# 專案啟動與架構決策會議記錄 (Meeting Minutes)
**會議主題**：Self-Boarding Gate Automation (SBG) 系統第一期架構定案與章程確認
**會議日期**：2026-09-13 14:30 - 16:30
**會議地點**：機場控制塔 3 號會議室 / Google Meet
**出席成員**：
- Edmond Chan (Project Owner & Lead Architect)
- Kevin Lau (Senior Backend Engineer)
- Sarah Wong (Frontend & Embedded UI Engineer)
- David Cheung (Airport Operations & Security Specialist)

---

### 1. 專案章程總體目標 (Project Charter & Core Objectives)
- **商業總目標 (Objective)**：打造全球領先的新一代生物辨識自動登機門 (SBG)，將旅客平均登機過閘時間縮短至 2.5 秒內，並達成 99.99% 的系統可用性。
- **專案範疇 (Scope)**：
  1. 登機門嵌入式觸控終端 UI 與雙鏡頭人臉/QR 掃描整合。
  2. 高可用後端微服務（託管於 Google Cloud Run，延遲 < 150ms）。
  3. 與機場離港系統 (DCS) 及旅客安檢清單的即時 API 雙向對接。
- **目標里程碑 (Milestones)**：
  - 2026-10-15：完成 Alpha 版閘門離線快取與核心核驗引擎。
  - 2026-11-30：於 12 號登機門進行現場 UAT 壓力驗收測試。

---

### 2. 重大架構決策 (Key Architecture Decisions)
1. **[Decision] 人臉特徵比對與資料庫架構**：
   - 經討論一致決定採用 Neon PostgreSQL + pgvector (768-dim) 作為人臉特徵向量比對引擎，淘汰舊版 Redis 方案，以確保完全符合 Google OKF 知識圖譜標準。
2. **[Decision] 閘門離線降級容災機制 (Offline Fallback)**：
   - 當機場主網絡中斷時，登機閘門端微服務自動切換至本機 SQLite/內存白名單模式，保障登機流程不中斷。

---

### 3. 技術阻礙與風險評估 (Bottlenecks & Risks)
- **[Bottleneck] 第三方 DCS API 響應延遲與 Rate Limit**：
  - 機場舊版 DCS 系統在高峰期 API 響應高達 800ms，且缺乏批量查詢介面，可能導致閘門等待逾時。需由 Kevin 負責構建 Local Cache Worker 進行預先拉取緩存。

---

### 4. 具體功能需求與任務分工 (Requirements, Tasks & Action Items)
1. **[Requirement] 雙模態身份驗證 (QR Code + Face Recognition)**
   - **[User Story]** 作為登機旅客，我期望在刷電子登機證 QR Code 的同時完成人臉特徵採樣，以便在 2.5 秒內無感通過閘門。
   - **[Task]** (指派給: Kevin Lau) 開發 Cloud Run 上的 `/api/v1/gate/verify` 雙模態並行核驗端點，預計 9月20日前交付。
   - **[Task]** (指派給: Sarah Wong) 開發登機門雙螢幕引導動畫與即時狀態回饋 UI (React + Tailwind)，預計 9月22日前交付。

2. **[Requirement] 閘門硬件與通行控制通訊協議 (Gate Controller Protocol)**
   - **[Task]** (指派給: Edmond Chan) 封裝 WebSocket/MQTT 閘門開啟/阻擋硬件指令控制層，並建立心跳健康檢查。

---

### 5. 驗收測試標準 (UAT & Acceptance Criteria)
- **[UAT-01] 500 人次連續壓力測試**：
  - 模擬滿載航班 500 名旅客連續刷票過閘，平均核驗響應時間必須小於 200ms，誤拒率 (FRR) < 0.01%，零 Crash。
- **[UAT-02] 斷網容災切換測試**：
  - 在旅客登機過程中拔除外網線，系統需在 1 秒內無縫切換至離線白名單核驗，閘門正常運作並記錄 Audit Log。