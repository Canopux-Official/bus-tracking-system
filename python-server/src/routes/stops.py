from flask import Blueprint, request, jsonify
from src import db
from src.database.bus import Bus
from src.crud.stops import get_or_create_route, pin_stop

stops_bp = Blueprint("stops", __name__)

@stops_bp.route("/api/trips/<trip_id>/pin-stop", methods=["POST"])
def pin_stop_route(trip_id: str):
    data = request.get_json()
    lat  = data.get("lat")
    lng  = data.get("lng")

    if lat is None or lng is None:
        return jsonify({"error": "lat and lng are required"}), 400

    trip = Bus.query.filter_by(tripId=trip_id).first()
    if not trip:
        return jsonify({"error": "Trip not found"}), 404

    route = get_or_create_route(trip.bus_number, trip.source, trip.destination)
    stop  = pin_stop(route, lat, lng)
    db.session.commit()

    return jsonify({"id": stop.id, "lat": stop.lat, "lng": stop.lng}), 201