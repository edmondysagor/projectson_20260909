// @ts-nocheck
import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { CanvasPane } from './components/CanvasPane';
import { CopilotPane } from './components/CopilotPane';
import { ProposalDiffCard } from './components/ProposalDiffCard';
import { api } from './utils/api';
import type { Task, Meeting, Bottleneck, KnowledgeNote, ToolProposal, ChatMessage, Project, Product, Workspace, Member, } from './utils/api';

type TabType = 'kanban' | 'tasks' | 'projects' | 'products' | 'meetings' | 'bottlenecks' | 'knowledge' | 'documents' | 'user' | 'workspaces' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeNote[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  
  const [selectedSubItemId, setSelectedSubItemId] = useState<string | null>('task-table');
  
  const [proposals, setProposals] = useState<ToolProposal[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [filterProject, setFilterProject] = useState('');
  const [filterWorkspace, setFilterWorkspace] = useState('');

  // 1. Fetch data from Neon DB
  const refreshData = async () => {
    try {
      const [allTasks, allMeetings, allBottlenecks, allKnowledge, allProjects, allProducts, allWorkspaces, allMembers, ] = await Promise.all([
        api.getTasks(),
        api.getMeetings(),
        api.getBottlenecks(),
        api.getKnowledge(),
        api.getProjects(),
        api.getProducts(),
        api.getWorkspaces(),
        api.getMembers()
      ]);
      setTasks(allTasks);
      setMeetings(allMeetings);
      setBottlenecks(allBottlenecks);
      setKnowledge(allKnowledge);
      setProjects(allProjects);
      setProducts(allProducts);
      setWorkspaces(allWorkspaces);
      setMembers(allMembers);
    } catch (error) {
      console.error('Error fetching data from API:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([
        refreshData(),
        api.getChatHistory().then((history) => setChatHistory(history)).catch(() => {}),
      ]);
      setIsLoading(false);
    };
    init();
  }, []);

  // Sync default selection when category changes
  useEffect(() => {
    if (isLoading) return;
    if (activeTab === 'tasks') {
      if (selectedSubItemId === 'task-table' || tasks.some(t => t.id === selectedSubItemId)) return;
      setSelectedSubItemId('task-table');
    } else if (activeTab === 'projects') {
      if (selectedSubItemId === 'project-table' || projects.some(p => p.id === selectedSubItemId)) return;
      setSelectedSubItemId('project-table');
    } else if (activeTab === 'products') {
      if (selectedSubItemId === 'product-table' || products.some(p => p.id === selectedSubItemId)) return;
      setSelectedSubItemId('product-table');
    } else if (activeTab === 'meetings') {
      if (selectedSubItemId === 'meeting-table' || meetings.some(m => m.id === selectedSubItemId)) return;
      setSelectedSubItemId('meeting-table');
    } else if (activeTab === 'bottlenecks') {
      if (selectedSubItemId === 'bottleneck-table' || bottlenecks.some(b => b.id === selectedSubItemId)) return;
      setSelectedSubItemId('bottleneck-table');
    } else if (activeTab === 'knowledge') {
      if (selectedSubItemId === 'knowledge-table' || knowledge.some(k => k.id === selectedSubItemId)) return;
      setSelectedSubItemId('knowledge-table');
    } else if (activeTab === 'user') {
      if (selectedSubItemId === 'user-profile' || selectedSubItemId === 'user-security' || selectedSubItemId === 'user-notifications') return;
      setSelectedSubItemId('user-profile');
    } else if (activeTab === 'workspaces') {
      if (selectedSubItemId === 'workspace-table' || workspaces.some(w => String(w.workspace_id) === selectedSubItemId)) return;
      setSelectedSubItemId('workspace-table');
    }
  }, [activeTab, isLoading, selectedSubItemId, tasks, projects, products, meetings, bottlenecks, knowledge, workspaces]);

  // 2. Chat / Transcript sender
  const handleSendMessage = async (messageText: string) => {
    setIsGenerating(true);
    const userMsg: ChatMessage = {
      sender: 'user',
      message: messageText,
      created_at: new Date().toISOString()
    };
    setChatHistory((prev) => [...prev, userMsg]);

    try {
      const result = await api.parseTranscript(messageText);
      setChatHistory((prev) => [...prev, result.chatMessage]);
      setProposals((prev) => [...prev, ...result.proposals]);
    } catch (error) {
      console.error('Error during transcript parsing:', error);
      setChatHistory((prev) => [
        ...prev,
        {
          sender: 'assistant',
          message: '❌ 解析失敗，請檢查 API 與資料庫連線。',
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. HITL Actions
  const handleAcceptProposal = async (proposal: ToolProposal) => {
    const result = await api.acceptProposal(proposal);
    if (result.success) {
      await refreshData();
      
      // Discard accepted proposal from local queue
      setProposals((prev) => prev.filter((p) => p.id !== proposal.id));

      // Auto-select and redirect viewport to modified doc
      const record = result.record;
      if (record) {
        if (proposal.targetType === 'task') {
          setActiveTab('tasks');
          setSelectedSubItemId(record.id);
        } else if (proposal.targetType === 'meeting') {
          setActiveTab('meetings');
          setSelectedSubItemId(record.id);
        } else if (proposal.targetType === 'charter') {
          setActiveTab('projects');
          setSelectedSubItemId('project-charter');
        } else if (proposal.targetType === 'requirement') {
          setActiveTab('projects');
          setSelectedSubItemId(record.id);
        } else if (proposal.targetType === 'plan') {
          setActiveTab('projects');
          setSelectedSubItemId('project-plan');
        } else if (proposal.targetType === 'traceability') {
          setActiveTab('projects');
          setSelectedSubItemId('project-traceability');
        } else if (proposal.targetType === 'bottleneck') {
          setActiveTab('bottlenecks');
          setSelectedSubItemId(record.id);
        } else if (proposal.targetType === 'knowledge') {
          setActiveTab('knowledge');
          setSelectedSubItemId(record.id);
        }
      }
    }
  };

  const handleRejectProposal = (id: string) => {
    setProposals((prev) => prev.filter((p) => p.id !== id));
  };

  // 4. Update Actions
  const handleUpdateTask = async (id: string, updates: any) => {
    await api.updateTask(id, updates);
    await refreshData();
  };

  const handleUpdateMeeting = async (id: string, updates: any) => {
    await api.updateMeeting(id, updates);
    await refreshData();
  };

  const handleUpdateCharter = async (_id: string, updates: any) => {};

  const handleUpdateRequirement = async (id: string, updates: any) => {};

  const handleUpdatePlan = async (id: string, updates: any) => {};

  const handleUpdateBottleneck = async (id: string, updates: any) => {
    await api.updateBottleneck(id, updates);
    await refreshData();
  };

  const handleUpdateKnowledge = async (id: string, updates: any) => {
    await api.updateKnowledge(id, updates);
    await refreshData();
  };

  const handleUpdateProduct = async (id: string, updates: any) => {
    await api.updateProduct(id, updates);
    await refreshData();
  };

  const handleUpdateProject = async (id: string, updates: any) => {
    await api.updateProject(id, updates);
    await refreshData();
  };

  const handleUpdateMember = async (id: string, updates: any) => {
    await api.updateMember(id, updates);
    await refreshData();
  };

  const handleUpdateWorkspace = async (id: string, updates: any) => {
    await api.updateWorkspace(id, updates);
    await refreshData();
  };

  const handleDeleteItem = async (id: string) => {
    await api.deleteItem(id);
    await refreshData();
  };

  const handleDeleteProject = async (id: string) => {
    await api.deleteProject(id);
    await refreshData();
  };

  const handleDeleteProduct = async (id: string) => {
    await api.deleteProduct(id);
    await refreshData();
  };

  const handleDeleteMember = async (id: string) => {
    await api.deleteMember(id);
    await refreshData();
  };

  const handleDeleteWorkspace = async (id: string) => {
    await api.deleteWorkspace(id);
    await refreshData();
  };

  const handleCreateTraceabilityLink = async (reqId: string, taskId: string) => {};

  const handleDeleteTraceabilityLink = async (id: string) => {};

  // 5. Manual creation from side list
  const handleCreateNew = async () => {
    if (activeTab === 'products') {
      const wsId = filterWorkspace || workspaces[0]?.workspace_id || 'a0000000-0000-0000-0000-000000000001';
      const newProduct = await api.createProduct({
        id: 'PROD-' + Date.now(),
        name: 'New Product',
        business_owner: 'Unassigned',
        tech_owner: 'Unassigned',
        product_vision: '請在此輸入產品願景。',
        related_workspace_id: wsId,
        remarks_entry: '使用者手動建立產品項目'
      });
      await refreshData();
      setSelectedSubItemId(newProduct.id);
      return newProduct;
    } else if (activeTab === 'tasks') {
      const newTask = await api.createTask({
        item_title: 'New Task',
        item_type: 'Task',
        item_status: 'Not Start',
        item_priority: 'Middle',
        item_content: {
          description: '手動建立的任務工單。'
        },
        remarks_entry: '使用者手動建立任務'
      });
      await refreshData();
      return newTask;
    } else if (activeTab === 'meetings') {
      const newMeeting = await api.createMeeting({
        title: 'New Meeting',
        content: '| 序號 | 討論事項 | 決議/行動方案 | 負責人 | 狀態 |\n|---|---|---|---|---|\n| 1 | 初始化 | 建立文件流水帳 | Edmond | 已完成 |',
        summary: '手動建立的會議記錄。',
        remarks_entry: '使用者手動建立會議'
      });
      await refreshData();
      return newMeeting;
    } else if (activeTab === 'projects') {
      const newProj = await api.createProject({
        content_name: 'New Project',
        related_workspace_id: 1,
        content_status: 'Active',
        project_type: 'Phase',
        project_type_sequence: 1,
        content: {},
        remarks_entry: '使用者手動建立專案項目'
      } as any);
      await refreshData();
      return newProj;
    } else if (activeTab === 'bottlenecks') {
      const newBottleneck = await api.createBottleneck({
        project_id: 1,
        title: 'New Bottleneck',
        description: '阻礙詳細說明...',
        severity: 'Middle',
        status: 'Not Start',
        remarks_entry: '使用者手動建立專案瓶頸'
      });
      await refreshData();
      return newBottleneck;
    } else if (activeTab === 'knowledge') {
      const newKnowledge = await api.createKnowledge({
        product_id: 2,
        term: 'New Term',
        definition: '定義內容...',
        kpi_formula: null,
        remarks_entry: '使用者手動建立術語定義'
      });
      await refreshData();
      return newKnowledge;
    } else if (activeTab === 'user') {
      const newMember = await api.createMember({
        member_name: 'New Member',
        member_role: 'Collaborator',
        member_status: 'Active'
      });
      await refreshData();
      setSelectedSubItemId('user-table');
      return newMember;
    } else if (activeTab === 'workspaces') {
      const newWs = await api.createWorkspace({
        prefix_code: 'NEW',
        workspace_name: 'New Workspace',
        last_item_number: 0
      });
      await refreshData();
      setSelectedSubItemId('workspace-table');
      return newWs;
    }
    return null;
  };

  return (
    <div className="dashboard-container" style={{ gridTemplateColumns: isCopilotOpen ? '260px 1fr 400px' : '260px 1fr' }}>
      {/* Column 1: Tree-based sidebar navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        selectedSubItemId={selectedSubItemId}
        setSelectedSubItemId={setSelectedSubItemId}
        workspaces={workspaces}
        products={products}
        projects={projects}
        filterProject={filterProject}
        setFilterProject={setFilterProject}
        filterWorkspace={filterWorkspace}
        setFilterWorkspace={setFilterWorkspace}
        onRefreshData={refreshData}
      />

      {/* Floating Toggle Co-pilot Button */}
      <button 
        onClick={() => setIsCopilotOpen(!isCopilotOpen)}
        style={{
          position: 'absolute',
          right: isCopilotOpen ? '412px' : '12px',
          top: '12px',
          zIndex: 1000,
          backgroundColor: 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#F8FAFC',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        title={isCopilotOpen ? "隱藏 Co-pilot" : "顯示 Co-pilot"}
      >
        <span>{isCopilotOpen ? '➡️' : '🤖'}</span>
        <span>{isCopilotOpen ? '隱藏 Co-pilot' : 'AI Co-pilot'}</span>
      </button>

      {/* Column 3: Canvas visual board / detail editor */}
      {isLoading ? (
        <div style={styles.loading}>載入資料庫中...</div>
      ) : (
        <CanvasPane
          activeTab={activeTab}
          selectedSubItemId={selectedSubItemId}
          tasks={tasks}
          meetings={meetings}
          bottlenecks={bottlenecks}
          knowledge={knowledge}
          projects={projects}
          products={products}
          workspaces={workspaces}
          members={members}
          onUpdateTask={handleUpdateTask}
          onUpdateMeeting={handleUpdateMeeting}
          onUpdateCharter={handleUpdateCharter}
          onUpdateRequirement={handleUpdateRequirement}
          onUpdatePlan={handleUpdatePlan}
          onUpdateBottleneck={handleUpdateBottleneck}
          onUpdateKnowledge={handleUpdateKnowledge}
          onUpdateProduct={handleUpdateProduct}
          onUpdateProject={handleUpdateProject}
          onUpdateMember={handleUpdateMember}
          onUpdateWorkspace={handleUpdateWorkspace}
          onDeleteItem={handleDeleteItem}
          onDeleteProject={handleDeleteProject}
          onDeleteProduct={handleDeleteProduct}
          onDeleteMember={handleDeleteMember}
          onDeleteWorkspace={handleDeleteWorkspace}
          onCreateTraceability={handleCreateTraceabilityLink}
          onDeleteTraceability={handleDeleteTraceabilityLink}
          onSelectSubItem={setSelectedSubItemId}
          onCreateNew={handleCreateNew}
          onRefreshData={refreshData}
          filterProject={filterProject}
          setFilterProject={setFilterProject}
          filterWorkspace={filterWorkspace}
          setFilterWorkspace={setFilterWorkspace}
        />
      )}

      {/* Column 4: Co-Pilot panel */}
      {isCopilotOpen && (
        <div style={styles.rightDashboardColumn}>
          <CopilotPane
            chatHistory={chatHistory}
            onSendMessage={handleSendMessage}
            isGenerating={isGenerating}
          />
          <ProposalDiffCard
            proposals={proposals}
            onAccept={handleAcceptProposal}
            onReject={handleRejectProposal}
          />
        </div>
      )}
    </div>
  );
}

const styles = {
  rightDashboardColumn: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#07090F',
    width: '400px',
  },
  loading: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    fontSize: '15px',
    backgroundColor: '#0E1321',
  },
};

export default App;
