import numpy as np
import math
from filterpy.kalman import ExtendedKalmanFilter
from src.pipeline.models import State

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
    px, py, _, _, _ = x
    return np.array([px, py])


def H_jacobian(x):
    return np.array([
        [1, 0, 0, 0, 0],
        [0, 1, 0, 0, 0]
    ])


# -------------------------
# Main EKF
# -------------------------
def run_ekf(states):

    kf = ExtendedKalmanFilter(dim_x=5, dim_z=2)

    # Initial state
    first = states[0]
    kf.x = np.array([
        first.x,
        first.y,
        first.velocity,
        first.heading,
        0.0
    ])

    # Covariance
    kf.P = np.diag([200, 200, 50, 10, 10])

    # Process noise
    kf.Q = np.diag([5, 5, 2, 0.5, 1])

    filtered = []
    prev_time = first.timestamp

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
        elif dt > 3:
            dt = 3.0

        prev_time = curr.timestamp

        # -------------------------
        # Predict
        # -------------------------
        kf.F = F_jacobian(kf.x, dt)
        kf.x = fx(kf.x, dt)
        kf.P = kf.F @ kf.P @ kf.F.T + kf.Q

        # -------------------------
        # Measurement
        # -------------------------
        z = np.array([curr.x, curr.y])

        # -------------------------
        # Measurement noise (adaptive)
        # -------------------------
        acc = curr.accuracy if curr.accuracy is not None else 8.0
        acc = max(2.0, min(acc, 15.0))

        speed = curr.velocity

        if speed < 5:
            factor = 1.0
        elif speed < 15:
            factor = 1.2
        else:
            factor = 1.5

        effective_acc = acc * factor

        kf.R = np.diag([
            effective_acc**2,
            effective_acc**2
        ])

        # -------------------------
        # Gating (Mahalanobis)
        # -------------------------
        z_pred = hx(kf.x)
        y = z - z_pred

        H = H_jacobian(kf.x)
        S = H @ kf.P @ H.T + kf.R

        mahal = y.T @ np.linalg.inv(S) @ y

        if i>5 and mahal > 20:
            # keep prediction instead of skipping
            filtered.append(State(
                x=kf.x[0],
                y=kf.x[1],
                velocity=kf.x[2],
                heading=kf.x[3],
                omega=kf.x[4],
                timestamp=curr.timestamp,
                accuracy=curr.accuracy
            ))
            continue

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