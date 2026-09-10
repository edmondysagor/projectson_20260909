# Projectson 技術心得與踩坑重點 (Lessons Learned)

---

## 1. Neon PostgreSQL 唯一鍵衝突與工作區預設專案 SQL 欄位映射 (2026-09-10)
### 工作區創建拋出 500 / 模糊失敗 (Workspace Creation Failure)
*   **痛點 / 現象**：
    1. 用戶在前端「Create New Workspace」彈窗輸入名稱與代號（例如 `AAP`）時，前端介面直接紅字報錯 `Failed to create workspace`，用戶無法得知失敗原因。
    2. 後端伺服器在建立工作區時，就算代號不重複，也會觸發 `column "content_name" of relation "project_context" does not exist` 導致 500 報錯崩潰。
*   **根因分析**：
    1. Neon DB 的 `workspace` 資料表設有嚴格唯一索引 `workspace_prefix_code_key UNIQUE (prefix_code)`。現存工作區 `ASD Ops Analytics & Insights` 已佔用代號 `AAP`，當再次輸入 `AAP` 時，PostgreSQL 觸發了 23505 唯一衝突。
    2. 後端 `routes/workspaces.ts` 在建立工作區後，嘗試自動寫入 `project_context`，但 SQL 誤寫為 `INSERT INTO project_context (content_name, ...)`。在實際資料庫 schema 中，該欄位為 `context_name`，且 `context_number` 設有 `NOT NULL` 約束。
    3. 前端 `api.ts` 的 `createWorkspace` 僅檢查 `if (!res.ok) throw new Error('Failed to create workspace');`，直接丟棄了後端回傳的具體 JSON 錯誤描述。
### 解決方案與防禦架構 (Defensive Solution)
1. **主動防禦檢查與友善提示**：
   在 INSERT 前先執行 `SELECT workspace_uid, workspace_name FROM workspace WHERE UPPER(prefix_code) = $1`，發現衝突時回傳 400 及精確的中文字串，告知被哪一個工作區佔用。
2. **修正資料庫寫入 Schema**：
   ```sql
   INSERT INTO project_context (context_name, context_display_code, context_number, context_type, related_workspace_uid, context_status, project_type)
   VALUES ('General Project', $1, 1, 'Project', $2, 'Active', 'BAU')
   ```
3. **前端 API 錯誤透傳**：
   ```ts
   if (!res.ok) {
     const err = await res.json().catch(() => ({}));
     throw new Error(err.error || 'Failed to create workspace');
   }
   ```

---

## 2. React 渲染樹中 Temporal Dead Zone (TDZ) 導致的模態窗崩潰 (2026-09-10)
### 工單總表渲染被 ErrorBoundary 捕獲白屏 / 紅框報錯 (TDZ ReferenceError)
*   **痛點 / 現象**：
    1. 用戶進入工作區或點選「所有工單總表 (Task Table View)」時，整個視圖被紅框 ErrorBoundary 攔截：
       `Something went wrong while rendering this section: ReferenceError: Cannot access '...' before initialization`。
*   **根因分析**：
    1. 在 `TaskModal.tsx` 與 `MeetingModal.tsx` 中，開發者在宣告 `const task = ...` 與 `const meet = ...` 之前（高達 50 行前），就先執行了：
       `const activeWsId = ... || task.workspace_id || ...;`
       在現代 JavaScript 規範中，`const` / `let` 宣告在賦值執行之前處於 Temporal Dead Zone (TDZ)。
    2. 由於 `renderAllOverlays()` 無條件渲染了 `<TaskModal />` 與 `<MeetingModal />`，當 `selectedModalTaskId` 為 `null` 時，組件在執行至該行時直接觸發 `ReferenceError` 崩潰。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **調整變數存取順序**：
       在無 Hooks 的展示型模態窗中，第一時間執行衛語句（Guard Clause）：
       ```ts
       if (!selectedModalTaskId) return null;
       const task = tasks.find(t => String(t.id) === String(selectedModalTaskId));
       if (!task) return null;

       const activeWsId = ... || task.workspace_id ...;
       ```
    2. **公用日期函式模組化提升**：
       將 `formatDateString` 等跨多個視圖調用的轉換函式提升至模組頂部（文件頂層），避免在組件實例化期間因閉包位置不當產生 TDZ 存取風險。

---

## 3. PostgreSQL UUID 轉化數值造成 NaN 與 React Dropdown 失效 (2026-09-10)
### Dropdown 選完無反應與更新未寫入 (Dropdown Unresponsive & Lost Workspace Update)
*   **痛點 / 現象**：
    1. 用戶在專案抽屜或彈窗中點選「工作空間」下拉選單，選取項目後選單立刻關閉，但選取的內容未被保留，依然顯示「選擇工作空間」。
    2. 專案彈窗中的「父級產品」下拉選單完全空白，只有「-- 未指定 --」，用戶無法綁定父級產品。
    3. 即使點選「儲存變更」，後端並未更新工作空間或父級產品，專案始終停留在預設工作空間中。
*   **根因分析**：
    1. 前端組件在 React Select 的 `onChange` 事件中執行了 `Number(selected.value)`。由於現代 Neon DB 架構已遷移至 UUID（如 `a0000000-0000-0000-0000-000000000001`），`Number(uuid)` 會評估為 `NaN`。下一次渲染時 `workspaces.find(w => w.workspace_id === NaN)` 傳回 `undefined`，導致 `value` 永遠為 `null`。
    2. 父組件 `CanvasPane.tsx` 在渲染 `<ProjectModal />` 時，遺漏了傳入 `products={products}` prop，導致子組件內部的 `products` 預設為空陣列 `[]`。
    3. 後端 `PUT /api/projects/:id` 的 SQL `UPDATE` 語句未納入 `related_workspace_uid` 與 `parent_content_uid` 欄位，導致就算前端送出，資料庫也未執行更新。
### 解決方案與防禦架構 (Defensive Solution)
1. **全面禁用 UUID 上的 Number 轉換**：
   在所有 `Select`、`onChange` 及 API Payload 中，將 ID 統一以 `String(...)` 處理：
   ```tsx
   value={workspaces.find(w => String(w.workspace_id || w.workspace_uid) === String(editWorkspaceId)) ? { 
     value: String(editWorkspaceId), 
     label: workspaces.find(w => String(w.workspace_id || w.workspace_uid) === String(editWorkspaceId))?.workspace_name 
   } : null}
   onChange={(selected: any) => setEditWorkspaceId(selected ? String(selected.value) : '')}
   ```
2. **補齊組件 Props 傳遞**：
   確保 `ProjectModal` 接收到當前工作區下的所有可用 `products`。
3. **後端動態更新與編號遷移 (Display Code Migration)**：
   在後端 `PUT` 時，若檢測到所屬工作空間異動，自動取用新工作空間的 `last_context_number` 並為其更新 `context_display_code`。

---

## 4. 全域 CSS 標籤選擇器干擾第三方富文字編輯器子元素 (2026-09-11)
### Code Block 內 Enter 鍵無法換行、光標水平單行溢出 (CSS Cascade Collision on Code Elements)
*   **痛點 / 現象**：
    1. 在工單 Description 或 Comment 插入 Code Block 代碼塊時，用戶輸入程式碼並按下鍵盤 `Enter` 換行，編輯器完全沒有任何換行反應，所有代碼被強行擠在同一行水平延伸。
*   **根因分析**：
    1. 專案根目錄 `index.css` 包含一段針對行內小標籤的通用樣式：
       ```css
       code, .counter {
         font-family: var(--mono);
         display: inline-flex;
         border-radius: 4px;
       }
       ```
    2. BlockNote 的 Code Block 內部架構為 `<pre><code>...</code></pre>`。當 `<code>` 繼承了全域的 `display: inline-flex` 時，其內部 TextNode 與 ProseMirror 的換行符號 `\n` 無法觸發正常的區塊流式換行計算，導致瀏覽器將換行字元視為連續行內內容處理。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **隔離編輯器專屬命名空間與強制覆寫**：
       為 BlockNote 內的 code 元素精確宣告區塊顯示、空白保留與行高：
       ```css
       .bn-block-content[data-content-type="codeBlock"] > pre > code {
         display: block !important;
         white-space: pre-wrap !important;
         word-break: break-word !important;
         line-height: 1.6 !important;
         background: transparent !important;
         padding: 0 !important;
       }
       ```
    2. **全域樣式避坑原則**：
       避免在 `index.css` 直接針對標準 HTML 標籤（如 `code`, `table`, `input`, `select`）套用強制性佈局屬性（如 `display: inline-flex`、`overflow: hidden`）。若需行內代碼樣式，應限制於特定容器範圍內（如 `.markdown-body code`）或使用 Utility Class（如 `.code-inline`）。

---

## 5. BlockNote 靜態預覽與編輯態渲染同構原則 (2026-09-11)
### 儲存後 Markdown 表格與特殊語法退化為原始字元 (Renderer Parity Failure)
*   **痛點 / 現象**：
    1. 用戶在 BlockNote 編輯器中建立了標準表格（Table）或代碼塊，點選「Save」退出編輯後，在詳情頁面上卻顯示出原始的 `| | |`、`| --------- |` 以及 `/code` 字元，未能呈現人類可讀的視覺樣式。
*   **根因分析**：
    1. 前端在「編輯態」採用了強大的 BlockNote 區塊引擎，但在「靜態唯讀態」卻呼叫了一個純文字 Regex 處理函式 `renderMarkdownContent`。該函式僅能處理極簡單的標題與列表，無法解析複雜的多維表格或帶語言參數的代碼塊結構。
    2. 雙重渲染機制（Dual-Rendering Architecture）導致編輯體驗與檢視體驗分裂。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **直接採用 BlockNoteView 唯讀模式作為靜態檢視器**：
       將靜態檢視器統一透過 `BlockNoteView` 搭配 `editable={false}` 實裝：
       ```tsx
       export const NotionViewer: React.FC<{ content: any }> = ({ content }) => {
         const text = typeof content === 'string' ? content : content?.text || '';
         if (!text.trim()) {
           return <span style={{ color: '#64748b', fontStyle: 'italic' }}>尚無內容</span>;
         }
         return <NotionEditor value={text} editable={false} showActions={false} minHeight="auto" />;
       };
       ```
    2. **保證渲染同構**：
       凡富文字/區塊化編輯器（如 BlockNote, Lexical, Tiptap），檢視端必須共用相同的 Parser 與 Renderer（僅關閉交互輸入功能），徹底杜絕手寫 Markdown 正則解析器的退化風險。

---

## 6. BlockNote 擴充 Schema 覆蓋與語言切換器 UI 顯眼化 (2026-09-11)
### Code Block 缺乏語言切換下拉選單與語法著色未生效 (CodeBlock Spec Override & UI Visibility)
*   **痛點 / 現象**：
    1. 安裝了 `@blocknote/code-block` 後，在編輯器中插入代碼塊，既看不到程式語言切換下拉選單，語法也沒有任何著色效果。
    2. 即便在底層 DOM 中生成了 `<select>`，在畫面上也幾乎無法看見或點擊。
*   **根因分析**：
    1. BlockNote 官方預設的 `defaultBlockSpecs.codeBlock` 是陽春型代碼塊，不自帶語言選擇器與 Shiki 高亮。光是在 `extensions: [syntaxHighlighter]` 加入擴充不足以激活自訂語言清單，必須主動透過 `BlockNoteSchema.create().extend({ blockSpecs: { codeBlock: createCodeBlockSpec(codeBlockOptions) } })` 覆蓋預設的 codeBlock 規格。
    2. BlockNote 原廠 CSS 將代碼塊右上角的 `<select>` 設置為 `opacity: 0`，且預設透明度延遲達 1 秒，用戶很難發現滑鼠移入時才能點擊切換。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **Schema 顯式註冊**：
       ```ts
       const customSchema = BlockNoteSchema.create().extend({
         blockSpecs: {
           codeBlock: createCodeBlockSpec(codeBlockOptions),
         },
       });
       const editor = useCreateBlockNote({
         schema: customSchema,
         extensions: [syntaxHighlighter],
       });
       ```
    2. **自訂高對比 Badge Button 樣式**：
       透過 CSS 將 select 包裝為常駐於 Code Block 右上角的高對比深藍色 Badge 按鈕（`opacity: 1 !important; appearance: auto !important; background-color: #21262d; color: #58a6ff;`），讓用戶一目了然並可快速切換 40+ 種程式語言。

---

## 7. 富文字編輯器 NodeView DOM 隔離與序列化污染防範 (2026-09-11)
### 額外 UI 標籤洩漏至 Markdown 字串 (Serialization Bleed in Custom Blocks)
*   **痛點 / 現象**：
    1. 在先前嘗試為代碼塊添加頂部 Header 與語言切換器時，編輯完成並儲存至資料庫的 Markdown 內容開頭居然夾雜了組件內的標題文字，如：
       ```markdown
       CODE BLOCKJavaScript```
       const x = 1;
       ```
       導致下次讀取時文字損壞，視覺也出現重複的 "CODE BLOCKJavaScript" 標籤。
*   **根因分析**：
    1. 在 ProseMirror / TipTap / BlockNote 架構中，若在自訂渲染容器內未明確宣告 `contentEditable={false}`，或者在 Markdown 序列化外掛 (`tiptap-markdown` 或 `blocksToMarkdownLossy`) 掃描 DOM Tree / Node 時，將純屬操作界面的 UI 元素（如標題字元、按鈕、下拉選單）視為文檔文字節點 (TextNode) 一併序列化導出。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **使用 NodeViewWrapper 與 NodeViewContent 嚴格隔離邊界**：
       在 TipTap / Novel 中，頂部 UI 控制項必須宣告 `contentEditable={false}`，且真正的文字輸入區必須以 `<NodeViewContent as="code" />` 包覆：
       ```tsx
       <NodeViewWrapper>
         <div contentEditable={false}>
           {/* UI 工具列、搜尋彈窗、語言選擇器 */}
         </div>
         <pre>
           <NodeViewContent as="code" className={`language-${currentLang}`} />
         </pre>
       </NodeViewWrapper>
       ```
       這樣 ProseMirror 與 Markdown 序列化器便只會選取 `<NodeViewContent>` 內部的純粹代碼內容，徹底隔絕 UI 文字污染。
    2. **自建 Input Search + Dropdown Box 彈窗而非依賴陽春原生 Select**：
       原生 `<select>` 在客製化外觀、搜尋幾十種程式語言時體驗受限。透過獨立的浮動彈窗組件，內建 `searchTerm` 即時過濾陣列，搭配 `useRef` + `mousedown` 監聽器實現點擊外部自動收起，可提供類似 VS Code 與 Notion 的極致搜尋切換體驗。
