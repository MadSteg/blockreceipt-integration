import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure websocket for serverless Neon database connection
neonConfig.webSocketConstructor = ws;

// Check for database URL
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.warn("DATABASE_URL not set, database operations will fail.");
}

// Create the database connection pool
export const pool = databaseUrl 
  ? new Pool({ connectionString: databaseUrl }) 
  : null;

// Create the database client with our schema
export const db = pool 
  ? drizzle(pool, { schema })
  : null;