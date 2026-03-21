// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from './schema'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test the database connection
pool.connect()
  .then(client => {
    console.log("✅ Database connected successfully");
    client.release(); // release the client back to the pool
  })
  .catch(err => {
    console.error("❌ Database connection error:", err);
  });

export const db = drizzle(pool, {schema});