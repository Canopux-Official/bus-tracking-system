import { useEffect } from "react";
import "../styles/Stopsmodal.css";

type Bus = {
  tripId: string;
  bus_number: string;
  route: string[];
  status: string;
};

type Props = {
  bus: Bus;
  userSource: string;
  userDestination: string;
  onClose: () => void;
  onTrack: () => void;
};

export default function StopsModal({ bus, userSource, userDestination, onClose, onTrack }: Props) {
  const route = bus.route;
  const srcNorm = userSource.trim().toLowerCase();
  const dstNorm = userDestination.trim().toLowerCase();

  const boardingIdx = route.findIndex((s) => s.toLowerCase() === srcNorm);
  const dropIdx = route.findIndex((s) => s.toLowerCase() === dstNorm);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function getStopType(idx: number): "boarding" | "drop" | "between" | "outside" {
    if (idx === boardingIdx) return "boarding";
    if (idx === dropIdx) return "drop";
    if (boardingIdx !== -1 && dropIdx !== -1 && idx > boardingIdx && idx < dropIdx) return "between";
    return "outside";
  }

  return (
    <div className="sm-backdrop" onClick={onClose}>
      <div className="sm-sheet" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="sm-header">
          <div className="sm-header-left">
            <div className="sm-bus-badge">{bus.bus_number}</div>
            <div className="sm-header-meta">
              <div className="sm-title">Route Stops</div>
              <div className="sm-sub">{route.length} stops · {route[0]} → {route[route.length - 1]}</div>
            </div>
          </div>
          <button className="sm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Legend */}
        <div className="sm-legend">
          <span className="sm-legend-item boarding">● Boarding</span>
          <span className="sm-legend-item drop">● Drop</span>
          <span className="sm-legend-item between">● Your route</span>
          <span className="sm-legend-item outside">● Outside</span>
        </div>

        {/* Stop List */}
        <div className="sm-scroll">
          <div className="sm-timeline">
            {route.map((stop, idx) => {
              const type = getStopType(idx);
              const isLast = idx === route.length - 1;

              return (
                <div key={idx} className={`sm-stop sm-stop--${type}`}>
                  {/* Track line + dot */}
                  <div className="sm-track">
                    <div className={`sm-dot sm-dot--${type}`} />
                    {!isLast && <div className={`sm-line ${type === "between" || type === "boarding" ? "sm-line--active" : ""}`} />}
                  </div>

                  {/* Content */}
                  <div className="sm-stop-content">
                    <div className="sm-stop-name">
                      {stop.charAt(0).toUpperCase() + stop.slice(1)}
                    </div>
                    {type === "boarding" && <span className="sm-tag sm-tag--boarding">Your Boarding Stop</span>}
                    {type === "drop"     && <span className="sm-tag sm-tag--drop">Your Drop Stop</span>}
                    <div className="sm-stop-num">Stop {idx + 1}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="sm-footer">
          {bus.status === "active" ? (
            <button className="sm-track-btn" onClick={onTrack}>
              <span className="sm-track-pulse" />
              Track Live Bus
            </button>
          ) : (
            <div className="sm-offline-note">
              🔴 This bus is currently offline
            </div>
          )}
        </div>

      </div>
    </div>
  );
}