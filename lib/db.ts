import mysql from "mysql2/promise";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";

// Reuse one pool across hot reloads in development
const globalForDb = globalThis as unknown as { __rawPool?: Pool };

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set (see .env.local)");
  }
  const pool = mysql.createPool({
    uri: url,
    connectionLimit: 10,
    timezone: "Z", // the schema stores UTC
    dateStrings: false,
  });
  // Make NOW() and column defaults use UTC too, whatever the server's own timezone is
  pool.on("connection", (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  return pool;
}

export function getPool(): Pool {
  if (!globalForDb.__rawPool) {
    globalForDb.__rawPool = createPool();
  }
  return globalForDb.__rawPool;
}

export async function query<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const [rows] = await getPool().query<T[]>(sql, params);
  return rows;
}

export async function queryOne<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<ResultSetHeader> {
  const [result] = await getPool().query<ResultSetHeader>(sql, params);
  return result;
}

export type { RowDataPacket };
