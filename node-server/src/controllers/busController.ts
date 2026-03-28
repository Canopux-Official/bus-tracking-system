// src/controllers/busController.ts
import { Request, Response } from "express";
import { db } from "../db/dbconnection";
import { bus } from "../db/schema/bus";
import { eq } from "drizzle-orm";

// this request for when the bus driver will enter the bus details
export async function createBus(req: Request, res: Response): Promise<void> {
    try {
        const { bus_number, source, destination } = req.body;

        // ── validation ──────────────────────────────────────────────────────
        if (!bus_number || !source || !destination) {
            res.status(400).json({
                success: false,
                message: "bus_number, source, and destination are required.",
            });
            return;
        }



        // ── insert ──────────────────────────────────────────────────────────
        const [newBus] = await db
            .insert(bus)
            .values({
                bus_number,
                source,
                destination,
                route: [source.toLowerCase(), destination.toLowerCase()], // ✅ FIX
            })
            .returning();

        res.status(201).json({
            success: true,
            message: "Bus created successfully.",
            tripId: newBus.tripId,
            data: newBus,
        });
    } catch (err: unknown) {
        if (
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: string }).code === "23505"
        ) {
            res.status(409).json({
                success: false,
                message: "A bus with this bus_number already exists.",
            });
            return;
        }

        console.error("❌ createBus error:", err);
        res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
}




// export async function endTrip(req: Request, res: Response): Promise<void> {
//     try {
//         const tripId = req.params.tripId as string;
//         // ── validation ─────────────────────────────────────────
//         if (!tripId) {
//             res.status(400).json({
//                 success: false,
//                 message: "tripId is required.",
//             });
//             return;
//         }
//         // ── check if trip exists ───────────────────────────────
//         const [existingTrip] = await db
//             .select()
//             .from(bus)
//             .where(eq(bus.tripId, tripId));

//         if (!existingTrip) {
//             res.status(404).json({
//                 success: false,
//                 message: "Bus trip not found.",
//             });
//             return;
//         }

//         // ── prevent double ending ──────────────────────────────
//         if (existingTrip.status === "completed") {
//             res.status(400).json({
//                 success: false,
//                 message: "Trip already ended.",
//             });
//             return;
//         }

//         // ── update trip ────────────────────────────────────────
//         const [updatedBus] = await db
//             .update(bus)
//             .set({
//                 status: "completed",
//                 endedAt: new Date(),
//                 updatedAt: new Date(),
//             })
//             .where(eq(bus.tripId, tripId))
//             .returning();

//         res.status(200).json({
//             success: true,
//             message: "Trip ended successfully.",
//             data: updatedBus,
//         });

//     } catch (err) {
//         console.error("❌ endTrip error:", err);

//         res.status(500).json({
//             success: false,
//             message: "Internal server error.",
//         });
//     }
// }


export async function endTrip(req: Request, res: Response): Promise<void> {
    try {
        const tripId = req.params.tripId as string;

        if (!tripId) {
            res.status(400).json({ success: false, message: "tripId is required." });
            return;
        }

        const [existingTrip] = await db
            .select()
            .from(bus)
            .where(eq(bus.tripId, tripId));

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
            .where(eq(bus.tripId, tripId))
            .returning();

        // ── Trigger batch stop processing in Python ────────────────────────
        // Fire and forget — if Python is down it logs but never blocks response
        const PYTHON_URL = process.env.PYTHON_URL || "http://localhost:5000";
        console.log(`[endTrip] calling Python at: ${PYTHON_URL}/internal/process-stops/${tripId}`);
        fetch(`${PYTHON_URL}/internal/process-stops/${tripId}`, { method: "POST" })
            .catch(err => console.error("Stop processing trigger failed:", err));
        // ──────────────────────────────────────────────────────────────────

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