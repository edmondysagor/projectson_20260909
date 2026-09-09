# Projectson 系統升級與移植待辦清單 (TODO List)

> **目標**：將 `Projectson_previous_ver` 核心業務邏輯完整移植至新一代全棧架構（Cloudflare Pages + Google Cloud Run + Neon PostgreSQL），並融合 Google OKF (Open Knowledge Format) Graph RAG 與主動式 AI 專案助手。

---

## 📌 Phase 1: 基礎代碼移植與環境整合 (Migration & Alignment)
- [x] **1.1 資料庫架構合併 (Database Schema Migration)**
  - [ ] 整合舊版 Polymorphic Schema (`workspace`, `member`, `project_context`, `project_item`) 與新版診斷/向量結構
  - [ ] 補充新設計欄位：ADR 決策屬性、依賴關係 (Dependencies)
  - [ ] 編寫/更新 `backend/database/schema.sql` 與資料庫初始化腳本
- [x] **1.2 後端業務邏輯移植 (Backend to Google Cloud Run)**
  - [ ] 移植所有業務路由：`projects.ts`, `tasks.ts`, `meetings.ts`, `bottlenecks.ts`, `knowledge.ts`, `workspaces.ts`, `members.ts`, `upload.ts` (Cloudflare R2 支援)
  - [ ] 統一使用 Neon Connection Pooler (`-pooler`) 與 SSL 配置
  - [ ] 合併 `package.json` 後端依賴 (如 `aws-sdk`/S3 client 用於 R2 等)
- [ ] **1.3 前端業務 UI 移植 (Frontend to Cloudflare Pages)**
  - [ ] 移植核心組件：`Sidebar.tsx`, `CanvasPane.tsx`, `ListPane.tsx`, `AdvancedTable.tsx`, `TemplateBuilderModal.tsx` 等
  - [ ] 整合 BlockNote 富文本編輯器 (支援表格、圖片即時上傳 R2 與 Session Tracker 孤兒圖片自動清理)
  - [ ] 整合原樣式、Icon 與 API Client (`frontend/src/utils/api.ts`)，打通 Cloud Run API 端點

---

## 📌 Phase 2: 專案分類維度與架構升級 (Domain Classification Enhancement)
- [ ] **2.1 引入 ADR (Architectural Decision Records) 決策日誌**
  - [ ] 在 `project_item` 增加或優化 `Decision` 類型 (含 Context, Options, Final Decision, Rationale)
  - [ ] 前端專案抽屜增設「決策日誌 (Decisions)」分頁與快速錄入表單
- [ ] **2.2 引入 Dependencies & Assumptions (外部依賴與前置假設)**
  - [ ] 增強 `related_item_id_relation` 支援 `DEPENDS_ON`, `BLOCKED_BY`, `ASSUMPTION_OF`
  - [ ] 前端卡片/表格視覺化標記「阻塞狀態」與前置依賴鏈

---

## 📌 Phase 3: Google OKF + Graph RAG 知識庫搭建 (Multi-source Knowledge Base)
- [ ] **3.1 知識庫資料表設計 (OKF Schema)**
  - [ ] 建立 `okf_concepts` (概念節點、雙時態時間戳、狀態 lifecycle)
  - [ ] 建立 `okf_chunks` (pgvector 768-dim 向量段落)
  - [ ] 建立 `okf_links` (概念關聯：`PRE_REQ`, `BELONGS_TO`, `SUPERSEDES`, `DERIVED_FROM`)
- [ ] **3.2 多元來源擷取管道 (3-Source Ingestion Pipeline)**
  - [ ] **來源 1 (專案項目)**：Task/Meeting/Bottleneck/Charter 建立或變更時非同步提煉入庫
  - [ ] **來源 2 (AI 對話)**：Chat 對話完成後觸發語義探針，將沉澱決策與 Insight 自動抽取存入 OKF
  - [ ] **來源 3 (文件上載)**：支援上載 PDF/Markdown/Doc 解析並切片入庫
- [ ] **3.3 檢索架構落地 (Hybrid Graph Retrieval)**
  - [ ] 階段 1：DashScope `text-embedding-v4` (768-dim) + pgvector 粗篩
  - [ ] 階段 2：`okf_links` 拓撲 1-Hop 概念擴展
  - [ ] 階段 3：阿里雲 `gte-rerank` 精準重排 Top 5

---

## 📌 Phase 4: 主動式 AI Assistant 與認知減負 (Cognitive Load Reduction)
- [ ] **4.1 雙時態演化與知識生命週期 (Bi-temporal & Superseding)**
  - [ ] 對話中識別內容過期（例如變更 Deadline、替換架構方案）
  - [ ] 自動標記 `SUPERSEDES` 舊概念，將舊決策標記為 `DEPRECATED`，保持 RAG Grounding 最新
- [ ] **4.2 減低認知過載 (Proactive Copilot Features)**
  - [ ] **Catch me up / 前情提要**：進入專案時一鍵生成進度摘要與目前阻礙
  - [ ] **晨會/每日主動簡報**：主動提示即將過期項目與依賴關聯風險
  - [ ] **跨專案經驗遷移 (Cross-Project Recall)**：相似 Bottleneck 推薦過往成功解決方案

---

## 📌 Phase 5: CI/CD 自動化部署與驗證 (Cloudflare + Cloud Run)
- [ ] **5.1 Cloud Run (Backend)** 容器編譯與自動化部署驗證
- [ ] **5.2 Cloudflare Pages (Frontend)** 構建設定與 SPA 404 回退驗證
- [ ] **5.3 跨域 CORS 與環境變數全套驗證**

---

*最後更新時間：2026-09-09*
