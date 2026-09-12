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
        m.member_name as owner_name
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
          i.updated_at
        FROM public.item i
        LEFT JOIN public.member m ON i.item_follow_by = m.member_uid
        WHERE i.related_project_uid = $1
        ORDER BY i.item_number ASC, i.updated_at DESC
        LIMIT 100
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
          m.member_name as follow_by_name
        FROM public.item i
        LEFT JOIN public.member m ON i.item_follow_by = m.member_uid
        WHERE i.workspace_uid = $1
        ORDER BY i.updated_at DESC
        LIMIT 100
      `, [workspace_uid])
      itemsContext = itemRes.rows
    }

    // 分流統計 5 層 Traceability 階層工單
    const objectives = itemsContext.filter(i => i.item_type?.toLowerCase() === 'objective')
    const requirements = itemsContext.filter(i => i.item_type?.toLowerCase() === 'requirement')
    const stories = itemsContext.filter(i => ['user story', 'story'].includes(i.item_type?.toLowerCase()))
    const tasks = itemsContext.filter(i => i.item_type?.toLowerCase() === 'task')
    const uats = itemsContext.filter(i => i.item_type?.toLowerCase() === 'uat')
    const bugs = itemsContext.filter(i => i.item_type?.toLowerCase() === 'bug')
    const decisions = itemsContext.filter(i => i.item_type?.toLowerCase() === 'decision')
    const infos = itemsContext.filter(i => i.item_type?.toLowerCase() === 'information')
    const bottlenecks = itemsContext.filter(i => i.item_type?.toLowerCase() === 'bottleneck')

    // 2. 構建 System Prompt (Ground Truth DDL + 查詢規則 + Action DSL)
    const thinkingInstruction = enable_thinking ? `
【🧠 深度思考模式 (Thinking Mode: ON)】：
在輸出正式回答前，你必須先將深層推理過程（工單相依性、成員負載、查庫邏輯、架構權衡）完整寫在 <think> 與 </think> 標籤內。
` : ''

    const focusedProjectInfo = currentProject ? `
【🎯 目前聚焦專案 (Current Focused Project)】：
- 專案名稱: ${currentProject.project_name} (代碼: ${currentProject.project_display_code}, UID: ${currentProject.project_uid})
- 專案類型: ${currentProject.project_type} (${currentProject.project_sub_type || 'BAU/Phase'})
- 專案狀態: ${currentProject.project_status}
- 負責人: ${currentProject.owner_name || '未指定'}
- 專案目標 (Objectives, 共 ${objectives.length} 個):
${JSON.stringify(objectives.map(o => ({ code: o.item_display_code, title: o.item_title, status: o.item_status, assignee: o.follow_by_name || '未指派' })), null, 2)}
- 專案需求 (Requirements, 共 ${requirements.length} 個):
${JSON.stringify(requirements.map(r => ({ code: r.item_display_code, title: r.item_title, status: r.item_status, assignee: r.follow_by_name || '未指派' })), null, 2)}
- 專案 User Stories (共 ${stories.length} 個):
${JSON.stringify(stories.map(s => ({ code: s.item_display_code, title: s.item_title, status: s.item_status, assignee: s.follow_by_name || '未指派' })), null, 2)}
- 專案 Tasks (共 ${tasks.length} 個):
${JSON.stringify(tasks.map(t => ({ code: t.item_display_code, title: t.item_title, status: t.item_status, assignee: t.follow_by_name || '未指派' })), null, 2)}
- 專案 UATs (共 ${uats.length} 個): ${JSON.stringify(uats.map(u => ({ code: u.item_display_code, title: u.item_title })))}
- 專案 Bugs (共 ${bugs.length} 個): ${JSON.stringify(bugs.map(b => ({ code: b.item_display_code, title: b.item_title })))}
- 專案 Decisions (共 ${decisions.length} 個): ${JSON.stringify(decisions.map(d => ({ code: d.item_display_code, title: d.item_title })))}
- 專案 Information (共 ${infos.length} 個): ${JSON.stringify(infos.map(info => ({ code: info.item_display_code, title: info.item_title })))}
- 專案 Bottlenecks (共 ${bottlenecks.length} 個): ${JSON.stringify(bottlenecks.map(bt => ({ code: bt.item_display_code, title: bt.item_title })))}
` : `
【全域工作區模式 (Global Workspace Mode)】：
- 目前未聚焦單一專案，顯示整個工作區的概覽數據。
- 專案目標總數: 共 ${objectives.length} 個 Objectives
`

    const systemPrompt = `
你係 Projectson 嘅專業 AI Copilot（具備 Google OKF v0.2、Schema-Aware 查庫能力與 Actionable Agent 能力）。
你必須用繁體中文（廣東話口吻或標準書面語）直接回答用戶。
${thinkingInstruction}

【🗄️ Neon PostgreSQL 完整資料庫 Schema (Ground Truth)】：
1. public.workspace (workspace_uid, prefix_code, workspace_name, last_project_number, last_item_number)
2. public.project (project_uid, project_display_code, project_name, project_type, project_sub_type, project_status, related_workspace_uid, project_owner)
3. public.item (item_uid, item_display_code, prefix_code, item_number, item_title, related_project_uid, workspace_uid, item_type, item_status, item_priority, parent_item_uid, relation_item_uid, item_follow_by, item_content, item_comment)
   - 重要：item_type 原生支援 5 層 Traceability 追溯鏈：
     * Objective (專案業務總目標)
     * Requirement (業務需求)
     * User story (使用者故事)
     * Task (具體任務/開發項目)
     * UAT (驗收測試)
     * 額外多態：Bug (缺陷), Decision (決策), Deployment (部署), Information (資訊), Bottleneck (瓶頸)
4. public.member (member_uid, member_name, member_email, member_ad_group, member_status)
5. public.okf_sources (source_uid, workspace_uid, project_uid, file_name, file_type, page_count, is_active)

【目前所在工作區即時數據 (Preloaded Context)】：
- 當前工作區: ${workspaceInfo.workspace_name} (UID: ${workspace_uid}, Prefix: ${workspaceInfo.prefix_code})
- 該工作區下之專案/產品清單 (共 ${projectsContext.length} 個):
${JSON.stringify(projectsContext.map(p => ({
  code: p.project_display_code,
  name: p.project_name,
  type: p.project_type,
  sub_type: p.project_sub_type,
  status: p.project_status,
  owner: p.owner_name || '未指定'
})), null, 2)}
- 團隊成員清單:
${JSON.stringify(membersContext.map(m => ({ uid: m.member_uid, name: m.member_name, email: m.member_email })), null, 2)}
${focusedProjectInfo}
- 知識庫文件: ${JSON.stringify(sourcesContext.map(s => s.file_name))}

【查庫與回答原則】：
1. 用戶問「本 project 有咩 objective」、「有幾多個 project」、「有咩 task/story」時，必須根據上述即時真實數據【準確作答】，清楚列出編號、標題、狀態與負責人！
2. 若用戶詢問更深層的跨表統計或上述未涵蓋之資料，你可以調用工具（優先使用專屬 Def 工具如 \`get_workspace_overview\` 或 \`search_items\`；若有複雜聚合則調用 \`execute_read_only_sql\`）查 Neon DB 獲取真實資料後再回答。
3. 如果用戶要求拆解專案、規劃多項工單、或進行架構拆分建議：
   你必須在回答結尾附帶 batch_proposal Action JSON 標籤，讓用戶在右側 Proposal Canvas 審核工作台審批：
   <<ACTION>>{"actionType":"batch_proposal","proposalTitle":"<提案標題>","items":[{"itemTitle":"<工單標題>","itemType":"Objective"|"Requirement"|"User story"|"Task"|"Bug"|"Decision"|"Information"|"Bottleneck","itemPriority":"High"|"Middle"|"Low","itemFollowBy":"<可選成員姓名>","parentItemUid":"<可選父工單DisplayCode或UID>","description":"<簡短說明>"}]}<<ACTION>>
4. 如果用戶要求開【單一張】新工單：
   <<ACTION>>{"actionType":"create_item","itemType":"Objective"|"Requirement"|"User story"|"Task"|"Bug"|"Decision"|"Information"|"Bottleneck","itemTitle":"<標題>","parentItemUid":"<可選父工單Code或UID>","itemFollowBy":"<可選成員名>"}<<ACTION>>
5. 如果用戶要求指派任務、更新狀態、修改標題：
   <<ACTION>>{"actionType":"update_item","targetDisplayCode":"<工單Code如TTG-12>","targetItemUid":"<工單UID>","itemTitle":"<工單標題>","updates":{"item_follow_by":"<成員UID或姓名>","item_status":"<新狀態>"},"summary":"指派給 <成員名>"}<<ACTION>>
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
          description: '多條件檢索工單與追溯項目 (支援 Objective, Requirement, User story, Task, Bug, Decision 等)',
          parameters: {
            type: 'object',
            properties: {
              workspace_uid: { type: 'string', description: '工作區 UID' },
              project_uid: { type: 'string', description: '可選專案 UID' },
              item_type: { type: 'string', description: '可選類型 (Objective, Requirement, User story, Task, Bug, Decision, Information, Bottleneck)' },
              item_status: { type: 'string', description: '可選狀態' },
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
          description: '獲取單一工單詳細資料、反向關聯與評論',
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
                SELECT i.item_uid, i.item_display_code, i.item_title, i.item_type, i.item_status, i.item_priority, m.member_name as follow_by_name
                FROM public.item i
                LEFT JOIN public.member m ON i.item_follow_by = m.member_uid
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
                iQuery += ` AND i.item_title ILIKE $${iParams.length}`
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
              toolResult = singleRes.rows[0] || { error: 'Item not found' }
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

    if (!cleanText || cleanText.trim() === '') {
      cleanText = reasoningContent && reasoningContent.trim() !== '' ? reasoningContent : '（已為您檢索專案數據）'
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
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Decision', 'Approved', 'High', $7, $8)
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
        name,
        canonical_name,
        concept_type,
        definition
      ) VALUES ($1, $2, $3, $4, 'decision', $5)`,
      [
        workspace_uid,
        project_uid || null,
        title.trim(),
        title.trim().toLowerCase(),
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

