// src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import 'dotenv/config';
import { db } from './db/dbconnection';


const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Example route using Drizzle
app.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allUsers = await db.query.users.findMany();
    console.log(allUsers);
    res.json(allUsers);
  } catch (err) {
    next(err);
  }
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});