// src/simulate.ts
// ─────────────────────────────────────────────────────────────────────────────
// Bus Location Simulator — loops the route forever
//
// WHY LOOP?
//   Socket.IO does NOT replay past events. If you open the browser after the
//   simulator already sent some points, you miss them. By looping infinitely
//   you can open the page at ANY time and still see a full smooth animation.
//
// Run:  npx ts-node src/simulate.ts
// Stop: Ctrl + C
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';

// ── config ────────────────────────────────────────────────────────────────────

const API_URL  = process.env.API_URL  || "http://localhost:4000";
const ENDPOINT = `${API_URL}/api/redis/location`;
const INTERVAL = 10_000;  // ms between each waypoint push
const TRIP_ID  = process.env.TRIP_ID || "clx3k2m9h0000356kfj2a8b9x";

// Gap between finishing one loop and starting the next (so map resets cleanly)
const LOOP_GAP = 5_000;  // 5 seconds

// ── route: Connaught Place → India Gate (Delhi) ───────────────────────────────

interface Waypoint {
  lat:    number;
  lon:    number;
  label:  string;
  vel?:   number;   // km/h
  acc?:   number;   // m/s²
}

const ROUTE: Waypoint[] = [
  { lat: 28.6315, lon: 77.2167, label: "Connaught Place",     vel: 0,    acc: 0    },
  { lat: 28.6298, lon: 77.2183, label: "Janpath crossing",    vel: 28.5, acc: 1.2  },
  { lat: 28.6278, lon: 77.2201, label: "Windsor Place",       vel: 32.0, acc: 0.5  },
  { lat: 28.6261, lon: 77.2218, label: "Shahjahan Road",      vel: 35.0, acc: 0.8  },
  { lat: 28.6247, lon: 77.2234, label: "Rajpath near NII",    vel: 40.0, acc: 1.0  },
  { lat: 28.6233, lon: 77.2252, label: "Rajpath mid",         vel: 42.5, acc: 0.3  },
  { lat: 28.6218, lon: 77.2267, label: "Near Vijay Chowk",   vel: 38.0, acc: -0.5 },
  { lat: 28.6200, lon: 77.2279, label: "Vijay Chowk",        vel: 20.0, acc: -2.0 },
  { lat: 28.6185, lon: 77.2285, label: "Kartavya Path start", vel: 25.0, acc: 1.0  },
  { lat: 28.6165, lon: 77.2290, label: "Kartavya Path mid",   vel: 30.0, acc: 0.5  },
  { lat: 28.6145, lon: 77.2292, label: "Near War Memorial",   vel: 28.0, acc: -0.3 },
  { lat: 28.6129, lon: 77.2295, label: "India Gate",          vel: 0,    acc: -2.0 },
];

// ── helpers ───────────────────────────────────────────────────────────────────

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function pushLocation(waypoint: Waypoint, step: number, loop: number): Promise<void> {
  const body = {
    tripId: TRIP_ID,
    lat:    waypoint.lat,
    lon:    waypoint.lon,
    vel:    waypoint.vel  ?? null,
    acc:    waypoint.acc  ?? null,
  };

  try {
    const res  = await fetch(ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    const data = await res.json();

    if (res.ok) {
      console.log(
        `[Loop ${loop}] ✅ (${step + 1}/${ROUTE.length}) ${waypoint.label.padEnd(22)}` +
        ` lat:${waypoint.lat}  lon:${waypoint.lon}` +
        (waypoint.vel != null ? `  vel:${waypoint.vel}km/h` : "")
      );
    } else {
      console.error(`[Loop ${loop}] ❌ API error at step ${step + 1}:`, data);
    }
  } catch (err) {
    console.error(`[Loop ${loop}] ❌ Fetch failed at step ${step + 1}:`, err);
  }
}

// ── main loop ─────────────────────────────────────────────────────────────────

async function runSimulator(): Promise<void> {
  console.log("🚌  Bus Location Simulator — looping forever (Ctrl+C to stop)");
  console.log(`📍  Route : ${ROUTE[0].label} → ${ROUTE[ROUTE.length - 1].label}`);
  console.log(`🔗  API   : ${ENDPOINT}`);
  console.log(`🆔  Trip  : ${TRIP_ID}`);
  console.log(`⏱   Every : ${INTERVAL / 1000}s  |  Loop gap: ${LOOP_GAP / 1000}s`);
  console.log("─".repeat(70));
  console.log("💡  TIP: Open your browser NOW — the route will keep replaying.");
  console.log("─".repeat(70));

  let loop = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log(`\n🔁  Starting loop ${loop}…`);

    for (let i = 0; i < ROUTE.length; i++) {
      await pushLocation(ROUTE[i], i, loop);

      // Don't wait after the last waypoint — just log and break to loop gap
      if (i < ROUTE.length - 1) {
        await wait(INTERVAL);
      }
    }

    console.log(`\n🏁  Loop ${loop} complete — bus arrived at ${ROUTE[ROUTE.length - 1].label}.`);
    console.log(`⏸   Restarting in ${LOOP_GAP / 1000}s...\n`);
    console.log("─".repeat(70));

    await wait(LOOP_GAP);
    loop++;
  }
}

// ── entry ─────────────────────────────────────────────────────────────────────

runSimulator().catch((err) => {
  console.error("💥 Simulator crashed:", err);
  process.exit(1);
});