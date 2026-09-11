import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  Bot, 
  User, 
  CheckCircle2, 
  PlusCircle, 
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
    parentTitle?: string;
    targetUid?: string;
    newStatus?: string;
  };
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  isOpen,
  onClose,
  workspace,
  project,
  items,
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

    // 智能推理與兩步確認模擬 (Tool Calling Logic)
    setTimeout(async () => {
      const lower = userMsgText.toLowerCase();

      // 場景 A：要求開工單 / 建立 Requirement 或 Task
      if (lower.includes('開') || lower.includes('加') || lower.includes('create') || lower.includes('新增')) {
        const itemType = lower.includes('requirement') || lower.includes('需求') ? 'Requirement' :
                         lower.includes('story') || lower.includes('故事') ? 'User story' :
                         lower.includes('decision') || lower.includes('決策') ? 'Decision' : 'Task';
        
        const extractedTitle = userMsgText.replace(/^(幫我|請幫我|加|開個|新增|create)+/gi, '').trim() || '新功能模組開發';

        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: `我為你分析了專案脈絡，準備在目前專案建立以下工單：\n\n📌 **類型**：\`${itemType}\`\n📋 **標題**：**${extractedTitle}**\n\n請確認是否套用至專案？`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionPreview: {
            actionType: 'create_item',
            itemType,
            itemTitle: extractedTitle,
            parentTitle: project ? project.project_name : '根節點'
          }
        };
        setMessages(prev => [...prev, aiResponse]);
      } 
      // 場景 B：詢問最新情況 / 進度對齊 (Proactive Context)
      else if (lower.includes('點') || lower.includes('進度') || lower.includes('最新') || lower.includes('status')) {
        // 查找最近更新的工單
        const sortedItems = [...items].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        const recentItem = sortedItems[0];

        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: recentItem 
            ? `📊 **最新專案情報摘要**：\n\n目前專案共有 **${items.length}** 張工單。\n\n📢 **最近推進動態**：\n工單 **\`[${recentItem.item_display_code}] ${recentItem.item_title}\`** 目前狀態為 **\`${recentItem.item_status}\`**，負責人為 **${recentItem.follow_by_name || '未指派'}**。\n\n需要我幫你推進或調整哪項工作嗎？`
            : `目前專案內尚無工單項目，你可以隨時上傳 PRD 或叫我直接為你規劃！`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, aiResponse]);
      }
      // 場景 C：通用自然語言問答
      else {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: `收到你的指令！我已經根據 **${project?.project_name || '目前專案'}** 的 Google OKF 知識圖譜完成比對。\n\n如果有具體規格需要寫入 Traceability 矩陣，隨時話我知！`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, aiResponse]);
      }

      setIsThinking(false);
    }, 800);
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
          item_type: action.itemType || 'Task',
          item_title: action.itemTitle || '新任務',
          item_status: 'Not Start',
          item_priority: 'Middle'
        });

        await onRefresh();

        setMessages(prev => prev.map(m => m.id === msgId ? {
          ...m,
          text: m.text + `\n\n✅ **已成功建立工單並寫入 Traceability 矩陣！**`,
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
                      <PlusCircle size={13} />
                      即將執行的工單操作 (Action Preview)
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#f8fafc', fontWeight: 500 }}>
                      [{actionPreviewTypeLabel(msg.actionPreview.itemType)}] {msg.actionPreview.itemTitle}
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
