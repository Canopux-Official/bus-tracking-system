from pipeline.models import State
import math
EARTH_RADIUS = 6371000


#preprocess function

def latlon_to_xy(lat0,lon0,lat,lon):
    # convertion from degrees to radian
    lat0 = math.radians(lat0)
    lon0 = math.radians(lon0)
    lat =  math.radians(lat)
    lon =  math.radians(lon)
    x = EARTH_RADIUS * (lon-lon0) * math.cos(lat0)
    y = EARTH_RADIUS * (lat-lat0)
    return x,y

def compute_heading(x1,y1,x2,y2):
    dy = y2-y1
    dx = x2-x1
    return math.atan2(dy,dx)



def process_gps_data(points):
    states = []

    prev_x = None
    prev_y = None
    prev_heading = None

    # reference point
    lat0, lon0 = points[0][0], points[0][1]

    for point in points:
        lat, lon, velocity, timestamp = point

        # convert to x, y
        x, y = latlon_to_xy(lat0, lon0, lat, lon)
        if prev_x is None:
            heading = None
            state = State(x, y, velocity, heading, timestamp)
            states.append(state)
            prev_x = x
            prev_y = y

            continue

        heading = compute_heading(prev_x,prev_y,x,y)
        state = State(x, y, velocity, heading, timestamp)
        states.append(state)
        prev_x = x
        prev_y = y
        

    return states

