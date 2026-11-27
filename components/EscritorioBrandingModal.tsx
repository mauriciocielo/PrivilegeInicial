'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Palette, Upload, Trash2, X, Check } from 'lucide-react';

export interface BrandingState {
  customizado?: boolean;
  escritorioId?: string;
  nome?: string;
  corPrimaria?: string | null;
  corSecundaria?: string | null;
  logoData?: string | null;
  podeEditar?: boolean;
}

const PALETAS_PRONTAS = [
  { nome: 'Azul Royal', primaria: '#1d4ed8', secundaria: '#1e3a8a' },
  { nome: 'Verde Esmeralda', primaria: '#047857', secundaria: '#065f46' },
  { nome: 'Vinho Clássico', primaria: '#600000', secundaria: '#450000' },
  { nome: 'Petróleo', primaria: '#0f766e', secundaria: '#115e59' },
  { nome: 'Grafite', primaria: '#1f2937', secundaria: '#111827' },
  { nome: 'Índigo', primaria: '#4338ca', secundaria: '#312e81' },
  { nome: 'Terracota', primaria: '#c2410c', secundaria: '#9a3412' },
  { nome: 'Dourado Escuro', primaria: '#a16207', secundaria: '#713f12' },
];

function hexParaRgb(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return '96, 0, 0';
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
}

export function aplicarTemaWhiteLabel(branding: BrandingState | null) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (branding?.corPrimaria && /^#[0-9a-fA-F]{6}$/.test(branding.corPrimaria)) {
    const prim = branding.corPrimaria;
    const sec = branding.corSecundaria && /^#[0-9a-fA-F]{6}$/.test(branding.corSecundaria) ? branding.corSecundaria : prim;
    const rgb = hexParaRgb(prim);
    root.style.setProperty('--accent', prim);
    root.style.setProperty('--accent-dark', sec);
    root.style.setProperty('--accent-light', prim);
    root.style.setProperty('--accent-glow', `rgba(${rgb}, 0.14)`);
    root.style.setProperty('--wine', prim);
  } else {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-dark');
    root.style.removeProperty('--accent-light');
    root.style.removeProperty('--accent-glow');
    root.style.removeProperty('--wine');
  }
}

interface Props {
  brandingAtual: BrandingState;
  onFechar: () => void;
  onSalvo: (novo: BrandingState) => void;
}

export default function EscritorioBrandingModal({ brandingAtual, onFechar, onSalvo }: Props) {
  const [mounted, setMounted] = useState(false);
  const [nome, setNome] = useState(brandingAtual.nome || '');
  const [corPrimaria, setCorPrimaria] = useState(brandingAtual.corPrimaria || '#1d4ed8');
  const [corSecundaria, setCorSecundaria] = useState(brandingAtual.corSecundaria || '#1e3a8a');
  const [logoData, setLogoData] = useState<string | null>(brandingAtual.logoData || null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem PNG, JPG, WebP ou SVG.');
      return;
    }
    if (file.size > 1.2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 1,2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogoData(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const res = await fetch('/api/escritorio/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          corPrimaria,
          corSecundaria,
          logoData: logoData ?? '',
        }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(dados.error || 'Erro ao salvar personalização.');
        return;
      }
      const novo: BrandingState = {
        customizado: true,
        ...(dados.branding || { nome, corPrimaria, corSecundaria, logoData, podeEditar: true }),
      };
      aplicarTemaWhiteLabel(novo);
      try {
        sessionStorage.setItem('cf_brand_whitelabel', JSON.stringify(novo));
      } catch {
        // ignora
      }
      onSalvo(novo);
      toast.success('Identidade visual salva! Já está ativa no seu painel e no painel de todos os seus clientes.');
      onFechar();
    } catch {
      toast.error('Erro de conexão ao salvar personalização.');
    } finally {
      setSalvando(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onFechar}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 620,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: `${corPrimaria}1f`, color: corPrimaria, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Palette size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>Personalizar Painel do Escritório</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                A logo e as cores definidas aqui aparecem no seu painel e para todos os seus clientes
              </p>
            </div>
          </div>
          <button type="button" onClick={onFechar} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Prévia ao vivo */}
          <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: '#ffffff', borderBottom: `3px solid ${corPrimaria}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {logoData ? (
                  <img src={logoData} alt="Logo" style={{ height: 34, maxWidth: 140, objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontWeight: 800, fontSize: 15, color: corPrimaria }}>{nome || 'Seu Escritório Contábil'}</span>
                )}
              </div>
              <span style={{ background: corPrimaria, color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 8 }}>
                Botão Principal
              </span>
            </div>
            <div style={{ padding: '8px 16px', background: '#f9fafb', fontSize: 12, color: '#6b7280' }}>
              Pré-visualização do cabeçalho exibido para os seus clientes
            </div>
          </div>

          {/* Nome */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nome de Exibição do Escritório</label>
            <input
              className="form-control"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex.: Contabilidade Exemplo"
            />
          </div>

          {/* Logo */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Logo do Escritório (PNG, JPG ou SVG)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: '#111827',
                }}
              >
                <Upload size={14} /> Enviar Logo
                <input type="file" accept="image/*" onChange={handleUploadLogo} style={{ display: 'none' }} />
              </label>
              {logoData && (
                <button
                  type="button"
                  onClick={() => setLogoData(null)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #fecaca',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: '#b91c1c',
                  }}
                >
                  <Trash2 size={14} /> Remover Logo
                </button>
              )}
            </div>
          </div>

          {/* Paletas prontas */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Paletas Prontas</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PALETAS_PRONTAS.map(p => {
                const selecionada = corPrimaria.toLowerCase() === p.primaria.toLowerCase();
                return (
                  <button
                    key={p.nome}
                    type="button"
                    onClick={() => { setCorPrimaria(p.primaria); setCorSecundaria(p.secundaria); }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 10px',
                      borderRadius: 99,
                      border: `2px solid ${selecionada ? p.primaria : '#e5e7eb'}`,
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: '#111827',
                    }}
                  >
                    <span style={{ width: 14, height: 14, borderRadius: '50%', background: p.primaria, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      {selecionada && <Check size={9} />}
                    </span>
                    {p.nome}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seletores manuais de cor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Cor Primária</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={corPrimaria} onChange={e => setCorPrimaria(e.target.value)} style={{ width: 42, height: 36, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                <input className="form-control" value={corPrimaria} onChange={e => setCorPrimaria(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Cor Secundária</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={corSecundaria} onChange={e => setCorSecundaria(e.target.value)} style={{ width: 42, height: 36, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                <input className="form-control" value={corSecundaria} onChange={e => setCorSecundaria(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onFechar} className="btn btn-secondary">Cancelar</button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            className="btn"
            style={{ background: corPrimaria, color: '#fff', border: 'none', fontWeight: 700 }}
          >
            {salvando ? 'Salvando...' : 'Salvar Identidade Visual'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
