import json
from src.redis.redisConnection import redis_client
from src.redis.redisPublish import publish_to_redis

from collections import defaultdict
from src.pipeline.preprocessing import process_gps_data, xy_to_latlon
from src.pipeline.ekf import run_ekf


bus_buffers = defaultdict(list)
bus_origin = {}


def preprocess(raw_data):

    bus_id = raw_data["tripId"]

    point = (
        raw_data["lat"],
        raw_data["lon"],
        raw_data.get("velocity", 0),
        raw_data.get("timestamp", redis_client.time()[0]),
        raw_data.get("accuracy", 8.0)
    )

    # -------------------------
    # Store origin (first GPS)
    # -------------------------
    if bus_id not in bus_origin:
        bus_origin[bus_id] = (point[0], point[1])

    # -------------------------
    # Add to buffer
    # -------------------------
    bus_buffers[bus_id].append(point)

    # Keep last 20 points only
    if len(bus_buffers[bus_id]) > 20:
        bus_buffers[bus_id].pop(0)

    # -------------------------
    # Need minimum data
    # -------------------------
    if len(bus_buffers[bus_id]) < 3:
        return None

    # -------------------------
    # Run preprocessing + EKF
    # -------------------------
    states = process_gps_data(bus_buffers[bus_id])
    filtered_states = run_ekf(states)

    latest = filtered_states[-1]

    # -------------------------
    # Convert back to lat/lon
    # -------------------------
    lat0, lon0 = bus_origin[bus_id]
    lat, lon = xy_to_latlon(lat0, lon0, latest.x, latest.y)

    return {
        "bus_id": bus_id,
        "lat": lat,
        "lon": lon,
        "velocity": latest.velocity,
        "heading": latest.heading,
        "timestamp": latest.timestamp,
        "processed_at": redis_client.time()[0]
    }


def subscribe_to_redis():
    pubsub = redis_client.pubsub()
    pubsub.subscribe("raw_location")
    print("Subscribed to Redis channel: raw_location")

    for message in pubsub.listen():
        if message['type'] == 'message':
            raw_data = json.loads(message['data'])
            print("Raw data received:", raw_data)

            processed_data = preprocess(raw_data)

            # here i also need to add this in the database using the unique tripId

            if processed_data:
                publish_to_redis(processed_data)


