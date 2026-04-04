import math
from datetime import datetime, timezone
from src import db
from src.database.stops import RouteStop, StopObservation

MATCH_RADIUS_METERS = 30    # two positions within this = same stop


def _haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    True straight-line distance between two GPS points in metres.
    Used to decide if two stop observations are at the same physical location.
    """
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = (math.sin(dphi / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_or_create_route(bus_id: str, source: str, destination: str) -> RouteStop:
    """
    Returns the RouteStop row for (bus_id, source, destination).
    Creates it if it does not exist yet.

    Called once per stop event (when bus dwells 5+ min).
    Fast because the composite index on (bus_id, source, destination)
    makes the SELECT hit an index instead of scanning the whole table.
    """
    route = RouteStop.query.filter_by(
        bus_id=bus_id,
        source=source,
        destination=destination
    ).first()

    if route:
        return route

    # First time this route has ever been seen — create the folder row
    route = RouteStop(bus_id=bus_id, source=source, destination=destination)
    db.session.add(route)
    db.session.flush()  # flush assigns the id without committing yet,
                        # so we can use route.id in upsert_stop below
                        # within the same transaction
    return route


def upsert_stop(route_stop: RouteStop, lat: float, lng: float):
    """
    The cross-trip matching logic.

    Loads all known stops for this route, checks if any are within
    MATCH_RADIUS_METERS of the new position.

    MATCH FOUND (same stop, seen before):
        - counter += 1  (confidence increases)
        - lat/lng updated via weighted average (centroid stabilises)
        - last_seen updated

    NO MATCH (new location):
        - Insert fresh row with counter = 1

    WEIGHTED AVERAGE:
        weight = 1 / (counter + 1)
        new_lat = old_lat * (1 - weight) + current_lat * weight

        counter=1  → weight=0.50  (centroid moves a lot, still uncertain)
        counter=10 → weight=0.09  (centroid barely moves, converging)
        counter=30 → weight=0.03  (essentially fixed)

    This means the stop location converges to the true bus stop position
    over several trips and stops drifting around.
    """
    existing = StopObservation.query.filter_by(
        route_stop_id=route_stop.id
    ).all()

    matched: StopObservation | None = None
    for obs in existing:
        if _haversine_meters(obs.lat, obs.lng, lat, lng) <= MATCH_RADIUS_METERS:
            matched = obs
            break

    now = datetime.now(timezone.utc)

    if matched:
        weight      = 1 / (matched.counter + 1)
        matched.lat = matched.lat * (1 - weight) + lat * weight
        matched.lng = matched.lng * (1 - weight) + lng * weight
        matched.counter  += 1
        matched.last_seen = now
        # Flask-SQLAlchemy tracks changes automatically — no need to db.session.add()
        print(f"[stops] updated stop → counter={matched.counter} "
              f"at ({matched.lat:.5f}, {matched.lng:.5f})")
    else:
        new_obs = StopObservation(
            route_stop_id=route_stop.id,
            lat=lat,
            lng=lng,
            counter=1,
            first_seen=now,
            last_seen=now,
        )
        db.session.add(new_obs)
        print(f"[stops] new stop at ({lat:.5f}, {lng:.5f})")