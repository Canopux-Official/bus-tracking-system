// import { useEffect, useRef, useState } from "react";
// import { sendLocation } from "../apis/trip.api";

// const USE_DEMO = true;

// const DEMO_ROUTE: [number, number, number][] = [

//   // ── STOP 1: Gorakhpur Bus Terminal (SOURCE) ──────────────────────────────
//   [20.289621, 85.741105, 0],
//   [20.289514, 85.741376, 0],
//   [20.289164, 85.741793, 0],
//   [20.288889, 85.742285, 0],
//   [20.288621, 85.742885, 0],
//   [20.288183, 85.743819, 0],
//   [20.287692, 85.744872, 0],   // minor traffic pause — NOT a stop

//   // ── STOP 2: Deoria Junction ──────────────────────────────────────────────
//   [20.287214, 85.745973, 0],   // dwell 60s → AUTO-PINNED as stop
//   [20.286977, 85.746545, 0],
//   [20.286556, 85.747621, 0],
//   [20.286351, 85.748253, 0],
//   [20.286150, 85.748961, 0],
//   [20.285881, 85.749728, 0],

//   // ── STOP 3: Azamgarh Bus Stand ───────────────────────────────────────────
//   [20.285615, 85.750423, 0],   // dwell 60s → AUTO-PINNED as stop
//   [20.285335, 85.751038, 0],
//   [20.284902, 85.751954, 0],
//   [20.284544, 85.752714, 0],
//   [20.284250, 85.753165, 0],

//   // ── STOP 4: Bhubaneswar Baramunda Bus Terminal (DESTINATION) ────────────
//   [20.283770, 85.754058, 0],   // dwell 60s → AUTO-PINNED as final stop
//   [20.283294, 85.755087, 0],
//   [20.282249, 85.756330, 0],
//   [20.281506, 85.757288, 0],


//   [20.280783, 85.758558, 0],   // dwell 60s → AUTO-PINNED as final stop
//   [20.279905, 85.760101, 0],
//   [20.279615, 85.760730, 0],
//   [20.280046, 85.761127, 0],
// ];

// export const useTracking = (tripId: string | null) => {

//   const [isTracking, setIsTracking] = useState(false);
//   const [busStatus, setBusStatus] = useState<"idle" | "moving" | "stopped">("idle");
//   const [lastSent, setLastSent] = useState<number | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [lastLocation, setLastLocation] = useState<{ lat: number; lon: number; vel: number; acc: number; time: string } | null>(null);

//   const watchIdRef = useRef<number | null>(null);
//   const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
//   const sendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
//   const isSendingRef = useRef<boolean>(false);
//   const isTrackingRef = useRef<boolean>(false);
//   const lastPosRef = useRef<{ lat: number; lon: number; vel: number; acc: number } | null>(null);
//   const prevSpeedRef = useRef<number>(0);
//   const prevTimeRef = useRef<number>(Date.now());
//   const lastSendTimeRef = useRef<number>(0);

//   const routeIdxRef = useRef<number>(0);
//   const dwellCountRef = useRef<number>(0);


//   // 1. SEND LOCATION TO SERVER.
//   const sendPing = async (
//     latitude: number,
//     longitude: number,
//     velocity: number,
//     acceleration: number,
//     status: "moving" | "stopped"
//   ) => {
//     if (!tripId || isSendingRef.current) return;
//     try {
//       isSendingRef.current = true;
//       lastPosRef.current = { lat: latitude, lon: longitude, vel: velocity, acc: acceleration };
//       const pingTime = new Date().toLocaleTimeString();
//       console.log("📍 LOCATION UPDATE:", { lat: latitude, lon: longitude, vel: velocity, acc: acceleration, time: pingTime });
//       await sendLocation({ tripId, lat: latitude, lon: longitude, vel: velocity, acc: acceleration, status });
//       setLastSent(0);
//       setLastLocation({ lat: latitude, lon: longitude, vel: velocity, acc: acceleration, time: pingTime });
//       setError(null);
//     } catch (err) {
//       console.error("Send error:", err);
//       setError("Failed to send location");
//     } finally {
//       isSendingRef.current = false;
//     }
//   };


//   // 2. FALLBACK SENDER: real GPS only.
//   const startSendTimer = () => {
//     if (sendTimerRef.current) clearInterval(sendTimerRef.current);
//     sendTimerRef.current = setInterval(async () => {
//       if (!isTrackingRef.current || !lastPosRef.current || isSendingRef.current) return;
//       const nowTime = Date.now();
//       if (nowTime - lastSendTimeRef.current >= 10_000) {
//         const { lat, lon, vel, acc } = lastPosRef.current;
//         lastSendTimeRef.current = nowTime;
//         setBusStatus("moving");
//         await sendPing(lat, lon, vel, acc, "moving");
//       }
//     }, 10_000);
//   };


//   // 3. DEMO TICKER: advances through DEMO_ROUTE every 10s.
//   const startDemoTicker = () => {
//     if (sendTimerRef.current) clearInterval(sendTimerRef.current);

//     sendTimerRef.current = setInterval(async () => {
//       if (!isTrackingRef.current || isSendingRef.current) return;

//       const idx = routeIdxRef.current;
//       if (idx >= DEMO_ROUTE.length) {
//         console.log("🏁 Demo route complete");
//         stopTracking();
//         return;
//       }

//       const [lat, lon, dwellPings] = DEMO_ROUTE[idx];

//       // Calculate velocity from previous position
//       const prevLat = lastPosRef.current?.lat ?? lat;
//       const prevLon = lastPosRef.current?.lon ?? lon;
//       const dLat = lat - prevLat;
//       const dLon = lon - prevLon;
//       const distMetres = Math.sqrt(dLat * dLat + dLon * dLon) * 111_320;
//       const velocity = distMetres / 10; // m/s

//       lastSendTimeRef.current = Date.now();
//       setBusStatus("moving");
//       await sendPing(lat, lon, velocity, 0, "moving");

//       // ── Dwell logic ───────────────────────────────────────────────────────
//       if (dwellPings > 0) {
//         // Still dwelling at this stop — increment count but don't advance index
//         dwellCountRef.current += 1;
//         console.log(`⏳ Dwelling at idx=${idx} (${dwellCountRef.current}/${dwellPings})`);

//         if (dwellCountRef.current >= dwellPings) {
//           // Dwell complete — pin the stop, then advance to next point
//           console.log(`📍 Dwell complete at idx=${idx} — pinning stop`);
//           fetch(`${import.meta.env.VITE_PYTHON_BACKEND_URL}/api/trips/${tripId}/pin-stop`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ lat, lng: lon }),
//           }).catch(console.error);

//           dwellCountRef.current = 0;       // reset for next stop
//           routeIdxRef.current += 1;        // advance past this dwell point
//         }
//         // else: stay at same index until dwell is done
//       } else {
//         // No dwell — just move to next point normally
//         routeIdxRef.current += 1;
//       }

//     }, 10_000);
//   };


//   // 4. START GPS TRACKING (real device).
//   const attachWatch = () => {
//     if (!navigator.geolocation) { setError("Geolocation not supported"); return; }
//     if (watchIdRef.current !== null) {
//       navigator.geolocation.clearWatch(watchIdRef.current);
//       watchIdRef.current = null;
//     }
//     watchIdRef.current = navigator.geolocation.watchPosition(
//       (pos) => {
//         const { latitude, longitude, speed } = pos.coords;
//         const velocity = speed !== null && speed !== undefined ? speed : prevSpeedRef.current;
//         const now = Date.now();
//         const deltaTime = (now - prevTimeRef.current) / 1000;
//         const acceleration = deltaTime > 0 ? (velocity - prevSpeedRef.current) / deltaTime : 0;
//         prevSpeedRef.current = velocity;
//         prevTimeRef.current = now;
//         lastPosRef.current = { lat: latitude, lon: longitude, vel: velocity, acc: acceleration };
//         setError(null);
//         const nowTime = Date.now();
//         if (isTrackingRef.current && nowTime - lastSendTimeRef.current >= 10_000 && !isSendingRef.current) {
//           lastSendTimeRef.current = nowTime;
//           setBusStatus("moving");
//           sendPing(latitude, longitude, velocity, acceleration, "moving");
//         }
//       },
//       (err) => {
//         console.error("GPS error:", err);
//         setError("GPS lost — tap START to resume");
//         isTrackingRef.current = false;
//         setIsTracking(false);
//         setBusStatus("stopped");
//         if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
//         if (sendTimerRef.current) { clearInterval(sendTimerRef.current); sendTimerRef.current = null; }
//       },
//       { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
//     );
//     startSendTimer();
//   };


//   // 5. HANDLE TAB VISIBILITY CHANGE.
//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState === "visible" && isTrackingRef.current) {
//         console.log("👁 Tab visible — checking timers");
//         if (sendTimerRef.current === null) {
//           console.log("🔁 Restarting send timer");
//           USE_DEMO ? startDemoTicker() : startSendTimer();
//         }
//         if (!USE_DEMO && watchIdRef.current === null) {
//           console.warn("⚠️ GPS lost — restart required");
//           setError("GPS paused — tap START to resume");
//           setIsTracking(false);
//           isTrackingRef.current = false;
//         }
//       }
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   }, []);


//   // 6. START TRACKING.
//   const startTracking = () => {
//     if (!tripId) { setError("Trip not initialized"); return; }
//     if (isTrackingRef.current) return;

//     isTrackingRef.current = true;
//     lastSendTimeRef.current = Date.now();
//     setIsTracking(true);
//     setBusStatus("moving");
//     setError(null);

//     if (USE_DEMO) {
//       const resumeIdx = routeIdxRef.current;
//       if (resumeIdx >= DEMO_ROUTE.length) {
//         console.warn("⚠️ Demo route already complete. End the trip to restart.");
//         isTrackingRef.current = false;
//         setIsTracking(false);
//         setBusStatus("stopped");
//         return;
//       }
//       const [lat, lon] = DEMO_ROUTE[resumeIdx];
//       lastPosRef.current = { lat, lon, vel: 0, acc: 0 };
//       sendPing(lat, lon, 0, 0, "moving");
//       routeIdxRef.current = resumeIdx + 1;
//       startDemoTicker();
//     } else {
//       attachWatch();
//     }
//   };


//   // 7. STOP TRACKING.
//   const stopTracking = async () => {
//     isTrackingRef.current = false;
//     setIsTracking(false);
//     setBusStatus("stopped");
//     if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
//     if (sendTimerRef.current) { clearInterval(sendTimerRef.current); sendTimerRef.current = null; }
//     if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
//     const lastPos = lastPosRef.current;
//     if (tripId && lastPos) {
//       try {
//         await sendLocation({ tripId, lat: lastPos.lat, lon: lastPos.lon, vel: 0, acc: 0, status: "stopped" });
//         console.log("🛑 Stopped at:", lastPos);
//       } catch (err) {
//         console.error("Failed to send stop signal:", err);
//       }
//     } else {
//       console.warn("⚠️ stopTracking called with no last known position");
//     }
//     prevSpeedRef.current = 0;
//     prevTimeRef.current = Date.now();
//     lastSendTimeRef.current = 0;
//   };


//   // 7b. RESET TRIP.
//   const resetTrip = () => {
//     lastPosRef.current = null;
//     routeIdxRef.current = 0;
//     dwellCountRef.current = 0;
//     setLastLocation(null);
//   };


//   // 8. TIMER FOR LAST SEEN.
//   useEffect(() => {
//     if (!isTracking) return;
//     const timer = setInterval(() => setLastSent(p => p !== null ? p + 1 : null), 1000);
//     return () => clearInterval(timer);
//   }, [isTracking]);


//   // 9. CLEANUP ON UNMOUNT.
//   useEffect(() => {
//     return () => {
//       if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
//       if (sendTimerRef.current) clearInterval(sendTimerRef.current);
//       if (intervalRef.current) clearInterval(intervalRef.current);
//     };
//   }, []);

//   return { isTracking, busStatus, startTracking, stopTracking, resetTrip, lastSent, error, lastLocation };
// };


import { useEffect, useRef, useState } from "react";
import { sendLocation } from "../apis/trip.api";

const USE_DEMO = true;

const DEMO_ROUTE: [number, number, number][] = [
  [20.289621, 85.741105, 0],
  [20.289514, 85.741376, 0],
  [20.289164, 85.741793, 0],
  [20.288889, 85.742285, 0],
  [20.288621, 85.742885, 0],
  [20.288183, 85.743819, 0],
  [20.287692, 85.744872, 0],

  [20.287214, 85.745973, 0],
  [20.286977, 85.746545, 0],
  [20.286556, 85.747621, 0],
  [20.286351, 85.748253, 0],
  [20.286150, 85.748961, 0],
  [20.285881, 85.749728, 0],

  [20.285615, 85.750423, 0],
  [20.285335, 85.751038, 0],
  [20.284902, 85.751954, 0],
  [20.284544, 85.752714, 0],
  [20.284250, 85.753165, 0],

  [20.283770, 85.754058, 0],
  [20.283294, 85.755087, 0],
  [20.282249, 85.756330, 0],
  [20.281506, 85.757288, 0],

  [20.280783, 85.758558, 0],
  [20.279905, 85.760101, 0],
  [20.279615, 85.760730, 0],
  [20.280046, 85.761127, 0],
];

export const useTracking = (tripId: string | null) => {
  const [isTracking, setIsTracking]     = useState(false);
  const [busStatus, setBusStatus]       = useState<"idle" | "moving" | "stopped">("idle");
  const [lastSent, setLastSent]         = useState<number | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [lastLocation, setLastLocation] = useState<{
    lat: number; lon: number; vel: number; acc: number; time: string
  } | null>(null);

  const watchIdRef       = useRef<number | null>(null);
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSendingRef     = useRef<boolean>(false);
  const isTrackingRef    = useRef<boolean>(false);
  const lastPosRef       = useRef<{ lat: number; lon: number; vel: number; acc: number } | null>(null);
  const prevSpeedRef     = useRef<number>(0);
  const prevTimeRef      = useRef<number>(Date.now());
  const lastSendTimeRef  = useRef<number>(0);
  const routeIdxRef      = useRef<number>(0);
  const dwellCountRef    = useRef<number>(0);
  const firstPingRef     = useRef<boolean>(true); // ✅ tracks whether source has been pinned


  // ── Helper: pin a stop via the Python backend ─────────────────────────────
  const pinStop = (lat: number, lng: number) => {
    if (!tripId) return;
    fetch(`${import.meta.env.VITE_PYTHON_BACKEND_URL}/api/trips/${tripId}/pin-stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    }).catch(console.error);
  };


  // 1. SEND LOCATION TO SERVER
  const sendPing = async (
    latitude: number, longitude: number,
    velocity: number, acceleration: number,
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


  // 2. FALLBACK SENDER: real GPS only
  const startSendTimer = () => {
    if (sendTimerRef.current) clearInterval(sendTimerRef.current);
    sendTimerRef.current = setInterval(async () => {
      if (!isTrackingRef.current || !lastPosRef.current || isSendingRef.current) return;
      const nowTime = Date.now();
      if (nowTime - lastSendTimeRef.current >= 10_000) { // ✅ was 10_000
        const { lat, lon, vel, acc } = lastPosRef.current;
        lastSendTimeRef.current = nowTime;
        setBusStatus("moving");
        await sendPing(lat, lon, vel, acc, "moving");
      }
    }, 10_000); // ✅ was 10_000
  };


  // 3. DEMO TICKER: advances through DEMO_ROUTE every 5s
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

      const prevLat = lastPosRef.current?.lat ?? lat;
      const prevLon = lastPosRef.current?.lon ?? lon;
      const dLat = lat - prevLat;
      const dLon = lon - prevLon;
      const distMetres = Math.sqrt(dLat * dLat + dLon * dLon) * 111_320;
      const velocity = distMetres / 10; // ✅ was / 10 (interval is now 5s)

      lastSendTimeRef.current = Date.now();
      setBusStatus("moving");
      await sendPing(lat, lon, velocity, 0, "moving");

      if (dwellPings > 0) {
        dwellCountRef.current += 1;
        console.log(`⏳ Dwelling at idx=${idx} (${dwellCountRef.current}/${dwellPings})`);

        if (dwellCountRef.current >= dwellPings) {
          console.log(`📍 Dwell complete at idx=${idx} — pinning stop`);
          pinStop(lat, lon); // ✅ using shared helper

          dwellCountRef.current = 0;
          routeIdxRef.current += 1;
        }
      } else {
        routeIdxRef.current += 1;
      }

    }, 10_000); // ✅ was 10_000
  };


  // 4. START GPS TRACKING (real device)
  const attachWatch = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported"); return; }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const velocity     = speed !== null && speed !== undefined ? speed : prevSpeedRef.current;
        const now          = Date.now();
        const deltaTime    = (now - prevTimeRef.current) / 1000;
        const acceleration = deltaTime > 0 ? (velocity - prevSpeedRef.current) / deltaTime : 0;
        prevSpeedRef.current  = velocity;
        prevTimeRef.current   = now;
        lastPosRef.current    = { lat: latitude, lon: longitude, vel: velocity, acc: acceleration };
        setError(null);

        const nowTime = Date.now();
        if (isTrackingRef.current && nowTime - lastSendTimeRef.current >= 10_000 && !isSendingRef.current) { // ✅ was 10_000
          lastSendTimeRef.current = nowTime;
          setBusStatus("moving");
          sendPing(latitude, longitude, velocity, acceleration, "moving");

          // ✅ Auto-pin source on the very first real GPS fix
          if (firstPingRef.current) {
            firstPingRef.current = false;
            console.log("📍 Auto-pinning source stop (first GPS fix)");
            pinStop(latitude, longitude);
          }
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


  // 5. HANDLE TAB VISIBILITY CHANGE
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


  // 6. START TRACKING
  const startTracking = () => {
    if (!tripId) { setError("Trip not initialized"); return; }
    if (isTrackingRef.current) return;

    isTrackingRef.current  = true;
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

      // ✅ Auto-pin the SOURCE stop immediately when tracking starts
      if (firstPingRef.current) {
        firstPingRef.current = false;
        console.log("📍 Auto-pinning source stop (demo start)");
        pinStop(lat, lon);
      }

      routeIdxRef.current = resumeIdx + 1;
      startDemoTicker();
    } else {
      attachWatch();
    }
  };


  // 7. STOP TRACKING
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
    prevSpeedRef.current   = 0;
    prevTimeRef.current    = Date.now();
    lastSendTimeRef.current = 0;
  };


  // 7b. RESET TRIP
  const resetTrip = () => {
    lastPosRef.current  = null;
    routeIdxRef.current = 0;
    dwellCountRef.current = 0;
    firstPingRef.current  = true; // ✅ reset so next trip auto-pins source again
    setLastLocation(null);
  };


  // 8. TIMER FOR LAST SEEN
  useEffect(() => {
    if (!isTracking) return;
    const timer = setInterval(() => setLastSent(p => p !== null ? p + 1 : null), 1000);
    return () => clearInterval(timer);
  }, [isTracking]);


  // 9. CLEANUP ON UNMOUNT
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (sendTimerRef.current) clearInterval(sendTimerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { isTracking, busStatus, startTracking, stopTracking, resetTrip, lastSent, error, lastLocation };
};