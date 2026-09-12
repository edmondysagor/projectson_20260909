# Projectson 開發日誌 (Development Log)

---

### Phase 5.5: AI Copilot Clean Slate 重構與雙軌讀寫引擎升級 (AI Copilot Clean Slate Rebuild & Dual-Track Schema Engine) (2026-09-12)
*   **後端架構重構 (Backend Clean Slate & Def Tools)**：
    *   移除既有分散與冗餘的 Copilot 程式碼，重新以標準化模組重構 `backend/src/routes/copilot.ts` 與 `backend/src/routes/items.ts`。
    *   實裝靜態 Ground Truth Context 預載：自動預載 Workspace、Projects 清單、Active Members 與當前聚焦專案之 5 層工單追溯鏈（`Objective`, `Requirement`, `User story`, `Task`, `UAT`, `Bug`, `Decision`, `Information`, `Bottleneck`）。
    *   實裝專屬 Def 工具集（`get_workspace_overview`, `list_projects`, `search_items`, `get_item_detail`）與 `execute_read_only_sql` 唯讀沙盒（`BEGIN READ ONLY` + 3000ms 超時保護 + 關鍵字 AST 防禦）。
    *   實裝 `normalizeItemContent` 防禦性轉換器，支援將純文字/Markdown 自動打包為合法 BlockNote blocks 結構，徹底杜絕前端 BlockNote 編輯器白屏崩潰。
    *   實裝對話共識沉澱端點 `POST /api/copilot/consensus`，支援一鍵將對話結論沉澱入 `okf_concepts` 與 `Decision` 工單。
*   **前端 UI 與 Proposal Canvas 工作台 (Frontend Markdown & Canvas Studio)**：
    *   重構 `CopilotDrawer.tsx`，支援 ReactMarkdown（表格、程式碼高亮、清單）、5 大模型切換器（`Qwen 3.8 Flash`, `Qwen 2.5 Plus`, `Qwen Max`, `DeepSeek V3`, `DeepSeek R1`）與 `🧠 思考模式` 紫灰色 CoT 摺疊卡片。
    *   重構 `ProposalCanvas.tsx` 900px 雙面板審批工作台，支援全選/取消全選、逐項修改標題/類型/優先級/指派人、新增自訂工單與原子批次套用 (`POST /api/items/batch`)。
    *   實裝 `consensus_proposal` 專屬金黃色對話共識沉澱卡片與「一鍵入庫」操作。
*   **規格文檔同步**：
    *   同步更新 `z_doc/ai_copilot_engine_spec.md`、`z_doc/ai_copilot_okf_alignment.md`、`z_doc/todo_list.md` 與 `z_doc/active_spec.md`。

---

### Phase 1.4: 工作區創建健全性修復與工單總表 TDZ 崩潰解決 (Workspace Creation & TDZ Crash Fix) (2026-09-10)
*   **後端工作區管理模組 (Workspace API Route)**：
    *   修復 `POST /api/workspaces` 於 Neon PostgreSQL 建立工作區時的 SQL 欄位映射錯誤（原錯誤寫入不存在之 `content_name`，修正為 `context_name`，並正確寫入 `context_number = 1`）。
    *   在工作區建立前新增代號重複預先檢查（`SELECT workspace_uid FROM workspace WHERE UPPER(prefix_code) = $1`），若已存在則拋出友善中文提示：`代號「...」已被「...」使用，請更換其他代號 (3-4英文字母)`。
    *   捕捉 PostgreSQL 唯一約束衝突 `23505` 錯誤代碼，回傳 400 狀態碼與結構化錯誤 JSON，避免伺服器未捕獲拋出 500。
*   **前端 API 與工作區彈窗 (Frontend API & Modal UX)**：
    *   修復 `frontend/src/utils/api.ts` 的 `createWorkspace`、`updateWorkspace` 與 `deleteWorkspace`，改為解析後端回傳之 `err.error` 訊息，取代硬編碼的 `Failed to create workspace`。
    *   在 `Sidebar.tsx` 工作區建立邏輯中，相容支援 `workspace_uid` 與 `workspace_id`，確保新工作區建立後能精確切換工作區篩選。
*   **工單總表與彈窗 TDZ 運行時崩潰修復 (Temporal Dead Zone Resolution)**：
    *   根治 `TaskModal.tsx` 與 `MeetingModal.tsx` 中在尚未宣告 `task` / `meet` 變數前便訪問 `activeWsId = ... || task.workspace_id` 導致的 JavaScript TDZ `ReferenceError: Cannot access '...' before initialization`。
    *   將 `formatDateString` 輔助函式提取並提升至 `CanvasPane.tsx` 模組頂層，避免子組件渲染時因未初始化而被調用拋錯。
    *   重新建置前端並透過 `wrangler` 部署至 Cloudflare Workers (`https://projectson.edmondylchan2002.workers.dev`)，後端透過 `gcloud` 部署至 Cloud Run (`projectson-00015-js4`)。

---

### Phase 1.5: 專案彈窗工作空間與父級產品 Dropdown 聯動及後端 CRUD 修復 (Project Modal Dropdown & CRUD Fix) (2026-09-10)
*   **前端專案彈窗 (Project Modal & Canvas Pane)**：
    *   修復 `ProjectModal.tsx` 中工作空間 Dropdown 選擇無反應問題：因資料庫使用 UUID 字串，原 `onChange` 執行 `Number(selected.value)` 會轉為 `NaN`，導致比對失敗並重設為空。修正為全字串比較與賦值。
    *   修復父級產品 (Parent Product) Dropdown 找不到產品問題：在 `CanvasPane.tsx` 調用 `<ProjectModal />` 時補回遺漏傳遞的 `products={products}` 屬性。
    *   修復 `ProductModal.tsx` 中工作空間選擇時執行 `Number(e.target.value)` 的相同 UUID 轉換問題。
    *   修復 `handleModalProjectSave` 與 `handleModalProductSave` 寫入時執行 `Number(editWorkspaceId)` 轉為 `NaN` 的問題，改為傳遞乾淨的字串 UUID (`related_workspace_uid`)。
*   **後端專案與產品更新邏輯 (Projects & Products PUT Route)**：
    *   修復 `PUT /api/projects/:id` 的 SQL `UPDATE` 語句遺漏更新 `related_workspace_uid`、`parent_content_uid`、`actual_start_date`、`actual_end_date` 的重大問題。
    *   加入工作空間跨區遷移支援：當專案被使用者變更工作空間時，自動為其重新獲取目標工作空間的流水號並生成對應前綴之 `context_display_code`（例如從 `TWK-COT-2` 自動轉為 `AAP-COT-1`）。
    *   修復 `PUT /api/products/:id` 支援更新 `related_workspace_uid`。
    *   前端 `api.ts` 的專案與產品 CRUD 方法全數加入伺服器錯誤訊息透傳。

---

### Phase 1.6: 全域客製化 Dropdown 樣式統整與 Member 搜尋創建元件規範化 (Dropdown & Member Search-and-Create Standardization) (2026-09-10)
*   **全域自訂下拉選單模組 (Custom Popover Dropdown)**：
    *   全面替換原生 `<select>` 元素為暗黑沉浸式客製化彈窗選單，統一藍色邊框與精緻懸停回饋。
    *   在工單側邊欄 (ItemDrawer) 頂部屬性區實裝 Priority、Follow by (負責人)、Status 三大屬性的 Inline Edit 下拉選單。
*   **成員搜尋與動態創建模組 (Member Search & Create Component)**：
    *   實裝「輸入搜尋 + 即時創建新成員 (Input Search & Create)」通用彈窗機制。
    *   當用戶輸入不在既有名單中的姓名時，顯示「+ Create "<name>"」按鈕，點擊後即時寫入後端 `team_member` 資料表，並自動設定為當前選中成員。
    *   將全域所有涉及成員指定（包括 Follow by、Assignee、Reviewer）的下拉選單無縫替換為該統一組件。
*   **成員管理總表格式對齊 (Members Table View Alignment)**：
    *   參考「所有工單總表 (All Items Table View)」規格重構 Member 頁面，具備大標題、全域關鍵字搜尋欄、篩選列與支援 Inline Edit 的表格視圖。
    *   將全域所有日期選擇器（`input[type="date"]`）的 calendar 圖示統一透過 CSS 濾鏡轉為純白色 (`filter: invert(1) brightness(1.8)`)。

---

### Phase 1.7: 引入正統 TypeCellOS/BlockNote 區塊編輯器與 Shiki 語法高亮 (BlockNote Engine & Shiki Code Highlighting) (2026-09-10 ~ 2026-09-11)
*   **Block-based 區塊編輯器架構遷移 (Notion-Style Block Engine)**：
    *   評估並棄用自製簡易 Markdown Textarea，全面引進官方正統開源 `@blocknote/core`、`@blocknote/react` 與 `@blocknote/mantine`。
    *   完整支援 Notion 原生交互生態：全域 6 點拖曳手柄 (Drag Handle)、拖曳重排藍色指示線 (Drop Indicator Blue Line)、浮動選取文字格式工具列 (Formatting Toolbar) 以及 `/` 快捷指令選單 (Slash Commands Menu)。
    *   將該編輯器全面應用於工單詳情 (Item Description) 與工單評論模組 (Item Comments)。
*   **程式碼區塊與語言切換器 (Code Block & Interactive Language Picker)**：
    *   整合 `@blocknote/code-block` 套件，並在編輯器 Schema 中以 `createCodeBlockSpec(codeBlockOptions)` 取代預設代碼塊，啟用 Shiki 語法高亮引擎。
    *   於 Code Block 右上角自訂顯眼、高對比的常駐深藍色 Badge 語言下拉選單，支援切換 SQL、JavaScript、TypeScript、Python、HTML、CSS、Rust、C++、JSON 等 40+ 種程式語言，並動態賦予精確語法著色。
    *   修復全域 CSS 中 `code { display: inline-flex }` 導致的 Code Block Enter 換行失效問題，強制覆寫為 `display: block !important; white-space: pre-wrap !important;`，恢復正常多行編程體驗。
*   **編輯與唯讀檢視引擎完全同構 (Unified BlockNoteViewer Rendering)**：
    *   修復儲存 (Save) 後使用 regex 文字解析導致 Table 表格與代碼塊退化為原始字元的問題。
    *   將所有靜態檢視器 (`renderMarkdownContent` / `NotionViewer`) 全面改採 `BlockNoteView` 搭配 `editable={false}`，使表格、代碼塊、清單、待辦項目於儲存前後保持 100% 一致的人類可讀排版。
*   **部署與版本控制 (Continuous Deployment)**：
    *   前端成功建置並透過 Wrangler 自動化部署至 Cloudflare Workers (`https://projectson.edmondylchan2002.workers.dev`)，變更同步推送到 GitHub `origin/main`。

---

### Phase 1.8: 全面遷移至 steven-tey/novel 編輯器與搜尋型 Code Block 語言選擇器 (Novel Migration & Code Block Search Selector) (2026-09-11)
*   **官方 steven-tey/novel 編輯器全面導入 (Novel Ecosystem Integration)**：
    *   依據專案最新需求，將工單內容 (Item Content / Description) 與工單評論 (Item Comments) 編輯器由 BlockNote 遷移至正統 Notion 開源複製品 `steven-tey/novel`。
    *   基於 TipTap / Novel 架構配置 `EditorRoot`、`EditorContent`、`StarterKit`、`Table`、`TaskList`、`HorizontalRule`、`TiptapLink`、`GlobalDragHandle` 與 `tiptap-markdown`。
    *   內建 Notion 體驗規格：`/` 喚出 Slash Command 選單、文字選取浮動工具列 (NovelBubbleMenu: Bold, Italic, Underline, Strikethrough, Code)、6 點拖曳手柄。
*   **Code Block 自訂 NodeView 與「搜尋 + 下拉選單」語言切換器 (Code Block NodeView & Search Picker)**：
    *   實裝 `NovelCodeBlockView`，利用 `<NodeViewWrapper>` 嚴格隔離 UI 控制層（`contentEditable={false}`）與文字內容層（`<NodeViewContent as="code">`），徹底根絕前版 DOM 元素文字洩漏至 Markdown 的序列化污染（如 `CODE BLOCKJavaScript\``` `）。
    *   設計全新 `CodeBlockLanguagePicker` 組件：支援常駐深藍色 Badge 按鈕、點擊展開浮動彈窗、內建即時過濾搜尋框（Input Search Filter）、48 種主流程式語言清單（含 JavaScript, TypeScript, Python, SQL, Rust, Go, CSS, HTML, C++, Bash 等）與選中打勾回饋，支援點擊外部自動收起。
    *   整合 `CodeBlockLowlight` 與 `lowlight / highlight.js`，並以 GitHub Dark 語法主題實現不同語言的高亮著色。
    *   設定 `white-space: pre-wrap !important; display: block !important;` 確保代碼塊內 Enter 換行流暢無阻。
*   **同構 Markdown 存儲與 Neon DB 零摩擦相容**：
    *   編輯器透過 `tiptap-markdown` 在輸入停止 500ms 後自動序列化純淨 Markdown 字串並回傳 `onChange`。
    *   唯讀模式下透過同構 `NovelEditor` (`editable={false}`) 渲染，確保已儲存內容與編輯態具有 100% 相同的高品質排版與代碼高亮。
*   **自動化建置與部署 (Build & Deploy Verification)**：
    *   修復 Novel 與底層 TipTap TypeScript 類型宣告微調，通過 `npm run build` 嚴格編譯。
    *   成功發布至 Cloudflare Workers (`https://projectson.edmondylchan2002.workers.dev`) 並推播代碼至 GitHub 倉庫。

---

### Phase 1.9: Update & Deployment 頁面三欄式工程矩陣重構與功能鍵對齊 (Deployment Traceability Matrix) (2026-09-11)
*   **佈局重構對齊（對齊 圖2）**：
    *   在專案詳情頁（`ProjectDetailView.tsx`）中，將「🚀 Update & Deployment」分頁由原本通用的二維扁平表格（`AdvancedTable`）重構為專屬的 3 欄式階層矩陣：`Deployment ➔ User Story ➔ Task`。
*   **功能鍵與交互生態全面對齊（對齊 圖3 TraceabilityMatrix 規格）**：
    *   **頂部表頭與快捷建立**：表頭「📦 Deployment」右側附帶小圓形「+」號，且頁面頂部常駐「+ 新增 Deployment」橘色按鈕，支援快速建立頂層部署節點。
    *   **卡片功能鍵**：每張卡片右上角配備「+」號（可向右新增或關聯下層附屬工單）以及 Hover 浮現的紅色垃圾桶刪除按鈕。
    *   **虛線新增插槽（Empty Slot Placeholder）**：當 Deployment 下尚無 User Story，或 User Story 下尚無 Task 時，自動呈現精緻的「+ 新增 User Story」/「+ 新增 Task」虛線按鈕與橫向引導線。
    *   **二合一操作彈窗**：點擊任一「+」號展開全功能彈出層，支援「➕ 直接建立新工單」與「🔍 搜尋並關聯既有工單」雙 Tab 操作。
    *   **拖曳重定從屬（Drag & Drop Hierarchy Rebinding）**：支援直接將卡片拖曳到目標父層卡片或右側插槽區，實現無摩擦跨層級重新分組與歸類。
*   **部署與版本控制**：
    *   前端通過 `npm run build` 嚴格驗證並成功發布至 Cloudflare Workers (`https://projectson.edmondylchan2002.workers.dev`)，變更同步推送到 GitHub `origin/main`。

---

### Phase 1.10: 補齊 Information 類型支援、專案色彩自訂與屬性欄擴充 (Information Item Type & Project Color Attribute) (2026-09-11)
*   **全域工單類型補齊 Information (ℹ️)**：
    *   在工單總表 (`AdvancedTable`)、篩選器 (`MultiSelect`)、工單側邊欄 (`ItemDrawer`)、範本編輯器 (`TemplateModal`) 中全面補齊 `Information` (ℹ️) 作為正式工單類型。
    *   為 `Information` 類型配置標準樣式：天藍色 Badge 背景 (`#075985` / `#38bdf8`) 與圖示。
*   **專案色彩屬性與側欄自訂 (Project Color via project_attribute JSONB)**：
    *   後端資料庫：在 `public.project` 資料表新增 `project_attribute JSONB DEFAULT '{}'::jsonb` 欄位，支援儲存包含 `color` 等擴充屬性。
    *   後端 API：在 `POST /api/projects` 與 `PATCH /api/projects/:uid` 路由中全面支援 `project_attribute` 寫入與更新。
    *   前端專案詳情頁（`ProjectDetailView.tsx`）：
        *   於右側屬性側邊欄中加入「專案色彩 (Project Color)」下拉調色盤（支援 Sky Blue, Indigo, Purple, Emerald, Amber, Rose, Cyan, Pink, Orange, Slate）。
        *   在專案大標題旁渲染選定之專案色彩指示燈。
        *   將 `projectColor` 屬性向下傳遞至 `TraceabilityMatrix` 與 `DeploymentTraceabilityMatrix`，使所屬工單卡片左側呈現專案色彩左邊框（`borderLeft`），實現視覺色彩連貫繼承。
*   **自動化建置與驗證**：
    *   後端及前端均通過嚴格 TypeScript 編譯與打包建置。

---

### Phase 4.1: Google OKF v0.2 與向量資料庫結構底座建立 (OKF & pgvector Schema Foundation) (2026-09-11)
*   **向量資料庫擴展 (Neon Serverless PostgreSQL pgvector)**：
    *   在 `backend/database/schema.sql` 啟用 `vector` 擴展 (`CREATE EXTENSION IF NOT EXISTS "vector";`)。
    *   設計並建立 `okf_sources` 知識文件來源表：支援 Workspace 全域共用知識 (`project_uid IS NULL`) 與專案專屬知識 (`project_uid = ?`)，配置上傳、解析、切片與索引狀態生命週期 (`uploaded > parsing > chunking > indexed > failed`)。
    *   建立 `okf_chunks` 768 維語意向量分塊表：關聯 `okf_sources` 與 `item`，配置 `ON DELETE CASCADE` 級聯刪除保護，並建立 `HNSW` 餘弦相似度向量索引 (`vector_cosine_ops`)。
    *   建立 `okf_concepts` 與 `okf_links`：實現 Google OKF v0.2 雙時態概念實體與時序關係邊（`SUPERSEDES`, `PRE_REQ`, `BELONGS_TO`, `DERIVED_FROM`, `CAUSES`, `EXTENDS`）。
*   **系統架構規格對齊與實施方案定案**：
    *   產出完整系統規格文件 [`z_doc/ai_copilot_okf_alignment.md`](file:///Users/edmondchan/Documents/文件%20-%20Edmond的MacBook%20Air/Local%20Mac/AI%20Project/AI%20Project%20Doc%20Manager/20260909%20Projectson/z_doc/ai_copilot_okf_alignment.md)，明確確立「90% 工作態走純 SQL (0 Token / < 10ms) + 10% 知識態 (Information/Decision/Bottleneck/PDF) 走 OKF+RAG」的雙軌架構。
    *   確定多用戶協同純以 PostgreSQL 原生 `updated_at` (TIMESTAMPTZ) 作為客觀事實基準，徹底杜絕並發 Race Condition。
    *   建立五階段實施路線圖（Implementation Plan）。

---

### Phase 4.2 & 5.1: 專案知識文件庫 Tab、後端 Sources API 與 Actionable AI Copilot 抽屜實裝 (Project Sources & Copilot Drawer) (2026-09-11)
*   **後端知識來源模組 (Backend Sources API Route)**：
    *   在 `backend/src/routes/sources.ts` 實裝完整 CRUD API（`GET /api/sources`, `POST /api/sources`, `PATCH /api/sources/:uid`, `DELETE /api/sources/:uid`）。
    *   支援上傳建立來源時自動將純文字或 Markdown 內文進行輕量段落切片 (`okf_chunks`)。
    *   刪除來源文件時由資料庫 `ON DELETE CASCADE` 級聯清空關聯分塊，實現 0 Token 自動清理。
    *   在 `backend/src/index.ts` 註冊 `/api/sources` 路由並通過 TypeScript 編譯。
*   **前端專案知識文件庫 (Project Sources View & NotebookLM UI)**：
    *   在 `frontend/src/components/ProjectSourcesView.tsx` 打造 Google NotebookLM 風格的知識來源卡片庫：
        *   頂部拖放上傳區（Drag & Drop Zone，支援 PDF, DOCX, Markdown, TXT, JSON）。
        *   支援「新增 Markdown 規格」彈窗與「設為 Workspace 全域共用知識」開關。
        *   卡片清單顯示檔名、大小、頁數、向量節點數與索引狀態 Badge。
        *   卡片底部提供「啟用/停用 AI 引用 (Source Toggles)」與「刪除文件」功能。
    *   在 `ProjectDetailView.tsx` 導航列補齊 **`📁 知識文件 (Sources)`** Tab，點擊無縫切換至該檢視。
*   **全域 Actionable AI Copilot 抽屜 (`CopilotDrawer.tsx`)**：
    *   在 `App.tsx` 右下角實裝常駐紫色漸變 **`✨ AI Copilot` 懸浮按鈕**。
    *   點擊自右側滑出 `CopilotDrawer`，支援即時多輪對話、專案脈絡注入、情報對齊（Proactive Delta Summary）。
    *   實裝 **Action Preview（工單建立預覽卡片）** 與 **「一鍵套用至專案 (Apply)」** 交互，點擊確認後即時呼叫 `api.createItem` 寫入資料庫並自動刷新專案矩陣。
*   **建置與工程驗證**：
    *   前端通過 Vite 嚴格建置（0 錯誤）。

---

### Phase 5.2: AI Copilot「一鍵套用」工單指派/更新支援與後端成員上下文對齊 (Copilot Action Execution & Member Assignment) (2026-09-11)
*   **Actionable Agent 更新與指派邏輯實裝 (`frontend/src/components/CopilotDrawer.tsx`)**：
    *   修復「一鍵套用無反應」缺陷：擴展 `handleApplyAction` 支援 `actionType: 'update_item'` 操作。
    *   點擊「一鍵套用至專案」時直接調用 `api.patchItem(targetItemUid, updates)`，支援即時指派負責人（`item_follow_by`）、修改工單狀態（`item_status`）、更新標題等。
    *   升級 Action Preview 預覽卡片：區分「建立工單」與「更新/指派工單」，提供清晰的視覺反饋與狀態回饋。
*   **後端 Ground Truth 成員與工單上下文強化 (`backend/src/routes/copilot.ts`)**：
    *   注入 Neon DB `public.member` 啟用成員清單（`member_uid`, `member_name`, `email`）。
    *   工單 Context 關聯查詢負責人姓名（`item_follow_by` ➔ `follow_by_name`）。
    *   強化 Prompt 意圖指引，使 Qwen 接收指派指令時（如「把 story 1 task 1 指派比 Edmond」）能自動比對成員清單與工單清單，精確生成 `update_item` Action JSON。
---

### Phase 5.3: AI Copilot 多模型切換器、深度思考模式 (Thinking Mode) 與 VS Code 診斷修復 (2026-09-12)
*   **VS Code TypeScript 診斷清零**：
    *   修復 `frontend/tsconfig.node.json` 模組解析設置為 `ESNext` + `bundler`，徹底解決紅字警告。
*   **多模型切換器 (Multi-Model Switcher)**：
    *   支援在 Copilot 抽屜頂部自由切換 5 款大模型：Qwen 3.8 Flash、Qwen 2.5 Plus、Qwen Max、DeepSeek V3、DeepSeek R1。
*   **深度思考模式 (Thinking Mode / CoT Reasoning)**：
    *   後端 `copilot.ts` 自動解析 `<think>...</think>` 思維鏈。
    *   前端提供紫色專屬摺疊卡片 `🧠 深度思考過程 (Reasoning Process)`，支援查看深層邏輯推演。

---

### Phase 5.4: AI Copilot 提案審核工作台 (880px Dual-Panel Proposal Canvas) 與原子批次寫入 API (2026-09-12)
*   **後端原子批量建立工單 API (`POST /api/items/batch`)**：
    *   在 `backend/src/routes/items.ts` 實裝事務保護的批量寫入端點 (`client.query('BEGIN') ... COMMIT`)。
    *   原子鎖定 `public.workspace` 累加流水號，安全生成連續有序的 `PREFIX-X` display code。
    *   支援容錯成員名單解析（姓名/UUID）與父級工單代碼關聯解析。
    *   自動向每一張 AI 建立的工單寫入不可逆的 Jira 式審計紀錄 (`item_comment` 標記 `🤖 [AI Copilot 批量生成記錄]`)。
*   **前端 Proposal Canvas 審核工作台 (`frontend/src/components/ProposalCanvas.tsx`)**：
    *   獨立審核面板：支援逐項勾選 (`☑️ Approve` / `❌ Skip`)、全選/取消全選、即時修改工單標題、切換類型、調整優先級、直接指派負責人與新增自訂項目。
    *   雙面板自適應佈局 (`CopilotDrawer.tsx`)：當 AI 產出批量提案時，抽屜自 `420px` 平滑展開至 `900px` 雙面板工作台（左側對話 380px + 右側審核 520px）。
    *   一鍵套用機制：點擊「套用已核准項目」後調用 `api.batchCreateItems`，寫入 Neon DB 並自動刷新矩陣與派發更新事件，隨後平滑收回抽屜。
*   **全棧建置與 TypeScript 驗證**：
    *   後端與前端 `npm run build` 全數 0 錯誤通過。

---

### Phase 5.5: AI Copilot Schema-Aware 讀庫引擎、專屬 Def 工具庫與唯讀 SQL 沙盒 (2026-09-12)
*   **系統架構專屬規範文檔定案**：
    *   建立 [`z_doc/ai_copilot_engine_spec.md`](file:///Users/edmondchan/Documents/文件%20-%20Edmond的MacBook%20Air/Local%20Mac/AI/AI%20Project/AI%20Project%20Doc%20Manager/20260909%20Projectson/z_doc/ai_copilot_engine_spec.md)，完整規範 5 大核心表 DDL Schema、唯讀沙盒防護規則、Tool Calling 清單與 Proposal Canvas 寫入鐵律。
*   **後端 Schema-Aware Prompt 與基礎資料補全 (`backend/src/routes/copilot.ts`)**：
    *   補齊 `public.workspace` 與 `public.project` 全域清單預載，徹底根治「不知道當前工作區有幾多個 project」的上下文缺陷。
    *   注入完整 PostgreSQL 5 大表 DDL 與關聯拓撲說明。
*   **專屬 Def 工具庫與唯讀 SQL 沙盒實裝**：
    *   實裝標準 Tool Calling 定義：`get_workspace_overview`、`list_projects`、`search_items`、`get_item_detail`、`execute_read_only_sql`。
    *   唯讀 SQL 執行引擎採用 `BEGIN READ ONLY` + 3000ms 超時保護 + 寫入關鍵字嚴格攔截，確保零副作用安全查庫。
    *   實裝多輪 Tool Calling 循環（Multi-turn Tool Loop），支援 AI 主動調度工具獲取 DB 真實數據後再組織最終回答。

---

### Phase 5.6: 前端 AI Copilot 富文本 Markdown、表格與代碼塊渲染升級 (2026-09-12)
*   **ReactMarkdown 與 remark-gfm 深度整合 (`CopilotDrawer.tsx`)**：
    *   解決 AI 回覆中 Markdown 表格（如 `| # | Display Code | 名稱 | ... |`）、粗體、行內代碼、清單未正確渲染為 HTML 結構的問題。
    *   配置暗黑模式專屬 Table 容器（自動橫向捲動、邊框美化、標頭高亮）、Code Block、Blockquote 與排版樣式。

---

### Phase 5.7: AI Copilot 全維度 Schema Ground Truth 校準與完整業務操作百科掌握 (Schema Calibration & Deep Domain Mastery) (2026-09-13)
*   **系統提示詞與領域模型全維度校準 (`backend/src/routes/copilot.ts`)**：
    *   完整注入 Neon PostgreSQL 核心 Schema 所有枚舉約束與資料表結構百科：16 種合法 `item_type`、8 種合法 `item_status`、5 種 `project_status`、2 種 `project_type` 與水平依賴關係。
*   **修復對話共識沉澱端點與資料庫欄位對齊 (`POST /api/copilot/consensus`)**：
    *   修復原硬編碼 `Approved` 非法狀態引起的約束報錯，校準為標準枚舉 `Completed`。
    *   校準 `okf_concepts` 寫入 SQL 欄位（`concept_name`, `concept_type`, `concept_description`）。

---

### Phase 5.8: 全動作全自動展開式 Proposal Canvas 審批工作台升級 (Universal Auto-Expanding 900px Proposal Canvas) (2026-09-13)
*   **全動作統一展開架構 (Unified 4-Mode Canvas Studio in `ProposalCanvas.tsx`)**：
    *   **批量拆解 (Batch Proposal)**：多工單 Checklist 審查，支援全部 16 種合法工單類型、3 級優先度、指派人、全選/取消全選、加一項與刪除。
    *   **單項建立 (Create Item)**：專屬單一工單預覽與父級掛載展示。
    *   **單項變更/作廢 (Update Diff Studio)**：**變更前後視覺對照 (Diff Comparison)**，清楚呈現 `狀態：Not Start ➔ Closed (已作廢)`、`負責人：未指派 ➔ Edmond` 等變更與理由。
    *   **對話決策沉澱 (Consensus & Decision)**：金色決策陳述與 OKF 圖譜同步預覽。
*   **主動式自適應展開 (`CopilotDrawer.tsx`)**：
    *   只要 AI 生成任何 Action（批量拆解、單張新建、屬性更新/作廢、對話共識），抽屜立即自動由 `420px` 平滑展開至 `900px` 雙面板工作台。
    *   左側對話框顯示精緻徽章，右側提供完整審批與行內微調控制，點擊核准套用後原子寫入 Neon DB 並自動收合回 `420px`。


