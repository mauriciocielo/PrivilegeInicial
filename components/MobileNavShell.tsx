'use client';

import { useState } from 'react';
import {
  X, ChevronDown, LayoutDashboard, NotebookPen, ReceiptText, MessageSquare, Menu,
  Building2, Sun, Moon, LogOut, Search, type LucideIcon,
} from 'lucide-react';
import type { Empresa } from '../lib/store';

export interface MobileNavSection {
  section: string;
  items: { label: string; href: string; icon: LucideIcon }[];
}

interface MobileNavShellProps {
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
  onOpenSearch: () => void;
  navSections: MobileNavSection[];
  pathname: string;
  role: string;
  userName?: string;
  userEmail?: string;
  activeEmpresa?: Empresa | null;
  selectableEmpresas: Empresa[];
  selectedEmpresaId: string;
  onSelectEmpresa: (id: string) => void;
  onNavigate: (href: string) => void;
  theme: string;
  onToggleTheme: () => void;
  onLogout: () => void;
}

export default function MobileNavShell({
  drawerOpen,
  onOpenDrawer,
  onCloseDrawer,
  onOpenSearch,
  navSections,
  pathname,
  role,
  userName,
  userEmail,
  activeEmpresa,
  selectableEmpresas,
  selectedEmpresaId,
  onSelectEmpresa,
  onNavigate,
  theme,
  onToggleTheme,
  onLogout,
}: MobileNavShellProps) {
  const [expandedSection, setExpandedSection] = useState<string>(navSections[0]?.section || '');
  const prefixo = role === 'cliente' ? '/cliente' : '/consultor';

  const bottomTabs = [
    { label: 'Início', href: `${prefixo}/dashboard`, icon: LayoutDashboard },
    { label: 'Lançam.', href: `${prefixo}/lancamentos`, icon: NotebookPen },
    { label: 'NFS-e', href: `${prefixo}/nfse`, icon: ReceiptText },
    { label: 'WhatsApp', href: `${prefixo}/whatsapp`, icon: MessageSquare },
  ];

  return (
    <>
      {/* DRAWER LATERAL (Mobile & Tablet <= 1024px) */}
      {drawerOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={onCloseDrawer}
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          <aside
            className="mobile-drawer-panel"
            onClick={e => e.stopPropagation()}
          >
            {/* Topo do Drawer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: '1px solid var(--border, #ececec)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #171717)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userName || 'Privilege Gestão'}
                </div>
                {userEmail && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted, #737373)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {userEmail}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onCloseDrawer}
                aria-label="Fechar menu"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: '1px solid var(--border, #e5e5e5)',
                  background: 'var(--bg-base, #f8f8f8)',
                  color: 'var(--text-primary, #171717)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Busca rápida + Seletor de Empresa */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border, #ececec)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  onCloseDrawer();
                  onOpenSearch();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--border, #e5e5e5)',
                  background: 'var(--bg-base, #fafafa)',
                  color: 'var(--text-muted, #525252)',
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Search size={14} style={{ color: '#600000' }} />
                <span>Buscar tela ou empresa...</span>
              </button>

              {selectableEmpresas.length > 0 && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #737373)', marginBottom: 4 }}>
                    <Building2 size={11} style={{ color: '#600000' }} /> Empresa Ativa
                  </label>
                  <select
                    value={selectedEmpresaId}
                    onChange={e => {
                      onSelectEmpresa(e.target.value);
                      onCloseDrawer();
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid var(--border, #e5e5e5)',
                      background: 'var(--bg-card, #ffffff)',
                      color: 'var(--text-primary, #171717)',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {selectableEmpresas.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nomeFantasia || emp.razaoSocial}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Seções em Acordeão */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 16px' }}>
              {navSections.map(sec => {
                const isOpen = expandedSection === sec.section || sec.items.some(i => i.href === pathname);
                return (
                  <div key={sec.section} style={{ marginBottom: 6 }}>
                    <button
                      type="button"
                      onClick={() => setExpandedSection(prev => (prev === sec.section ? '' : sec.section))}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: 'none',
                        background: isOpen ? 'rgba(96, 0, 0, 0.06)' : 'transparent',
                        color: isOpen ? '#600000' : 'var(--text-primary, #171717)',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <span>{sec.section}</span>
                      <ChevronDown
                        size={15}
                        style={{
                          transition: 'transform 0.2s',
                          transform: isOpen ? 'rotate(180deg)' : 'none',
                        }}
                      />
                    </button>

                    {isOpen && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0 4px 6px' }}>
                        {sec.items.map(item => {
                          const Icon = item.icon;
                          const active = pathname === item.href;
                          return (
                            <button
                              key={item.href}
                              type="button"
                              onClick={() => {
                                onCloseDrawer();
                                onNavigate(item.href);
                              }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: 'none',
                                background: active ? '#600000' : 'transparent',
                                color: active ? '#ffffff' : 'var(--text-primary, #262626)',
                                fontSize: 13.5,
                                fontWeight: active ? 600 : 500,
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <Icon size={16} style={{ flexShrink: 0, opacity: active ? 1 : 0.75 }} />
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rodapé do Drawer */}
            <div
              style={{
                padding: '12px 14px',
                borderTop: '1px solid var(--border, #ececec)',
                display: 'flex',
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={onToggleTheme}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {theme === 'dark' ? <><Sun size={14} /> Claro</> : <><Moon size={14} /> Escuro</>}
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseDrawer();
                  onLogout();
                }}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#dc2626' }}
              >
                <LogOut size={14} /> Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* BARRA INFERIOR FIXA (Bottom Tab Bar — apenas Celular <= 768px) */}
      <nav className="mobile-bottom-bar no-print" aria-label="Navegação rápida mobile">
        {bottomTabs.map(tab => {
          const Icon = tab.icon;
          const active = pathname === tab.href || (tab.href.endsWith('/dashboard') && pathname?.endsWith('/dashboard2'));
          return (
            <button
              key={tab.href}
              type="button"
              onClick={() => onNavigate(tab.href)}
              className={`mobile-bottom-tab ${active ? 'active' : ''}`}
            >
              <Icon size={19} strokeWidth={active ? 2.3 : 1.9} />
              <span>{tab.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenDrawer}
          className={`mobile-bottom-tab ${drawerOpen ? 'active' : ''}`}
        >
          <Menu size={19} strokeWidth={2} />
          <span>Menu</span>
        </button>
      </nav>
    </>
  );
}
