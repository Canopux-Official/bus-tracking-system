import { Request, Response } from "express";
import { db } from '../db/dbconnection';
import { bus } from '../db/schema/bus';

export const searchBuses = async (req: Request, res: Response) => {
  try {
    const { source, destination } = req.query;

    if (typeof source !== "string" || typeof destination !== "string") {
      return res.status(400).json({ error: "Invalid query params" });
    }

    const s = source.trim().toLowerCase();
    const d = destination.trim().toLowerCase();

    if (s === d) {
      return res.status(400).json({ error: "Source and Destination cannot be same." });
    }

    // Fetch only required Fields
    const buses = await db.select({
      tripId: bus.tripId,
      bus_number: bus.bus_number,
      route: bus.route,
      status: bus.status,
    }).from(bus);

    const filtered = buses.filter((b) => {
      const route = Array.isArray(b.route)
        ? b.route.map((r: string) => r.toLowerCase())
        : [];

      const sIndex = route.indexOf(s);
      const dIndex = route.indexOf(d);

      return sIndex !== -1 && dIndex !== -1 && sIndex < dIndex;
    });

    // Filter Active Bus First.
    filtered.sort((a, b) =>
      (b.status === "active" ? 1 : 0) - (a.status === "active" ? 1 : 0)
    );

    return res.status(200).json(filtered);

  } catch (err) {
    console.error("searchBuses error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};