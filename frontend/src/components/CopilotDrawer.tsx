import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  Bot, 
  User, 
  RefreshCw, 
  Cpu, 
  BrainCircuit,
  ArrowRight,
  Layers,
  Edit3,
  PlusCircle,
  BookmarkCheck
} from 'lucide-react';
import { api } from '../utils/api';
import type { Workspace, Project, ProjectItem, Member } from '../utils/api';
import { ProposalCanvas } from './ProposalCanvas';
import type { ProposedItem, UpdateDiffPayload, ConsensusPayload } from './ProposalCanvas';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    actionType: 'create_item' | 'update_item' | 'batch_proposal' | 'consensus_proposal';
    itemType?: string;
    itemTitle?: string;
    itemPriority?: string;
    itemFollowBy?: string;
    parentItemUid?: string;
    targetItemUid?: string;
    targetDisplayCode?: string;
    proposalTitle?: string;
    statement?: string;
    rationale?: string;
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
      item_planned_start_date?: string;
      item_planned_end_date?: string;
      parent_item_uid?: string;
    };
    summary?: string;
  };
}

interface ActiveProposalState {
  messageId: string;
  actionType: 'batch_proposal' | 'create_item' | 'update_item' | 'consensus_proposal';
  proposalTitle: string;
  items: ProposedItem[];
  updateDiff?: UpdateDiffPayload;
  consensusData?: ConsensusPayload;
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
  items: existingProjectItems,
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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
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

      // 【主動展開式 Proposal Canvas (方案 A)】：只要 AI 產出任何 Action，即刻平滑展開 900px Canvas 工作台
      if (res.actionPreview) {
        const preview = res.actionPreview;
        const actionType = preview.actionType;

        if (actionType === 'batch_proposal' && Array.isArray(preview.items)) {
          const proposedItems: ProposedItem[] = preview.items.map((item: any, idx: number) => ({
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
            actionType: 'batch_proposal',
            proposalTitle: preview.proposalTitle || 'AI 需求架構拆解提案',
            items: proposedItems
          });
        } else if (actionType === 'create_item') {
          const singleItem: ProposedItem = {
            id: `prop_single_${Date.now()}`,
            itemTitle: preview.itemTitle || '新工單項目',
            itemType: preview.itemType || 'Task',
            itemPriority: preview.itemPriority || 'Middle',
            itemFollowBy: preview.itemFollowBy || preview.updates?.item_follow_by || undefined,
            parentItemUid: preview.parentItemUid || undefined,
            approved: true
          };

          setActiveProposal({
            messageId: aiMsgId,
            actionType: 'create_item',
            proposalTitle: `建立新工單：${preview.itemTitle || '未命名項目'}`,
            items: [singleItem]
          });
        } else if (actionType === 'update_item') {
          const targetKey = preview.targetDisplayCode || preview.targetItemUid;
          const foundExisting = existingProjectItems?.find(
            it => it.item_display_code?.toLowerCase() === targetKey?.toLowerCase() || it.item_uid === targetKey
          );

          setActiveProposal({
            messageId: aiMsgId,
            actionType: 'update_item',
            proposalTitle: `工單變更審查：[${preview.targetDisplayCode || targetKey}]`,
            items: [],
            updateDiff: {
              targetDisplayCode: preview.targetDisplayCode || foundExisting?.item_display_code,
              targetItemUid: preview.targetItemUid || foundExisting?.item_uid,
              itemTitle: preview.itemTitle || foundExisting?.item_title,
              updates: preview.updates || {},
              summary: preview.summary,
              currentValues: {
                item_status: foundExisting?.item_status,
                item_follow_by: foundExisting?.item_follow_by,
                follow_by_name: foundExisting?.follow_by_name,
                item_priority: foundExisting?.item_priority,
                parent_display_code: foundExisting?.parent_display_code
              }
            }
          });
        } else if (actionType === 'consensus_proposal') {
          setActiveProposal({
            messageId: aiMsgId,
            actionType: 'consensus_proposal',
            proposalTitle: preview.itemTitle || '專案架構決策定案',
            items: [],
            consensusData: {
              title: preview.itemTitle || '專案架構決策',
              statement: preview.statement || preview.summary || '經對話共識定案',
              rationale: preview.rationale || '對話共識'
            }
          });
        }
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

  // 1. 執行單一建立工單套用
  const handleApplySingleCreate = async (item: ProposedItem) => {
    if (!project || !workspace) {
      alert('請先選擇目標專案');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.createItem({
        workspace_uid: workspace.workspace_uid,
        related_project_uid: project.project_uid,
        item_type: (item.itemType as any) || 'Task',
        item_title: item.itemTitle || '新任務',
        item_status: 'Not Start',
        item_priority: (item.itemPriority as any) || 'Middle',
        item_follow_by: item.itemFollowBy || undefined,
        parent_item_uid: item.parentItemUid || undefined
      });

      await onRefresh();
      window.dispatchEvent(new CustomEvent('projectson_item_updated', { detail: { type: 'create', item: res } }));

      if (activeProposal) {
        const msgId = activeProposal.messageId;
        setMessages(prev => prev.map(m => m.id === msgId ? {
          ...m,
          text: m.text + `\n\n✅ **已成功建立工單 [${res.item_display_code}]「${res.item_title}」並寫入 Traceability 矩陣！**`,
          actionPreview: undefined
        } : m));
      }

      setActiveProposal(null);
    } catch (err: any) {
      alert('建立工單失敗: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. 執行單一更新/作廢套用
  const handleApplySingleUpdate = async (diff: UpdateDiffPayload) => {
    const targetKey = diff.targetDisplayCode || diff.targetItemUid;
    if (!targetKey) {
      alert('未指定目標工單編號或 UID');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.patchItem(targetKey, diff.updates as Partial<ProjectItem>);

      await onRefresh();
      window.dispatchEvent(new CustomEvent('projectson_item_updated', { detail: { targetKey, item: res } }));

      if (activeProposal) {
        const msgId = activeProposal.messageId;
        const summaryText = diff.summary ? ` (${diff.summary})` : '';
        setMessages(prev => prev.map(m => m.id === msgId ? {
          ...m,
          text: m.text + `\n\n✅ **已成功更新工單 [${res.item_display_code || targetKey}]${summaryText}！**`,
          actionPreview: undefined
        } : m));
      }

      setActiveProposal(null);
    } catch (err: any) {
      alert('更新工單失敗: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. 執行批量建立套用
  const handleApplyBatchProposal = async (selectedItems: ProposedItem[]) => {
    if (!project || !workspace) {
      alert('請先選擇目標專案');
      return;
    }

    setIsSubmitting(true);
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
      setIsSubmitting(false);
    }
  };

  // 4. 執行決策共識沉澱套用
  const handleApplyConsensus = async (consensus: ConsensusPayload) => {
    if (!workspace) {
      alert('請先選擇工作區');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.commitConsensus({
        workspace_uid: workspace.workspace_uid,
        project_uid: project?.project_uid,
        title: consensus.title,
        statement: consensus.statement,
        rationale: consensus.rationale
      });

      await onRefresh();
      window.dispatchEvent(new CustomEvent('projectson_item_updated', { detail: { type: 'consensus_committed' } }));

      if (activeProposal) {
        const msgId = activeProposal.messageId;
        setMessages(prev => prev.map(m => m.id === msgId ? {
          ...m,
          text: m.text + `\n\n📌 **已成功將共識沉澱至 OKF 專案知識庫與 Decision 工單 [${res.item.item_display_code}]！**`,
          actionPreview: undefined
        } : m));
      }

      setActiveProposal(null);
    } catch (err: any) {
      alert('沉澱決策共識失敗: ' + err.message);
    } finally {
      setIsSubmitting(false);
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

                  <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p style={{ margin: '0 0 8px 0', lineHeight: 1.6 }}>{children}</p>,
                        table: ({ children }) => (
                          <div style={{ overflowX: 'auto', margin: '8px 0', borderRadius: '6px', border: '1px solid #334155' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => <thead style={{ backgroundColor: '#1e293b', color: '#93c5fd' }}>{children}</thead>,
                        tbody: ({ children }) => <tbody>{children}</tbody>,
                        tr: ({ children }) => <tr style={{ borderBottom: '1px solid #1e293b' }}>{children}</tr>,
                        th: ({ children }) => <th style={{ padding: '6px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</th>,
                        td: ({ children }) => <td style={{ padding: '6px 10px', color: '#cbd5e1' }}>{children}</td>,
                        ul: ({ children }) => <ul style={{ paddingLeft: '18px', margin: '4px 0 8px 0' }}>{children}</ul>,
                        ol: ({ children }) => <ol style={{ paddingLeft: '18px', margin: '4px 0 8px 0' }}>{children}</ol>,
                        li: ({ children }) => <li style={{ marginBottom: '3px' }}>{children}</li>,
                        code: ({ children, ...props }: any) => (
                          <code
                            style={{
                              backgroundColor: '#1e293b',
                              color: '#38bdf8',
                              padding: '2px 5px',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              fontFamily: 'monospace'
                            }}
                            {...props}
                          >
                            {children}
                          </code>
                        ),
                        strong: ({ children }) => <strong style={{ color: '#f8fafc', fontWeight: 700 }}>{children}</strong>,
                        h1: ({ children }) => <h1 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '10px 0 6px 0', color: '#f8fafc' }}>{children}</h1>,
                        h2: ({ children }) => <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '8px 0 4px 0', color: '#f8fafc' }}>{children}</h2>,
                        h3: ({ children }) => <h3 style={{ fontSize: '0.88rem', fontWeight: 600, margin: '6px 0 4px 0', color: '#93c5fd' }}>{children}</h3>,
                        blockquote: ({ children }) => (
                          <blockquote style={{
                            borderLeft: '3px solid #6366f1',
                            paddingLeft: '10px',
                            margin: '6px 0',
                            color: '#94a3b8',
                            fontStyle: 'italic'
                          }}>
                            {children}
                          </blockquote>
                        )
                      }}
                    >
                      {msg.text
                        .replace(/<<ACTION>>[\s\S]*?<<\/?ACTION>>/gi, '')
                        .replace(/ACTION<<[\s\S]*?>>?ACTION<</gi, '')
                        .trim()}
                    </ReactMarkdown>
                  </div>

                  {/* 提示已展開右側 Proposal Canvas 工作台的精緻徽章 */}
                  {msg.actionPreview && (
                    <div style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      backgroundColor: '#131b2e',
                      border: '1px solid #3b82f6',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#93c5fd', fontWeight: 600 }}>
                        {msg.actionPreview.actionType === 'batch_proposal' ? <Layers size={14} color="#818cf8" /> :
                         msg.actionPreview.actionType === 'create_item' ? <PlusCircle size={14} color="#38bdf8" /> :
                         msg.actionPreview.actionType === 'update_item' ? <Edit3 size={14} color="#facc15" /> :
                         <BookmarkCheck size={14} color="#f59e0b" />}
                        <span>已在右側 Proposal Canvas 展開審批工作台</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (msg.actionPreview) {
                            const prev = msg.actionPreview;
                            if (prev.actionType === 'batch_proposal') {
                              const proposedItems: ProposedItem[] = (prev.items || []).map((item: any, idx: number) => ({
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
                                actionType: 'batch_proposal',
                                proposalTitle: prev.proposalTitle || 'AI 需求拆解提案',
                                items: proposedItems
                              });
                            } else if (prev.actionType === 'create_item') {
                              setActiveProposal({
                                messageId: msg.id,
                                actionType: 'create_item',
                                proposalTitle: `建立工單：${prev.itemTitle || '未命名'}`,
                                items: [{
                                  id: `prop_single_${Date.now()}`,
                                  itemTitle: prev.itemTitle || '新工單',
                                  itemType: prev.itemType || 'Task',
                                  itemPriority: prev.itemPriority || 'Middle',
                                  itemFollowBy: prev.itemFollowBy || undefined,
                                  parentItemUid: prev.parentItemUid || undefined,
                                  approved: true
                                }]
                              });
                            } else if (prev.actionType === 'update_item') {
                              const targetKey = prev.targetDisplayCode || prev.targetItemUid;
                              const foundExisting = existingProjectItems?.find(
                                it => it.item_display_code?.toLowerCase() === targetKey?.toLowerCase() || it.item_uid === targetKey
                              );
                              setActiveProposal({
                                messageId: msg.id,
                                actionType: 'update_item',
                                proposalTitle: `工單變更審查：[${prev.targetDisplayCode || targetKey}]`,
                                items: [],
                                updateDiff: {
                                  targetDisplayCode: prev.targetDisplayCode || foundExisting?.item_display_code,
                                  targetItemUid: prev.targetItemUid || foundExisting?.item_uid,
                                  itemTitle: prev.itemTitle || foundExisting?.item_title,
                                  updates: prev.updates || {},
                                  summary: prev.summary,
                                  currentValues: {
                                    item_status: foundExisting?.item_status,
                                    item_follow_by: foundExisting?.item_follow_by,
                                    follow_by_name: foundExisting?.follow_by_name,
                                    item_priority: foundExisting?.item_priority
                                  }
                                }
                              });
                            } else if (prev.actionType === 'consensus_proposal') {
                              setActiveProposal({
                                messageId: msg.id,
                                actionType: 'consensus_proposal',
                                proposalTitle: prev.itemTitle || '專案架構決策',
                                items: [],
                                consensusData: {
                                  title: prev.itemTitle || '專案架構決策',
                                  statement: prev.statement || prev.summary || '經對話共識定案',
                                  rationale: prev.rationale
                                }
                              });
                            }
                          }
                        }}
                        style={{
                          backgroundColor: '#2563eb',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <ArrowRight size={12} />
                        <span>檢視工作台</span>
                      </button>
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

      {/* 右面板：Proposal Canvas 審核工作台 (當 activeProposal 存在時展開至 900px) */}
      {isDualPanel && activeProposal && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
          <ProposalCanvas
            actionType={activeProposal.actionType}
            proposalTitle={activeProposal.proposalTitle}
            items={activeProposal.items}
            updateDiff={activeProposal.updateDiff}
            consensusData={activeProposal.consensusData}
            members={members}
            existingItems={existingProjectItems}
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
            onApplyBatch={handleApplyBatchProposal}
            onApplySingleCreate={handleApplySingleCreate}
            onApplySingleUpdate={handleApplySingleUpdate}
            onApplyConsensus={handleApplyConsensus}
            isSubmitting={isSubmitting}
          />
        </div>
      )}
    </div>
  );
};
