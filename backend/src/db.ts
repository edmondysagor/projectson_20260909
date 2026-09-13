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

    CREATE TABLE IF NOT EXISTS public.template (
      template_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_uid UUID REFERENCES public.member(member_uid) ON DELETE SET NULL,
      template_name VARCHAR(255) NOT NULL,
      template_schema JSONB DEFAULT '[]'::jsonb NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE public.project ADD COLUMN IF NOT EXISTS project_attribute JSONB DEFAULT '{}'::jsonb;

    CREATE TABLE IF NOT EXISTS public.ai_chat_session (
      session_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_uid UUID NOT NULL REFERENCES public.workspace(workspace_uid) ON DELETE CASCADE,
      project_uid UUID REFERENCES public.project(project_uid) ON DELETE SET NULL,
      member_uid UUID REFERENCES public.member(member_uid) ON DELETE SET NULL,
      title VARCHAR(255) NOT NULL DEFAULT '新對話',
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      last_model_used VARCHAR(64) DEFAULT 'qwen3.8-flash',
      is_pinned BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ai_chat_session_ws_prj ON public.ai_chat_session(workspace_uid, project_uid, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_chat_session_member ON public.ai_chat_session(member_uid, updated_at DESC);
  `
  try {
    const client = await pool.connect()
    await client.query(createTableQuery)
    client.release()
    console.log('✅ Neon DB: schema updated successfully.')
  } catch (err: any) {
    console.error('❌ Neon DB initialization error:', err.message)
  }
}

