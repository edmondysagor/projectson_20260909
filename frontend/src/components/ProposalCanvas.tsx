import React from 'react';
import { 
  CheckSquare, 
  Square, 
  Trash2, 
  Plus, 
  User, 
  Layers, 
  CheckCircle2, 
  X,
  AlertCircle
} from 'lucide-react';
import type { Member, ProjectItem } from '../utils/api';

export interface ProposedItem {
  id: string;
  itemTitle: string;
  itemType: 'Requirement' | 'User story' | 'Task' | 'Bug' | 'Decision' | string;
  itemPriority: 'High' | 'Middle' | 'Low' | string;
  itemFollowBy?: string;
  parentItemUid?: string;
  description?: string;
  approved: boolean;
}

interface ProposalCanvasProps {
  proposalTitle: string;
  items: ProposedItem[];
  members: Member[];
  existingItems?: ProjectItem[];
  onItemChange: (index: number, updatedItem: ProposedItem) => void;
  onToggleApprove: (index: number) => void;
  onToggleAll: (approved: boolean) => void;
  onAddItem: () => void;
  onDeleteItem: (index: number) => void;
  onClose: () => void;
  onApply: (selectedItems: ProposedItem[]) => Promise<void>;
  isSubmitting: boolean;
}

export const ProposalCanvas: React.FC<ProposalCanvasProps> = ({
  proposalTitle,
  items,
  members,
  onItemChange,
  onToggleApprove,
  onToggleAll,
  onAddItem,
  onDeleteItem,
  onClose,
  onApply,
  isSubmitting
}) => {
  const approvedCount = items.filter(i => i.approved).length;
  const allApproved = items.length > 0 && approvedCount === items.length;

  const handleApply = () => {
    const selected = items.filter(i => i.approved);
    if (selected.length === 0) {
      alert('請至少勾選一項要套用的工單！');
      return;
    }
    onApply(selected);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#0a0f1d',
      borderLeft: '1px solid #1e293b'
    }}>
      {/* 頂部 Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid #1e293b',
        backgroundColor: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: '#1e3a8a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Layers size={16} color="#93c5fd" />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              工單提案工作台 (Proposal Canvas)
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {proposalTitle || 'AI 拆解規劃提案'}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
          title="關閉審核工作台"
        >
          <X size={18} />
        </button>
      </div>

      {/* 控制工具列 Toolbar */}
      <div style={{
        padding: '8px 16px',
        backgroundColor: '#090d16',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => onToggleAll(!allApproved)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: 'none',
              color: '#cbd5e1',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {allApproved ? <CheckSquare size={14} color="#38bdf8" /> : <Square size={14} color="#64748b" />}
            <span>{allApproved ? '取消全選' : '全選所有'}</span>
          </button>

          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>•</span>

          <span style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 600 }}>
            已選取 {approvedCount} / {items.length} 項
          </span>
        </div>

        <button
          type="button"
          onClick={onAddItem}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#1e293b',
            color: '#93c5fd',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '3px 8px',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Plus size={12} />
          <span>加一項</span>
        </button>
      </div>

      {/* 項目滾動清單 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b', fontSize: '0.85rem' }}>
            <AlertCircle size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            目前暫無任何提案工單項目
          </div>
        ) : (
          items.map((item, idx) => (
            <div
              key={item.id || idx}
              style={{
                backgroundColor: item.approved ? '#0f172a' : '#090d16',
                border: item.approved ? '1px solid #334155' : '1px dashed #1e293b',
                borderRadius: '8px',
                padding: '10px 12px',
                opacity: item.approved ? 1 : 0.6,
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {/* 第一行: 勾選 + 類型 + 標題 + 刪除 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => onToggleApprove(idx)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: item.approved ? '#38bdf8' : '#64748b' }}
                >
                  {item.approved ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>

                {/* 類型選擇 */}
                <select
                  value={item.itemType}
                  onChange={(e) => onItemChange(idx, { ...item, itemType: e.target.value })}
                  style={{
                    backgroundColor: getTypeBg(item.itemType),
                    color: getTypeColor(item.itemType),
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Objective">🎯 目標</option>
                  <option value="Requirement">📋 需求</option>
                  <option value="User story">📖 Story</option>
                  <option value="Task">⚡ 任務</option>
                  <option value="Bug">🐞 Bug</option>
                  <option value="Decision">💡 決策</option>
                  <option value="Information">ℹ️ 資訊</option>
                  <option value="Bottleneck">⚠️ 瓶頸</option>
                </select>

                {/* 標題輸入框 */}
                <input
                  type="text"
                  value={item.itemTitle}
                  onChange={(e) => onItemChange(idx, { ...item, itemTitle: e.target.value })}
                  placeholder="工單標題..."
                  style={{
                    flex: 1,
                    backgroundColor: '#131b2e',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '0.8rem',
                    color: '#f8fafc',
                    fontWeight: 500,
                    outline: 'none'
                  }}
                />

                {/* 刪除此項按鈕 */}
                <button
                  type="button"
                  onClick={() => onDeleteItem(idx)}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                  title="移除此項"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* 第二行: 優先級 + 指派成員 + 說明 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px' }}>
                {/* 優先級 */}
                <select
                  value={item.itemPriority}
                  onChange={(e) => onItemChange(idx, { ...item, itemPriority: e.target.value })}
                  style={{
                    backgroundColor: '#131b2e',
                    color: item.itemPriority === 'High' ? '#f87171' : (item.itemPriority === 'Middle' ? '#fbbf24' : '#94a3b8'),
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    padding: '2px 6px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="High">🔴 高優先級</option>
                  <option value="Middle">🟡 中優先級</option>
                  <option value="Low">🟢 低優先級</option>
                </select>

                {/* 指派成員 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <User size={12} color="#94a3b8" />
                  <select
                    value={item.itemFollowBy || ''}
                    onChange={(e) => onItemChange(idx, { ...item, itemFollowBy: e.target.value || undefined })}
                    style={{
                      flex: 1,
                      backgroundColor: '#131b2e',
                      color: '#cbd5e1',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      padding: '2px 6px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">未指派負責人</option>
                    {members.map(m => (
                      <option key={m.member_uid} value={m.member_name}>
                        {m.member_name} ({m.member_email || '成員'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 可選說明或背景備註 */}
              {item.description && (
                <div style={{
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  paddingLeft: '24px',
                  lineHeight: 1.4,
                  fontStyle: 'italic'
                }}>
                  💬 {item.description}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 底部按鈕區 */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #1e293b',
        backgroundColor: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
      }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '7px 14px',
            backgroundColor: '#1e293b',
            color: '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          放棄提案
        </button>

        <button
          type="button"
          onClick={handleApply}
          disabled={approvedCount === 0 || isSubmitting}
          style={{
            flex: 1,
            padding: '7px 14px',
            backgroundColor: approvedCount > 0 && !isSubmitting ? '#16a34a' : '#334155',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: approvedCount > 0 && !isSubmitting ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: approvedCount > 0 ? '0 0 12px rgba(22, 163, 74, 0.4)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <CheckCircle2 size={14} />
          <span>{isSubmitting ? '正在原子寫入 Neon DB...' : `套用已核准項目 (${approvedCount} 項)`}</span>
        </button>
      </div>
    </div>
  );
};

function getTypeBg(type?: string) {
  switch (type) {
    case 'Requirement': return '#3b0764';
    case 'User story': return '#1e1b4b';
    case 'Bug': return '#4c0519';
    case 'Decision': return '#451a03';
    default: return '#064e3b';
  }
}

function getTypeColor(type?: string) {
  switch (type) {
    case 'Requirement': return '#d8b4fe';
    case 'User story': return '#a5b4fc';
    case 'Bug': return '#fda4af';
    case 'Decision': return '#fcd34d';
    default: return '#6ee7b7';
  }
}
