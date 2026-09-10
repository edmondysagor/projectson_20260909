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
