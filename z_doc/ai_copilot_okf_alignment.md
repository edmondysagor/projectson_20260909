# 🧠 AI Copilot 與 OKF + Graph RAG 知識庫完整系統規格 (Aligned System Spec)

> **版本**：v1.2 (納入 Information 知識來源定案版)  
> **更新日期**：2026-09-11  
> **系統定位**：Projectson AI PM Hub  
> **核心標準**：Google OKF v0.2 / Hybrid Graph RAG / Actionable Agentic PM / Zero-Token Cost Control

---

## 📌 一、核心架構與檢索分工 (Core Architecture & Hybrid Retrieval)

### 1. 雙軌檢索分工：SQL 精準查詢 vs 向量/圖譜語意檢索
全系統嚴格劃分「結構化工作態」與「非結構化知識態」，避免盲目 Embedding 導致的 Token 浪費與資料滯後：

| 數據維度 | 包含內容 | 檢索與處理機制 | 成本與延遲 |
| :--- | :--- | :--- | :--- |
| **工作態數據 (90%)** | 任務狀態、指派人、截止日、5 層 Traceability 樹狀鏈、卡片數量、日常工單的 `item_content` (BlockNote) 與 `item_comment` (Task, Story, Req, Bug 等) | **純 SQL 查詢 (PostgreSQL / JSONB 原生查詢)**<br>AI 透過 Tool Calling 直讀直寫資料庫。 | **0 Token 耗費**<br>< 10ms 即時響應<br>100% 精準無幻覺 |
| **知識態大數據來源 (10%)** | 1. 外部上傳的 PDF/DOCX/PRD 規格書<br>2. 內部工單 **`ℹ️ Information`** (技術背景、外部 API 規格、環境配置、SOP 備忘)<br>3. 正式定案的 **`💡 Decision`** (決策理由與權衡)<br>4. 已解決的 **`⚠️ Bottleneck`** (Root Cause 排查心得)<br>5. 專案章程 **`📜 Charter`** (專案目標與願景)<br>6. 對話動態規則 (`okf-dialogue-memory`) | **雙軌並行**：<br>1. 日常精準查詢走 SQL 直讀<br>2. 當 Information 建立/更新完成時，非同步提取 BlockNote 文本進行 DashScope 768-dim 向量化，作為 Graph RAG 跨專案語意檢索來源。 | **極低成本**<br>百萬 Token 約 $0.02 USD<br>語意檢索能力極高 |

---

### 2. 工單更新 (Content / Comment) 的觸發與分流規則
當用家修改工單內容或新增評論時，系統採取極致清晰的三大分流：

```
工單更新 (修改 Content / 新增 Comment)
                 │
                 ▼
         判斷工單類型是什麼？
                 │
      ┌──────────┼──────────────────────────────┐
      ▼          ▼                              ▼
【普通工單】  【資訊工單 Information】       【決策/阻礙工單 Decision, Bottleneck】
(Task/Story)   (技術背景/SOP/API配置)          (架構權衡 / Root Cause)
      │          │                              │
      ▼          ▼                              ▼
 🚀 僅存 DB    🚀 即時寫入 DB                   判斷狀態是否為 Approved / Resolved？
 (0 Token)       + 非同步更新 OKF/RAG 向量庫          │
                 (讓 AI 具備語意長文檢索能力)    ├── 是 ──► 🧠 觸發非同步 OKF/RAG 沉澱
                                                └── 否 ──► 🚀 僅存入 Neon DB (草稿期純 SQL 查)
```

---

## 📌 二、多用家並發與情報對齊 (Concurrency & Proactive Delta Alerting)

### 1. 唯一客觀時間基準：`updated_at` (徹底捨棄 Flag)
* **無狀態時間軸 (Stateless Time-window)**：
  * 不在資料庫中維護容易產生 Race Condition 的 `inform_ind` 或單一知悉時間戳。
  * 以 PostgreSQL 原生觸發器維護的 **`updated_at` (TIMESTAMPTZ)** 作為唯一客觀基準（Ground Truth）。
* **多用家隔離查詢**：
  * 當任何用家進入專案同 AI 傾偈時，AI 直接以當前時間往前推算（例如 `updated_at >= NOW() - INTERVAL '24 HOURS'`），精準列出最近被推進／被留言的工單動態，多個用家同時使用各自獨立，完全不打交。

### 2. 主動式智能提醒 (Proactive Delta Alerting)
* **自然語言概念對齊 (Entity Linking)**：
  * 用家無需背誦 Display Code，隨意問：「*個結帳畫面點呀？*」
  * AI 自動透過 SQL 比對命中 `[TTG-5]`，並依據最新 `updated_at` 發現 Chris 在 10 分鐘前剛留了 Comment 並將狀態推至 `Review`。
* **主動匯報最新進展**：
  * AI 不僅回答現況，還會主動帶出最新動態：「*順帶提醒你，Chris 喺 10 分鐘前啱啱將狀態推至 `Review`，並留言提到測試環境已部署囉！*」

---

## 📌 三、多租戶安全性與文件管理 (Multi-Tenant & Source Hub)

### 1. 嚴格的多租戶數據隔離 (Strict Multi-Tenant Isolation)
* **租戶防線 (Workspace Boundary)**：不同公司（Workspace）之間數據**絕對隔離**。任何 SQL、pgvector 近似搜尋與圖譜遍歷，後端**強制鎖死** `WHERE workspace_uid = $current_user_workspace_uid`。
* **知識繼承層級 (Scope Hierarchy)**：
  * **Workspace 全域知識**：公司級別通用規範（如 Coding Standard、通用 API 格式），該 Workspace 內所有 Project 自動繼承。
  * **Project 專屬知識**：專屬該專案的 PRD 與需求，跨 Project 預設不干擾，但可透過 AI 智慧建議過往歷史根因。

### 2. 文件管理模式 (NotebookLM-Style Sources vs 拒絕傳統檔案總管)
* **摒棄傳統樹狀資料夾總管**：避免階層搬移的認知負擔，RAG 檢索核心為語意與 Metadata。
* **採用「來源卡片庫 (Source Cards)」**：
  * 卡片顯示：檔名、大小、頁數、解析狀態 (`🟢 已完成索引 (xx 節點)`)。
  * 支援單項來源啟用/停用勾選（Source Toggles），精準控制 AI 本次對話的參考範圍。
  * 支援一鍵溯源（點擊引用標籤查看原文段落與頁碼）。

### 3. UI 入口佈局 (UI Entry Point)
* **Level 2 專案詳情頁新增 Tab**：
  * 在現有 Tabs 列新增 **`📁 知識文件 / 來源 (Sources)`**（附帶數量計數，例如 `📁 知識文件 (3)`）。
  * 點入後提供拖放上傳區（Drag & Drop Zone）及 NotebookLM 風格的卡片清單。
* **全域 AI Copilot 抽屜 (Side Drawer)**：
  * 懸浮按鈕或頂部常駐入口，點擊自右側滑出對話面板，支援全螢幕隨時召喚。

---

## 📌 四、Actionable AI Agent 與刪除保護 (Agentic PM & Cascading Protection)

### 1. 可執行工單的 AI 專案經理 (Tool Calling)
* **AI 不只做 Q&A，具備工單寫入與編輯能力**：
  * 透過 Tool Calling 調用既有後端 API（`create_item`, `update_item`, `batch_create_hierarchy` 等）。
* **支援場景**：
  * **對話式操作**：「幫我喺 TTG-2 下面開多個 Requirement...」
  * **PRD 一鍵拆解**：上傳 PRD PDF，AI 自動提取需求與 Story，批次寫入 Traceability 矩陣。
* **Human-in-the-loop 確認機制**：
  * 批次建立或重大變更前，Copilot 介面呈現預覽卡片，需用家點擊「確認套用 (Apply)」後才寫入資料庫。

### 2. 刪除與數據一致性防護 (Delete & Cascade Invalidation)
* **文件刪除 (File Delete)**：
  * 刪除檔案記錄 ➡️ 資料庫自動 **`ON DELETE CASCADE`** 級聯刪除對應的 `okf_chunks` (向量資料) 與 `okf_concepts`。
  * 同步非同步刪除 Cloudflare R2 上的實體檔案（**0 Token 消耗**）。
* **工單刪除 / 廢棄 (Item Delete / Abandon)**：
  * **物理刪除**：級聯清除對應的向量索引與關係邊。
  * **狀態改為 Abandoned (廢棄)**：保留節點但標記為 `is_archived = true`，AI 搜尋時自動過濾排除，防止 AI 引述已廢棄的假需求。

---

## ❓ 五、待討論與未敲定事項 (Pending / Open Questions 🔍)

| 序號 | 待確認項目 | 討論焦點 / 備選方案 | 建議方向 |
| :--- | :--- | :--- | :--- |
| **Q1** | **Workspace 全域文件的上傳位置** | 目前 Project 專屬文件放在 Level 2 Tab，那「全公司共用文件」要在左側 Sidebar 加一個 `🌐 全域知識庫` 頁面，還是在專案內上傳時用 Switch 切換「設為全域共用」？ | 建議兩者兼備：Sidebar 有全覽總表，上傳時可選 Scope。 |
| **Q2** | **檔案實體儲存空間** | 上傳的原始 PDF/DOCX 檔案存放在 Cloudflare R2 還是本地/GCP Cloud Storage？ | 建議走 Cloudflare R2 (零出流量費用，且現有圖片已接通 R2)。 |
| **Q3** | **向量化與 LLM 模型選型** | 1. Embedding 模型：採用 DashScope 768-dim 還是 OpenAI `text-embedding-3-small`？<br>2. Chat/Tool Calling 模型：Gemini 2.5 Flash 還是 Claude 3.5 Sonnet？ | 建議 Embedding 用 DashScope (極低成本)，Chat/Tools 用 Gemini 2.5 Flash (速度快、支援超大上下文)。 |
| **Q4** | **文件解析進度與非同步佇列** | 若用家上傳 50 頁超長 PRD，前端如何呈現解析進度？需不需要做 SSE (Server-Sent Events) 即時進度條？ | 採用輪詢 (Polling) 或 SSE 即時推播 `parsing > chunking > embedded` 狀態。 |
| **Q5** | **AI 建議覆寫 (Conflict Handling)** | 當用家在對話中提到的規則與已上傳的 PRD 產生衝突時，AI 是否自動發起彈窗提示衝突並引導用家做 `Decision`？ | 是，引導用家建立 `Decision` 工單並標記舊規則 `SUPERSEDES`。 |

---

## 🚀 六、後續實施 Roadmap (Next Steps)

1. **Phase 4.1 (OKF Schema & Vector Infrastructure)**：
   * Neon DB 擴充 `okf_sources`、`okf_chunks` (pgvector 768-dim)、`okf_concepts` 與 `okf_links`（配置 `ON DELETE CASCADE` 外鍵防護）。
2. **Phase 4.2 (Project Sources UI)**：
   * 在 `ProjectDetailView.tsx` 實現 `📁 知識文件` Tab、來源卡片庫與拖放上傳組件。
3. **Phase 4.3 (File Parser & Ingestion Pipeline)**：
   * 後端接入 R2 儲存 + PDF/Text Parser + DashScope Embedding 寫入 pgvector。
4. **Phase 5.1 (Copilot Drawer & Tool Calling Router)**：
   * 前端右側 Copilot 抽屜 + 後端 Tool Calling 執行既有工單 CRUD 與精準 SQL 查詢。
