import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, CheckCircle2, ChevronRight, Sprout, Tractor, Landmark, ShieldCheck, MessageCircle, Phone } from 'lucide-react';

const PAGE_TITLE = 'Contabilidade para Agronegócio e LCDPR';
const PAGE_DESC =
  'Contabilidade para o agronegócio e produtores rurais em Francisco Beltrão e Sudoeste do PR. Livro Caixa Digital (LCDPR), ITR, holding e sucessão rural.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  keywords: [
    'contabilidade agronegócio Francisco Beltrão',
    'LCDPR Paraná contador',
    'livro caixa produtor rural Francisco Beltrão',
    'holding rural planejamento sucessório agro',
    'ITR CCIR declaração produtor rural',
    'consultoria agropecuária sudoeste PR',
  ],
  alternates: {
    canonical: 'https://privilegecontabilidade.cnt.br/contabilidade-agronegocio',
  },
  openGraph: {
    title: `${PAGE_TITLE} | Privilege`,
    description: PAGE_DESC,
    url: 'https://privilegecontabilidade.cnt.br/contabilidade-agronegocio',
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
      '@id': 'https://privilegecontabilidade.cnt.br/contabilidade-agronegocio#service',
      name: 'Contabilidade para o Agronegócio e LCDPR',
      serviceType: 'Contabilidade Rural, LCDPR e Planejamento Sucessório no Campo',
      description: PAGE_DESC,
      url: 'https://privilegecontabilidade.cnt.br/contabilidade-agronegocio',
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
          name: 'Contabilidade para o Agronegócio (LCDPR)',
          item: 'https://privilegecontabilidade.cnt.br/contabilidade-agronegocio',
        },
      ],
    },
  ],
};

export default function ContabilidadeAgronegocioPage() {
  const whatsAppUrl = 'https://wa.me/554630351018?text=Ol%C3%A1!%20Gostaria%20de%20conversar%20sobre%20a%20contabilidade%20do%20agroneg%C3%B3cio%20e%20LCDPR.';

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
          <span style={{ color: '#600000', fontWeight: 600 }}>Contabilidade para o Agronegócio (LCDPR)</span>
        </div>
      </nav>

      {/* Hero do Serviço */}
      <main style={{ maxWidth: '1000px', width: '100%', margin: '0 auto', padding: '48px 24px 80px', flex: 1 }}>
        <div style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto 48px' }}>
          <span style={{ color: '#600000', fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'inline-block', marginBottom: '12px' }}>
            Agronegócio & Produtores Rurais
          </span>
          <h1 style={{ fontSize: '44px', lineHeight: 1.15, fontWeight: 800, margin: '0 0 20px 0', color: '#111' }}>
            Contabilidade Especializada no Agronegócio: Segurança Fiscal para o Produtor Rural no Paraná
          </h1>
          <p style={{ fontSize: '18px', lineHeight: 1.6, color: '#525252', margin: '0 0 32px 0' }}>
            Do Livro Caixa Digital do Produtor Rural (LCDPR) ao planejamento tributário e sucessório da família do campo. A Privilege Contabilidade alia tecnologia e rigor contábil para proteger suas terras e otimizar seus resultados na safra e pecuária.
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
              <MessageCircle size={20} /> Falar com Especialista Agro
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

        {/* O que muda no agro hoje */}
        <section style={{ marginBottom: '56px', background: '#fff', border: '1px solid #e5e5e5', borderRadius: '24px', padding: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 18px 0', color: '#111' }}>
            O agronegócio do Sudoeste do Paraná sob a mira da fiscalização eletrônica
          </h2>
          <p style={{ fontSize: '16px', lineHeight: 1.7, color: '#404040', marginBottom: '18px' }}>
            Francisco Beltrão e as cidades vizinhas são polos de alta produtividade em soja, milho, trigo, leite, suinocultura e avicultura. Contudo, a relação com o Fisco mudou drasticamente: o cruzamento de notas fiscais eletrônicas de produtor (NFP-e), movimentações bancárias (e-Financeira) e cooperativas tornou a fiscalização 100% automatizada.
          </p>
          <p style={{ fontSize: '16px', lineHeight: 1.7, color: '#404040', margin: 0 }}>
            Uma simples inconsistência no <strong>LCDPR (Livro Caixa Digital do Produtor Rural)</strong> ou na apuração do Imposto de Renda da Atividade Rural pode gerar glosa de despesas, multas de 75% e desenquadramento da alíquota presumida de 20%. Nossa equipe atua preventivamente para blindar o produtor.
          </p>
        </section>

        {/* Pilares do Serviço Agro */}
        <section style={{ marginBottom: '56px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 28px 0', color: '#111', textAlign: 'center' }}>
            Soluções completas para produtores e agroindústrias
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {[
              {
                icon: <Tractor size={28} color="#600000" />,
                title: 'LCDPR com Rigor Técnico',
                desc: 'Escrituração e conferência detalhada de todas as entradas, saídas, investimentos em máquinas, defensivos e insumos com geração e entrega do arquivo validado à Receita Federal.',
              },
              {
                icon: <Landmark size={28} color="#600000" />,
                title: 'Pessoa Física vs Pessoa Jurídica',
                desc: 'Estudo tributário para avaliar se a exploração rural deve continuar no CPF do produtor, em condomínio/parceria rural ou através de uma PJ agropecuária.',
              },
              {
                icon: <ShieldCheck size={28} color="#600000" />,
                title: 'Holding Rural & Sucessão Familiar',
                desc: 'Estruturação societária para preservar o patrimônio da família contra inventários caros e conflitos futuros, garantindo a continuidade das operações no campo.',
              },
              {
                icon: <Sprout size={28} color="#600000" />,
                title: 'Obrigações Cadastrais (ITR, CCIR, CAR)',
                desc: 'Emissão e entrega tempestiva da DITR com base no Valor da Terra Nua (VTN) oficial, atualização do CCIR no INCRA e regularidade fiscal plena.',
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

        {/* Benefícios para o Produtor */}
        <section style={{ marginBottom: '56px', background: '#fafafa', border: '1px solid #eaeaea', borderRadius: '24px', padding: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 20px 0', color: '#111' }}>
            Vantagens diretas para sua propriedade rural:
          </h2>
          <div style={{ display: 'grid', gap: '16px' }}>
            {[
              { title: 'Aproveitamento Máximo das Deduções', desc: 'Classificação correta de investimentos em silos, tratores, adubação e benfeitorias para abater da base de cálculo do Imposto de Renda.' },
              { title: 'Acesso Facilitado ao Crédito Rural', desc: 'Balanço e relatórios financeiros estruturados para apresentar ao Banco do Brasil, Sicredi, Sicoob e Cresol, facilitando liberações do Plano Safra.' },
              { title: 'Mitigação de Riscos de Malha Fina', desc: 'Conciliação entre o que as cooperativas informam à Receita e as receitas declaradas pelo produtor rural.' },
              { title: 'Planejamento Tributário na Venda de Imóveis Rurais', desc: 'Cálculo estratégico do Ganho de Capital com base no Valor da Terra Nua (VTN) para minimizar o imposto sobre alienações de terras.' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <CheckCircle2 size={20} color="#600000" style={{ marginTop: '3px', flexShrink: 0 }} />
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 2px 0', color: '#111' }}>{item.title}</h4>
                  <p style={{ fontSize: '14.5px', color: '#525252', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ do Serviço */}
        <section style={{ marginBottom: '56px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 24px 0', color: '#111', textAlign: 'center' }}>
            Perguntas Frequentes sobre Contabilidade Agro
          </h2>
          <div style={{ display: 'grid', gap: '16px' }}>
            {[
              {
                q: 'Quem é obrigado a entregar o LCDPR?',
                a: 'O Livro Caixa Digital do Produtor Rural é obrigatório para todo produtor rural que obtiver receita bruta total da atividade rural igual ou superior a R$ 4,8 milhões no ano-calendário, devendo ser entregue assinado digitalmente com certificado ICP-Brasil.',
              },
              {
                q: 'Produtor rural com receita abaixo de R$ 4,8 milhões precisa de livro caixa?',
                a: 'Sim! Embora a entrega eletrônica do arquivo LCDPR só seja obrigatória a partir desse teto, todo produtor que apura o imposto pelo resultado real da atividade rural deve manter a escrituração do livro caixa físico/digital para comprovar suas despesas à Receita Federal.',
              },
              {
                q: 'Como funciona a tributação pelo lucro presumido rural de 20%?',
                a: 'A legislação permite ao produtor tributar 20% da sua receita bruta com base no arbitramento simplificado. No entanto, em anos de safra com alto custo de insumos, a apuração pelo resultado real (receita menos despesas reais) frequentemente gera imposto zero ou muito menor.',
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
            Traga a contabilidade da sua fazenda para a Privilege
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.85)', maxWidth: '640px', margin: '0 auto 32px' }}>
            Agende uma reunião conosco em Francisco Beltrão ou solicite um atendimento presencial na sua propriedade. Cuidamos do fiscal para você focar na produtividade.
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
            <MessageCircle size={20} /> Falar com Consultor Agro no WhatsApp
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
            <Link href="/planejamento-tributario" style={{ color: '#fff', textDecoration: 'none' }}>Planejamento Tributário</Link>
            <Link href="/abertura-de-empresa-francisco-beltrao" style={{ color: '#fff', textDecoration: 'none' }}>Abertura de Empresa</Link>
            <Link href="/contato" style={{ color: '#fff', textDecoration: 'none' }}>Contato</Link>
            <Link href="/privacidade" style={{ color: '#fff', textDecoration: 'none' }}>Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
