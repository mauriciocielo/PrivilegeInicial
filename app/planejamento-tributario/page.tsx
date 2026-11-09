import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  ChevronRight,
  TrendingDown,
  Scale,
  ShieldAlert,
  Sparkles,
  MessageCircle,
  Phone,
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  ArrowRight,
  FileText,
} from 'lucide-react';

const PAGE_TITLE = 'Planejamento Tributário e Gestão Fiscal';
const PAGE_DESC =
  'Guia completo de Planejamento Tributário: Simples Nacional, Lucro Presumido, Lucro Real e Reforma Tributária em Francisco Beltrão, PR.';

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
    'elisão fiscal contabilidade',
  ],
  alternates: {
    canonical: 'https://privilegecontabilidade.cnt.br/planejamento-tributario',
  },
  openGraph: {
    type: 'article',
    title: `${PAGE_TITLE} | Privilege`,
    description: PAGE_DESC,
    url: 'https://privilegecontabilidade.cnt.br/planejamento-tributario',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Planejamento Tributário — Privilege Contabilidade' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PAGE_TITLE} | Privilege`,
    description: PAGE_DESC,
    images: ['/og-image.png'],
  },
};

const pageJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      '@id': 'https://privilegecontabilidade.cnt.br/planejamento-tributario#article',
      headline: 'Planejamento Tributário no Paraná: Guia Prático para Reduzir Impostos com Segurança Jurídica',
      description: PAGE_DESC,
      image: 'https://privilegecontabilidade.cnt.br/og-image.png',
      datePublished: '2026-10-15T08:00:00-03:00',
      dateModified: '2026-11-09T10:00:00-03:00',
      author: [
        {
          '@type': 'Person',
          name: 'Marcos Cancelier',
          identifier: 'CRC-PR 062232/O-1',
          jobTitle: 'Contador e Consultor Tributário',
          image: 'https://privilegecontabilidade.cnt.br/foto-marcos.jpg',
        },
        {
          '@type': 'Person',
          name: 'Mauricio Cielo',
          identifier: 'CRC-PR 082974/O-7',
          jobTitle: 'Contador e Especialista em Inteligência Financeira',
          image: 'https://privilegecontabilidade.cnt.br/foto-mauricio.jpg',
        },
      ],
      publisher: {
        '@id': 'https://privilegecontabilidade.cnt.br/#organization',
      },
      mainEntityOfPage: 'https://privilegecontabilidade.cnt.br/planejamento-tributario',
    },
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
  const whatsAppUrl =
    'https://wa.me/554630351018?text=Ol%C3%A1!%20Li%20o%20artigo%20sobre%20Planejamento%20Tribut%C3%A1rio%20no%20site%20e%20gostaria%20de%20conversar%20com%20um%20especialista.';

  return (
    <div style={{ background: '#f8f8fa', color: '#171717', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
      />

      {/* Header Público Editorial (Acesso 100% Livre, sem necessidade de login) */}
      <header style={{ borderBottom: '1px solid #e5e5e5', background: '#fff', position: 'sticky', top: 0, zIndex: 50 }}>
        <div
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Image src="/privilege-logo-colorida.svg" alt="Privilege Contabilidade e Consultoria" width={165} height={40} priority />
            </Link>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#600000',
                background: 'rgba(96,0,0,0.08)',
                padding: '5px 12px',
                borderRadius: '99px',
              }}
            >
              Blog & Guias Técnicos
            </span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link href="/" style={{ color: '#525252', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
              Início
            </Link>
            <Link href="/bpo-financeiro-francisco-beltrao" style={{ color: '#525252', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
              BPO Financeiro
            </Link>
            <Link href="/abertura-de-empresa-francisco-beltrao" style={{ color: '#525252', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
              Abrir Empresa
            </Link>
            <Link href="/contabilidade-agronegocio" style={{ color: '#525252', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
              Agronegócio
            </Link>
            <Link href="/contato" style={{ color: '#525252', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
              Contato
            </Link>
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#600000',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '13.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <MessageCircle size={15} /> Falar com Contador
            </a>
          </nav>
        </div>
      </header>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ background: '#fff', borderBottom: '1px solid #ececec', padding: '10px 24px', fontSize: '13px' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#737373', flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: '#525252', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <ArrowLeft size={13} /> Página Inicial
          </Link>
          <ChevronRight size={14} />
          <span>Artigos e Guias</span>
          <ChevronRight size={14} />
          <span style={{ color: '#600000', fontWeight: 600 }}>Planejamento Tributário e Gestão Fiscal</span>
        </div>
      </nav>

      {/* Layout de Blog / Artigo Editorial */}
      <main
        style={{
          maxWidth: '1120px',
          width: '100%',
          margin: '0 auto',
          padding: '44px 24px 80px',
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: '40px',
        }}
      >
        <article
          style={{
            background: '#fff',
            borderRadius: '24px',
            border: '1px solid #e5e5e5',
            padding: 'clamp(24px, 5vw, 56px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          }}
        >
          {/* Cabeçalho do Artigo */}
          <header style={{ borderBottom: '1px solid #efefef', paddingBottom: '32px', marginBottom: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '16px', fontSize: '13px', color: '#666' }}>
              <span
                style={{
                  background: '#600000',
                  color: '#fff',
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Guia Tributário 2026
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Calendar size={14} color="#600000" /> Atualizado em Novembro de 2026
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={14} color="#600000" /> Leitura de 6 min
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <BookOpen size={14} color="#600000" /> Conteúdo Aberto
              </span>
            </div>

            <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', lineHeight: 1.18, fontWeight: 800, margin: '0 0 10px 0', color: '#111' }}>
              Planejamento Tributário em Francisco Beltrão e no Paraná
            </h1>

            <p style={{ fontSize: '21px', fontWeight: 600, lineHeight: 1.4, color: '#600000', margin: '0 0 16px 0' }}>
              Como pagar apenas o imposto justo e blindar sua empresa com segurança jurídica.
            </p>

            <p style={{ fontSize: '18px', lineHeight: 1.65, color: '#4b5563', margin: '0 0 28px 0' }}>
              Entenda como funciona o estudo entre Simples Nacional, Lucro Presumido e Lucro Real, como recuperar impostos pagos a maior em produtos monofásicos e ICMS-ST, e o que muda na prática com a Reforma Tributária (IBS e CBS).
            </p>

            {/* Autores do Artigo */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '20px',
                background: '#fafafa',
                border: '1px solid #ececec',
                borderRadius: '16px',
                padding: '16px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #fff', position: 'relative' }}>
                    <Image src="/foto-marcos.jpg" alt="Marcos Cancelier — Contador CRC-PR 062232/O-1" width={48} height={48} sizes="48px" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }} />
                  </div>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #fff', position: 'relative', marginLeft: '-12px' }}>
                    <Image src="/foto-mauricio.jpg" alt="Mauricio Cielo — Contador CRC-PR 082974/O-7" width={48} height={48} sizes="48px" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111' }}>
                    Por Marcos Cancelier (CRC-PR 062232/O-1) & Mauricio Cielo (CRC-PR 082974/O-7)
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#666' }}>
                    Sócios e Responsáveis Técnicos da Privilege Contabilidade e Consultoria · Francisco Beltrão/PR
                  </div>
                </div>
              </div>

              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#600000',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                Tirar dúvida sobre o artigo <ArrowRight size={14} />
              </a>
            </div>
          </header>

          {/* Sumário / Índice do Artigo */}
          <nav
            aria-label="Índice do artigo"
            style={{
              background: '#fcfafa',
              borderLeft: '4px solid #600000',
              borderRadius: '0 16px 16px 0',
              padding: '22px 26px',
              marginBottom: '40px',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#600000', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} /> Neste artigo você vai ler:
            </div>
            <ol style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '8px', fontSize: '15px', color: '#333' }}>
              <li><a href="#o-que-e" style={{ color: '#1f2937', textDecoration: 'none', fontWeight: 500 }}>O que é Planejamento Tributário (Elisão Fiscal) e por que ele gera caixa imediato</a></li>
              <li><a href="#comparativo-regimes" style={{ color: '#1f2937', textDecoration: 'none', fontWeight: 500 }}>Simples Nacional, Lucro Presumido ou Lucro Real: qual escolhe menos imposto?</a></li>
              <li><a href="#oportunidades-pr" style={{ color: '#1f2937', textDecoration: 'none', fontWeight: 500 }}>4 oportunidades fiscais que empresas do Paraná costumam deixar na mesa</a></li>
              <li><a href="#reforma-tributaria" style={{ color: '#1f2937', textDecoration: 'none', fontWeight: 500 }}>Como se preparar para a Reforma Tributária (IBS e CBS) sem perder margem</a></li>
              <li><a href="#passo-a-passo" style={{ color: '#1f2937', textDecoration: 'none', fontWeight: 500 }}>Passo a passo de uma revisão tributária segura</a></li>
              <li><a href="#faq" style={{ color: '#1f2937', textDecoration: 'none', fontWeight: 500 }}>Perguntas frequentes sobre revisão e mudança de regime</a></li>
            </ol>
          </nav>

          {/* Corpo Editorial do Blog */}
          <div style={{ fontSize: '16.5px', lineHeight: 1.8, color: '#262626', display: 'grid', gap: '36px' }}>
            <section id="o-que-e">
              <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#111', margin: '0 0 16px 0' }}>
                1. O que é Planejamento Tributário e por que ele é o maior gerador de caixa imediato?
              </h2>
              <p style={{ margin: '0 0 16px 0' }}>
                A legislação tributária brasileira possui milhares de normas federais, estaduais e municipais que sofrem alterações constantes. Quando uma empresa opera no <em>“piloto automático”</em> — apenas emitindo notas e pagando a guia do imposto no fim do mês —, a probabilidade de estar recolhendo tributos acima do devido é altíssima.
              </p>
              <p style={{ margin: '0 0 16px 0' }}>
                O <strong>Planejamento Tributário (ou elisão fiscal)</strong> é o estudo técnico, preventivo e 100% amparado na lei que analisa a operação real da empresa (faturamento, margem de lucro, folha de pagamento, compras interestaduais e NCMs dos produtos) para identificar a estrutura fiscal mais econômica.
              </p>
              <div style={{ background: '#f5f5f7', borderRadius: '14px', padding: '20px 24px', fontSize: '15px', color: '#333' }}>
                <strong>Importante diferenciar:</strong> Enquanto a <em>evasão fiscal</em> oculta fatos geradores (o que é ilegal), a <strong>elisão fiscal</strong> utiliza as próprias opções, incentivos, créditos e regimes previstos no Código Tributário Nacional, na Receita Federal e na SEFAZ-PR para reduzir legalmente o desembolso de impostos.
              </div>
            </section>

            <section id="comparativo-regimes">
              <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#111', margin: '0 0 16px 0' }}>
                2. Simples Nacional, Lucro Presumido ou Lucro Real: qual é o melhor regime?
              </h2>
              <p style={{ margin: '0 0 20px 0' }}>
                Um dos mitos mais caros do mercado empresarial é acreditar que o <strong>Simples Nacional</strong> é sempre o regime mais barato. Dependendo da faixa de faturamento, da folha salarial e da possibilidade de tomada de créditos de ICMS, PIS e COFINS, permanecer no Simples pode custar caro. Veja o comparativo prático:
              </p>

              <div style={{ overflowX: 'auto', border: '1px solid #e5e5e5', borderRadius: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#111', color: '#fff' }}>
                      <th style={{ padding: '14px 18px' }}>Critério</th>
                      <th style={{ padding: '14px 18px' }}>Simples Nacional</th>
                      <th style={{ padding: '14px 18px' }}>Lucro Presumido</th>
                      <th style={{ padding: '14px 18px' }}>Lucro Real</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #eaeaea' }}>
                      <td style={{ padding: '14px 18px', fontWeight: 700 }}>Limite de Faturamento</td>
                      <td style={{ padding: '14px 18px' }}>Até R$ 4,8 milhões/ano (sublimite estadual ICMS/ISS em R$ 3,6 mi)</td>
                      <td style={{ padding: '14px 18px' }}>Até R$ 78 milhões/ano</td>
                      <td style={{ padding: '14px 18px' }}>Sem limite (obrigatório acima de R$ 78 milhões)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #eaeaea', background: '#fafafa' }}>
                      <td style={{ padding: '14px 18px', fontWeight: 700 }}>Base de Cálculo</td>
                      <td style={{ padding: '14px 18px' }}>Alíquota progressiva sobre a receita bruta acumulada em 12 meses</td>
                      <td style={{ padding: '14px 18px' }}>Margem de lucro prefixada pela lei (ex: 8% comércio, 32% serviços)</td>
                      <td style={{ padding: '14px 18px' }}>Lucro contábil efetivo apurado após todas as despesas dedutíveis</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #eaeaea' }}>
                      <td style={{ padding: '14px 18px', fontWeight: 700 }}>Crédito de PIS/COFINS e ICMS</td>
                      <td style={{ padding: '14px 18px' }}>Muito restrito (não aproveita créditos de insumos e energia)</td>
                      <td style={{ padding: '14px 18px' }}>Permite crédito normal de ICMS; PIS/COFINS cumulativo (3,65%)</td>
                      <td style={{ padding: '14px 18px' }}>Aproveitamento amplo de créditos de ICMS e PIS/COFINS não-cumulativo</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '14px 18px', fontWeight: 700 }}>Para quem costuma ser ideal</td>
                      <td style={{ padding: '14px 18px' }}>Comércios e serviços iniciais com folha de pagamento relevante</td>
                      <td style={{ padding: '14px 18px' }}>Empresas com margens de lucro altas e folha salarial enxuta</td>
                      <td style={{ padding: '14px 18px' }}>Indústrias, transportadoras, postos, supermercados e margens baixas</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section id="oportunidades-pr">
              <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#111', margin: '0 0 20px 0' }}>
                3. Quatro oportunidades fiscais que empresas do Paraná costumam perder
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                {[
                  {
                    icon: <TrendingDown size={26} color="#600000" />,
                    title: 'Segregação de Produtos Monofásicos e ICMS-ST',
                    desc: 'Farmácias, mercados, autopeças, distribuidoras de bebidas, postos de combustíveis e lojas de cosméticos no Simples Nacional frequentemente pagam PIS/COFINS e ICMS duas vezes por falta de segregação correta no cadastro de NCM.',
                  },
                  {
                    icon: <Scale size={26} color="#600000" />,
                    title: 'Fator R para Prestadores de Serviços',
                    desc: 'Clínicas médicas, engenheiros, arquitetos, empresas de TI e representantes comerciais podem cair do Anexo V (15,5%) para o Anexo III (6%) quando a folha de pagamento e pró-labore atingem 28% do faturamento.',
                  },
                  {
                    icon: <ShieldAlert size={26} color="#600000" />,
                    title: 'Auditoria Preventiva de SPED vs. XMLs',
                    desc: 'A SEFAZ-PR e a Receita Federal cruzam automaticamente todas as NF-es emitidas contra o CNPJ da sua empresa com o SPED Fiscal e EFD-Contribuições. Auditar essas divergências evita multas pesadas.',
                  },
                  {
                    icon: <Sparkles size={26} color="#600000" />,
                    title: 'Benefícios Estaduais e Créditos no Lucro Real',
                    desc: 'Aproveitamento técnico de créditos sobre insumos industriais, fretes, embalagens, energia elétrica e depreciação de máquinas conforme entendimento atualizado da Receita e do STJ.',
                  },
                ].map(item => (
                  <div key={item.title} style={{ background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '18px', padding: '26px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>{item.icon}</div>
                    <h3 style={{ fontSize: '18.5px', fontWeight: 700, margin: 0, color: '#111' }}>{item.title}</h3>
                    <p style={{ fontSize: '14.5px', lineHeight: 1.65, color: '#4b5563', margin: 0 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="reforma-tributaria">
              <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#111', margin: '0 0 16px 0' }}>
                4. Reforma Tributária (IBS e CBS): O que sua empresa precisa fazer agora?
              </h2>
              <p style={{ margin: '0 0 16px 0' }}>
                A transição do sistema tributário brasileiro com a chegada da <strong>CBS (Contribuição sobre Bens e Serviços)</strong> e do <strong>IBS (Imposto sobre Bens e Serviços)</strong> transforma profundamente a formação de preços e a escolha de fornecedores.
              </p>
              <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none', display: 'grid', gap: '12px' }}>
                {[
                  'Não-cumulatividade plena: o crédito financeiro passa a depender do efetivo pagamento do imposto na etapa anterior (Split Payment).',
                  'Fornecedores no Simples Nacional: será necessário avaliar se seus fornecedores optarão por recolher IBS/CBS por fora do DAS para transferir crédito integral à sua empresa.',
                  'Revisão de contratos de médio e longo prazo: cláusulas de repasse tributário e precificação precisam ser ajustadas antes de cada virada de alíquota.',
                ].map(point => (
                  <li key={point} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '15.5px' }}>
                    <CheckCircle2 size={20} color="#600000" style={{ flexShrink: 0, marginTop: '4px' }} />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section id="passo-a-passo" style={{ background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '20px', padding: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#111', margin: '0 0 20px 0' }}>
                5. Como funciona o Diagnóstico Tributário da Privilege na prática?
              </h2>
              <div style={{ display: 'grid', gap: '18px' }}>
                {[
                  { step: '1', title: 'Levantamento Digital (Sem Burocracia)', desc: 'Importamos os arquivos XMLs, SPEDs e balancetes dos últimos 12 a 60 meses para nossa ferramenta de auditoria fiscal.' },
                  { step: '2', title: 'Simulação dos 3 Regimes + Revisão de NCM', desc: 'Calculamos centavo por centavo quanto sua empresa pagaria no Simples Nacional, no Lucro Presumido e no Lucro Real.' },
                  { step: '3', title: 'Apresentação do Parecer Executivo', desc: 'Reunião direta com os sócios Marcos Cancelier e Mauricio Cielo demonstrando o potencial de economia mensal e eventual recuperação administrativa.' },
                  { step: '4', title: 'Parametrização no ERP e Acompanhamento', desc: 'Ajustamos as regras fiscais junto ao seu sistema emissor para que cada nota fiscal já saia com a tributação correta.' },
                ].map(st => (
                  <div key={st.step} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <span style={{ background: '#600000', color: '#fff', width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                      {st.step}
                    </span>
                    <div>
                      <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 4px 0', color: '#111' }}>{st.title}</h3>
                      <p style={{ fontSize: '15px', color: '#525252', margin: 0, lineHeight: 1.6 }}>{st.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Perguntas Frequentes */}
            <section id="faq">
              <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#111', margin: '0 0 20px 0' }}>
                6. Perguntas Frequentes sobre Planejamento Tributário
              </h2>
              <div style={{ display: 'grid', gap: '16px' }}>
                {[
                  {
                    q: 'Qualquer empresa pode fazer um estudo de Planejamento Tributário?',
                    a: 'Sim. Desde micro e pequenas empresas no Simples Nacional que desejam validar o Fator R ou segregar produtos monofásicos, até médias e grandes empresas no Lucro Presumido ou Lucro Real.',
                  },
                  {
                    q: 'Existe risco de fiscalização ao recuperar créditos tributários?',
                    a: 'Quando a revisão é feita administrativamente com base nos próprios arquivos XMLs e na legislação pacificada da Receita Federal (como a restituição de PIS/COFINS monofásico no Simples Nacional), o procedimento é padrão, eletrônico e 100% seguro.',
                  },
                  {
                    q: 'Qual é o melhor mês do ano para planejar a mudança de regime tributário?',
                    a: 'A opção definitiva pelo regime tributário ocorre em janeiro, mas o estudo ideal deve ser feito entre setembro e dezembro para que a empresa já inicie o ano-calendário seguinte no enquadramento mais econômico.',
                  },
                ].map(f => (
                  <div key={f.q} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '16px', padding: '22px' }}>
                    <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 8px 0', color: '#111' }}>{f.q}</h3>
                    <p style={{ fontSize: '15px', color: '#525252', margin: 0, lineHeight: 1.65 }}>{f.a}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Box de Conversão Final */}
          <div
            style={{
              marginTop: '48px',
              background: 'linear-gradient(135deg, #600000, #3b0000)',
              color: '#fff',
              borderRadius: '20px',
              padding: '40px 32px',
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 12px 0', color: '#fff' }}>
              Quer saber se sua empresa está pagando imposto a mais?
            </h2>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.88)', maxWidth: '620px', margin: '0 auto 28px', lineHeight: 1.6 }}>
              Converse diretamente com os contadores Marcos Cancelier (CRC-PR 062232/O-1) e Mauricio Cielo (CRC-PR 082974/O-7) e solicite uma análise tributária preliminar para o seu CNPJ.
            </p>
            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#fff',
                  color: '#600000',
                  padding: '14px 28px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '15.5px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <MessageCircle size={19} /> Solicitar Análise pelo WhatsApp
              </a>
              <a
                href="tel:+554630351018"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.35)',
                  padding: '14px 24px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '15.5px',
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
        </article>

        {/* Outros Artigos e Guias Relacionados */}
        <section>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111', margin: '0 0 20px 0' }}>
            Continue lendo: outros guias da Privilege Contabilidade
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {[
              {
                title: 'BPO Financeiro em Francisco Beltrão: Como funciona a terceirização do financeiro',
                href: '/bpo-financeiro-francisco-beltrao',
                tag: 'Gestão Financeira',
              },
              {
                title: 'Como abrir uma empresa em Francisco Beltrão passo a passo e sem erros de CNPJ',
                href: '/abertura-de-empresa-francisco-beltrao',
                tag: 'Societário & Abertura',
              },
              {
                title: 'Contabilidade para Agronegócio e LCDPR: Guia para o produtor rural do Sudoeste do PR',
                href: '/contabilidade-agronegocio',
                tag: 'Agronegócio & LCDPR',
              },
            ].map(card => (
              <Link
                key={card.href}
                href={card.href}
                style={{
                  background: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: '18px',
                  padding: '24px',
                  textDecoration: 'none',
                  color: '#111',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                }}
              >
                <div>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#600000', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {card.tag}
                  </span>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '8px 0 0 0', lineHeight: 1.4, color: '#111' }}>
                    {card.title}
                  </h3>
                </div>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#600000', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  Ler guia completo <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {/* Footer com NAP Text e Telefone Clicável */}
      <footer style={{ borderTop: '1px solid #e5e5e5', background: '#111', color: '#a3a3a3', padding: '36px 24px', fontSize: '13px' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
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
