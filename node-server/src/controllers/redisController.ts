import { redisClient } from '../redis/redisConnection'
import { Request, Response } from "express";

// Push location to Redis
export const pushLocation = async (req: Request, res: Response) => {
    const { tripId, lat, lon, vel, acc } = req.body;

    if (!tripId || lat === undefined || lon === undefined) {
        return res.status(400).json({ message: "Invalid data" });
    }

    try {
        // Create raw data object
        const rawData = {
            tripId,
            lat,
            lon,
            vel: vel ?? null,   // optional
            acc: acc ?? null,   // optional
            timestamp: Date.now()
        };

        // Publish to Redis channel 'raw_location'
        await redisClient.publish('raw_location', JSON.stringify(rawData));

        return res.json({ message: "Raw data published to Redis", data: rawData });
    } catch (err) {
        console.error('Redis error:', err);
        return res.status(500).json({ message: "Redis error" });
    }
};

// Get location from Redis
// export const getLocation = async (req: Request, res: Response) => {
//     const { busId } = req.params;

//     try {
//         const key = `bus:${busId}`;
//         const value = await redisClient.get(key);

//         if (!value) return res.status(404).json({ message: "Location not found" });

//         return res.json({ busId, location: JSON.parse(value as any) });
//     } catch (err) {
//         console.error(err);
//         return res.status(500).json({ message: "Redis error" });
//     }
// };

// //get all locations from redis
// export const getAllLocations = async (req: Request, res: Response) => {
//     try {
//         const keys = await redisClient.keys("bus:*");
//         const locations = [];
//         for (const key of keys) {
//             const value = await redisClient.get(key);
//             if (value) {
//                 locations.push({ busId: key.split(":")[1], location: JSON.parse(value as any) });
//             }
//         }
//         return res.json({ locations });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ message: "Redis error" });
//     }
// }