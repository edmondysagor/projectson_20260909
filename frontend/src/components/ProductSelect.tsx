import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, ChevronDown, Check, X, Box } from 'lucide-react';
import { api } from '../utils/api';
import type { Project } from '../utils/api';

interface ProductSelectProps {
  value?: string; // parent_project_uid
  products: Project[];
  workspaceUid: string;
  onChange: (productUid: string | null) => Promise<void> | void;
  onRefreshProducts?: () => Promise<void> | void;
  placeholder?: string;
  allowClear?: boolean;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
}

export const ProductSelect: React.FC<ProductSelectProps> = ({
  value,
  products,
  workspaceUid,
  onChange,
  onRefreshProducts,
  placeholder = '-- 未關聯產品 (None) --',
  allowClear = true,
  size = 'md',
  style,
  buttonStyle
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProduct = products.find(p => p.project_uid === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredProducts = products.filter(p => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return p.project_name.toLowerCase().includes(q) || p.project_display_code.toLowerCase().includes(q);
  });

  const exactMatch = products.some(
    p => p.project_name.toLowerCase() === searchQuery.trim().toLowerCase()
  );

  const handleSelectProduct = async (productUid: string | null) => {
    await onChange(productUid);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleCreateAndSelect = async () => {
    const nameToCreate = searchQuery.trim();
    if (!nameToCreate || !workspaceUid) return;
    setCreating(true);
    try {
      const newProduct = await api.createProject({
        project_name: nameToCreate,
        project_type: 'Product',
        related_workspace_uid: workspaceUid,
        project_status: 'Active'
      });
      if (onRefreshProducts) {
        await onRefreshProducts();
      }
      await onChange(newProduct.project_uid);
      setIsOpen(false);
      setSearchQuery('');
    } catch (err: any) {
      alert('建立產品失敗: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const isSmall = size === 'sm';

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', width: style?.width || 'auto', ...style }}>
      {/* 觸發按鈕 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: isSmall ? '3px 8px' : '6px 10px',
          backgroundColor: '#1b2438',
          border: '1px solid #2d3b55',
          borderRadius: '6px',
          color: selectedProduct ? '#f8fafc' : '#94a3b8',
          fontSize: isSmall ? '0.75rem' : '0.82rem',
          fontWeight: 500,
          cursor: 'pointer',
          width: '100%',
          boxSizing: 'border-box',
          outline: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'border-color 0.15s, background-color 0.15s',
          ...buttonStyle
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#222d45';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = (buttonStyle?.backgroundColor as string) || '#1b2438';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedProduct ? (
            <>
              <span style={{
                padding: isSmall ? '1px 4px' : '2px 6px',
                borderRadius: '4px',
                backgroundColor: '#064e3b',
                color: '#6ee7b7',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: isSmall ? '0.65rem' : '0.72rem',
                fontWeight: 700,
                flexShrink: 0
              }}>
                <Box size={11} />
                {selectedProduct.project_display_code}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedProduct.project_name}
              </span>
            </>
          ) : (
            <span style={{ color: '#64748b' }}>{placeholder}</span>
          )}
        </div>

        {/* 右側下拉箭頭 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #334155', paddingLeft: '6px', marginLeft: '4px' }}>
          <ChevronDown size={14} color="#94a3b8" />
        </div>
      </button>

      {/* 下拉搜尋與列表面板 (對齊 MemberSelect 規範) */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          minWidth: '260px',
          width: '100%',
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 150,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 搜尋輸入欄 (Input Search) */}
          <div style={{ padding: '8px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#131b2e' }}>
            <Search size={14} color="#64748b" />
            <input
              autoFocus
              type="text"
              placeholder="搜尋產品代號、名稱..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f8fafc',
                fontSize: '0.8rem',
                width: '100%'
              }}
            />
          </div>

          {/* 清除選項 (None) */}
          {allowClear && (
            <div
              onClick={() => handleSelectProduct(null)}
              style={{
                padding: '6px 10px',
                fontSize: '0.78rem',
                color: '#94a3b8',
                cursor: 'pointer',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X size={12} />
              <span>-- 無關聯產品 (None) --</span>
            </div>
          )}

          {/* 產品列表 (Drop Down List) */}
          <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {filteredProducts.map(prod => {
              const isSelected = prod.project_uid === value;
              return (
                <div
                  key={prod.project_uid}
                  onClick={() => handleSelectProduct(prod.project_uid)}
                  style={{
                    padding: '8px 10px',
                    fontSize: '0.8rem',
                    color: isSelected ? '#38bdf8' : '#cbd5e1',
                    backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #131b2e'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isSelected ? 'rgba(56, 189, 248, 0.15)' : '#1e293b'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isSelected ? 'rgba(56, 189, 248, 0.1)' : 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span style={{
                      padding: '2px 5px',
                      borderRadius: '4px',
                      backgroundColor: '#064e3b',
                      color: '#6ee7b7',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      {prod.project_display_code}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {prod.project_name}
                    </span>
                  </div>

                  {isSelected && <Check size={14} color="#38bdf8" />}
                </div>
              );
            })}

            {filteredProducts.length === 0 && !searchQuery.trim() && (
              <div style={{ padding: '12px', fontSize: '0.78rem', color: '#64748b', textAlign: 'center' }}>
                尚無任何產品
              </div>
            )}
          </div>

          {/* 即時創建新產品 (Input search & create) */}
          {searchQuery.trim() && !exactMatch && (
            <div
              onClick={handleCreateAndSelect}
              style={{
                padding: '8px 10px',
                backgroundColor: '#162238',
                borderTop: '1px solid #23304a',
                color: '#38bdf8',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: creating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d2e4d'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#162238'}
            >
              <Plus size={14} />
              <span>{creating ? '建立中...' : `+ 新增產品 "${searchQuery.trim()}"`}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
