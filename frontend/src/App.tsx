import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { SignInPage } from './pages/SignInPage';
import { AuthCallback } from './pages/AuthCallback';
import { Sidebar } from './components/Sidebar';
import { ProjectTable } from './components/ProjectTable';
import { ProjectDetailView } from './components/ProjectDetailView';
import { ProductDetailView } from './components/ProductDetailView';
import { AdvancedTable } from './components/AdvancedTable';
import { MemberTable } from './components/MemberTable';
import { ItemDrawer } from './components/ItemDrawer';
import { CopilotDrawer } from './components/CopilotDrawer';
import { Sparkles, Loader2 } from 'lucide-react';
import { api } from './utils/api';
import type { Workspace, Project, ProjectItem, Member } from './utils/api';
import './App.css';

// 路由守衛 (Auth Guard): 未認證導向登入頁面
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#020617',
        color: '#94a3b8',
        gap: '16px'
      }}>
        <Loader2 size={36} className="animate-spin" color="#6366f1" />
        <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>驗證身份中...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/sign-in" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// 主工作區儀表板核心元件 (Dashboard Application)
function DashboardApp() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  // 導航層級:
  // 1. activeNav 控制 Sidebar (product / project / all_items / members)
  // 2. selectedProject 控制是否進入該專案子頁面 (圖1 -> 圖2)
  const [activeNav, setActiveNav] = useState<'product' | 'project' | 'all_items' | 'members'>('project');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // 3. selectedDrawerItemUid 控制工單詳情滑出抽屜
  const [selectedDrawerItemUid, setSelectedDrawerItemUid] = useState<string | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [isCanvasExpanded, setIsCanvasExpanded] = useState<boolean>(false);

  // 4. 預設管理員身份
  const activeViewMemberUid = 'ADMIN';

  // 初始化讀取 Workspaces 與 Members
  const loadInitialData = async () => {
    try {
      const [wsList, memberList] = await Promise.all([
        api.getWorkspaces(),
        api.getMembers()
      ]);
      setWorkspaces(wsList);
      setMembers(memberList);

      if (wsList.length > 0) {
        const defaultWs = currentWorkspace 
          ? (wsList.find(w => w.workspace_uid === currentWorkspace.workspace_uid) || wsList[0])
          : wsList[0];
        setCurrentWorkspace(defaultWs);
      }
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
    }
  };

  // 切換 Workspace 重新讀取專案與項目
  const loadWorkspaceData = async () => {
    if (!currentWorkspace) return;
    try {
      const [prjList, itemList, wsList, memberList] = await Promise.all([
        api.getProjects({ workspace_uid: currentWorkspace.workspace_uid }),
        api.getItems({ workspace_uid: currentWorkspace.workspace_uid }),
        api.getWorkspaces(),
        api.getMembers()
      ]);
      setProjects(prjList);
      setItems(itemList);
      setWorkspaces(wsList);
      setMembers(memberList);

      const updatedCurrentWs = wsList.find(w => w.workspace_uid === currentWorkspace.workspace_uid);
      if (updatedCurrentWs) setCurrentWorkspace(updatedCurrentWs);

      // 若目前選取的 project 仍在該 workspace，同步更新實例
      setSelectedProject((prev) => {
        if (!prev) return null;
        return prjList.find(p => p.project_uid === prev.project_uid) || null;
      });
    } catch (err: any) {
      console.error('Failed to load workspace projects & items:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (currentWorkspace) {
      loadWorkspaceData();
    }
  }, [currentWorkspace]);

  // 三層階梯式權限繼承判定函式 (Three-tier Cascading Access Control)
  const isMemberAllowed = (itemAllowList?: any[], projectAllowList?: any[], workspaceAllowList?: any[]) => {
    if (activeViewMemberUid === 'ADMIN') return true;
    
    // Level 1: 工單/項目層級
    if (itemAllowList && Array.isArray(itemAllowList) && itemAllowList.length > 0) {
      const match = itemAllowList.some(m => (typeof m === 'string' ? m : m.member_uid) === activeViewMemberUid);
      if (match) return true;
    }

    // Level 2: 專案層級
    if (projectAllowList && Array.isArray(projectAllowList) && projectAllowList.length > 0) {
      const match = projectAllowList.some(m => (typeof m === 'string' ? m : m.member_uid) === activeViewMemberUid);
      if (match) return true;
    }

    // Level 3: 工作區層級
    if (workspaceAllowList && Array.isArray(workspaceAllowList) && workspaceAllowList.length > 0) {
      const match = workspaceAllowList.some(m => (typeof m === 'string' ? m : m.member_uid) === activeViewMemberUid);
      if (match) return true;
    }

    return false;
  };

  // 根據選擇的檢視身分過濾專案清單
  const visibleProjects = projects.filter(p => {
    if (activeViewMemberUid === 'ADMIN') return true;
    return isMemberAllowed(undefined, p.allow_access_member, currentWorkspace?.allow_access_member);
  });

  // 根據選擇的檢視身分過濾工單清單
  const visibleItems = items.filter(it => {
    if (activeViewMemberUid === 'ADMIN') return true;
    const parentPrj = projects.find(p => p.project_uid === it.related_project_uid);
    return isMemberAllowed(undefined, parentPrj?.allow_access_member, currentWorkspace?.allow_access_member);
  });

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      backgroundColor: '#020617',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* 1. 左側導航欄 (Sidebar) */}
      <Sidebar
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={(ws) => {
          setCurrentWorkspace(ws);
          setSelectedProject(null);
        }}
        onRefreshWorkspaces={loadInitialData}
        activeNav={activeNav}
        onNavChange={(nav) => {
          setActiveNav(nav);
          setSelectedProject(null);
        }}
      />

      {/* 2. 中間核心主工作區 (Main Content Stage) */}
      <main 
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minWidth: 0,
          backgroundColor: '#090d16',
          borderLeft: '1px solid #1e293b',
          transition: 'all 0.3s ease-in-out',
          marginRight: isCopilotOpen ? (isCanvasExpanded ? '920px' : '420px') : '0px'
        }}
      >
        {/* 全域頂部檢視身分切換 Bar (Impersonation / View As Bar) */}
        <header style={{
          height: '48px',
          borderBottom: '1px solid #1e293b',
          backgroundColor: 'rgba(2, 6, 23, 0.8)',
          backdropFilter: 'blur(8px)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.3px' }}>
              ⚡ Mission Control
            </span>
          </div>

          <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {user && (
              <span style={{ color: '#34d399', fontWeight: 500 }}>
                ● 已登入：{user.name} ({user.role})
              </span>
            )}
            <span style={{ color: '#475569' }}>|</span>
            <span>工作區: <strong style={{ color: '#f8fafc' }}>{currentWorkspace?.workspace_name || '載入中...'}</strong> {currentWorkspace && (
              (() => {
                const isCurrentWsOwn = Boolean(
                  currentWorkspace.owner_email &&
                  user?.email &&
                  currentWorkspace.owner_email.toLowerCase() === user.email.toLowerCase()
                );
                return (
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: isCurrentWsOwn ? 'rgba(99, 102, 241, 0.2)' : 'rgba(20, 184, 166, 0.2)',
                    color: isCurrentWsOwn ? '#a5b4fc' : '#5eead4',
                    border: isCurrentWsOwn ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(20, 184, 166, 0.4)',
                    marginLeft: '4px'
                  }}>
                    {isCurrentWsOwn ? '👑 Own' : '👥 Shared'}
                  </span>
                );
              })()
            )}</span>
            <span style={{ color: '#475569' }}>|</span>
            <span>前綴: <strong style={{ color: '#818cf8' }}>{currentWorkspace?.prefix_code || '---'}</strong></span>
          </div>
        </header>

        {/* 核心視圖路由器 (根據導航狀態渲染不同視圖) */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          backgroundColor: '#090d16'
        }}>
          {selectedProject ? (
            selectedProject.project_type === 'Product' ? (
              <ProductDetailView
                product={selectedProject}
                allProjects={projects}
                items={visibleItems}
                members={members}
                onBack={() => setSelectedProject(null)}
                onSelectProject={(prj) => setSelectedProject(prj)}
                onItemClick={(item) => setSelectedDrawerItemUid(item.item_uid)}
                onRefresh={loadWorkspaceData}
              />
            ) : (
              <ProjectDetailView
                project={selectedProject}
                items={visibleItems}
                members={members}
                onBack={() => setSelectedProject(null)}
                onItemClick={(item) => setSelectedDrawerItemUid(item.item_uid)}
                onRefresh={loadWorkspaceData}
              />
            )
          ) : (
            <>
              {activeNav === 'product' && (
                <ProjectTable
                  projects={visibleProjects.filter(p => p.project_type === 'Product')}
                  members={members}
                  currentWorkspaceUid={currentWorkspace?.workspace_uid || ''}
                  defaultType="Product"
                  onSelectProject={(prj) => setSelectedProject(prj)}
                  onRefresh={loadWorkspaceData}
                />
              )}

              {activeNav === 'project' && (
                <ProjectTable
                  projects={visibleProjects.filter(p => p.project_type === 'Project')}
                  members={members}
                  currentWorkspaceUid={currentWorkspace?.workspace_uid || ''}
                  defaultType="Project"
                  onSelectProject={(prj) => setSelectedProject(prj)}
                  onRefresh={loadWorkspaceData}
                />
              )}

              {activeNav === 'all_items' && (
                <AdvancedTable
                  title="All Items (工單總表)"
                  items={visibleItems}
                  projects={projects}
                  members={members}
                  currentWorkspaceUid={currentWorkspace?.workspace_uid}
                  onItemClick={(item) => setSelectedDrawerItemUid(item.item_uid)}
                  onRefresh={loadWorkspaceData}
                />
              )}

              {activeNav === 'members' && (
                <MemberTable
                  members={members}
                  workspace={currentWorkspace}
                  products={projects.filter(p => p.project_type === 'Product')}
                  projects={projects.filter(p => p.project_type === 'Project')}
                  onRefresh={loadInitialData}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* 3. 工單詳情滑出抽屜 (Item Drawer) */}
      <ItemDrawer
        itemUid={selectedDrawerItemUid}
        onClose={() => setSelectedDrawerItemUid(null)}
        onRefresh={loadWorkspaceData}
        members={members}
        projects={projects}
        onSelectAnotherItem={(uid: string) => setSelectedDrawerItemUid(uid)}
      />

      {/* 4. 右下角懸浮 AI Copilot 開啟按鈕 */}
      <button
        type="button"
        onClick={() => setIsCopilotOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          height: '48px',
          padding: '0 18px',
          borderRadius: '24px',
          backgroundColor: '#581c87',
          border: '1px solid #a855f7',
          color: '#f3e8ff',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 700,
          fontSize: '0.9rem',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(168, 85, 247, 0.5)',
          zIndex: 9000,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 24px rgba(168, 85, 247, 0.7)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(168, 85, 247, 0.5)';
        }}
      >
        <Sparkles size={18} color="#f3e8ff" />
        <span>AI Copilot</span>
      </button>

      {/* 5. 全域 AI Copilot 右側抽屜 (Actionable Copilot Drawer) */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => {
          setIsCopilotOpen(false);
          setIsCanvasExpanded(false);
        }}
        workspace={currentWorkspace}
        project={selectedProject}
        items={visibleItems}
        activeMemberUid={activeViewMemberUid}
        onRefresh={loadWorkspaceData}
        onCanvasToggle={(expanded) => setIsCanvasExpanded(expanded)}
      />
    </div>
  );
}

// 根路由設定 (Root App with React Router & AuthProvider)
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Landing Page (Public) */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/landing" element={<LandingPage />} />

          {/* Auth Routes */}
          <Route path="/auth/sign-in" element={<SignInPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected App Routes */}
          <Route
            path="/app/*"
            element={
              <ProtectedRoute>
                <DashboardApp />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <DashboardApp />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

