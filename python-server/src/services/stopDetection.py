# from src import db
# from src.crud.stops import get_or_create_route, upsert_stop

# # ─── Thresholds — adjust based on real-world testing ─────────────────────────

# DWELL_THRESHOLD_SEC = 50
# # 5 min stationary → candidate stop.
# # Why 5 min? Traffic max is 3-4 min. Real stops are longer.
# # Raise to 420 if you still see traffic jams being counted as stops.

# MOVE_RADIUS_METERS = 20
# # Bus moved more than this → it left the anchor, reset dwell timer.
# # 20m absorbs GPS noise (typically ±5-15m) without masking real movement.

# # ─── In-memory dwell state ────────────────────────────────────────────────────
# # Keyed by trip_id. Updated every 10 seconds. Never written to Redis or DB.
# # Cleared when trip ends via clear_trip_state().
# #
# # { "tripId_abc": {
# #     "bus_id":      "BUS_42",       ← fetched from DB once, then stays here
# #     "source":      "Bhubaneswar",
# #     "destination": "Cuttack",
# #     "anchor_lat":  20.2941,        ← position where bus first went still
# #     "anchor_lng":  85.7446,
# #     "dwell_sec":   180,            ← seconds accumulated near anchor
# # } }
# _dwell_state: dict = {}

# # Flask app reference — set once via init_detection() at startup
# _app = None


# def init_detection(app):
#     """
#     Call this once in main.py before starting the Redis thread.
#     Stores the Flask app so the background thread can use app_context().

#     In main.py add:
#         from src.services.stopDetection import init_detection
#         init_detection(app)
#     """
#     global _app
#     _app = app


# def _fetch_trip_meta(trip_id: str) -> dict | None:
#     """
#     Fetches bus_id, source, destination for a trip from your database.
#     Called ONCE per trip on the first ping. Result is cached in _dwell_state.

#     WHAT TO CHANGE HERE:
#         Replace `Bus` with whichever model holds your trip/route data.
#         Replace `.trip_id`, `.bus_id`, `.source`, `.destination` with
#         your actual column names.

#     We use app.app_context() because this runs in a background thread,
#     not inside a Flask request.
#     """
#     if not _app:
#         print("[stopDetection] app not initialised — call init_detection(app) in main.py")
#         return None

#     try:
#         with _app.app_context():
#             # ── ADJUST THIS QUERY TO MATCH YOUR MODEL ────────────────────────
#             # Your Bus or Trip model must have: bus_id, source, destination
#             # If your model is called Trip and has field names busId / src / dst,
#             # update the three lines below accordingly.
#             from src.database.bus import Bus
#             trip = Bus.query.filter_by(tripId=trip_id).first()

#             if not trip:
#                 print(f"[stopDetection] trip {trip_id} not found")
#                 return None

#             return {
#                 "bus_id":      trip.bus_number,       # ← change to your field name
#                 "source":      trip.source,        # ← change to your field name
#                 "destination": trip.destination,   # ← change to your field name
#             }
#     except Exception as e:
#         print(f"[stopDetection] error fetching trip meta: {e}")
#         return None


# def process_stop_detection(data: dict):
#     """
#     Main entry point — called on every ping from redisSubscribe.py.

#     FAST PATH  (most pings): pure dict/arithmetic, no I/O
#     INIT PATH  (first ping): one DB SELECT for trip meta
#     WRITE PATH (stop found): two SELECTs + one INSERT or UPDATE
#     """
#     print(data)
#     trip_id = data.get("tripId")
#     lat     = data.get("lat")
#     lng     = data.get("lon")

#     if not all([trip_id, lat is not None, lng is not None]):
#         return

#     state = _dwell_state.get(trip_id)
#     print(state)

#     # ── First ping for this trip ──────────────────────────────────────────────
#     if not state:
#         meta = _fetch_trip_meta(trip_id)
#         if not meta:
#             return

#         _dwell_state[trip_id] = {
#             **meta,               # unpacks bus_id, source, destination
#             "anchor_lat": lat,
#             "anchor_lng": lng,
#             "dwell_sec":  0,
#         }
#         print(_dwell_state[trip_id])
#         return   # first ping just sets the anchor — nothing to compare yet

#     # ── All subsequent pings ──────────────────────────────────────────────────
#     import math
#     R = 6_371_000
#     phi1, phi2 = math.radians(state["anchor_lat"]), math.radians(lat)
#     dphi = math.radians(lat - state["anchor_lat"])
#     dlam = math.radians(lng - state["anchor_lng"])
#     a = (math.sin(dphi / 2) ** 2
#          + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2)
#     dist = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

#     if dist > MOVE_RADIUS_METERS:
#         # Bus moved — reset anchor and dwell timer
#         state["anchor_lat"] = lat
#         state["anchor_lng"] = lng
#         state["dwell_sec"]  = 0

#     else:
#         # Bus still near anchor — add 10 seconds (one ping interval)
#         state["dwell_sec"] += 10

#         if state["dwell_sec"] >= DWELL_THRESHOLD_SEC:
#             print(
#                 f"[stopDetection] trip {trip_id} stopped 5+ min at "
#                 f"({state['anchor_lat']:.5f}, {state['anchor_lng']:.5f})"
#             )
#             _save_stop(state)
#             state["dwell_sec"] = 0   # reset so same stop isn't saved every 10s


# def _save_stop(state: dict):
#     """
#     Writes the stop to DB inside an app context.
#     Separated into its own function to keep process_stop_detection readable.
#     """
#     if not _app:
#         return

#     try:
#         with _app.app_context():
#             route = get_or_create_route(
#                 state["bus_id"],
#                 state["source"],
#                 state["destination"]
#             )
#             upsert_stop(route, state["anchor_lat"], state["anchor_lng"])
#             db.session.commit()
#     except Exception as e:
#         db.session.rollback()
#         print(f"[stopDetection] DB error: {e}")


# def clear_trip_state(trip_id: str):
#     """
#     Call this when a trip ends to free memory.
#     Hook it up to your trip-end API route or wherever trips are closed.

#     Example in a Flask route:
#         from src.services.stopDetection import clear_trip_state
#         clear_trip_state(trip_id)
#     """
#     if _dwell_state.pop(trip_id, None):
#         print(f"[stopDetection] cleared state for trip {trip_id}")



# src/services/stopDetection.py
#
# THE FIX:
#   Before: _get_conn() called psycopg2.connect() every time a stop was detected.
#           Creating a new PostgreSQL connection = 100-500ms every time.
#           This blocked the thread and backed up the queue.
#
#   After:  One connection pool created at startup (pool size = 5).
#           Each DB operation borrows a connection from the pool (< 1ms),
#           uses it, and returns it immediately.
#           The pool keeps connections warm and reuses them.
#
# YOUR subscribe_to_redis already uses ThreadPoolExecutor — that part is correct.
# The bottleneck was purely the cold connection creation, not the queries themselves.

# src/services/stopDetection.py
#
# COMPLETELY REWRITTEN — batch mode only.
# This is now called ONCE when a trip ends, not on every ping.
#
# WHAT process_trip_stops() DOES:
#   1. Fetch all pings for this trip from Redis (LRANGE = one Redis call)
#   2. Walk through them in order, running dwell detection in pure Python
#      (no DB, no network — just a loop over a list)
#   3. Collect candidate stops (positions where bus was still for 50+ sec)
#   4. Write all of them to DB in one session (bulk upsert)
#   5. Delete the Redis list — it is no longer needed
#
# RESULT:
#   During trip  → zero DB calls, zero slow operations
#   On trip end  → one Redis read + one DB session with N writes
#                  runs in background thread so end-trip API responds instantly

import math
import json
from datetime import datetime, timezone

from src import db
from src.crud.stops import get_or_create_route, upsert_stop

DWELL_THRESHOLD_SEC = 50    # set to 300 in production
MOVE_RADIUS_METERS  = 20

_app = None


def init_detection(app):
    global _app
    _app = app


def _haversine_meters(lat1, lng1, lat2, lng2):
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = (math.sin(dphi / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _extract_stops_from_pings(pings: list[dict]) -> list[tuple[float, float]]:
    """
    Pure Python dwell detection — no DB, no network, just a loop.
    Walks through the ping list and returns a list of (lat, lng) tuples
    where the bus was stationary for DWELL_THRESHOLD_SEC or more.

    HOW IT WORKS (same logic as before, but offline):
      - anchor = position where bus first went still
      - dwell_sec accumulates while bus stays within MOVE_RADIUS_METERS of anchor
      - when dwell_sec crosses threshold → record as candidate stop, reset
      - when bus moves away → reset anchor to new position

    Each ping represents 10 seconds (your send interval).
    """
    if not pings:
        return []

    candidate_stops: list[tuple[float, float]] = []

    anchor_lat = pings[0]["lat"]
    anchor_lng = pings[0]["lon"]
    dwell_sec  = 0

    for ping in pings[1:]:
        lat = ping["lat"]
        lng = ping["lon"]

        dist = _haversine_meters(anchor_lat, anchor_lng, lat, lng)

        if dist > MOVE_RADIUS_METERS:
            # Bus moved — reset anchor
            anchor_lat = lat
            anchor_lng = lng
            dwell_sec  = 0
        else:
            # Bus still near anchor — accumulate 10s
            dwell_sec += 10
            if dwell_sec >= DWELL_THRESHOLD_SEC:
                candidate_stops.append((anchor_lat, anchor_lng))
                print(f"[stopDetection] stop found at ({anchor_lat:.5f}, {anchor_lng:.5f})")
                # Reset dwell so same stop isn't added multiple times
                dwell_sec = 0

    return candidate_stops


def process_trip_stops(trip_id: str):
    """
    Called ONCE when a trip ends.
    Runs in a background thread so the end-trip API response is instant.

    Steps:
      1. Fetch all pings from Redis
      2. Detect stops in pure Python
      3. Bulk write to DB
      4. Clean up Redis key
    """
    if not _app:
        print("[stopDetection] app not initialised")
        return

    from src.redis.redisConnection import redis_client

    key = f"trip:{trip_id}:locs"

    # ── Step 1: Fetch all pings from Redis ────────────────────────────────────
    # LRANGE key 0 -1 = get entire list, one round trip to Redis
    raw_pings = redis_client.lrange(key, 0, -1)
    if not raw_pings:
        print(f"[stopDetection] no pings found for trip {trip_id}")
        return

    pings = [json.loads(p) for p in raw_pings]
    print(f"[stopDetection] processing {len(pings)} pings for trip {trip_id}")

    # ── Step 2: Pure Python stop detection ───────────────────────────────────
    candidate_stops = _extract_stops_from_pings(pings)

    if not candidate_stops:
        print(f"[stopDetection] no stops found for trip {trip_id}")
        redis_client.delete(key)
        return

    print(f"[stopDetection] {len(candidate_stops)} stop(s) found — writing to DB")

    # ── Step 3: Fetch trip meta + bulk write to DB ────────────────────────────
    try:
        with _app.app_context():
            from src.database.bus import Bus
            trip = Bus.query.filter_by(tripId=trip_id).first()
            if not trip:
                print(f"[stopDetection] trip {trip_id} not found in DB")
                redis_client.delete(key)
                return

            # get_or_create_route once for this trip
            route = get_or_create_route(
                trip.bus_number,
                trip.source,
                trip.destination
            )

            # upsert every candidate stop — all in one session/transaction
            for lat, lng in candidate_stops:
                upsert_stop(route, lat, lng)

            db.session.commit()
            print(f"[stopDetection] committed {len(candidate_stops)} stop(s) for trip {trip_id}")

    except Exception as e:
        db.session.rollback()
        print(f"[stopDetection] DB error: {e}")

    # ── Step 4: Clean up Redis list ───────────────────────────────────────────
    redis_client.delete(key)
    print(f"[stopDetection] cleaned up Redis key {key}")