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
- 階層總覽統計:
  * Objectives: ${objectives.length} 個 | Requirements: ${requirements.length} 個 | User Stories: ${stories.length} 個 | Tasks: ${tasks.length} 個 | UATs: ${uats.length} 個
  * Bugs: ${bugs.length} 個 | Decisions: ${decisions.length} 個 | Bottlenecks: ${bottlenecks.length} 個 | Information: ${infos.length} 個
- 專案目標 (Objectives):
${JSON.stringify(objectives.map(o => ({ code: o.item_display_code, title: o.item_title, status: o.item_status, assignee: o.follow_by_name || '未指派' })), null, 2)}
- 專案需求 (Requirements):
${JSON.stringify(requirements.map(r => ({ code: r.item_display_code, title: r.item_title, status: r.item_status, parent: r.parent_code || '無', assignee: r.follow_by_name || '未指派' })), null, 2)}
- 專案 User Stories:
${JSON.stringify(stories.map(s => ({ code: s.item_display_code, title: s.item_title, status: s.item_status, parent: s.parent_code || '無', assignee: s.follow_by_name || '未指派' })), null, 2)}
- 專案 Tasks:
${JSON.stringify(tasks.map(t => ({ code: t.item_display_code, title: t.item_title, status: t.item_status, parent: t.parent_code || '無', assignee: t.follow_by_name || '未指派' })), null, 2)}
- 專案 UATs: ${JSON.stringify(uats.map(u => ({ code: u.item_display_code, title: u.item_title, status: u.item_status })))}
- 專案 Bugs: ${JSON.stringify(bugs.map(b => ({ code: b.item_display_code, title: b.item_title, status: b.item_status })))}
- 專案 Decisions: ${JSON.stringify(decisions.map(d => ({ code: d.item_display_code, title: d.item_title })))}
- 專案 Information: ${JSON.stringify(infos.map(info => ({ code: info.item_display_code, title: info.item_title })))}
- 專案 Bottlenecks: ${JSON.stringify(bottlenecks.map(bt => ({ code: bt.item_display_code, title: bt.item_title })))}
` : `
【全域工作區模式 (Global Workspace Mode)】：
- 目前未聚焦單一專案，顯示整個工作區的概覽數據。
- 整個工作區已載入 ${itemsContext.length} 個工單概覽。
`

    const systemPrompt = `
你係 Projectson 嘅專業 AI Copilot（具備 Google OKF v0.2、Neon PostgreSQL 完整資料庫 Schema 與 Actionable Agent 能力）。
你必須用繁體中文（廣東話口吻或標準書面語）直接回答用戶。
${thinkingInstruction}

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

【Action 標籤格式規範 (必須嚴格遵從 Schema 枚舉)】：
1. 批量提案 (用於需求拆解、一鍵生成多張工單)：
   <<ACTION>>{"actionType":"batch_proposal","proposalTitle":"<提案標題>","items":[{"itemTitle":"<標題>","itemType":"Objective"|"Requirement"|"User story"|"Task"|"Bug"|"Decision"|"Information"|"Bottleneck","itemPriority":"High"|"Middle"|"Low","itemFollowBy":"<成員姓名或UID>","parentItemUid":"<可選父工單Code如TTG-14或UID>","description":"<簡短說明>"}]}<<ACTION>>

2. 單張建立 (用於開一張特定新工單)：
   <<ACTION>>{"actionType":"create_item","itemType":"Objective"|"Requirement"|"User story"|"Task"|"Bug"|"Decision"|"Information"|"Bottleneck","itemTitle":"<標題>","parentItemUid":"<可選父工單Code或UID>","itemFollowBy":"<成員姓名或UID>","itemPriority":"High"|"Middle"|"Low"}<<ACTION>>

3. 單張更新 (用於指派人員、更新狀態、修改標題或解除關聯)：
   <<ACTION>>{"actionType":"update_item","targetDisplayCode":"<工單Code如TTG-12>","targetItemUid":"<工單UID>","itemTitle":"<工單標題>","updates":{"item_follow_by":"<成員UID或姓名>","item_status":"Not Start"|"Ready"|"In Progress"|"Blocked"|"Review"|"Completed"|"Closed"|"Backlog"},"summary":"說明"}<<ACTION>>
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

    // 4. 多輪 Tool Calling 執行循環
    let messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversation_history.map((h: any) => ({
        role: h.sender === 'user' ? 'user' : 'assistant',
        content: h.text
      })),
      { role: 'user', content: message }
    ]

    let finalAiText = ''
    let iterations = 0
    const maxIterations = 3

    while (iterations < maxIterations) {
      iterations++

      const requestBody: any = {
        model: model,
        messages: messages,
        temperature: enable_thinking ? 0.6 : 0.3
      }

      if (!model.includes('deepseek-r1') && iterations === 1) {
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

    // 5. 解析 Thinking Mode 思維鏈與 Action Preview
    let reasoningContent: string | undefined = undefined
    let actionPreview: any = undefined
    let cleanText = finalAiText

    const thinkMatch = cleanText.match(/<think>(.*?)<\/think>/s)
    if (thinkMatch) {
      reasoningContent = thinkMatch[1].trim()
      cleanText = cleanText.replace(/<think>.*?<\/think>/s, '').trim()
    }

    const actionRegexList = [
      /<<ACTION>>\s*(\{[\s\S]*?\})\s*<<\/?ACTION>>/i,
      /ACTION<<\s*(\{[\s\S]*?\})\s*>>?ACTION<</i,
      /<<ACTION>>\s*(\{[\s\S]*?\})\s*$/i,
      /```json\s*(\{[\s\S]*?"actionType"[\s\S]*?\})\s*```/i,
      /(\{\s*"actionType"\s*:\s*"(?:create_item|update_item|batch_proposal|consensus_proposal)"[\s\S]*?\})/i
    ]

    for (const regex of actionRegexList) {
      const match = cleanText.match(regex)
      if (match) {
        try {
          const rawJsonStr = match[1].trim()
          actionPreview = JSON.parse(rawJsonStr)
          cleanText = cleanText.replace(match[0], '').trim()
          break
        } catch (e) {
          console.error('Failed to parse matched action JSON:', e)
        }
      }
    }

    cleanText = cleanText
      .replace(/<<ACTION>>[\s\S]*?<<\/?ACTION>>/gi, '')
      .replace(/ACTION<<[\s\S]*?>>?ACTION<</gi, '')
      .trim()

    // 確保有 Action 時絕不出現空文字或冷冰冰的預設文字
    if (!cleanText || cleanText.trim() === '') {
      if (actionPreview) {
        if (actionPreview.actionType === 'update_item') {
          const isClosed = actionPreview.updates?.item_status === 'Closed'
          const code = actionPreview.targetDisplayCode || '目標工單'
          cleanText = isClosed
            ? `我查證確認，為遵守專案審計與追溯規範，已為您將 **[${code}]** 的狀態提議設定為 **Closed（已作廢）**。請於右側展開之 Proposal Canvas 工作台審批確認。`
            : `已為您準備工單 **[${code}]** 的更新提案（${actionPreview.summary || '更新屬性'}），請於右側 Proposal Canvas 工作台核准套用。`
        } else if (actionPreview.actionType === 'create_item') {
          cleanText = `已為您準備建立新工單 **[${actionPreview.itemType || 'Task'}]**「${actionPreview.itemTitle}」，請於右側 Proposal Canvas 工作台核准建立。`
        } else if (actionPreview.actionType === 'batch_proposal') {
          cleanText = `已為您完成需求架構拆解提案（共 ${actionPreview.items?.length || 0} 項）。請於右側 Proposal Canvas 工作台逐項審核、就地微調並一鍵套用。`
        } else if (actionPreview.actionType === 'consensus_proposal') {
          cleanText = `已為您提煉對話決策共識「${actionPreview.itemTitle || '專案架構決策'}」，請於右側 Proposal Canvas 審核並一鍵沉澱至 OKF 專案知識庫。`
        }
      } else if (reasoningContent && reasoningContent.trim() !== '') {
        cleanText = reasoningContent
      } else {
        cleanText = '已為您檢索並處理專案數據。'
      }
    }

    res.json({
      text: cleanText,
      reasoning_content: reasoningContent,
      actionPreview: actionPreview,
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

