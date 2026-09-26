import { Router, Request, Response } from 'express'
import { pool } from '../db.js'
import { orchestrateMultiAgentPipeline } from '../agents/orchestrator.js'
import { AgentContext } from '../agents/types.js'
import { isJunkHeadingOrPreamble } from '../services/reconciliation/candidateNormalizer.js'
import { executeReconciliationPipeline } from '../services/reconciliation/proposalPipeline.js'
import { extractExplicitPriority } from '../services/reconciliation/sourceLedgerExtractor.js'
import { assertAuthorityBoundaryForMutation } from '../services/reconciliation/schemaGuard.js'
import { markProposalCommitted } from '../services/reconciliation/proposalRegistry.js'
import { executeCanonicalProposalTransaction, verifyDatabaseState } from '../services/reconciliation/dbExecutor.js'
import { executeBetaMemoryAlignment } from '../services/reconciliation/betaMemoryAlignment.js'
import { executeUnifiedMemoryPipeline } from '../services/reconciliation/unifiedMemoryPipeline.js'

export const copilotRouter = Router()

/**
 * 唯讀 SQL 執行安全沙盒 (Read-Only SQL Execution Sandbox)
 * 嚴格阻斷任何寫入或 DDL 關鍵字，以 BEGIN READ ONLY 與 3000ms 超時保護
 */
async function runReadOnlySql(sql: string): Promise<{ rowCount: number; rows: any[] }> {
  const trimmed = sql.trim()
  const forbiddenKeywords = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|EXEC|EXECUTE|VACUUM)\b/i

  if (forbiddenKeywords.test(trimmed)) {
    throw new Error('安全防禦攔截：此工具為唯讀沙盒，嚴禁包含寫入或結構修改關鍵字 (INSERT, UPDATE, DELETE, DROP 等)')
  }

  if (!/^(SELECT|WITH)\b/i.test(trimmed)) {
    throw new Error('安全防禦攔截：SQL 語句必須以 SELECT 或 WITH 開頭')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN READ ONLY')
    await client.query("SET LOCAL statement_timeout = '3000ms'")
    const res = await client.query(trimmed)
    await client.query('COMMIT')
    return {
      rowCount: res.rowCount || res.rows.length,
      rows: res.rows.slice(0, 100)
    }
  } catch (err: any) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

function extractItemText(content: any): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (typeof content === 'object') {
    if (content.description && typeof content.description === 'string' && content.description.trim()) {
      return content.description
    }
    if (content.text && typeof content.text === 'string' && content.text.trim()) {
      return content.text
    }
    const blocks = Array.isArray(content) ? content : (Array.isArray(content.blocks) ? content.blocks : null)
    if (blocks) {
      return blocks.map((b: any) => {
        if (!b) return ''
        if (b.type === 'table') {
          const rows = b.content?.rows || []
          if (rows.length === 0) return ''
          return rows.map((r: any, rIdx: number) => {
            const cells = (r.cells || []).map((cell: any) => {
              if (Array.isArray(cell)) {
                return cell.map((t: any) => t.text || '').join('')
              }
              return typeof cell === 'string' ? cell : ''
            })
            const rowStr = '| ' + cells.join(' | ') + ' |'
            if (rIdx === 0) {
              const divider = '| ' + cells.map(() => '---').join(' | ') + ' |'
              return rowStr + '\n' + divider
            }
            return rowStr
          }).join('\n')
        }
        if (Array.isArray(b.content)) {
          return b.content.map((c: any) => c.text || '').join('')
        }
        if (typeof b.content === 'string') return b.content
        return ''
      }).filter(Boolean).join('\n\n')
    }
  }
  return ''
}

function safeParseActionJson(rawStr: string): any {
  if (!rawStr) return null
  let cleaned = rawStr.trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()

  // 1. Direct parse
  try {
    return JSON.parse(cleaned)
  } catch (_) {}

  // 2. Remove trailing commas
  try {
    const noTrailing = cleaned.replace(/,\s*([}\]])/g, '$1')
    return JSON.parse(noTrailing)
  } catch (_) {}

  // 3. Fix unescaped control characters and newlines inside JSON string literals
  try {
    let inString = false
    let escaped = false
    let result = ''
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i]
      if (escaped) {
        result += char
        escaped = false
        continue
      }
      if (char === '\\') {
        result += char
        escaped = true
        continue
      }
      if (char === '"') {
        inString = !inString
        result += char
        continue
      }
      if (inString) {
        if (char === '\n') {
          result += '\\n'
          continue
        }
        if (char === '\r') {
          result += '\\r'
          continue
        }
        if (char === '\t') {
          result += '\\t'
          continue
        }
      }
      result += char
    }
    const fixed = result.replace(/,\s*([}\]])/g, '$1')
    return JSON.parse(fixed)
  } catch (_) {}

  // 4. Try auto-closing unclosed JSON (for truncated responses)
  try {
    let openBraces = (cleaned.match(/\{/g) || []).length
    let closeBraces = (cleaned.match(/\}/g) || []).length
    let openBrackets = (cleaned.match(/\[/g) || []).length
    let closeBrackets = (cleaned.match(/\]/g) || []).length
    let patch = cleaned
    while (closeBrackets < openBrackets) {
      patch += ']'
      closeBrackets++
    }
    while (closeBraces < openBraces) {
      patch += '}'
      closeBraces++
    }
    return JSON.parse(patch.replace(/,\s*([}\]])/g, '$1'))
  } catch (_) {}

  return null
}

function fillTableFromText(templateMarkdown: string, text: string): string {
  if (!templateMarkdown || !templateMarkdown.includes('|')) return text

  const lines = templateMarkdown.split('\n')
  const filledLines: string[] = []

  const kvMap: Record<string, string> = {}
  const kvRegex = /(?:^|\n)[ \t]*(?:[-*•]|\d+\.)?[ \t]*(?:\*\*|__)?([A-Za-z0-9\s&/_:：\u4e00-\u9fa5]+?)(?:\*\*|__)?\s*[:：]\s*([^\n]+)/g
  let match: RegExpExecArray | null
  while ((match = kvRegex.exec(text)) !== null) {
    const rawK = match[1].trim().toLowerCase().replace(/^(?:project|item|工單|專案)\s*/i, '')
    const fullK = match[1].trim().toLowerCase()
    const val = match[2].trim().replace(/^[`'"]|[`'"]$/g, '')
    if (val) {
      if (fullK) kvMap[fullK] = val
      if (rawK) kvMap[rawK] = val
    }
  }

  // 常見 Charter / PM 欄位繁簡中英文同義詞庫
  const FIELD_SYNONYMS: Record<string, string[]> = {
    'project title': ['專案名稱', '項目名稱', '專案標題', '標題', '項目標題', 'title', 'project title'],
    'business sponsor': ['贊助人', '發起人', 'sponsor', 'business sponsor'],
    'business owner': ['業務負責人', '業務擁有者', 'owner', 'business owner'],
    'project lead': ['專案主管', '專案經理', '專案負責人', '負責人', 'lead', 'project lead', 'pm'],
    'problem & opportunity': ['問題與機會', '業務痛點', '問題', '痛點', '背景', '現狀', 'problem', 'opportunity', 'problem & opportunity'],
    'objectives': ['核心目標', '專案目標', '目標', '主要目標', 'objective', 'objectives'],
    'quantifiable benefits': ['量化效益', '量化價值', '量化成果', 'quantifiable benefits', 'quantifiable'],
    'non-quantifiable benefits': ['非量化效益', '質化效益', '質化價值', 'non-quantifiable benefits'],
    'strategic alignment': ['策略對齊', '戰略對齊', '策略', '戰略', 'strategic alignment'],
    'metric': ['量化指標', '指標', '衡量指標', 'kpi', 'metric', 'metrics'],
    'baseline': ['基準值', '基準', '現狀值', 'baseline'],
    'target': ['目標值', '目標指標', 'target'],
    'in-scope': ['範疇定義', '範疇', '包含範疇', '範圍', '涵蓋範圍', 'in-scope', 'in scope'],
    'out-of-scope': ['排除範疇', '非範圍', '不包含', 'out-of-scope', 'out of scope'],
    'project team members': ['專案團隊', '團隊成員', '專案成員', '成員', 'project team members', 'team'],
    'stakeholders': ['利害關係人', '持份者', '相關方', 'stakeholders', 'stakeholder'],
    'known risks': ['風險管理', '潛在風險', '風險', '阻礙', 'known risks', 'risk', 'risks']
  }

  for (const line of lines) {
    if (!line.trim().startsWith('|')) {
      filledLines.push(line)
      continue
    }
    const parts = line.split('|').map(p => p.trim())
    if (parts.length >= 3) {
      const fieldName = parts[1]
      const currentDesc = parts[2]
      if (fieldName === 'Field' || fieldName === '欄位' || fieldName.includes('---')) {
        filledLines.push(line)
        continue
      }

      let fillVal = currentDesc || ''
      const lowerField = fieldName.toLowerCase().trim()
      const rawField = lowerField.replace(/^(?:project|item|工單|專案)\s*/i, '')

      // 1. 先用同義詞比對
      let matched = false
      const synonyms = FIELD_SYNONYMS[lowerField] || FIELD_SYNONYMS[rawField] || []
      const allSearchKeys = [lowerField, rawField, ...synonyms]

      for (const [k, v] of Object.entries(kvMap)) {
        if (allSearchKeys.some(key => k === key || k.includes(key) || key.includes(k))) {
          fillVal = v
          matched = true
          break
        }
      }

      // 2. 若無精確同義詞，採用模糊子字串比對
      if (!matched) {
        for (const [k, v] of Object.entries(kvMap)) {
          if (lowerField === k || rawField === k || lowerField.includes(k) || k.includes(rawField)) {
            fillVal = v
            break
          }
        }
      }

      filledLines.push(`| ${fieldName} | ${fillVal} |`)
    } else {
      filledLines.push(line)
    }
  }

  return filledLines.join('\n')
}

/**
 * @deprecated Legacy fallback parser.
 * Candidates extracted from text regex MUST NOT bypass executeReconciliationPipeline()
 * and MUST NOT directly mutate or construct a CanonicalProposal.
 */
function parseStructuredItemsFromText(text: string, members: any[] = [], existingItems: any[] = []): any[] {
  if (!text || text.trim() === '') return []
  const items: any[] = []
  const lines = text.split('\n')

  let currentType = 'Task'
  let currentSectionTitle = 'AI 需求拆解工單'

  const typePatterns: Array<{ regex: RegExp; type: string; sectionName: string }> = [
    { regex: /(?:🎯|🏆)?\s*(?:Objective|商業目標|專案目標|總目標|目標)\s*(?:[:：\(\)（）\-]|\b)/i, type: 'Objective', sectionName: '🎯 專案目標 (Objectives)' },
    { regex: /(?:📋|📄)?\s*(?:Requirement|業務需求|專案需求|功能需求|需求)\s*(?:[:：\(\)（）\-]|\b)/i, type: 'Requirement', sectionName: '📋 業務需求 (Requirements)' },
    { regex: /(?:📖|👤|🧑‍💻)?\s*(?:User\s*Story|使用者故事|用戶故事|故事)\s*(?:[:：\(\)（）\-]|\b)/i, type: 'User story', sectionName: '📖 使用者故事 (User Stories)' },
    { regex: /(?:⚡|🛠️|⚒️|🔧)?\s*(?:Task|執行任務|開發任務|工作項目|任務)\s*(?:[:：\(\)（）\-]|\b)/i, type: 'Task', sectionName: '⚡ 執行任務 (Tasks)' },
    { regex: /(?:🧪|🔬|🧬)?\s*(?:UAT|驗收測試|測試案例|功能測試|驗收)\s*(?:[:：\(\)（）\-]|\b)/i, type: 'UAT', sectionName: '🧪 驗收測試 (UATs)' },
    { regex: /(?:💡|🧠)?\s*(?:Decision|架構決策|技術決策|決策記錄|決策)\s*(?:[:：\(\)（）\-]|\b)/i, type: 'Decision', sectionName: '💡 架構決策 (Decisions)' },
    { regex: /(?:⚠️|🚨|🛑)?\s*(?:Bottleneck|技術阻礙|瓶頸風險|阻礙|瓶頸)\s*(?:[:：\(\)（）\-]|\b)/i, type: 'Bottleneck', sectionName: '⚠️ 瓶頸與阻礙 (Bottlenecks)' },
    { regex: /(?:👥|📅|🗣️)?\s*(?:Meeting|會議記錄|架構會議|定案會議|會議)\s*(?:[:：\(\)（）\-]|\b)/i, type: 'Meeting', sectionName: '👥 會議記錄 (Meetings)' },
    { regex: /(?:🚩|🏁)?\s*(?:Milestone|專案里程碑|交付里程碑|里程碑)\s*(?:[:：\(\)（）\-]|\b)/i, type: 'Milestone', sectionName: '🚩 專案里程碑 (Milestones)' },
    { regex: /(?:📜)?\s*(?:Charter|專案章程|立項章程|章程)\s*(?:[:：\(\)（）\-]|\b)/i, type: 'Charter', sectionName: '📜 專案章程 (Charters)' },
    { regex: /(?:🐞|🐛)?\s*(?:Bug|缺陷修復|問題修復|缺陷)\s*(?:[:：\(\)（）\-]|\b)/i, type: 'Bug', sectionName: '🐞 缺陷修復 (Bugs)' },
    { regex: /(?:ℹ️|📚)?\s*(?:Information|規格文件|背景資訊|技術資料|資訊)\s*(?:[:：\(\)（）\-]|\b)/i, type: 'Information', sectionName: 'ℹ️ 規格資訊 (Information)' }
  ]

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (!rawLine) continue

    // 1. 檢測是否為分組類別標題列（如 "3. 👤 User Story (使用者故事)：" 或 "### 4. 🛠️ Task (執行任務)"）
    for (const tp of typePatterns) {
      if (tp.regex.test(rawLine)) {
        currentType = tp.type
        currentSectionTitle = tp.sectionName
        break
      }
    }

    // 2. 檢測是否為具體工單項目條目（如 "• US-01: 旅客無感通過 (對應 REQ-01)。" 或 "- TSK-01: 開發 /api/... (Kevin)"）
    const isBulletLine = /^[•\-\*\+]\s+/.test(rawLine) || /^\d+[\.、\)]\s+/.test(rawLine)
    const codePrefixMatch = rawLine.match(/^([•\-\*\+]\s*|\d+[\.、\)]\s*)?([A-Z0-9]{2,6}[-_]\d+)\s*[:：\-]\s*(.*)$/i)
    
    if (codePrefixMatch || isBulletLine) {
      let lineText = rawLine.replace(/^[•\-\*\+]\s*(?:\[[\sxX]\]\s*)?/, '').replace(/^\d+[\.、\)]\s*/, '').trim()
      if (lineText.length < 3) continue

      // 略過純大標題（例如「使用者故事：」、「執行任務：」）
      if (lineText.endsWith('：') || lineText.endsWith(':')) {
        continue
      }

      // 🚨 嚴格過濾對話分析、大綱標題、LaTeX 箭頭、前言與結論段落（杜絕偽工單與假 Objective 產生）
      if (isJunkHeadingOrPreamble(lineText)) {
        continue
      }

      let title = lineText
      let assigneeUid: string | undefined = undefined
      let parentUidOrCode: string | undefined = undefined

      // 提取負責人 (例如 (Kevin), (Sarah), (Edmond), [Kevin], 【Kevin】, 負責人: Kevin, 或行內提及)
      const assigneeBracketMatch = title.match(/[\(（\[【]([A-Za-z0-9\u4e00-\u9fa5\s]{2,15})[\)）\]】]/)
      if (assigneeBracketMatch) {
        const potentialName = assigneeBracketMatch[1].trim().toLowerCase()
        const foundMember = members.find(m => 
          m.member_name?.toLowerCase().includes(potentialName) || 
          potentialName.includes(m.member_name?.toLowerCase()) ||
          m.member_name?.toLowerCase().startsWith(potentialName)
        )
        if (foundMember) {
          assigneeUid = foundMember.member_uid
          title = title.replace(assigneeBracketMatch[0], '').trim()
        }
      }

      if (!assigneeUid && members.length > 0) {
        const titleLower = title.toLowerCase()
        for (const m of members) {
          if (!m.member_name) continue
          const mName = m.member_name.trim().toLowerCase()
          if (mName.length >= 2 && titleLower.includes(mName)) {
            assigneeUid = m.member_uid
            break
          }
          const firstName = mName.split(' ')[0]
          if (firstName && firstName.length >= 3) {
            const firstRegex = new RegExp(`(?:\\b|[\(（\[【：:•\\-])${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\b|[\)）\\]】\\s,，;；。])`, 'i')
            if (firstRegex.test(titleLower)) {
              assigneeUid = m.member_uid
              break
            }
          }
        }
      }

      // 提取父層/關聯工單編號 (例如 (對應 REQ-01), (驗證 TSK-01, 02), (父層: OBJ-01))
      const parentMatch = title.match(/[\(（\[【](?:對應|父層|關聯|驗證|parent|related to|covers|blocks|discusses)?\s*([A-Z0-9]{2,6}[-_]\d+)[\)）\]】]/i)
      if (parentMatch) {
        parentUidOrCode = parentMatch[1].trim()
      }

      // 優先級判定：未顯式指定則為 undefined (TBC / Unspecified)
      let priority: 'High' | 'Middle' | 'Low' | undefined = undefined
      const explicitPri = extractExplicitPriority(title)
      if (explicitPri) {
        priority = explicitPri
      }
      if (currentType === 'Information' || currentType === 'Charter' || currentType === 'Milestone') {
        priority = undefined
      }

      // 移除標題 Markdown 格式與結尾標點
      title = title
        .replace(/^[*`_~#\s]+|[*`_~#\s]+$/g, '')
        .replace(/^(?:objective|requirement|user\s*story|story|task|uat|bug|decision|bottleneck|meeting|milestone|charter)\s*[:：\s-]+/i, '')
        .replace(/^[*`_~#\s]+|[*`_~#\s]+$/g, '')
        .replace(/[。；;]+$/, '')
        .trim()

      if (title.length >= 3) {
        items.push({
          itemTitle: title,
          itemType: currentType,
          itemPriority: priority,
          itemFollowBy: assigneeUid,
          parentItemUid: parentUidOrCode,
          description: `依據 AI 架構拆解建立之 ${currentType} 工單：${title}`,
          sectionTitle: currentSectionTitle
        })
      }
    }
  }

  return items
}

/**
 * POST /api/copilot/chat
 * Schema-Aware Tool Calling + 專屬 Def 工具 + 唯讀 SQL 沙盒 + 多模型調度 + Thinking Mode
 */
copilotRouter.post('/chat', async (req: Request, res: Response) => {
  const { 
    message, 
    workspace_uid, 
    project_uid,
    conversation_history = [],
    attachments = [],
    model: customModel,
    enable_thinking = false,
    beta_alignment_mode = false,
    unified_memory_mode = false
  } = req.body

  if (!message || !workspace_uid) {
    return res.status(400).json({ error: 'message and workspace_uid are required' })
  }

  try {
    const apiKey = process.env.DASHSCOPE_API_KEY
    const baseUrl = process.env.DASHSCOPE_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
    const model = customModel || process.env.LLM_ROUTER_MODEL || 'gemma4:31b-cloud'

    // 1. 預載工作區基礎 Context (Workspace, Projects, Members)
    const wsRes = await pool.query(
      `SELECT workspace_uid, prefix_code, workspace_name, last_item_number, last_project_number FROM public.workspace WHERE workspace_uid = $1`,
      [workspace_uid]
    )
    const workspaceInfo = wsRes.rows[0] || { workspace_uid, workspace_name: 'Unknown', prefix_code: '' }

    // 獲取該工作區旗下專案/產品清單
    const prjRes = await pool.query(`
      SELECT 
        p.project_uid, 
        p.project_display_code, 
        p.project_name, 
        p.project_type, 
        p.project_sub_type, 
        p.project_status,
        m.member_name as owner_name,
        (SELECT count(*)::int FROM public.item WHERE related_project_uid = p.project_uid) as item_count
      FROM public.project p
      LEFT JOIN public.member m ON p.project_owner = m.member_uid
      WHERE p.related_workspace_uid = $1
      ORDER BY p.project_number ASC
    `, [workspace_uid])
    const projectsContext = prjRes.rows

    // 獲取所有啟用團隊成員
    const memberRes = await pool.query(`
      SELECT member_uid, member_name, member_email, member_ad_group, member_status
      FROM public.member
      WHERE member_status = 'Active' OR member_status IS NULL
      ORDER BY member_name ASC
    `)
    const membersContext = memberRes.rows

    // 獲取當前聚焦專案詳情與工單層級 (若指定 project_uid)
    let currentProject: any = null
    let itemsContext: any[] = []

    if (project_uid) {
      const pRes = await pool.query(`
        SELECT p.*, m.member_name as owner_name 
        FROM public.project p 
        LEFT JOIN public.member m ON p.project_owner = m.member_uid 
        WHERE p.project_uid = $1
      `, [project_uid])
      currentProject = pRes.rows[0] || null

      const itemRes = await pool.query(`
        SELECT 
          i.item_uid, 
          i.item_display_code, 
          i.item_title, 
          i.item_type, 
          i.item_status, 
          i.item_priority, 
          i.parent_item_uid,
          i.item_follow_by,
          i.item_content,
          m.member_name as follow_by_name,
          parent.item_display_code as parent_code,
          parent.item_title as parent_title,
          i.updated_at
        FROM public.item i
        LEFT JOIN public.member m ON i.item_follow_by = m.member_uid
        LEFT JOIN public.item parent ON i.parent_item_uid = parent.item_uid
        WHERE i.related_project_uid = $1
        ORDER BY i.item_number ASC, i.updated_at DESC
        LIMIT 200
      `, [project_uid])
      itemsContext = itemRes.rows
    } else {
      const itemRes = await pool.query(`
        SELECT 
          i.item_uid, 
          i.item_display_code, 
          i.item_title, 
          i.item_type, 
          i.item_status, 
          i.item_priority,
          i.item_follow_by,
          i.item_content,
          m.member_name as follow_by_name,
          p.project_name,
          p.project_display_code as project_code
        FROM public.item i
        LEFT JOIN public.member m ON i.item_follow_by = m.member_uid
        LEFT JOIN public.project p ON i.related_project_uid = p.project_uid
        WHERE i.workspace_uid = $1
        ORDER BY i.updated_at DESC
        LIMIT 200
      `, [workspace_uid])
      itemsContext = itemRes.rows
    }

    // ----------------------------------------------------
    // 🌟 Memory Alignment Beta (Single-LLM Opt-In Alignment Mode)
    // ----------------------------------------------------
    if (beta_alignment_mode) {
      if (!project_uid) {
        return res.json({
          text: '⚠️ **記憶對齊 (Beta) 提示**：請先於上方選取目標專案，以載入該專案之既有工單進行對齊比對。',
          model_used: model,
          actionPreview: null,
          actionPreviews: []
        })
      }

      // Extract transcript text from attachment or message
      const attachmentText = (attachments || [])
        .map((a: any) => a.textContent || a.content || '')
        .filter(Boolean)
        .join('\n\n')
      const transcript = attachmentText || message

      const alignmentResult = await executeBetaMemoryAlignment({
        projectUid: project_uid,
        projectName: currentProject?.project_name || '當前專案',
        items: itemsContext,
        transcriptText: transcript,
        model
      })

      return res.json({
        text: alignmentResult.reportMarkdown,
        model_used: model,
        actionPreview: alignmentResult.actionPreview,
        actionPreviews: alignmentResult.actionPreview ? [alignmentResult.actionPreview] : []
      })
    }

    // ----------------------------------------------------
    // 🧠 Unified Project Memory Alpha (Single-LLM Opt-In Unified Mode)
    // ----------------------------------------------------
    if (unified_memory_mode) {
      if (!project_uid) {
        return res.json({
          text: '⚠️ **統一專案記憶 (Alpha) 提示**：請先於上方選取目標專案，以載入該專案之既有工單進行統一記憶比對與對齊。',
          model_used: model,
          actionPreview: null,
          actionPreviews: []
        })
      }

      // Extract transcript text from attachment or message
      const attachmentText = (attachments || [])
        .map((a: any) => a.textContent || a.content || '')
        .filter(Boolean)
        .join('\n\n')
      const transcript = attachmentText || message

      const unifiedResult = await executeUnifiedMemoryPipeline({
        projectUid: project_uid,
        projectName: currentProject?.project_name || '當前專案',
        items: itemsContext,
        transcriptText: transcript,
        model
      })

      const previewPayload = {
        ...unifiedResult.actionPreview,
        canonicalProposal: unifiedResult.canonicalProposal,
        applied: false,
        isAlphaPreview: true
      }

      return res.json({
        text: unifiedResult.reportMarkdown,
        model_used: model,
        actionPreview: previewPayload,
        actionPreviews: [previewPayload]
      })
    }
    const mentionedCodes: string[] = []
    for (const item of itemsContext) {
      if (!item.item_display_code) continue
      const code = item.item_display_code.toUpperCase()
      const normalizedCode = code.replace(/[-\s_]/g, '')
      const codePattern = new RegExp(`\\b${code.replace(/[-\s_]/g, '[-\\s_]?')}\\b`, 'i')
      if (codePattern.test(message) || message.toUpperCase().includes(code)) {
        if (!mentionedCodes.includes(code)) mentionedCodes.push(code)
      } else {
        const compactMsg = message.replace(/[-\s_]/g, '').toUpperCase()
        if (compactMsg.includes(normalizedCode)) {
          if (!mentionedCodes.includes(code)) mentionedCodes.push(code)
        }
      }
    }
    const mentionedItems = itemsContext.filter(i => mentionedCodes.includes(i.item_display_code?.toUpperCase()))

    // 分流統計 5 層 Traceability 階層與各多態項目
    const objectives = itemsContext.filter(i => i.item_type?.toLowerCase() === 'objective')
    const requirements = itemsContext.filter(i => i.item_type?.toLowerCase() === 'requirement')
    const stories = itemsContext.filter(i => ['user story', 'story'].includes(i.item_type?.toLowerCase()))
    const tasks = itemsContext.filter(i => i.item_type?.toLowerCase() === 'task')
    const uats = itemsContext.filter(i => i.item_type?.toLowerCase() === 'uat')
    const bugs = itemsContext.filter(i => i.item_type?.toLowerCase() === 'bug')
    const decisions = itemsContext.filter(i => i.item_type?.toLowerCase() === 'decision')
    const infos = itemsContext.filter(i => i.item_type?.toLowerCase() === 'information')
    const bottlenecks = itemsContext.filter(i => i.item_type?.toLowerCase() === 'bottleneck')
    const charters = itemsContext.filter(i => i.item_type?.toLowerCase() === 'charter')
    const epics = itemsContext.filter(i => i.item_type?.toLowerCase() === 'epic')
    const microTasks = itemsContext.filter(i => i.item_type?.toLowerCase() === 'micro task')
    const deployments = itemsContext.filter(i => i.item_type?.toLowerCase() === 'deployment')
    const milestones = itemsContext.filter(i => i.item_type?.toLowerCase() === 'milestone')
    const meetings = itemsContext.filter(i => i.item_type?.toLowerCase() === 'meeting')
    const events = itemsContext.filter(i => i.item_type?.toLowerCase() === 'event')

    // 2. 構建 System Prompt (Ground Truth DDL + 業務指南 + 查詢規則 + Action DSL)
    const thinkingInstruction = enable_thinking ? `
【🧠 深度思考模式 (Thinking Mode: ON)】：
在輸出正式回答前，你必須先將深層推理過程（工單相依性、成員負載、查庫邏輯、架構權衡）完整寫在 <think> 與 </think> 標籤內。
` : ''

    const focusedProjectInfo = currentProject ? `
【🎯 目前聚焦專案 (Current Focused Project)】：
- 專案名稱: ${currentProject.project_name} (代碼: ${currentProject.project_display_code}, UID: ${currentProject.project_uid})
- 專案類型: ${currentProject.project_type} (${currentProject.project_sub_type || '無子類型'})
- 專案狀態: ${currentProject.project_status}
- 負責人: ${currentProject.owner_name || '未指定'}
- 專案章程 (Charters 及現有內容/表格結構):
${JSON.stringify(charters.map(c => ({
  code: c.item_display_code,
  title: c.item_title,
  uid: c.item_uid,
  status: c.item_status,
  existing_content: extractItemText(c.item_content)
})), null, 2)}
${mentionedItems.length > 0 ? `
- 🚨 用戶訊息明確提及的目標工單詳細既有內容 (Mentioned Items):
${JSON.stringify(mentionedItems.map(m => ({
  code: m.item_display_code,
  title: m.item_title,
  type: m.item_type,
  uid: m.item_uid,
  existing_content: extractItemText(m.item_content)
})), null, 2)}
` : ''}
- 階層總覽統計:
  * Objectives: ${objectives.length} 個 | Requirements: ${requirements.length} 個 | User Stories: ${stories.length} 個 | Tasks: ${tasks.length} 個 | UATs: ${uats.length} 個
  * Bugs: ${bugs.length} 個 | Decisions: ${decisions.length} 個 | Bottlenecks: ${bottlenecks.length} 個 | Information: ${infos.length} 個
- 專案目標 (Objectives):
${JSON.stringify(objectives.map(o => ({ code: o.item_display_code, title: o.item_title, status: o.item_status, assignee: o.follow_by_name || '未指派', existing_content: o.item_content ? extractItemText(o.item_content) : undefined })), null, 2)}
- 專案需求 (Requirements):
${JSON.stringify(requirements.map(r => ({ code: r.item_display_code, title: r.item_title, status: r.item_status, parent: r.parent_code || '無', assignee: r.follow_by_name || '未指派', existing_content: r.item_content ? extractItemText(r.item_content) : undefined })), null, 2)}
- 專案 User Stories:
${JSON.stringify(stories.map(s => ({ code: s.item_display_code, title: s.item_title, status: s.item_status, parent: s.parent_code || '無', assignee: s.follow_by_name || '未指派', existing_content: s.item_content ? extractItemText(s.item_content) : undefined })), null, 2)}
- 專案 Tasks:
${JSON.stringify(tasks.map(t => ({ code: t.item_display_code, title: t.item_title, status: t.item_status, parent: t.parent_code || '無', assignee: t.follow_by_name || '未指派', existing_content: t.item_content ? extractItemText(t.item_content) : undefined })), null, 2)}
- 專案 UATs: ${JSON.stringify(uats.map(u => ({ code: u.item_display_code, title: u.item_title, status: u.item_status, existing_content: u.item_content ? extractItemText(u.item_content) : undefined })))}
- 專案 Bugs: ${JSON.stringify(bugs.map(b => ({ code: b.item_display_code, title: b.item_title, status: b.item_status, existing_content: b.item_content ? extractItemText(b.item_content) : undefined })))}
- 專案 Decisions: ${JSON.stringify(decisions.map(d => ({ code: d.item_display_code, title: d.item_title, existing_content: d.item_content ? extractItemText(d.item_content) : undefined })))}
- 專案 Information: ${JSON.stringify(infos.map(info => ({ code: info.item_display_code, title: info.item_title, existing_content: info.item_content ? extractItemText(info.item_content) : undefined })))}
- 專案 Bottlenecks: ${JSON.stringify(bottlenecks.map(bt => ({ code: bt.item_display_code, title: bt.item_title, existing_content: bt.item_content ? extractItemText(bt.item_content) : undefined })))}
` : `
【全域工作區模式 (Global Workspace Mode)】：
- 目前未聚焦單一專案，顯示整個工作區的概覽數據。
- 整個工作區已載入 ${itemsContext.length} 個工單概覽。
`

    const systemPrompt = `
你係 Projectson 嘅專業 AI Copilot（具備 Google OKF v0.2、Neon PostgreSQL 完整資料庫 Schema 與 Actionable Agent 能力）。
你必須用繁體中文（廣東話口吻或標準書面語）直接回答用戶。
${thinkingInstruction}

【🚨 核心最高原則：建議層職責與知行合一 (Advisory Candidate Model)】：
1. 你係一個具備語義理解與候選推薦能力嘅 AI Copilot (Understanding & Candidate Recommendation Specialist)。
2. 凡是用戶要求你「填寫」、「更新」、「填入」、「寫」、「修改」、「建立」、「拆解」任何工單：
   - 你在回覆完要點後，可於回答最底部輸出建議的 <<ACTION>>...<<ACTION>> 標籤。
   - 🚨 【權限邊界鐵律】：你所輸出的一切工單項目【均僅為候選建議 (Candidate Proposals)】，後續由後端確定性對齊引擎 (Deterministic Reconciliation Engine) 嚴格檢驗源頭證據！
   - 🚨 【真實性高於完整性 (Truthful Memory > Fabricated PM Hierarchy)】：若上載文件或指令中未包含明確的 User Story，**【嚴禁為了填滿階層而無中生有】**；若無明確 UAT，**【嚴禁憑空捏造驗收條件】**；若技術依賴尚未成為阻礙，**【嚴禁擅自升格為 Bottleneck】**！缺層完全合法且受支援！
   - 🚨 【嚴禁使用標題作為 ID】：parentItemUid 絕不可填寫文字標題！若有依賴，關聯僅供確定性引擎參考。

【🗄️ Projectson 核心架構與 Schema 規範 (Ground Truth)】：
1. 工作區 (public.workspace)：
   - 欄位: workspace_uid (UUID), prefix_code (如 PRJ, ENG, TTG), workspace_name, last_item_number (流水號計數器), last_project_number (專案計數器)

2. 專案/產品 (public.project)：
   - project_type (分類): 嚴格限定 'Product' 或 'Project'
   - project_sub_type (子分類): 
     * 當 project_type = 'Product' 時，project_sub_type 必須為 NULL！
     * 當 project_type = 'Project' 時，project_sub_type 必須為 'Phase' 或 'BAU'！
   - project_status (狀態): 嚴格限定 5 種：
     'Pipeline' (規劃中/待啟動) | 'Active' (進行中) | 'On Hold' (暫停) | 'Completed' (已完成) | 'Abandoned' (已廢棄)
   - project_owner (UUID): 關聯到 member.member_uid

3. 項目多態表 (public.item) —— 核心工作單元：
   - item_type (16 種完整合法類型):
     * 【5 層核心追溯鏈 (Traceability Spine)】：
       1. 'Objective' (專案商業總目標 / 頂層 KPI)
       2. 'Requirement' (業務與功能需求，父級通常為 Objective)
       3. 'User story' (使用者故事，注意小寫 story，父級通常為 Requirement)
       4. 'Task' (具體開發/執行任務，父級通常為 User story 或 Requirement)
       5. 'UAT' (驗收測試案例，父級通常為 Task 或 User story)
     * 【專案管理與敏捷多態 (Agile & Management Polymorphism)】：
       6. 'Charter' (專案章程與總體目標)
       7. 'Epic' (大型史詩)
       8. 'Micro Task' (子任務/細項清單)
       9. 'Event' (重要事件/關鍵日期)
       10. 'Meeting' (會議記錄/討論)
       11. 'Bottleneck' (技術阻礙/依賴瓶頸/風險)
       12. 'Information' (架構文件/技術規格/API指南)
       13. 'Bug' (缺陷/漏洞回報)
       14. 'Deployment' (上線發佈/部署手冊)
       15. 'Milestone' (關鍵里程碑)
       16. 'Decision' (架構決策記錄 ADR / 對話共識定案)

   - item_status (8 種嚴格合法狀態，禁止使用其他字眼)：
     1. 'Not Start' (未開始 / 待辦)
     2. 'Ready' (準備就緒 / 可動工)
     3. 'In Progress' (進行中 / 施工中)
     4. 'Blocked' (受阻 / 遇到阻礙)
     5. 'Review' (審查中 / 測試中 / Code Review)
     6. 'Completed' (已完成 —— 所有 Done/Pass/Approved 一律設定為此)
     7. 'Closed' (已關閉 / 已作廢 —— 所有 Cancelled/Abandoned/作廢/取消 一律設定為此)
     8. 'Backlog' (儲備池 / 需求池)

   - item_priority (3 種優先級): 'High' | 'Middle' | 'Low'

   - 關聯架構 (Hierarchy & Dependency)：
     * 垂直階層 (parent_item_uid): 樹狀父子關係 (UUID 唯一定義)。
     * 水平依賴 (relation_item_uid JSONB): [{item_uid: UUID, relation: 'blocks' | 'covers' | 'deploys' | 'discusses' | 'causes'}]
       - 系統會自動計算雙向關係 (例如 A blocks B -> B is blocked by A)。

4. 團隊成員 (public.member):
   - member_uid (UUID), member_name, member_email, member_ad_group, member_status ('Active')

5. 技術規格與知識沉澱 (public.item - Information / Decision / Bottleneck / Charter):
   - 所有技術架構規格、外部 API 規範、環境配置與 SOP 均作為 'Information' 原生工單存於資料庫，享有完整 5 層階層與雙向關聯鏈。
   - 決策共識沉澱為 'Decision' 工單，排錯記錄沉澱為 'Bottleneck' 工單。

【安全守則與權限規範】：
1. 嚴禁物理刪除 (No Hard Delete)：AI 不具備直接由資料庫物理刪除工單的權限。若用戶提出刪除工單要求，你應解釋專案審計規範，並建議將工單狀態改為 'Closed' (已作廢) 或解除父子關聯，並透過 Proposal Canvas 送出更新提案。
2. 所有人機協同寫入必須由用戶確認 (Human-in-the-Loop)：所有建立、更新、批量提案必須包裝成規範的 Action JSON 標籤，讓用戶在介面上審核。

【目前所在工作區即時數據 (Preloaded Context)】：
- 當前工作區: ${workspaceInfo.workspace_name} (UID: ${workspace_uid}, Prefix: ${workspaceInfo.prefix_code})
- 該工作區下之專案/產品清單 (共 ${projectsContext.length} 個):
${JSON.stringify(projectsContext.map(p => ({
  uid: p.project_uid,
  code: p.project_display_code,
  name: p.project_name,
  type: p.project_type,
  sub_type: p.project_sub_type,
  status: p.project_status,
  items_count: p.item_count,
  owner: p.owner_name || '未指定'
})), null, 2)}
- 團隊成員清單 (指派負責人請使用以下姓名或 UID):
${JSON.stringify(membersContext.map(m => ({ uid: m.member_uid, name: m.member_name, email: m.member_email })), null, 2)}
${focusedProjectInfo}

【🎯 意圖精準識別與 Action 派發法則 (Precise User Intent Routing)】：
🚨 你必須嚴格遵從用戶的【具體要求】，嚴禁自作主張將單一指令擴大為 4-in-1 全套操作！

0. 🛡️ 【場景 0：上載文件自動比對與零變更判定法則 (Autonomous Document Diffing & Zero-Delta Protocol)】（只要用戶有附帶文件或貼上會議記錄，強制執行！）：
   - 🔍 **第一步：主動比對現狀 (Scan Existing DB Items)**：
     * 當用戶上載文件（如 Meeting Recap、PRD、規格書）時，無論用戶提示詞是否含有「請對比」或「請更新」，你【第一件事必須先核對上方 Context 中所有已建立之工單】！
   - ⚖️ **第二步：精準計算增量 (Compute Delta)**：
     * 🟢 **全新工單 (New Items / Full Initialization)**：
       - 若當前專案為空，或文件中包含多個全新需求/任務/會議/決策：
       - 🚨 **【必須一律使用 1 個 batch_proposal 提案】**，將會議 (\`Meeting\`)、5 層追溯骨架 (\`Objective\` ➔ \`Requirement\` ➔ \`User story\` ➔ \`Task\` ➔ \`UAT\`)、架構決策 (\`Decision\`) 與瓶頸 (\`Bottleneck\`) **全部完整打包在同一個 \`batch_proposal.items\` 陣列中**！
       - 🚨 **【嚴禁在多工單場景下只輸出單張 create_item】**！只有當全篇文件「真的只討論了單獨 1 張工單」時才允許使用 \`create_item\`。
     * 🟡 **實質變更 (Modified Items)**：僅針對資料庫中已存在之工單（如 TPM-45），且文件中【明確給出了全新不同之驗收條件、新截止日、或重大決策異動】，輸出 \`update_item\`。
     * ⚪ **完全一致 / 已建立 (Zero Delta)**：若文件內容只是重複闡述既有工單的已知內容，且資料庫中已有一致的工單記錄，【嚴禁重複輸出 update_item 或重複開新單】！
   - 🚨 **第三步：零變更保護與核對報告 (No-Op Output Rule)**：
     * 若整份文件比對後發現所有內容均已在資料庫中建檔且無實質新變更，【絕對嚴禁輸出任何 <<ACTION>> 標籤】！
     * 你必須在對話中輸出結構化比對清單，例如：
       \`\`\`markdown
       ### 📋 文件與現有工單比對核對報告
       * **上載文件**：<檔案名稱或主題>
       * **比對結果**：
         - [TPM-xx] <工單標題>：內容與狀態已在資料庫中對齊（無須變更）。
       * **結論**：經全面比對，本次上載內容與目前專案已建立之工單完全一致，無新增任務或實質異動。保持現狀，無須寫入資料庫。
       \`\`\`

1. 🏛️ 【場景 A：全工單通用模板與結構 100% 繼承與填寫 (Universal Item & Template Filling)】（適用於 Charter, Objective, Requirement, User story, Task, UAT, Decision, Information 等全部 16 種工單類型）：
   - ⚠️ **【嚴禁自把自為執行 4-in-1 或建立無關工單】**！用戶只想專注於填寫或更新指定/現存工單！
   - 🚨 **【既有表格結構/自訂模板 100% 繼承與填寫法則 (Preserve Existing Template & Table)】**：
     * 當目標工單（如用戶指定的代碼如 TTG-96、或在專案 Context / mentionedItems 中找到之工單）已具備既有內容或 Markdown 表格結構（例如包含 \`| Field | Description |\` 或 \`| 欄位 | 說明 |\`、自訂表單結構、特定欄位清單）：
     * 你【必須 100% 保持該 Markdown 表格的所有行和欄位名稱，將會議紀錄/附件/用戶指示之具體內容逐一填入右側 Description 欄位】！
     * 【絕對不可破壞表格格式，不可改成一般 H1/H2 段落文字，不可遺漏或替換任何原始欄位名稱】！
   - 💡 **【模板內部指示/佔位符嚴格遵從 (Template In-line Instructions)】**：
     * 若模板單元格或括號中包含填寫指示（例如：\`(請列出 3 個量化指標，包含 SLA)\`、\`[Given-When-Then 格式]\`、\`(需包含負責人與預計交付日)\` 或表頭上方的 Prompt 註解）：
     * 你【必須嚴格遵從該指示的要求、格式與規範】來提煉並填入該格內容，並以填好之實際內容取代佔位提示字！
   - 🚨 **【必須在回覆最底部輸出 update_item Action】**：
     * 若更新已存在之工單（如目標工單 Code 或 UID）：
       在回答最底部輸出：
       \`<<ACTION>>{"actionType":"update_item","targetDisplayCode":"<目標工單Code如TTG-96>","itemTitle":"<工單標題>","updates":{"item_content":{"text":"<填好且保持表格結構的Markdown>","description":"<填好且保持表格結構的Markdown>"}},"summary":"根據指示填寫表格內容"}<<ACTION>>\`
     * 若為新工單且無既有模板：
       輸出 \`create_item\` 動作。

2. 🚀 【場景 B：複合指令與多重動作處理 (Multi-Action / Compound Requests)】：
   - 🚨 **當用戶在同一則指令中提出多個需求（例如：「記錄會議工單，並且更新 TPM-16 Charter 表格」、「建立 Task 同時更新 Requirement」）時，你【必須在同一則回覆最底部同時輸出所有對應的 <<ACTION>> 區塊】**！
     * 動作 1 (例如 create_item 或 batch_proposal): 建立會議工單或拆解任務。
     * 動作 2 (例如 update_item): 更新/填寫目標工單（如 TPM-16 Charter）表格內容。
   - 系統前端 Proposal Canvas 支持同時展示多個提案，用戶可以一次過逐一審核並套用全部！

3. 🌲 【場景 C：5 層 Traceability 溯源骨架 (用戶要求「Traceability 骨架」、「拆解需求架構」、「建立溯源樹」、「Kick-off 初始化」)】：
   - 🚨 **【頂層 Objective 絕對強制令】**：
     * 凡是拆解需求、任務或追溯骨架，**【第 1 個項目必須且絕對強制是 'Objective' (專案商業總目標)】**！
     * 所有頂層 Requirement 的 parentItemUid **必須填寫該同批 Objective 的標題**！
     * 嚴禁跳過 Objective 直接從 Requirement 開始，否則 Traceability 溯源鏈矩陣將無根節點可供掛載！
   - 使用 1 個 batch_proposal 提案，完整輸出 5 層縱向骨架（每一層透過 parentItemUid 縱向鏈接）：
     * 🎯 第 1 層 'Objective' (parentItemUid: null)
     * 📋 第 2 層 'Requirement' (parentItemUid: '同批 Objective 標題')
     * 👤 第 3 層 'User story' (parentItemUid: '同批 Requirement 標題')
     * 🛠️ 第 4 層 'Task' (parentItemUid: '同批 User story 標題')
     * 🧪 第 5 層 'UAT' (parentItemUid: '同批 Task 標題')

4. 👥 【場景 D：一般會議拆解 (用戶要求「整理會議記錄」、「一般會議拆解」)】：
   - 建立 1 張 'Meeting' 工單，並在同批建立會中拍板的 'Decision'、'Task' 或 'Bottleneck' 工單。
   - Meeting 工單必須在 relationItemUid 中標註 [{"item_uid": "同批任務或決策標題", "relation": "discusses"}]。

5. ➕ 【場景 E：單張工單新增/修改/決策沉澱】：
   - 根據用戶指令輸出對應的 create_item、update_item 或 consensus_proposal。

【知行合一絕對準則 (Zero Hallucinated Action Gap)】：
- 🚨 凡是你在對話文字中分析或提及的所有工單，【必須 100% 逐一寫入對應的 <<ACTION>> Payload 中】！
- 每張子工單的 parentItemUid 必須明確填寫同批父項目標題或現有工單 Code。
- 每張會議/瓶頸工單的 relationItemUid 必須明確填寫同批關聯項目標題或現有工單 Code。

【📦 Neon PostgreSQL 核心 JSONB 欄位規範與標準契約 (Strict JSONB Contract)】：
為了確保所有寫入資料庫的內容在 BlockNote 富文本編輯器、Traceability 矩陣與 OKF 知識庫中完美呈現，你必須遵循以下規範：

1. 工單內容主體 (public.item.item_content / description)：
   - 結構契約：一律輸出標準 Markdown 文本（包含 H1/H2 標題、粗體、清單、GFM 表格與引用區塊）。
   - 各類型標準範式 (Polymorphic Markdown Templates)：
     * 🏛️ 'Charter' (專案章程)：
       \`# 專案章程 (Project Charter)\\n## 1. 商業總目標 (Objective & Vision)\\n...\\n## 2. 專案範疇 (In-Scope & Out-of-Scope)\\n...\\n## 3. 關鍵成功指標 (KPIs & Metrics)\\n| 指標名稱 | 目標值 | 驗收基準 |\\n|---|---|---|\\n...\\n## 4. 里程碑與交付時程\\n...\`
     * 📅 'Meeting' (會議記錄)：
       \`# 會議記錄 (Meeting Minutes)\\n**會議主題**：...\\n**會議日期**：YYYY-MM-DD\\n**出席成員**：...\\n\\n## 1. 核心討論與共識 (Summary)\\n...\\n## 2. 架構決策 (Decisions)\\n...\\n## 3. 阻礙與風險 (Bottlenecks)\\n...\\n## 4. 行動項目清單 (Action Items)\\n| 任務名稱 | 負責人 | 預計交付日 |\\n|---|---|---|\`
     * ⚖️ 'Decision' (架構決策記錄 ADR)：
       \`# 架構決策記錄 (Architecture Decision Record)\\n**狀態**：Approved / 定案\\n## 1. 背景與問題陳述 (Context)\\n...\\n## 2. 候選方案評估與權衡 (Trade-offs Table)\\n| 方案 | 優點 | 缺點 | 成本 |\\n|---|---|---|---|\\n...\\n## 3. 拍板結論與核心論據 (Decision & Rationale)\\n...\\n## 4. 後續影響與配套 (Consequences)\\n...\`
     * ⚠️ 'Bottleneck' (技術阻礙與瓶頸)：
       \`# 技術阻礙與風險評估 (Bottleneck Report)\\n**嚴重程度**：High / Medium / Low\\n## 1. 阻礙現象與受阻模組 (Symptoms & Blocked Items)\\n...\\n## 2. 根本原因剖析 (Root Cause Analysis)\\n...\\n## 3. 緩解與應對處置方案 (Mitigation Plan)\\n...\\n## 4. 解決負責人與預計解除日\\n...\`
     * 🎯 'Objective' / 📋 'Requirement' / 👤 'User story' / 🛠️ 'Task' / 🧪 'UAT'：
       包含清晰的條列說明、驗收準則 (Acceptance Criteria / Given-When-Then) 與技術實作指引。

2. 水平依賴關係 (public.item.relation_item_uid JSONB)：
   - 結構：\`[{"item_uid":"<UUID 或同批工單標題或代碼>","relation":"blocks"|"covers"|"deploys"|"discusses"|"causes"}]\`
   - 規則：Meeting 會議工單若討論了 Task、Decision 或 Bottleneck，標記 discusses；Bottleneck 標記 blocks；UAT 覆蓋 Task 標記 covers。

3. 自訂屬性擴展 (public.item.item_attribute JSONB)：
   - 可在更新或建立時提供 \`{ "meeting_date": "YYYY-MM-DD", "attendees": ["成員A", "成員B"], "kpi_target": "...", "risk_level": "High" }\` 等精準鍵值。

【Action 標籤格式規範 (必須嚴格遵從 Schema 枚舉)】：
⚠️ 只要涉及「建立工單」、「修改工單」、「填格仔/更新內容」、「作廢工單」、「提煉決策」、「會議整理」，你必須在回覆的【最底部】附帶 <<ACTION>> 標籤！這是觸發系統彈出右側 Proposal Canvas 審批工作台的唯一憑據！絕不可只在文字中說準備好了卻遺漏 <<ACTION>> 標籤！
⚠️ 【嚴禁輸出 tool_call 作為 ACTION】！所有建立、修改、提案一律使用 batch_proposal, update_item, create_item, consensus_proposal。專案即時數據已完整預載於上方 Context 中，請直接輸出你的繁體中文分析結論與 ACTION 標籤！
⚠️ 【優先級接地規範 (Priority Grounding)】：若來源文檔未明確給出優先級（例如未明確提及「高優先」、「最高優先級」、「High Priority」），itemPriority 必須返回 null (TBC / Unspecified)！絕對嚴禁依據個人/業務重要性推測填寫 High / Middle / Low！

1. 批量提案 (用於會議拆解、需求架構拆解、一鍵生成多張工單)：
   <<ACTION>>{"actionType":"batch_proposal","proposalTitle":"<提案標題，如：Kick-off 啟航初始化工單批次>","items":[{"itemTitle":"<標題>","itemType":"Objective"|"Requirement"|"User story"|"Task"|"UAT"|"Bug"|"Decision"|"Information"|"Bottleneck"|"Meeting"|"Milestone"|"Charter","itemPriority":"High"|"Middle"|"Low"|null,"itemFollowBy":"<成員姓名或UID>","parentItemUid":"<可選同批父項目標題或代碼如TTG-14>","relationItemUid":[{"item_uid":"<同批關聯項目標題或代碼>","relation":"discusses"|"blocks"|"covers"}],"description":"<必須提供完整結構化的Markdown內文與表格，不可留空！>"}]}<<ACTION>>

2. 單張建立 (用於開一張特定新工單)：
   <<ACTION>>{"actionType":"create_item","itemType":"Objective"|"Requirement"|"User story"|"Task"|"UAT"|"Bug"|"Decision"|"Information"|"Bottleneck"|"Meeting"|"Milestone"|"Charter","itemTitle":"<標題>","parentItemUid":"<可選父工單Code或UID>","relationItemUid":[{"item_uid":"<關聯項目Code或UID>","relation":"discusses"|"blocks"|"covers"}],"itemFollowBy":"<成員姓名或UID>","itemPriority":"High"|"Middle"|"Low"|null,"description":"<必須提供完整結構化的Markdown內文與表格，不可留空！>"}<<ACTION>>

3. 單張更新 (用於指派人員、更新狀態、修改標題、填寫/更新 Description 或 Markdown 表格內容)：
   <<ACTION>>{"actionType":"update_item","targetDisplayCode":"<工單Code如TTG-32>","targetItemUid":"<工單UID>","itemTitle":"<工單標題>","updates":{"item_content":{"text":"<完整更新後的Markdown內容/表格>","description":"<完整更新後的Markdown內容/表格>"},"item_follow_by":"<可選成員姓名或UID>","item_status":"<可選狀態>","parent_item_uid":"<可選父工單Code或UID>"},"summary":"<變更說明如：填寫 Project Charter 表格>"}<<ACTION>>

4. 對話決策共識沉澱：
   <<ACTION>>{"actionType":"consensus_proposal","itemTitle":"<決策標題>","statement":"<決策內容總結>","rationale":"<決策論據與背景>"}<<ACTION>>

⚠️ 當用戶要求「Kick-off 4-in-1 全套初始化」時：
你必須在同一則回覆最底部同時輸出多個 <<ACTION>> 區塊：
1. 第一個 <<ACTION>> 輸出 update_item 更新現有的 Project Charter (例如 TTG-32) 表格；
2. 第二個 <<ACTION>> 輸出 batch_proposal，一口氣建立所有 Milestones、5層 Traceability (Objective ➔ Requirement ➔ User story ➔ Task ➔ UAT) 與 Meeting 工單（並以 relationItemUid 綁定 discusses）！
`

    // 3. 定義 Tool Definitions (相容 DashScope / OpenAI 規範)
    const tools = [
      {
        type: 'function',
        function: {
          name: 'get_workspace_overview',
          description: '獲取指定工作區的概覽資訊、專案清單與工單統計',
          parameters: {
            type: 'object',
            properties: {
              workspace_uid: { type: 'string', description: '工作區 UID' }
            },
            required: ['workspace_uid']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'list_projects',
          description: '查詢工作區內的所有專案或產品清單',
          parameters: {
            type: 'object',
            properties: {
              workspace_uid: { type: 'string', description: '工作區 UID' },
              project_type: { type: 'string', description: "可選過濾 'Product' 或 'Project'" },
              project_status: { type: 'string', description: '可選過濾專案狀態' }
            },
            required: ['workspace_uid']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_items',
          description: '多條件檢索工單與追溯項目 (支援 Objective, Requirement, User story, Task, Bug, Decision, Information, Bottleneck 等)',
          parameters: {
            type: 'object',
            properties: {
              workspace_uid: { type: 'string', description: '工作區 UID' },
              project_uid: { type: 'string', description: '可選專案 UID' },
              item_type: { type: 'string', description: '可選類型 (Objective, Requirement, User story, Task, Bug, Decision, Information, Bottleneck)' },
              item_status: { type: 'string', description: '可選狀態 (Not Start, Ready, In Progress, Blocked, Review, Completed, Closed, Backlog)' },
              assignee_name: { type: 'string', description: '可選指派負責人姓名' },
              keyword: { type: 'string', description: '可選標題關鍵字' }
            },
            required: ['workspace_uid']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_item_detail',
          description: '獲取單一工單詳細資料、反向關聯、子工單與評論',
          parameters: {
            type: 'object',
            properties: {
              item_key: { type: 'string', description: '工單 UID 或 Display Code (例如 TTG-12)' }
            },
            required: ['item_key']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'execute_read_only_sql',
          description: '執行自訂 PostgreSQL 唯讀 SQL 查詢 (僅限 SELECT / WITH 語句，禁止任何寫入操作)',
          parameters: {
            type: 'object',
            properties: {
              sql_query: { type: 'string', description: 'PostgreSQL SELECT 語句' },
              rationale: { type: 'string', description: '查詢此 SQL 的目的或邏輯說明' }
            },
            required: ['sql_query']
          }
        }
      }
    ]

    // 4. 多輪 Tool Calling 執行循環與多模態附件解析
    // 提取當前訊息之文字與圖片附件
    let currentFormattedMessage = message
    const currentTextAtts = (attachments || []).filter((a: any) => a.type === 'text' || a.textContent)
    if (currentTextAtts.length > 0) {
      currentFormattedMessage += '\n\n【用戶附加文件檔案 (Attached Files)】:\n' + 
        currentTextAtts.map((a: any) => `📄 檔案: ${a.name}\n\`\`\`\n${a.textContent || a.content}\n\`\`\``).join('\n\n')
    }

    const currentImageAtts = (attachments || []).filter((a: any) => a.type === 'image' || (a.dataUrl && a.dataUrl.startsWith('data:image/')) || (a.mimeType && a.mimeType.startsWith('image/')))

    let currentUserContent: any = currentFormattedMessage
    let effectiveModel = model

    if (currentImageAtts.length > 0) {
      if (!effectiveModel.includes('vl')) {
        effectiveModel = 'qwen-vl-max'
      }
      currentUserContent = [
        { type: 'text', text: currentFormattedMessage },
        ...currentImageAtts.map((img: any) => ({
          type: 'image_url',
          image_url: {
            url: img.dataUrl || img.content
          }
        }))
      ]
    }

    let messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversation_history.map((h: any) => {
        if (h.sender === 'user' && h.attachments && h.attachments.length > 0) {
          let hText = h.text
          const textAtts = h.attachments.filter((a: any) => a.type === 'text' || a.textContent)
          if (textAtts.length > 0) {
            hText += '\n\n【歷史附加文件】:\n' + textAtts.map((a: any) => `📄 ${a.name}:\n${a.textContent || a.content}`).join('\n\n')
          }
          const imgAtts = h.attachments.filter((a: any) => a.type === 'image' || (a.dataUrl && a.dataUrl.startsWith('data:image/')))
          if (imgAtts.length > 0) {
            return {
              role: 'user',
              content: [
                { type: 'text', text: hText },
                ...imgAtts.map((img: any) => ({
                  type: 'image_url',
                  image_url: { url: img.dataUrl || img.content }
                }))
              ]
            }
          }
          return { role: 'user', content: hText }
        }
        return {
          role: h.sender === 'user' ? 'user' : 'assistant',
          content: h.text
        }
      }),
      { role: 'user', content: currentUserContent }
    ]

    let finalAiText = ''
    const isOllama = model.startsWith('ollama:') || 
      ['gemma4:31b-cloud', 'gemma4:31b', 'gemma4:latest', 'deepseek-v4.1-flash', 'kimi-k3', 'glm-5.3-flash', 'qwen3.5:397b'].includes(model)

    if (isOllama) {
      const targetOllamaModel = model.replace(/^ollama:/, '') || process.env.OLLAMA_MODEL || 'gemma4:31b-cloud'
      const ollamaApiKey = process.env.OLLAMA_API_KEY
      const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || 'https://api.ollama.com').replace(/\/v1\/?$/, '').replace(/\/$/, '') + '/api/chat'

      const ollamaMessages = messages.map(m => {
        if (typeof m.content === 'string') return { role: m.role, content: m.content }
        if (Array.isArray(m.content)) {
          const textPart = m.content.find((c: any) => c.type === 'text')
          return { role: m.role, content: textPart?.text || '' }
        }
        return { role: m.role, content: String(m.content || '') }
      })

      const response = await fetch(ollamaBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ollamaApiKey}`
        },
        body: JSON.stringify({
          model: targetOllamaModel,
          messages: ollamaMessages,
          stream: false,
          options: {
            temperature: enable_thinking ? 0.6 : 0.3,
            num_predict: 8192
          }
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Ollama Cloud API Error (${targetOllamaModel}): ${errText}`)
      }

      const data: any = await response.json()
      finalAiText = data.message?.content || data.response || ''
    } else {
      let iterations = 0
      const maxIterations = 3

      while (iterations < maxIterations) {
        iterations++

        const requestBody: any = {
          model: effectiveModel,
          messages: messages,
          temperature: enable_thinking ? 0.6 : 0.3,
          max_tokens: 8192
        }

        if (!effectiveModel.includes('deepseek-r1') && !effectiveModel.includes('vl')) {
          requestBody.tools = tools
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const errText = await response.text()
          throw new Error(`DashScope API Error (${model}): ${errText}`)
        }

      const data: any = await response.json()
      const choice = data.choices?.[0]
      const responseMessage = choice?.message

      if (!responseMessage) {
        finalAiText = '暫時無法獲取回答'
        break
      }

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        messages.push(responseMessage)

        for (const toolCall of responseMessage.tool_calls) {
          const fnName = toolCall.function?.name
          let fnArgs: any = {}
          try {
            fnArgs = JSON.parse(toolCall.function?.arguments || '{}')
          } catch (e) {
            console.error('Failed to parse tool call args:', e)
          }

          let toolResult: any = {}

          try {
            if (fnName === 'get_workspace_overview') {
              const targetWsUid = fnArgs.workspace_uid || workspace_uid
              const wRes = await pool.query(`SELECT * FROM public.workspace WHERE workspace_uid = $1`, [targetWsUid])
              const pRes = await pool.query(`SELECT project_uid, project_display_code, project_name, project_status, project_type FROM public.project WHERE related_workspace_uid = $1`, [targetWsUid])
              const iRes = await pool.query(`SELECT count(*)::int as item_count FROM public.item WHERE workspace_uid = $1`, [targetWsUid])
              toolResult = {
                workspace: wRes.rows[0],
                projects: pRes.rows,
                total_items: iRes.rows[0]?.item_count || 0
              }
            } else if (fnName === 'list_projects') {
              const targetWsUid = fnArgs.workspace_uid || workspace_uid
              let pQuery = `
                SELECT p.*, m.member_name as owner_name 
                FROM public.project p 
                LEFT JOIN public.member m ON p.project_owner = m.member_uid 
                WHERE p.related_workspace_uid = $1
              `
              const pParams: any[] = [targetWsUid]
              if (fnArgs.project_type) {
                pParams.push(fnArgs.project_type)
                pQuery += ` AND p.project_type ILIKE $${pParams.length}`
              }
              if (fnArgs.project_status) {
                pParams.push(fnArgs.project_status)
                pQuery += ` AND p.project_status ILIKE $${pParams.length}`
              }
              pQuery += ` ORDER BY p.project_number ASC`
              const pRes = await pool.query(pQuery, pParams)
              toolResult = { count: pRes.rows.length, projects: pRes.rows }
            } else if (fnName === 'search_items') {
              const targetWsUid = fnArgs.workspace_uid || workspace_uid
              let iQuery = `
                SELECT 
                  i.item_uid, 
                  i.item_display_code, 
                  i.item_title, 
                  i.item_type, 
                  i.item_status, 
                  i.item_priority, 
                  i.parent_item_uid,
                  parent.item_display_code as parent_display_code,
                  m.member_name as follow_by_name
                FROM public.item i
                LEFT JOIN public.member m ON i.item_follow_by = m.member_uid
                LEFT JOIN public.item parent ON i.parent_item_uid = parent.item_uid
                WHERE i.workspace_uid = $1
              `
              const iParams: any[] = [targetWsUid]
              if (fnArgs.project_uid) {
                iParams.push(fnArgs.project_uid)
                iQuery += ` AND i.related_project_uid = $${iParams.length}`
              }
              if (fnArgs.item_type) {
                iParams.push(fnArgs.item_type)
                iQuery += ` AND i.item_type ILIKE $${iParams.length}`
              }
              if (fnArgs.item_status) {
                iParams.push(fnArgs.item_status)
                iQuery += ` AND i.item_status ILIKE $${iParams.length}`
              }
              if (fnArgs.keyword) {
                iParams.push(`%${fnArgs.keyword}%`)
                iQuery += ` AND (i.item_title ILIKE $${iParams.length} OR i.item_display_code ILIKE $${iParams.length})`
              }
              if (fnArgs.assignee_name) {
                iParams.push(`%${fnArgs.assignee_name}%`)
                iQuery += ` AND (m.member_name ILIKE $${iParams.length} OR m.member_email ILIKE $${iParams.length})`
              }
              iQuery += ` ORDER BY i.item_number ASC LIMIT 50`
              const iRes = await pool.query(iQuery, iParams)
              toolResult = { count: iRes.rows.length, items: iRes.rows }
            } else if (fnName === 'get_item_detail') {
              const key = String(fnArgs.item_key).trim()
              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)
              const singleRes = await pool.query(
                `SELECT i.*, m.member_name as follow_by_name, p.project_name FROM public.item i 
                 LEFT JOIN public.member m ON i.item_follow_by = m.member_uid
                 LEFT JOIN public.project p ON i.related_project_uid = p.project_uid
                 WHERE ${isUuid ? 'i.item_uid = $1' : 'i.item_display_code ILIKE $1'}`,
                [key]
              )
              const foundItem = singleRes.rows[0]
              if (foundItem) {
                const childRes = await pool.query(
                  `SELECT item_uid, item_display_code, item_title, item_type, item_status, item_priority 
                   FROM public.item WHERE parent_item_uid = $1 ORDER BY item_number ASC`,
                  [foundItem.item_uid]
                )
                toolResult = {
                  ...foundItem,
                  child_items: childRes.rows
                }
              } else {
                toolResult = { error: 'Item not found' }
              }
            } else if (fnName === 'execute_read_only_sql') {
              toolResult = await runReadOnlySql(fnArgs.sql_query)
            } else {
              toolResult = { error: `Unknown function: ${fnName}` }
            }
          } catch (toolErr: any) {
            toolResult = { error: toolErr.message }
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          })
        }

        continue
      } else {
        finalAiText = responseMessage.content || ''
        break
      }
    }
    }

    // 5. 解析 Thinking Mode 思維鏈與 Action Preview (支援單個與多個 <<ACTION>> 標籤)
    let reasoningContent: string | undefined = undefined
    const rawActionPreviews: any[] = []
    let cleanText = finalAiText

    const thinkMatch = cleanText.match(/<think>(.*?)<\/think>/s)
    if (thinkMatch) {
      reasoningContent = thinkMatch[1].trim()
      cleanText = cleanText.replace(/<think>.*?<\/think>/s, '').trim()
    }

    // 全域提取所有 <<ACTION>> ... <</ACTION>> 區塊
    const globalActionRegex = /<<ACTION>>\s*(\{[\s\S]*?\})\s*<<\/?ACTION>>/gi
    let globalMatch: RegExpExecArray | null
    while ((globalMatch = globalActionRegex.exec(finalAiText)) !== null) {
      const parsed = safeParseActionJson(globalMatch[1])
      if (parsed) {
        rawActionPreviews.push(parsed)
      }
    }

    // 若未匹配到標準 <<ACTION>> 標籤，嘗試容錯正則提取
    if (rawActionPreviews.length === 0) {
      const fallbackRegexList = [
        /ACTION<<\s*(\{[\s\S]*?\})\s*>>?ACTION<</i,
        /<<ACTION>>\s*(\{[\s\S]*?\})\s*$/i,
        /```(?:json)?\s*(\{[\s\S]*?"actionType"[\s\S]*?\})\s*```/i,
        /(\{\s*"actionType"\s*:\s*"(?:create_item|update_item|batch_proposal|consensus_proposal)"[\s\S]*?\})/i
      ]

      for (const regex of fallbackRegexList) {
        const match = cleanText.match(regex)
        if (match) {
          const parsed = safeParseActionJson(match[1])
          if (parsed) {
            rawActionPreviews.push(parsed)
            break
          }
        }
      }
    }

    // 乾淨清除內文中的所有 ACTION 標籤標記與 AI 模仿歷史生成的假「✅ 已成功套用」
    cleanText = cleanText
      .replace(/<<ACTION>>[\s\S]*?<<\/?ACTION>>/gi, '')
      .replace(/ACTION<<[\s\S]*?>>?ACTION<</gi, '')
      .replace(/✅\s*已成功套用[^\n]*(\n|$)/gi, '')
      .trim()

    // 嚴格過濾合法之 Action Preview 類型（徹底杜絕 tool_call 等未定義型別污染）
    const VALID_ACTION_TYPES = ['batch_proposal', 'create_item', 'update_item', 'consensus_proposal']
    let actionPreviews = rawActionPreviews.filter(a => a && typeof a === 'object' && VALID_ACTION_TYPES.includes(a.actionType))

    // 遍歷所有 update_item 動作，若 updates 內為純文字或未完全填寫表格，但目標工單具有 Markdown 表格模板，執行 fillTableFromText 確保 100% 填格仔
    for (const act of actionPreviews) {
      if (act.actionType === 'update_item') {
        let contentText = ''
        if (act.updates?.item_content) {
          contentText = typeof act.updates.item_content === 'object'
            ? (act.updates.item_content.text || act.updates.item_content.description || '')
            : String(act.updates.item_content || '')
        } else if (act.updates?.description) {
          contentText = String(act.updates.description || '')
        }

        const targetItem = itemsContext.find(i =>
          (act.targetDisplayCode && i.item_display_code?.toUpperCase() === act.targetDisplayCode.toUpperCase()) ||
          (act.targetItemUid && i.item_uid === act.targetItemUid)
        )
        if (targetItem) {
          const rawExisting = extractItemText(targetItem.item_content)
          if (rawExisting && rawExisting.includes('|')) {
            if (!contentText.includes('|') || contentText.split('|').length < 5) {
              const filled = fillTableFromText(rawExisting, cleanText + '\n' + contentText)
              act.updates = act.updates || {}
              act.updates.item_content = { text: filled, description: filled }
            }
          }
        }
      }
    }

    // 🚨 終極安全防護：語義自動救援 (Auto-Heuristic Recovery)
    // 涵蓋：指派負責人 (Assign)、修改狀態 (Status)、填寫/更新表格與描述、關閉/作廢工單
    const isAssignIntent = /(?:安排|指派|分派|派畀|交畀|畀|指定|負責人|跟進|assign|follow|lead|owner)/i.test(message) || /(?:指派給|重新指派給|負責人為|指派)/i.test(cleanText)
    const isStatusIntent = /(?:改為|改成|變成|設定為|狀態|status|complete|closed|blocked|in progress|not start|ready|作廢|取消|關閉)/i.test(message)
    const isFillOrUpdateIntent = /(?:填寫|填入|更新|修改|寫入|格式|template|format|fill|update|charter|表格|描述|description)/i.test(message)
    
    // 如果有提到工單，或指派/更新意圖
    let targetItem = (mentionedItems && mentionedItems.length > 0 ? mentionedItems[0] : null)
    if (!targetItem) {
      // 嘗試從 cleanText 或 message 中提取工單 code（例如 AI 在回覆中提及 TPM-6）
      for (const item of itemsContext) {
        if (!item.item_display_code) continue
        const code = item.item_display_code.toUpperCase()
        const normalizedCode = code.replace(/[-\s_]/g, '')
        if (cleanText.toUpperCase().includes(code) || cleanText.replace(/[-\s_]/g, '').toUpperCase().includes(normalizedCode)) {
          targetItem = item
          break
        }
      }
    }
    if (!targetItem && isFillOrUpdateIntent && /charter/i.test(message) && charters && charters.length > 0) {
      targetItem = charters[0]
    }

    if (targetItem && (isAssignIntent || isStatusIntent || isFillOrUpdateIntent)) {
      const alreadyHasUpdate = actionPreviews.some(a => 
        a.actionType === 'update_item' && 
        (a.targetDisplayCode?.toUpperCase() === targetItem.item_display_code?.toUpperCase() || a.targetItemUid === targetItem.item_uid)
      )

      if (!alreadyHasUpdate) {
        const updates: any = {}
        let actionSummary = `更新 [${targetItem.item_display_code}]「${targetItem.item_title}」`

        // 1. 指派負責人 (Assign Member)
        if (isAssignIntent) {
          let matchedMember: any = null
          for (const m of membersContext) {
            const mName = m.member_name?.toLowerCase()
            const mEmail = m.member_email?.toLowerCase()
            const mUid = m.member_uid
            if (mName && (message.toLowerCase().includes(mName) || cleanText.toLowerCase().includes(mName))) {
              matchedMember = m
              break
            }
            if (mEmail && (message.toLowerCase().includes(mEmail) || cleanText.toLowerCase().includes(mEmail))) {
              matchedMember = m
              break
            }
            if (mUid && cleanText.includes(mUid)) {
              matchedMember = m
              break
            }
            // 匹配名字第一部分（如 Edmond）
            const firstName = mName?.split(' ')[0]
            if (firstName && firstName.length >= 2 && (message.toLowerCase().includes(firstName) || cleanText.toLowerCase().includes(firstName))) {
              matchedMember = m
              break
            }
          }

          if (matchedMember) {
            updates.item_follow_by = matchedMember.member_uid
            actionSummary = `將負責人指派給 ${matchedMember.member_name}`
          }
        }

        // 2. 狀態修改 (Status Update)
        if (isStatusIntent) {
          const lowerCombined = (message + ' ' + cleanText).toLowerCase()
          if (/closed|已作廢|作廢|取消|關閉/.test(lowerCombined)) {
            updates.item_status = 'Closed'
            actionSummary = `將工單標記為 Closed（已作廢）`
          } else if (/in progress|進行中|開工/.test(lowerCombined)) {
            updates.item_status = 'In Progress'
            actionSummary = `將狀態設定為 In Progress`
          } else if (/completed|完成|done/.test(lowerCombined)) {
            updates.item_status = 'Completed'
            actionSummary = `將狀態設定為 Completed`
          } else if (/blocked|阻礙|卡住/.test(lowerCombined)) {
            updates.item_status = 'Blocked'
            actionSummary = `將狀態設定為 Blocked`
          } else if (/review|審查|審核/.test(lowerCombined)) {
            updates.item_status = 'Review'
            actionSummary = `將狀態設定為 Review`
          } else if (/ready|就緒/.test(lowerCombined)) {
            updates.item_status = 'Ready'
            actionSummary = `將狀態設定為 Ready`
          } else if (/not start|未開始/.test(lowerCombined)) {
            updates.item_status = 'Not Start'
            actionSummary = `將狀態設定為 Not Start`
          }
        }

        // 3. 填寫/更新表格與描述 (僅限純表格對位，其餘複雜範本交由專業 Agent 提煉)
        if (cleanText.includes('|') && !cleanText.includes('📋 文件與現有工單比對核對報告')) {
          let updatedMarkdown = ''
          const tableMatch = cleanText.match(/(\|[\s\S]*?\|[\r\n]+\|[\s\S]*?\|)/)
          if (tableMatch) {
            updatedMarkdown = tableMatch[0].trim()
          } else {
            const rawExisting = extractItemText(targetItem.item_content)
            if (rawExisting && rawExisting.includes('|')) {
              updatedMarkdown = fillTableFromText(rawExisting, cleanText)
            }
          }
          if (updatedMarkdown && updatedMarkdown.includes('|')) {
            updates.item_content = {
              text: updatedMarkdown,
              description: updatedMarkdown
            }
            if (!actionSummary.includes('負責人') && !actionSummary.includes('狀態')) {
              actionSummary = `根據指示更新 [${targetItem.item_display_code}]「${targetItem.item_title}」表格內容`
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          actionPreviews.push({
            actionType: 'update_item',
            targetDisplayCode: targetItem.item_display_code,
            targetItemUid: targetItem.item_uid,
            itemTitle: targetItem.item_title,
            updates: updates,
            summary: actionSummary
          })
        }
      }
    }

    // 4. 領域專家 (3 Sub-Agents) 與 Supervisor Critic 主管預審 (Pre-Reconciliation Candidate Review)
    // 依據 Authority Boundary 規範：LLM / Sub-Agents / Critic 僅具 Candidate 推薦權，絕不可直接產出或修改 Canonical Proposal
    const agentCtx: AgentContext = {
      workspace_uid,
      project_uid,
      workspaceInfo,
      projectsContext,
      membersContext,
      itemsContext,
      mentionedItems,
      currentProject,
      message,
      conversation_history,
      attachments,
      model,
      enable_thinking
    }

    const supervisorOutcome = await orchestrateMultiAgentPipeline(agentCtx, actionPreviews)
    const candidateProposals = supervisorOutcome.unifiedActions

    // 5. 來源帳本基數對齊與確定性對齊管線 (Deterministic Reconciliation Pipeline)
    // 依據 Spec 規範：來源文檔與用戶指令嚴格物理隔離 (Source Document vs Processing Instruction)
    // 唯一權威：由 executeReconciliationPipeline 組裝唯一不可變之 CanonicalProposal，LLM/Critic 嚴禁於此後執行
    let sourceContent = ''
    const attachmentFilename = attachments?.[0]?.name

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      sourceContent = attachments
        .map(att => att.textContent || att.content || '')
        .filter(Boolean)
        .join('\n\n')
    } else {
      sourceContent = message || ''
    }

    const sourceDocument = {
      documentId: attachments?.[0]?.id || `DOC-${Date.now().toString(36).toUpperCase()}`,
      filename: attachmentFilename,
      content: sourceContent
    }

    const processingInstruction = {
      userIntent: message,
      requestedOperation: 'reconcile_and_propose',
      targetProjectId: currentProject?.project_uid
    }

    const reconciliation = executeReconciliationPipeline({
      sourceDocument,
      processingInstruction,
      text: sourceContent,
      existingItems: itemsContext,
      members: membersContext,
      currentProject: currentProject ? { project_uid: currentProject.project_uid, project_name: currentProject.project_name } : undefined,
      rawPreviews: candidateProposals,
      filename: attachmentFilename
    })

    let extractedItems: any[] = []

    if (!reconciliation.coverage.isComplete) {
      const missingTypes = reconciliation.coverage.incompleteExtraction?.suspectedItemTypes?.join('、') || '專案關鍵要素'
      cleanText = `⚠️ **文件提取未完整 (Extraction Incomplete)**\n\n系統檢測到上載之文件「${attachmentFilename || '會議記錄'}」包含實質專案章節，但候選項目未能完整代表所有章節（疑似漏缺：**${missingTypes}**）。\n\n為遵守 Projectson 專案記憶完整性規範，系統已安全攔截提案並阻止寫入資料庫。`
      actionPreviews = []
    } else if (reconciliation.creates.length >= 2 || reconciliation.updates.length > 0) {
      extractedItems = reconciliation.creates.map(c => ({
        candidateId: c.candidateId,
        proposalItemId: c.proposalItemId,
        itemTitle: c.itemTitle,
        sourceLabel: c.sourceLabel,
        itemType: c.itemType,
        itemPriority: c.itemPriority || undefined,
        itemFollowBy: c.itemFollowBy,
        assigneeUid: c.assigneeUid,
        assigneeId: c.assigneeId,
        assigneeName: c.assigneeName,
        parentCandidateId: c.parentCandidateId,
        parentProposalItemId: c.parentProposalItemId,
        parentItemUid: c.parentItemUid,
        relationshipStatus: c.relationshipStatus || 'CONFIRMED',
        relationItemUid: c.relationItemUid,
        description: c.description || (c.itemType === 'Objective' ? `### 🎯 商業核心目標：${c.itemTitle}` : undefined),
        sourceContent: c.sourceContent,
        inferred: c.inferred || false,
        confidence: c.confidence || 1.0,
        needsReview: c.needsReview || (c.relationshipStatus === 'NEEDS_REVIEW'),
        sourceReference: c.sourceReference,
        sourceEvidence: c.sourceEvidence,
        sectionTitle: c.itemType === 'Objective' ? '🎯 專案目標' :
                      c.itemType === 'Requirement' ? '📋 核心需求' :
                      c.itemType === 'User story' ? '📖 使用者故事' :
                      c.itemType === 'Task' ? '⚡ 執行任務' :
                      c.itemType === 'UAT' ? '🧪 驗收測試' :
                      c.itemType === 'Decision' ? '💡 架構決策' :
                      c.itemType === 'Bottleneck' ? '⚠️ 瓶頸與阻礙' :
                      c.itemType === 'Milestone' ? '🚩 專案里程碑' : '👥 會議記錄'
      }))

      actionPreviews = [{
        actionType: 'batch_proposal',
        proposalTitle: currentProject ? `${currentProject.project_name} 需求架構拆解提案` : 'AI 需求架構拆解提案',
        items: extractedItems,
        canonicalProposal: reconciliation
      }]
    } else if (reconciliation.creates.length === 1 && reconciliation.updates.length === 0) {
      const singleCreate = reconciliation.creates[0]
      actionPreviews = [{
        actionType: 'create_item',
        candidateId: singleCreate.candidateId,
        proposalItemId: singleCreate.proposalItemId,
        itemTitle: singleCreate.itemTitle,
        itemType: singleCreate.itemType,
        itemPriority: singleCreate.itemPriority || undefined,
        itemFollowBy: singleCreate.itemFollowBy,
        description: singleCreate.description,
        canonicalProposal: reconciliation
      }]
    } else {
      // 檢查 candidateProposals 中是否有非 batch 的合法更新或共識提案
      const nonBatchCandidates = candidateProposals.filter(p => p.actionType === 'update_item' || p.actionType === 'consensus_proposal')
      if (nonBatchCandidates.length > 0) {
        actionPreviews = nonBatchCandidates.map(p => ({
          ...p,
          canonicalProposal: reconciliation
        }))
      } else {
        actionPreviews = []
      }
    }

    const primaryAction = supervisorOutcome.primaryAction || actionPreviews[0] || undefined

    // RULE 9: UI NARRATIVE MUST FOLLOW VALIDATION
    const isValidationFailed = reconciliation?.validation?.status === 'FAIL'
    if (isValidationFailed) {
      const errMsgs = (reconciliation.validation?.errors || []).map(e => `• [${e.code}] ${e.message}`).join('\n')
      cleanText = `❌ **提案安全驗證未通過 (Proposal Validation Failed)**\n\n系統依據專案語義保真性規範（Semantic Data Integrity）進行嚴格驗收，本提案未通過安全校驗，已安全攔截並阻止寫入資料庫（資料庫寫入數：0）。\n\n**攔截原因：**\n${errMsgs}\n\n為保證專案記憶正確性，此提案無法提交套用。請依據原始事實釐清後重新提交。`
    } else if (!cleanText || cleanText.trim() === '') {
      if (actionPreviews.length > 1) {
        cleanText = `已為您成功規劃 **${actionPreviews.length} 個連鎖作業提案**（包含填寫表格、批量建立、工單關聯掛接等）。請於右側 Proposal Canvas 工作台逐一審核或一鍵套用全部。`
      } else if (primaryAction) {
        if (primaryAction.actionType === 'update_item') {
          const isClosed = primaryAction.updates?.item_status === 'Closed'
          const code = primaryAction.targetDisplayCode || '目標工單'
          cleanText = isClosed
            ? `我查證確認，為遵守專案審計與追溯規範，已為您將 **[${code}]** 的狀態提議設定為 **Closed（已作廢）**。請於右側展開之 Proposal Canvas 工作台審批確認。`
            : `已為您準備工單 **[${code}]** 的更新提案（${primaryAction.summary || '更新屬性'}），請於右側 Proposal Canvas 工作台核准套用。`
        } else if (primaryAction.actionType === 'create_item') {
          cleanText = `已為您準備建立新工單 **[${primaryAction.itemType || 'Task'}]**「${primaryAction.itemTitle}」，請於右側 Proposal Canvas 工作台核准建立。`
        } else if (primaryAction.actionType === 'batch_proposal') {
          if (reconciliation.creates.length === 0 && reconciliation.updates.length > 0) {
            cleanText = `已為您完成專案增量對齊提案（共 ${reconciliation.updates.length} 項工單更新）。請於右側 Proposal Canvas 工作台審核並一鍵套用。`
          } else {
            cleanText = `已為您完成需求架構拆解提案（共 ${reconciliation.creates.length} 項新建${reconciliation.updates.length > 0 ? `、${reconciliation.updates.length} 項更新` : ''}）。請於右側 Proposal Canvas 工作台逐項審核、就地微調並一鍵套用。`
          }
        } else if (primaryAction.actionType === 'consensus_proposal') {
          cleanText = `已為您提煉對話決策共識「${primaryAction.itemTitle || '專案架構決策'}」，請於右側 Proposal Canvas 審核並一鍵沉澱至 OKF 專案知識庫。`
        }
      } else if (reasoningContent && reasoningContent.trim() !== '') {
        cleanText = reasoningContent
      } else if (finalAiText && finalAiText.trim() !== '') {
        cleanText = finalAiText
      } else {
        cleanText = '已為您完成專案分析與處理。'
      }
    }

    // 若原先 LLM 嘗試提案，但經 Supervisor Critic 嚴格比對發現為零變更 (No-Op)，確保回覆給予明確的無變更說明
    if (actionPreviews.length === 0 && supervisorOutcome.critiqueNotes.some(n => n.includes('零變更過濾') || n.includes('零增量過濾') || n.includes('完全一致'))) {
      if (!cleanText.includes('完全一致') && !cleanText.includes('無須變更') && !cleanText.includes('保持現狀')) {
        cleanText += '\n\n> 🛡️ **主管驗收器（Supervisor Critic）核對結果**：經嚴格比對，上載內容與目前專案資料庫現況已完全一致，無任何實質新異動，因此本次保持現狀，不觸發多餘的更新審核視窗。'
      }
    }

    res.json({
      text: cleanText,
      reasoning_content: reasoningContent,
      actionPreview: primaryAction,
      actionPreviews: actionPreviews,
      model_used: model,
      workspace_name: workspaceInfo.workspace_name,
      focused_project: currentProject ? currentProject.project_name : null,
      projects_count: projectsContext.length,
      items_count: itemsContext.length
    })


  } catch (err: any) {
    console.error('Copilot chat error:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/copilot/consensus
 * 將對話共識（Chat Consensus）沉澱入專案知識庫與 Decision 工單
 * 
 * 🛡️ Phase 1C AI Mutation Closure:
 * 嚴禁 raw AI payload 直接寫入 public.item。
 * 共識沉澱必須源自經 server authority 驗證之 CanonicalProposal。
 */
copilotRouter.post('/consensus', async (req: Request, res: Response) => {
  const { workspace_uid, project_uid, title, statement, rationale, proposal, humanApproval } = req.body

  if (!workspace_uid || !title || !statement) {
    return res.status(400).json({ error: 'workspace_uid, title, and statement are required', applied: false })
  }

  // 1. 嚴格權威邊界檢查：Raw AI payload 嚴禁繞過 CanonicalProposal 直接寫入
  if (!proposal) {
    return res.status(403).json({
      error: 'RAW_AI_MUTATION_PROHIBITED',
      message: 'Direct unvalidated Project Memory mutation via raw AI consensus is strictly prohibited. AI-originated decisions must originate from an authoritative CanonicalProposal verified by the reconciliation engine.',
      policy: 'Phase 1C Invariant: Any AI-originated Project Memory mutation MUST originate from an authoritative CanonicalProposal.',
      applied: false
    })
  }

  // 2. 伺服器權威註冊、人類審批與 SHA-256 驗證
  const effectiveApproval = humanApproval || proposal.humanApproval
  const boundaryCheck = assertAuthorityBoundaryForMutation(proposal, {
    requireServerAuthority: true,
    requireHumanApproval: true,
    humanApproval: effectiveApproval
  })
  if (!boundaryCheck.valid) {
    return res.status(403).json({
      error: 'AUTHORITY_BOUNDARY_VIOLATION',
      message: 'Consensus CanonicalProposal failed authority boundary verification.',
      details: boundaryCheck.errors,
      applied: false
    })
  }

  // 3. 透過事務執行 CanonicalProposal 與 OKF concepts 沉澱
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const result = await executeCanonicalProposalTransaction(client, proposal, {
      workspace_uid,
      related_project_uid: project_uid || proposal.projectUid,
      members: []
    })

    // Post-Write Database Verification BEFORE COMMIT
    const verification = await verifyDatabaseState(client, proposal as any, result)
    if (verification.status !== 'APPLIED_AND_VERIFIED' || verification.mismatches.length > 0) {
      await client.query('ROLLBACK')
      return res.status(422).json({
        error: 'POST_WRITE_VERIFICATION_FAILED',
        message: 'Database state did not match expected CanonicalProposal. All mutations rolled back.',
        status: 'FAILED_VERIFICATION',
        applied: false,
        mismatches: verification.mismatches
      })
    }

    // 沉澱至 OKF 概念知識庫
    await client.query(
      `INSERT INTO public.okf_concepts (
        workspace_uid,
        project_uid,
        concept_name,
        concept_type,
        concept_description
      ) VALUES ($1, $2, $3, 'Decision', $4)`,
      [
        workspace_uid,
        project_uid || proposal.projectUid || null,
        title.trim(),
        statement
      ]
    )

    await client.query('COMMIT')

    // 標記 proposal 已提交，防止 Replay 攻擊
    markProposalCommitted(proposal.proposalId)

    const createdItem = result.insertedItems[0] || null
    return res.status(201).json({
      message: 'Consensus successfully committed to Knowledge Base and Neon DB via authoritative CanonicalProposal',
      item: createdItem,
      status: 'APPLIED_AND_VERIFIED',
      applied: true,
      result,
      verification
    })
  } catch (err: any) {
    await client.query('ROLLBACK')
    console.error('Commit consensus error:', err)
    return res.status(500).json({ error: err.message, status: 'FAILED_TRANSACTION', applied: false })
  } finally {
    client.release()
  }
})

// ==============================================================================
// 6. AI Copilot 對話 Session 歷史管理端點 (Session History APIs)
// ==============================================================================

/**
 * GET /api/copilot/sessions
 * 獲取歷史對話清單 (支援按 workspace_uid, member_uid, project_uid 篩選)
 */
copilotRouter.get('/sessions', async (req: Request, res: Response) => {
  const { workspace_uid, member_uid, project_uid } = req.query

  if (!workspace_uid) {
    return res.status(400).json({ error: 'workspace_uid is required' })
  }

  try {
    const memberFilter = (member_uid && member_uid !== 'ADMIN') ? member_uid : null
    const projectFilter = project_uid ? project_uid : null

    const query = `
      SELECT 
        s.session_uid,
        s.workspace_uid,
        s.project_uid,
        s.member_uid,
        s.title,
        s.last_model_used,
        s.is_pinned,
        jsonb_array_length(s.messages) as message_count,
        s.created_at,
        s.updated_at,
        p.project_display_code,
        p.project_name
      FROM public.ai_chat_session s
      LEFT JOIN public.project p ON s.project_uid = p.project_uid
      WHERE s.workspace_uid = $1
        AND (
          $2::text IS NULL 
          OR s.member_uid::text = $2::text 
          OR s.member_uid IS NULL
        )
        AND ($3::text IS NULL OR s.project_uid::text = $3::text)
      ORDER BY s.is_pinned DESC, s.updated_at DESC
      LIMIT 100
    `

    const { rows } = await pool.query(query, [workspace_uid, memberFilter, projectFilter])
    res.json(rows)
  } catch (err: any) {
    console.error('Get copilot sessions error:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/copilot/sessions/:id
 * 獲取單一 Session 的完整對話紀錄
 */
copilotRouter.get('/sessions/:id', async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const { rows } = await pool.query(
      `SELECT s.*, p.project_display_code, p.project_name
       FROM public.ai_chat_session s
       LEFT JOIN public.project p ON s.project_uid = p.project_uid
       WHERE s.session_uid = $1`,
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ error: '對話 Session 不存在' })
    }

    res.json(rows[0])
  } catch (err: any) {
    console.error('Get copilot session detail error:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/copilot/sessions
 * 建立新的對話 Session
 */
copilotRouter.post('/sessions', async (req: Request, res: Response) => {
  const { 
    workspace_uid, 
    project_uid, 
    member_uid, 
    title = '新對話', 
    messages = [], 
    last_model_used = 'qwen3.8-flash' 
  } = req.body

  if (!workspace_uid) {
    return res.status(400).json({ error: 'workspace_uid is required' })
  }

  try {
    const actualMemberUid = (member_uid && member_uid !== 'ADMIN') ? member_uid : null

    const { rows } = await pool.query(
      `INSERT INTO public.ai_chat_session (
        workspace_uid, 
        project_uid, 
        member_uid, 
        title, 
        messages, 
        last_model_used
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        workspace_uid,
        project_uid || null,
        actualMemberUid,
        title.trim(),
        JSON.stringify(messages),
        last_model_used
      ]
    )

    res.status(201).json(rows[0])
  } catch (err: any) {
    console.error('Create copilot session error:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * PUT /api/copilot/sessions/:id
 * 更新對話 Session (標題、對話 messages、最後模型、置頂)
 */
copilotRouter.put('/sessions/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { title, messages, last_model_used, is_pinned, project_uid } = req.body

  try {
    const updates: string[] = []
    const values: any[] = [id]
    let paramIdx = 2

    if (title !== undefined) {
      updates.push(`title = $${paramIdx++}`)
      values.push(title.trim())
    }
    if (messages !== undefined) {
      updates.push(`messages = $${paramIdx++}`)
      values.push(JSON.stringify(messages))
    }
    if (last_model_used !== undefined) {
      updates.push(`last_model_used = $${paramIdx++}`)
      values.push(last_model_used)
    }
    if (is_pinned !== undefined) {
      updates.push(`is_pinned = $${paramIdx++}`)
      values.push(Boolean(is_pinned))
    }
    if (project_uid !== undefined) {
      updates.push(`project_uid = $${paramIdx++}`)
      values.push(project_uid || null)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    const query = `
      UPDATE public.ai_chat_session
      SET ${updates.join(', ')}
      WHERE session_uid = $1
      RETURNING *
    `

    const { rows } = await pool.query(query, values)
    if (rows.length === 0) {
      return res.status(404).json({ error: '對話 Session 不存在' })
    }

    res.json(rows[0])
  } catch (err: any) {
    console.error('Update copilot session error:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * DELETE /api/copilot/sessions/:id
 * 刪除指定的對話 Session
 */
copilotRouter.delete('/sessions/:id', async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM public.ai_chat_session WHERE session_uid = $1`,
      [id]
    )

    if (rowCount === 0) {
      return res.status(404).json({ error: '對話 Session 不存在' })
    }

    res.json({ message: '對話已成功刪除', session_uid: id })
  } catch (err: any) {
    console.error('Delete copilot session error:', err)
    res.status(500).json({ error: err.message })
  }
})


