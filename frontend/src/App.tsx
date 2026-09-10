import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { AdvancedTable } from './components/AdvancedTable';
import { ItemDrawer } from './components/ItemDrawer';
import { TraceabilityMatrix } from './components/TraceabilityMatrix';
import { api } from './utils/api';
import type { Workspace, Project, ProjectItem, Member } from './utils/api';
import './App.css';

export default function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const [activeNav, setActiveNav] = useState<'product' | 'project' | 'traceability' | 'all_items' | 'members'>('project');
  const [selectedDrawerItemUid, setSelectedDrawerItemUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. 初始化讀取 Workspaces 與 Members
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
        // 預設選取第一個 Workspace (例如 AAP)
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

  // 2. 當切換 Workspace 時，重新抓取該 Workspace 下的 Projects 與 Items
  const loadWorkspaceData = async () => {
    if (!currentWorkspace) return;
    try {
      const [prjList, itemList] = await Promise.all([
        api.getProjects({ workspace_uid: currentWorkspace.workspace_uid }),
        api.getItems({ workspace_uid: currentWorkspace.workspace_uid })
      ]);
      setProjects(prjList);
      setItems(itemList);
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

  // 過濾當前 View 所呈現的 items
  const getFilteredItemsForNav = () => {
    if (activeNav === 'product') {
      const productUids = projects.filter(p => p.project_type === 'Product').map(p => p.project_uid);
      return items.filter(i => productUids.includes(i.related_project_uid));
    }
    if (activeNav === 'project') {
      const projectUids = projects.filter(p => p.project_type === 'Project').map(p => p.project_uid);
      return items.filter(i => projectUids.includes(i.related_project_uid));
    }
    return items; // 'all_items'
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#090d16' }}>
      {/* 1. 左側側邊欄 (Sidebar) */}
      <Sidebar
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={(ws) => setCurrentWorkspace(ws)}
        onRefreshWorkspaces={loadInitialData}
        activeNav={activeNav}
        onNavChange={(nav) => setActiveNav(nav)}
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
          /* Workspace Members View */
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
        ) : activeNav === 'traceability' ? (
          /* Multi-Level Row Span Traceability Matrix (PDF 4e) */
          <TraceabilityMatrix
            items={items}
            onRefresh={loadWorkspaceData}
            onItemClick={(item) => setSelectedDrawerItemUid(item.item_uid)}
            projectId={projects[0]?.project_uid || ''}
          />
        ) : (
          /* Advanced Table View (PDF 2a, 2b: Search, Filter, Resizable, Inline Edit, Link to Drawer) */
          <AdvancedTable
            title={
              activeNav === 'product'
                ? `產品主頁 (Product Content Table View)`
                : activeNav === 'project'
                ? `專案主頁 (Project Context Table View)`
                : `所有工單總表 (All Items Table View)`
            }
            items={getFilteredItemsForNav()}
            projects={projects}
            members={members}
            onRefresh={loadWorkspaceData}
            onItemClick={(item) => setSelectedDrawerItemUid(item.item_uid)}
          />
        )}
      </main>

      {/* 3. 抽屜詳細視圖 (Slide-over Drawer) */}
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
