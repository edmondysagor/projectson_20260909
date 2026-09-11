import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  Bot, 
  User, 
  CheckCircle2, 
  PlusCircle, 
  Edit3,
  RefreshCw
} from 'lucide-react';
import { api } from '../utils/api';
import type { Workspace, Project, ProjectItem } from '../utils/api';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace | null;
  project: Project | null;
  items: ProjectItem[];
  onRefresh: () => Promise<void>;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  actionPreview?: {
    actionType: 'create_item' | 'update_item';
    itemType?: string;
    itemTitle?: string;
    parentItemUid?: string;
    targetItemUid?: string;
    targetDisplayCode?: string;
    updates?: {
      item_follow_by?: string;
      item_status?: string;
      item_title?: string;
      item_priority?: string;
    };
    summary?: string;
  };
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  isOpen,
  onClose,
  workspace,
  project,
  items: _items,
  onRefresh
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: `你好！我是 **Projectson Actionable AI Copilot** 🧠。\n\n我已經自動掌握了 **${project ? project.project_name : (workspace ? workspace.workspace_name : '工作區')}** 的最新動態與工單進度。\n\n你可以隨意同我討論專案架構、詢問最新進展、或者叫我幫你一鍵建立工單（例如：「*喺 TTG-2 下面開個 Requirement*」）！`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  if (!isOpen) return null;

  const handleSendMessage = async () => {
    if (!inputText.trim() || isThinking) return;

    const userMsgText = inputText.trim();
    const newMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setIsThinking(true);

    // 呼叫真實後端 Qwen 大模型 + Neon DB Ground Truth
    try {
      if (!workspace) {
        throw new Error('請先選擇工作區');
      }

      const res = await api.copilotChat({
        message: userMsgText,
        workspace_uid: workspace.workspace_uid,
        project_uid: project ? project.project_uid : undefined,
        conversation_history: messages.map(m => ({ sender: m.sender, text: m.text }))
      });

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: res.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionPreview: res.actionPreview
      };

      setMessages(prev => [...prev, aiResponse]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `抱歉，處理對話時發生錯誤: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  // 執行 Action Preview (Human-in-the-loop 套用)
  const handleApplyAction = async (msgId: string, action: NonNullable<Message['actionPreview']>) => {
    if (!project || !workspace) {
      alert('請先選擇目標專案');
      return;
    }

    try {
      if (action.actionType === 'create_item') {
        await api.createItem({
          workspace_uid: workspace.workspace_uid,
          related_project_uid: project.project_uid,
          item_type: (action.itemType as any) || 'Task',
          item_title: action.itemTitle || '新任務',
          item_status: 'Not Start',
          item_priority: 'Middle',
          parent_item_uid: action.parentItemUid || undefined
        });

        await onRefresh();

        setMessages(prev => prev.map(m => m.id === msgId ? {
          ...m,
          text: m.text + `\n\n✅ **已成功建立工單並寫入 Traceability 矩陣！**`,
          actionPreview: undefined
        } : m));
      } else if (action.actionType === 'update_item') {
        const targetKey = action.targetDisplayCode || action.targetItemUid;
        if (!targetKey) {
          throw new Error('未指定目標工單編號或 UID');
        }

        await api.patchItem(targetKey, (action.updates || {}) as Partial<ProjectItem>);

        await onRefresh();
        window.dispatchEvent(new CustomEvent('projectson_item_updated', { detail: { targetKey } }));

        const summaryText = action.summary ? ` (${action.summary})` : '';
        setMessages(prev => prev.map(m => m.id === msgId ? {
          ...m,
          text: m.text + `\n\n✅ **已成功更新工單 [${action.targetDisplayCode || targetKey}]${summaryText}！**`,
          actionPreview: undefined
        } : m));
      }
    } catch (err: any) {
      alert('執行操作失敗: ' + err.message);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: '420px',
      maxWidth: '90vw',
      backgroundColor: '#090d16',
      borderLeft: '1px solid #1e293b',
      boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.6)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      backdropFilter: 'blur(10px)'
    }}>
      {/* 頂部 Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0f172a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#581c87',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(168, 85, 247, 0.5)'
          }}>
            <Sparkles size={18} color="#f3e8ff" />
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Projectson Copilot
              <span style={{ fontSize: '0.65rem', backgroundColor: '#064e3b', color: '#6ee7b7', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                OKF v0.2
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {project ? `正在聚焦: ${project.project_name}` : '全域工作區模式'}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* 訊息滾動對話區 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', maxWidth: '88%' }}>
              {msg.sender === 'ai' && (
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#581c87', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  <Bot size={14} color="#fff" />
                </div>
              )}

              <div style={{
                backgroundColor: msg.sender === 'user' ? '#3b82f6' : '#0f172a',
                color: '#f8fafc',
                padding: '10px 14px',
                borderRadius: msg.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                fontSize: '0.85rem',
                lineHeight: 1.5,
                border: msg.sender === 'ai' ? '1px solid #1e293b' : 'none',
                whiteSpace: 'pre-wrap',
                boxShadow: msg.sender === 'user' ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none'
              }}>
                {msg.text}

                {/* Action Preview 預覽卡片 (Human-in-the-loop) */}
                {msg.actionPreview && (
                  <div style={{
                    marginTop: '10px',
                    padding: '10px 12px',
                    backgroundColor: '#1e1b4b',
                    border: '1px solid #7e22ce',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {msg.actionPreview.actionType === 'create_item' ? <PlusCircle size={13} /> : <Edit3 size={13} />}
                      {msg.actionPreview.actionType === 'create_item' ? '即將建立新工單 (Action Preview)' : '即將更新工單 (Action Preview)'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#f8fafc', fontWeight: 500 }}>
                      {msg.actionPreview.actionType === 'create_item' ? (
                        <>
                          <span style={{ color: '#93c5fd' }}>[{actionPreviewTypeLabel(msg.actionPreview.itemType)}]</span> {msg.actionPreview.itemTitle}
                        </>
                      ) : (
                        <>
                          <span style={{ color: '#a7f3d0' }}>[{msg.actionPreview.targetDisplayCode || '工單'}]</span> {msg.actionPreview.itemTitle ? `${msg.actionPreview.itemTitle} ➔ ` : ''}
                          <span style={{ color: '#fde047', fontWeight: 600 }}>{msg.actionPreview.summary || '更新屬性'}</span>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        onClick={() => handleApplyAction(msg.id, msg.actionPreview!)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          backgroundColor: '#16a34a',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <CheckCircle2 size={13} />
                        一鍵套用至專案 (Apply)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  <User size={14} color="#93c5fd" />
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px', padding: '0 4px' }}>
              {msg.timestamp}
            </div>
          </div>
        ))}

        {isThinking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a855f7', fontSize: '0.8rem' }}>
            <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
            <span>AI 正在研讀專案脈絡與知識圖譜...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 底部輸入框 */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid #1e293b',
        backgroundColor: '#0f172a'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#090d16',
          border: '1px solid #334155',
          borderRadius: '10px',
          padding: '6px 10px',
          gap: '8px'
        }}>
          <textarea
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="與 AI 討論專案、查詢進度或建立工單..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '0.85rem',
              resize: 'none',
              fontFamily: 'inherit'
            }}
          />

          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isThinking}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: inputText.trim() && !isThinking ? '#7e22ce' : '#334155',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: inputText.trim() && !isThinking ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s ease'
            }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

function actionPreviewTypeLabel(type?: string) {
  switch (type) {
    case 'Requirement': return '📋 需求';
    case 'User story': return '📖 Story';
    case 'Decision': return '💡 決策';
    default: return '⚡ 任務';
  }
}
