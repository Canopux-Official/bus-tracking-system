# src/routes/bus.py
from flask import Blueprint, jsonify, request
from src.crud import bus as crud_bus

bp = Blueprint("bus", __name__, url_prefix="/buses")

@bp.route("/getallbuses", methods=["GET"])
def get_buses():
    buses = crud_bus.get_all_buses()
    result = [
        {
            "id": b.id,
            "bus_number": b.bus_number,
            "source": b.source,
            "destination": b.destination,
            "route": b.route,
            "current": b.current
        }
        for b in buses
    ]
    return jsonify(result)

@bp.route("/", methods=["POST"])
def create_new_bus():
    data = request.json
    bus = crud_bus.create_bus(data)
    return jsonify({
        "id": bus.id,
        "bus_number": bus.bus_number,
        "source": bus.source,
        "destination": bus.destination,
        "route": bus.route,
        "current": bus.current
    })