import { useState } from "react";
import '../styles/User.css'

type Bus = {
  tripId: string;
  bus_number: string;
  route: string[];
  status: string;
};

export default function User() {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [filteredBuses, setFilteredBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!source || !destination) {
      alert("Please enter source and destination");
      return;
    }
    try {
      setLoading(true);
      setSearched(false);
      const res = await fetch("/api/bus");
      const data: Bus[] = await res.json();
      const s = source.trim().toLowerCase();
      const d = destination.trim().toLowerCase();
      const result = data.filter((bus) => {
        
        // Considering active state of Bus now.
        if (bus.status !== "active") return false;
        const route = bus.route.map((r) => r.toLowerCase());
        const sIndex = route.indexOf(s);
        const dIndex = route.indexOf(d);
        return sIndex !== -1 && dIndex !== -1 && sIndex < dIndex;
      });
      setFilteredBuses(result);
      setSearched(true);
    } catch (err) {
      console.error("Error fetching buses:", err);
      alert("Failed to fetch buses");
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    setSource(destination);
    setDestination(source);
  };

  return (
    <>
      <div className="app">

        {/* NAV */}
        <div className="nav">
          <div className="nav-top">
            <div className="nav-brand">
              <div className="nav-logo">🚌</div>
              <div className="nav-name">BusGo</div>
            </div>
          </div>
          <div className="nav-greeting">Good morning,</div>
          <div className="nav-headline">Where are you<br />heading today?</div>
        </div>

        {/* SEARCH CARD BRIDGE */}
        <div className="red-bridge">
          <div className="search-card">

            {/* FROM */}
            <div className="field" style={{ paddingRight: 14 }}>
              <div className="field-dot dot-from" />
              <div className="field-inner">
                <div className="field-label">From</div>
                <input
                  className="field-input"
                  placeholder="Enter city or stop"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>
            </div>

            {/* DIVIDER + SWAP */}
            <div className="field-sep-wrap">
              <div className="field-sep" />
              <button className="swap-btn" onClick={handleSwap} title="Swap">⇅</button>
            </div>

            {/* TO */}
            <div className="field" style={{ paddingRight: 14 }}>
              <div className="field-dot dot-to" />
              <div className="field-inner">
                <div className="field-label">To</div>
                <input
                  className="field-input"
                  placeholder="Enter city or stop"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
            </div>

            <button className="search-btn" onClick={handleSearch} disabled={loading}>
              {loading
                ? <><div className="spinner" /> Searching buses…</>
                : <>Search Buses</>
              }
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="content">

          {/* Skeletons */}
          {loading && [0, 1].map((i) => (
            <div className="skel-card" key={i}>
              <div className="skel-row">
                <div className="skeleton" style={{ width: 64, height: 28 }} />
                <div className="skeleton" style={{ width: 100, height: 14 }} />
                <div style={{ flex: 1 }} />
                <div className="skeleton" style={{ width: 56, height: 22, borderRadius: 20 }} />
              </div>
              <div className="skeleton" style={{ height: 12, width: "80%" }} />
              <div className="skeleton" style={{ height: 12, width: "55%" }} />
            </div>
          ))}

          {/* Pre-search */}
          {!searched && !loading && (
            <div className="prompt">
              <span className="prompt-emoji">🗺️</span>
              <div className="prompt-title">Plan your journey</div>
              <div className="prompt-sub">Enter your source & destination above<br />to find active buses on your route</div>
            </div>
          )}

          {/* Results */}
          {searched && !loading && (
            <>
              <div className="section-header">
                <div className="section-title">Available Buses</div>
                {filteredBuses.length > 0 && (
                  <div className="section-badge">{filteredBuses.length} found</div>
                )}
              </div>

              {filteredBuses.length === 0 ? (
                <div className="empty">
                  <span className="empty-emoji">😕</span>
                  <div className="empty-title">No buses found</div>
                  <div className="empty-sub">No active buses on this route right now.<br />Try different stops.</div>
                </div>
              ) : (
                filteredBuses.map((bus, i) => {
                  const src = source.trim().toLowerCase();
                  const dst = destination.trim().toLowerCase();
                  const route = bus.route;
                  const srcIdx = route.findIndex(s => s.toLowerCase() === src);
                  const dstIdx = route.findIndex(s => s.toLowerCase() === dst);
                  const viaStops = route.slice(srcIdx + 1, dstIdx);

                  return (
                    <div key={bus.tripId} className="bus-card" style={{ animationDelay: `${i * 70}ms` }}>
                      <div className="bus-card-head">
                        <div className="bus-left">
                          <div className="bus-num-badge">{bus.bus_number}</div>
                          <div>
                            <div className="bus-trip">TRIP #{bus.tripId}</div>
                            <div className="bus-type">Express Bus</div>
                          </div>
                        </div>
                        <div className="status-pill">
                          <div className="status-dot" />
                          Live
                        </div>
                      </div>

                      <div className="bus-card-body">
                        {/* SOURCE */}
                        <div className="timeline-row">
                          <div className="timeline-track">
                            <div className="t-dot t-dot-src" />
                            <div className="t-line" />
                          </div>
                          <div className="timeline-stop">
                            <div className="stop-name-main">
                              {route[srcIdx]}
                              <span className="stop-tag stop-tag-src">Boarding</span>
                            </div>
                            <div className="stop-sub">Your boarding point</div>
                          </div>
                        </div>

                        {/* VIA */}
                        {viaStops.length > 0 && (
                          <div className="timeline-row">
                            <div className="timeline-track">
                              <div className="t-dot t-dot-mid" />
                              <div className="t-line t-line-dashed" />
                            </div>
                            <div className="timeline-stop">
                              <div className="via-stops">via {viaStops.join(" → ")}</div>
                            </div>
                          </div>
                        )}

                        {/* DESTINATION */}
                        <div className="timeline-row">
                          <div className="timeline-track">
                            <div className="t-dot t-dot-dst" />
                          </div>
                          <div className="timeline-stop" style={{ paddingBottom: 0 }}>
                            <div className="stop-name-main is-dst">
                              {route[dstIdx]}
                              <span className="stop-tag stop-tag-dst">Drop</span>
                            </div>
                            <div className="stop-sub">Your drop point</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

        </div>
      </div>
    </>
  );
}