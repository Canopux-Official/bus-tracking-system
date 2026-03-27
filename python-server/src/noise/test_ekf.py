from pipeline.preprocessing import process_gps_data
from pipeline.ekf import run_ekf
import random

# Format: (lat, lon, velocity, timestamp, accuracy)

gps_points = [
    (12.9716, 77.5946, 10, 0, 5),
    (12.9719, 77.5949, 10, 1, 5),
    (12.9722, 77.5952, 10, 2, 5),

    # turning
    (12.9725, 77.5956, 10, 3, 6),
    (12.9727, 77.5960, 10, 4, 6),

    # worse GPS
    (12.9728, 77.5965, 10, 5, 15),
    (12.9728, 77.5970, 10, 6, 15),

    # back to normal
    (12.9729, 77.5974, 10, 7, 5),
    (12.9731, 77.5978, 10, 8, 5),
    (12.9734, 77.5981, 10, 9, 5),
]

# -------------------------
# Add noise (IMPORTANT)- not needed during real gps data
# -------------------------
noisy_points = []

for lat, lon, v, t, acc in gps_points:
    noisy_lat = lat + random.uniform(-acc * 1e-5, acc * 1e-5)
    noisy_lon = lon + random.uniform(-acc * 1e-5, acc * 1e-5)

    noisy_points.append((noisy_lat, noisy_lon, v, t, acc))


# -------------------------
# Run pipeline
# -------------------------
states = process_gps_data(noisy_points)
filtered_states = run_ekf(states)

# -------------------------
# Print results
# -------------------------
print("\n===== EKF TEST OUTPUT =====\n")

for raw, filt in zip(states, filtered_states):
    print(
        f"RAW: ({raw.x:.2f}, {raw.y:.2f}, h={raw.heading:.2f}, acc={raw.accuracy}) | "
        f"FILTERED: ({filt.x:.2f}, {filt.y:.2f}, h={filt.heading:.2f})"
    )
