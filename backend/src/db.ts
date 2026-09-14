import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

// Initialize core tables and schema if not exists
export async function initTestingDB() {
  const createTableQuery = `
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "vector";

    CREATE TABLE IF NOT EXISTS public.workspace (
      workspace_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prefix_code VARCHAR(20) NOT NULL UNIQUE,
      workspace_name VARCHAR(255) NOT NULL,
      workspace_created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      last_item_number INTEGER DEFAULT 0 NOT NULL,
      last_project_number INTEGER DEFAULT 0 NOT NULL,
      allow_access_member JSONB DEFAULT '[]'::jsonb NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public.member (
      member_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_name VARCHAR(255) NOT NULL,
      member_email VARCHAR(255) NOT NULL UNIQUE,
      member_ad_group VARCHAR(255),
      member_status VARCHAR(50) DEFAULT 'Active',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS public.project (
      project_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_name VARCHAR(255) NOT NULL,
      project_display_code VARCHAR(50) NOT NULL UNIQUE,
      project_number INTEGER NOT NULL,
      project_type VARCHAR(50) NOT NULL CHECK (project_type IN ('Product', 'Project')),
      related_workspace_uid UUID NOT NULL REFERENCES public.workspace(workspace_uid) ON DELETE CASCADE,
      parent_project_uid UUID REFERENCES public.project(project_uid) ON DELETE SET NULL,
      project_status VARCHAR(50) NOT NULL DEFAULT 'Pipeline' 
          CHECK (project_status IN ('Pipeline', 'Active', 'On Hold', 'Completed', 'Abandoned')),
      project_sub_type VARCHAR(50) CHECK (project_sub_type IN ('Phase', 'BAU')),
      project_type_sequence INTEGER DEFAULT 0,
      project_owner UUID REFERENCES public.member(member_uid) ON DELETE SET NULL,
      planned_start_date DATE,
      planned_end_date DATE,
      actual_start_date DATE,
      actual_end_date DATE,
      project_content JSONB DEFAULT '{}'::jsonb NOT NULL,
      allow_access_member JSONB DEFAULT '[]'::jsonb NOT NULL,
      project_attribute JSONB DEFAULT '{}'::jsonb NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_project_sub_type CHECK (
          (project_type = 'Product' AND project_sub_type IS NULL) OR
          (project_type = 'Project' AND project_sub_type IN ('Phase', 'BAU'))
      )
    );

    CREATE TABLE IF NOT EXISTS public.item (
      item_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      item_display_code VARCHAR(50) NOT NULL UNIQUE,
      prefix_code VARCHAR(20) NOT NULL,
      item_number INTEGER NOT NULL,
      item_title VARCHAR(500) NOT NULL,
      related_project_uid UUID NOT NULL REFERENCES public.project(project_uid) ON DELETE CASCADE,
      workspace_uid UUID NOT NULL REFERENCES public.workspace(workspace_uid) ON DELETE CASCADE,
      item_type VARCHAR(50) NOT NULL CHECK (
          item_type IN (
              'Charter', 'Epic', 'Task', 'Event', 'Micro Task', 
              'Meeting', 'Bottleneck', 'Information', 'Bug', 'UAT', 
              'Deployment', 'Milestone', 'Objective', 'Requirement', 
              'User story', 'Decision'
          )
      ),
      item_status VARCHAR(50) NOT NULL DEFAULT 'Not Start' CHECK (
          item_status IN (
              'Not Start', 'Ready', 'In Progress', 'Blocked', 
              'Review', 'Completed', 'Closed', 'Backlog'
          )
      ),
      item_priority VARCHAR(20) NOT NULL DEFAULT 'Middle' CHECK (
          item_priority IN ('High', 'Middle', 'Low')
      ),
      item_planned_start_date DATE,
      item_planned_end_date DATE,
      item_actual_start_date DATE,
      item_actual_end_date DATE,
      item_follow_by UUID REFERENCES public.member(member_uid) ON DELETE SET NULL,
      item_assigned_by UUID REFERENCES public.member(member_uid) ON DELETE SET NULL,
      item_content JSONB DEFAULT '{}'::jsonb NOT NULL,
      item_comment JSONB DEFAULT '[]'::jsonb NOT NULL,
      parent_item_uid UUID REFERENCES public.item(item_uid) ON DELETE SET NULL,
      relation_item_uid JSONB DEFAULT '[]'::jsonb NOT NULL,
      item_attribute JSONB DEFAULT '{}'::jsonb NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS public.template (
      template_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_uid UUID REFERENCES public.member(member_uid) ON DELETE SET NULL,
      template_name VARCHAR(255) NOT NULL,
      template_schema JSONB DEFAULT '[]'::jsonb NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

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

    CREATE INDEX IF NOT EXISTS idx_okf_sources_ws_prj ON public.okf_sources(workspace_uid, project_uid, is_active);
    CREATE INDEX IF NOT EXISTS idx_okf_chunks_source ON public.okf_chunks(source_uid);
  `

  try {
    const client = await pool.connect()
    await client.query(createTableQuery)

    // Seed default workspace and member if workspace is empty
    const wsRes = await client.query('SELECT count(*)::int as c FROM public.workspace')
    if (wsRes.rows[0]?.c === 0) {
      console.log('🌱 Database is empty, seeding initial Workspace & Members...')
      
      const m1 = await client.query(`
        INSERT INTO public.member (member_name, member_email, member_ad_group, member_status)
        VALUES ('Edmond Chan', 'edmond.chan@projectson.local', 'Project Leads', 'Active')
        RETURNING member_uid
      `)
      const m2 = await client.query(`
        INSERT INTO public.member (member_name, member_email, member_ad_group, member_status)
        VALUES ('Sarah Wong', 'sarah.wong@projectson.local', 'Dev Team', 'Active')
        RETURNING member_uid
      `)
      const edmondUid = m1.rows[0].member_uid
      const sarahUid = m2.rows[0].member_uid

      const ws = await client.query(`
        INSERT INTO public.workspace (prefix_code, workspace_name, last_project_number, last_item_number, allow_access_member)
        VALUES ('TTG', 'Testing', 1, 96, $1)
        RETURNING workspace_uid
      `, [JSON.stringify([
        { member_uid: edmondUid, role_in_this_workspace: 'owner' },
        { member_uid: sarahUid, role_in_this_workspace: 'editor' }
      ])])
      const wsUid = ws.rows[0].workspace_uid

      const prj = await client.query(`
        INSERT INTO public.project (
          project_name, project_display_code, project_number, project_type,
          related_workspace_uid, project_status, project_sub_type, project_type_sequence,
          project_owner, planned_start_date, planned_end_date, project_content
        ) VALUES (
          'Testing Project Phase 1', 'TTG-PRO-1', 1, 'Project',
          $1, 'Active', 'Phase', 1,
          $2, '2026-09-01', '2026-12-31',
          $3
        ) RETURNING project_uid
      `, [wsUid, edmondUid, JSON.stringify({ vision: "Automate boarding gate clearance with biometric verification." })])
      const prjUid = prj.rows[0].project_uid

      const standardCharterTable = `| Field | Description |
|---|---|
| Project Title |  |
| Business Sponsor |  |
| Business Owner |  |
| Problem & Opportunity |  |
| Objectives |  |
| Quantifiable Benefits |  |
| Non-quantifiable Benefits |  |
| Strategic Alignment |  |
| Metric |  |
| Baseline |  |
| Target |  |
| In-scope |  |
| Out-of-scope |  |
| Project Team Members |  |
| Stakeholders |  |
| Data Source: IODA |  |
| Data Source: Source System |  |
| Data Source: User Files |  |
| L1&2 Start |  |
| L3 Start |  |
| L4 Start |  |
| L5 Start |  |`

      await client.query(`
        INSERT INTO public.item (
          item_display_code, prefix_code, item_number, item_title,
          related_project_uid, workspace_uid, item_type, item_status, item_priority,
          item_follow_by, item_content
        ) VALUES ('TTG-96', 'TTG', 96, 'CHAR-01 SBG 系統自動化專案章程', $1, $2, 'Charter', 'Not Start', 'High', $3, $4)
      `, [prjUid, wsUid, edmondUid, JSON.stringify({ text: standardCharterTable, description: standardCharterTable })])

      console.log('✅ Seed completed: Testing Workspace (TTG) & TTG-96 Charter created.')
    }

    client.release()
    console.log('✅ Database schema verified & updated successfully.')
  } catch (err: any) {
    console.error('❌ Database initialization error:', err.message)
  }
}

