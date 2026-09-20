# Projectson 開發日誌 (Development Log)

---

### Phase 7.12: All Items 工單總表新增 [全部專案] Project Multi-Select 篩選器 (2026-09-20)
*   **All Items 專案跨界篩選器 (Cross-Project MultiSelect Filter)**：
    *   於 `frontend/src/components/AdvancedTable.tsx` 工具列新增 `filterProjects` 狀態與專屬 `全部專案 ∨` 多選膠囊下拉選單。
    *   在工作區總表（All Items）視圖下，自動載入所有 Project 清單（包含代碼如 `[TPM-PRO-1] 專案名稱`），支援單選或多選特定專案進行跨工單檢視。
    *   此篩選與 List 列表、Kanban 看板、Timeline 時間軸與 Calendar 行事曆視圖 100% 全聯動，並在單一專案專屬頁面內自動隱藏多餘的專案下拉，保持介面極簡整潔。

---

### Phase 7.11: 單一專案章程智能聚合 (Single Charter Rule) 與標題 Markdown 格式全面剝離 (2026-09-20)
*   **單一專案章程智能聚合 (Single Charter Consolidation Rule)**：
    *   **根因剖析**：主 LLM 與 `charterAgent` 同時產生命名略有差異之章程（例如「專案章程 (Project Charter)」與「Projectson Phase 1 - 專案章程」），因字串比對不一致而未觸發普通去重，導致 Proposal Canvas 中出現兩張重複的 Charter。
    *   **修復措施**：於 `backend/src/agents/supervisorCritic.ts` 實裝 Rule 6.0.1（Single Charter Rule），強制 1 個專案批次僅保留 1 張核心 Project Charter，自動選取並合併內容最完整的表格，杜絕多張重複章程工單。
*   **工單標題 Markdown 格式全面剝離 (Robust Title Cleaner & Outline Filtering)**：
    *   強化 `cleanItemTitle`：徹底剝離包括 `Objective**: ...`、`**Requirement**: ...` 等所有帶有非對稱粗體或類型前綴的裝飾字串。
    *   強化 `isJunkConversationalItem`：過濾 AI 在文字中輸出的高階大綱式摘要條目（如「拆分為...」、「針對...建立...」），防止在真實研發工單上方生成重複的虛擬摘要鏈。

---

### Phase 7.10: 對話分析廢料物理過濾、單一會議單智能聚合與 5 層拓撲嚴格對齊 (2026-09-20)
*   **對話中繼分析廢料物理過濾 (Conversational Preamble & Junk Filtering)**：
    *   **根因剖析**：先前文字工單提取器 (`parseStructuredItemsFromText`) 將 AI 回覆中的分析標題列（如 `- **上載文件**：...`、`- **現有專案狀態**：...`、`- **增量分析**：...`、`- **結論**：...`、`- **鏈路 A/B**：...`）誤識別為多張 `Meeting` 或 `Requirement` 工單，導致單次會議 Recap 產生 6 張會議單與大量孤立假需求。
    *   **修復措施**：於 `backend/src/routes/copilot.ts` 與 `backend/src/agents/supervisorCritic.ts` 實裝嚴格正則過濾器 `isJunkConversationalItem`，徹底阻斷對話分析字串誤入工單流；並將 `itemTitle` 全面清洗為乾淨純文字（移除 `**`、`$`、LaTeX 與類型前綴）。
*   **單一會議紀要智能聚合 (Single Meeting Consolidation Engine)**：
    *   在 `supervisorCritic.ts` 實裝 Rule 6.0：單次 Recap 只能保留 1 張核心 `Meeting` 工單，若檢測到多張會議單則自動融合 Markdown 內文為單一完整紀要，徹底根絕「1 個會議拆出 6 張 Meeting 工單」的碎片化痛點。
*   **同批次多維別名拓撲索引升級 (Multi-Dimensional In-Batch Topology Ingestion)**：
    *   重構 `backend/src/routes/items.ts` 中 `POST /batch`：在 Pass 1 索引建立時同步註冊原始標題、純文字標題與類型前綴剝離（Stripped-Type）別名。
    *   在 `resolveItemUid` 採用統一標準化（去除符號、空白與類型前綴）模糊匹配，保證同批次內的所有 `Requirement` 100% 精準解析並物理鏈接至頂層 `Objective` 的真實 UUID，徹底消除 5 層追溯矩陣中的「待歸屬需求 (Unassigned)」斷層。

---

### Phase 7.9: 智能自適應專家集群架構 (Adaptive Specialist Swarm) (2026-09-20)
*   **自適應雙軌分流 (Adaptive Dual-Track Execution Engine)**：
    *   **Fast Track (簡單問答/單項修改)**：當用戶僅進行即時對話或簡易單項工單調整時，由 Main LLM + Supervisor Critic 直接完成審查與防呆，維持 1~2s 極速低延遲體驗。
    *   **Specialist Swarm (遇上載文件/Kick-off/複雜多工單拆解)**：檢測到文件附件或複雜拆解關鍵字時，自適應並行派發 (`Promise.all`) 給 3 大領域專家 Sub-Agents 執行精準解析。
*   **3 大領域專家 LLM 獨立執行體 (Dedicated Sub-Agent Executors)**：
    *   實裝 `backend/src/agents/llmClient.ts`：支援 Ollama Cloud / 本地 Ollama 與 DashScope / OpenAI-compatible API，內建 JSON 抽取、自動修復與 35s 超時保護。
    *   升級 `backend/src/agents/spineAgent.ts`（骨幹專家）：以專屬 Prompt 深入萃取 5 層追溯鏈（Objective ➔ Requirement ➔ User story ➔ Task ➔ UAT）與 Milestone 里程碑，自動鎖定負責人與優先級。
    *   升級 `backend/src/agents/charterAgent.ts`（章程與範疇專家）：深入分析 Project Charter 表格 100% 欄位、In/Out-of-Scope 範疇界定及 Information 規格文件，自動產生精確的 Table Markdown 更新提案。
    *   升級 `backend/src/agents/decisionAgent.ts`（決策與風險專家）：深入提煉 Meeting 會議紀要、Decision (ADR) 架構決策與 Bottleneck 技術瓶頸，並自動構建水平關聯網絡（`discusses`, `blocks`, `causes`）。
*   **Supervisor Critic 主管驗收器無縫合流與防呆 (Unified Synthesis & Cycle-Free Assurance)**：
    *   於 `backend/src/agents/supervisorCritic.ts` 整合跨專家提案合併去重、5 層 Traceability 根節點自動補全、未指派需求全鏈路強制錨定、團隊成員姓名自動嗅探以及 Deterministic No-Op 零變更過濾，保證送往前端 Proposal Canvas 的是一份完美拓撲、高質量的單一統一提案畫布。

---

### Phase 7.8: 全量初始化自動批次擴展與多工單單項 Action 合流 (Batch Augmentation) (2026-09-20)
*   **多工單強制 Single batch_proposal 規範 (Mandatory Single Batch for Multi-Items)**：
    *   重構 `backend/src/routes/copilot.ts` System Prompt：明確禁止在全量初始化或多工單拆解時輸出單張 `create_item`，強制要求將 Meeting、5層 Traceability (Objective ➔ Requirement ➔ User story ➔ Task ➔ UAT)、Decision、Bottleneck 全部集中於 1 個 `batch_proposal.items` 中。
*   **後端 Action 漏發自動合流救援 (Batch Augmentation Fallback)**：
    *   在 `copilot.ts` 中實裝「多工單單項 Action 合流」：當 LLM 在文字中詳盡拆解了完整架構，但在 `<<ACTION>>` 標籤中只遺漏輸出單張 `create_item`（例如只有 Meeting）時，後端自動將該單張工單與文字中提取的 5 層骨架完整無縫合流為 `batch_proposal`，徹底杜絕工單丟失現象。
*   **快捷同步按鈕 Prompt 強化**：
    *   於 `frontend/src/components/CopilotDrawer.tsx` 強化 `[📄 根據上載文件，新增/更新相關 item]` 之發送提示詞，明確指示在全量初始化時輸出完整批次。

---

### Phase 7.7: AI Copilot 工作流快捷鍵 [📄 根據上載文件，新增/更新相關 item] 上線 (2026-09-20)
*   **文件智能同步專屬快捷膠囊 (Smart Document Sync Workflow Chip)**：
    *   於 `frontend/src/components/CopilotDrawer.tsx` 輸入框上方推薦工作流列首位新增 `[📄 根據上載文件，新增/更新相關 item]` 快捷按鈕。
    *   當使用者上載附件時，按鈕自動高亮為綠色脈衝光暈（`#064e3b` + `#10b981` 邊框），一鍵發送精確對比與增量同步指令，完全免除手動打字提示的繁瑣流程。

---

### Phase 7.6: 5 層追溯鏈強制全鏈路自動錨定 (5-Layer Cascading Topology Repair) (2026-09-20)
*   **Supervisor Critic 全鏈路強制掛載修復 (Universal Requirement & Spine Auto-Anchoring)**：
    *   重構 `backend/src/agents/supervisorCritic.ts` 中 Rule 6：解除「僅在批次缺 Objective 時才執行」的條件限制，升級為全域強制拓撲修復。
    *   只要批次內或專案資料庫中存在 Objective，所有未提供 `parentItemUid` 或填寫了無效代碼（如 `OBJ-01`、`商業目標`）的 `Requirement`，主管驗收器一律**強制自動掛載至目標 Objective**。
    *   同理，針對批次內未指派父層之 `User story`、`Task`、`UAT`，亦自動向上層鏈接至最近的 `Requirement` 或 `User story`，徹底杜絕工單掉入「待歸屬需求區」的斷層現象。

---

### Phase 7.5: 負責人自動嗅探匹配引擎 (Auto-Assignee Sniffer & Inline Resolution) (2026-09-20)
*   **Supervisor Critic 負責人自動嗅探與補全 (Auto-Assignee Sniffer)**：
    *   於 `backend/src/agents/supervisorCritic.ts` 實裝 Rule 5.1：針對大批次建立 (`batch_proposal`) 與單張建立 (`create_item`)，若 LLM 產生的工單遺漏 `itemFollowBy`，主管驗收器自動從工單標題、Markdown 內文與表格中精準匹配團隊成員全名（如 Kevin Lau）與簡稱（如 Kevin、Sarah），自動注入 `itemFollowBy = member_uid`。
*   **非結構化工單文字解析器升級 (Enhanced Inline Assignee Parser)**：
    *   重構 `backend/src/routes/copilot.ts` 中 `parseStructuredItemsFromText` 負責人匹配演算法，支援括號表示法 `(Kevin)`、冒號語法 `負責人: Sarah` 以及任意位置的行內成員名字提取，徹底解決大批次結構化拆解時注意力稀釋導致負責人漏填的痛點。

---

### Phase 7.4: 智能文件自動對比與零變更攔截引擎 (Autonomous Document Diffing & Substantive No-Op Filter) (2026-09-20)
*   **Prompt 層：上載文件自動比對與零增量認知規範 (Autonomous Delta Protocol)**：
    *   重構 `backend/src/routes/copilot.ts` System Prompt，新增【場景 0：上載文件自動比對與零變更判定法則】。
    *   即使使用者隨手上載文件且未特別提示「請對比」，AI 亦強制執行「先掃描現狀 ➔ 計算增量 Delta (新單 / 變更 / 一致) ➔ 動作決策」三步法；若 Delta = 0，自動輸出清晰結構化核對報告且嚴禁輸出多餘 Action。
*   **主管層：實質變更物理校驗與 No-Op 提案過濾 (Deterministic Delta Verifier)**：
    *   於 `backend/src/agents/supervisorCritic.ts` 實裝 Rule 7：針對 `update_item` 提案逐項校驗 `itemTitle`、`item_status`、`item_follow_by`、`parent_item_uid` 與 `item_content` 之實質差異。
    *   若提案內容與 Neon DB 現存資料 100% 一致（或整批 `batch_proposal` 已全數存在），主管驗收器自動從後端物理撤除該 Action，杜絕無意義的更新提案彈窗。

---

### Phase 7.3: Traceability Matrix 待歸屬需求區 (Unassigned Fallback) 與 Supervisor Critic 根節點自動錨定 (2026-09-20)
*   **Supervisor Critic 根節點 Objective 自動錨定 (Root Anchor Auto-Synthesis)**：
    *   在 `backend/src/agents/supervisorCritic.ts` 新增 Rule 6：當 LLM 批量拆解 Traceability 工單（包含 Requirement, User Story, Task, UAT）但遺漏最頂層 `Objective` 時，Supervisor Critic 自動補齊錨定頂層 `🎯 Objective` 並將 Requirement 設為其子項，防止 5 層樹狀結構斷頭。
*   **Traceability Matrix 待歸屬需求安全渲染 (Unassigned Requirements Group)**：
    *   重構 `frontend/src/components/TraceabilityMatrix.tsx`，加入 `unassignedRequirements` 分組渲染與專屬警告提示。
    *   即使目前專案資料庫中尚未建立任何 Objective，所有的 Requirement、User Story、Task、UAT 依然 100% 完整可見、可編輯、可點擊新增子工單，並支援直接拖曳至建立好的 Objective 完成歸屬。

---

### Phase 7.2: 3 大領域專家 Sub-Agents + Supervisor Critic 主管驗收架構與側欄 [隱藏/顯示] 折疊上線 (2026-09-20)
*   **左側導航欄 [隱藏/顯示] 平滑折疊 (Collapsible Navigation Sidebar)**：
    *   重構 `frontend/src/components/Sidebar.tsx` 與 `frontend/src/App.tsx`，支援 `isSidebarOpen` 狀態與 `localStorage` 偏好記憶。
    *   提供 Header 左側與側欄內部 `[收折 / 展開]` 按鈕，以 `width: 260px ➔ 0px` 平滑動畫釋放 PM 工作區橫向空間。
*   **3 大領域集群專家 Sub-Agents (Domain Cluster Specialists)**：
    *   實裝 `backend/src/agents/spineAgent.ts`（骨幹專家）：專精 5 層 Traceability 縱向骨架 (Objective ➔ Requirement ➔ User story ➔ Task ➔ UAT) 與 Milestone 里程碑。
    *   實裝 `backend/src/agents/charterAgent.ts`（章程專家）：專精 Project Charter 表格 100% 欄位填寫、In/Out-of-Scope 範疇界定與 Information 技術規格。
    *   實裝 `backend/src/agents/decisionAgent.ts`（決策與風險專家）：專精 Meeting 會議紀要、Decision (ADR) 決策記錄、Bottleneck 瓶頸以及水平拓撲關聯 (`discusses`, `blocks`, `causes`)。
*   **Supervisor Critic 主管審核與驗收器 (Supervisor Verifier)**：
    *   實裝 `backend/src/agents/supervisorCritic.ts`，負責對所有 Sub-Agent 提案進行 16 種工單類型與 8 種狀態的 Schema 校驗。
    *   執行孤兒節點自動修復 (Orphan Parent Resolution)、跨專家重複提案去重、以及 `blocks` 關聯去環 (Cycle Prevention)，確保送往前端 Proposal Canvas 的提案 100% 合規無瑕疵。
*   **多智能體協同調度器 (Multi-Agent Orchestrator)**：
    *   實裝 `backend/src/agents/orchestrator.ts` 並於 `backend/src/routes/copilot.ts` 中完成對接，實現 Meeting Recap、需求拆解與工單維護的端到端自動化流水線。

---

### Phase 6.4: AI Copilot 模式 1 上線 — 輕量側欄對話 (380px) + 中央審核劇院 (Center Studio Modal) + 一鍵全螢幕切換 (2026-09-20)
*   **主工作區空間極致釋放 (Lightweight 380px Copilot Drawer & Zero Page Squeeze)**：
    *   重構 `frontend/src/App.tsx` 與 `frontend/src/components/CopilotDrawer.tsx`，將 Copilot 抽屜鎖定為輕量 **380px** 緊湊側欄。
    *   移除舊版因雙面板展開而向左硬推 920px 的過度擠壓機制，左側 PM 主工作區（5 層 Traceability 矩陣、Kanban 看板、工單總表）始終保有 1000px+ 寬闊舒適視野。
*   **中央審核劇院 Studio 彈窗 (Proposal Canvas Center Modal Studio)**：
    *   將 `ProposalCanvas.tsx` 審核工作台升級為獨立的**中央劇院彈窗 (Center Studio Modal)**（寬度 1020px，配合毛玻璃背景遮罩 `backdropFilter: blur(12px)`）。
    *   當 AI 產生工單提案（批量拆解、單張新建、Diff 變更對照、對話共識）時，自動在中央以全幅寬敞卡片展開，提供極致舒展的 Markdown 表格與工單屬性預覽。
    *   點擊「核准並更新工單」後，中央 Modal 自動平滑淡出收回，背後主矩陣與看板自動即時刷新！
*   **一鍵全螢幕專注思考模式 (Fullscreen Focus Mode Toggle)**：
    *   於 Copilot 頂部 Header 右側新增 `[ ⛶ 全螢幕 / ❐ 側欄 ]` 切換鈕，支援在「側欄對照模式」與「全螢幕深度思考模式」之間無縫一鍵切換。

---

### Phase 5.20: 全域看板（Kanban View）整欄滿版高度延伸 (Full-Height Column Stretch) 與全區橫向垂直無縫拖曳 (2026-09-15)
*   **欄位滿版高度延伸 (Full-Height Column Stretch)**：
    *   重構 `frontend/src/components/ItemKanbanView.tsx` 網格排版，將看板列容器改為 `alignItems: 'stretch'`，並在每個 Column 容器配置 `alignSelf: 'stretch'` 與卡片清單 `flex: 1`。
    *   所有狀態欄位（包括卡片數量為 0 或僅有 1-2 張卡片的欄位）皆自動向下垂直拉伸至與最長欄位（例如有 25+ 張工單的欄位）相同高度。
*   **全區橫向水平與垂直精準判定 (Lane-Wide Hit-Testing & Drop)**：
    *   外層滾動容器整合 X 軸座標命中測試（`getBoundingClientRect()` X-Axis Hit-Testing），無論用戶滾動到下方幾千像素，只要將工單水平拖曳至目標狀態欄的任何垂直空白區域，系統皆能 100% 精準識別該狀態並即時高亮邊框。
    *   放開滑鼠即可立即將工單變更為目標狀態並自動寫入資料庫，徹底解決長列表下方無法拖曳至短列表的痛點。

---

### Phase 5.19: 語音輸入 (Speech-to-Text) 即時預覽 (Live Interim Transcript) 與麥克風生命週期徹底重構 (2026-09-15)
*   **即時動態字詞預覽 (Live Interim Typing Feedback)**：
    *   重構 `frontend/src/components/CopilotDrawer.tsx` 語音事件處理，將 `event.results` 拆解為 `finalTranscript` 與 `interimTranscript`。
    *   使用者邊講話時輸入框即時出字（不再需要長時間停頓等待），徹底消除「以為麥克風無反應」的體驗斷層。
*   **麥克風實例狀態競爭與生命週期防呆 (Safe Recognition Lifecycle)**：
    *   引入 `isListeningRef` 與 `recognitionRef` 雙重鎖定機制，點擊切換時安全 `abort()` 舊實例，杜絕瀏覽器 `SpeechRecognition has already started` 異常。
    *   全面捕捉 `not-allowed`（未開權限）、`audio-capture`（無收音設備）、`network` 錯誤並提供友善彈窗提示。

---

### Phase 5.18: AI Copilot 全格式代碼識別 (無連字號支援)、全維度語義自動救援 (指派/狀態/表格) 與同義詞映射強化 (2026-09-15)
*   **全格式工單代碼識別 (Space-Insensitive & Flexible Display Code Matcher)**：
    *   重構 `backend/src/routes/copilot.ts` 中 `mentionedCodes` 提取演算法，突破原本單一 `[A-Z]{2,5}-\d+` 連字號限制。
    *   全面支援空格或無空格格式（如 `TPM-6`、`tpm 6`、`tpm6`、`TPM 6`、`TPM-PRO-2`、`tpm pro 2`），確保口語化提問能 100% 精確命中目標工單。
*   **多場景語意自動救援引擎 (Auto-Heuristic Recovery Engine)**：
    *   針對 Gemma 4 等開源模型漏出 `<<ACTION>>` 標籤的常見問題，實裝全能型自動救援兜底機制：
        1. **指派負責人 (Assign)**：精準捕捉「安排/指派/派畀/畀/交畀/assign」意圖，自動從團隊名單比對成員（支援全名、姓氏與 Email），組裝 `update_item` 提案。
        2. **工單狀態切換 (Status Update)**：自動偵測「改為/變成/完成/作廢/取消/Blocked/In Progress」等意圖並映射合法枚舉。
        3. **表格與內容填寫 (Form & Charter Fill)**：整合 20+ 項中英文 PM 欄位同義詞庫（如 `核心目標 ➔ Objectives`、`範疇定義 ➔ In-scope`、`量化指標 ➔ Metric`、`風險管理 ➔ Known Risks`），就算模型僅輸出中文點列摘要亦能自動精準填滿每一格。
    *   過濾模型模仿歷史對話所產生的假 `✅ 已成功套用` 文本，確保用戶一定能於 Proposal Canvas 進行真實審批。

---

### Phase 5.17: Calendar 頂層浮動狀態選單、全域看板 (Kanban) 同步滾動 + 凍結置頂標題、[+] 快速新增與 Type 即時下拉切換 (2026-09-15)
*   **行事曆（Calendar View）狀態下拉選單頂層浮動 (Top-Layer Fixed Dropdown for Status)**：
    *   重構 `frontend/src/components/ItemCalendarView.tsx`，在點擊狀態膠囊時利用 `e.currentTarget.getBoundingClientRect()` 精確計算螢幕視口座標。
    *   將狀態下拉選單提升至根節點以 `position: 'fixed'`, `zIndex: 999999` 浮動渲染，徹底解決被每日格子內部 `overflowY: 'auto'` 滾動邊界裁切（clipping）的問題。
*   **全域看板（Kanban View）多欄統一滾動與標題列凍結置頂 (Unified Board Scroll & Sticky Headers)**：
    *   重構 `frontend/src/components/ItemKanbanView.tsx`，將看板外層容器統一配置 `overflowX: 'auto'`, `overflowY: 'auto'`，所有狀態欄位（Column）上下滾動完全同步。
    *   各狀態標題欄（Header）配置 `position: 'sticky'`, `top: 0`, `zIndex: 20`，滾動瀏覽長列表卡片時標題欄始終凍結置頂可見。
*   **看板狀態標題旁 [+] 快速新增工單卡片 (Inline Quick Create)**：
    *   於各狀態標題列右側新增 `[+]` 快捷按鈕。
    *   點擊後展開看板卡片級的 Inline 新增表單，支援輸入標題、選擇工單類型（Type）與所屬專案（Project），按下儲存後即時建立該狀態下的新工單並無縫載入。
*   **看板卡片工單類型（Type）即時下拉編輯 (Inline Type Switcher)**：
    *   看板卡片上的 Type 標籤支援點擊展開客製化浮動選單（包含全部 13 種工單類型）。
    *   選單採用 `position: 'fixed'`, `zIndex: 999999` 頂層渲染，點選後即時發送 `PATCH /api/items/:uid` 更新 `item_type`，並自動同步工作區與專案數據。

---

### Phase 5.16: 全域行事曆（Calendar View）5 週網格、雙行工單卡片、拖曳改期 (Drag & Drop) 與即時行內狀態切換 (2026-09-15)
*   **固定 5 週（35 格）網格佈局 (5-Week Grid Layout)**：
    *   將行事曆由原本的 6 週（42 格）改為固定呈現 5 週（35 格，`gridTemplateRows: repeat(5, 1fr)`），大幅增加每週垂直格子高度與工單卡片展示空間。
*   **工單卡片雙行結構化排版 (2-Line Item Card)**：
    *   重構 `frontend/src/components/ItemCalendarView.tsx`，每張卡片標準呈現 2 行：
        - **第一行 (Line 1)**：高亮 Display Code 藍色代碼 + 工單標題（單行超出自動省略），點擊可直接開啟工單抽屜（Drawer）。
        - **第二行 (Line 2)**：即時狀態膠囊按鈕，點擊可展開專屬狀態下拉選單（`Not Start`, `Ready`, `In Progress`, `Review`, `Blocked`, `Completed`, `Closed`, `Backlog`），選擇後立即發送 API 寫入更新。
*   **HTML5 原生拖曳排程修改 (Drag and Drop Rescheduling)**：
    *   每張工單卡片支援 `draggable={true}`，滑鼠拖曳放置到目標日期格子時，自動呼叫 `PATCH /api/items/:uid` 更新 `item_planned_end_date`。
    *   拖曳經過日期格時提供高亮半透明邊框視覺反饋，放開即自動重繪並重整資料。
*   **超出內容垂直滾動 (Scrollable Day Cell)**：
    *   每天格子內部工單容器配置 `overflowY: 'auto'`，當項目較多時（如 28 項）可流暢獨立向下滾動。

---

### Phase 5.15: 工單表格與里程碑 RACI 工具列極致單行化 — 搜尋、過濾器與視圖切換器一體化 (Single-Line Compact Toolbar) (2026-09-15)
*   **搜尋、篩選與 View 模式切換器單行一體化 (Single Line Toolbar Consolidation)**：
    *   重構 `frontend/src/components/AdvancedTable.tsx`，將原本垂直分散在 3 行的搜尋框（Search Input）、3 個多選下拉選單（類型、狀態、負責人）與 View 切換器（List, Kanban, Timeline, Calendar）**全部收納壓縮至同一行**。
    *   在專案詳情頁（Charter, Task, Information, Meeting, Bottleneck, Decision）中移除重複的獨立大標題行，將垂直空間再釋放 80px+。
*   **里程碑 RACI 工具列單行化 (Milestone RACI Table Single-Line Layout)**：
    *   重構 `frontend/src/components/MilestoneRaciTable.tsx`，將「`+ 新增 RACI 成員`」按鈕、搜尋框與「狀態過濾器」整合至**同一行**，按鈕與輸入框高度統一鎖定為 `28px`，下拉彈窗層級設為 `zIndex: 9999`。
*   **ViewSwitcher 與 MultiSelect 微型緊湊化升級 (Micro Compact Components)**：
    *   在 `ViewSwitcher.tsx` 引入 `compact` 屬性，優化按鈕邊距 (`padding: 3px 8px`) 與字體 (`0.75rem`)。
    *   在 `MultiSelect.tsx` 支援高度鎖定為 `28px` 與文字自動省略，保證在高密度介面下不換行。

---

### Phase 5.14: 專案專頁 UI 空間最佳化 — Description 遷徙至右側 Side Bar 與緊湊微型分頁膠囊 (Project Detail UI Optimization) (2026-09-14)
*   **專案詳細說明 (Description / Vision) 遷徙至右側 Sidebar**：
    *   從左側主畫面拔除大面積 Description 區塊，移至右側屬性欄（位於狀態/色彩與負責人之間）。
    *   在側欄支援點擊就地展開 Textarea 編輯、儲存與取消，不佔用左側主工作區任何垂直空間。
*   **精簡微型分頁膠囊與垂直空間大解放 (Compact Micro-Tab Pills)**：
    *   將專案標題列進行緊湊化排版（`margin: 0`、字體 `1.35rem`）。
    *   將 9 個分頁 Tab 升級為精緻微型膠囊（`padding: 4px 10px`、字體 `0.78rem`、緊湊間距 `5px`、細緻半透明邊框）。
    *   左側主矩陣與資料表垂直可視空間大增 300%，徹底消除擠逼感。

---

### Phase 5.13: 移除舊版知識庫 (Knowledge Hub & Sources)、產品/專案總表批次操作與成員 Email 徽章對齊及醒目除名按鈕 (2026-09-14)
*   **舊版知識庫 (Level 0 Knowledge Hub 與 Level 2 Project Sources) 全面退役與死代碼清理**：
    *   移除 `backend/src/routes/sources.ts` 與 `frontend/src/components/ProjectSourcesView.tsx`。
    *   在 `Sidebar.tsx`、`ProjectDetailView.tsx`、`App.tsx`、`api.ts`、`copilot.ts` 清理所有 `sources` 關聯。
    *   確立所有架構、會議與外部知識由工單系統 `item_type = 'Information'` 全面接管之新標準。
*   **Level 0 產品總表與 Level 1 專案總表支援全選/多選/單選與批次刪除/作廢 (Batch Actions)**：
    *   在 `ProjectTable.tsx` 實裝 Checkbox 欄位與表頭全選/取消全選。
    *   實裝浮動膠囊批次操作列，支援「🚫 批次取消/作廢」、「🗑️ 批次刪除」與一鍵反選。
    *   後端新增 `POST /api/projects/batch-delete` 與 `POST /api/projects/batch-status` 路由。
*   **工作區成員總表 Email 徽章左置等寬對齊與醒目紅色除名按鈕 (MemberTable UI Enhancement)**：
    *   將「`已鎖定`」與「`待認證`」徽章移至 Email address 的**左側**，並統一定義等寬 `68px` 容器與 `white-space: nowrap`，使成員 Email 上下完美垂直對齊。
    *   將操作欄位之成員除名/移除按鈕升級為醒目紅色高亮按鈕 (`#ef4444` 與半透明淺紅邊框背景)，提升操作警示性與視覺層次。

---

### Phase 5.12: 生產級 Google OAuth 2.0 認證系統、PostgreSQL users 資料表同步與路由守衛 (Google OAuth 2.0, User Profile Sync & Route Guard) (2026-09-14)
*   **PostgreSQL 資料庫 users 表與自動初始化 (Database User Schema & Auto-Bootstrap)**：
    *   在 `backend/src/db.ts` 內建 `public.users` 資料表 Schema（包含 `id`, `email`, `name`, `avatar_url`, `role`, `status`, `oauth_provider`, `oauth_provider_id`, `last_sign_in_at` 等欄位，並針對 `email` 建立唯一索引）。
    *   實裝 `POST /api/auth/sync-user` API：使用 `ON CONFLICT (email) DO UPDATE` 達成登入即時 Upsert 同步使用者檔案，並自動聯動確保 `public.member` 記錄存在。
    *   實裝 `GET /api/auth/me` 與 `GET /api/auth/users` 查詢端點。
*   **前端 Google OAuth 2.0 認證流程與回調處理 (Authentic Google OAuth Flow & Callback)**：
    *   實裝官方 `https://accounts.google.com/o/oauth2/v2/auth` 跳轉與 `openid email profile` scope 授權。
    *   建立 `/auth/callback` 路由，自動從 URL 解析 Access Token 並向 Google UserInfo API (`https://www.googleapis.com/oauth2/v3/userinfo`) 提取經驗證的真實 Google 頭像、姓名與 Email。
*   **毛玻璃視覺（Glassmorphism）登入頁面與路由守衛 (SignIn UI, Auth Guard & Sign Out)**：
    *   打造 `SignInPage.tsx` 毛玻璃居中登入卡片，配置官方 Google "G" 彩色標誌按鈕、載入狀態 Spinner、錯誤提示 Banner 與快速演示登入選項。
    *   建立 `AuthContext.tsx` 全域狀態管理與 `ProtectedRoute` (Auth Guard)，未授權訪問自動重定向至 `/auth/sign-in`。
    *   在 `Sidebar.tsx` 底部整合登入使用者資訊卡片（展示 Google 頭像、姓名、Email）與全域登出 (`LogOut`) 按鈕。
    *   配置 `vercel.json` SPA 重寫規則與 Cloudflare Workers SPA fallback，避免重新整理 404。

---

### Phase 5.11: 工單側邊欄 Related items 關聯表格支援即時行內編輯 (Inline Editing & Dropdowns for Related Items) (2026-09-14)
*   **關聯表格全欄位行內編輯與快速選擇 (Related Items Inline Editing & Custom Select)**：
    *   重構 `frontend/src/components/ItemDrawer.tsx` 底部 `Related items (關聯工單)` 表格，將靜態欄位升級為即時可互動視圖：
        1. **Work (標題)**：支援點擊即時行內文字編輯，並帶有工單類型專屬 Icon（如 `[R] Requirement`、`[S] Story`、`[T] Task` 等）與點擊直接跳轉導航代碼按鈕。
        2. **Relation Type (關聯類型)**：引入 `CustomSelect` 下拉選單，可即時切換 `discusses`、`blocks`、`covers`、`deploys`、`causes`、`depends on`、`relates to`，自動更新當前工單或來源工單之 `relation_item_uid` 結構。
        3. **Direction (方向標籤)**：視覺化標註 `Outgoing (當前 ➔)` 或 `Incoming (➔ 當前)` 標籤。
        4. **Status (目標工單狀態)**：提供狀態專屬色彩 `CustomSelect` 下拉選單（`Not Start`, `Ready`, `In Progress`, `Review`, `Blocked`, `Completed`, `Closed`, `Backlog`），切換後即時透過 API 更新目標工單狀態並重整工作區快取。
        5. **Action (解除關聯)**：提供一鍵解除關聯按鈕，無論是主動關聯或被動被關聯皆能無縫清理並同步更新。
    *   前端 `npm run build` 通過且無縫部署至 Cloudflare Workers。

---

### Phase 5.10: 4合1 啟航與多動作連鎖執行引擎 (Multi-Action Pipeline & Approve All) (2026-09-13)
*   **後端多動作全域解析器 (Backend Multi-Action Global Parser)**：
    *   重構 `backend/src/routes/copilot.ts`，將原單次 `regex.match` 解析擴展為全域正規表示式掃描 (`globalActionRegex.exec`)，支援在單次 AI 回覆中完整捕捉多個 `<<ACTION>>...<</ACTION>>` 區塊。
    *   回傳結構擴充 `actionPreviews: any[]` 陣列，確保 Charter 更新 (`update_item`)、批次工單新增 (`batch_proposal`)、UAT 父級回填等所有連鎖動作 100% 完整保留並回傳給前端。
*   **前端 Multi-Action 卡片與一鍵依序執行 (Frontend Multi-Action Card & Approve All)**：
    *   在 `CopilotDrawer.tsx` 中實裝多動作狀態跟蹤，訊息泡泡若包含多個動作時渲染專屬 `4-in-1 / 連鎖動作清單` 容器，標註進度 `(X/Y 已完成)`。
    *   頂部配置 **`✨ 一鍵依序執行全部動作 (Approve All)`** 按鈕，點擊後依序自動調用 `api.batchCreateItems`、`api.patchItem`、`api.createItem` 或 `api.commitConsensus`，自動依序入庫並儲存 Session 歷史。
    *   每項子動作保留獨立 `[審核 ➔]` / `[查看]` 按鈕，支援個別微調審批，且執行後自動標註綠色已套用徽章。

---

### Phase 5.9: Level 2 表格全選/多選/單選 Checkbox 與批次複製/刪除 + AI 啟航工作流膠囊上線 (2026-09-13)
*   **Level 2 全域表格多選與批次操作 (Table Checkbox Selection & Batch Duplicate/Delete)**：
    *   在 `AdvancedTable.tsx` 最左側新增 Checkbox 欄位，表頭支援「全選/取消全選」，每列支援單選/多選，選中時行背景高亮。
    *   實裝浮動批次操作列 (Floating Batch Action Bar)：選中項目時顯示「📋 複製工單 (Duplicate)」、「🗑️ 批次刪除 (Delete)」與「✕ 取消選取」。
    *   在後端 `POST /api/items/batch-delete` 實裝原子陣列刪除 (`DELETE WHERE item_uid = ANY($1::uuid[])`)。
    *   每列右側操作欄新增單項快速複製按鈕 (`📋 Duplicate`)。
*   **AI Copilot 智能工作流快捷膠囊 (Smart Workflow Action Chips)**：
    *   在 `CopilotDrawer.tsx` 輸入框頂部實裝微型膠囊標籤列：`🚀 Kick-off 啟航 (4合1)`、`👥 一般會議拆解`、`🌲 5層 Traceability 骨架`、`📜 填寫 Charter 章程`。
    *   點擊即自動以結構化專業 Prompt 觸發對應 Pipeline，極致簡化操作路徑。

---

### Phase 5.8: 5 層 Traceability 溯源骨架強制掃描與 Batch 關聯 (relation_item_uid) 雙向打通 (2026-09-13)
*   **端到端關聯傳遞健全性修復 (End-to-End Relation Preservation)**：
    *   修復 `ProposalCanvas.tsx` 中 `ProposedItem` 遺漏 `relation_item_uid` / `relationItemUid` 定義，並在 `ItemCard` 渲染關聯標籤 (`🔗 discusses`, `🔗 blocks`, `🔗 covers`)。
    *   修復 `CopilotDrawer.tsx` 中 `preview.items` 映射與 `handleApplyBatchProposal` 遺漏 `relation_item_uid` 傳遞至 `api.batchCreateItems` 的核心 Bug。
    *   強化 `backend/src/routes/copilot.ts` System Prompt：強制執行 5-Layer Spine (`Objective ➔ Requirement ➔ User Story ➔ Task ➔ UAT`) 完整多態建立，嚴禁假定節點已存在，並在 Meeting 與 Bottleneck 工單中強制輸出 `relationItemUid`。
*   **雙階段圖譜拓撲演算法 (Two-Pass Topology Resolution)**：
    *   `POST /api/items/batch` 支援在單一 Neon DB Transaction 內自動解析同批項目標題、前綴代碼與歷史工單代碼，將 `parent_item_uid` 與 `relation_item_uid` 無縫解析為真實 UUID。

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
    *   左側對話框顯示精緻徽章，右側提供完整審批與行內微調控制，點擊核准套用後原子寫入 Neon DB 與自動收合回 `420px`。

---

### Phase 5.9: 畫布展開雙向自適應壓縮、底部凍結橫向捲軸與成員名稱/電郵完全解析 (Canvas Responsive Layout, Frozen Horizontal Scrollbar & UUID Resolution) (2026-09-13)
*   **畫布展開雙向自適應壓縮與視口底部凍結橫向捲軸 (`App.tsx`, `App.css`, `TraceabilityMatrix.tsx`)**：
    *   **主工作區平滑擠壓壓縮**：於 `App.tsx` 建立 `isCanvasExpanded` 雙向監聽機制，當右側 900px Proposal Canvas 展開時，左側 PM 主畫布自動加上 `marginRight: 900px` 與 `transition: margin-right 0.3s`，確保 PM 溯源鏈矩陣不被彈窗遮擋，完整壓縮在左側視口。
    *   **視口底部凍結橫向捲軸 (Sticky Frozen Bottom Horizontal Scrollbar)**：重構 `App.css` 與矩陣高度約束，提供高辨識度橫向捲軸軌道與懸停青光反饋，確保在畫布展開、寬度壓縮時，橫向滾動條始終固定凍結於螢幕最底部，隨時可橫向查看各層階梯欄位。
*   **全畫布去 UUID 化與成員名稱 + Email / 父工單標題解析 (`ProposalCanvas.tsx`, `CopilotDrawer.tsx`)**：
    *   實裝 `resolveMemberDisplay` 與 `resolveItemDisplay` 核心解析器。
    *   **杜絕 Raw UUID 洩漏**：在 Diff Comparison 變更對照、單項建立、批量拆解卡片及 Member Select 下拉選單中，全面將 `item_follow_by` 與 `parent_item_uid` 解析為 `姓名 (email)`（例如 `Edmond Chan (edmond...@...)`）與 `[代碼] 標題`（例如 `[TTG-14] 項目標題`）。
    *   即使 AI 回傳 raw UUID，工作台亦自動轉換為人類友善的可讀標籤。
*   **雲端部署上線**：
    *   前端成功編譯並即時部署至 Cloudflare Workers (`https://projectson.edmondylchan2002.workers.dev`)。

---

### Phase 6.0: AI Copilot 多輪歷史對話持久化與方案 A 懸浮選單系統 (AI Chat History Sessions & Scheme A Popover Studio) (2026-09-13)
*   **Neon PostgreSQL 歷史對話資料庫 Schema 構建 (`backend/database/schema.sql`)**：
    *   建立 `public.ai_chat_session` 核心表，包含 `session_uid` (UUID PK)、`workspace_uid` (UUID FK)、`project_uid` (UUID FK NULLable)、`member_uid` (UUID FK NULLable)、`title` (VARCHAR 255)、`messages` (JSONB)、`last_model_used` (VARCHAR 64)、`is_pinned` (BOOLEAN)、`created_at`、`updated_at`。
    *   配置 `trg_ai_chat_session_updated_at` 自動時間戳觸發器與索引 (`workspace_uid`, `project_uid`, `member_uid`)。
    *   於 Neon PostgreSQL 線上環境即時執行 DDL 遷移生效。
*   **後端 RESTful CRUD API 實裝與成員私隱隔離 (`backend/src/routes/copilot.ts`)**：
    *   實裝 5 大 RESTful 路由：
        *   `GET /api/copilot/sessions`: 依據 `workspace_uid` 與 `member_uid` 安全隔離獲取清單，支援 `project_uid` 專案過濾與 Admin 視角。
        *   `GET /api/copilot/sessions/:id`: 獲取特定對話之完整訊息歷程。
        *   `POST /api/copilot/sessions`: 建立全新對話記錄。
        *   `PUT /api/copilot/sessions/:id`: 更新對話訊息、模型選擇與標題。
        *   `DELETE /api/copilot/sessions/:id`: 刪除指定歷史對話。
*   **前端 API Client 與方案 A (Popover) 零佔用懸浮選單 (`api.ts`, `CopilotDrawer.tsx`)**：
    *   **方案 A 頂部懸浮選單**：在 Copilot 頂部 Header 右側配置 `+ 新對話` 按鈕與 `🕒 歷史 (N)` 按鈕，點擊以 `320px` 懸浮 Popover 下拉展示，完全不佔用 Copilot 橫向寬度與工作空間。
    *   **專案過濾與歷史切換**：支援 `[本專案]` 與 `[全部]` 歷史過濾切換、當前對話綠點指示、時間戳、對話數量顯示與單鍵垃圾桶刪除。
    *   **無感自動保存 (Auto-Persistence)**：在發送新訊息或 AI 回覆完畢時，自動原子儲存至 Neon DB，新對話自動以第一句提問生成精準標題。
*   **雲端部署上線**：
    *   後端與前端已全數編譯無誤，前端成功部署至 Cloudflare Workers (`https://projectson.edmondylchan2002.workers.dev`)。

---

### Phase 6.1: 歷史對話 Proposal Canvas 已審核狀態持久化與唯讀歷程查閱模式 (Proposal Canvas Historical Applied Mode) (2026-09-13)
*   **審批狀態即時原子持久化 (`CopilotDrawer.tsx`)**：
    *   修復此前審核套用動作（單項新建、屬性更新/作廢、批量拆解、決策沉澱）後未將 `actionPreview.applied = true` 同步寫入 Neon DB `ai_chat_session` 的問題。
    *   在每次點擊核准套用時，即時更新訊息實體並透過 `api.updateCopilotSession` 持久化至 Neon DB。
*   **歷史對話智能回溯與狀態識別 (Intelligent Historical Recognition)**：
    *   結合 `actionPreview.applied` 與文字標記（如 `✅ 已成功`、`📌 已成功`），即使用戶載入歷史對話，系統亦能百分之百準確識別該提案已完成審批。
    *   對話泡泡中的操作卡片自動切換為翡翠綠外觀，標示 `✅ 此提案已於先前核准並寫入資料庫`，按鈕文字切換為 `檢視已套用內容`。
*   **Proposal Canvas 唯讀歷程查閱模式 (`ProposalCanvas.tsx`)**：
    *   當由已審批歷史展開工作台時，頂部顯示全幅綠色通知列：`此提案已於先前核准並成功同步寫入資料庫（唯讀歷程查閱模式）`。
    *   底部按鈕自動由 `[核准並更新工單]` 切換為不可再次觸發的灰色/綠色禁用狀態 `[✓ 已完成核准與套用 (歷史記錄)]`，左側按鈕變更為 `[關閉工作台]`，徹底杜絕用戶誤會為未審批的體驗問題。
*   **雲端部署上線**：
    *   前端即時編譯並部署至 Cloudflare Workers (`https://projectson.edmondylchan2002.workers.dev`)。

---

### Phase 6.2: BlockNote 富文本表格多行/多列批量選取與一鍵刪除引擎 (Table Multi-Row & Multi-Column Batch Delete Engine) (2026-09-13)
*   **表格多行/多列選取即時空間幾何偵測 (`NovelEditor.tsx`)**：
    *   實裝 `checkTableSelection` 核心演算法，支援 ProseMirror 原生 `.selectedCell` 矩陣掃描與 DOM 交叉檢測，自動精確計算所選取的 Row 索引集與 Column 索引集。
*   **雙模式批量刪除實裝（浮動工具列膠囊 + 鍵盤快捷鍵）**：
    *   **浮動操作膠囊 (Floating Action Pill Toolbar)**：
        *   當框選 2 行或以上時，自動彈出亮紅色 `[ 🗑️ 批量刪除選中的 N 行 (Delete Rows) ]` 按鈕。
        *   當框選 2 列或以上時，自動彈出深紅色 `[ 🗑️ 批量刪除選中的 N 列 (Delete Columns) ]` 按鈕。
    *   **鍵盤快捷鍵原生攔截 (Keyboard Interception)**：支援在選中多行/多列時直接按下 `Backspace` 或 `Delete` 鍵，攔截預設行為並自動將所選 Rows 或 Columns 從 BlockNote Document 結構中完全移除。
*   **雲端部署上線**：
    *   前端成功編譯並部署至 Cloudflare Workers (`https://projectson.edmondylchan2002.workers.dev`).

---

### Phase 6.3: 中英雙語會議紀錄智能解析與 16 種工單多態自動分類 SOP (Meeting Intelligence & Polymorphic Item Classification) (2026-09-13)
*   **工單多態表語義簽名矩陣 (Semantic Signature Matrix in `backend/src/routes/copilot.ts`)**：
    *   在 System Prompt 中注入中英文典型會議用語特徵：
        *   `Decision`: "Agreed that...", "Consensus reached on...", "拍板決定", "採用方案"
        *   `Bottleneck`: "Blocked by...", "Pending approval from...", "外部依賴阻礙", "技術風險"
        *   `Requirement`: "New requirement: system must support...", "業務需求"
        *   `User story`: "As a user, I want to...", "使用者期望"
        *   `Task`: "[Assignee] to implement by [Date]", "開發執行任務"
        *   `UAT`: "Acceptance criteria / test case", "驗收測試案例"
        *   `Bug`: "Bug report / 500 error / glitch", "缺陷回報"
        *   `Milestone`: "Target release by [Date]", "關鍵里程碑"
        *   `Meeting`: 會議主體工單（記錄出席人員與會議摘要）
*   **Proposal Canvas 摺疊預覽組件升級 (`ProposalCanvas.tsx`, `CopilotDrawer.tsx`)**：
    *   新增 `showContentPreview` 狀態與 `點擊展開預覽 / 收起預覽 ▾` 摺疊切換開關，支援在批量建立工單前即時預覽完整的 Markdown 描述與表格。
    *   修復 Action JSON parser 對長文字換行符與結尾逗號的容錯修復邏輯。

---

### Phase 6.4: AI Copilot 多模態文件/圖片附件上傳、截圖貼上與視覺模型調度 (Copilot File & Image Upload, Screenshot Paste & Multimodal Vision) (2026-09-13)
*   **前端全方位上傳與剪貼簿原生攔截 (`frontend/src/components/CopilotDrawer.tsx`)**：
    *   **📎 附件選擇按鈕 (Paperclip Picker)**：支援 `.md, .txt, .json, .csv, .pdf, .png, .jpg, .jpeg, .webp, .gif` 等多格式選取。
    *   **📋 剪貼簿截圖貼上 (Clipboard Paste Interception)**：支援在輸入框按下 `Cmd+V / Ctrl+V` 時直接將剪貼簿截圖轉化為附件圖片。
    *   **🪟 拖曳上傳支援 (Drag & Drop)**：可直接拖放檔案至 Copilot 對話框。
    *   **🏷️ 待發送預覽膠囊列 (Attachment Preview Pills)**：即時顯示圖片縮圖、檔案圖標、檔名、大小與一鍵 `✕` 移除按鈕。
    *   **💬 對話氣泡展示**：用戶訊息氣泡支援圖片縮圖（點擊放大查看原圖）與文件膠囊標籤展示。
*   **後端多模態調度與文件上下文解析 (`backend/src/routes/copilot.ts`, `api.ts`)**：
    *   **文字檔案**：前端以 `FileReader` 自動提取純文字內容，後端格式化注入 Prompt Context 進行精準工單拆解。
    *   **圖片/截圖**：前端以 Base64 Data URL 傳遞，後端自動調度至 `qwen-vl-max` 多模態視覺模型，以標準 OpenAI 視覺結構（`image_url`）發送，直接識別圖片中的會議筆記、UI 設計圖或報錯截圖。
    *   **模型選單擴充**：於 Copilot 下拉選單中加入 `🖼️ Qwen VL Max (視覺多模態)`。
*   **雲端部署上線**：
    *   前端成功編譯並部署至 Cloudflare Workers (`https://certifyai-yes-college.edmondylchan2002.workers.dev` / `https://projectson.edmondylchan2002.workers.dev`)，後端同步推送至 GitHub `main` 分支。

---

### Phase 6.5: Level 0 全域知識庫入口、全功能文件管理 UI 與 Neon DB Schema 遷移 (Level 0 Global Knowledge Hub & Unified Document Management Studio) (2026-09-13)
*   **Neon PostgreSQL 資料庫 Schema 補齊與線上即時遷移 (`schema.sql`, `backend/src/db.ts`)**：
    *   在 Neon DB 成功啟用 `vector` 擴展，建立 `public.okf_sources` 與 `public.okf_chunks` 表結構。
    *   新增 `content_text TEXT` 原始文字內容欄位，支援 UI 即時預覽與全文閱讀。
    *   配置 `idx_okf_sources_ws_prj` 與 `idx_okf_chunks_source` 索引，確保跨工作區與專案檢索效能。
*   **後端 RESTful 路由強化 (`backend/src/routes/sources.ts`, `api.ts`)**：
    *   `GET /api/sources`: 關聯 `public.project` 回傳專案名稱與代碼，支援 `scope`（`all` / `global` / `project`）精確過濾。
    *   `GET /api/sources/:uid`: 獲取單一知識文件詳情，包含 `content_text` 與所屬 `okf_chunks` 向量切片清單。
    *   `POST /api/sources`: 支援儲存純文字內容並自動執行段落分塊（Paragraph Chunking）。
    *   `PATCH /api/sources/:uid`: 支援即時切換 `is_active`（Copilot 引用開關）與變更所屬 `project_uid`（Scope 變更）。
    *   `DELETE /api/sources/:uid`: 級聯刪除文件與底層向量分塊。
*   **前端全功能雙層知識庫管理 UI (`Sidebar.tsx`, `App.tsx`, `ProjectSourcesView.tsx`)**：
    *   **Level 0 導航入口**：在左側 Sidebar 新增 `📚 Knowledge Hub (知識庫)` 主入口。
    *   **雙層自適應架構**：同一個組件既能作為 Level 0 全域知識庫總台，亦能在 Level 2 作為特定專案的文件分頁。
    *   **Scope 標籤與篩選列**：清楚區分 `[ 🏢 公司全域通用 ]`（翡翠綠徽章）與 `[ 📦 專案專屬 ]`（紫羅蘭徽章），支援膠囊按鈕一鍵篩選。
    *   **📖 文件全文閱讀與切片預覽抽屜 (Document Reader Modal)**：點擊卡片彈出閱讀視窗，提供 `文件全文內容`（ReactMarkdown 美化渲染）與 `語意向量切片 (Chunks Breakdown)` 雙 Tab 檢視。
    *   **⚡ Copilot 引用開關與一鍵安全刪除**：即時切換 AI 檢索開關與級聯清理確認。
*   **雲端部署上線**：
    *   前端成功編譯並部署至 Cloudflare Workers (`https://projectson.edmondylchan2002.workers.dev`)，後端同步推送至 GitHub `main`。

---

### Phase 6.6: Landing Page 航太視覺重構、三截核心功能聚焦與 Mission Control 智能導向 (SpaceX-Themed Landing Page, 3-Chapter Redesign & Mission Control Smart Routing) (2026-09-14)
*   **SpaceX 暗黑遙測主題與 3 截核心架構聚焦 (`LandingPage.tsx`)**：
    *   **Chapter 01: 航向指令中樞與動態光束 (Mission Launch & Live Ingestion Beam)**：展示即時專案儀表板全景、狀態遙測矩陣與動態霓虹掃描光束，呈現極致即時性與掌控感。
    *   **Chapter 02: 雙引擎動力架構動態切換器 (Dual Propulsion Architecture Switcher)**：
        *   提供雙態互動切換：`[ 01 // 雙時態語意知識圖譜 (Temporal Graph RAG) ]` 與 `[ 02 // 880px 雙面板提案審核工作台 (HITL Proposal Canvas) ]`。
        *   依據選取狀態即時動態更換對應之架構全景展示圖與詳細技術參數說明。
    *   **Chapter 03: 零幻覺氣閘與人機協同安全防護 (Zero-Hallucination HITL Airlock & Enterprise Access)**：
        *   深度剖析 4 層安全氣閘（唯讀 SQL 沙盒、Human-in-the-Loop 二次確認、不可逆審計日誌、零外洩防護）。
*   **智能驗證與工作區跳轉閉環 (`LandingPage.tsx`, `useAuth`)**：
    *   整合 `useAuth()` 認證鉤子，實裝 `handleEnterMissionControl` 智能跳轉機制。
    *   點擊導航列 `ENTER MISSION CONTROL` 或首頁 Hero 區 `LAUNCH SANDBOX DEMO` 時：
        *   **已登入用戶**：直接快速進入 `/app` 工作區（Mission Control Dashboard）。
        *   **未登入用戶**：流暢導向 `/auth/sign-in` 登入頁，完成登入後自動無縫跳轉進入 `/app`。

---

### Phase 6.7: 全站頂部 Header 身份模式清理、Member 多租戶 UID 欄位擴展與 Production 全面部署 (Header Simplification, Multi-Tenant Member Schema Migration & Production Deployment) (2026-09-14)
*   **頂部導航欄 UI 淨化與檢視身份模式移除 (`frontend/src/App.tsx`)**：
    *   移除頂部導航列冗餘之「👀 檢視身份模式 (User Impersonation)」下拉選單，解除畫面視覺雜訊。
    *   替換為簡潔之 `⚡ Mission Control` 狀態徽章，預設鎖定全功能 ADMIN 角色運作，避免未授權狀態切換。
*   **Member 資料表多租戶專屬 UIDs 擴展與資料庫遷移 (`backend/src/db.ts`)**：
    *   針對 `public.member` 補全 `own_workspace_uid`、`shared_workspace_uid`、`shared_project_uid` 等多租戶專屬陣列欄位。
    *   於後端啟動時自動檢查並執行 Schema Migration，確保成員資料關聯與權限過濾欄位完整呈現。
*   **雲端全棧 Production 部署上線**：
    *   前端完成 TypeScript 嚴格檢查（零編譯錯誤）並部署至 Cloudflare Workers (`https://projectson.taipingmuntech.com` / `https://projectson.edmondylchan2002.workers.dev`)。
    *   後端同步推送到 GitHub `main` 分支並觸發 Railway CI/CD 自動構建。

---

### Phase 6.8: 產品總表與專案總表全選/多選/單選、批次作廢/取消與批次刪除實裝 (Product & Project Table Selection, Batch Abandon & Batch Delete) (2026-09-14)
*   **多選/全選 Checkbox 系統與批次操作浮動膠囊列 (`ProjectTable.tsx`)**：
    *   實裝表頭全選按鈕（`Square` / `MinusSquare` / `CheckSquare` 三態切換）與第一欄（Sticky Left）單選 Checkbox。
    *   實裝選中高亮背景（Cyan Highlight `rgba(56, 189, 248, 0.08)`）與浮動膠囊列（`Layers` 計數、取消選取、標記 Abandoned 作廢、批次刪除）。
*   **操作欄位與後端批次 API 支援 (`backend/src/routes/projects.ts`, `api.ts`)**：
    *   後端新增 `POST /api/projects/batch-delete` 與 `POST /api/projects/batch-status`。
    *   表格末端新增 `操作` 欄位與單項刪除 Trash2 按鈕（附帶二次防呆確認）。

---

### Phase 6.9: 系統架構極致簡化 — 全面退役 Level 0 知識庫與 Level 2 Sources 分頁，萬物歸一至 Information 工單 (Decommission Knowledge Hub in favor of Information Items & Zero Dead Code) (2026-09-14)
*   **架構理念重構（萬物皆工單 Single Mental Model）**：
    *   取消獨立的 Sources 知識庫與文件切片模式，將所有架構規格、技術背景、API 規範、環境配置與 SOP 全面統一為 **`Information` 原生工單 (`item_type = 'Information'`)**。
    *   享有完整的 5 層追溯階層掛載、雙向關聯鏈（`covers`, `blocks`）與 0 Token 毫秒級 SQL 直讀。
*   **徹底清除無用代碼與組件 (Zero Dead Code Enforcement)**：
    *   **前端清理**：
        *   從 [Sidebar.tsx](file:///Users/edmondchan/Documents/文件%20-%20Edmond的MacBook%20Air/Local%20Mac/AI/AI%20Project/AI%20Project%20Doc%20Manager/20260909%20Projectson/frontend/src/components/Sidebar.tsx) 移除 `📚 Knowledge Hub (知識庫)` 按鈕與 `knowledge` 導航類型。
        *   從 [ProjectDetailView.tsx](file:///Users/edmondchan/Documents/文件%20-%20Edmond的MacBook%20Air/Local%20Mac/AI/AI%20Project/AI%20Project%20Doc%20Manager/20260909%20Projectson/frontend/src/components/ProjectDetailView.tsx) 移除 `📁 知識文件 (Sources)` Tab 與渲染邏輯。
        *   從 [App.tsx](file:///Users/edmondchan/Documents/文件%20-%20Edmond的MacBook%20Air/Local%20Mac/AI/AI%20Project/AI%20Project%20Doc%20Manager/20260909%20Projectson/frontend/src/App.tsx) 移除 `activeNav === 'knowledge'` 分支與未使用之 Import。
        *   從 [api.ts](file:///Users/edmondchan/Documents/文件%20-%20Edmond的MacBook%20Air/Local%20Mac/AI/AI%20Project/AI%20Project%20Doc%20Manager/20260909%20Projectson/frontend/src/utils/api.ts) 移除 `KnowledgeSource` 介面與 `getSources`/`deleteSource` 等 API 方法。
        *   物理刪除死代碼檔案 `frontend/src/components/ProjectSourcesView.tsx`。
    *   **後端清理**：
        *   從 [index.ts](file:///Users/edmondchan/Documents/文件%20-%20Edmond的MacBook%20Air/Local%20Mac/AI/AI%20Project/AI%20Project%20Doc%20Manager/20260909%20Projectson/backend/src/index.ts) 移除 `sourceRouter` 與 `/api/sources` 路由註冊。
        *   物理刪除死代碼檔案 `backend/src/routes/sources.ts`。
        *   於 [copilot.ts](file:///Users/edmondchan/Documents/文件%20-%20Edmond的MacBook%20Air/Local%20Mac/AI/AI%20Project/AI%20Project%20Doc%20Manager/20260909%20Projectson/backend/src/routes/copilot.ts) 移除 `okf_sources` 查詢與 `sourcesContext`，並更新 Prompt 強化 `Information` 工單作為規格唯一真相（Single Source of Truth）。
*   **雲端全棧 Production 部署上線**：
    *   前端完成 0 Error 編譯並部署至 Cloudflare Workers，後端同步推送至 GitHub `main` 分支。

---

### Phase 7.0: Copilot 劇院工作區重構 (Mode 1)、ItemDrawer 遮擋消除、頂部緊湊排版與 Gemma 4 31B 預設升級 (2026-09-20)
*   **Copilot & Proposal 模式 1 (輕量側欄 + 中央劇院彈窗) 重構 (`frontend/src/App.tsx`, `ProposalCanvas.tsx`, `CopilotDrawer.tsx`)**：
    *   移除過往 Proposal Canvas 對主畫面的 920px 擠壓，將主畫面右邊距鎖定為輕量 380px。
    *   將 `ProposalCanvas` 升級為 1020px 中央工作區劇院彈窗（Center Studio Modal），配備毛玻璃 Backdrop 遮罩與全功能單項/批次 Diff 審批。
    *   為 CopilotDrawer 實裝全螢幕專注思考模式（`[ ⛶ / ❐ ]`），支援一鍵在 380px 與全屏模式間無縫切換。
*   **工單詳情 ItemDrawer 空間防遮擋 (`ItemDrawer.tsx`, `App.tsx`)**：
    *   新增 `isCopilotOpen` 響應式屬性，當 Copilot 側欄展開時，`ItemDrawer` 自動設定 `right: 380px`。
    *   工單詳情彈窗自動居中於左側工作區可視空間，右上角 `✕` 關閉按鈕與右側屬性操作面板 100% 完整露出，不再被 Copilot 遮擋。
*   **Copilot 頂部 Header 緊湊美化與文字防折行 (`CopilotDrawer.tsx`)**：
    *   精簡左側圖示（26px）與標題為單行緊湊排版（`Copilot` + `OKF v0.2` Tag），移除多餘的副標題佔位。
    *   右側按鈕群（「新對話」、「歷史」等）設定 `whiteSpace: 'nowrap'`、緊湊內邊距與間距，徹底解決 380px 寬度下文字垂直堆疊換行的擠迫問題。
*   **預設 LLM 升級為 Gemma 4 31B (Ollama Cloud)**：
    *   前端 `selectedModel` 預設值與後端 `LLM_ROUTER_MODEL` Fallback 統一改為 `gemma4:31b-cloud`。
*   **Cloudflare Workers Production 部署**：
    *   前端 TypeScript 構建通過並順利發布至 Production (`https://projectson.taipingmuntech.com` / `https://projectson.edmondylchan2002.workers.dev`)。

---

### Phase 7.1: 整合式大畫布 (Unified Proposal Studio 方案 A) 實裝 — 消除焦點搶奪與多 Batch 架構分組展示 (2026-09-20)
*   **非侵入式對話 UX（Non-Intrusive Chat Flow）**：
    *   移除 AI 串流完成時自動執行 `setActiveProposal` 的霸道彈窗行為，確保用家閱讀 AI 解釋與分析的連續性。
    *   對話氣泡底部新增「📦 AI 綜合架構提案卡片」，提供「🔍 審核完整提案畫布」與「✨ 一鍵執行」主動控制按鈕。
*   **多 Batch 提案合流與架構分組大畫布 (`ProposalCanvas.tsx`, `CopilotDrawer.tsx`)**：
    *   將同一訊息中產生的所有動作（會議章程、核心決策、5 層溯源骨架等）自動合流為單一提案。
    *   `ProposalCanvas` 支援 Section 分組卡片展示（`📁 會議與章程`、`💡 核心決策與阻礙`、`🌳 5層溯源骨架`），並提供分組全選與全域選取控制。
    *   畫布底部統一為 `核准並套用已選工單 (共 N 項)`，一次性將完整架構樹安全寫入 Neon DB。
*   **生產環境發布**：
    *   通過 TypeScript 嚴格檢查並順利部署至 Cloudflare Workers Production。

---

### Phase 7.9: 自適應專家群協同架構 (Adaptive Specialist Swarm Architecture) (2026-09-20)
*   **多專家 Agent 分工架構實裝 (`backend/src/agents/`)**：
    *   **LLM Client (`llmClient.ts`)**：提供統一的多模型調用客戶端，支援 Ollama Cloud、OpenAI 相容協議，具備結構化 JSON 輸出與重試防護機制。
    *   **Charter Agent (`charterAgent.ts`)**：專門負責 Project Charter 項目章程萃取與整合，維護單一專案章程真相。
    *   **Spine Agent (`spineAgent.ts`)**：專門負責 5 層追溯骨幹（Objective -> Requirement -> User Story -> Task -> Acceptance Criteria / UAT）拓撲結構提煉。
    *   **Decision Agent (`decisionAgent.ts`)**：專門負責 Meeting 紀錄、核心決策（ADR）、阻礙與行動項目的萃取。
    *   **Supervisor Critic (`supervisorCritic.ts`)**：總指揮審計器，負責語義去重、拓撲關聯修復與輸出整合。
    *   **Orchestrator (`orchestrator.ts`)**：協同調度引擎，依據用戶輸入動態分發任務給各領域專家並整合提案。

---

### Phase 7.10: 對話前言過濾、單一會議收斂與拓撲別名鏈接 (Junk Filter, Single Meeting Consolidation & In-Batch Topological Parent Linking) (2026-09-20)
*   **對話前言雜訊消除 (`copilot.ts`, `supervisorCritic.ts`)**：
    *   嚴格限制 AI 輸出非工單內容的冗贅開場白，確保產出的 Actions 乾淨可執行。
*   **會議單一化收斂與拓撲別名鏈接 (`items.ts`, `copilot.ts`)**：
    *   單次 Meeting Recap 輸入收斂為單一 Meeting 工單，防止重覆分散。
    *   實裝批次內拓撲別名解析機制（`in-batch multi-alias topological parent linking`），保證子工單正確錨定父級工單 ID。

---

### Phase 7.11: 專案章程唯一性收斂 (Rule 6.0.1) 與工單標題前綴清理 (Single Charter Enforcement & Title Prefix Normalization) (2026-09-20)
*   **單一 Charter 強制約束 (Rule 6.0.1)**：
    *   在 Supervisor Critic 與 Charter Agent 注入防呆規則：單一專案內永遠只維護一個 Project Charter，新內容自動執行 UPDATE 或補充，嚴禁新建第二個獨立章程。
*   **工單標題格式對稱化與前綴移除**：
    *   清除頂層工單名稱中的非對稱 Markdown/類型前綴（如 `Objective**:`, `[Requirement]:`），保持全層級工單標題整潔統一。

---

### Phase 7.12: 全工單總表專案多選篩選器 (All Items Table Project Multi-Select Filter) (2026-09-20)
*   **專案篩選下拉清單 (`frontend/src/components/AdvancedTable.tsx`)**：
    *   在 `All Items` 總表頂部工具列新增 `全部專案 ∨` 多選/全選篩選器，支援依專案快速過濾工單。
    *   實裝跨專案工單即時搜尋與多維度組合過濾能力。

---

### Phase 7.13: 範本引導式動態萃取與格式對齊引擎 (Template-Driven Few-Shot Ingestion Engine) (2026-09-20)
*   **專案自定義範本風格探測器 (Zero-Config Template Sniffer)**：
    *   **Charter Agent (`charterAgent.ts`)**：動態檢測專案既有章程的格式（Markdown GFM 表格 vs 段落章節標題清單 vs 自定義大綱），100% 依循用戶風格進行萃取與更新，杜絕生硬格式強加。
    *   **Spine Agent (`spineAgent.ts`)**：動態探測現有 User Story（如 Given-When-Then、As-a-I-want 格式）與 UAT 驗收標準範本，自動對齊用戶既定格式。
    *   **Decision Agent (`decisionAgent.ts`)**：動態探測專案既有 Decision（ADR Context-Decision-Consequences）與 Meeting 紀錄結構，精準繼承用家偏好格式。
*   **全棧構建與部署**：
    *   後端與前端完成 0 Error 編譯檢查，前端成功部署至 Cloudflare Workers。



