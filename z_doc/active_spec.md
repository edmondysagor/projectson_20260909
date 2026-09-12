# 📋 Projectson 核心系統規格書 (Active System Specification)

> **版本**：v1.0 (Frozen & Aligned)  
> **更新日期**：2026-09-10  
> **系統定位**：結合 Jira 追蹤能力、Notion 區塊編輯體感、Monday.com 矩陣表格與 Google OKF (Open Knowledge Format) 雙時態知識圖譜的現代化專案管理中樞。  
> **核心技術棧**：Cloudflare Pages (Frontend / React / Vite / BlockNote) + Google Cloud Run (Backend / Node.js Express / TS) + Neon PostgreSQL (Serverless Pooler / pgvector) + Cloudflare R2。

---

## 1. 業務需求與核心用戶旅程 (User Journey & UI Lifecycle)

### 1.1 側邊欄與工作區導航 (Sidebar & Workspace)
- **結構**：最頂部為 `Workspace`（含三點選單：新增、重新命名、刪除工作區；下方 Dropdown 可切換已加入的 Workspace）。
- **過濾機制**：切換 Workspace 後，全站視圖僅過濾並呈現該 Workspace 內容。
- **導航項目**：
  - `Product`（產品矩陣視圖）
  - `Project`（專案矩陣視圖）
  - `All Item`（全量項目視圖）
  - `Workspace Member`（工作區成員權限管理）

### 1.2 主內容區表格視圖 (Table View & Quick Control)
- **頂部工具列**：搜尋欄 (Search input)、Filter、Sort、Hide Columns、Group By、View 切換（Table / Info Card / Kanban / Timeline / Calendar）。
- **表格核心特性**：
  - 欄寬支援拖曳調整。
  - 視窗上下左右自由滾動 (Scrollable Container)。
  - 外部「+ 新增」按鈕：點擊後在頂部展開 Input Bar 輸入名稱，按 Save 即時寫入資料庫並配號。
  - **就地編輯 (Inline Edit)**：
    - 文字欄位：點擊進入編輯模式，尾部帶「剔號（保存）」與「交叉（還原）」，支援 Enter 保存、Esc / 點擊外部保存。
    - 日期欄位：點擊彈出 Datepicker 日曆選擇。
    - 下拉選項 (Option)：點擊展開 Select，選中立即 PATCH 寫入。
    - 關聯/成員欄位：支援 Searchable Select，找不到即時呼叫 Auto-provision Member 寫入。
    - **Display Code 為整行唯一進入詳細抽屜 (Drawer) 的超連結**。

### 1.3 抽屜詳細視圖 (Drawer View)
- 點擊 Display Code 後，由右向左滑出展開。
- **左側主要內容區**：
  - Display Code 標籤。
  - 標題 (就地編輯)。
  - **富文本內容 (Content)**：採用 **BlockNote** 編輯器，以 `JSONB` 原生區塊結構存儲，支援圖片即時上傳 Cloudflare R2。點擊下方 Save / Cancel 進行保存或還原。
  - **Traceability 矩陣 (5層鏈條)**：`Objective > Requirement > User Story > Task > UAT`（Multi-level Row Span 引擎，支援 Drag & Drop 跨列拖曳、缺級以佔位卡片呈現、卡片一鍵 `+` 建立子項）。
  - **Updates & Deployment 矩陣**：基於 `Deployment` 與 `User Story` 的關聯（`deploys` / `is deployed`），同樣以 Multi-level Row Span 展現。
  - **Jira 風格評論系統 (Comments)**：存入 `item_comment JSONB`，支援輸入、即時發表、編輯與時間戳顯示。
- **右側元數據邊欄 (Metadata Sidebar)**：
  - Workspace、Owner、Status、Priority、Members、Created At、Updated At 等屬性卡片。

---

## 2. 資料庫規範 (Neon PostgreSQL Schema)

參照已同步至 Neon DB (`.env.development` & `.env.production`) 的 [schema.sql](file:///Users/edmondchan/Documents/文件%20-%20Edmond的MacBook%20Air/Local%20Mac/AI/AI%20Project/AI%20Project%20Doc%20Manager/20260909%20Projectson/backend/database/schema.sql)：

1. **`workspace`**：
   - `workspace_uid` (UUID PK)
   - `prefix_code` (VARCHAR UNIQUE, 全域唯一前綴)
   - `workspace_name` (VARCHAR)
   - `last_item_number` (INT, 序號自增計數器)
   - `last_project_number` (INT, 序號自增計數器)
   - `allow_access_member` (JSONB)
2. **`member`**：
   - `member_uid` (UUID PK)
   - `member_name`, `member_email` (UNIQUE), `member_ad_group`, `member_status`
3. **`project`**：
   - `project_uid` (UUID PK)
   - `project_display_code` (例如 `PRJ-PRO-1`)
   - `project_number` (INT)
   - `project_type` ('Product' | 'Project')
   - `project_sub_type` ('Phase' | 'BAU', 僅 Project 適用)
   - `project_status` ('Pipeline' | 'Active' | 'On Hold' | 'Completed' | 'Abandoned')
   - `project_content` (JSONB, BlockNote 結構)
   - `allow_access_member` (JSONB)
4. **`item`**：
   - `item_uid` (UUID PK)
   - `item_display_code` (例如 `PRJ-101`)
   - `item_type` (16種多態枚舉，包含 Charter, Epic, Task, Meeting, Bottleneck, Decision 等)
   - `item_status` (8種狀態)
   - `item_priority` ('High' | 'Middle' | 'Low')
   - `parent_item_uid` (樹狀外鍵，支撐 Traceability)
   - `relation_item_uid` (JSONB, 單向存儲、雙向呈現：`blocks`, `covers`, `deploys`, `discusses`, `causes`)
   - `item_content` (JSONB), `item_comment` (JSONB)
5. **`template`**：
   - `template_uid`, `template_name`, `template_schema` (JSONB)

---

## 3. 變更追蹤與 Google OKF 知識庫演化架構 (AI Synchronization)

1. **變更監聽 (Zero-Token Change Tracking)**：
   - 移除過度設計的 `update_log` JSONB，全系統統一採用 PostgreSQL 原生觸發器維護的 **`updated_at` (TIMESTAMPTZ)** 作為唯一變更依據。
   - 日常就地編輯操作耗費 **0 Token**，毫秒級存檔。
2. **知識庫同步觸發 (OKF Sync Trigger)**：
   - **手動一鍵同步 (On-Demand)**：用戶點擊「同步專案知識庫」按鈕，系統查詢 `updated_at > last_synced_at` 的實質項目。
   - **狀態結案觸發 (Lifecycle Event)**：當 `Decision` 完成或 `Bottleneck` 標記 Closed 時，後端背景非同步將精準結論同步至 OKF 概念圖譜。
3. **成本與規模化優化**：
   - 樹狀關係與阻礙依賴直接由代碼 Mapping 為 OKF Links，無需大模型推理邊關係（$0）。
   - 切片段落僅採用輕量級 DashScope 768-dim 向量化，幾千人規模下每日成本低於 $0.2 USD。

---

## 4. AI Copilot 雙欄提案畫布 (Proposal Canvas & Review Studio)

### 4.1 雙欄空間佈局 (Dual-Panel Responsive Layout)
* **默認對話狀態**：Copilot 抽屜固定寬度為 `420px`（專注日常問答與即時進度查詢）。
* **提案觸發狀態**：當 AI 提出結構性變更（例如 PRD 拆解、多工單批量建立或屬性批量調整）時，抽屜向左平滑動畫展開至 **`880px`**：
  * **左欄 (`360px`)**：Copilot Chat（對話歷史、模型切換、思考模式開關、修正意見輸入）。
  * **右欄 (`520px`)**：Proposal Canvas 工作台（結構化卡片清單、逐項審批、就地微調、樹狀階層預覽）。
* **套用後收合**：用戶點擊「套用已選項目」成功或關閉 Canvas 後，抽屜自動平滑收合回 `420px`。

### 4.2 逐項審批矩陣 (Granular Checklist & Inline Edit)
* **獨立項目卡片**：
  * 每筆建議項目均包含：`[類型 Badge]`、`標題`、`負責人`、`優先級`、`狀態`、`父工單關聯`。
  * 操作開關：**`☑️ Approve (核准)`** / **`❌ Skip (略過)`**。
  * **就地微調 (Inline Edit)**：用戶可直接在 Canvas 上點擊修改標題、下拉切換指派人或調整優先級，無需讓 AI 重新生成。
  * **反饋微調環 (Refine Loop)**：點擊單項「💬 反饋」，指令自動載入左側 Chat Box 進行精準二次生成。
* **底部匯總控制列**：
  * 顯示「已選取 X / Y 項」動態計數 Badge。
  * 提供「全部勾選 / 全部取消」捷徑。
  * 提供「✅ 套用已核准項目 (Apply Selected)」按鈕。

---

## 5. AI 寫入防護守則與原子批次交易 (AI Write Governance & Batch API)

### 5.1 原子交易批次寫入端點 (`POST /api/items/batch`)
* **契約定義**：
  * `items`: Array of items to create/update.
  * 請求由後端 `client.query('BEGIN') ... client.query('COMMIT')` 包裹在單一 PostgreSQL Transaction 內。
  * **原子序號鎖定**：自動於 `public.workspace` 以行級排他鎖分配連續的 `item_number`，若中途任何一筆校驗失敗，全體自動 `ROLLBACK`，保證資料庫序號與關聯 100% 乾淨一致。

### 5.2 嚴格的寫入防護與留痕規則 (Safety Guardrails)
1. **Description 絕對保護 (No Blind Overwrite)**：
   * AI **嚴禁覆蓋** 現有工單的 BlockNote `item_content` 描述，防止用戶原創文案被抹除。
2. **自動審計 Comment 留痕 (Audit Trail)**：
   * 每次 AI 套用新建或更新，系統自動在 `item_comment` 插入一條不可篡改的系統審計記錄：
     > `🤖 [AI Copilot 變更記錄]：已依據用戶指令建立此工單並關聯至 [TTG-2]`
3. **物理刪除絕對禁止 (No Hard Delete)**：
   * 後端 API 拒絕 AI 發起物理刪除操作，AI 僅能建議「標記為 Abandoned/廢棄」。
4. **5 層 Traceability 層級約束**：
   * 嚴格限制 `Objective > Requirement > User Story > Task > UAT` 方向，防止倒掛。

---

## 6. AI 對話歷史持久化 (Chat History & Session Management)

### 6.1 資料庫表結構
* `public.copilot_sessions`: `session_uid`, `workspace_uid`, `project_uid`, `member_uid`, `session_title`, `created_at`, `updated_at`。
* `public.copilot_messages`: `message_uid`, `session_uid`, `sender`, `message_text`, `reasoning_content`, `action_preview`, `created_at`。

### 6.2 前端會話管理
* Copilot 抽屜頂部提供「➕ 新對話 (New Chat)」與「🕒 歷史對話列表」。
* 切換專案或工作區時自動加載對應的歷史討論，重整頁面不丟失記憶。

