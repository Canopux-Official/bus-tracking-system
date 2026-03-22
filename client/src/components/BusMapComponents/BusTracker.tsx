import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import type { Map, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── INSTALL DEPS ────────────────────────────────────────────────────────────
// npm install leaflet
// npm install --save-dev @types/leaflet
// ─────────────────────────────────────────────────────────────────────────────

// ── types ─────────────────────────────────────────────────────────────────────

/** [latitude, longitude] tuple */
type LatLng = [number, number];

/** Status of the tracker */
type Status = "idle" | "fetching" | "riding" | "arrived" | "error";

/** Coordinate pair as strings (from input fields) */
interface CoordInput {
  lat: string;
  lng: string;
}

/** Route metadata returned by OSRM */
interface RouteInfo {
  distKm: string;
  etaMin: number;
}

/** Raw OSRM route response shape (partial) */
interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: string;
}

interface OsrmResponse {
  code: string;
  routes?: OsrmRoute[];
}

// ── constants ─────────────────────────────────────────────────────────────────

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

const STATUS_LABELS: Record<Status, string> = {
  idle: "Ready",
  fetching: "Fetching route…",
  riding: "Riding",
  arrived: "Arrived!",
  error: "Error",
};

// ── pure helpers ──────────────────────────────────────────────────────────────

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let idx = 0;
  let lat = 0;
  let lng = 0;

  while (idx < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(idx++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(idx++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
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

function getPositionAt(
  t: number,
  points: LatLng[],
  cumulDist: number[]
): LatLng {
  const total = cumulDist[cumulDist.length - 1];
  const target = t * total;

  let lo = 0;
  let hi = cumulDist.length - 2;
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
  const x     =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
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

  .smt-root {
    font-family: 'Syne', sans-serif;
    background: #0d0f14;
    color: #e8e6e0;
    min-height: 100vh;
    padding: 24px;
    box-sizing: border-box;
  }
  .smt-header { display:flex; align-items:baseline; gap:12px; margin-bottom:20px; }
  .smt-title  { font-size:22px; font-weight:700; color:#e8e6e0; letter-spacing:-0.5px; margin:0; }
  .smt-badge  {
    font-family:'DM Mono',monospace; font-size:11px;
    background:#1a2f1a; color:#4ade80; border:1px solid #2d4a2d;
    padding:3px 8px; border-radius:4px;
  }

  .smt-map-wrap { position:relative; border-radius:12px; overflow:hidden; border:1px solid #1e2530; }

  /* ⚠ Leaflet REQUIRES the container to have an explicit height */
  .smt-map-div { width:100%; height:420px; }

  .smt-overlay {
    position:absolute; top:12px; right:12px;
    background:rgba(13,15,20,0.88); backdrop-filter:blur(8px);
    border:1px solid #1e2530; border-radius:10px;
    padding:12px 16px; min-width:160px; z-index:1000;
  }
  .smt-overlay-label { font-family:'DM Mono',monospace; font-size:10px; color:#5a6070; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
  .smt-overlay-val   { font-family:'DM Mono',monospace; font-size:20px; font-weight:500; color:#4ade80; line-height:1.2; }
  .smt-overlay-sub   { font-size:11px; color:#5a6070; margin-top:2px; }
  .smt-progress-bar-wrap { margin-top:10px; background:#1e2530; border-radius:3px; height:3px; overflow:hidden; }
  .smt-progress-bar { height:100%; background:linear-gradient(90deg,#4ade80,#22d3ee); transition:width 0.1s linear; border-radius:3px; }

  .smt-controls    { display:flex; flex-wrap:wrap; gap:10px; margin-top:16px; align-items:flex-end; }
  .smt-coord-group { display:flex; flex-direction:column; gap:4px; flex:1; min-width:140px; }
  .smt-coord-label { font-family:'DM Mono',monospace; font-size:11px; color:#5a6070; letter-spacing:0.5px; }
  .smt-coord-row   { display:flex; gap:6px; }
  .smt-input {
    flex:1; background:#0d0f14; border:1px solid #1e2530; border-radius:6px;
    padding:8px 10px; color:#e8e6e0; font-family:'DM Mono',monospace;
    font-size:12px; outline:none; transition:border-color 0.2s; min-width:0;
  }
  .smt-input:focus { border-color:#4ade80; }
  .smt-input::placeholder { color:#2e3440; }

  .smt-btn {
    padding:9px 20px; border-radius:7px; border:none;
    font-family:'Syne',sans-serif; font-size:13px; font-weight:600;
    cursor:pointer; transition:all 0.15s; white-space:nowrap;
  }
  .smt-btn-primary { background:#4ade80; color:#0d0f14; }
  .smt-btn-primary:hover    { background:#22c55e; transform:translateY(-1px); }
  .smt-btn-primary:active   { transform:scale(0.97); }
  .smt-btn-primary:disabled { background:#1e2530; color:#3a4050; cursor:not-allowed; transform:none; }
  .smt-btn-secondary { background:transparent; color:#e8e6e0; border:1px solid #1e2530; }
  .smt-btn-secondary:hover { border-color:#3a4050; background:#1e2530; }

  .smt-duration-wrap { display:flex; flex-direction:column; gap:6px; min-width:160px; }
  .smt-range { accent-color:#4ade80; width:100%; cursor:pointer; }

  .smt-status-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
  .smt-chip {
    font-family:'DM Mono',monospace; font-size:11px; padding:4px 10px;
    border-radius:20px; border:1px solid #1e2530; background:#0d0f14; color:#5a6070;
  }
  .smt-chip.active { border-color:#4ade80; color:#4ade80; background:#0d1a0d; }
  .smt-chip.error  { border-color:#f87171; color:#f87171; background:#1a0d0d; }

  .smt-error {
    font-family:'DM Mono',monospace; font-size:12px; color:#f87171; margin-top:8px;
    padding:8px 12px; background:#1a0d0d; border:1px solid #3a1a1a; border-radius:6px;
  }

  /* Dark tile theme */
  .smt-map-wrap .leaflet-container { background:#1a1d24; }
  .smt-map-wrap .leaflet-tile {
    filter: invert(0.92) hue-rotate(180deg) brightness(0.85) saturate(0.8);
  }
  .smt-map-wrap .leaflet-control-zoom a {
    background:#0d0f14 !important; color:#e8e6e0 !important; border-color:#1e2530 !important;
  }
  .smt-map-wrap .leaflet-control-zoom a:hover { background:#1e2530 !important; }
  .smt-map-wrap .leaflet-control-attribution { display:none; }

  .bike-icon-inner {
    width:38px; height:38px; background:#0d0f14;
    border:2px solid #4ade80; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:18px; box-shadow:0 0 12px rgba(74,222,128,0.4);
    transition:transform 0.3s ease;
  }
`;

// ── component ─────────────────────────────────────────────────────────────────

export default function SmoothMapTracker()  {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<Map | null>(null);
  const markerRef       = useRef<Marker | null>(null);
  const routeLayerRef   = useRef<Polyline | null>(null);
  const animFrameRef    = useRef<number | null>(null);
  const startTimeRef    = useRef<number | null>(null);
  const routePointsRef  = useRef<LatLng[]>([]);
  const cumulDistRef    = useRef<number[]>([]);

  const [coordA, setCoordA]       = useState<CoordInput>({ lat: "28.6315", lng: "77.2167" });
  const [coordB, setCoordB]       = useState<CoordInput>({ lat: "28.6129", lng: "77.2295" });
  const [duration, setDuration]   = useState<number>(15);
  const [progress, setProgress]   = useState<number>(0);
  const [status, setStatus]       = useState<Status>("idle");
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [error, setError]         = useState<string>("");

  // ── init Leaflet map once after mount ──────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([28.62, 77.22], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Clean up on unmount
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── cancel any running animation frame ────────────────────────────────────
  const stopAnimation = useCallback((): void => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // ── fetch route + start animation ─────────────────────────────────────────
  const startRide = useCallback(async (): Promise<void> => {
    const map = mapRef.current;
    if (!map) return;

    stopAnimation();
    setError("");
    setProgress(0);
    setStatus("fetching");

    const latA = parseFloat(coordA.lat);
    const lngA = parseFloat(coordA.lng);
    const latB = parseFloat(coordB.lat);
    const lngB = parseFloat(coordB.lng);

    if ([latA, lngA, latB, lngB].some(Number.isNaN)) {
      setError("Invalid coordinates. Please enter decimal lat/lng values.");
      setStatus("error");
      return;
    }

    // Fetch actual road geometry from OSRM (free, no key needed)
    let routePoints: LatLng[];

    try {
      const url =
        `${OSRM_BASE}/${lngA},${latA};${lngB},${latB}` +
        `?overview=full&geometries=polyline`;
      const res  = await fetch(url);
      const data: OsrmResponse = await res.json();

      if (data.code !== "Ok" || !data.routes?.length) {
        throw new Error("No route found");
      }

      const route = data.routes[0];
      routePoints = decodePolyline(route.geometry);
      setRouteInfo({
        distKm: (route.distance / 1000).toFixed(1),
        etaMin: Math.round(route.duration / 60),
      });
    } catch {
      // Graceful fallback if OSRM is unreachable
      routePoints = buildFallbackPath([latA, lngA], [latB, lngB]);
      setRouteInfo(null);
      setError("OSRM unavailable — using approximate curved path.");
    }

    routePointsRef.current = routePoints;
    cumulDistRef.current   = buildCumulativeDist(routePoints);

    // Draw route line
    if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
    routeLayerRef.current = L.polyline(routePoints, {
      color: "#4ade80",
      weight: 4,
      opacity: 0.7,
    }).addTo(map);

    // A / B pin icons
    const iconDot = (color: string, label: string) =>
      L.divIcon({
        className: "",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
            <div style="width:12px;height:12px;background:${color};border-radius:50%;
                        border:2px solid #0d0f14;box-shadow:0 0 8px ${color}66;"></div>
            <span style="font-family:'DM Mono',monospace;font-size:10px;color:${color};
                         background:#0d0f14;padding:1px 4px;border-radius:3px;
                         border:1px solid ${color}44;white-space:nowrap;">${label}</span>
          </div>`,
        iconSize:   [12, 32] as [number, number],
        iconAnchor: [6,  6]  as [number, number],
      });

    L.marker([latA, lngA], { icon: iconDot("#22d3ee", "START") }).addTo(map);
    L.marker([latB, lngB], { icon: iconDot("#f87171", "END")   }).addTo(map);

    // Bike marker
    if (markerRef.current) map.removeLayer(markerRef.current);
    markerRef.current = L.marker(routePoints[0], {
      icon: L.divIcon({
        className: "",
        html: `<div class="bike-icon-inner" id="smt-bike-icon">🏍</div>`,
        iconSize:   [38, 38] as [number, number],
        iconAnchor: [19, 19] as [number, number],
      }),
    }).addTo(map);

    map.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });

    // Animation loop
    const durationMs     = duration * 1000;
    startTimeRef.current = null;
    setStatus("riding");

    const animate = (ts: number): void => {
      if (startTimeRef.current === null) startTimeRef.current = ts;

      const raw = Math.min((ts - startTimeRef.current) / durationMs, 1);
      const t   = easeInOut(raw);
      const pos = getPositionAt(t, routePointsRef.current, cumulDistRef.current);

      markerRef.current?.setLatLng(pos);

      // Rotate icon to face direction of travel
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

      setProgress(Math.round(raw * 100));

      if (raw < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setStatus("arrived");
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, [coordA, coordB, duration, stopAnimation]);

  // ── reset everything ───────────────────────────────────────────────────────
  const reset = useCallback((): void => {
    stopAnimation();
    setProgress(0);
    setStatus("idle");
    setError("");
    setRouteInfo(null);

    const map = mapRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    map.setView([28.62, 77.22], 14);
  }, [stopAnimation]);

  // ── derived UI values ──────────────────────────────────────────────────────
  const statusLabel =
    status === "riding" ? `Riding — ${progress}%` : STATUS_LABELS[status];

  const chipClass =
    status === "arrived" || status === "riding"
      ? "active"
      : status === "error"
      ? "error"
      : "";

  const isDisabled = status === "fetching" || status === "riding";

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{styles}</style>

      <div className="smt-root">
        {/* ── header ── */}
        <div className="smt-header">
          <h1 className="smt-title">Smooth Map Tracker</h1>
          <span className="smt-badge">Leaflet + OSRM · TypeScript</span>
        </div>

        {/* ── map ── */}
        <div className="smt-map-wrap">
          {/*
            mapContainerRef attaches to this div.
            The .smt-map-div class gives it an explicit height (420px).
            Leaflet will NOT render if the container has zero height.
          */}
          <div className="smt-map-div" ref={mapContainerRef} />

          {/* live progress overlay */}
          <div className="smt-overlay">
            <div className="smt-overlay-label">Progress</div>
            <div className="smt-overlay-val">{progress}%</div>
            {routeInfo && (
              <div className="smt-overlay-sub">
                {routeInfo.distKm} km · ~{routeInfo.etaMin} min ETA
              </div>
            )}
            <div className="smt-progress-bar-wrap">
              <div
                className="smt-progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── controls ── */}
        <div className="smt-controls">
          {/* Start coords */}
          <div className="smt-coord-group">
            <div className="smt-coord-label">◉ Start (A)</div>
            <div className="smt-coord-row">
              <input
                className="smt-input"
                placeholder="lat"
                value={coordA.lat}
                onChange={(e) =>
                  setCoordA((p) => ({ ...p, lat: e.target.value }))
                }
              />
              <input
                className="smt-input"
                placeholder="lng"
                value={coordA.lng}
                onChange={(e) =>
                  setCoordA((p) => ({ ...p, lng: e.target.value }))
                }
              />
            </div>
          </div>

          {/* End coords */}
          <div className="smt-coord-group">
            <div className="smt-coord-label">◎ End (B)</div>
            <div className="smt-coord-row">
              <input
                className="smt-input"
                placeholder="lat"
                value={coordB.lat}
                onChange={(e) =>
                  setCoordB((p) => ({ ...p, lat: e.target.value }))
                }
              />
              <input
                className="smt-input"
                placeholder="lng"
                value={coordB.lng}
                onChange={(e) =>
                  setCoordB((p) => ({ ...p, lng: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Duration slider */}
          <div className="smt-duration-wrap">
            <div className="smt-coord-label">Duration: {duration}s</div>
            <input
              type="range"
              className="smt-range"
              min={5}
              max={60}
              step={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="smt-btn smt-btn-primary"
              onClick={startRide}
              disabled={isDisabled}
            >
              {status === "fetching"
                ? "Routing…"
                : status === "riding"
                ? "Riding…"
                : "▶ Start"}
            </button>
            <button className="smt-btn smt-btn-secondary" onClick={reset}>
              ↺
            </button>
          </div>
        </div>

        {/* ── status chips ── */}
        <div className="smt-status-row">
          <div className={`smt-chip ${chipClass}`}>{statusLabel}</div>
          {routeInfo && (
            <div className="smt-chip active">
              {routeInfo.distKm} km road distance
            </div>
          )}
          <div className="smt-chip">OSRM free routing</div>
          <div className="smt-chip">No API key needed</div>
        </div>

        {/* ── error banner ── */}
        {error && <div className="smt-error">⚠ {error}</div>}
      </div>
    </>
  );
}