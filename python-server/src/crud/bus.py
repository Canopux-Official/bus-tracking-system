# src/crud/bus.py
from src.database.bus import Bus
from src import db

def get_all_buses():
    return Bus.query.all()

def get_bus_by_id(bus_id):
    return Bus.query.get(bus_id)

def create_bus(data):
    new_bus = Bus(**data)
    db.session.add(new_bus)
    db.session.commit()
    return new_bus