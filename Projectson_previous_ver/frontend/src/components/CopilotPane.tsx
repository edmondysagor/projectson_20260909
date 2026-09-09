import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../utils/api';

interface CopilotPaneProps {
  chatHistory: ChatMessage[];
  onSendMessage: (msg: string) => Promise<void>;
  isGenerating: boolean;
}

export const CopilotPane: React.FC<CopilotPaneProps> = ({
  chatHistory,
  onSendMessage,
  isGenerating,
}) => {
  const [input, setInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isGenerating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    const msg = input;
    setInput('');
    await onSendMessage(msg);
  };

  // Drag and Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const text = await file.text();
      if (text.trim()) {
        await onSendMessage(text);
      }
    }
  };

  return (
    <div style={styles.container}>
      {/* Pane Header */}
      <div style={styles.header}>
        <div style={styles.headerTitleRow}>
          <span style={styles.aiSparkle}>✦</span>
          <h3 style={styles.title}>Project 神 Co-Pilot</h3>
        </div>
        <p style={styles.subtitle}>上傳會議紀錄，自動規劃並提取更新</p>
      </div>

      {/* Chat Messages Log */}
      <div style={styles.chatArea}>
        {chatHistory.length === 0 ? (
          <div style={styles.emptyChat}>
            <span style={{ fontSize: '24px', marginBottom: '8px' }}>💬</span>
            <p>輸入會議記錄、Task 變更要求，或者拖放會議記錄文字檔 (.txt) 到下方對話框以提取行動點與會議網格。</p>
          </div>
        ) : (
          chatHistory.map((chat, i) => {
            const isUser = chat.sender === 'user';
            return (
              <div
                key={i}
                style={{
                  ...styles.messageRow,
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    ...styles.messageBubble,
                    ...(isUser ? styles.userBubble : styles.assistantBubble),
                  }}
                >
                  <div style={styles.bubbleHeader}>
                    {isUser ? '你' : 'AI 助理'}
                  </div>
                  <div style={styles.bubbleText}>{chat.message}</div>
                </div>
              </div>
            );
          })
        )}
        {isGenerating && (
          <div style={styles.messageRow}>
            <div style={{ ...styles.messageBubble, ...styles.assistantBubble }}>
              <div style={styles.bubbleHeader}>AI 助理</div>
              <div style={styles.typingContainer}>
                <span style={styles.dot1}>.</span>
                <span style={styles.dot2}>.</span>
                <span style={styles.dot3}>.</span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area + Dropzone */}
      <form
        onSubmit={handleSubmit}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        style={{
          ...styles.inputForm,
          ...(dragActive ? styles.inputFormActive : {}),
        }}
      >
        {dragActive && (
          <div style={styles.dragOverlay}>
            <p style={styles.dragText}>放開以讀取會議記錄檔案 📄</p>
          </div>
        )}
        
        <textarea
          style={styles.chatInput}
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="在此輸入或貼上會議紀錄... (或直接拖放 .txt 檔案到這裡)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />

        <div style={styles.controls}>
          <span style={styles.dropHint}>支持 .txt 檔案拖放</span>
          <button style={styles.sendBtn} type="submit" disabled={isGenerating || !input.trim()}>
            <svg style={styles.sendIcon} fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

const styles = {
  container: {
    height: '60%', // Top half of the 4th column
    display: 'flex',
    flexDirection: 'column' as const,
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: '#07090F',
  },
  header: {
    padding: '20px',
    borderBottom: '1px solid var(--border-color)',
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  aiSparkle: {
    color: 'var(--accent-secondary)',
    fontWeight: 'bold',
    fontSize: '16px',
    textShadow: '0 0 10px var(--accent-secondary-glow)',
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  subtitle: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  chatArea: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  emptyChat: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    color: 'var(--text-muted)',
    fontSize: '12px',
    padding: '30px 10px',
    lineHeight: '1.6',
    flex: 1,
  },
  messageRow: {
    display: 'flex',
    width: '100%',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '13px',
    lineHeight: '1.5',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  userBubble: {
    backgroundColor: 'var(--accent-primary)',
    color: '#fff',
    borderBottomRightRadius: '2px',
  },
  assistantBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    borderBottomLeftRadius: '2px',
  },
  bubbleHeader: {
    fontSize: '10px',
    fontWeight: 600,
    opacity: 0.7,
  },
  bubbleText: {
    whiteSpace: 'pre-wrap' as const,
  },
  typingContainer: {
    display: 'flex',
    gap: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  dot1: { animation: 'breathe 1.5s infinite 0.1s' },
  dot2: { animation: 'breathe 1.5s infinite 0.3s' },
  dot3: { animation: 'breathe 1.5s infinite 0.5s' },
  inputForm: {
    padding: '12px 16px 16px',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    position: 'relative' as const,
  },
  inputFormActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
  },
  dragOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    border: '2px dashed var(--accent-secondary)',
    zIndex: 10,
  },
  dragText: {
    color: 'var(--accent-secondary)',
    fontWeight: 600,
    fontSize: '13px',
  },
  chatInput: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    padding: '10px',
    fontSize: '13px',
    outline: 'none',
    resize: 'none' as const,
    fontFamily: 'var(--font-body)',
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropHint: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  sendBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: '#fff',
    borderRadius: '6px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
  },
  sendIcon: {
    width: '14px',
    height: '14px',
  },
};
export default CopilotPane;
