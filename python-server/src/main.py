# # src/main.py
# from src import create_app,db
# from src.database.models import Bus
# from src.redis.redisSubscribe import subscribe_to_redis

# app = create_app()

# # For dev only: create tables automatically
# with app.app_context():
#     db.create_all()

# if __name__ == "__main__":
#     subscribe_to_redis()
#     app.run(debug=True, host="0.0.0.0", port=5000)


# src/main.py
# import os
# import threading
# from src import create_app, db
# from src.database.models import Bus
# from src.redis.redisSubscribe import subscribe_to_redis

# app = create_app()

# # For dev only: create tables automatically
# with app.app_context():
#     db.create_all()

# # Run Redis subscriber in a separate thread
# def start_redis_listener():
#     subscribe_to_redis()

# t = threading.Thread(target=start_redis_listener)
# t.daemon = True  # ensures thread exits when main process exits
# t.start()

# if __name__ == "__main__":
#     port = int(os.environ.get("PORT", 5000))  # Render assigns PORT
#     app.run(debug=False, host="0.0.0.0", port=port)


# main.py — YOUR EXISTING FILE with 2 small additions (marked ← ADD)
#
# Nothing is removed or changed. Two lines added only.

# import os
# import threading
# from src import create_app, db
# from src.database.bus import Bus
# from src.database.stops import RouteStop, StopObservation   # ← ADD (so db.create_all sees them)
# from src.redis.redisSubscribe import subscribe_to_redis
# from src.services.stopDetection import init_detection       # ← ADD

# app = create_app()

# with app.app_context():
#     db.create_all()
#     # db.create_all() now also creates route_stops and stop_observations
#     # because we imported them above — SQLAlchemy discovers them via the import

# init_detection(app)     # ← ADD — gives stopDetection the app for app_context()

# def start_redis_listener():
#     subscribe_to_redis()

# t = threading.Thread(target=start_redis_listener)
# t.daemon = True
# t.start()

# if __name__ == "__main__":
#     port = int(os.environ.get("PORT", 5000))
#     app.run(debug=False, host="0.0.0.0", port=port)


# main.py — changes from your current version
#
# REMOVE the ThreadPoolExecutor from redisSubscribe (no longer needed there)
# KEEP init_detection(app) — still needed for the end-trip batch processing

import os
import threading
from src import create_app, db
from src.database.bus import Bus
from src.database.stops import RouteStop, StopObservation
from src.redis.redisSubscribe import subscribe_to_redis
from src.services.stopDetection import init_detection

app = create_app()

with app.app_context():
    db.create_all()

init_detection(app)

def start_redis_listener():
    subscribe_to_redis()

t = threading.Thread(target=start_redis_listener)
t.daemon = True
t.start()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)