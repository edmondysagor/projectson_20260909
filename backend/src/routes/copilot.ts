import { Router, Request, Response } from 'express'
import { pool } from '../db.js'

export const copilotRouter = Router()

// POST /api/copilot/chat - 真實後端 LLM 對話 + Tool Calling + SQL 即時檢索
copilotRouter.post('/chat', async (req: Request, res: Response) => {
  const { 
    message, 
    workspace_uid, 
    project_uid,
    conversation_history = [] 
  } = req.body

  if (!message || !workspace_uid) {
    return res.status(400).json({ error: 'message and workspace_uid are required' })
  }

  try {
    const apiKey = process.env.DASHSCOPE_API_KEY
    const baseUrl = process.env.DASHSCOPE_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
    const model = process.env.LLM_ROUTER_MODEL || 'qwen3.8-flash'

    // 1. 先從 Neon DB 提取當前專案或工作區的「即時真實數據」作為 Context
    let itemsContext = []
    let sourcesContext = []

    if (project_uid) {
      const itemRes = await pool.query(`
        SELECT 
          item_uid, 
          item_display_code, 
          item_title, 
          item_type, 
          item_status, 
          item_priority, 
          parent_item_uid,
          updated_at
        FROM public.item
        WHERE related_project_uid = $1
        ORDER BY updated_at DESC
        LIMIT 50
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
          item_uid, 
          item_display_code, 
          item_title, 
          item_type, 
          item_status, 
          item_priority
        FROM public.item
        WHERE workspace_uid = $1
        ORDER BY updated_at DESC
        LIMIT 50
      `, [workspace_uid])
      itemsContext = itemRes.rows
    }

    // 2. 構建 System Prompt (注入真實專案數據與工具意圖)
    const systemPrompt = `
你係 Projectson 嘅專業 AI Copilot（具備 Google OKF v0.2 與 Actionable Agent 能力）。
你必須用繁體中文（廣東話口吻或標準書面語）直接回答用戶。

【目前專案即時真實數據 (Ground Truth from Neon DB)】：
- 專案 UID: ${project_uid || '全域工作區'}
- 工單數量: 共 ${itemsContext.length} 張工單
- 工單清單 (依更新時間排序):
${JSON.stringify(itemsContext.map(i => `[${i.item_display_code}] (${i.item_type}) ${i.item_title} | 狀態: ${i.item_status}`), null, 2)}
- 知識庫文件清單:
${JSON.stringify(sourcesContext.map(s => s.file_name), null, 2)}

【回答原則】：
1. 用戶問有幾多個 item、有咩工單、最新狀態係咩時，必須根據上述真實數據【準確作答】，列出具體 Display Code、類型與數量，切勿答非所問！
2. 如果用戶要求開新工單（例如：「開個 Requirement: 支援八達通」），你必須在回答中給予清晰回應，並以 JSON 格式標記你要執行的 actionPreview：
<<ACTION>>{"actionType":"create_item","itemType":"Requirement","itemTitle":"支援八達通"}<<ACTION>>
`

    // 3. 呼叫阿里雲 DashScope Qwen 模型
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation_history.map((h: any) => ({
        role: h.sender === 'user' ? 'user' : 'assistant',
        content: h.text
      })),
      { role: 'user', content: message }
    ]

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.3
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`DashScope API Error: ${errText}`)
    }

    const data: any = await response.json()
    const rawAiText = data.choices?.[0]?.message?.content || '暫時無法獲取回答'

    // 4. 解析 Action Preview
    let actionPreview = undefined
    let cleanText = rawAiText

    const actionMatch = rawAiText.match(/<<ACTION>>(.*?)<<ACTION>>/s)
    if (actionMatch) {
      try {
        actionPreview = JSON.parse(actionMatch[1])
        cleanText = rawAiText.replace(/<<ACTION>>.*?<<ACTION>>/s, '').trim()
      } catch (e) {
        console.error('Failed to parse actionPreview JSON:', e)
      }
    }

    res.json({
      text: cleanText,
      actionPreview: actionPreview,
      items_count: itemsContext.length
    })

  } catch (err: any) {
    console.error('Copilot chat error:', err)
    res.status(500).json({ error: err.message })
  }
})
