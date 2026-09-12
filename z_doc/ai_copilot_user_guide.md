# 🧠 Projectson Actionable AI Copilot 全功能操作手冊與能力全景指南 (User & Feature Guide)

> **版本**：v2.0 (全功能整合版)  
> **更新日期**：2026-09-12  
> **適用角色**：專案經理 (PM)、技術負責人 (Tech Lead)、工程師、產品負責人 (PO)  
> **系統定位**：結合 Jira 追蹤能力、Notion 區塊編輯體感與 Google OKF v0.2 圖譜的 Actionable AI 專案經理中樞。

---

## 🧭 一、AI Copilot 核心能力全景地圖 (Feature Map)

Projectson AI Copilot 唔單止係一個聊天機械人，而係一個具備 **「直接查庫 (Read) + 提案審核 (Canvas Review) + 安全寫入 (Write) + 知識沉澱 (OKF RAG)」** 的全功能 AI 專案經理。

```
                                  ┌─────────────────────────────────┐
                                  │   Projectson AI Copilot 中樞    │
                                  └────────────────┬────────────────┘
                                                   │
        ┌──────────────────────────┬───────────────┴───────────────┬──────────────────────────┐
        ▼                          ▼                               ▼                          ▼
【1. 即時查庫與統計】       【2. 單項/指派/更新】           【3. PRD 一鍵拆解/批量提案】   【4. 對話共識沉澱至知識庫】
- Workspace 專案總覽       - 對話式開單 (自動掛載父項)      - 需求自動拆分至 5 層結構      - 口頭共識自動識別
- 5 層 Traceability 樹    - 智能指派成員 (名稱轉 UUID)     - 自動展開 900px 審批工作台    - 一鍵生成 Approved Decision
- 唯讀 SQL 動態安全查詢    - 狀態/優先級就地更新            - 逐項勾選、行內修改、批量套用  - 同步 OKF 概念圖譜
```

---

## 💬 二、你可以點樣同 AI 溝通？（常用對話範例指令庫）

以下係所有已支援並經過端到端驗證的對話指令範例，你可以直接複製或用自然語言口吻向 AI 發問：

### 📊 1. 查詢與專案進度類 (Query & Overview)

| 用戶指令範例 | AI 的處理動作與反饋 |
| :--- | :--- |
| 「*本工作區有幾多個專案？進度點樣？*」 | 調用 `get_workspace_overview`，列出所有 Project/Product、狀態、代碼與 Owner。 |
| 「*目前專案有咩 Objective 同 Requirement？*」 | 調用即時 Context，清楚列出 5 層追溯鏈之 Objective 代號（如 `TTG-2`）、狀態與負責人。 |
| 「*幫我查下 Chris Chow 身上掛住幾多個任務？*」 | 調用 `search_items(assignee_name='Chris Chow')`，列出其負責工單與優先級。 |
| 「*計下有幾多個 High priority 且 Blocked 嘅 Bug？*」 | 調用唯讀 SQL 沙盒 `execute_read_only_sql` 執行聚合統計並總結回覆。 |

---

### ➕ 2. 單項開單與掛載父工單 (Single Create with Hierarchy)

當你需要快速開單，AI 會生成 **綠色「一鍵套用至專案 (Apply)」卡片**：

* **對話範例 1**：
  > 🗣️ **用戶**：「*幫我加個附屬 task 比 TTG-14，標題寫『實裝八達通付款回調』*」  
  > 🤖 **AI 輸出**：生成建立工單卡片 `[任務] 實裝八達通付款回調`，自動解析父工單 `TTG-14`。  
  > 🖱️ **操作**：點擊綠色 **【一鍵套用至專案 (Apply)】** ➔ 即時寫入資料庫並於看板/矩陣顯示。

* **對話範例 2**：
  > 🗣️ **用戶**：「*喺 TTG-3 下面開多個 User Story: 支援 Apple Pay，指派比 Chris Chow，優先級 High*」  
  > 🤖 **AI 輸出**：生成帶指派人 `Chris Chow` 與高優先級的開單卡片。  
  > 🖱️ **操作**：點擊 **【一鍵套用至專案 (Apply)】** ➔ 完成建立。

---

### ✏️ 3. 工單指派、修改標題與狀態更新 (Update & Assign)

* **對話範例 1 (指派與狀態)**：
  > 🗣️ **用戶**：「*幫我把 TTG-12 指派比 Edmond，並將狀態改為 In Progress*」  
  > 🤖 **AI 輸出**：生成更新卡片 `[TTG-12] ➔ 指派給 Edmond，狀態改為 In Progress`。  
  > 🖱️ **操作**：點擊 **【一鍵套用至專案 (Apply)】** ➔ 即時 PATCH 更新，左側抽屜同步響應。

* **對話範例 2 (修改標題)**：
  > 🗣️ **用戶**：「*將 TTG-5 嘅標題改為『重構結帳流程 API』*」  
  > 🤖 **AI 輸出**：生成標題修改卡片。  
  > 🖱️ **操作**：點擊 **【一鍵套用至專案 (Apply)】**。

---

### 🗑️ 4. 工單作廢與刪除安全規範 (No Hard Delete & Cancel/Close)

為符合工程專案審計與追溯完整性，AI 遵守 **No Hard Delete（無物理刪除權限）** 鐵律：

* **對話範例**：
  > 🗣️ **用戶**：「*幫我 delete TTG-30*」  
  > 🤖 **AI 輸出**：說明系統安全規範，並主動生成更新卡片，將 `TTG-30` 的狀態改為 **`Closed`（已作廢）** 或解除父子關聯。  
  > 🖱️ **操作**：點擊 **【一鍵套用至專案 (Apply)】** ➔ 完成工單作廢標記。

---

### 📑 5. PRD 一鍵拆解與批量提案 (Batch Proposal & 900px Canvas)

當你需要對複雜模組進行整體架構拆分時，AI 會主動觸發 **900px 雙面板 Proposal Canvas 工作台**：

* **對話範例**：
  > 🗣️ **用戶**：「*我哋要開發會員積分系統，請幫我由 Objective、Requirement 拆解到具體 Tasks*」  
  > 🤖 **AI 輸出**：
  > 1. Chat Box 輸出架構思考與分析。
  > 2. 抽屜自動平滑展開至 900px，右側打開 **Proposal Canvas** 審批工作台。
* **Proposal Canvas 核心操作**：
  * ☑️ **全選 / 取消全選**：一鍵控制整批項目。
  * 🔲 **逐項審核**：個別勾選 Approve 或 Skip。
  * ✏️ **行內即時修改**：直接在 Canvas 上修改工單標題、切換工單類型（支援全部 16 種合法類型：Objective / Requirement / User story / Task / UAT / Bug / Decision / Bottleneck / Information 等）、變更優先級（High / Middle / Low）或指派團隊成員。
  * ➕ **加一項**：臨時手動追加自訂工單。
  * 🚀 **套用已核准項目 (Apply Selected)**：點擊後後端發起**原子事務 (`POST /api/items/batch`)**，一次性批量配號寫入 Neon DB！

---

### 📌 6. 對話共識沉澱至 OKF 知識庫 (Dialogue Consensus Distillation)

當你同 AI 喺對話中達成重大架構決策（例如技術選型、業務邊界定案）：

* **對話範例**：
  > 🗣️ **用戶**：「*傾完之後，我哋決定全面採用 Neon PostgreSQL 取代 DynamoDB，因為需要強一致性事務*」  
  > 🤖 **AI 輸出**：AI 偵測到架構共識，輸出金黃色卡片：`📌 對話共識沉澱提案：採用 Neon PostgreSQL 作為主資料庫`。  
  > 🖱️ **操作**：點擊金黃色按鈕 **【📌 沉澱至專案知識庫與 Decision 工單】**：
  > 1. 自動建立一張已完成 (`Completed`) 狀態的 `💡 Decision` 工單。
  > 2. 自動寫入 Google OKF 雙時態概念圖譜 (`public.okf_concepts`)，建立知識節點，日後對話永久記住！

---

## ⚙️ 三、抽屜頂部控制列功能說明

在 AI Copilot 抽屜頂部，提供以下兩大進階控制項：

```
┌─────────────────────────────────────────────────────────────┐
│ ⚡ Qwen 3.8 Flash (極速輕量)  ▼  │  🧠 思考模式  [●] ON      │
└─────────────────────────────────────────────────────────────┘
```

1. **多模型切換器 (Model Switcher)**：
   * **⚡ Qwen 3.8 Flash (預設)**：響應極快 (< 1s)，適合日常查詢、快速開單與指派。
   * **🚀 Qwen 2.5 Plus**：智商均衡主力，推薦用於長文分析、複雜依賴鏈梳理。
   * **🧠 Qwen Max**：旗艦級推理，適合超複雜業務架構推演。
   * **🔮 DeepSeek V3**：通用開源大模型，代碼與敏捷工程理解極佳。
   * **🎯 DeepSeek R1**：深度長思維鏈推理，專精系統根因排查 (Root Cause Analysis)。
2. **🧠 深度思考模式 (Thinking Mode 開關)**：
   * 開啟後，AI 在輸出最終結論前，會將其內部推理思維鏈封裝於紫灰色 `<think>...</think>` 摺疊卡片中，點擊可展開檢視推演過程，保證邏輯透明無黑盒。

---

## 🛡️ 四、底層安全與容錯防護機制（點解唔會再報錯崩潰？）

| 防護層級 | 解決的痛點 | 實裝的防禦機制 |
| :--- | :--- | :--- |
| **Schema 嚴格枚舉防線** | 避免 `item_item_status_check` 約束崩潰 | AI 認知全面注入 8 大合法狀態（`Not Start`, `Ready`, `In Progress`, `Blocked`, `Review`, `Completed`, `Closed`, `Backlog`），所有作廢/取消一律映射至 `Closed`，完成一律映射至 `Completed`。 |
| **UUID 標識解析防線** | 避免 `invalid input syntax for type uuid: "*TTG-14*"` 崩潰 | 後端全面內置 `resolveParent` 與 `resolveMember`，自動剝離 Markdown 標記（如 `*`、`[`、`]`），自動將 Display Code（如 `TTG-14`）與成員名（如 `Edmond`）精確映射為正確的 UUID。 |
| **唯讀 SQL 沙盒防線** | 避免 AI 查庫答唔出 或 誤寫入破壞資料庫 | 注入完整 5 大表 DDL Schema。沙盒強制 `BEGIN READ ONLY` + 3000ms 超時 + 正則阻斷任何 `INSERT/UPDATE/DELETE/DROP`。 |
| **BlockNote 富文本防線** | 避免 AI 產生的 JSON 格式不合規導致前端白屏 | 後端內置 `normalizeItemContent`，無論 AI 傳入純文字、Markdown 或陣列，自動打包為合法 BlockNote blocks 結構。 |
| **原子事務防線** | 避免批量開單中途斷線導致流水號錯亂 | `POST /api/items/batch` 採用 PostgreSQL 原子事務與行級排他鎖，若有一項失敗全體自動 ROLLBACK。 |
| **審計追蹤防線** | 釐清人類修改與 AI 原因的邊界 | 每次 AI 寫入或更新，自動附加不可篡改的 `🤖 AI Copilot (Audit)` 審計時間戳與備註。 |

---

## ❓ 五、常見操作 Q&A

* **Q: 點解我點「一鍵套用」之後看板冇即時變？**
  * **A**: 系統已配置 `projectson_item_updated` 全域廣播事件，點擊後會自動局部刷新資料。如果瀏覽器有舊 Cache，可隨時按右上角重新整理或硬刷新 (`Cmd + Shift + R`)。
* **Q: 如果我想一次過開好多張 subtask，點樣最快？**
  * **A**: 直接對 AI 講：「*請以 TTG-14 為父工單，拆解出 3 個開發任務*」，AI 會直接叫出右側 900px Proposal Canvas，你可以一次過審核並批量寫入！
* **Q: 如果我想廢棄某張工單，AI 會點做？**
  * **A**: AI 會建議將狀態更新為 `Closed`（已作廢），並發出 Action 預覽供你一鍵確認套用。
