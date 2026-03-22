// src/controllers/busController.ts
import { Request, Response } from "express";
import { db } from "../db/dbconnection";
import { bus } from "../db/schema/bus";

// this request for when the bus driver will enter the bus details
export async function createBus(req: Request, res: Response): Promise<void> {
    try {
        const { bus_number, source, destination, current } = req.body;

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
                route : [],
                current: current ?? false,
            })
            .returning();

        res.status(201).json({
            success: true,
            message: "Bus created successfully.",
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