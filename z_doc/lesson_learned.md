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
       原生 `<select>` 在客製化外觀、搜尋幾十種程式語言時體驗受限。透過獨立的浮動彈窗組件，內建 `searchTerm` 即時過濾陣列，搭配 `useRef` + `mousedown` 監聽器實現點擊外部自動收起，可進行類似 VS Code 與 Notion 的極致搜尋切換體驗。

---

## 8. AI Copilot 多動作連鎖解析與批次一鍵入庫架構 (Multi-Action Pipeline & Global Action Extraction) (2026-09-13)
### 4合1 複雜指令只產出單一動作 / 其餘工單遺失 (Single Action Drop in Multi-Intent AI Generation)
*   **痛點 / 現象**：
    1. 用戶在 AI Copilot 觸發「🚀 Kick-off 啟航 (4合1)」或上傳複雜會議記錄要求同時更新 Project Charter 並建立 10+ 個 Milestone / Task / Bottleneck / Meeting 時，AI 回覆雖然生成了所有內容，但前端 Proposal 審查卡片只出現「Project Charter 更新」，其餘 10 項工單完全不見且無法一鍵套用。
*   **根因分析**：
    1. 後端 `routes/copilot.ts` 原本使用單次正規表達式匹配 `rawAiText.match(/<<ACTION>>[\s\S]*?<<\/ACTION>>/)`，只要匹配到第一個動作區塊（Charter 更新），解析器就立即 `break` 結束，導致後續的 `batch_proposal` 與關聯更新全部被截斷拋棄。
    2. 前端 `CopilotDrawer.tsx` 狀態結構 `actionPreview` 設計為單一物件，未能支援陣列多動作卡片管理與「一鍵依序執行全部」流水線。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **後端全域掃描與多動作陣列導出**：
       ```ts
       const globalActionRegex = /<<ACTION>>([\s\S]*?)<<\/ACTION>>/g;
       const actionPreviews: any[] = [];
       let globalMatch;
       while ((globalMatch = globalActionRegex.exec(finalAiText)) !== null) {
         try {
           const parsed = JSON.parse(globalMatch[1].trim());
           actionPreviews.push(parsed);
         } catch (e) {
           console.error('[Copilot] Failed to parse action block JSON:', e);
         }
       }
       ```
    2. **前端 Multi-Action 卡片與 Approve All 流水線**：
       在前端渲染多動作清單，標註 `(X/Y 已完成)`，並提供 `✨ 一鍵依序執行全部動作 (Approve All)`。點擊時自動遍歷尚未套用之動作，依序透過 `api.batchCreateItems`、`api.patchItem` 等非同步寫入 Neon DB，寫入完畢自動更新對話 Session 與分發全域重繪事件。

---

## 9. TypeScript 嚴格編譯 TS6133 宣告未使用變數阻斷部署與 Vite 構建防護 (2026-09-14)
### TS6133 'xxx' is declared but its value is never read (Dead Code in Strict Build)
*   **痛點 / 現象**：
    1. 在修改或重構前端組件（例如移除 `App.tsx` 中的「檢視身份模式」下拉選單）時，若僅註解或移除了 JSX 元素，但保留了 `const [activeViewMemberUid, setActiveViewMemberUid] = useState('ADMIN')` 中未被調用的 `setActiveViewMemberUid`，執行 `npm run build`（`tsc -b && vite build`）時會觸發致命錯誤：
       ```
       error TS6133: 'setActiveViewMemberUid' is declared but its value is never read.
       ```
       導致 CI/CD 流水線或 Cloudflare Workers 部署程序直接終止。
*   **根因分析**：
    1. 專案的 `tsconfig.app.json` 開啟了 `"noUnusedLocals": true` 與 `"noUnusedParameters": true` 嚴格靜態分析選項。任何宣告但未使用的局部變數、參數或 import，在 TypeScript 編譯器眼裡均視為編譯錯誤而非單純 warning。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **清除未使用的 Setters 與 Imports**：
       當某個 state 只需讀取固定初始值或唯讀常數時，應避免解構出多餘的 setter：
       ```tsx
       // ❌ 錯誤寫法（未調用 setter 觸發 TS6133）
       const [activeViewMemberUid, setActiveViewMemberUid] = useState<string>('ADMIN');

       // ✅ 正確寫法（若需保持 state 響應但暫不修改）
       const [activeViewMemberUid] = useState<string>('ADMIN');

       // ✅ 或若完全為固定值時轉為常數
       const activeViewMemberUid = 'ADMIN';
       ```
    2. **部署前統一執行 `npm run build` 驗證**：
       每次在執行 `wrangler deploy` 前，一律串聯 `npm run build && npx wrangler deploy`，第一時間由本機 TypeScript 編譯器攔截任何未使用的變數或類型不匹配，確保零錯誤交付。

---

## 10. Landing Page 與 SPA Protected Workspace 無縫路由導航與認證狀態預先判斷 (2026-09-14)
### 點擊 Enter 進入系統重複引導至登入頁或無跳轉 (Unnecessary Login Redirection for Authenticated Sessions)
*   **痛點 / 現象**：
    1. 當用家已經在瀏覽器登入系統後，返回 Landing Page 點擊 `ENTER MISSION CONTROL` 或 `LAUNCH SANDBOX DEMO`，若硬編碼為固定導向 `/auth/sign-in`，已登入用戶會被反覆彈回登入頁面，造成困惑與流暢度中斷。
*   **根因分析**：
    1. Landing Page 作為獨立對外展示頁面，若未注入全域認證狀態上下文 (`useAuth`)，按鈕事件便無法感知當前客戶端是否持有有效的 Token 或 Demo Session。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **智慧入口路由分流 (`handleEnterMissionControl`)**：
       在 Landing Page 中引入 `useAuth()`，於點擊事件中進行狀態前置判斷：
       ```tsx
       const { isAuthenticated } = useAuth();
       const navigate = useNavigate();

       const handleEnterMissionControl = () => {
         if (isAuthenticated) {
           navigate('/app');
         } else {
           navigate('/auth/sign-in');
         }
       };
       ```
    2. **登入後回跳保護**：
       在 `SignInPage.tsx` 登入成功後，一律導向 `/app`，形成「Landing Page -> 智能判斷 -> 已認證直達 `/app` / 未認證登入後自動入庫」的完美閉環體驗。

---

## 11. 開源 LLM 遺漏/損壞 Action 標籤之全頻譜語義自動救援 (Heuristic Structured Extraction & Token Limit Resilience) (2026-09-20)
### 開源/雲端大模型輸出 Markdown 工單清單但未彈出 Proposal 審批工作台
*   **痛點 / 現象**：
    1. 當使用 Gemma 4 31B (Ollama Cloud) 等開源模型進行專案 5 層溯源拆解或會議記錄工單化時，AI 雖然在對話中完整輸出了「User Story、Task、UAT」等清單，但對話底部卻完全沒有出現「📦 AI 綜合架構提案卡片」或審核按鈕，導致用家無法一鍵入庫。
*   **根因分析**：
    1. **Token Prediction 截斷**：Ollama Cloud API 預設輸出 token 上限較保守（預設 2048/4096），當 AI 寫了長篇 Markdown 解釋後，末端的 `<<ACTION>>` JSON 標籤容易被截斷或丟失。
    2. **缺乏結構化清單語義救援**：後端原本僅針對 `update_item` 進行語義兜底，當 `actionPreviews` 為空且 LLM 遺漏 `<<ACTION>>` 標籤時，未能自動從 Markdown 清單中反向解析出 `batch_proposal` / `create_item` 物件。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **全頻譜語義工單提取器 (`parseStructuredItemsFromText`)**：
       在後端 `copilot.ts` 中實裝正規化語義掃描器，精準捕捉 16 種合法工單類型（Objective, Requirement, User story, Task, UAT, Decision, Bottleneck 等），並自動提取標題、負責人、父子關聯及優先級，100% 自動重構為 `batch_proposal`。
    2. **JSON 自動補全修復 (`safeParseActionJson`)**：
       針對末端被截斷的 JSON 標籤，自動計算並補齊未閉合的括號（`]` 與 `}`），確保解析成功率。
    3. **提升 Token 預測上限 (`num_predict: 8192`)**：
       在 Ollama 與 DashScope API 調用時顯式配置 `num_predict: 8192` 與 `max_tokens: 8192`，避免大批量架構輸出時被截斷。

---

## 12. 5 層溯源矩陣多分支樹狀結構坍塌與模糊語義父級錨定 (Traceability Tree Collapse & Fuzzy Semantic Parent Anchoring) (2026-09-21)
### 會議紀要與矩陣落差 — 後續需求分支子工單丟失或全部坍塌至首個需求 (Child Items Collapsing into Index 0)
*   **痛點 / 現象**：
    1. 在 Copilot 的 Meeting Recap 說明中，AI 能夠清楚列出完整 5 層架構表格（如需求 1: 雙模態身份驗證、需求 2: 閘門硬件通訊、需求 3: 離線容災），且每個需求下方都有各自的 User Story / Task / UAT。
    2. 但實際寫入專案矩陣（`ProjectTraceabilityMatrix`）時，卻發現需求 2 與需求 3 下方空空如也，所有的子工單要麼沒生成，要麼全部被掛到「需求 1」底下。
*   **根因分析**：
    1. **Spine Agent 未強制全分支覆蓋**：Spine Agent 提示詞未強制約束「每個 Requirement 必須為各自生成專屬的 User Story/Task/UAT」，導致大模型在生成長文本時偷懶，僅為第一個需求拆解細節。
    2. **Supervisor Critic 的嚴格字串比對與錯誤 Fallback**：
       `supervisorCritic.ts` 在校驗 `parentItemUid` 時，僅使用嚴格等值比對 `item.parentItemUid.toLowerCase() === candidate.itemTitle.toLowerCase()`。當子工單寫的父級簡稱為「閘門通訊」，而父級完整標題為「實現閘門硬件與通行控制通訊協議」時，比對失敗，程式碼觸發了歷史兜底邏輯：
       ```ts
       // ❌ 過去的致命兜底：比對不到直接塞給第一個需求
       if (batchRequirements.length > 0) {
         item.parentItemUid = batchRequirements[0].itemTitle;
       }
       ```
       這導致所有後續需求的子任務被強制奪取並塞給了 Requirement 1，造成嚴重的樹狀拓撲坍塌。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **實裝三階語意模糊父級錨定器 (`findBestParentMatch`)**：
       ```ts
       const findBestParentMatch = (targetParentTitle: string, candidates: any[]): any | null => {
         if (!targetParentTitle || !candidates.length) return null;
         const target = targetParentTitle.trim().toLowerCase();

         // 1. 完全一致匹配
         const exact = candidates.find(c => c.itemTitle?.trim().toLowerCase() === target);
         if (exact) return exact;

         // 2. 子字串相互包含
         const sub = candidates.find(c => {
           const cTitle = c.itemTitle?.trim().toLowerCase() || '';
           return cTitle.includes(target) || target.includes(cTitle);
         });
         if (sub) return sub;

         // 3. 關鍵字詞元重疊度計分 (Token Overlap Jaccard Scoring)
         const targetTokens = target.split(/[\s,，、:：\-—_()（）[\]]+/).filter(t => t.length > 1);
         let bestMatch: any = null;
         let maxScore = 0;

         for (const cand of candidates) {
           const candTitle = cand.itemTitle?.trim().toLowerCase() || '';
           let score = 0;
           for (const token of targetTokens) {
             if (candTitle.includes(token)) score += token.length;
           }
           if (score > maxScore && score >= 2) {
             maxScore = score;
             bestMatch = cand;
           }
         }
         return bestMatch;
       };
       ```
    2. **Spine Agent 全分支骨幹剛性約束**：
       在 `spineAgent.ts` 提示詞中嚴格下達 `Full-Branch Tree Guarantee`，明確規定必須以「1 個 Objective ➔ 多個 Requirement ➔ 各自的 User Story ➔ 各自的 Task ➔ 各自的 UAT」進行完整分支拓撲展開。

---

## 13. 多目標平行溯源結構與會議出席者精準指派綁定 (Multi-Objective Traceability & Team Member Ingestion) (2026-09-21)
### 多商業目標被強行合併為單一空泛目標、且團隊負責人全部被默認指派給當前操作者 (Objective Over-Consolidation & Default Assignee Pollution)
*   **痛點 / 現象**：
    1. 用戶在會議紀錄中條理分明地定義了多個商業目標（例如：目標 1「縮短登機過閘至 2.5s」對應需求 1「雙模態身份驗證」；目標 2「達成 99.99% 可用性」對應需求 2「閘門硬件協議」）。但在 AI 生成矩陣時，卻被強行合成單一空泛目標（例如「打造全球領先的新一代系統」），導致業務目標的精準對稱性被破壞。
    2. 會議中明確使用括號指派負責人（如 `(Kevin)`、`(Sarah)`、`(Edmond)`），但在工單寫入時，所有 Task 均未被指派給 Kevin / Sarah，而是全部被預設寫成了操作者自己的帳號（或空值）。
*   **根因分析**：
    1. **Spine Agent 預設單一 Grand Objective 架構**：Spine Agent 提示詞未明確指示「當會議有多個商業目標時應生成多個 Objective 工單」，導致大模型自動把所有需求塞進同一個 Grand Objective。
    2. **負責人解析缺乏別名/名 (First Name) 與括號剝離容錯**：
       會議文本常用 `(Kevin)`、`Kevin` 指稱成員，而資料庫存儲之全名為 `Kevin Lau`。過去的 `resolveMember` 與 `supervisorCritic` 僅支援精確全名匹配，未對名字第一部分 (First Name) 與括號進行正則提取，導致匹配失敗後退回預設指派。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **多目標平行生成與語意父子錨定**：
       在 `spineAgent.ts` 中明確「多目標平行拆解死命令」，並在 `supervisorCritic.ts` 中支援多個 Objective 候選集的語意動態比對，實現精準的 1-to-1 目標到需求映射。
    2. **多級成員名稱解析器 (`resolveMember`)**：
       在 `supervisorCritic.ts` 與 `items.ts` 中升級成員解析算法：
       ```ts
       // 1. 精確 UID 匹配 ➔ 2. 全名 / Email 匹配 ➔ 3. First Name / 括號標籤剝離匹配 ➔ 4. 內嵌正則掃描
       const parts = m.member_name.toLowerCase().trim().split(/[\s_-]+/).filter((p: string) => p.length >= 2);
       for (const p of parts) {
         memberMap.set(p, m.member_uid);
       }
       ```

