'use client';

import { useRouter } from 'next/navigation';
import { MessageSquare, ArrowLeft } from 'lucide-react';

export default function ClienteWhatsAppPage() {
  const router = useRouter();

  return (
    <div className="page-body" style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
      <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center', padding: 28 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: '#f0fdf4',
            color: '#15803d',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <MessageSquare size={26} />
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 8px' }}>Atendimento Privilege</h2>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 20px' }}>
          O painel interno de mensagens é restrito à equipe do escritório. Para falar diretamente com o seu consultor, clique no botão abaixo.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push('/cliente/dashboard')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={15} /> Voltar ao Início
          </button>
          <a
            href="https://wa.me/5546999048990?text=Ol%C3%A1%2C%20preciso%20falar%20com%20meu%20consultor%20da%20Privilege."
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ background: '#15803d', borderColor: '#15803d', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <MessageSquare size={15} /> Falar no WhatsApp Oficial
          </a>
        </div>
      </div>
    </div>
  );
}
