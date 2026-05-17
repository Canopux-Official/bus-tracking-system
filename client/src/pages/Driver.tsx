import '../styles/Driver.css';
import { useState } from "react";
import { useTracking } from "../hooks/useTracking";
import { startTrip, endTrip } from "../apis/trip.api";
import { BusIcon, LocationPin, ArrowRight } from "../icons/driver";


export default function Driver() {

  // Form State.
  const [busNo, setBusNo] = useState("");
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");

  // Trip State.
  const [tripStarted, setTripStarted] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Pin Stop State.
  const [pinning, setPinning] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<"success" | "error" | null>(null);

  const python_backend_url = import.meta.env.VITE_PYTHON_BACKEND_URL || "http://localhost:8000";
  const environment = import.meta.env.VITE_ENVIRONMENT || "development";

  const { isTracking, busStatus, startTracking, stopTracking, lastSent, error } = useTracking(tripId);

  const STATUS_CONFIG = {
    idle:    { label: "Idle",        color: "#5a6070", bg: "#0d0f14", border: "#1e2530" },
    moving:  { label: "🟢 Moving",  color: "#4ade80", bg: "#0d1a0d", border: "#2d4a2d" },
    stopped: { label: "🔴 Stopped", color: "#f87171", bg: "#1a0d0d", border: "#4a2d2d" },
  } as const;


  // 1. Start Trip.
  const handleSubmitTrip = async () => {
    if (!busNo || !source || !destination) {
      alert("Please fill all fields");
      return;
    }
    try {
      setLoading(true);

      if (environment === "production") {
        await fetch(python_backend_url)
          .then(res => {
            if (!res.ok) throw new Error("Backend wake-up failed");
            console.log("Backend woke up!");
          })
          .catch(err => {
            console.error("Failed to wake backend:", err);
          });
      }

      const res = await startTrip({ busNo, source, destination });
      const tripId = res.tripId;
      if (!tripId) throw new Error("Invalid response from server");

      console.log("Trip Started:", tripId);
      setTripId(tripId);
      setTripStarted(true);

    } catch (err) {
      console.error("Start trip failed:", err);
      alert("Failed to start trip");
    } finally {
      setLoading(false);
    }
  };


  // 2. End Trip.
  const handleEndTrip = async () => {
    try {
      if (tripId) {
        await endTrip(tripId);
        console.log("Trip Ended:", tripId);
      }
    } catch (err) {
      console.error("End trip failed", err);
    }
    stopTracking();
    setTripStarted(false);
    setTripId(null);
    setBusNo("");
    setSource("");
    setDestination("");
  };


  // 3. Pin Stop — grabs current GPS position and sends to backend.
  const handlePinStop = async () => {
    if (!tripId) return;

    setPinning(true);
    setPinFeedback(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
        })
      );

      const { latitude: lat, longitude: lng } = position.coords;

      const res = await fetch(`${python_backend_url}/api/trips/${tripId}/pin-stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });

      if (!res.ok) throw new Error("Pin stop request failed");

      console.log(`[pinStop] stop pinned at (${lat}, ${lng})`);
      setPinFeedback("success");

    } catch (err) {
      console.error("Pin stop failed:", err);
      setPinFeedback("error");
    } finally {
      setPinning(false);
      // Clear feedback after 3 seconds
      setTimeout(() => setPinFeedback(null), 3000);
    }
  };


  return (
    <>
      <div className="app">
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <div className="screen">

          {/* HEADER */}
          <div className="header">
            <div>
              <div className="header-label">Fleet Driver</div>
              <div className="header-title">
                {tripStarted ? "Trip Control" : "New Trip"}
              </div>
            </div>
            <div className="header-badge"><BusIcon /></div>
          </div>

          {/* FORM */}
          {!tripStarted && (
            <div className="fade-in">
              <div className="section-label">Trip Details</div>

              <div className="field">
                <div className="field-inner">
                  <span className="field-icon"><BusIcon /></span>
                  <div className="field-vr" />
                  <input
                    className="field-input"
                    placeholder="Vehicle Number (e.g. BUS-6042)"
                    value={busNo}
                    onChange={(e) => setBusNo(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <div className="field-inner">
                  <span className="field-icon"><LocationPin /></span>
                  <div className="field-vr" />
                  <input
                    className="field-input"
                    placeholder="Origin / Source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <div className="field-inner">
                  <span className="field-icon" style={{ color: "#3b82f6" }}>
                    <LocationPin />
                  </span>
                  <div className="field-vr" />
                  <input
                    className="field-input"
                    placeholder="Destination"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </div>
              </div>

              {source && destination && (
                <div className="route-card fade-in">
                  <div className="route-left">
                    <div className="route-dot from" />
                    <div style={{ height: 28, width: 1, background: "linear-gradient(#f59e0b, #2563eb)", margin: "4px 3px" }} />
                    <div className="route-dot to" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="route-label">{source}</div>
                    <div className="route-sub">Departure</div>
                    <div style={{ margin: "6px 0", height: 1, background: "var(--border)" }} />
                    <div className="route-label">{destination}</div>
                    <div className="route-sub">Destination</div>
                  </div>
                  <div style={{ color: "var(--muted)" }}><ArrowRight /></div>
                </div>
              )}

              <button
                className="btn-cta"
                onClick={handleSubmitTrip}
                disabled={loading || !busNo || !source || !destination}
              >
                {loading ? "Starting Trip..." : <>Start Trip <ArrowRight /></>}
              </button>
            </div>
          )}

          {/* CONTROL PANEL */}
          {tripStarted && (
            <div className="control-wrap fade-in">

              {/* Trip Info */}
              <div className="trip-badge">
                <div className="trip-badge-dot" />
                {tripId} · Active
                <span style={{ marginLeft: "auto" }}>{busNo}</span>
              </div>

              {/* Bus Status Pill */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "6px 14px", borderRadius: 20,
                border: `1px solid ${STATUS_CONFIG[busStatus].border}`,
                background: STATUS_CONFIG[busStatus].bg,
                color: STATUS_CONFIG[busStatus].color,
                fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500,
                transition: "all 0.3s ease",
              }}>
                {STATUS_CONFIG[busStatus].label}
              </div>

              {/* Start / Stop Tracking */}
              <button
                className={`main-btn ${isTracking ? "active" : "inactive"}`}
                onClick={() => { if (!tripId) return; isTracking ? stopTracking() : startTracking(); }}
              >
                {isTracking ? "STOP" : "START"}
              </button>

              {/* Last Sent Timer */}
              <div>
                {isTracking
                  ? `Last sent: ${lastSent ?? 0}s ago`
                  : busStatus === "stopped" ? "Tracking stopped" : "Not tracking"}
              </div>

              {/* Pin Stop Button */}
              <button
                onClick={handlePinStop}
                disabled={pinning || !isTracking}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 12,
                  border: `1px solid ${pinFeedback === "success" ? "#2d4a2d" : pinFeedback === "error" ? "#4a2d2d" : "#2a3a2a"}`,
                  background: pinFeedback === "success" ? "#0d1a0d" : pinFeedback === "error" ? "#1a0d0d" : "#0f1a0f",
                  color: pinFeedback === "success" ? "#4ade80" : pinFeedback === "error" ? "#f87171" : "#86efac",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: pinning || !isTracking ? "not-allowed" : "pointer",
                  opacity: !isTracking ? 0.4 : 1,
                  transition: "all 0.3s ease",
                  letterSpacing: "0.05em",
                }}
              >
                {pinning
                  ? "📍 Pinning..."
                  : pinFeedback === "success"
                  ? "✅ Stop Pinned"
                  : pinFeedback === "error"
                  ? "❌ Pin Failed — Retry"
                  : "📍 PIN STOP"}
              </button>

              {/* Error */}
              {error && (
                <div style={{
                  color: "#f87171", background: "#1a0d0d", border: "1px solid #4a2d2d",
                  borderRadius: 10, padding: "10px 14px", fontSize: 13
                }}>
                  ⚠️ {error}
                  {!isTracking && tripStarted && (
                    <button
                      onClick={startTracking}
                      style={{
                        marginLeft: 12, color: "#4ade80", background: "none",
                        border: "1px solid #2d4a2d", borderRadius: 6,
                        padding: "2px 10px", cursor: "pointer"
                      }}>
                      Tap to Resume
                    </button>
                  )}
                </div>
              )}

              {/* End Trip */}
              <button className="btn-end" onClick={handleEndTrip}>
                END TRIP
              </button>

            </div>
          )}
        </div>
      </div>
    </>
  );
}