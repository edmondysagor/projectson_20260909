---
name: zdoc-maintainer
description: Expert documentation maintainer for z_doc/development_log.md and z_doc/lesson_learned.md. Strictly adheres to historical format, phase numbering, structured root-cause analyses, and anti-repetition engineering standards.
---

# 📚 Z-Doc Documentation Maintainer Skill (`zdoc-maintainer`)

Use this skill whenever you complete a feature, fix a critical bug, execute a migration/deployment, or need to record lessons learned. It ensures that `z_doc/development_log.md` and `z_doc/lesson_learned.md` are continuously updated in exact alignment with existing conventions.

---

## 🎯 Target Files & Exact Format Standards

### 1. `z_doc/development_log.md` (開發日誌)

- **Structure**:
  - Maintained in chronological order under sequential Phase headings (e.g. `### Phase N: <Title in Chinese & English> (YYYY-MM-DD)` or `## 階段 N: <Title> (YYYY-MM-DD)`).
  - Uses bullet points with bold category headings (e.g. `*   **<Feature/Module Name> (English Subtitle)**:`).
  - Updates the bottom `## 待辦事項 (Next Steps)` section by checking off completed items (`- [x]`) and adding new milestones.

#### Standard Entry Format for `development_log.md`:
```markdown
---

### Phase <N>: <Feature Title in Chinese> (<English Title>) (<YYYY-MM-DD>)
*   **<子模組名稱 1> (<Sub-module English Name>)**：
    *   條列具體實裝之技術細節、API 接口、資料表或狀態管理改動。
*   **<子模組名稱 2> (<Sub-module English Name>)**：
    *   條列前端 UI、狀態處理、防呆保護或效能提升。

```

---

### 2. `z_doc/lesson_learned.md` (技術心得與踩坑重點)

- **Structure**:
  - Numbered sequentially (`## N. <主題與模組名稱> (YYYY-MM-DD)`).
  - Uses the proven 3-part diagnostic formula:
    1. **痛點 / 現象 / 踩坑與分析 (Problem / Symptoms)**
    2. **根因分析 (Root Cause)**
    3. **解決方案與防禦機制 / 最佳實踐 (Defensive Solution & Best Practice)** (includes code snippets, SQL, or architectural decisions where applicable).

#### Standard Entry Format for `lesson_learned.md`:
```markdown
---

## <N>. <技術主題名稱 (如：Neon DB 欄位映射 / React 渲染防護)> (<YYYY-MM-DD>)
### <問題現象或痛點標題> (<Pain Point English Tag>)
*   **痛點 / 現象**：
    1. 描述具體錯誤現象（如：白屏、HTTP 500、CORS、無效重渲染、資料未寫入）。
    2. 說明在特定環境（Vercel, Railway, Neon, Cloudflare R2, Stripe）下的觸發條件。
### 解決方案與防禦架構 (<Architectural Solution>)
1. **<關鍵技術措施 1>**：
   - 說明如何解決，附上具體 TypeScript / SQL / 配置示範。
2. **<最佳實踐 / 避坑守則>**：
   - 總結日後開發相同模組時應遵循的防呆原則。
```

---

## ⚡ Operational Workflow

When the user asks to "log progress", "記錄日誌", "寫入 lesson learned", or at the completion of major tasks:

1. **Auto-Detect Next Phase / Section Number**:
   - Read the last Phase number in `development_log.md` (e.g., if Phase 18 exists, create Phase 19).
   - Read the last Section number in `lesson_learned.md` (e.g., if Section 35 exists, create Section 36).
2. **Current Date**: Use the system timestamp (e.g. current date `YYYY-MM-DD`).
3. **Format Integrity**:
   - Preserve existing content. Always append with appropriate markdown headers.
   - Maintain bilingual precision (Traditional Chinese with clear English technical terms in parentheses).
   - Keep `.md` files clean and perfectly formatted.
