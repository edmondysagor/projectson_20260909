-- ==========================================
-- Project 神 (AI-Driven Project Document Assistant)
-- Neon PostgreSQL 5-Table Unified Polymorphic Database Schema
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables to recreate clean schema
DROP TABLE IF EXISTS project_item CASCADE;
DROP TABLE IF EXISTS project_context CASCADE;
DROP TABLE IF EXISTS member CASCADE;
DROP TABLE IF EXISTS workspace CASCADE;

-- 1. Workspace Table
CREATE TABLE workspace (
    workspace_id SERIAL PRIMARY KEY,
    prefix_code VARCHAR(50) UNIQUE NOT NULL,
    workspace_name VARCHAR(255) NOT NULL,
    workspace_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_item_number INT DEFAULT 0,
    last_context_number INT DEFAULT 0
);

-- 2. Member Table
CREATE TABLE member (
    member_id SERIAL PRIMARY KEY,
    member_name VARCHAR(255) NOT NULL,
    member_email VARCHAR(255),
    member_role VARCHAR(100),
    member_ad_group VARCHAR(100),
    member_status VARCHAR(50),
    member_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    member_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Project Context Table (Products and Projects)
CREATE TABLE project_context (
    id SERIAL PRIMARY KEY,
    content_name VARCHAR(255) NOT NULL,
    content_display_id VARCHAR(100) NOT NULL, -- e.g. "AAP-COT-1"
    content_type VARCHAR(50) NOT NULL, -- 'Project', 'Product'
    related_workspace_id INT REFERENCES workspace(workspace_id) ON DELETE SET NULL,
    parent_content_id INT REFERENCES project_context(id) ON DELETE SET NULL,
    content_status VARCHAR(50) NOT NULL, -- 'Pipeline', 'Active', 'On Hold', 'Completed', 'Abandoned'
    project_type VARCHAR(50), -- 'Null', 'Phase', 'BAU' (Nullable/Null for Product)
    project_type_sequence INT, -- Phase sequence starting from 1, 0 for BAU, empty/null for Product
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    content JSONB DEFAULT '{}'::jsonb, -- Additional properties
    content_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    content_update_log JSONB DEFAULT '[]'::jsonb
);

-- 4. Project Item Table (Polymorphic Tasks, Meetings, Events, Bottlenecks, Bugs, UAT, etc.)
CREATE TABLE project_item (
    id SERIAL PRIMARY KEY,
    item_display_id VARCHAR(100) UNIQUE NOT NULL, -- e.g., "AAP-083"
    item_title VARCHAR(255) NOT NULL,
    workspace_id INT REFERENCES workspace(workspace_id) ON DELETE CASCADE,
    related_context_id INT REFERENCES project_context(id) ON DELETE CASCADE,
    parent_item_id INT REFERENCES project_item(id) ON DELETE SET NULL,
    related_item_id_relation JSONB DEFAULT '[]'::jsonb,
    item_type VARCHAR(50) NOT NULL, -- 'Epic','Task','Event','Micro Task','Meeting','Bottleneck','Knowledge','Casual Note','Bug','UAT','Deploy'
    item_status VARCHAR(50) NOT NULL, -- 'Not Start','Ready','In Progress','Stuck','Review','Report Result','Completed','Closed','Backlog'
    item_priority VARCHAR(50) NOT NULL, -- 'High','Middle','Low'
    item_planned_start_date DATE,
    item_planned_end_date DATE,
    item_actual_start_date DATE,
    item_actual_end_date DATE,
    item_follow_by INT REFERENCES member(member_id) ON DELETE SET NULL,
    item_assigned_by INT REFERENCES member(member_id) ON DELETE SET NULL,
    item_content JSONB DEFAULT '{}'::jsonb, -- Specific properties depending on item_type (e.g. formulas, summaries)
    item_attribute JSONB DEFAULT '{}'::jsonb, -- Additional customizable properties
    item_comment JSONB DEFAULT '[]'::jsonb, -- Comments list
    item_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    item_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    item_update_log JSONB DEFAULT '[]'::jsonb
);

-- ==========================================
-- SEED DATA
-- ==========================================

-- Workspaces
INSERT INTO workspace (workspace_id, prefix_code, workspace_name, last_item_number, last_context_number) VALUES
(1, 'AAP', 'ASD Ops Analytics & Insight', 0, 9),
(2, 'TPM', 'Tai Ping Mun Tech', 0, 0);

-- Members
INSERT INTO member (member_id, member_name, member_email, member_role, member_ad_group, member_status) VALUES
(1, 'Edmond Chan', 'edmondlchan2002@gmail.com', 'Business Analyst', 'ASD-ADA', 'Active'),
(2, 'HKIA', NULL, 'Collaborator', 'ASD-HKIA', 'Active'),
(3, 'GAMS', NULL, 'Collaborator', 'ASD-GAMS', 'Active'),
(4, 'Chris Chow', NULL, 'Collaborator', 'ASD-ACS', 'Active');

-- Project Contexts
INSERT INTO project_context (id, content_name, content_display_id, content_type, related_workspace_id, parent_content_id, content_status, project_type, project_type_sequence, planned_start_date) VALUES
(1, 'Airport Self Service (Revamp)', 'AAP-COT-1', 'Project', 1, 2, 'Active', 'Phase', 1, '2025-05-01'),
(2, 'Airport Self Service (Product)', 'AAP-COT-2', 'Product', 1, NULL, 'Active', NULL, NULL, '2025-01-01'),
(3, 'Airport Self Service (BAU)', 'AAP-COT-3', 'Project', 1, 2, 'Active', 'BAU', 0, '2025-05-01'),
(7, 'Mishandled Baggage (New)', 'AAP-COT-7', 'Project', 1, 9, 'Pipeline', 'Phase', 1, '2025-04-01'),
(8, 'Mishandled Baggage (BAU)', 'AAP-COT-8', 'Project', 1, 9, 'Pipeline', 'BAU', 0, '2025-11-03'),
(9, 'Mishandled Baggage (Product)', 'AAP-COT-9', 'Product', 1, NULL, 'Active', NULL, NULL, NULL);

-- Project Items
INSERT INTO project_item (item_display_id, item_title, related_context_id, parent_item_id, related_item_id_relation, item_type, item_status, item_priority, item_planned_start_date, item_follow_by, item_content) VALUES
('AAP-083', 'True Self Service Dashboard Kick Off', 1, NULL, '[]'::jsonb, 'Meeting', 'Completed', 'Middle', '2026-06-14', 1, '{"summary": "Kick-off meeting to align on project scopes.", "content": "Meeting details..."}'::jsonb),
('AAP-084', 'DFM and HKIA to provide a proposed list of TSS inclusion/exclusion items for further discussion.', 1, NULL, '[]'::jsonb, 'Task', 'In Progress', 'High', '2026-06-14', 1, '{}'::jsonb),
('AAP-087', 'Estimate the impact of individual exclusions item on TSS score as listed in the wishlist/items', 1, NULL, '[]'::jsonb, 'Task', 'Not Start', 'High', '2026-06-14', 1, '{}'::jsonb),
('AAP-020', 'Test Bag 1', 3, NULL, '[]'::jsonb, 'Bug', 'Completed', 'Middle', '2026-06-15', 1, '{"description": "Found that employee browser with custom logic has issues."}'::jsonb);

