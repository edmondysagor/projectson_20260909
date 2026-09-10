import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ProjectTable } from './components/ProjectTable';
import { ProjectDetailView } from './components/ProjectDetailView';
import { AdvancedTable } from './components/AdvancedTable';
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
      const [prjList, itemList] = await Promise.all([
        api.getProjects({ workspace_uid: currentWorkspace.workspace_uid }),
        api.getItems({ workspace_uid: currentWorkspace.workspace_uid })
      ]);
      setProjects(prjList);
      setItems(itemList);

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
          /* 成員視圖 */
          <div style={{ padding: '32px', color: '#f8fafc' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>工作區成員列表 (Members)</h1>
            <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#131b2e', color: '#94a3b8', fontSize: '0.8rem' }}>
                    <th style={{ padding: '12px 16px' }}>姓名</th>
                    <th style={{ padding: '12px 16px' }}>電子郵件</th>
                    <th style={{ padding: '12px 16px' }}>AD 群組</th>
                    <th style={{ padding: '12px 16px' }}>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.member_uid} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{m.member_name}</td>
                      <td style={{ padding: '12px 16px', color: '#38bdf8' }}>{m.member_email}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{m.member_ad_group || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 8px', background: '#064e3b', color: '#6ee7b7', borderRadius: '10px', fontSize: '0.75rem' }}>
                          {m.member_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : selectedProject ? (
          /* 層級 2: 指定 Project 子頁面 (對齊 圖2: 專案詳情、各 Item View Tab、Traceability Matrix、右側屬性欄) */
          <ProjectDetailView
            project={selectedProject}
            items={items}
            members={members}
            onBack={() => setSelectedProject(null)}
            onRefresh={loadWorkspaceData}
            onItemClick={(item) => setSelectedDrawerItemUid(item.item_uid)}
          />
        ) : activeNav === 'project' ? (
          /* 層級 1: 專案總表 (對齊 圖1: 專案總表 List View，點擊 Display Code 進入指定 Project) */
          <ProjectTable
            projects={projects.filter(p => p.project_type === 'Project')}
            members={members}
            onRefresh={loadWorkspaceData}
            onSelectProject={(p) => setSelectedProject(p)}
            currentWorkspaceUid={currentWorkspace.workspace_uid}
          />
        ) : activeNav === 'product' ? (
          /* 產品總表 */
          <ProjectTable
            projects={projects.filter(p => p.project_type === 'Product')}
            members={members}
            onRefresh={loadWorkspaceData}
            onSelectProject={(p) => setSelectedProject(p)}
            currentWorkspaceUid={currentWorkspace.workspace_uid}
          />
        ) : (
          /* 所有工單總表 (All Items View) */
          <AdvancedTable
            title="所有工單總表 (All Items Table View)"
            items={items}
            projects={projects}
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
        members={members}
        projects={projects}
      />
    </div>
  );
}
