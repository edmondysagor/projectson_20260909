import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Bot, 
  User, 
  RefreshCw, 
  Cpu, 
  BrainCircuit,
  Layers,
  Send,
  CheckCircle2,
  Plus,
  FileText,
  Square,
  History,
  Trash2,
  Paperclip,
  Edit3,
  Copy,
  Check,
  Mic,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { api } from '../utils/api';
import type { Workspace, Project, ProjectItem, Member, CopilotSession, CopilotAttachment } from '../utils/api';
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
  activeMemberUid?: string;
  onRefresh: () => Promise<void>;
  onCanvasToggle?: (isExpanded: boolean) => void;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  reasoningContent?: string;
  modelUsed?: string;
  timestamp: string;
  attachments?: CopilotAttachment[];
  actionPreview?: {
    actionType: 'create_item' | 'update_item' | 'batch_proposal' | 'consensus_proposal';
    applied?: boolean;
    appliedAt?: string;
    appliedSummary?: string;
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
    description?: string;
    items?: Array<{
      itemTitle: string;
      itemType?: string;
      itemPriority?: string;
      itemFollowBy?: string;
      parentItemUid?: string;
      relation_item_uid?: any;
      relationItemUid?: any;
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
      item_content?: any;
      description?: string;
    };
    summary?: string;
  };
  actionPreviews?: Array<{
    actionId?: string;
    actionType: 'create_item' | 'update_item' | 'batch_proposal' | 'consensus_proposal';
    applied?: boolean;
    appliedAt?: string;
    appliedSummary?: string;
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
    description?: string;
    items?: Array<{
      itemTitle: string;
      itemType?: string;
      itemPriority?: string;
      itemFollowBy?: string;
      parentItemUid?: string;
      relation_item_uid?: any;
      relationItemUid?: any;
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
      item_content?: any;
      description?: string;
    };
    summary?: string;
  }>;
}

interface ActiveProposalState {
  messageId: string;
  actionIndex?: number;
  actionType: 'batch_proposal' | 'create_item' | 'update_item' | 'consensus_proposal';
  proposalTitle: string;
  items: ProposedItem[];
  updateDiff?: UpdateDiffPayload;
  updatesList?: UpdateDiffPayload[];
  consensusData?: ConsensusPayload;
  isApplied?: boolean;
}


const AVAILABLE_MODELS = [
  { id: 'gemma4:31b-cloud', label: '🦙 Gemma 4 31B (Ollama Cloud)' },
  { id: 'deepseek-v4.1-flash', label: '⚡ DeepSeek V4.1 Flash (Ollama Cloud)' },
  { id: 'kimi-k3', label: '🌙 Kimi K3 (Ollama Cloud)' },
  { id: 'glm-5.3-flash', label: '🌟 GLM 5.3 Flash (Ollama Cloud)' },
  { id: 'qwen3.8-flash', label: '⚡ Qwen 3.8 Flash (Alibaba DashScope)' },
  { id: 'qwen-plus', label: '🚀 Qwen 2.5 Plus (Alibaba DashScope)' },
  { id: 'qwen-max', label: '🧠 Qwen Max (Alibaba DashScope)' },
  { id: 'qwen-vl-max', label: '🖼️ Qwen VL Max (視覺多模態)' },
  { id: 'deepseek-v3', label: '🔮 DeepSeek V3 (DashScope)' },
  { id: 'deepseek-r1', label: '🎯 DeepSeek R1 (DashScope CoT)' },
];

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  isOpen,
  onClose,
  workspace,
  project,
  items: existingProjectItems,
  activeMemberUid,
  onRefresh,
  onCanvasToggle
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: `你好！我是 **Projectson Actionable AI Copilot** 🧠。\n\n我已經自動掌握了 **${project ? project.project_name : (workspace ? workspace.workspace_name : '工作區')}** 的最新動態與工單進度。\n\n你可以隨意同我討論專案架構、切換不同大模型、開啟深度思考模式，或者直接**貼上截圖 (Cmd+V) / 上傳會議紀錄文件**叫我幫你一鍵拆解/建立/指派工單！`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [attachments, setAttachments] = useState<CopilotAttachment[]>([]);
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemma4:31b-cloud');
  const [enableThinking, setEnableThinking] = useState<boolean>(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeProposal, setActiveProposal] = useState<ActiveProposalState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 方案 A: 歷史對話 Session 管理狀態
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<CopilotSession[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historyScope, setHistoryScope] = useState<'project' | 'all'>('project');
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const historyMenuRef = useRef<HTMLDivElement>(null);

  // 全螢幕專注思考模式狀態
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // 訊息複製狀態
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const handleCopyMessage = (text: string, msgId: string) => {
    const cleanText = text
      .replace(/<<ACTION>>[\s\S]*?<<\/?ACTION>>/gi, '')
      .replace(/ACTION<<[\s\S]*?>>?ACTION<</gi, '')
      .trim();
    navigator.clipboard.writeText(cleanText);
    setCopiedMsgId(msgId);
    setTimeout(() => {
      setCopiedMsgId((prev) => (prev === msgId ? null : prev));
    }, 2000);
  };

  // 語音轉文字 (Speech-to-Text / Web Speech API) 狀態
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechLang, setSpeechLang] = useState<'zh-HK' | 'zh-TW' | 'en-US'>('zh-HK');
  const [showLangMenu, setShowLangMenu] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const baseInputRef = useRef<string>('');

  // 保持 isListeningRef 與 state 同步
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // 切換錄音/語音轉文字
  const toggleListening = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('您的瀏覽器暫未支援 Web Speech 語音輸入，建議使用 Google Chrome 或 Microsoft Edge 瀏覽器。');
      return;
    }

    // 若目前正在聆聽中，點擊即停止
    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
        recognitionRef.current = null;
      }
      return;
    }

    // 啟動前先清理舊實例
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }

    try {
      baseInputRef.current = inputText;
      const recognition = new SpeechRec();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = speechLang || 'zh-HK';

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript;
          } else {
            interimTranscript += res[0].transcript;
          }
        }

        const currentSpoken = (finalTranscript + interimTranscript).trim();
        if (currentSpoken) {
          const base = baseInputRef.current.trim();
          setInputText(base ? `${base} ${currentSpoken}` : currentSpoken);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error event:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          alert('請允許瀏覽器麥克風權限以使用語音輸入。');
          isListeningRef.current = false;
          setIsListening(false);
        } else if (event.error === 'audio-capture') {
          alert('未偵測到可用麥克風，請檢查收音設備。');
          isListeningRef.current = false;
          setIsListening(false);
        } else if (event.error === 'network') {
          console.warn('Speech recognition network warning');
          isListeningRef.current = false;
          setIsListening(false);
        } else if (event.error !== 'no-speech') {
          isListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // 若使用者未主動關閉且仍在聆聽狀態，重置狀態以供下次點擊正常重啟
        isListeningRef.current = false;
        setIsListening(false);
      };

      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      isListeningRef.current = false;
      setIsListening(false);
    }
  };

  // 組件卸載時清理語音辨識
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, []);

  // 當 activeProposal 改變時，主動通知父層 App 調整主頁面寬度壓縮
  useEffect(() => {
    onCanvasToggle?.(Boolean(activeProposal));
  }, [activeProposal, onCanvasToggle]);

  // 獲取團隊成員名單以供指派選擇
  useEffect(() => {
    if (isOpen) {
      api.getMembers().then(data => setMembers(data)).catch(err => console.error('Failed to load members:', err));
    }
  }, [isOpen]);

  // 載入歷史對話清單
  const loadSessions = async () => {
    if (!workspace) return;
    setIsLoadingSessions(true);
    try {
      const list = await api.getCopilotSessions({
        workspace_uid: workspace.workspace_uid,
        member_uid: activeMemberUid,
        project_uid: (historyScope === 'project' && project) ? project.project_uid : undefined
      });
      setSessions(list);
    } catch (err) {
      console.error('Failed to load copilot sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (isOpen && workspace) {
      loadSessions();
    }
  }, [isOpen, workspace?.workspace_uid, activeMemberUid, historyScope, project?.project_uid]);

  // 點擊外部自動收起歷史對話 Popover
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (historyMenuRef.current && !historyMenuRef.current.contains(e.target as Node)) {
        setIsHistoryOpen(false);
      }
    };
    if (isHistoryOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isHistoryOpen]);

  // 開啟新對話 (New Chat)
  const handleNewChat = () => {
    setCurrentSessionId(null);
    setActiveProposal(null);
    setMessages([
      {
        id: Date.now().toString(),
        sender: 'ai',
        text: `你好！我是 **Projectson Actionable AI Copilot** 🧠。\n\n我已經自動掌握了 **${project ? project.project_name : (workspace ? workspace.workspace_name : '工作區')}** 的最新動態與工單進度。\n\n你可以隨意同我討論專案架構、切換不同大模型、開啟深度思考模式，或者叫我幫你一鍵拆解/建立/指派工單！`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setIsHistoryOpen(false);
  };

  // 選擇並載入歷史對話 (Select Session)
  const handleSelectSession = async (sessionUid: string) => {
    try {
      const fullSession = await api.getCopilotSession(sessionUid);
      setCurrentSessionId(fullSession.session_uid);
      if (Array.isArray(fullSession.messages) && fullSession.messages.length > 0) {
        setMessages(fullSession.messages);
      }
      if (fullSession.last_model_used) {
        setSelectedModel(fullSession.last_model_used);
      }
      setActiveProposal(null);
      setIsHistoryOpen(false);
    } catch (err: any) {
      alert('載入對話失敗: ' + err.message);
    }
  };

  // 刪除歷史對話 (Delete Session)
  const handleDeleteSession = async (e: React.MouseEvent, sessionUid: string) => {
    e.stopPropagation();
    if (!confirm('確定要刪除此段對話紀錄嗎？')) return;
    try {
      await api.deleteCopilotSession(sessionUid);
      if (currentSessionId === sessionUid) {
        handleNewChat();
      }
      loadSessions();
    } catch (err: any) {
      alert('刪除對話失敗: ' + err.message);
    }
  };

  // 智能構建 Proposal Canvas 狀態 (支援單工單、多工單、Diff 與共識)
  const buildProposalStateFromAction = (
    preview: any, 
    messageId: string, 
    actionIndex?: number, 
    isApplied?: boolean
  ): ActiveProposalState | null => {
    if (!preview) return null;
    const actionType = preview.actionType;

    if (actionType === 'batch_proposal' && Array.isArray(preview.items)) {
      const proposedItems: ProposedItem[] = preview.items.map((item: any, idx: number) => ({
        id: `prop_${Date.now()}_${idx}`,
        itemTitle: item.itemTitle || `工單項目 ${idx + 1}`,
        itemType: item.itemType || 'Task',
        itemPriority: (item.itemPriority as any) || 'Middle',
        itemFollowBy: item.itemFollowBy || undefined,
        parentItemUid: item.parentItemUid || undefined,
        relation_item_uid: item.relation_item_uid || item.relationItemUid || undefined,
        relationItemUid: item.relation_item_uid || item.relationItemUid || undefined,
        description: item.description || undefined,
        approved: true
      }));

      return {
        messageId,
        actionIndex,
        actionType: 'batch_proposal',
        proposalTitle: preview.proposalTitle || 'AI 需求架構拆解提案',
        items: proposedItems,
        isApplied
      };
    } else if (actionType === 'create_item') {
      const singleItem: ProposedItem = {
        id: `prop_single_${Date.now()}`,
        itemTitle: preview.itemTitle || '新工單項目',
        itemType: preview.itemType || 'Task',
        itemPriority: preview.itemPriority || 'Middle',
        itemFollowBy: preview.itemFollowBy || preview.updates?.item_follow_by || undefined,
        parentItemUid: preview.parentItemUid || undefined,
        relation_item_uid: preview.relation_item_uid || preview.relationItemUid || undefined,
        relationItemUid: preview.relation_item_uid || preview.relationItemUid || undefined,
        description: preview.description || undefined,
        approved: true
      };

      return {
        messageId,
        actionIndex,
        actionType: 'create_item',
        proposalTitle: `建立新工單：${preview.itemTitle || '未命名項目'}`,
        items: [singleItem],
        isApplied
      };
    } else if (actionType === 'update_item') {
      const targetKey = preview.targetDisplayCode || preview.targetItemUid;
      const foundExisting = existingProjectItems?.find(
        it => it.item_display_code?.toLowerCase() === targetKey?.toLowerCase() || it.item_uid === targetKey
      );

      const rawUpdates = preview.updates || {};
      if (preview.description && !rawUpdates.item_content) {
        rawUpdates.item_content = { text: preview.description, description: preview.description };
      } else if (rawUpdates.description && !rawUpdates.item_content) {
        rawUpdates.item_content = { text: rawUpdates.description, description: rawUpdates.description };
      } else if (typeof rawUpdates.item_content === 'string') {
        rawUpdates.item_content = { text: rawUpdates.item_content, description: rawUpdates.item_content };
      }

      return {
        messageId,
        actionIndex,
        actionType: 'update_item',
        proposalTitle: `工單變更審查：[${preview.targetDisplayCode || targetKey}]`,
        items: [],
        updateDiff: {
          targetDisplayCode: preview.targetDisplayCode || foundExisting?.item_display_code,
          targetItemUid: preview.targetItemUid || foundExisting?.item_uid,
          itemTitle: preview.itemTitle || foundExisting?.item_title,
          updates: rawUpdates,
          summary: preview.summary,
          currentValues: {
            item_status: foundExisting?.item_status,
            item_follow_by: foundExisting?.item_follow_by,
            follow_by_name: foundExisting?.follow_by_name,
            item_priority: foundExisting?.item_priority,
            parent_display_code: foundExisting?.parent_display_code,
            item_content: foundExisting?.item_content
          }
        },
        isApplied
      };
    } else if (actionType === 'consensus_proposal') {
      return {
        messageId,
        actionIndex,
        actionType: 'consensus_proposal',
        proposalTitle: preview.itemTitle || '專案架構決策定案',
        items: [],
        consensusData: {
          title: preview.itemTitle || '專案架構決策',
          statement: preview.statement || preview.summary || '經對話共識定案',
          rationale: preview.rationale || '對話共識'
        },
        isApplied
      };
    }
    return null;
  };

  // 智能構建整合式 Proposal Canvas 狀態 (方案 A: 將訊息內所有批次/單項/更新合流為一體)
  const buildUnifiedProposalStateFromMessage = (
    msg: Message,
    isApplied?: boolean
  ): ActiveProposalState | null => {
    const actions = msg.actionPreviews || (msg.actionPreview ? [msg.actionPreview] : []);
    if (actions.length === 0) return null;

    if (actions.length === 1) {
      return buildProposalStateFromAction(actions[0], msg.id, 0, isApplied);
    }

    // 匯總所有建立工單、批次工單與更新工單
    const unifiedItems: ProposedItem[] = [];
    const updatesList: UpdateDiffPayload[] = [];

    actions.forEach((act, actIdx) => {
      if (act.actionType === 'batch_proposal' && Array.isArray(act.items)) {
        const sectionTitle = act.proposalTitle || `批次工單骨架 (${act.items.length} 項)`;
        act.items.forEach((item: any, iIdx: number) => {
          unifiedItems.push({
            id: `prop_u_${actIdx}_${iIdx}_${Date.now()}`,
            itemTitle: item.itemTitle || `工單項目 ${iIdx + 1}`,
            itemType: item.itemType || 'Task',
            itemPriority: (item.itemPriority as any) || 'Middle',
            itemFollowBy: item.itemFollowBy || undefined,
            parentItemUid: item.parentItemUid || undefined,
            relation_item_uid: item.relation_item_uid || item.relationItemUid || undefined,
            relationItemUid: item.relation_item_uid || item.relationItemUid || undefined,
            description: item.description || undefined,
            sectionTitle,
            approved: true
          });
        });
      } else if (act.actionType === 'create_item') {
        const sectionTitle = act.proposalTitle || (act.itemType ? `${act.itemType} 工單` : '單項工單建立');
        unifiedItems.push({
          id: `prop_u_single_${actIdx}_${Date.now()}`,
          itemTitle: act.itemTitle || '新工單項目',
          itemType: act.itemType || 'Task',
          itemPriority: act.itemPriority || 'Middle',
          itemFollowBy: act.itemFollowBy || act.updates?.item_follow_by || undefined,
          parentItemUid: act.parentItemUid || undefined,
          relation_item_uid: (act as any).relation_item_uid || (act as any).relationItemUid || undefined,
          relationItemUid: (act as any).relation_item_uid || (act as any).relationItemUid || undefined,
          description: act.description || undefined,
          sectionTitle,
          approved: true
        });
      } else if (act.actionType === 'update_item') {
        const targetKey = act.targetDisplayCode || act.targetItemUid;
        const foundExisting = existingProjectItems?.find(
          it => it.item_display_code?.toLowerCase() === targetKey?.toLowerCase() || it.item_uid === targetKey
        );
        const rawUpdates = act.updates || {};
        if (act.description && !rawUpdates.item_content) {
          rawUpdates.item_content = { text: act.description, description: act.description };
        }
        updatesList.push({
          targetDisplayCode: act.targetDisplayCode || foundExisting?.item_display_code,
          targetItemUid: act.targetItemUid || foundExisting?.item_uid,
          itemTitle: act.itemTitle || foundExisting?.item_title,
          updates: rawUpdates,
          summary: act.summary,
          currentValues: {
            item_status: foundExisting?.item_status,
            item_follow_by: foundExisting?.item_follow_by,
            follow_by_name: foundExisting?.follow_by_name,
            item_priority: foundExisting?.item_priority,
            parent_display_code: foundExisting?.parent_display_code,
            item_content: foundExisting?.item_content
          }
        });
      }
    });

    if (unifiedItems.length === 0 && updatesList.length === 1) {
      // 若只有單項更新，直接開 Diff 面板
      return buildProposalStateFromAction(actions[0], msg.id, 0, isApplied);
    }

    const titleParts = [];
    if (updatesList.length > 0) titleParts.push(`${updatesList.length} 項更新`);
    if (unifiedItems.length > 0) titleParts.push(`${unifiedItems.length} 項新建`);

    return {
      messageId: msg.id,
      actionType: 'batch_proposal',
      proposalTitle: `專案架構綜合提案 (${titleParts.join(' + ') || '工單作業'})`,
      items: unifiedItems,
      updatesList: updatesList.length > 0 ? updatesList : undefined,
      isApplied
    };
  };

  // 標記動作套用狀態並持久化至 Session
  const markActionApplied = (
    msgId: string, 
    actionIndex: number | undefined, 
    summaryText: string
  ) => {
    setMessages(prevMsgs => {
      const next = prevMsgs.map(m => {
        if (m.id !== msgId) return m;

        let updatedPreviews = m.actionPreviews ? [...m.actionPreviews] : [];
        if (updatedPreviews.length > 0 && actionIndex !== undefined && updatedPreviews[actionIndex]) {
          updatedPreviews[actionIndex] = {
            ...updatedPreviews[actionIndex],
            applied: true,
            appliedAt: new Date().toISOString(),
            appliedSummary: summaryText
          };
        } else if (updatedPreviews.length > 0) {
          updatedPreviews = updatedPreviews.map(a => ({ ...a, applied: true, appliedAt: new Date().toISOString() }));
        }

        const isAllApplied = updatedPreviews.length > 0
          ? updatedPreviews.every(a => a.applied)
          : true;

        const singleActionPreview = m.actionPreview ? {
          ...m.actionPreview,
          applied: isAllApplied,
          appliedAt: new Date().toISOString(),
          appliedSummary: summaryText
        } : undefined;

        const newText = m.text.includes(summaryText) ? m.text : `${m.text}\n\n✅ **已成功套用：${summaryText}！**`;

        return {
          ...m,
          text: newText,
          actionPreviews: updatedPreviews.length > 0 ? updatedPreviews : undefined,
          actionPreview: singleActionPreview
        };
      });

      if (currentSessionId) {
        api.updateCopilotSession(currentSessionId, {
          messages: next,
          last_model_used: selectedModel
        }).catch(e => console.error('Failed to update session:', e));
      }
      return next;
    });
  };


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  // 處理附加檔案與截圖 (支援純文字、Markdown、程式碼與圖片)
  const processFiles = async (fileList: FileList | File[]) => {
    setIsReadingFile(true);
    const newAttachments: CopilotAttachment[] = [];
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const isImage = file.type.startsWith('image/');
        const isText = file.type.includes('text') || 
          file.name.endsWith('.md') || 
          file.name.endsWith('.txt') || 
          file.name.endsWith('.json') || 
          file.name.endsWith('.csv') ||
          file.name.endsWith('.ts') ||
          file.name.endsWith('.js') ||
          file.name.endsWith('.py') ||
          file.name.endsWith('.sql');

        if (isImage) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          newAttachments.push({
            name: file.name,
            type: 'image',
            mimeType: file.type || 'image/png',
            size: file.size,
            dataUrl
          });
        } else if (isText) {
          const text = await file.text();
          newAttachments.push({
            name: file.name,
            type: 'text',
            mimeType: file.type || 'text/plain',
            size: file.size,
            textContent: text
          });
        } else {
          try {
            const text = await file.text();
            newAttachments.push({
              name: file.name,
              type: 'text',
              mimeType: file.type || 'application/octet-stream',
              size: file.size,
              textContent: text
            });
          } catch {
            newAttachments.push({
              name: file.name,
              type: 'file',
              mimeType: file.type,
              size: file.size,
              textContent: `[檔案: ${file.name}, 大小: ${Math.round(file.size / 1024)} KB]`
            });
          }
        }
      }
      setAttachments(prev => [...prev, ...newAttachments]);
    } catch (err: any) {
      console.error('Failed to read files:', err);
      alert('檔案讀取失敗: ' + (err.message || String(err)));
    } finally {
      setIsReadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 剪貼簿貼上攔截 (Cmd+V / Ctrl+V 貼上螢幕截圖)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;
    const items = clipboardData.items;
    if (!items || items.length === 0) return;

    const filesToProcess: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const nowStr = new Date().toISOString().replace(/[:.]/g, '-');
          filesToProcess.push(new File([blob], `screenshot_${nowStr}.png`, { type: blob.type }));
        }
      }
    }
    if (filesToProcess.length > 0) {
      e.preventDefault();
      await processFiles(filesToProcess);
    }
  };

  if (!isOpen) return null;

  // 緊急中止 AI 生成
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsThinking(false);
    const stopNotice: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: `🛑 **已手動中止生成 (Generation Aborted)**\n\n你可以隨時重新調整指示、切換模型或修改附件後再次提問。`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, stopNotice]);
  };

  const handleSendMessage = async (overrideText?: string) => {
    const rawText = typeof overrideText === 'string' ? overrideText : inputText;
    if ((!rawText.trim() && attachments.length === 0) || isThinking || isReadingFile) return;

    const userMsgText = rawText.trim() || (attachments.length > 0 ? `請分析所附加的 ${attachments.length} 個檔案/圖片` : '');
    const currentAttachments = [...attachments];

    const newMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMsgText,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setAttachments([]);
    setIsThinking(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      if (!workspace) {
        throw new Error('請先選擇工作區');
      }

      const res = await api.copilotChat({
        message: userMsgText,
        workspace_uid: workspace.workspace_uid,
        project_uid: project ? project.project_uid : undefined,
        conversation_history: messages.map(m => ({ 
          sender: m.sender, 
          text: m.text, 
          attachments: m.attachments 
        })),
        attachments: currentAttachments,
        model: selectedModel,
        enable_thinking: enableThinking
      }, controller.signal);

      const allActionPreviews = res.actionPreviews && res.actionPreviews.length > 0
        ? res.actionPreviews
        : (res.actionPreview ? [res.actionPreview] : []);

      const aiMsgId = (Date.now() + 1).toString();
      const aiResponse: Message = {
        id: aiMsgId,
        sender: 'ai',
        text: res.text,
        reasoningContent: res.reasoning_content,
        modelUsed: res.model_used || selectedModel,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionPreview: allActionPreviews[0] || undefined,
        actionPreviews: allActionPreviews.length > 0 ? allActionPreviews : undefined
      };

      const updatedMessages = [...messages, newMsg, aiResponse];
      setMessages(updatedMessages);

      // 自動同步儲存至 Neon DB 歷史 Session (方案 A)
      try {
        if (!currentSessionId) {
          const autoTitle = userMsgText.length > 22 ? userMsgText.slice(0, 22) + '...' : userMsgText;
          const created = await api.createCopilotSession({
            workspace_uid: workspace.workspace_uid,
            project_uid: project ? project.project_uid : undefined,
            member_uid: activeMemberUid,
            title: autoTitle,
            messages: updatedMessages,
            last_model_used: selectedModel
          });
          setCurrentSessionId(created.session_uid);
          loadSessions();
        } else {
          await api.updateCopilotSession(currentSessionId, {
            messages: updatedMessages,
            last_model_used: selectedModel
          });
          loadSessions();
        }
      } catch (saveErr) {
        console.error('Failed to auto-save copilot session:', saveErr);
      }

      // AI 產出 Action 後不強制彈出 Canvas，保留在 Chat 讓用家從容閱讀，由用家自主點擊審核或一鍵執行
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.toLowerCase().includes('abort')) {
        console.log('AI generation aborted by user.');
        return;
      }
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `抱歉，處理對話時發生錯誤: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
      abortControllerRef.current = null;
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
        parent_item_uid: item.parentItemUid || undefined,
        item_content: item.description ? { text: item.description, description: item.description } : undefined
      });

      await onRefresh();
      window.dispatchEvent(new CustomEvent('projectson_item_updated', { detail: { type: 'create', item: res } }));

      if (activeProposal) {
        markActionApplied(
          activeProposal.messageId,
          activeProposal.actionIndex,
          `已建立工單 [${res.item_display_code}]「${res.item_title}」`
        );
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
        const summaryText = diff.summary ? ` (${diff.summary})` : '';
        markActionApplied(
          activeProposal.messageId,
          activeProposal.actionIndex,
          `已更新工單 [${res.item_display_code || targetKey}]${summaryText}`
        );
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
        relation_item_uid: (item.relation_item_uid || item.relationItemUid || undefined) as any,
        related_project_uid: project.project_uid,
        item_content: item.description ? { text: item.description, description: item.description } : undefined,
        description: item.description || undefined,
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
        markActionApplied(
          activeProposal.messageId,
          activeProposal.actionIndex,
          `已批量建立 ${res.items.length} 張工單 (${res.items.map(i => i.item_display_code).join(', ')})`
        );
      }

      setActiveProposal(null);
    } catch (err: any) {
      alert('批次寫入工單失敗: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3.1 執行整合式雙模態提案套用 (同時處理 Updates 與 Creations)
  const handleApplyUnifiedProposal = async (selectedItems: ProposedItem[], selectedUpdates?: UpdateDiffPayload[]) => {
    if (!project || !workspace) {
      alert('請先選擇目標專案');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. 執行所有 Updates
      if (selectedUpdates && selectedUpdates.length > 0) {
        for (const up of selectedUpdates) {
          const targetKey = up.targetDisplayCode || up.targetItemUid;
          if (targetKey) {
            await api.patchItem(targetKey, up.updates as Partial<ProjectItem>);
          }
        }
      }

      // 2. 執行所有 Creations
      let createdCount = 0;
      let createdCodes: string[] = [];
      if (selectedItems.length > 0) {
        const payloadItems = selectedItems.map(item => ({
          item_title: item.itemTitle,
          item_type: item.itemType,
          item_priority: item.itemPriority as any,
          item_follow_by: item.itemFollowBy,
          parent_item_uid: item.parentItemUid,
          relation_item_uid: (item.relation_item_uid || item.relationItemUid || undefined) as any,
          related_project_uid: project.project_uid,
          item_content: item.description ? { text: item.description, description: item.description } : undefined,
          description: item.description || undefined,
          audit_remark: `🤖 [AI 綜合提案批量寫入]：依據提案「${activeProposal?.proposalTitle || '架構規劃'}」經審核批次建立。`
        }));

        const res = await api.batchCreateItems({
          workspace_uid: workspace.workspace_uid,
          related_project_uid: project.project_uid,
          items: payloadItems
        });
        createdCount = res.items.length;
        createdCodes = res.items.map(i => i.item_display_code);
      }

      await onRefresh();
      window.dispatchEvent(new CustomEvent('projectson_item_updated', { detail: { type: 'unified_applied' } }));

      if (activeProposal) {
        const updateSummary = selectedUpdates && selectedUpdates.length > 0 ? `${selectedUpdates.length} 項更新` : '';
        const createSummary = createdCount > 0 ? `${createdCount} 項新建 (${createdCodes.join(', ')})` : '';
        const combinedSummary = [updateSummary, createSummary].filter(Boolean).join(' + ');

        markActionApplied(
          activeProposal.messageId,
          activeProposal.actionIndex,
          `已成功套用綜合提案：${combinedSummary}`
        );
      }

      setActiveProposal(null);
    } catch (err: any) {
      alert('套用綜合提案失敗: ' + err.message);
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
        markActionApplied(
          activeProposal.messageId,
          activeProposal.actionIndex,
          `已將共識沉澱至 OKF 專案知識庫與 Decision 工單 [${res.item.item_display_code}]`
        );
      }

      setActiveProposal(null);
    } catch (err: any) {
      alert('共識沉澱失敗: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. 執行訊息內「一鍵依序執行全部動作 (Approve All)」
  const handleApplyAllInMessage = async (msg: Message) => {
    if (!project || !workspace) {
      alert('請先選擇目標專案');
      return;
    }

    const actions = msg.actionPreviews || (msg.actionPreview ? [msg.actionPreview] : []);
    const unapplied = actions.filter(a => !a.applied);
    if (unapplied.length === 0) {
      alert('所有動作皆已套用完成！');
      return;
    }

    setIsSubmitting(true);
    const results: string[] = [];

    try {
      for (let idx = 0; idx < actions.length; idx++) {
        const action = actions[idx];
        if (action.applied) continue;

        if (action.actionType === 'batch_proposal' && Array.isArray(action.items)) {
          const payloadItems = action.items.map(item => ({
            item_title: item.itemTitle,
            item_type: item.itemType,
            item_priority: item.itemPriority as any,
            item_follow_by: item.itemFollowBy,
            parent_item_uid: item.parentItemUid,
            relation_item_uid: (item.relation_item_uid || item.relationItemUid || undefined) as any,
            related_project_uid: project.project_uid,
            item_content: item.description ? { text: item.description, description: item.description } : undefined,
            description: item.description || undefined,
            audit_remark: `🤖 [4-in-1 全套初始化批量寫入]：依據「${action.proposalTitle || '架構規劃'}」經審核批次建立。`
          }));

          const res = await api.batchCreateItems({
            workspace_uid: workspace.workspace_uid,
            related_project_uid: project.project_uid,
            items: payloadItems
          });
          action.applied = true;
          action.appliedAt = new Date().toISOString();
          action.appliedSummary = `已批量建立 ${res.items.length} 項`;
          results.push(`已批量建立 ${res.items.length} 張工單 (${res.items.map(i => i.item_display_code).join(', ')})`);
        } else if (action.actionType === 'update_item') {
          const targetKey = action.targetDisplayCode || action.targetItemUid;
          if (targetKey) {
            const rawUpdates = action.updates || {};
            if (action.description && !rawUpdates.item_content) {
              rawUpdates.item_content = { text: action.description, description: action.description };
            }
            const res = await api.patchItem(targetKey, rawUpdates as Partial<ProjectItem>);
            action.applied = true;
            action.appliedAt = new Date().toISOString();
            action.appliedSummary = `已更新 [${res.item_display_code || targetKey}]`;
            results.push(`已更新工單 [${res.item_display_code || targetKey}]`);
          }
        } else if (action.actionType === 'create_item') {
          const res = await api.createItem({
            workspace_uid: workspace.workspace_uid,
            related_project_uid: project.project_uid,
            item_type: (action.itemType as any) || 'Task',
            item_title: action.itemTitle || '新任務',
            item_status: 'Not Start',
            item_priority: (action.itemPriority as any) || 'Middle',
            item_follow_by: action.itemFollowBy || undefined,
            parent_item_uid: action.parentItemUid || undefined,
            item_content: action.description ? { text: action.description, description: action.description } : undefined
          });
          action.applied = true;
          action.appliedAt = new Date().toISOString();
          action.appliedSummary = `已建立 [${res.item_display_code}]`;
          results.push(`已建立工單 [${res.item_display_code}]`);
        } else if (action.actionType === 'consensus_proposal') {
          await api.commitConsensus({
            workspace_uid: workspace.workspace_uid,
            project_uid: project.project_uid,
            title: action.itemTitle || '專案架構決策',
            statement: action.statement || action.summary || '經對話共識定案',
            rationale: action.rationale
          });
          action.applied = true;
          action.appliedAt = new Date().toISOString();
          action.appliedSummary = `已沉澱共識`;
          results.push(`已沉澱決策共識`);
        }
      }

      await onRefresh();
      window.dispatchEvent(new CustomEvent('projectson_item_updated', { detail: { type: 'batch_all_applied' } }));

      // 更新訊息狀態
      setMessages(prevMsgs => {
        const next = prevMsgs.map(m => {
          if (m.id !== msg.id) return m;
          const summaryStr = `\n\n✅ **已成功執行全部 ${actions.length} 項連鎖動作！**\n- ${results.join('\n- ')}`;
          const updatedPreviews = actions.map(a => ({ ...a, applied: true, appliedAt: new Date().toISOString() }));
          return {
            ...m,
            text: m.text.includes('✅ **已成功執行全部') ? m.text : m.text + summaryStr,
            actionPreviews: updatedPreviews,
            actionPreview: { ...updatedPreviews[0], applied: true }
          };
        });

        if (currentSessionId) {
          api.updateCopilotSession(currentSessionId, {
            messages: next,
            last_model_used: selectedModel
          }).catch(e => console.error('Failed to update session:', e));
        }
        return next;
      });

      setActiveProposal(null);
    } catch (err: any) {
      alert('執行連鎖動作失敗: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* 1. 右側 AI Copilot 對話抽屜 (常駐輕量 380px，支援一鍵全螢幕) */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: isFullscreen ? '100vw' : '380px',
        maxWidth: '100vw',
        backgroundColor: '#090d16',
        borderLeft: isFullscreen ? 'none' : '1px solid #1e293b',
        boxShadow: isFullscreen ? 'none' : '-8px 0 32px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: isFullscreen ? 10000 : 9000,
        backdropFilter: 'blur(10px)',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {/* 對話主體 */}
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}>
        {/* 頂部 Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#0f172a'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              backgroundColor: '#581c87',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 10px rgba(168, 85, 247, 0.4)'
            }}>
              <Sparkles size={14} color="#f3e8ff" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap' }}>
                Copilot
              </span>
              <span style={{ fontSize: '0.62rem', backgroundColor: '#064e3b', color: '#6ee7b7', padding: '1px 5px', borderRadius: '4px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                OKF v0.2
              </span>
            </div>
          </div>

          {/* 右側操作群：新對話 + 歷史記錄 Popover + 關閉 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            {/* 新對話按鈕 */}
            <button
              onClick={handleNewChat}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '3px 6px',
                borderRadius: '5px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#cbd5e1',
                fontSize: '0.72rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title="開啟全新對話"
            >
              <Plus size={12} color="#a855f7" />
              <span>新對話</span>
            </button>

            {/* 歷史對話按鈕 & 懸浮選單 Popover (方案 A) */}
            <div style={{ position: 'relative' }} ref={historyMenuRef}>
              <button
                onClick={() => {
                  const nextState = !isHistoryOpen;
                  setIsHistoryOpen(nextState);
                  if (nextState) loadSessions();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '3px 6px',
                  borderRadius: '5px',
                  backgroundColor: isHistoryOpen ? '#334155' : '#1e293b',
                  border: `1px solid ${isHistoryOpen ? '#818cf8' : '#334155'}`,
                  color: isHistoryOpen ? '#f8fafc' : '#cbd5e1',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                title="查看歷史對話"
              >
                <History size={12} color="#38bdf8" />
                <span>歷史</span>
                {sessions.length > 0 && (
                  <span style={{
                    fontSize: '0.62rem',
                    backgroundColor: '#0369a1',
                    color: '#e0f2fe',
                    padding: '0px 4px',
                    borderRadius: '10px',
                    lineHeight: '1.2'
                  }}>
                    {sessions.length}
                  </span>
                )}
              </button>

              {/* 方案 A: 懸浮選單 Popover */}
              {isHistoryOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '320px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)',
                  padding: '12px',
                  zIndex: 10000
                }}>
                  {/* Popover 標題與過濾切換 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #1e293b'
                  }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <History size={14} color="#38bdf8" />
                      歷史對話 ({sessions.length})
                    </div>
                    {project && (
                      <div style={{ display: 'flex', backgroundColor: '#1e293b', borderRadius: '6px', padding: '2px' }}>
                        <button
                          onClick={() => setHistoryScope('project')}
                          style={{
                            padding: '2px 6px',
                            fontSize: '0.68rem',
                            border: 'none',
                            borderRadius: '4px',
                            backgroundColor: historyScope === 'project' ? '#0284c7' : 'transparent',
                            color: historyScope === 'project' ? '#fff' : '#94a3b8',
                            cursor: 'pointer',
                            fontWeight: historyScope === 'project' ? 600 : 400
                          }}
                        >
                          本專案
                        </button>
                        <button
                          onClick={() => setHistoryScope('all')}
                          style={{
                            padding: '2px 6px',
                            fontSize: '0.68rem',
                            border: 'none',
                            borderRadius: '4px',
                            backgroundColor: historyScope === 'all' ? '#0284c7' : 'transparent',
                            color: historyScope === 'all' ? '#fff' : '#94a3b8',
                            cursor: 'pointer',
                            fontWeight: historyScope === 'all' ? 600 : 400
                          }}
                        >
                          全部
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 對話清單 */}
                  <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {isLoadingSessions ? (
                      <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                        <RefreshCw size={14} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} />
                        載入對話記錄中...
                      </div>
                    ) : sessions.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '0.75rem', color: '#64748b' }}>
                        暫無歷史對話記錄
                      </div>
                    ) : (
                      sessions.map((sess) => {
                        const isCurrent = sess.session_uid === currentSessionId;
                        const msgCount = Array.isArray(sess.messages) ? sess.messages.length : 0;
                        const dateStr = sess.updated_at ? new Date(sess.updated_at).toLocaleDateString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                        
                        return (
                          <div
                            key={sess.session_uid}
                            onClick={() => handleSelectSession(sess.session_uid)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              backgroundColor: isCurrent ? '#1e293b' : 'transparent',
                              border: `1px solid ${isCurrent ? '#38bdf8' : 'transparent'}`,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'background 0.15s',
                              gap: '8px'
                            }}
                            onMouseEnter={(e) => {
                              if (!isCurrent) e.currentTarget.style.backgroundColor = '#1e293b';
                            }}
                            onMouseLeave={(e) => {
                              if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{
                                fontSize: '0.78rem',
                                fontWeight: isCurrent ? 600 : 500,
                                color: isCurrent ? '#38bdf8' : '#f1f5f9',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}>
                                {isCurrent && (
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#38bdf8', flexShrink: 0 }} />
                                )}
                                {sess.title || '新對話'}
                              </div>
                              <div style={{
                                fontSize: '0.68rem',
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginTop: '2px'
                              }}>
                                <span>{dateStr}</span>
                                <span>•</span>
                                <span>{msgCount} 條對話</span>
                              </div>
                            </div>

                            <button
                              onClick={(e) => handleDeleteSession(e, sess.session_uid)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                              title="刪除此對話"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 全螢幕/側欄切換按鈕 */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{
                background: isFullscreen ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                border: isFullscreen ? '1px solid #a855f7' : 'none',
                color: isFullscreen ? '#d8b4fe' : '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title={isFullscreen ? '還原為側欄' : '全螢幕專注思考模式'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* 收起按鈕 */}
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              title="收起 AI Copilot"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 上下文模式指示橫幅 (Context Scope Status Banner) */}
        <div style={{
          padding: '8px 14px',
          backgroundColor: project ? '#0b192e' : '#140e28',
          borderBottom: '1px solid #1e293b',
          borderLeft: project ? '3px solid #38bdf8' : '3px solid #a855f7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, overflow: 'hidden' }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: project ? '#38bdf8' : '#c084fc',
              boxShadow: project ? '0 0 8px #38bdf8' : '0 0 8px #c084fc',
              flexShrink: 0
            }} />
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 700, color: project ? '#38bdf8' : '#c084fc' }}>
                {project ? '🎯 專案聚焦問答模式' : '🏢 全域工作區模式'}：
              </span>{' '}
              <strong style={{ color: '#f8fafc' }}>
                {project ? `[${project.project_display_code}] ${project.project_name}` : (workspace?.workspace_name || '工作區總覽')}
              </strong>
            </div>
          </div>
          <span style={{
            fontSize: '0.68rem',
            color: project ? '#93c5fd' : '#d8b4fe',
            backgroundColor: project ? 'rgba(56, 189, 248, 0.12)' : 'rgba(192, 132, 252, 0.12)',
            border: project ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(192, 132, 252, 0.3)',
            padding: '2px 6px',
            borderRadius: '4px',
            flexShrink: 0,
            fontWeight: 600
          }}>
            {project
              ? `${existingProjectItems.filter(i => i.related_project_uid === project.project_uid).length} 張工單已載入`
              : `${existingProjectItems.length} 張工單總覽`}
          </span>
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
        <div 
          className="copilot-chat-container"
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '16px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '14px',
            userSelect: 'text',
            WebkitUserSelect: 'text'
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                userSelect: 'text',
                WebkitUserSelect: 'text'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', maxWidth: '92%' }}>
                {msg.sender === 'ai' && (
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#581c87', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px', userSelect: 'none' }}>
                    <Bot size={14} color="#fff" />
                  </div>
                )}

                <div 
                  className="copilot-message-bubble"
                  style={{
                    backgroundColor: msg.sender === 'user' ? '#3b82f6' : '#0f172a',
                    color: '#f8fafc',
                    padding: '10px 14px',
                    borderRadius: msg.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    border: msg.sender === 'ai' ? '1px solid #1e293b' : 'none',
                    boxShadow: msg.sender === 'user' ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none',
                    userSelect: 'text',
                    WebkitUserSelect: 'text',
                    cursor: 'text'
                  }}
                >
                  {/* 附加檔案與圖片展示 */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px', userSelect: 'none' }}>
                      {msg.attachments.map((att, attIdx) => (
                        att.type === 'image' && att.dataUrl ? (
                          <div key={attIdx} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.25)', maxWidth: '240px', maxHeight: '180px' }}>
                            <img 
                              src={att.dataUrl} 
                              alt={att.name} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                              onClick={() => window.open(att.dataUrl, '_blank')}
                              title="點擊開啟原圖"
                            />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.65)', padding: '2px 6px', fontSize: '0.65rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {att.name}
                            </div>
                          </div>
                        ) : (
                          <div key={attIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', backgroundColor: msg.sender === 'user' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(30, 58, 138, 0.4)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', fontSize: '0.75rem', color: msg.sender === 'user' ? '#fff' : '#93c5fd' }}>
                            <FileText size={14} color={msg.sender === 'user' ? '#bfdbfe' : '#60a5fa'} />
                            <span style={{ fontWeight: 500 }}>{att.name}</span>
                            <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>({Math.round(att.size / 1024)} KB)</span>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                  {/* 深度思考推理過程摺疊卡片 */}
                  {msg.reasoningContent && (
                    <details style={{
                      marginBottom: '10px',
                      padding: '8px 10px',
                      backgroundColor: '#131127',
                      border: '1px solid #4338ca',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      color: '#cbd5e1',
                      userSelect: 'text'
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
                        fontSize: '0.75rem',
                        userSelect: 'text',
                        WebkitUserSelect: 'text'
                      }}>
                        {msg.reasoningContent}
                      </div>
                    </details>
                  )}

                  <div 
                    className="copilot-markdown-content"
                    style={{ 
                      fontSize: '0.85rem', 
                      lineHeight: 1.6,
                      userSelect: 'text',
                      WebkitUserSelect: 'text'
                    }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p style={{ margin: '0 0 8px 0', lineHeight: 1.6, userSelect: 'text' }}>{children}</p>,
                        table: ({ children }) => (
                          <div style={{ overflowX: 'auto', margin: '8px 0', borderRadius: '6px', border: '1px solid #334155', userSelect: 'text' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left', userSelect: 'text' }}>
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => <thead style={{ backgroundColor: '#1e293b', color: '#93c5fd', userSelect: 'text' }}>{children}</thead>,
                        tbody: ({ children }) => <tbody style={{ userSelect: 'text' }}>{children}</tbody>,
                        tr: ({ children }) => <tr style={{ borderBottom: '1px solid #1e293b', userSelect: 'text' }}>{children}</tr>,
                        th: ({ children }) => <th style={{ padding: '6px 10px', fontWeight: 600, whiteSpace: 'nowrap', userSelect: 'text' }}>{children}</th>,
                        td: ({ children }) => <td style={{ padding: '6px 10px', color: '#cbd5e1', userSelect: 'text' }}>{children}</td>,
                        ul: ({ children }) => <ul style={{ paddingLeft: '18px', margin: '4px 0 8px 0', userSelect: 'text' }}>{children}</ul>,
                        ol: ({ children }) => <ol style={{ paddingLeft: '18px', margin: '4px 0 8px 0', userSelect: 'text' }}>{children}</ol>,
                        li: ({ children }) => <li style={{ marginBottom: '3px', userSelect: 'text' }}>{children}</li>,
                        code: ({ children, ...props }: any) => (
                          <code
                            style={{
                              backgroundColor: '#1e293b',
                              color: '#38bdf8',
                              padding: '2px 5px',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              fontFamily: 'monospace',
                              userSelect: 'text',
                              WebkitUserSelect: 'text'
                            }}
                            {...props}
                          >
                            {children}
                          </code>
                        ),
                        pre: ({ children }: any) => (
                          <pre style={{
                            backgroundColor: '#090d16',
                            border: '1px solid #1e293b',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            overflowX: 'auto',
                            fontSize: '0.78rem',
                            margin: '8px 0',
                            userSelect: 'text',
                            WebkitUserSelect: 'text'
                          }}>
                            {children}
                          </pre>
                        ),
                        strong: ({ children }) => <strong style={{ color: '#f8fafc', fontWeight: 700, userSelect: 'text' }}>{children}</strong>,
                        h1: ({ children }) => <h1 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '10px 0 6px 0', color: '#f8fafc', userSelect: 'text' }}>{children}</h1>,
                        h2: ({ children }) => <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '8px 0 4px 0', color: '#f8fafc', userSelect: 'text' }}>{children}</h2>,
                        h3: ({ children }) => <h3 style={{ fontSize: '0.88rem', fontWeight: 600, margin: '6px 0 4px 0', color: '#93c5fd', userSelect: 'text' }}>{children}</h3>,
                        blockquote: ({ children }) => (
                          <blockquote style={{
                            borderLeft: '3px solid #6366f1',
                            paddingLeft: '10px',
                            margin: '6px 0',
                            color: '#94a3b8',
                            fontStyle: 'italic',
                            userSelect: 'text'
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

                  {/* 提示已展開右側 Proposal Canvas 工作台或多動作列表 */}
                  {(() => {
                    const actions = msg.actionPreviews && msg.actionPreviews.length > 0
                      ? msg.actionPreviews
                      : (msg.actionPreview ? [msg.actionPreview] : []);

                    if (actions.length === 0) return null;

                    // 多動作模式 (如 4-in-1 全套初始化)
                    if (actions.length > 1) {
                      const completedCount = actions.filter(a => a.applied).length;
                      const isAllApplied = actions.every(a => a.applied);
                      const totalItemCount = actions.reduce((acc, a) => acc + (a.items?.length || 1), 0);

                      return (
                        <div style={{
                          marginTop: '12px',
                          backgroundColor: isAllApplied ? 'rgba(6, 78, 59, 0.25)' : '#0f172a',
                          border: `1px solid ${isAllApplied ? '#059669' : '#3b82f6'}`,
                          borderRadius: '10px',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}>
                          {/* 頂部標題與狀態 */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                backgroundColor: isAllApplied ? '#064e3b' : '#1e3a8a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {isAllApplied ? <CheckCircle2 size={16} color="#34d399" /> : <Layers size={16} color="#38bdf8" />}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isAllApplied ? '#a7f3d0' : '#f8fafc' }}>
                                  {isAllApplied ? `✅ AI 架構提案已全數核准入庫 (${completedCount}/${actions.length} 組)` : `📦 AI 綜合架構提案 (共 ${totalItemCount} 項工單)`}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                  {isAllApplied ? '已同步寫入專案工單庫' : `涵蓋 ${actions.length} 個架構分組區塊，可一次過全覽審批`}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 分組清單摘要 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {actions.map((act, actIdx) => {
                              const isActApplied = Boolean(act.applied);
                              let actTitle = '';
                              let count = 1;
                              if (act.actionType === 'batch_proposal') {
                                actTitle = act.proposalTitle || `批次工單骨架 (${act.items?.length || 0} 個項目)`;
                                count = act.items?.length || 0;
                              } else if (act.actionType === 'create_item') {
                                actTitle = `新增 [${act.itemType || '工單'}]: ${act.itemTitle || '未命名項目'}`;
                                count = 1;
                              } else if (act.actionType === 'update_item') {
                                const code = act.targetDisplayCode ? `[${act.targetDisplayCode}] ` : '';
                                actTitle = `更新 ${code}${act.itemTitle || act.summary || '工單屬性與內容'}`;
                                count = 1;
                              } else if (act.actionType === 'consensus_proposal') {
                                actTitle = `決策共識: ${act.itemTitle || '架構定案'}`;
                                count = 1;
                              } else {
                                actTitle = act.proposalTitle || act.itemTitle || '專案作業提案';
                                count = 1;
                              }
                              return (
                                <div
                                  key={actIdx}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '5px 8px',
                                    backgroundColor: isActApplied ? 'rgba(6, 78, 59, 0.3)' : '#090d16',
                                    border: `1px solid ${isActApplied ? '#059669' : '#1e293b'}`,
                                    borderRadius: '5px',
                                    fontSize: '0.72rem'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isActApplied ? '#6ee7b7' : '#cbd5e1', fontWeight: 500, overflow: 'hidden' }}>
                                    {isActApplied ? <CheckCircle2 size={13} color="#34d399" /> : <Sparkles size={13} color="#818cf8" />}
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                                      {actTitle}
                                    </span>
                                  </div>
                                  <span style={{ color: '#64748b', fontSize: '0.68rem', flexShrink: 0 }}>
                                    {count} 項
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* 底部操作按鈕：審核完整畫布 + 一鍵執行 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const unified = buildUnifiedProposalStateFromMessage(msg, isAllApplied);
                                if (unified) setActiveProposal(unified);
                              }}
                              style={{
                                flex: 1,
                                padding: '6px 12px',
                                backgroundColor: isAllApplied ? '#065f46' : '#2563eb',
                                color: '#fff',
                                border: `1px solid ${isAllApplied ? '#059669' : '#3b82f6'}`,
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
                              }}
                            >
                              <Edit3 size={13} />
                              <span>{isAllApplied ? '查閱完整提案畫布' : `🔍 審核完整提案畫布 (${totalItemCount} 項)`}</span>
                            </button>

                            {!isAllApplied && (
                              <button
                                type="button"
                                onClick={() => handleApplyAllInMessage(msg)}
                                disabled={isSubmitting}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#1e293b',
                                  color: '#38bdf8',
                                  border: '1px solid #334155',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  whiteSpace: 'nowrap'
                                }}
                                title="直接全部執行入庫"
                              >
                                <Sparkles size={12} />
                                <span>{isSubmitting ? '執行中...' : '一鍵執行'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // 單一動作模式
                    const singleAction = actions[0];
                    const isMsgApplied = Boolean(
                      singleAction.applied || 
                      msg.text?.includes('✅ **已成功') || 
                      msg.text?.includes('📌 **已成功')
                    );

                    return (
                      <div style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        backgroundColor: isMsgApplied ? 'rgba(6, 78, 59, 0.35)' : '#131b2e',
                        border: `1px solid ${isMsgApplied ? '#059669' : '#3b82f6'}`,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.76rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isMsgApplied ? '#6ee7b7' : '#93c5fd', fontWeight: 600 }}>
                          {isMsgApplied ? <CheckCircle2 size={15} color="#34d399" /> : <Sparkles size={15} color="#38bdf8" />}
                          <span>
                            {isMsgApplied 
                              ? (singleAction.appliedSummary || '動作已成功執行入庫')
                              : (singleAction.proposalTitle || '已產生建議變更草案')}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const st = buildProposalStateFromAction(singleAction, msg.id, 0, isMsgApplied);
                            if (st) setActiveProposal(st);
                          }}
                          style={{
                            padding: '3px 9px',
                            backgroundColor: isMsgApplied ? '#065f46' : '#2563eb',
                            color: '#fff',
                            border: `1px solid ${isMsgApplied ? '#059669' : '#3b82f6'}`,
                            borderRadius: '5px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Edit3 size={12} />
                          {isMsgApplied ? '查看歷史' : '開啟審核'}
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {msg.sender === 'user' && (
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px', userSelect: 'none' }}>
                    <User size={14} color="#93c5fd" />
                  </div>
                )}
              </div>

              {/* 訊息底部：時間戳 + 模型資訊 + 一鍵複製按鈕 */}
              <div style={{ 
                fontSize: '0.7rem', 
                color: '#64748b', 
                marginTop: '4px', 
                padding: '0 4px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                userSelect: 'none'
              }}>
                <span>{msg.timestamp}</span>
                {msg.modelUsed && (
                  <span style={{ color: '#475569' }}>• {msg.modelUsed}</span>
                )}
                
                {/* 一鍵複製訊息按鈕 */}
                <button
                  type="button"
                  onClick={() => handleCopyMessage(msg.text, msg.id)}
                  style={{
                    background: copiedMsgId === msg.id ? 'rgba(52, 211, 153, 0.15)' : 'transparent',
                    border: copiedMsgId === msg.id ? '1px solid rgba(52, 211, 153, 0.4)' : '1px solid transparent',
                    color: copiedMsgId === msg.id ? '#34d399' : '#64748b',
                    cursor: 'pointer',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.68rem',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (copiedMsgId !== msg.id) {
                      e.currentTarget.style.color = '#94a3b8';
                      e.currentTarget.style.borderColor = '#334155';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (copiedMsgId !== msg.id) {
                      e.currentTarget.style.color = '#64748b';
                      e.currentTarget.style.borderColor = 'transparent';
                    }
                  }}
                  title="複製訊息內容 (Copy)"
                >
                  {copiedMsgId === msg.id ? (
                    <>
                      <Check size={11} color="#34d399" />
                      <span style={{ color: '#34d399', fontWeight: 600 }}>已複製</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      <span>複製</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}

          {isThinking && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#1e1b4b',
              border: '1px solid #6366f1',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#c084fc',
              fontSize: '0.8rem',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                <span>{enableThinking ? 'AI 正在進行深度邏輯推演與知識圖譜分析...' : 'AI 正在研讀專案脈絡與即時資料...'}</span>
              </div>
              <button
                type="button"
                onClick={handleStopGeneration}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
                  transition: 'background 0.15s ease'
                }}
                title="緊急停止 AI 生成"
              >
                <Square size={11} fill="#fff" />
                <span>中止 (Stop)</span>
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 底部輸入框與附件列 */}
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              processFiles(e.dataTransfer.files);
            }
          }}
          style={{
            padding: '12px 16px 14px 16px',
            borderTop: '1px solid #1e293b',
            backgroundColor: '#0f172a'
          }}
        >
          {/* 待發送附件預覽膠囊列表 */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {attachments.map((att, idx) => (
                <div 
                  key={idx} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #3b82f6',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '0.75rem',
                    color: '#e2e8f0',
                    maxWidth: '100%'
                  }}
                >
                  {att.type === 'image' && att.dataUrl ? (
                    <img src={att.dataUrl} alt={att.name} style={{ width: '20px', height: '20px', objectFit: 'cover', borderRadius: '3px' }} />
                  ) : (
                    <FileText size={13} color="#60a5fa" />
                  )}
                  <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {att.name}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>({Math.round(att.size / 1024)}KB)</span>
                  <button
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="移除附件"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ⚡ 推薦工作流快捷膠囊標籤 (Smart Workflow Chips) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '8px',
            scrollbarWidth: 'none'
          }}>
            {/* 快捷鍵：根據上載文件，新增/更新相關 item */}
            <button
              type="button"
              disabled={isThinking || isReadingFile}
              onClick={() => handleSendMessage('請根據我上載的文件內容進行專案記憶對齊：1. 嚴格依據文件事實提取顯式項目（Meeting、Objective、Requirement、User story、Task、UAT、Decision、Bottleneck、Milestone）；2. 忠實建立追溯關聯（保留缺層直連拓撲，嚴禁捏造不存在的層級）；3. 比對專案現有工單，僅對實質新條目執行建立，對相同條目保持現狀或增量更新。')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: attachments.length > 0 ? '#064e3b' : '#131b2e',
                color: attachments.length > 0 ? '#6ee7b7' : '#94a3b8',
                border: attachments.length > 0 ? '1px solid #10b981' : '1px solid #334155',
                borderRadius: '20px',
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: isThinking ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxShadow: attachments.length > 0 ? '0 2px 8px rgba(16, 185, 129, 0.25)' : 'none'
              }}
              title="自動比對上載文件與現有工單，忠實保留源頭真實性與增量更新"
            >
              <span>📄 根據上載文件，新增/更新相關 item</span>
            </button>

            <button
              type="button"
              disabled={isThinking || isReadingFile}
              onClick={() => handleSendMessage('這是一次專案 Kick-off 啟航會議。請執行專案初始化對齊：1. 提取會議完整記錄與元數據；2. 提取關鍵 Milestone 里程碑；3. 依據事實證據構建需求追溯拓撲（Objective ➔ Requirement ➔ User story ➔ Task ➔ UAT，缺層直連保留原貌）；4. 提煉架構決策與瓶頸並進行專案記憶比對。')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#172554',
                color: '#93c5fd',
                border: '1px solid #2563eb',
                borderRadius: '20px',
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: isThinking ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)'
              }}
              title="一鍵執行 Kick-off 專案章程、里程碑、真實需求拓撲與會議結構化對齊"
            >
              <span>🚀 Kick-off 啟航 (記憶對齊)</span>
            </button>

            <button
              type="button"
              disabled={isThinking || isReadingFile}
              onClick={() => handleSendMessage('請幫我整理這份會議紀錄：提煉出 Meeting 會議記錄主工單（完整保留原文與日期/出席者）、行動任務 (Tasks)、架構決策 (Decisions) 與技術阻礙 (Bottlenecks)，並依據事實證據建立工單與關聯。')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#131b2e',
                color: '#cbd5e1',
                border: '1px solid #334155',
                borderRadius: '20px',
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 500,
                cursor: isThinking ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
              title="提取會議記錄、行動任務與決策"
            >
              <span>👥 一般會議拆解</span>
            </button>

            <button
              type="button"
              disabled={isThinking || isReadingFile}
              onClick={() => handleSendMessage('請依據文件中的事實依據，整理需求追溯關係拓撲（Objective ➔ Requirement ➔ User story ➔ Task ➔ UAT），保留合法缺層直連，嚴禁捏造不存在的中間層級。')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#131b2e',
                color: '#cbd5e1',
                border: '1px solid #334155',
                borderRadius: '20px',
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 500,
                cursor: isThinking ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
              title="規劃真實需求追溯拓撲"
            >
              <span>🌲 事實 Traceability 拓撲</span>
            </button>

            <button
              type="button"
              disabled={isThinking || isReadingFile}
              onClick={() => handleSendMessage('請檢索並為本專案填寫 Project Charter 專案章程表格 (包含商業目標、範疇、KPI 矩陣與驗收基準)。')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#131b2e',
                color: '#cbd5e1',
                border: '1px solid #334155',
                borderRadius: '20px',
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 500,
                cursor: isThinking ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
              title="填寫或更新專案章程"
            >
              <span>📜 填寫 Charter 章程</span>
            </button>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#090d16',
            border: '1px solid #334155',
            borderRadius: '10px',
            padding: '6px 10px',
            gap: '8px'
          }}>
            {/* 隱藏的檔案選擇器 */}
            <input 
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              multiple
              accept=".md,.txt,.json,.csv,.pdf,.png,.jpg,.jpeg,.webp,.gif,.ts,.js,.py,.sql"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  processFiles(e.target.files);
                }
              }}
            />

            {/* 📎 附加檔案按鈕 */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isThinking || isReadingFile}
              title="上載文件 / 圖片 / 截圖 (.md, .txt, .pdf, .png, .jpg)"
              style={{
                background: 'none',
                border: 'none',
                color: attachments.length > 0 ? '#60a5fa' : '#94a3b8',
                cursor: isThinking || isReadingFile ? 'not-allowed' : 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'color 0.15s ease'
              }}
            >
              {isReadingFile ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Paperclip size={15} />}
            </button>

            {/* 語音輸入按鈕 (Speech-to-Text / Web Speech API) */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                onClick={toggleListening}
                disabled={isThinking}
                title={isListening ? '正在聆聽語音... (點擊停止)' : `語音輸入 (${speechLang === 'zh-HK' ? '廣東話' : speechLang === 'zh-TW' ? '普通話' : 'English'})`}
                style={{
                  background: isListening ? '#ef4444' : 'none',
                  border: isListening ? '1px solid #f87171' : 'none',
                  color: isListening ? '#ffffff' : '#94a3b8',
                  cursor: isThinking ? 'not-allowed' : 'pointer',
                  padding: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  boxShadow: isListening ? '0 0 12px rgba(239, 68, 68, 0.7)' : 'none',
                  animation: isListening ? 'pulse 1.5s infinite' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {isListening ? <Mic size={15} color="#fff" /> : <Mic size={15} />}
              </button>

              {/* 語音語言快速切換 */}
              <button
                type="button"
                onClick={() => setShowLangMenu(!showLangMenu)}
                title="切換語音辨識語言"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  padding: '2px 4px',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: '#93c5fd',
                  cursor: 'pointer',
                  marginLeft: '2px'
                }}
              >
                {speechLang === 'zh-HK' ? '粵' : speechLang === 'zh-TW' ? '國' : 'EN'}
              </button>

              {showLangMenu && (
                <div style={{
                  position: 'absolute',
                  bottom: '120%',
                  left: '0',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '4px',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
                  minWidth: '100px'
                }}>
                  <button
                    type="button"
                    onClick={() => { setSpeechLang('zh-HK'); setShowLangMenu(false); }}
                    style={{
                      background: speechLang === 'zh-HK' ? '#1e293b' : 'transparent',
                      color: speechLang === 'zh-HK' ? '#38bdf8' : '#cbd5e1',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '0.72rem',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    🇭🇰 廣東話 (粵語)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSpeechLang('zh-TW'); setShowLangMenu(false); }}
                    style={{
                      background: speechLang === 'zh-TW' ? '#1e293b' : 'transparent',
                      color: speechLang === 'zh-TW' ? '#38bdf8' : '#cbd5e1',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '0.72rem',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    🇹🇼 普通話 (國語)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSpeechLang('en-US'); setShowLangMenu(false); }}
                    style={{
                      background: speechLang === 'en-US' ? '#1e293b' : 'transparent',
                      color: speechLang === 'en-US' ? '#38bdf8' : '#cbd5e1',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '0.72rem',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    🇺🇸 English (US)
                  </button>
                </div>
              )}
            </div>

            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="與 AI 討論、貼上截圖 (Cmd+V) 或附加會議紀錄文件..."
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

            {isThinking ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                title="緊急停止生成 (Stop)"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Square size={13} fill="#fff" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={(!inputText.trim() && attachments.length === 0) || isReadingFile}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: (inputText.trim() || attachments.length > 0) && !isReadingFile ? '#7e22ce' : '#334155',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: (inputText.trim() || attachments.length > 0) && !isReadingFile ? 'pointer' : 'not-allowed',
                  transition: 'background 0.15s ease'
                }}
              >
                <Send size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* 2. 中央審核劇院 Studio Modal (Proposal Canvas) */}
      {activeProposal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(3, 7, 18, 0.78)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '24px',
            boxSizing: 'border-box'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveProposal(null);
            }
          }}
        >
          <div style={{
            width: '1020px',
            maxWidth: '94vw',
            height: '86vh',
            maxHeight: '880px',
            backgroundColor: '#0a0f1d',
            border: '1px solid #1e293b',
            borderRadius: '16px',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
          }}>
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
              updatesList={activeProposal.updatesList}
              onApplyUnified={handleApplyUnifiedProposal}
              onApplyBatch={handleApplyBatchProposal}
              onApplySingleCreate={handleApplySingleCreate}
              onApplySingleUpdate={handleApplySingleUpdate}
              onApplyConsensus={handleApplyConsensus}
              isApplied={Boolean(activeProposal.isApplied)}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}
    </>
  );
};
