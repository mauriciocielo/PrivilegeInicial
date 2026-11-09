import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, CheckCircle2, ChevronRight, Building2, FileCheck, Zap, Award, MessageCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Abertura de Empresa em Francisco Beltrão · Abra seu CNPJ com Agilidade',
  description:
    'Abra sua empresa em Francisco Beltrão com a Privilege Contabilidade. Processo rápido na JUCEPAR e Prefeitura, escolha inteligente de CNAEs para pagar menos impostos e suporte consultivo completo.',
  keywords: [
    'abertura de empresa Francisco Beltrão',
    'como abrir CNPJ Francisco Beltrão PR',
    'abrir empresa JUCEPAR Francisco Beltrão',
    'contador para abrir empresa Beltrão',
    'abertura de microempresa SLU LTDA',
    'alvará Francisco Beltrão contabilidade',
  ],
  alternates: {
    canonical: 'https://privilegecontabilidade.cnt.br/abertura-de-empresa-francisco-beltrao',
  },
  openGraph: {
    title: 'Abertura de Empresa em Francisco Beltrão · Privilege Contabilidade',
    description: 'Comece seu negócio com o pé direito: CNPJ emitido com rapidez e planejamento tributário inicial.',
    url: 'https://privilegecontabilidade.cnt.br/abertura-de-empresa-francisco-beltrao',
  },
};

export default function AberturaEmpresaPage() {
  const whatsAppUrl = 'https://wa.me/554630351018?text=Ol%C3%A1!%20Quero%20abrir%20minha%20empresa%20em%20Francisco%20Beltr%C3%A3o%20e%20gostaria%20de%20orienta%C3%A7%C3%A3o.';

  return (
    <div style={{ background: '#fdfdfd', color: '#171717', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header Institucional */}
      <header style={{ borderBottom: '1px solid #e5e5e5', background: '#fff', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <Image src="/privilege-logo-colorida.svg" alt="Privilege Contabilidade e Consultoria" width={170} height={42} priority />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
          <span style={{ color: '#525252' }}>Abertura e Societário</span>
          <ChevronRight size={14} />
          <span style={{ color: '#600000', fontWeight: 600 }}>Abertura de Empresa em Francisco Beltrão</span>
        </div>
      </nav>

      {/* Hero do Serviço */}
      <main style={{ maxWidth: '1000px', width: '100%', margin: '0 auto', padding: '48px 24px 80px', flex: 1 }}>
        <div style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto 48px' }}>
          <span style={{ color: '#600000', fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'inline-block', marginBottom: '12px' }}>
            Legalização Societária & Novos Negócios
          </span>
          <h1 style={{ fontSize: '44px', lineHeight: 1.15, fontWeight: 800, margin: '0 0 20px 0', color: '#111' }}>
            Abertura de Empresa em Francisco Beltrão: Do Contrato ao CNPJ Ativo sem Complicações
          </h1>
          <p style={{ fontSize: '18px', lineHeight: 1.6, color: '#525252', margin: '0 0 32px 0' }}>
            Empreender exige foco e velocidade. A Privilege cuida de toda a burocracia na Junta Comercial (JUCEPAR), Receita Federal e Prefeitura de Francisco Beltrão. Mais do que emitir um CNPJ, planejamos a melhor estrutura tributária para o seu negócio pagar menos imposto desde o primeiro dia.
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
              <MessageCircle size={20} /> Iniciar Abertura de Empresa
            </a>
          </div>
        </div>

        {/* Importância de abrir com quem entende */}
        <section style={{ marginBottom: '56px', background: '#fff', border: '1px solid #e5e5e5', borderRadius: '24px', padding: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 18px 0', color: '#111' }}>
            Por que abrir sua empresa com a Privilege Contabilidade?
          </h2>
          <p style={{ fontSize: '16px', lineHeight: 1.7, color: '#404040', marginBottom: '18px' }}>
            Muitos empreendedores cometem o erro grave de escolher o código de atividade (CNAE) de forma genérica ou definir o formato societário sem proteção patrimonial. Esse erro simples pode forçar sua empresa a pagar 15% ou mais de imposto quando poderia estar tributando a 4% ou 6% no Anexo correto do Simples Nacional.
          </p>
          <p style={{ fontSize: '16px', lineHeight: 1.7, color: '#404040', margin: 0 }}>
            Na Privilege, a abertura não é um mero trâmite cartorial. Realizamos um <strong>estudo prévio de viabilidade</strong> com você para definir se o melhor modelo é uma <strong>SLU (Sociedade Limitada Unipessoal)</strong>, uma <strong>Sociedade LTDA</strong> com sócios, ou até uma estrutura holding, blindando seu patrimônio pessoal.
          </p>
        </section>

        {/* Pilares da Abertura */}
        <section style={{ marginBottom: '56px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 28px 0', color: '#111', textAlign: 'center' }}>
            O que entregamos no processo de abertura em Francisco Beltrão
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {[
              {
                icon: <Building2 size={28} color="#600000" />,
                title: 'Contrato Social Personalizado',
                desc: 'Minuta contratual elaborada sob medida com regras claras de deliberação societária, saída de sócios e proteção patrimonial.',
              },
              {
                icon: <Zap size={28} color="#600000" />,
                title: 'Tramitação Expressa na JUCEPAR',
                desc: 'Protocolo eletrônico com assinatura digital via certificado ou gov.br, garantindo deferimento em poucos dias úteis.',
              },
              {
                icon: <FileCheck size={28} color="#600000" />,
                title: 'Alvará & Inscrição Municipal',
                desc: 'Consulta prévia de viabilidade de endereço em Francisco Beltrão, licenciamento sanitário, bombeiros e emissão do alvará.',
              },
              {
                icon: <Award size={28} color="#600000" />,
                title: 'Certificado Digital & Emissor Fiscal',
                desc: 'Suporte para emissão do e-CNPJ e parametrização do software de emissão de NF-e e NFS-e para começar a faturar imediatamente.',
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

        {/* Passo a Passo */}
        <section style={{ marginBottom: '56px', background: '#fafafa', border: '1px solid #eaeaea', borderRadius: '24px', padding: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 20px 0', color: '#111' }}>
            Passo a passo para abrir sua empresa em Francisco Beltrão:
          </h2>
          <div style={{ display: 'grid', gap: '20px' }}>
            {[
              { step: '1', title: 'Alinhamento Inicial & Viabilidade', desc: 'Definimos atividades (CNAEs), nome empresarial, capital social e endereço. Fazemos a consulta de viabilidade prévia no Município de Francisco Beltrão.' },
              { step: '2', title: 'Elaboração e Assinatura dos Documentos', desc: 'Redigimos o Contrato Social e colhemos as assinaturas digitais com total segurança e comodidade.' },
              { step: '3', title: 'Registro na JUCEPAR e Emissão do CNPJ', desc: 'Protocolamos o registro na Junta Comercial do Paraná e geramos o CNPJ ativo junto à Receita Federal.' },
              { step: '4', title: 'Inscrições Fiscais e Licenças', desc: 'Liberamos a Inscrição Estadual (SEFAZ-PR para comércio/indústria) e Inscrição Municipal para prestadores de serviços.' },
              { step: '5', title: 'Início das Operações & Emissão de Notas', desc: 'Configuramos seu sistema de faturamento e orientamos sobre as rotinas contábeis, pró-labore e tributação.' },
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
            Dúvidas Frequentes sobre Abertura de Empresa
          </h2>
          <div style={{ display: 'grid', gap: '16px' }}>
            {[
              {
                q: 'Quanto tempo leva para abrir uma empresa em Francisco Beltrão?',
                a: 'Graças ao sistema Empresa Fácil do Paraná e à tramitação eletrônica, a maioria das empresas de baixo risco obtém seu CNPJ e alvará entre 3 e 7 dias úteis após a entrega dos documentos.',
              },
              {
                q: 'Posso abrir uma empresa sem sócio?',
                a: 'Sim! A SLU (Sociedade Limitada Unipessoal) permite abrir uma empresa com 100% de titularidade individual, sem exigência de capital social mínimo elevado e garantindo total proteção entre os bens pessoais e os bens da empresa.',
              },
              {
                q: 'O que é melhor: MEI ou Microempresa (ME)?',
                a: 'O MEI é vantajoso pelo custo fixo, mas tem limite de faturamento anual restrito (R$ 81 mil) e veda diversas profissões regulamentadas. Se você planeja crescer, contratar mais de um colaborador ou atuar em atividades intelectuais, a ME já no Simples Nacional é o caminho mais seguro.',
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
            Tire sua ideia do papel com suporte contábil de excelência
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.85)', maxWidth: '640px', margin: '0 auto 32px' }}>
            Fale conosco hoje mesmo. Avaliaremos sua atividade econômica e traçaremos o caminho mais ágil e econômico para formalizar sua empresa em Francisco Beltrão.
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
            <MessageCircle size={20} /> Iniciar Abertura no WhatsApp
          </a>
        </section>
      </main>

      {/* Footer com NAP Text */}
      <footer style={{ borderTop: '1px solid #e5e5e5', background: '#111', color: '#a3a3a3', padding: '36px 24px', fontSize: '13px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <strong style={{ color: '#fff' }}>Privilege Contabilidade e Consultoria</strong> · Privilege Consultoria Ltda (CNPJ 58.033.979/0001-84)<br />
            Rua Pará, 127, Sala 03 – Centro, Francisco Beltrão – PR, CEP 85601-290 · Telefone: (46) 3035-1018 · E-mail: contato@privilegecontabilidade.cnt.br
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link href="/" style={{ color: '#fff', textDecoration: 'none' }}>Início</Link>
            <Link href="/bpo-financeiro-francisco-beltrao" style={{ color: '#fff', textDecoration: 'none' }}>BPO Financeiro</Link>
            <Link href="/planejamento-tributario" style={{ color: '#fff', textDecoration: 'none' }}>Planejamento Tributário</Link>
            <Link href="/contabilidade-agronegocio" style={{ color: '#fff', textDecoration: 'none' }}>Agronegócio</Link>
            <Link href="/privacidade" style={{ color: '#fff', textDecoration: 'none' }}>Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

