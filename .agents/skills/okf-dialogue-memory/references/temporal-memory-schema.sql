-- ==============================================================================
-- Google OKF v0.2 時態記憶擴展結構 (Temporal Dialogue Memory Extension Schema)
-- 適用資料庫: Neon Serverless PostgreSQL (搭配 pgvector 延伸模組)
-- ==============================================================================

-- 1. 確保延伸模組已啟用
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. 時態概念卡片表 (okf_concepts 擴展時態欄位)
-- 若資料庫已有 okf_concepts，可透過 ALTER TABLE 補充以下欄位：
ALTER TABLE public.okf_concepts 
ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active', -- 'active', 'superseded', 'deprecated', 'needs_review'
ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS superseded_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3, 2) DEFAULT 1.0;

-- 索引優化：讓檢索常規 active 知識時保持極致毫秒級
CREATE INDEX IF NOT EXISTS idx_okf_concepts_status_active 
ON public.okf_concepts (course_id, status) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_okf_concepts_valid_time 
ON public.okf_concepts (valid_from, valid_until);

-- 3. 時態演進關聯擴展 (okf_links 關係類型定義)
-- 支援的 link_text 標準謂詞：
--   'SUPERSEDES'        : 新概念取代並廢棄舊概念 (包含變更說明與日期)
--   'EXTENDS'           : 補充與細化既有概念
--   'CONTRADICTS'       : 標記兩者存在邏輯衝突需待人工覆核
--   'DERIVED_FROM_CHAT' : 標記此概念源自於某段對話 Session
ALTER TABLE public.okf_links
ADD COLUMN IF NOT EXISTS link_type VARCHAR(50) DEFAULT 'ASSOCIATED_WITH',
ADD COLUMN IF NOT EXISTS diff_summary TEXT;

CREATE INDEX IF NOT EXISTS idx_okf_links_temporal 
ON public.okf_links (source_concept_id, target_concept_id, link_type);
