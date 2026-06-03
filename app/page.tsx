'use client';
import { useEffect, useRef, useState } from 'react';
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
      { threshold: 0.08 }
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [activeService, setActiveService] = useState<any | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeLegal, setActiveLegal] = useState<string | null>(null);

  useEffect(() => {
    // Load Curator.io widget script dynamically on mount
    const i = document.createElement("script");
    i.async = true;
    i.charset = "UTF-8";
    i.src = "https://cdn.curator.io/published/9c0e78bd-730c-4bf1-b269-f5fd13afae90.js";
    const e = document.getElementsByTagName("script")[0];
    if (e && e.parentNode) {
      e.parentNode.insertBefore(i, e);
    } else {
      document.body.appendChild(i);
    }
  }, []);

  const handleOpenService = (service: any) => {
    setActiveService(service);
    setSelectedService(service);
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const renderServiceIcon = (iconName: string, customColor?: string) => {
    const strokeColor = customColor || "#8c1a22";
    const svgProps: React.SVGProps<SVGSVGElement> = {
      width: "24",
      height: "24",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: strokeColor,
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { transition: 'transform 0.3s ease' }
    };
    switch (iconName) {
      case 'abertura':
        return (
          <svg {...svgProps}>
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
            <line x1="9" y1="22" x2="9" y2="16"></line>
            <line x1="15" y1="22" x2="15" y2="16"></line>
            <line x1="9" y1="16" x2="15" y2="16"></line>
          </svg>
        );
      case 'fiscal':
        return (
          <svg {...svgProps}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        );
      case 'pessoal':
        return (
          <svg {...svgProps}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        );
      case 'contabilidade':
        return (
          <svg {...svgProps}>
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
        );
      case 'irpf':
        return (
          <svg {...svgProps}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        );
      case 'certificacao':
        return (
          <svg {...svgProps}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        );
      case 'gestao':
        return (
          <svg {...svgProps}>
            <path d="M2 20h20M5 17V5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v12"></path>
          </svg>
        );
      case 'gerencial':
        return (
          <svg {...svgProps}>
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
          </svg>
        );
      case 'tributaria':
        return (
          <svg {...svgProps}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
        );
      case 'financeira':
        return (
          <svg {...svgProps}>
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        );
      default:
        return <span>💼</span>;
    }
  };

  const renderStatIcon = (iconName: string) => {
    const svgProps: React.SVGProps<SVGSVGElement> = {
      width: "36",
      height: "36",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#8c1a22",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { margin: '0 auto 14px', display: 'block' }
    };
    switch (iconName) {
      case 'empresas':
        return (
          <svg {...svgProps}>
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
            <line x1="9" y1="22" x2="9" y2="16"></line>
            <line x1="15" y1="22" x2="15" y2="16"></line>
            <line x1="9" y1="16" x2="15" y2="16"></line>
          </svg>
        );
      case 'faturamento':
        return (
          <svg {...svgProps}>
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        );
      case 'retencao':
        return (
          <svg {...svgProps}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        );
      case 'historico':
        return (
          <svg {...svgProps}>
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
            <path d="M12 7v5l4 2"></path>
          </svg>
        );
      default:
        return <span>🏆</span>;
    }
  };

  const renderMvvIcon = (iconName: string) => {
    const svgProps: React.SVGProps<SVGSVGElement> = {
      width: "40",
      height: "40",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#c7a75c",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { marginBottom: '20px' }
    };
    switch (iconName) {
      case 'missao':
        return (
          <svg {...svgProps}>
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="6"></circle>
            <circle cx="12" cy="12" r="2"></circle>
          </svg>
        );
      case 'visao':
        return (
          <svg {...svgProps}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        );
      case 'valores':
        return (
          <svg {...svgProps}>
            <polygon points="6 3 18 3 22 8 12 21 2 8 6 3"></polygon>
            <line x1="12" y1="21" x2="6" y2="3"></line>
            <line x1="12" y1="21" x2="18" y2="3"></line>
            <line x1="2" y1="8" x2="22" y2="8"></line>
          </svg>
        );
      default:
        return <span>🎯</span>;
    }
  };

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#faf9f6', color: '#8c1a22' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <div style={{ fontWeight: 700, letterSpacing: '4px', fontFamily: "'Outfit', sans-serif", fontSize: '11px', textTransform: 'uppercase', color: '#8c1a22', opacity: 0.9 }}>Portal Privilege</div>
        </div>
        <style>{`
          .spinner {
            width: 48px;
            height: 48px;
            border: 2px solid rgba(140, 26, 34, 0.08);
            border-radius: 50%;
            border-top-color: #8c1a22;
            margin: 0 auto 20px;
            animation: spin 0.8s cubic-bezier(.5,0,.5,1) infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const services = [
    {
      icon: 'abertura',
      title: 'Abertura e Legalização de Empresas',
      desc: 'Constituição de novas empresas, filiais e regularização cadastral ágil em órgãos governamentais.',
      category: 'Rotinas Operacionais e Conformidade (Compliance)',
      tagline: 'O deploy inicial da sua operação.',
      fullDesc: 'Estruturamos o seu contrato social, executamos o registro nos órgãos competentes e garantimos a emissão de todos os alvarás com zero bugs legais. O setup do seu CNPJ nasce com a arquitetura tributária e societária correta, pronto para rodar em total compliance com a legislação.'
    },
    {
      icon: 'fiscal',
      title: 'Escrituração Fiscal',
      desc: 'Apuração e cálculo de tributos federais, estaduais e municipais, além da entrega de obrigações acessórias.',
      category: 'Rotinas Operacionais e Conformidade (Compliance)',
      tagline: 'O processamento em tempo real da sua carga tributária.',
      fullDesc: 'Capturamos e validamos o log de todas as suas notas fiscais de entrada e saída. Apuramos impostos com precisão algorítmica, eliminando redundâncias e protegendo o seu banco de dados fiscal contra multas e autuações do fisco.'
    },
    {
      icon: 'pessoal',
      title: 'Folha de Pagamento',
      desc: 'Processamento de holerites, eSocial, cálculo de provisões e gerenciamento de obrigações trabalhistas.',
      category: 'Rotinas Operacionais e Conformidade (Compliance)',
      tagline: 'A automação mensal do seu capital humano.',
      fullDesc: 'Realizamos o processamento completo de salários, pró-labores, férias, rescisões e encargos (eSocial). Garantimos que todas as variáveis trabalhistas e obrigações sindicais sejam executadas no prazo, mitigando completamente o risco de passivos na justiça do trabalho.'
    },
    {
      icon: 'contabilidade',
      title: 'Contabilidade',
      desc: 'Elaboração de balanços patrimoniais, DRE e relatórios indispensáveis para a gestão analítica do seu negócio.',
      category: 'Rotinas Operacionais e Conformidade (Compliance)',
      tagline: 'O código-fonte da saúde do seu negócio.',
      fullDesc: 'Traduzimos todas as movimentações diárias em demonstrações contábeis exatas. Fornecemos relatórios como Balanço Patrimonial e DRE, funcionando como um dashboard de alta precisão para que você visualize seus ativos e passivos de forma transparente e auditável.'
    },
    {
      icon: 'irpf',
      title: 'Imposto de Renda Pessoa Física',
      desc: 'Planejamento e preenchimento de declarações de Imposto de Renda de forma segura para otimizar seus tributos.',
      category: 'Rotinas Operacionais e Conformidade (Compliance)',
      tagline: 'A compilação definitiva da sua evolução patrimonial.',
      fullDesc: 'Executamos uma varredura rigorosa nos seus rendimentos, ganhos de capital e despesas dedutíveis. Estruturamos a declaração com cruzamento de dados prévio para transmissão à Receita Federal, blindando seu CPF contra inconsistências e malhas finas.'
    },
    {
      icon: 'certificacao',
      title: 'Certificação Digital',
      desc: 'Assessoria na emissão de certificados digitais e-CNPJ e e-CPF para assinatura eletrônica de documentos legais.',
      category: 'Rotinas Operacionais e Conformidade (Compliance)',
      tagline: 'A sua chave de criptografia para validação de transações no ambiente de negócios.',
      fullDesc: 'Emitimos seu e-CPF ou e-CNPJ de forma ágil, garantindo a autenticidade das suas assinaturas eletrônicas e o acesso seguro aos sistemas governamentais, com proteção total da integridade dos seus dados.'
    },
    {
      icon: 'gestao',
      title: 'Consultoria de Gestão',
      desc: 'Modelagem de rotinas administrativas e estruturação de controles para aumentar a produtividade operacional.',
      category: 'Consultoria e Inteligência de Negócios (Business Intelligence)',
      tagline: 'O upgrade do seu modelo operacional.',
      fullDesc: 'Mapeamos os processos internos da sua empresa para identificar gargalos e redundâncias. Entregamos um plano de ação focado em eficiência, reduzindo custos invisíveis e escalando a performance do seu negócio de forma sustentável e previsível.'
    },
    {
      icon: 'gerencial',
      title: 'Consultoria Gerencial',
      desc: 'Apoio na tomada de decisões estratégicas por meio de análise de indicadores e relatórios gerenciais estruturados.',
      category: 'Consultoria e Inteligência de Negócios (Business Intelligence)',
      tagline: 'A infraestrutura estratégica para sua tomada de decisão.',
      fullDesc: 'Parametrizamos indicadores-chave de desempenho (KPIs) específicos para o seu nicho. Transformamos dados brutos em inteligência corporativa, permitindo que a liderança conduza a empresa com uma visão orientada a dados (data-driven).'
    },
    {
      icon: 'tributaria',
      title: 'Consultoria Tributária',
      desc: 'Estudo para enquadramento fiscal adequado e planejamento tributário com o objetivo de mitigar custos de impostos.',
      category: 'Consultoria e Inteligência de Negócios (Business Intelligence)',
      tagline: 'A refatoração inteligente da sua carga de impostos.',
      fullDesc: 'Realizamos um estudo profundo sobre o seu regime de tributação (Simples Nacional, Lucro Presumido ou Lucro Real). Executamos estratégias de elisão fiscal dentro das normativas legais para otimizar o fluxo de caixa e maximizar o bottom line (lucro líquido).'
    },
    {
      icon: 'financeira',
      title: 'Consultoria Financeira',
      desc: 'Orientação especializada em controle de fluxo de caixa, orçamento, investimentos e análise de viabilidade.',
      category: 'Consultoria e Inteligência de Negócios (Business Intelligence)',
      tagline: 'A auditoria preditiva e otimização do seu fluxo de capital.',
      fullDesc: 'Estruturamos o seu capital de giro, revisamos a precificação de produtos/serviços e analisamos a viabilidade de investimentos. Blindamos o seu caixa contra oscilações de mercado e garantimos que a operation gere um Retorno sobre o Investimento (ROI) validado.'
    }
  ];

  const legalDocs: Record<string, { title: string; subtitle: string; content: React.ReactNode }> = {
    termos: {
      title: 'Termos de Uso',
      subtitle: 'Diretrizes legais e de funcionamento do site',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#5a4c4e', fontSize: '15px', lineHeight: '1.8' }}>
          <p style={{ fontWeight: 600, color: '#150608' }}>
            Este documento estabelece as diretrizes legais e de funcionamento para a utilização do site da Privilege Contabilidade e Consultoria, nome fantasia da pessoa jurídica MARCOS CANCELIER ASSESSORIA CONTABIL - ME, devidamente inscrita no CNPJ sob o nº 29.679.048/0001-50, com sede operacional na Rua Pará, 127, Sala 103 – Centro, Francisco Beltrão, PR – CEP 85601-290.
          </p>
          <p>
            <strong>Bem-vindo ao nosso ambiente digital.</strong><br />
            Ao acessar e utilizar nosso site, você concorda com a nossa arquitetura de regras. Nosso objetivo é garantir uma navegação segura, auditável e transparente.
          </p>
          <p>
            <strong>Uso do Site:</strong> O conteúdo disponibilizado em nossas páginas, incluindo artigos, textos explicativos e respostas a dúvidas frequentes (FAQ), possui caráter informativo. Eles não substituem uma consultoria contábil, tributária ou financeira executada sob medida para o banco de dados do seu CNPJ ou CPF.
          </p>
          <p>
            <strong>Propriedade Intelectual:</strong> Todos os textos, logotipos, scripts e identidades visuais presentes neste site pertencem exclusivamente à Privilege Contabilidade e Consultoria. Fica estritamente proibida a cópia, reprodução ou distribuição do nosso código e conteúdo sem autorização prévia documentada.
          </p>
          <p>
            <strong>Links de Terceiros:</strong> Nosso site pode conter rotas (links) para sistemas governamentais (como o portal e-CAC da Receita Federal) ou plataformas de integração parceiras. Não assumimos responsabilidade pelo uptime (tempo no ar) ou pelas políticas de privacidade dessas infraestruturas externas.
          </p>
          <p>
            <strong>Atualizações de Versão:</strong> Assim como as normativas fiscais, estes termos podem sofrer atualizações ou refatorações periódicas. O uso contínuo da plataforma implica na aceitação das novas versões.
          </p>
        </div>
      )
    },
    privacidade: {
      title: 'Política de Privacidade',
      subtitle: 'Diretrizes de privacidade e segurança da informação',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#5a4c4e', fontSize: '15px', lineHeight: '1.8' }}>
          <p style={{ fontWeight: 600, color: '#150608' }}>
            Este documento estabelece as diretrizes de privacidade e segurança da informação para o site da Privilege Contabilidade e Consultoria, nome fantasia da pessoa jurídica MARCOS CANCELIER ASSESSORIA CONTABIL - ME, devidamente inscrita no CNPJ sob o nº 29.679.048/0001-50, com sede operacional na Rua Pará, 127, Sala 103 – Centro, Francisco Beltrão, PR – CEP 85601-290.
          </p>
          <p>
            <strong>A proteção dos seus dados é o nosso principal ativo.</strong><br />
            No nosso escritório, o processamento das informações que transitam pelo nosso site opera com a mesma criptografia e sigilo exigidos em auditorias de balanços e demonstrações financeiras.
          </p>
          <p>
            <strong>Quais dados processamos (Inputs):</strong> Quando você preenche nosso formulário de contato ou inicia um protocolo via WhatsApp, armazenamos strings básicas como seu nome, e-mail, telefone e, caso fornecido, o faturamento estimado ou nicho da sua operação.
          </p>
          <p>
            <strong>Como executamos seus dados (Outputs):</strong> As informações capturadas têm a finalidade exclusiva de permitir que nossa equipe processe o seu atendimento, envie propostas comerciais solicitadas e forneça o suporte inicial. Sob nenhuma hipótese seu banco de dados será vendido, alugado ou compartilhado com terceiros para fins não autorizados.
          </p>
          <p>
            <strong>Gerenciamento de Cookies:</strong> Nossa interface utiliza cookies (pequenos arquivos de sessão) para monitorar o tráfego e otimizar o tempo de carregamento das páginas. Você tem total autonomia para limpar esse cache ou bloquear a execução de cookies nas configurações do seu navegador de internet.
          </p>
          <p>
            <strong>Protocolos de Segurança:</strong> Toda a nossa infraestrutura web utiliza o protocolo SSL (HTTPS) para garantir que o payload (dados enviados) dos formulários chegue aos nossos servidores criptografado e imune a interceptações.
          </p>
        </div>
      )
    },
    lgpd: {
      title: 'Conformidade com a LGPD',
      subtitle: 'Lei Geral de Proteção de Dados (Lei nº 13.709/2018)',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#5a4c4e', fontSize: '15px', lineHeight: '1.8' }}>
          <p style={{ fontWeight: 600, color: '#150608' }}>
            Este documento detalha o compliance com a proteção de dados na utilização do site da Privilege Contabilidade e Consultoria, nome fantasia da pessoa jurídica MARCOS CANCELIER ASSESSORIA CONTABIL - ME, devidamente inscrita no CNPJ sob o nº 29.679.048/0001-50, com sede operacional na Rua Pará, 127, Sala 103 – Centro, Francisco Beltrão, PR – CEP 85601-290.
          </p>
          <p>
            <strong>Seus direitos garantidos por lei.</strong><br />
            Nosso escritório opera com 100% de compliance à Lei nº 13.709/2018 (LGPD). A seguir, documentamos os processos para que você mantenha a governança sobre suas informações pessoais.
          </p>
          <p>
            <strong>Transparência e Finalidade:</strong> Toda query (busca ou tratamento) de dados realizada por nós possui lastro legal, seja para a execução de um contrato de prestação de serviços, para o cumprimento de obrigações acessórias perante o fisco, ou mediante o seu consentimento explícito.
          </p>
          <p>
            <strong>Controle do Titular (Artigo 18 da LGPD):</strong> Você possui autoridade para abrir um chamado a qualquer momento solicitando:
            <ul style={{ paddingLeft: '20px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>A confirmação da existência de processamento dos seus dados;</li>
              <li>A extração (export) integral dos dados que mantemos em nossa base;</li>
              <li>A atualização ou correção de registros (cadastros desatualizados ou com erro de digitação);</li>
              <li>O delete (exclusão) de dados desnecessários, exceto naqueles casos em que a retenção seja obrigatória por exigências tributárias, previdenciárias e fiscais.</li>
            </ul>
          </p>
          <p>
            <strong>Canal de Comunicação (DPO):</strong> Para acionar qualquer um desses direitos ou reportar bugs na gestão de privacidade, envie uma requisição formalizada para o nosso Encarregado de Dados pelo e-mail oficial: <a href="mailto:contato@privilegecontabilidade.com.br" style={{ color: '#8c1a22', fontWeight: 600, textDecoration: 'none' }}>contato@privilegecontabilidade.com.br</a>.
          </p>
        </div>
      )
    }
  };

  return (
    <div className="landing-page" style={{ backgroundColor: '#faf9f6', color: '#2a1f20', minHeight: '100vh', fontFamily: "'Inter', sans-serif", overflowX: 'hidden' }}>

      {/* ── Google Fonts and Master Stylesheet ── */}
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

        /* Floating Capsule Header */
        .floating-header {
          position: fixed;
          top: 24px;
          left: 50%;
          transform: translateX(-50%);
          width: 90%;
          max-width: 1200px;
          height: 72px;
          background: rgba(250, 249, 246, 0.85);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(199, 167, 92, 0.22);
          border-radius: 100px;
          padding: 0 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 1000;
          box-shadow: 0 10px 40px rgba(107, 16, 22, 0.04);
          transition: all 0.3s ease;
        }
        .floating-header.scrolled {
          top: 12px;
          box-shadow: 0 15px 45px rgba(107, 16, 22, 0.08);
          border-color: rgba(199, 167, 92, 0.35);
        }

        .nav-link {
          text-decoration: none;
          color: #5a4c4e;
          font-weight: 600;
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
          background: #8c1a22;
          transform: scaleX(0);
          transition: transform 0.3s cubic-bezier(.16,1,.3,1);
          border-radius: 2px;
        }
        .nav-link:hover { color: #8c1a22; }
        .nav-link:hover::after { transform: scaleX(1); }

        /* Premium Buttons */
        .btn-gold {
          background: linear-gradient(135deg, #c7a75c 0%, #a88a44 100%);
          color: #fff !important;
          border: 1px solid rgba(199, 167, 92, 0.4);
          box-shadow: 0 4px 18px rgba(168, 138, 68, 0.25);
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
          box-shadow: 0 10px 25px rgba(168, 138, 68, 0.4);
          filter: brightness(1.05);
        }

        .btn-wine {
          background: linear-gradient(135deg, #8c1a22 0%, #52080d 100%);
          color: #fff !important;
          border: 1px solid rgba(140, 26, 34, 0.2);
          box-shadow: 0 4px 18px rgba(140, 26, 34, 0.2);
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
          box-shadow: 0 12px 28px rgba(140, 26, 34, 0.35);
          border-color: #c7a75c;
        }

        .btn-outline-wine {
          border: 1px solid rgba(140, 26, 34, 0.5);
          color: #8c1a22 !important;
          background: rgba(140, 26, 34, 0.03);
          transition: all 0.4s cubic-bezier(.16,1,.3,1);
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .btn-outline-wine:hover {
          background: rgba(140, 26, 34, 0.08);
          border-color: #8c1a22;
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(140, 26, 34, 0.12);
        }

        /* Morphing Fluid Blobs */
        .blob-bg {
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(199, 167, 92, 0.14) 0%, rgba(140, 26, 34, 0.04) 70%, transparent 100%);
          filter: blur(40px);
          animation: morphBlob 16s ease-in-out infinite alternate;
          z-index: 1;
        }
        .blob-bg-2 {
          position: absolute;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(140, 26, 34, 0.09) 0%, rgba(199, 167, 92, 0.03) 75%, transparent 100%);
          filter: blur(30px);
          animation: morphBlob2 20s ease-in-out infinite alternate;
          z-index: 1;
        }
        @keyframes morphBlob {
          0% { border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%; transform: translate(0, 0) scale(1); }
          50% { border-radius: 70% 30% 52% 48% / 60% 40% 60% 40%; transform: translate(60px, -40px) scale(1.1); }
          100% { border-radius: 50% 50% 30% 70% / 40% 60% 40% 60%; transform: translate(-30px, 50px) scale(0.9); }
        }
        @keyframes morphBlob2 {
          0% { border-radius: 50% 50% 30% 70% / 40% 60% 40% 60%; transform: translate(0, 0) scale(1); }
          50% { border-radius: 35% 65% 55% 45% / 45% 55% 45% 55%; transform: translate(-80px, 40px) scale(1.15); }
          100% { border-radius: 65% 35% 70% 30% / 55% 35% 65% 45%; transform: translate(40px, -60px) scale(0.95); }
        }

        .hero-grid {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(140, 26, 34, 0.02) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(140, 26, 34, 0.02) 1px, transparent 1px);
          background-size: 60px 60px;
          background-position: center;
          z-index: 2;
          transform: perspective(600px) rotateX(62deg) translateY(-100px);
          mask-image: linear-gradient(to bottom, transparent, rgba(0,0,0,0.65) 50%, transparent);
          opacity: 0.7;
          animation: gridMove 28s linear infinite;
        }
        @keyframes gridMove {
          0% { background-position: 0 0; }
          100% { background-position: 0 120px; }
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(140, 26, 34, 0.05);
          color: #8c1a22;
          padding: 8px 20px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 2px;
          border: 1px solid rgba(140, 26, 34, 0.15);
          font-family: 'Outfit', sans-serif;
          backdrop-filter: blur(4px);
        }

        /* Light Premium Cards with Dynamic Hover */
        .premium-card {
          background: #ffffff;
          border: 1px solid rgba(199, 167, 92, 0.15);
          border-radius: 28px;
          padding: 44px 40px;
          box-shadow: 0 8px 28px rgba(107, 16, 22, 0.01);
          transition: all 0.5s cubic-bezier(.16,1,.3,1);
          position: relative;
          overflow: hidden;
        }
        .premium-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(199, 167, 92, 0.06) 0%, transparent 60%);
          opacity: 0;
          transition: opacity 0.5s ease;
          z-index: 1;
        }
        .premium-card:hover {
          transform: translateY(-8px) scale(1.01);
          border-color: #c7a75c;
          box-shadow: 0 25px 50px rgba(168, 138, 68, 0.14);
        }
        .premium-card:hover::before {
          opacity: 1;
        }

        .service-icon {
          width: 58px; height: 58px;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(140, 26, 34, 0.06), rgba(199, 167, 92, 0.04));
          border: 1px solid rgba(199, 167, 92, 0.28);
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; margin-bottom: 28px;
          box-shadow: 0 4px 12px rgba(168, 138, 68, 0.06);
          transition: transform 0.3s ease;
        }
        .premium-card:hover .service-icon {
          transform: scale(1.1) rotate(5deg);
        }

        /* Premium Outline Gold Button */
        .btn-outline-gold {
          border: 1px solid rgba(199, 167, 92, 0.6);
          color: #c7a75c !important;
          background: rgba(199, 167, 92, 0.05);
          transition: all 0.4s cubic-bezier(.16,1,.3,1);
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
        }
        .btn-outline-gold:hover {
          background: rgba(199, 167, 92, 0.15);
          border-color: #c7a75c;
          color: #ffffff !important;
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 10px 25px rgba(168, 138, 68, 0.35);
        }

        /* Stats Cards */
        .stat-item {
          text-align: center;
          flex: 1;
          min-width: 220px;
          padding: 48px 32px;
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 10px 30px rgba(21, 6, 8, 0.02);
          border: 1px solid rgba(199, 167, 92, 0.16);
          transition: all 0.5s cubic-bezier(.16, 1, .3, 1);
          position: relative;
        }
        .stat-item:hover {
          transform: translateY(-8px);
          border-color: #c7a75c;
          background: #ffffff;
          box-shadow: 0 20px 45px rgba(168, 138, 68, 0.14);
        }
        .stat-item svg {
          transition: all 0.4s cubic-bezier(.16, 1, .3, 1);
        }
        .stat-item:hover svg {
          transform: scale(1.15) rotate(4deg);
          stroke: #c7a75c;
        }

        /* Premium Landing Page Inputs */
        .landing-page .form-control {
          background: #faf9f6;
          border: 1px solid rgba(199, 167, 92, 0.15);
          border-radius: 14px;
          color: #2a1f20;
          padding: 14px 18px;
          transition: all 0.4s cubic-bezier(.16,1,.3,1);
        }
        .landing-page .form-control:focus {
          border-color: #c7a75c;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(199, 167, 92, 0.08);
        }
        .landing-page .form-label {
          font-weight: 600;
          color: #5a4c4e;
          font-size: 13px;
          margin-bottom: 8px;
        }

        /* Floating WhatsApp Button */
        .whatsapp-btn {
          position: fixed; bottom: 30px; right: 30px;
          width: 60px; height: 60px; background: #25d366; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 10px 30px rgba(37,211,102,0.35); z-index: 99999;
          text-decoration: none; font-size: 30px;
          transition: all 0.3s cubic-bezier(.16,1,.3,1);
        }
        .whatsapp-btn:hover {
          transform: scale(1.08) translateY(-3px);
          box-shadow: 0 15px 35px rgba(37,211,102,0.5);
        }
        @media (max-width: 768px) {
          .whatsapp-btn {
            bottom: 20px;
            right: 20px;
            width: 52px;
            height: 52px;
          }
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
          background: #8c1a22;
          margin: 5px 0;
          transition: 0.3s;
        }

        @media (max-width: 768px) {
          .floating-header {
            border-radius: 30px;
            padding: 0 24px;
          }
          .nav-menu {
            display: none !important;
            flex-direction: column;
            position: absolute;
            top: 80px;
            left: 0;
            right: 0;
            background: #faf9f6;
            border: 1px solid rgba(199, 167, 92, 0.2);
            border-radius: 20px;
            padding: 30px;
            gap: 20px !important;
            box-shadow: 0 15px 35px rgba(0,0,0,0.08);
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

        /* ── FOOTER STYLING ── */
        .footer-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 60px;
        }
        @media (max-width: 1024px) {
          .footer-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 40px;
          }
        }
        @media (max-width: 640px) {
          .footer-grid {
            grid-template-columns: 1fr;
            gap: 30px;
          }
        }

        .social-link {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(199, 167, 92, 0.2);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #bfaea7;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          text-decoration: none;
        }
        .social-link:hover {
          background: linear-gradient(135deg, #8c1a22 0%, #52080d 100%);
          border-color: #c7a75c;
          color: #ffffff;
          transform: translateY(-4px);
          box-shadow: 0 6px 20px rgba(140, 26, 34, 0.4);
        }
        .social-link svg {
          transition: transform 0.3s ease;
        }
        .social-link:hover svg {
          transform: scale(1.15);
        }

        .footer-link {
          color: #bfaea7;
          text-decoration: none;
          font-size: 14px;
          transition: all 0.25s ease;
          display: inline-block;
          position: relative;
        }
        .footer-link:hover {
          color: #c7a75c !important;
          transform: translateX(4px);
        }

        /* ── MODAL ANIMATIONS ── */
        @keyframes fadeInModal {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleInModal {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .hero-section {
          position: relative;
          height: 80vh;
          min-height: 550px;
          display: flex;
          align-items: center;
          overflow: hidden;
          background: #faf9f6;
        }
        .hero-container {
          position: relative;
          z-index: 5;
          padding: 0 8%;
          max-width: 1280px;
          width: 100%;
          margin: 0 auto;
        }
        .hero-title {
          font-size: clamp(38px, 5.8vw, 76px);
          font-weight: 900;
          margin-top: 24px;
          margin-bottom: 24px;
          line-height: 1.08;
          color: #150608;
          letter-spacing: -2px;
        }
        .about-image-wrap {
          position: relative;
          height: 480px;
          border-radius: 28px;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(107, 16, 22, 0.06);
          border: 1px solid rgba(199, 167, 92, 0.2);
        }
        .finance-banner-wrap {
          max-width: 1200px;
          margin: 0 auto;
          border-radius: 32px;
          overflow: hidden;
          position: relative;
          height: 380px;
          box-shadow: 0 20px 40px rgba(107, 16, 22, 0.05);
          border: 1px solid rgba(199, 167, 92, 0.25);
        }
        .finance-banner-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(250, 249, 246, 0.96) 0%, rgba(250, 243, 244, 0.85) 100%);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          padding: 60px 8%;
        }
        .contact-form-card {
          padding: 50px 44px;
          border-radius: 28px;
          background-color: #ffffff;
          box-shadow: 0 20px 45px rgba(107, 16, 22, 0.03);
          border: 1px solid rgba(199, 167, 92, 0.18);
        }
        .modal-wrap {
          background: #ffffff;
          max-width: 680px;
          width: 100%;
          max-height: 85vh;
          border-radius: 28px;
          border: 1px solid rgba(199, 167, 92, 0.3);
          box-shadow: 0 25px 60px rgba(15, 6, 8, 0.18);
          overflow-y: auto;
          position: relative;
          transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .modal-body {
          padding: 40px;
        }

        @media (max-width: 768px) {
          .hero-section {
            height: auto !important;
            min-height: auto !important;
            padding-top: 130px !important;
            padding-bottom: 60px !important;
          }
          .hero-container {
            padding: 0 6% !important;
          }
          .hero-title {
            font-size: 32px !important;
            line-height: 1.2 !important;
            letter-spacing: -1px !important;
          }
          .about-image-wrap {
            height: 260px !important;
          }
          .finance-banner-wrap {
            height: auto !important;
            min-height: 380px !important;
          }
          .finance-banner-overlay {
            position: relative !important;
            padding: 40px 24px !important;
            background: linear-gradient(135deg, rgba(250, 249, 246, 0.98) 0%, rgba(250, 243, 244, 0.95) 100%) !important;
          }
          .contact-form-card {
            padding: 30px 20px !important;
          }
          .modal-wrap {
            max-width: 95% !important;
            max-height: 90vh !important;
            border-radius: 20px !important;
          }
          .modal-body {
            padding: 24px 20px !important;
          }
        }
      `}</style>

      {/* ── FLOATING HEADER ── */}
      <header className={`floating-header ${scrolled ? 'scrolled' : ''}`}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
          {/* Logo wrapper using a dark pill container to make the white logo stand out beautifully */}
          <div style={{ 
            position: 'relative', 
            width: '135px', 
            height: '38px', 
            background: '#150608', 
            padding: '3px 10px', 
            borderRadius: '10px',
            border: '1px solid rgba(199, 167, 92, 0.3)',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
          }}>
            <Image 
              src="/logo.png" 
              alt="Privilege Contabilidade" 
              fill
              style={{ objectFit: 'contain', padding: '3px' }}
              priority
            />
          </div>
        </Link>
        
        <nav className={`nav-menu ${menuOpen ? 'active' : ''}`} style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <a href="#servicos" className="nav-link" onClick={() => setMenuOpen(false)}>Serviços</a>
          <a href="#sobre" className="nav-link" onClick={() => setMenuOpen(false)}>Sobre Nós</a>
          <a href="#instagram" className="nav-link" onClick={() => setMenuOpen(false)}>Instagram</a>
          <a href="#contato" className="nav-link" onClick={() => setMenuOpen(false)}>Contato</a>
          <Link href="/login" className="btn-wine" style={{ padding: '10px 24px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            Portal do Cliente
          </Link>
        </nav>

        <button className={`hamburger ${menuOpen ? 'active' : ''}`} onClick={() => setMenuOpen(!menuOpen)}>
          <span></span>
          <span></span>
          <span></span>
        </button>
      </header>

      {/* Spacer for floating header */}
      <div style={{ height: '110px' }} />

      {/* ── HERO SECTION ── */}
      <section style={{ position: 'relative', height: '80vh', minHeight: '550px', display: 'flex', alignItems: 'center', overflow: 'hidden', background: '#faf9f6' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.16, zIndex: 1, overflow: 'hidden' }}>
          <Image 
            src="/hero_luxury_bg.png" 
            alt="Luxury Corporate Background" 
            fill 
            className="hero-bg-animate"
            style={{ objectFit: 'cover' }}
            priority
          />
          <div style={{ 
            position: 'absolute', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            height: '220px', 
            background: 'linear-gradient(to bottom, transparent, #faf9f6)',
            pointerEvents: 'none'
          }} />
        </div>
        <div className="blob-bg" style={{ top: '-10%', left: '-5%', opacity: 0.6 }} />
        <div className="blob-bg-2" style={{ bottom: '10%', right: '-5%', opacity: 0.5 }} />
        <div className="hero-grid" style={{ opacity: 0.4 }} />
        
        <div style={{ position: 'relative', zIndex: 5, padding: '0 8%', maxWidth: '1280px', width: '100%', margin: '0 auto' }}>
          <div style={{ animation: 'fadeSlideUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
            <span className="hero-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <path d="M6 3h12l4 6-10 13L2 9z"></path>
                <path d="M11 3 8 9l4 13 4-13-3-6"></path>
                <path d="M2 9h20"></path>
              </svg>
              Excelência Contábil & Gestão Digital Avançada
            </span>
            <h1 style={{ fontSize: 'clamp(42px, 5.8vw, 76px)', fontWeight: 900, marginTop: '24px', marginBottom: '24px', lineHeight: '1.08', color: '#150608', letterSpacing: '-2px' }}>
              Muito além da contabilidade,<br />
              <span style={{ color: '#8c1a22', background: 'linear-gradient(to right, #8c1a22, #c7a75c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                inteligência de dados
              </span> para sua empresa.
            </h1>
            <p style={{ fontSize: '20px', color: '#5a4c4e', lineHeight: '1.65', maxWidth: '640px', marginBottom: '48px' }}>
              Há 8 anos unindo a tradição de uma assessoria contábil de excelência a soluções tecnológicas de alta performance financeira no seu dia a dia.
            </p>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <Link href="/login" className="btn-wine" style={{ padding: '18px 44px', borderRadius: '16px', fontSize: '15px' }}>
                Entrar no Portal do Cliente
              </Link>
              <a href="#contato" className="btn-outline-wine" style={{ padding: '18px 40px', borderRadius: '16px', fontSize: '15px' }}>
                Falar com um Consultor
              </a>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '2px', height: '55px', background: 'linear-gradient(to bottom, #8c1a22, transparent)', animation: 'scrollPulse 2s infinite' }} />
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
          @keyframes slowPanZoom {
            0% { transform: scale(1.05) translate(0, 0); }
            50% { transform: scale(1.15) translate(-15px, 8px); }
            100% { transform: scale(1.05) translate(0, 0); }
          }
          .hero-bg-animate {
            animation: slowPanZoom 28s ease-in-out infinite;
          }
        `}</style>
      </section>

      {/* ── STATS SECTION ── */}
      <FadeSection id="sobre" style={{ padding: '100px 8%', background: 'linear-gradient(to bottom, #faf9f6 0%, #ffffff 100%)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span className="outfit-font" style={{ display: 'inline-block', background: 'rgba(140, 26, 34, 0.05)', color: '#8c1a22', padding: '6px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', border: '1px solid rgba(140, 26, 34, 0.15)' }}>
              Resultados de Destaque
            </span>
            <h2 style={{ fontSize: '40px', fontWeight: 800, color: '#150608', letterSpacing: '-0.8px', marginTop: '16px' }}>
              Tradição e Segurança em Números
            </h2>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '24px' }}>
            {[
              { num: '+500', label: 'Empresas Atendidas', icon: 'empresas' },
              { num: 'R$ 2Bi+', label: 'Faturamento Gerido', icon: 'faturamento' },
              { num: '98%', label: 'Retenção de Clientes', icon: 'retencao' },
              { num: '8 anos', label: 'De Histórico', icon: 'historico' },
            ].map((s, i) => (
              <div key={i} className="stat-item">
                {renderStatIcon(s.icon)}
                <div style={{ fontSize: '42px', fontWeight: 900, color: '#8c1a22', fontFamily: "'Outfit', sans-serif", lineHeight: 1.1 }}>{s.num}</div>
                <div style={{ fontSize: '12px', color: '#5a4c4e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '12px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </FadeSection>

      {/* ── ABOUT & MVV SECTION ── */}
      <FadeSection style={{ padding: '100px 8%', background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '80px', alignItems: 'center', marginBottom: '100px' }}>
            <div>
              <span className="outfit-font" style={{ display: 'inline-block', background: 'rgba(140, 26, 34, 0.05)', color: '#8c1a22', padding: '6px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', border: '1px solid rgba(140, 26, 34, 0.15)' }}>
                Sobre Nós
              </span>
              <h2 style={{ fontSize: '40px', fontWeight: 800, color: '#150608', marginTop: '16px', marginBottom: '24px', lineHeight: '1.2', letterSpacing: '-0.8px' }}>
                Parceria e tecnologia focadas no seu sucesso
              </h2>
              <p style={{ color: '#5a4c4e', fontSize: '17px', lineHeight: '1.75', marginBottom: '36px' }}>
                A Privilege Contabilidade e Consultoria combina a sólida bagagem técnica de 8 anos de atuação a ferramentas digitais de última geração. Oferecemos um suporte financeiro e contábil consultivo e inteligente para embasar as tomadas de decisões da sua liderança.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  'Assessores especializados dedicados à sua conta',
                  'Processos corporativos 100% integrados e digitais',
                  'Relatórios gerenciais e análises em tempo real'
                ].map((txt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#150608', fontWeight: 600, fontSize: '15px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c1a22" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    {txt}
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ position: 'relative', height: '480px', borderRadius: '28px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(107, 16, 22, 0.06)', border: '1px solid rgba(199, 167, 92, 0.2)' }}>
              <Image
                src="/edificio_privilege.jpg"
                alt="Sede Privilege Contabilidade"
                fill
                style={{ objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(140, 26, 34, 0.08), transparent)' }} />
            </div>
          </div>

          {/* Missão, Visão e Valores (Light Theme) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '28px' }}>
            {[
              {
                icon: 'missao',
                label: 'Missão',
                title: 'Excelência & Foco',
                text: 'Oferecer serviços com a máxima qualidade, responsabilidade e precisão técnica, superando expectativas de nossos clientes e contribuindo para a evolução de seus negócios.'
              },
              {
                icon: 'visao',
                label: 'Visão',
                title: 'Referência Contábil',
                text: 'Ser reconhecido nacionalmente como escritório de referência em contabilidade consultiva e BPO financeiro, mantendo-nos na vanguarda tecnológica e técnica.'
              },
              {
                icon: 'valores',
                label: 'Valores',
                title: 'Ética & Organização',
                text: 'Comprometimento absoluto · Ética profissional inabalável · Agilidade de resposta · Organização primorosa · Busca constante por inovação, evolução e sustentabilidade.'
              },
            ].map((item, i) => (
              <div key={i} style={{
                background: '#ffffff',
                border: '1px solid rgba(199, 167, 92, 0.18)',
                borderRadius: '24px',
                padding: '40px 36px',
                boxShadow: '0 6px 20px rgba(0,0,0,0.015)',
                transition: 'all 0.4s cubic-bezier(.16,1,.3,1)',
              }}
                onMouseEnter={e => { 
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px)'; 
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 15px 35px rgba(168, 138, 68, 0.1)';
                  (e.currentTarget as HTMLElement).style.borderColor = '#c7a75c';
                }}
                onMouseLeave={e => { 
                  (e.currentTarget as HTMLElement).style.transform = ''; 
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.015)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(199, 167, 92, 0.18)';
                }}
              >
                {renderMvvIcon(item.icon)}
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#c7a75c', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>{item.label}</div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#150608', marginBottom: '14px' }}>{item.title}</h3>
                <p style={{ color: '#5a4c4e', fontSize: '15px', lineHeight: '1.75' }}>{item.text}</p>
              </div>
            ))}
          </div>

        </div>
      </FadeSection>

      {/* ── SERVICES SECTION ── */}
      <FadeSection id="servicos" style={{ padding: '100px 8%', background: 'linear-gradient(180deg, #ffffff 0%, #faf9f6 100%)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '70px' }}>
            <span className="outfit-font" style={{ display: 'inline-block', background: 'rgba(140, 26, 34, 0.05)', color: '#8c1a22', padding: '6px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', border: '1px solid rgba(140, 26, 34, 0.15)' }}>
              Nossas Soluções
            </span>
            <h2 style={{ fontSize: '42px', fontWeight: 800, color: '#150608', letterSpacing: '-0.8px', marginTop: '16px' }}>
              Especialidades sob Medida
            </h2>
            <p style={{ color: '#5a4c4e', fontSize: '18px', marginTop: '16px', maxWidth: '640px', margin: '16px auto 0', lineHeight: '1.6' }}>
              Facilitamos a rotina tributária e financeira da sua empresa com assessoria especializada para cada demanda corporativa.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
            {services.map((s, i) => (
              <div key={i} className="premium-card" onClick={() => handleOpenService(s)} style={{ cursor: 'pointer' }}>
                <div className="service-icon">{renderServiceIcon(s.icon)}</div>
                <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px', color: '#150608' }}>{s.title}</h3>
                <p style={{ color: '#5a4c4e', lineHeight: '1.75', fontSize: '15px' }}>{s.desc}</p>
                <div style={{ marginTop: '28px', display: 'flex', alignItems: 'center', gap: '8px', color: '#8c1a22', fontWeight: 700, fontSize: '14px' }}>
                  Saiba mais <span style={{ fontSize: '16px' }}>→</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </FadeSection>

      {/* ── FINANCE BANNER (Luxury Mesh Style) ── */}
      <FadeSection style={{ padding: '0 8%', marginBottom: '60px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', borderRadius: '32px', overflow: 'hidden', position: 'relative', height: '380px', boxShadow: '0 20px 40px rgba(107, 16, 22, 0.05)', border: '1px solid rgba(199, 167, 92, 0.25)' }}>
          <Image src="/finance_abstract.png" alt="Gestão avançada de caixa" fill style={{ objectFit: 'cover' }} />
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            background: 'linear-gradient(135deg, rgba(250, 249, 246, 0.96) 0%, rgba(250, 243, 244, 0.85) 100%)', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'flex-start', 
            justifyContent: 'center', 
            padding: '60px 8%' 
          }}>
            <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 800, color: '#150608', marginBottom: '20px', maxWidth: '600px', lineHeight: '1.2', letterSpacing: '-0.8px' }}>
              Gestão financeira estratégica na ponta dos dedos.
            </h2>
            <p style={{ color: '#5a4c4e', fontSize: '17px', marginBottom: '36px', maxWidth: '520px', lineHeight: '1.6' }}>
              Dashboard completo para acompanhamento de saldos, conciliação inteligente de OFX e controle de faturamento em tempo real.
            </p>
            <Link href="/login" className="btn-wine" style={{ padding: '16px 36px', borderRadius: '14px', fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Acessar Painel Privilege →
            </Link>
          </div>
        </div>
      </FadeSection>

      {/* ── INSTAGRAM FEED SECTION ── */}
      <FadeSection id="instagram" style={{ padding: '100px 8%', backgroundColor: '#f7f6f2' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span className="outfit-font" style={{ display: 'inline-block', background: 'rgba(140, 26, 34, 0.05)', color: '#8c1a22', padding: '6px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', border: '1px solid rgba(140, 26, 34, 0.15)' }}>
              Siga @privilgefb no Instagram
            </span>
            <h2 style={{ fontSize: '40px', fontWeight: 800, color: '#150608', letterSpacing: '-0.8px', marginTop: '16px' }}>
              Últimas Publicações
            </h2>
            <p style={{ color: '#5a4c4e', fontSize: '16px', marginTop: '12px' }}>
              Fique por dentro de atualizações fiscais, dicas de gestão e novidades da Privilege.
            </p>
          </div>

          <div id="curator-feed-default-feed-layout" style={{ width: '100%' }}>
            <a href="https://curator.io" target="_blank" rel="noopener noreferrer" className="crt-logo crt-tag" style={{ color: '#5a4c4e', textDecoration: 'none', fontSize: '12px' }}>
              Powered by Curator.io
            </a>
          </div>
        </div>
      </FadeSection>


      {/* ── CONTACT SECTION ── */}
      <FadeSection id="contato" style={{ padding: '100px 8%', backgroundColor: '#fcfbfa' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '80px', alignItems: 'start' }}>
          <div>
            <span className="outfit-font" style={{ display: 'inline-block', background: 'rgba(140, 26, 34, 0.05)', color: '#8c1a22', padding: '6px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', border: '1px solid rgba(140, 26, 34, 0.15)' }}>
              Canais de Contato
            </span>
            <h2 style={{ fontSize: '40px', fontWeight: 800, color: '#150608', letterSpacing: '-0.8px', marginTop: '16px', marginBottom: '20px' }}>
              Vamos Conversar?
            </h2>
            <p style={{ color: '#5a4c4e', fontSize: '17px', marginBottom: '44px', lineHeight: '1.7' }}>
              Agende um diagnóstico contábil inicial gratuito com nossos especialistas. Envie sua mensagem ou utilize nossos canais diretos de atendimento.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {[
                { 
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8c1a22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                  ), 
                  label: 'Telefone', 
                  val: '(46) 3035-1018', 
                  href: 'tel:+554630351018' 
                },
                { 
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8c1a22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                  ), 
                  label: 'E-mail', 
                  val: 'contato@privilegecontabilidade.com.br', 
                  href: 'mailto:contato@privilegecontabilidade.com.br' 
                },
                { 
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8c1a22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                  ), 
                  label: 'Sede Principal', 
                  val: 'Rua Pará, 127, Sala 103 – Centro, Francisco Beltrão, PR – CEP 85601-290', 
                  href: '#mapa' 
                },
                { 
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8c1a22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  ), 
                  label: 'Atendimento', 
                  val: 'Segunda a Sexta-feira: 8h às 18h', 
                  href: undefined 
                },
              ].map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                  <div style={{ 
                    width: '48px', height: '48px', borderRadius: '14px', 
                    backgroundColor: 'rgba(140, 26, 34, 0.04)', 
                    border: '1px solid rgba(199,167,92,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0 
                  }}>{c.icon}</div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#c7a75c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>{c.label}</div>
                    {c.href ? (
                      <a href={c.href} style={{ fontWeight: 600, color: '#150608', textDecoration: 'none', fontSize: '15px', transition: 'color 0.2s' }}
                         onMouseEnter={e => e.currentTarget.style.color = '#8c1a22'}
                         onMouseLeave={e => e.currentTarget.style.color = '#150608'}>{c.val}</a>
                    ) : (
                      <span style={{ fontWeight: 600, color: '#150608', fontSize: '15px' }}>{c.val}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ 
            padding: '50px 44px', 
            borderRadius: '28px', 
            backgroundColor: '#ffffff',
            boxShadow: '0 20px 45px rgba(107, 16, 22, 0.03)',
            border: '1px solid rgba(199, 167, 92, 0.18)'
          }}>
            <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} onSubmit={e => e.preventDefault()}>
              <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#150608', marginBottom: '8px' }}>Solicite um Diagnóstico</h3>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nome Completo</label>
                <input className="form-control" placeholder="Seu nome" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">E-mail Corporativo</label>
                <input type="email" className="form-control" placeholder="seu@email.com" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">WhatsApp</label>
                <input type="tel" className="form-control" placeholder="(46) 99999-9999" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Como podemos somar?</label>
                <textarea className="form-control" rows={4} placeholder="Conte brevemente sobre as necessidades de sua empresa..." style={{ resize: 'none' }}></textarea>
              </div>
              <button type="submit" className="btn-wine" style={{ padding: '16px', fontSize: '15px', fontWeight: 700, borderRadius: '14px', width: '100%' }}>
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
            style={{ border: 0, display: 'block' }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Localização Privilege Contabilidade"
          />
          <div style={{ 
            position: 'absolute', top: '30px', left: '30px', 
            background: 'rgba(255,255,255,0.96)', borderRadius: '20px', 
            padding: '24px 28px', backdropFilter: 'blur(12px)', 
            boxShadow: '0 10px 30px rgba(0,0,0,0.06)', maxWidth: '320px',
            border: '1px solid rgba(199, 167, 92, 0.2)'
          }}>
            <div style={{ marginBottom: '12px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8c1a22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
            <div style={{ fontWeight: 700, color: '#150608', marginBottom: '6px', fontSize: '16px', fontFamily: "'Outfit', sans-serif" }}>Sede Privilege</div>
            <div style={{ color: '#5a4c4e', fontSize: '13px', lineHeight: '1.5' }}>Rua Pará, 127, Sala 103 – Centro<br />Francisco Beltrão – PR, CEP 85601-290</div>
          </div>
        </div>
      </FadeSection>

      {/* ── FINAL CALL TO ACTION (CTA) ── */}
      <FadeSection style={{ padding: '90px 8%' }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          borderRadius: '32px',
          background: 'linear-gradient(135deg, #8c1a22 0%, #52080d 100%)',
          color: '#fff', textAlign: 'center', padding: '90px 6%',
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(140, 26, 34, 0.2)',
          border: '1px solid rgba(199, 167, 92, 0.35)'
        }}>
          <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '320px', height: '320px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', bottom: '-90px', left: '-45px', width: '280px', height: '280px', borderRadius: '50%', background: 'rgba(199,167,92,0.05)' }} />
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 900, marginBottom: '24px', letterSpacing: '-1px', lineHeight: 1.15 }}>
              Eleve a gestão da sua empresa ao nível Privilege
            </h2>
            <p style={{ fontSize: '19px', marginBottom: '48px', opacity: 0.85, maxWidth: '620px', margin: '0 auto 48px', lineHeight: '1.6', color: '#f2ecee' }}>
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
      <footer style={{ background: '#150608', color: '#bfaea7', paddingTop: '90px', borderTop: '1px solid rgba(199, 167, 92, 0.15)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 8%' }}>
          <div className="footer-grid" style={{ paddingBottom: '60px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

            {/* Brand details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ 
                position: 'relative', 
                width: '145px', 
                height: '42px', 
                background: '#150608', 
                padding: '4px 12px', 
                borderRadius: '12px',
                border: '1px solid rgba(199, 167, 92, 0.3)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}>
                <Image 
                  src="/logo.png" 
                  alt="Privilege Contabilidade" 
                  fill
                  style={{ objectFit: 'contain', padding: '4px' }}
                />
              </div>
              <p style={{ fontSize: '14px', lineHeight: '1.8', color: '#bfaea7', margin: 0 }}>
                Excelência técnica, ética profissional e inovação digital contínua. Desde 2018, transformando dados financeiros em bases para o crescimento.
              </p>
              <div style={{ display: 'flex', gap: '14px', marginTop: '6px' }}>
                <a href="https://www.instagram.com/privilgefb" target="_blank" rel="noopener noreferrer" className="social-link" title="Instagram">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                </a>
                <a href="https://www.facebook.com/people/Privilege-Contabilidade-e-Consultoria/61586803271078/" target="_blank" rel="noopener noreferrer" className="social-link" title="Facebook">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                </a>
                <a href="https://www.linkedin.com/company/privilege-assessoria-cont%C3%A1bil/" target="_blank" rel="noopener noreferrer" className="social-link" title="LinkedIn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                </a>
                <a href="https://api.whatsapp.com/send?phone=5546999048990&text=Olá! Gostaria de falar com o time Privilege." target="_blank" rel="noopener noreferrer" className="social-link" title="WhatsApp">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                </a>
              </div>
            </div>

            {/* Services Links */}
            <div>
              <h4 style={{ color: '#faf9f6', marginBottom: '24px', fontSize: '15px', fontWeight: 700, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.5px' }}>Serviços</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['Abertura de Empresas', 'Escrituração Fiscal', 'Folha de Pagamento', 'Contabilidade', 'Consultoria Tributária'].map((l, i) => (
                  <a key={i} href="#servicos" className="footer-link">{l}</a>
                ))}
              </div>
            </div>

            {/* Company Links */}
            <div>
              <h4 style={{ color: '#faf9f6', marginBottom: '24px', fontSize: '15px', fontWeight: 700, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.5px' }}>Institucional</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['Sobre Nós', 'Instagram', 'Trabalhe Conosco', 'Política de Privacidade'].map((l, i) => (
                  <a key={i} href={l === 'Instagram' ? '#instagram' : '#sobre'} className="footer-link">{l}</a>
                ))}
              </div>
            </div>

            {/* Contact Details */}
            <div>
              <h4 style={{ color: '#faf9f6', marginBottom: '24px', fontSize: '15px', fontWeight: 700, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.5px' }}>Contato</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', fontSize: '14px' }}>
                <a href="tel:+554630351018" className="footer-link" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c7a75c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  (46) 3035-1018
                </a>
                <a href="mailto:contato@privilegecontabilidade.com.br" className="footer-link" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c7a75c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  contato@privilegecontabilidade.com.br
                </a>
                <span style={{ color: '#bfaea7', display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: 1.6 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c7a75c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '3px', flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  <span>Rua Pará, 127, Sala 103<br />Centro – Francisco Beltrão, PR</span>
                </span>
                <span style={{ color: '#bfaea7', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c7a75c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  Seg–Sex: 8h às 18h
                </span>
              </div>
            </div>

          </div>

          {/* Footer Bottom copyright */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '30px 0', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: '#8c7e80' }}>
            <span>© {new Date().getFullYear()} Privilege Contabilidade. Todos os direitos reservados.</span>
            <div style={{ display: 'flex', gap: '24px' }}>
              <button onClick={() => setActiveLegal('termos')} style={{ background: 'none', border: 'none', font: 'inherit', color: '#8c7e80', textDecoration: 'none', transition: 'color 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.color = '#c7a75c'} onMouseLeave={e => e.currentTarget.style.color = '#8c7e80'}>Termos</button>
              <button onClick={() => setActiveLegal('privacidade')} style={{ background: 'none', border: 'none', font: 'inherit', color: '#8c7e80', textDecoration: 'none', transition: 'color 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.color = '#c7a75c'} onMouseLeave={e => e.currentTarget.style.color = '#8c7e80'}>Privacidade</button>
              <button onClick={() => setActiveLegal('lgpd')} style={{ background: 'none', border: 'none', font: 'inherit', color: '#8c7e80', textDecoration: 'none', transition: 'color 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.color = '#c7a75c'} onMouseLeave={e => e.currentTarget.style.color = '#8c7e80'}>LGPD</button>
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

      {/* ── SERVICE MODAL ── */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(21, 6, 8, 0.6)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px',
        opacity: selectedService ? 1 : 0,
        pointerEvents: selectedService ? 'auto' : 'none',
        transition: 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={() => setSelectedService(null)}
      >
        <div style={{
          background: '#ffffff',
          maxWidth: '680px',
          width: '100%',
          borderRadius: '28px',
          border: '1px solid rgba(199, 167, 92, 0.3)',
          boxShadow: '0 25px 60px rgba(15, 6, 8, 0.18)',
          overflow: 'hidden',
          position: 'relative',
          transform: selectedService ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)',
          transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
        >
          {activeService && (
            <>
              {/* Header / Accent Bar */}
              <div style={{
                background: 'linear-gradient(135deg, #8c1a22 0%, #52080d 100%)',
                padding: '30px 40px',
                color: '#fff',
                position: 'relative'
              }}>
                <span className="outfit-font" style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  color: '#c7a75c',
                  opacity: 0.9,
                  display: 'block',
                  marginBottom: '8px'
                }}>{activeService.category}</span>
                <h3 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: '#faf9f6', letterSpacing: '-0.5px' }}>
                  {activeService.title}
                </h3>
                
                {/* Close Button */}
                <button 
                  onClick={() => setSelectedService(null)}
                  style={{
                    position: 'absolute',
                    top: '30px',
                    right: '30px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div style={{ padding: '40px' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '24px' }}>
                  <div style={{ 
                    width: '56px', height: '56px', 
                    borderRadius: '16px', 
                    background: 'linear-gradient(135deg, rgba(140, 26, 34, 0.06), rgba(199, 167, 92, 0.04))', 
                    border: '1px solid rgba(199, 167, 92, 0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '28px', flexShrink: 0
                  }}>{renderServiceIcon(activeService.icon, "#c7a75c")}</div>
                  <div>
                    <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#8c1a22', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                      {activeService.tagline}
                    </h4>
                    <span style={{ fontSize: '12px', color: '#c7a75c', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Privilege Inteligência
                    </span>
                  </div>
                </div>

                <p style={{ color: '#5a4c4e', fontSize: '16px', lineHeight: '1.8', margin: '0 0 32px 0' }}>
                  {activeService.fullDesc}
                </p>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <a 
                    href={`https://api.whatsapp.com/send?phone=5546999048990&text=Olá! Gostaria de conversar com um especialista sobre o serviço de: ${activeService.title}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-wine"
                    style={{ padding: '14px 28px', borderRadius: '12px', fontSize: '14px', flex: 1, textDecoration: 'none', textAlign: 'center' }}
                    onClick={() => setSelectedService(null)}
                  >
                    Falar com um Especialista
                  </a>
                  <button 
                    className="btn-outline-wine" 
                    style={{ padding: '14px 24px', borderRadius: '12px', fontSize: '14px', flex: 1 }}
                    onClick={() => {
                      setSelectedService(null);
                      const el = document.getElementById('contato');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    Solicitar Contato por E-mail
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── LEGAL MODAL ── */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(21, 6, 8, 0.6)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px',
        opacity: activeLegal ? 1 : 0,
        pointerEvents: activeLegal ? 'auto' : 'none',
        transition: 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={() => setActiveLegal(null)}
      >
        <div style={{
          background: '#ffffff',
          maxWidth: '740px',
          width: '100%',
          maxHeight: '85vh',
          borderRadius: '28px',
          border: '1px solid rgba(199, 167, 92, 0.3)',
          boxShadow: '0 25px 60px rgba(15, 6, 8, 0.18)',
          overflowY: 'auto',
          position: 'relative',
          transform: activeLegal ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)',
          transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
        >
          {activeLegal && legalDocs[activeLegal] && (
            <>
              {/* Header / Accent Bar */}
              <div style={{
                background: 'linear-gradient(135deg, #8c1a22 0%, #52080d 100%)',
                padding: '30px 40px',
                color: '#fff',
                position: 'relative'
              }}>
                <span className="outfit-font" style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  color: '#c7a75c',
                  opacity: 0.9,
                  display: 'block',
                  marginBottom: '8px'
                }}>Privilege Legal & Compliance</span>
                <h3 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: '#faf9f6', letterSpacing: '-0.5px' }}>
                  {legalDocs[activeLegal].title}
                </h3>
                
                {/* Close Button */}
                <button 
                  onClick={() => setActiveLegal(null)}
                  style={{
                    position: 'absolute',
                    top: '30px',
                    right: '30px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div style={{ padding: '40px' }}>
                <div style={{ fontSize: '13px', color: '#c7a75c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '24px' }}>
                  {legalDocs[activeLegal].subtitle}
                </div>
                {legalDocs[activeLegal].content}
                
                <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn-wine" 
                    style={{ padding: '14px 32px', borderRadius: '12px', fontSize: '14px' }}
                    onClick={() => setActiveLegal(null)}
                  >
                    Entendi e Fechar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
}
