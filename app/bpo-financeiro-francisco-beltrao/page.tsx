import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, CheckCircle2, ChevronRight, DollarSign, Clock, BarChart3, ShieldCheck, MessageCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'BPO Financeiro em Francisco Beltrão · Terceirização Financeira Inteligente',
  description:
    'Terceirize o financeiro da sua empresa em Francisco Beltrão com a Privilege Contabilidade. Gestão profissional de contas a pagar, receber, conciliação diária, DFC e relatórios estratégicos.',
  keywords: [
    'BPO financeiro Francisco Beltrão',
    'terceirização do financeiro Francisco Beltrão PR',
    'gestão financeira para empresas',
    'contas a pagar e receber terceirizado',
    'fluxo de caixa Francisco Beltrão',
    'consultoria financeira sudoeste do Paraná',
  ],
  alternates: {
    canonical: 'https://privilegecontabilidade.cnt.br/bpo-financeiro-francisco-beltrao',
  },
  openGraph: {
    title: 'BPO Financeiro em Francisco Beltrão · Privilege Contabilidade',
    description: 'Transforme seu financeiro em um motor de tomada de decisões com BPO integrado.',
    url: 'https://privilegecontabilidade.cnt.br/bpo-financeiro-francisco-beltrao',
  },
};

export default function BpoFinanceiroPage() {
  const whatsAppUrl = 'https://wa.me/554630351018?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20o%20BPO%20Financeiro%20para%20minha%20empresa%20em%20Francisco%20Beltr%C3%A3o.';

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
          <span style={{ color: '#525252' }}>Soluções Estratégicas</span>
          <ChevronRight size={14} />
          <span style={{ color: '#600000', fontWeight: 600 }}>BPO Financeiro em Francisco Beltrão</span>
        </div>
      </nav>

      {/* Hero do Serviço */}
      <main style={{ maxWidth: '1000px', width: '100%', margin: '0 auto', padding: '48px 24px 80px', flex: 1 }}>
        <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 48px' }}>
          <span style={{ color: '#600000', fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'inline-block', marginBottom: '12px' }}>
            Terceirização da Gestão Financeira (BPO)
          </span>
          <h1 style={{ fontSize: '44px', lineHeight: 1.15, fontWeight: 800, margin: '0 0 20px 0', color: '#111' }}>
            BPO Financeiro em Francisco Beltrão: Controle Total do Seu Caixa sem Custos com Equipe Interna
          </h1>
          <p style={{ fontSize: '18px', lineHeight: 1.6, color: '#525252', margin: '0 0 32px 0' }}>
            Elimine planilhas confusas, pagamentos em atraso e a sobrecarga operacional. A Privilege cuida do contas a pagar, receber, conciliação bancária diária e fornece relatórios gerenciais claros para você focar nas vendas e no crescimento.
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
              <MessageCircle size={20} /> Solicitar Diagnóstico de BPO Gratuito
            </a>
          </div>
        </div>

        {/* O que é o BPO */}
        <section style={{ marginBottom: '56px', background: '#fff', border: '1px solid #e5e5e5', borderRadius: '24px', padding: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 18px 0', color: '#111' }}>
            O que é BPO Financeiro e por que ele transforma empresas no Sudoeste do Paraná?
          </h2>
          <p style={{ fontSize: '16px', lineHeight: 1.7, color: '#404040', marginBottom: '18px' }}>
            <strong>BPO (Business Process Outsourcing) Financeiro</strong> é a terceirização completa ou parcial das rotinas operacionais do departamento financeiro da sua empresa. Em vez de contratar analistas, auxiliares e investir em softwares caros, você conta com a equipe especializada da Privilege Contabilidade executando suas operações financeiras com padrão de auditoria.
          </p>
          <p style={{ fontSize: '16px', lineHeight: 1.7, color: '#404040', margin: 0 }}>
            Em Francisco Beltrão e em todo o Paraná, empresários de comércio, serviços, agro e indústrias sofrem com a falta de tempo: o dono da empresa perde horas inserindo comprovantes bancários, agendando boletos e tentando entender para onde o lucro foi. O BPO Financeiro resolve essa dor na raiz.
          </p>
        </section>

        {/* Pilares do Serviço */}
        <section style={{ marginBottom: '56px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 28px 0', color: '#111', textAlign: 'center' }}>
            O que está incluído no BPO Financeiro da Privilege?
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {[
              {
                icon: <Clock size={28} color="#600000" />,
                title: 'Contas a Pagar',
                desc: 'Organização de notas, agendamento de boletos e tributos no seu banco. Você apenas dá a autorização final com 1 clique.',
              },
              {
                icon: <DollarSign size={28} color="#600000" />,
                title: 'Contas a Receber & Cobrança',
                desc: 'Emissão de notas fiscais, boletos registrados, acompanhamento da régua de cobrança preventiva e combate à inadimplência.',
              },
              {
                icon: <ShieldCheck size={28} color="#600000" />,
                title: 'Conciliação Bancária Diária',
                desc: 'Conferência diária centavo por centavo entre o extrato bancário, contas digitais e as vendas no cartão e PIX.',
              },
              {
                icon: <BarChart3 size={28} color="#600000" />,
                title: 'DRE & Fluxo de Caixa (DFC)',
                desc: 'Relatórios visuais e objetivos: saiba exatamente a margem real de cada produto, os custos fixos e a previsão de caixa para 30, 60 e 90 dias.',
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

        {/* Como funciona na prática */}
        <section style={{ marginBottom: '56px', background: '#fafafa', border: '1px solid #eaeaea', borderRadius: '24px', padding: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 20px 0', color: '#111' }}>
            Como funciona a operação no dia a dia?
          </h2>
          <div style={{ display: 'grid', gap: '20px' }}>
            {[
              { step: '1', title: 'Envio Digital dos Documentos', desc: 'Sua empresa nos envia notas, contratos e comprovantes via plataforma segura, WhatsApp ou e-mail.' },
              { step: '2', title: 'Processamento e Agendamento', desc: 'Nossos analistas lançam os dados no ERP em nuvem (Omie, Bling ou parceiros) e preparam os pagamentos no banco sem acesso para movimentar — apenas agendar.' },
              { step: '3', title: 'Aprovação pelo Gestor', desc: 'Com total autonomia e segurança, o empresário aprova os pagamentos diretamente pelo app do seu próprio banco.' },
              { step: '4', title: 'Reunião Mensal de Resultados', desc: 'Apresentamos um painel executivo com a rentabilidade real, ponto de equilíbrio e orientações tributárias.' },
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
            Dúvidas Frequentes sobre BPO Financeiro
          </h2>
          <div style={{ display: 'grid', gap: '16px' }}>
            {[
              {
                q: 'A Privilege terá acesso para transferir dinheiro da minha conta?',
                a: 'Não! O BPO opera com perfil de operador secundário disponibilizado pelos próprios bancos. Nós apenas cadastramos e agendamos os pagamentos. A liberação final com senha ou token de segurança é 100% exclusiva de você, gestor.',
              },
              {
                q: 'O BPO Financeiro substitui meu contador?',
                a: 'Na Privilege, o BPO e a contabilidade andam juntos sob o mesmo teto! Isso elimina retrabalho, reduz impostos e garante que sua escrituração fiscal e balanço estejam sempre em dia.',
              },
              {
                q: 'Minha empresa é pequena, o BPO serve para mim?',
                a: 'Sim! Atendemos desde profissionais liberais e pequenas empresas até médias corporações. Contratar o BPO custa uma fração do salário, encargos e riscos trabalhistas de um funcionário interno.',
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
            Quer ter clareza total do seu caixa a partir deste mês?
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.85)', maxWidth: '640px', margin: '0 auto 32px' }}>
            Agende uma conversa rápida com Marcos Cancelier e Mauricio Meurer. Vamos analisar seus processos atuais e mostrar o modelo ideal de BPO para sua empresa em Francisco Beltrão.
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
            <MessageCircle size={20} /> Falar com um Consultor no WhatsApp
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
            <Link href="/planejamento-tributario" style={{ color: '#fff', textDecoration: 'none' }}>Planejamento Tributário</Link>
            <Link href="/abertura-de-empresa-francisco-beltrao" style={{ color: '#fff', textDecoration: 'none' }}>Abertura de Empresa</Link>
            <Link href="/contabilidade-agronegocio" style={{ color: '#fff', textDecoration: 'none' }}>Agronegócio</Link>
            <Link href="/privacidade" style={{ color: '#fff', textDecoration: 'none' }}>Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

