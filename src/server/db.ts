import pg from "pg";

import { getEnv } from "@/src/server/env";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  const env = getEnv();
  pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  return pool;
}

export async function withClient<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

