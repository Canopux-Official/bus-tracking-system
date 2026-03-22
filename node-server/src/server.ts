// // src/server.ts
// import express from 'express';
// import 'dotenv/config';
// import busRoutes from './routes/busRoutes';
// import redisRoutes from './routes/redisRoutes';
// import { connectRedis, redisClient } from './redis/redisConnection';

// const app = express();
// const port = process.env.PORT || 4000;

// app.use(express.json());

// async function initRedis() {
//     await connectRedis();

//     // Duplicate client for subscribing
//     const subscriber = redisClient.duplicate();
//     await subscriber.connect();

//     console.log("🔔 Subscribed to processed_location channel...");

//     await subscriber.subscribe("processed_data", (message) => {
//         const processedData = JSON.parse(message);
//         console.log("✅ Processed data received:", processedData);

//         // Here you could also emit via WebSocket to frontend
//         // io.emit('locationUpdate', processedData);
//     });
// }

// // 2️⃣ Start Redis subscription
// initRedis().catch(console.error);

// // 3️⃣ Routes (can remain outside the Redis subscription)
// app.use("/api/redis", redisRoutes);
// app.use("/bus", busRoutes);

// // 4️⃣ Start Express server
// app.listen(port, () => {
//     console.log(`Server running on http://localhost:${port}`);
//     console.log(`Environment: ${process.env.NODE_ENV}`);
// });


// src/server.ts
import express from 'express';
import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import busRoutes from './routes/busRoutes';
import redisRoutes from './routes/redisRoutes';
import { connectRedis, redisClient } from './redis/redisConnection';

const app = express();
const httpServer = createServer(app);

// ── Socket.IO setup ───────────────────────────────────────────────────────────
export const io = new Server(httpServer, {
    cors: {
        origin: "*",       // tighten this in production
        methods: ["GET", "POST"],
    },
});

io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    socket.on("disconnect", () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
    });
});

const port = process.env.PORT || 4000;

app.use(express.json());

// ── Redis subscriber → emit to all connected frontend clients ─────────────────
async function initRedis() {
    await connectRedis();

    const subscriber = redisClient.duplicate();
    await subscriber.connect();

    console.log("🔔 Subscribed to processed_data channel...");

    await subscriber.subscribe("processed_data", (message) => {
        const processedData = JSON.parse(message);
        console.log("✅ Processed data received:", processedData);

        // Add this log to confirm emit is firing
        console.log(`📡 Emitting to ${io.engine.clientsCount} connected clients`);
        io.emit("locationUpdate", processedData);
    });
}

initRedis().catch(console.error);

app.use("/api/redis", redisRoutes);
app.use("/bus", busRoutes);

httpServer.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});