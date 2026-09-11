import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { GoogleAuth } from 'google-auth-library'
import { pool, initTestingDB } from './db.js'
import { workspaceRouter } from './routes/workspaces.js'
import { memberRouter } from './routes/members.js'
import { projectRouter } from './routes/projects.js'
import { itemRouter } from './routes/items.js'
import { templateRouter } from './routes/templates.js'
import { sourceRouter } from './routes/sources.js'

dotenv.config()

const app = express()
const port = process.env.PORT || 8080

// Initialize Google Cloud ADC Auth
const auth = new GoogleAuth({
  scopes: 'https://www.googleapis.com/auth/cloud-platform'
})

// Flexible CORS handling for production workers, custom domains, and localhost
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    
    // Check FRONTEND_URL from environment (e.g. custom domain or workers.dev)
    if (process.env.FRONTEND_URL) {
      const target = process.env.FRONTEND_URL.replace(/\/$/, '')
      if (origin === target || origin.startsWith(target)) {
        return callback(null, true)
      }
    }
    
    // Check pattern or local dev ports
    const genericPattern = /^(https:\/\/.*\.workers\.dev|https:\/\/.*\.pages\.dev|http:\/\/localhost:[0-9]+)/
    if (genericPattern.test(origin)) {
      return callback(null, true)
    }

    callback(null, true) // Permissive fallback for seamless testing
  },
  credentials: true
}))

app.use(express.json())

// 業務 API 路由註冊
app.use('/api/workspaces', workspaceRouter)
app.use('/api/members', memberRouter)
app.use('/api/projects', projectRouter)
app.use('/api/items', itemRouter)
app.use('/api/templates', templateRouter)
app.use('/api/sources', sourceRouter)

app.get('/health', async (_req: Request, res: Response) => {
  let dbStatus = 'disconnected'
  let dbTime = null
  let dbError = null

  try {
    const result = await pool.query('SELECT NOW() as db_time')
    dbStatus = 'connected'
    dbTime = result.rows[0].db_time
  } catch (err: any) {
    dbError = err.message
  }

  res.status(200).json({
    status: 'ok',
    app: 'Tai Ping Mun Tech Test API',
    cloudRun: 'online',
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
      time: dbTime,
      error: dbError,
      url: process.env.DATABASE_URL ? `${process.env.DATABASE_URL.split('@')[1] || 'Configured'}` : 'Not set'
    },
    llmProviders: {
      alibabaDashscope: !!process.env.DASHSCOPE_API_KEY,
      ollamaCloud: !!process.env.OLLAMA_API_KEY,
      googleVertexAI: true
    },
    timestamp: new Date().toISOString()
  })
})

app.post('/api/tests', async (req: Request, res: Response) => {
  const { title, category, notes } = req.body
  if (!title) {
    return res.status(400).json({ error: 'Title is required' })
  }
  try {
    const result = await pool.query(
      'INSERT INTO tai_ping_mun_tests (title, category, notes) VALUES ($1, $2, $3) RETURNING *',
      [title, category || 'General', notes || '']
    )
    res.status(201).json(result.rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/tests', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM tai_ping_mun_tests ORDER BY id DESC')
    res.json(result.rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/tests/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { title, category, notes } = req.body
  try {
    const result = await pool.query(
      'UPDATE tai_ping_mun_tests SET title = COALESCE($1, title), category = COALESCE($2, category), notes = COALESCE($3, notes), updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [title, category, notes, id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' })
    }
    res.json(result.rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/tests/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const result = await pool.query('DELETE FROM tai_ping_mun_tests WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' })
    }
    res.json({ message: 'Deleted successfully', id })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/chat', async (req: Request, res: Response) => {
  const { provider, message, model } = req.body
  if (!message) {
    return res.status(400).json({ error: 'Message is required' })
  }

  const selectedProvider = provider || 'alibaba'

  try {
    if (selectedProvider === 'alibaba') {
      const apiKey = process.env.DASHSCOPE_API_KEY
      const baseUrl = process.env.DASHSCOPE_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
      const targetModel = model || process.env.LLM_ROUTER_MODEL || 'qwen3.8-flash'

      const isCompatible = baseUrl.includes('compatible-mode')
      const url = isCompatible
        ? `${baseUrl.replace(/\/$/, '')}/chat/completions`
        : `${baseUrl.replace(/\/$/, '')}/services/aigc/text-generation/generation`

      const payload = isCompatible
        ? {
            model: targetModel,
            messages: [{ role: 'user', content: message }]
          }
        : {
            model: targetModel,
            input: {
              messages: [{ role: 'user', content: message }]
            }
          }

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const rawText = await resp.text()
      let data: any
      try {
        data = JSON.parse(rawText)
      } catch {
        return res.status(resp.status || 500).json({
          error: `Alibaba API returned non-JSON response (HTTP ${resp.status})`,
          raw: rawText.slice(0, 300)
        })
      }

      if (!resp.ok) {
        return res.status(resp.status).json({ 
          error: data.error?.message || data.message || data.code || 'Alibaba API Error', 
          details: data 
        })
      }

      const reply = data.choices?.[0]?.message?.content || data.output?.text || 'No response text'
      const reasoning = data.choices?.[0]?.message?.reasoning_content
      return res.json({
        provider: `Alibaba Cloud DashScope (${targetModel})`,
        model: targetModel,
        reply,
        reasoning
      })
    }

    if (selectedProvider === 'ollama') {
      const apiKey = process.env.OLLAMA_API_KEY
      let baseUrl = (process.env.OLLAMA_BASE_URL || 'https://api.ollama.com').replace(/\/v1\/?$/, '').replace(/\/$/, '')
      const targetModel = model || process.env.OLLAMA_MODEL || 'gemma4:31b-cloud'

      const resp = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: message }],
          stream: false
        })
      })

      const rawText = await resp.text()
      let data: any
      try {
        data = JSON.parse(rawText)
      } catch {
        return res.status(resp.status || 500).json({
          error: `Ollama API returned non-JSON response (HTTP ${resp.status})`,
          raw: rawText.slice(0, 300)
        })
      }

      if (!resp.ok) {
        return res.status(resp.status).json({ error: data.error || 'Ollama API Error', details: data })
      }
      return res.json({
        provider: `Ollama Cloud (${targetModel})`,
        model: targetModel,
        reply: data.message?.content || 'No response text'
      })
    }

    if (selectedProvider === 'google') {
      const targetModel = model || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite'
      const projectId = process.env.GOOGLE_PROJECT_ID || 'certifyai-yes-college'

      // Fetch ADC access token directly (automatic on Cloud Run)
      const client = await auth.getClient()
      const tokenResponse = await client.getAccessToken()
      const accessToken = tokenResponse.token

      // Official Google Agent Platform Global REST Endpoint
      const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${targetModel}:generateContent`
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: message }] }]
        })
      })

      const rawText = await resp.text()
      let data: any
      try {
        data = JSON.parse(rawText)
      } catch {
        return res.status(resp.status || 500).json({
          error: `Google Vertex API returned non-JSON response (HTTP ${resp.status})`,
          raw: rawText.slice(0, 300)
        })
      }

      if (!resp.ok) {
        return res.status(resp.status).json({ error: data.error?.message || 'Google Vertex Error', details: data })
      }

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No content generated'
      return res.json({
        provider: `Google Agent Platform (${targetModel})`,
        model: targetModel,
        reply
      })
    }

    return res.status(400).json({ error: `Unknown provider: ${selectedProvider}` })
  } catch (err: any) {
    console.error('Chat error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.listen(Number(port), '0.0.0.0', async () => {
  console.log(`🚀 Tai Ping Mun Tech Test Server running on http://0.0.0.0:${port}`)
  await initTestingDB()
})
