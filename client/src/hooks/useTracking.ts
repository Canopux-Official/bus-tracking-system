// // import { useEffect, useRef, useState } from "react";
// // import { sendLocation } from "../apis/trip.api";


// // // Custom Hook for GPS Tracking.
// // export const useTracking = (tripId: string | null) => {

// //   const [isTracking, setIsTracking] = useState(false);
// //   const [lastSent, setLastSent] = useState<number | null>(null);
// //   const [error, setError] = useState<string | null>(null);

// //   const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

// //   // Previous Values.
// //   const prevSpeedRef = useRef<number>(0);
// //   const prevTimeRef = useRef<number>(Date.now());

// //   // Prevent Overlapping API Calls.
// //   const isSendingRef = useRef<boolean>(false);


// //   // 1. Start Tracking.
// //   const startTracking = () => {
// //     if (!tripId) {
// //       setError("Trip not initialized");
// //       return;
// //     }
// //     if (!navigator.geolocation) {
// //       console.error("Geolocation not supported");
// //       setError("Geolocation not supported");
// //       return;
// //     }
// //     if (intervalRef.current) return;

// //     setIsTracking(true);
// //     setError(null);

// //     intervalRef.current = setInterval(() => {
// //       navigator.geolocation.getCurrentPosition(
// //         async (pos) => {
// //           if (isSendingRef.current) return;
// //           try {
// //             isSendingRef.current = true;
// //             const { latitude, longitude, speed } = pos.coords;
// //             const velocity =
// //               speed !== null && speed !== undefined
// //                 ? speed
// //                 : prevSpeedRef.current; const now = Date.now();
// //             const deltaTime = (now - prevTimeRef.current) / 1000;
// //             const acceleration = deltaTime > 0 ? (velocity - prevSpeedRef.current) / deltaTime : 0;

// //             // Update Reference.
// //             prevSpeedRef.current = velocity;
// //             prevTimeRef.current = now;

// //             // Log Location.
// //             console.log("📍 LOCATION UPDATE:", {
// //               lat: latitude,
// //               lon: longitude,
// //               vel: velocity,
// //               acc: acceleration,
// //               time: new Date().toLocaleTimeString(),
// //             });

// //             // Send to Backend.
// //             await sendLocation({ tripId, lat: latitude, lon: longitude, vel: velocity, acc: acceleration, status: "moving" });

// //             // Reset Timer Display.
// //             setLastSent(0);

// //           } catch (err) {
// //             console.error("Send error:", err);
// //             setError("Failed to send location");
// //           } finally {
// //             isSendingRef.current = false;
// //           }
// //         },
// //         (err) => {
// //           console.error("GPS error:", err);
// //           setError("GPS unavailable");
// //         },
// //         {
// //           enableHighAccuracy: true,
// //           timeout: 10000,
// //           maximumAge: 0,
// //         }
// //       );
// //       // Runs Every 10 Seconds.
// //     }, 10000);
// //   };


// //   // 2. Stop Tracking.
// //   const stopTracking = async () => {
// //     setIsTracking(false);
// //     if (intervalRef.current) {
// //       clearInterval(intervalRef.current);
// //       intervalRef.current = null;
// //     }

// //     if (tripId) {
// //       try {
// //         await sendLocation({
// //           tripId,
// //           lat: lastPosRef.current?.lat ?? 0,
// //           lon: lastPosRef.current?.lon ?? 0,
// //           vel: 0,
// //           acc: 0,
// //           status: "stopped",
// //         });
// //         console.log("🛑 Stopped at:", lastPosRef.current);
// //       } catch (err) {
// //         console.error("Failed to send stop signal:", err);
// //       }
// //     }

// //     // Reset Values.
// //     prevSpeedRef.current = 0;
// //     prevTimeRef.current = Date.now();
// //   };


// //   // 3. Timer For Last Seen.
// //   useEffect(() => {
// //     if (!isTracking) return;
// //     const timer = setInterval(() => {
// //       setLastSent((prev) => (prev !== null ? prev + 1 : null));
// //     }, 1000);
// //     return () => clearInterval(timer);
// //   }, [isTracking]);


// //   // 4. Cleanup on Unmount.
// //   useEffect(() => {
// //     return () => {
// //       if (intervalRef.current) clearInterval(intervalRef.current);
// //     };
// //   }, []);


// //   return { isTracking, startTracking, stopTracking, lastSent, error }
// // };

// import { useEffect, useRef, useState } from "react";
// import { sendLocation } from "../apis/trip.api";

// export const useTracking = (tripId: string | null) => {

//   const [isTracking, setIsTracking] = useState(false);
//   const [busStatus, setBusStatus] = useState<"idle" | "moving" | "stopped">("idle");
//   const [lastSent, setLastSent] = useState<number | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
//   const prevSpeedRef = useRef<number>(0);
//   const prevTimeRef = useRef<number>(Date.now());
//   const isSendingRef = useRef<boolean>(false);
//   const lastPosRef = useRef<{ lat: number; lon: number } | null>(null); // ← new

//   // 1. Start Tracking.
//   const startTracking = () => {
//     if (!tripId) { setError("Trip not initialized"); return; }
//     if (!navigator.geolocation) { setError("Geolocation not supported"); return; }
//     if (intervalRef.current) return;

//     setIsTracking(true);
//     setBusStatus("moving");
//     setError(null);

//     intervalRef.current = setInterval(() => {
//       navigator.geolocation.getCurrentPosition(
//         async (pos) => {
//           if (isSendingRef.current) return;
//           try {
//             isSendingRef.current = true;
//             const { latitude, longitude, speed } = pos.coords;

//             // Save last known position.
//             lastPosRef.current = { lat: latitude, lon: longitude };

//             const velocity = speed !== null && speed !== undefined ? speed : prevSpeedRef.current;
//             const now = Date.now();
//             const deltaTime = (now - prevTimeRef.current) / 1000;
//             const acceleration = deltaTime > 0 ? (velocity - prevSpeedRef.current) / deltaTime : 0;

//             prevSpeedRef.current = velocity;
//             prevTimeRef.current = now;

//             console.log("📍 LOCATION UPDATE:", {
//               lat: latitude, lon: longitude,
//               vel: velocity, acc: acceleration,
//               time: new Date().toLocaleTimeString(),
//             });

//             await sendLocation({
//               tripId, lat: latitude, lon: longitude,
//               vel: velocity, acc: acceleration,
//               status: "moving",
//             });

//             setLastSent(0);
//           } catch (err) {
//             console.error("Send error:", err);
//             setError("Failed to send location");
//           } finally {
//             isSendingRef.current = false;
//           }
//         },
//         (err) => { console.error("GPS error:", err); setError("GPS unavailable"); },
//         { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
//       );
//     }, 10000);
//   };

//   // 2. Stop Tracking — sends final "stopped" ping with last real position.
//   const stopTracking = async () => {
//     setIsTracking(false);
//     setBusStatus("stopped");

//     if (intervalRef.current) {
//       clearInterval(intervalRef.current);
//       intervalRef.current = null;
//     }

//     if (tripId) {
//       try {
//         await sendLocation({
//           tripId,
//           lat: lastPosRef.current?.lat ?? 0,
//           lon: lastPosRef.current?.lon ?? 0,
//           vel: 0,
//           acc: 0,
//           status: "stopped",
//         });
//         console.log("🛑 Stopped at:", lastPosRef.current);
//       } catch (err) {
//         console.error("Failed to send stop signal:", err);
//       }
//     }

//     prevSpeedRef.current = 0;
//     prevTimeRef.current = Date.now();
//     lastPosRef.current = null;
//   };

//   // 3. Timer For Last Seen.
//   useEffect(() => {
//     if (!isTracking) return;
//     const timer = setInterval(() => {
//       setLastSent((prev) => (prev !== null ? prev + 1 : null));
//     }, 1000);
//     return () => clearInterval(timer);
//   }, [isTracking]);

//   // 4. Cleanup on Unmount.
//   useEffect(() => {
//     return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
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
const USE_DEMO = false;

const DEMO_ROUTE: [number, number, number][] = [
  [20.294204, 85.742366, 0], // Bhubaneswar Rly Station
  [20.293969, 85.742259, 0],

  [20.29362809106558, 85.74215025839784, 0],
  [20.293218, 85.742016, 0],
  [20.292906, 85.741901, 0],

  [20.292604, 85.741785, 0],
  [20.292288, 85.741667, 0],
  [20.291810, 85.741488, 0],
  [20.291212, 85.741259, 0],
  [20.290835, 85.741092, 0],
  [20.290337, 85.740899, 0],
  [20.290031, 85.740740, 0],
  [20.289860, 85.740504, 0],
  [20.290139, 85.740021, 0],
  [20.290368, 85.739651, 0],
  [20.290548, 85.739387, 0],
  [20.290770, 85.738805, 0],
  [20.291034, 85.738046, 0],
  [20.291331, 85.737185, 0],
  [20.291522, 85.736632, 0],


  [20.291695, 85.736157, 0], // STOP 1: 
  [20.291695, 85.736157, 0], // STOP 1:
  [20.291695, 85.736157, 0], // STOP 1: 
  [20.291695, 85.736157, 0], // STOP 1: 
  [20.291695, 85.736157, 0], // STOP 1: 
  [20.291695, 85.736157, 0],
  [20.291695, 85.736157, 0], // stop 1


  [20.291960, 85.735854, 0],
  [20.291858, 85.736124, 0],
  [20.291674, 85.736606, 0],
  [20.291376, 85.737503, 0],
  [20.290787, 85.739144, 0],
  [20.290250, 85.740126, 0],
  [20.290023, 85.740460, 0],
  [20.290191, 85.740677, 0],
  [20.290664, 85.740867, 0],
  [20.291513, 85.741216, 0],
  [20.292045, 85.741432, 0],
  [20.292119, 85.741611, 0],
  [20.293051, 85.741956, 0],


  [20.293155, 85.742004, 0],
  [20.293155, 85.742004, 0], // Traffic pause
  [20.293155, 85.742004, 0],


  [20.293533, 85.742125, 0],
  [20.293692, 85.742053, 0],
  [20.295266, 85.742555, 0],
  [20.296111, 85.742831, 0],
  [20.296433, 85.742970, 0],
  [20.296333, 85.743027, 0],
  [20.295797, 85.742879, 0],


  [20.294433, 85.742426, 0], // STOP 2:
  [20.294433, 85.742426, 0], // STOP 2:
  [20.294433, 85.742426, 0], // STOP 2:
  [20.294433, 85.742426, 0], // STOP 2:
  [20.294433, 85.742426, 0], // STOP 2:
  [20.294433, 85.742426, 0],
  [20.294433, 85.742426, 0],
  [20.294433, 85.742426, 0],


  [20.293201, 85.742023, 0],
  [20.293133, 85.742119, 0],
  [20.292863, 85.742986, 0],
  [20.292230, 85.744743, 0],
  [20.292131, 85.746156, 0],
  [20.292207, 85.746950, 0],
  [20.292325, 85.748323, 0],


  [20.292373, 85.749080, 0], // destination 
  [20.292373, 85.749080, 0],
];

// Small noise so stationary pings don't look perfectly frozen on the map
const jitter = () => (Math.random() - 0.5) * 0.0001;

// ─────────────────────────────────────────────────────────────────────────────

export const useTracking = (tripId: string | null) => {

  const [isTracking, setIsTracking] = useState(false);
  const [busStatus, setBusStatus] = useState<"idle" | "moving" | "stopped">("idle");
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevSpeedRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(Date.now());
  const isSendingRef = useRef<boolean>(false);
  const lastPosRef = useRef<{ lat: number; lon: number } | null>(null);

  // Demo-only refs — track where we are in the route
  const routeIdxRef = useRef<number>(0);   // which DEMO_ROUTE point we're on
  const dwellCountRef = useRef<number>(0);   // how many dwell pings sent so far

  // ── shared send logic (used by both demo and real GPS) ────────────────────
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

      lastPosRef.current = { lat: latitude, lon: longitude };

      console.log("📍 LOCATION UPDATE:", {
        lat: latitude, lon: longitude,
        vel: velocity, acc: acceleration,
        time: new Date().toLocaleTimeString(),
      });

      await sendLocation({
        tripId, lat: latitude, lon: longitude,
        vel: velocity, acc: acceleration,
        status,
      });

      setLastSent(0);
      setError(null);
    } catch (err) {
      console.error("Send error:", err);
      setError("Failed to send location");
    } finally {
      isSendingRef.current = false;
    }
  };

  // ── demo tick — replaces navigator.geolocation.getCurrentPosition ─────────
  const demoTick = async () => {
    const idx = routeIdxRef.current;

    // Reached end of route — stop automatically
    if (idx >= DEMO_ROUTE.length) {
      stopTracking();
      return;
    }

    const [baseLat, baseLng, dwellPings] = DEMO_ROUTE[idx];
    const isDwelling = dwellCountRef.current < dwellPings;

    const lat = isDwelling ? baseLat + jitter() : baseLat;
    const lng = isDwelling ? baseLng + jitter() : baseLng;
    const vel = isDwelling ? 0 : Math.round(20 + Math.random() * 20);
    const acc = isDwelling ? 0 : Math.round(Math.random() * 3);
    const status = isDwelling ? "stopped" : "moving";

    setBusStatus(status);

    console.log(
      `[demo] point ${idx}/${DEMO_ROUTE.length - 1}`,
      isDwelling
        ? `DWELL ${dwellCountRef.current + 1}/${dwellPings}`
        : "MOVING"
    );

    await sendPing(lat, lng, vel, acc, status);

    // Advance the route pointer
    if (isDwelling) {
      dwellCountRef.current += 1;
      if (dwellCountRef.current >= dwellPings) {
        dwellCountRef.current = 0;
        routeIdxRef.current += 1;
      }
    } else {
      routeIdxRef.current += 1;
    }
  };

  // 1. Start Tracking.
  const startTracking = () => {
    if (!tripId) { setError("Trip not initialized"); return; }
    if (intervalRef.current) return;

    // Reset demo pointer every time tracking starts
    routeIdxRef.current = 0;
    dwellCountRef.current = 0;

    setIsTracking(true);
    setBusStatus("moving");
    setError(null);

    if (USE_DEMO) {
      // ── DEMO MODE ──────────────────────────────────────────────────────────
      // Fire first ping immediately, then every 10s
      demoTick();
      intervalRef.current = setInterval(demoTick, 10_000);

    } else {
      // ── REAL GPS (your original code, untouched) ───────────────────────────
      if (!navigator.geolocation) { setError("Geolocation not supported"); return; }

      intervalRef.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude, speed } = pos.coords;
            const velocity = speed !== null && speed !== undefined ? speed : prevSpeedRef.current;
            const now = Date.now();
            const deltaTime = (now - prevTimeRef.current) / 1000;
            const acceleration = deltaTime > 0 ? (velocity - prevSpeedRef.current) / deltaTime : 0;
            prevSpeedRef.current = velocity;
            prevTimeRef.current = now;
            setBusStatus("moving");
            await sendPing(latitude, longitude, velocity, acceleration, "moving");
          },
          (err) => { console.error("GPS error:", err); setError("GPS unavailable"); },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }, 10000);
    }
  };

  // 2. Stop Tracking — sends final "stopped" ping with last known position.
  const stopTracking = async () => {
    setIsTracking(false);
    setBusStatus("stopped");

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // ✅ Capture last position BEFORE nulling the ref
    const lastPos = lastPosRef.current;

    if (tripId && lastPos) {  // ✅ Only send if we actually have a position
      try {
        await sendLocation({
          tripId,
          lat: lastPos.lat,
          lon: lastPos.lon,
          vel: 0, acc: 0,
          status: "stopped",
        });
        console.log("🛑 Stopped at:", lastPos);
      } catch (err) {
        console.error("Failed to send stop signal:", err);
      }
    } else {
      console.warn("⚠️ stopTracking called with no last known position");
    }

    prevSpeedRef.current = 0;
    prevTimeRef.current = Date.now();
    lastPosRef.current = null;  // ✅ Null AFTER the sendLocation call
  };

  // 3. Timer for Last Seen — your original, unchanged.
  useEffect(() => {
    if (!isTracking) return;
    const timer = setInterval(() => {
      setLastSent((prev) => (prev !== null ? prev + 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [isTracking]);

  // 4. Cleanup on Unmount — your original, unchanged.
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return { isTracking, busStatus, startTracking, stopTracking, lastSent, error };
};
