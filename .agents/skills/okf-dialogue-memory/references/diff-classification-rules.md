# 對話知識時態比對與判定規則 (Temporal Diffing & Conflict Rules)

本規範定義當 AI 從對話中識別出新事實/規則時，如何與 Neon DB 中檢索出的既有歷史概念進行仲裁比對。

---

## 一、仲裁決策四象限 (The 4-Decision Matrix)

| 判定類型 | 定義與條件 | 執行動作 (Neon DB 變更) | 對話感知反饋範例 |
| :--- | :--- | :--- | :--- |
| **`SUPERSEDE` (取代廢棄)** | 新輸入與歷史概念之核心數值/規則發生**直接矛盾或推翻** (例如退款天數由 7 天改為 14 天)。 | 1. 舊卡片 `status = 'superseded'`，`valid_until = NOW()`。<br/>2. 寫入新卡片 `status = 'active'`。<br/>3. 在 `okf_links` 插入一筆 `SUPERSEDES` 關聯與變更摘要。 | *「收到！我留意到這項規則在 2026-03-15 曾設定為 7 天，已為你更新為 14 天並歸檔歷史記錄！✅」* |
| **`ENHANCE` (增量補充)** | 新輸入未推翻既有事實，而是為現有概念補充了額外條件、例外情況或案例。 | 1. 保持原 `concept_id`。<br/>2. 在 `body_md` 末尾以追加段落（Append）形式合流。<br/>3. 更新 `updated_at = NOW()` 並重新計算 `okf_chunks` 向量。 | *「已為你將這項新補充的例外條件，整合進【退款政策】既有卡片中！📝」* |
| **`NEW_INDEPENDENT` (全新概念)** | 語意檢索相似度 `< 0.70`，與現存所有知識點無實質直接重疊。 | 1. 產生全新 `concept_id`。<br/>2. 建立新概念卡片與獨立向量區塊。<br/>3. 嘗試與相關父級結構建立弱關聯。 | *「已為你建立全新的知識卡片【XX】！💡」* |
| **`IGNORE / NOOP` (無價值忽略)** | 純對話問候、情緒表達、臨時調試指令、或與現有知識 100% 完全重複的話語。 | 不進行任何資料庫寫入，僅作常規對話回應。 | *(直接回答用戶問題，不提及知識存檔)* |

---

## 二、LLM 判定 Prompt 模板 (Structured Diff Prompt)

```json
{
  "system_prompt": "你是一個專業的知識庫時效與衝突審查員。請比對【現有歷史卡片】與【今日用戶對話輸入】，嚴格輸出指定的 JSON 結構。",
  "input_schema": {
    "historical_card": {
      "concept_id": "string",
      "created_at": "ISO-8601",
      "summary": "string"
    },
    "current_input": "string"
  },
  "output_schema": {
    "action": "SUPERSEDE | ENHANCE | NEW_INDEPENDENT | IGNORE",
    "reasoning": "string",
    "diff_summary": "string (說明新舊差異，如從 A 改為 B)",
    "target_concept_title": "string"
  }
}
```
