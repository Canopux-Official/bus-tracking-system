import { useEffect, useRef, useState } from "react";
import { sendLiveLocation } from "../apis/trip.api";


// Custom Hook for GPS Tracking.
export const useTracking = (tripId: string | null) => {
  const [isTracking, setIsTracking] = useState(false);
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevSpeedRef = useRef<number>(0);

  // 1. Start Tracking.
  const startTracking = () => {
    if (!tripId) {
      setError("Trip not initialized");
      return;
    }

    if (!navigator.geolocation) {
      console.error("Geolocation not supported");
      return;
    }

    if (intervalRef.current) return;

    setIsTracking(true);
    setError(null);

    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude, speed } = pos.coords;
            console.log(
              "📍 LOCATION:",
              JSON.stringify(
                {
                  lat: latitude,
                  lng: longitude,
                  speed: speed ?? 0,
                  time: new Date().toLocaleTimeString(),
                },
                null,
                2
              )
            );

            // Velocity may be Zero (Depends on Device).
            const velocity = speed ?? 0;

            // Correct Acceleration (Δv / Δt).
            const acceleration = (velocity - prevSpeedRef.current) / 10;
            prevSpeedRef.current = velocity;

            await sendLiveLocation({
              tripId,
              lat: latitude,
              lng: longitude,
              velocity,
              acceleration,
            });

            setLastSent(0);
          } catch (err) {
            console.error("Send error:", err);
            setError("Failed to send location");
          }
        },
        (err) => {
          console.error("GPS error:", err);
          setError("GPS unavailable");
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    }, 10000);
  };



  // 2. Stop Tracking (Trip still valid).
  const stopTracking = () => {
    setIsTracking(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    prevSpeedRef.current = 0;
  };

  useEffect(() => {
    if (!isTracking) return;

    const timer = setInterval(() => {
      setLastSent((prev) => (prev !== null ? prev + 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [isTracking]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    isTracking,
    startTracking,
    stopTracking,
    lastSent,
    error,
  };
};