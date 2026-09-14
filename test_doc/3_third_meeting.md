# 專案目標優化與關鍵里程碑變更會議記錄 (Third Meeting Minutes)
**會議主題**：Self-Boarding Gate Automation (SBG) 系統第一期 - 效能標竿調升與現場上線排程加速
**會議日期**：2026-09-14 14:00 - 15:30
**會議地點**：機場行政大樓 5 樓會議室 / Google Meet
**出席成員**：
- Raymond Lam (Business Sponsor - 機場數位轉型總監)
- David Cheung (Business Owner - 機場營運與安全部主管)
- Edmond Chan (Project Lead & 首席架構師)
- Kevin Lau (資深後端工程師)
- Sarah Wong (前端與嵌入式工程師)

---

### 1. 變更背景與管理層最新決策 (Context & Executive Decision)
因應香港機管局 (AAHK) 最新發布之「超高峰客流應對戰略」，以及考慮到年尾聖誕旅遊旺季的人流壓力，管理層與技術團隊經深入評估後，一致決議**提高系統性能指標門檻**，並**加速各階段推進節奏**。

---

### 2. 關鍵欄位重大變更 (Key Scope & Target Updates)

#### ⚡ 1. 效能與目標指標變更 (Target Update)
- **原定目標 (Previous Target)**：過閘時間 < 2.5s / 可用性 99.99%
- **🚀 變更後最新目標 (Revised Target)**：
  - **旅客平均過閘時間由 < 2.5 秒大幅縮短至 `< 1.8s`**（透過 Railway 邊緣微服務與本地白名單雙核並行加速）。
  - **系統可用性提升至 `99.999% (Five Nines)`**。

#### 📅 2. 階段里程碑時程變更 (Timeline & L5 Milestone Update)
- **原定 L5 時程 (Previous L5 Start)**：2026-11-15
- **⏩ 變更後最新 L5 時程 (Revised L5 Start)**：
  - **`L5 start (現場 12 號登機門 UAT 驗收與試運行)` 正式提前至 `2026-11-01`**（提早整整兩星期，以預留更充裕的現場壓力驗收緩衝期）。
- *（備註：L1&2 Start 維持 2026-09-15、L3 Start 維持 2026-10-01、L4 Start 維持 2026-10-20 不變）*

---

### 3. 架構因應與跟進行動 (Action Items)
1. **後端核驗優化**：Kevin 需在 L3 階段完成人臉特徵向量比對引擎從 250ms 降至 90ms 的算法快取調優，以確保達標 1.8 秒極限要求。
2. **時程對齊**：Sarah 需配合 11 月 1 日現場 UAT 節奏，於 10 月 28 日前鎖定前端登機門 UI 所有 Release Candidate (RC) 版本。