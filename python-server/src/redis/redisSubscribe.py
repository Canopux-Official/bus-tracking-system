import json
from src.redis.redisConnection import redis_client
from src.redis.redisPublish import publish_to_redis

def preprocess(raw_data):
    """
    Example preprocessing:
    - Adjust coordinates slightly
    - Add processed timestamp
    """
    raw_data['lat'] += 0.0001
    raw_data['lon'] += 0.0001
    raw_data['processed_at'] = redis_client.time()[0]  # current timestamp from Redis
    return raw_data


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

            # Publish processed data
            publish_to_redis(processed_data)