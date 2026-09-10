import React, { useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { api } from '../utils/api';
import type { Project, ProjectItem, Member } from '../utils/api';
import { TraceabilityMatrix } from './TraceabilityMatrix';
import { DeploymentTraceabilityMatrix } from './DeploymentTraceabilityMatrix';
import { AdvancedTable } from './AdvancedTable';
import { CustomSelect } from './CustomSelect';
import { MemberSelect } from './MemberSelect';

interface ProjectDetailViewProps {
  project: Project;
  items: ProjectItem[];
  members: Member[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onItemClick: (item: ProjectItem) => void;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  items,
  members,
  onBack,
  onRefresh,
  onItemClick
}) => {
  const [activeTab, setActiveTab] = useState<string>('traceability');

  const [editingDesc, setEditingDesc] = useState(false);
  const [descText, setDescText] = useState(project.project_content?.vision || '');

  const projectItems = items.filter(i => i.related_project_uid === project.project_uid);

  const handleSaveDesc = async () => {
    try {
      await api.patchProject(project.project_uid, {
        project_content: { ...project.project_content, vision: descText }
      });
      setEditingDesc(false);
      await onRefresh();
    } catch (err: any) {
      alert('更新專案說明失敗: ' + err.message);
    }
  };

  const getCount = (type: string) => projectItems.filter(i => i.item_type === type).length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      overflow: 'hidden'
    }}>
      {/* 1. 頂部返回導航條 (對齊 圖2: ❮ 返回專案分頁  📁 AAP-PRO-1) */}
      <div style={{
        padding: '12px 24px',
        backgroundColor: '#131b2e',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBack}
            style={{
              padding: '6px 12px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#cbd5e1',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={14} /> 返回專案分頁
          </button>
          <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.95rem' }}>
            📁 {project.project_display_code}
          </span>
        </div>

        <button
          onClick={onBack}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* 2. 主視圖區塊 (左側大內容 + 右側專案資訊屬性欄，對齊 圖2) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左側主面板 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h1 style={{ margin: '0 0 12px 0', fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc' }}>
              {project.project_name}
            </h1>

            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
              詳細說明 (Description)
            </div>

            {editingDesc ? (
              <div>
                <textarea
                  rows={3}
                  value={descText}
                  onChange={(e) => setDescText(e.target.value)}
                  placeholder="輸入專案目標、願景或說明..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #3b82f6',
                    borderRadius: '8px',
                    color: '#fff',
                    boxSizing: 'border-box',
                    fontSize: '0.9rem'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    onClick={handleSaveDesc}
                    style={{ padding: '6px 12px', background: '#16a34a', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingDesc(false)}
                    style={{ padding: '6px 12px', background: '#334155', border: 'none', borderRadius: '6px', color: '#cbd5e1', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingDesc(true)}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  color: descText ? '#cbd5e1' : '#64748b',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  minHeight: '44px',
                  lineHeight: 1.5
                }}
              >
                {descText || '點擊以新增專案願景與詳細說明...'}
              </div>
            )}
          </div>

          {/* 3. 分頁導航條 (對齊 圖2: 專案章程、專案里程碑、Requirement Traceability、Update & Deployment 等) */}
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
            borderBottom: '1px solid #1e293b',
            paddingBottom: '12px',
            marginBottom: '16px',
            flexShrink: 0
          }}>
            <button
              onClick={() => setActiveTab('charter')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'charter' ? '#334155' : 'transparent',
                color: activeTab === 'charter' ? '#fff' : '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📜 專案章程 ({getCount('Charter')})
            </button>

            <button
              onClick={() => setActiveTab('milestone')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'milestone' ? '#334155' : 'transparent',
                color: activeTab === 'milestone' ? '#fff' : '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🚩 專案里程碑 ({getCount('Milestone')})
            </button>

            {/* 核心 Highlight: Requirement Traceability (圖2紫色高亮) */}
            <button
              onClick={() => setActiveTab('traceability')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'traceability' ? '#581c87' : '#1e1b4b',
                color: activeTab === 'traceability' ? '#f3e8ff' : '#c084fc',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: activeTab === 'traceability' ? '0 2px 10px rgba(88, 28, 135, 0.4)' : 'none'
              }}
            >
              🔗 Requirement Traceability
            </button>

            <button
              onClick={() => setActiveTab('deployment')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'deployment' ? '#334155' : 'transparent',
                color: activeTab === 'deployment' ? '#fff' : '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🚀 Update & Deployment ({getCount('Deployment')})
            </button>

            <button
              onClick={() => setActiveTab('task')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'task' ? '#334155' : 'transparent',
                color: activeTab === 'task' ? '#fff' : '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📋 相關任務 ({getCount('Task')})
            </button>

            <button
              onClick={() => setActiveTab('meeting')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'meeting' ? '#334155' : 'transparent',
                color: activeTab === 'meeting' ? '#fff' : '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📅 相關會議 ({getCount('Meeting')})
            </button>

            <button
              onClick={() => setActiveTab('bottleneck')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'bottleneck' ? '#334155' : 'transparent',
                color: activeTab === 'bottleneck' ? '#fff' : '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ⚠️ 相關阻礙 ({getCount('Bottleneck')})
            </button>

            <button
              onClick={() => setActiveTab('decision')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'decision' ? '#334155' : 'transparent',
                color: activeTab === 'decision' ? '#fff' : '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              💡 決策日誌 ({getCount('Decision')})
            </button>
          </div>

          {/* 4. Tab 內容渲染 */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab === 'traceability' ? (
              <TraceabilityMatrix
                items={projectItems}
                onRefresh={onRefresh}
                onItemClick={onItemClick}
                projectId={project.project_uid}
              />
            ) : activeTab === 'deployment' ? (
              <DeploymentTraceabilityMatrix
                items={projectItems}
                onRefresh={onRefresh}
                onItemClick={onItemClick}
                projectId={project.project_uid}
              />
            ) : (
              <AdvancedTable
                title={
                  activeTab === 'charter' ? '專案章程列表 (Charters)' :
                  activeTab === 'milestone' ? '專案里程碑 (Milestones)' :
                  activeTab === 'task' ? '任務工單清單 (Tasks)' :
                  activeTab === 'meeting' ? '專案會議紀錄 (Meetings)' :
                  activeTab === 'bottleneck' ? '阻塞阻礙事項 (Bottlenecks)' : '架構決策日誌 (Decisions)'
                }
                items={projectItems.filter(i => {
                  if (activeTab === 'charter') return i.item_type === 'Charter';
                  if (activeTab === 'milestone') return i.item_type === 'Milestone';
                  if (activeTab === 'deployment') return i.item_type === 'Deployment';
                  if (activeTab === 'task') return i.item_type === 'Task';
                  if (activeTab === 'meeting') return i.item_type === 'Meeting';
                  if (activeTab === 'bottleneck') return i.item_type === 'Bottleneck';
                  if (activeTab === 'decision') return i.item_type === 'Decision';
                  return true;
                })}
                projects={[project]}
                members={members}
                onRefresh={onRefresh}
                onItemClick={onItemClick}
              />
            )}
          </div>
        </div>

        {/* 右側專案屬性欄 (對齊 圖2 右側側欄) */}
        <div style={{
          width: '280px',
          backgroundColor: '#0f172a',
          borderLeft: '1px solid #1e293b',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          overflowY: 'auto'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              專案狀態 (Status)
            </label>
            <CustomSelect
              value={project.project_status}
              style={{ width: '100%' }}
              options={[
                { value: 'Pipeline', label: 'Pipeline', badgeBg: '#1e293b', badgeColor: '#cbd5e1' },
                { value: 'Active', label: 'Active', badgeBg: '#1e3a8a', badgeColor: '#93c5fd' },
                { value: 'On Hold', label: 'On Hold', badgeBg: '#78350f', badgeColor: '#fde68a' },
                { value: 'Completed', label: 'Completed', badgeBg: '#064e3b', badgeColor: '#6ee7b7' },
                { value: 'Abandoned', label: 'Abandoned', badgeBg: '#334155', badgeColor: '#94a3b8' }
              ]}
              onChange={async (newStatus) => {
                await api.patchProject(project.project_uid, { project_status: newStatus as any });
                await onRefresh();
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              專案負責人 (Owner)
            </label>
            <MemberSelect
              value={project.project_owner || ''}
              members={members}
              style={{ width: '100%' }}
              onChange={async (uid) => {
                await api.patchProject(project.project_uid, { project_owner: uid ? uid : undefined });
                await onRefresh();
              }}
              placeholder="-- 未指定 --"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              計劃開始日期
            </label>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
              {project.planned_start_date ? project.planned_start_date.split('T')[0] : '未設定'}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              計劃結束日期
            </label>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
              {project.planned_end_date ? project.planned_end_date.split('T')[0] : '未設定'}
            </div>
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid #1e293b', paddingTop: '16px', fontSize: '0.75rem', color: '#64748b' }}>
            <div>建立時間: {new Date(project.created_at).toLocaleDateString()}</div>
            <div>更新時間: {new Date(project.updated_at).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
