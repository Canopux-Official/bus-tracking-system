import math
from pipeline.models import State

EARTH_RADIUS = 6371000

def latlon_to_xy(lat0, lon0, lat, lon):
    lat0, lon0, lat, lon = map(math.radians, [lat0, lon0, lat, lon])
    x = EARTH_RADIUS * (lon - lon0) * math.cos(lat0)
    y = EARTH_RADIUS * (lat - lat0)
    return x, y

def compute_heading(x1, y1, x2, y2):
    dx = x2 - x1
    dy = y2 - y1
    return math.atan2(dy, dx)

def process_gps_data(points):
    
    states = []

    lat0, lon0 = points[0][0], points[0][1]
    prev_x = prev_y = None

    for lat, lon, velocity, timestamp in points:
        x, y = latlon_to_xy(lat0, lon0, lat, lon)
        if prev_x is None:
            heading = 0.0
        else:
            heading = compute_heading(prev_x, prev_y, x, y)

        states.append(State(x, y, velocity, heading, omega=0.0, timestamp=timestamp))
        prev_x, prev_y = x, y

    return states