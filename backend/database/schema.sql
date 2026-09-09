-- ==============================================================================
-- Projectson (AI-Driven Project & Knowledge Assistant)
-- Production & Development Unified Database Schema
-- Compatible with: Neon Serverless PostgreSQL
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean drop of existing legacy tables
DROP TABLE IF EXISTS template CASCADE;
DROP TABLE IF EXISTS item CASCADE;
DROP TABLE IF EXISTS project_item CASCADE;
DROP TABLE IF EXISTS project_context CASCADE;
DROP TABLE IF EXISTS member CASCADE;
DROP TABLE IF EXISTS workspace CASCADE;
DROP TABLE IF EXISTS tai_ping_mun_tests CASCADE;

-- ------------------------------------------------------------------------------
-- 0. Health / Diagnostic Test Table
-- ------------------------------------------------------------------------------
CREATE TABLE tai_ping_mun_tests (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 1. Workspace Table
-- ------------------------------------------------------------------------------
CREATE TABLE workspace (
    workspace_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefix_code VARCHAR(50) UNIQUE NOT NULL,
    workspace_name VARCHAR(255) NOT NULL,
    workspace_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_item_number INT DEFAULT 0,
    last_context_number INT DEFAULT 0,
    allow_access_member JSONB DEFAULT '[]'::jsonb
);

-- ------------------------------------------------------------------------------
-- 2. Member Table
-- ------------------------------------------------------------------------------
CREATE TABLE member (
    member_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_name VARCHAR(255) NOT NULL,
    member_email VARCHAR(255) UNIQUE,
    member_role VARCHAR(100) DEFAULT 'Member',
    member_ad_group VARCHAR(100),
    member_status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 3. Project Context Table (Product, Project)
-- ------------------------------------------------------------------------------
CREATE TABLE project_context (
    context_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_name VARCHAR(255) NOT NULL,
    context_display_code VARCHAR(100) UNIQUE NOT NULL, -- e.g. "AAP-COT-1"
    context_number INT NOT NULL,
    context_type VARCHAR(50) NOT NULL, -- 'Product', 'Project'
    related_workspace_uid UUID REFERENCES workspace(workspace_uid) ON DELETE CASCADE,
    parent_content_uid UUID REFERENCES project_context(context_uid) ON DELETE SET NULL,
    context_status VARCHAR(50) NOT NULL DEFAULT 'Active', -- 'Active','Pipeline','On Hold','Completed','Abandoned'
    project_type VARCHAR(50), -- 'Phase', 'BAU', Null
    project_type_sequence INT DEFAULT 0, -- 0 for BAU, 1..N for Phase
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    content JSONB DEFAULT '{}'::jsonb, -- Rich text, charter or properties
    allow_access_member JSONB DEFAULT '[]'::jsonb,
    content_update_log JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 4. Item Table (Unified Polymorphic Items)
-- ------------------------------------------------------------------------------
CREATE TABLE item (
    item_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_display_code VARCHAR(100) UNIQUE NOT NULL, -- e.g. "AAP-083"
    prefix_code VARCHAR(50) NOT NULL,
    item_number INT NOT NULL,
    item_title VARCHAR(255) NOT NULL,
    related_context_uid UUID REFERENCES project_context(context_uid) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL, 
    -- 'Charter', 'Epic', 'Task', 'Event', 'Micro Task', 'Meeting', 'Bottleneck', 
    -- 'Information', 'Bug', 'UAT', 'Deployment', 'Milestone', 'Objective', 
    -- 'Requirement', 'User story', 'Decision'
    item_status VARCHAR(50) NOT NULL DEFAULT 'Not Start', 
    -- 'Not Start', 'Ready', 'In Progress', 'Stuck', 'Review', 'Completed', 'Closed', 'Backlog'
    item_priority VARCHAR(50) NOT NULL DEFAULT 'Middle', -- 'High', 'Middle', 'Low'
    item_planned_start_date DATE,
    item_planned_end_date DATE,
    item_actual_start_date DATE,
    item_actual_end_date DATE,
    item_follow_by UUID REFERENCES member(member_uid) ON DELETE SET NULL,
    item_assigned_by UUID REFERENCES member(member_uid) ON DELETE SET NULL,
    item_content JSONB DEFAULT '{}'::jsonb, -- BlockNote rich text / custom details
    item_comment JSONB DEFAULT '[]'::jsonb, -- Comments history
    parent_item_uid UUID REFERENCES item(item_uid) ON DELETE SET NULL, -- Hierarchy: Objective > Requirement > Story > Task > UAT
    related_item_uid_relation JSONB DEFAULT '[]'::jsonb, -- {item_uid, relation: blocks, is blocked, etc.}
    workspace_uid UUID REFERENCES workspace(workspace_uid) ON DELETE CASCADE,
    item_attribute JSONB DEFAULT '{}'::jsonb,
    item_update_log JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 5. Template Table
-- ------------------------------------------------------------------------------
CREATE TABLE template (
    template_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_uid UUID REFERENCES workspace(workspace_uid) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    target_type VARCHAR(50), -- e.g. 'Project', 'Item', 'Meeting', 'Charter'
    template_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 6. Indexes for Performance & Scalability
-- ------------------------------------------------------------------------------
CREATE INDEX idx_project_context_workspace ON project_context(related_workspace_uid);
CREATE INDEX idx_project_context_parent ON project_context(parent_content_uid);
CREATE INDEX idx_item_context ON item(related_context_uid);
CREATE INDEX idx_item_workspace ON item(workspace_uid);
CREATE INDEX idx_item_type ON item(item_type);
CREATE INDEX idx_item_status ON item(item_status);
CREATE INDEX idx_item_parent ON item(parent_item_uid);

-- ------------------------------------------------------------------------------
-- 7. Timestamp Update Triggers
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER trigger_update_member_timestamp
BEFORE UPDATE ON member
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER trigger_update_context_timestamp
BEFORE UPDATE ON project_context
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER trigger_update_item_timestamp
BEFORE UPDATE ON item
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER trigger_update_template_timestamp
BEFORE UPDATE ON template
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ------------------------------------------------------------------------------
-- 8. Standard Seed Data
-- ------------------------------------------------------------------------------

-- Seed Workspaces
INSERT INTO workspace (workspace_uid, prefix_code, workspace_name, last_item_number, last_context_number)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'AAP', 'ASD Ops Analytics & Insight', 87, 9),
    ('a0000000-0000-0000-0000-000000000002', 'TPM', 'Tai Ping Mun Tech', 0, 0)
ON CONFLICT (prefix_code) DO NOTHING;

-- Seed Members
INSERT INTO member (member_uid, member_name, member_email, member_role, member_ad_group, member_status)
VALUES 
    ('b0000000-0000-0000-0000-000000000001', 'Edmond Chan', 'edmondlchan2002@gmail.com', 'Product Lead', 'ASD-ADA', 'Active'),
    ('b0000000-0000-0000-0000-000000000002', 'HKIA Team', 'hkia@cathaypacific.com', 'Collaborator', 'ASD-HKIA', 'Active'),
    ('b0000000-0000-0000-0000-000000000003', 'GAMS Team', 'gams@cathaypacific.com', 'Collaborator', 'ASD-GAMS', 'Active'),
    ('b0000000-0000-0000-0000-000000000004', 'Chris Chow', 'chris@cathaypacific.com', 'Collaborator', 'ASD-ACS', 'Active')
ON CONFLICT (member_email) DO NOTHING;

-- Seed Project Contexts
INSERT INTO project_context (context_uid, context_name, context_display_code, context_number, context_type, related_workspace_uid, parent_content_uid, context_status, project_type, project_type_sequence, planned_start_date)
VALUES 
    ('c0000000-0000-0000-0000-000000000002', 'Airport Self Service (Product)', 'AAP-COT-2', 2, 'Product', 'a0000000-0000-0000-0000-000000000001', NULL, 'Active', NULL, NULL, '2025-01-01'),
    ('c0000000-0000-0000-0000-000000000001', 'Airport Self Service (Revamp)', 'AAP-COT-1', 1, 'Project', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Active', 'Phase', 1, '2025-05-01'),
    ('c0000000-0000-0000-0000-000000000003', 'Airport Self Service (BAU)', 'AAP-COT-3', 3, 'Project', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Active', 'BAU', 0, '2025-05-01')
ON CONFLICT (context_display_code) DO NOTHING;

-- Seed Items
INSERT INTO item (item_uid, item_display_code, prefix_code, item_number, item_title, related_context_uid, item_type, item_status, item_priority, item_planned_start_date, item_follow_by, workspace_uid, item_content)
VALUES 
    ('d0000000-0000-0000-0000-000000000083', 'AAP-083', 'AAP', 83, 'True Self Service Dashboard Kick Off', 'c0000000-0000-0000-0000-000000000001', 'Meeting', 'Completed', 'Middle', '2026-06-14', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '{"summary": "Kick-off meeting to align on project scopes."}'::jsonb),
    ('d0000000-0000-0000-0000-000000000084', 'AAP-084', 'AAP', 84, 'DFM and HKIA to provide a proposed list of TSS inclusion/exclusion items', 'c0000000-0000-0000-0000-000000000001', 'Task', 'In Progress', 'High', '2026-06-14', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '{}'::jsonb),
    ('d0000000-0000-0000-0000-000000000087', 'AAP-087', 'AAP', 87, 'Adopt Cloud Run & Cloudflare Pages for Projectson 2.0', 'c0000000-0000-0000-0000-000000000001', 'Decision', 'Completed', 'High', '2026-09-09', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '{"decision": "Adopt Google Cloud Run and Cloudflare Pages architecture", "rationale": "Cost efficiency, zero egress in same region, instant deployment."}'::jsonb)
ON CONFLICT (item_display_code) DO NOTHING;

