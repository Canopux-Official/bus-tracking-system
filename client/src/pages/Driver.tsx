import '../styles/Driver.css';
import { useState} from "react";
import { useTracking } from "../hooks/useTracking";
import { startTrip, endTrip } from "../apis/trip.api";
import { BusIcon, LocationPin, ArrowRight, SignalIcon } from "../icons/driver";


export default function Driver() {

  // Form Inputs.
  const [busId, setBusId] = useState("");
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");

  // Trip-Related States.
  const [tripStarted, setTripStarted] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // GPS Tracking.
  const { isTracking, startTracking, stopTracking, lastSent, error } = useTracking(tripId);


  // 1. Submit Trip.
  const handleSubmitTrip = async () => {
    if (!busId || !source || !destination) {
      alert("Please fill all fields");
      return;
    }
    try {
      setLoading(true);
      const res = await startTrip({ busId, source, destination });
      if (!res?.tripId) {
        throw new Error("Invalid response from server");
      }
      setTripId(res.tripId);
      setTripStarted(true);
    } catch (err) {
      console.error(err);
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
      }
    } catch (err) {
      console.error("End trip failed", err);
    }
    stopTracking();
    setTripStarted(false);
    setTripId(null);
    setBusId("");
    setSource("");
    setDestination("");
  };


  return (
    <>
      <div className="app">
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <div className="screen">
          {/* ── HEADER ── */}
          <div className="header">
            <div>
              <div className="header-label">Fleet Driver</div>
              <div className="header-title">{tripStarted ? "Trip Control" : "New Trip"}</div>
            </div>
            <div className="header-badge"><BusIcon /></div>
          </div>

          {/* ── FORM ── */}
          {!tripStarted && (
            <div className="fade-in">
              <div className="section-label">Trip Details</div>

              <div className="field">
                <div className="field-inner">
                  <span className="field-icon">
                    <BusIcon />
                  </span>
                  <div className="field-vr" />
                  <input
                    className="field-input" placeholder="Bus ID (e.g. BUS-042)"
                    value={busId} onChange={(e) => setBusId(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <div className="field-inner">
                  <span className="field-icon"><LocationPin /></span>
                  <div className="field-vr" />
                  <input
                    className="field-input" placeholder="Origin / Source"
                    value={source} onChange={(e) => setSource(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <div className="field-inner">
                  <span className="field-icon" style={{ color: "#3b82f6" }}><LocationPin /></span>
                  <div className="field-vr" />
                  <input
                    className="field-input" placeholder="Destination"
                    value={destination} onChange={(e) => setDestination(e.target.value)}
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
                disabled={loading || !busId || !source || !destination}
              >
                {loading ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite" }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Starting Trip…
                  </>
                ) : (
                  <>Start Trip <ArrowRight /></>
                )}
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── CONTROL PANEL ── */}
          {tripStarted && (
            <div className="control-wrap fade-in">
              {/* active badge */}
              <div className="trip-badge">
                <div className="trip-badge-dot" />
                {tripId} · Active
                <span style={{ marginLeft: "auto", color: "var(--muted)" }}>{busId}</span>
              </div>

              {/* chips */}
              <div className="trip-info-row">
                <div className="trip-chip">
                  <div className="trip-chip-label">From</div>
                  <div className="trip-chip-value">{source}</div>
                </div>
                <div className="trip-chip" style={{ borderColor: "#2563eb20" }}>
                  <div className="trip-chip-label">To</div>
                  <div className="trip-chip-value" style={{ color: "#2563eb" }}>{destination}</div>
                </div>
              </div>

              {/* big button */}
              <div className="orb-btn-wrap">
                <div className="pulse-ring-wrap">
                  <div className={`ring  ${isTracking ? "active" : "inactive"}`} />
                  <div className={`ring  ${isTracking ? "active" : "inactive"}`} />
                  <div className={`ring  ${isTracking ? "active" : "inactive"}`} />
                  <button
                    className={`main-btn ${isTracking ? "active" : "inactive"}`}
                    onClick={isTracking ? stopTracking : startTracking}
                  >
                    {isTracking ? "STOP" : "START"}
                    <span className="main-btn-sub">{isTracking ? "Sharing" : "Tracking"}</span>
                  </button>
                </div>

                {/* status strip */}
                <div className="status-strip" style={{ width: "100%" }}>
                  <div className="status-left">
                    <div className={`status-dot ${isTracking ? "on" : "off"}`} />
                    <div>
                      <div className="status-text">
                        {isTracking ? "Broadcasting GPS" : "GPS Paused"}
                      </div>
                      <div className="status-sub">
                        {isTracking ? "Passengers can see you live" : "Tap START to share location"}
                      </div>
                    </div>
                  </div>
                  <div className="status-signal">
                    {isTracking ? (
                      <div className={`last-sent-tag${isTracking ? "" : " off"}`}>
                        {lastSent !== null ? `${lastSent}s ago` : "now"}
                      </div>
                    ) : (
                      <SignalIcon active={false} />
                    )}
                  </div>
                </div>

                {error && <p style={{ color: "var(--red)", fontSize: 12, textAlign: "center" }}>{error}</p>}
              </div>

              <button className="btn-end" onClick={handleEndTrip}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                </svg>
                END TRIP
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}