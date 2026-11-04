'use client';

import { useState } from 'react';
import CertidaoFederalModal from '../../../components/CertidaoFederalModal';

export default function CndFederalPage() {
  const [modalAberto, setModalAberto] = useState(true);

  return (
    <div className="container" style={{ padding: '24px 16px', maxWidth: 1000 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        background: 'var(--bg-card)',
        padding: '20px 24px',
        borderRadius: 12,
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #1e3a8a, #0284c7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 24,
          }}>
            🏛️
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Certidão Negativa de Débitos Federais (CND / SITFIS)
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Consulta e emissão oficial de relatórios de regularidade fiscal perante a Receita Federal do Brasil e PGFN via Integra Contador (SERPRO).
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModalAberto(true)}
          style={{
            background: 'linear-gradient(135deg, #1e3a8a, #0284c7)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          🔍 Nova Consulta de CND
        </button>
      </div>

      {modalAberto && (
        <CertidaoFederalModal
          onFechar={() => setModalAberto(false)}
        />
      )}

      <div style={{
        background: 'var(--bg-card)',
        padding: 24,
        borderRadius: 12,
        border: '1px solid var(--border)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Sobre as Certidões Federais</h3>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          A <strong>Certidão de Débitos Relativos a Créditos Tributários Federais e à Dívida Ativa da União</strong> abrange todos os créditos tributários federais administrados pela Receita Federal do Brasil (RFB) e as inscrições em Dívida Ativa da União administradas pela Procuradoria-Geral da Fazenda Nacional (PGFN).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 16 }}>
          <div style={{ background: 'var(--bg-card2)', padding: 16, borderRadius: 8, border: '1px solid var(--border-light)' }}>
            <div style={{ fontWeight: 600, color: '#10b981', marginBottom: 6 }}>✓ Certidão Negativa</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Emitida quando não constam pendências em nome do contribuinte perante a RFB e a PGFN.
            </div>
          </div>
          <div style={{ background: 'var(--bg-card2)', padding: 16, borderRadius: 8, border: '1px solid var(--border-light)' }}>
            <div style={{ fontWeight: 600, color: '#0284c7', marginBottom: 6 }}>✓ Positiva c/ Efeito de Negativa</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Constam débitos com exigibilidade suspensa (parcelamentos ativos, depósitos judiciais, recursos tempestivos). Possui os mesmos efeitos jurídicos da certidão negativa.
            </div>
          </div>
          <div style={{ background: 'var(--bg-card2)', padding: 16, borderRadius: 8, border: '1px solid var(--border-light)' }}>
            <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: 6 }}>⚠ Positiva (Com Pendências)</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Identificados débitos em cobrança ativa ou omissão de declarações obrigatórias (DCTFWeb, PGDAS-D, DEFIS, etc.).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
