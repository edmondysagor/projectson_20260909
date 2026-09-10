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
