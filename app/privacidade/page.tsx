import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ShieldCheck, Mail, MapPin, Phone } from 'lucide-react';

const PAGE_TITLE = 'Política de Privacidade (LGPD)';
const PAGE_DESC =
  'Política de Privacidade e Proteção de Dados da Privilege Consultoria Ltda (CNPJ 58.033.979/0001-84) em Francisco Beltrão/PR, conforme a LGPD.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  alternates: {
    canonical: 'https://privilegecontabilidade.cnt.br/privacidade',
  },
  openGraph: {
    title: `${PAGE_TITLE} | Privilege`,
    description: PAGE_DESC,
    url: 'https://privilegecontabilidade.cnt.br/privacidade',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Privilege Contabilidade e Consultoria' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PAGE_TITLE} | Privilege`,
    description: PAGE_DESC,
    images: ['/og-image.png'],
  },
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
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
      name: 'Política de Privacidade (LGPD)',
      item: 'https://privilegecontabilidade.cnt.br/privacidade',
    },
  ],
};

export default function PrivacidadePage() {
  return (
    <div style={{ background: '#fdfdfd', color: '#171717', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Header Institucional */}
      <header style={{ borderBottom: '1px solid #e5e5e5', background: '#fff', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
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
            <Link
              href="/login"
              style={{
                background: '#600000',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              Área do Cliente
            </Link>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main style={{ maxWidth: '860px', width: '100%', margin: '0 auto', padding: '48px 24px 80px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#600000', marginBottom: '12px' }}>
          <ShieldCheck size={24} />
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Transparência & Conformidade Regulatória
          </span>
        </div>

        <h1 style={{ fontSize: '38px', lineHeight: 1.2, fontWeight: 800, margin: '0 0 12px 0', color: '#111' }}>
          Política de Privacidade e Proteção de Dados (LGPD)
        </h1>
        <p style={{ color: '#737373', fontSize: '14px', marginBottom: '36px' }}>
          Última atualização: 21 de outubro de 2026 · Versão 2.1
        </p>

        <div style={{ background: '#fafafa', border: '1px solid #eaeaea', borderRadius: '16px', padding: '24px', marginBottom: '36px', fontSize: '14.5px', lineHeight: 1.7, color: '#333' }}>
          <p style={{ margin: 0 }}>
            A <strong>PRIVILEGE CONSULTORIA LTDA</strong>, pessoa jurídica de direito privado, inscrita no <strong>CNPJ sob o nº 58.033.979/0001-84</strong>, com sede na Rua Pará, nº 127, Sala 03, Centro, CEP 85601-290, no município de <strong>Francisco Beltrão, Estado do Paraná</strong> (doravante denominada <strong>"PRIVILEGE"</strong>), reafirma seu compromisso com a privacidade, transparência, segurança da informação e a proteção dos dados pessoais tratados no contexto de suas soluções tecnológicas, sistemas web, rotinas contábeis, BPO financeiro e assessoria de gestão.
          </p>
        </div>

        <article style={{ display: 'grid', gap: '28px', fontSize: '15px', lineHeight: 1.75, color: '#262626' }}>
          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', margin: '0 0 10px 0' }}>
              1. Definições Técnicas e Papéis sob a LGPD
            </h2>
            <p>
              Para a perfeita interpretação deste instrumento, aplicam-se as definições previstas no art. 5º da <strong>Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 – LGPD)</strong>:
            </p>
            <ul style={{ paddingLeft: '22px', display: 'grid', gap: '8px', marginTop: '10px' }}>
              <li><strong>Dado Pessoal:</strong> Informação relacionada a pessoa natural identificada ou identificável;</li>
              <li><strong>Titular:</strong> Pessoa física a quem se referem os dados pessoais objeto de tratamento;</li>
              <li><strong>Controlador:</strong> Pessoa física ou jurídica a quem competem as decisões sobre o tratamento de dados pessoais. No relacionamento B2B, a empresa cliente atua prevalentemente como Controladora dos dados de seus colaboradores, parceiros e fornecedores;</li>
              <li><strong>Operador:</strong> Pessoa que realiza o tratamento de dados pessoais em nome do Controlador. A PRIVILEGE atua como Operadora no processamento de folha de pagamento, escrituração fiscal e BPO financeiro delegados por seus clientes; e como Controladora dos dados de cadastro direto de seus contratantes;</li>
              <li><strong>Encarregado (DPO):</strong> Pessoa indicada para atuar como canal de comunicação entre o controlador, os titulares dos dados e a Autoridade Nacional de Proteção de Dados (ANPD).</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', margin: '0 0 10px 0' }}>
              2. Dados Coletados e Bases Legais de Tratamento
            </h2>
            <p>
              A coleta de dados restringe-se ao estritamente necessário para o cumprimento das obrigações contratuais e regulatórias (art. 7º da LGPD):
            </p>
            <ul style={{ paddingLeft: '22px', display: 'grid', gap: '10px', marginTop: '10px' }}>
              <li><strong>Identificação e Contato:</strong> Nome completo, CPF, RG, e-mail institucional, telefone, cargo e dados societários. <em>Finalidade:</em> Autenticação segura, formalização contratual e suporte. <em>Base Legal:</em> Execução de Contrato (Art. 7º, V).</li>
              <li><strong>Dados Financeiros e Contábeis:</strong> Contas bancárias, chaves PIX, extratos OFX/PDF, notas fiscais (NF-e, NFS-e, CT-e) e livros caixa. <em>Finalidade:</em> BPO financeiro, conciliação, apuração de impostos e DRE. <em>Base Legal:</em> Execução de Contrato e Cumprimento de Obrigação Legal (Art. 7º, II).</li>
              <li><strong>Dados Trabalhistas e Previdenciários:</strong> Remuneração, pró-labore, dependentes, CTPS digital e dados de eSocial. <em>Finalidade:</em> Processamento da folha e recolhimento de encargos (FGTS, INSS, IRRF). <em>Base Legal:</em> Cumprimento de Obrigação Legal (Art. 7º, II).</li>
              <li><strong>Registros de Conexão e Acesso:</strong> Endereço IP, data, hora, porta lógica e logs de auditoria. <em>Finalidade:</em> Rastreabilidade e prevenção a fraudes cibernéticas. <em>Base Legal:</em> Art. 15 da Lei nº 12.965/2014 (Marco Civil da Internet).</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', margin: '0 0 10px 0' }}>
              3. Processamento Estruturado e Inteligência Computacional
            </h2>
            <p>
              A PRIVILEGE utiliza rotinas automatizadas de classificação fiscal, inteligência tributária e conciliação de arquivos SPED e XMLs. Esclarecemos que:
            </p>
            <ul style={{ paddingLeft: '22px', display: 'grid', gap: '8px', marginTop: '10px' }}>
              <li>Nenhum dado financeiro ou fiscal é comercializado ou compartilhado para fins de publicidade comportamental;</li>
              <li>Toda e qualquer apuração tributária sensível ou decisão contábil estratégica permanece sob a <strong>supervisão direta e validação de contadores legalmente habilitados com registro ativo no Conselho Regional de Contabilidade do Paraná (CRC-PR 062232/O-1 e CRC-PR 082974/O-7)</strong>.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', margin: '0 0 10px 0' }}>
              4. Medidas de Segurança da Informação
            </h2>
            <p>
              Adotamos elevados padrões de segurança para mitigar qualquer risco de acesso não autorizado, destruição ou vazamento (art. 46 da LGPD):
            </p>
            <ul style={{ paddingLeft: '22px', display: 'grid', gap: '8px', marginTop: '10px' }}>
              <li>Criptografia de ponta a ponta em trânsito com <strong>protocolo TLS 1.3 / HTTPS</strong> e criptografia de repouso (AES-256);</li>
              <li>Controle de acesso baseado em funções (RBAC) segundo o Princípio do Menor Privilégio;</li>
              <li>Trilhas imutáveis de auditoria registrando operador, data, hora e natureza de cada operação;</li>
              <li>Cópias de segurança periódicas com redundância geográfica e plano estruturado de recuperação de desastres.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', margin: '0 0 10px 0' }}>
              5. Prazos de Retenção e Descarte
            </h2>
            <p>
              Os dados são conservados pelo prazo indispensável para as finalidades do tratamento e para a guarda legal obrigatória:
            </p>
            <ul style={{ paddingLeft: '22px', display: 'grid', gap: '8px', marginTop: '10px' }}>
              <li><strong>5 anos:</strong> Documentos e escriturações fiscais (art. 173 do Código Tributário Nacional);</li>
              <li><strong>30 anos:</strong> Documentação comprobatória de FGTS e encargos previdenciários de folha de pagamento;</li>
              <li><strong>6 meses:</strong> Logs de conexão de aplicações de internet (Marco Civil da Internet).</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', margin: '0 0 10px 0' }}>
              6. Direitos dos Titulares de Dados (Art. 18 da LGPD)
            </h2>
            <p>
              O titular de dados tem o direito de obter da PRIVILEGE, a qualquer momento e mediante requisição formal: confirmação da existência de tratamento, acesso aos dados, correção de informações incompletas ou desatualizadas, anonimização ou eliminação de dados excessivos e portabilidade.
            </p>
          </section>

          <section style={{ background: '#f5f5f7', border: '1px solid #e5e5e5', borderRadius: '16px', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111', margin: '0 0 12px 0' }}>
              7. Canal do Encarregado de Proteção de Dados (DPO)
            </h2>
            <p style={{ margin: '0 0 14px 0', fontSize: '14px' }}>
              Para solicitações, dúvidas ou exercício dos seus direitos sob a LGPD, entre em contato diretamente com o nosso Encarregado de Dados:
            </p>
            <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={16} color="#600000" />
                <span>
                  <strong>E-mail do DPO:</strong>{' '}
                  <a href="mailto:contato@privilegecontabilidade.cnt.br" style={{ color: '#600000', textDecoration: 'none' }}>
                    contato@privilegecontabilidade.cnt.br
                  </a>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={16} color="#600000" />
                <span>
                  <strong>Telefone / WhatsApp:</strong>{' '}
                  <a href="tel:+554630351018" style={{ color: '#600000', textDecoration: 'none' }}>
                    (46) 3035-1018
                  </a>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} color="#600000" />
                <span><strong>Endereço:</strong> Rua Pará, 127, Sala 03, Centro, Francisco Beltrão – PR, CEP 85601-290</span>
              </div>
            </div>
          </section>
        </article>
      </main>

      {/* Footer com NAP Text e Telefone Clicável */}
      <footer style={{ borderTop: '1px solid #e5e5e5', background: '#111', color: '#a3a3a3', padding: '36px 24px', fontSize: '13px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <strong style={{ color: '#fff' }}>Privilege Contabilidade e Consultoria</strong> · Privilege Consultoria Ltda (CNPJ 58.033.979/0001-84)<br />
            Rua Pará, 127, Sala 03 – Centro, Francisco Beltrão – PR, CEP 85601-290 · Telefone:{' '}
            <a href="tel:+554630351018" style={{ color: '#fff', textDecoration: 'none' }}>(46) 3035-1018</a>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link href="/" style={{ color: '#fff', textDecoration: 'none' }}>Início</Link>
            <Link href="/contato" style={{ color: '#fff', textDecoration: 'none' }}>Contato</Link>
            <Link href="/termos" style={{ color: '#fff', textDecoration: 'none' }}>Termos de Uso</Link>
            <Link href="/login" style={{ color: '#fff', textDecoration: 'none' }}>Área do Cliente</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
