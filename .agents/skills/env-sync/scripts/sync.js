#!/usr/bin/env node

/**
 * ==============================================================================
 * Universal Cloud Env Syncer for Template Repo (ES Module)
 * Supports: Google Cloud Run (Backend) & Cloudflare Workers (Frontend)
 * Reads local SSOT: frontend/.env.<mode>, backend/.env.<mode>
 * Features: Masked Diff Preview, Batch Sync
 * ==============================================================================
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const env = {}
  lines.forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/)
    if (match) {
      let key = match[1]
      let value = match[2] || ''
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      env[key] = value
    }
  })
  return env
}

function maskValue(val) {
  if (!val) return '<empty>'
  if (val.length <= 8) return '****'
  return val.slice(0, 4) + '...' + val.slice(-4)
}

function updateEnvExample(targetDir, envObj) {
  const examplePath = path.join(targetDir, '.env.example')
  const keys = Object.keys(envObj)
  if (keys.length === 0 || !fs.existsSync(examplePath)) return
  console.log(`ℹ️  [Checked] ${path.relative(process.cwd(), examplePath)} exists with reference template.`)
}

async function run() {
  const args = process.argv.slice(2)
  const mode = args.find(a => a === 'production' || a === 'development') || 'development'
  const target = args.find(a => a === 'frontend' || a === 'backend' || a === 'all') || 'all'
  const isDryRun = args.includes('--dry-run') || args.includes('-d')

  console.log('\n======================================================')
  console.log(`🌐 Cloud Env Syncer [Mode: ${mode.toUpperCase()}] [Target: ${target.toUpperCase()}]`)
  console.log(`🎯 Platforms: Google Cloud Run (Backend) & Cloudflare (Frontend)`)
  console.log(`🔍 Execution Mode: ${isDryRun ? 'DRY-RUN (Preview Only)' : 'LIVE SYNC'}`)
  console.log('======================================================\n')

  const targets = target === 'all' ? ['backend', 'frontend'] : [target]

  for (const t of targets) {
    const targetDir = path.join(process.cwd(), t)
    const envFile = path.join(targetDir, `.env.${mode}`)

    if (!fs.existsSync(envFile)) {
      console.log(`⚠️  File not found: ${path.relative(process.cwd(), envFile)} - skipping.`)
      continue
    }

    const envVars = parseEnv(envFile)
    const varKeys = Object.keys(envVars)

    console.log(`📂 [${t.toUpperCase()}] Source: ${path.relative(process.cwd(), envFile)} (${varKeys.length} variables)`)
    console.log('------------------------------------------------------')
    varKeys.forEach(k => {
      console.log(`  🔑 ${k.padEnd(35)} : ${maskValue(envVars[k])}`)
    })
    console.log('------------------------------------------------------')

    if (isDryRun) {
      console.log(`ℹ️  [Dry-run] No changes applied to cloud for ${t}.\n`)
      continue
    }

    // Auto-update .env.example
    updateEnvExample(targetDir, envVars)

    // Sync to Google Cloud Run for backend
    if (t === 'backend') {
      const isProd = mode === 'production'
      const projectId = envVars.GOOGLE_PROJECT_ID || 'certifyai-yes-college'
      const serviceName = envVars.CLOUD_RUN_SERVICE_NAME || (isProd ? `${projectId}-git` : `${projectId}-dev`)
      const region = envVars.CLOUD_RUN_REGION || 'asia-southeast1'
      const tempYamlPath = path.join(targetDir, `.env.${mode}.temp.yaml`)

      console.log(`🚀 [Google Cloud Run] Preparing sync to service [${serviceName}] (${region}) in project [${projectId}]...`)

      try {
        // Convert to YAML
        const yamlLines = Object.entries(envVars).map(([k, v]) => {
          const safeVal = String(v).replace(/"/g, '\\"')
          return `${k}: "${safeVal}"`
        })
        fs.writeFileSync(tempYamlPath, yamlLines.join('\n'), 'utf-8')

        // Update Cloud Run via gcloud CLI
        const cmd = `export PATH="/opt/homebrew/bin:$PATH" && gcloud run services update ${serviceName} \
          --project=${projectId} \
          --region=${region} \
          --env-vars-file="${tempYamlPath}" \
          --quiet`

        console.log(`⏳ [Google Cloud Run] Updating revision and switching 100% traffic...`)
        execSync(cmd, { stdio: 'inherit' })
        console.log(`  ✅ [Google Cloud Run] Successfully updated and deployed ${serviceName}!`)
      } catch (e) {
        console.error(`  ❌ [Google Cloud Run] Failed to sync ${serviceName}:`, e.message)
      } finally {
        if (fs.existsSync(tempYamlPath)) {
          fs.unlinkSync(tempYamlPath)
        }
      }
    }

    // Frontend (Cloudflare Workers)
    if (t === 'frontend') {
      console.log(`🚀 [Cloudflare Workers] Notice: Frontend Vite build bakes VITE_* variables during build.`)
      console.log(`💡 To deploy with latest env vars, run: npm run deploy:${mode === 'production' ? 'prod' : 'dev'}`)
    }

    console.log(`\n✨ Finished syncing for ${t}.\n`)
  }

  console.log('🎉 All tasks completed!\n')
}

run().catch(err => {
  console.error('Fatal error during sync:', err)
  process.exit(1)
})
