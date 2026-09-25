/**
 * Shared Sub-Agent LLM Client
 * 支援 Ollama Cloud / 本地 Ollama 與 DashScope / OpenAI-compatible API
 * 內建 JSON 提取、修復與超時防護
 */

function safeParseJson<T>(rawStr: string): T | null {
  if (!rawStr) return null
  let cleaned = rawStr.trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()

  // 1. 直接解析
  try {
    return JSON.parse(cleaned) as T
  } catch (_) {}

  // 2. 移除尾隨逗號
  try {
    const noTrailing = cleaned.replace(/,\s*([}\]])/g, '$1')
    return JSON.parse(noTrailing) as T
  } catch (_) {}

  // 3. 搜尋字串中的第一個 JSON 陣列或物件
  try {
    const firstBracket = cleaned.indexOf('[')
    const lastBracket = cleaned.lastIndexOf(']')
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const arraySubstring = cleaned.substring(firstBracket, lastBracket + 1).replace(/,\s*([}\]])/g, '$1')
      return JSON.parse(arraySubstring) as T
    }

    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const objSubstring = cleaned.substring(firstBrace, lastBrace + 1).replace(/,\s*([}\]])/g, '$1')
      return JSON.parse(objSubstring) as T
    }
  } catch (_) {}

  return null
}

export interface SubAgentLlmOptions {
  systemPrompt: string
  userPrompt: string
  model?: string
  temperature?: number
  timeoutMs?: number
}

export async function callSubAgentJson<T>(options: SubAgentLlmOptions): Promise<T | null> {
  const {
    systemPrompt,
    userPrompt,
    model: requestedModel,
    temperature = 0.2,
    timeoutMs = 35000
  } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const model = requestedModel || process.env.LLM_ROUTER_MODEL || 'gemma4:31b-cloud'
    const isOllama = model.startsWith('ollama:') || 
      ['gemma4:31b-cloud', 'gemma4:31b', 'gemma4:latest', 'deepseek-v4.1-flash', 'kimi-k3', 'glm-5.3-flash', 'qwen3.5:397b'].includes(model)

    let rawOutput = ''

    if (isOllama) {
      const targetOllamaModel = model.replace(/^ollama:/, '') || process.env.OLLAMA_MODEL || 'gemma4:31b-cloud'
      const ollamaApiKey = process.env.OLLAMA_API_KEY
      const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || 'https://api.ollama.com').replace(/\/v1\/?$/, '').replace(/\/$/, '') + '/api/chat'

      const response = await fetch(ollamaBaseUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ollamaApiKey}`
        },
        body: JSON.stringify({
          model: targetOllamaModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false,
          format: 'json',
          options: {
            temperature,
            num_predict: 4096
          }
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`SubAgent Ollama API Error (${targetOllamaModel}): ${errText}`)
      }

      const data: any = await response.json()
      rawOutput = data.message?.content || data.response || ''
    } else {
      const apiKey = process.env.DASHSCOPE_API_KEY
      const rawBase = process.env.DASHSCOPE_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
      const baseUrl = rawBase.replace(/\/api\/v1\/?$/, '/compatible-mode/v1').replace(/\/+$/, '')

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature,
          max_tokens: 4096,
          response_format: { type: 'json_object' }
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`SubAgent DashScope API Error (${model}): ${errText}`)
      }

      const data: any = await response.json()
      const choice = data.choices?.[0]
      rawOutput = choice?.message?.content || ''
    }

    return safeParseJson<T>(rawOutput)
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn(`[SubAgent LLM] Timeout aborted after ${timeoutMs}ms`)
    } else {
      console.error(`[SubAgent LLM Error]:`, err)
    }
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}
