import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const config: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }, // Typically false for neon serverless certificates in dev, change to true for higher security
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
};

export const pool = new Pool(config);

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export interface RemarkEntry {
  timestamp: string;
  user: string;
  text: string;
  action?: string;
}

/**
 * Format append-only remarks. Updates the remarks JSON array by adding a new log.
 */
export const appendRemark = (
  existingRemarks: RemarkEntry[] | string | null | undefined,
  text: string,
  user: string = 'System/AI',
  action?: string
): string => {
  let remarksArray: RemarkEntry[] = [];
  if (Array.isArray(existingRemarks)) {
    remarksArray = existingRemarks;
  } else if (typeof existingRemarks === 'string') {
    try {
      remarksArray = JSON.parse(existingRemarks);
    } catch {
      remarksArray = [];
    }
  }

  remarksArray.push({
    timestamp: new Date().toISOString(),
    user,
    text,
    action
  });

  return JSON.stringify(remarksArray);
};
