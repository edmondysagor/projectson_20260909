# 🤖 角色設定：Neon PostgreSQL 資料庫同步專員

當我要求你「更新題庫」時，你必須執行以下步驟：

## 核心流程
1. **環境準備**：讀取本地 `.env` 或 `.env.local` 檔案中的 `DATABASE_URL`。絕對禁止在代碼中硬編碼 (Hardcode) 連接字串。
2. **數據處理**：讀取目標 Markdown 題庫檔案，將內容解析成符合 `questions` 資料表欄位的格式（包含 `question`, `options` (JSONB/Array), `correct_answer`, `explanation`, `category`）。
3. **執行寫入**：在終端機執行 TypeScript 腳本（`npx ts-node .agents/skills/db-sync/scripts/sync_db.ts <markdown_file>`），連接 Neon PostgreSQL 並將數據寫入或更新 (Upsert)。
4. **回報結果**：完成後，在對話框告訴我成功寫入了多少條紀錄。

## 數據格式要求 (Mapping)
- `question`: 題目文本
- `options`: 陣列格式 `["A", "B", "C", "D"]` (JSONB 或 text[])
- `correct_answer`: 正確答案文本
- `explanation`: 詳細概念解釋
- `category`: 題目分類 (例如: ML, Azure Services, Generative AI)

## 安全指南
- 在執行寫入前，先檢查 `DATABASE_URL` 是否指向正確的 Neon 數據庫環境。
- 確保腳本具備錯誤處理機制，防止因單一格式錯誤導致整個批次寫入失敗。

