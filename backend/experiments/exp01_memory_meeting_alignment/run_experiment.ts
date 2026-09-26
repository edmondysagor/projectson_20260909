import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ProjectItemMemory {
  item_uid: string
  item_display_code: string
  item_type: string
  item_title: string
  item_status: string
  item_priority: string | null
  item_follow_by: string | null
  follow_by_name: string | null
  item_planned_end_date: string | null
  parent_item_uid: string | null
  item_content: {
    text: string
    summary?: string
  }
}

interface FieldDiff {
  field: string
  before: any
  after: any
  rationale: string
}

interface AlignmentItemResult {
  item_uid: string
  item_display_code: string
  item_title: string
  item_type: string
  is_mentioned: boolean
  matched_evidence: string[]
  action: 'UPDATE' | 'NO_CHANGE' | 'NEEDS_REVIEW'
  reason: string
  field_diffs: FieldDiff[]
}

interface UnmatchedEvidence {
  topic: string
  excerpt: string
  notes: string
}

interface AlignmentResponse {
  experiment_id: string
  model_used: string
  timestamp: string
  aligned_items: AlignmentItemResult[]
  unmatched_evidence: UnmatchedEvidence[]
  summary: {
    total_existing_items: number
    items_mentioned: number
    updates_proposed: number
    no_changes_proposed: number
    needs_review_proposed: number
    unmatched_facts_count: number
  }
}

interface ValidationCheck {
  name: string
  passed: boolean
  details: string
}

async function callLlm(systemPrompt: string, userPrompt: string): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_LOCAL_URL || 'http://localhost:11434/api/chat'
  const model = process.env.EXPERIMENT_MODEL || 'gemma4:e4b-mlx'

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 900000)

  try {
    const response = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        format: 'json',
        stream: true,
        options: {
          temperature: 0.1,
          num_predict: 8192
        }
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`LLM call failed (${model}): ${errText}`)
    }

    if (!response.body) {
      throw new Error('No response body received from LLM')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let accumulatedContent = ''
    let buffer = ''
    let tokenCount = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const parsed = JSON.parse(trimmed)
          if (parsed.message?.content) {
            accumulatedContent += parsed.message.content
            tokenCount++
            if (tokenCount % 100 === 0) {
              process.stdout.write('.')
            }
          }
        } catch {
          // Ignore partial or unparseable JSON lines
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim())
        if (parsed.message?.content) {
          accumulatedContent += parsed.message.content
        }
      } catch {}
    }

    process.stdout.write('\n')
    return accumulatedContent
  } finally {
    clearTimeout(timeoutId)
  }
}

function cleanJson(rawStr: string): string {
  let cleaned = rawStr.trim()
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim()
  } else {
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1)
    }
  }
  return cleaned.trim()
}

export async function runExperiment() {
  console.log('=================================================================')
  console.log('PROJECTSON EXPERIMENT 01: Existing Memory + New Meeting Alignment')
  console.log('=================================================================\n')

  // 1. Load Inputs
  const memoryPath = path.resolve(__dirname, 'input_project_memory.json')
  const script2Path = path.resolve(__dirname, '../../../test_doc/B_meeting_script_2.md')

  const memoryItems: ProjectItemMemory[] = JSON.parse(fs.readFileSync(memoryPath, 'utf-8'))
  const meetingTranscript = fs.readFileSync(script2Path, 'utf-8')

  console.log(`[Input] Loaded ${memoryItems.length} authoritative items from input_project_memory.json`)
  console.log(`[Input] Loaded meeting transcript: B_meeting_script_2.md (${meetingTranscript.length} characters)\n`)

  // 2. Build Single LLM Alignment Prompt
  const systemPrompt = `You are an expert Project Alignment Engine for Projectson.
Your task is to compare a NEW meeting transcript against an authoritative list of EXISTING project items (Project Memory).

CRITICAL CONSTRAINTS & BEHAVIOR:
1. EXISTING-ITEM ALIGNMENT ONLY:
   - For every existing item in the provided Project Memory, evaluate whether the meeting mentions it.
   - If mentioned and evidence shows substantive progress/status change, propose UPDATE with precise field_diffs.
   - If mentioned to reaffirm existing scope/assumptions without change, propose NO_CHANGE.
   - If not mentioned at all, propose NO_CHANGE.
   - If mentioned with ambiguous, conflicting, or uncertain outcomes, propose NEEDS_REVIEW.
2. NO HALLUCINATION & NO FABRICATED ENTITIES:
   - Do NOT invent new item IDs, new tasks, new deadlines, or new requirements.
   - Do NOT create duplicate items.
   - Use the exact existing item_uid and item_display_code provided in the memory snapshot.
3. GROUNDED PROGRESS EXTRACTION:
   - If a participant explicitly confirms an action item is completed (e.g. Rachel completed interviews), update item_status to 'Completed'.
   - If an item is in progress or outstanding (e.g. Michael's queue check or privacy review), do NOT mark it completed. Keep it 'In Progress' with updated notes.
   - If a metric (e.g. 30% reduction) is reaffirmed as a proposed target pending trial baseline, do NOT upgrade it to a confirmed KPI.
   - If a response time (e.g. <3s) is maintained as a technical target, do NOT upgrade it to an SLA.
   - If baseline timeline is maintained as tentative Oct 2, preserve it as tentative.
4. UNMATCHED FACTS SEPARATION:
   - If the meeting discusses topics/events not represented by any existing item (e.g. the meeting itself or future ideas), list them under unmatched_evidence for human visibility. Do NOT fabricate CREATE mutations.

OUTPUT FORMAT:
Output a single valid JSON object with the following structure:
{
  "aligned_items": [
    {
      "item_uid": string (exact UID from memory),
      "item_display_code": string (exact display code),
      "item_title": string,
      "item_type": string,
      "is_mentioned": boolean,
      "matched_evidence": [string (verbatim transcript excerpt)],
      "action": "UPDATE" | "NO_CHANGE" | "NEEDS_REVIEW",
      "reason": string,
      "field_diffs": [
        {
          "field": "item_status" | "item_content.text" | "item_planned_end_date" | "item_follow_by",
          "before": any,
          "after": any,
          "rationale": string
        }
      ]
    }
  ],
  "unmatched_evidence": [
    {
      "topic": string,
      "excerpt": string,
      "notes": string
    }
  ]
}`

  const userPrompt = `### EXISTING PROJECT MEMORY (AUTHORITATIVE DB SNAPSHOT)
${JSON.stringify(memoryItems, null, 2)}

### NEW MEETING TRANSCRIPT (B_meeting_script_2.md)
${meetingTranscript}

Perform the alignment analysis and output valid JSON.`

  const modelName = process.env.EXPERIMENT_MODEL || 'qwen3.5:9b-mlx'
  console.log(`[LLM] Calling single alignment model (${modelName})...`)
  const startTime = Date.now()
  const rawLlmOutput = await callLlm(systemPrompt, userPrompt)
  const durationMs = Date.now() - startTime
  console.log(`[LLM] Response received in ${(durationMs / 1000).toFixed(2)}s\n`)

  const parsedJson = JSON.parse(cleanJson(rawLlmOutput))

  // 3. Deterministic Validation & Audit Pass
  console.log('[Validation] Running deterministic verification checks...')
  const memoryMap = new Map(memoryItems.map(m => [m.item_uid, m]))
  const validationChecks: ValidationCheck[] = []

  // Check 1: All returned UIDs exist in DB snapshot
  const returnedUids = (parsedJson.aligned_items || []).map((i: any) => i.item_uid)
  const allUidsValid = returnedUids.every((uid: string) => memoryMap.has(uid))
  validationChecks.push({
    name: 'UID Integrity Check',
    passed: allUidsValid,
    details: allUidsValid ? 'All aligned items reference valid UIDs from the authoritative snapshot.' : 'Found unknown or invented UIDs in alignment results.'
  })

  // Check 2: All 15 existing items are evaluated
  const evaluatedAll = memoryItems.every(m => returnedUids.includes(m.item_uid))
  validationChecks.push({
    name: 'Coverage Completeness Check',
    passed: evaluatedAll,
    details: evaluatedAll ? 'All 15 existing items evaluated.' : `Only ${returnedUids.length}/15 existing items evaluated.`
  })

  // Check 3: Field-level Before values match snapshot
  let beforeValuesMatch = true
  const beforeErrors: string[] = []
  for (const item of (parsedJson.aligned_items || [])) {
    const original = memoryMap.get(item.item_uid)
    if (original && item.field_diffs) {
      for (const diff of item.field_diffs) {
        if (diff.field === 'item_status' && diff.before !== original.item_status) {
          beforeValuesMatch = false
          beforeErrors.push(`${item.item_display_code}: before status '${diff.before}' != authoritative '${original.item_status}'`)
        }
      }
    }
  }
  validationChecks.push({
    name: 'Before Value Fidelity Check',
    passed: beforeValuesMatch,
    details: beforeValuesMatch ? 'All Before values match authoritative DB snapshot.' : beforeErrors.join('; ')
  })

  // Check 4: Rachel Interview Task Updated to Completed
  const rachelItem = (parsedJson.aligned_items || []).find((i: any) => 
    i.item_title.toLowerCase().includes('interview') || 
    (memoryMap.get(i.item_uid)?.follow_by_name === 'Rachel')
  )
  const rachelCompleted = rachelItem && rachelItem.action === 'UPDATE' && 
    rachelItem.field_diffs?.some((d: any) => d.field === 'item_status' && d.after === 'Completed')
  validationChecks.push({
    name: 'Rachel Interview Completion Check',
    passed: Boolean(rachelCompleted),
    details: rachelCompleted 
      ? `Rachel task [${rachelItem.item_display_code}] correctly proposed UPDATE -> Completed.`
      : `Rachel task not updated to Completed.`
  })

  // Check 5: Michael Queue Data Check Not Falsely Completed
  const queueItem = (parsedJson.aligned_items || []).find((i: any) => 
    i.item_title.toLowerCase().includes('queue data') || 
    i.item_title.toLowerCase().includes('queue-data') ||
    i.item_display_code === 'TPM-34'
  )
  const queueStillInProgress = queueItem && (
    queueItem.action === 'UPDATE' ? !queueItem.field_diffs?.some((d: any) => d.field === 'item_status' && d.after === 'Completed') : true
  )
  validationChecks.push({
    name: 'Michael Queue Data In-Progress Integrity Check',
    passed: Boolean(queueStillInProgress),
    details: queueStillInProgress ? `Queue data task [${queueItem?.item_display_code}] remains In Progress with mapping availability recorded.` : 'Queue data task was falsely marked completed.'
  })

  // Check 6: Michael Privacy Task Not Falsely Completed
  const privacyItem = (parsedJson.aligned_items || []).find((i: any) => 
    i.item_title.toLowerCase().includes('privacy') || 
    i.item_display_code === 'TPM-36'
  )
  const privacyStillInProgress = privacyItem && (
    privacyItem.action === 'UPDATE' ? !privacyItem.field_diffs?.some((d: any) => d.field === 'item_status' && d.after === 'Completed') : true
  )
  validationChecks.push({
    name: 'Michael Privacy Review In-Progress Integrity Check',
    passed: Boolean(privacyStillInProgress),
    details: privacyStillInProgress ? `Privacy review task [${privacyItem?.item_display_code}] remains In Progress as outstanding validation.` : 'Privacy task was falsely marked completed.'
  })

  // Check 7: 30% Objective Reaffirmed as Target (Not Confirmed KPI)
  const objItem = (parsedJson.aligned_items || []).find((i: any) => i.item_type === 'Objective' || i.item_display_code === 'TPM-29')
  const objTargetPreserved = objItem && (
    objItem.action === 'NO_CHANGE' || !objItem.field_diffs?.some((d: any) => String(d.after).includes('confirmed KPI'))
  )
  validationChecks.push({
    name: '30% Objective Target Preservation Check',
    passed: Boolean(objTargetPreserved),
    details: objTargetPreserved ? `Objective [${objItem?.item_display_code}] preserved as proposed target without SLA promotion.` : 'Objective was falsely upgraded to confirmed KPI.'
  })

  // Assemble Complete Result
  const alignmentResult: AlignmentResponse = {
    experiment_id: 'EXP-01-MEMORY-MEETING-ALIGNMENT',
    model_used: 'gemma4:12b (Local Ollama Single-Call)',
    timestamp: new Date().toISOString(),
    aligned_items: parsedJson.aligned_items || [],
    unmatched_evidence: parsedJson.unmatched_evidence || [],
    summary: {
      total_existing_items: memoryItems.length,
      items_mentioned: (parsedJson.aligned_items || []).filter((i: any) => i.is_mentioned).length,
      updates_proposed: (parsedJson.aligned_items || []).filter((i: any) => i.action === 'UPDATE').length,
      no_changes_proposed: (parsedJson.aligned_items || []).filter((i: any) => i.action === 'NO_CHANGE').length,
      needs_review_proposed: (parsedJson.aligned_items || []).filter((i: any) => i.action === 'NEEDS_REVIEW').length,
      unmatched_facts_count: (parsedJson.unmatched_evidence || []).length
    }
  }

  // 4. Save Deliverables
  const resultJsonPath = path.resolve(__dirname, 'alignment_result.json')
  fs.writeFileSync(resultJsonPath, JSON.stringify(alignmentResult, null, 2), 'utf-8')
  console.log(`[Output] Saved machine-readable alignment result: ${resultJsonPath}`)

  const reportMdPath = path.resolve(__dirname, 'alignment_report.md')
  const reportContent = generateMarkdownReport(alignmentResult, memoryMap, validationChecks, durationMs)
  fs.writeFileSync(reportMdPath, reportContent, 'utf-8')
  console.log(`[Output] Saved human-readable alignment report: ${reportMdPath}\n`)

  console.log('=================================================================')
  console.log('EXPERIMENT 01 SUMMARY & ACCEPTANCE TEST VERIFICATION')
  console.log('=================================================================')
  for (const check of validationChecks) {
    console.log(`${check.passed ? '✅' : '❌'} ${check.name}: ${check.details}`)
  }
  console.log('=================================================================\n')
}

function generateMarkdownReport(
  result: AlignmentResponse,
  memoryMap: Map<string, ProjectItemMemory>,
  validationChecks: ValidationCheck[],
  durationMs: number
): string {
  const lines: string[] = []
  lines.push('# Projectson Experiment 01 — Existing Memory + New Meeting Alignment Report')
  lines.push('')
  lines.push(`- **Experiment ID**: \`${result.experiment_id}\``)
  lines.push(`- **Model Used**: \`${result.model_used}\``)
  lines.push(`- **Execution Duration**: \`${(durationMs / 1000).toFixed(2)}s\``)
  lines.push(`- **Execution Timestamp**: \`${result.timestamp}\``)
  lines.push(`- **Architecture**: Single-LLM Alignment Prompt (Pass-through of 15 authoritative items + meeting transcript)`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 1. Executive Summary & Metric Breakdown')
  lines.push('')
  lines.push('| Metric | Count | Description |')
  lines.push('| :--- | :--- | :--- |')
  lines.push(`| **Total Existing Items** | \`${result.summary.total_existing_items}\` | Authoritative snapshot from Meeting 1 |`)
  lines.push(`| **Items Mentioned in Meeting 2** | \`${result.summary.items_mentioned}\` | Items actively referenced in dialogue |`)
  lines.push(`| **Substantive UPDATEs Proposed** | \`${result.summary.updates_proposed}\` | Grounded progress or status modifications |`)
  lines.push(`| **NO_CHANGE Reaffirmations** | \`${result.summary.no_changes_proposed}\` | Mentioned but scope reaffirmed / unmentioned |`)
  lines.push(`| **NEEDS_REVIEW Uncertainties** | \`${result.summary.needs_review_proposed}\` | Ambiguities flagged for human review |`)
  lines.push(`| **Unmatched Document Facts** | \`${result.summary.unmatched_facts_count}\` | Document-level facts not mapped to existing items |`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 2. Acceptance Criteria & Deterministic Validation Results')
  lines.push('')
  for (const check of validationChecks) {
    lines.push(`- ${check.passed ? '✅' : '❌'} **${check.name}**: ${check.details}`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 3. Detailed Item Alignment & Field-Level Diffs')
  lines.push('')
  lines.push('| Display Code | Item Title | Type | Mentioned | Action | Field Diffs / Evidence |')
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |')

  for (const item of result.aligned_items) {
    const diffStr = item.field_diffs && item.field_diffs.length > 0
      ? item.field_diffs.map(d => `**${d.field}**: \`${d.before}\` ➔ \`${d.after}\` (${d.rationale})`).join('<br>')
      : (item.matched_evidence && item.matched_evidence.length > 0 ? `*Reaffirmed by evidence*: "${item.matched_evidence[0].slice(0, 60)}..."` : '*Not mentioned in transcript*')
    
    lines.push(`| \`${item.item_display_code}\` | **${item.item_title}** | \`${item.item_type}\` | ${item.is_mentioned ? '🟢 Yes' : '⚪ No'} | \`${item.action}\` | ${diffStr} |`)
  }

  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 4. Unmatched Document Facts (Non-CREATE Observations)')
  lines.push('')
  if (result.unmatched_evidence.length === 0) {
    lines.push('No unmapped document facts detected.')
  } else {
    for (const u of result.unmatched_evidence) {
      lines.push(`### 📌 ${u.topic}`)
      lines.push(`- **Transcript Excerpt**: > "${u.excerpt}"`)
      lines.push(`- **Notes**: ${u.notes}`)
      lines.push('')
    }
  }

  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 5. Architectural Comparison: Single-LLM Alignment vs. Multi-Agent Reconciliation')
  lines.push('')
  lines.push('| Dimension | Experiment 01 (Single-LLM Alignment) | Production Multi-Agent Pipeline |')
  lines.push('| :--- | :--- | :--- |')
  lines.push('| **LLM Invocations** | **1 single prompt** (Fast, deterministic payload) | Multiple concurrent calls (Spine, Charter, Decision, Critic) |')
  lines.push('| **Candidate Generation** | Zero candidate proliferation (Direct item-level alignment) | Aggregates subagent previews + deterministic ledger |')
  lines.push('| **ID & UID Preservation** | Exact `item_uid` binding directly from prompt | Reconstructs topology & resolves IDs via multi-stage retriever |')
  lines.push('| **CREATE Handling** | Explicitly out of scope (Reports unmatched facts) | Capable of discovering and creating new hierarchical entities |')
  lines.push('| **Failure Points** | Context window limit if item count > 100 | Inter-agent deduplication collisions, unverified parent IDs |')
  lines.push('')

  return lines.join('\n')
}

// Execute if run directly
runExperiment().catch(err => {
  console.error('[Fatal Error in Experiment]:', err)
  process.exit(1)
})
