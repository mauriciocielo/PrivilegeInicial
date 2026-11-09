import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, FileText, Mail, MapPin, Phone } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termos e Condições de Uso',
  description:
    'Termos e Condições Gerais de Uso da plataforma e dos serviços prestados pela Privilege Consultoria Ltda (CNPJ 58.033.979/0001-84) em Francisco Beltrão/PR.',
  alternates: {
    canonical: 'https://privilegecontabilidade.cnt.br/termos',
  },
  openGraph: {
    title: 'Termos de Uso · Privilege Contabilidade',
    description: 'Condições gerais, responsabilidades e parâmetros operacionais dos serviços da Privilege Contabilidade.',
    url: 'https://privilegecontabilidade.cnt.br/termos',
  },
};

export default function TermosPage() {
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
                transition: 'all 0.2s',
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
          <FileText size={24} />
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Segurança Jurídica & Diretrizes Contratuais
          </span>
        </div>

        <h1 style={{ fontSize: '38px', lineHeight: 1.2, fontWeight: 800, margin: '0 0 12px 0', color: '#111' }}>
          Termos e Condições Gerais de Uso
        </h1>
        <p style={{ color: '#737373', fontSize: '14px', marginBottom: '36px' }}>
          Última atualização: 21 de outubro de 2026 · Versão 2.1
        </p>

        <div style={{ background: '#fafafa', border: '1px solid #eaeaea', borderRadius: '16px', padding: '24px', marginBottom: '36px', fontSize: '14.5px', lineHeight: 1.7, color: '#333' }}>
          <p style={{ margin: 0 }}>
            Este instrumento regula as condições para utilização das aplicações, sistemas web, módulos de conciliação fiscal e serviços fornecidos pela <strong>PRIVILEGE CONSULTORIA LTDA</strong>, inscrita no <strong>CNPJ sob o nº 58.033.979/0001-84</strong>, com sede na Rua Pará, nº 127, Sala 03, Centro, CEP 85601-290, em <strong>Francisco Beltrão, Estado do Paraná</strong>.
          </p>
        </div>

        <article style={{ display: 'grid', gap: '28px', fontSize: '15px', lineHeight: 1.75, color: '#262626' }}>
          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', margin: '0 0 10px 0' }}>
              1. Aceite e Objeto dos Serviços
            </h2>
            <p>
              <strong>1.1. Aceite:</strong> A utilização das plataformas ou serviços da PRIVILEGE implica a expressa concordância com este Termo.
            </p>
            <p>
              <strong>1.2. Objeto:</strong> O presente contrato disciplina a prestação de serviços de contabilidade consultiva, escrituração fiscal, folha de pagamento, BPO financeiro, planejamento tributário e o licenciamento de uso dos ambientes digitais de acompanhamento e auditoria fiscal.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', margin: '0 0 10px 0' }}>
              2. Autenticação, Credenciais e Segurança
            </h2>
            <p>
              O acesso aos sistemas da PRIVILEGE é individual, intransferível e protegido por criptografia e autenticação de múltiplos fatores (MFA). O Usuário compromete-se a manter sob estrito sigilo suas senhas e tokens de segurança, respondendo pelos atos praticados com suas credenciais.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', margin: '0 0 10px 0' }}>
              3. Responsabilidade pelos Documentos e Informações Fiscais
            </h2>
            <p>
              <strong>3.1. Idoneidade dos Documentos:</strong> O Contratante é o único responsável pela veracidade, integridade e tempestividade do envio de notas fiscais, XMLs, arquivos SPED, extratos bancários e contratos.
            </p>
            <p>
              <strong>3.2. Prazos Operacionais:</strong> A apuração precisa de tributos e o cumprimento das obrigações acessórias dependem do envio tempestivo das informações pelo cliente dentro do cronograma fiscal pactuado.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', margin: '0 0 10px 0' }}>
              4. Nível de Serviço (SLA) e Disponibilidade
            </h2>
            <p>
              A PRIVILEGE compromete-se com a meta de 99% de disponibilidade mensal do portal do cliente, ressalvadas as janelas de manutenção preventiva programadas e indisponibilidades de webservices governamentais oficiais (Receita Federal, SEFAZ, Conectividade Social e Prefeituras).
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', margin: '0 0 10px 0' }}>
              5. Propriedade Intelectual
            </h2>
            <p>
              Os códigos, marcas, algoritmos de cálculo tributário, relatórios gerenciais e interfaces disponibilizadas pertencem com exclusividade à PRIVILEGE CONSULTORIA LTDA, sendo vedada qualquer prática de engenharia reversa, reprodução ou distribuição não autorizada.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', margin: '0 0 10px 0' }}>
              6. Legislação Aplicável e Foro
            </h2>
            <p>
              Este instrumento é regido pelas leis da República Federativa do Brasil. Para dirimir eventuais litígios que não possam ser solucionados consensualmente, as partes elegem o <strong>Foro da Comarca de Francisco Beltrão, Estado do Paraná</strong>, com renúncia a qualquer outro.
            </p>
          </section>

          <section style={{ background: '#f5f5f7', border: '1px solid #e5e5e5', borderRadius: '16px', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111', margin: '0 0 12px 0' }}>
              Dúvidas ou Esclarecimentos
            </h2>
            <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={16} color="#600000" />
                <span><strong>E-mail:</strong> contato@privilegecontabilidade.cnt.br</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={16} color="#600000" />
                <span><strong>Telefone:</strong> (46) 3035-1018</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} color="#600000" />
                <span><strong>Endereço:</strong> Rua Pará, 127, Sala 03, Centro, Francisco Beltrão – PR, CEP 85601-290</span>
              </div>
            </div>
          </section>
        </article>
      </main>

      {/* Footer com NAP Text */}
      <footer style={{ borderTop: '1px solid #e5e5e5', background: '#111', color: '#a3a3a3', padding: '36px 24px', fontSize: '13px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <strong style={{ color: '#fff' }}>Privilege Contabilidade e Consultoria</strong> · Privilege Consultoria Ltda (CNPJ 58.033.979/0001-84)<br />
            Rua Pará, 127, Sala 03 – Centro, Francisco Beltrão – PR, CEP 85601-290 · Telefone: (46) 3035-1018
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link href="/" style={{ color: '#fff', textDecoration: 'none' }}>Início</Link>
            <Link href="/privacidade" style={{ color: '#fff', textDecoration: 'none' }}>Privacidade</Link>
            <Link href="/login" style={{ color: '#fff', textDecoration: 'none' }}>Área do Cliente</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

