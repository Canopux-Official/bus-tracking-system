// import { useEffect, useRef, useState } from "react";
// import { sendLocation } from "../apis/trip.api";

// // ─── Demo route (Bhubaneswar) ─────────────────────────────────────────────────
// // [lat, lng, dwell_pings]
// // dwell_pings = how many consecutive 10s pings to send at this exact spot
// //   0 = moving through, advances to next point next tick
// //   6 = stays here for 6 × 10s = 60s  →  triggers 50s Python threshold
// //   2 = traffic pause, 20s            →  below 50s, NOT saved as stop
// //
// // To go back to real GPS: set USE_DEMO = false
// const USE_DEMO = false;

// // const DEMO_ROUTE: [number, number, number][] = [
// //   [20.280582, 85.762401, 0], // Bhubaneswar Rly Station
// //   [20.279540, 85.762685, 0],

// //   [20.278246, 85.762898, 0],
// //   [20.277268, 85.763054, 0],

// //   [20.276767, 85.763223, 0],

// //   [20.276865, 85.764003, 0],

// //   [20.276825, 85.764709, 0],

// //   [20.276928, 85.765468, 0],

// //   [20.277356, 85.766050, 0],

// //   [20.278835, 85.767391, 0],

// //   [20.278978, 85.768394, 0],

// //   [20.279361, 85.768415, 0],

// //   [20.279791, 85.768332, 0],

// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],
// //   [20.279791, 85.768332, 0],

// //   [20.279871, 85.769318, 0],


// //   [20.279976, 85.770316,0],

// //   [20.280474, 85.770780,0],


// // ];

// export const useTracking = (tripId: string | null) => {

//   const [isTracking, setIsTracking]  = useState(false);
//   const [busStatus, setBusStatus]    = useState<"idle" | "moving" | "stopped">("idle");
//   const [lastSent, setLastSent]      = useState<number | null>(null);
//   const [error, setError]            = useState<string | null>(null);

//   const watchIdRef      = useRef<number | null>(null);
//   const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
//   const sendTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
//   const isSendingRef    = useRef<boolean>(false);
//   const isTrackingRef   = useRef<boolean>(false);
//   const lastPosRef      = useRef<{ lat: number; lon: number; vel: number; acc: number } | null>(null);
//   const prevSpeedRef    = useRef<number>(0);
//   const prevTimeRef     = useRef<number>(Date.now());
//   const lastSendTimeRef = useRef<number>(0);


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

//       // Store Latest Position.
//       lastPosRef.current = { lat: latitude, lon: longitude, vel: velocity, acc: acceleration };
//       console.log("📍 LOCATION UPDATE:", {
//         lat: latitude, lon: longitude,
//         vel: velocity, acc: acceleration,
//         time: new Date().toLocaleTimeString(),
//       });

//       // // API Call.
//       await sendLocation({ tripId, lat: latitude, lon: longitude, vel: velocity, acc: acceleration, status });
//       setLastSent(0);
//       setError(null);

//     } catch (err) {
//       console.error("Send error:", err);
//       setError("Failed to send location");
//     } finally {
//       isSendingRef.current = false;
//     }
//   };


//   // 2. FALLBACK SENDER: GUARANTEES LOCATION UPDATES EVERY 10s.
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


//   // 3. START GPS TRACKING.
//   const attachWatch = () => {
//     if (!navigator.geolocation) { setError("Geolocation not supported"); return; }
    
//     if (watchIdRef.current !== null) {
//       navigator.geolocation.clearWatch(watchIdRef.current);
//       watchIdRef.current = null;
//     }

//     // Start Watching Position.
//     watchIdRef.current = navigator.geolocation.watchPosition(
//       (pos) => {
//         const { latitude, longitude, speed } = pos.coords;
//         const velocity = speed !== null && speed !== undefined ? speed : prevSpeedRef.current;
//         const now = Date.now();
//         const deltaTime = (now - prevTimeRef.current) / 1000;
//         const acceleration = deltaTime > 0 ? (velocity - prevSpeedRef.current) / deltaTime : 0;
//         prevSpeedRef.current = velocity;
//         prevTimeRef.current  = now;

//         // Store Latest Position.
//         lastPosRef.current = { lat: latitude, lon: longitude, vel: velocity, acc: acceleration };
//         setError(null);

//         // Primary Sending Logic: Send Immediately on GPS Update, but only if not sent in last 10s.
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

//         if (watchIdRef.current !== null) {
//           navigator.geolocation.clearWatch(watchIdRef.current);
//           watchIdRef.current = null;
//         }
//         if (sendTimerRef.current) {
//           clearInterval(sendTimerRef.current);
//           sendTimerRef.current = null;
//         }
//       },
//       { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
//     );
//     // Start Backup Sending Mechanism.
//     startSendTimer();
//   };


//   // 4. HANDLE TAB VISIBILITY CHANGE.
//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState === "visible" && isTrackingRef.current) {
//         console.log("👁 Tab visible — checking timers");

//         if (sendTimerRef.current === null) {
//           console.log("🔁 Restarting send timer");
//           startSendTimer(); 
//         }
//         if (watchIdRef.current === null) {
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


//   // 5. START TRACKING.
//   const startTracking = () => {
//     if (!tripId) { setError("Trip not initialized"); return; }
//     if (isTrackingRef.current) return;

//     isTrackingRef.current   = true;
//     lastSendTimeRef.current = Date.now(); 

//     setIsTracking(true);
//     setBusStatus("moving");
//     setError(null);

//     if (USE_DEMO) {
//     } else {
//       attachWatch();
//     }
//   };

//   // 2. Stop Tracking — sends final "stopped" ping with last known position.
//   const stopTracking = async () => {     
//     setIsTracking(false);
//     setBusStatus("stopped");

//     if (watchIdRef.current !== null) {
//       navigator.geolocation.clearWatch(watchIdRef.current);
//       watchIdRef.current = null;
//     }
//     if (sendTimerRef.current) { clearInterval(sendTimerRef.current); sendTimerRef.current = null; }
//     if (intervalRef.current)  { clearInterval(intervalRef.current);  intervalRef.current  = null; }

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
//     prevSpeedRef.current    = 0;
//     prevTimeRef.current     = Date.now();
//     lastPosRef.current      = null;
//     lastSendTimeRef.current = 0;
//   };

  
//   // 7. TIMER FOR LAST SEEN.
//   useEffect(() => {
//     if (!isTracking) return;
//     const timer = setInterval(() => setLastSent(p => p !== null ? p + 1 : null), 1000);
//     return () => clearInterval(timer);
//   }, [isTracking]);

 
//   // 8. CLEANUP ON UNMOUNT.
//   useEffect(() => {
//     return () => {
//       if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
//       if (sendTimerRef.current) clearInterval(sendTimerRef.current);
//       if (intervalRef.current)  clearInterval(intervalRef.current);
//     };
//   }, []);

//   return { isTracking, busStatus, startTracking, stopTracking, lastSent, error };
// };




import { useEffect, useRef, useState } from "react";
import { sendLocation } from "../apis/trip.api";

// ─── Demo route (Bhubaneswar) ─────────────────────────────────────────────────
// [lat, lng, dwell_pings]
// dwell_pings = how many consecutive 10s pings to send at this exact spot
//   0 = moving through, advances to next point next tick
//   6 = stays here for 6 × 10s = 60s  →  triggers 50s Python threshold
//   2 = traffic pause, 20s            →  below 50s, NOT saved as stop
//
// To go back to real GPS: set USE_DEMO = false
const USE_DEMO = true;

const DEMO_ROUTE: [number, number, number][] = [
  [20.280582, 85.762401, 0], // Bhubaneswar Rly Station
  [20.279540, 85.762685, 0],
  [20.278246, 85.762898, 0],
  [20.277268, 85.763054, 0],
  [20.276767, 85.763223, 0],
  [20.276865, 85.764003, 0],
  [20.276825, 85.764709, 0],
  [20.276928, 85.765468, 0],
  [20.277356, 85.766050, 0],
  [20.278835, 85.767391, 0],
  [20.278978, 85.768394, 0],
  [20.279361, 85.768415, 0],
  [20.279791, 85.768332, 0],
  [20.279791, 85.768332, 6], // dwell for ~60s (6 pings × 10s)
  [20.279871, 85.769318, 0],
  [20.279976, 85.770316, 0],
  [20.280474, 85.770780, 0],
];

export const useTracking = (tripId: string | null) => {

  const [isTracking, setIsTracking]  = useState(false);
  const [busStatus, setBusStatus]    = useState<"idle" | "moving" | "stopped">("idle");
  const [lastSent, setLastSent]      = useState<number | null>(null);
  const [error, setError]            = useState<string | null>(null);
  const [lastLocation, setLastLocation] = useState<{ lat: number; lon: number; vel: number; acc: number; time: string } | null>(null);

  const watchIdRef      = useRef<number | null>(null);
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSendingRef    = useRef<boolean>(false);
  const isTrackingRef   = useRef<boolean>(false);
  const lastPosRef      = useRef<{ lat: number; lon: number; vel: number; acc: number } | null>(null);
  const prevSpeedRef    = useRef<number>(0);
  const prevTimeRef     = useRef<number>(Date.now());
  const lastSendTimeRef = useRef<number>(0);

  // ─── Demo-specific refs ───────────────────────────────────────────────────
  // routeIdxRef  : which waypoint we're currently at
  // dwellCountRef: how many pings we've already sent at this waypoint
  const routeIdxRef   = useRef<number>(0);
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
      console.log("📍 LOCATION UPDATE:", {
        lat: latitude, lon: longitude,
        vel: velocity, acc: acceleration,
        time: pingTime,
      });

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


  // 2. FALLBACK SENDER: GUARANTEES LOCATION UPDATES EVERY 10s (real GPS only).
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
        // Route finished — stop automatically.
        console.log("🏁 Demo route complete");
        stopTracking();
        return;
      }

      const [lat, lon, dwellPings] = DEMO_ROUTE[idx];

      // Compute a fake velocity (distance / 10s) for context.
      const prevLat = lastPosRef.current?.lat ?? lat;
      const prevLon = lastPosRef.current?.lon ?? lon;
      const dLat = lat - prevLat;
      const dLon = lon - prevLon;
      const distMetres = Math.sqrt(dLat * dLat + dLon * dLon) * 111_320;
      const velocity = distMetres / 10; // m/s

      lastSendTimeRef.current = Date.now();
      setBusStatus("moving");
      await sendPing(lat, lon, velocity, 0, "moving");

      // Decide whether to advance or dwell.
      if (dwellPings > 0 && dwellCountRef.current < dwellPings) {
        // Still dwelling at this waypoint.
        dwellCountRef.current += 1;
        console.log(`⏸ Dwelling at waypoint ${idx} (${dwellCountRef.current}/${dwellPings})`);
      } else {
        // Move to the next waypoint.
        routeIdxRef.current   = idx + 1;
        dwellCountRef.current = 0;
        console.log(`➡️  Moving to waypoint ${idx + 1}`);
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
        prevTimeRef.current  = now;

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

        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        if (sendTimerRef.current) {
          clearInterval(sendTimerRef.current);
          sendTimerRef.current = null;
        }
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

    isTrackingRef.current   = true;
    lastSendTimeRef.current = Date.now();

    setIsTracking(true);
    setBusStatus("moving");
    setError(null);

    if (USE_DEMO) {
      const resumeIdx = routeIdxRef.current;

      if (resumeIdx >= DEMO_ROUTE.length) {
        // Route already finished — nothing to resume.
        console.warn("⚠️ Demo route already complete. End the trip to restart.");
        isTrackingRef.current = false;
        setIsTracking(false);
        setBusStatus("stopped");
        return;
      }

      // Send the resume point immediately (no 10s wait).
      const [lat, lon] = DEMO_ROUTE[resumeIdx];
      lastPosRef.current = { lat, lon, vel: 0, acc: 0 };
      sendPing(lat, lon, 0, 0, "moving");
      routeIdxRef.current = resumeIdx + 1; // next tick picks up from here

      // Start the 10s ticker.
      startDemoTicker();
    } else {
      attachWatch();
    }
  };


  // 7. STOP TRACKING — sends final "stopped" ping with last known position.
  const stopTracking = async () => {     
    isTrackingRef.current = false;
    setIsTracking(false);
    setBusStatus("stopped");

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (sendTimerRef.current) { clearInterval(sendTimerRef.current); sendTimerRef.current = null; }
    if (intervalRef.current)  { clearInterval(intervalRef.current);  intervalRef.current  = null; }

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

    prevSpeedRef.current    = 0;
    prevTimeRef.current     = Date.now();
    // NOTE: lastPosRef, routeIdxRef, dwellCountRef intentionally preserved
    // so START resumes from the exact same position. Only resetTrip() clears them.
    lastSendTimeRef.current = 0;
  };


  // 7b. RESET TRIP — called by endTrip to fully wipe route state.
  const resetTrip = () => {
    lastPosRef.current      = null;
    routeIdxRef.current     = 0;
    dwellCountRef.current   = 0;
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
      if (intervalRef.current)  clearInterval(intervalRef.current);
    };
  }, []);

  return { isTracking, busStatus, startTracking, stopTracking, resetTrip, lastSent, error, lastLocation };
};