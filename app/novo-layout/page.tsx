'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Inter, Instrument_Serif } from 'next/font/google';
import { CheckCircle2, ChevronDown, ExternalLink, X } from 'lucide-react';
import { consultoriaServices, contabilidadeServices, faqs, cnds } from '../pageData';

const sans = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600'] });
const serif = Instrument_Serif({ subsets: ['latin'], weight: ['400'], style: ['normal', 'italic'] });

export default function EnhancedLayoutPage() {
  const [activeTab, setActiveTab] = useState<'consultoria' | 'contabilidade'>('consultoria');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [legalModal, setLegalModal] = useState<'termos' | 'privacidade' | null>(null);

  const currentServices = activeTab === 'consultoria' ? consultoriaServices : contabilidadeServices;

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

        .container { max-width: 1200px; margin: 0 auto; padding: 0 40px; }

        /* Typography */
        h1, h2, h3 { font-family: ${serif.style.fontFamily}; color: #000; }
        h1 { font-size: 80px; line-height: 0.95; margin-bottom: 32px; letter-spacing: -0.02em; }
        h2 { font-size: 56px; margin-bottom: 40px; letter-spacing: -0.02em; }

        /* Navigation */
        nav { padding: 40px 0; display: flex; align-items: center; justify-content: space-between; }
        .nav-links { display: flex; gap: 32px; align-items: center; }
        .nav-link { text-decoration: none; color: var(--text); font-weight: 500; font-size: 15px; }
        .client-btn { background: var(--accent); color: #fff; padding: 10px 22px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 15px; transition: background 0.2s; }
        .client-btn:hover { background: #3b0000; }

        /* Hero */
        .hero { padding: 140px 0 100px; text-align: center; }
        .hero-btn { background: var(--accent); color: #fff; padding: 22px 48px; border-radius: 12px; font-weight: 600; text-decoration: none; display: inline-block; transition: background 0.3s; }
        .hero-btn:hover { background: #000; }

        /* Impact Section */
        .impact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 60px 0; }
        .impact-card { background: #0a0a0a; color: #fff; padding: 80px; border-radius: 32px; display: flex; flex-direction: column; justify-content: center; }
        .stat-card { background: #fff; border: 1px solid var(--border); padding: 50px; border-radius: 32px; }

        /* Tabs Switcher */
        .tabs-wrapper { display: flex; justify-content: center; margin-bottom: 50px; }
        .tabs-container { background: #f0f0f2; padding: 6px; border-radius: 99px; display: inline-flex; gap: 8px; border: 1px solid var(--border); }
        .tab-btn { background: transparent; border: none; padding: 14px 32px; border-radius: 99px; font-size: 16px; font-weight: 600; cursor: pointer; color: var(--text-light); transition: all 0.3s ease; }
        .tab-btn.active { background: #fff; color: #000; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

        /* Services Grid */
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 32px; }
        .card { background: #fff; border: 1px solid var(--border); padding: 48px; border-radius: 28px; transition: all 0.4s ease; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .card:hover { transform: translateY(-8px); border-color: var(--accent); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
        .item-list { list-style: none; padding: 0; margin-top: 24px; }
        .item-list li { margin-bottom: 12px; font-size: 15px; color: var(--text-light); display: flex; align-items: center; gap: 10px; }

        /* Partners Grid */
        .partners-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .partner-card { background: #fff; border: 1px solid var(--border); padding: 40px; border-radius: 28px; display: flex; gap: 24px; align-items: flex-start; }
        .partner-avatar { width: 150px; height: 150px; border-radius: 24px; overflow: hidden; flex-shrink: 0; }
        .partner-monogram { width: 150px; height: 150px; border-radius: 24px; background: linear-gradient(135deg, #600000, #2c0000); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }

        /* FAQ & CNDs */
        .faq-grid { max-width: 800px; margin: 0 auto; display: grid; gap: 16px; }
        .faq-item { background: #fff; border: 1px solid var(--border); border-radius: 16px; padding: 24px; cursor: pointer; transition: all 0.2s; }
        .faq-item:hover { border-color: #ccc; }
        .cnd-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 40px; }
        .cnd-card { background: #fff; border: 1px solid var(--border); padding: 24px; border-radius: 16px; text-decoration: none; color: inherit; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s; }
        .cnd-card:hover { border-color: var(--accent); transform: translateY(-4px); }

        /* Footer */
        .footer-grid { display: grid; grid-template-columns: 1.5fr repeat(4, 1fr); gap: 40px; margin-bottom: 60px; }

        /* Responsive Media Queries */
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
        .marquee-container::before, .marquee-container::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          width: 80px;
          z-index: 2;
          pointer-events: none;
        }
        .marquee-container::before {
          left: 0;
          background: linear-gradient(to right, var(--bg), transparent);
        }
        .marquee-container::after {
          right: 0;
          background: linear-gradient(to left, var(--bg), transparent);
        }

        @media (max-width: 900px) {
          .container { padding: 0 20px; }
          h1 { font-size: 46px; line-height: 1.1; margin-bottom: 24px; }
          h2 { font-size: 36px; margin-bottom: 30px; }
          .hero { padding: 80px 0 60px; }
          .impact-grid, .grid, .partners-grid, .footer-grid, .cnd-grid, .mvv-grid, .partners-logos { grid-template-columns: 1fr; }
          .partners-logos { display: grid !important; gap: 30px; }
          .partner-card { flex-direction: column; align-items: center; text-align: center; }
          .partner-card p { text-align: center !important; }
          .impact-card, .stat-card { padding: 40px 24px; }
          nav { flex-direction: column; gap: 20px; }
          .nav-links { flex-wrap: wrap; justify-content: center; gap: 16px; }
        }
      `}</style>

      <div className="container">
        <nav>
          <Image src="/privilege-logo-colorida.svg" alt="Privilege Contabilidade" width={180} height={45} priority />
          <div className="nav-links">
            <a href="#atuacao" className="nav-link">Serviços</a>
            <a href="#quem-somos" className="nav-link">Quem Somos</a>
            <a href="#cnds" className="nav-link">Certidões</a>
            <a href="#faq" className="nav-link">Dúvidas</a>
            <a href="#contato" className="nav-link">Contato</a>
            <Link href="/login" className="client-btn">Área do Cliente</Link>
          </div>
        </nav>

        <section className="hero" style={{ position: 'relative', overflow: 'hidden' }}>
          <Image src="/hero_office.png" alt="Office Background" fill style={{ objectFit: 'cover', zIndex: -1, opacity: 0.1 }} />
          <h1 className="serif">Números que sustentam decisões estratégicas.</h1>
          <p style={{ fontSize: '20px', color: 'var(--text-light)', maxWidth: '700px', margin: '0 auto 40px' }}>
            Assessoria contábil e BPO financeiro para empresas que buscam clareza, segurança fiscal e crescimento acelerado.
          </p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#atuacao" className="hero-btn">Conhecer Soluções</a>
            <a href="#contato" className="hero-btn" style={{ background: '#fff', color: '#600000', border: '1px solid #600000' }}>Agendar Diagnóstico</a>
          </div>
        </section>

        <div className="impact-grid" style={{ position: 'relative', overflow: 'hidden' }}>
          <Image src="/finance_abstract.png" alt="Financial Abstract Background" fill style={{ objectFit: 'cover', zIndex: -1, opacity: 0.05 }} />
          <div className="impact-card">
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Resultados Alcançados</span>
            <div style={{ fontSize: '84px', fontWeight: '400', margin: '12px 0', fontFamily: serif.style.fontFamily }}>R$ 10 Mi+</div>
            <p style={{ fontSize: '18px', lineHeight: 1.4 }}>Em crédito facilitado e novas linhas de fomento estruturadas para nossos clientes.</p>
          </div>
          <div className="stat-card">
            <h3 style={{ fontSize: 28, marginBottom: 24 }}>Excelência Privilege</h3>
            <div style={{ display: 'grid', gap: 18 }}>
              {[
                { title: 'Balanço Auditado', desc: 'Transparência total para investidores e bancos.' },
                { title: 'BPO Integrado', desc: 'Gestão 100% digital do seu financeiro.' },
                { title: 'Planejamento Tributário', desc: 'Redução legal de carga fiscal.' }
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
        <section id="atuacao" style={{ padding: '80px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 className="serif">Nossas Soluções</h2>
            <p style={{ fontSize: '18px', color: 'var(--text-light)', maxWidth: '600px', margin: '0 auto 40px' }}>
              Alterne entre as soluções de Consultoria Estratégica e Escrituração Contábil para conhecer nossa entrega completa.
            </p>
          </div>

          <div className="tabs-wrapper">
            <div className="tabs-container">
              <button
                className={`tab-btn ${activeTab === 'consultoria' ? 'active' : ''}`}
                onClick={() => setActiveTab('consultoria')}
              >
                Consultoria & Gestão
              </button>
              <button
                className={`tab-btn ${activeTab === 'contabilidade' ? 'active' : ''}`}
                onClick={() => setActiveTab('contabilidade')}
              >
                Contabilidade & Fiscal
              </button>
            </div>
          </div>

          <div className="grid">
            {currentServices.map(s => (
              <div key={s.title} className="card">
                <h3 className="serif" style={{ fontSize: 26, marginBottom: 16 }}>{s.title}</h3>
                <p style={{ fontSize: 15, color: 'var(--text-light)' }}>{s.desc}</p>
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
          <Image src="/team_meeting.png" alt="Team Meeting" fill style={{ objectFit: 'cover', zIndex: -1, opacity: 0.05 }} />
          <div style={{ maxWidth: '800px', marginBottom: '50px' }}>
            <h2 className="serif" style={{ fontSize: 40, marginBottom: 20 }}>Sua parceira estratégica em contabilidade e gestão.</h2>
            <p style={{ fontSize: 17, color: 'var(--text-light)', marginBottom: 16 }}>
              A Privilege Contabilidade e Consultoria nasceu da necessidade de transformar dados contábeis em decisões estratégicas para empresas em crescimento.
            </p>
            <p style={{ fontSize: 17, color: 'var(--text-light)' }}>
              Nossa abordagem une a precisão técnica necessária para a conformidade fiscal com uma visão consultiva voltada para a rentabilidade e longevidade do seu negócio.
            </p>
          </div>

          <div className="partners-grid">
            {/* Marcos Cancelier */}
            <div className="partner-card">
              <div className="partner-monogram">
                <span style={{ fontSize: 36, letterSpacing: '2px' }}>MC</span>
                <span style={{ fontSize: 10, opacity: 0.8, textTransform: 'uppercase', marginTop: 4 }}>UTFPR · CRC-PR</span>
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="serif" style={{ fontSize: 26, marginBottom: 4 }}>Marcos Cancelier</h3>
                <p style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14, marginBottom: 4 }}>Sócio-Diretor · Contabilidade & Consultoria</p>
                <a href="https://instagram.com/marcos.cancelier" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', color: 'var(--text-light)', fontSize: '13px', marginBottom: '14px', textDecoration: 'none' }}>
                  @marcos.cancelier ↗
                </a>
                <p style={{ fontSize: 14, color: 'var(--text-light)', lineHeight: 1.6, textAlign: 'justify' }}>
                  Bacharel em Ciências Contábeis pela UTFPR com pós-graduações em Direito Tributário e Gestão Empresarial.
                  Palestrante do SESCAP-PR, atua na gestão executiva dos dois braços do grupo, conectando o rigor técnico contábil à estratégia empresarial e tomada de decisão.
                </p>
              </div>
            </div>

            {/* Mauricio Cielo */}
            <div className="partner-card">
              <div className="partner-avatar">
                <Image src="/foto-mauricio.jpg" alt="Mauricio Cielo" width={150} height={150} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="serif" style={{ fontSize: 26, marginBottom: 4 }}>Mauricio Cielo</h3>
                <p style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14, marginBottom: 4 }}>Sócio-Administrador · Consultoria Estratégica</p>
                <a href="https://instagram.com/mauricio.cielo" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', color: 'var(--text-light)', fontSize: '13px', marginBottom: '14px', textDecoration: 'none' }}>
                  @mauricio.cielo ↗
                </a>
                <p style={{ fontSize: 14, color: 'var(--text-light)', lineHeight: 1.6, textAlign: 'justify' }}>
                  Bacharel em Ciências Contábeis (CRC-PR 082974/O-7) com extensões em Auditoria e Riscos.
                  Com mais de 200 empresas atendidas, lidera as divisões de inteligência financeira, reestruturação de fluxo de caixa e planejamento tributário estratégico na Privilege Consultoria.
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '60px' }}>
            <h2 className="serif" style={{ fontSize: 36, marginBottom: '30px' }}>Missão, Visão e Valores</h2>
            <div className="mvv-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '30px' }}>
                <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <h3 className="serif" style={{ fontSize: 22, marginBottom: '15px' }}>Missão</h3>
                    <p style={{ fontSize: 15, color: 'var(--text-light)', textAlign: 'justify' }}>Oferecer serviços com qualidade, responsabilidade e excelência, superando as necessidades e expectativas dos clientes, colaboradores e da sociedade. É o nosso compromisso diário em cada atendimento e entrega.</p>
                </div>
                <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <h3 className="serif" style={{ fontSize: 22, marginBottom: '15px' }}>Visão</h3>
                  <p style={{ fontSize: 15, color: 'var(--text-light)', textAlign: 'justify' }}>Ser reconhecido, nos próximos 5 anos, em Francisco Beltrão, como o escritório de referência em contabilidade — um destino natural para quem busca excelência, confiança e resultados concretos.</p>
                </div>
                <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <h3 className="serif" style={{ fontSize: 22, marginBottom: '15px' }}>Valores</h3>
                    <p style={{ fontSize: 15, color: 'var(--text-light)', textAlign: 'justify' }}>Ética & Comprometimento, Responsabilidade & Confiança, Excelência & Qualidade, Inovação & Evolução, Sustentabilidade & Organização.</p>
                </div>
            </div>
          </div>

          <div style={{ marginTop: '60px' }}>
            <h2 className="serif" style={{ fontSize: 36, marginBottom: '30px' }}>Onde Estamos</h2>
            <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', height: '400px' }}>
                <iframe
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

          <div style={{ marginTop: '60px' }}>
            <h2 className="serif" style={{ fontSize: 36, marginBottom: '30px', textAlign: 'center' }}>Parceiros Institucionais</h2>
            <div className="marquee-container">
              <div className="marquee-track">
                {[...Array(2)].map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: '60px', alignItems: 'center', flexShrink: 0 }}>
                    <a href="https://ademicon.com.br" target="_blank" rel="noopener noreferrer"><Image src="/ademicon.svg" alt="Ademicon" width={150} height={50} style={{ objectFit: 'contain' }} /></a>
                    <a href="https://www.evolua.coop.br/" target="_blank" rel="noopener noreferrer"><Image src="/logo-evolua.svg" alt="Evolua Energia" width={150} height={50} style={{ objectFit: 'contain' }} /></a>
                    <a href="https://okton.com.br/" target="_blank" rel="noopener noreferrer" style={{ background: '#0A2540', padding: '10px 20px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center' }}><Image src="/okton.png" alt="Okton" width={130} height={40} style={{ objectFit: 'contain' }} /></a>
                    <a href="https://www.omie.com.br/" target="_blank" rel="noopener noreferrer"><Image src="/logo-omie.webp" alt="Omie" width={150} height={50} style={{ objectFit: 'contain' }} /></a>
                    <a href="https://www.bling.com.br/" target="_blank" rel="noopener noreferrer"><Image src="/bling.svg" alt="Bling" width={150} height={50} style={{ objectFit: 'contain' }} /></a>
                    <a href="https://sebraepr.com.br/" target="_blank" rel="noopener noreferrer"><Image src="/logo-sebrae.svg" alt="Sebrae PR" width={150} height={50} style={{ objectFit: 'contain' }} /></a>
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
                  Acessar portal <ExternalLink size={12} />
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* Impostômetro */}
        <section id="impostometro" style={{ padding: '80px 0', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
          <h2 className="serif" style={{ fontSize: 36, marginBottom: 30 }}>Acompanhe o Impostômetro</h2>
          <iframe id="impostometro-widget" src="https://impostometro.com.br/widget/contador/" width="728" height="228" scrolling="no" frameBorder="0" style={{ border: 'none', maxWidth: '100%' }}></iframe>
        </section>

        {/* Perguntas Frequentes (FAQ) */}
        <section id="faq" style={{ padding: '80px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 40px' }}>
            <h2 className="serif" style={{ fontSize: 36, marginBottom: 12 }}>Dúvidas Frequentes</h2>
            <p style={{ fontSize: 16, color: 'var(--text-light)' }}>
              Esclarecimentos sobre os modelos de atuação, assessoria contábil e terceirização financeira.
            </p>
          </div>
          <div className="faq-grid">
            {faqs.map((faq, idx) => (
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
                      color: 'var(--accent)'
                    }}
                  />
                </div>
                {openFaq === idx && (
                  <p style={{ marginTop: 14, fontSize: 14, color: 'var(--text-light)', lineHeight: 1.6 }}>
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Contato */}
        <section id="contato" style={{ padding: '90px 40px', background: '#f9f9f9', borderRadius: '32px', textAlign: 'center', margin: '60px 0' }}>
          <h2 className="serif" style={{ fontSize: 44, marginBottom: 16 }}>Pronto para estruturar o crescimento da sua empresa?</h2>
          <p style={{ fontSize: 18, color: 'var(--text-light)', marginBottom: 36, maxWidth: '540px', margin: '0 auto 36px' }}>
            Agende um diagnóstico consultivo gratuito com nossos sócios e descubra oportunidades de eficiência tributária e financeira.
          </p>
          <a href="https://wa.me/554630351018" target="_blank" rel="noopener noreferrer" className="hero-btn">
            Falar com um Consultor no WhatsApp
          </a>
        </section>
      </div>

      {/* Footer */}
      <footer style={{ padding: '70px 0 35px', background: '#111', color: '#fff' }}>
        <div className="container">
          <div className="footer-grid">
            <div>
              <Image src="/privilege-logo-colorida.svg" alt="Privilege Contabilidade" width={160} height={40} style={{ marginBottom: '20px', filter: 'brightness(0) invert(1)' }} />
              <p style={{ fontSize: 13, color: '#a3a3a3', maxWidth: '240px', marginBottom: 20 }}>
                Inteligência contábil e consultoria estratégica em Francisco Beltrão - PR.
              </p>
              <div style={{ display: 'flex', gap: '15px' }}>
                <a href="https://instagram.com/privilegefb" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', fontSize: '13px', textDecoration: 'none' }}>Instagram</a>
                <a href="https://www.linkedin.com/company/privilege-assessoria-cont%C3%A1bil/" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', fontSize: '13px', textDecoration: 'none' }}>LinkedIn</a>
              </div>
            </div>

            {[
              { title: 'Contato', links: [{ label: 'WhatsApp', href: 'https://wa.me/554630351018' }, { label: 'Diagnóstico', href: '#contato' }, { label: 'Localização', href: '#contato' }] },
              { title: 'Institucional', links: [{ label: 'Quem Somos', href: '#quem-somos' }, { label: 'Área do Cliente', href: '/login' }, { label: 'Metodologia', href: '#atuacao' }] },
              { title: 'Serviços', links: [{ label: 'BPO Financeiro', href: '#atuacao' }, { label: 'Planejamento Tributário', href: '#atuacao' }, { label: 'Controladoria & BI', href: '#atuacao' }] },
              { title: 'Utilidades', links: [{ label: 'Certidões CND', href: '#cnds' }, { label: 'Dúvidas FAQ', href: '#faq' }, { label: 'Simples / Lucro Real', href: '#atuacao' }] }
            ].map(col => (
              <div key={col.title}>
                <h4 style={{ fontWeight: 600, marginBottom: '20px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff' }}>{col.title}</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {col.links.map(link => (
                    <li key={link.label} style={{ marginBottom: '10px' }}>
                      <a href={link.href} style={{ color: '#a3a3a3', fontSize: '14px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#fff'} onMouseOut={e => e.currentTarget.style.color = '#a3a3a3'}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '25px', display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '13px', flexWrap: 'wrap', gap: 16 }}>
            <div>© {new Date().getFullYear()} Privilege Contabilidade e Consultoria. Todos os direitos reservados.</div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <button
                type="button"
                onClick={() => setLegalModal('termos')}
                style={{ background: 'none', border: 'none', padding: 0, color: '#a3a3a3', fontSize: '13px', cursor: 'pointer', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.color = '#fff'}
                onMouseOut={e => e.currentTarget.style.color = '#a3a3a3'}
              >
                Termos de Uso
              </button>
              <button
                type="button"
                onClick={() => setLegalModal('privacidade')}
                style={{ background: 'none', border: 'none', padding: 0, color: '#a3a3a3', fontSize: '13px', cursor: 'pointer', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.color = '#fff'}
                onMouseOut={e => e.currentTarget.style.color = '#a3a3a3'}
              >
                Privacidade
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal Termos de Uso & Política de Privacidade */}
      {legalModal && (
        <div
          onClick={() => setLegalModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              color: '#171717',
              maxWidth: '720px',
              width: '100%',
              maxHeight: '85vh',
              borderRadius: '24px',
              padding: '40px',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px', borderBottom: '1px solid #e5e5e5', paddingBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#600000' }}>
                  Privilege Contabilidade e Consultoria
                </span>
                <h3 className="serif" style={{ fontSize: '34px', margin: '4px 0 0 0', lineHeight: 1.15 }}>
                  {legalModal === 'termos' ? 'Termos e Condições de Uso' : 'Política de Privacidade e Proteção de Dados (LGPD)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                aria-label="Fechar"
                style={{
                  background: '#f5f5f5',
                  border: 'none',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <X size={18} color="#171717" />
              </button>
            </div>

            {legalModal === 'termos' ? (
              <div style={{ fontSize: '14.5px', color: '#404040', lineHeight: 1.7, display: 'grid', gap: '18px', textAlign: 'justify' }}>
                <div style={{ lineHeight: 1.7, textAlign: 'justify' }}>
                  <p><strong>Última atualização:</strong> 21 de outubro de 2026.</p>
                  <p>Este instrumento contratual ("Termo") regula os direitos, obrigações, responsabilidades e condições gerais para acesso e utilização das aplicações, sistemas web, APIs, módulos de automação e ferramentas digitais fornecidas pela <strong>PRIVILEGE CONSULTORIA LTDA</strong>, pessoa jurídica de direito privado, inscrita no <strong>CNPJ sob o nº 58.033.979/0001-84</strong>, com sede na Rua Pará, nº 127, Sala 03, Centro, CEP 85601-290, no município de <strong>Francisco Beltrão, Estado do Paraná</strong>, doravante denominada simplesmente <strong>"CONTRATADA"</strong>, e, do outro lado, a pessoa física ou jurídica que acessa ou contrata os serviços, doravante denominada <strong>"USUÁRIO"</strong> ou <strong>"CONTRATANTE"</strong>.</p>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginTop: '20px', marginBottom: '8px', fontFamily: sans.style.fontFamily }}>1. ACEITE, OBJETO E ESCOPO DOS SERVIÇOS</h4>
                  <p><strong>1.1. Aceite Vinculante:</strong> A criação de conta, autenticação, acesso ou utilização contínua da Plataforma constitui <strong>manifestação expressa e inequívoca de concordância</strong> com este Termo. Caso o USUÁRIO discorde de qualquer cláusula, deverá cessar imediatamente o uso dos serviços.</p>
                  <p><strong>1.2. Objeto:</strong> O presente instrumento tem como objeto licenciar o <strong>uso temporário, não exclusivo e intransferível</strong> de software e ambiente digital voltado à gestão contábil, financeira, fiscal, BPO financeiro, processamento de rotinas acessórias e inteligência de negócios.</p>
                  <p><strong>1.3. Representação Legal:</strong> O indivíduo que realiza o cadastro em nome de uma pessoa jurídica <strong>declara e garante possuir plenos poderes legais e societários</strong> para vinculá-la aos termos deste contrato.</p>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginTop: '20px', marginBottom: '8px', fontFamily: sans.style.fontFamily }}>2. AUTENTICAÇÃO, CREDENCIAIS E SEGURANÇA OPERACIONAL</h4>
                  <p><strong>2.1. Guarda de Credenciais:</strong> O acesso é <strong>estritamente pessoal e intransferível</strong>, operado mediante identificador unívoco (login), credencial criptográfica (senha) e autenticação de múltiplos fatores (MFA/2FA), quando exigida. O USUÁRIO é o <strong>único responsável pela guarda e confidencialidade</strong> de tais acessos.</p>
                  <p><strong>2.2. Imputabilidade de Operações:</strong> Toda e qualquer transação, envio de arquivos, baixa de pagamentos, parametrização fiscal ou autorização de rotinas executadas sob as credenciais do USUÁRIO <strong>presumem-se válidas, legítimas e de sua inteira responsabilidade</strong>.</p>
                  <p><strong>2.3. Comunicação de Incidentes:</strong> Qualquer suspeita de quebra de confidencialidade, vazamento de credenciais ou intrusão não autorizada deve ser reportada de forma <strong>imediata</strong> à CONTRATADA por meio dos canais oficiais de suporte técnico.</p>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginTop: '20px', marginBottom: '8px', fontFamily: sans.style.fontFamily }}>3. RESPONSABILIDADE SOBRE DOCUMENTOS, FISCALIZAÇÃO E COMPLIANCE TRIBUTÁRIO</h4>
                  <p><strong>3.1. Veracidade e Idoneidade do Input:</strong> O USUÁRIO assume <strong>responsabilidade civil, administrativa e penal integral</strong> pela veracidade, acurácia, legalidade, completude e integridade de todos os documentos (arquivos XML/SPED, notas fiscais, extratos OFX/PDF, contratos e comprovantes bancários) inseridos ou integrados à Plataforma.</p>
                  <p><strong>3.2. Exoneração por Erro de Entrada (Garbage In, Garbage Out):</strong> A CONTRATADA e seus responsáveis técnicos ficam <strong>integralmente isentos de responsabilidade</strong> por:</p>
                  <ul style={{ paddingLeft: '20px', margin: '8px 0 12px' }}>
                    <li><strong>Multas, juros moratórios, glosas fiscais ou autuações</strong> lavradas por órgãos fazendários decorrentes de dados incorretos, extemporâneos ou omitidos pelo USUÁRIO;</li>
                    <li><strong>Falhas na apuração de impostos e entrega de obrigações</strong> decorrentes de arquivos corrompidos, adulterados ou enviados fora dos prazos operacionais pactuados;</li>
                    <li><strong>Omissão de contas bancárias, movimentações patrimoniais ou receitas tributáveis</strong> no ambiente da Plataforma.</li>
                  </ul>
                  <p><strong>3.3. Guarda dos Documentos Fiscais:</strong> Salvo disposição contratual específica para custódia digital, a obrigação legal de manter a guarda dos documentos comprobatórios pelo <strong>prazo decadencial/prescricional legal</strong> (art. 173 do Código Tributário Nacional e art. 195 da CLT) permanece sob responsabilidade do USUÁRIO.</p>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginTop: '20px', marginBottom: '8px', fontFamily: sans.style.fontFamily }}>4. DISPONIBILIDADE DA PLATAFORMA (SLA) E SUPORTE TÉCNICO</h4>
                  <p><strong>4.1. Meta de Disponibilidade:</strong> A CONTRATADA empregará esforços comercialmente razoáveis para manter a Plataforma acessível com índice de disponibilidade de <strong>99,0% (noventa e nove por cento) ao mês</strong>, mensurado no regime 24x7x365.</p>
                  <p><strong>4.2. Exclusões do SLA:</strong> Não são computadas para fins de índice de disponibilidade:</p>
                  <ul style={{ paddingLeft: '20px', margin: '8px 0 12px' }}>
                    <li><strong>Janelas de manutenção preventiva ou corretiva programadas</strong> (comunicadas com aviso prévio mínimo de 24 horas e executadas prioritariamente fora do horário comercial);</li>
                    <li><strong>Indisponibilidades decorrentes de falhas de conectividade</strong> do próprio USUÁRIO ou de seus provedores de telecomunicações;</li>
                    <li><strong>Inoperância de webservices e sistemas de órgãos públicos governamentais</strong> (eSocial, Conectividade Social, SEFAZ estaduais, Prefeituras ou Receita Federal do Brasil);</li>
                    <li><strong>Hipóteses de caso fortuito ou força maior</strong> (art. 393 do Código Civil), bem como ataques de negação de serviço (DDoS) de larga escala que excedam os mecanismos de mitigação padrão.</li>
                  </ul>
                  <p><strong>4.3. Suporte:</strong> O suporte técnico para incidentes e correções na Plataforma será prestado em <strong>dias úteis, das 08h às 18h</strong>, através dos canais de chamado e mensageria integrados.</p>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginTop: '20px', marginBottom: '8px', fontFamily: sans.style.fontFamily }}>5. PROPRIEDADE INTELECTUAL E RESTRIÇÕES DE ENGENHARIA REVERSA</h4>
                  <p><strong>5.1. Titularidade:</strong> A arquitetura lógica, códigos-fonte, bibliotecas, algoritmos, rotinas de banco de dados, fluxos de integração via API, relatórios pré-formatados, interfaces de usuário (UI/UX) e marcas <strong>pertencem com exclusividade à CONTRATADA</strong>.</p>
                  <p><strong>5.2. Vedações Expressas:</strong> É <strong>expressamente proibido</strong> ao USUÁRIO, diretamente ou por intermédio de terceiros:</p>
                  <ul style={{ paddingLeft: '20px', margin: '8px 0 12px' }}>
                    <li>Copiar, modificar, distribuir, vender, alugar ou criar obras derivadas baseadas na Plataforma;</li>
                    <li>Realizar <strong>engenharia reversa, descompilar, desmontar</strong> ou tentar extrair o código-fonte da aplicação;</li>
                    <li>Empregar rotinas automatizadas não autorizadas de varredura (web scraping, crawlers, spiders) para extração sistemática de dados ou sobrecarga da infraestrutura;</li>
                    <li>Violar ou tentar contornar mecanismos de autenticação, criptografia ou limites operacionais de taxa de requisições (rate limits).</li>
                  </ul>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginTop: '20px', marginBottom: '8px', fontFamily: sans.style.fontFamily }}>6. LIMITAÇÃO DE RESPONSABILIDADE FINANCEIRA E CIVIL</h4>
                  <p><strong>6.1.</strong> Em nenhuma circunstância a CONTRATADA será responsável perante o USUÁRIO ou terceiros por <strong>lucros cessantes, perdas de oportunidade de negócio, danos indiretos, incidentais ou punitivos</strong> de qualquer natureza decorrentes do uso ou da impossibilidade de uso da Plataforma.</p>
                  <p><strong>6.2.</strong> Na extensão máxima permitida pela legislação aplicável, eventual responsabilidade indenizatória total da CONTRATADA estará <strong>limitada ao montante financeiro efetivamente pago pelo USUÁRIO nos últimos 3 (três) meses</strong> anteriores ao fato gerador da demanda.</p>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginTop: '20px', marginBottom: '8px', fontFamily: sans.style.fontFamily }}>7. SUSPENSÃO, RESCISÃO E DESCREDENCIAMENTO</h4>
                  <p><strong>7.1. Rescisão por Violação:</strong> A CONTRATADA reserva-se o direito de <strong>suspender cautelarmente ou encerrar</strong> o acesso do USUÁRIO à Plataforma, sem necessidade de aviso prévio e sem direito a qualquer indenização, nas seguintes hipóteses:</p>
                  <ul style={{ paddingLeft: '20px', margin: '8px 0 12px' }}>
                    <li>Inadimplemento financeiro das mensalidades ou taxas de serviço contratadas;</li>
                    <li>Violação comprovada de cláusulas de propriedade intelectual ou segurança da informação;</li>
                    <li>Uso da Plataforma para práticas fraudulentas, simulação fiscal, lavagem de capitais ou ilícitos civis e penais.</li>
                  </ul>
                  <p><strong>7.2. Exportação de Dados:</strong> Em caso de encerramento contratual regular, o USUÁRIO terá o direito de requerer ou realizar o download de seus dados e balancetes armazenados no formato padrão do sistema em até <strong>30 (trinta) dias corridos</strong> após a solicitação de cancelamento. Findo este período, os dados poderão ser definitivamente expurgados ou mantidos unicamente para cumprimento de obrigação legal.</p>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginTop: '20px', marginBottom: '8px', fontFamily: sans.style.fontFamily }}>8. DISPOSIÇÕES GERAIS E ATUALIZAÇÕES DOS TERMOS</h4>
                  <p><strong>8.1. Autonomia das Cláusulas:</strong> Se qualquer disposição deste Termo for declarada nula ou inexequível por decisão judicial transitada em julgado, as demais cláusulas permanecerão <strong>plenamente válidas e eficazes</strong>.</p>
                  <p><strong>8.2. Atualização do Instrumento:</strong> A CONTRATADA poderá alterar as disposições deste Termo para refletir aprimoramentos técnicos ou adequações regulatórias. As alterações entrarão em vigor a partir da publicação da versão revisada no ambiente do sistema, sendo comunicadas com destaque ao USUÁRIO. O uso continuado após a notificação constituirá <strong>aceitação tácita</strong>.</p>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginTop: '20px', marginBottom: '8px', fontFamily: sans.style.fontFamily }}>9. LEGISLAÇÃO APLICÁVEL E FORO DE ELEIÇÃO</h4>
                  <p><strong>9.1.</strong> Este contrato é regido e interpretado em estrita conformidade com as leis da <strong>República Federativa do Brasil</strong>.</p>
                  <p><strong>9.2.</strong> As partes elegem expressamente o <strong>Foro da Comarca de Francisco Beltrão, Estado do Paraná</strong>, como o único competente para processar e julgar qualquer ação, disputa ou controvérsia decorrente da interpretação ou execução deste instrumento, com renúncia irrevogável a qualquer outro foro, por mais privilegiado que seja ou venha a ser.</p>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '14.5px', color: '#404040', lineHeight: 1.7, display: 'grid', gap: '18px', textAlign: 'justify' }}>
                <div style={{ lineHeight: 1.7, textAlign: 'justify' }}>
                  <p><strong>Última atualização: 21 de outubro de 2026.</strong></p>
                  <p>A <strong>PRIVILEGE CONSULTORIA LTDA</strong>, pessoa jurídica de direito privado, inscrita no <strong>CNPJ sob o nº 58.033.979/0001-84</strong>, com sede na Rua Pará, nº 127, Sala 03, Centro, CEP 85601-290, no município de Francisco Beltrão, Estado do Paraná (doravante denominada <strong>"PRIVILEGE"</strong> ou <strong>"EMPRESA"</strong>), reafirma seu compromisso com a privacidade, transparência, segurança da informação e a proteção dos dados pessoais tratados no contexto de suas soluções tecnológicas, sistemas web, rotinas contábeis, BPO financeiro e assessoria de gestão.</p>
                  <p>Esta <strong>Política de Privacidade</strong> descreve como os dados pessoais são coletados, processados, armazenados, compartilhados e descartados, em estrita conformidade com a <strong>Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 – LGPD)</strong> e demais diplomas aplicáveis.</p>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginBottom: '6px', fontFamily: sans.style.fontFamily }}>1. DEFINIÇÕES TÉCNICAS E PAPÉIS SOB A LGPD</h4>
                  <p><strong>1.1.</strong> Para a perfeita interpretação deste instrumento, aplicam-se as seguintes definições do art. 5º da LGPD:</p>
                  <p><strong>Dado Pessoal:</strong> Informação relacionada a pessoa natural identificada ou identificável;</p>
                  <p><strong>Dado Pessoal Sensível:</strong> Dado sobre origem racial/étnica, convicção religiosa, opinião política, filiação sindical, dado genético/biométrico ou relativo à saúde/vida sexual;</p>
                  <p><strong>Titular:</strong> A pessoa física a quem se referem os dados pessoais objeto de tratamento;</p>
                  <p><strong>Controlador:</strong> Pessoa física ou jurídica a quem competem as decisões sobre o tratamento de dados pessoais. No contexto de clientes corporativos (B2B), a empresa CONTRATANTE atua predominantemente como Controladora dos dados de seus colaboradores, clientes e fornecedores inseridos no sistema;</p>
                  <p><strong>Operador:</strong> Pessoa jurídica que realiza o tratamento de dados em nome do Controlador. A PRIVILEGE atua como Operadora no que tange ao processamento operacional de folhas de pagamento, documentos fiscais, faturamento e BPO financeiro delegados por seus clientes; e como Controladora em relação aos dados diretos de cadastro e acesso dos seus usuários e contratantes diretos;</p>
                  <p><strong>Encarregado (DPO - Data Protection Officer):</strong> Pessoa indicada para atuar como canal de comunicação entre o Controlador, os titulares dos dados e a Autoridade Nacional de Proteção de Dados (ANPD).</p>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginBottom: '6px', fontFamily: sans.style.fontFamily }}>2. DADOS COLETADOS E BASES LEGAIS DE TRATAMENTO</h4>
                  <p>A coleta de dados é restrita ao mínimo necessário para a execução técnica e conformidade fiscal/regulatória das atividades, classificada conforme as hipóteses autorizativas do art. 7º da LGPD:</p>
                  <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                    <li><strong>Identificação e Cadastro:</strong> Nome completo, CPF, RG, e-mail corporativo, número de telefone, cargo, dados societários. <em>Finalidade:</em> Autenticação no sistema, formalização contratual e comunicação operacional. <em>Base Legal:</em> Execução de Contrato (Art. 7º, V).</li>
                    <li><strong>Dados Financeiros e Contábeis:</strong> Chaves PIX, dados bancários de favorecidos, comprovantes de despesas, extratos de contas correntes. <em>Finalidade:</em> Execução de rotinas de BPO financeiro, conciliação contábil, apuração de tributos e emissão de relatórios. <em>Base Legal:</em> Execução de Contrato (Art. 7º, V) e Cumprimento de Obrigação Legal (Art. 7º, II).</li>
                    <li><strong>Dados Laborais (DP/RH):</strong> Salário, pró-labore, dependentes, PIS/PASEP, CTPS digital, dados previdenciários. <em>Finalidade:</em> Processamento de folha de pagamento, envio ao eSocial, DCTFWeb e emissão de guias (FGTS, INSS, IRRF). <em>Base Legal:</em> Cumprimento de Obrigação Legal ou Regulatória (Art. 7º, II).</li>
                    <li><strong>Logs e Registros Técnicos:</strong> Endereço IP, data e hora de conexão, porta lógica, logs de eventos no sistema e requisições de API. <em>Finalidade:</em> Rastreabilidade de acessos, auditoria interna e prevenção a fraudes cibernéticas. <em>Base Legal:</em> Cumprimento de Obrigação Legal (Art. 15 da Lei nº 12.965/2014 – Marco Civil da Internet).</li>
                  </ul>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginBottom: '6px', fontFamily: sans.style.fontFamily }}>3. PROCESSAMENTO AUTOMATIZADO E INTELIGÊNCIA COMPUTACIONAL</h4>
                  <p><strong>3.1. Processamento Estruturado:</strong> A PRIVILEGE poderá empregar <strong>algoritmos de análise fiscal, rotinas de inteligência tributária</strong>, reconciliação automatizada de dados bancários (OFX/API) e modelos de linguagem para processamento e classificação de documentos contábeis (XMLs de NF-e, NFS-e, CT-e, SPEDs).</p>
                  <p><strong>3.2. Finalidade Estrita:</strong> Nenhuma informação processada por tais ferramentas é <strong>compartilhada para fins de publicidade comportamental, nem comercializada a terceiros</strong>.</p>
                  <p><strong>3.3. Revisão Humana:</strong> Qualquer classificação tributária crítica ou decisão contábil estratégica decorrente de triagem algorítmica permanece <strong>sujeita à validação, conferência e supervisão por contadores e consultores técnicos legalmente habilitados junto ao CRC</strong>.</p>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginBottom: '6px', fontFamily: sans.style.fontFamily }}>4. MEDIDAS DE SEGURANÇA DA INFORMAÇÃO E MITIGAÇÃO DE RISCOS</h4>
                  <p>A PRIVILEGE adota <strong>medidas técnicas, administrativas e organizacionais aptas a proteger os dados pessoais</strong> contra acessos não autorizados e situações acidentais ou ilícitas de destruição, perda, alteração ou comunicação (art. 46 da LGPD):</p>
                  <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                    <li><strong>Criptografia Avançada:</strong> Tráfego de rede criptografado via protocolo seguro <strong>TLS 1.3 (HTTPS)</strong> e dados sensíveis criptografados em repouso (at-rest) com cifra simétrica <strong>AES-256</strong>;</li>
                    <li><strong>Gestão de Acessos (Princípio do Menor Privilégio):</strong> Isolamento de permissões (Role-Based Access Control - RBAC), garantindo que apenas profissionais estritamente autorizados e vinculados a termos de sigilo processem os dados;</li>
                    <li><strong>Trilhas de Auditoria Imutáveis:</strong> Armazenamento seguro de logs de transação, registrando autor, data, hora e natureza de toda alteração ou exclusão de registros;</li>
                    <li><strong>Rotinas de Backup e Continuidade:</strong> Cópias de segurança automatizadas e distribuídas geograficamente, assegurando alta resiliência e planos de recuperação de desastres (disaster recovery).</li>
                  </ul>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginBottom: '6px', fontFamily: sans.style.fontFamily }}>5. COMPARTILHAMENTO DE DADOS COM TERCEIROS</h4>
                  <p><strong>5.1.</strong> A PRIVILEGE <strong>não vende, aluga ou cede bases de dados pessoais</strong> sob qualquer pretexto.</p>
                  <p><strong>5.2.</strong> O compartilhamento ocorre unicamente nos limites estritos das finalidades contratadas:</p>
                  <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                    <li><strong>Órgãos Fazendários e Previdenciários:</strong> Transmissão de declarações e obrigações acessórias via ecossistema SPED, eSocial, Receita Federal, Secretarias de Estado da Fazenda e Prefeituras Municipais, no cumprimento direto de dever legal;</li>
                    <li><strong>Infraestrutura em Nuvem:</strong> Provedores de hospedagem e servidores de alta segurança (tais como AWS, Google Cloud ou Microsoft Azure), com acordos de processamento de dados (DPA) que asseguram conformidade internacional e aderência à LGPD;</li>
                    <li><strong>Instituições Financeiras Integradas:</strong> Intercâmbio de dados bancários estritamente para viabilizar as rotinas de liquidação, conciliação e geração de boletos autorizadas formalmente pelo CONTRATANTE.</li>
                  </ul>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginBottom: '6px', fontFamily: sans.style.fontFamily }}>6. RETENÇÃO E CICLO DE DESCARTE DE DADOS</h4>
                  <p><strong>6.1.</strong> Os dados pessoais serão retidos pelo período necessário para o cumprimento das finalidades pactuadas e para o atendimento de prazos prescricionais e decadenciais legais aos quais a PRIVILEGE e seus clientes estão sujeitos, incluindo, mas não se limitando a:</p>
                  <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                    <li><strong>5 (cinco) anos:</strong> Para guarda de documentos e escriturações fiscais (art. 173 do Código Tributário Nacional);</li>
                    <li><strong>30 (trinta) anos:</strong> Para documentos comprobatórios de FGTS e obrigações previdenciárias associadas à folha de pagamento;</li>
                    <li><strong>6 (seis) meses:</strong> Para registros de conexão à internet e aplicações (art. 15 do Marco Civil da Internet).</li>
                  </ul>
                  <p><strong>6.2.</strong> Exaurida a finalidade operacional e decorridos os prazos de custódia legal, os dados serão <strong>eliminados com segurança ou anonimizados irreversivelmente</strong> para fins estatísticos internos.</p>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginBottom: '6px', fontFamily: sans.style.fontFamily }}>7. DIREITOS DOS TITULARES DE DADOS (ART. 18 DA LGPD)</h4>
                  <p><strong>7.1.</strong> O Titular de Dados Pessoais pode, a qualquer tempo e mediante requisição formal, exercer perante a PRIVILEGE os seguintes direitos:</p>
                  <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                    <li><strong>Confirmação</strong> da existência de tratamento;</li>
                    <li><strong>Acesso</strong> aos dados pessoais tratados;</li>
                    <li><strong>Correção</strong> de dados incompletos, inexatos ou desatualizados;</li>
                    <li><strong>Anonimização, bloqueio ou eliminação</strong> de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD;</li>
                    <li><strong>Portabilidade dos dados</strong> a outro fornecedor de serviço, mediante requisição expressa;</li>
                    <li><strong>Informação</strong> sobre as entidades públicas e privadas com as quais o Controlador realizou uso compartilhado de dados.</li>
                  </ul>
                  <p><strong>7.2.</strong> Quando a PRIVILEGE atuar como Operadora, as solicitações dos titulares vinculados aos seus clientes corporativos serão prontamente direcionadas ao respectivo Controlador, prestando o suporte técnico necessário para a resposta tempestiva.</p>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginBottom: '6px', fontFamily: sans.style.fontFamily }}>8. IDENTIFICAÇÃO DO ENCARREGADO PELO TRATAMENTO DE DADOS (DPO)</h4>
                  <p>Para exercer qualquer um dos direitos previstos na LGPD, reportar potenciais vulnerabilidades ou sanar dúvidas sobre o tratamento de dados pessoais, o titular ou a autoridade poderá entrar em contato direto com o Encarregado de Dados (DPO):</p>
                  <p><strong>Responsável:</strong> Encarregado pelo Tratamento de Dados Pessoais (DPO) – PRIVILEGE CONSULTORIA LTDA<br/>
                  <strong>Canal de Privacidade / E-mail:</strong> <strong>contato@privilegecontabilidade.com.br</strong><br/>
                  <strong>Endereço Postal:</strong> Rua Pará, nº 127, Sala 03, Centro, CEP 85601-290, Francisco Beltrão – PR.</p>

                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginBottom: '6px', fontFamily: sans.style.fontFamily }}>9. ATUALIZAÇÕES DESTA POLÍTICA E FORO DE ELEIÇÃO</h4>
                  <p><strong>9.1.</strong> Esta Política poderá ser atualizada a qualquer momento para refletir melhorias técnicas, novos serviços ou adequações regulatórias emitidas pela ANPD, entrando em vigor na data de sua publicação no ambiente da Plataforma.</p>
                  <p><strong>9.2.</strong> Este documento é regido pelas leis da <strong>República Federativa do Brasil</strong>. Para a resolução de controvérsias decorrentes deste instrumento que não puderem ser solucionadas consensualmente pela via administrativa, fica eleito o <strong>Foro da Comarca de Francisco Beltrão, Estado do Paraná</strong>.</p>
                </div>
              </div>
            )}

            <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setLegalModal(legalModal === 'termos' ? 'privacidade' : 'termos')}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#600000', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {legalModal === 'termos' ? 'Ver Política de Privacidade →' : 'Ver Termos de Uso →'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                style={{
                  background: '#600000',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Entendi e Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
