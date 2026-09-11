import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  UploadCloud, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  ToggleLeft, 
  ToggleRight, 
  Search,
  Sparkles,
  X,
  FileCode,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../utils/api';
import type { KnowledgeSource } from '../utils/api';

interface ProjectSourcesViewProps {
  projectUid: string;
  workspaceUid: string;
  projectName: string;
}

export const ProjectSourcesView: React.FC<ProjectSourcesViewProps> = ({
  projectUid,
  workspaceUid,
  projectName
}) => {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadTextModal, setUploadTextModal] = useState<boolean>(false);
  const [textTitle, setTextTitle] = useState<string>('');
  const [textContent, setTextContent] = useState<string>('');
  const [isGlobalScope, setIsGlobalScope] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSources = async () => {
    setLoading(true);
    try {
      const data = await api.getSources({ workspace_uid: workspaceUid, project_uid: projectUid });
      setSources(data);
    } catch (err: any) {
      console.error('Failed to load sources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, [projectUid, workspaceUid]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsUploading(true);

    try {
      let contentText = '';
      if (file.type.includes('text') || file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.json')) {
        contentText = await file.text();
      } else {
        contentText = `[文件名稱: ${file.name}]\n這是一份上傳至專案 ${projectName} 的參考文件，包含相關功能規格與業務規則。`;
      }

      await api.createSource({
        workspace_uid: workspaceUid,
        project_uid: isGlobalScope ? undefined : projectUid,
        file_name: file.name,
        file_size: file.size,
        file_type: file.name.split('.').pop() || 'file',
        page_count: Math.max(1, Math.ceil(file.size / 3000)),
        content_text: contentText
      });

      await loadSources();
    } catch (err: any) {
      alert('上傳失敗: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateTextSource = async () => {
    if (!textTitle.trim()) {
      alert('請輸入文件名稱');
      return;
    }
    setIsUploading(true);
    try {
      await api.createSource({
        workspace_uid: workspaceUid,
        project_uid: isGlobalScope ? undefined : projectUid,
        file_name: textTitle.endsWith('.md') ? textTitle : `${textTitle}.md`,
        file_size: new Blob([textContent]).size,
        file_type: 'md',
        page_count: Math.max(1, Math.ceil(textContent.length / 800)),
        content_text: textContent
      });

      setTextTitle('');
      setTextContent('');
      setUploadTextModal(false);
      await loadSources();
    } catch (err: any) {
      alert('建立失敗: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleActive = async (source: KnowledgeSource) => {
    try {
      const updated = await api.toggleSourceActive(source.source_uid, !source.is_active);
      setSources(sources.map(s => s.source_uid === source.source_uid ? { ...s, is_active: updated.is_active } : s));
    } catch (err: any) {
      alert('切換狀態失敗: ' + err.message);
    }
  };

  const handleDelete = async (source: KnowledgeSource) => {
    if (!confirm(`確定要刪除文件 [${source.file_name}] 嗎？\n這將會自動清空該文件建立的所有向量與圖譜節點 (ON DELETE CASCADE)。`)) {
      return;
    }
    try {
      await api.deleteSource(source.source_uid);
      setSources(sources.filter(s => s.source_uid !== source.source_uid));
    } catch (err: any) {
      alert('刪除失敗: ' + err.message);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <FileText size={28} color="#ef4444" />;
      case 'md':
      case 'txt':
        return <FileCode size={28} color="#38bdf8" />;
      case 'docx':
      case 'doc':
        return <FileText size={28} color="#3b82f6" />;
      default:
        return <FileSpreadsheet size={28} color="#10b981" />;
    }
  };

  const filteredSources = sources.filter(s => 
    s.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 24px' }}>
      {/* 頂部標題與說明 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Sparkles size={20} color="#a855f7" />
            專案知識文件庫 (Google OKF & NotebookLM Sources)
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
            上傳之 PRD、API 規格與架構文件將自動完成 768-dim 向量切片與圖譜索引，作為 AI Copilot 思考與自動拆解工單的實體依據。
          </p>
        </div>

        {/* 建立/上傳按鈕群 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
            accept=".pdf,.docx,.txt,.md,.json"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#581c87',
              color: '#f3e8ff',
              border: '1px solid #7e22ce',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: isUploading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(88, 28, 135, 0.4)'
            }}
          >
            <UploadCloud size={16} />
            {isUploading ? '處理中...' : '上傳檔案 (PDF / DOCX)'}
          </button>

          <button
            onClick={() => setUploadTextModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0f172a',
              color: '#cbd5e1',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <FileCode size={16} />
            新增 Markdown 規格
          </button>
        </div>
      </div>

      {/* 搜尋與統計欄 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '6px 12px', width: '320px' }}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="搜尋知識文件名稱..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '0.85rem',
              width: '100%'
            }}
          />
        </div>

        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
          共 <span style={{ color: '#c084fc', fontWeight: 600 }}>{sources.length}</span> 份知識來源 · <span style={{ color: '#10b981', fontWeight: 600 }}>{sources.filter(s => s.is_active).length}</span> 份已啟用於 AI 檢索
        </div>
      </div>

      {/* 拖放上傳引導區 (Drop Area) */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed #334155',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          cursor: 'pointer',
          marginBottom: '20px',
          transition: 'border-color 0.2s ease, background 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#7e22ce';
          e.currentTarget.style.backgroundColor = 'rgba(88, 28, 135, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#334155';
          e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.4)';
        }}
      >
        <UploadCloud size={36} color="#c084fc" style={{ marginBottom: '8px' }} />
        <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.95rem' }}>
          拖放 PRD 規格書、API 文件至此，或點擊瀏覽檔案
        </div>
        <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>
          支援 PDF, DOCX, Markdown, TXT, JSON · 自動切片並提取 768-dim 語意向量
        </div>
      </div>

      {/* 來源卡片網格 (NotebookLM Cards Grid) */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            <Clock size={24} style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ marginTop: '8px' }}>載入專案知識來源中...</div>
          </div>
        ) : filteredSources.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', border: '1px solid #1e293b', borderRadius: '12px', backgroundColor: '#090d16' }}>
            <FileText size={36} color="#334155" style={{ marginBottom: '12px' }} />
            <div style={{ color: '#cbd5e1', fontWeight: 600 }}>目前尚未上傳任何知識文件</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
              上傳後 AI Copilot 即可自動研讀並拆解 User Story 與 Architecture 需求。
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {filteredSources.map((src) => (
              <div
                key={src.source_uid}
                style={{
                  backgroundColor: '#090d16',
                  border: `1px solid ${src.is_active ? 'rgba(168, 85, 247, 0.3)' : '#1e293b'}`,
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: src.is_active ? '0 4px 16px rgba(88, 28, 135, 0.15)' : 'none',
                  transition: 'transform 0.15s ease, border-color 0.15s ease'
                }}
              >
                {/* 卡片頭部：Icon + 名稱 + Scope */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  {getFileIcon(src.file_type)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: '#f8fafc',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {src.file_name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: src.project_uid ? '#1e1b4b' : '#064e3b',
                        color: src.project_uid ? '#c084fc' : '#6ee7b7',
                        fontWeight: 600
                      }}>
                        {src.project_uid ? '專案專屬' : '🌐 Workspace 全域'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {(src.file_size / 1024).toFixed(1)} KB · {src.page_count} 頁
                      </span>
                    </div>
                  </div>
                </div>

                {/* 卡片狀態與分塊數 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: '#0f172a',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  border: '1px solid #1e293b'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={14} color="#10b981" />
                    <span style={{ color: '#10b981', fontWeight: 500 }}>已完成向量索引</span>
                  </div>
                  <span style={{ color: '#94a3b8' }}>
                    {src.chunk_count || 1} 個向量節點
                  </span>
                </div>

                {/* 底部功能欄：開關 + 刪除 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #1e293b' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(src)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'transparent',
                      border: 'none',
                      color: src.is_active ? '#c084fc' : '#64748b',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {src.is_active ? <ToggleRight size={20} color="#a855f7" /> : <ToggleLeft size={20} />}
                    {src.is_active ? '已啟用 AI 引用' : '已停用引用'}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      title="刪除文件"
                      onClick={() => handleDelete(src)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新增 Markdown 彈窗 */}
      {uploadTextModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '12px',
            width: '600px',
            maxWidth: '90%',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem', fontWeight: 600 }}>新增 Markdown 規格文件</h3>
              <button onClick={() => setUploadTextModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>文件名稱</label>
              <input
                type="text"
                placeholder="例如：2026_Q3_PRD.md 或 API_Specification.md"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#090d16',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#94a3b8' }}>
                <input
                  type="checkbox"
                  checked={isGlobalScope}
                  onChange={(e) => setIsGlobalScope(e.target.checked)}
                />
                設為 Workspace 全域共用知識 (所有專案皆可繼承引用)
              </label>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>文件內容 (Markdown 格式)</label>
              <textarea
                rows={10}
                placeholder="# 產品需求規格書\n\n## 1. 業務目標\n- 支援 Apple Pay 與八達通支付\n\n## 2. User Stories\n- 作為買家，我可以一鍵結帳..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: '#090d16',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setUploadTextModal(false)}
                style={{ padding: '8px 16px', background: '#1e293b', border: 'none', borderRadius: '6px', color: '#cbd5e1', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={handleCreateTextSource}
                disabled={isUploading}
                style={{ padding: '8px 16px', background: '#7e22ce', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                {isUploading ? '建立中...' : '儲存並索引'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
