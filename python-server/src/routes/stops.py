from flask import Blueprint, request, jsonify
from src.crud.stops import get_place_name
import requests
import os

stops_bp = Blueprint("stops", __name__)

NODE_URL = os.getenv("NODE_URL", "http://localhost:4000")


@stops_bp.route("/api/trips/<trip_id>/pin-stop", methods=["POST"])
def pin_stop_route(trip_id: str):
    data = request.get_json()
    lat  = data.get("lat")
    lng  = data.get("lng")
    
    print(f"[pin_stop] received: tripId={trip_id}, lat={lat}, lng={lng}")

    if lat is None or lng is None:
        return jsonify({"error": "lat and lng are required"}), 400

    # Removed: stop_name = get_place_name(lat, lng)

    try:
        node_res = requests.patch(
            f"{NODE_URL}/bus/trip/{trip_id}/route",
            json={"lat": lat, "lng": lng},  # send coordinates instead of stop_name
            timeout=5
        )
        print(f"[pin_stop] Node status: {node_res.status_code}")
        print(f"[pin_stop] Node response: {node_res.text}")
        node_data = node_res.json()
    except Exception as e:
        print(f"[pin_stop] Node call failed: {e}")
        return jsonify({"error": "Failed to update route on Node"}), 502

    return jsonify({
        "skipped": node_data.get("skipped", False),
        "route":   node_data.get("route", []),
        "lat":     lat,
        "lng":     lng,
    }), 200