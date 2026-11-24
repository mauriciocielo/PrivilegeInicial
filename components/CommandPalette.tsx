'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Search, Building2, CornerDownLeft, X, type LucideIcon,
} from 'lucide-react';
import type { Empresa } from '../lib/store';
import { formatarCpfCnpj } from '../lib/formatar-documento';

export interface CommandNavSection {
  section: string;
  items: { label: string; href: string; icon: LucideIcon }[];
}

interface CommandItem {
  id: string;
  /** Cabeçalho do grupo: a área do menu (Administrativo, Financeiro...) ou "Trocar empresa". */
  group: string;
  tipo: 'tela' | 'empresa';
  label: string;
  subtitle: string;
  keywords: string;
  icon: LucideIcon;
  active?: boolean;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  navSections: CommandNavSection[];
  empresas: Empresa[];
  selectedEmpresaId: string;
  currentPath: string;
  onNavigate: (href: string) => void;
  onSelectEmpresa: (empresaId: string) => void;
}

const teclaEstilo: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 12,
  padding: '1px 6px',
  borderRadius: 5,
  border: '1px solid var(--border, #e5e5e5)',
  background: 'var(--bg-base, #f8f8f8)',
  color: 'var(--text-secondary, #525252)',
};

function norm(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function CommandPalette({
  open,
  onClose,
  navSections,
  empresas,
  selectedEmpresaId,
  currentPath,
  onNavigate,
  onSelectEmpresa,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const allItems = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];

    // 1. Telas permitidas
    for (const sec of navSections) {
      for (const item of sec.items) {
        list.push({
          id: `nav:${item.href}`,
          group: sec.section,
          tipo: 'tela',
          label: item.label,
          subtitle: sec.section,
          keywords: `${item.label} ${sec.section} ${item.href}`,
          icon: item.icon,
          active: currentPath === item.href,
          onSelect: () => {
            onNavigate(item.href);
            onClose();
          },
        });
      }
    }

    // 2. Empresas disponíveis
    for (const emp of empresas) {
      const nome = emp.nomeFantasia || emp.razaoSocial || 'Empresa';
      list.push({
        id: `emp:${emp.id}`,
        group: 'Trocar empresa',
        tipo: 'empresa',
        label: nome,
        subtitle: emp.cnpj ? formatarCpfCnpj(emp.cnpj) : '',
        keywords: `${nome} ${emp.razaoSocial || ''} ${emp.cnpj || ''} ${(emp.cnpj || '').replace(/\D/g, '')}`,
        icon: Building2,
        active: emp.id === selectedEmpresaId,
        onSelect: () => {
          onSelectEmpresa(emp.id);
          onClose();
        },
      });
    }

    return list;
  }, [navSections, empresas, selectedEmpresaId, currentPath, onNavigate, onSelectEmpresa, onClose]);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) {
      // Sem busca: empresas primeiro (até 5) e depois todas as telas, agrupadas por área
      const emps = allItems.filter(i => i.tipo === 'empresa').slice(0, 5);
      const telas = allItems.filter(i => i.tipo === 'tela');
      return [...emps, ...telas];
    }
    const termos = q.split(/\s+/).filter(Boolean);
    return allItems
      .filter(item => {
        const hay = norm(item.keywords);
        return termos.every(t => hay.includes(t));
      })
      .slice(0, 24);
  }, [allItems, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => (filtered.length ? (i + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
      } else if (e.key === 'Enter' && filtered[activeIndex]) {
        e.preventDefault();
        filtered[activeIndex].onSelect();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, filtered, activeIndex, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  // Agrupa mantendo ordem
  const groups: { name: string; items: { item: CommandItem; flatIdx: number }[] }[] = [];
  filtered.forEach((item, flatIdx) => {
    let g = groups.find(x => x.name === item.group);
    if (!g) {
      g = { name: item.group, items: [] };
      groups.push(g);
    }
    g.items.push({ item, flatIdx });
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Busca rápida do sistema"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '10vh 16px 24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 620,
          background: 'var(--bg-card, #ffffff)',
          color: 'var(--text-primary, #171717)',
          borderRadius: 16,
          border: '1px solid var(--border, #e5e5e5)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.22)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '76vh',
        }}
      >
        {/* Campo de busca */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: '1px solid var(--border, #ececec)',
          }}
        >
          <Search size={18} style={{ color: '#600000', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar tela ou empresa (nome ou CNPJ)"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              color: 'inherit',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #737373)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Lista de resultados */}
        <div ref={listRef} style={{ overflowY: 'auto', padding: '6px 8px 10px', flex: 1 }}>
          {groups.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted, #737373)' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Nada encontrado</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>Tente pelo nome da tela (NFS-e, Lançamentos...) ou pelo nome ou CNPJ da empresa.</div>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.name} style={{ marginTop: 6 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--text-muted, #737373)',
                    padding: '8px 10px 4px',
                  }}
                >
                  {group.name}
                </div>
                {group.items.map(({ item, flatIdx }) => {
                  const isSelected = flatIdx === activeIndex;
                  const Icon = item.icon;
                  // Na busca, as telas mostram a área à direita para diferenciar nomes parecidos.
                  const detalhe = item.tipo === 'empresa' ? item.subtitle : (query ? item.subtitle : '');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-cmd-idx={flatIdx}
                      onMouseEnter={() => setActiveIndex(flatIdx)}
                      onClick={item.onSelect}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: isSelected ? 'rgba(96, 0, 0, 0.07)' : 'transparent',
                        color: 'inherit',
                        fontSize: 14.5,
                        transition: 'background 0.12s',
                      }}
                    >
                      <Icon size={17} style={{ flexShrink: 0, color: isSelected ? '#600000' : 'var(--text-muted, #737373)' }} />
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontWeight: isSelected ? 600 : 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.label}
                      </span>
                      {item.active && (
                        <span style={{ fontSize: 12, fontWeight: 600, padding: '1px 8px', borderRadius: 99, background: '#dcfce7', color: '#15803d', flexShrink: 0 }}>
                          {item.tipo === 'empresa' ? 'Atual' : 'Você está aqui'}
                        </span>
                      )}
                      {detalhe && (
                        <span style={{ fontSize: 13, color: 'var(--text-muted, #737373)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                          {detalhe}
                        </span>
                      )}
                      {isSelected && <CornerDownLeft size={14} style={{ color: '#600000', flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Rodapé de atalhos */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '9px 16px',
            borderTop: '1px solid var(--border, #ececec)',
            fontSize: 13,
            color: 'var(--text-muted, #737373)',
          }}
        >
          <span><kbd style={teclaEstilo}>↑</kbd> <kbd style={teclaEstilo}>↓</kbd> navegar</span>
          <span><kbd style={teclaEstilo}>Enter</kbd> abrir</span>
          <span><kbd style={teclaEstilo}>Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
