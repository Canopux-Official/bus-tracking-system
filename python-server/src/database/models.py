# src/database/models.py
from src import db
from sqlalchemy.dialects.postgresql import JSON
from datetime import datetime

class Bus(db.Model):
    __tablename__ = "buses"
    
    id = db.Column(db.Integer, primary_key=True)
    bus_number = db.Column(db.String, unique=True, nullable=False)
    source = db.Column(db.String, nullable=False)
    destination = db.Column(db.String, nullable=False)
    route = db.Column(JSON, nullable=False)
    current = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)