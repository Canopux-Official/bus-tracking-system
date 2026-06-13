import { Request, Response } from "express";
import { db } from "../db/dbconnection";
import { bus, Stop } from "../db/schema/bus";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// ── 1) Create Bus ─────────────────────────────────────────────────────────────
export async function createBus(req: Request, res: Response): Promise<void> {
    try {
        const { bus_number, source, destination } = req.body;

        if (!bus_number || !source || !destination) {
            res.status(400).json({
                success: false,
                message: "bus_number, source, and destination are required.",
            });
            return;
        }

        const s = source.trim().toLowerCase();
        const d = destination.trim().toLowerCase();

        // Check if same bus+route combo already exists
        const [existing] = await db
            .select()
            .from(bus)
            .where(
                and(
                    eq(bus.bus_number, bus_number),
                    eq(bus.source, s),
                    eq(bus.destination, d)
                )
            );

        if (existing) {
            // Reactivate with new tripId, carry over old route
            const newTripId = createId();
            const [reactivated] = await db
                .update(bus)
                .set({
                    tripId: newTripId,
                    status: "active",
                    endedAt: null,
                    updatedAt: new Date(),
                    // route is intentionally NOT reset — old route is preserved
                })
                .where(
                    and(
                        eq(bus.bus_number, bus_number),
                        eq(bus.source, s),
                        eq(bus.destination, d)
                    )
                )
                .returning();

            res.status(200).json({
                success: true,
                message: "Existing bus reactivated with previous route.",
                tripId: reactivated.tripId,
                data: reactivated,
            });
            return;
        }

        // First time — initialize route as [source, destination]
        const [newBus] = await db
            .insert(bus)
            .values({
                bus_number,
                source: s,
                destination: d,
                route: [],
            })
            .returning();

        res.status(201).json({
            success: true,
            message: "Bus created successfully.",
            tripId: newBus.tripId,
            data: newBus,
        });

    } catch (err: unknown) {
        console.error("❌ createBus error:", err);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}


// ── 2) Update Route ───────────────────────────────────────────────────────────
// Called when driver pins a new stop during the trip
// ── 2) Update Route ───────────────────────────────────────────────────────────
export async function updateRoute(req: Request, res: Response): Promise<void> {
    try {
        const { tripId } = req.params;
        const { lat, lng } = req.body; // ✅ was: { stop_name }

        if (lat === undefined || lng === undefined) {
            res.status(400).json({ success: false, message: "lat and lng are required." });
            return;
        }

        const [existing] = await db
            .select()
            .from(bus)
            .where(eq(bus.tripId, tripId as string));

        if (!existing) {
            res.status(404).json({ success: false, message: "Trip not found." });
            return;
        }

        if (existing.status === "completed") {
            res.status(400).json({ success: false, message: "Cannot update route of a completed trip." });
            return;
        }

        const newStop = { lat, lng };
        const currentRoute = Array.isArray(existing.route) ? existing.route as { lat: number; lng: number }[] : [];

        // Skip if last stop is the same coordinate (duplicate consecutive pin)
        const last = currentRoute[currentRoute.length - 1];
        const skipped = last && last.lat === lat && last.lng === lng;

        if (skipped) {
            res.status(200).json({
                success: true,
                skipped: true,
                message: "Duplicate stop skipped.",
                route: currentRoute,
            });
            return;
        }

        // ✅ Insert before final destination (last element)
        const destination = currentRoute[currentRoute.length - 1];
        const newRoute = [...currentRoute.slice(0, -1), newStop, destination];

        const [updated] = await db
            .update(bus)
            .set({ route: newRoute, updatedAt: new Date() })
            .where(eq(bus.tripId, tripId as string))
            .returning();

        res.status(200).json({
            success: true,
            skipped: false,
            message: "Stop added to route.",
            route: updated.route,
        });

    } catch (err) {
        console.error("❌ updateRoute error:", err);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}


// ── 3) End Trip ───────────────────────────────────────────────────────────────
export async function endTrip(req: Request, res: Response): Promise<void> {
    try {
        const { tripId } = req.params;

        const [existingTrip] = await db
            .select()
            .from(bus)
            .where(eq(bus.tripId, tripId as string));

        if (!existingTrip) {
            res.status(404).json({ success: false, message: "Bus trip not found." });
            return;
        }

        if (existingTrip.status === "completed") {
            res.status(400).json({ success: false, message: "Trip already ended." });
            return;
        }

        const [updatedBus] = await db
            .update(bus)
            .set({ status: "completed", endedAt: new Date(), updatedAt: new Date() })
            .where(eq(bus.tripId, tripId as string))
            .returning();

        // Fire-and-forget: notify Python service to process stops
        const PYTHON_URL = process.env.PYTHON_URL || "http://localhost:5000";
        fetch(`${PYTHON_URL}/internal/process-stops/${tripId}`, { method: "POST" })
            .catch(err => console.error("❌ Stop processing trigger failed:", err));

        res.status(200).json({
            success: true,
            message: "Trip ended successfully.",
            data: updatedBus,
        });

    } catch (err) {
        console.error("❌ endTrip error:", err);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}


// ── 4) Get Stops ──────────────────────────────────────────────────────────────
// Returns the current route/stops for frontend display
export async function getStops(req: Request, res: Response): Promise<void> {
    try {
        const { tripId } = req.params;

        const [existing] = await db
            .select()
            .from(bus)
            .where(eq(bus.tripId, tripId as string));

        if (!existing) {
            res.status(404).json({ success: false, message: "Trip not found." });
            return;
        }

        const route = Array.isArray(existing.route) ? existing.route as Stop[] : []; // ✅ was: as string[]

        res.status(200).json({
            success: true,
            bus_number: existing.bus_number,
            source: existing.source,
            destination: existing.destination,
            stops: route.map((name, idx) => ({ idx, name })),
        });

    } catch (err) {
        console.error("❌ getStops error:", err);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}