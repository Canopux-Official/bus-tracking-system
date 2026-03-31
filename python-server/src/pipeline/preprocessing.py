import math
from src.pipeline.models import State

EARTH_RADIUS = 6371000 

def latlon_to_xy(lat0, lon0, lat, lon):
    lat0_rad, lon0_rad, lat_rad, lon_rad = map(math.radians, [lat0, lon0, lat, lon])
    # x is Easting, y is Northing
    x = EARTH_RADIUS * (lon_rad - lon0_rad) * math.cos(lat0_rad)
    y = EARTH_RADIUS * (lat_rad - lat0_rad)
    return x, y

def xy_to_latlon(lat0, lon0, x, y):
    lat0_rad = math.radians(lat0)
    lon0_rad = math.radians(lon0)
    lat = lat0_rad + (y / EARTH_RADIUS)
    lon = lon0_rad + (x / (EARTH_RADIUS * math.cos(lat0_rad)))
    return math.degrees(lat), math.degrees(lon)

def normalize_angle(angle):
    """Keep angle within [-pi, pi] to prevent filter divergence."""
    return (angle + math.pi) % (2 * math.pi) - math.pi

def process_gps_data(points):
    states = []
    if not points:
        return states

    lat0, lon0 = points[0][0], points[0][1]
    
    for i in range(len(points)):
        lat, lon, input_vel, t = points[i][0], points[i][1], points[i][2], points[i][3]
        x, y = latlon_to_xy(lat0, lon0, lat, lon)
        
        if i == 0:
            # Initialize with a look-ahead to point 1 for better heading
            if len(points) > 1:
                x1, y1 = latlon_to_xy(lat0, lon0, points[1][0], points[1][1])
                heading = math.atan2(y1 - y, x1 - x)
            else:
                heading = 0.0
            
            velocity = input_vel if input_vel > 0 else 5.0
            omega = 0.0
        else:
            prev = states[-1]
            dt = max(0.1, t - prev.timestamp)
            
            # 1. Calculate REAL velocity from distance moved
            dist = math.sqrt((x - prev.x)**2 + (y - prev.y)**2)
            calc_vel = dist / dt
            
            # 2. Blend input GPS velocity with calculated velocity
            current_vel = (0.3 * input_vel) + (0.7 * calc_vel)

            # 3. THE POLISH: 3-Point Moving Average for Velocity
            # This smooths out "jumps" that cause EKF overshooting
            if i > 1:
                velocity = (current_vel + states[-1].velocity + states[-2].velocity) / 3.0
            else:
                velocity = current_vel

            # 4. Calculate heading and turn rate (omega)
            heading = math.atan2(y - prev.y, x - prev.x)
            
            # Always normalize the angular difference before dividing by dt
            angle_diff = normalize_angle(heading - prev.heading)
            omega = angle_diff / dt
            
        states.append(State(
            x=x, 
            y=y, 
            velocity=velocity, 
            heading=heading, 
            omega=omega, 
            timestamp=t
        ))
        
    return states