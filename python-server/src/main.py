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
import os
import threading
from src import create_app, db
from src.database.models import Bus
from src.redis.redisSubscribe import subscribe_to_redis

app = create_app()

# For dev only: create tables automatically
with app.app_context():
    db.create_all()

# Run Redis subscriber in a separate thread
def start_redis_listener():
    subscribe_to_redis()

t = threading.Thread(target=start_redis_listener)
t.daemon = True  # ensures thread exits when main process exits
t.start()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Render assigns PORT
    app.run(debug=False, host="0.0.0.0", port=port)