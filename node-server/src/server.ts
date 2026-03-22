// src/server.ts
import express from 'express';
import 'dotenv/config';
import busRoutes from './routes/busRoutes';
import redisRoutes from './routes/redisRoutes';
import { connectRedis, redisClient } from './redis/redisConnection';

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

async function initRedis() {
    await connectRedis();

    // Duplicate client for subscribing
    const subscriber = redisClient.duplicate();
    await subscriber.connect();

    console.log("🔔 Subscribed to processed_location channel...");

    await subscriber.subscribe("processed_data", (message) => {
        const processedData = JSON.parse(message);
        console.log("✅ Processed data received:", processedData);

        // Here you could also emit via WebSocket to frontend
        // io.emit('locationUpdate', processedData);
    });
}

// 2️⃣ Start Redis subscription
initRedis().catch(console.error);

// 3️⃣ Routes (can remain outside the Redis subscription)
app.use("/api/redis", redisRoutes);
app.use("/bus", busRoutes);

// 4️⃣ Start Express server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});