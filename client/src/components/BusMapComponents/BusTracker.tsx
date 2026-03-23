
// import { useEffect, useRef, useState, useCallback } from "react";
// import L from "leaflet";
// import type { Map, Marker, Polyline } from "leaflet";
// import "leaflet/dist/leaflet.css";
// import { io, Socket } from "socket.io-client";

// // npm install socket.io-client

// // ── types ─────────────────────────────────────────────────────────────────────

// type LatLng = [number, number];

// type Status = "idle" | "connecting" | "riding" | "waiting" | "stopped";

// /** Shape of each locationUpdate event from the server */
// interface LocationUpdate {
//   tripId: string;
//   lat: number;
//   lon: number;
//   vel?: number | null;
//   acc?: number | null;
//   timestamp: number;
// }

// // ── constants ─────────────────────────────────────────────────────────────────

// const OSRM_BASE      = "https://router.project-osrm.org/route/v1/driving";
// const SOCKET_URL     = "http://localhost:4000";   // ← change to your server URL
// const ANIM_DURATION  = 10_000;                    // 10 seconds per segment

// const STATUS_LABELS: Record<Status, string> = {
//   idle:       "Waiting for connection…",
//   connecting: "Connecting…",
//   riding:     "Bus moving",
//   waiting:    "Waiting for next location…",
//   stopped:    "Bus stopped",
// };

// // ── pure helpers ──────────────────────────────────────────────────────────────

// const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// const easeInOut = (t: number): number =>
//   t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

// function decodePolyline(encoded: string): LatLng[] {
//   const points: LatLng[] = [];
//   let idx = 0, lat = 0, lng = 0;
//   while (idx < encoded.length) {
//     let b: number, shift = 0, result = 0;
//     do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
//     lat += result & 1 ? ~(result >> 1) : result >> 1;
//     shift = 0; result = 0;
//     do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
//     lng += result & 1 ? ~(result >> 1) : result >> 1;
//     points.push([lat / 1e5, lng / 1e5]);
//   }
//   return points;
// }

// function buildCumulativeDist(coords: LatLng[]): number[] {
//   const cd: number[] = [0];
//   for (let i = 1; i < coords.length; i++) {
//     const dlat = coords[i][0] - coords[i - 1][0];
//     const dlng = coords[i][1] - coords[i - 1][1];
//     cd.push(cd[cd.length - 1] + Math.sqrt(dlat * dlat + dlng * dlng));
//   }
//   return cd;
// }

// function getPositionAt(t: number, points: LatLng[], cumulDist: number[]): LatLng {
//   const total  = cumulDist[cumulDist.length - 1];
//   const target = t * total;
//   let lo = 0, hi = cumulDist.length - 2;
//   while (lo < hi) {
//     const mid = (lo + hi) >> 1;
//     if (cumulDist[mid + 1] < target) lo = mid + 1;
//     else hi = mid;
//   }
//   const seg  = cumulDist[lo + 1] - cumulDist[lo];
//   const segT = seg === 0 ? 0 : (target - cumulDist[lo]) / seg;
//   return [
//     lerp(points[lo][0], points[lo + 1][0], segT),
//     lerp(points[lo][1], points[lo + 1][1], segT),
//   ];
// }

// function bearing(from: LatLng, to: LatLng): number {
//   const toRad = (d: number) => (d * Math.PI) / 180;
//   const toDeg = (r: number) => (r * 180) / Math.PI;
//   const dLng  = toRad(to[1] - from[1]);
//   const lat1  = toRad(from[0]);
//   const lat2  = toRad(to[0]);
//   const y     = Math.sin(dLng) * Math.cos(lat2);
//   const x     = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
//   return (toDeg(Math.atan2(y, x)) + 360) % 360;
// }

// function buildFallbackPath(from: LatLng, to: LatLng, steps = 40): LatLng[] {
//   const path: LatLng[] = [];
//   for (let i = 0; i <= steps; i++) {
//     const t   = i / steps;
//     const arc = Math.sin(t * Math.PI) * 0.003;
//     path.push([lerp(from[0], to[0], t) + arc, lerp(from[1], to[1], t) + arc]);
//   }
//   return path;
// }

// // ── styles ────────────────────────────────────────────────────────────────────

// const styles = `
//   @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700&display=swap');

//   .smt-root { font-family:'Syne',sans-serif; background:#0d0f14; color:#e8e6e0; min-height:100vh; padding:24px; box-sizing:border-box; }
//   .smt-header { display:flex; align-items:baseline; gap:12px; margin-bottom:20px; }
//   .smt-title  { font-size:22px; font-weight:700; color:#e8e6e0; letter-spacing:-0.5px; margin:0; }
//   .smt-badge  { font-family:'DM Mono',monospace; font-size:11px; background:#1a2f1a; color:#4ade80; border:1px solid #2d4a2d; padding:3px 8px; border-radius:4px; }
//   .smt-badge.disconnected { background:#2f1a1a; color:#f87171; border-color:#4a2d2d; }

//   .smt-map-wrap { position:relative; border-radius:12px; overflow:hidden; border:1px solid #1e2530; }
//   .smt-map-div  { width:100%; height:460px; }

//   .smt-overlay {
//     position:absolute; top:12px; right:12px;
//     background:rgba(13,15,20,0.9); backdrop-filter:blur(8px);
//     border:1px solid #1e2530; border-radius:10px;
//     padding:12px 16px; min-width:180px; z-index:1000;
//   }
//   .smt-overlay-label { font-family:'DM Mono',monospace; font-size:10px; color:#5a6070; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
//   .smt-overlay-val   { font-family:'DM Mono',monospace; font-size:16px; font-weight:500; color:#4ade80; line-height:1.4; }
//   .smt-overlay-row   { margin-top:8px; padding-top:8px; border-top:1px solid #1e2530; }
//   .smt-overlay-meta  { font-family:'DM Mono',monospace; font-size:11px; color:#5a6070; margin-top:3px; }

//   .smt-status-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
//   .smt-chip {
//     font-family:'DM Mono',monospace; font-size:11px; padding:4px 10px;
//     border-radius:20px; border:1px solid #1e2530; background:#0d0f14; color:#5a6070;
//   }
//   .smt-chip.active  { border-color:#4ade80; color:#4ade80; background:#0d1a0d; }
//   .smt-chip.waiting { border-color:#facc15; color:#facc15; background:#1a1800; }
//   .smt-chip.error   { border-color:#f87171; color:#f87171; background:#1a0d0d; }

//   .smt-log {
//     margin-top:14px; background:#080a0f; border:1px solid #1e2530;
//     border-radius:8px; padding:10px 14px; max-height:140px; overflow-y:auto;
//   }
//   .smt-log-title { font-family:'DM Mono',monospace; font-size:10px; color:#5a6070; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
//   .smt-log-entry { font-family:'DM Mono',monospace; font-size:11px; color:#5a6070; line-height:1.8; }
//   .smt-log-entry.new { color:#4ade80; }

//   /* Leaflet dark theme */
//   .smt-map-wrap .leaflet-container { background:#1a1d24; }
//   .smt-map-wrap .leaflet-tile { filter:invert(0.92) hue-rotate(180deg) brightness(0.85) saturate(0.8); }
//   .smt-map-wrap .leaflet-control-zoom a { background:#0d0f14 !important; color:#e8e6e0 !important; border-color:#1e2530 !important; }
//   .smt-map-wrap .leaflet-control-zoom a:hover { background:#1e2530 !important; }
//   .smt-map-wrap .leaflet-control-attribution { display:none; }

//   .bike-icon-inner {
//     width:38px; height:38px; background:#0d0f14;
//     border:2px solid #4ade80; border-radius:50%;
//     display:flex; align-items:center; justify-content:center;
//     font-size:18px; box-shadow:0 0 12px rgba(74,222,128,0.4);
//     transition:transform 0.3s ease;
//   }
//   .pulse-dot {
//     width:10px; height:10px; border-radius:50%; background:#4ade80;
//     animation: pulse 1.5s infinite;
//   }
//   @keyframes pulse {
//     0%   { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); }
//     70%  { box-shadow: 0 0 0 8px rgba(74,222,128,0); }
//     100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); }
//   }
// `;

// // ── log entry type ────────────────────────────────────────────────────────────

// interface LogEntry {
//   id: number;
//   text: string;
//   isNew: boolean;
// }

// // ── component ─────────────────────────────────────────────────────────────────

// export default function BusTracker() {
//   const mapContainerRef = useRef<HTMLDivElement>(null);
//   const mapRef          = useRef<Map | null>(null);
//   const markerRef       = useRef<Marker | null>(null);
//   const routeLayerRef   = useRef<Polyline | null>(null);
//   const animFrameRef    = useRef<number | null>(null);
//   const startTimeRef    = useRef<number | null>(null);
//   const socketRef       = useRef<Socket | null>(null);

//   // Stores the current real position of the bus (latest received coordinate)
//   const currentPosRef   = useRef<LatLng | null>(null);
//   // Route points for current segment being animated
//   const routePointsRef  = useRef<LatLng[]>([]);
//   const cumulDistRef    = useRef<number[]>([]);

//   const [status, setStatus]           = useState<Status>("idle");
//   const [connected, setConnected]     = useState(false);
//   const [lastUpdate, setLastUpdate]   = useState<LocationUpdate | null>(null);
//   const [logs, setLogs]               = useState<LogEntry[]>([]);
//   const logCountRef                   = useRef(0);

//   const addLog = useCallback((text: string) => {
//     const id = ++logCountRef.current;
//     setLogs((prev) => {
//       const updated = prev.map((e) => ({ ...e, isNew: false }));
//       return [...updated, { id, text, isNew: true }].slice(-20); // keep last 20
//     });
//   }, []);

//   // ── stop animation ──────────────────────────────────────────────────────────
//   const stopAnimation = useCallback(() => {
//     if (animFrameRef.current !== null) {
//       cancelAnimationFrame(animFrameRef.current);
//       animFrameRef.current = null;
//     }
//   }, []);

//   // ── animate from point A → point B along road ───────────────────────────────
//   const animateSegment = useCallback(
//     (from: LatLng, to: LatLng) => {
//       const map = mapRef.current;
//       if (!map) return;

//       stopAnimation();

//       // Remove old route line
//       if (routeLayerRef.current) {
//         map.removeLayer(routeLayerRef.current);
//         routeLayerRef.current = null;
//       }

//       const run = (routePoints: LatLng[]) => {
//         routePointsRef.current = routePoints;
//         cumulDistRef.current   = buildCumulativeDist(routePoints);

//         // Draw the new segment line
//         routeLayerRef.current = L.polyline(routePoints, {
//           color: "#4ade80",
//           weight: 4,
//           opacity: 0.65,
//         }).addTo(map);

//         // Pan map to show the segment
//         map.fitBounds(routeLayerRef.current.getBounds(), { padding: [60, 60], maxZoom: 16 });

//         // Place or move bike marker to start
//         if (!markerRef.current) {
//           markerRef.current = L.marker(from, {
//             icon: L.divIcon({
//               className: "",
//               html: `<div class="bike-icon-inner" id="smt-bike-icon">🚌</div>`,
//               iconSize:   [38, 38] as [number, number],
//               iconAnchor: [19, 19] as [number, number],
//             }),
//           }).addTo(map);
//         } else {
//           markerRef.current.setLatLng(from);
//         }

//         startTimeRef.current = null;
//         setStatus("riding");

//         const animate = (ts: number): void => {
//           if (startTimeRef.current === null) startTimeRef.current = ts;

//           const raw = Math.min((ts - startTimeRef.current) / ANIM_DURATION, 1);
//           const t   = easeInOut(raw);
//           const pos = getPositionAt(t, routePointsRef.current, cumulDistRef.current);

//           markerRef.current?.setLatLng(pos);
//           // Store as current position so next segment starts from here
//           currentPosRef.current = pos;

//           // Rotate icon toward direction of travel
//           if (raw < 1) {
//             const nextPos = getPositionAt(
//               easeInOut(Math.min(raw + 0.01, 1)),
//               routePointsRef.current,
//               cumulDistRef.current
//             );
//             const deg    = bearing(pos, nextPos);
//             const iconEl = document.getElementById("smt-bike-icon") as HTMLDivElement | null;
//             if (iconEl) iconEl.style.transform = `rotate(${deg - 90}deg)`;
//           }

//           if (raw < 1) {
//             animFrameRef.current = requestAnimationFrame(animate);
//           } else {
//             // Animation done — wait for next socket event
//             currentPosRef.current = to;
//             setStatus("waiting");
//             animFrameRef.current  = null;
//           }
//         };

//         animFrameRef.current = requestAnimationFrame(animate);
//       };

//       // Try OSRM for real road path, fallback to curved line
//       const url =
//         `${OSRM_BASE}/${from[1]},${from[0]};${to[1]},${to[0]}` +
//         `?overview=full&geometries=polyline`;

//       fetch(url)
//         .then((r) => r.json())
//         .then((data) => {
//           if (data.code === "Ok" && data.routes?.length) {
//             run(decodePolyline(data.routes[0].geometry));
//           } else {
//             run(buildFallbackPath(from, to));
//           }
//         })
//         .catch(() => run(buildFallbackPath(from, to)));
//     },
//     [stopAnimation]
//   );

//   // ── init Leaflet ────────────────────────────────────────────────────────────
//   useEffect(() => {
//     if (mapRef.current || !mapContainerRef.current) return;

//     const map = L.map(mapContainerRef.current, {
//       zoomControl: true,
//       attributionControl: false,
//     }).setView([28.62, 77.22], 13);

//     L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
//       maxZoom: 19,
//     }).addTo(map);

//     mapRef.current = map;
//     return () => { map.remove(); mapRef.current = null; };
//   }, []);

//   // ── Socket.IO connection ────────────────────────────────────────────────────
//   useEffect(() => {
//     // const socket = io(SOCKET_URL, { transports: ["websocket"] });
//     const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
//     socketRef.current = socket;

//     socket.on("connect", () => {
//       setConnected(true);
//       setStatus("waiting");
//       addLog(`[${new Date().toLocaleTimeString()}] Connected — waiting for bus location…`);
//     });

//     socket.on("disconnect", () => {
//       setConnected(false);
//       setStatus("idle");
//       addLog(`[${new Date().toLocaleTimeString()}] Disconnected from server.`);
//     });

//     // 🔑 Core event handler
//     socket.on("locationUpdate", (data: LocationUpdate) => {
//       const newPos: LatLng = [data.lat, data.lon];

//       setLastUpdate(data);
//       addLog(
//         `[${new Date().toLocaleTimeString()}] Trip ${data.tripId.slice(-6)} → lat:${data.lat.toFixed(4)} lon:${data.lon.toFixed(4)}${data.vel != null ? ` vel:${data.vel}km/h` : ""}`
//       );

//       if (currentPosRef.current === null) {
//         // First location ever — just place the marker, wait for next point
//         currentPosRef.current = newPos;
//         setStatus("waiting");

//         const map = mapRef.current;
//         if (map) {
//           map.setView(newPos, 15);

//           // Place initial marker
//           if (!markerRef.current) {
//             markerRef.current = L.marker(newPos, {
//               icon: L.divIcon({
//                 className: "",
//                 html: `<div class="bike-icon-inner" id="smt-bike-icon">🚌</div>`,
//                 iconSize:   [38, 38] as [number, number],
//                 iconAnchor: [19, 19] as [number, number],
//               }),
//             }).addTo(map);
//           }
//         }

//         addLog(`[${new Date().toLocaleTimeString()}] First point set. Waiting for next location…`);
//       } else {
//         // We have a previous position — animate from there to here
//         const from = currentPosRef.current;
//         animateSegment(from, newPos);
//       }
//     });

//     return () => {
//       socket.disconnect();
//       socketRef.current = null;
//     };
//   }, [addLog, animateSegment]);

//   // ── derived UI ──────────────────────────────────────────────────────────────
//   const chipClass =
//     status === "riding"  ? "active"  :
//     status === "waiting" ? "waiting" :
//     status === "stopped" ? "error"   : "";

//   return (
//     <>
//       <style>{styles}</style>
//       <div className="smt-root">

//         {/* Header */}
//         <div className="smt-header">
//           <h1 className="smt-title">Bus Tracker</h1>
//           <span className={`smt-badge ${connected ? "" : "disconnected"}`}>
//             {connected ? "● Live" : "○ Disconnected"}
//           </span>
//         </div>

//         {/* Map */}
//         <div className="smt-map-wrap">
//           <div className="smt-map-div" ref={mapContainerRef} />

//           {/* Overlay */}
//           <div className="smt-overlay">
//             <div className="smt-overlay-label">Status</div>
//             <div className="smt-overlay-val">{STATUS_LABELS[status]}</div>

//             {lastUpdate && (
//               <div className="smt-overlay-row">
//                 <div className="smt-overlay-meta">
//                   lat: {lastUpdate.lat.toFixed(5)}
//                 </div>
//                 <div className="smt-overlay-meta">
//                   lon: {lastUpdate.lon.toFixed(5)}
//                 </div>
//                 {lastUpdate.vel != null && (
//                   <div className="smt-overlay-meta">vel: {lastUpdate.vel} km/h</div>
//                 )}
//                 <div className="smt-overlay-meta" style={{ marginTop: 6, color: "#3a4050" }}>
//                   {new Date(lastUpdate.timestamp).toLocaleTimeString()}
//                 </div>
//               </div>
//             )}

//             {status === "riding" && (
//               <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
//                 <div className="pulse-dot" />
//                 <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#4ade80" }}>
//                   animating…
//                 </span>
//               </div>
//             )}
//           </div>
//         </div>

//         {/* Status chips */}
//         <div className="smt-status-row">
//           <div className={`smt-chip ${chipClass}`}>{STATUS_LABELS[status]}</div>
//           <div className={`smt-chip ${connected ? "active" : "error"}`}>
//             {connected ? "Socket connected" : "Socket disconnected"}
//           </div>
//           <div className="smt-chip">10s segments</div>
//           <div className="smt-chip">OSRM road routing</div>
//         </div>

//         {/* Event log */}
//         <div className="smt-log">
//           <div className="smt-log-title">Event log</div>
//           {logs.length === 0 && (
//             <div className="smt-log-entry">No events yet…</div>
//           )}
//           {logs.map((entry) => (
//             <div key={entry.id} className={`smt-log-entry ${entry.isNew ? "new" : ""}`}>
//               {entry.text}
//             </div>
//           ))}
//         </div>

//       </div>
//     </>
//   );
// }


// import { useEffect, useRef, useState, useCallback } from "react";
// import L from "leaflet";
// import type { Map, Marker, Polyline } from "leaflet";
// import "leaflet/dist/leaflet.css";
// import { io, Socket } from "socket.io-client";

// // ── types ─────────────────────────────────────────────────────────────────────

// type LatLng = [number, number];

// type Status = "idle" | "connecting" | "riding" | "waiting" | "stopped";

// interface LocationUpdate {
//   tripId: string;
//   lat: number;
//   lon: number;
//   vel?: number | null;
//   acc?: number | null;
//   timestamp: number;
// }

// // ── constants ─────────────────────────────────────────────────────────────────

// const OSRM_BASE     = "https://router.project-osrm.org/route/v1/driving";
// const SOCKET_URL    = "http://localhost:4000";
// const ANIM_DURATION = 10_000;

// const STATUS_LABELS: Record<Status, string> = {
//   idle:       "Waiting for connection…",
//   connecting: "Connecting…",
//   riding:     "Bus moving",
//   waiting:    "Waiting for next location…",
//   stopped:    "Bus stopped",
// };

// // ── pure helpers ──────────────────────────────────────────────────────────────

// const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

// function decodePolyline(encoded: string): LatLng[] {
//   const points: LatLng[] = [];
//   let idx = 0, lat = 0, lng = 0;
//   while (idx < encoded.length) {
//     let b: number, shift = 0, result = 0;
//     do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
//     lat += result & 1 ? ~(result >> 1) : result >> 1;
//     shift = 0; result = 0;
//     do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
//     lng += result & 1 ? ~(result >> 1) : result >> 1;
//     points.push([lat / 1e5, lng / 1e5]);
//   }
//   return points;
// }

// function buildCumulativeDist(coords: LatLng[]): number[] {
//   const cd: number[] = [0];
//   for (let i = 1; i < coords.length; i++) {
//     const dlat = coords[i][0] - coords[i - 1][0];
//     const dlng = coords[i][1] - coords[i - 1][1];
//     cd.push(cd[cd.length - 1] + Math.sqrt(dlat * dlat + dlng * dlng));
//   }
//   return cd;
// }

// function getPositionAt(t: number, points: LatLng[], cumulDist: number[]): LatLng {
//   const total  = cumulDist[cumulDist.length - 1];
//   const target = t * total;
//   let lo = 0, hi = cumulDist.length - 2;
//   while (lo < hi) {
//     const mid = (lo + hi) >> 1;
//     if (cumulDist[mid + 1] < target) lo = mid + 1;
//     else hi = mid;
//   }
//   const seg  = cumulDist[lo + 1] - cumulDist[lo];
//   const segT = seg === 0 ? 0 : (target - cumulDist[lo]) / seg;
//   return [
//     lerp(points[lo][0], points[lo + 1][0], segT),
//     lerp(points[lo][1], points[lo + 1][1], segT),
//   ];
// }

// function bearing(from: LatLng, to: LatLng): number {
//   const toRad = (d: number) => (d * Math.PI) / 180;
//   const toDeg = (r: number) => (r * 180) / Math.PI;
//   const dLng  = toRad(to[1] - from[1]);
//   const lat1  = toRad(from[0]);
//   const lat2  = toRad(to[0]);
//   const y     = Math.sin(dLng) * Math.cos(lat2);
//   const x     = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
//   return (toDeg(Math.atan2(y, x)) + 360) % 360;
// }

// function buildFallbackPath(from: LatLng, to: LatLng, steps = 40): LatLng[] {
//   const path: LatLng[] = [];
//   for (let i = 0; i <= steps; i++) {
//     const t   = i / steps;
//     const arc = Math.sin(t * Math.PI) * 0.003;
//     path.push([lerp(from[0], to[0], t) + arc, lerp(from[1], to[1], t) + arc]);
//   }
//   return path;
// }

// // ── styles ────────────────────────────────────────────────────────────────────

// const styles = `
//   @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700&display=swap');

//   .smt-root { font-family:'Syne',sans-serif; background:#0d0f14; color:#e8e6e0; min-height:100vh; padding:24px; box-sizing:border-box; }
//   .smt-header { display:flex; align-items:baseline; gap:12px; margin-bottom:20px; }
//   .smt-title  { font-size:22px; font-weight:700; color:#e8e6e0; letter-spacing:-0.5px; margin:0; }
//   .smt-badge  { font-family:'DM Mono',monospace; font-size:11px; background:#1a2f1a; color:#4ade80; border:1px solid #2d4a2d; padding:3px 8px; border-radius:4px; }
//   .smt-badge.disconnected { background:#2f1a1a; color:#f87171; border-color:#4a2d2d; }

//   .smt-trip-bar {
//     display:flex; gap:8px; align-items:center; margin-bottom:14px;
//   }
//   .smt-trip-input {
//     flex:1; font-family:'DM Mono',monospace; font-size:13px;
//     background:#080a0f; border:1px solid #1e2530; color:#e8e6e0;
//     border-radius:8px; padding:8px 12px; outline:none;
//     transition: border-color 0.2s;
//   }
//   .smt-trip-input:focus { border-color:#4ade80; }
//   .smt-trip-input::placeholder { color:#3a4050; }
//   .smt-trip-btn {
//     font-family:'DM Mono',monospace; font-size:12px; font-weight:500;
//     padding:8px 16px; border-radius:8px; border:1px solid #4ade80;
//     background:#0d1a0d; color:#4ade80; cursor:pointer; transition: background 0.2s;
//   }
//   .smt-trip-btn:hover { background:#1a3020; }
//   .smt-trip-btn.leave { border-color:#f87171; background:#1a0d0d; color:#f87171; }
//   .smt-trip-btn.leave:hover { background:#2a1010; }
//   .smt-trip-label {
//     font-family:'DM Mono',monospace; font-size:11px; color:#5a6070; margin-bottom:6px;
//     text-transform:uppercase; letter-spacing:1px;
//   }

//   .smt-map-wrap { position:relative; border-radius:12px; overflow:hidden; border:1px solid #1e2530; }
//   .smt-map-div  { width:100%; height:460px; }

//   .smt-overlay {
//     position:absolute; top:12px; right:12px;
//     background:rgba(13,15,20,0.9); backdrop-filter:blur(8px);
//     border:1px solid #1e2530; border-radius:10px;
//     padding:12px 16px; min-width:190px; z-index:1000;
//   }
//   .smt-overlay-label { font-family:'DM Mono',monospace; font-size:10px; color:#5a6070; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
//   .smt-overlay-val   { font-family:'DM Mono',monospace; font-size:16px; font-weight:500; color:#4ade80; line-height:1.4; }
//   .smt-overlay-row   { margin-top:8px; padding-top:8px; border-top:1px solid #1e2530; }
//   .smt-overlay-meta  { font-family:'DM Mono',monospace; font-size:11px; color:#5a6070; margin-top:3px; }
//   .smt-overlay-tripid { font-family:'DM Mono',monospace; font-size:10px; color:#4ade80; margin-top:6px; word-break:break-all; }

//   .smt-status-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
//   .smt-chip {
//     font-family:'DM Mono',monospace; font-size:11px; padding:4px 10px;
//     border-radius:20px; border:1px solid #1e2530; background:#0d0f14; color:#5a6070;
//   }
//   .smt-chip.active  { border-color:#4ade80; color:#4ade80; background:#0d1a0d; }
//   .smt-chip.waiting { border-color:#facc15; color:#facc15; background:#1a1800; }
//   .smt-chip.error   { border-color:#f87171; color:#f87171; background:#1a0d0d; }

//   .smt-log {
//     margin-top:14px; background:#080a0f; border:1px solid #1e2530;
//     border-radius:8px; padding:10px 14px; max-height:140px; overflow-y:auto;
//   }
//   .smt-log-title { font-family:'DM Mono',monospace; font-size:10px; color:#5a6070; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
//   .smt-log-entry { font-family:'DM Mono',monospace; font-size:11px; color:#5a6070; line-height:1.8; }
//   .smt-log-entry.new { color:#4ade80; }

//   .smt-map-wrap .leaflet-container { background:#1a1d24; }
//   .smt-map-wrap .leaflet-tile { filter:invert(0.92) hue-rotate(180deg) brightness(0.85) saturate(0.8); }
//   .smt-map-wrap .leaflet-control-zoom a { background:#0d0f14 !important; color:#e8e6e0 !important; border-color:#1e2530 !important; }
//   .smt-map-wrap .leaflet-control-zoom a:hover { background:#1e2530 !important; }
//   .smt-map-wrap .leaflet-control-attribution { display:none; }

//   .bike-icon-inner {
//     width:38px; height:38px; background:#0d0f14;
//     border:2px solid #4ade80; border-radius:50%;
//     display:flex; align-items:center; justify-content:center;
//     font-size:18px; box-shadow:0 0 12px rgba(74,222,128,0.4);
//     transition:transform 0.3s ease;
//   }
//   .pulse-dot {
//     width:10px; height:10px; border-radius:50%; background:#4ade80;
//     animation: pulse 1.5s infinite;
//   }
//   @keyframes pulse {
//     0%   { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); }
//     70%  { box-shadow: 0 0 0 8px rgba(74,222,128,0); }
//     100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); }
//   }
// `;

// // ── log entry type ────────────────────────────────────────────────────────────

// interface LogEntry {
//   id: number;
//   text: string;
//   isNew: boolean;
// }

// // ── props ─────────────────────────────────────────────────────────────────────

// interface BusTrackerProps {
//   /**
//    * If provided, the component joins this room immediately on connect
//    * without showing the manual input bar.
//    *
//    * Omit (or pass undefined) to let the user type a trip ID themselves.
//    */
//   tripId?: string;
// }

// // ── component ─────────────────────────────────────────────────────────────────

// export default function BusTracker({ tripId: propTripId }: BusTrackerProps = {}) {
//   const mapContainerRef = useRef<HTMLDivElement>(null);
//   const mapRef          = useRef<Map | null>(null);
//   const markerRef       = useRef<Marker | null>(null);
//   const routeLayerRef   = useRef<Polyline | null>(null);
//   const animFrameRef    = useRef<number | null>(null);
//   const startTimeRef    = useRef<number | null>(null);
//   const socketRef       = useRef<Socket | null>(null);

//   const currentPosRef  = useRef<LatLng | null>(null);
//   const routePointsRef = useRef<LatLng[]>([]);
//   const cumulDistRef   = useRef<number[]>([]);

//   // The trip room currently joined (null = not tracking anything yet)
//   const joinedRoomRef  = useRef<string | null>(null);

//   const [status, setStatus]         = useState<Status>("idle");
//   const [connected, setConnected]   = useState(false);
//   const [lastUpdate, setLastUpdate] = useState<LocationUpdate | null>(null);
//   const [logs, setLogs]             = useState<LogEntry[]>([]);
//   const logCountRef                 = useRef(0);

//   // Input-bar state (only used when propTripId is not provided)
//   const [inputTripId, setInputTripId] = useState("");
//   const [trackedTripId, setTrackedTripId] = useState<string | null>(
//     propTripId ?? null
//   );

//   const addLog = useCallback((text: string) => {
//     const id = ++logCountRef.current;
//     setLogs((prev) => {
//       const updated = prev.map((e) => ({ ...e, isNew: false }));
//       return [...updated, { id, text, isNew: true }].slice(-20);
//     });
//   }, []);

//   // ── reset map state when switching trips ─────────────────────────────────────
//   const resetMapState = useCallback(() => {
//     const map = mapRef.current;
//     if (routeLayerRef.current && map) {
//       map.removeLayer(routeLayerRef.current);
//       routeLayerRef.current = null;
//     }
//     if (markerRef.current && map) {
//       map.removeLayer(markerRef.current);
//       markerRef.current = null;
//     }
//     if (animFrameRef.current !== null) {
//       cancelAnimationFrame(animFrameRef.current);
//       animFrameRef.current = null;
//     }
//     currentPosRef.current  = null;
//     routePointsRef.current = [];
//     cumulDistRef.current   = [];
//     setLastUpdate(null);
//     setStatus("waiting");
//   }, []);

//   // ── join / leave room helpers ────────────────────────────────────────────────
//   const joinRoom = useCallback((tripId: string) => {
//     const socket = socketRef.current;
//     if (!socket || !tripId.trim()) return;

//     // Leave previous room if any
//     if (joinedRoomRef.current && joinedRoomRef.current !== tripId) {
//       socket.emit("stopTrackBus", joinedRoomRef.current);
//       addLog(`[${new Date().toLocaleTimeString()}] Left room: ${joinedRoomRef.current}`);
//       resetMapState();
//     }

//     socket.emit("trackBus", tripId);
//     joinedRoomRef.current = tripId;
//     setTrackedTripId(tripId);
//     addLog(`[${new Date().toLocaleTimeString()}] Joined room: ${tripId} — waiting for updates…`);
//   }, [addLog, resetMapState]);

//   const leaveRoom = useCallback(() => {
//     const socket = socketRef.current;
//     if (!socket || !joinedRoomRef.current) return;

//     socket.emit("stopTrackBus", joinedRoomRef.current);
//     addLog(`[${new Date().toLocaleTimeString()}] Left room: ${joinedRoomRef.current}`);
//     joinedRoomRef.current = null;
//     setTrackedTripId(null);
//     resetMapState();
//     setStatus("connecting"); // connected but not tracking
//   }, [addLog, resetMapState]);

//   // ── stop animation ───────────────────────────────────────────────────────────
//   const stopAnimation = useCallback(() => {
//     if (animFrameRef.current !== null) {
//       cancelAnimationFrame(animFrameRef.current);
//       animFrameRef.current = null;
//     }
//   }, []);

//   // ── animate segment ──────────────────────────────────────────────────────────
//   const animateSegment = useCallback(
//     (from: LatLng, to: LatLng) => {
//       const map = mapRef.current;
//       if (!map) return;

//       stopAnimation();

//       if (routeLayerRef.current) {
//         map.removeLayer(routeLayerRef.current);
//         routeLayerRef.current = null;
//       }

//       const run = (routePoints: LatLng[]) => {
//         routePointsRef.current = routePoints;
//         cumulDistRef.current   = buildCumulativeDist(routePoints);

//         routeLayerRef.current = L.polyline(routePoints, {
//           color: "#4ade80",
//           weight: 4,
//           opacity: 0.65,
//         }).addTo(map);

//         map.fitBounds(routeLayerRef.current.getBounds(), { padding: [60, 60], maxZoom: 16 });

//         if (!markerRef.current) {
//           markerRef.current = L.marker(from, {
//             icon: L.divIcon({
//               className: "",
//               html: `<div class="bike-icon-inner" id="smt-bike-icon">🚌</div>`,
//               iconSize:   [38, 38],
//               iconAnchor: [19, 19],
//             }),
//           }).addTo(map);
//         } else {
//           markerRef.current.setLatLng(from);
//         }

//         startTimeRef.current = null;
//         setStatus("riding");

//         const animate = (ts: number): void => {
//           if (startTimeRef.current === null) startTimeRef.current = ts;

//           const raw = Math.min((ts - startTimeRef.current) / ANIM_DURATION, 1);
//           const t   = easeInOut(raw);
//           const pos = getPositionAt(t, routePointsRef.current, cumulDistRef.current);

//           markerRef.current?.setLatLng(pos);
//           currentPosRef.current = pos;

//           if (raw < 1) {
//             const nextPos = getPositionAt(
//               easeInOut(Math.min(raw + 0.01, 1)),
//               routePointsRef.current,
//               cumulDistRef.current
//             );
//             const deg    = bearing(pos, nextPos);
//             const iconEl = document.getElementById("smt-bike-icon") as HTMLDivElement | null;
//             if (iconEl) iconEl.style.transform = `rotate(${deg - 90}deg)`;
//           }

//           if (raw < 1) {
//             animFrameRef.current = requestAnimationFrame(animate);
//           } else {
//             currentPosRef.current = to;
//             setStatus("waiting");
//             animFrameRef.current  = null;
//           }
//         };

//         animFrameRef.current = requestAnimationFrame(animate);
//       };

//       const url =
//         `${OSRM_BASE}/${from[1]},${from[0]};${to[1]},${to[0]}` +
//         `?overview=full&geometries=polyline`;

//       fetch(url)
//         .then((r) => r.json())
//         .then((data) => {
//           if (data.code === "Ok" && data.routes?.length) {
//             run(decodePolyline(data.routes[0].geometry));
//           } else {
//             run(buildFallbackPath(from, to));
//           }
//         })
//         .catch(() => run(buildFallbackPath(from, to)));
//     },
//     [stopAnimation]
//   );

//   // ── init Leaflet ─────────────────────────────────────────────────────────────
//   useEffect(() => {
//     if (mapRef.current || !mapContainerRef.current) return;

//     const map = L.map(mapContainerRef.current, {
//       zoomControl: true,
//       attributionControl: false,
//     }).setView([28.62, 77.22], 13);

//     L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
//       maxZoom: 19,
//     }).addTo(map);

//     mapRef.current = map;
//     return () => { map.remove(); mapRef.current = null; };
//   }, []);

//   // ── Socket.IO ────────────────────────────────────────────────────────────────
//   useEffect(() => {
//     const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
//     socketRef.current = socket;

//     socket.on("connect", () => {
//       setConnected(true);
//       setStatus("connecting");
//       addLog(`[${new Date().toLocaleTimeString()}] Connected to server.`);

//       // Auto-join if a tripId was passed as prop OR user had already picked one
//       const toJoin = propTripId ?? trackedTripId;
//       if (toJoin) {
//         // Small delay so the server registers the connection first
//         setTimeout(() => joinRoom(toJoin), 100);
//       }
//     });

//     socket.on("disconnect", () => {
//       setConnected(false);
//       setStatus("idle");
//       joinedRoomRef.current = null;
//       addLog(`[${new Date().toLocaleTimeString()}] Disconnected from server.`);
//     });

//     socket.on("locationUpdate", (data: LocationUpdate) => {
//       // Guard: only handle updates for the room we actually joined
//       if (data.tripId !== joinedRoomRef.current) return;

//       const newPos: LatLng = [data.lat, data.lon];
//       setLastUpdate(data);
//       addLog(
//         `[${new Date().toLocaleTimeString()}] Trip ${data.tripId.slice(-6)} → lat:${data.lat.toFixed(4)} lon:${data.lon.toFixed(4)}${data.vel != null ? ` vel:${data.vel}km/h` : ""}`
//       );

//       if (currentPosRef.current === null) {
//         // First fix — place marker, wait for second point to start animating
//         currentPosRef.current = newPos;
//         setStatus("waiting");

//         const map = mapRef.current;
//         if (map) {
//           map.setView(newPos, 15);
//           if (!markerRef.current) {
//             markerRef.current = L.marker(newPos, {
//               icon: L.divIcon({
//                 className: "",
//                 html: `<div class="bike-icon-inner" id="smt-bike-icon">🚌</div>`,
//                 iconSize:   [38, 38],
//                 iconAnchor: [19, 19],
//               }),
//             }).addTo(map);
//           }
//         }
//         addLog(`[${new Date().toLocaleTimeString()}] First point set. Waiting for next location…`);
//       } else {
//         animateSegment(currentPosRef.current, newPos);
//       }
//     });

//     return () => {
//       socket.disconnect();
//       socketRef.current = null;
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);  // intentionally run once; joinRoom / animateSegment are stable refs

//   // ── derived UI ───────────────────────────────────────────────────────────────
//   const chipClass =
//     status === "riding"  ? "active"  :
//     status === "waiting" ? "waiting" :
//     status === "stopped" ? "error"   : "";

//   const handleJoin = () => {
//     const id = inputTripId.trim();
//     if (id) joinRoom(id);
//   };

//   return (
//     <>
//       <style>{styles}</style>
//       <div className="smt-root">

//         {/* Header */}
//         <div className="smt-header">
//           <h1 className="smt-title">Bus Tracker</h1>
//           <span className={`smt-badge ${connected ? "" : "disconnected"}`}>
//             {connected ? "● Live" : "○ Disconnected"}
//           </span>
//           {trackedTripId && (
//             <span className="smt-badge" style={{ background: "#1a1f2f", borderColor: "#2d3a5a", color: "#93c5fd" }}>
//               room: {trackedTripId.slice(-8)}
//             </span>
//           )}
//         </div>

//         {/* Trip ID input bar — hidden when tripId is passed as prop */}
//         {!propTripId && (
//           <div>
//             <div className="smt-trip-label">Trip ID</div>
//             <div className="smt-trip-bar">
//               <input
//                 className="smt-trip-input"
//                 placeholder="Enter trip ID to track…"
//                 value={inputTripId}
//                 onChange={(e) => setInputTripId(e.target.value)}
//                 onKeyDown={(e) => e.key === "Enter" && handleJoin()}
//                 disabled={!connected}
//               />
//               {trackedTripId ? (
//                 <button className="smt-trip-btn leave" onClick={leaveRoom}>
//                   Leave
//                 </button>
//               ) : (
//                 <button
//                   className="smt-trip-btn"
//                   onClick={handleJoin}
//                   disabled={!connected || !inputTripId.trim()}
//                 >
//                   Track
//                 </button>
//               )}
//             </div>
//           </div>
//         )}

//         {/* Map */}
//         <div className="smt-map-wrap">
//           <div className="smt-map-div" ref={mapContainerRef} />

//           <div className="smt-overlay">
//             <div className="smt-overlay-label">Status</div>
//             <div className="smt-overlay-val">{STATUS_LABELS[status]}</div>

//             {trackedTripId && (
//               <div className="smt-overlay-tripid">
//                 trip: {trackedTripId}
//               </div>
//             )}

//             {lastUpdate && (
//               <div className="smt-overlay-row">
//                 <div className="smt-overlay-meta">lat: {lastUpdate.lat.toFixed(5)}</div>
//                 <div className="smt-overlay-meta">lon: {lastUpdate.lon.toFixed(5)}</div>
//                 {lastUpdate.vel != null && (
//                   <div className="smt-overlay-meta">vel: {lastUpdate.vel} km/h</div>
//                 )}
//                 <div className="smt-overlay-meta" style={{ marginTop: 6, color: "#3a4050" }}>
//                   {new Date(lastUpdate.timestamp).toLocaleTimeString()}
//                 </div>
//               </div>
//             )}

//             {status === "riding" && (
//               <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
//                 <div className="pulse-dot" />
//                 <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#4ade80" }}>
//                   animating…
//                 </span>
//               </div>
//             )}
//           </div>
//         </div>

//         {/* Status chips */}
//         <div className="smt-status-row">
//           <div className={`smt-chip ${chipClass}`}>{STATUS_LABELS[status]}</div>
//           <div className={`smt-chip ${connected ? "active" : "error"}`}>
//             {connected ? "Socket connected" : "Socket disconnected"}
//           </div>
//           {trackedTripId
//             ? <div className="smt-chip active">tracking room</div>
//             : <div className="smt-chip">no room joined</div>
//           }
//           <div className="smt-chip">10s segments</div>
//           <div className="smt-chip">OSRM road routing</div>
//         </div>

//         {/* Event log */}
//         <div className="smt-log">
//           <div className="smt-log-title">Event log</div>
//           {logs.length === 0 && (
//             <div className="smt-log-entry">No events yet…</div>
//           )}
//           {logs.map((entry) => (
//             <div key={entry.id} className={`smt-log-entry ${entry.isNew ? "new" : ""}`}>
//               {entry.text}
//             </div>
//           ))}
//         </div>

//       </div>
//     </>
//   );
// }


// src/components/BusMapComponents/BusTracker.tsx
//
// Changes from original:
//  - Reads :tripId from react-router URL params (useParams)
//  - propTripId prop is removed; URL param is the source of truth
//  - "Leave" button navigates back to "/" instead of just clearing state
//  - Everything else (animation, socket, map) is unchanged

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import L from "leaflet";
import type { Map, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import { io, Socket } from "socket.io-client";

// ── types ─────────────────────────────────────────────────────────────────────

type LatLng = [number, number];

type Status = "idle" | "connecting" | "riding" | "waiting" | "stopped";

interface LocationUpdate {
  tripId: string;
  lat: number;
  lon: number;
  vel?: number | null;
  acc?: number | null;
  timestamp: number;
}

// ── constants ─────────────────────────────────────────────────────────────────

const OSRM_BASE     = "https://router.project-osrm.org/route/v1/driving";
const SOCKET_URL    = import.meta.env.VITE_SOCKET_URL;
const ANIM_DURATION = 10_000;

const STATUS_LABELS: Record<Status, string> = {
  idle:       "Waiting for connection…",
  connecting: "Connecting…",
  riding:     "Bus moving",
  waiting:    "Waiting for next location…",
  stopped:    "Bus stopped",
};

// ── pure helpers ──────────────────────────────────────────────────────────────

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let idx = 0, lat = 0, lng = 0;
  while (idx < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

function buildCumulativeDist(coords: LatLng[]): number[] {
  const cd: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const dlat = coords[i][0] - coords[i - 1][0];
    const dlng = coords[i][1] - coords[i - 1][1];
    cd.push(cd[cd.length - 1] + Math.sqrt(dlat * dlat + dlng * dlng));
  }
  return cd;
}

function getPositionAt(t: number, points: LatLng[], cumulDist: number[]): LatLng {
  const total  = cumulDist[cumulDist.length - 1];
  const target = t * total;
  let lo = 0, hi = cumulDist.length - 2;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulDist[mid + 1] < target) lo = mid + 1;
    else hi = mid;
  }
  const seg  = cumulDist[lo + 1] - cumulDist[lo];
  const segT = seg === 0 ? 0 : (target - cumulDist[lo]) / seg;
  return [
    lerp(points[lo][0], points[lo + 1][0], segT),
    lerp(points[lo][1], points[lo + 1][1], segT),
  ];
}

function bearing(from: LatLng, to: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng  = toRad(to[1] - from[1]);
  const lat1  = toRad(from[0]);
  const lat2  = toRad(to[0]);
  const y     = Math.sin(dLng) * Math.cos(lat2);
  const x     = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function buildFallbackPath(from: LatLng, to: LatLng, steps = 40): LatLng[] {
  const path: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t   = i / steps;
    const arc = Math.sin(t * Math.PI) * 0.003;
    path.push([lerp(from[0], to[0], t) + arc, lerp(from[1], to[1], t) + arc]);
  }
  return path;
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700&display=swap');

  .smt-root { font-family:'Syne',sans-serif; background:#0d0f14; color:#e8e6e0; min-height:100vh; padding:24px; box-sizing:border-box; }
  .smt-header { display:flex; align-items:baseline; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
  .smt-title  { font-size:22px; font-weight:700; color:#e8e6e0; letter-spacing:-0.5px; margin:0; }
  .smt-badge  { font-family:'DM Mono',monospace; font-size:11px; background:#1a2f1a; color:#4ade80; border:1px solid #2d4a2d; padding:3px 8px; border-radius:4px; }
  .smt-badge.disconnected { background:#2f1a1a; color:#f87171; border-color:#4a2d2d; }

  .smt-back-btn {
    font-family:'DM Mono',monospace; font-size:11px; font-weight:500;
    padding:4px 12px; border-radius:6px; border:1px solid #1e2530;
    background:transparent; color:#8a9aaa; cursor:pointer;
    transition: border-color 0.2s, color 0.2s;
    display:flex; align-items:center; gap:6px;
    margin-left:auto;
  }
  .smt-back-btn:hover { border-color:#4ade80; color:#4ade80; }

  .smt-map-wrap { position:relative; border-radius:12px; overflow:hidden; border:1px solid #1e2530; }
  .smt-map-div  { width:100%; height:460px; }

  .smt-overlay {
    position:absolute; top:12px; right:12px;
    background:rgba(13,15,20,0.9); backdrop-filter:blur(8px);
    border:1px solid #1e2530; border-radius:10px;
    padding:12px 16px; min-width:190px; z-index:1000;
  }
  .smt-overlay-label { font-family:'DM Mono',monospace; font-size:10px; color:#5a6070; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
  .smt-overlay-val   { font-family:'DM Mono',monospace; font-size:16px; font-weight:500; color:#4ade80; line-height:1.4; }
  .smt-overlay-row   { margin-top:8px; padding-top:8px; border-top:1px solid #1e2530; }
  .smt-overlay-meta  { font-family:'DM Mono',monospace; font-size:11px; color:#5a6070; margin-top:3px; }
  .smt-overlay-tripid { font-family:'DM Mono',monospace; font-size:10px; color:#4ade80; margin-top:6px; word-break:break-all; }

  .smt-status-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
  .smt-chip {
    font-family:'DM Mono',monospace; font-size:11px; padding:4px 10px;
    border-radius:20px; border:1px solid #1e2530; background:#0d0f14; color:#5a6070;
  }
  .smt-chip.active  { border-color:#4ade80; color:#4ade80; background:#0d1a0d; }
  .smt-chip.waiting { border-color:#facc15; color:#facc15; background:#1a1800; }
  .smt-chip.error   { border-color:#f87171; color:#f87171; background:#1a0d0d; }

  .smt-log {
    margin-top:14px; background:#080a0f; border:1px solid #1e2530;
    border-radius:8px; padding:10px 14px; max-height:140px; overflow-y:auto;
  }
  .smt-log-title { font-family:'DM Mono',monospace; font-size:10px; color:#5a6070; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
  .smt-log-entry { font-family:'DM Mono',monospace; font-size:11px; color:#5a6070; line-height:1.8; }
  .smt-log-entry.new { color:#4ade80; }

  .smt-map-wrap .leaflet-container { background:#1a1d24; }
  .smt-map-wrap .leaflet-tile { filter:invert(0.92) hue-rotate(180deg) brightness(0.85) saturate(0.8); }
  .smt-map-wrap .leaflet-control-zoom a { background:#0d0f14 !important; color:#e8e6e0 !important; border-color:#1e2530 !important; }
  .smt-map-wrap .leaflet-control-zoom a:hover { background:#1e2530 !important; }
  .smt-map-wrap .leaflet-control-attribution { display:none; }

  .bike-icon-inner {
    width:38px; height:38px; background:#0d0f14;
    border:2px solid #4ade80; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:18px; box-shadow:0 0 12px rgba(74,222,128,0.4);
    transition:transform 0.3s ease;
  }
  .pulse-dot {
    width:10px; height:10px; border-radius:50%; background:#4ade80;
    animation: pulse 1.5s infinite;
  }
  @keyframes pulse {
    0%   { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); }
    70%  { box-shadow: 0 0 0 8px rgba(74,222,128,0); }
    100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); }
  }
`;

// ── log entry type ────────────────────────────────────────────────────────────

interface LogEntry {
  id: number;
  text: string;
  isNew: boolean;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function BusTracker() {
  // ── Read tripId from URL (:tripId param) ─────────────────────────────────
  const { tripId } = useParams<{ tripId: string }>();
  const navigate   = useNavigate();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<Map | null>(null);
  const markerRef       = useRef<Marker | null>(null);
  const routeLayerRef   = useRef<Polyline | null>(null);
  const animFrameRef    = useRef<number | null>(null);
  const startTimeRef    = useRef<number | null>(null);
  const socketRef       = useRef<Socket | null>(null);

  const currentPosRef  = useRef<LatLng | null>(null);
  const routePointsRef = useRef<LatLng[]>([]);
  const cumulDistRef   = useRef<number[]>([]);
  const joinedRoomRef  = useRef<string | null>(null);

  const [status, setStatus]         = useState<Status>("idle");
  const [connected, setConnected]   = useState(false);
  const [lastUpdate, setLastUpdate] = useState<LocationUpdate | null>(null);
  const [logs, setLogs]             = useState<LogEntry[]>([]);
  const logCountRef                 = useRef(0);

  const addLog = useCallback((text: string) => {
    const id = ++logCountRef.current;
    setLogs((prev) => {
      const updated = prev.map((e) => ({ ...e, isNew: false }));
      return [...updated, { id, text, isNew: true }].slice(-20);
    });
  }, []);

  // ── reset map state ──────────────────────────────────────────────────────
  const resetMapState = useCallback(() => {
    const map = mapRef.current;
    if (routeLayerRef.current && map) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    if (markerRef.current && map) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    currentPosRef.current  = null;
    routePointsRef.current = [];
    cumulDistRef.current   = [];
    setLastUpdate(null);
    setStatus("waiting");
  }, []);

  // ── join room ────────────────────────────────────────────────────────────
  const joinRoom = useCallback((id: string) => {
    const socket = socketRef.current;
    if (!socket || !id.trim()) return;

    if (joinedRoomRef.current && joinedRoomRef.current !== id) {
      socket.emit("stopTrackBus", joinedRoomRef.current);
      addLog(`[${new Date().toLocaleTimeString()}] Left room: ${joinedRoomRef.current}`);
      resetMapState();
    }

    socket.emit("trackBus", id);
    joinedRoomRef.current = id;
    addLog(`[${new Date().toLocaleTimeString()}] Joined room: ${id} — waiting for updates…`);
  }, [addLog, resetMapState]);

  // ── leave room → go back home ────────────────────────────────────────────
  const handleLeave = useCallback(() => {
    const socket = socketRef.current;
    if (socket && joinedRoomRef.current) {
      socket.emit("stopTrackBus", joinedRoomRef.current);
    }
    joinedRoomRef.current = null;
    navigate("/");
  }, [navigate]);

  // ── stop animation ───────────────────────────────────────────────────────
  const stopAnimation = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // ── animate segment ──────────────────────────────────────────────────────
  const animateSegment = useCallback(
    (from: LatLng, to: LatLng) => {
      const map = mapRef.current;
      if (!map) return;

      stopAnimation();

      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }

      const run = (routePoints: LatLng[]) => {
        routePointsRef.current = routePoints;
        cumulDistRef.current   = buildCumulativeDist(routePoints);

        routeLayerRef.current = L.polyline(routePoints, {
          color: "#4ade80",
          weight: 4,
          opacity: 0.65,
        }).addTo(map);

        map.fitBounds(routeLayerRef.current.getBounds(), { padding: [60, 60], maxZoom: 16 });

        if (!markerRef.current) {
          markerRef.current = L.marker(from, {
            icon: L.divIcon({
              className: "",
              html: `<div class="bike-icon-inner" id="smt-bike-icon">🚌</div>`,
              iconSize:   [38, 38],
              iconAnchor: [19, 19],
            }),
          }).addTo(map);
        } else {
          markerRef.current.setLatLng(from);
        }

        startTimeRef.current = null;
        setStatus("riding");

        const animate = (ts: number): void => {
          if (startTimeRef.current === null) startTimeRef.current = ts;
          const raw = Math.min((ts - startTimeRef.current) / ANIM_DURATION, 1);
          const t   = easeInOut(raw);
          const pos = getPositionAt(t, routePointsRef.current, cumulDistRef.current);

          markerRef.current?.setLatLng(pos);
          currentPosRef.current = pos;

          if (raw < 1) {
            const nextPos = getPositionAt(
              easeInOut(Math.min(raw + 0.01, 1)),
              routePointsRef.current,
              cumulDistRef.current
            );
            const deg    = bearing(pos, nextPos);
            const iconEl = document.getElementById("smt-bike-icon") as HTMLDivElement | null;
            if (iconEl) iconEl.style.transform = `rotate(${deg - 90}deg)`;
          }

          if (raw < 1) {
            animFrameRef.current = requestAnimationFrame(animate);
          } else {
            currentPosRef.current = to;
            setStatus("waiting");
            animFrameRef.current  = null;
          }
        };

        animFrameRef.current = requestAnimationFrame(animate);
      };

      const url =
        `${OSRM_BASE}/${from[1]},${from[0]};${to[1]},${to[0]}` +
        `?overview=full&geometries=polyline`;

      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (data.code === "Ok" && data.routes?.length) {
            run(decodePolyline(data.routes[0].geometry));
          } else {
            run(buildFallbackPath(from, to));
          }
        })
        .catch(() => run(buildFallbackPath(from, to)));
    },
    [stopAnimation]
  );

  // ── init Leaflet ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([28.62, 77.22], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Socket.IO ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tripId) return;

    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setStatus("connecting");
      addLog(`[${new Date().toLocaleTimeString()}] Connected to server.`);
      // Auto-join the room from URL param
      setTimeout(() => joinRoom(tripId), 100);
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setStatus("idle");
      joinedRoomRef.current = null;
      addLog(`[${new Date().toLocaleTimeString()}] Disconnected from server.`);
    });

    socket.on("locationUpdate", (data: LocationUpdate) => {
      if (data.tripId !== joinedRoomRef.current) return;

      const newPos: LatLng = [data.lat, data.lon];
      setLastUpdate(data);
      addLog(
        `[${new Date().toLocaleTimeString()}] Trip ${data.tripId.slice(-6)} → lat:${data.lat.toFixed(4)} lon:${data.lon.toFixed(4)}${data.vel != null ? ` vel:${data.vel}km/h` : ""}`
      );

      if (currentPosRef.current === null) {
        currentPosRef.current = newPos;
        setStatus("waiting");

        const map = mapRef.current;
        if (map) {
          map.setView(newPos, 15);
          if (!markerRef.current) {
            markerRef.current = L.marker(newPos, {
              icon: L.divIcon({
                className: "",
                html: `<div class="bike-icon-inner" id="smt-bike-icon">🚌</div>`,
                iconSize:   [38, 38],
                iconAnchor: [19, 19],
              }),
            }).addTo(map);
          }
        }
        addLog(`[${new Date().toLocaleTimeString()}] First point set. Waiting for next location…`);
      } else {
        animateSegment(currentPosRef.current, newPos);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // intentionally once; joinRoom / animateSegment are stable

  // ── derived UI ────────────────────────────────────────────────────────────
  const chipClass =
    status === "riding"  ? "active"  :
    status === "waiting" ? "waiting" :
    status === "stopped" ? "error"   : "";

  return (
    <>
      <style>{styles}</style>
      <div className="smt-root">

        {/* Header */}
        <div className="smt-header">
          <h1 className="smt-title">Bus Tracker</h1>
          <span className={`smt-badge ${connected ? "" : "disconnected"}`}>
            {connected ? "● Live" : "○ Disconnected"}
          </span>
          {tripId && (
            <span className="smt-badge" style={{ background: "#1a1f2f", borderColor: "#2d3a5a", color: "#93c5fd" }}>
              room: {tripId.slice(-8)}
            </span>
          )}
          <button className="smt-back-btn" onClick={handleLeave}>
            ← Back
          </button>
        </div>

        {/* Map */}
        <div className="smt-map-wrap">
          <div className="smt-map-div" ref={mapContainerRef} />

          <div className="smt-overlay">
            <div className="smt-overlay-label">Status</div>
            <div className="smt-overlay-val">{STATUS_LABELS[status]}</div>

            {tripId && (
              <div className="smt-overlay-tripid">
                trip: {tripId}
              </div>
            )}

            {lastUpdate && (
              <div className="smt-overlay-row">
                <div className="smt-overlay-meta">lat: {lastUpdate.lat.toFixed(5)}</div>
                <div className="smt-overlay-meta">lon: {lastUpdate.lon.toFixed(5)}</div>
                {lastUpdate.vel != null && (
                  <div className="smt-overlay-meta">vel: {lastUpdate.vel} km/h</div>
                )}
                <div className="smt-overlay-meta" style={{ marginTop: 6, color: "#3a4050" }}>
                  {new Date(lastUpdate.timestamp).toLocaleTimeString()}
                </div>
              </div>
            )}

            {status === "riding" && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <div className="pulse-dot" />
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#4ade80" }}>
                  animating…
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Status chips */}
        <div className="smt-status-row">
          <div className={`smt-chip ${chipClass}`}>{STATUS_LABELS[status]}</div>
          <div className={`smt-chip ${connected ? "active" : "error"}`}>
            {connected ? "Socket connected" : "Socket disconnected"}
          </div>
          <div className="smt-chip active">tracking room</div>
          <div className="smt-chip">10s segments</div>
          <div className="smt-chip">OSRM road routing</div>
        </div>

        {/* Event log */}
        <div className="smt-log">
          <div className="smt-log-title">Event log</div>
          {logs.length === 0 && (
            <div className="smt-log-entry">No events yet…</div>
          )}
          {logs.map((entry) => (
            <div key={entry.id} className={`smt-log-entry ${entry.isNew ? "new" : ""}`}>
              {entry.text}
            </div>
          ))}
        </div>

      </div>
    </>
  );
}