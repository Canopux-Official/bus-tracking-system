class State:
    def __init__(self, x, y, velocity, heading, omega=0.0, timestamp=None, accuracy=8.0):
        self.x = x
        self.y = y
        self.velocity = velocity
        self.heading = heading
        self.omega = omega
        self.timestamp = timestamp
        self.accuracy = accuracy