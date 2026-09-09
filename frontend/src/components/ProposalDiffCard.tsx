import React, { useState } from 'react';
import type { ToolProposal } from '../utils/api';

interface ProposalDiffCardProps {
  proposals: ToolProposal[];
  onAccept: (proposal: ToolProposal) => Promise<void>;
  onReject: (id: string) => void;
}

export const ProposalDiffCard: React.FC<ProposalDiffCardProps> = ({
  proposals,
  onAccept,
  onReject,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCommitting, setIsCommitting] = useState(false);

  const activeIndex = Math.min(currentIndex, Math.max(0, proposals.length - 1));
  const proposal = proposals[activeIndex];

  if (proposals.length === 0 || !proposal) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>
          <div style={styles.emptyGlow} />
          <h4 style={styles.emptyTitle}>AI 提案卡片 (Pull Request View)</h4>
          <p style={styles.emptyDesc}>目前尚無待審批的變更提案。當你向 Co-Pilot 提及專案章程修改、需求制定、任務更新或會議記錄時，對應的變更建議會顯示於此處供審查與 Commit。</p>
        </div>
      </div>
    );
  }

  const handleAccept = async () => {
    setIsCommitting(true);
    try {
      await onAccept(proposal);
      if (currentIndex >= proposals.length - 1) {
        setCurrentIndex(Math.max(0, proposals.length - 2));
      }
    } catch (error) {
      alert('無法提交變更到資料庫，請檢查連線');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleReject = () => {
    onReject(proposal.id);
    if (currentIndex >= proposals.length - 1) {
      setCurrentIndex(Math.max(0, proposals.length - 2));
    }
  };

  const renderDiff = () => {
    const data = proposal.after || {};
    
    // 1. Create/Insert Log Diff (S1: Task/Meeting, S2: Requirement)
    if (proposal.type === 'create_new_log' || proposal.type === 'create_requirement') {
      return (
        <div style={styles.diffBox}>
          <div style={styles.diffHeader}>[NEW] 新增 {proposal.targetType.toUpperCase()}</div>
          <div style={styles.diffContent}>
            <div style={styles.diffRow}>
              <span style={styles.diffLabel}>標題:</span>
              <span className="diff-ins">+ {data.title}</span>
            </div>
            
            {proposal.targetType === 'task' && (
              <>
                <div style={styles.diffRow}>
                  <span style={styles.diffLabel}>狀態:</span>
                  <span className="diff-ins">+ {data.status || 'TODO'}</span>
                </div>
                <div style={styles.diffRow}>
                  <span style={styles.diffLabel}>性質:</span>
                  <span className="diff-ins">+ {data.nature || '無'}</span>
                </div>
                <div style={styles.diffRow}>
                  <span style={styles.diffLabel}>負責人:</span>
                  <span className="diff-ins">+ {data.assignees?.join(', ') || '無'}</span>
                </div>
                <div style={styles.diffRow}>
                  <span style={styles.diffLabel}>描述:</span>
                  <span className="diff-ins" style={{ whiteSpace: 'pre-wrap' }}>+ {data.description}</span>
                </div>
              </>
            )}

            {proposal.targetType === 'requirement' && (
              <>
                <div style={styles.diffRow}>
                  <span style={styles.diffLabel}>分類:</span>
                  <span className="diff-ins">+ {data.category || 'Functional'}</span>
                </div>
                <div style={styles.diffRow}>
                  <span style={styles.diffLabel}>MoSCoW 優先級:</span>
                  <span className="diff-ins">+ {data.priority || 'Medium'}</span>
                </div>
                <div style={styles.diffRow}>
                  <span style={styles.diffLabel}>狀態:</span>
                  <span className="diff-ins">+ {data.status || 'DRAFT'}</span>
                </div>
                <div style={styles.diffRow}>
                  <span style={styles.diffLabel}>詳細描述:</span>
                  <span className="diff-ins" style={{ whiteSpace: 'pre-wrap' }}>+ {data.description}</span>
                </div>
              </>
            )}

            {proposal.targetType === 'meeting' && (
              <>
                <div style={styles.diffRow}>
                  <span style={styles.diffLabel}>摘要:</span>
                  <span className="diff-ins">+ {data.summary || '無'}</span>
                </div>
                <div style={styles.diffRow}>
                  <span style={styles.diffLabel}>Markdown 內容:</span>
                  <pre className="diff-ins" style={styles.preCode}>+ {data.description_or_content || data.content}</pre>
                </div>
              </>
            )}

            <div style={styles.diffRow}>
              <span style={styles.diffLabel}>備註 (Remarks):</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontStyle: 'italic' }}>
                ↳ "{data.remarks_entry || '透過 AI 提案新建'}"
              </span>
            </div>
          </div>
        </div>
      );
    }

    // 2. Charter Upsert Diff (S2)
    if (proposal.type === 'upsert_charter') {
      const w5h2 = data.w5h2 || {};
      return (
        <div style={styles.diffBox}>
          <div style={styles.diffHeader}>[UPSERT] 寫入專案章程 CHARTER</div>
          <div style={styles.diffContent}>
            <div style={styles.diffRow}>
              <span style={styles.diffLabel}>章程標題:</span>
              <span className="diff-ins">+ {data.title}</span>
            </div>
            <div style={styles.diffRow}>
              <span style={styles.diffLabel}>核心目標 (Goals):</span>
              <span className="diff-ins">+ {data.goals}</span>
            </div>
            <div style={styles.diffRow}>
              <span style={styles.diffLabel}>專案範圍 (Scope):</span>
              <span className="diff-ins">+ {data.scope}</span>
            </div>
            <div style={styles.diffRow}>
              <span style={styles.diffLabel}>排除範圍 (Out-of-scope):</span>
              <span className="diff-ins">+ {data.out_of_scope}</span>
            </div>
            <div style={styles.diffRow}>
              <span style={styles.diffLabel}>5W2H 專案骨架:</span>
              <div style={styles.subGrid}>
                {Object.entries(w5h2).map(([key, val]: any) => (
                  <div key={key} style={styles.subRow}>
                    <span style={styles.subLabel}>{key.toUpperCase()}:</span>
                    <span className="diff-ins">+ {val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={styles.diffRow}>
              <span style={styles.diffLabel}>備註 (Remarks):</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontStyle: 'italic' }}>
                ↳ "{data.remarks_entry}"
              </span>
            </div>
          </div>
        </div>
      );
    }

    // 3. Update existing records (Task, Meeting, Requirement)
    const before = proposal.before || {};
    const after = proposal.after || {};
    const keys = Object.keys(after).filter(k => k !== 'remarks_entry' && k !== 'id' && k !== 'project_id' && k !== 'product_id');

    return (
      <div style={styles.diffBox}>
        <div style={styles.diffHeader}>[MODIFY] 變更現有 {proposal.targetType.toUpperCase()}</div>
        <div style={styles.diffContent}>
          <div style={styles.diffRow}>
            <span style={styles.diffLabel}>對象 ID:</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              {proposal.targetId}
            </span>
          </div>
          
          {keys.map((key) => {
            const beforeVal = Array.isArray(before[key]) ? before[key].join(', ') : String(before[key] ?? '');
            const afterVal = Array.isArray(after[key]) ? after[key].join(', ') : String(after[key] ?? '');
            
            if (beforeVal === afterVal) return null;

            return (
              <div key={key} style={styles.diffFieldBlock}>
                <span style={styles.diffLabel}>{key.toUpperCase()}:</span>
                <div style={styles.diffComparison}>
                  <div className="diff-del">- {beforeVal || '(空)'}</div>
                  <div className="diff-ins">+ {afterVal || '(空)'}</div>
                </div>
              </div>
            );
          })}
          
          <div style={styles.diffRow}>
            <span style={styles.diffLabel}>變更備註 (Remarks):</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontStyle: 'italic' }}>
              ↳ "{after.remarks_entry}"
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* Card Header */}
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <span style={styles.badge}>HITL Queue</span>
          <span style={styles.counter}>
            {activeIndex + 1} / {proposals.length} 項變更提案
          </span>
        </div>
        <div style={styles.navButtons}>
          <button
            style={styles.navBtn}
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={activeIndex === 0}
          >
            ◀
          </button>
          <button
            style={styles.navBtn}
            onClick={() => setCurrentIndex(prev => Math.min(proposals.length - 1, prev + 1))}
            disabled={activeIndex === proposals.length - 1}
          >
            ▶
          </button>
        </div>
      </div>

      {/* Main Diff Content */}
      <div style={styles.body}>
        <div style={styles.reasonBlock}>
          <strong>提案原因：</strong> {proposal.reason}
        </div>
        
        {renderDiff()}
      </div>

      {/* HITL Actions */}
      <div style={styles.footer}>
        <button style={styles.rejectBtn} onClick={handleReject} disabled={isCommitting}>
          ❌ 拒絕提案
        </button>
        <button style={styles.acceptBtn} onClick={handleAccept} disabled={isCommitting}>
          {isCommitting ? 'SQL Commit 中...' : '✅ 接受變更 (SQL Commit)'}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    height: '40%',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#0A0E1A',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    textAlign: 'center' as const,
    color: 'var(--text-muted)',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  emptyGlow: {
    position: 'absolute' as const,
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, var(--accent-primary-glow) 0%, transparent 70%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 0,
    pointerEvents: 'none' as const,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px',
    zIndex: 1,
  },
  emptyDesc: {
    fontSize: '11px',
    lineHeight: '1.6',
    zIndex: 1,
    maxWidth: '280px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  badge: {
    fontSize: '9px',
    fontWeight: 'bold',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    color: 'var(--accent-primary)',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    textTransform: 'uppercase' as const,
  },
  counter: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  navButtons: {
    display: 'flex',
    gap: '4px',
  },
  navBtn: {
    padding: '2px 8px',
    fontSize: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    opacity: 0.7,
    '&:disabled': {
      opacity: 0.3,
      cursor: 'not-allowed',
    }
  },
  body: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  reasonBlock: {
    fontSize: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderLeft: '2px solid var(--accent-secondary)',
    padding: '8px 10px',
    borderRadius: '4px',
    lineHeight: '1.4',
    color: 'var(--text-secondary)',
  },
  diffBox: {
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  diffHeader: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: 600,
    borderBottom: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontFamily: 'monospace',
  },
  diffContent: {
    padding: '10px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  diffRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    fontSize: '12px',
  },
  diffLabel: {
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '10px',
    textTransform: 'uppercase' as const,
  },
  diffFieldBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    borderBottom: '1px dashed rgba(255, 255, 255, 0.03)',
    paddingBottom: '8px',
  },
  diffComparison: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    fontSize: '12px',
  },
  preCode: {
    fontFamily: 'monospace',
    fontSize: '11px',
    padding: '6px',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: '4px',
    overflowX: 'auto' as const,
  },
  subGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    paddingLeft: '8px',
    borderLeft: '2px solid rgba(255, 255, 255, 0.05)',
    marginTop: '4px',
  },
  subRow: {
    display: 'flex',
    gap: '8px',
    fontSize: '11px',
  },
  subLabel: {
    color: 'var(--text-muted)',
    fontWeight: 600,
    width: '60px',
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    gap: '10px',
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#FCA5A5',
    textAlign: 'center' as const,
  },
  acceptBtn: {
    flex: 2,
    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#fff',
    boxShadow: '0 4px 12px rgba(16, 185, 205, 0.15)',
    textAlign: 'center' as const,
  },
};
export default ProposalDiffCard;
