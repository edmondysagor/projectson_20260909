import { pool } from '../config/database';

const setupQueries = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables to recreate clean schema
DROP TABLE IF EXISTS traceability_matrix CASCADE;
DROP TABLE IF EXISTS project_plans CASCADE;
DROP TABLE IF EXISTS requirement_logs CASCADE;
DROP TABLE IF EXISTS charters CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS bottlenecks CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS chat_histories CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS knowledge_notes CASCADE;

-- Products Table (Foundation)
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    business_owner VARCHAR(255),
    tech_owner VARCHAR(255),
    product_vision TEXT,
    remarks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects Table (Foundation)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(100) REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    phase_number INT,
    status VARCHAR(50) NOT NULL DEFAULT '進行中',
    end_date TIMESTAMP WITH TIME ZONE,
    priority VARCHAR(50) NOT NULL DEFAULT 'Medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Meetings Table (Sprint 1)
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(100) REFERENCES products(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    meeting_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    recap_done BOOLEAN DEFAULT FALSE,
    summary TEXT,
    content TEXT NOT NULL,
    host VARCHAR(100),
    file_path VARCHAR(255),
    remarks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bottlenecks Table (Sprint 3)
CREATE TABLE IF NOT EXISTS bottlenecks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(50) DEFAULT 'Medium', -- High, Medium, Low
    status VARCHAR(50) DEFAULT '研究中', -- 研究中, 已解決
    remarks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tasks Table (Sprint 1)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(100) REFERENCES products(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'TODO',
    nature VARCHAR(50), -- 事件, 任務
    priority VARCHAR(50) DEFAULT 'Middle', -- High, Middle, Low
    urgency VARCHAR(50) DEFAULT '非緊急', -- 緊急, 非緊急
    due_date TIMESTAMP WITH TIME ZONE,
    related_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
    bottleneck_id UUID REFERENCES bottlenecks(id) ON DELETE SET NULL,
    reopen_count INT DEFAULT 0,
    assignees TEXT[] DEFAULT '{}',
    remarks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat Histories Table (Sprint 1 Buffer)
CREATE TABLE IF NOT EXISTS chat_histories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) NOT NULL,
    sender VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Charters Table (Sprint 2)
CREATE TABLE IF NOT EXISTS charters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    remarks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Requirement Logs Table (Sprint 2)
CREATE TABLE IF NOT EXISTS requirement_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'Functional',
    priority VARCHAR(50) DEFAULT 'Medium',
    status VARCHAR(50) DEFAULT 'DRAFT',
    remarks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project Plans / RACI Table (Sprint 3)
CREATE TABLE IF NOT EXISTS project_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    milestone_date TIMESTAMP WITH TIME ZONE,
    r_assignees TEXT[] DEFAULT '{}',
    a_assignees TEXT[] DEFAULT '{}',
    c_assignees TEXT[] DEFAULT '{}',
    i_assignees TEXT[] DEFAULT '{}',
    remarks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Traceability Matrix (Sprint 3)
CREATE TABLE IF NOT EXISTS traceability_matrix (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES requirement_logs(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_requirement_task UNIQUE (requirement_id, task_id)
);

-- Knowledge Notes Table (Sprint 3)
CREATE TABLE IF NOT EXISTS knowledge_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(100) REFERENCES products(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    term VARCHAR(255) UNIQUE NOT NULL,
    definition TEXT NOT NULL,
    kpi_formula TEXT,
    tag VARCHAR(100),
    url VARCHAR(255),
    status VARCHAR(50) DEFAULT 'INBOX', -- 完成, 封存, 進行中, INBOX
    remarks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

const seedQueries = `
-- Insert Seed Products
INSERT INTO products (id, name, business_owner, tech_owner, product_vision, remarks) VALUES 
('11111111-1111-1111-1111-111111111111', 'Project 神 B2B Core SaaS', 'Leo', 'Jeff', '成為企業內部的 AI Co-pilot 文件助理', '[]'::jsonb),
('PROD-TSS-DASHBOARD', 'True Self-service Dashboard', 'Eric (CED AM)', 'Paul', '成為全客運部門 (BUs) 與港口 (Ports) 對於「自助服務率 (TSS)」定義與數據呈現的單一事實來源 (Single Source of Truth)', '[{"timestamp":"2026-05-23T04:45:00.000Z", "user":"Edmond", "text":"產品順利完成 Phase 1 審計，目前正式進入 Phase 2 與萬年 BAU 雙軌並行。"}, {"timestamp":"2025-05-05T00:00:00.000Z", "user":"Eric", "text":"手動創建產品本體，準備爭取第一期 Funding。"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Insert Seed Projects (13 Projects from Screenshot)
INSERT INTO projects (id, product_id, name, type, phase_number, status, end_date, priority) VALUES 
('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-111111111111', 'QS PTS', 'Phase', 1, '進行中', NULL, 'High'),
('22222222-2222-2222-2222-000000000002', '11111111-1111-1111-1111-111111111111', 'Airport Performance DB', 'Phase', 1, '進行中', '2025-06-30T00:00:00Z', 'High'),
('22222222-2222-2222-2222-000000000003', '11111111-1111-1111-1111-111111111111', 'HKIA Self Service DB', 'Phase', 1, '進行中', NULL, 'Medium'),
('22222222-2222-2222-2222-000000000004', '11111111-1111-1111-1111-111111111111', 'Boarding Study', 'Phase', 1, '進行中', NULL, 'Low'),
('22222222-2222-2222-2222-000000000005', '11111111-1111-1111-1111-111111111111', 'CIS Migration to IODA', 'Phase', 1, '進行中', NULL, 'Low'),
('22222222-2222-2222-2222-000000000006', '11111111-1111-1111-1111-111111111111', 'Ad-hoc Analysis', 'Phase', 1, '進行中', NULL, 'Low'),
('22222222-2222-2222-2222-000000000007', '11111111-1111-1111-1111-111111111111', 'Baggage Report DB', 'Phase', 1, '未開始', NULL, 'Medium'),
('22222222-2222-2222-2222-000000000008', '11111111-1111-1111-1111-111111111111', 'HKIA ROS NRS data to IODA', 'Phase', 1, '未開始', NULL, 'Low'),
('22222222-2222-2222-2222-000000000009', 'PROD-TSS-DASHBOARD', 'Self Service DB (GAM)', 'Phase', 1, '未開始', NULL, 'Low'),
('22222222-2222-2222-2222-000000000010', '11111111-1111-1111-1111-111111111111', 'Waiver DB', 'Phase', 1, '未開始', NULL, 'Low'),
('22222222-2222-2222-2222-000000000011', '11111111-1111-1111-1111-111111111111', 'ADA Team Document', 'Phase', 1, '未開始', NULL, 'Low'),
('22222222-2222-2222-2222-000000000012', 'PROD-TSS-DASHBOARD', 'Self Service (Enhancement)', 'Phase', 1, '未開始', NULL, 'Low'),
('22222222-2222-2222-2222-000000000013', '11111111-1111-1111-1111-111111111111', 'Portable Water', 'Phase', 1, '未開始', NULL, 'Low');

-- Insert Seed Meetings
INSERT INTO meetings (id, product_id, project_id, title, meeting_date, recap_done, summary, content, host, file_path) VALUES
('44444444-4444-4444-4444-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000002', 'ADA x DGT Regular Meeting 20250526', '2025-05-26T10:00:00Z', TRUE, '定期進度與資料對接細節確認。', $$| 序號 | 討論事項 | 決議/行動方案 | 負責人 | 狀態 |
|---|---|---|---|---|
| 1 | 定期進度對齊 | DGT 已完成第一階段 API 開發，預計下周進行聯調測試。 | Leo | 進行中 |
| 2 | 分析器資料對接 | 確認底層分析器資料流向並對接完成，目前一切正常。 | Leo | 已完成 |$$, 'Leo', 'Regular_Meeting_Minutes_20250526.pdf'),
('44444444-4444-4444-4444-000000000002', '11111111-1111-1111-1111-111111111111', NULL, 'ADA Team Meeting 20250422', '2025-04-22T14:00:00Z', FALSE, '內部工作分配及流程優化討論。', '討論事項：內部周會記錄', 'Edmond', NULL),
('44444444-4444-4444-4444-000000000003', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000002', 'APT Perf Weekly meeting 20250416', '2025-04-16T11:00:00Z', TRUE, '例行週會，確認數據指標。', $$| 序號 | 討論事項 | 決議/行動方案 | 負責人 | 狀態 |
|---|---|---|---|---|
| 1 | 週度性能監控 | 例行確認延遲指標與資料連線，效能數據表現平穩。 | Leo | 已完成 |
| 2 | 數據口徑校準 | 與 BA 對齊數據計算口徑並完成系統邏輯校正。 | Jeff | 已完成 |$$, 'Leo', 'APT_Weekly_20250416.docx'),
('44444444-4444-4444-4444-000000000004', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000002', 'APT Perf Weekly meeting 20250407', '2025-04-07T11:00:00Z', FALSE, '討論本週數據表現及延遲問題。', '討論事項：延遲指標優化', 'Leo', NULL),
('44444444-4444-4444-4444-000000000005', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000002', 'APT Perf Weekly meeting 20250321', '2025-03-21T11:00:00Z', FALSE, '討論連線效能及優化清單。', '討論事項：資料庫連線池調優', 'Leo', NULL),
('44444444-4444-4444-4444-000000000006', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000002', 'APT Perf Weekly meeting 20250403', '2025-04-03T11:00:00Z', TRUE, '會議大綱：性能週會彙報。', $$| 序號 | 討論事項 | 決議/行動方案 | 負責人 | 狀態 |
|---|---|---|---|---|
| 1 | 性能週會彙報 | 性能報告大綱已歸檔至專案目錄，並供管理層審核。 | Leo | 已完成 |
| 2 | 里程碑 1 架構設計 | 經架構審查會討論，同意首期 WBS 資料庫模型與 RACI 分配。 | Edmond | 已完成 |$$, 'Leo', 'APT_Weekly_20250403.docx'),
('44444444-4444-4444-4444-000000000007', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000002', 'ADA x DGT Regular Meeting 20250319', '2025-03-19T10:00:00Z', TRUE, '雙方對接常規會議。', $$| 序號 | 討論事項 | 決議/行動方案 | 負責人 | 狀態 |
|---|---|---|---|---|
| 1 | 數據常規驗收 | 完成 3 月份對接數據驗收，雙方資料一致無落差。 | Leo | 已完成 |
| 2 | 安全通訊連線 | 啟用 SSL 連線池加密機制並建立 Neon 資料庫備份機制。 | Jeff | 已完成 |$$, 'Leo', 'Regular_Meeting_Minutes_20250319.pdf'),
('44444444-4444-4444-4444-000000000008', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000002', 'APT Perf BU meeting 20250319', '2025-03-19T15:00:00Z', TRUE, '業務單元主管會簽，同意第一期架構設計。', $$| 序號 | 討論事項 | 決議/行動方案 | 負責人 | 狀態 |
|---|---|---|---|---|
| 1 | 第一期架構簽核 | 各業務單位 (BUs) 主管會簽通過，正式同意第一期架構設計。 | Leo | 已完成 |
| 2 | 預算核准核發 | PMO 正式核發第一期預算，專案由研究中轉為進行中。 | PMO | 已完成 |$$, 'Leo', 'BU_Signoff_20250319.pdf'),
('44444444-4444-4444-4444-000000000009', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000002', 'APT Perf Shadowing Session 20250318', '2025-03-18T14:00:00Z', FALSE, '進行影子觀摩，釐清前台業務流動。', '討論事項：觀察前線BA操作流動', 'Leo', NULL),
('44444444-4444-4444-4444-000000000010', '11111111-1111-1111-1111-111111111111', NULL, 'ADA Team Meeting 20250318', '2025-03-18T09:00:00Z', FALSE, '內部工作交接及待辦清單清算。', '討論事項：對齊工作交付時程', 'Jeff', NULL),
('44444444-4444-4444-4444-000000000011', '11111111-1111-1111-1111-111111111111', NULL, 'ADA Team Weekly Catch-up', '2025-03-18T16:00:00Z', FALSE, '常規週會工作狀態同步。', '討論事項：本周進度大綱', 'Leo', NULL);

-- Insert Seed Bottlenecks
INSERT INTO bottlenecks (id, project_id, title, description, severity, status) VALUES
('88888888-8888-8888-8888-000000000001', '22222222-2222-2222-2222-000000000002', '.yxdb or .qvx ? Pick which', '對於 DGT 提供之分析器底層格式，應選擇 Alteryx 專用的 yxdb 或 Qlik 專用的 qvx 格式進行交換，待評估。', 'High', '研究中'),
('88888888-8888-8888-8888-000000000002', '22222222-2222-2222-2222-000000000002', 'Tableau Prep Data connection Issue', 'Tableau Prep 在對接 Neon DB Pooler 連線時發生連線逾時，限制了即時面板功能。', 'High', '已解決'),
('88888888-8888-8888-8888-000000000003', '22222222-2222-2222-2222-000000000002', 'QS license bulk request is turned down by DGT', 'DGT 基於資安政策回絕了大規模的 Qlik Sense 授權申請，影響前線 DA 存取權限。', 'Medium', '已解決'),
('88888888-8888-8888-8888-000000000004', '22222222-2222-2222-2222-000000000002', 'Baggage data in IODA issue', 'IODA 資料集內缺失行李輸送系統的即時標籤，影響數據關聯度。', 'Medium', '已解決');

-- Insert Seed Tasks (12 Tasks from Screenshot)
INSERT INTO tasks (id, product_id, project_id, title, description, status, nature, priority, urgency, due_date, related_meeting_id, bottleneck_id, assignees) VALUES
('33333333-3333-3333-3333-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000002', 'Line up meeting for suggestion', '與DGT團隊約會議，針對資料交換規格提出反饋與建議', 'TODO', '事件', 'High', '緊急', '2025-05-08T23:59:59Z', '44444444-4444-4444-4444-000000000001', '88888888-8888-8888-8888-000000000001', ARRAY['Leo']),
('33333333-3333-3333-3333-000000000002', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000012', 'Prepare the kick off meeting ma', '準備 Self Service 專案啟動會議材料（簡報與規格文件範本）', 'DONE', '任務', 'High', '緊急', '2025-05-21T23:59:59Z', NULL, NULL, ARRAY['Edmond', 'Antigravity']),
('33333333-3333-3333-3333-000000000003', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000007', 'Initiate Project with project char', '撰寫並發起行李系統數據庫分析專案章程，確認首期里程碑', 'IN_PROGRESS', '事件', 'High', '緊急', '2025-05-23T23:59:59Z', NULL, NULL, ARRAY['Jeff']),
('33333333-3333-3333-3333-000000000004', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000007', 'Refresh the "Traceability Matrix"', '更新需求追蹤對接矩陣，確保所有 FR 皆關聯至 SQL 表格', 'IN_PROGRESS', '任務', 'High', '緊急', '2025-05-23T23:59:59Z', NULL, NULL, ARRAY['Edmond']),
('33333333-3333-3333-3333-000000000005', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000007', 'Find the BU for confirming the h', '聯絡業務單位(BU)窗口確認手動上傳報表的真實欄位口徑與格式', 'IN_PROGRESS', '任務', 'High', '緊急', '2025-05-23T23:59:59Z', NULL, NULL, ARRAY['Edmond']),
('33333333-3333-3333-3333-000000000006', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000007', 'Read the data file in share point', '下載並閱讀 SharePoint 歸檔的歷史業務數據，準備進行清洗', 'DONE', '任務', 'High', '緊急', '2025-05-23T23:59:59Z', NULL, NULL, ARRAY['Antigravity']),
('33333333-3333-3333-3333-000000000007', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000006', 'MEL self service Pax process tir', 'MEL 自助客運流程效能及時間分析', 'TODO', '任務', 'Middle', '緊急', '2025-05-25T23:59:59Z', NULL, NULL, ARRAY['Jeff']),
('33333333-3333-3333-3333-000000000008', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000002', 'Contact DGT for "Load Factor A', '聯絡 DGT 獲取 Load Factor Analyzer 對接資料', 'TODO', '任務', 'High', '非緊急', '2025-04-20T23:59:59Z', '44444444-4444-4444-4444-000000000001', '88888888-8888-8888-8888-000000000001', ARRAY['Leo']),
('33333333-3333-3333-3333-000000000009', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000002', 'Apply QS license for users', '為開發小組申請 Qlik Sense 系統授權', 'DONE', '任務', 'High', '非緊急', '2025-05-21T23:59:59Z', NULL, '88888888-8888-8888-8888-000000000003', ARRAY['Leo']),
('33333333-3333-3333-3333-000000000010', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000006', 'Level D DT lounge acc', '提供 Level D Lounge 會員權限串接規格', 'IN_PROGRESS', '任務', 'High', '非緊急', '2025-05-23T23:59:59Z', NULL, NULL, ARRAY['Jeff']),
('33333333-3333-3333-3333-000000000011', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000013', 'Verify the portable water data t', '檢查飲用水系統歷史監測數值是否異常', 'IN_PROGRESS', '任務', 'Low', '非緊急', '2025-05-31T23:59:59Z', NULL, NULL, ARRAY['Edmond']),
('33333333-3333-3333-3333-000000000012', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000012', 'Prepare the meeting recap and', '撰寫啟動會議紀錄綱要，並向管理階層進行工作匯報準備', 'TODO', '任務', 'Middle', '非緊急', '2025-05-26T23:59:59Z', NULL, NULL, ARRAY['Edmond']);

-- Insert Seed Knowledge Notes (11 Notes from Screenshot)
INSERT INTO knowledge_notes (id, product_id, project_id, term, definition, tag, url, status, created_at) VALUES
('99999999-9999-9999-9999-000000000001', '11111111-1111-1111-1111-111111111111', NULL, 'Supplier management DB enquiry', '供應商管理數據庫查詢介面，包含廠商合規審核紀錄與服務等級評分。', NULL, NULL, '完成', '2025-03-24T11:51:00Z'),
('99999999-9999-9999-9999-000000000002', '11111111-1111-1111-1111-111111111111', NULL, 'Test note', '測試專用的筆記詞條，供快速驗證 Markdown 語法及文字溢出。', NULL, 'youtube.com/watch?v=12345', '完成', '2025-01-12T22:51:00Z'),
('99999999-9999-9999-9999-000000000003', '11111111-1111-1111-1111-111111111111', NULL, 'Data catalog', '數據資產目錄，索引企業內部現存的所有數據集、表格結構與負責人。', 'Digital Tool', 'cathay-pacific-airways-devportal.com', '封存', '2025-01-13T10:07:00Z'),
('99999999-9999-9999-9999-000000000004', '11111111-1111-1111-1111-111111111111', NULL, 'Self Service CHKIN DB comparison', '自助值機系統數據庫結構比對，對齊出境與入境表格的主鍵與欄位口徑。', NULL, NULL, '進行中', '2025-01-16T11:50:00Z'),
('99999999-9999-9999-9999-000000000005', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000007', 'Data Source Study', '針對行李系統主機日誌進行格式解析，評估是否能抽取即時輸送狀態。', NULL, NULL, '進行中', '2025-01-21T13:26:00Z'),
('99999999-9999-9999-9999-000000000006', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000004', 'Group Boarding Trial Date', '團體登機測試日期與實地觀摩時程表安排。', NULL, NULL, 'INBOX', '2025-01-27T09:50:00Z'),
('99999999-9999-9999-9999-000000000007', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000005', 'TSS rate DB - config', 'TSS 出境吞吐速率數據庫的配置連接與安全權限角色配置。', NULL, NULL, 'INBOX', '2025-02-24T16:29:00Z'),
('99999999-9999-9999-9999-000000000008', '11111111-1111-1111-1111-111111111111', NULL, 'Message from ICN manager', '首爾仁川機場經理發來的流程對接備忘錄，包含出發與到達的對齊規範。', NULL, NULL, 'INBOX', '2025-04-01T18:34:00Z'),
('99999999-9999-9999-9999-000000000009', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000007', 'Work file location path', '行李系統主機傳輸的臨時工作目錄與 SharePoint 映射連結路徑。', NULL, 'cathaypacificairways.sharepoint.com/teams/baggage', 'INBOX', '2025-04-14T14:17:00Z'),
('99999999-9999-9999-9999-000000000010', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-000000000012', 'TSS Concept Note', '出境流程概念白皮書，涉及安全檢查、海關申報與出境口自動化通道。', NULL, NULL, 'INBOX', '2025-04-22T22:14:00Z'),
('99999999-9999-9999-9999-000000000011', '11111111-1111-1111-1111-111111111111', NULL, 'CM data connect to real PII', '關於將 CM (Customer Management) 資料集連線至真實客戶識別資訊 (PII) 的脫敏合規標準。', NULL, NULL, 'INBOX', '2025-05-06T15:48:00Z');

-- Insert Seed Charter
INSERT INTO charters (id, project_id, title, content, remarks)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '22222222-2222-2222-2222-000000000002',
  'Airport Performance DB 專案章程 (Project Charter)',
  '{"goals": "為內部 PMO、BA 團隊開發一個 AI 驅動的專案文件自動化管理助理，減少 80% 的日常行政耗時。", "scope": "實現 meetings 與 tasks 的 AI 工具提取、HITL 審批流程、以及專案章程與需求基準自動生成。", "out_of_scope": "外部客戶登入入口與付費金流模組。", "w5h2": {"who": "PMO, BA, IT Developers", "why": "前線人員花費過多時間在行政填表與整理記錄上", "how": "React 4-Column Layout + Node.js Express + Neon DB + Gemini Agent", "what": "AI-Driven Project Document Assistant", "when": "2026年Q2發布", "where": "企業內部部署", "how_much": "預算為 CapEx 港幣五十萬"}}'::jsonb,
  '[{"timestamp":"2025-05-25T09:00:00.000Z", "user":"Edmond", "text":"專案章程初始草稿"}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Insert Seed Requirement
INSERT INTO requirement_logs (id, project_id, title, description, category, priority, status, remarks)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '22222222-2222-2222-2222-000000000002',
  'FR-01: AI 會議記錄自動提取任務',
  '用戶只需發送會議紀錄，AI Agent 便能識別出行動點，生成新增/修改任務的變更提案並提交給用戶審批。',
  'Functional',
  'Must',
  'APPROVED',
  '[{"timestamp":"2025-05-25T09:00:00.000Z", "user":"Edmond", "text":"基準需求導入"}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Insert Seed Project Plan (RACI)
INSERT INTO project_plans (id, project_id, title, description, milestone_date, r_assignees, a_assignees, c_assignees, i_assignees, remarks)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  '22222222-2222-2222-2222-000000000002',
  '里程碑 WBS 1: 核心架構打通',
  '建立 10 張數據表格，實現 Execution, Baseline 與 Knowledge Agent 機制。',
  '2025-06-30T00:00:00Z',
  ARRAY['Antigravity'],
  ARRAY['Edmond'],
  ARRAY['BA'],
  ARRAY['PMO'],
  '[{"timestamp":"2025-05-25T09:00:00.000Z", "user":"Edmond", "text":"設定 RACI 權責劃分"}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Insert Seed Traceability
INSERT INTO traceability_matrix (project_id, requirement_id, task_id)
VALUES (
  '22222222-2222-2222-2222-000000000002',
  '66666666-6666-6666-6666-666666666666',
  '33333333-3333-3333-3333-000000000001'
)
ON CONFLICT DO NOTHING;
`;

async function main() {
  console.log('Initializing database tables for Sprint 3 (Notion-Aligned Schema)...');
  try {
    await pool.query(setupQueries);
    console.log('Sprint 3 tables initialized successfully.');
    
    console.log('Seeding initial records for Sprint 3 (Notion-Aligned Data)...');
    await pool.query(seedQueries);
    console.log('Sprint 3 seeding completed successfully.');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await pool.end();
  }
}

main();
