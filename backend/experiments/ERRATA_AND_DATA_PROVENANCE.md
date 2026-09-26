# Projectson Experiments 01 & 02 — Errata & Data Provenance Report

- **Audit Date**: 2026-09-26T19:15:45+08:00
- **Database Connection Target**: Neon PostgreSQL (`ep-square-cloud-aoq2r0hq-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb`)
- **Query Type**: Exhaustive read-only scan of `public.project`, `public.workspace`, and `public.item`

---

## 1. Database Connection & Project Query Findings

### A. Connected PostgreSQL Inventory
A direct read-only query of all projects, workspaces, and items in the connected PostgreSQL database revealed:
1. **Projects Present**:
   - `5a854590-c6c6-4228-8738-235d566d0054` (`PRJ-T574539` / "Test Project T574539", created 2026-09-25)
   - `90a33dea-d4c6-4f56-9e52-7b5848109e6e` (`PRJ-T457038` / "Test Project T457038", created 2026-09-25)
2. **Items Present**:
   - Total item count = **1**
   - `cd731337-5841-45ba-a8e2-1d99099d31d5` (`T574539-1`, Task "Existing Architecture Item" in project `PRJ-T574539`)
3. **TPM Records Search**:
   - Search for `TPM` or `Queue` across `project_name`, `project_display_code`, `item_title`, `item_display_code`: **0 matching records**.
   - `Projectson Phase 1` (`TPM-PRO-2`) and items `TPM-28` through `TPM-42` **do not exist in the connected database**.

---

## 2. Root Cause & Data Provenance Analysis

### Why TPM-28 through TPM-42 Are Not in the Database:
1. **Uncommitted Proposal in Meeting 1**:
   - In `test_doc/response_1.md`, the Copilot received `B_meeting_script_1.md` and produced an **uncommitted action preview** containing 15 candidates (`CAND-001` through `CAND-016`, with `CAND-006` merged).
   - This proposal was rendered in the UI preview payload but was never committed/persisted to the PostgreSQL database (or the database was subsequently cleared by test suites).
2. **Meeting 2 Rejection**:
   - In `test_doc/response_2.md`, `B_meeting_script_2.md` failed validation (`R002_NON_EXISTENT_PARENT`), resulting in `0 database writes`.

---

## 3. Categorization of Data Provenance

| Data Category | Description | Exact Source / Location |
| :--- | :--- | :--- |
| **Actual Persisted DB Records** | The genuine records currently stored in PostgreSQL | Only 1 item (`T574539-1` in project `PRJ-T574539`). Zero TPM records exist. |
| **Canonical Proposal Data** | The uncommitted candidates extracted by Copilot from Meeting 1 | 15 candidates (`CAND-001` to `CAND-016`) in `test_doc/response_1.md` `actionPreview.items`. |
| **Manually Reconstructed Fixtures** | Synthesized datasets used for Experiment 01 & 02 | `input_project_memory.json` and `real_db_memory_snapshot.json`. |
| **Synthetic / Inferred Fields** | Fields manually derived rather than queried from DB | 1. Synthetic UUIDs (`01923a11-0001-...` to `01923a11-0015-...`)<br>2. Synthetic Display Codes (`TPM-28` to `TPM-42`)<br>3. Extracted structured assignees (`Rachel`, `Michael`, `Thomas`, `Edmond`) from prose<br>4. Extracted structured planned end dates (`2026-10-02`, `2026-10-16`, `2026-11-13`) from prose |

---

## 4. Errata for Experiment 01 & Experiment 02

### Errata Notice for Experiment 01:
- **Correction**: Experiment 01 was an alignment test against a **reconstructed fixture derived from Meeting 1 proposal payload (`response_1.md`)**, NOT a live DB snapshot.
- The 15 items tested represent the semantic candidate set from Meeting 1 with synthetic UUIDs (`01923a11-...`) and structured fields.

### Errata Notice for Experiment 02:
- **Correction**: Experiment 02 was erroneously titled "Real DB Memory Alignment Verification". 
- In reality, `real_db_memory_snapshot.json` was **synthesized from `test_doc/response_1.md`** and does NOT reflect records queried from the PostgreSQL database.
- Experiment 02 demonstrates single-LLM pass-through alignment logic on a structured 15-item JSON representation, but **it did NOT test real database records because no TPM records are persisted in the database**.
