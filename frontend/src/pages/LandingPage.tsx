import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  ChevronDown, 
  RefreshCw, 
  CheckCircle2, 
  Radio, 
  Gauge,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleEnterMissionControl = () => {
    if (isAuthenticated) {
      navigate('/app');
    } else {
      navigate('/auth/sign-in');
    }
  };

  // --- 狀態 1: Active Section Tracker (3 截精準導航) ---
  const [activeSection, setActiveSection] = useState<number>(0);
  const sectionIds = ['mission', 'dual-engine', 'airlock-access'];

  // --- 狀態 2: Live Ingestion Beam (Hero 互動模擬器) ---
  const [ingestionStep, setIngestionStep] = useState<'streaming' | 'resolving' | 'synthesized'>('synthesized');
  const [isResimulating, setIsResimulating] = useState(false);

  const handleResimulate = () => {
    if (isResimulating) return;
    setIsResimulating(true);
    setIngestionStep('streaming');
    setTimeout(() => {
      setIngestionStep('resolving');
      setTimeout(() => {
        setIngestionStep('synthesized');
        setIsResimulating(false);
      }, 1200);
    }, 1400);
  };

  // --- 狀態 3: 雙面人系統視角切換 (The Two-Faced System Switcher) ---
  const [activePerspective, setActivePerspective] = useState<'frontline' | 'pmo'>('frontline');

  // --- 狀態 4: HITL 審批模擬器 (Sandbox Diff Simulator) ---
  const [proposalStatus, setProposalStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleAcceptProposal = () => {
    setProposalStatus('accepted');
    setToastMessage('✓ AUDIT HASH #E8F9A2 COMMITTED TO NEON MASTER REPOSITORY');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleRejectProposal = () => {
    setProposalStatus('rejected');
    setToastMessage('✕ PROPOSAL REJECTED. MASTER STATE PRESERVED');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleResetProposal = () => {
    setProposalStatus('pending');
    setToastMessage(null);
  };

  // --- 狀態 5: Waitlist 表單 ---
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail || !waitlistEmail.includes('@')) return;
    setIsSubmitted(true);
  };

  // --- 背景 Canvas 渲染：SpaceX 深空動態星塵與神經星系拓撲 ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // 星塵與節點陣列
    const stars: Array<{ x: number; y: number; size: number; alpha: number; speed: number; vx: number; vy: number }> = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.8 + 0.5,
        alpha: Math.random() * 0.7 + 0.2,
        speed: Math.random() * 0.3 + 0.1,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 繪製微弱的宇宙拓撲連線
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(stars[i].x, stars[i].y);
            ctx.lineTo(stars[j].x, stars[j].y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - dist / 110) * 0.12})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // 繪製星塵粒子
      for (let s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x = width;
        if (s.x > width) s.x = 0;
        if (s.y < 0) s.y = height;
        if (s.y > height) s.y = 0;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#ffffff';
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const scrollToSection = (idx: number) => {
    setActiveSection(idx);
    const element = document.getElementById(sectionIds[idx]);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div style={{
      backgroundColor: '#000000',
      color: '#ffffff',
      fontFamily: '"DIN Neuzeit Grotesk", "Inter", -apple-system, sans-serif',
      height: '100vh',
      overflowY: 'auto',
      scrollSnapType: 'y proximity',
      position: 'relative',
      userSelect: 'text'
    }}>
      {/* 宇宙背景 Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* 頂部 SpaceX 經典極簡透明導航列 */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 100,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        height: '68px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        boxSizing: 'border-box'
      }}>
        {/* 品牌 LOGO */}
        <div 
          onClick={() => scrollToSection(0)}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '14px', 
            cursor: 'pointer' 
          }}
        >
          <span style={{
            fontSize: '1.25rem',
            fontWeight: 900,
            letterSpacing: '3px',
            color: '#ffffff',
            textTransform: 'uppercase'
          }}>
            PROJECT 神
          </span>
          <div style={{
            fontSize: '0.65rem',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: '#10b981',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            padding: '2px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10b981' }} className="animate-pulse" />
            TELEMETRY: NOMINAL
          </div>
        </div>

        {/* 航天選單導航 (3 截) */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          {[
            { label: '01 MISSION', idx: 0 },
            { label: '02 DUAL PROPULSION', idx: 1 },
            { label: '03 AIRLOCK & ACCESS', idx: 2 }
          ].map(nav => (
            <button
              key={nav.label}
              onClick={() => scrollToSection(nav.idx)}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeSection === nav.idx ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                fontSize: '0.78rem',
                fontWeight: 700,
                letterSpacing: '2px',
                cursor: 'pointer',
                transition: 'color 0.2s',
                textTransform: 'uppercase',
                borderBottom: activeSection === nav.idx ? '2px solid #ffffff' : '2px solid transparent',
                paddingBottom: '4px'
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
              onMouseLeave={e => {
                if (activeSection !== nav.idx) e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
              }}
            >
              {nav.label}
            </button>
          ))}
        </nav>

        {/* SpaceX 經典直角邊框反白按鈕 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => navigate('/auth/sign-in')}
            style={{
              padding: '8px 20px',
              backgroundColor: 'transparent',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '1.5px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.25s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.color = '#000000';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#ffffff';
            }}
          >
            SIGN IN
          </button>

          <button
            onClick={handleEnterMissionControl}
            style={{
              padding: '8px 22px',
              backgroundColor: '#ffffff',
              color: '#000000',
              border: '1px solid #ffffff',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '1.5px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.25s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.color = '#000000';
            }}
          >
            ENTER MISSION CONTROL
          </button>
        </div>
      </header>

      {/* 右側 SpaceX 經典垂直點狀導航指示 (HUD Paginator - 3 截) */}
      <div style={{
        position: 'fixed',
        right: '28px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {sectionIds.map((id, idx) => (
          <button
            key={id}
            onClick={() => scrollToSection(idx)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px'
            }}
            title={`Go to Section 0${idx + 1}`}
          >
            <span style={{
              fontSize: '0.65rem',
              fontFamily: 'monospace',
              color: activeSection === idx ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
              transition: 'color 0.2s'
            }}>
              0{idx + 1}
            </span>
            <div style={{
              width: activeSection === idx ? '24px' : '8px',
              height: '2px',
              backgroundColor: activeSection === idx ? '#ffffff' : 'rgba(255, 255, 255, 0.25)',
              transition: 'all 0.25s ease-out'
            }} />
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: [MISSION] — 專案管理神經系統升空 (Hero + Live Ingestion Beam) */}
      {/* ========================================================================= */}
      <section 
        id="mission" 
        style={{
          minHeight: '100vh',
          height: '100vh',
          scrollSnapAlign: 'start',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '0 60px 80px 60px',
          boxSizing: 'border-box',
          backgroundImage: `
            linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(0, 0, 0, 0.85) 100%),
            url('https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?q=80&w=2600&auto=format&fit=crop')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          zIndex: 1
        }}
      >
        <div style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px', alignItems: 'flex-end' }}>
          {/* 左側：SpaceX 巨型文字排版 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div style={{
              fontSize: '0.85rem',
              fontWeight: 800,
              letterSpacing: '4px',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.85)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Radio size={14} color="#10b981" className="animate-pulse" />
              <span>MISSION: AUTONOMOUS ENTERPRISE GOVERNANCE</span>
            </div>

            <h1 style={{
              fontSize: 'clamp(2.8rem, 5vw, 4.8rem)',
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: '-1.5px',
              margin: '0 0 24px 0',
              textTransform: 'uppercase',
              textShadow: '0 4px 20px rgba(0,0,0,0.8)'
            }}>
              FROM MESSY NOTES<br />
              <span style={{ color: '#ffffff', WebkitTextStroke: '1px rgba(255,255,255,0.8)' }}>
                TO PMP-GRADE TRACEABILITY
              </span>
            </h1>

            <p style={{
              fontSize: '1.05rem',
              lineHeight: 1.6,
              color: 'rgba(255, 255, 255, 0.85)',
              maxWidth: '620px',
              margin: '0 0 36px 0',
              letterSpacing: '0.3px',
              textShadow: '0 2px 10px rgba(0,0,0,0.9)'
            }}>
              擺脫 70% 行政內耗。開會語音與速記隨手丟入，AI 意圖分流自動織網，秒級編譯符合 ISO 審計規範的端到端追溯大表。
            </p>

            {/* 按鈕組 */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={handleEnterMissionControl}
                style={{
                  padding: '14px 34px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  border: '1px solid #ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.25s',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.6)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.color = '#000000';
                }}
              >
                LAUNCH SANDBOX DEMO
              </button>

              <button
                onClick={() => scrollToSection(1)}
                style={{
                  padding: '14px 30px',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(8px)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.25s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#ffffff';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                  e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.6)';
                }}
              >
                EXPLORE DUAL ENGINE ↓
              </button>
            </div>
          </motion.div>

          {/* 右側：SpaceX 遙測 HUD 數據卡片 (The Live Ingestion Beam) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{
              backgroundColor: 'rgba(5, 5, 8, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '24px',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              position: 'relative'
            }}
          >
            {/* 卡片標題與 HUD 參數 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
              paddingBottom: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Gauge size={16} color="#34d399" />
                <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}>
                  INGESTION BEAM HUD
                </span>
              </div>
              <button
                onClick={handleResimulate}
                disabled={isResimulating}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#ffffff',
                  padding: '3px 10px',
                  fontSize: '0.7rem',
                  letterSpacing: '1px',
                  cursor: isResimulating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={10} className={isResimulating ? 'animate-spin' : ''} />
                {isResimulating ? 'ROUTING...' : 'RE-SIMULATE'}
              </button>
            </div>

            {/* 模擬語音輸入 */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '12px',
              fontSize: '0.82rem',
              color: 'rgba(255, 255, 255, 0.85)',
              fontFamily: 'monospace',
              lineHeight: 1.5,
              marginBottom: '14px'
            }}>
              &gt; RAW TELEMETRY: "Karl: BU added Phase 2 YOY filter for Lounges. Bug #101 safari styling fixed, but IMT API still blocked..."
            </div>

            {/* 自動解析的三項原子輸出 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '120px' }}>
              <AnimatePresence mode="wait">
                {ingestionStep === 'streaming' && (
                  <motion.div
                    key="streaming"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ padding: '24px', textAlign: 'center', color: '#93c5fd', fontSize: '0.8rem', fontFamily: 'monospace' }}
                  >
                    <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#38bdf8' }} />
                    TELEMETRY: EXTRACTING ATOMIC INTENT FROM AUDIO TRANSCRIPT...
                  </motion.div>
                )}

                {ingestionStep === 'resolving' && (
                  <motion.div
                    key="resolving"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ padding: '24px', textAlign: 'center', color: '#a78bfa', fontSize: '0.8rem', fontFamily: 'monospace' }}
                  >
                    <div style={{ fontSize: '1.1rem', marginBottom: '6px' }}>⚡</div>
                    AI RESOLUTION: MATCHING POINTERS WITH PROJECT WBS MATRIX...
                  </motion.div>
                )}

                {ingestionStep === 'synthesized' && (
                  <motion.div
                    key="synthesized"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                  >
                    <div style={{
                      padding: '8px 12px',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                      fontFamily: 'monospace'
                    }}>
                      <span style={{ color: '#34d399' }}>✓ UPDATE Task #101 ➔ Closed</span>
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>SAFARI CSS OK</span>
                    </div>

                    <div style={{
                      padding: '8px 12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                      fontFamily: 'monospace'
                    }}>
                      <span style={{ color: '#f87171' }}>🚨 BOTTLENECK #05 ➔ IMT Token</span>
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>CRITICAL PATH</span>
                    </div>

                    <div style={{
                      padding: '8px 12px',
                      backgroundColor: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                      fontFamily: 'monospace'
                    }}>
                      <span style={{ color: '#38bdf8' }}>📋 REQ #001 ➔ Dimension: YOY</span>
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>LOUNGE BI</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* 底部 SpaceX 滾動引導箭頭 */}
        <div 
          onClick={() => scrollToSection(1)}
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            opacity: 0.8,
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
        >
          <ChevronDown size={22} color="#ffffff" className="animate-bounce" />
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 2: [DUAL PROPULSION] — 雙面人推進系統 (Frontline Speed vs PMO Traceability) */}
      {/* ========================================================================= */}
      <section 
        id="dual-engine" 
        style={{
          minHeight: '100vh',
          scrollSnapAlign: 'start',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '100px 60px',
          boxSizing: 'border-box',
          backgroundImage: `
            linear-gradient(to top, rgba(0, 0, 0, 0.92) 0%, rgba(0, 0, 0, 0.5) 50%, rgba(0, 0, 0, 0.92) 100%),
            url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2600&auto=format&fit=crop')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 1
        }}
      >
        <div style={{ maxWidth: '1280px', width: '100%', margin: '0 auto' }}>
          <div style={{
            fontSize: '0.85rem',
            fontWeight: 800,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.85)',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Sparkles size={16} color="#38bdf8" />
            <span>SYSTEM CAPABILITY 01 // THE TWO-FACED SYSTEM</span>
          </div>

          <h2 style={{
            fontSize: 'clamp(2.2rem, 4vw, 3.6rem)',
            fontWeight: 900,
            letterSpacing: '-1px',
            margin: '0 0 16px 0',
            textTransform: 'uppercase',
            textShadow: '0 4px 20px rgba(0,0,0,0.9)'
          }}>
            DUAL-PROPULSION ARCHITECTURE<br />
            <span style={{ color: '#ffffff' }}>雙面人推進系統・前線快感 × 高層審計</span>
          </h2>

          <p style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.85)',
            maxWidth: '700px',
            margin: '0 0 32px 0',
            lineHeight: 1.6,
            textShadow: '0 2px 10px rgba(0,0,0,0.9)'
          }}>
            為前線工程師提供零阻力的 Notion 式速記畫布；同時為 PMO 與主管即時編譯端到端 PMP 級跨行審計大表。
          </p>

          {/* 視角切換器 */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
            <button
              onClick={() => setActivePerspective('frontline')}
              style={{
                padding: '10px 24px',
                backgroundColor: activePerspective === 'frontline' ? '#ffffff' : 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                color: activePerspective === 'frontline' ? '#000000' : '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                fontSize: '0.78rem',
                fontWeight: 800,
                letterSpacing: '1.5px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'all 0.2s'
              }}
            >
              01 // FRONTLINE AGILE MODE
            </button>

            <button
              onClick={() => setActivePerspective('pmo')}
              style={{
                padding: '10px 24px',
                backgroundColor: activePerspective === 'pmo' ? '#ffffff' : 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                color: activePerspective === 'pmo' ? '#000000' : '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                fontSize: '0.78rem',
                fontWeight: 800,
                letterSpacing: '1.5px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'all 0.2s'
              }}
            >
              02 // EXECUTIVE AUDIT MATRIX
            </button>
          </div>

          {/* 展示面板 */}
          <div style={{
            backgroundColor: 'rgba(5, 5, 8, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            padding: '28px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
          }}>
            <AnimatePresence mode="wait">
              {activePerspective === 'frontline' ? (
                <motion.div
                  key="frontline"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '200px 1fr 280px',
                    gap: '20px',
                    minHeight: '280px'
                  }}
                >
                  <div style={{ border: '1px solid rgba(255,255,255,0.12)', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '2px', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
                      WORKSPACES
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                      🏢 Tai Ping Mun Tech
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                      📁 Q3 Lounge System
                    </div>
                  </div>

                  <div style={{ border: '1px solid rgba(255,255,255,0.12)', padding: '20px', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '2px', color: '#34d399', marginBottom: '10px' }}>
                      NOTION-LIKE MASTER CANVAS
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 10px 0' }}>
                      Q3 貴賓室專案架構速記
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
                      • 語音對話即刻轉錄為工單原子實體。<br />
                      • 支援 Google OAuth 2.0 官方認證與三級角色權限。<br />
                      • 零數據外洩，企業專屬資料庫安全隔離。
                    </p>
                  </div>

                  <div style={{ border: '1px solid rgba(255,255,255,0.18)', padding: '16px', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '2px', color: '#38bdf8', marginBottom: '12px' }}>
                      AI COPILOT ROUTER
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>
                      "已自動提取 3 項原子變更，點擊同步即可送交 PMO 審計大表。"
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="pmo"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ overflowX: 'auto' }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.7)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                        <th style={{ padding: '12px 14px' }}>OBJECTIVE</th>
                        <th style={{ padding: '12px 14px' }}>REQUIREMENT</th>
                        <th style={{ padding: '12px 14px' }}>DEV TASK</th>
                        <th style={{ padding: '12px 14px' }}>UAT GATE</th>
                        <th style={{ padding: '12px 14px' }}>RELEASE</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <td style={{ padding: '14px', fontWeight: 700, color: '#ffffff' }} rowSpan={2}>
                          OBJ-01<br />LOUNGE REVENUE
                        </td>
                        <td style={{ padding: '14px', color: '#ffffff' }}>
                          REQ-01: YOY HISTORICAL FILTER
                        </td>
                        <td style={{ padding: '14px', color: '#38bdf8', fontFamily: 'monospace' }}>
                          #TSK-401 API DEPLOYED
                        </td>
                        <td style={{ padding: '14px', color: '#34d399', fontWeight: 700 }}>
                          ✓ 98% PASS
                        </td>
                        <td style={{ padding: '14px', color: 'rgba(255,255,255,0.8)' }}>
                          v2.4.0 PROD
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <td style={{ padding: '14px', color: '#ffffff' }}>
                          REQ-02: MULTI-TIER RBAC ACCESS
                        </td>
                        <td style={{ padding: '14px', color: '#38bdf8', fontFamily: 'monospace' }}>
                          #TSK-402 OAUTH AUTH
                        </td>
                        <td style={{ padding: '14px', color: '#34d399', fontWeight: 700 }}>
                          ✓ 100% PASS
                        </td>
                        <td style={{ padding: '14px', color: 'rgba(255,255,255,0.8)' }}>
                          v2.4.0 PROD
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 3: [AIRLOCK & ACCESS] — 防幻覺氣閘審批門禁 + 即時發射入口 */}
      {/* ========================================================================= */}
      <section 
        id="airlock-access" 
        style={{
          minHeight: '100vh',
          scrollSnapAlign: 'start',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '90px 60px 80px 60px',
          boxSizing: 'border-box',
          backgroundImage: `
            linear-gradient(to top, rgba(0, 0, 0, 0.94) 0%, rgba(0, 0, 0, 0.55) 50%, rgba(0, 0, 0, 0.94) 100%),
            url('https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=2600&auto=format&fit=crop')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 1
        }}
      >
        <div style={{ maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
          {/* 上半部：HITL 防幻覺氣閘 */}
          <div style={{ marginBottom: '40px' }}>
            <div style={{
              fontSize: '0.85rem',
              fontWeight: 800,
              letterSpacing: '4px',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.85)',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <ShieldCheck size={16} color="#10b981" />
              <span>SECURITY PROTOCOL 02 // ZERO-HALLUCINATION HITL AIRLOCK</span>
            </div>

            <h2 style={{
              fontSize: 'clamp(2rem, 3.8vw, 3.2rem)',
              fontWeight: 900,
              letterSpacing: '-1px',
              margin: '0 0 12px 0',
              textTransform: 'uppercase',
              textShadow: '0 4px 20px rgba(0,0,0,0.9)'
            }}>
              防幻覺氣閘審批門禁
            </h2>

            <p style={{
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.85)',
              maxWidth: '750px',
              margin: '0 0 20px 0',
              lineHeight: 1.5,
              textShadow: '0 2px 10px rgba(0,0,0,0.9)'
            }}>
              AI 絕不直接竄改主庫。所有變更均需經過人類確認（Human-In-The-Loop），在沙盒中完成 Diff 比對授權後才安全寫入 Neon PostgreSQL。
            </p>

            {/* 氣閘審批卡片 */}
            <div style={{
              backgroundColor: 'rgba(5, 5, 8, 0.88)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '24px',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                paddingBottom: '12px',
                marginBottom: '16px'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#38bdf8' }}>
                  AIRLOCK PROPOSAL DIFF INSPECTOR
                </span>
                <button
                  onClick={handleResetProposal}
                  style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', letterSpacing: '1px', cursor: 'pointer' }}
                >
                  RESET AIRLOCK
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr auto',
                gap: '16px',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '16px'
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  STAKEHOLDER
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontFamily: 'monospace' }}>
                  <span style={{
                    fontSize: '0.8rem',
                    color: 'rgba(255,255,255,0.5)',
                    textDecoration: proposalStatus === 'accepted' ? 'line-through' : 'none',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    padding: '4px 10px'
                  }}>
                    OLD: TBC (待確認)
                  </span>

                  <ArrowRight size={14} color="rgba(255,255,255,0.5)" />

                  <span style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: proposalStatus === 'accepted' ? '#34d399' : proposalStatus === 'rejected' ? '#f87171' : '#38bdf8',
                    backgroundColor: proposalStatus === 'accepted' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                    padding: '4px 12px',
                    border: proposalStatus === 'accepted' ? '1px solid #10b981' : '1px solid rgba(56, 189, 248, 0.4)'
                  }}>
                    {proposalStatus === 'accepted'
                      ? '✓ COMMITTED: JOSH ROGERS (HEAD OF ADA DATA)'
                      : proposalStatus === 'rejected'
                      ? '✕ PROPOSAL REJECTED'
                      : 'AI PROPOSAL: JOSH ROGERS (HEAD OF ADA DATA)'}
                  </span>
                </div>

                {/* 審批按鈕 */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleAcceptProposal}
                    disabled={proposalStatus !== 'pending'}
                    style={{
                      padding: '7px 16px',
                      backgroundColor: proposalStatus === 'accepted' ? '#10b981' : '#ffffff',
                      color: '#000000',
                      border: 'none',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      letterSpacing: '1px',
                      cursor: proposalStatus === 'pending' ? 'pointer' : 'default',
                      textTransform: 'uppercase'
                    }}
                  >
                    ✓ ACCEPT
                  </button>

                  <button
                    onClick={handleRejectProposal}
                    disabled={proposalStatus !== 'pending'}
                    style={{
                      padding: '7px 16px',
                      backgroundColor: 'transparent',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.35)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '1px',
                      cursor: proposalStatus === 'pending' ? 'pointer' : 'default',
                      textTransform: 'uppercase'
                    }}
                  >
                    ✕ REJECT
                  </button>
                </div>
              </div>

              {toastMessage && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#34d399',
                  fontSize: '0.78rem',
                  fontFamily: 'monospace',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle2 size={16} />
                  <span>{toastMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* 下半部：即時預約與登艦 CTA */}
          <div style={{
            textAlign: 'center',
            padding: '24px 20px 0 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: '#34d399',
              marginBottom: '10px'
            }}>
              T-MINUS 0 // FINAL COUNTDOWN
            </div>

            <h3 style={{
              fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
              fontWeight: 900,
              letterSpacing: '-1px',
              margin: '0 0 16px 0',
              textTransform: 'uppercase',
              textShadow: '0 4px 20px rgba(0,0,0,0.9)'
            }}>
              READY FOR MISSION LAUNCH?
            </h3>

            {isSubmitted ? (
              <div style={{
                padding: '14px 24px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#34d399',
                fontSize: '0.85rem',
                fontWeight: 700,
                fontFamily: 'monospace',
                letterSpacing: '1px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                backdropFilter: 'blur(12px)'
              }}>
                <CheckCircle2 size={18} />
                PILOT APPLICATION RECEIVED. MISSION CONTROL WILL CONTACT YOU IN 24H.
              </div>
            ) : (
              <form onSubmit={handleWaitlistSubmit} style={{
                display: 'flex',
                maxWidth: '520px',
                margin: '0 auto 20px auto',
                gap: '10px',
                flexWrap: 'wrap'
              }}>
                <input
                  type="email"
                  required
                  placeholder="ENTERPRISE WORK EMAIL..."
                  value={waitlistEmail}
                  onChange={e => setWaitlistEmail(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '240px',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    letterSpacing: '1px',
                    outline: 'none'
                  }}
                />

                <button
                  type="submit"
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    border: '1px solid #ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.25s',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.6)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.color = '#000000';
                  }}
                >
                  INITIALIZE PILOT
                </button>
              </form>
            )}
          </div>
        </div>

        {/* 頁尾 SpaceX 航天條款 */}
        <footer style={{
          position: 'absolute',
          bottom: '16px',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          fontSize: '0.7rem',
          color: 'rgba(255, 255, 255, 0.5)',
          letterSpacing: '1.5px',
          textTransform: 'uppercase'
        }}>
          <span>PROJECT 神 © 2026</span>
          <span>● CLOUDFLARE EDGE</span>
          <span>● NEON POSTGRESQL</span>
          <span>● SOC2 COMPLIANT</span>
        </footer>
      </section>
    </div>
  );
};
