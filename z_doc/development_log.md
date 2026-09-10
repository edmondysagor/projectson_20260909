# Projectson 開發日誌 (Development Log)

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
