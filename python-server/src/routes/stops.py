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





@stops_bp.route("/api/trips/<trip_id>/stops", methods=["GET"])
def get_stops(trip_id: str):
    trip = Bus.query.filter_by(tripId=trip_id).first()
    if not trip:
        return jsonify({"error": "Trip not found"}), 404

    # Look up by bus_number + source + destination, NOT tripId
    route = RouteStop.query.filter_by(
        bus_id=trip.bus_number,
        source=trip.source,
        destination=trip.destination
    ).first()

    if not route:
        return jsonify({"stops": []}), 200

    stops = [
        {
            "id": s.id,
            "lat": s.lat,
            "lng": s.lng,
            "name": s.name,
            "pinned_at": s.pinned_at.isoformat(),
        }
        for s in route.observations
    ]

    return jsonify({
        "bus_number": trip.bus_number,
        "source": trip.source,
        "destination": trip.destination,
        "stops": stops
    }), 200