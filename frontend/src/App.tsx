import { useState, useEffect } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ProjectTable } from './components/ProjectTable';
import { ProjectDetailView } from './components/ProjectDetailView';
import { ProductDetailView } from './components/ProductDetailView';
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

  // Member 快速新增狀態
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [memberSubmitting, setMemberSubmitting] = useState(false);

  // 導航層級:
  // 1. activeNav 控制 Sidebar (product / project / all_items / members)
  // 2. selectedProject 控制是否進入該專案子頁面 (圖1 -> 圖2)
  const [activeNav, setActiveNav] = useState<'product' | 'project' | 'all_items' | 'members'>('project');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // 3. selectedDrawerItemUid 控制工單詳情滑出抽屜
  const [selectedDrawerItemUid, setSelectedDrawerItemUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;
    setMemberSubmitting(true);
    try {
      await api.provisionMember({
        member_name: newMemberName.trim(),
        member_email: newMemberEmail.trim()
      });
      setNewMemberName('');
      setNewMemberEmail('');
      setShowAddMember(false);
      await loadInitialData();
    } catch (err: any) {
      alert('建立成員失敗: ' + err.message);
    } finally {
      setMemberSubmitting(false);
    }
  };

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
          /* 成員視圖 (Level 0: Workspace Member，支援框底快速新增) */
          <div style={{ padding: '32px', color: '#f8fafc', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '20px', flexShrink: 0 }}>工作區成員列表 (Members)</h1>
            <div style={{ 
              backgroundColor: '#0f172a', 
              borderRadius: '12px', 
              border: '1px solid #1e293b', 
              display: 'flex', 
              flexDirection: 'column', 
              flex: 1, 
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)' 
            }}>
              <div style={{ flex: 1, overflow: 'auto' }}>
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

              {/* 框底新增功能 Input Bar */}
              <div style={{
                borderTop: '1px solid #1e293b',
                backgroundColor: '#0c1222',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexShrink: 0
              }}>
                {showAddMember ? (
                  <form onSubmit={handleAddMember} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    flexWrap: 'wrap'
                  }}>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="成員姓名 (Member Name)..."
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: '180px',
                        padding: '7px 12px',
                        backgroundColor: '#090d16',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />
                    <input
                      type="email"
                      required
                      placeholder="電子郵件 (Member Email)..."
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: '220px',
                        padding: '7px 12px',
                        backgroundColor: '#090d16',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={memberSubmitting}
                      style={{
                        padding: '7px 14px',
                        backgroundColor: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <Check size={15} /> {memberSubmitting ? '建立中...' : '儲存'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMember(false);
                        setNewMemberName('');
                        setNewMemberEmail('');
                      }}
                      style={{
                        padding: '7px 12px',
                        backgroundColor: '#334155',
                        color: '#cbd5e1',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={15} /> 取消
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowAddMember(true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      transition: 'color 0.15s, background-color 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#38bdf8';
                      e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#64748b';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Plus size={16} /> + 新增頁面 (Workspace Member)
                  </button>
                )}
              </div>
            </div>
          </div>
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
        members={members}
        projects={projects}
        onSelectAnotherItem={(uid) => setSelectedDrawerItemUid(uid)}
      />
    </div>
  );
}
