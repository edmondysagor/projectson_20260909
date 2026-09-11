import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ProjectTable } from './components/ProjectTable';
import { ProjectDetailView } from './components/ProjectDetailView';
import { ProductDetailView } from './components/ProductDetailView';
import { AdvancedTable } from './components/AdvancedTable';
import { MemberTable } from './components/MemberTable';
import { ItemDrawer } from './components/ItemDrawer';
import { api } from './utils/api';
import type { Workspace, Project, ProjectItem, Member } from './utils/api';
import './App.css';

export default function App() {
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
  const [loading, setLoading] = useState(true);

  // 4. 檢視身份切換 (User Impersonation / View As: 'ADMIN' 或 member_uid)
  const [activeViewMemberUid, setActiveViewMemberUid] = useState<string>('ADMIN');

  // 初始化讀取 Workspaces 與 Members
  const loadInitialData = async () => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
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
      if (selectedProject) {
        const refreshedPrj = prjList.find(p => p.project_uid === selectedProject.project_uid);
        if (refreshedPrj) setSelectedProject(refreshedPrj);
      }
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
  const isProjectAccessible = (project: Project, memberUid: string): boolean => {
    if (memberUid === 'ADMIN') return true;
    if (!currentWorkspace) return true;

    // 1. 工作空間全域通行 (Workspace Scope)
    const wsUids = (currentWorkspace.allow_access_member || []).map((item: any) =>
      typeof item === 'string' ? item : item?.member_uid
    ).filter(Boolean);
    if (wsUids.includes(memberUid)) return true;

    // 2. 產品級通行 (Product Scope)
    if (project.project_type === 'Product') {
      const prodUids = (project.allow_access_member || []).map((item: any) =>
        typeof item === 'string' ? item : item?.member_uid
      ).filter(Boolean);
      return prodUids.includes(memberUid);
    }

    // 3. 專案級通行 (Project Scope)
    // 3a. 由母產品繼承
    if (project.parent_project_uid) {
      const parentProd = projects.find(p => p.project_uid === project.parent_project_uid);
      if (parentProd) {
        const parentUids = (parentProd.allow_access_member || []).map((item: any) =>
          typeof item === 'string' ? item : item?.member_uid
        ).filter(Boolean);
        if (parentUids.includes(memberUid)) return true;
      }
    }

    // 3b. 個別專案直接授權
    const prjUids = (project.allow_access_member || []).map((item: any) =>
      typeof item === 'string' ? item : item?.member_uid
    ).filter(Boolean);
    return prjUids.includes(memberUid);
  };

  // 根據當前切換之身份過濾可見之專案與工單
  const visibleProjects = projects.filter(p => isProjectAccessible(p, activeViewMemberUid));
  const visibleProjectUids = new Set(visibleProjects.map(p => p.project_uid));
  const visibleItems = items.filter(i => activeViewMemberUid === 'ADMIN' || visibleProjectUids.has(i.related_project_uid));

  const activeMemberObj = members.find(m => m.member_uid === activeViewMemberUid);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#090d16' }}>
      {/* 1. 左側側邊欄 (Sidebar) */}
      <Sidebar
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={(ws) => {
          setCurrentWorkspace(ws);
          setSelectedProject(null); // 切換工作區重置子頁面
        }}
        onRefreshWorkspaces={loadInitialData}
        activeNav={activeNav}
        onNavChange={(nav) => {
          setActiveNav(nav);
          setSelectedProject(null); // 切換側欄導航重置子頁面回到總表
        }}
      />

      {/* 2. 主內容工作區 (Main Canvas) */}
      <main style={{ flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* 頂部檢視身份切換條 (User Impersonation / View As Bar) */}
        <div
          style={{
            height: '42px',
            backgroundColor: activeViewMemberUid === 'ADMIN' ? '#0c1222' : '#1e1b4b',
            borderBottom: activeViewMemberUid === 'ADMIN' ? '1px solid #1e293b' : '1px solid #4338ca',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: '#94a3b8',
            flexShrink: 0,
            transition: 'background-color 0.2s, border-color 0.2s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 600, color: activeViewMemberUid === 'ADMIN' ? '#94a3b8' : '#c084fc' }}>
              {activeViewMemberUid === 'ADMIN' ? '👀 檢視身份模式:' : '🎭 權限預覽模式 (模擬外人/成員視角):'}
            </span>
            <select
              value={activeViewMemberUid}
              onChange={(e) => {
                setActiveViewMemberUid(e.target.value);
                setSelectedProject(null); // 切換身份時重置回總表避免檢視無權專案
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: activeViewMemberUid === 'ADMIN' ? '#131b2e' : '#312e81',
                border: activeViewMemberUid === 'ADMIN' ? '1px solid #334155' : '1px solid #6366f1',
                color: activeViewMemberUid === 'ADMIN' ? '#f8fafc' : '#e0e7ff',
                fontSize: '0.8rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ADMIN">👑 全域管理員 (All Access / Admin)</option>
              <optgroup label="── 工作空間成員 (Members) ──">
                {members.map(m => (
                  <option key={m.member_uid} value={m.member_uid}>
                    👤 {m.member_name} ({m.member_email})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {activeViewMemberUid !== 'ADMIN' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#a5b4fc', fontSize: '0.78rem' }}>
                目前以 <strong>{activeMemberObj?.member_name}</strong> 視角過濾中 (可見 {visibleProjects.length} 個專案/產品)
              </span>
              <button
                onClick={() => setActiveViewMemberUid('ADMIN')}
                style={{
                  padding: '3px 10px',
                  backgroundColor: '#4338ca',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                重置為 Admin
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
            連接 Neon PostgreSQL 資料庫中...
          </div>
        ) : !currentWorkspace ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
            <h2>尚未選擇工作區</h2>
            <p>請在左側建立或選擇一個 Workspace 開始使用</p>
          </div>
        ) : activeNav === 'members' ? (
          /* 成員視圖 (Level 0: Workspace Member Table View，含集中權限管理抽屜) */
          <MemberTable
            members={members}
            workspace={currentWorkspace}
            products={projects.filter(p => p.project_type === 'Product')}
            projects={projects.filter(p => p.project_type === 'Project')}
            onRefresh={loadWorkspaceData}
          />
        ) : selectedProject ? (
          /* 層級 2: 指定 Product 或 Project 子頁面 */
          selectedProject.project_type === 'Product' ? (
            /* 指定 Product 子頁面 (對齊 圖1: 產品願景、附屬關聯專案列表、Update & Deployment 3欄式矩陣、右側產品屬性欄) */
            <ProductDetailView
              product={selectedProject}
              allProjects={visibleProjects}
              items={visibleItems}
              members={members}
              onBack={() => setSelectedProject(null)}
              onRefresh={loadWorkspaceData}
              onRefreshMembers={loadInitialData}
              onSelectProject={(p) => setSelectedProject(p)}
              onItemClick={(item) => setSelectedDrawerItemUid(item.item_uid)}
            />
          ) : (
            /* 指定 Project 子頁面 (對齊 圖2: 專案詳情、各 Item View Tab、Traceability Matrix、右側屬性欄) */
            <ProjectDetailView
              project={selectedProject}
              items={visibleItems}
              members={members}
              products={visibleProjects.filter(p => p.project_type === 'Product')}
              onBack={() => setSelectedProject(null)}
              onRefresh={loadWorkspaceData}
              onRefreshMembers={loadInitialData}
              onItemClick={(item) => setSelectedDrawerItemUid(item.item_uid)}
            />
          )
        ) : activeNav === 'project' ? (
          /* 層級 1: 專案總表 (對齊 圖1: 專案總表 List View，點擊 Display Code 進入指定 Project) */
          <ProjectTable
            projects={visibleProjects.filter(p => p.project_type === 'Project')}
            members={members}
            onRefresh={loadWorkspaceData}
            onSelectProject={(p) => setSelectedProject(p)}
            currentWorkspaceUid={currentWorkspace.workspace_uid}
            defaultType="Project"
          />
        ) : activeNav === 'product' ? (
          /* 產品總表 */
          <ProjectTable
            projects={visibleProjects.filter(p => p.project_type === 'Product')}
            members={members}
            onRefresh={loadWorkspaceData}
            onSelectProject={(p) => setSelectedProject(p)}
            currentWorkspaceUid={currentWorkspace.workspace_uid}
            defaultType="Product"
          />
        ) : (
          /* 所有工單總表 (All Items View) */
          <AdvancedTable
            title="所有工單總表 (All Items Table View)"
            items={visibleItems}
            projects={visibleProjects}
            members={members}
            onRefresh={loadWorkspaceData}
            onItemClick={(item) => setSelectedDrawerItemUid(item.item_uid)}
          />
        )}
      </main>

      {/* 3. 工單詳情抽屜 (Item Drawer) */}
      <ItemDrawer
        itemUid={selectedDrawerItemUid}
        onClose={() => setSelectedDrawerItemUid(null)}
        onRefresh={loadWorkspaceData}
        onRefreshMembers={loadInitialData}
        members={members}
        projects={projects}
        onSelectAnotherItem={(uid) => setSelectedDrawerItemUid(uid)}
      />
    </div>
  );
}
