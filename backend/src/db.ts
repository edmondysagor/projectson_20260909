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

    CREATE EXTENSION IF NOT EXISTS "vector";

    CREATE TABLE IF NOT EXISTS public.okf_sources (
      source_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_uid UUID NOT NULL REFERENCES public.workspace(workspace_uid) ON DELETE CASCADE,
      project_uid UUID REFERENCES public.project(project_uid) ON DELETE CASCADE,
      file_name VARCHAR(255) NOT NULL,
      file_size BIGINT NOT NULL DEFAULT 0,
      file_type VARCHAR(50) NOT NULL,
      r2_url TEXT,
      page_count INTEGER DEFAULT 1,
      content_text TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'uploaded' CHECK (
        status IN ('uploaded', 'parsing', 'chunking', 'indexed', 'failed')
      ),
      error_message TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS public.okf_chunks (
      chunk_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_uid UUID NOT NULL REFERENCES public.okf_sources(source_uid) ON DELETE CASCADE,
      workspace_uid UUID NOT NULL REFERENCES public.workspace(workspace_uid) ON DELETE CASCADE,
      project_uid UUID REFERENCES public.project(project_uid) ON DELETE CASCADE,
      item_uid UUID REFERENCES public.item(item_uid) ON DELETE CASCADE,
      page_number INTEGER DEFAULT 1,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      chunk_content TEXT NOT NULL,
      embedding vector(768),
      metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS public.okf_concepts (
      concept_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_uid UUID NOT NULL REFERENCES public.workspace(workspace_uid) ON DELETE CASCADE,
      project_uid UUID REFERENCES public.project(project_uid) ON DELETE CASCADE,
      concept_name VARCHAR(255) NOT NULL,
      concept_type VARCHAR(50) NOT NULL DEFAULT 'DomainConcept',
      concept_description TEXT,
      is_archived BOOLEAN NOT NULL DEFAULT false,
      valid_from TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      valid_to TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS public.okf_links (
      link_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_uid UUID NOT NULL REFERENCES public.workspace(workspace_uid) ON DELETE CASCADE,
      source_concept_uid UUID NOT NULL REFERENCES public.okf_concepts(concept_uid) ON DELETE CASCADE,
      target_concept_uid UUID NOT NULL REFERENCES public.okf_concepts(concept_uid) ON DELETE CASCADE,
      relation_type VARCHAR(50) NOT NULL CHECK (
        relation_type IN ('SUPERSEDES', 'PRE_REQ', 'BELONGS_TO', 'DERIVED_FROM', 'CAUSES', 'EXTENDS')
      ),
      link_metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE public.okf_sources ADD COLUMN IF NOT EXISTS content_text TEXT;
    CREATE INDEX IF NOT EXISTS idx_okf_sources_ws_prj ON public.okf_sources(workspace_uid, project_uid, is_active);
    CREATE INDEX IF NOT EXISTS idx_okf_chunks_source ON public.okf_chunks(source_uid);
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

