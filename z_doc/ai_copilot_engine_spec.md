# Projectson AI Copilot 雙軌讀寫引擎架構與資料庫調度規範 (AI Copilot Engine Spec)

> **版本**：v1.0  
> **建立日期**：2026-09-12  
> **狀態**：正式生效 (Active)  
> **適用範圍**：後端 `backend/src/routes/copilot.ts`、`backend/src/routes/items.ts` 與 前端 `CopilotDrawer.tsx`、`ProposalCanvas.tsx`。

---

## 📖 1. 核心理念與雙軌架構概覽 (Dual-Track Architecture)

Projectson Actionable AI Copilot 採用 **「Schema-Aware Tool Calling + 專屬 Def 工具庫 + 唯讀 SQL 沙盒」** 的精確讀取機制，以及 **「Action DSL + 雙面板 Proposal Canvas 審批 + 後端原子事務」** 的高安全寫入治理體系。

```
                              ┌───────────────────────────┐
                              │    User Prompt 用戶指令   │
                              └─────────────┬─────────────┘
                                            │
                                            ▼
                          ┌───────────────────────────────────┐
                          │    AI Copilot 大腦決策中心        │
                          │ (Schema-Aware + Thinking Mode CoT)│
                          └─────────────┬─────────────────────┘
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           ▼                                                         ▼
   【READ 讀取防線 (0 副作用)】                              【WRITE 寫入防線 (人機協同審批)】
   -----------------------------------------                 -----------------------------------------
   1. 靜態基礎 Context 預載 (Workspace + Projects + Members)   1. 嚴禁 Direct Raw Write (無 UPDATE/DELETE)
   2. 語義專屬 Def 工具 (`get_workspace_overview` 等)          2. 生成標準結構化 `<<ACTION>>` JSON 標籤
   3. 動態唯讀 SQL 沙盒 (`execute_read_only_sql`)              3. 前端觸發 880px Dual-Panel Proposal Canvas
      - 限制 SELECT 查詢                                      4. 用戶即時行內編輯、核准勾選
      - `BEGIN READ ONLY` 事務保護                            5. 點擊套用 ➔ 後端原子事務批次寫入 (`/api/items/batch`)
      - 3000ms 執行超時防護                                    6. 自動注入不可逆審計日誌 (`🤖 AI Copilot Audit`)
```

---

## 🗄️ 2. 公開予 AI 之 Neon PostgreSQL DDL Schema

AI Copilot 獲悉系統 5 大核心資料表的結構與關聯性：

### 2.1 `public.workspace` (工作區總表)
```sql
CREATE TABLE public.workspace (
    workspace_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefix_code VARCHAR(10) UNIQUE NOT NULL,      -- 例: 'TTG'
    workspace_name VARCHAR(255) NOT NULL,        -- 例: 'Testing'
    last_project_number INT DEFAULT 0,            -- 專案流水號計數器
    last_item_number INT DEFAULT 0,               -- 工單流水號計數器
    allow_access_member JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 `public.project` (專案/產品表)
```sql
CREATE TABLE public.project (
    project_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_display_code VARCHAR(30) UNIQUE NOT NULL, -- 例: 'TTG-PRO-2'
    project_number INT NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    project_type VARCHAR(50) NOT NULL,                -- 'Product' | 'Project'
    project_sub_type VARCHAR(50),                     -- 'Phase' | 'BAU'
    project_status VARCHAR(50) DEFAULT 'Active',      -- 'Pipeline' | 'Active' | 'On Hold' | 'Completed' | 'Abandoned'
    related_workspace_uid UUID REFERENCES public.workspace(workspace_uid),
    project_owner UUID REFERENCES public.member(member_uid),
    planned_start_date DATE,
    planned_end_date DATE,
    project_content JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### 2.3 `public.item` (多態工單與追溯實體表)
```sql
CREATE TABLE public.item (
    item_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_display_code VARCHAR(50) UNIQUE NOT NULL,    -- 例: 'TTG-12'
    prefix_code VARCHAR(20) NOT NULL,
    item_number INT NOT NULL,
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
    item_content JSONB DEFAULT '{}' NOT NULL,         -- BlockNote 區塊描述 (受保護防覆蓋)
    item_comment JSONB DEFAULT '[]' NOT NULL,         -- Jira 評論與 AI 審計日誌
    parent_item_uid UUID REFERENCES public.item(item_uid) ON DELETE SET NULL,
    relation_item_uid JSONB DEFAULT '[]' NOT NULL,    -- 單向關聯 (blocks, covers, deploys, discusses, causes)
    item_attribute JSONB DEFAULT '{}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### 2.4 `public.member` (團隊成員表)
```sql
CREATE TABLE public.member (
    member_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_name VARCHAR(255) NOT NULL,
    member_email VARCHAR(255) UNIQUE,
    member_ad_group VARCHAR(100),
    member_status VARCHAR(50) DEFAULT 'Active'
);
```

### 2.5 `public.okf_sources` (專案知識庫與文件來源表)
```sql
CREATE TABLE public.okf_sources (
    source_uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_uid UUID REFERENCES public.workspace(workspace_uid),
    project_uid UUID REFERENCES public.project(project_uid),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    page_count INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🛠️ 3. Read Database Def 工具集定義 (Read Defs)

後端向 LLM 提供以下標準 Tool 定義（相容 OpenAI Function Calling / DashScope 規範）：

| 工具名稱 | 參數 (Arguments) | 功能描述 |
| :--- | :--- | :--- |
| `get_workspace_overview` | `workspace_uid: string` | 獲取當前工作區名稱、前綴、底下所有 Projects 清單（含 UID、Display Code、狀態、Owner）、成員總數與工單總數。 |
| `list_projects` | `workspace_uid: string, project_type?: string, project_status?: string` | 檢索指定條件的專案清單，返回名稱、代碼、負責人、排期與子類型 (Phase/BAU)。 |
| `search_items` | `workspace_uid: string, project_uid?: string, item_type?: string, item_status?: string, item_priority?: string, assignee_name?: string, keyword?: string, limit?: number` | 多維度精準過濾工單清單，支援 16 種合法 item_type（Objective/Requirement/User story/Task/UAT/Bug/Decision/Information/Bottleneck 等）及 8 種 item_status。 |
| `get_item_detail` | `item_key: string` (UID 或 Display Code 如 'TTG-12') | 獲取單張工單完整資料，包含子工單、被誰 Block / 被誰 Deploy 的雙向關係推導與評論記錄。 |
| `get_project_traceability` | `project_uid: string` | 提取專案自頂向下 `Objective -> Requirement -> User story -> Task -> UAT` 的階層追溯樹。 |
| `execute_read_only_sql` | `sql_query: string, rationale?: string` | **動態唯讀 SQL 沙盒**：執行自訂 `SELECT` 或 `WITH` 查詢，強制於 `BEGIN READ ONLY` 事務中執行，阻斷任何寫入關鍵字。 |

---

## 🔒 4. 唯讀 SQL 沙盒安全防護規範 (Read-Only SQL Sandbox)

當 AI 調用 `execute_read_only_sql` 時，後端執行以下防禦：

1. **關鍵字前置檢查 (AST / Regex Guard)**：
   - 語句開頭必須為 `SELECT` 或 `WITH`。
   - 嚴格攔截任何寫入或 DDL 關鍵字：`INSERT`、`UPDATE`、`DELETE`、`DROP`、`ALTER`、`TRUNCATE`、`CREATE`、`REPLACE`、`GRANT`、`REVOKE`、`EXEC`。
2. **PostgreSQL 引擎級唯讀鎖定**：
   ```sql
   BEGIN READ ONLY;
   SET LOCAL statement_timeout = '3000ms'; -- 3 秒超時保護，防止慢查詢鎖表
   <USER_QUERY>;
   COMMIT;
   ```
3. **資料筆數限制 (Pagination Safeguard)**：
   - 查詢預設強制注入或截斷至 `LIMIT 100`，防止大資料溢出記憶體。

---

## ✍️ 5. Write Database 寫入規則與 Proposal Canvas 工作台

### 5.1 寫入四大鐵律
1. **嚴禁 Direct Raw Write 與 No Hard Delete**：AI 絕不直接執行寫入 SQL，且無權物理刪除任何資料表列。若用戶提出刪除需求，AI 自動引導轉換為 `Closed`（已作廢）狀態並送交 Canvas 審批。
2. **標準化 Action DSL 標籤**：
   - **單項建立**：`<<ACTION>>{"actionType":"create_item", "itemType":"Task", "itemTitle":"...", "parentItemUid":"..."}<<ACTION>>`
   - **單項更新/指派**：`<<ACTION>>{"actionType":"update_item", "targetDisplayCode":"TTG-12", "updates":{"item_follow_by":"Edmond", "item_status":"In Progress"}, "summary":"指派給 Edmond"}<<ACTION>>`
   - **批量提案**：`<<ACTION>>{"actionType":"batch_proposal", "proposalTitle":"...", "items":[...]}<<ACTION>>`
3. **880px 雙面板 Proposal Canvas (Human-in-the-loop 審核)**：
   - AI 提出方案 ➔ 抽屜平滑展開至 900px（左側 380px 對話 + 右側 520px Proposal Canvas）。
   - 用戶逐項勾選 (`☑️ Approve` / `❌ Skip`)、即時修改標題、切換優先級、指定成員或新增自訂項目。
4. **後端原子事務與不可逆審計日誌 (`POST /api/items/batch`)**：
   - 行級鎖定 `public.workspace` 自增流水號，保證連續有序之 `PREFIX-X` 代碼。
   - 自動在 `item_comment` 寫入不可篡改的審計日誌：`🤖 [AI Copilot 批量生成記錄]：依據需求提案批次建立工單 [PREFIX-X]`。

### 5.2 BlockNote JSON 結構正規化防禦 (JSON Normalizer)
為杜絕 AI 輸出非標準格式導致前端 BlockNote 編輯器白屏崩潰：
1. **結構規範**：`item_content` 與 `project_content` 統一受 `normalizeItemContent` 保護，支援陣列、純文字自動打包為標準 Paragraph Block。
2. **容錯欄位解析**：成員名稱 (如 `"Edmond"`) 自動對齊 `member_uid`，父工單 Display Code (如 `"TTG-2"`) 自動對齊 `parent_item_uid`。
3. **狀態/類型容錯正規化**：`normalizeItemStatus` 與 `normalizeItemType` 自動將自然語言字眼（如 `Cancelled` -> `Closed`, `Done` -> `Completed`）對齊 8 大合法狀態與 16 大合法類型。

### 5.3 對話共識沉澱機制 (Dialogue Consensus & Distillation)
1. **觸發條件**：當對話達成重要共識，AI 輸出 `consensus_proposal` Action 標籤。
2. **確認入庫**：用戶於對話框點擊「📌 沉澱至專案知識庫」，調用 `POST /api/copilot/consensus`：
   - 原子建立一條 Completed 狀態之 `💡 Decision` 工單。
   - 同步寫入 `public.okf_concepts`（`concept_name`, `concept_type = 'Decision'`, `concept_description`）。

---

## 🔄 6. 多模型切換與深度思考 (Multi-Model & Reasoning CoT)

1. **支援模型**：
   - `⚡ Qwen 3.8 Flash`（極速輕量，預設日常對話）
   - `🚀 Qwen 2.5 Plus`（高智商主力，推薦用於複雜需求拆分與 Tool Calling）
   - `🧠 Qwen Max`（旗艦推演）
   - `🔮 DeepSeek V3`（通用開源推理）
   - `🎯 DeepSeek R1`（深度長思維鏈推理）
2. **思維鏈透明化 (Thinking Mode)**：
   - 開啟後，AI 在輸出結論前必須將推演過程置於 `<think>...</think>` 標籤內。
   - 前端自動解析為紫色專屬摺疊卡片 `🧠 深度思考過程 (Reasoning Process)`，保證邏輯透明可追溯。

