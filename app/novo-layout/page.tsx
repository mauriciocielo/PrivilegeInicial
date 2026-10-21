'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Lora, Montserrat } from 'next/font/google';
import { ArrowRight } from 'lucide-react';

const serif = Lora({ subsets: ['latin'], weight: ['400', '600', '700'] });
const sans = Montserrat({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('in'); obs.unobserve(el); } },
      { threshold, rootMargin: '0px 0px -60px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return ref;
}

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useInView<HTMLDivElement>();
  return <div ref={ref} className={`rv ${className}`}>{children}</div>;
}

export default function NovoLayout() {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24);
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? Math.min(1, window.scrollY / h) : 0);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`landing ${sans.className}`}>
      <style>{`
        .landing {
          --wine: #600000;
          --wine-dark: #3b0000;
          --wine-light: #8b1a1a;
          --ink: #1a1a1a;
          --ink-soft: #404040;
          --muted: #808080;
          --bone: #faf8f5;
          --bone-deep: #f3ede5;
          --paper: #ffffff;
          --rule: rgba(26, 26, 26, 0.14);
          --rule-soft: rgba(26, 26, 26, 0.08);
          --ease: cubic-bezier(0.16, 1, 0.3, 1);

          color: var(--ink-soft);
          background: var(--bone);
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
        }

        .landing * { box-sizing: border-box; margin: 0; padding: 0; }
        .landing h1, .landing h2, .landing h3, .landing h4 {
          font-family: ${serif.style.fontFamily};
          font-weight: 700;
          color: var(--ink);
          line-height: 1.1;
          letter-spacing: -0.01em;
        }

        /* Progress bar */
        .landing .prog {
          position: fixed;
          top: 0;
          left: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--wine), var(--wine-light));
          z-index: 1001;
          transition: width 0.1s linear;
        }

        /* Navigation */
        .landing .nav {
          position: sticky;
          top: 0;
          z-index: 900;
          background: rgba(250, 248, 245, 0.95);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid transparent;
          transition: border-color 0.4s, box-shadow 0.4s;
        }
        .landing .nav.scrolled {
          border-bottom-color: var(--rule-soft);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }
        .landing .nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 40px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }
        .landing .nav-brand {
          font-size: 20px;
          font-weight: 700;
          color: var(--wine);
          font-family: ${serif.style.fontFamily};
        }
        .landing .nav-links {
          display: flex;
          align-items: center;
          gap: 40px;
        }
        .landing .nav-link {
          font-size: 13px;
          font-weight: 500;
          color: var(--ink-soft);
          text-decoration: none;
          position: relative;
        }
        .landing .nav-link::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: -2px;
          width: 100%;
          height: 2px;
          background: var(--wine);
          transform: scaleX(0);
          transform-origin: right;
          transition: transform 0.55s var(--ease);
        }
        .landing .nav-link:hover::after { transform: scaleX(1); transform-origin: left; }
        .landing .nav-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 28px;
          font-size: 13px;
          font-weight: 600;
          background: var(--wine);
          color: white;
          border-radius: 3px;
          cursor: pointer;
          text-decoration: none;
          border: none;
          position: relative;
          overflow: hidden;
          transition: all 0.4s var(--ease);
        }
        .landing .nav-cta::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--wine-dark);
          transform: translateY(101%);
          transition: transform 0.55s var(--ease);
          z-index: 0;
        }
        .landing .nav-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(96, 0, 0, 0.2); }
        .landing .nav-cta:hover::before { transform: none; }
        .landing .nav-cta > * { position: relative; z-index: 1; }

        /* Reveal animations */
        .landing .anim {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.9s var(--ease), transform 0.9s var(--ease);
        }
        .landing .rv.in .anim { opacity: 1; transform: none; }

        /* Container */
        .landing .c {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 40px;
        }

        /* ════════════════════════════════════════════════════════════════════ */
        /* SEÇÃO 1: HERO COM IMAGEM */
        /* ════════════════════════════════════════════════════════════════════ */
        .landing .hero {
          padding: 100px 0 80px;
          position: relative;
        }
        .landing .hero-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 60px;
          align-items: center;
        }
        .landing .eyebrow {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--wine);
          margin-bottom: 24px;
          display: block;
          font-family: ${sans.style.fontFamily};
        }
        .landing .hero h1 {
          font-size: clamp(48px, 6.5vw, 86px);
          margin-bottom: 32px;
          letter-spacing: -0.02em;
          line-height: 1.08;
        }
        .landing .hero h1 em {
          font-style: italic;
          color: var(--wine);
          font-weight: 700;
        }
        .landing .hero-lead {
          font-size: 17px;
          line-height: 1.7;
          color: var(--ink-soft);
          max-width: 55ch;
          margin-bottom: 40px;
          font-family: ${serif.style.fontFamily};
        }
        .landing .hero-ctas {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .landing .hero-image {
          position: relative;
          width: 100%;
          height: 450px;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(96, 0, 0, 0.15);
        }

        /* Botões */
        .landing .btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 15px 32px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 3px;
          cursor: pointer;
          text-decoration: none;
          border: 1.5px solid transparent;
          overflow: hidden;
          transition: all 0.4s var(--ease);
          font-family: ${sans.style.fontFamily};
        }
        .landing .btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--wine-dark);
          transform: translateY(101%);
          transition: transform 0.55s var(--ease);
          z-index: 0;
        }
        .landing .btn:hover::before { transform: none; }
        .landing .btn:hover { transform: translateY(-2px); }
        .landing .btn > * { position: relative; z-index: 1; }
        .landing .btn-primary {
          background: var(--wine);
          color: white;
        }
        .landing .btn-primary:hover { box-shadow: 0 12px 32px rgba(96, 0, 0, 0.25); }
        .landing .btn-outline {
          background: transparent;
          color: var(--ink);
          border-color: var(--rule);
        }
        .landing .btn-outline:hover { color: white; border-color: var(--wine-dark); box-shadow: 0 8px 24px rgba(96, 0, 0, 0.15); }
        .landing .btn .arrow { transition: transform 0.5s var(--ease); }
        .landing .btn:hover .arrow { transform: translateX(4px); }

        /* ════════════════════════════════════════════════════════════════════ */
        /* SEÇÃO 2: DESTAQUE R$ 10 MI */
        /* ════════════════════════════════════════════════════════════════════ */
        .landing .highlight-banner {
          background: linear-gradient(135deg, var(--wine-dark) 0%, #1a1a1a 100%);
          color: white;
          padding: 80px 40px;
          border-radius: 12px;
          text-align: center;
          margin: 100px 0;
          box-shadow: 0 20px 60px rgba(96, 0, 0, 0.25);
        }
        .landing .highlight-value {
          font-size: clamp(48px, 8vw, 80px);
          font-weight: 700;
          margin-bottom: 16px;
          letter-spacing: -0.02em;
        }
        .landing .highlight-label {
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          opacity: 0.9;
          margin-bottom: 24px;
          font-family: ${sans.style.fontFamily};
        }
        .landing .highlight-desc {
          font-size: 16px;
          line-height: 1.7;
          max-width: 600px;
          margin: 0 auto;
          opacity: 0.9;
        }

        /* ════════════════════════════════════════════════════════════════════ */
        /* SEÇÃO 3: CARDS COM ESTRUTURA */
        /* ════════════════════════════════════════════════════════════════════ */
        .landing .sec {
          padding: 120px 0;
          position: relative;
        }
        .landing .sec-light { background: var(--bone); }
        .landing .sec-white { background: var(--paper); }
        .landing .sec-dark {
          background: linear-gradient(165deg, var(--wine-dark) 0%, var(--ink) 62%);
          color: rgba(255, 255, 255, 0.68);
        }
        .landing .sec-dark h2, .landing .sec-dark h3, .landing .sec-dark h4 { color: #ffffff; }

        .landing .sec-header {
          margin-bottom: 80px;
        }
        .landing .sec-label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--wine);
          margin-bottom: 20px;
          display: block;
          font-family: ${sans.style.fontFamily};
        }
        .landing .sec-dark .sec-label { color: rgba(255, 255, 255, 0.6); }
        .landing .sec-title {
          font-size: clamp(36px, 5vw, 64px);
          letter-spacing: -0.015em;
          max-width: 70ch;
        }
        .landing .sec-title em {
          font-style: italic;
          color: var(--wine);
        }
        .landing .sec-dark .sec-title em { color: rgba(255, 255, 255, 0.7); }

        /* Grid de Cards */
        .landing .cards-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 40px;
        }
        .landing .card {
          background: var(--paper);
          border: 1px solid var(--rule-soft);
          padding: 48px;
          border-radius: 8px;
          transition: all 0.4s var(--ease);
          opacity: 0;
          transform: translateY(20px);
        }
        .landing .rv.in .card { opacity: 1; transform: none; }
        .landing .card:nth-child(1) { transition-delay: 0.05s; }
        .landing .card:nth-child(2) { transition-delay: 0.1s; }
        .landing .card:nth-child(3) { transition-delay: 0.15s; }
        .landing .card:nth-child(4) { transition-delay: 0.2s; }
        .landing .card:hover {
          border-color: var(--wine);
          transform: translateY(-8px);
          box-shadow: 0 24px 48px rgba(96, 0, 0, 0.12);
        }
        .landing .card-icon {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, rgba(96, 0, 0, 0.1), rgba(139, 26, 26, 0.05));
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--wine);
          margin-bottom: 24px;
          font-size: 32px;
        }
        .landing .card-title {
          font-size: 20px;
          margin-bottom: 12px;
        }
        .landing .card-desc {
          font-size: 14px;
          line-height: 1.7;
          color: var(--ink-soft);
        }

        /* ════════════════════════════════════════════════════════════════════ */
        /* SEÇÃO COM IMAGEM + CONTEÚDO */
        /* ════════════════════════════════════════════════════════════════════ */
        .landing .content-with-image {
          display: grid;
          grid-template-columns: 1fr 1.1fr;
          gap: 80px;
          align-items: start;
        }
        .landing .image-container {
          position: relative;
          width: 100%;
          height: 500px;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(96, 0, 0, 0.15);
        }
        .landing .content-list {
          display: flex;
          flex-direction: column;
          gap: 40px;
        }
        .landing .list-item {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.9s var(--ease), transform 0.9s var(--ease);
        }
        .landing .rv.in .list-item {
          opacity: 1;
          transform: none;
        }
        .landing .list-item:nth-child(1) { transition-delay: 0.1s; }
        .landing .list-item:nth-child(2) { transition-delay: 0.2s; }
        .landing .list-item:nth-child(3) { transition-delay: 0.3s; }
        .landing .list-item h3 {
          font-size: 21px;
          margin-bottom: 12px;
          color: var(--wine);
        }
        .landing .list-item p {
          font-size: 15px;
          line-height: 1.7;
          color: var(--ink-soft);
        }

        /* ════════════════════════════════════════════════════════════════════ */
        /* FOOTER */
        /* ════════════════════════════════════════════════════════════════════ */
        .landing .footer {
          background: var(--ink);
          color: rgba(255, 255, 255, 0.56);
          padding: 80px 0 32px;
        }
        .landing .footer h4 {
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 24px;
          font-family: ${sans.style.fontFamily};
        }
        .landing .footer-grid {
          display: grid;
          grid-template-columns: 1.8fr 1fr 1fr 1fr;
          gap: 60px;
          padding-bottom: 60px;
          margin-bottom: 32px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .landing .footer-link {
          display: block;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.56);
          text-decoration: none;
          margin-bottom: 14px;
          transition: color 0.3s;
          font-family: ${sans.style.fontFamily};
        }
        .landing .footer-link:hover { color: #ffffff; }
        .landing .footer-copy {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
          font-family: ${sans.style.fontFamily};
        }

        @media (max-width: 1000px) {
          .landing .hero-grid { grid-template-columns: 1fr; gap: 50px; }
          .landing .content-with-image { grid-template-columns: 1fr; }
          .landing .cards-grid { grid-template-columns: 1fr; }
          .landing .c { padding: 0 32px; }
        }

        @media (max-width: 760px) {
          .landing .c { padding: 0 24px; }
          .landing .nav-links { display: none; }
          .landing .nav-inner { padding: 0 24px; }
          .landing .hero { padding: 80px 0 60px; }
          .landing .sec { padding: 80px 0; }
          .landing .card { padding: 32px; }
          .landing .highlight-banner { padding: 60px 24px; }
          .landing .footer-grid { grid-template-columns: 1fr 1fr; gap: 40px; }
        }
      `}</style>

      <div className="prog" style={{ width: `${progress * 100}%` }} aria-hidden="true" />

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* NAVEGAÇÃO */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
        <div className="nav-inner">
          <div className="nav-brand">Fluxo Caixa</div>
          <div className="nav-links">
            <a href="#diferencial" className="nav-link">Diferencial</a>
            <a href="#recursos" className="nav-link">Recursos</a>
            <a href="#contato" className="nav-link">Contato</a>
          </div>
          <Link href="/login" className="nav-cta">
            <span>Portal</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </nav>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* HERO COM IMAGEM */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <section className="hero rv">
        <div className="c">
          <div className="hero-grid">
            <div>
              <span className="eyebrow anim">Gestão Financeira & Consultoria</span>
              <h1 className="anim">
                Conquiste até <em>R$ 10 Milhões</em> em crédito.
              </h1>
              <p className="hero-lead anim" style={{ transitionDelay: '0.2s' }}>
                Organizamos sua estrutura financeira para que bancos vejam o potencial do seu negócio. Consultores e clientes, conectados pelos números que importam.
              </p>
              <div className="hero-ctas anim" style={{ transitionDelay: '0.3s' }}>
                <Link href="/login" className="btn btn-primary">
                  <span>Acessar Portal</span>
                  <span className="arrow">→</span>
                </Link>
                <a href="#recursos" className="btn btn-outline">
                  Conhecer Mais
                </a>
              </div>
            </div>
            <div className="hero-image anim" style={{ transitionDelay: '0.25s' }}>
              <Image src="/hero_office.png" alt="Consultoria" fill style={{ objectFit: 'cover' }} priority />
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* DESTAQUE: R$ 10 MILHÕES */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <Reveal>
        <div className="highlight-banner anim">
          <div className="highlight-value">R$ 10 MI</div>
          <div className="highlight-label">Em Crédito Conquistado Para Clientes</div>
          <div className="highlight-desc">
            Relacionamentos consolidados com instituições financeiras. Documentação organizada, fluxo claro, acesso facilitado. Seus clientes crescem com confiança.
          </div>
        </div>
      </Reveal>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* SEÇÃO: DIFERENCIAL */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <Reveal id="diferencial" className="sec sec-dark">
        <div className="c">
          <div className="sec-header anim">
            <span className="sec-label">Por Que Escolher</span>
            <h2 className="sec-title">
              O diferencial que conecta <em>consultores</em> e <em>clientes</em> ao crescimento.
            </h2>
          </div>

          <div className="cards-grid">
            {[
              { icon: '💰', title: 'Acesso a R$ 10M em Crédito', desc: 'Parcerias com instituições financeiras que confiam em dados organizados e clara documentação.' },
              { icon: '📊', title: 'Transparência Total', desc: 'Consultor e cliente veem os mesmos números em tempo real. Uma única fonte de verdade.' },
              { icon: '🔒', title: 'Segurança por Função', desc: 'RBAC completo. Cada perfil acessa apenas o que deve. Auditoria em cada movimento.' },
              { icon: '📈', title: 'Decisões Estratégicas', desc: 'Relatórios, tendências, margens. Dados que guiam decisões de crescimento, não apenas de conformidade.' },
            ].map((item, i) => (
              <div key={i} className="card">
                <div className="card-icon">{item.icon}</div>
                <h3 className="card-title">{item.title}</h3>
                <p className="card-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* SEÇÃO: IMAGEM + CONTEÚDO */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <Reveal className="sec sec-light">
        <div className="c">
          <div className="sec-header anim">
            <span className="sec-label">Como Funciona</span>
            <h2 className="sec-title">Estrutura para o crescimento</h2>
          </div>

          <div className="content-with-image">
            <div className="image-container anim">
              <Image src="/finance_abstract.png" alt="Análise Financeira" fill style={{ objectFit: 'cover' }} />
            </div>
            <div className="content-list">
              <div className="list-item">
                <h3>📋 Auditoria Inicial</h3>
                <p>Organizamos todo histórico financeiro conforme padrões bancários e contábeis.</p>
              </div>
              <div className="list-item">
                <h3>📊 DRE Gerencial</h3>
                <p>Margens, rentabilidade por linha de negócio. Visão clara de onde vem lucro.</p>
              </div>
              <div className="list-item">
                <h3>🤝 Conexão com Crédito</h3>
                <p>Documentação pronta para submissão de propostas. Bancos veem dados confiáveis.</p>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* SEÇÃO: RECURSOS */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <Reveal id="recursos" className="sec sec-white">
        <div className="c">
          <div className="sec-header anim">
            <span className="sec-label">Funcionalidades</span>
            <h2 className="sec-title">Plataforma integrada e pronta para usar</h2>
          </div>

          <div className="cards-grid">
            {[
              { icon: '📈', title: 'Dashboard em Tempo Real', desc: 'Saldos, fluxo, tendências. Tudo no mesmo painel, sempre atualizado.' },
              { icon: '📑', title: 'Relatórios Detalhados', desc: 'Análises profundas. Margens, despesas por categoria, perspectivas de caixa.' },
              { icon: '🔄', title: 'Sincronização Automática', desc: 'Consultor registra → Cliente vê. Sem atrasos, sem duplicações.' },
              { icon: '📤', title: 'Importação OFX', desc: 'Extratos bancários integrados. Menos digitação, mais precisão.' },
            ].map((item, i) => (
              <div key={i} className="card">
                <div className="card-icon">{item.icon}</div>
                <h3 className="card-title">{item.title}</h3>
                <p className="card-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* CTA: TESTE AGORA */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <Reveal id="contato" className="sec sec-white">
        <div className="c">
          <div style={{ textAlign: 'center', maxWidth: '750px', margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 56px)', marginBottom: 24 }} className="anim">
              Pronto para conectar seus clientes ao crescimento?
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--ink-soft)', marginBottom: 48, fontFamily: serif.style.fontFamily }} className="anim" style={{ transitionDelay: '0.1s' }}>
              Teste a plataforma com dados de exemplo. Veja como consultores e clientes trabalham juntos ao redor de números que importam.
            </p>

            <div style={{ background: 'linear-gradient(135deg, rgba(96, 0, 0, 0.08), rgba(139, 26, 26, 0.05))', border: '1px solid var(--rule-soft)', borderRadius: 8, padding: 40, marginBottom: 40, textAlign: 'left' }} className="anim" style={{ transitionDelay: '0.15s' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 32 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 10, fontFamily: sans.style.fontFamily }}>Cliente</div>
                  <code style={{ fontSize: 14, fontFamily: 'Monaco, Courier', color: 'var(--ink)', background: 'var(--bone)', padding: '8px 12px', borderRadius: 4, display: 'block' }}>cliente@empresa.com</code>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 10, fontFamily: sans.style.fontFamily }}>Consultor</div>
                  <code style={{ fontSize: 14, fontFamily: 'Monaco, Courier', color: 'var(--ink)', background: 'var(--bone)', padding: '8px 12px', borderRadius: 4, display: 'block' }}>consultor@sistema.com</code>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 10, fontFamily: sans.style.fontFamily }}>Senha</div>
                <code style={{ fontSize: 14, fontFamily: 'Monaco, Courier', color: 'var(--ink)', background: 'var(--bone)', padding: '8px 12px', borderRadius: 4, display: 'block' }}>123456</code>
              </div>
            </div>

            <Link href="/login" className="btn btn-primary">
              <span>Acessar Dashboard</span>
              <span className="arrow">→</span>
            </Link>
          </div>
        </div>
      </Reveal>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* FOOTER */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <footer className="footer">
        <div className="c">
          <div className="footer-grid">
            <div>
              <h4 style={{ color: '#ffffff', fontSize: 16, fontWeight: 700, marginBottom: 16, fontFamily: serif.style.fontFamily }}>
                Fluxo Caixa
              </h4>
              <p style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 320, marginBottom: 16 }}>
                Plataforma que conecta consultores e clientes em torno de dados financeiros precisos e acesso facilitado a crédito.
              </p>
            </div>
            <div>
              <h4>Produto</h4>
              <a href="#recursos" className="footer-link">Recursos</a>
              <a href="#diferencial" className="footer-link">Diferencial</a>
              <Link href="/login" className="footer-link">Acessar</Link>
            </div>
            <div>
              <h4>Sobre</h4>
              <a href="#" className="footer-link">Documentação</a>
              <a href="#" className="footer-link">Suporte</a>
              <a href="#" className="footer-link">Privacidade</a>
            </div>
            <div>
              <h4>Consultoria</h4>
              <a href="#" className="footer-link">Contato</a>
              <a href="#" className="footer-link">Parcerias</a>
              <a href="#" className="footer-link">Blog</a>
            </div>
          </div>

          <div className="footer-copy">
            © {new Date().getFullYear()} Privilege Contabilidade. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
