-- ============================================================================
-- Google OKF (Open Knowledge Format v0.2) + Hybrid Graph RAG Schema for Neon DB
-- ============================================================================

-- 1. 啟用 PostgreSQL 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. 概念卡片主表 (OKF Concepts)
CREATE TABLE IF NOT EXISTS public.okf_concepts (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id VARCHAR(255) NOT NULL UNIQUE,             -- e.g. "acca_fa1/double_entry_bookkeeping"
    course_id VARCHAR(50) NOT NULL,                     -- e.g. "ACCA FA1"
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,                          -- 'Structure', 'Concept', 'Rule', 'Process', 'Standard'
    frontmatter JSONB NOT NULL DEFAULT '{}'::jsonb,     -- tags, sources, generated, verified, aliases, etc.
    body_md TEXT NOT NULL,                              -- 結構化 Markdown 內文 (含章節頁碼出處)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_okf_concepts_course ON public.okf_concepts(course_id);
CREATE INDEX IF NOT EXISTS idx_okf_concepts_type ON public.okf_concepts(type);

-- 3. 雙向語意與結構圖譜關聯表 (OKF Links)
CREATE TABLE IF NOT EXISTS public.okf_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id VARCHAR(50),
    source_concept_id VARCHAR(255) NOT NULL REFERENCES public.okf_concepts(concept_id) ON DELETE CASCADE,
    target_concept_id VARCHAR(255) NOT NULL,
    link_text VARCHAR(255),                             -- 連線語意標籤 (例如: "核心章節考點", "關聯計算規則")
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_okf_links_source ON public.okf_links(source_concept_id);
CREATE INDEX IF NOT EXISTS idx_okf_links_target ON public.okf_links(target_concept_id);
CREATE INDEX IF NOT EXISTS idx_okf_links_course ON public.okf_links(course_id);

-- 4. 768 維度向量切片表 (OKF Chunks - DashScope text-embedding-v4 / GTE)
CREATE TABLE IF NOT EXISTS public.okf_chunks (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id VARCHAR(255) NOT NULL REFERENCES public.okf_concepts(concept_id) ON DELETE CASCADE,
    course_id VARCHAR(50) NOT NULL,
    section_title VARCHAR(255),                         -- 小節標題 (例如: "## 核心原理與計算規則")
    content TEXT NOT NULL,                              -- 注入頁碼出處浮水印的切片文本
    embedding vector(768),                              -- 768 維度向量
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_okf_chunks_concept ON public.okf_chunks(concept_id);
CREATE INDEX IF NOT EXISTS idx_okf_chunks_course ON public.okf_chunks(course_id);
-- 建立 HNSW 向量 Cosine 距離索引 (加速檢索)
CREATE INDEX IF NOT EXISTS idx_okf_chunks_embedding_hnsw ON public.okf_chunks USING hnsw (embedding vector_cosine_ops);
