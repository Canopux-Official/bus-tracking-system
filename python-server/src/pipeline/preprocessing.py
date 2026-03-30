import math
from src.pipeline.models import State

EARTH_RADIUS = 6371000  # meters


def latlon_to_xy(lat0, lon0, lat, lon):
    lat0, lon0, lat, lon = map(math.radians, [lat0, lon0, lat, lon])
    x = EARTH_RADIUS * (lon - lon0) * math.cos(lat0)
    y = EARTH_RADIUS * (lat - lat0)
    return x, y


def compute_heading(x1, y1, x2, y2):
    dx = x2 - x1
    dy = y2 - y1
    return math.atan2(dy, dx)


def normalize_angle(angle):
    """
    Keep angle between -pi and pi
    """
    return (angle + math.pi) % (2 * math.pi) - math.pi


def process_gps_data(points):
    
    states = []

    lat0, lon0 = points[0][0], points[0][1]

    prev_x = prev_y = None
    prev_heading = None
    prev_time = None

    for point in points:

        
        if len(point) == 5:
            lat, lon, velocity, timestamp, accuracy = point
        else:
            lat, lon, velocity, timestamp = point
            accuracy = 8.0  # realistic fallback (meters)

        x, y = latlon_to_xy(lat0, lon0, lat, lon)
        if prev_x is not None:
            dx = x - prev_x
            dy = y - prev_y

            dt = (timestamp - prev_time) if prev_time else 1.0
            if dt <= 0:
                dt = 1.0

            computed_v = math.sqrt(dx*dx + dy*dy) / dt
            velocity = 0.7 * velocity + 0.3 * computed_v

        if prev_x is not None:
            dx = x - prev_x
            dy = y - prev_y
            dist = math.sqrt(dx*dx + dy*dy)

            if dist > 150:   # 50 meters jump = bad GPS
                continue

        
        if prev_x is None:
            heading = 0.0
            omega = 0.0
        else:
            new_heading = compute_heading(prev_x, prev_y, x, y)

            if prev_heading is None:
                heading = new_heading
            else:
                heading = normalize_angle(0.5 * prev_heading + 0.5 * new_heading)

            # compute dt safely
            dt = (timestamp - prev_time) if prev_time is not None else 1.0
            if dt <= 0:
                dt = 1.0

            if prev_heading is None:
                omega = 0.0
            else:
                omega = normalize_angle(heading - prev_heading) / dt

        states.append(State(
            x=x,
            y=y,
            velocity=velocity,
            heading=heading,
            omega=omega,
            timestamp=timestamp,
            accuracy=accuracy
        ))

        prev_x, prev_y = x, y
        prev_heading = heading
        prev_time = timestamp

    return states




# Missing: Back to Coordinates.
def xy_to_latlon(lat0, lon0, x, y):
    import math

    EARTH_RADIUS = 6371000

    # convert reference to radians (MATCH forward)
    lat0_rad = math.radians(lat0)
    lon0_rad = math.radians(lon0)

    # compute in radians
    lat = lat0_rad + (y / EARTH_RADIUS)
    lon = lon0_rad + (x / (EARTH_RADIUS * math.cos(lat0_rad)))

    # convert back to degrees
    return math.degrees(lat), math.degrees(lon)