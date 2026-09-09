// @ts-nocheck
import React, { useState } from 'react';
import type { Task, Meeting, Bottleneck, KnowledgeNote, Project } from '../utils/api';

type TabType = 'kanban' | 'tasks' | 'projects' | 'meetings' | 'bottlenecks' | 'knowledge' | 'settings' | 'user';

interface ListPaneProps {
  activeTab: TabType;
  tasks: Task[];
  meetings: Meeting[];
  bottlenecks: Bottleneck[];
  knowledge: KnowledgeNote[];
  projects: Project[];
  selectedSubItemId: string | null;
  onSelectSubItem: (id: string) => void;
  onCreateNew: () => void;
}

export const ListPane: React.FC<ListPaneProps> = ({
  activeTab,
  tasks,
  meetings,
  bottlenecks,
  knowledge,
  projects,
  selectedSubItemId,
  onSelectSubItem,
  onCreateNew,
}) => {
  const [search, setSearch] = useState('');

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'must':
        return { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.2)' };
      case 'should':
        return { backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.2)' };
      case 'could':
        return { backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60A5FA', border: '1px solid rgba(59, 130, 246, 0.2)' };
      default:
        return { backgroundColor: 'rgba(148, 163, 184, 0.1)', color: '#94A3B8', border: '1px solid rgba(148, 163, 184, 0.2)' };
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#FCA5A5' };
      case 'medium':
        return { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#FDE047' };
      default:
        return { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34D399' };
    }
  };

  const renderTitle = () => {
    switch (activeTab) {
      case 'kanban': return '任務看板';
      case 'tasks': return '任務工單';
      case 'projects': return '項目與文件';
      case 'meetings': return '會議記錄';
      case 'bottlenecks': return '樽頸與風險';
      case 'knowledge': return '業務字典';
      case 'settings': return '系統設定';
      case 'user': return '用戶帳號';
    }
  };

  // Filters based on search
  const filteredTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase()))
  );


  const filteredMeetings = meetings.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.summary && m.summary.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredBottlenecks = bottlenecks.filter(
    (b) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      (b.description && b.description.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredKnowledge = knowledge.filter(
    (k) =>
      k.term.toLowerCase().includes(search.toLowerCase()) ||
      k.definition.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>{renderTitle()}</h2>
        {/* Only show "add" button for CRUD tabs */}
        {(activeTab === 'tasks' || activeTab === 'meetings' || activeTab === 'projects' || activeTab === 'bottlenecks' || activeTab === 'knowledge') && (
          <button style={styles.addBtn} onClick={onCreateNew} title="手動建立">
            <svg style={styles.addIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Input for searchable lists */}
      {activeTab !== 'settings' && activeTab !== 'user' && activeTab !== 'kanban' && (
        <div style={styles.searchContainer}>
          <svg style={styles.searchIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            style={styles.searchInput}
            type="text"
            placeholder="搜尋關鍵字..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Lists */}
      <div style={styles.list}>
        {/* 1. Kanban Tabs */}
        {activeTab === 'kanban' && (
          <div style={styles.metaList}>
            {[
              { id: 'kanban-board', label: '📊 任務看板視圖 (Board)' },
              { id: 'kanban-todo', label: '📋 待辦工單 (To Do)' },
              { id: 'kanban-done', label: '✅ 已完成工單 (Completed)' },
              { id: 'kanban-archive', label: '🗄️ 已封存工單 (Archive)' },
              { id: 'kanban-calendar', label: '📅 專案行事曆 (Calendar)' }
            ].map((v) => (
              <div
                key={v.id}
                style={{ ...styles.card, ...(selectedSubItemId === v.id ? styles.cardActive : {}) }}
                onClick={() => onSelectSubItem(v.id)}
              >
                <span style={styles.metaLabel}>{v.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* 2. Tasks List */}
        {activeTab === 'tasks' && (
          <div style={styles.metaList}>
            <div
              style={{ ...styles.card, ...(selectedSubItemId === 'task-table' ? styles.cardActive : {}) }}
              onClick={() => onSelectSubItem('task-table')}
            >
              <span style={styles.metaLabel}>📊 所有工單總表 (Table View)</span>
            </div>
            <div style={styles.sectionHeader}>個別工單項目</div>
            {filteredTasks.length === 0 ? (
              <div style={styles.empty}>無符合任務</div>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  style={{ ...styles.card, ...(selectedSubItemId === task.id ? styles.cardActive : {}) }}
                  onClick={() => onSelectSubItem(task.id)}
                >
                  <div style={styles.cardHeader}>
                    <div style={styles.titleRow}>
                      <span className={`status-lamp ${task.status.toLowerCase().replace('_', '')}`} style={{ marginRight: '8px', flexShrink: 0 }} />
                      <span style={styles.cardTitle}>{task.title}</span>
                    </div>
                  </div>
                  <p style={styles.cardDesc}>{task.description || '無詳細描述'}</p>
                  <div style={styles.cardFooter}>
                    {task.nature && <span className="nature-tag">{task.nature}</span>}
                    <div style={styles.assignees}>
                      {task.assignees?.slice(0, 2).map((a, i) => (
                        <div key={i} style={styles.assigneeBadge} title={a}>
                          {a.charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'projects' && (
          <div style={styles.metaList}>
            <div
              style={{ ...styles.card, ...(selectedSubItemId === 'project-table' ? styles.cardActive : {}) }}
              onClick={() => onSelectSubItem('project-table')}
            >
              <span style={styles.metaLabel}>📊 所有專案總表 (Table View)</span>
            </div>

            <div style={styles.sectionHeader}>核心專案文件</div>
            {[
              { id: 'project-charter', label: '📄 專案章程 (Project Charter)' },
              { id: 'project-plan', label: '📅 WBS / RACI 計畫表' },
              { id: 'project-traceability', label: '🔗 需求對接追蹤矩陣' },
              { id: 'requirement-table', label: '📊 需求基準總表 (Table View)' }
            ].map((d) => (
              <div
                key={d.id}
                style={{ ...styles.card, ...(selectedSubItemId === d.id ? styles.cardActive : {}) }}
                onClick={() => onSelectSubItem(d.id)}
              >
                <span style={styles.metaLabel}>{d.label}</span>
              </div>
            ))}

            <div style={styles.sectionHeader}>個別專案項目</div>
            {projects.length === 0 ? (
              <div style={styles.empty}>無專案項目</div>
            ) : (
              projects.map((proj) => {
                const isSelected = selectedSubItemId === proj.id;
                const isRunning = proj.status === '進行中';
                return (
                  <div
                    key={proj.id}
                    style={{ ...styles.card, ...(isSelected ? styles.cardActive : {}) }}
                    onClick={() => onSelectSubItem(proj.id)}
                  >
                    <div style={styles.cardHeader}>
                      <div style={styles.titleRow}>
                        <span className={`status-lamp ${isRunning ? 'progress' : 'idle'}`} style={{ marginRight: '8px', flexShrink: 0 }} />
                        <span style={styles.cardTitle}>{proj.name}</span>
                      </div>
                    </div>
                    <p style={styles.cardDesc}>{proj.type} / Phase {proj.phase_number || 1}</p>
                    <div style={styles.cardFooter}>
                      <span style={{ ...styles.priorityTag, ...getPriorityStyle(proj.priority) }}>
                        {proj.priority} Priority
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 4. Meetings List */}
        {activeTab === 'meetings' && (
          <div style={styles.metaList}>
            <div
              style={{ ...styles.card, ...(selectedSubItemId === 'meeting-table' ? styles.cardActive : {}) }}
              onClick={() => onSelectSubItem('meeting-table')}
            >
              <span style={styles.metaLabel}>📊 所有會議總表 (Table View)</span>
            </div>
            <div style={styles.sectionHeader}>個別會議紀錄</div>
            {filteredMeetings.length === 0 ? (
              <div style={styles.empty}>無符合會議</div>
            ) : (
              filteredMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  style={{ ...styles.card, ...(selectedSubItemId === meeting.id ? styles.cardActive : {}) }}
                  onClick={() => onSelectSubItem(meeting.id)}
                >
                  <div style={styles.meetingHeader}>
                    <span style={styles.date}>{formatDate(meeting.meeting_date)}</span>
                    <span style={styles.cardTitle}>{meeting.title}</span>
                  </div>
                  <p style={styles.cardDesc}>{meeting.summary || '點選查閱 5 欄會議 Markdown 網格...'}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* 5. Bottlenecks List */}
        {activeTab === 'bottlenecks' && (
          <div style={styles.metaList}>
            <div
              style={{ ...styles.card, ...(selectedSubItemId === 'bottleneck-table' ? styles.cardActive : {}) }}
              onClick={() => onSelectSubItem('bottleneck-table')}
            >
              <span style={styles.metaLabel}>📊 樽頸風險總表 (Table View)</span>
            </div>
            <div style={styles.sectionHeader}>個別阻礙項目</div>
            {filteredBottlenecks.length === 0 ? (
              <div style={styles.empty}>無符合樽頸</div>
            ) : (
              filteredBottlenecks.map((b) => (
                <div
                  key={b.id}
                  style={{ ...styles.card, ...(selectedSubItemId === b.id ? styles.cardActive : {}) }}
                  onClick={() => onSelectSubItem(b.id)}
                >
                  <div style={styles.cardHeader}>
                    <div style={styles.titleRow}>
                      <span className={`status-lamp ${b.status === 'ACTIVE' ? 'blocked' : 'done'}`} style={{ marginRight: '8px', flexShrink: 0 }} />
                      <span style={styles.cardTitle}>{b.title}</span>
                    </div>
                  </div>
                  <p style={styles.cardDesc}>{b.description}</p>
                  <div style={styles.cardFooter}>
                    <span style={{ ...styles.priorityTag, ...getSeverityStyle(b.severity) }}>
                      {b.severity} Severity
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 6. Knowledge Notes List */}
        {activeTab === 'knowledge' && (
          <div style={styles.metaList}>
            <div
              style={{ ...styles.card, ...(selectedSubItemId === 'knowledge-table' ? styles.cardActive : {}) }}
              onClick={() => onSelectSubItem('knowledge-table')}
            >
              <span style={styles.metaLabel}>📊 業務知識總表 (Table View)</span>
            </div>
            <div style={styles.sectionHeader}>個別術語項目</div>
            {filteredKnowledge.length === 0 ? (
              <div style={styles.empty}>無符合知識詞條</div>
            ) : (
              filteredKnowledge.map((item) => (
                <div
                  key={item.id}
                  style={{ ...styles.card, ...(selectedSubItemId === item.id ? styles.cardActive : {}) }}
                  onClick={() => onSelectSubItem(item.id)}
                >
                  <div style={styles.meetingHeader}>
                    <span style={styles.date}>GLOSSARY TERM</span>
                    <span style={styles.cardTitle}>{item.term}</span>
                  </div>
                  <p style={styles.cardDesc}>{item.definition}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* 7. Settings List */}
        {activeTab === 'settings' && (
          <div style={styles.metaList}>
            {[
              { id: 'setting-system', label: '⚙️ 全域系統偏好設定' },
              { id: 'setting-ai', label: '🤖 AI Co-pilot 代理設定' },
              { id: 'setting-database', label: '🗄️ Neon 資料庫連線狀態' }
            ].map((s) => (
              <div
                key={s.id}
                style={{ ...styles.card, ...(selectedSubItemId === s.id ? styles.cardActive : {}) }}
                onClick={() => onSelectSubItem(s.id)}
              >
                <span style={styles.metaLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* 8. User Account List */}
        {activeTab === 'user' && (
          <div style={styles.metaList}>
            {[
              { id: 'user-profile', label: '👤 個人基本資料' },
              { id: 'user-security', label: '🔒 帳號密碼與安全' },
              { id: 'user-notifications', label: '🔔 通知與訂閱設定' }
            ].map((u) => (
              <div
                key={u.id}
                style={{ ...styles.card, ...(selectedSubItemId === u.id ? styles.cardActive : {}) }}
                onClick={() => onSelectSubItem(u.id)}
              >
                <span style={styles.metaLabel}>{u.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: '320px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: 'rgba(11, 15, 25, 0.4)',
    borderRight: '1px solid var(--border-color)',
    userSelect: 'none' as const,
  },
  header: {
    padding: '24px 20px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  addBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-primary)',
    transition: 'all 0.2s ease',
  },
  addIcon: {
    width: '18px',
    height: '18px',
  },
  searchContainer: {
    margin: '0 20px 16px',
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute' as const,
    left: '12px',
    width: '16px',
    height: '16px',
    color: 'var(--text-muted)',
  },
  searchInput: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '10px 12px 10px 36px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    fontFamily: 'var(--font-body)',
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0 20px 24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '30px 0',
    color: 'var(--text-muted)',
    fontSize: '13px',
  },
  metaList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  sectionHeader: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginTop: '10px',
    marginBottom: '4px',
  },
  metaLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  card: {
    padding: '14px',
    borderRadius: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  cardActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: 'var(--accent-primary)',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.1)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: '13px',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis' as const,
  },
  cardDesc: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as any,
    overflow: 'hidden',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '2px',
  },
  assignees: {
    display: 'flex',
    alignItems: 'center',
  },
  assigneeBadge: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-primary)',
    color: '#fff',
    fontSize: '8px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #0B0F19',
  },
  meetingHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  date: {
    fontSize: '9px',
    fontWeight: 600,
    color: 'var(--accent-secondary)',
    letterSpacing: '0.05em',
  },
  priorityTag: {
    fontSize: '9px',
    padding: '1px 5px',
    borderRadius: '3px',
    fontWeight: 600,
  }
};
export default ListPane;
