import { useEffect, useRef, useState } from "react";
import { sendLocation } from "../apis/trip.api";

const USE_DEMO = true;

const DEMO_ROUTE: [number, number, number][] = [

  // ── STOP 1: Gorakhpur Bus Terminal (SOURCE) ──────────────────────────────
  [26.7606, 83.3732, 0],
  [26.7520, 83.3810, 0],
  [26.7435, 83.3895, 0],
  [26.7300, 83.4050, 0],
  [26.7100, 83.4280, 0],
  [26.6850, 83.4520, 0],
  [26.6600, 83.4750, 2],   // minor traffic pause — NOT a stop

  // ── STOP 2: Deoria Junction ──────────────────────────────────────────────
  [26.5020, 83.7840, 6],   // dwell 60s → AUTO-PINNED as stop
  [26.4900, 83.7950, 0],
  [26.4750, 83.8100, 0],
  [26.4500, 83.8350, 0],
  [26.4200, 83.8700, 0],
  [26.3900, 83.9100, 0],

  // ── STOP 3: Azamgarh Bus Stand ───────────────────────────────────────────
  [26.0669, 83.1840, 6],   // dwell 60s → AUTO-PINNED as stop
  [26.0580, 83.1750, 0],
  [26.0430, 83.1600, 0],
  [26.0200, 83.1380, 0],
  [25.9900, 83.1100, 0],

  // ── STOP 4: Bhubaneswar Baramunda Bus Terminal (DESTINATION) ────────────
  [20.2961, 85.7930, 6],   // dwell 60s → AUTO-PINNED as final stop
  [20.2900, 85.7870, 0],
  [20.2830, 85.7800, 0],
  [20.2780, 85.7740, 0],
];

export const useTracking = (tripId: string | null) => {

  const [isTracking, setIsTracking] = useState(false);
  const [busStatus, setBusStatus] = useState<"idle" | "moving" | "stopped">("idle");
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastLocation, setLastLocation] = useState<{ lat: number; lon: number; vel: number; acc: number; time: string } | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSendingRef = useRef<boolean>(false);
  const isTrackingRef = useRef<boolean>(false);
  const lastPosRef = useRef<{ lat: number; lon: number; vel: number; acc: number } | null>(null);
  const prevSpeedRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(Date.now());
  const lastSendTimeRef = useRef<number>(0);

  const routeIdxRef = useRef<number>(0);
  const dwellCountRef = useRef<number>(0);


  // 1. SEND LOCATION TO SERVER.
  const sendPing = async (
    latitude: number,
    longitude: number,
    velocity: number,
    acceleration: number,
    status: "moving" | "stopped"
  ) => {
    if (!tripId || isSendingRef.current) return;
    try {
      isSendingRef.current = true;
      lastPosRef.current = { lat: latitude, lon: longitude, vel: velocity, acc: acceleration };
      const pingTime = new Date().toLocaleTimeString();
      console.log("📍 LOCATION UPDATE:", { lat: latitude, lon: longitude, vel: velocity, acc: acceleration, time: pingTime });
      await sendLocation({ tripId, lat: latitude, lon: longitude, vel: velocity, acc: acceleration, status });
      setLastSent(0);
      setLastLocation({ lat: latitude, lon: longitude, vel: velocity, acc: acceleration, time: pingTime });
      setError(null);
    } catch (err) {
      console.error("Send error:", err);
      setError("Failed to send location");
    } finally {
      isSendingRef.current = false;
    }
  };


  // 2. FALLBACK SENDER: real GPS only.
  const startSendTimer = () => {
    if (sendTimerRef.current) clearInterval(sendTimerRef.current);
    sendTimerRef.current = setInterval(async () => {
      if (!isTrackingRef.current || !lastPosRef.current || isSendingRef.current) return;
      const nowTime = Date.now();
      if (nowTime - lastSendTimeRef.current >= 10_000) {
        const { lat, lon, vel, acc } = lastPosRef.current;
        lastSendTimeRef.current = nowTime;
        setBusStatus("moving");
        await sendPing(lat, lon, vel, acc, "moving");
      }
    }, 10_000);
  };


  // 3. DEMO TICKER: advances through DEMO_ROUTE every 10s.
  const startDemoTicker = () => {
    if (sendTimerRef.current) clearInterval(sendTimerRef.current);

    sendTimerRef.current = setInterval(async () => {
      if (!isTrackingRef.current || isSendingRef.current) return;

      const idx = routeIdxRef.current;
      if (idx >= DEMO_ROUTE.length) {
        console.log("🏁 Demo route complete");
        stopTracking();
        return;
      }

      const [lat, lon, dwellPings] = DEMO_ROUTE[idx];

      // Calculate velocity from previous position
      const prevLat = lastPosRef.current?.lat ?? lat;
      const prevLon = lastPosRef.current?.lon ?? lon;
      const dLat = lat - prevLat;
      const dLon = lon - prevLon;
      const distMetres = Math.sqrt(dLat * dLat + dLon * dLon) * 111_320;
      const velocity = distMetres / 10; // m/s

      lastSendTimeRef.current = Date.now();
      setBusStatus("moving");
      await sendPing(lat, lon, velocity, 0, "moving");

      // ── Dwell logic ───────────────────────────────────────────────────────
      if (dwellPings > 0) {
        // Still dwelling at this stop — increment count but don't advance index
        dwellCountRef.current += 1;
        console.log(`⏳ Dwelling at idx=${idx} (${dwellCountRef.current}/${dwellPings})`);

        if (dwellCountRef.current >= dwellPings) {
          // Dwell complete — pin the stop, then advance to next point
          console.log(`📍 Dwell complete at idx=${idx} — pinning stop`);
          fetch(`${import.meta.env.VITE_PYTHON_BACKEND_URL}/api/trips/${tripId}/pin-stop`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng: lon }),
          }).catch(console.error);

          dwellCountRef.current = 0;       // reset for next stop
          routeIdxRef.current += 1;        // advance past this dwell point
        }
        // else: stay at same index until dwell is done
      } else {
        // No dwell — just move to next point normally
        routeIdxRef.current += 1;
      }

    }, 10_000);
  };


  // 4. START GPS TRACKING (real device).
  const attachWatch = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported"); return; }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const velocity = speed !== null && speed !== undefined ? speed : prevSpeedRef.current;
        const now = Date.now();
        const deltaTime = (now - prevTimeRef.current) / 1000;
        const acceleration = deltaTime > 0 ? (velocity - prevSpeedRef.current) / deltaTime : 0;
        prevSpeedRef.current = velocity;
        prevTimeRef.current = now;
        lastPosRef.current = { lat: latitude, lon: longitude, vel: velocity, acc: acceleration };
        setError(null);
        const nowTime = Date.now();
        if (isTrackingRef.current && nowTime - lastSendTimeRef.current >= 10_000 && !isSendingRef.current) {
          lastSendTimeRef.current = nowTime;
          setBusStatus("moving");
          sendPing(latitude, longitude, velocity, acceleration, "moving");
        }
      },
      (err) => {
        console.error("GPS error:", err);
        setError("GPS lost — tap START to resume");
        isTrackingRef.current = false;
        setIsTracking(false);
        setBusStatus("stopped");
        if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
        if (sendTimerRef.current) { clearInterval(sendTimerRef.current); sendTimerRef.current = null; }
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
    );
    startSendTimer();
  };


  // 5. HANDLE TAB VISIBILITY CHANGE.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isTrackingRef.current) {
        console.log("👁 Tab visible — checking timers");
        if (sendTimerRef.current === null) {
          console.log("🔁 Restarting send timer");
          USE_DEMO ? startDemoTicker() : startSendTimer();
        }
        if (!USE_DEMO && watchIdRef.current === null) {
          console.warn("⚠️ GPS lost — restart required");
          setError("GPS paused — tap START to resume");
          setIsTracking(false);
          isTrackingRef.current = false;
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);


  // 6. START TRACKING.
  const startTracking = () => {
    if (!tripId) { setError("Trip not initialized"); return; }
    if (isTrackingRef.current) return;

    isTrackingRef.current = true;
    lastSendTimeRef.current = Date.now();
    setIsTracking(true);
    setBusStatus("moving");
    setError(null);

    if (USE_DEMO) {
      const resumeIdx = routeIdxRef.current;
      if (resumeIdx >= DEMO_ROUTE.length) {
        console.warn("⚠️ Demo route already complete. End the trip to restart.");
        isTrackingRef.current = false;
        setIsTracking(false);
        setBusStatus("stopped");
        return;
      }
      const [lat, lon] = DEMO_ROUTE[resumeIdx];
      lastPosRef.current = { lat, lon, vel: 0, acc: 0 };
      sendPing(lat, lon, 0, 0, "moving");
      routeIdxRef.current = resumeIdx + 1;
      startDemoTicker();
    } else {
      attachWatch();
    }
  };


  // 7. STOP TRACKING.
  const stopTracking = async () => {
    isTrackingRef.current = false;
    setIsTracking(false);
    setBusStatus("stopped");
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (sendTimerRef.current) { clearInterval(sendTimerRef.current); sendTimerRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    const lastPos = lastPosRef.current;
    if (tripId && lastPos) {
      try {
        await sendLocation({ tripId, lat: lastPos.lat, lon: lastPos.lon, vel: 0, acc: 0, status: "stopped" });
        console.log("🛑 Stopped at:", lastPos);
      } catch (err) {
        console.error("Failed to send stop signal:", err);
      }
    } else {
      console.warn("⚠️ stopTracking called with no last known position");
    }
    prevSpeedRef.current = 0;
    prevTimeRef.current = Date.now();
    lastSendTimeRef.current = 0;
  };


  // 7b. RESET TRIP.
  const resetTrip = () => {
    lastPosRef.current = null;
    routeIdxRef.current = 0;
    dwellCountRef.current = 0;
    setLastLocation(null);
  };


  // 8. TIMER FOR LAST SEEN.
  useEffect(() => {
    if (!isTracking) return;
    const timer = setInterval(() => setLastSent(p => p !== null ? p + 1 : null), 1000);
    return () => clearInterval(timer);
  }, [isTracking]);


  // 9. CLEANUP ON UNMOUNT.
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (sendTimerRef.current) clearInterval(sendTimerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { isTracking, busStatus, startTracking, stopTracking, resetTrip, lastSent, error, lastLocation };
};