import { useState, useEffect } from 'react'
import './App.css'

interface HealthStatus {
  status: string
  app: string
  cloudRun: string
  environment: string
  database: {
    status: string
    time: string | null
    error: string | null
    url: string
  }
  llmProviders: {
    alibabaDashscope: boolean
    ollamaCloud: boolean
    googleGemini: boolean
  }
  timestamp: string
}

interface TestItem {
  id: number
  title: string
  category: string
  notes: string
  created_at: string
  updated_at: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  provider: string
  text: string
  time: string
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'db_test' | 'llm_test'>('overview')
  const [apiUrl, setApiUrl] = useState<string>(
    import.meta.env.VITE_API_URL || 'https://projectson-923554069100.asia-southeast1.run.app'
  )
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loadingHealth, setLoadingHealth] = useState<boolean>(false)
  const [healthError, setHealthError] = useState<string | null>(null)

  // Database CRUD States
  const [items, setItems] = useState<TestItem[]>([])
  const [loadingItems, setLoadingItems] = useState<boolean>(false)
  const [newTitle, setNewTitle] = useState<string>('')
  const [newCategory, setNewCategory] = useState<string>('Cloud Architecture')
  const [newNotes, setNewNotes] = useState<string>('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState<string>('')
  const [editNotes, setEditNotes] = useState<string>('')

  // Multi-LLM Chat States
  const [provider, setProvider] = useState<'alibaba' | 'ollama' | 'google'>('alibaba')
  const [alibabaModel, setAlibabaModel] = useState<string>('qwen3.8-flash')
  const [googleModel, setGoogleModel] = useState<string>('gemini-3.1-flash-lite')
  const [chatInput, setChatInput] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState<boolean>(false)

  // Fetch Health Check on load
  const checkHealth = async () => {
    setLoadingHealth(true)
    setHealthError(null)
    try {
      const res = await fetch(`${apiUrl}/health`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const data = await res.json()
      setHealth(data)
    } catch (err: any) {
      setHealthError(err.message || 'Cannot reach Google Cloud Run API')
    } finally {
      setLoadingHealth(false)
    }
  }

  useEffect(() => {
    checkHealth()
  }, [apiUrl])

  // Fetch Items for DB CRUD
  const fetchItems = async () => {
    setLoadingItems(true)
    try {
      const res = await fetch(`${apiUrl}/api/tests`)
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingItems(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'db_test') {
      fetchItems()
    }
  }, [activeTab, apiUrl])

  // Create Item
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      const res = await fetch(`${apiUrl}/api/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          category: newCategory,
          notes: newNotes
        })
      })
      if (res.ok) {
        setNewTitle('')
        setNewNotes('')
        fetchItems()
      }
    } catch (err) {
      alert('Error creating item: ' + err)
    }
  }

  // Update Item
  const handleUpdate = async (id: number) => {
    try {
      const res = await fetch(`${apiUrl}/api/tests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          notes: editNotes
        })
      })
      if (res.ok) {
        setEditingId(null)
        fetchItems()
      }
    } catch (err) {
      alert('Error updating item: ' + err)
    }
  }

  // Delete Item
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this record?')) return
    try {
      const res = await fetch(`${apiUrl}/api/tests/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchItems()
      }
    } catch (err) {
      alert('Error deleting item: ' + err)
    }
  }

  // Send LLM Chat
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading) return

    const userText = chatInput.trim()
    setChatInput('')

    const newMsgList: ChatMessage[] = [
      ...messages,
      { role: 'user', provider: 'User', text: userText, time: new Date().toLocaleTimeString() }
    ]
    setMessages(newMsgList)
    setChatLoading(true)

    try {
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: provider === 'google' ? googleModel : (provider === 'alibaba' ? alibabaModel : undefined),
          message: userText
        })
      })
      const text = await res.text()
      let data: any
      try {
        data = JSON.parse(text)
      } catch {
        data = { error: `伺服器未返回 JSON (HTTP ${res.status}): ${text.slice(0, 150)}` }
      }

      if (res.ok && data.reply) {
        setMessages([
          ...newMsgList,
          {
            role: 'assistant',
            provider: `${data.provider} (${data.model})`,
            text: data.reasoning ? `💭 推理思考：\n${data.reasoning}\n\n💬 回覆：\n${data.reply}` : data.reply,
            time: new Date().toLocaleTimeString()
          }
        ])
      } else {
        setMessages([
          ...newMsgList,
          {
            role: 'assistant',
            provider: `${provider.toUpperCase()} (Error)`,
            text: `❌ Error: ${data.error || 'Failed to fetch response'}\n${data.hint ? `💡 Note: ${data.hint}` : ''}`,
            time: new Date().toLocaleTimeString()
          }
        ])
      }
    } catch (err: any) {
      setMessages([
        ...newMsgList,
        {
          role: 'assistant',
          provider: 'System',
          text: `❌ Connection error: ${err.message}`,
          time: new Date().toLocaleTimeString()
        }
      ])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div style={{
      maxWidth: '1000px',
      margin: '24px auto',
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      color: '#0f172a',
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.08)'
    }}>
      {/* App Header */}
      <header style={{
        borderBottom: '2px solid #e2e8f0',
        paddingBottom: '20px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚡ Tai Ping Mun Tech
          </h1>
          <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '0.95rem' }}>
            Cloud Native Integration Test App (Cloudflare Pages + Google Cloud Run + Neon DB)
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '0.85rem',
            padding: '6px 12px',
            borderRadius: '20px',
            backgroundColor: health?.database.status === 'connected' ? '#dcfce7' : '#fee2e2',
            color: health?.database.status === 'connected' ? '#166534' : '#991b1b',
            fontWeight: 600
          }}>
            {health?.database.status === 'connected' ? '● System Online & Linked' : '○ System Checking...'}
          </span>
        </div>
      </header>

      {/* Target API Setting Bar */}
      <div style={{
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        padding: '12px 16px',
        borderRadius: '10px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <strong style={{ fontSize: '0.9rem', color: '#334155' }}>Target Cloud Run API:</strong>
        <input
          type="text"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          style={{
            flex: 1,
            minWidth: '280px',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            fontSize: '0.9rem'
          }}
        />
        <button
          onClick={checkHealth}
          disabled={loadingHealth}
          style={{
            padding: '8px 16px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {loadingHealth ? 'Testing...' : 'Test Connection'}
        </button>
      </div>

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'overview' ? '#1e40af' : '#f1f5f9',
            color: activeTab === 'overview' ? '#ffffff' : '#475569'
          }}
        >
          📊 服務連線總覽 (Services Overview)
        </button>
        <button
          onClick={() => setActiveTab('db_test')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'db_test' ? '#1e40af' : '#f1f5f9',
            color: activeTab === 'db_test' ? '#ffffff' : '#475569'
          }}
        >
          💾 Neon DB CRUD 測試
        </button>
        <button
          onClick={() => setActiveTab('llm_test')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'llm_test' ? '#1e40af' : '#f1f5f9',
            color: activeTab === 'llm_test' ? '#ffffff' : '#475569'
          }}
        >
          🤖 多模型 LLM 測試 (Gemini / Qwen / Gemma)
        </button>
      </nav>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '16px', color: '#1e293b' }}>
            雲端三件套架構連線狀態 (Connection Health)
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Cloudflare Pages */}
            <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#f97316' }}>🌐 Cloudflare Pages (Frontend)</h3>
              <p style={{ margin: '4px 0', fontSize: '0.9rem', color: '#475569' }}>
                <strong>Host:</strong> {window.location.origin}
              </p>
              <p style={{ margin: '4px 0', fontSize: '0.9rem', color: '#16a34a' }}>
                <strong>狀態:</strong> 運行中 (Healthy SPA)
              </p>
            </div>

            {/* Google Cloud Run */}
            <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#2563eb' }}>🚀 Google Cloud Run (Backend)</h3>
              {healthError ? (
                <p style={{ color: '#dc2626', fontSize: '0.9rem' }}>❌ 連線失敗: {healthError}</p>
              ) : health ? (
                <>
                  <p style={{ margin: '4px 0', fontSize: '0.9rem', color: '#475569' }}>
                    <strong>服務:</strong> {health.app}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '0.9rem', color: '#16a34a' }}>
                    <strong>狀態:</strong> {health.cloudRun} (環境: {health.environment})
                  </p>
                </>
              ) : (
                <p style={{ color: '#64748b' }}>正在測試連線...</p>
              )}
            </div>

            {/* Neon Serverless DB */}
            <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#059669' }}>🐘 Neon PostgreSQL (Database)</h3>
              {health?.database.status === 'connected' ? (
                <>
                  <p style={{ margin: '4px 0', fontSize: '0.9rem', color: '#16a34a' }}>
                    <strong>狀態:</strong> 連接成功 (Connected)
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#64748b' }}>
                    <strong>DB 時間:</strong> {new Date(health.database.time || '').toLocaleString()}
                  </p>
                </>
              ) : (
                <p style={{ color: '#dc2626', fontSize: '0.9rem' }}>
                  ❌ 未能連接: {health?.database.error || '檢查 DATABASE_URL 配置'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NEON DB CRUD */}
      {activeTab === 'db_test' && (
        <div>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '16px', color: '#1e293b' }}>
            Neon DB CRUD 實時測試表 (Table: tai_ping_mun_tests)
          </h2>

          {/* Form Create */}
          <form onSubmit={handleCreate} style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            padding: '16px',
            borderRadius: '10px',
            marginBottom: '24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>測試標題 (Title):</label>
              <input
                type="text"
                placeholder="例如: Cloudflare Pages 延遲測試"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>分類 (Category):</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              >
                <option value="Cloud Architecture">Cloud Architecture</option>
                <option value="API Performance">API Performance</option>
                <option value="Database Query">Database Query</option>
                <option value="LLM Quality">LLM Quality</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>備註 (Notes):</label>
              <textarea
                placeholder="測試備註詳情..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <button
                type="submit"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ➕ 新增測試記錄 (Create)
              </button>
            </div>
          </form>

          {/* List Table */}
          {loadingItems ? (
            <p style={{ color: '#64748b' }}>正在讀取 Neon 資料庫資料...</p>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
              資料庫目前未有測試記錄，請使用上方表格新增第一筆資料！
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '10px' }}>ID</th>
                    <th style={{ padding: '10px' }}>標題 (Title)</th>
                    <th style={{ padding: '10px' }}>分類 (Category)</th>
                    <th style={{ padding: '10px' }}>備註 (Notes)</th>
                    <th style={{ padding: '10px' }}>時間 (Created)</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>操作 (Actions)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px' }}>#{item.id}</td>
                      <td style={{ padding: '10px' }}>
                        {editingId === item.id ? (
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            style={{ padding: '4px', width: '100%' }}
                          />
                        ) : (
                          <strong>{item.title}</strong>
                        )}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                          {item.category}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        {editingId === item.id ? (
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            style={{ padding: '4px', width: '100%' }}
                          />
                        ) : (
                          item.notes || '-'
                        )}
                      </td>
                      <td style={{ padding: '10px', fontSize: '0.8rem', color: '#64748b' }}>
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        {editingId === item.id ? (
                          <>
                            <button
                              onClick={() => handleUpdate(item.id)}
                              style={{ padding: '4px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', marginRight: '4px', cursor: 'pointer' }}
                            >
                              儲存
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              style={{ padding: '4px 8px', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingId(item.id)
                                setEditTitle(item.title)
                                setEditNotes(item.notes)
                              }}
                              style={{ padding: '4px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', marginRight: '6px', cursor: 'pointer' }}
                            >
                              ✏️ 修改
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              style={{ padding: '4px 8px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              🗑️ 刪除
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MULTI-LLM CHAT */}
      {activeTab === 'llm_test' && (
        <div>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '8px', color: '#1e293b' }}>
            🤖 多平台 LLM 模型測試 Chat Box
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>
            自由切換 Alibaba Cloud DashScope (Qwen), Ollama Cloud (Gemma), 與 Google Agent Platform (Gemini)。
          </p>

          {/* Provider Selector */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: provider === 'alibaba' ? '#eff6ff' : '#ffffff',
              cursor: 'pointer'
            }}>
              <input
                type="radio"
                name="provider"
                value="alibaba"
                checked={provider === 'alibaba'}
                onChange={() => setProvider('alibaba')}
              />
              <span style={{ fontWeight: 600, color: '#1d4ed8' }}>Alibaba Cloud (Qwen-Turbo)</span>
            </label>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: provider === 'ollama' ? '#f0fdf4' : '#ffffff',
              cursor: 'pointer'
            }}>
              <input
                type="radio"
                name="provider"
                value="ollama"
                checked={provider === 'ollama'}
                onChange={() => setProvider('ollama')}
              />
              <span style={{ fontWeight: 600, color: '#15803d' }}>Ollama Cloud (Gemma-4)</span>
            </label>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: provider === 'google' ? '#fef2f2' : '#ffffff',
              cursor: 'pointer'
            }}>
              <input
                type="radio"
                name="provider"
                value="google"
                checked={provider === 'google'}
                onChange={() => setProvider('google')}
              />
              <span style={{ fontWeight: 600, color: '#b91c1c' }}>Google Agent Platform (Gemini)</span>
            </label>
          </div>

          {provider === 'alibaba' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '14px', background: '#eff6ff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e40af' }}>Alibaba 模型:</span>
              {[
                { id: 'qwen3.8-flash', label: '⚡ qwen3.8-flash (極速+推理)' },
                { id: 'qwen3.8-max', label: '🧠 qwen3.8-max (旗艦推理)' },
                { id: 'qwen3.7-plus', label: '✨ qwen3.7-plus (進階通用)' },
                { id: 'qwen3.7-max', label: '👑 qwen3.7-max (高階旗艦)' },
                { id: 'qwen-turbo', label: '🚀 qwen-turbo (經典輕量)' },
                { id: 'qwen-plus', label: '🌐 qwen-plus (經典通用)' }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setAlibabaModel(m.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: alibabaModel === m.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: alibabaModel === m.id ? '#dbeafe' : '#ffffff',
                    color: alibabaModel === m.id ? '#1d4ed8' : '#475569'
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {provider === 'google' && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px', background: '#fff1f2', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fecdd3' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#9f1239' }}>Gemini 模型:</span>
              <button
                type="button"
                onClick={() => setGoogleModel('gemini-3.1-flash-lite')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: googleModel === 'gemini-3.1-flash-lite' ? '2px solid #e11d48' : '1px solid #cbd5e1',
                  background: googleModel === 'gemini-3.1-flash-lite' ? '#ffe4e6' : '#ffffff',
                  color: googleModel === 'gemini-3.1-flash-lite' ? '#be123c' : '#64748b'
                }}
              >
                ⚡ Gemini 3.1 Flash-Lite (極速)
              </button>
              <button
                type="button"
                onClick={() => setGoogleModel('gemini-3.8-flash')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: googleModel === 'gemini-3.8-flash' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                  background: googleModel === 'gemini-3.8-flash' ? '#f5f3ff' : '#ffffff',
                  color: googleModel === 'gemini-3.8-flash' ? '#6d28d9' : '#64748b'
                }}
              >
                🧠 Gemini 3.8 Flash (強推理)
              </button>
            </div>
          )}

          {/* Chat Window */}
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            height: '380px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#fafafa'
          }}>
            <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '120px' }}>
                  💬 選擇一個 LLM 提供商，輸入訊息開始測試！
                </div>
              ) : (
                messages.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      backgroundColor: m.role === 'user' ? '#2563eb' : '#ffffff',
                      color: m.role === 'user' ? '#ffffff' : '#1e293b',
                      border: m.role === 'user' ? 'none' : '1px solid #e2e8f0',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', marginBottom: '6px', opacity: 0.8, textAlign: 'left' }}>
                      {m.provider} • {m.time}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, textAlign: 'left' }}>
                      {m.text}
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div style={{ alignSelf: 'flex-start', padding: '10px 14px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                  ⏳ 正在生成回覆中，請稍候...
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} style={{ display: 'flex', borderTop: '1px solid #e2e8f0', background: '#ffffff', padding: '8px' }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={`問問 ${provider === 'alibaba' ? 'Qwen' : provider === 'ollama' ? 'Gemma' : 'Gemini'} 一些問題...`}
                disabled={chatLoading}
                style={{ flex: 1, padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem' }}
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  marginLeft: '8px',
                  padding: '10px 20px',
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: chatLoading ? 'not-allowed' : 'pointer'
                }}
              >
                發送
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ marginTop: '32px', textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8' }}>
        Tai Ping Mun Tech © {new Date().getFullYear()} • Integration Diagnostic Test Suite
      </footer>
    </div>
  )
}
