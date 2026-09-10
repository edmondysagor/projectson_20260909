-- ==============================================================================
-- Projectson 核心資料庫初始化結構 (Database Schema)
-- 適用環境: Neon Serverless PostgreSQL (Pooler 支援)
-- ==============================================================================

-- 啟用必要擴展 (UUID 生成)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. 工作區表 (workspace)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.workspace (
    workspace_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefix_code VARCHAR(20) NOT NULL UNIQUE,
    workspace_name VARCHAR(255) NOT NULL,
    workspace_created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_item_number INTEGER DEFAULT 0 NOT NULL,
    last_project_number INTEGER DEFAULT 0 NOT NULL,
    allow_access_member JSONB DEFAULT '[]'::jsonb NOT NULL
);

COMMENT ON TABLE public.workspace IS 'Projectson 工作區核心資料表';
COMMENT ON COLUMN public.workspace.workspace_uid IS '工作區唯一識別碼 (UUID)';
COMMENT ON COLUMN public.workspace.prefix_code IS '項目代號前綴 (例如 PRJ, ENG)，全域唯一';
COMMENT ON COLUMN public.workspace.workspace_name IS '工作區名稱';
COMMENT ON COLUMN public.workspace.workspace_created_at IS '建立時間戳記';
COMMENT ON COLUMN public.workspace.last_item_number IS '該工作區內 Item 序號最大值 (自增計數器)';
COMMENT ON COLUMN public.workspace.last_project_number IS '該工作區內 Project 序號最大值 (自增計數器)';
COMMENT ON COLUMN public.workspace.allow_access_member IS '成員權限列表 JSONB [{member_uid, role_in_this_workspace}]';

-- ==============================================================================
-- 2. 成員表 (member)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.member (
    member_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_name VARCHAR(255) NOT NULL,
    member_email VARCHAR(255) NOT NULL UNIQUE,
    member_ad_group VARCHAR(255),
    member_status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.member IS '成員使用者資料表';
COMMENT ON COLUMN public.member.member_uid IS '成員唯一識別碼 (UUID)';
COMMENT ON COLUMN public.member.member_name IS '成員全名';
COMMENT ON COLUMN public.member.member_email IS '成員電子郵件 (唯一)';
COMMENT ON COLUMN public.member.member_ad_group IS 'Active Directory / 團隊群組';
COMMENT ON COLUMN public.member.member_status IS '成員狀態 (Active, Inactive, etc.)';

-- ==============================================================================
-- 3. 專案/產品表 (project)
-- ==============================================================================
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_project_sub_type CHECK (
        (project_type = 'Product' AND project_sub_type IS NULL) OR
        (project_type = 'Project' AND project_sub_type IN ('Phase', 'BAU'))
    )
);

COMMENT ON TABLE public.project IS '專案或產品主表';
COMMENT ON COLUMN public.project.project_display_code IS '展示編號 (例如 PREFIX-PRO-1)';
COMMENT ON COLUMN public.project.project_type IS '分類 (Product 或 Project)';
COMMENT ON COLUMN public.project.project_sub_type IS '子分類 (Phase 或 BAU，僅 Project 適用)';
COMMENT ON COLUMN public.project.project_content IS 'Notion 式豐富文本 / 區塊結構 JSONB';

-- ==============================================================================
-- 4. 項目多態表 (item)
-- ==============================================================================
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

COMMENT ON TABLE public.item IS '任務/需求/決策等項目多態主表';
COMMENT ON COLUMN public.item.item_display_code IS '展示編號 (例如 PREFIX-101)';
COMMENT ON COLUMN public.item.parent_item_uid IS '樹狀父級 (Objective > Requirement > User Story > Task > UAT)';
COMMENT ON COLUMN public.item.relation_item_uid IS '單向關聯定義 JSONB [{item_uid, relation: blocks/covers/deploys/discusses/causes}]';

-- ==============================================================================
-- 5. 範本表 (template)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.template (
    template_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_uid UUID REFERENCES public.member(member_uid) ON DELETE SET NULL,
    template_name VARCHAR(255) NOT NULL,
    template_schema JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.template IS '預設專案與項目結構範本資料表';

-- ==============================================================================
-- 6. 自動更新 updated_at 觸發器函數 (Trigger Function)
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS trg_member_updated_at ON public.member;
CREATE TRIGGER trg_member_updated_at
BEFORE UPDATE ON public.member
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS trg_project_updated_at ON public.project;
CREATE TRIGGER trg_project_updated_at
BEFORE UPDATE ON public.project
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS trg_item_updated_at ON public.item;
CREATE TRIGGER trg_item_updated_at
BEFORE UPDATE ON public.item
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS trg_template_updated_at ON public.template;
CREATE TRIGGER trg_template_updated_at
BEFORE UPDATE ON public.template
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ==============================================================================
-- 7. 效能索引 (Performance Indexes)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_project_workspace ON public.project(related_workspace_uid);
CREATE INDEX IF NOT EXISTS idx_project_status ON public.project(project_status);
CREATE INDEX IF NOT EXISTS idx_item_project ON public.item(related_project_uid);
CREATE INDEX IF NOT EXISTS idx_item_workspace ON public.item(workspace_uid);
CREATE INDEX IF NOT EXISTS idx_item_type_status ON public.item(item_type, item_status);
CREATE INDEX IF NOT EXISTS idx_item_parent ON public.item(parent_item_uid);
CREATE INDEX IF NOT EXISTS idx_item_relation_gin ON public.item USING GIN (relation_item_uid);
