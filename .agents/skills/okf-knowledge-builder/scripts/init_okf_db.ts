import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables
const envPaths = ['.env.local', 'backend/.env.development', 'backend/.env', '.env'];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL is missing in environment variables.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

export async function initOkfSchema() {
  console.log('🚀 Initializing Google OKF v0.2 + pgvector Schema on Neon DB...');
  const schemaPath = path.join(__dirname, '../references/okf_schema.sql');
  const ddl = fs.readFileSync(schemaPath, 'utf-8');

  try {
    // Split statements and execute
    const statements = ddl
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      await sql(stmt);
    }
    console.log('✅ OKF Database Schema (okf_concepts, okf_links, okf_chunks) successfully created/verified!');
  } catch (err: any) {
    console.error('❌ Failed to apply OKF schema:', err.message);
    throw err;
  }
}

if (require.main === module) {
  initOkfSchema().catch(() => process.exit(1));
}
