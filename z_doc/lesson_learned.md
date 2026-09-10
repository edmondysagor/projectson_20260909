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
