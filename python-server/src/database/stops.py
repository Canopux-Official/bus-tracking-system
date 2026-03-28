

from src import db

class RouteStop(db.Model):
    __tablename__ = "route_stops"

    id          = db.Column(db.String, primary_key=True,
                            default=lambda: str(__import__('uuid').uuid4()))
    bus_id      = db.Column(db.String(100), nullable=False)
    source      = db.Column(db.String(200), nullable=False)
    destination = db.Column(db.String(200), nullable=False)
    created_at  = db.Column(db.DateTime, server_default=db.func.now(), nullable=False)
    updated_at  = db.Column(db.DateTime, server_default=db.func.now(),
                            onupdate=db.func.now(), nullable=False)

    # One RouteStop → many StopObservations
    # cascade="all, delete-orphan": deleting a RouteStop also deletes
    # all its child StopObservations automatically
    observations = db.relationship(
        "StopObservation",
        backref="route_stop",
        cascade="all, delete-orphan",
        lazy="select"
    )

    __table_args__ = (
        # Composite index so the query
        # "find route for bus_id + source + destination"
        # does not do a full table scan
        db.Index("idx_route_stops_bus_src_dst", "bus_id", "source", "destination"),
    )

    def __repr__(self):
        return f"<RouteStop {self.bus_id} {self.source}→{self.destination}>"


# ─────────────────────────────────────────────────────────────────────────────
# StopObservation — one row per distinct physical stop on a route
#
# Bus 42 on Bhubaneswar→Cuttack might have 8 rows here,
# one for each bus stop it regularly uses.
#
# FIELDS:
#   lat / lng   centroid of all observed positions. Starts at first sighting,
#               drifts slowly toward true centre using weighted average.
#               Stabilises after ~10 trips.
#
#   counter     how many separate trip sessions stopped here.
#               1  = could be traffic/hotel/breakdown
#               5  = probably a real stop
#               15 = confirmed stop, safe to show on map
#
#   first_seen  first ever detection
#   last_seen   most recent confirmation (to detect retired stops later)
# ─────────────────────────────────────────────────────────────────────────────
class StopObservation(db.Model):
    __tablename__ = "stop_observations"

    id            = db.Column(db.String, primary_key=True,
                               default=lambda: str(__import__('uuid').uuid4()))
    route_stop_id = db.Column(
        db.String,
        db.ForeignKey("route_stops.id", ondelete="CASCADE"),
        nullable=False
    )
    lat        = db.Column(db.Float, nullable=False)
    lng        = db.Column(db.Float, nullable=False)
    counter    = db.Column(db.Integer, nullable=False, default=1)
    first_seen = db.Column(db.DateTime, server_default=db.func.now(), nullable=False)
    last_seen  = db.Column(db.DateTime, server_default=db.func.now(), nullable=False)

    __table_args__ = (
        db.Index("idx_stop_obs_route_stop_id", "route_stop_id"),
    )

    def __repr__(self):
        return f"<StopObservation ({self.lat:.5f}, {self.lng:.5f}) counter={self.counter}>"