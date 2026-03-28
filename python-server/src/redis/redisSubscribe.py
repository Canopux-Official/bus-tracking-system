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

import json
from src.redis.redisConnection import redis_client
from src.redis.redisPublish import publish_to_redis

# How long to keep the location list in Redis after the trip ends.
# 2 hours is enough — processing happens immediately on end-trip.
LOCATION_TTL_SECONDS = 7200


def preprocess(raw_data):
    raw_data['lat'] += 0.0001
    raw_data['lon'] += 0.0001
    raw_data['processed_at'] = redis_client.time()[0]
    return raw_data


def subscribe_to_redis():
    pubsub = redis_client.pubsub()
    pubsub.subscribe("raw_location")
    print("Subscribed to Redis channel: raw_location")

    for message in pubsub.listen():
        if message['type'] == 'message':
            raw_data = json.loads(message['data'])

            processed_data = preprocess(raw_data)

            # ── Store ping in Redis list ──────────────────────────────────────
            # RPUSH appends to the right of the list — O(1), very fast.
            # We only store the 4 fields we need for stop detection.
            # No DB call. No threading. Just one Redis write.
            trip_id = processed_data.get("tripId")
            if trip_id:
                key = f"trip:{trip_id}:locs"
                redis_client.rpush(key, json.dumps({
                    "lat": processed_data["lat"],
                    "lon": processed_data["lon"],
                    "ts":  processed_data["processed_at"],
                }))
                # Reset TTL on every ping so the key stays alive during long trips
                redis_client.expire(key, LOCATION_TTL_SECONDS)

            # ── Publish to Node server as before ─────────────────────────────
            publish_to_redis(processed_data)