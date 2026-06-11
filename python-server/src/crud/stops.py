import requests
import os

def get_place_name(lat: float, lng: float) -> str:
    api_key = os.getenv("LOCATIONIQ_TOKEN")
    url = f"https://us1.locationiq.com/v1/reverse?key={api_key}&lat={lat}&lon={lng}&format=json"
    try:
        res = requests.get(url, timeout=5)
        addr = res.json().get("address", {})
        return (
            addr.get("amenity") or
            addr.get("road") or
            addr.get("suburb") or
            addr.get("city") or
            "Unknown"
        )
    except Exception:
        return "Unknown"


def pin_stop(trip_id: str, lat: float, lng: float) -> bool:
    name = get_place_name(lat, lng)

    NODE_URL = os.getenv("NODE_URL", "http://localhost:3000")
    try:
        res = requests.patch(
            f"{NODE_URL}/bus/trip/{trip_id}/route",
            json={"stop_name": name},
            timeout=5
        )
        data = res.json()
        print(f"[stops] pinned '{name}' → route: {data.get('route')}")
        return True
    except Exception as e:
        print(f"[stops] ❌ failed to update route: {e}")
        return False