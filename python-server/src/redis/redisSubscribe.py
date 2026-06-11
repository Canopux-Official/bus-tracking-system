# import json
# from src.redis.redisConnection import redis_client
# from src.redis.redisPublish import publish_to_redis
# from src.services.stopDetection import process_stop_detection
# from concurrent.futures import ThreadPoolExecutor

# executor = ThreadPoolExecutor(max_workers=20)  # adjust pool size

# def preprocess(raw_data):
#     """
#     Example preprocessing:
#     - Adjust coordinates slightly
#     - Add processed timestamp
#     """
#     raw_data['lat'] += 0.0001
#     raw_data['lon'] += 0.0001
#     raw_data['processed_at'] = redis_client.time()[0]  # current timestamp from Redis
#     return raw_data


# def subscribe_to_redis():
#     pubsub = redis_client.pubsub()
#     pubsub.subscribe("raw_location")
#     print("Subscribed to Redis channel: raw_location")

#     # for message in pubsub.listen():
#     #     if message['type'] == 'message':
#     #         raw_data = json.loads(message['data'])
#     #         # print("Raw data received:", raw_data)

#     #         processed_data = preprocess(raw_data)

#     #         # here i also need to add this in the database using the unique tripId

#     #         executor.submit(process_stop_detection, processed_data)

#     #         # Publish processed data
#     #         publish_to_redis(processed_data)


#     for message in pubsub.listen():
#         if message['type'] == 'message':
#             raw_data = json.loads(message['data'])
#             processed_data = preprocess(raw_data)

#             import time
#             t0 = time.time()
#             executor.submit(process_stop_detection, processed_data)
#             print(f"[timing] submit took {(time.time()-t0)*1000:.1f}ms")   # should be < 1ms

#             t1 = time.time()
#             publish_to_redis(processed_data)
#             print(f"[timing] publish took {(time.time()-t1)*1000:.1f}ms")  # should be < 5ms



# src/redis/redisSubscribe.py
#
# WHAT CHANGED:
#   Before: called process_stop_detection() on every ping → slow DB ops during trip
#   After:  just stores each ping in a Redis list (RPUSH) → zero DB calls during trip
#
# The Redis list key is:  trip:{tripId}:locs
# It holds every raw ping for the trip as a JSON string.
# When the trip ends, the Node server calls /bus/end-trip/:tripId,
# which triggers process_trip_stops() to read + analyse the whole list at once.

# import json
# from src.redis.redisConnection import redis_client
# from src.redis.redisPublish import publish_to_redis

# from collections import defaultdict
# from src.pipeline.preprocessing import process_gps_data, xy_to_latlon
# from src.pipeline.ekf import run_ekf

# LOCATION_TTL_SECONDS = 7200


# bus_buffers = defaultdict(list)
# bus_origin = {}


# def preprocess(raw_data):

#     bus_id = raw_data["tripId"]

#     point = (
#         raw_data["lat"],
#         raw_data["lon"],
#         raw_data.get("velocity", 0),
#         raw_data.get("timestamp", redis_client.time()[0]),
#         raw_data.get("accuracy", 8.0)
#     )

#     # -------------------------
#     # Store origin (first GPS)
#     # -------------------------
#     if bus_id not in bus_origin:
#         bus_origin[bus_id] = (point[0], point[1])

#     # -------------------------
#     # Add to buffer
#     # -------------------------
#     bus_buffers[bus_id].append(point)

#     # Keep last 20 points only
#     if len(bus_buffers[bus_id]) > 20:
#         bus_buffers[bus_id].pop(0)

#     # -------------------------
#     # Need minimum data
#     # -------------------------
#     if len(bus_buffers[bus_id]) < 3:
#         return None

#     # -------------------------
#     # Run preprocessing + EKF
#     # -------------------------
#     states = process_gps_data(bus_buffers[bus_id])
#     filtered_states = run_ekf(states)

#     latest = filtered_states[-1]

#     # -------------------------
#     # Convert back to lat/lon
#     # -------------------------
#     lat0, lon0 = bus_origin[bus_id]
#     lat, lon = xy_to_latlon(lat0, lon0, latest.x, latest.y)

#     return {
#         "tripId": bus_id,
#         "lat": lat,
#         "lon": lon,
#         "velocity": latest.velocity,
#         "heading": latest.heading,
#         "timestamp": latest.timestamp,
#         "processed_at": redis_client.time()[0]
#     }

# res = []

# def subscribe_to_redis():
#     pubsub = redis_client.pubsub()
#     pubsub.subscribe("raw_location")
#     print("Subscribed to Redis channel: raw_location")

#     for message in pubsub.listen():
#         if message['type'] == 'message':
#             raw_data = json.loads(message['data'])
#             # print(raw_data)


#             processed_data = preprocess(raw_data)
#             # processed_data = raw_data

#             if processed_data is None:
#                 continue   

#             # ── Store ping in Redis list ──────────────────────────────────────
#             # RPUSH appends to the right of the list — O(1), very fast.
#             # We only store the 4 fields we need for stop detection.
#             # No DB call. No threading. Just one Redis write.
#             trip_id = processed_data.get("tripId")
#             if trip_id:
#                 key = f"trip:{trip_id}:locs"
#                 redis_client.rpush(key, json.dumps({
#                     "lat": processed_data["lat"],
#                     "lon": processed_data["lon"],
#                     "ts":  processed_data["processed_at"],
#                 }))
#                 # Reset TTL on every ping so the key stays alive during long trips
#                 redis_client.expire(key, LOCATION_TTL_SECONDS)
            
#             # # print(processed_data)

#             # d = {}
#             # d["lat"] = [raw_data['lat'],processed_data['lat']]
#             # d["lon"] = [raw_data['lon'],processed_data['lon']]
#             # res.append(d)

#             # print(f"comparsion {res}")

#             if processed_data:
#                 publish_to_redis(processed_data)


import json
import os
import httpx
from src.redis.redisConnection import redis_client
from src.redis.redisPublish import publish_to_redis
from dotenv import load_dotenv

load_dotenv()  # load .env variables

LOCATION_TTL_SECONDS = 7200
LOCATIONIQ_TOKEN = os.getenv("LOCATIONIQ_TOKEN")
LOCATIONIQ_MATCH_URL = os.getenv("LOCATION_MATCH_URL")

# Sliding window of raw points per trip for map matching
bus_raw_window = {}
MATCH_WINDOW_SIZE = 2


def snap_to_road(window: list[dict]) -> tuple[float, float] | None:
    if len(window) < 2:
        return None

    try:
        coords = ";".join(f"{p['lon']},{p['lat']}" for p in window)
        url = f"https://us1.locationiq.com/v1/matching/driving/{coords}"

        # ✅ Convert ms → seconds if needed (LocationIQ requires Unix seconds)
        def to_seconds(ts):
            t = int(ts)
            return t // 1000 if t > 1_000_000_000_000 else t

        ts_list = [to_seconds(p["ts"]) for p in window]

        params = {
            "key":         LOCATIONIQ_TOKEN,
            "timestamps":  ";".join(str(t) for t in ts_list),
            "radiuses":    ";".join("15" for _ in window),
            "geometries":  "geojson",
            "annotations": "false",
            "overview":    "false",
        }

        response = httpx.get(url, params=params, timeout=5.0)
        response.raise_for_status()
        data = response.json()

        tracepoints = data.get("tracepoints", [])
        if not tracepoints:
            return None

        last_tp = tracepoints[-1]
        if last_tp is None:
            return None

        snapped_lon, snapped_lat = last_tp["location"]
        return snapped_lat, snapped_lon

    except httpx.HTTPStatusError as e:
        print(f"[map_match] HTTP error {e.response.status_code}: {e.response.text}")
        return None
    except Exception as e:
        print(f"[map_match] Unexpected error: {e}")
        return None


def subscribe_to_redis():
    pubsub = redis_client.pubsub()
    pubsub.subscribe("raw_location")
    print("Subscribed to Redis channel: raw_location")

    for message in pubsub.listen():
        if message['type'] != 'message':
            continue

        raw_data = json.loads(message['data'])

        trip_id = raw_data.get("tripId")
        if not trip_id:
            continue

        ts = raw_data.get("timestamp", redis_client.time()[0])

        # ── 1. Append new point to window ─────────────────────────────────────
        if trip_id not in bus_raw_window:
            bus_raw_window[trip_id] = []

        window = bus_raw_window[trip_id]
        window.append({
            "lat": raw_data["lat"],
            "lon": raw_data["lon"],
            "ts":  ts,
        })
        if len(window) > MATCH_WINDOW_SIZE:
            window.pop(0)

        # ── 2. Snap to road — called on EVERY ping, no waiting ────────────────
        # Window gives LocationIQ directional context for better accuracy,
        # but we always publish immediately using the LATEST point's snapped pos.
        # Even with window size 1 (first ping), snap_to_road handles it by
        # falling back to raw, so there's zero delay ever.
        snapped = snap_to_road(window)

        if snapped:
            lat, lon = snapped
            map_matched = True
            print(
                f"[map_match] {trip_id} "
                f"raw({raw_data['lat']:.6f},{raw_data['lon']:.6f}) → "
                f"road({lat:.6f},{lon:.6f})"
            )
        else:
            lat, lon = raw_data["lat"], raw_data["lon"]
            map_matched = False
            print(f"[map_match] {trip_id} — falling back to raw GPS")

        # ── 3. Build output payload ───────────────────────────────────────────
        processed_data = {
            "tripId":      trip_id,
            "lat":         lat,
            "lon":         lon,
            "velocity":    raw_data.get("vel", 0),
            "timestamp":   ts,
            "map_matched": map_matched,
        }

        # ── 4. Store + publish immediately ────────────────────────────────────
        key = f"trip:{trip_id}:locs"
        redis_client.rpush(key, json.dumps({"lat": lat, "lon": lon, "ts": ts}))
        redis_client.expire(key, LOCATION_TTL_SECONDS)

        publish_to_redis(processed_data)