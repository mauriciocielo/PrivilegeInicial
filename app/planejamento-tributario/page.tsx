import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ChevronRight, TrendingDown, Scale, ShieldAlert, Sparkles, MessageCircle, Phone } from 'lucide-react';

const PAGE_TITLE = 'Planejamento Tributário e Gestão Fiscal';
const PAGE_DESC =
  'Reduza legalmente seus impostos e prepare sua empresa para a Reforma Tributária. Estudo entre Simples, Presumido e Lucro Real em Francisco Beltrão, PR.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  keywords: [
    'planejamento tributário Francisco Beltrão',
    'redução de impostos Paraná',
    'Simples Nacional vs Lucro Real',
    'Lucro Presumido planejamento',
    'recuperação de créditos tributários PR',
    'consultoria tributária Francisco Beltrão',
    'reforma tributária IBS CBS empresas',
  ],
  alternates: {
    canonical: 'https://privilegecontabilidade.cnt.br/planejamento-tributario',
  },
  openGraph: {
    title: `${PAGE_TITLE} | Privilege`,
    description: PAGE_DESC,
    url: 'https://privilegecontabilidade.cnt.br/planejamento-tributario',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Privilege Contabilidade e Consultoria' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PAGE_TITLE} | Privilege`,
    description: PAGE_DESC,
    images: ['/og-image.png'],
  },
};

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Service',
      '@id': 'https://privilegecontabilidade.cnt.br/planejamento-tributario#service',
      name: 'Planejamento Tributário e Gestão Fiscal',
      serviceType: 'Consultoria Tributária e Elisão Fiscal',
      description: PAGE_DESC,
      url: 'https://privilegecontabilidade.cnt.br/planejamento-tributario',
      provider: {
        '@id': 'https://privilegecontabilidade.cnt.br/#organization',
      },
      areaServed: [
        { '@type': 'City', name: 'Francisco Beltrão' },
        { '@type': 'AdministrativeArea', name: 'Sudoeste do Paraná' },
        { '@type': 'AdministrativeArea', name: 'Paraná' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Início',
          item: 'https://privilegecontabilidade.cnt.br/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Planejamento Tributário',
          item: 'https://privilegecontabilidade.cnt.br/planejamento-tributario',
        },
      ],
    },
  ],
};

export default function PlanejamentoTributarioPage() {
  const whatsAppUrl = 'https://wa.me/554630351018?text=Ol%C3%A1!%20Gostaria%20de%20agendar%20um%20diagn%C3%B3stico%20de%20Planejamento%20Tribut%C3%A1rio%20para%20minha%20empresa.';

  return (
    <div style={{ background: '#fdfdfd', color: '#171717', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />

      {/* Header Institucional */}
      <header style={{ borderBottom: '1px solid #e5e5e5', background: '#fff', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <Image src="/privilege-logo-colorida.svg" alt="Privilege Contabilidade e Consultoria" width={170} height={42} priority />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: '#525252',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
              }}
            >
              <ArrowLeft size={16} /> Voltar ao Início
            </Link>
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#600000',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <MessageCircle size={16} /> Falar no WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <nav style={{ background: '#f5f5f7', borderBottom: '1px solid #eaeaea', padding: '12px 24px', fontSize: '13px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#737373' }}>
          <Link href="/" style={{ color: '#525252', textDecoration: 'none' }}>Início</Link>
          <ChevronRight size={14} />
          <span style={{ color: '#600000', fontWeight: 600 }}>Planejamento Tributário</span>
        </div>
      </nav>

      {/* Hero do Serviço */}
      <main style={{ maxWidth: '1000px', width: '100%', margin: '0 auto', padding: '48px 24px 80px', flex: 1 }}>
        <div style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto 48px' }}>
          <span style={{ color: '#600000', fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'inline-block', marginBottom: '12px' }}>
            Consultoria e Inteligência Fiscal
          </span>
          <h1 style={{ fontSize: '44px', lineHeight: 1.15, fontWeight: 800, margin: '0 0 20px 0', color: '#111' }}>
            Planejamento Tributário: Pague Apenas o Justo e Blinde Seu Negócio com Segurança Jurídica
          </h1>
          <p style={{ fontSize: '18px', lineHeight: 1.6, color: '#525252', margin: '0 0 32px 0' }}>
            No Brasil, grande parte das empresas paga impostos a mais por enquadramento inadequado ou por não aproveitar benefícios fiscais legais. A Privilege Contabilidade realiza diagnóstico tributário aprofundado para gerar economia real e preparar sua empresa para a Reforma Tributária.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#600000',
                color: '#fff',
                padding: '16px 36px',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '16px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 4px 14px rgba(96,0,0,0.25)',
              }}
            >
              <MessageCircle size={20} /> Solicitar Diagnóstico Tributário
            </a>
            <a
              href="tel:+554630351018"
              style={{
                background: '#fff',
                color: '#600000',
                border: '1px solid #600000',
                padding: '16px 28px',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '16px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Phone size={18} /> (46) 3035-1018
            </a>
          </div>
        </div>

        {/* Por que fazer planejamento agora */}
        <section style={{ marginBottom: '56px', background: '#fff', border: '1px solid #e5e5e5', borderRadius: '24px', padding: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 18px 0', color: '#111' }}>
            Por que o Planejamento Tributário é o maior gerador de caixa imediato para uma empresa?
          </h2>
          <p style={{ fontSize: '16px', lineHeight: 1.7, color: '#404040', marginBottom: '18px' }}>
            A carga tributária brasileira é uma das mais complexas do planeta. Manter sua empresa no "piloto automático" pagando guias sem auditoria sistemática de alíquotas, créditos de PIS/COFINS, substituição tributária de ICMS e fator R é o caminho mais rápido para drenar a rentabilidade.
          </p>
          <p style={{ fontSize: '16px', lineHeight: 1.7, color: '#404040', margin: 0 }}>
            Liderado por <strong>Marcos Cancelier (CRC-PR 062232/O-1)</strong> e <strong>Mauricio Cielo (CRC-PR 082974/O-7)</strong>, nosso time não atua com aventuras jurídicas: aplicamos <strong>elisão fiscal 100% legal e respaldada na legislação</strong>, permitindo que os recursos economizados fiquem no seu caixa para reinvestimento.
          </p>
        </section>

        {/* Áreas de Atuação no Planejamento */}
        <section style={{ marginBottom: '56px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 28px 0', color: '#111', textAlign: 'center' }}>
            Nossas frentes de atuação em Planejamento Tributário
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {[
              {
                icon: <Scale size={28} color="#600000" />,
                title: 'Estudo Comparativo de Regimes',
                desc: 'Simulação matemática precisa entre Simples Nacional, Lucro Presumido e Lucro Real com base nas suas projeções de faturamento e despesas.',
              },
              {
                icon: <TrendingDown size={28} color="#600000" />,
                title: 'Segregação de Monofásicos & ST',
                desc: 'Para farmácias, autopeças, bebidas e cosméticos: não pague PIS, COFINS e ICMS duas vezes sobre produtos com tributação concentrada.',
              },
              {
                icon: <Sparkles size={28} color="#600000" />,
                title: 'Preparação para a Reforma Tributária',
                desc: 'Diagnóstico do impacto da transição para IBS (Estados/Municípios) e CBS (União), precificação e cadeia de fornecedores.',
              },
              {
                icon: <ShieldAlert size={28} color="#600000" />,
                title: 'Auditoria Eletrônica de SPED e NF-e',
                desc: 'Cruzamento preventivo de arquivos fiscais com os parâmetros da Receita Federal e SEFAZ-PR antes que qualquer autuação aconteça.',
              },
            ].map(col => (
              <div key={col.title} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '20px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>{col.icon}</div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#111' }}>{col.title}</h3>
                <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#525252', margin: 0 }}>{col.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Fases do Diagnóstico */}
        <section style={{ marginBottom: '56px', background: '#fafafa', border: '1px solid #eaeaea', borderRadius: '24px', padding: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 20px 0', color: '#111' }}>
            Como funciona a assessoria tributária da Privilege?
          </h2>
          <div style={{ display: 'grid', gap: '20px' }}>
            {[
              { step: '1', title: 'Coleta e Auditoria dos XMLs e SPED', desc: 'Analisamos as escriturações dos últimos 12 a 60 meses para identificar oportunidades e inconsistências fiscais.' },
              { step: '2', title: 'Relatório Executivo de Oportunidades', desc: 'Apresentamos em reunião quanto a empresa pode economizar mensalmente e quais ajustes contratuais ou societários são recomendados.' },
              { step: '3', title: 'Implementação Segura', desc: 'Alteração dos parâmetros fiscais no seu emissor/ERP, retificação de obrigações e acompanhamento contínuo.' },
              { step: '4', title: 'Monitoramento Contínuo', desc: 'Revisão semestral de rentabilidade fiscal acompanhando novas normas do Diário Oficial e jurisprudências do CARF e STF.' },
            ].map(st => (
              <div key={st.step} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <span style={{ background: '#600000', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                  {st.step}
                </span>
                <div>
                  <h4 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 4px 0', color: '#111' }}>{st.title}</h4>
                  <p style={{ fontSize: '15px', color: '#525252', margin: 0, lineHeight: 1.6 }}>{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ do Serviço */}
        <section style={{ marginBottom: '56px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 24px 0', color: '#111', textAlign: 'center' }}>
            Perguntas Frequentes sobre Planejamento Tributário
          </h2>
          <div style={{ display: 'grid', gap: '16px' }}>
            {[
              {
                q: 'O Simples Nacional é sempre a opção mais barata?',
                a: 'Não! Para muitas empresas com baixa folha salarial ou que comercializam produtos com margem reduzida, o Lucro Presumido ou Lucro Real podem proporcionar uma carga tributária total substancialmente menor.',
              },
              {
                q: 'Existe algum risco de autuação ao fazer planejamento tributário?',
                a: 'Nosso trabalho fundamenta-se estritamente na elisão fiscal legal (escolha da forma jurídica e contábil mais econômica amparada pela lei), jamais em sonegação (evasão). Todas as medidas contam com embasamento normativo expresso.',
              },
              {
                q: 'Quando deve ser feita a mudança de regime tributário?',
                a: 'A opção pelo regime tributário é formalizada em janeiro de cada ano fiscal. Por isso, os meses de outubro, novembro e dezembro são cruciais para simular os cenários e tomar a melhor decisão para o ano seguinte.',
              },
            ].map(f => (
              <div key={f.q} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '16px', padding: '24px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 8px 0', color: '#111' }}>{f.q}</h3>
                <p style={{ fontSize: '15px', color: '#525252', margin: 0, lineHeight: 1.65 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Final */}
        <section style={{ background: 'linear-gradient(135deg, #600000, #3b0000)', color: '#fff', borderRadius: '24px', padding: '48px 36px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 16px 0', color: '#fff' }}>
            Descubra quanto sua empresa pode economizar em tributos
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.85)', maxWidth: '640px', margin: '0 auto 32px' }}>
            Agende um diagnóstico preliminar com os especialistas Marcos Cancelier (CRC-PR 062232/O-1) e Mauricio Cielo (CRC-PR 082974/O-7). Avaliaremos o cenário tributário da sua empresa sem custo inicial.
          </p>
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#fff',
              color: '#600000',
              padding: '16px 36px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '16px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <MessageCircle size={20} /> Conversar com Especialista no WhatsApp
          </a>
        </section>
      </main>

      {/* Footer com NAP Text e Telefone Clicável */}
      <footer style={{ borderTop: '1px solid #e5e5e5', background: '#111', color: '#a3a3a3', padding: '36px 24px', fontSize: '13px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <strong style={{ color: '#fff' }}>Privilege Contabilidade e Consultoria</strong> · Privilege Consultoria Ltda (CNPJ 58.033.979/0001-84)<br />
            Rua Pará, 127, Sala 03 – Centro, Francisco Beltrão – PR, CEP 85601-290 · Telefone:{' '}
            <a href="tel:+554630351018" style={{ color: '#fff', textDecoration: 'none' }}>(46) 3035-1018</a> · E-mail:{' '}
            <a href="mailto:contato@privilegecontabilidade.cnt.br" style={{ color: '#a3a3a3', textDecoration: 'none' }}>contato@privilegecontabilidade.cnt.br</a>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <Link href="/" style={{ color: '#fff', textDecoration: 'none' }}>Início</Link>
            <Link href="/bpo-financeiro-francisco-beltrao" style={{ color: '#fff', textDecoration: 'none' }}>BPO Financeiro</Link>
            <Link href="/abertura-de-empresa-francisco-beltrao" style={{ color: '#fff', textDecoration: 'none' }}>Abertura de Empresa</Link>
            <Link href="/contabilidade-agronegocio" style={{ color: '#fff', textDecoration: 'none' }}>Agronegócio</Link>
            <Link href="/contato" style={{ color: '#fff', textDecoration: 'none' }}>Contato</Link>
            <Link href="/privacidade" style={{ color: '#fff', textDecoration: 'none' }}>Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
