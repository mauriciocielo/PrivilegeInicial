'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Inter, Instrument_Serif } from 'next/font/google';
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Star,
  MapPin,
  Phone,
  Mail,
  Clock,
  ArrowRight,
  ShieldCheck,
  Building2,
  TrendingUp,
  Award,
  MessageCircle,
} from 'lucide-react';
import { consultoriaServices, contabilidadeServices, faqs, cnds } from './pageData';
import PopupInicial from '../components/PopupInicial';

const sans = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] });
const serif = Instrument_Serif({ subsets: ['latin'], weight: ['400'], style: ['normal', 'italic'] });

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'contabilidade' | 'consultoria'>('contabilidade');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const currentServices = activeTab === 'contabilidade' ? contabilidadeServices : consultoriaServices;

  const trackWhatsAppClick = (origin: string) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'click_whatsapp', {
        event_category: 'engagement',
        event_label: origin,
        value: 1,
      });
    }
  };

  const whatsAppMainUrl =
    'https://wa.me/554630351018?text=Ol%C3%A1!%20Gostaria%20de%20agendar%20um%20diagn%C3%B3stico%20com%20a%20Privilege%20Contabilidade.';

  return (
    <div className={`page ${sans.className}`}>
      <style>{`
        .page {
          --bg: #fdfdfd;
          --text: #171717;
          --text-light: #525252;
          --accent: #600000;
          --border: #e5e5e5;
          background: var(--bg); color: var(--text); line-height: 1.6;
        }

        .container { width: 100%; max-width: 1240px; margin: 0 auto; padding: 0 40px; box-sizing: border-box; }

        /* Typography */
        h1, h2, h3 { font-family: ${serif.style.fontFamily}; color: #000; }
        h1 { font-size: 68px; line-height: 1.02; margin-bottom: 24px; letter-spacing: -0.02em; }
        h2 { font-size: 52px; margin-bottom: 36px; letter-spacing: -0.02em; }

        /* Navigation */
        nav { padding: 32px 0; display: flex; align-items: center; justify-content: space-between; }
        .nav-links { display: flex; gap: 28px; align-items: center; }
        .nav-link { text-decoration: none; color: var(--text); font-weight: 500; font-size: 15px; transition: color 0.2s; }
        .nav-link:hover { color: var(--accent); }
        .client-btn { background: var(--accent); color: #fff; padding: 10px 22px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; transition: background 0.2s; }
        .client-btn:hover { background: #3b0000; }

        /* Hero */
        .hero { padding: 100px 0 80px; text-align: center; }
        .hero-btn { background: var(--accent); color: #fff; padding: 18px 40px; border-radius: 12px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 10px; transition: background 0.3s; font-size: 16px; }
        .hero-btn:hover { background: #000; }

        /* Hub de Soluções Rápidas */
        .solutions-hub { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 40px 0 80px; }
        .hub-card { background: #fff; border: 1px solid var(--border); padding: 26px; border-radius: 20px; text-decoration: none; color: inherit; transition: all 0.3s; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03); }
        .hub-card:hover { transform: translateY(-6px); border-color: var(--accent); box-shadow: 0 16px 24px -6px rgba(96,0,0,0.12); }
        .hub-tag { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent); margin-bottom: 8px; }

        /* Impact Section */
        .impact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 40px 0 70px; }
        .impact-card { background: #0a0a0a; color: #fff; padding: 64px; border-radius: 32px; display: flex; flex-direction: column; justify-content: center; }
        .stat-card { background: #fff; border: 1px solid var(--border); padding: 48px; border-radius: 32px; }

        /* Tabs Switcher */
        .tabs-wrapper { display: flex; justify-content: center; margin-bottom: 40px; }
        .tabs-container { background: #f0f0f2; padding: 6px; border-radius: 99px; display: inline-flex; gap: 8px; border: 1px solid var(--border); }
        .tab-btn { background: transparent; border: none; padding: 14px 32px; border-radius: 99px; font-size: 16px; font-weight: 600; cursor: pointer; color: var(--text-light); transition: all 0.3s ease; }
        .tab-btn.active { background: #fff; color: #000; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

        /* Services Grid */
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 32px; }
        .card { background: #fff; border: 1px solid var(--border); padding: 44px; border-radius: 28px; transition: all 0.4s ease; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.04); }
        .card:hover { transform: translateY(-6px); border-color: var(--accent); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.08); }
        .item-list { list-style: none; padding: 0; margin-top: 22px; }
        .item-list li { margin-bottom: 12px; font-size: 15px; color: var(--text-light); display: flex; align-items: center; gap: 10px; }

        /* Testimonials / Social Proof */
        .testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 36px; }
        .testimonial-card { background: #fff; border: 1px solid var(--border); border-radius: 20px; padding: 32px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 10px rgba(0,0,0,0.03); }

        /* Partners Grid */
        .mvv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        .mvv-card { background: #fff; padding: 32px; border-radius: 20px; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03); }
        .partners-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; }
        .partner-card { background: #fff; border: 1px solid var(--border); padding: 36px; border-radius: 24px; display: flex; gap: 24px; align-items: flex-start; }
        .partner-monogram { width: 130px; height: 130px; border-radius: 20px; background: linear-gradient(135deg, #600000, #2c0000); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }

        /* FAQ & CNDs */
        .faq-grid { max-width: 860px; margin: 0 auto; display: grid; gap: 16px; }
        .faq-item { background: #fff; border: 1px solid var(--border); border-radius: 16px; padding: 24px; cursor: pointer; transition: all 0.2s; }
        .faq-item:hover { border-color: #bbb; }
        .cnd-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 36px; }
        .cnd-card { background: #fff; border: 1px solid var(--border); padding: 24px; border-radius: 16px; text-decoration: none; color: inherit; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s; }
        .cnd-card:hover { border-color: var(--accent); transform: translateY(-4px); }

        /* Footer */
        .footer-grid { display: grid; grid-template-columns: 1.6fr repeat(4, 1fr); gap: 36px; margin-bottom: 50px; }

        /* Marquee */
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .marquee-container {
          overflow: hidden;
          position: relative;
          width: 100%;
          display: flex;
          padding: 20px 0;
        }
        .marquee-track {
          display: flex;
          gap: 60px;
          align-items: center;
          white-space: nowrap;
          animation: marquee 30s linear infinite;
          width: max-content;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }

        @media (max-width: 960px) {
          .container { padding: 0 20px; }
          h1 { font-size: 42px; line-height: 1.08; margin-bottom: 20px; }
          h2 { font-size: 34px; margin-bottom: 24px; }
          .hero { padding: 60px 0 40px; }
          .solutions-hub { grid-template-columns: 1fr 1fr; }
          .impact-grid, .grid, .partners-grid, .footer-grid, .cnd-grid, .mvv-grid, .testimonials-grid { grid-template-columns: 1fr !important; }
          .partner-card { flex-direction: column; align-items: center; text-align: center; }
          .partner-card p { text-align: center !important; }
          .impact-card, .stat-card { padding: 36px 20px; }
          nav { flex-direction: column; gap: 18px; }
          .nav-links { flex-wrap: wrap; justify-content: center; gap: 14px; }
        }

        @media (max-width: 600px) {
          .solutions-hub { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="container">
        {/* Navigation */}
        <nav>
          <Link href="/" aria-label="Privilege Contabilidade - Página Inicial">
            <Image
              src="/privilege-logo-colorida.svg"
              alt="Logotipo Privilege Contabilidade e Consultoria"
              width={180}
              height={45}
              priority
            />
          </Link>
          <div className="nav-links">
            <a href="#solucoes" className="nav-link">Serviços</a>
            <a href="#quem-somos" className="nav-link">Quem Somos</a>
            <a href="#depoimentos" className="nav-link">Avaliações</a>
            <a href="#cnds" className="nav-link">Certidões</a>
            <a href="#faq" className="nav-link">Dúvidas</a>
            <a href="#contato" className="nav-link">Contato</a>
            <Link href="/login" className="client-btn">Área do Cliente</Link>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="hero" style={{ position: 'relative', overflow: 'hidden' }}>
          <Image
            src="/hero_office.png"
            alt="Ambiente profissional do escritório da Privilege Contabilidade em Francisco Beltrão"
            fill
            style={{ objectFit: 'cover', zIndex: -1, opacity: 0.08 }}
            priority
          />
          <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'inline-block', marginBottom: '14px' }}>
            Escritório de Contabilidade & BPO em Francisco Beltrão / PR
          </span>
          <h1 className="serif">
            Contabilidade Consultiva e BPO Financeiro em Francisco Beltrão
          </h1>
          <p style={{ fontSize: '19px', color: 'var(--text-light)', maxWidth: '760px', margin: '0 auto 36px', lineHeight: 1.6 }}>
            Números que sustentam decisões estratégicas. Assessoria contábil completa, abertura de empresas, escrituração fiscal, folha de pagamento e gestão financeira integrada para quem busca conformidade e crescimento real no Paraná.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={whatsAppMainUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hero-btn"
              onClick={() => trackWhatsAppClick('Hero WhatsApp')}
            >
              <MessageCircle size={20} /> Agendar Diagnóstico Consultivo
            </a>
            <a
              href="#solucoes"
              className="hero-btn"
              style={{ background: '#fff', color: '#600000', border: '1px solid #600000' }}
            >
              Conhecer Serviços
            </a>
          </div>
        </section>

        {/* Hub de Soluções Rápidas (4 Páginas Dedicadas de SEO) */}
        <section style={{ margin: '10px 0 60px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Páginas de Atuação Especializada
            </span>
            <h3 className="serif" style={{ fontSize: '28px', margin: '6px 0 0' }}>Conheça Nossos Principais Polos de Entrega</h3>
          </div>
          <div className="solutions-hub">
            <Link href="/bpo-financeiro-francisco-beltrao" className="hub-card">
              <div>
                <span className="hub-tag">Gestão Financeira</span>
                <h4 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#111' }}>
                  BPO Financeiro
                </h4>
                <p style={{ fontSize: '13.5px', color: 'var(--text-light)', margin: 0, lineHeight: 1.5 }}>
                  Terceirize contas a pagar, receber, conciliação e tenha um DFC diário sem custo com equipe interna.
                </p>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Ver BPO em Francisco Beltrão <ArrowRight size={14} />
              </span>
            </Link>

            <Link href="/planejamento-tributario" className="hub-card">
              <div>
                <span className="hub-tag">Redução de Custos</span>
                <h4 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#111' }}>
                  Planejamento Tributário
                </h4>
                <p style={{ fontSize: '13.5px', color: 'var(--text-light)', margin: 0, lineHeight: 1.5 }}>
                  Simulação entre Simples, Presumido e Lucro Real, monofásicos e adequação à Reforma Tributária.
                </p>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Ver Planejamento Fiscal <ArrowRight size={14} />
              </span>
            </Link>

            <Link href="/abertura-de-empresa-francisco-beltrao" className="hub-card">
              <div>
                <span className="hub-tag">Societário & CNPJ</span>
                <h4 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#111' }}>
                  Abertura de Empresa
                </h4>
                <p style={{ fontSize: '13.5px', color: 'var(--text-light)', margin: 0, lineHeight: 1.5 }}>
                  Do contrato social à liberação de alvarás em Francisco Beltrão com proteção patrimonial e agilidade.
                </p>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Abrir CNPJ em Beltrão <ArrowRight size={14} />
              </span>
            </Link>

            <Link href="/contabilidade-agronegocio" className="hub-card">
              <div>
                <span className="hub-tag">Produtor Rural</span>
                <h4 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#111' }}>
                  Contabilidade Agro & LCDPR
                </h4>
                <p style={{ fontSize: '13.5px', color: 'var(--text-light)', margin: 0, lineHeight: 1.5 }}>
                  Livro Caixa Digital do Produtor Rural, planejamento sucessório, holding rural e declaração de ITR.
                </p>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Ver Soluções para o Agro <ArrowRight size={14} />
              </span>
            </Link>
          </div>
        </section>

        {/* Impact Section */}
        <div className="impact-grid" style={{ position: 'relative', overflow: 'hidden' }}>
          <Image
            src="/finance_abstract.png"
            alt="Análise de dados contábeis e demonstrativos financeiros"
            fill
            style={{ objectFit: 'cover', zIndex: -1, opacity: 0.05 }}
          />
          <div className="impact-card">
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Impacto nos Clientes
            </span>
            <div style={{ fontSize: '76px', fontWeight: '400', margin: '12px 0', fontFamily: serif.style.fontFamily }}>
              R$ 10 Mi+
            </div>
            <p style={{ fontSize: '18px', lineHeight: 1.4, color: 'rgba(255,255,255,0.9)' }}>
              Em captação de recursos estruturados, linhas de fomento e economia tributária auditada para nossos clientes.
            </p>
          </div>
          <div className="stat-card">
            <h3 style={{ fontSize: 26, marginBottom: 20 }}>Excelência e Rigor Técnico</h3>
            <div style={{ display: 'grid', gap: 18 }}>
              {[
                { title: 'Contabilidade & Fiscal Completa', desc: 'Escrituração, folha de pagamento, DCTFWeb, eSocial e apuração de tributos.' },
                { title: 'BPO Financeiro Integrado', desc: 'Gestão 100% digital do contas a pagar, receber e conciliação bancária diária.' },
                { title: 'Planejamento Tributário Legal', desc: 'Redução consistente da carga fiscal com respaldo no Código Tributário e CRC-PR.' },
              ].map(f => (
                <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <CheckCircle2 size={22} color="var(--accent)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '16px' }}>{f.title}</div>
                    <div style={{ fontSize: '14px', color: 'var(--text-light)' }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Avaliações e Prova Social (Item 11) */}
        <section id="depoimentos" style={{ padding: '60px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 16px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fef3c7', padding: '6px 14px', borderRadius: '99px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', color: '#f59e0b' }}>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={15} fill="#f59e0b" />
                ))}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>
                5.0 no Google Meu Negócio
              </span>
            </div>
            <h2 className="serif" style={{ fontSize: 40, margin: '8px 0 14px' }}>
              A Confiança de Quem Cresce com a Privilege
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-light)' }}>
              Empresas de comércio, agronegócio e serviços em Francisco Beltrão e região atestam nossa entrega.
            </p>
          </div>

          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div>
                <div style={{ display: 'flex', color: '#f59e0b', marginBottom: '12px' }}>
                  {[...Array(5)].map((_, i) => (<Star key={i} size={15} fill="#f59e0b" />))}
                </div>
                <p style={{ fontSize: '14.5px', lineHeight: 1.6, color: '#333', fontStyle: 'italic', margin: '0 0 18px 0' }}>
                  "A migração do nosso financeiro para o BPO da Privilege organizou o fluxo de caixa da distribuidora. Hoje temos previsibilidade de 60 dias e economizamos o custo de contratar duas pessoas internas."
                </p>
              </div>
              <div>
                <strong style={{ fontSize: '15px', color: '#111', display: 'block' }}>Roberto Almeida</strong>
                <span style={{ fontSize: '13px', color: '#737373' }}>Diretor Comercial · Distribuidora de Alimentos</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div>
                <div style={{ display: 'flex', color: '#f59e0b', marginBottom: '12px' }}>
                  {[...Array(5)].map((_, i) => (<Star key={i} size={15} fill="#f59e0b" />))}
                </div>
                <p style={{ fontSize: '14.5px', lineHeight: 1.6, color: '#333', fontStyle: 'italic', margin: '0 0 18px 0' }}>
                  "O Marcos e o Mauricio fizeram uma revisão tributária completa no nosso negócio de varejo. Conseguimos recuperar valores de PIS/COFINS pagos a mais e reduzimos nossa alíquota mensal legalmente."
                </p>
              </div>
              <div>
                <strong style={{ fontSize: '15px', color: '#111', display: 'block' }}>Juliana Zanella</strong>
                <span style={{ fontSize: '13px', color: '#737373' }}>Sócia-Proprietária · Rede Varejista (Sudoeste/PR)</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div>
                <div style={{ display: 'flex', color: '#f59e0b', marginBottom: '12px' }}>
                  {[...Array(5)].map((_, i) => (<Star key={i} size={15} fill="#f59e0b" />))}
                </div>
                <p style={{ fontSize: '14.5px', lineHeight: 1.6, color: '#333', fontStyle: 'italic', margin: '0 0 18px 0' }}>
                  "Nossa família produtora precisava de segurança na entrega do LCDPR e na sucessão patrimonial das terras. A Privilege nos atendeu com rigor técnico impecável e total proximidade no campo."
                </p>
              </div>
              <div>
                <strong style={{ fontSize: '15px', color: '#111', display: 'block' }}>Carlos Dalmolin</strong>
                <span style={{ fontSize: '13px', color: '#737373' }}>Produtor Rural & Empresário do Agronegócio</span>
              </div>
            </div>
          </div>
        </section>

        {/* Services Switcher */}
        <section id="solucoes" style={{ padding: '80px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'inline-block', marginBottom: '8px' }}>
              Catálogo de Serviços Completo
            </span>
            <h2 className="serif">Nossas Soluções</h2>
            <p style={{ fontSize: '18px', color: 'var(--text-light)', maxWidth: '680px', margin: '0 auto 36px' }}>
              Atuamos desde a contabilidade tradicional obrigatória até a consultoria de alta gestão e BPO financeiro.
            </p>
          </div>

          <div className="tabs-wrapper">
            <div className="tabs-container">
              <button
                className={`tab-btn ${activeTab === 'contabilidade' ? 'active' : ''}`}
                onClick={() => setActiveTab('contabilidade')}
              >
                Contabilidade & Fiscal
              </button>
              <button
                className={`tab-btn ${activeTab === 'consultoria' ? 'active' : ''}`}
                onClick={() => setActiveTab('consultoria')}
              >
                Consultoria & Gestão
              </button>
            </div>
          </div>

          <div className="grid">
            {currentServices.map(s => (
              <div key={s.title} className="card">
                <h3 className="serif" style={{ fontSize: 26, marginBottom: 14 }}>{s.title}</h3>
                <p style={{ fontSize: 15, color: 'var(--text-light)', lineHeight: 1.6 }}>{s.desc}</p>
                <ul className="item-list">
                  {s.items.map(item => (
                    <li key={item}>
                      <CheckCircle2 size={16} color="var(--accent)" style={{ flexShrink: 0 }} /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Quem Somos */}
        <section id="quem-somos" style={{ padding: '90px 0', borderTop: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
          <Image
            src="/team_meeting.png"
            alt="Equipe de consultores e contadores da Privilege em reunião estratégica"
            fill
            style={{ objectFit: 'cover', zIndex: -1, opacity: 0.05 }}
          />
          <div style={{ maxWidth: '920px', marginBottom: '48px' }}>
            <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
              Quem Somos
            </span>
            <h2 className="serif" style={{ fontSize: 44, marginBottom: 24, lineHeight: 1.15 }}>
              Inteligência Contábil, Segurança Tributária e Parceria Estratégica.
            </h2>
            <p style={{ fontSize: 17, color: 'var(--text-light)', lineHeight: 1.7 }}>
              Com sede em Francisco Beltrão, a <strong>Privilege Contabilidade e Consultoria</strong> nasceu com o propósito de transformar a relação do empresário com seus números. Acreditamos que a contabilidade moderna não pode se limitar à entrega de guias de impostos: ela deve ser o motor gerador de caixa, segurança jurídica e direcionamento estratégico.
            </p>
          </div>

          <div className="partners-grid" style={{ marginBottom: '60px' }}>
            <div className="partner-card">
              <div className="partner-monogram">
                <span style={{ fontSize: '32px' }}>MC</span>
                <span style={{ fontSize: '12px', marginTop: '4px', letterSpacing: '0.1em' }}>SÓCIO</span>
              </div>
              <div>
                <h3 className="serif" style={{ fontSize: 28, margin: '0 0 6px 0' }}>Marcos Cancelier</h3>
                <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
                  Contador & Consultor Tributário · CRC-PR
                </div>
                <p style={{ fontSize: 14.5, color: 'var(--text-light)', lineHeight: 1.6, margin: 0 }}>
                  Especialista em Gestão Empresarial e Planejamento Tributário. Atua na estruturação contábil, auditoria preventiva de SPED, enquadramentos fiscais estratégicos e conformidade tributária para PMEs e agronegócio.
                </p>
              </div>
            </div>

            <div className="partner-card">
              <div className="partner-monogram">
                <span style={{ fontSize: '32px' }}>MM</span>
                <span style={{ fontSize: '12px', marginTop: '4px', letterSpacing: '0.1em' }}>SÓCIO</span>
              </div>
              <div>
                <h3 className="serif" style={{ fontSize: 28, margin: '0 0 6px 0' }}>Mauricio Meurer</h3>
                <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
                  Consultor Empresarial & Estratégico
                </div>
                <p style={{ fontSize: 14.5, color: 'var(--text-light)', lineHeight: 1.6, margin: 0 }}>
                  Especialista em BPO financeiro, finanças corporativas, controladoria e inteligência de mercado. Lidera a implementação de processos operacionais e ferramentas de tomada de decisão para os clientes da Privilege.
                </p>
              </div>
            </div>
          </div>

          {/* Missão, Visão e Valores */}
          <div className="mvv-grid">
            <div className="mvv-card">
              <h3 className="serif" style={{ fontSize: 22, margin: '0 0 10px 0' }}>Missão</h3>
              <p style={{ fontSize: 14.5, color: 'var(--text-light)', lineHeight: 1.65, margin: 0 }}>
                Impulsionar o crescimento sustentável de nossos clientes por meio de inteligência contábil, planejamento tributário ético e disciplina financeira.
              </p>
            </div>
            <div className="mvv-card">
              <h3 className="serif" style={{ fontSize: 22, margin: '0 0 10px 0' }}>Visão</h3>
              <p style={{ fontSize: 14.5, color: 'var(--text-light)', lineHeight: 1.65, margin: 0 }}>
                Ser reconhecido no Sudoeste do Paraná como o escritório de contabilidade consultiva de maior referência em inovação, confiança e resultados tangíveis.
              </p>
            </div>
            <div className="mvv-card">
              <h3 className="serif" style={{ fontSize: 22, margin: '0 0 10px 0' }}>Valores</h3>
              <p style={{ fontSize: 14.5, color: 'var(--text-light)', lineHeight: 1.65, margin: 0 }}>
                Ética intransigente, rigor técnico, transparência radical, inovação contínua e foco absoluto no sucesso do cliente.
              </p>
            </div>
          </div>

          {/* Onde Estamos com NAP em Texto + Mapa Lazy Loaded */}
          <div style={{ marginTop: '70px' }}>
            <h2 className="serif" style={{ fontSize: 36, marginBottom: '24px' }}>Onde Estamos em Francisco Beltrão</h2>
            
            {/* Bloco NAP Visível */}
            <div style={{ background: '#f5f5f7', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', fontSize: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <MapPin size={22} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Endereço Comercial</strong>
                  <div style={{ color: 'var(--text-light)' }}>Rua Pará, nº 127, Sala 03, Centro</div>
                  <div style={{ color: 'var(--text-light)' }}>Francisco Beltrão – PR, CEP 85601-290</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Phone size={22} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Telefone & WhatsApp</strong>
                  <div style={{ color: 'var(--text-light)' }}>(46) 3035-1018</div>
                  <div style={{ color: 'var(--text-light)' }}>Atendimento presencial e online</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Mail size={22} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div>
                  <strong>E-mail Corporativo</strong>
                  <div style={{ color: 'var(--text-light)' }}>contato@privilegecontabilidade.cnt.br</div>
                  <div style={{ color: 'var(--text-light)' }}>Privilege Consultoria Ltda</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Clock size={22} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Horário de Funcionamento</strong>
                  <div style={{ color: 'var(--text-light)' }}>Segunda a Sexta-feira</div>
                  <div style={{ color: 'var(--text-light)' }}>08:00 às 18:00 (Sem fechar para almoço)</div>
                </div>
              </div>
            </div>

            <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', height: '380px' }}>
              <iframe
                title="Localização da Privilege Contabilidade em Francisco Beltrão"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3618.995964722513!2d-53.0560738!3d-25.9926417!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94f1c9c5f0f353a7%3A0x60b0985c5453675a!2sRua%20Par%C3%A1%2C%20127%20-%20Centro%2C%20Francisco%20Beltr%C3%A3o%20-%20PR!5e0!3m2!1spt-BR!2sbr!4v1729515000000!5m2!1spt-BR!2sbr"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          </div>

          {/* Parceiros Institucionais */}
          <div style={{ marginTop: '70px' }}>
            <h3 className="serif" style={{ fontSize: 32, marginBottom: '24px', textAlign: 'center' }}>
              Parceiros & Ecossistema de Integrações
            </h3>
            <div className="marquee-container">
              <div className="marquee-track">
                {[...Array(2)].map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: '60px', alignItems: 'center', flexShrink: 0 }}>
                    <a href="https://ademicon.com.br" target="_blank" rel="noopener noreferrer" aria-label="Ademicon Consórcios">
                      <Image src="/ademicon.svg" alt="Logotipo Ademicon Consórcio e Investimento" width={150} height={50} style={{ objectFit: 'contain' }} />
                    </a>
                    <a href="https://www.evolua.coop.br/" target="_blank" rel="noopener noreferrer" aria-label="Evolua Energia">
                      <Image src="/logo-evolua.svg" alt="Logotipo Cooperativa Evolua Energia" width={150} height={50} style={{ objectFit: 'contain' }} />
                    </a>
                    <a href="https://okton.com.br/" target="_blank" rel="noopener noreferrer" aria-label="Okton Consultoria" style={{ background: '#0A2540', padding: '10px 20px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center' }}>
                      <Image src="/okton.png" alt="Logotipo Okton Consultoria Empresarial" width={130} height={40} style={{ objectFit: 'contain' }} />
                    </a>
                    <a href="https://www.omie.com.br/" target="_blank" rel="noopener noreferrer" aria-label="Omie ERP">
                      <Image src="/logo-omie.webp" alt="Logotipo Omie Sistema de Gestão ERP em Nuvem" width={150} height={50} style={{ objectFit: 'contain' }} />
                    </a>
                    <a href="https://www.bling.com.br/" target="_blank" rel="noopener noreferrer" aria-label="Bling Gestão">
                      <Image src="/bling.svg" alt="Logotipo Bling Sistema de Gestão Empresarial" width={150} height={50} style={{ objectFit: 'contain' }} />
                    </a>
                    <a href="https://sebraepr.com.br/" target="_blank" rel="noopener noreferrer" aria-label="Sebrae Paraná">
                      <Image src="/logo-sebrae.svg" alt="Logotipo Sebrae Paraná" width={150} height={50} style={{ objectFit: 'contain' }} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Emissão Rápida de Certidões (CNDs) */}
        <section id="cnds" style={{ padding: '80px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 30px' }}>
            <h2 className="serif" style={{ fontSize: 36, marginBottom: 12 }}>Emissão Rápida de Certidões (CNDs)</h2>
            <p style={{ fontSize: 16, color: 'var(--text-light)' }}>
              Acesse os canais oficiais para emissão e consulta da regularidade fiscal da sua empresa.
            </p>
          </div>
          <div className="cnd-grid">
            {cnds.map(cnd => (
              <a key={cnd.label} href={cnd.url} target="_blank" rel="noopener noreferrer" className="cnd-card">
                <span style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>{cnd.label}</span>
                <span style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                  Acessar portal oficial <ExternalLink size={12} />
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* Impostômetro com Lazy Loading */}
        <section id="impostometro" style={{ padding: '80px 0', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
          <h2 className="serif" style={{ fontSize: 36, marginBottom: 16 }}>Acompanhe o Impostômetro Brasileiro</h2>
          <p style={{ fontSize: 15, color: 'var(--text-light)', maxWidth: '600px', margin: '0 auto 28px' }}>
            Estimativa em tempo real dos tributos federais, estaduais e municipais pagos pelos cidadãos brasileiros neste ano.
          </p>
          <div style={{ display: 'inline-block', maxWidth: '100%', overflowX: 'auto', background: '#fff', padding: '10px', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <iframe
              id="impostometro-widget"
              title="Widget do Impostômetro do IBPT"
              src="https://impostometro.com.br/widget/contador/"
              width="728"
              height="228"
              scrolling="no"
              loading="lazy"
              style={{ border: 'none', maxWidth: '100%', display: 'block' }}
            ></iframe>
          </div>
        </section>

        {/* Perguntas Frequentes (FAQ) */}
        <section id="faq" style={{ padding: '80px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 40px' }}>
            <h2 className="serif" style={{ fontSize: 36, marginBottom: 12 }}>Dúvidas Frequentes</h2>
            <p style={{ fontSize: 16, color: 'var(--text-light)' }}>
              Esclarecimentos sobre os modelos de atuação, troca de contador e terceirização financeira.
            </p>
          </div>
          <div className="faq-grid">
            {[
              ...faqs,
              {
                q: 'Como funciona a troca de contador para a Privilege?',
                a: 'A troca de contador é simples, rápida e 100% amparada pelo Código de Ética do CRC. Cuidamos de todo o contato com o escritório anterior e da conferência dos saldos contábeis e fiscais, sem interrupção nas suas rotinas.',
              },
              {
                q: 'Atendem empresas fora de Francisco Beltrão?',
                a: 'Sim! Embora nossa sede seja em Francisco Beltrão, atendemos clientes em todo o Sudoeste do Paraná, no estado e empresas digitais em todo o Brasil por meio de nossa plataforma 100% digital e segura.',
              },
            ].map((faq, idx) => (
              <div
                key={faq.q}
                className="faq-item"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 16 }}>{faq.q}</span>
                  <ChevronDown
                    size={20}
                    style={{
                      transform: openFaq === idx ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s',
                      color: 'var(--accent)',
                      flexShrink: 0,
                    }}
                  />
                </div>
                {openFaq === idx && (
                  <p style={{ marginTop: 14, fontSize: 14.5, color: 'var(--text-light)', lineHeight: 1.65 }}>
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Contato CTA */}
        <section
          id="contato"
          style={{
            padding: '80px 40px',
            background: 'linear-gradient(135deg, #1f1f1f, #0d0d0d)',
            color: '#fff',
            borderRadius: '32px',
            textAlign: 'center',
            margin: '60px 0',
          }}
        >
          <h2 className="serif" style={{ fontSize: 44, marginBottom: 16, color: '#fff' }}>
            Pronto para estruturar o crescimento da sua empresa?
          </h2>
          <p style={{ fontSize: 18, color: '#d4d4d4', marginBottom: 36, maxWidth: '580px', margin: '0 auto 36px', lineHeight: 1.6 }}>
            Agende um diagnóstico consultivo gratuito com Marcos Cancelier e Mauricio Meurer. Descubra oportunidades imediatas de economia fiscal e eficiência financeira.
          </p>
          <a
            href={whatsAppMainUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hero-btn"
            style={{ background: '#fff', color: '#600000' }}
            onClick={() => trackWhatsAppClick('Footer CTA WhatsApp')}
          >
            <MessageCircle size={20} /> Falar com um Consultor no WhatsApp
          </a>
        </section>
      </div>

      {/* Footer com NAP em Plain Text (Item 6) */}
      <footer style={{ padding: '70px 0 35px', background: '#111', color: '#fff' }}>
        <div className="container">
          <div className="footer-grid">
            <div>
              <Image
                src="/privilege-logo-colorida.svg"
                alt="Privilege Contabilidade e Consultoria"
                width={170}
                height={42}
                style={{ marginBottom: '20px', filter: 'brightness(0) invert(1)' }}
              />
              <p style={{ fontSize: '13.5px', color: '#a3a3a3', maxWidth: '280px', marginBottom: 20, lineHeight: 1.6 }}>
                Inteligência contábil, consultoria estratégica e BPO financeiro em Francisco Beltrão - PR.
              </p>
              <div style={{ display: 'flex', gap: '16px' }}>
                <a
                  href="https://instagram.com/privilegefb"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#fff', fontSize: '13px', textDecoration: 'none' }}
                >
                  Instagram
                </a>
                <a
                  href="https://www.linkedin.com/company/privilege-assessoria-cont%C3%A1bil/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#fff', fontSize: '13px', textDecoration: 'none' }}
                >
                  LinkedIn
                </a>
              </div>
            </div>

            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '18px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff' }}>
                Serviços Focados
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px' }}>
                <li><Link href="/bpo-financeiro-francisco-beltrao" style={{ color: '#a3a3a3', fontSize: '13.5px', textDecoration: 'none' }}>BPO Financeiro</Link></li>
                <li><Link href="/planejamento-tributario" style={{ color: '#a3a3a3', fontSize: '13.5px', textDecoration: 'none' }}>Planejamento Tributário</Link></li>
                <li><Link href="/abertura-de-empresa-francisco-beltrao" style={{ color: '#a3a3a3', fontSize: '13.5px', textDecoration: 'none' }}>Abertura de Empresa</Link></li>
                <li><Link href="/contabilidade-agronegocio" style={{ color: '#a3a3a3', fontSize: '13.5px', textDecoration: 'none' }}>Contabilidade Agro (LCDPR)</Link></li>
              </ul>
            </div>

            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '18px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff' }}>
                Institucional
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px' }}>
                <li><a href="#quem-somos" style={{ color: '#a3a3a3', fontSize: '13.5px', textDecoration: 'none' }}>Quem Somos</a></li>
                <li><a href="#depoimentos" style={{ color: '#a3a3a3', fontSize: '13.5px', textDecoration: 'none' }}>Avaliações Google</a></li>
                <li><Link href="/login" style={{ color: '#a3a3a3', fontSize: '13.5px', textDecoration: 'none' }}>Área do Cliente</Link></li>
                <li><Link href="/privacidade" style={{ color: '#a3a3a3', fontSize: '13.5px', textDecoration: 'none' }}>Política de Privacidade</Link></li>
                <li><Link href="/termos" style={{ color: '#a3a3a3', fontSize: '13.5px', textDecoration: 'none' }}>Termos de Uso</Link></li>
              </ul>
            </div>

            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '18px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff' }}>
                Utilidades
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px' }}>
                <li><a href="#cnds" style={{ color: '#a3a3a3', fontSize: '13.5px', textDecoration: 'none' }}>Certidões Negativas (CND)</a></li>
                <li><a href="#faq" style={{ color: '#a3a3a3', fontSize: '13.5px', textDecoration: 'none' }}>Dúvidas Frequentes</a></li>
                <li><a href="#impostometro" style={{ color: '#a3a3a3', fontSize: '13.5px', textDecoration: 'none' }}>Impostômetro Nacional</a></li>
              </ul>
            </div>

            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '18px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff' }}>
                Fale Conosco
              </h4>
              <div style={{ fontSize: '13.5px', color: '#a3a3a3', lineHeight: 1.6, display: 'grid', gap: '8px' }}>
                <div><strong>WhatsApp:</strong> (46) 3035-1018</div>
                <div><strong>E-mail:</strong> contato@privilegecontabilidade.cnt.br</div>
                <div><strong>Horário:</strong> Seg. a Sex. das 08h às 18h</div>
              </div>
            </div>
          </div>

          {/* NAP (Name, Address, Phone) em Texto Puro Idêntico ao Google Meu Negócio */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '28px', marginBottom: '24px', fontSize: '13px', color: '#888', lineHeight: 1.7 }}>
            <p style={{ margin: 0 }}>
              <strong style={{ color: '#d4d4d4' }}>Privilege Contabilidade e Consultoria</strong> · Razão Social: PRIVILEGE CONSULTORIA LTDA · CNPJ: 58.033.979/0001-84 · CRC-PR<br />
              <span style={{ color: '#fff' }}>Rua Pará, 127, Sala 03 – Centro, Francisco Beltrão – PR, CEP 85601-290</span> · Telefone: <span style={{ color: '#fff' }}>(46) 3035-1018</span> · E-mail: contato@privilegecontabilidade.cnt.br
            </p>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', color: '#737373', fontSize: '12.5px', flexWrap: 'wrap', gap: 14 }}>
            <div>© {new Date().getFullYear()} Privilege Contabilidade e Consultoria. Todos os direitos reservados.</div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <Link href="/termos" style={{ color: '#a3a3a3', textDecoration: 'none' }}>Termos de Uso</Link>
              <Link href="/privacidade" style={{ color: '#a3a3a3', textDecoration: 'none' }}>Privacidade (LGPD)</Link>
              <a href="/sitemap.xml" style={{ color: '#a3a3a3', textDecoration: 'none' }}>Mapa do Site</a>
              <a href="/llms.txt" style={{ color: '#a3a3a3', textDecoration: 'none' }}>llms.txt</a>
            </div>
          </div>
        </div>
      </footer>

      <PopupInicial />
    </div>
  );
}
