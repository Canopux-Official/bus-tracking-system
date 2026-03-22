// src/db/seeddb.ts
import 'dotenv/config';
import { db } from './dbconnection';
import { bus } from './schema/bus';

async function seed() {
    try {
        console.log("🔹 Seeding database...");

        // ✅ Wipe all existing data first
        await db.delete(bus);
        console.log("🗑️  Cleared existing bus data.");

        const buses = [
            {
                bus_number: "BUS101",
                source: "Station A",
                destination: "Station B",
                route: ["Station A", "Stop 1", "Stop 2", "Station B"],
                current: true,
            },
            {
                bus_number: "BUS102",
                source: "Station C",
                destination: "Station D",
                route: ["Station C", "Stop 3", "Stop 4", "Station D"],
                current: false,
            },
            {
                bus_number: "BUS103",
                source: "Station E",
                destination: "Station F",
                route: ["Station E", "Stop 5", "Stop 6", "Station F"],
                current: true,
            },
        ];

        // ✅ Insert fresh data
        await db.insert(bus).values(buses);

        console.log("✅ Seed completed successfully!");
    } catch (err) {
        console.error("❌ Error seeding database:", err);
    } finally {
        await db.$client.end();
    }
}

seed();