# src/routes/bus.py  (or wherever your Flask routes live)
from flask import jsonify,Blueprint
from concurrent.futures import ThreadPoolExecutor
from src.services.stopDetection import process_trip_stops


bp = Blueprint("bus", __name__)

_executor = ThreadPoolExecutor(max_workers=4)



@bp.route("/internal/process-stops/<trip_id>", methods=["POST"])
def trigger_stop_processing(trip_id):
    # Fires in background — responds instantly
    print("Running ")
    _executor.submit(process_trip_stops, trip_id)
    return jsonify({"message": "processing started"}), 200