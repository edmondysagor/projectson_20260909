-- ==============================================================================
-- Tai Ping Mun Tech 雲端整合診斷模板 資料庫初始化結構 (Database Schema)
-- 適用資料庫: Neon Serverless PostgreSQL (或相容之標準 PostgreSQL)
-- ==============================================================================

-- 1. 建立測試用診斷表 (tai_ping_mun_tests)
-- 後端啟動時亦會透過 db.ts 自動執行此 DDL，如在 Neon 控制台手動執行可直接複製以下指令：
CREATE TABLE IF NOT EXISTS public.tai_ping_mun_tests (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 加上註解以利於辨識
COMMENT ON TABLE public.tai_ping_mun_tests IS 'Tai Ping Mun Tech 雲端整合診斷 CRUD 測試資料表';
COMMENT ON COLUMN public.tai_ping_mun_tests.id IS '主鍵，自增 ID';
COMMENT ON COLUMN public.tai_ping_mun_tests.title IS '測試項目標題';
COMMENT ON COLUMN public.tai_ping_mun_tests.category IS '分類標籤 (如：Cloud Architecture, Database, LLM)';
COMMENT ON COLUMN public.tai_ping_mun_tests.notes IS '診斷備註或日誌摘要';

-- 2. 插入初始預設種子資料 (Initial Seed Data)
INSERT INTO public.tai_ping_mun_tests (title, category, notes)
VALUES 
    ('Neon DB Connection Pool Verification', 'Database', '驗證連線池、SSL 連線以及讀寫延遲正常。'),
    ('Cloud Run Asia-Southeast1 Latency Check', 'Cloud Architecture', '確認新加坡區域 Cloud Run 容器自動擴展與回應時間。'),
    ('Multi-LLM Matrix Diagnostic', 'LLM', '整合 Alibaba Qwen 3.8、Google Gemini 3.8 與 Ollama Gemma 4。')
ON CONFLICT DO NOTHING;

-- 3. 自動更新 updated_at 的觸發函數 (可選，推薦生產環境使用)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS set_timestamp ON public.tai_ping_mun_tests;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.tai_ping_mun_tests
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
