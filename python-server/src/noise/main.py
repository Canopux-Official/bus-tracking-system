import math
from pipeline.models import State
from pipeline.preprocessing import process_gps_data


state = State(2,3,10,0,1)

print(repr(state))
points = [
    (20.2961, 85.8245, 5.0, 0),
    (20.2962, 85.8246, 5.0, 10),
    (20.2963, 85.8247, 5.0, 20),
]

states = process_gps_data(points)
for s in states:
    print(s)


