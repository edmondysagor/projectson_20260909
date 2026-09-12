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
  RefreshCw, 
  Cpu, 
  BrainCircuit,
  Layers,
  ArrowRight
} from 'lucide-react';
import { api } from '../utils/api';
import type { Workspace, Project, ProjectItem, Member } from '../utils/api';
import { ProposalCanvas } from './ProposalCanvas';
import type { ProposedItem } from './ProposalCanvas';

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
  reasoningContent?: string;
  modelUsed?: string;
  timestamp: string;
  actionPreview?: {
    actionType: 'create_item' | 'update_item' | 'batch_proposal';
    itemType?: string;
    itemTitle?: string;
    parentItemUid?: string;
    targetItemUid?: string;
    targetDisplayCode?: string;
    proposalTitle?: string;
    items?: Array<{
      itemTitle: string;
      itemType?: string;
      itemPriority?: string;
      itemFollowBy?: string;
      parentItemUid?: string;
      description?: string;
    }>;
    updates?: {
      item_follow_by?: string;
      item_status?: string;
      item_title?: string;
      item_priority?: string;
    };
    summary?: string;
  };
}

interface ActiveProposalState {
  messageId: string;
  proposalTitle: string;
  items: ProposedItem[];
}

const AVAILABLE_MODELS = [
  { id: 'qwen3.8-flash', label: '⚡ Qwen 3.8 Flash (極速輕量)' },
  { id: 'qwen-plus', label: '🚀 Qwen 2.5 Plus (均衡主力)' },
  { id: 'qwen-max', label: '🧠 Qwen Max (旗艦推演)' },
  { id: 'deepseek-v3', label: '🔮 DeepSeek V3 (通用開源)' },
  { id: 'deepseek-r1', label: '🎯 DeepSeek R1 (深度長推理)' },
];

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
      text: `你好！我是 **Projectson Actionable AI Copilot** 🧠。\n\n我已經自動掌握了 **${project ? project.project_name : (workspace ? workspace.workspace_name : '工作區')}** 的最新動態與工單進度。\n\n你可以隨意同我討論專案架構、切換不同大模型、開啟深度思考模式，或者叫我幫你一鍵拆解/建立/指派工單！`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('qwen3.8-flash');
  const [enableThinking, setEnableThinking] = useState<boolean>(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeProposal, setActiveProposal] = useState<ActiveProposalState | null>(null);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 獲取團隊成員名單以供指派選擇
  useEffect(() => {
    if (isOpen) {
      api.getMembers().then(data => setMembers(data)).catch(err => console.error('Failed to load members:', err));
    }
  }, [isOpen]);

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

    try {
      if (!workspace) {
        throw new Error('請先選擇工作區');
      }

      const res = await api.copilotChat({
        message: userMsgText,
        workspace_uid: workspace.workspace_uid,
        project_uid: project ? project.project_uid : undefined,
        conversation_history: messages.map(m => ({ sender: m.sender, text: m.text })),
        model: selectedModel,
        enable_thinking: enableThinking
      });

      const aiMsgId = (Date.now() + 1).toString();
      const aiResponse: Message = {
        id: aiMsgId,
        sender: 'ai',
        text: res.text,
        reasoningContent: res.reasoning_content,
        modelUsed: res.model_used || selectedModel,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionPreview: res.actionPreview
      };

      setMessages(prev => [...prev, aiResponse]);

      // 若 AI 產生了批量提案 (batch_proposal)，自動啟動右側 Proposal Canvas 工作台
      if (res.actionPreview && res.actionPreview.actionType === 'batch_proposal' && Array.isArray(res.actionPreview.items)) {
        const proposedItems: ProposedItem[] = res.actionPreview.items.map((item: any, idx: number) => ({
          id: `prop_${Date.now()}_${idx}`,
          itemTitle: item.itemTitle || `工單項目 ${idx + 1}`,
          itemType: item.itemType || 'Task',
          itemPriority: (item.itemPriority as any) || 'Middle',
          itemFollowBy: item.itemFollowBy || undefined,
          parentItemUid: item.parentItemUid || undefined,
          description: item.description || undefined,
          approved: true
        }));

        setActiveProposal({
          messageId: aiMsgId,
          proposalTitle: res.actionPreview.proposalTitle || 'AI 拆解規劃提案',
          items: proposedItems
        });
      }
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

  // 執行單一項目 Action Preview
  const handleApplySingleAction = async (msgId: string, action: NonNullable<Message['actionPreview']>) => {
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
          item_follow_by: action.updates?.item_follow_by || undefined,
          parent_item_uid: action.parentItemUid || undefined
        });

        await onRefresh();
        window.dispatchEvent(new CustomEvent('projectson_item_updated', { detail: { type: 'create' } }));

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

  // 執行 Proposal Canvas 批量套用
  const handleApplyBatchProposal = async (selectedItems: ProposedItem[]) => {
    if (!project || !workspace) {
      alert('請先選擇目標專案');
      return;
    }

    setIsSubmittingBatch(true);
    try {
      const payloadItems = selectedItems.map(item => ({
        item_title: item.itemTitle,
        item_type: item.itemType,
        item_priority: item.itemPriority as any,
        item_follow_by: item.itemFollowBy,
        parent_item_uid: item.parentItemUid,
        related_project_uid: project.project_uid,
        audit_remark: `🤖 [AI Copilot 提案批量寫入]：依據提案「${activeProposal?.proposalTitle || '架構規劃'}」經審核批次建立。`
      }));

      const res = await api.batchCreateItems({
        workspace_uid: workspace.workspace_uid,
        related_project_uid: project.project_uid,
        items: payloadItems
      });

      await onRefresh();
      window.dispatchEvent(new CustomEvent('projectson_item_updated', { detail: { type: 'batch_created' } }));

      // 更新訊息狀態
      if (activeProposal) {
        const targetMsgId = activeProposal.messageId;
        setMessages(prev => prev.map(m => m.id === targetMsgId ? {
          ...m,
          text: m.text + `\n\n✅ **已成功批量建立 ${res.items.length} 張工單 (${res.items.map(i => i.item_display_code).join(', ')}) 並寫入 Traceability 矩陣！**`,
          actionPreview: undefined
        } : m));
      }

      setActiveProposal(null);
    } catch (err: any) {
      alert('批次寫入工單失敗: ' + err.message);
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const isDualPanel = Boolean(activeProposal);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: isDualPanel ? '900px' : '420px',
      maxWidth: '96vw',
      backgroundColor: '#090d16',
      borderLeft: '1px solid #1e293b',
      boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.6)',
      display: 'flex',
      flexDirection: 'row',
      zIndex: 9999,
      backdropFilter: 'blur(10px)',
      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      {/* 左面板：AI Copilot 對話主體 */}
      <div style={{
        width: isDualPanel ? '380px' : '100%',
        minWidth: isDualPanel ? '380px' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRight: isDualPanel ? '1px solid #1e293b' : 'none'
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

        {/* AI Model & Thinking Mode 控制列 */}
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#0c101d',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          {/* 模型選擇器 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
            <Cpu size={14} color="#a855f7" />
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: '#131b2e',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f1f5f9',
                padding: '4px 8px',
                fontSize: '0.75rem',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* 深度思考模式開關 */}
          <button
            type="button"
            onClick={() => setEnableThinking(!enableThinking)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              border: enableThinking ? '1px solid #8b5cf6' : '1px solid #334155',
              backgroundColor: enableThinking ? '#2e1065' : '#131b2e',
              color: enableThinking ? '#e9d5ff' : '#94a3b8',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="啟用後 AI 將在輸出回答前進行深層邏輯推演 (Reasoning CoT)"
          >
            <BrainCircuit size={13} color={enableThinking ? '#c084fc' : '#94a3b8'} />
            <span>思考模式</span>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: enableThinking ? '#22c55e' : '#64748b',
              boxShadow: enableThinking ? '0 0 6px #22c55e' : 'none'
            }} />
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
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', maxWidth: '92%' }}>
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
                  {/* 深度思考推理過程摺疊卡片 */}
                  {msg.reasoningContent && (
                    <details style={{
                      marginBottom: '10px',
                      padding: '8px 10px',
                      backgroundColor: '#131127',
                      border: '1px solid #4338ca',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      color: '#cbd5e1'
                    }}>
                      <summary style={{
                        cursor: 'pointer',
                        color: '#a5b4fc',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        userSelect: 'none'
                      }}>
                        🧠 深度思考過程 (Reasoning Process)
                      </summary>
                      <div style={{
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid #2e285a',
                        whiteSpace: 'pre-wrap',
                        color: '#94a3b8',
                        lineHeight: 1.5,
                        fontSize: '0.75rem'
                      }}>
                        {msg.reasoningContent}
                      </div>
                    </details>
                  )}

                  {msg.text}

                  {/* 批量提案預覽卡片 (Batch Proposal) */}
                  {msg.actionPreview && msg.actionPreview.actionType === 'batch_proposal' && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      backgroundColor: '#1e1b4b',
                      border: '1px solid #6366f1',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layers size={14} color="#818cf8" />
                        <span>AI 建議工單拆解提案 ({msg.actionPreview.items?.length || 0} 項)</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#f8fafc', fontWeight: 600 }}>
                        {msg.actionPreview.proposalTitle || '架構規劃拆分提案'}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const proposedItems: ProposedItem[] = (msg.actionPreview?.items || []).map((item: any, idx: number) => ({
                              id: `prop_${Date.now()}_${idx}`,
                              itemTitle: item.itemTitle || `工單項目 ${idx + 1}`,
                              itemType: item.itemType || 'Task',
                              itemPriority: (item.itemPriority as any) || 'Middle',
                              itemFollowBy: item.itemFollowBy || undefined,
                              parentItemUid: item.parentItemUid || undefined,
                              description: item.description || undefined,
                              approved: true
                            }));
                            setActiveProposal({
                              messageId: msg.id,
                              proposalTitle: msg.actionPreview?.proposalTitle || 'AI 拆解規劃提案',
                              items: proposedItems
                            });
                          }}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            backgroundColor: '#4338ca',
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
                          <ArrowRight size={13} />
                          開啟審核工作台 (Review in Canvas)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 單項 Action Preview 預覽卡片 (Human-in-the-loop) */}
                  {msg.actionPreview && msg.actionPreview.actionType !== 'batch_proposal' && (
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
                          onClick={() => handleApplySingleAction(msg.id, msg.actionPreview!)}
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

              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{msg.timestamp}</span>
                {msg.modelUsed && (
                  <span style={{ color: '#475569' }}>• {msg.modelUsed}</span>
                )}
              </div>
            </div>
          ))}

          {isThinking && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a855f7', fontSize: '0.8rem' }}>
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
              <span>{enableThinking ? 'AI 正在進行深度邏輯推演與知識圖譜分析...' : 'AI 正在研讀專案脈絡與即時資料...'}</span>
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
              placeholder="與 AI 討論專案、查詢進度或拆解工單..."
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

      {/* 右面板：Proposal Canvas 審核工作台 (當 activeProposal 存在時展開) */}
      {isDualPanel && activeProposal && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
          <ProposalCanvas
            proposalTitle={activeProposal.proposalTitle}
            items={activeProposal.items}
            members={members}
            onItemChange={(idx, updated) => {
              setActiveProposal(prev => {
                if (!prev) return null;
                const newItems = [...prev.items];
                newItems[idx] = updated;
                return { ...prev, items: newItems };
              });
            }}
            onToggleApprove={(idx) => {
              setActiveProposal(prev => {
                if (!prev) return null;
                const newItems = [...prev.items];
                newItems[idx] = { ...newItems[idx], approved: !newItems[idx].approved };
                return { ...prev, items: newItems };
              });
            }}
            onToggleAll={(approved) => {
              setActiveProposal(prev => {
                if (!prev) return null;
                return {
                  ...prev,
                  items: prev.items.map(item => ({ ...item, approved }))
                };
              });
            }}
            onAddItem={() => {
              setActiveProposal(prev => {
                if (!prev) return null;
                const newItem: ProposedItem = {
                  id: `prop_${Date.now()}_${prev.items.length}`,
                  itemTitle: '自訂新工單',
                  itemType: 'Task',
                  itemPriority: 'Middle',
                  approved: true
                };
                return { ...prev, items: [...prev.items, newItem] };
              });
            }}
            onDeleteItem={(idx) => {
              setActiveProposal(prev => {
                if (!prev) return null;
                const newItems = prev.items.filter((_, i) => i !== idx);
                return { ...prev, items: newItems };
              });
            }}
            onClose={() => setActiveProposal(null)}
            onApply={handleApplyBatchProposal}
            isSubmitting={isSubmittingBatch}
          />
        </div>
      )}
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
