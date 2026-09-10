---
name: env-sync
description: Cross-platform environment variable synchronization hub. Syncs local backend/.env.* to Google Cloud Run and frontend/.env.* to Cloudflare Workers across development and production environments, supporting 5 major platforms (Neon, Cloudflare R2, Stripe, LLM APIs, System).
---

# 🌐 Cloud Environment Synchronization Skill (`env-sync`)

Use this skill whenever the user wants to **check, audit, preview (dry-run), or synchronize environment variables** from local `.env` files to cloud platforms (**Google Cloud Run** and **Cloudflare Workers**).

---

## 🧭 Architecture & Source of Truth

- **Local SSOT (Single Source of Truth)**:
  - `backend/.env.development` & `backend/.env.production`
  - `frontend/.env.development` & `frontend/.env.production`
- **5-Platform Variable Scope**:
  1. **Neon PostgreSQL**: `DATABASE_URL` (in `backend/`)
  2. **Alibaba Cloud Model Studio**: `DASHSCOPE_API_KEY`, `DASHSCOPE_BASE_URL` (`compatible-mode/v1`), `LLM_*_MODEL` (in `backend/`)
  3. **Google Agent Platform / Vertex AI**: `GOOGLE_PROJECT_ID`, `GEMINI_MODEL`, `GEMINI_REASONING_MODEL` (in `backend/`)
  4. **Ollama Cloud**: `OLLAMA_API_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` (in `backend/`)
  5. **Cloudflare R2 & Stripe (Optional Extensions)**: `R2_*`, `STRIPE_*` (in `backend/`)
  6. **Frontend System Config**: `VITE_API_URL`, `VITE_DEFAULT_LLM_PROVIDER` (in `frontend/`)

---

## 🛠️ Commands & Automation Workflows

### 1. Preview / Dry-Run (Check variables with masked preview)
Show a masked overview of keys to be synced without making cloud changes:
```bash
node .agents/skills/env-sync/scripts/sync.js development all --dry-run
# Or for production:
node .agents/skills/env-sync/scripts/sync.js production all --dry-run
```

### 2. Live Synchronization to Google Cloud Run (Backend) & Cloudflare (Frontend)
```bash
# Sync all to Development (Cloud Run dev + Cloudflare Workers dev)
node .agents/skills/env-sync/scripts/sync.js development all

# Sync all to Production (Cloud Run prod + Cloudflare Workers prod)
node .agents/skills/env-sync/scripts/sync.js production all

# Sync only backend (Google Cloud Run)
node .agents/skills/env-sync/scripts/sync.js development backend
node .agents/skills/env-sync/scripts/sync.js production backend

# Or using repository root npm scripts:
npm run sync:dev   # Syncs backend/.env.development to Cloud Run Dev
npm run sync:prod  # Syncs backend/.env.production to Cloud Run Prod
```

---

## 🛡️ Safety & Anti-Hallucination Rules

1. **Masked Output**: Never print full secret keys (API keys, database passwords) to chat or logs. Always use the masked preview.
2. **Production Confirmation**: Always notify the user before applying variables to `production`.
3. **Explicit GCP Flags**: Always specify `--project=<PROJECT_ID>` and `--region=<REGION>` in all `gcloud` commands to avoid cross-project contamination.
4. **Git Safety Check**: Ensure `.env*` files are strictly included in respective `.gitignore` files.
