# src/__init__.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    app.config.from_object("src.config.Config")
    
    db.init_app(app)
    
    # Import and register routes
    from src.routes import bus
    app.register_blueprint(bus.bp)
    
    return app