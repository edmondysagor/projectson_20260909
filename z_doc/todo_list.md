# Projectson 系統重構與開發待辦清單 (TODO List)

> **目標**：從零打造新一代企業級全棧專案管理中樞（Cloudflare Pages + Google Cloud Run + Neon PostgreSQL + Cloudflare R2），深度融合 Jira 追蹤能力、Notion 區塊編輯體感、Monday.com 矩陣表格與 Google OKF (Open Knowledge Format) 雙時態知識圖譜。
> **規格標準依據**：`z_doc/requirement.pdf` 與 `z_doc/active_spec.md`。

---

## 📌 Phase 1: 資料庫與後端核心業務 API (Database & Backend Core)
- [x] **1.1 資料庫架構設計與同步 (Neon DB Schema & Migration)**
  - [x] 設計標準五大核心表：`workspace`, `member`, `project`, `item`, `template`
  - [x] 納入 `Decision` 為原生項目類型，移除冗餘 `update_log`，全權依靠 `updated_at` 觸發器維護
  - [x] 配置 `relation_item_uid`（單向存儲、雙向呈現）與 GIN 索引
  - [x] 成功同步 DDL 至 Neon DB `development` 與 `production` (Singapore `ap-southeast-1`)
- [x] **1.2 後端業務模組開發 (Google Cloud Run API Routes)**
  - [x] **Workspaces API (`/api/workspaces`)**：
    - CRUD、名稱重複/前綴代碼全域唯一校驗
    - 流水號自增原子計數器（`last_project_number`, `last_item_number`）
    - 成員存取清單 (`allow_access_member`) 管理
  - [x] **Members API (`/api/members`)**：
    - 成員查詢與 Auto-provision（輸入未註冊成員自動建檔）
  - [x] **Projects API (`/api/projects`)**：
    - 專案/產品 CRUD，自動編號生成（`PREFIX-PRO-X`）
    - `project_type` ('Product'/'Project') 與 `project_sub_type` ('Phase'/'BAU') 約束校驗
    - Notion 區塊結構 `project_content` 更新
  - [x] **Items API (`/api/items`)**：
    - 多態項目 CRUD，自動編號生成（`PREFIX-X`）
    - 支援文字、狀態、排期、負責人就地 PATCH 局部更新
    - 樹狀父子關係維護（`parent_item_uid`）
    - 單向關係讀寫與雙向反向關聯動態推導（`blocks` / `is blocked by`）
    - 評論系統 CRUD（`item_comment` JSONB）
- [x] **1.3 種子資料與端到端驗證 (Seed Data & API Testing)**
  - [x] 注入真實專案示範資料（如 Airport Self-Service 專案、成員、Traceability 範例鏈）
  - [x] 驗證各 API 端點運作正常與錯誤攔截

---

## 📌 Phase 2: 前端核心 UI 佈局與就地編輯 (Frontend Core & Inline Editing)
- [x] **2.1 前端工程基礎升級**
  - [x] 升級安裝 Lucide React 圖標庫與必要 UI 依賴
  - [x] 封裝統一 API Client (`frontend/src/utils/api.ts`)
- [x] **2.2 側邊欄與工作區導航 (Sidebar Component)**
  - [x] 工作區標題 3-dot 選單（Add new workspace, Rename workspace, Delete workspace 模態窗）
  - [x] 工作區切換下拉選單（切換後全站過濾該 Workspace）
  - [x] 導航選單：`Product`, `Project`, `All Item`, `Workspace Member`
- [x] **2.3 現代化主表格視圖 (Advanced Table View)**
  - [x] 頂部工具列：Search Input、Filter (Type / Status)、View 切換器
  - [x] 表格外框自適應視窗高度，支援上下左右雙向流暢捲動 (Scrollable)
  - [x] 頂部「+ 新增」按鈕：展開就地快速輸入 Bar，即時配號寫入
- [x] **2.4 全站就地編輯微交互 (Inline Editing Engine)**
  - [x] 文字欄位：點擊轉為輸入框，尾部顯示「剔號（保存）」與「交叉（取消）」，支援 Enter 保存、Esc 還原、點擊外部自動保存
  - [x] 日期欄位：點擊彈出 Datepicker 日曆選擇器
  - [x] 下拉選項 (Option)：點擊展開 Select，選中立即 PATCH
  - [x] 成員/關聯：Searchable Select，找不到即時呼叫 Auto-provision
  - [x] **Display Code 作為整行唯一進入抽屜 (Drawer) 的超連結**
- [x] **2.5 滑出式抽屜視圖初版 (Slide-over Drawer V1)**
  - [x] 點擊 Display Code 由右向左滑出，展示項目詳情、內容描述、雙向拓撲與 Jira 評論
  - [x] 標題與文案就地編輯，屬性面板即時 PATCH

---

## 📌 Phase 3: 抽屜視圖、矩陣引擎與富文本 (Drawer, Matrix Engine & BlockNote)
- [ ] **3.1 BlockNote 富文本編輯器深度整合**
  - [ ] 整合 BlockNote 區塊編輯器於 Product/Project/Item Content
  - [ ] 底部配置「Save」與「Cancel」按鈕，支援就地保存與還原
  - [ ] 圖片上傳 Cloudflare R2 支援
- [ ] **3.2 Multi-Level Row Span Table 引擎**
  - [ ] **Traceability 鏈**：`Objective > Requirement > User Story > Task > UAT`（5 層樹狀 Row Span 合併）
  - [ ] **Updates & Deployment 鏈**：`Deployment` 與 `User Story` 關聯之雙向 Row Span 展開
  - [ ] 支援卡片上「+」號快速彈出搜尋/創建附屬項目
  - [ ] 支援拖曳 (Drag & Drop) 變更父子或關聯關係
  - [ ] 支援直接在卡片上點擊下拉選單快速變更 Status
- [ ] **3.3 Jira 式評論系統增強 (Comments Component)**
  - [ ] 支援新增評論、多層回覆展示、編輯與時間戳顯示，同步存入 `item_comment`

---

## 📌 Phase 4: Google OKF + Graph RAG 知識庫搭建 (Multi-source Knowledge Base)
- [x] **4.1 OKF 資料表設計 (OKF Schema & pgvector)**
  - [x] 啟用 `vector` 擴展，建立 `okf_sources`, `okf_chunks` (pgvector 768-dim 餘弦索引), `okf_concepts`, `okf_links`
  - [x] 配置 `ON DELETE CASCADE` 級聯刪除外鍵防護
- [x] **4.2 知識來源管理與 NotebookLM 風格 UI (Sources Hub)**
  - [x] 後端 `/api/sources` CRUD API 實裝與 Markdown 輕量分塊
  - [x] 前端 `ProjectDetailView` 新增 `📁 知識文件 (Sources)` Tab
  - [x] Google NotebookLM 風格來源卡片庫、拖放上傳區、共用切換與引用開關 (Source Toggles)
- [ ] **4.3 混合檢索架構 (Hybrid Graph Retrieval)**
  - [ ] 階段 1：pgvector 768-dim 向量粗篩
  - [ ] 階段 2：`okf_links` 拓撲 1-Hop 概念擴展
  - [ ] 階段 3：阿里雲 `gte-rerank` 精準重排 Top 5

---

## 📌 Phase 5: Actionable AI Copilot、多模型與認知減負 (Agentic Copilot & Cognitive Hub)
- [x] **5.1 全域 Actionable Copilot 抽屜與 Tool Calling (Action Agent V1)**
  - [x] 前端常駐紫色漸變 `✨ AI Copilot` 懸浮按鈕與滑出式抽屜 (`CopilotDrawer.tsx`)
  - [x] 後端 `/api/copilot/chat` 注入 Neon DB Ground Truth 即時工單與知識來源 Context
  - [x] Action Preview 工單操作預覽卡片與「一鍵套用至專案 (Apply)」
- [x] **5.2 工單指派、狀態更新與雙軌標識容錯 (Defensive Execution & Live Sync)**
  - [x] 後端支援 `item_display_code` (如 `TTG-12`) 與 `item_uid` 雙重更新匹配
  - [x] 後端注入 `members` 名單並支援成員姓名 (如 `Edmond`) 自動解析轉換為 `member_uid`
  - [x] 前端派發 `projectson_item_updated` 全域事件，即時聯動刷新已開啟的 `ItemDrawer`
- [x] **5.3 多模型切換與 Thinking Mode (Model Switcher & Deep Reasoning)**
  - [x] 前端頂部支援 Qwen 3.8 Flash / Qwen 2.5 Plus / Qwen Max / DeepSeek V3 / DeepSeek R1 下拉選單
  - [x] 前端提供 `🧠 深度思考模式` 開關與思考過程可摺疊展開卡片
  - [x] 後端支援動態調度指定模型與 CoT `<think>...</think>` 思維鏈解析
- [x] **5.4 AI Copilot 提案審核工作台 (880px Dual-Panel Proposal Canvas) 與原子批次寫入**
  - [x] 後端實裝 `POST /api/items/batch`（PostgreSQL 事務鎖定與連續序號生成、容錯成員/父代碼解析、不可逆審計紀錄）
  - [x] 前端實裝 `ProposalCanvas.tsx`（逐項審核、全選切換、即時行內編輯、指派成員、自訂新增）
  - [x] 前端 `CopilotDrawer.tsx` 880px 雙面板展開與審核後一鍵原子寫入
- [x] **5.5 Schema-Aware 讀庫引擎、專屬 Def 工具庫與唯讀 SQL 沙盒 (Text-to-SQL & Tool Loop)**
  - [x] 產出專屬架構文檔 [`z_doc/ai_copilot_engine_spec.md`](file:///Users/edmondchan/Documents/文件%20-%20Edmond的MacBook%20Air/Local%20Mac/AI/AI%20Project/AI%20Project%20Doc%20Manager/20260909%20Projectson/z_doc/ai_copilot_engine_spec.md)
  - [x] 後端注入完整 5 大表 DDL Schema 與關聯拓撲
  - [x] 實裝 `get_workspace_overview`、`list_projects`、`search_items`、`get_item_detail`、`execute_read_only_sql` (3000ms + `BEGIN READ ONLY` 沙盒保護)
  - [x] 實裝 Multi-turn Tool Calling Execution Loop
- [ ] **5.6 AI Chat History 對話持久化 (Session Continuity & Dialogue Memory)**
  - [ ] Neon DB 建立 `copilot_sessions` 與 `copilot_messages` 資料表
  - [ ] 後端提供 Sessions CRUD API (`GET /api/copilot/sessions`, `POST /api/copilot/sessions`)
  - [ ] 前端支援「➕ 新對話 (New Chat)」與歷史對話切換
- [ ] **5.7 減低認知過載 (Proactive Copilot Features)**
  - [ ] **Catch me up / 前情提要**：進入專案時一鍵生成進度摘要與目前阻礙
  - [ ] **晨會/每日主動簡報**：主動提示即將過期項目與依賴關聯風險
  - [ ] **跨專案經驗遷移 (Cross-Project Recall)**：相似 Bottleneck 推薦過往成功解決方案

---

## 📌 Phase 6: CI/CD 自動化部署與驗證 (Cloudflare + Cloud Run)
- [x] **6.1 Google Cloud Run (Backend)** 容器編譯與自動化部署驗證 (`certifyai-yes-college`)
- [x] **6.2 Cloudflare Pages (Frontend)** 構建設定與 SPA 404 回退驗證 (`projectson.edmondylchan2002.workers.dev`)
- [x] **6.3 跨域 CORS 與環境變數全套驗證**

---

*最後更新時間：2026-09-12*
