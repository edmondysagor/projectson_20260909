import { Router, Request, Response } from 'express'
import { pool } from '../db.js'

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
      const lowerField = fieldName.toLowerCase()
      const rawField = lowerField.replace(/^(?:project|item|工單|專案)\s*/i, '')

      for (const [k, v] of Object.entries(kvMap)) {
        if (lowerField === k || rawField === k || lowerField.includes(k) || k.includes(rawField)) {
          fillVal = v
          break
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
    enable_thinking = false
  } = req.body

  if (!message || !workspace_uid) {
    return res.status(400).json({ error: 'message and workspace_uid are required' })
  }

  try {
    const apiKey = process.env.DASHSCOPE_API_KEY
    const baseUrl = process.env.DASHSCOPE_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
    const model = customModel || process.env.LLM_ROUTER_MODEL || 'qwen3.8-flash'

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
    let sourcesContext: any[] = []

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

      const sourceRes = await pool.query(`
        SELECT source_uid, file_name, file_type, page_count, status
        FROM public.okf_sources
        WHERE (project_uid = $1 OR project_uid IS NULL) AND workspace_uid = $2 AND is_active = true
      `, [project_uid, workspace_uid])
      sourcesContext = sourceRes.rows
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

    // 檢查用戶訊息中是否有提及特定工單 Display Code (例如 TTG-96)
    const mentionedCodes = (message.match(/(?:[A-Z]{2,5}-\d+|[A-Z]{2,5}-[A-Z]{2,5}-\d+)/gi) || []).map((c: string) => c.toUpperCase())
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

【🚨 核心最高原則：知行合一與 Action 輸出強制令 (Mandatory Action Execution)】：
1. 你係一個「Actionable Agent」，而不僅僅是聊天機器人！
2. 凡是用戶要求你「填寫」、「更新」、「填入」、「寫」、「修改」、「建立」、「拆解」任何工單（包含 Charter, Objective, Requirement, User story, Task, UAT, Decision, Information, Bottleneck 等所有 16 種工單類型）：
   - 你在回覆完要點後，**【必須且絕對強制在回答的最底部輸出對應的 <<ACTION>>...<<ACTION>> 標籤】**！
   - 只有輸出 <<ACTION>> 標籤，前端才會彈出 Approve（審批/套用）按鈕與 Proposal Canvas 工作台！
   - **【嚴禁只在文字中口頭答應或總結，卻遺漏 <<ACTION>> 標籤】**！若無 <<ACTION>>，用戶將無法一鍵批准與儲存！

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
     * 垂直階層 (parent_item_uid): 樹狀父子關係 (Objective > Requirement > User story > Task > UAT)。
     * 水平依賴 (relation_item_uid JSONB): [{item_uid: UUID, relation: 'blocks' | 'covers' | 'deploys' | 'discusses' | 'causes'}]
       - 系統會自動計算雙向關係 (例如 A blocks B -> B is blocked by A)。

4. 團隊成員 (public.member):
   - member_uid (UUID), member_name, member_email, member_ad_group, member_status ('Active')

5. Google OKF v0.2 知識庫 (public.okf_sources, okf_chunks, okf_concepts, okf_links):
   - 知識沉澱分類: Charter (總體目標), Information (技術架構/API), Decision (決策共識), Bottleneck (排錯記錄/瓶頸)

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
- 知識庫文件: ${JSON.stringify(sourcesContext.map(s => s.file_name))}

【🎯 意圖精準識別與 Action 派發法則 (Precise User Intent Routing)】：
🚨 你必須嚴格遵從用戶的【具體要求】，嚴禁自作主張將單一指令擴大為 4-in-1 全套操作！

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

3. 🌲 【場景 C：5 層 Traceability 溯源骨架 (用戶要求「Traceability 骨架」、「拆解需求架構」、「建立溯源樹」)】：
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

1. 批量提案 (用於會議拆解、需求架構拆解、一鍵生成多張工單)：
   <<ACTION>>{"actionType":"batch_proposal","proposalTitle":"<提案標題，如：Kick-off 啟航初始化工單批次>","items":[{"itemTitle":"<標題>","itemType":"Objective"|"Requirement"|"User story"|"Task"|"UAT"|"Bug"|"Decision"|"Information"|"Bottleneck"|"Meeting"|"Milestone"|"Charter","itemPriority":"High"|"Middle"|"Low","itemFollowBy":"<成員姓名或UID>","parentItemUid":"<可選同批父項目標題或代碼如TTG-14>","relationItemUid":[{"item_uid":"<同批關聯項目標題或代碼>","relation":"discusses"|"blocks"|"covers"}],"description":"<必須提供完整結構化的Markdown內文與表格，不可留空！>"}]}<<ACTION>>

2. 單張建立 (用於開一張特定新工單)：
   <<ACTION>>{"actionType":"create_item","itemType":"Objective"|"Requirement"|"User story"|"Task"|"UAT"|"Bug"|"Decision"|"Information"|"Bottleneck"|"Meeting"|"Milestone"|"Charter","itemTitle":"<標題>","parentItemUid":"<可選父工單Code或UID>","relationItemUid":[{"item_uid":"<關聯項目Code或UID>","relation":"discusses"|"blocks"|"covers"}],"itemFollowBy":"<成員姓名或UID>","itemPriority":"High"|"Middle"|"Low","description":"<必須提供完整結構化的Markdown內文與表格，不可留空！>"}<<ACTION>>

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
            temperature: enable_thinking ? 0.6 : 0.3
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
          temperature: enable_thinking ? 0.6 : 0.3
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

    // 乾淨清除內文中的所有 ACTION 標籤標記
    cleanText = cleanText
      .replace(/<<ACTION>>[\s\S]*?<<\/?ACTION>>/gi, '')
      .replace(/ACTION<<[\s\S]*?>>?ACTION<</gi, '')
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
    // 若用戶明確提出填寫/更新指定工單或 Charter，但 actionPreviews 內缺少該工單的 update_item 提案，自動補齊！
    const isFillOrUpdateIntent = /(?:填寫|填入|更新|修改|寫入|格式|template|format|fill|update|charter|表格)/i.test(message)
    const targetItem = (mentionedItems && mentionedItems.length > 0 ? mentionedItems[0] : null) || 
                       (isFillOrUpdateIntent && /charter/i.test(message) && charters && charters.length > 0 ? charters[0] : null)

    if (targetItem && isFillOrUpdateIntent) {
      const alreadyHasUpdate = actionPreviews.some(a => 
        a.actionType === 'update_item' && 
        (a.targetDisplayCode?.toUpperCase() === targetItem.item_display_code?.toUpperCase() || a.targetItemUid === targetItem.item_uid)
      )

      if (!alreadyHasUpdate) {
        let updatedMarkdown = ''
        const tableMatch = cleanText.match(/(\|[\s\S]*?\|[\r\n]+\|[\s\S]*?\|)/)
        if (tableMatch) {
          updatedMarkdown = tableMatch[0].trim()
        } else {
          const rawExisting = extractItemText(targetItem.item_content)
          if (rawExisting && rawExisting.includes('|')) {
            updatedMarkdown = fillTableFromText(rawExisting, cleanText)
          } else if (targetItem.item_type?.toLowerCase() === 'charter' || /charter/i.test(targetItem.item_title || message)) {
            const standardCharterTemplate = `| Field | Description |\n|---|---|\n| Project Title | |\n| Business Sponsor | |\n| Business Owner | |\n| Problem & Opportunity | |\n| Objectives | |\n| Quantifiable Benefits | |\n| Non-quantifiable Benefits | |\n| Strategic Alignment | |\n| Metric | |\n| Baseline | |\n| Target | |\n| In-scope | |\n| Out-of-scope | |\n| Project Team Members | |\n| Stakeholders | |\n| Data Source: IODA | |\n| Data Source: Source System | |\n| Data Source: User Files | |\n| L1&2 Start | |\n| L3 Start | |\n| L4 Start | |\n| L5 Start | |`
            updatedMarkdown = fillTableFromText(standardCharterTemplate, cleanText)
          } else {
            updatedMarkdown = cleanText
          }
        }

        actionPreviews.push({
          actionType: 'update_item',
          targetDisplayCode: targetItem.item_display_code,
          targetItemUid: targetItem.item_uid,
          itemTitle: targetItem.item_title,
          updates: {
            item_content: {
              text: updatedMarkdown,
              description: updatedMarkdown
            }
          },
          summary: `根據指示更新 [${targetItem.item_display_code}]「${targetItem.item_title}」內容與表格`
        })
      }
    }

    const primaryAction = actionPreviews[0] || undefined

    // 確保有 Action 時絕不出現空文字或冷冰冰的預設文字
    if (!cleanText || cleanText.trim() === '') {
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
          cleanText = `已為您完成需求架構拆解提案（共 ${primaryAction.items?.length || 0} 項）。請於右側 Proposal Canvas 工作台逐項審核、就地微調並一鍵套用。`
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
 */
copilotRouter.post('/consensus', async (req: Request, res: Response) => {
  const { workspace_uid, project_uid, title, statement, rationale } = req.body

  if (!workspace_uid || !title || !statement) {
    return res.status(400).json({ error: 'workspace_uid, title, and statement are required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const wsRes = await client.query(
      `UPDATE public.workspace SET last_item_number = last_item_number + 1 WHERE workspace_uid = $1 RETURNING prefix_code, last_item_number`,
      [workspace_uid]
    )
    if (wsRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Workspace not found' })
    }
    const { prefix_code, last_item_number } = wsRes.rows[0]
    const displayCode = `${prefix_code}-${last_item_number}`

    const itemContent = [
      {
        id: `blk_${Date.now()}_1`,
        type: 'paragraph',
        props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
        content: [{ type: 'text', text: `【決策內容 (Consensus Statement)】：${statement}`, styles: {} }]
      },
      {
        id: `blk_${Date.now()}_2`,
        type: 'paragraph',
        props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
        content: [{ type: 'text', text: `【權衡與理由 (Rationale)】：${rationale || '經對話共識定案'}`, styles: {} }]
      }
    ]

    const initialComments = [
      {
        comment_id: `cmt_${Date.now()}`,
        author_name: '🤖 AI Copilot (Consensus)',
        author_email: 'copilot@projectson.local',
        comment_text: `經用戶於 Copilot 對話中明確確認，沉澱為專案決策定案 [${displayCode}]。`,
        created_at: new Date().toISOString()
      }
    ]

    const insertRes = await client.query(
      `INSERT INTO public.item (
        item_display_code,
        prefix_code,
        item_number,
        item_title,
        related_project_uid,
        workspace_uid,
        item_type,
        item_status,
        item_priority,
        item_content,
        item_comment
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Decision', 'Completed', 'High', $7, $8)
      RETURNING *`,
      [
        displayCode,
        prefix_code,
        last_item_number,
        title.trim(),
        project_uid || null,
        workspace_uid,
        JSON.stringify(itemContent),
        JSON.stringify(initialComments)
      ]
    )

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
        project_uid || null,
        title.trim(),
        statement
      ]
    )

    await client.query('COMMIT')
    res.status(201).json({
      message: 'Consensus successfully committed to Knowledge Base and Neon DB',
      item: insertRes.rows[0]
    })
  } catch (err: any) {
    await client.query('ROLLBACK')
    console.error('Commit consensus error:', err)
    res.status(500).json({ error: err.message })
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


