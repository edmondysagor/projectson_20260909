import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

// Initialize testing table if not exists
export async function initTestingDB() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS tai_ping_mun_tests (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(100) DEFAULT 'General',
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `
  try {
    const client = await pool.connect()
    await client.query(createTableQuery)
    client.release()
    console.log('✅ Neon DB: tai_ping_mun_tests table initialized successfully.')
  } catch (err: any) {
    console.error('❌ Neon DB initialization error:', err.message)
  }
}
