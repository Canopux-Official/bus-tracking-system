class State:
    def __init__(self,x,y,velocity,heading,timestamp):

        self.x = x
        self.y = y
        self.velocity = velocity
        self.heading = heading
        self.timestamp = timestamp
    
    def __str__(self):
        return f"x={self.x},y={self.y},v={self.velocity},θ={self.heading},t={self.timestamp}"
    
    def __repr__(self):
        return f"State(x={self.x}, y={self.y}, velocity={self.velocity}, heading={self.heading}, timestamp={self.timestamp})"

    


