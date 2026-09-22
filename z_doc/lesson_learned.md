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

---

## 14. 結構化記憶對齊管線 (Structured Memory Reconciliation) 與會議 discusses 網狀圖譜鏈接 (2026-09-21)
### 對話 LaTeX/Markdown 分段標題被誤認為偽工單、且會議詳情頁無關聯工單 (Markdown Heading Poisoning & Missing Meeting Graph Linkage)
*   **痛點 / 現象**：
    1. 當 AI 在對話中輸出 Markdown 溯源路徑或分段標題（例如 `$\rightarrow$ 'Requirement'`, `**Requirements**:`, `**User Stories**:`）時，被後端文本提取器誤認為是獨立工單項目，並且全部預設為 `Objective`，一次性爆出 8 張空無一物的假目標工單。
    2. 會議工單（Meeting）雖然在內文中完整列出了 Traceability 表格，但點開會議工單詳情時，「Related items (關聯工單)」完全為空，會議與所產生的具體任務相互孤立。
*   **根因分析**：
    1. **缺乏結構化分階段管線 (Single-Shot Overload)**：過去將候選項目提取、去重、語意比對與圖譜構建全部塞在一次 LLM 提示詞中，當 LLM 丟失標籤時觸發粗暴正則掃描，誤把 Markdown 格式文字當作待建立項目。
    2. **會議網狀拓撲未自動注入**：過去會議工單在生成時，未將同批次生成的其他非會議工單自動加入 `relation_item_uid: [{ relation: 'discusses', item_uid: ... }]`。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **實裝 8 階段解耦記憶對齊管線 (`backend/src/services/reconciliation/`)**：
       - `meetingParser.ts` ➔ `candidateNormalizer.ts` ➔ `memoryRetriever.ts` ➔ `itemReconciler.ts` ➔ `graphValidator.ts`。
       - 嚴格落實 R001~R014 驗證規則，每項候選工單必須精確分配 `CREATE`、`UPDATE`、`NO_CHANGE`、`REVIEW_REQUIRED`、`IGNORE` 之一。
    2. **偽標題專屬過濾器 (`isJunkHeadingOrPreamble`)**：
       物理阻斷 LaTeX 箭頭、分段大綱與分析性中繼文字。
    3. **會議網狀關聯自動鏈接器**：
       在 Supervisor Critic 與 Graph Validator 中自動為 Meeting 注入同批次所有子工單的 `discusses` 關聯，並在 `items.ts` 批次寫入時解析為精確 UUID。

---

## 15. 階層強迫補全偏差 (Hierarchy Completion Bias) 與來源帳本基數控制 (Source Ledger Cardinality Control) (2026-09-21)
### 會議 14 項條目膨脹為 32 項工單、虛構 User Story 與幽靈分支 (Hierarchy Hallucination & Ghost Branch Proliferation)
*   **痛點 / 現象**：
    1. 用戶輸入結構分明的 14 項會議條目（1 Objective, 2 Requirements, 1 User Story, 3 Tasks, 2 UATs, 2 Decisions, 1 Bottleneck, 2 Milestones），AI 卻產生了 32 項工單爆炸。
    2. **語意類型篡改**：AI 將 `[Decision]` 與 `[Bottleneck]` 擅自改寫為 `Requirement ➔ User Story ➔ Task`。
    3. **無中生有**：Requirement 2 原文只有 Task，AI 卻憑空編造出不存在的 User Story。
    4. **幽靈分支**：出現空的、重複的 Objective 分支（如 `TPM-253` 與 `TPM-256` 衝突）。
    5. **標題截斷與指派失敗**：`[UAT-01]` 標題被粗暴截斷為 `01]`，`(指派給: Kevin Lau)` 因 `指派給:` 前綴無法匹配成員。
*   **根因分析**：
    1. **LLM 的「階層強迫補全偏差」**：LLM 習慣性將所有輸入強行補齊為 5 層樹（Objective ➔ Requirement ➔ User Story ➔ Task ➔ UAT），忽視了「局部拓撲 (Incomplete Branch)」在敏捷會議中的合理性。
    2. **多 Agent 競爭生成導致空分支**：主提示詞與子 Agent 各自生成 Objective，合併時未進行空分支修剪。
    3. **正則過濾器過度清洗**：`cleanTitle` 盲目清除 `[uat`，導致 UAT 案例編號損毀。
---

## 16. 追溯規劃與工單創建之職責混淆 (Traceability Planner Boundary Confusion) 與 39 項工單膨脹根治 (2026-09-21)
### 會議文件 15 項條目被系統膨脹生成 39 項提案 (Synthetic Item Inflation & Matrix Generation Bug)
*   **痛點 / 現象**：
    1. 當用家輸入 15 項源頭條目的會議記錄（`1_first_meeting.md`）時，系統竟產出了 39 個工單建立提案（膨脹率高達 260%）。
    2. 追溯規劃器試圖將每一項工單強制納入 `Objective ➔ Requirement ➔ User story ➔ Task ➔ UAT` 完整鏈路，在沒有 User Story 的需求下捏造虛構故事。
    3. 主路由提取器與 Spine / Decision / Charter 多專家並行輸出時，因微小標題措辭差異（如「實現核驗端點」vs「開發核驗端點」）導致工單未被去重，被直接疊加成倍暴增。
*   **根因分析**：
    1. **Traceability Planner 的職責越界**：將「追溯矩陣檢視 (Traceability View)」誤當作「工單生成器 (Item Generator)」，違反了 `SOURCE FIDELITY > HIERARCHY COMPLETENESS` 原則。
    2. **去重邏輯過於脆弱**：`supervisorCritic.ts` 僅使用簡單字串 Set 比對，無法識別語意相同但措辭微異的候選項目。
    3. **批評審核器的根節點強迫補建**：在沒有檢測到頂層 Objective 時，Critic 擅自在批次開頭插入合成的偽 Objective。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **最高優先級法則硬鎖定**：
       ```
       SOURCE EVIDENCE > SEMANTIC FIDELITY > EXISTING MEMORY > RELATIONSHIP INFERENCE > HIERARCHY COMPLETENESS
       ```
    2. **Traceability Planner 唯關聯契約 (Relationship-Only Contract)**：
       - 追溯規劃的輸入為 `(Source Ledger Candidates, Existing Items)`，輸出 **僅限** 關聯關聯矩陣（`parent_child` / `discusses`）。
       - 嚴格禁止 Traceability Planner 輸出任何 `CREATE_ITEM`，若某需求缺少 User Story，Task 100% 直連 Requirement，空欄位（`-`）為合法狀態。
    3. **跨專家語意去重器 (`isSemanticDuplicate`)**：
       - 實裝基於 Token Jaccard Overlap (>= 0.45) 的語意實體合併機制，將子專家的輸出定位為現有候選項目的「描述與屬性增強 (Enrichment)」，徹底物理阻斷項目疊加新增。
    4. **基數守恆自動化回歸測試 (`reconciliation.test.ts: TEST 16`)**：
       - 強制要求 15 項來源輸入經過完整 Multi-Agent 審核後，最終提案工單數必須精確維持 15 項，超額立即觸發測試失敗。

---

## 17. 來源事實證據綁定 (Source Evidence Grounding) 與多代理人外溢防護 (Multi-Agent Candidate Ledger Sovereignty) (2026-09-21)
### 提案階段 21 項膨脹問題、章節標題誤判與子專家外溢漏洞 (Proposal Inflation, Heading Leaks & Sub-agent Spillage)
*   **痛點 / 現象**：
    1. 在修復 39 項階層強迫補全問題後，`1_first_meeting.md`（實際包含 15 項事實條目）在提案生成階段仍產生了 21 個項目，超出 6 個未經來源授權的工單。
    2. **章節大綱誤判**：`1. 專案章程總體目標` 作為 Markdown 標題，被 Charter Agent 誤判為獨立的 Charter 工單。
    3. **類型雙重發行 (Double Issuance)**：`[User Story]` 條目被同時間識別為 User Story 並額外產生一個重複的 Task。
    4. **決策細節拆分**：決策條目中的附帶說明（如 Neon pgvector / SQLite）被拆分為兩個重複 Decision。
    5. **UAT 位置依賴錯位**：提取器使用單一變數 `currentParentTask` 記錄上下文，導致所有 UAT 皆錯誤錨定至最後一個 Task，破壞了事實拓撲。
*   **根因分析**：
    1. **缺乏來源事實證據 (Source Evidence) 的物理鏈接**：工單只具備 Title，沒有強制關聯回來源文件中的章節、行號與具體引用。
    2. **多代理人批次追加外溢 (Ledger Leakage)**：Supervisor Critic 在接收到子代理人回傳的新項目時，允許透過 `existingBatch.items.push(item)` 任意追加，繞過了源頭帳本的基數約束。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **來源帳本主權 (Source Ledger Sovereignty)**：
       - 以 `extractSourceLedgerFromText` 作為唯一事實依據 (Single Source of Truth)，為每筆候選工單賦予唯一的 `proposalItemId`（如 `P001-I01`）與 `sourceEvidence`。
       - 在管線中加入硬基數檢驗（Hard Cardinality Check），提案結果若與候選清單基數不符直接終止。
    2. **子專家唯增強模式 (Sub-agent Enrichment Only)**：
       - 嚴格限制子專家（Spine, Decision, Charter 等）僅能增強與既有候選項目標題語意匹配的描述或屬性，絕對禁止直接向批次追加未授權項目。
    3. **事實證據 UAT 拓撲錨定 (Evidence-Based Topology)**：
       - UAT 候選項目在提取時不預設位置依賴的 `parentRef`，改由 `graphValidator.ts` 依據其描述的事實證據（如「500人次/壓力/核驗」錨定至核驗任務；「斷網/容災」錨定至通訊閘門任務）進行拓撲綁定。

---

## 18. AI 語意推理與後端確定性事務解耦及寫入後狀態二度驗收 (AI Reasoning vs Application Determinism & Post-Write DB Verification) (2026-09-21)
### 提案與資料庫狀態漂移、欄位語意混淆及寫入無驗證風險 (State Divergence, Field Pollution & Unverified DB Persistence)
*   **痛點 / 現象**：
    1. **提案與資料庫實際狀態漂移**：AI 提案顯示 15 項工單，但寫入資料庫後因缺乏事務二度驗收，出現工單丟失、欄位殘缺卻依然向用戶回報「成功建立 15 項」。
    2. **欄位多重意義污染**：
       - `parent_item_uid` 曾被填入工單標題而非 UUID；
       - `item_follow_by` 曾混入專案 UUID 或關聯關係而非純淨的成員 UUID。
    3. **會議內容丟失**：建立的會議工單只有標題與來源證據，遺失了會議原始全文內容、會議日期與與會人員。
    4. **UAT 標籤格式破碎**：提取出 `01] 500人次壓力測試` 之殘缺標題。
    5. **重複文件上傳無防護**：重複上傳同一個會議文件會產生雙倍重複工單。
*   **根因分析**：
    1. **過度依賴 LLM 單次端到端生成**：將 UUID 生成、外鍵解析、查重邏輯等應該由後端確定性程式負責的工作交給 LLM 處理。
    2. **缺乏資料庫寫入後驗收機制 (No Post-Write Verification)**：前端點擊 Apply 後，後端直接回傳成功，未從資料庫重新查詢比對資料完整性。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **確定性管線分離原則 (Application Determinism)**：
       ```
       Document ➔ Normalize (SHA-256 Hash) ➔ Extract (Stage A: CAND-xxx) ➔ Validate Extraction
       ➔ Match against DB (Doc Hash / Item Match) ➔ Traceability Planner (Stage B: parentCandidateId)
       ➔ Validate Proposal ➔ Transactional DB Write (CAND-xxx ➔ Real UUID) ➔ Re-read DB
       ➔ Post-Write Verification (Compare DB vs Proposal ➔ APPLIED_AND_VERIFIED)
       ```
    2. **欄位單一責任嚴格鎖定**：
       - `item_follow_by`：僅存成員 UUID，由 `resolveMemberUid` 解析。
       - `parent_item_uid`：僅存真實父工單 UUID，由 `candidateUidMap` 映射。
       - `item_content`：會議工單保存完整原文、日期、出席者與文件雜湊。
       - `sourceLabel` 與 `title` 徹底純化分離。
    3. **寫入後二度驗收機制 (`verifyDatabaseState`)**：
       - 寫入後立即執行 `SELECT` 重新載入剛寫入的工單記錄，比對總數、類型、標題、父級 UUID 與指派人 UUID。若有任何不吻合，回傳 `APPLIED_WITH_VERIFICATION_ERRORS` 並詳列 mismatches。

---

## 19. 提案編譯器統一、關聯語意純化與跨層拓撲確定性錨定 (Canonical Proposal Object Unification & Traceability Integrity) (2026-09-22)
### 提案物件多重表示、模糊標題覆寫破壞拓撲及父子直連錯位問題 (Multiple Proposal Schemas, Destructive Fuzzy Parent Overwriting & Hierarchy Misalignment)
*   **痛點 / 現象**：
    1. **多個模組各自手動組裝提案物件**：`copilot.ts`、`supervisorCritic.ts`、`proposalPipeline.ts` 各自手動轉換候選項目，導致 `parentProposalItemId` 等關鍵關聯欄位在傳遞中丟失。
    2. **Supervisor Critic 模糊比對破壞既有拓撲**：Supervisor Critic 的後處理階段使用標題模糊比對，將原本由 `graphValidator` 驗算出的確定性候選 ID 覆寫為中文字串標題，且在只有 1 個 User Story 時採用暴力 fallback（`allStoryCandidates[0]`），導致 Task Edmond（WebSocket 硬件通訊）被錯誤掛載至 User Story 1（登機旅客體驗）。
    3. **`parentItemUid` 欄位語意混淆**：提案中將純文字標題填入 `parentItemUid`，混淆了「尚未建立之同批父項目提案引用」與「已存在於 DB 中的工單 UUID」。
*   **根因分析**：
    1. **缺乏全鏈路統一的 Canonical Proposal 物件流通**：未將 `executeReconciliationPipeline` 的回傳值作為前端預覽、後端審批與資料庫套用的 Single Source of Truth。
    2. **Supervisor Critic 缺乏對標準 Canonical Proposal 的主權豁免**：管線後期的啟發式聚合邏輯無差別地作用於已通過 Stage A+B+C 驗證的結構化提案。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **全鏈路標準 Canonical Proposal 結構貫通**：
       - 嚴格要求 AI 提案生成、Canvas 預覽、點擊 Apply 與資料庫事務寫入皆使用相同的 `CanonicalProposal` / `ProposedItem` 物件。
       - 引入 `proposalItemId`（`P001-I01` ~ `P001-I15`）與 `parentProposalItemId`（`P001-I02` 等），使批次內部的父子鏈在尚未產生資料庫 UUID 前具備唯一且穩定的引用標識。
       - `parent_item_uid` 僅允許存放真實 DB UUID，提案階段一律置為 `undefined`。
    2. **Supervisor Critic Canonical Proposal 主權保護 (Sovereignty Bypass)**：
       - 若偵測到提案具備 `canonicalProposal` 或包含 `proposalItemId`，自動豁免破壞性標題模糊重寫與 fallback 覆蓋，保留由事實證據驅動的跨層拓撲。
    3. **跨層直連與事實證據綁定 (Direct Cross-layer & Evidence Grounding)**：
       - Task Edmond（`WebSocket/MQTT`）直接掛載至 Requirement 2（`Gate Controller Protocol`），完全支援合法缺層拓撲。
       - UAT-01（`500人次連續壓力測試`）精確掛載至 Task Kevin（`核驗端點`）；UAT-02（`斷網容災切換測試`）精確掛載至 Task Edmond（`WebSocket/MQTT`），關聯狀態標記為 `CONFIRMED`。

---

## 20. 提案完整性強化、零標題 ID 映射與事實守恆防禦 (Proposal Integrity Hardening & Zero-Title UUID Resolution) (2026-09-22)
### 標題洩漏至外鍵、欄位混用污染、無中生有幻覺及行動項目遺失 (Title Leaks in Foreign Keys, Field Polymorphism Pollution, LLM Hallucinations & Lost Action Items)
*   **痛點 / 現象**：
    1. **字串標題洩漏至關聯外鍵**：`parentItemUid` 或關聯陣列曾被填入人類可讀標題（如 `"打造全球領先新一代生物辨識自動登機門 (SBG)"`），造成前端與資料庫外鍵關聯異常。
    2. **欄位多重定義污染 (`itemFollowBy` 濫用)**：`itemFollowBy` 在不同邏輯下被誤用為專案 ID、字串姓名或關係標識，破壞了其作為「專案成員 UUID」的唯一職責。
    3. **LLM 腦補添加無佐證數據 (Unreferenced Hallucinations)**：LLM 在解析 Objective 或 User Story 時，擅自加上原文未提及的「52 分鐘非計劃停機」或「200ms 後端核驗」等具體技術指標。
    4. **技術瓶頸中隱含之明確行動項目丟失**：原文「需由 Kevin 負責構建 Local Cache Worker 進行預先拉取緩存」被當作純文字塞入 Bottleneck 描述中，未被轉化為可執行的 Task 工單。
    5. **虛構無依據之 UAT 父子關聯**：對於原文未明確指明父級的 UAT-02 項目，過往系統會隨機或暴力綁定至某個 Task，違反了「事實真實性 > 階層完整性」原則。
*   **根因分析**：
    1. **提案階段與資料庫階段 ID 語意未徹底解耦**：在工單尚未持久化至 DB 取得 UUID 前，直接拿標題當作批次內的引用識別符，導致標題字串沿管線穿透至資料庫寫入層。
    2. **缺乏對 `item_follow_by` 的強型別約束校驗**：未在資料庫執行器（`dbExecutor`）入口對成員 UUID 做嚴格正則格式（UUID v4）校驗。
    3. **Prompt 允許自由衍生**：缺乏對事實證據（`SourceEvidence`）的硬性約束與反幻覺防護機制。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **零標題 ID 鐵律 (Zero Titles As IDs)**：
       ```typescript
       // 提案階段：僅使用 proposalItemId (如 P001-I01) 與 parentProposalItemId
       export interface CanonicalProposalRelation {
         fromProposalItemId: string; // "P001-I04"
         toProposalItemId: string;   // "P001-I02"
         relationshipType: 'child_of' | 'blocks' | 'mitigates' | 'discusses';
       }
       // 執行階段：由 candidateUidMap 確定性映射至真實 PostgreSQL UUID
       ```
    2. **`item_follow_by` 專屬邊界鎖定**：
       - `dbExecutor.ts` 引入 `isValidUuid`，若傳入非 UUID 格式的字串一律不寫入 `item_follow_by`，強制要求必須先通過成員表查詢解析出真實 `member_uid`。
    3. **事實守恆與反幻覺工程 (Source Fidelity & Fact Cleaning)**：
       - 嚴格比對原文，清理所有未經原文授權的衍生數據。
       - 提取 Bottleneck 內明確指派負責人的行動為獨立 Task，標記關聯為 `mitigates`。
    4. **合法孤立 / NEEDS_REVIEW 機制**：
       - 對於無明確事實證據的關聯（如 UAT-02），保留 `parentCandidateId: undefined` 並標註 `needsReview: true`，誠實反映源頭資訊邊界。

---

## 21. React 富文本編輯器受控回流破壞 ProseMirror 選取與游標跳轉修復 (Rich Text Controlled Prop Loop & ProseMirror Selection Retention) (2026-09-22)
### 在 Table 等複雜區塊打字時游標突然跳轉至底部儲存格 (Cursor Jumping to Document End in Table Cells)
*   **痛點 / 現象**：
    1. 使用者在「編輯項目範本」(`TemplateModal`) 或工單詳情 (`ItemDrawer`) 的富文本 Markdown 表格（如 L1 / L2 / L3）輸入文字時，打字打到一半游標突然失去焦點並瞬間「飛移跳轉」至表格最底部儲存格，導致輸入內容被截斷或錯位。
*   **根因分析**：
    1. **受控組件死循環與非同構回流 (Controlled Props Loop in Rich Text)**：
       - `NovelEditor`（基於 TypeCellOS/BlockNote + ProseMirror）在使用者輸入時透過 `editor.blocksToMarkdownLossy` 生成 Markdown 字串並呼叫 `onChange(md)`。
       - 父組件（如 `TemplateModal`）收到 `onChange` 後更新 React state，觸發父組件 re-render，並將剛生成的 `md` 作為 `value` prop 重新傳回 `<NovelEditor value={md} />`。
    2. **內部快取狀態未同步與防護失效**：
       - 舊版代碼在發送 `onChange(md)` 時未同步更新 `lastLoadedValueRef`，在 800ms debounce 解除後，`useEffect` 檢測到 `value !== lastLoadedValueRef.current`，誤判定為「外部傳入了新資料」。
       - 於是執行了 `editor.replaceBlocks(editor.document, blocks)`，全量銷毀並重建了整個 DOM 結構與 Table 節點，導致 ProseMirror 舊有的選取範圍 `{ from, to }` 失效，游標被迫 fallback 到文檔末尾（表格最後一格）。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **三道守衛原則 (Triple Guard for Rich Text State Sync)**：
       ```typescript
       // 1. 內部編輯標記守衛
       if (isInternalChangeRef.current) return;

       // 2. 產出內容同值守衛 (Self-Emitted Echo Guard)
       if (value === lastEmittedValueRef.current || value === lastLoadedValueRef.current) return;

       // 3. 焦點保護守衛 (Active Focus Guard)
       if (editable && editor.isFocused()) return;

       // 僅在上述條件皆不滿足（確認為外部切換項目或範本）時，才呼叫 replaceBlocks
       if (!initializedRef.current || value !== lastLoadedValueRef.current) {
         loadContent();
       }
       ```
    2. **即時同步 Emitted / Loaded 快取**：
       - 每次 `blocksToMarkdownLossy` 產出 Markdown 後，立即賦值 `lastEmittedValueRef.current = md` 與 `lastLoadedValueRef.current = md`，杜絕任何延遲造成的二次重新解析。

---

## 22. 證據驅動之元素級語義比對與衝突偵測自省防護 (Evidence-First Field-Level Diffing & Non-Self-Conflicting Memory Retrieval) (2026-09-22)
### 全量覆蓋式工單更新、動作決策過早綁定與自指衝突誤判 (Full Item Overwrite, Premature Action Decisions & Self-Conflict False Positives)
*   **痛點 / 現象**：
    1. **動作決策過早與抽取耦合 (Premature Action Decision)**：若在抽取階段（Stage A）就直接標定 `CREATE` 或 `UPDATE`，在缺乏資料庫既有工單記憶的上下文下，必然導致重複建立或錯誤覆寫。
    2. **粗粒度全量替換 (Destructive Full Replacement)**：當某張已存在工單僅修改截止日期或指派人時，若系統將其視為整筆工單更新，容易遺失既有富文本內容、歷史關聯或手動自訂欄位。
    3. **語義衝突檢測的自我衝突誤判 (Self-Conflict False Positive)**：當既有 Decision 工單內文已包含「淘汰舊版方案」等字眼時，比對檢索器若未比對內容是否一致，會誤將「重複上傳的相同決策」判定為與自己衝突（`CONFLICT`），導致無法被識別為 `NO_CHANGE`。
*   **根因分析**：
    1. **職責邊界不清**：抽取階段應只負責提取源頭事實（`SourceEvidence`），不應涉足資料庫變更邏輯。
    2. **缺乏屬性層級 Diffing 模型**：未將資料庫工單欄位拆解為可單獨比對之屬性集合（`FieldDiff`）。
    3. **衝突檢測未排除等價自我**：衝突偵測正則僅匹配了關鍵字（如 `淘汰`、`deprecated`），未先排除 `rawExistingContent === candContent` 的完全一致情況。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **抽取與動作徹底解耦 (Extraction ≠ Action Decision)**：
       ```typescript
       // Stage A: 僅提取純粹事實候選，標註來源證據
       const ledger = extractSourceLedgerFromText(text, members);
       // Stage B: 檢索現有資料庫項目，進行多信號比對與屬性級 Diffing
       const reconciled = candidateList.map(cand => reconcileCandidate(cand, existingItems, members));
       ```
    2. **元素級屬性 Diffing 隔離 (`FieldDiff`)**：
       - 分別比對 `item_title`、`description`、`assignee`、`due_date`、`item_priority`、`item_status` 與 `parent_item_uid`。
       - 僅對產生實質變化的屬性輸出 `FieldDiff`，資料庫執行器只針對這些欄位生成精準的 `SET field = $val` SQL 語句。
    3. **衝突檢測非自身等價防護 (Non-Self-Conflict Guard)**：
       - 在 `memoryRetriever.ts` 中加入守衛：`rawExistingContent && candContent && rawExistingContent.trim() !== candContent.trim()`，只有在內容實質不同且宣告取代既有方案時才觸發 `CONFLICT`。
    4. **全套 18 項自動化回歸測試防護**：
       - 持續透過 `vitest` 回歸驗收，保障 16 項標準會議條目、單一屬性 Diff、顯式糾正與跨層拓撲的穩定性。

---

## 23. 跨存儲拓撲外鍵解析、Markdown 標題行比對失真與既有決策衝突誤判 (Cross-Storage Topology Foreign Key Resolution, Markdown Heading Diff Distortion & Existing Decision False Conflicts) (2026-09-22)
### 子項目依賴既有 DB 父項目外鍵丟失、Markdown 標題行導致 Diff 誤判與相同決策自指衝突 (Cross-Storage FK Loss, Heading Diff Distortion & False Self-Conflict)
*   **痛點 / 現象**：
    1. **新建子項目依賴既有 DB 父項目外鍵丟失 (Cross-Storage Foreign Key Loss)**：
       - 當系統執行部分更新時（如既有專案已有 Bottleneck `uuid-btn-001`，而會議提取出的「Local Cache Worker」為新建 Task），拓撲驗證器 `graphValidator` 過去僅在 `creates` 內部建立 `candidateIdMap`，無法在既有資料庫項目中查得 `uuid-btn-001`，導致新建子工單的 `parent_item_uid` 丟失或無法正確掛載至既有父項目。
    2. **Markdown 標題行差異導致內文 Diff 誤觸 (Markdown Heading Diff Distortion)**：
       - 抽取器在提取 Bottleneck / Decision 等候選條目時，格式化輸出了 `### 技術阻礙與瓶頸：xxx\n` 標題行；但既有資料庫內存儲的為純文字內容。比對器在比較字串長度與內容時，誤將這段 Markdown 標題視為「會議提供了補充實作細節與描述」，產生了不必要的 `field: description, action: UPDATE`。
    3. **相同決策因內含「淘汰方案」被自指為衝突 (False Conflict in Self-Same Decision)**：
       - 既有 Decision 工單已定案為「採用 Neon PostgreSQL + pgvector，淘汰舊版 Redis 方案」。會議記錄再次提及該決策時，比對器因比對未剝離標題行判定內容不完全相等，並匹配到「淘汰」關鍵字，誤將其判定為 `CONFLICT`，導致既有工單無法進入 `NO_CHANGE`。
*   **根因分析**：
    1. **拓撲驗證未覆蓋混合態 (Hybrid State Blind Spot)**：拓撲映射必須同時理解「新建立的條目（透過 Candidate ID）」與「資料庫既有的條目（透過 DB UUID）」，方能實現跨存儲拓撲掛載。
    2. **比對未做語意層正規化**：Markdown 渲染標題行（如 `### `）屬於視圖呈現，不代表本質業務語意差異。
    3. **衝突檢測缺乏實質語意等價守衛**：宣告「淘汰舊方案」是架構決策的普遍描述，只有當候選條目宣告淘汰或取代「既有工單自身所代表的方案」時，才構成衝突。
*   **解決方案與防禦架構 (Defensive Solution)**：
    1. **全景 Reconciled Map 跨存儲外鍵解析 (`graphValidator.ts`)**：
       ```typescript
       // 同時索引所有 Reconciled 項目 (含 CREATE, UPDATE, NO_CHANGE)
       const reconciledMap = new Map<string, ReconciledCandidate>()
       reconciled.forEach(r => reconciledMap.set(r.candidate.candidateId, r))

       // 當候選項目之父級指向已存在之資料庫項目時，即時解析真實 DB UUID
       if (parentRec?.action === 'NO_CHANGE' || parentRec?.action === 'UPDATE') {
         req.parentItemUid = parentRec.existingItemUid
       }
       ```
    2. **Markdown 標題剝離正規化 (`stripHeaderAndSpaces`)**：
       ```typescript
       const stripHeaderAndSpaces = (s: string) => {
         const withoutHeadings = s.replace(/^#{1,6}\s+[^\n]+(\r?\n|$)/gm, '')
         const base = withoutHeadings.trim().length > 0 ? withoutHeadings : s
         return base.replace(/\s+/g, ' ').trim().toLowerCase()
       }
       ```
       - 在 `itemReconciler.ts`（內文比對）與 `memoryRetriever.ts`（衝突偵測）中統一先調用該正規化邏輯，消除標題行排版帶來的 Diff 噪音。
    3. **實質差異守衛防護 (Substantial Difference Guard)**：
       - 只有在去除標題後實質內容不同、且互非子集合的情況下，才允許觸發廢棄與衝突警報。
    4. **SCENARIO 18 確定性部分初始化 SBG 專案測試 (Deterministic Partially-Initialized Project Test)**：
       - 植入 7 筆既有 SBG 工單，端到端驗證 5 筆 `NO_CHANGE`、2 筆 `UPDATE`、8 筆 `CREATE`（含跨層掛載的 Local Cache Worker）與 1 筆 `NEEDS_REVIEW`，全套 19 項測試 100% 通過。


