'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { store } from '../lib/store';
import Link from 'next/link';
import Image from 'next/image';

/* ─── Scroll animation hook ─── */
function useFadeInUp() {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible');
          obs.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ─── Animated section wrapper ─── */
function FadeSection({ children, className = '', id = '', style = {} }: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}) {
  const ref = useFadeInUp();
  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      id={id}
      className={`fade-in-up ${className}`}
      style={style}
    >
      {children}
    </section>
  );
}

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const user = store.getCurrentUser();
    if (user) {
      router.replace(user.role === 'consultor' ? '/consultor/dashboard' : '/cliente/dashboard');
    } else {
      setChecking(false);
    }
  }, [router]);

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#090506', color: '#c7a75c' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <div style={{ fontWeight: 600, letterSpacing: '3px', fontFamily: "'Outfit', sans-serif", fontSize: '12px', textTransform: 'uppercase', color: '#c7a75c', opacity: 0.9 }}>Carregando Portal...</div>
        </div>
        <style>{`
          .spinner {
            width: 50px;
            height: 50px;
            border: 3px solid rgba(199, 167, 92, 0.1);
            border-radius: 50%;
            border-top-color: #c7a75c;
            margin: 0 auto 24px;
            animation: spin 1s ease-in-out infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const services = [
    { icon: '📈', title: 'Contabilidade Estratégica', desc: 'Conformidade legal e contábil com foco na redução de custos e organização patrimonial de alta performance.' },
    { icon: '⚖️', title: 'Gestão Tributária', desc: 'Recuperação de impostos e planejamento tributário inteligente para maximizar seus lucros com segurança.' },
    { icon: '👥', title: 'Departamento Pessoal', desc: 'Gestão completa de folha de pagamento, benefícios e legislação trabalhista com 100% de conformidade.' },
    { icon: '💹', title: 'BPO Financeiro', desc: 'Terceirizamos toda a gestão financeira para você focar no crescimento estratégico do seu negócio.' },
    { icon: '🏛️', title: 'Patrimonial & Wealth', desc: 'Proteção de ativos e estruturação sucessória para famílias empresárias e grandes patrimônios.' },
    { icon: '🏢', title: 'Consultoria Societária', desc: 'Abertura, alteração e encerramento de empresas com agilidade jurídica e total segurança.' },
  ];

  const faqs = [
    { q: 'Como funciona o BPO Financeiro?', a: 'Nós assumimos as tarefas rotineiras como agendamento de pagamentos, emissão de notas e conciliação bancária, enquanto você foca na estratégia e crescimento.' },
    { q: 'O sistema aceita importação de arquivos OFX?', a: 'Sim, nosso portal permite a importação direta de arquivos OFX de qualquer banco para conciliação automatizada e relatórios instantâneos.' },
    { q: 'A consultoria é presencial ou online?', a: 'Atendemos empresas em todo o Brasil de forma 100% digital, com reuniões estratégicas via videoconferência e acesso ao portal exclusivo.' },
    { q: 'Qual o prazo para abertura de empresa?', a: 'Em média 5 a 10 dias úteis, dependendo do município e do regime tributário escolhido. Nossa equipe agiliza cada etapa.' },
  ];

  const blogPosts = [
    { date: '15 Mai, 2025', title: 'Mudanças no Simples Nacional para 2025', desc: 'Entenda como as novas regras impactam seu negócio e como se preparar com antecedência.', tag: 'Tributário' },
    { date: '10 Mai, 2025', title: 'A importância do BPO Financeiro', desc: 'Como a terceirização da gestão financeira libera o tempo do empreendedor para o que realmente importa.', tag: 'Gestão' },
    { date: '05 Mai, 2025', title: 'Reforma Tributária: O que esperar?', desc: 'Nossos consultores analisam os principais pontos aprovados e os próximos passos para as empresas.', tag: 'Reforma' },
  ];

  return (
    <div className="landing-page" style={{ backgroundColor: '#090506', color: '#f5f3f0', minHeight: '100vh', fontFamily: "'Inter', sans-serif", overflowX: 'hidden' }}>

      {/* ── Google Fonts and Premium Custom CSS styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap');

        /* Scroll Animation Base */
        .fade-in-up {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 1.2s cubic-bezier(.16,1,.3,1), transform 1.2s cubic-bezier(.16,1,.3,1);
        }
        .fade-in-up.visible {
          opacity: 1;
          transform: translateY(0);
        }

        h1, h2, h3, h4, .outfit-font {
          font-family: 'Outfit', sans-serif;
        }

        /* Glassmorphism Header (Dark theme) */
        .glass-header {
          background: rgba(9, 5, 6, 0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(199, 167, 92, 0.12);
          position: sticky;
          top: 0;
          z-index: 1000;
          transition: all 0.4s;
        }

        .nav-link {
          text-decoration: none;
          color: #bfaea7;
          font-weight: 500;
          font-size: 14px;
          position: relative;
          padding-bottom: 4px;
          transition: color 0.3s;
          letter-spacing: 0.5px;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0; height: 2px;
          background: #c7a75c;
          transform: scaleX(0);
          transition: transform 0.3s cubic-bezier(.16,1,.3,1);
          border-radius: 2px;
        }
        .nav-link:hover { color: #c7a75c; }
        .nav-link:hover::after { transform: scaleX(1); }

        /* Premium Buttons */
        .btn-gold {
          background: linear-gradient(135deg, #c7a75c 0%, #a88a44 100%);
          color: #090506 !important;
          border: 1px solid rgba(199, 167, 92, 0.4);
          box-shadow: 0 4px 20px rgba(199, 167, 92, 0.2);
          transition: all 0.4s cubic-bezier(.16,1,.3,1);
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .btn-gold:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 12px 30px rgba(199, 167, 92, 0.45);
          filter: brightness(1.1);
        }

        .btn-wine {
          background: linear-gradient(135deg, #8c1a22 0%, #52080d 100%);
          color: #fff !important;
          border: 1px solid rgba(199, 167, 92, 0.25);
          box-shadow: 0 4px 20px rgba(140, 26, 34, 0.3);
          transition: all 0.4s cubic-bezier(.16,1,.3,1);
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
        }
        .btn-wine:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 12px 30px rgba(140, 26, 34, 0.5);
          border-color: #c7a75c;
        }

        .btn-outline-gold {
          border: 1px solid rgba(199, 167, 92, 0.5);
          color: #c7a75c !important;
          background: rgba(199, 167, 92, 0.04);
          transition: all 0.4s cubic-bezier(.16,1,.3,1);
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .btn-outline-gold:hover {
          background: rgba(199, 167, 92, 0.12);
          border-color: #c7a75c;
          color: #fff !important;
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(199, 167, 92, 0.15);
        }

        /* Hero Mesh Background & Animation */
        .hero-mesh {
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(at 10% 10%, rgba(140, 26, 34, 0.22) 0px, transparent 50%),
            radial-gradient(at 90% 20%, rgba(199, 167, 92, 0.15) 0px, transparent 40%),
            radial-gradient(at 50% 80%, rgba(82, 8, 13, 0.28) 0px, transparent 50%);
          filter: blur(10px);
          z-index: 1;
        }
        .hero-grid {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(199, 167, 92, 0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(199, 167, 92, 0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          background-position: center;
          z-index: 2;
          transform: perspective(500px) rotateX(60deg) translateY(-100px);
          mask-image: linear-gradient(to bottom, transparent, rgba(0,0,0,0.8), transparent);
          opacity: 0.4;
          animation: gridMove 20s linear infinite;
        }
        @keyframes gridMove {
          0% { background-position: 0 0; }
          100% { background-position: 0 120px; }
        }

        /* Float elements */
        .floating-element {
          position: absolute;
          background: linear-gradient(135deg, rgba(199, 167, 92, 0.2) 0%, rgba(140, 26, 34, 0.1) 100%);
          border: 1px solid rgba(199, 167, 92, 0.15);
          backdrop-filter: blur(8px);
          border-radius: 50%;
          animation: float 8s ease-in-out infinite alternate;
        }
        @keyframes float {
          0% { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(-25px) rotate(15deg); }
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(199, 167, 92, 0.08);
          color: #c7a75c;
          padding: 8px 20px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 2px;
          border: 1px solid rgba(199, 167, 92, 0.2);
          font-family: 'Outfit', sans-serif;
          backdrop-filter: blur(4px);
        }

        /* Dark Premium Cards */
        .premium-card {
          background: rgba(22, 14, 16, 0.6);
          border: 1px solid rgba(199, 167, 92, 0.12);
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          transition: all 0.4s cubic-bezier(.16,1,.3,1);
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(10px);
        }
        .premium-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(199, 167, 92, 0.08) 0%, transparent 60%);
          opacity: 0;
          transition: opacity 0.4s;
          z-index: 1;
        }
        .premium-card:hover {
          transform: translateY(-8px);
          border-color: rgba(199, 167, 92, 0.4);
          box-shadow: 0 20px 50px rgba(140, 26, 34, 0.15);
        }
        .premium-card:hover::before {
          opacity: 1;
        }

        .service-icon {
          width: 60px; height: 60px;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(140, 26, 34, 0.15), rgba(199, 167, 92, 0.1));
          border: 1px solid rgba(199, 167, 92, 0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 26px; margin-bottom: 28px;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }

        /* Stats Cards */
        .stat-item {
          text-align: center;
          flex: 1;
          min-width: 220px;
          padding: 40px 24px;
          border-radius: 24px;
          background: rgba(22, 14, 16, 0.45);
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
          border: 1px solid rgba(199, 167, 92, 0.1);
          transition: all 0.3s cubic-bezier(.16,1,.3,1);
          backdrop-filter: blur(6px);
        }
        .stat-item:hover {
          transform: translateY(-5px);
          border-color: rgba(199, 167, 92, 0.35);
          box-shadow: 0 15px 40px rgba(140, 26, 34, 0.12);
        }

        /* FAQ Styling */
        .faq-item {
          background: rgba(22, 14, 16, 0.4);
          border: 1px solid rgba(199, 167, 92, 0.1);
          border-radius: 18px;
          margin-bottom: 16px;
          overflow: hidden;
          transition: all 0.3s;
        }
        .faq-item:hover {
          border-color: rgba(199, 167, 92, 0.3);
        }
        .faq-question {
          width: 100%;
          background: none;
          border: none;
          padding: 24px 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          font-family: 'Outfit', sans-serif;
          font-size: 17px;
          font-weight: 600;
          color: #f5f3f0;
          text-align: left;
          transition: background 0.2s;
        }
        .faq-question:hover { background: rgba(199, 167, 92, 0.03); }
        .faq-answer {
          padding: 0 28px;
          color: #bfaea7;
          line-height: 1.75;
          font-size: 15px;
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.35s ease, padding 0.35s ease;
        }
        .faq-answer.open {
          max-height: 200px;
          padding: 0 28px 24px;
        }
        .faq-icon {
          font-size: 20px;
          transition: transform 0.3s;
          color: #c7a75c;
          flex-shrink: 0;
        }
        .faq-icon.open { transform: rotate(45deg); color: #8c1a22; }

        /* Floating WhatsApp Button */
        .whatsapp-btn {
          position: fixed; bottom: 30px; right: 30px;
          width: 60px; height: 60px; background: #25d366; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 24px rgba(37,211,102,0.3); z-index: 999;
          text-decoration: none; font-size: 30px;
          transition: all 0.3s cubic-bezier(.16,1,.3,1);
        }
        .whatsapp-btn:hover {
          transform: scale(1.08) translateY(-3px);
          box-shadow: 0 12px 30px rgba(37,211,102,0.5);
        }

        /* Mobile Menu */
        .hamburger {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
        }
        .hamburger span {
          display: block;
          width: 24px;
          height: 2px;
          background: #c7a75c;
          margin: 5px 0;
          transition: 0.3s;
        }

        @media (max-width: 768px) {
          .nav-menu {
            display: none !important;
            flex-direction: column;
            position: absolute;
            top: 76px;
            left: 0;
            right: 0;
            background: #090506;
            border-bottom: 1px solid rgba(199, 167, 92, 0.2);
            padding: 30px;
            gap: 20px !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          }
          .nav-menu.active {
            display: flex !important;
          }
          .hamburger {
            display: block;
          }
          .hamburger.active span:nth-child(1) {
            transform: rotate(45deg) translate(5px, 5px);
          }
          .hamburger.active span:nth-child(2) {
            opacity: 0;
          }
          .hamburger.active span:nth-child(3) {
            transform: rotate(-45deg) translate(5px, -5px);
          }
        }
      `}</style>

      {/* ── HEADER ── */}
      <header className="glass-header" style={{
        padding: '0 8%',
        height: '76px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', width: '135px', height: '42px' }}>
            <Image 
              src="/logo.png" 
              alt="Privilege Contabilidade" 
              fill
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
        </Link>
        
        <nav className={`nav-menu ${menuOpen ? 'active' : ''}`} style={{ display: 'flex', gap: '36px', alignItems: 'center' }}>
          <a href="#servicos" className="nav-link" onClick={() => setMenuOpen(false)}>Serviços</a>
          <a href="#sobre" className="nav-link" onClick={() => setMenuOpen(false)}>Sobre Nós</a>
          <a href="#blog" className="nav-link" onClick={() => setMenuOpen(false)}>Blog</a>
          <a href="#contato" className="nav-link" onClick={() => setMenuOpen(false)}>Contato</a>
          <Link href="/login" className="btn-wine" style={{ padding: '12px 28px', borderRadius: '14px', fontSize: '13px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            Acesso Restrito
          </Link>
        </nav>

        <button className={`hamburger ${menuOpen ? 'active' : ''}`} onClick={() => setMenuOpen(!menuOpen)}>
          <span></span>
          <span></span>
          <span></span>
        </button>
      </header>

      {/* ── HERO SECTION ── */}
      <section style={{ position: 'relative', height: '90vh', minHeight: '650px', display: 'flex', alignItems: 'center', overflow: 'hidden', background: '#090506' }}>
        <div className="hero-mesh" />
        <div className="hero-grid" />
        
        {/* Animated Floating Bubbles */}
        <div className="floating-element" style={{ width: '120px', height: '120px', top: '15%', left: '10%', animationDelay: '0s' }} />
        <div className="floating-element" style={{ width: '80px', height: '80px', bottom: '20%', right: '8%', animationDelay: '2s' }} />
        <div className="floating-element" style={{ width: '60px', height: '60px', top: '25%', right: '35%', animationDelay: '4s' }} />
        
        <div style={{ position: 'relative', zIndex: 5, padding: '0 8%', maxWidth: '1280px', width: '100%', margin: '0 auto' }}>
          <div style={{ animation: 'fadeSlideUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
            <span className="hero-badge">
              💎 Excelência Contábil & Gestão Digital Avançada
            </span>
            <h1 style={{ fontSize: 'clamp(42px, 5.8vw, 80px)', fontWeight: 900, marginTop: '24px', marginBottom: '24px', lineHeight: '1.08', color: '#fff', letterSpacing: '-2px', textShadow: '0 4px 30px rgba(0,0,0,0.6)' }}>
              Muito além da contabilidade,<br />
              <span style={{ color: '#c7a75c', background: 'linear-gradient(to right, #f2dcab, #c7a75c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                inteligência de dados
              </span> para sua empresa.
            </h1>
            <p style={{ fontSize: '20px', color: '#bfaea7', lineHeight: '1.65', maxWidth: '640px', marginBottom: '48px', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
              Há mais de 30 anos unindo a tradição de uma assessoria contábil de excelência a soluções tecnológicas de alta performance financeira no seu dia a dia.
            </p>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <Link href="/login" className="btn-gold" style={{ padding: '18px 44px', borderRadius: '16px', fontSize: '15px' }}>
                Entrar no Portal do Cliente
              </Link>
              <a href="#contato" className="btn-outline-gold" style={{ padding: '18px 40px', borderRadius: '16px', fontSize: '15px' }}>
                Falar com um Consultor
              </a>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '2px', height: '55px', background: 'linear-gradient(to bottom, #c7a75c, transparent)', animation: 'scrollPulse 2s infinite' }} />
        </div>

        <style>{`
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes scrollPulse {
            0%, 100% { transform: translateY(0); opacity: 0.3; }
            50% { transform: translateY(10px); opacity: 1; }
          }
        `}</style>
      </section>

      {/* ── STATS SECTION ── */}
      <FadeSection id="sobre" style={{ padding: '100px 8%', background: 'linear-gradient(to bottom, #090506 0%, #160e10 100%)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span className="outfit-font" style={{ display: 'inline-block', background: 'rgba(199,167,92,0.08)', color: '#c7a75c', padding: '6px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', border: '1px solid rgba(199,167,92,0.2)' }}>
              Resultados de Destaque
            </span>
            <h2 style={{ fontSize: '40px', fontWeight: 800, color: '#fff', letterSpacing: '-0.8px', marginTop: '16px' }}>
              Tradição e Segurança em Números
            </h2>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '24px' }}>
            {[
              { num: '+500', label: 'Empresas Atendidas', icon: '🏢' },
              { num: 'R$ 2Bi+', label: 'Faturamento Gerido', icon: '💰' },
              { num: '98%', label: 'Retenção de Clientes', icon: '⭐' },
              { num: '+30 anos', label: 'De Histórico', icon: '🏆' },
            ].map((s, i) => (
              <div key={i} className="stat-item">
                <div style={{ fontSize: '38px', marginBottom: '14px' }}>{s.icon}</div>
                <div style={{ fontSize: '42px', fontWeight: 900, color: '#c7a75c', fontFamily: "'Outfit', sans-serif", lineHeight: 1.1 }}>{s.num}</div>
                <div style={{ fontSize: '12px', color: '#bfaea7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '12px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </FadeSection>

      {/* ── ABOUT & MVV SECTION ── */}
      <FadeSection style={{ padding: '100px 8%', background: '#160e10' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '80px', alignItems: 'center', marginBottom: '100px' }}>
            <div>
              <span className="outfit-font" style={{ display: 'inline-block', background: 'rgba(199,167,92,0.08)', color: '#c7a75c', padding: '6px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', border: '1px solid rgba(199,167,92,0.2)' }}>
                Sobre Nós
              </span>
              <h2 style={{ fontSize: '40px', fontWeight: 800, color: '#fff', marginTop: '16px', marginBottom: '24px', lineHeight: '1.2', letterSpacing: '-0.8px' }}>
                Parceria e tecnologia focadas no seu sucesso
              </h2>
              <p style={{ color: '#bfaea7', fontSize: '17px', lineHeight: '1.75', marginBottom: '36px' }}>
                A Privilege Contabilidade e Consultoria combina a sólida bagagem técnica de mais de 30 anos de atuação a ferramentas digitais de última geração. Oferecemos um suporte financeiro e contábil consultivo e inteligente para embasar as tomadas de decisões da sua liderança.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  'Assessores especializados dedicados à sua conta',
                  'Processos corporativos 100% integrados e digitais',
                  'Relatórios gerenciais e análises em tempo real'
                ].map((txt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#fff', fontWeight: 600, fontSize: '15px' }}>
                    <span style={{ color: '#c7a75c', fontSize: '18px' }}>✓</span>
                    {txt}
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ position: 'relative', height: '480px', borderRadius: '28px', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0, 0, 0, 0.4)', border: '1px solid rgba(199, 167, 92, 0.15)' }}>
              <Image
                src="/team_meeting.png"
                alt="Equipe Privilege reunida"
                fill
                style={{ objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(140, 26, 34, 0.25), transparent)' }} />
            </div>
          </div>

          {/* Missão, Visão e Valores (Dark Theme) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '28px' }}>
            {[
              {
                icon: '🎯',
                label: 'Missão',
                title: 'Excelência & Foco',
                text: 'Oferecer serviços com a máxima qualidade, responsabilidade e precisão técnica, superando expectativas de nossos clientes e contribuindo para a evolução de seus negócios.'
              },
              {
                icon: '🔭',
                label: 'Visão',
                title: 'Referência Contábil',
                text: 'Ser reconhecido nacionalmente como escritório de referência em contabilidade consultiva e BPO financeiro, mantendo-nos na vanguarda tecnológica e técnica.'
              },
              {
                icon: '💎',
                label: 'Valores',
                title: 'Ética & Organização',
                text: 'Comprometimento absoluto · Ética profissional inabalável · Agilidade de resposta · Organização primorosa · Busca constante por inovação, evolução e sustentabilidade.'
              },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'rgba(22, 14, 16, 0.5)',
                border: '1px solid rgba(199, 167, 92, 0.15)',
                borderRadius: '24px',
                padding: '40px 36px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                transition: 'all 0.4s cubic-bezier(.16,1,.3,1)',
                backdropFilter: 'blur(8px)'
              }}
                onMouseEnter={e => { 
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px)'; 
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 40px rgba(199, 167, 92, 0.15)';
                  (e.currentTarget as HTMLElement).style.borderColor = '#c7a75c';
                }}
                onMouseLeave={e => { 
                  (e.currentTarget as HTMLElement).style.transform = ''; 
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(199, 167, 92, 0.15)';
                }}
              >
                <div style={{ fontSize: '42px', marginBottom: '20px' }}>{item.icon}</div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#c7a75c', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>{item.label}</div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>{item.title}</h3>
                <p style={{ color: '#bfaea7', fontSize: '15px', lineHeight: '1.75' }}>{item.text}</p>
              </div>
            ))}
          </div>

        </div>
      </FadeSection>

      {/* ── SERVICES SECTION ── */}
      <FadeSection id="servicos" style={{ padding: '100px 8%', background: 'linear-gradient(180deg, #160e10 0%, #090506 100%)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '70px' }}>
            <span className="outfit-font" style={{ display: 'inline-block', background: 'rgba(199,167,92,0.08)', color: '#c7a75c', padding: '6px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', border: '1px solid rgba(199,167,92,0.2)' }}>
              Nossas Soluções
            </span>
            <h2 style={{ fontSize: '42px', fontWeight: 800, color: '#fff', letterSpacing: '-0.8px', marginTop: '16px' }}>
              Especialidades sob Medida
            </h2>
            <p style={{ color: '#bfaea7', fontSize: '18px', marginTop: '16px', maxWidth: '640px', margin: '16px auto 0', lineHeight: '1.6' }}>
              Facilitamos a rotina tributária e financeira da sua empresa com assessoria especializada para cada demanda corporativa.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
            {services.map((s, i) => (
              <div key={i} className="premium-card">
                <div className="service-icon">{s.icon}</div>
                <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px', color: '#fff' }}>{s.title}</h3>
                <p style={{ color: '#bfaea7', lineHeight: '1.75', fontSize: '15px' }}>{s.desc}</p>
                <div style={{ marginTop: '28px', display: 'flex', alignItems: 'center', gap: '8px', color: '#c7a75c', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                  Saiba mais <span style={{ fontSize: '16px' }}>→</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </FadeSection>

      {/* ── FINANCE BANNER (Luxury Mesh Style) ── */}
      <FadeSection style={{ padding: '0 8%', marginBottom: '60px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', borderRadius: '32px', overflow: 'hidden', position: 'relative', height: '380px', boxShadow: '0 25px 50px rgba(0,0,0,0.4)', border: '1px solid rgba(199, 167, 92, 0.2)' }}>
          <Image src="/finance_abstract.png" alt="Gestão avançada de caixa" fill style={{ objectFit: 'cover' }} />
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            background: 'linear-gradient(135deg, rgba(9, 5, 6, 0.92) 0%, rgba(82, 8, 13, 0.8) 100%)', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'flex-start', 
            justifyContent: 'center', 
            padding: '60px 8%' 
          }}>
            <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 800, color: '#fff', marginBottom: '20px', maxWidth: '600px', lineHeight: '1.2', letterSpacing: '-0.8px' }}>
              Gestão financeira estratégica na ponta dos dedos.
            </h2>
            <p style={{ color: '#bfaea7', fontSize: '17px', marginBottom: '36px', maxWidth: '520px', lineHeight: '1.6' }}>
              Dashboard completo para acompanhamento de saldos, conciliação inteligente de OFX e controle de faturamento em tempo real.
            </p>
            <Link href="/login" className="btn-gold" style={{ padding: '16px 36px', borderRadius: '14px', fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Acessar Painel Privilege →
            </Link>
          </div>
        </div>
      </FadeSection>

      {/* ── BLOG SECTION ── */}
      <FadeSection id="blog" style={{ padding: '100px 8%', backgroundColor: '#160e10' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span className="outfit-font" style={{ display: 'inline-block', background: 'rgba(199,167,92,0.08)', color: '#c7a75c', padding: '6px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', border: '1px solid rgba(199,167,92,0.2)' }}>
              Blog da Privilege
            </span>
            <h2 style={{ fontSize: '40px', fontWeight: 800, color: '#fff', letterSpacing: '-0.8px', marginTop: '16px' }}>
              Conteúdo & Atualizações
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
            {blogPosts.map((post, i) => (
              <div key={i} style={{
                borderRadius: '24px',
                overflow: 'hidden',
                border: '1px solid rgba(199, 167, 92, 0.12)',
                background: 'rgba(22, 14, 16, 0.4)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                transition: 'all 0.4s cubic-bezier(.16,1,.3,1)',
                backdropFilter: 'blur(6px)'
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 40px rgba(140, 26, 34, 0.15)';
                  (e.currentTarget as HTMLElement).style.borderColor = '#c7a75c';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = '';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(199, 167, 92, 0.12)';
                }}
              >
                <div style={{ height: '230px', overflow: 'hidden', position: 'relative' }}>
                  <Image
                    src="/team_meeting.png"
                    alt={post.title}
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                  <div style={{ 
                    position: 'absolute', 
                    top: '20px', 
                    left: '20px', 
                    background: 'linear-gradient(135deg, #8c1a22, #52080d)', 
                    color: '#fff', 
                    padding: '6px 14px', 
                    borderRadius: '100px', 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.8px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                    border: '1px solid rgba(199,167,92,0.2)'
                  }}>
                    {post.tag}
                  </div>
                </div>
                
                <div style={{ padding: '36px' }}>
                  <span style={{ fontSize: '12px', color: '#c7a75c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{post.date}</span>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '14px 0', color: '#fff', lineHeight: '1.45' }}>{post.title}</h3>
                  <p style={{ color: '#bfaea7', fontSize: '15px', lineHeight: '1.7' }}>{post.desc}</p>
                  <button className="outfit-font" style={{ marginTop: '24px', background: 'none', border: 'none', color: '#c7a75c', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Ler artigo completo →
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </FadeSection>

      {/* ── FAQ SECTION ── */}
      <FadeSection style={{ padding: '100px 8%', backgroundColor: '#090506' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span className="outfit-font" style={{ display: 'inline-block', background: 'rgba(199,167,92,0.08)', color: '#c7a75c', padding: '6px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', border: '1px solid rgba(199,167,92,0.2)' }}>
              Tire suas Dúvidas
            </span>
            <h2 style={{ fontSize: '40px', fontWeight: 800, color: '#fff', letterSpacing: '-0.8px', marginTop: '16px' }}>
              Perguntas Frequentes
            </h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {faqs.map((faq, i) => (
              <div key={i} className="faq-item">
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{faq.q}</span>
                  <span className={`faq-icon ${openFaq === i ? 'open' : ''}`}>+</span>
                </button>
                <div className={`faq-answer ${openFaq === i ? 'open' : ''}`}>{faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </FadeSection>

      {/* ── CONTACT SECTION ── */}
      <FadeSection id="contato" style={{ padding: '100px 8%', backgroundColor: '#160e10' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '80px', alignItems: 'start' }}>
          <div>
            <span className="outfit-font" style={{ display: 'inline-block', background: 'rgba(199,167,92,0.08)', color: '#c7a75c', padding: '6px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', border: '1px solid rgba(199,167,92,0.2)' }}>
              Canais de Contato
            </span>
            <h2 style={{ fontSize: '40px', fontWeight: 800, color: '#fff', letterSpacing: '-0.8px', marginTop: '16px', marginBottom: '20px' }}>
              Vamos Conversar?
            </h2>
            <p style={{ color: '#bfaea7', fontSize: '17px', marginBottom: '44px', lineHeight: '1.7' }}>
              Agende um diagnóstico contábil inicial gratuito com nossos especialistas. Envie sua mensagem ou utilize nossos canais diretos de atendimento.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {[
                { icon: '📞', label: 'Telefone', val: '(46) 3035-1018', href: 'tel:+554630351018' },
                { icon: '✉️', label: 'E-mail', val: 'contato@privilegecontabilidade.com.br', href: 'mailto:contato@privilegecontabilidade.com.br' },
                { icon: '📍', label: 'Sede Principal', val: 'Rua Pará, 127, Sala 103 – Centro, Francisco Beltrão, PR – CEP 85601-290', href: '#mapa' },
                { icon: '🕐', label: 'Atendimento', val: 'Segunda a Sexta-feira: 8h às 18h', href: undefined },
              ].map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                  <div style={{ 
                    width: '48px', height: '48px', borderRadius: '14px', 
                    backgroundColor: 'rgba(199, 167, 92, 0.05)', 
                    border: '1px solid rgba(199,167,92,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px', flexShrink: 0
                  }}>{c.icon}</div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#c7a75c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>{c.label}</div>
                    {c.href ? (
                      <a href={c.href} style={{ fontWeight: 600, color: '#fff', textDecoration: 'none', fontSize: '15px', transition: 'color 0.2s' }}
                         onMouseEnter={e => e.currentTarget.style.color = '#c7a75c'}
                         onMouseLeave={e => e.currentTarget.style.color = '#fff'}>{c.val}</a>
                    ) : (
                      <span style={{ fontWeight: 600, color: '#fff', fontSize: '15px' }}>{c.val}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ 
            padding: '50px 44px', 
            borderRadius: '28px', 
            backgroundColor: 'rgba(22, 14, 16, 0.5)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(199, 167, 92, 0.15)',
            backdropFilter: 'blur(10px)'
          }}>
            <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} onSubmit={e => e.preventDefault()}>
              <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Solicite um Diagnóstico</h3>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ color: '#bfaea7' }}>Nome Completo</label>
                <input className="form-control" placeholder="Seu nome" style={{ backgroundColor: 'rgba(9, 5, 6, 0.5)', border: '1px solid rgba(199, 167, 92, 0.2)', color: '#fff' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ color: '#bfaea7' }}>E-mail Corporativo</label>
                <input type="email" className="form-control" placeholder="seu@email.com" style={{ backgroundColor: 'rgba(9, 5, 6, 0.5)', border: '1px solid rgba(199, 167, 92, 0.2)', color: '#fff' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ color: '#bfaea7' }}>WhatsApp</label>
                <input type="tel" className="form-control" placeholder="(46) 99999-9999" style={{ backgroundColor: 'rgba(9, 5, 6, 0.5)', border: '1px solid rgba(199, 167, 92, 0.2)', color: '#fff' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ color: '#bfaea7' }}>Como podemos somar?</label>
                <textarea className="form-control" rows={4} placeholder="Conte brevemente sobre as necessidades de sua empresa..." style={{ resize: 'none', backgroundColor: 'rgba(9, 5, 6, 0.5)', border: '1px solid rgba(199, 167, 92, 0.2)', color: '#fff' }}></textarea>
              </div>
              <button type="submit" className="btn-gold" style={{ padding: '16px', fontSize: '15px', fontWeight: 700, borderRadius: '14px', width: '100%' }}>
                Enviar Solicitação →
              </button>
            </form>
          </div>
        </div>
      </FadeSection>

      {/* ── INTERACTIVE MAP ── */}
      <FadeSection id="mapa" style={{ padding: '0' }}>
        <div style={{ width: '100%', height: '440px', position: 'relative' }}>
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3601.6!2d-53.0561!3d-26.0778!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94f44e50c3b75e2f%3A0x1234567890abcdef!2sRua%20Par%C3%A1%2C%20127%20-%20Centro%2C%20Francisco%20Beltr%C3%A3o%20-%20PR%2C%2085601-290!5e0!3m2!1spt-BR!2sbr!4v1717000000000!5m2!1spt-BR!2sbr"
            width="100%"
            height="440"
            style={{ border: 0, display: 'block', filter: 'invert(90%) hue-rotate(180deg)' }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Localização Privilege Contabilidade"
          />
          <div style={{ 
            position: 'absolute', top: '30px', left: '30px', 
            background: 'rgba(9, 5, 6, 0.9)', borderRadius: '20px', 
            padding: '24px 28px', backdropFilter: 'blur(12px)', 
            boxShadow: '0 15px 35px rgba(0,0,0,0.4)', maxWidth: '320px',
            border: '1px solid rgba(199, 167, 92, 0.2)'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📍</div>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: '6px', fontSize: '16px', fontFamily: "'Outfit', sans-serif" }}>Sede Privilege</div>
            <div style={{ color: '#bfaea7', fontSize: '13px', lineHeight: '1.5' }}>Rua Pará, 127, Sala 103 – Centro<br />Francisco Beltrão – PR, CEP 85601-290</div>
          </div>
        </div>
      </FadeSection>

      {/* ── FINAL CALL TO ACTION (CTA) ── */}
      <FadeSection style={{ padding: '90px 8%' }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          borderRadius: '32px',
          background: 'linear-gradient(135deg, #8c1a22 0%, #3d0003 100%)',
          color: '#fff', textAlign: 'center', padding: '90px 6%',
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          border: '1px solid rgba(199, 167, 92, 0.3)'
        }}>
          <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '320px', height: '320px', borderRadius: '50%', background: 'rgba(255,255,255,0.02)' }} />
          <div style={{ position: 'absolute', bottom: '-90px', left: '-45px', width: '280px', height: '280px', borderRadius: '50%', background: 'rgba(199,167,92,0.03)' }} />
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 900, marginBottom: '24px', letterSpacing: '-1px', lineHeight: 1.15 }}>
              Eleve a gestão da sua empresa ao nível Privilege
            </h2>
            <p style={{ fontSize: '19px', marginBottom: '48px', opacity: 0.85, maxWidth: '620px', margin: '0 auto 48px', lineHeight: '1.6', color: '#bfaea7' }}>
              Junte-se a centenas de corporações que confiam suas finanças e contabilidade aos nossos especialistas estratégicos.
            </p>
            <div style={{ display: 'flex', gap: '18px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/login" className="btn-gold" style={{ padding: '18px 44px', borderRadius: '16px', fontSize: '15px' }}>
                Acessar Portal do Cliente
              </Link>
              <a href="#contato" className="btn-outline-gold" style={{ padding: '18px 40px', borderRadius: '16px', fontSize: '15px' }}>
                Solicitar Contato
              </a>
            </div>
          </div>
        </div>
      </FadeSection>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#050304', color: '#948a8b', paddingTop: '90px', borderTop: '1px solid rgba(199, 167, 92, 0.15)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 8%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '60px', paddingBottom: '60px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

            {/* Brand details */}
            <div style={{ maxWidth: '300px' }}>
              <div style={{ position: 'relative', width: '135px', height: '42px', marginBottom: '20px' }}>
                <Image 
                  src="/logo.png" 
                  alt="Privilege Contabilidade" 
                  fill
                  style={{ objectFit: 'contain' }}
                />
              </div>
              <p style={{ marginTop: '24px', fontSize: '14px', lineHeight: '1.8', color: '#807576' }}>
                Excelência técnica, ética profissional e inovação digital contínua. Desde 1993, transformando dados financeiros em bases para o crescimento.
              </p>
              <div style={{ display: 'flex', gap: '14px', marginTop: '30px' }}>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="social-link" title="Instagram">📷</a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="social-link" title="Facebook">📘</a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="social-link" title="LinkedIn">💼</a>
                <a href="https://api.whatsapp.com/send?phone=5546999048990&text=Olá! Gostaria de falar com o time Privilege." target="_blank" rel="noopener noreferrer" className="social-link" title="WhatsApp">💬</a>
              </div>
            </div>

            {/* Services Links */}
            <div>
              <h4 style={{ color: '#faf9f6', marginBottom: '24px', fontSize: '15px', fontWeight: 700, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.5px' }}>Serviços</h4>
              {['Contabilidade Estratégica', 'Gestão Tributária', 'Departamento Pessoal', 'BPO Financeiro', 'Patrimonial & Wealth'].map((l, i) => (
                <a key={i} href="#servicos" className="footer-link" style={{ color: '#807576', display: 'block', textDecoration: 'none', margin: '10px 0', fontSize: '14px', transition: 'color 0.2s' }}
                   onMouseEnter={e => e.currentTarget.style.color = '#c7a75c'}
                   onMouseLeave={e => e.currentTarget.style.color = '#807576'}>{l}</a>
              ))}
            </div>

            {/* Company Links */}
            <div>
              <h4 style={{ color: '#faf9f6', marginBottom: '24px', fontSize: '15px', fontWeight: 700, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.5px' }}>Institucional</h4>
              {['Sobre Nós', 'Blog', 'Dúvidas Frequentes', 'Trabalhe Conosco', 'Política de Privacidade'].map((l, i) => (
                <a key={i} href="#sobre" className="footer-link" style={{ color: '#807576', display: 'block', textDecoration: 'none', margin: '10px 0', fontSize: '14px', transition: 'color 0.2s' }}
                   onMouseEnter={e => e.currentTarget.style.color = '#c7a75c'}
                   onMouseLeave={e => e.currentTarget.style.color = '#807576'}>{l}</a>
              ))}
            </div>

            {/* Contact Details */}
            <div>
              <h4 style={{ color: '#faf9f6', marginBottom: '24px', fontSize: '15px', fontWeight: 700, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.5px' }}>Contato</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px' }}>
                <a href="tel:+554630351018" style={{ color: '#807576', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', transition: 'color 0.2s' }}
                   onMouseEnter={e => e.currentTarget.style.color = '#c7a75c'}
                   onMouseLeave={e => e.currentTarget.style.color = '#807576'}>
                   (46) 3035-1018
                </a>
                <a href="mailto:contato@privilegecontabilidade.com.br" style={{ color: '#807576', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', transition: 'color 0.2s' }}
                   onMouseEnter={e => e.currentTarget.style.color = '#c7a75c'}
                   onMouseLeave={e => e.currentTarget.style.color = '#807576'}>
                   contato@privilegecontabilidade.com.br
                </a>
                <span style={{ color: '#807576', display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: 1.5 }}>
                  Rua Pará, 127, Sala 103 Centro<br />Francisco Beltrão, PR
                </span>
                <span style={{ color: '#807576', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  Seg–Sex: 8h às 18h
                </span>
              </div>
            </div>

          </div>

          {/* Footer Bottom copyright */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '30px 0', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: '#6e6566' }}>
            <span>© {new Date().getFullYear()} Privilege Contabilidade. Todos os direitos reservados.</span>
            <div style={{ display: 'flex', gap: '24px' }}>
              <a href="#" style={{ color: '#6e6566', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#c7a75c'} onMouseLeave={e => e.currentTarget.style.color = '#6e6566'}>Termos</a>
              <a href="#" style={{ color: '#6e6566', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#c7a75c'} onMouseLeave={e => e.currentTarget.style.color = '#6e6566'}>Privacidade</a>
              <a href="#" style={{ color: '#6e6566', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#c7a75c'} onMouseLeave={e => e.currentTarget.style.color = '#6e6566'}>LGPD</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ── WhatsApp Floating CTA Button ── */}
      <a
        href="https://api.whatsapp.com/send?phone=5546999048990&text=Olá! Gostaria de solicitar informações sobre os serviços da Privilege Contabilidade."
        target="_blank"
        rel="noopener noreferrer"
        className="whatsapp-btn"
        title="Fale conosco no WhatsApp"
        aria-label="Falar conosco no WhatsApp"
      >
        <svg viewBox="0 0 24 24" fill="white" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>

    </div>
  );
}
