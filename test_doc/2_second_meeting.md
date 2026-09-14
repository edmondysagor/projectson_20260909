# 專案章程補完與範疇確認會議記錄 (Second Meeting Minutes)
**會議主題**：Self-Boarding Gate Automation (SBG) 系統第一期 - 章程細節定稿與邊界確認
**會議日期**：2026-09-14 10:00 - 11:30
**會議地點**：機場控制塔 3 號會議室 / 線上會議
**出席成員**：
- Raymond Lam (Business Sponsor - 機場數位轉型總監)
- David Cheung (Business Owner - 機場營運與安全部主管)
- Edmond Chan (Project Lead & 首席架構師)
- Kevin Lau (資深後端工程師)
- Sarah Wong (前端與嵌入式工程師)

---

### 1. 組織角色與管理層權責 (Roles & Governance)
- **Business Sponsor (業務贊助人)**：Raymond Lam (機場數位轉型總監)
- **Business Owner (業務負責人)**：David Cheung (機場營運與安全部主管)
- **Project Lead (專案負責人)**：Edmond Chan (Lead Architect)
- **Stakeholders (關鍵利益相關者)**：機場管理局 (AAHK)、民航處 (CAD)、地勤服務商 (HAS)、各進駐航空公司營運代表。

---

### 2. 問題診斷、商業價值與戰略對齊 (Business Case & Value)
- **Problem & Opportunity (問題與機會)**：
  現行地勤人工核驗登機證耗時冗長（平均每人 8.5 秒），尖峰時段登機口大排長龍且人力成本高昂；引入自動化雙模態生物辨識過閘可將登機效率提升 70%，顯著降低排隊時間並提升旅客滿意度。
- **Quantifiable Benefits (量化效益)**：
  節省 45% 地勤登機核驗人力成本，每班航班登機時間平均縮短 12 分鐘，每年節省逾 800 萬營運支出。
- **Non-quantifiable Benefits (非量化效益)**：
  大幅樹立智慧機場與大灣區航空樞紐創新形象，杜絕人為肉眼核驗漏看或登機證冒用風險。
- **Strategic Alignment (戰略對齊)**：
  高度對齊「智慧機場 2030 (Smart Airport 2030)」數位化願景，並符合 IATA One ID 全球無感通行規範。

---

### 3. 指標基準與範疇邊界 (Metrics, Baseline & Scope)
- **Baseline (現行基準值)**：旅客平均人工過閘時間 8.5 秒 / 系統可用性 98.5%。
- **Target (目標值)**：旅客平均生物辨識過閘時間 < 2.5 秒 / 系統可用性 99.99%。
- **In-scope (專案範疇)**：
  1. 閘門雙螢幕引導 UI、即時人臉採樣與 QR Code 雙模態核驗終端。
  2. 後端微服務 API (託管於 Railway，pgvector 毫秒級特徵向量比對)。
  3. 機場離港系統 (DCS) API 雙向即時對接與斷網本機白名單快取機制。
- **Out-of-scope (排除範疇)**：
  1. 行李託運自動分揀系統連線（列入第二期）。
  2. 機場 VIP 貴賓室門禁核驗系統。
  3. 第一期暫不支援外籍護照晶片 NFC 離線讀取。

---

### 4. 數據來源與系統介接 (Data Sources)
- **Data Source: IODA**：機場中央營運數據平台 (IODA FlightData Hub v2.1 航班即時動態)。
- **Data Source: Source System**：SITA / Amadeus DCS 離港系統旅客清單、香港入境處 e-Channel 人臉特徵核驗庫。
- **Data Source: User Files**：地勤手動上傳之航班緊急候補旅客 CSV / Excel 名冊。

---

### 5. 各階段時程里程碑 (Project Timeline & Phases)
- **L1&2 Start (專案啟動與架構藍圖)**：2026-09-15
- **L3 Start (前後端核心微服務開發)**：2026-10-01
- **L4 Start (DCS 與硬件閘門通訊整合測試)**：2026-10-20
- **L5 start (現場 12 號登機門 UAT 驗收與試運行)**：2026-11-15