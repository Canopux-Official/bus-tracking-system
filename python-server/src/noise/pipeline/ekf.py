import numpy as np
import math
from filterpy.kalman import ExtendedKalmanFilter
from pipeline.models import State


# -------------------------
# Utility
# -------------------------
def normalize_angle(angle):
    return (angle + math.pi) % (2 * math.pi) - math.pi


# -------------------------
# Motion Model (fx)
# -------------------------
def fx(x, dt):
    px, py, v, h, w = x

    px = px + v * math.cos(h) * dt
    py = py + v * math.sin(h) * dt
    h = h + w * dt

    h = normalize_angle(h)

    return np.array([px, py, v, h, w])


# -------------------------
# Jacobian of Motion Model
# -------------------------
def F_jacobian(x, dt):
    _, _, v, h, _ = x

    return np.array([
        [1, 0, math.cos(h) * dt, -v * math.sin(h) * dt, 0],
        [0, 1, math.sin(h) * dt,  v * math.cos(h) * dt, 0],
        [0, 0, 1,                 0,                    0],
        [0, 0, 0,                 1,                    dt],
        [0, 0, 0,                 0,                    1]
    ])


# -------------------------
# Measurement Model (hx)
# -------------------------
def hx(x):
    px, py, _, h, _ = x
    return np.array([px, py, h])


def H_jacobian(x):
    return np.array([
        [1, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
        [0, 0, 0, 1, 0]
    ])


# -------------------------
# Main EKF
# -------------------------
def run_ekf(states):

    kf = ExtendedKalmanFilter(dim_x=5, dim_z=3)

    # Initial state
    first = states[0]
    kf.x = np.array([
        first.x,
        first.y,
        first.velocity,
        first.heading,
        0.0   # 🔥 omega starts unknown
    ])

    # Covariance
    kf.P = np.diag([10, 10, 5, 1, 1])

    # Process noise
    kf.Q = np.diag([
        5.0,   # x
        5.0,   # y
        5.0,   # velocity
        0.1,   # heading
        1.0    # omega
    ])

    filtered = []

    prev_time = first.timestamp
    prev_heading = first.heading

    for i, curr in enumerate(states):

        if i == 0:
            filtered.append(curr)
            continue

        # -------------------------
        # Time step
        # -------------------------
        dt = curr.timestamp - prev_time
        if dt <= 0:
            dt = 1.0
        prev_time = curr.timestamp

        prev_heading = curr.heading

        # -------------------------
        # ✅ Predict (FIXED)
        # -------------------------
        kf.F = F_jacobian(kf.x, dt)

        # State prediction
        kf.x = fx(kf.x, dt)

        # 🔥 CRITICAL FIX: covariance prediction
        kf.P = kf.F @ kf.P @ kf.F.T + kf.Q

        # -------------------------
        # Measurement
        # -------------------------
        z = np.array([
            curr.x,
            curr.y,
            curr.heading
        ])

        # -------------------------
        # Measurement noise
        # -------------------------
        acc = curr.accuracy if curr.accuracy is not None else 8.0

        acc = min(acc, 10.0)
        kf.R = np.diag([
            acc**2,
            acc**2,
            0.05
        ])

        # -------------------------
        # Update
        # -------------------------
        kf.update(
            z,
            HJacobian=H_jacobian,
            Hx=hx
        )

        # Normalize heading
        kf.x[3] = normalize_angle(kf.x[3])

        # -------------------------
        # Save
        # -------------------------
        filtered.append(State(
            x=kf.x[0],
            y=kf.x[1],
            velocity=kf.x[2],
            heading=kf.x[3],
            omega=kf.x[4],
            timestamp=curr.timestamp,
            accuracy=curr.accuracy
        ))

    return filtered