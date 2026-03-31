import numpy as np
import math
from filterpy.kalman import ExtendedKalmanFilter
from src.pipeline.models import State

def normalize_angle(angle):
    return (angle + math.pi) % (2 * math.pi) - math.pi

def fx(x, dt):
    # State: [0:x, 1:y, 2:v, 3:h, 4:w]
    px, py, v, h, w = x
    px += v * math.cos(h) * dt
    py += v * math.sin(h) * dt
    h = normalize_angle(h + w * dt)
    # v and w are assumed constant during the dt step (CTRV model)
    return np.array([px, py, v, h, w])

def F_jacobian(x, dt):
    _, _, v, h, _ = x
    # Partial derivatives of fx with respect to [x, y, v, h, w]
    F = np.eye(5)
    F[0, 2] = math.cos(h) * dt      # dfx/dv
    F[0, 3] = -v * math.sin(h) * dt # dfx/dh
    F[1, 2] = math.sin(h) * dt      # dfy/dv
    F[1, 3] = v * math.cos(h) * dt  # dfy/dh
    F[3, 4] = dt                    # dh/dw
    return F

def hx(x):
    return np.array([x[0], x[1]])

def H_jacobian(x):
    H = np.zeros((2, 5))
    H[0, 0] = 1.0
    H[1, 1] = 1.0
    return H

def run_ekf(states):
    kf = ExtendedKalmanFilter(dim_x=5, dim_z=2)
    f = states[0]
    kf.x = np.array([f.x, f.y, f.velocity, f.heading, f.omega])
    
    # P: Start with low uncertainty to prevent the "Point 1 Jump"
    kf.P = np.eye(5) * 1.0 

    # Q: Process Noise - Low for position, Moderate for Velocity/Heading
    # This allows the bus to "drift" into turns without the model fighting it.
    kf.Q = np.diag([0.1, 0.1, 1.0, 0.5, 0.2])

    # R: Measurement Noise - Crucial!
    # If the error is 86m, your R might be too high (ignoring GPS).
    # Let's set it to a firm 10.0 (roughly 3.1 meters of GPS wobble).
    kf.R = np.diag([10.0, 10.0])

    filtered = [f]
    for i in range(1, len(states)):
        curr = states[i]
        dt = max(0.01, curr.timestamp - filtered[-1].timestamp)

        # Predict
        kf.F = F_jacobian(kf.x, dt)
        kf.x = fx(kf.x, dt)
        kf.predict()

        # Update
        z = np.array([curr.x, curr.y])
        kf.update(z, HJacobian=H_jacobian, Hx=hx)
        
        # Post-Update: Normalize heading
        kf.x[3] = normalize_angle(kf.x[3])

        filtered.append(State(kf.x[0], kf.x[1], kf.x[2], kf.x[3], kf.x[4], curr.timestamp))
    return filtered