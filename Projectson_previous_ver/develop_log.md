# Projectson 系統開發日記 (Development Log)

記錄本專案（Projectson）所有關鍵功能的開發歷程、重要架構調整以及已修正的 Bugs。

---

## 2026-06-29 — Cloudflare R2 圖片上傳與自動清理 (Session Tracker) 及網址修復

### 1. 圖片自動清理機制 (Cloudflare R2 Garbage Collection)
* **主題**: 雲端儲存空間管理與成本控制
* **內容**:
  * **需求背景**: 當使用者在 BlockNote 富文本編輯器貼上或上傳圖片時，圖片會立刻上傳至 Cloudflare R2。但若使用者在上傳後，尚未點擊 Save 就將圖片刪除，或是事後編輯時刪除舊圖片，這些圖片將會永久殘留於 R2 Bucket 中，造成成本浪費。
  * **解決方法**: 
    * 實作 `sessionUploadedUrls` (Session Tracker)，透過 React Ref 追蹤每一次視窗開啟期間新上傳的所有圖片 URL。
    * 在儲存 (Save) 時，將 `(資料庫原有圖片 + 本次新增圖片) - (最終保留在編輯器內的圖片)` 進行差異比對，精準找出「被刪除的孤兒圖片」。
    * 觸發後端 `DELETE /api/upload` 請求，自動將這些孤兒圖片從 Cloudflare R2 徹底刪除，並在前端加入成功刪除數量的彈窗提醒。

### 2. Inline Save 與 Modal Save 的統一處理
* **主題**: UI 儲存動作涵蓋率修復
* **內容**:
  * **Bug 現象**: 使用者若使用任務列表的「小 Save 按鈕 (Inline Save)」，因為該按鈕直接呼叫 `onUpdateTask`，導致上述的圖片清理機制被完全繞過。
  * **解決方法**: 將圖片清理邏輯抽離為獨立的非同步函式 `cleanupR2Images`，並將其同時綁定於右側欄的「主要 Save 按鈕」以及列表內的「Inline Save 按鈕」，確保任何儲存行為皆能觸發完整的垃圾清理。

### 3. 環境變數引發的雙斜線 (Double Slash) 破圖修復
* **主題**: 網址解析與防呆機制
* **內容**:
  * **Bug 現象**: 貼上截圖後，BlockNote 立刻顯示破圖 (Failed to load)。
  * **原因**: 伺服器環境變數 `R2_PUBLIC_URL` 在設定時結尾多加了斜線 `/`（例如 `https://pub-xxx.r2.dev/`），導致 API 回傳的圖片網址變成 `https://pub-xxx.r2.dev//uploads/xxx.png`。Cloudflare R2 無法解析雙斜線路徑，回傳 404 Not Found。
  * **解決方法**: 在後端 API 組合網址時，加入 `.replace(/\/$/, '')` 移除多餘的結尾斜線；在刪除 API 中，捨棄舊版的字串替換，改用 `new URL(url).pathname` 穩健解析出 Object Key，避免斜線造成的解析錯誤。

---

## 2026-06-29 — 任務關聯操作優化與嚴格比對 Bug 修正

### 1. 任務關聯自動寫入優化 (Auto-submit Relation Form)
* **主題**: 關聯工單 UX 提升
* **內容**:
  * 將原本必須手動點擊「新增關聯」按鈕的設計，改為在右側目標工單下拉選單選擇後，**自動觸發表單提交**。
  * 修正了下拉選單中 `key` 可能重複的問題，確保 React 渲染穩定。
  * 為小螢幕狀態下的按鈕增加 `flexShrink: 0` 及 `whiteSpace: 'nowrap'`，防止按鈕被過度擠壓消失。

### 2. 關聯列表不顯示及刪除失效 Bug 修正 (Strict Equality Type Bug)
* **主題**: 資料型別轉換與比對修正
* **內容**:
  * **Bug 現象**: 成功新增關聯後，列表仍顯示「尚無關聯工單」，且點擊刪除也沒有反應。
  * **原因**: 關聯資料確實已寫入資料庫，但前端在過濾顯示 (`getRelatedItems`) 及刪除關聯 (`handleDeleteRelation`) 時，使用了 `Number(rel.target_id) === task.id`。由於前端 `task.id` 已被封裝轉換為字串 (String) 格式，在 JavaScript 的嚴格等於 (`===`) 判斷下，數字與字串比對永遠為 `false`，導致篩選邏輯完全失效。
  * **解決方法**: 將所有涉及 ID 比對的地方，統一使用 `String()` 進行安全轉換（例如 `String(t.id) === String(rel.target_id)`），確保型別一致，成功修復了關聯列表的渲染與刪除功能。


## 2026-06-22 (Part 2) — Description 黑屏修正與專案內聯建立任務

### 1. Description 儲存後黑屏/空白 Bug 修正
* **主題**: BlockNote 編輯器生命週期與 React 渲染修復
* **內容**:
  * **Bug 現象**: 於 Description 加入 Table 後，點擊 Save 會導致 React App 崩潰（黑屏），且一般文字儲存後有時會呈現空白（乜都無）。
  * **原因 1 (黑屏)**: 儲存後 `tasks` 陣列更新，導致 `t.description`（BlockNote 的 JSONB 陣列）被直接傳入看板 (Kanban) 和行事曆 (Calendar) 視圖。React 無法渲染物件陣列，拋出「Objects are not valid as a React child」致命錯誤，觸發 ErrorBoundary 導致全域黑屏。
  * **原因 2 (空白)**: `isEditingDesc` 狀態切換時，舊代碼將 `<BlockNoteView>` 條件性卸載並重新掛載，但由於保留了相同的 `editor` 實例，導致 Prosemirror 的 DOM 綁定失效。
  * **解決方法**: 實作 `extractPlainText` 遞迴函式，安全地從 BlockNote JSON 陣列（包含 Table 的 row/cell 嵌套）中提取純文字供列表檢視使用；重構 Task Modal 的 Description 區塊，維持單一 `<BlockNoteView>` 實例不再卸載，僅透過 CSS `display: none` 和 `editable` 屬性動態控制狀態。

### 2. 專案子分頁內聯新增任務 (Inline Task Creation)
* **主題**: 提升任務建立效率
* **內容**:
  * 於專案抽屜 (Project Drawer) 的「任務與工作項」分頁中，將原本點擊即創建的 `+新增任務...` 按鈕，升級為內聯輸入表單 (Inline Input Form)。
  * 提供下拉式選單支援切換 Item Type（包含 Task, Epic, Story, Bug, 甚至 Meeting）。
  * 支援直接輸入任務標題並使用 `Enter` 鍵快速創建，大幅提升專案細部 WBS 拆解流程的流暢度。

---

## 2026-06-22 — 留言系統優化與專案分頁一致化

### 1. 留言輸入框收折與展開 (Comment Editor Collapsed/Expanded UI)
* **主題**: 留言區 UX 交互優化
* **內容**:
  * 實作留言輸入框的收折狀態（Collapsed View）：預設僅顯示 `"Add a comment..."` 提示文字及三個常用快速回覆標籤（`Suggest a reply...`、`Status update...`、`Thanks...`）。
  * 點擊輸入框或快速標籤時，立即順暢轉換為展開編輯狀態（Expanded View），加載 BlockNote 完整編輯器、自定義 Jira 工具列，並在下方顯示 `Save` 與 `Cancel` 按鈕。
  * `Save` 與 `Cancel` 按鈕外置於編輯器邊框下方，排版更加美觀整齊。

### 2. 歷史留言的 Edit 及 Delete 功能
* **主題**: 留言操作功能完善
* **內容**:
  * 實現歷史留言的 **Edit (編輯)** 按鈕：點擊後在該留言原位渲染 BlockNote 編輯器並加載既有富文本內容，供用家直接修改，保存後回傳後端更新。
  * 實現 **Delete (刪除)** 按鈕：點擊後會彈出確認視窗，用家確認後從留言列表及後端資料庫中移除。

### 3. 專案子分頁項目彈出視窗統一化 (Unified Item Pop Up Window)
* **主題**: 專案管理體驗一致性
* **內容**:
  * 調整 `CanvasPane.tsx` 的專案詳細資料視窗（Project Drawer）。
  * 將「會議記錄 (Meetings)」、「阻礙與樽頸 (Bottlenecks)」、「業務知識與隨筆 (Knowledge)」等表格的點擊項目（及新增按鈕）統一導向觸發 `setSelectedModalTaskId`。
  * 使得所有類型的工單點擊後皆會統一彈出 Jira 樣式的 Item Pop Up Window，提升跨模組瀏覽的一致性。

### 4. Description 儲存無寫入 Bug 修正 (Backend Merge Mapping Fix)
* **主題**: 資料保存機制修正
* **內容**:
  * **Bug 現象**: Description 點擊 `Save` 後編輯框關閉，但顯示還原為 `"Add a description..."` 空狀態。
  * **原因**: 後端 API `PUT /api/tasks/:id` 內置有舊屬性兼容邏輯：如果 `description`（頂層）不為 `undefined` 就會強行覆蓋 `item_content.description`。由於前端只更新了 `item_content` 屬性，導致頂層舊的空 `description` 覆蓋了已儲存的內容。
  * **解決方法**: 點擊儲存 Description時，讓前端 `updatedTask` 同時更新頂層 `description` 屬性與 `item_content.description`，保證後端欄位合併時不會造成舊值覆蓋。

### 5. Title 與 Description 編輯狀態解耦
* **主題**: 編輯狀態隔離
* **內容**:
  * 解決了原本任務標題與任務描述共用 `isEditing` 狀態所造成的狀態衝突問題。
  * 為 Description 引入專屬的 `isEditingDesc` 狀態，使兩者能各自獨立編輯及關閉。

---

## 2026-06-15 至 2026-06-21 — 編輯器工具列自研與 Code 模組深度開發

### 1. BlockNote 唯讀留言渲染崩潰修復
* **主題**: React Hook 規則漏洞修正
* **內容**:
  * **Bug 現象**: 留言寫入後，UI 立即發生 Crash / 當機現象（因 `<ReadonlyBlockNote>` 元件調用未定義 Hook 或非 React 頂層 Hook 違反規範）。
  * **解決方法**: 設計專屬的 `<ReadOnlyCommentEditor>`，優化內部 Hook 初始化時機，使得留言歷史紀錄的 JSONB 陣列能夠被安全、穩定地渲染成 BlockNote 唯讀視圖，徹底解決系統當機問題。

### 2. Code Block (代碼塊) 工具列與語法高亮 (Syntax Highlighting)
* **主題**: 代碼編輯增強
* **內容**:
  * 設計懸浮式 `CodeBlockToolbar.tsx`，在游標移入代碼塊時，顯示於代碼塊右下方/底部。
  * **語言搜尋選擇器**: 可在下拉式選單中輸入關鍵字，即時搜尋並切換代碼語言。
  * **代碼複製**: 提供一鍵複製 `Copy` 按鈕，具備短暫的 `Copied!` 狀態提示。
  * **語法高亮**: 引入 BlockNote 代碼高亮核心，在唯讀及編輯狀態下均能依據 SQL、JavaScript 等不同語言進行精確渲染。

### 3. Jira-like 富文本自定義工具列 (EditorToolbar.tsx)
* **主題**: 自研編輯器控制列
* **內容**:
  * 繞過 BlockNote 預設的 Floating Toolbar，開發了 Jira 樣式的靜態編輯工具列 `EditorToolbar.tsx`。
  * 提供：字體樣式（Title/Heading 選擇）、粗體/斜體/底線/刪除線、無序列表/有序列表、文字前景色與背景色、代碼塊插入、Emoji 插入以及 Redo/Undo 等豐富選項。

---

## 2026-05-31 至 2026-06-15 — 子任務關聯與專案抽屜過濾架構

### 1. 任務彈出視窗子工單篩選 Tab 組件 (Child Work Items Tab Filter)
* **主題**: 子工單分類展示
* **內容**:
  * 在工單詳情彈出視窗（Item Pop Up Window）中，為 `Child work items` 新增與專案分頁一致的五個篩選按鈕：`[所有]`、`[任務與工作項]`、`[會議記錄]`、`[阻礙與樽頸]`、`[知識與隨筆]`。
  * 當切換至 `[所有]` 標籤時，將底部的多餘冗餘框（如子工單快速新增等）隱藏，保持視圖整潔。

### 2. 專案分頁抽屜式側邊欄與動畫效果 (Project Drawer Slide-in UI)
* **主題**: UI/UX 頁面層次重構
* **內容**:
  * 將原本的 Project 彈出 Modal 修改為寬度可自適應的 **右側抽屜（Right Side Drawer）**，並新增流暢的 Slide-in 進入動畫以及 Slide-out 縮回動畫。
  * 新增「返回專案分頁」按鈕，觸發回退時會伴隨抽屜縮回的平滑動畫。
  * **層級優化**: 允許在專案抽屜已開啟的基礎上，點擊其中任何子項目直接在其上方疊加彈出工單視窗（Item Pop Up Window），點擊關閉工單視窗後仍會完好保留於專案抽屜內，免去重複開啟的繁瑣。

---

## 2026-05-24 至 2026-05-30 — 資料庫整合、下拉選單美化與內聯編輯

### 1. 下拉選單重構 (React-Select Integration)
* **主題**: 表單控制與美化
* **內容**:
  * 引入 `react-select` 全面取代原生 Select 元素，支援在任務屬性變更（如負責人、狀態、優先級）中進行文字即時搜尋。
  * 為狀態和優先級標籤自定義繽紛的背景及標記點（Colorful Labels）。

### 2. 內聯編輯與批次存檔 (Inline Editing & Batch Save)
* **主題**: 快速屬性更新
* **內容**:
  * 在 Task Modal 的標題 and 元數據區提供靈活的內聯點擊編輯模式。
  * 工單頂部標題右側新增 `Delete (垃圾桶)` 刪除按鈕，簡化刪除流程。
  * 任務及會議工單統一使用 `item_display_id`（例如 `AAP-083`）作為彈出視窗的標題顯示。

### 3. 資料庫 Schema 初始化與 Workspace 序列自增
* **主題**: 資料層底層建置
* **內容**:
  * 統一 `project_context` ID 為整數，重置並整理 `schema.sql`。
  * 更新 API 的模擬數據，並在後端創建任務時實作基於當前工作空間（Workspace）的自動前綴流水號（e.g. 每次建任務自動遞增 `AAP-001` -> `AAP-002`）。
