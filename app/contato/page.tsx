import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ChevronRight, MapPin, Phone, Mail, Clock, MessageCircle, ExternalLink } from 'lucide-react';

const PAGE_TITLE = 'Contato e Localização em Francisco Beltrão';
const PAGE_DESC =
  'Entre em contato com a Privilege Contabilidade em Francisco Beltrão, PR. Rua Pará, 127, Sala 03, Centro. Telefone e WhatsApp (46) 3035-1018.';
const GOOGLE_MAPS_URL =
  'https://www.google.com/maps/place/?q=place_id:ChIJmbblyQdz8JQReoz1xenqkKA';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  alternates: {
    canonical: 'https://privilegecontabilidade.cnt.br/contato',
  },
  openGraph: {
    title: `${PAGE_TITLE} | Privilege`,
    description: PAGE_DESC,
    url: 'https://privilegecontabilidade.cnt.br/contato',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Privilege Contabilidade e Consultoria' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PAGE_TITLE} | Privilege`,
    description: PAGE_DESC,
    images: ['/og-image.png'],
  },
};

const contatoJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'ContactPage',
      '@id': 'https://privilegecontabilidade.cnt.br/contato#webpage',
      url: 'https://privilegecontabilidade.cnt.br/contato',
      name: `${PAGE_TITLE} | Privilege`,
      description: PAGE_DESC,
      mainEntity: {
        '@id': 'https://privilegecontabilidade.cnt.br/#organization',
      },
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
          name: 'Contato',
          item: 'https://privilegecontabilidade.cnt.br/contato',
        },
      ],
    },
  ],
};

export default function ContatoPage() {
  const whatsAppUrl =
    'https://wa.me/554630351018?text=Ol%C3%A1!%20Gostaria%20de%20conversar%20com%20a%20equipe%20da%20Privilege%20Contabilidade.';

  return (
    <div style={{ background: '#fdfdfd', color: '#171717', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contatoJsonLd) }}
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
          <span style={{ color: '#600000', fontWeight: 600 }}>Contato e Localização</span>
        </div>
      </nav>

      {/* Conteúdo Principal */}
      <main style={{ maxWidth: '1040px', width: '100%', margin: '0 auto', padding: '48px 24px 80px', flex: 1 }}>
        <div style={{ textAlign: 'center', maxWidth: '760px', margin: '0 auto 48px' }}>
          <span style={{ color: '#600000', fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'inline-block', marginBottom: '12px' }}>
            Atendimento em Francisco Beltrão e Todo o Brasil
          </span>
          <h1 style={{ fontSize: '42px', lineHeight: 1.15, fontWeight: 800, margin: '0 0 18px 0', color: '#111' }}>
            Fale com a Privilege Contabilidade e Consultoria
          </h1>
          <p style={{ fontSize: '18px', lineHeight: 1.6, color: '#525252', margin: 0 }}>
            Estamos prontos para atender sua empresa presencialmente em nossa sede no Centro de Francisco Beltrão (PR) ou por videoconferência e canais digitais.
          </p>
        </div>

        {/* Cards de Canais de Atendimento */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '20px', marginBottom: '48px' }}>
          <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '20px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Phone size={28} color="#600000" />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111' }}>Telefone Fixo & Celular</h2>
            <p style={{ fontSize: '14px', color: '#525252', margin: 0, lineHeight: 1.5 }}>
              Clique para ligar diretamente para o nosso escritório:
            </p>
            <a
              href="tel:+554630351018"
              style={{ fontSize: '18px', fontWeight: 700, color: '#600000', textDecoration: 'none', marginTop: 'auto' }}
            >
              (46) 3035-1018
            </a>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '20px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <MessageCircle size={28} color="#600000" />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111' }}>WhatsApp Direto</h2>
            <p style={{ fontSize: '14px', color: '#525252', margin: 0, lineHeight: 1.5 }}>
              Atendimento rápido com nossos consultores e contadores:
            </p>
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '15px', fontWeight: 700, color: '#600000', textDecoration: 'none', marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              Iniciar conversa no WhatsApp <ExternalLink size={14} />
            </a>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '20px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Mail size={28} color="#600000" />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111' }}>E-mail Corporativo</h2>
            <p style={{ fontSize: '14px', color: '#525252', margin: 0, lineHeight: 1.5 }}>
              Envie propostas, documentos fiscais ou solicitações:
            </p>
            <a
              href="mailto:contato@privilegecontabilidade.cnt.br"
              style={{ fontSize: '14px', fontWeight: 700, color: '#600000', textDecoration: 'none', marginTop: 'auto', wordBreak: 'break-all' }}
            >
              contato@privilegecontabilidade.cnt.br
            </a>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '20px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Clock size={28} color="#600000" />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111' }}>Horário e Endereço</h2>
            <p style={{ fontSize: '14px', color: '#525252', margin: 0, lineHeight: 1.5 }}>
              Rua Pará, 127, Sala 03 – Centro<br />
              Francisco Beltrão – PR, CEP 85601-290
            </p>
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111', marginTop: 'auto' }}>
              Segunda a Sexta: 08h às 18h
            </span>
          </div>
        </section>

        {/* Mapa Interativo e Link para a Ficha */}
        <section style={{ marginBottom: '56px', background: '#fff', border: '1px solid #e5e5e5', borderRadius: '24px', padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', color: '#111' }}>
                Localização no Centro de Francisco Beltrão
              </h2>
              <p style={{ fontSize: '14.5px', color: '#525252', margin: 0 }}>
                Rua Pará, nº 127, Sala 03, Centro — Francisco Beltrão/PR (CEP 85601-290)
              </p>
            </div>
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#f5f5f7',
                color: '#600000',
                padding: '10px 18px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '14px',
                textDecoration: 'none',
                border: '1px solid #e5e5e5',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <MapPin size={16} /> Abrir no Google Maps <ExternalLink size={14} />
            </a>
          </div>
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #e5e5e5', height: '450px' }}>
            <iframe
              title="Localização da Privilege Contabilidade e Consultoria no Google Maps"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d680.6595585526918!2d-53.04807995568665!3d-26.080225948924042!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94f07307c9e5b699%3A0xa090eae9c5f58c7a!2sPrivilege%20Contabilidade%20e%20Consultoria!5e1!3m2!1spt-BR!2sbr!4v1794247569116!5m2!1spt-BR!2sbr"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            ></iframe>
          </div>
        </section>

        {/* Responsáveis Técnicos */}
        <section>
          <h2 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 24px 0', color: '#111', textAlign: 'center' }}>
            Sócios e Responsáveis Técnicos
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '24px', padding: '28px', display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div style={{ width: '96px', height: '96px', borderRadius: '18px', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                <Image
                  src="/foto-marcos.jpg"
                  alt="Marcos Cancelier — Contador (CRC-PR 062232/O-1)"
                  fill
                  sizes="96px"
                  style={{ objectFit: 'cover', objectPosition: 'center 25%' }}
                />
              </div>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px 0', color: '#111' }}>Marcos Cancelier</h3>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#600000', marginBottom: '6px' }}>
                  Sócio-Diretor · CRC-PR 062232/O-1
                </div>
                <a
                  href="https://instagram.com/marcos.cancelier"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '13px', color: '#525252', textDecoration: 'none' }}
                >
                  @marcos.cancelier ↗
                </a>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '24px', padding: '28px', display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div style={{ width: '96px', height: '96px', borderRadius: '18px', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                <Image
                  src="/foto-mauricio.jpg"
                  alt="Mauricio Cielo — Contador (CRC-PR 082974/O-7)"
                  fill
                  sizes="96px"
                  style={{ objectFit: 'cover', objectPosition: 'center center' }}
                />
              </div>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px 0', color: '#111' }}>Mauricio Cielo</h3>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#600000', marginBottom: '6px' }}>
                  Sócio-Administrador · CRC-PR 082974/O-7
                </div>
                <a
                  href="https://instagram.com/mauricio.cielo"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '13px', color: '#525252', textDecoration: 'none' }}
                >
                  @mauricio.cielo ↗
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer com NAP Text e Links Clicáveis */}
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
            <Link href="/privacidade" style={{ color: '#fff', textDecoration: 'none' }}>Privacidade</Link>
            <Link href="/termos" style={{ color: '#fff', textDecoration: 'none' }}>Termos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

