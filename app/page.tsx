'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Inter, Instrument_Serif } from 'next/font/google';
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  MapPin,
  Phone,
  Mail,
  Clock,
  ArrowRight,
  MessageCircle,
} from 'lucide-react';
import { consultoriaServices, contabilidadeServices, faqs, cnds } from './pageData';
import PopupInicial from '../components/PopupInicial';
import StoreLocator from '../components/StoreLocator';

const sans = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] });
const serif = Instrument_Serif({ subsets: ['latin'], weight: ['400'], style: ['normal', 'italic'] });

const GOOGLE_MAPS_URL =
  'https://www.google.com/maps/place/?q=place_id:ChIJmbblyQdz8JQReoz1xenqkKA';

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

        /* Partners Grid */
        .mvv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        .mvv-card { background: #fff; padding: 32px; border-radius: 20px; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03); display: flex; flex-direction: column; justify-content: flex-start; }
        .mvv-card-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; min-height: 52px; }
        .mvv-card-head h4 { font-size: 22px; margin: 0; color: #000; line-height: 1.25; flex: 1; word-break: break-word; }
        .mvv-card-head svg { flex-shrink: 0; margin-top: 4px; }
        .partners-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .partner-card { background: #fff; border: 1px solid var(--border); padding: 40px; border-radius: 28px; display: flex; gap: 24px; align-items: flex-start; }
        .partner-avatar { width: 150px; height: 150px; border-radius: 24px; overflow: hidden; flex-shrink: 0; position: relative; }

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
          .impact-grid, .grid, .partners-grid, .footer-grid, .cnd-grid, .mvv-grid { grid-template-columns: 1fr !important; }
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
            <a href="#cnds" className="nav-link">Certidões</a>
            <a href="#faq" className="nav-link">Dúvidas</a>
            <Link href="/contato" className="nav-link">Contato</Link>
            <Link href="/login" className="client-btn">Área do Cliente</Link>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="hero" style={{ position: 'relative', overflow: 'hidden' }}>
          <Image
            src="/hero_office.png"
            alt="Ambiente profissional do escritório da Privilege Contabilidade em Francisco Beltrão"
            fill
            sizes="100vw"
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
            sizes="100vw"
            style={{ objectFit: 'cover', zIndex: -1, opacity: 0.05 }}
          />
          <div className="impact-card">
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Resultados Alcançados
            </span>
            <div style={{ fontSize: '76px', fontWeight: '400', margin: '12px 0', fontFamily: serif.style.fontFamily }}>
              R$ 10 Mi+
            </div>
            <p style={{ fontSize: '18px', lineHeight: 1.4, color: 'rgba(255,255,255,0.9)' }}>
              Em crédito facilitado e novas linhas de fomento estruturadas para nossos clientes.
            </p>
          </div>
          <div className="stat-card">
            <h3 style={{ fontSize: 26, marginBottom: 20 }}>Excelência Privilege</h3>
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
            sizes="100vw"
            style={{ objectFit: 'cover', zIndex: -1, opacity: 0.05 }}
          />
          <div style={{ maxWidth: '920px', marginBottom: '48px' }}>
            <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
              Quem Somos
            </span>
            <h2 className="serif" style={{ fontSize: 44, marginBottom: 24, lineHeight: 1.15 }}>
              Sua parceira estratégica em contabilidade e gestão.
            </h2>
            <p style={{ fontSize: 17, color: 'var(--text-light)', marginBottom: 18, textAlign: 'justify', lineHeight: 1.75 }}>
              Fundada em 2018 na cidade de Francisco Beltrão (PR), a <strong style={{ color: 'var(--text)' }}>PRIVILEGE CONTABILIDADE E CONSULTORIA</strong> nasceu com o propósito de transformar a contabilidade tradicional em um verdadeiro motor de crescimento estratégico. Hoje, oferecemos soluções inteligentes, seguras e personalizadas em contabilidade, assessoria tributária e consultoria de negócios para empresas da região e de todo o país.
            </p>
            <p style={{ fontSize: 17, color: 'var(--text-light)', textAlign: 'justify', lineHeight: 1.75 }}>
              Acreditamos que a contabilidade vai muito além do cumprimento de obrigações: ela é uma ferramenta vital de gestão. Por isso, aliamos o profundo conhecimento técnico, a atualização constante e uma visão estratégica e consultiva para auxiliar nossos clientes no compliance legal, na otimização tributária inteligente e na tomada de decisões seguras — impulsionando o desenvolvimento sustentável.
            </p>
          </div>

          {/* Nossos Pilares de Atuação */}
          <div style={{ marginBottom: '56px' }}>
            <h3 className="serif" style={{ fontSize: 32, marginBottom: 10 }}>Nossos Pilares de Atuação</h3>
            <p style={{ fontSize: 16, color: 'var(--text-light)', marginBottom: 28 }}>
              Nossa essência e o padrão de excelência que entregamos todos os dias aos nossos parceiros estão fundamentados em três valores centrais:
            </p>
            <div className="mvv-grid">
              <div className="mvv-card">
                <div className="mvv-card-head">
                  <CheckCircle2 size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: 4 }} />
                  <h4 className="serif" style={{ fontSize: 22, margin: 0, color: '#000' }}>Segurança e Confiança</h4>
                </div>
                <p style={{ fontSize: 15, color: 'var(--text-light)', textAlign: 'justify', lineHeight: 1.65, margin: 0 }}>
                  Atuação altamente responsável, rigor técnico e compromisso inegociável com a conformidade legal, societária e tributária para garantir a total tranquilidade da sua empresa.
                </p>
              </div>

              <div className="mvv-card">
                <div className="mvv-card-head">
                  <CheckCircle2 size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: 4 }} />
                  <h4 className="serif" style={{ fontSize: 22, margin: 0, color: '#000' }}>Inteligência Estratégica</h4>
                </div>
                <p style={{ fontSize: 15, color: 'var(--text-light)', textAlign: 'justify', lineHeight: 1.65, margin: 0 }}>
                  Diagnósticos precisos, soluções contábeis e consultorias customizadas que apoiam decisões eficientes, evitam desperdícios e geram resultados financeiros reais.
                </p>
              </div>

              <div className="mvv-card">
                <div className="mvv-card-head">
                  <CheckCircle2 size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: 4 }} />
                  <h4 className="serif" style={{ fontSize: 22, margin: 0, color: '#000' }}>Pessoas e Excelência</h4>
                </div>
                <p style={{ fontSize: 15, color: 'var(--text-light)', textAlign: 'justify', lineHeight: 1.65, margin: 0 }}>
                  Contamos com uma equipe de cerca de 30 profissionais altamente qualificados e em constante evolução, unidos por uma cultura de proximidade e dedicação total às necessidades de cada cliente.
                </p>
              </div>
            </div>
          </div>

          {/* Liderança com Visão de Futuro */}
          <div style={{ maxWidth: '920px', marginBottom: '44px' }}>
            <h3 className="serif" style={{ fontSize: 32, marginBottom: 14 }}>Liderança com Visão de Futuro</h3>
            <p style={{ fontSize: 16.5, color: 'var(--text-light)', marginBottom: 14, textAlign: 'justify', lineHeight: 1.75 }}>
              Sob a direção de <strong style={{ color: 'var(--text)' }}>Marcos Cancelier</strong> — contador, empresário, consultor, professor e palestrante, especialista em Gestão Empresarial e Direito Tributário — e <strong style={{ color: 'var(--text)' }}>Mauricio Cielo</strong> — contador e consultor especialista em inteligência financeira, auditoria e riscos —, a Privilege une a bagagem e a autoridade técnica de quem entende o mercado de ponta a ponta com o dinamismo de uma estrutura ágil e focada em resultados.
            </p>
            <p style={{ fontSize: 16.5, color: 'var(--text-light)', textAlign: 'justify', lineHeight: 1.75 }}>
              Mais do que prestadores de serviços, somos parceiros estratégicos de jornada. Oferecemos o conhecimento e a confiança que sua empresa precisa para ir mais longe.
            </p>
          </div>

          {/* Cards dos Sócios com Fotos Reais e CRC-PR */}
          <div className="partners-grid" style={{ marginBottom: '60px' }}>
            {/* Marcos Cancelier */}
            <div className="partner-card">
              <div className="partner-avatar">
                <Image
                  src="/foto-marcos.jpg"
                  alt="Marcos Cancelier — Sócio-Diretor e Contador (CRC-PR 062232/O-1)"
                  width={150}
                  height={150}
                  sizes="(max-width: 768px) 120px, 150px"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="serif" style={{ fontSize: 26, marginBottom: 4 }}>Marcos Cancelier</h3>
                <p style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14, marginBottom: 4 }}>
                  Sócio-Diretor · Contabilidade & Consultoria · CRC-PR 062232/O-1
                </p>
                <a
                  href="https://instagram.com/marcos.cancelier"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-block', color: 'var(--text-light)', fontSize: '13px', marginBottom: '14px', textDecoration: 'none' }}
                >
                  @marcos.cancelier ↗
                </a>
                <p style={{ fontSize: 14, color: 'var(--text-light)', lineHeight: 1.6, textAlign: 'justify', margin: 0 }}>
                  Bacharel em Ciências Contábeis pela UTFPR (CRC-PR 062232/O-1) com pós-graduações em Direito Tributário e Gestão Empresarial. Palestrante do SESCAP-PR, atua na gestão executiva dos dois braços do grupo, conectando o rigor técnico contábil à estratégia empresarial e tomada de decisão.
                </p>
              </div>
            </div>

            {/* Mauricio Cielo */}
            <div className="partner-card">
              <div className="partner-avatar">
                <Image
                  src="/foto-mauricio.jpg"
                  alt="Mauricio Cielo — Sócio-Administrador e Contador (CRC-PR 082974/O-7)"
                  width={150}
                  height={150}
                  sizes="(max-width: 768px) 120px, 150px"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="serif" style={{ fontSize: 26, marginBottom: 4 }}>Mauricio Cielo</h3>
                <p style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14, marginBottom: 4 }}>
                  Sócio-Administrador · Consultoria Estratégica · CRC-PR 082974/O-7
                </p>
                <a
                  href="https://instagram.com/mauricio.cielo"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-block', color: 'var(--text-light)', fontSize: '13px', marginBottom: '14px', textDecoration: 'none' }}
                >
                  @mauricio.cielo ↗
                </a>
                <p style={{ fontSize: 14, color: 'var(--text-light)', lineHeight: 1.6, textAlign: 'justify', margin: 0 }}>
                  Bacharel em Ciências Contábeis (CRC-PR 082974/O-7) com extensões em Auditoria e Riscos. Com mais de 500 empresas atendidas, lidera as divisões de inteligência financeira, reestruturação de fluxo de caixa e planejamento tributário estratégico na Privilege Consultoria.
                </p>
              </div>
            </div>
          </div>

          {/* Missão, Visão e Valores */}
          <div style={{ marginTop: '60px' }}>
            <h2 className="serif" style={{ fontSize: 36, marginBottom: '30px' }}>Missão, Visão e Valores</h2>
            <div className="mvv-grid">
              <div className="mvv-card">
                <div className="mvv-card-head" style={{ minHeight: '52px' }}>
                  <h3 className="serif" style={{ fontSize: 22, margin: 0 }}>Missão</h3>
                </div>
                <p style={{ fontSize: 15, color: 'var(--text-light)', textAlign: 'justify', lineHeight: 1.65, margin: 0 }}>
                  Impulsionar o crescimento sustentável de nossos clientes por meio de inteligência contábil, planejamento tributário ético e disciplina financeira.
                </p>
              </div>
              <div className="mvv-card">
                <div className="mvv-card-head" style={{ minHeight: '52px' }}>
                  <h3 className="serif" style={{ fontSize: 22, margin: 0 }}>Visão</h3>
                </div>
                <p style={{ fontSize: 15, color: 'var(--text-light)', textAlign: 'justify', lineHeight: 1.65, margin: 0 }}>
                  Ser reconhecido, nos próximos 5 anos, em Francisco Beltrão, como o escritório de referência em contabilidade — um destino natural para quem busca excelência, confiança e resultados concretos.
                </p>
              </div>
              <div className="mvv-card">
                <div className="mvv-card-head" style={{ minHeight: '52px' }}>
                  <h3 className="serif" style={{ fontSize: 22, margin: 0 }}>Valores</h3>
                </div>
                <p style={{ fontSize: 15, color: 'var(--text-light)', textAlign: 'justify', lineHeight: 1.65, margin: 0 }}>
                  Ética & Comprometimento, Responsabilidade & Confiança, Excelência & Qualidade, Inovação & Evolução, Sustentabilidade & Organização.
                </p>
              </div>
            </div>
          </div>

          {/* Onde Estamos com NAP em Texto + Telefone Clicável + Mapa da Empresa */}
          <div style={{ marginTop: '70px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
              <h2 className="serif" style={{ fontSize: 36, margin: 0 }}>Onde Estamos em Francisco Beltrão</h2>
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--accent)',
                  fontWeight: 600,
                  fontSize: '14px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                Abrir ficha no Google Maps e traçar rota <ExternalLink size={14} />
              </a>
            </div>

            {/* Bloco NAP Visível com links tel: e mailto: */}
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
                  <div>
                    <a href="tel:+554630351018" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                      (46) 3035-1018
                    </a>
                  </div>
                  <div style={{ color: 'var(--text-light)' }}>Atendimento presencial e online</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Mail size={22} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div>
                  <strong>E-mail Corporativo</strong>
                  <div>
                    <a href="mailto:contato@privilegecontabilidade.cnt.br" style={{ color: 'var(--text-light)', textDecoration: 'none' }}>
                      contato@privilegecontabilidade.cnt.br
                    </a>
                  </div>
                  <div style={{ color: 'var(--text-light)' }}>Privilege Consultoria Ltda</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Clock size={22} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Horário de Funcionamento</strong>
                  <div style={{ color: 'var(--text-light)' }}>Segunda a Sexta-feira</div>
                  <div style={{ color: 'var(--text-light)' }}>08:00 às 18:00</div>
                </div>
              </div>
            </div>

            <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', height: '460px' }}>
              <StoreLocator />
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
            Agende um diagnóstico consultivo gratuito com Marcos Cancelier e Mauricio Cielo. Descubra oportunidades imediatas de economia fiscal e eficiência financeira.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
            <a
              href="tel:+554630351018"
              className="hero-btn"
              style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}
            >
              <Phone size={18} /> Ligar: (46) 3035-1018
            </a>
          </div>
        </section>
      </div>

      {/* Footer com NAP em Plain Text e Links Clicáveis */}
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
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
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
                <a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#fff', fontSize: '13px', textDecoration: 'none' }}
                >
                  Google Maps
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
                <li><Link href="/contato" style={{ color: '#a3a3a3', fontSize: '13.5px', textDecoration: 'none' }}>Contato e Localização</Link></li>
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
                <div>
                  <strong>Telefone:</strong>{' '}
                  <a href="tel:+554630351018" style={{ color: '#fff', textDecoration: 'none' }}>
                    (46) 3035-1018
                  </a>
                </div>
                <div>
                  <strong>WhatsApp:</strong>{' '}
                  <a
                    href={whatsAppMainUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#fff', textDecoration: 'none' }}
                    onClick={() => trackWhatsAppClick('Footer WhatsApp Link')}
                  >
                    (46) 3035-1018
                  </a>
                </div>
                <div>
                  <strong>E-mail:</strong>{' '}
                  <a href="mailto:contato@privilegecontabilidade.cnt.br" style={{ color: '#a3a3a3', textDecoration: 'none' }}>
                    contato@privilegecontabilidade.cnt.br
                  </a>
                </div>
                <div><strong>Horário:</strong> Seg. a Sex. das 08h às 18h</div>
              </div>
            </div>
          </div>

          {/* NAP (Name, Address, Phone) em Texto Puro e Clicável */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '28px', marginBottom: '24px', fontSize: '13px', color: '#888', lineHeight: 1.7 }}>
            <p style={{ margin: 0 }}>
              <strong style={{ color: '#d4d4d4' }}>Privilege Contabilidade e Consultoria</strong> · Razão Social: PRIVILEGE CONSULTORIA LTDA · CNPJ: 58.033.979/0001-84 · Responsáveis Técnicos: Marcos Cancelier (CRC-PR 062232/O-1) e Mauricio Cielo (CRC-PR 082974/O-7)<br />
              <span style={{ color: '#fff' }}>Rua Pará, 127, Sala 03 – Centro, Francisco Beltrão – PR, CEP 85601-290</span> · Telefone:{' '}
              <a href="tel:+554630351018" style={{ color: '#fff', textDecoration: 'none' }}>
                (46) 3035-1018
              </a>{' '}
              · E-mail:{' '}
              <a href="mailto:contato@privilegecontabilidade.cnt.br" style={{ color: '#a3a3a3', textDecoration: 'none' }}>
                contato@privilegecontabilidade.cnt.br
              </a>
            </p>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', color: '#737373', fontSize: '12.5px', flexWrap: 'wrap', gap: 14 }}>
            <div>© {new Date().getFullYear()} Privilege Contabilidade e Consultoria. Todos os direitos reservados.</div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <Link href="/contato" style={{ color: '#a3a3a3', textDecoration: 'none' }}>Contato</Link>
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
