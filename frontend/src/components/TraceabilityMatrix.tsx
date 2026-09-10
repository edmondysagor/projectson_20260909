import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../utils/api';
import type { ProjectItem } from '../utils/api';

interface TraceabilityMatrixProps {
  items: ProjectItem[];
  onRefresh: () => Promise<void>;
  onItemClick: (item: ProjectItem) => void;
  projectId: string;
}

export const TraceabilityMatrix: React.FC<TraceabilityMatrixProps> = ({
  items,
  onRefresh,
  onItemClick,
  projectId
}) => {
  const [draggedUid, setDraggedUid] = useState<string | null>(null);

  const objectives = items.filter(i => i.item_type === 'Objective');

  const getRequirements = (objUid: string) => 
    items.filter(i => i.item_type === 'Requirement' && i.parent_item_uid === objUid);

  const getUserStories = (reqUid: string) => 
    items.filter(i => i.item_type === 'User story' && i.parent_item_uid === reqUid);

  const getTasks = (usUid: string) => 
    items.filter(i => i.item_type === 'Task' && i.parent_item_uid === usUid);

  const getUats = (taskUid: string) => 
    items.filter(i => i.item_type === 'UAT' && i.parent_item_uid === taskUid);

  const handleDragStart = (e: React.DragEvent, uid: string) => {
    setDraggedUid(uid);
    e.dataTransfer.setData('text/plain', uid);
  };

  const handleDropOnParent = async (e: React.DragEvent, newParentUid: string) => {
    e.preventDefault();
    if (!draggedUid || draggedUid === newParentUid) return;

    try {
      await api.patchItem(draggedUid, { parent_item_uid: newParentUid });
      await onRefresh();
    } catch (err: any) {
      alert('變更關聯失敗: ' + err.message);
    } finally {
      setDraggedUid(null);
    }
  };

  const handleQuickAddChild = async (parentUid: string, childType: string) => {
    const title = prompt(`請輸入新的 ${childType} 名稱:`);
    if (!title || !title.trim()) return;

    try {
      await api.createItem({
        item_title: title.trim(),
        item_type: childType,
        related_project_uid: projectId,
        parent_item_uid: parentUid,
        item_status: 'Ready',
        item_priority: 'Middle'
      });
      await onRefresh();
    } catch (err: any) {
      alert('新增子項目失敗: ' + err.message);
    }
  };

  const renderStatusBadge = (status: string) => {
    const isDone = status === 'Completed' || status === 'Closed';
    const isBlocked = status === 'Blocked';
    const isInProgress = status === 'In Progress';

    return (
      <span style={{
        fontSize: '0.7rem',
        padding: '2px 6px',
        borderRadius: '4px',
        fontWeight: 600,
        backgroundColor: isDone ? '#064e3b' : isBlocked ? '#7f1d1d' : isInProgress ? '#1e3a8a' : '#1e293b',
        color: isDone ? '#6ee7b7' : isBlocked ? '#fca5a5' : isInProgress ? '#93c5fd' : '#94a3b8'
      }}>
        {status}
      </span>
    );
  };

  const renderCard = (item: ProjectItem, childTypeNext?: string) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, item.item_uid)}
      style={{
        backgroundColor: '#131b2e',
        borderRadius: '8px',
        border: '1px solid #1e293b',
        padding: '10px 12px',
        marginBottom: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        cursor: 'grab',
        transition: 'border-color 0.15s, background-color 0.15s'
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#38bdf8')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e293b')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <button
          onClick={() => onItemClick(item)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#38bdf8',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline'
          }}
        >
          {item.item_display_code}
        </button>
        {renderStatusBadge(item.item_status)}
      </div>

      <div style={{ fontSize: '0.85rem', color: '#f8fafc', marginBottom: '8px', fontWeight: 500, lineHeight: 1.4 }}>
        {item.item_title}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b' }}>
        <span>{item.follow_by_name || '未指派'}</span>
        {childTypeNext && (
          <button
            onClick={() => handleQuickAddChild(item.item_uid, childTypeNext)}
            style={{
              background: '#1e293b',
              border: 'none',
              borderRadius: '4px',
              color: '#38bdf8',
              padding: '2px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }}
            title={`新增 ${childTypeNext}`}
          >
            <Plus size={12} /> {childTypeNext}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
            專案溯源鏈矩陣 (Multi-level Row Span Traceability)
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
            5 層完整工程鏈條：Objective ➔ Requirement ➔ User Story ➔ Task ➔ UAT (支援跨列拖放與就地加項)
          </p>
        </div>
      </div>

      <div style={{
        flex: 1,
        margin: '16px 24px',
        backgroundColor: '#0f172a',
        borderRadius: '12px',
        border: '1px solid #1e293b',
        overflow: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(220px, 1fr))',
        gap: '1px',
        background: '#1e293b'
      }}>
        <div style={{ backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px', backgroundColor: '#131b2e', borderBottom: '1px solid #1e293b', fontWeight: 700, fontSize: '0.85rem', color: '#86efac' }}>
            🎯 1. Objective (業務目標)
          </div>
          <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
            {objectives.map(obj => (
              <div key={obj.item_uid}>
                {renderCard(obj, 'Requirement')}
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px', backgroundColor: '#131b2e', borderBottom: '1px solid #1e293b', fontWeight: 700, fontSize: '0.85rem', color: '#93c5fd' }}>
            📋 2. Requirement (功能需求)
          </div>
          <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
            {objectives.flatMap(obj => getRequirements(obj.item_uid)).map(req => (
              <div
                key={req.item_uid}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropOnParent(e, req.item_uid)}
              >
                {renderCard(req, 'User story')}
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px', backgroundColor: '#131b2e', borderBottom: '1px solid #1e293b', fontWeight: 700, fontSize: '0.85rem', color: '#c084fc' }}>
            📖 3. User Story (使用者故事)
          </div>
          <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
            {objectives.flatMap(obj => getRequirements(obj.item_uid)).flatMap(req => getUserStories(req.item_uid)).map(us => (
              <div
                key={us.item_uid}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropOnParent(e, us.item_uid)}
              >
                {renderCard(us, 'Task')}
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px', backgroundColor: '#131b2e', borderBottom: '1px solid #1e293b', fontWeight: 700, fontSize: '0.85rem', color: '#fde047' }}>
            🔨 4. Task (研發任務)
          </div>
          <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
            {objectives.flatMap(obj => getRequirements(obj.item_uid)).flatMap(req => getUserStories(req.item_uid)).flatMap(us => getTasks(us.item_uid)).map(task => (
              <div
                key={task.item_uid}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropOnParent(e, task.item_uid)}
              >
                {renderCard(task, 'UAT')}
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px', backgroundColor: '#131b2e', borderBottom: '1px solid #1e293b', fontWeight: 700, fontSize: '0.85rem', color: '#fca5a5' }}>
            🧪 5. UAT (驗收測試)
          </div>
          <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
            {objectives.flatMap(obj => getRequirements(obj.item_uid)).flatMap(req => getUserStories(req.item_uid)).flatMap(us => getTasks(us.item_uid)).flatMap(task => getUats(task.item_uid)).map(uat => (
              <div key={uat.item_uid}>
                {renderCard(uat)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
