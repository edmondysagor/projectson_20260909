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
          /* 成員視圖 (Level 0: Workspace Member Table View，參考 All Items 格式，含大標題、Search Bar、Filter、Inline Edit、框底快速新增) */
          <MemberTable
            members={members}
            onRefresh={loadInitialData}
          />
        ) : selectedProject ? (
          /* 層級 2: 指定 Product 或 Project 子頁面 */
          selectedProject.project_type === 'Product' ? (
            /* 指定 Product 子頁面 (對齊 圖1: 產品願景、附屬關聯專案列表、Update & Deployment 3欄式矩陣、右側產品屬性欄) */
            <ProductDetailView
              product={selectedProject}
              allProjects={projects}
              items={items}
              members={members}
              onBack={() => setSelectedProject(null)}
              onRefresh={loadWorkspaceData}
              onSelectProject={(p) => setSelectedProject(p)}
              onItemClick={(item) => setSelectedDrawerItemUid(item.item_uid)}
            />
          ) : (
            /* 指定 Project 子頁面 (對齊 圖2: 專案詳情、各 Item View Tab、Traceability Matrix、右側屬性欄) */
            <ProjectDetailView
              project={selectedProject}
              items={items}
              members={members}
              products={projects.filter(p => p.project_type === 'Product')}
              onBack={() => setSelectedProject(null)}
              onRefresh={loadWorkspaceData}
              onItemClick={(item) => setSelectedDrawerItemUid(item.item_uid)}
            />
          )
        ) : activeNav === 'project' ? (
          /* 層級 1: 專案總表 (對齊 圖1: 專案總表 List View，點擊 Display Code 進入指定 Project) */
          <ProjectTable
            projects={projects.filter(p => p.project_type === 'Project')}
            members={members}
            onRefresh={loadWorkspaceData}
            onSelectProject={(p) => setSelectedProject(p)}
            currentWorkspaceUid={currentWorkspace.workspace_uid}
            defaultType="Project"
          />
        ) : activeNav === 'product' ? (
          /* 產品總表 */
          <ProjectTable
            projects={projects.filter(p => p.project_type === 'Product')}
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
        onRefreshMembers={loadInitialData}
        members={members}
        projects={projects}
        onSelectAnotherItem={(uid) => setSelectedDrawerItemUid(uid)}
      />
    </div>
  );
}
