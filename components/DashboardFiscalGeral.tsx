'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Instrument_Serif } from 'next/font/google';
import {
  ShieldCheck, FileText, Activity, Building2, Play, RefreshCw,
  Plus, CheckCircle2, AlertTriangle, XCircle, Truck, Inbox,
  Clock, Moon, Sun, ArrowUpRight, ArrowDownLeft, KeyRound, Sparkles, FileSearch
} from 'lucide-react';
import { toast } from 'sonner';
import { store } from '../lib/store';
import NfeDestinadasPainel from './NfeDestinadasPainel';
import PainelSituacaoFiscal from './PainelSituacaoFiscal';
import NfeMonitorLogsPainel from './NfeMonitorLogsPainel';
import CadastrarCnpjModal from './CadastrarCnpjModal';

const serif = Instrument_Serif({ subsets: ['latin'], weight: ['400'] });

interface ResumoFiscal {
  totalEmpresas: number;
  ehHorarioNoturno: boolean;
  notas: {
    totalGeral: number;
    totalNfe: number;
    totalCte: number;
    totalNfeEmitidas: number;
    totalNfeRecebidas: number;
    totalNfse: number;
    totalNfseEmitidas: number;
    totalNfseTomadas: number;
    valorTotal: number;
  };
  cnds: {
    total: number;
    semPendencias: number;
    comEfeito: number;
    comPendencias: number;
    atencao: number;
    naoConsultadas: number;
  };
  certificados: {
    totalEmpresas: number;
    comCertificado: number;
    comProcuracao: number;
    vencendo30d: number;
    vencidos: number;
    semCertificado: number;
  };
  monitor: {
    totalAtivos: number;
    erros24h: number;
    frequenciaMinutos: number;
  };
}

/** Cartão de indicador clicável: leva à aba correspondente e reage ao passar o mouse. */
function CartaoKpi({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      style={{
        background: '#ffffff',
        border: `1px solid ${hover ? '#d1d5db' : '#e5e7eb'}`,
        borderRadius: 16,
        padding: 20,
        boxShadow: hover ? '0 12px 24px -8px rgba(0,0,0,0.12)' : '0 2px 4px rgba(0,0,0,0.02)',
        transform: hover ? 'translateY(-3px)' : 'none',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {children}
    </div>
  );
}

/** Esqueleto de carregamento para o número do KPI, no lugar do traço. */
function Skeleton({ width = 56 }: { width?: number }) {
  return (
    <span
      className="animate-pulse"
      style={{ display: 'inline-block', width, height: 26, borderRadius: 6, background: '#e5e7eb', marginTop: 8 }}
    />
  );
}

export default function DashboardFiscalGeral() {
  const router = useRouter();
  const [abaAtiva, setAbaAtiva] = useState<'notas' | 'cnd' | 'logs' | 'execucao'>('notas');
  const [resumo, setResumo] = useState<ResumoFiscal | null>(null);
  const [carregandoResumo, setCarregandoResumo] = useState(true);
  const [executandoLote, setExecutandoLote] = useState(false);
  const [showCadastrarModal, setShowCadastrarModal] = useState(false);
  const [isCliente, setIsCliente] = useState(false);
  const [horaAtualizacao, setHoraAtualizacao] = useState<string | null>(null);

  useEffect(() => {
    const u = store.getCurrentUser();
    if (u?.role === 'cliente') setIsCliente(true);
  }, []);

  const carregarResumo = useCallback(async () => {
    try {
      setCarregandoResumo(true);
      const res = await fetch('/api/dashboard2/resumo');
      if (!res.ok) throw new Error('Falha ao obter métricas');
      const data = await res.json();
      setResumo(data.resumo || null);
      setHoraAtualizacao(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Erro ao carregar resumo do dashboard fiscal:', err);
    } finally {
      setCarregandoResumo(false);
    }
  }, []);

  useEffect(() => {
    carregarResumo();
  }, [carregarResumo]);

  const dispararExecutarTodos = async () => {
    try {
      setExecutandoLote(true);
      toast.info('Iniciando sincronização completa de todos os clientes...');
      const res = await fetch('/api/nfe/monitor/executar', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.iniciado) {
        toast.success(data.mensagem || 'Rodada concluída com sucesso!');
        setTimeout(() => carregarResumo(), 1500);
      } else {
        toast.warning(data.mensagem || 'Não foi possível iniciar a rodada.');
      }
    } catch {
      toast.error('Erro ao acionar a rodada do monitor fiscal.');
    } finally {
      setExecutandoLote(false);
    }
  };

  const valorFormatado = (val?: number) => {
    if (!val && val !== 0) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
          color: '#ffffff',
          borderRadius: 20,
          padding: '28px 32px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span
              style={{
                background: '#600000',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '3px 10px',
                borderRadius: 99,
              }}
            >
              {isCliente ? 'Dashboard Fiscal • Documentos & CNDs' : 'Dashboard 2 • Torre de Controle Fiscal'}
            </span>
            {resumo?.ehHorarioNoturno ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#c4b5fd' }}>
                <Moon size={12} /> Janela Noturna SEFAZ Ativa
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#fde68a' }}>
                <Sun size={12} /> Horário Diurno (NFS-e 24/7)
              </span>
            )}
          </div>
          <h1
            className={serif.className}
            style={{
              fontSize: 34,
              fontWeight: 400,
              margin: '0 0 4px 0',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            {isCliente ? 'Painel Fiscal: Notas Fiscais & CNDs' : 'Monitoramento de Notas Fiscais & CNDs de Todos os Clientes'}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
            {isCliente
              ? 'Visão consolidada de NF-e (Mercadorias), CT-e (Fretes), NFS-e (Serviços) e certidões negativas da sua empresa.'
              : 'Visão consolidada de NF-e, CT-e, NFS-e, certidões negativas e auditoria contínua da carteira.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={dispararExecutarTodos}
            disabled={executandoLote}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#600000',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.15)',
              padding: '12px 22px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              cursor: executandoLote ? 'wait' : 'pointer',
              boxShadow: '0 4px 12px rgba(96,0,0,0.3)',
              transition: 'transform 0.15s ease',
            }}
          >
            <Play size={14} fill="#ffffff" />
            {executandoLote ? 'Sincronizando...' : (isCliente ? 'Sincronizar Documentos Agora' : 'Executar de Todos os Clientes')}
          </button>

          {!isCliente && (
            <button
              type="button"
              onClick={() => setShowCadastrarModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '12px 18px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              Cadastrar CNPJ / Importar
            </button>
          )}

          <button
            type="button"
            onClick={() => router.push(isCliente ? '/cliente/comparador-sped' : '/consultor/comparador-sped')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.1)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '12px 18px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
            title="Abrir ferramenta de auditoria e cruzamento de arquivo SPED com notas do sistema"
          >
            <FileSearch size={14} />
            Comparar SPED
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('abrirCopilotoFiscal'))}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: 'rgba(124,58,237,0.18)',
              color: '#e9d5ff',
              border: '1px solid rgba(167,139,250,0.4)',
              padding: '12px 18px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Abrir o assistente de IA com o contexto fiscal da carteira"
          >
            <Sparkles size={14} />
            Analista IA
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <button
              type="button"
              onClick={carregarResumo}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#ffffff',
                cursor: 'pointer',
              }}
              title="Recarregar Indicadores"
            >
              <RefreshCw size={15} className={carregandoResumo ? 'animate-spin' : ''} />
            </button>
            {horaAtualizacao && (
              <span style={{ fontSize: 9.5, color: '#9ca3af' }}>{horaAtualizacao}</span>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        {/* Card 1: Notas Fiscais */}
        <CartaoKpi onClick={() => setAbaAtiva('notas')}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
                Todas as Notas Fiscais
              </span>
              <span
                style={{
                  background: '#f3f4f6',
                  color: '#111827',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 99,
                }}
              >
                Carteira Consolidada
              </span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginTop: 8 }}>
              {resumo ? (resumo.notas.totalGeral).toLocaleString('pt-BR') : <Skeleton />}
            </div>
            <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
              {valorFormatado(resumo?.notas.valorTotal)} movimentados
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid #f3f4f6',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: '#6b7280',
            }}
          >
            <span>📦 {resumo?.notas.totalNfe || 0} NF-e</span>
            <span>🚚 {resumo?.notas.totalCte || 0} CT-e</span>
            <span>📑 {resumo?.notas.totalNfse || 0} NFS-e</span>
          </div>
        </CartaoKpi>

        {/* Card 2: CNDs & Situação Fiscal */}
        <CartaoKpi onClick={() => setAbaAtiva('cnd')}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
                Conformidade Fiscal & CNDs
              </span>
              <span
                style={{
                  background: (resumo?.cnds.comPendencias || 0) > 0 ? '#fef2f2' : '#f0fdf4',
                  color: (resumo?.cnds.comPendencias || 0) > 0 ? '#dc2626' : '#16a34a',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 99,
                }}
              >
                {(resumo?.cnds.comPendencias || 0) > 0 ? `${resumo?.cnds.comPendencias} com débito` : '100% Regulares'}
              </span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginTop: 8 }}>
              {!resumo ? <Skeleton /> : <>{resumo.cnds.semPendencias || 0}{' '}
              <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}>
                / {resumo.totalEmpresas || 0} empresas
              </span></>}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Certidões Negativas Federais / Estaduais
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid #f3f4f6',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: '#6b7280',
            }}
          >
            <span style={{ color: '#16a34a' }}>✓ {resumo?.cnds.semPendencias || 0} Sem débito</span>
            <span style={{ color: '#0284c7' }}>⚖ {resumo?.cnds.comEfeito || 0} Suspensos</span>
            <span style={{ color: '#dc2626' }}>✗ {resumo?.cnds.comPendencias || 0} Débitos</span>
          </div>
        </CartaoKpi>

        {/* Card 3: Certificados Digitais A1 */}
        <CartaoKpi onClick={() => setAbaAtiva('execucao')}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
                Certificados A1 no Cofre
              </span>
              {(resumo?.certificados.vencendo30d || 0) > 0 && (
                <span
                  style={{
                    background: '#fef3c7',
                    color: '#b45309',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 99,
                  }}
                >
                  {resumo?.certificados.vencendo30d} vencendo
                </span>
              )}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginTop: 8 }}>
              {!resumo ? <Skeleton /> : <>{resumo.certificados.comCertificado || 0}{' '}
              <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}>
                com A1 ativo
              </span></>}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {resumo?.certificados.comProcuracao || 0} operam com procuração eletrônica
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid #f3f4f6',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: '#6b7280',
            }}
          >
            <span>🔒 AES-256 Cofre</span>
            <span style={{ color: (resumo?.certificados.vencidos || 0) > 0 ? '#dc2626' : '#6b7280' }}>
              {resumo?.certificados.vencidos || 0} expirados
            </span>
            <span>{resumo?.certificados.semCertificado || 0} sem A1</span>
          </div>
        </CartaoKpi>

        {/* Card 4: Monitor & Auditoria */}
        <CartaoKpi onClick={() => setAbaAtiva('logs')}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
                Monitor em Segundo Plano
              </span>
              <span
                style={{
                  background: '#f0fdf4',
                  color: '#16a34a',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 99,
                }}
              >
                A cada 10 min
              </span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginTop: 8 }}>
              {!resumo ? <Skeleton /> : <>{resumo.monitor.totalAtivos || 0}{' '}
              <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}>empresas</span></>}
            </div>
            <div style={{ fontSize: 12, color: (resumo?.monitor.erros24h || 0) > 0 ? '#dc2626' : '#16a34a', marginTop: 2, fontWeight: 500 }}>
              {(resumo?.monitor.erros24h || 0) > 0
                ? `${resumo?.monitor.erros24h} ocorrência(s) nas últimas 24h`
                : '100% saudável nas últimas 24h'}
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid #f3f4f6',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: '#6b7280',
            }}
          >
            <span>⏰ Noturno: 21h-07h</span>
            <span>🌐 NFS-e 24/7</span>
            <span
              onClick={() => setAbaAtiva('logs')}
              style={{ color: '#600000', fontWeight: 600, cursor: 'pointer' }}
            >
              Ver Logs →
            </span>
          </div>
        </CartaoKpi>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: 4,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'inline-flex', background: '#f3f4f6', padding: 4, borderRadius: 12, gap: 4 }}>
          <button
            type="button"
            onClick={() => setAbaAtiva('notas')}
            style={{
              background: abaAtiva === 'notas' ? '#600000' : 'transparent',
              color: abaAtiva === 'notas' ? '#ffffff' : '#374151',
              border: 'none',
              padding: '8px 18px',
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Inbox size={14} />
            Todas as Notas Fiscais
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('cnd')}
            style={{
              background: abaAtiva === 'cnd' ? '#600000' : 'transparent',
              color: abaAtiva === 'cnd' ? '#ffffff' : '#374151',
              border: 'none',
              padding: '8px 18px',
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ShieldCheck size={14} />
            CNDs & Situação Fiscal
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('logs')}
            style={{
              background: abaAtiva === 'logs' ? '#600000' : 'transparent',
              color: abaAtiva === 'logs' ? '#ffffff' : '#374151',
              border: 'none',
              padding: '8px 18px',
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Activity size={14} />
            {isCliente ? 'Logs de Auditoria' : 'Logs de Todos os Clientes'}
            {(resumo?.monitor.erros24h || 0) > 0 && (
              <span
                style={{
                  background: '#fee2e2',
                  color: '#991b1b',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 99,
                  marginLeft: 2,
                }}
              >
                {resumo?.monitor.erros24h}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('execucao')}
            style={{
              background: abaAtiva === 'execucao' ? '#600000' : 'transparent',
              color: abaAtiva === 'execucao' ? '#ffffff' : '#374151',
              border: 'none',
              padding: '8px 18px',
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Play size={14} />
            {isCliente ? 'Central de Sincronização' : 'Central de Execução'}
          </button>
        </div>
      </div>

      {/* Conteúdo Dinâmico das Abas */}
      {abaAtiva === 'notas' && (
        <div>
          <NfeDestinadasPainel />
        </div>
      )}

      {abaAtiva === 'cnd' && (
        <div>
          <PainelSituacaoFiscal />
        </div>
      )}

      {abaAtiva === 'logs' && (
        <div>
          <NfeMonitorLogsPainel ehHorarioNoturno={resumo?.ehHorarioNoturno} />
        </div>
      )}

      {abaAtiva === 'execucao' && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 20,
            padding: 32,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 6px 0' }}>
              Central de Disparo & Sincronização em Segundo Plano
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
              Execute rotinas sob demanda para toda a carteira de empresas e acompanhe os retornos imediatamente.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 16,
                padding: 24,
                background: '#f9fafb',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Inbox size={20} color="#600000" />
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                    {isCliente ? 'Sincronização de Documentos' : 'Sincronização Completa (Todas)'}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                  {isCliente
                    ? 'Consulta em tempo real a SEFAZ (NF-e Mercadorias e CT-e Fretes) e o ADN Nacional (NFS-e emitidas e tomadas).'
                    : 'Consulta em paralelo a SEFAZ (NF-e Mercadorias e CT-e Fretes) e o ADN Nacional (NFS-e de Serviços emitidas e tomadas).'}
                </p>
              </div>
              <button
                type="button"
                onClick={dispararExecutarTodos}
                disabled={executandoLote}
                style={{
                  background: '#600000',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 18px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: executandoLote ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Play size={14} fill="#ffffff" />
                {executandoLote ? 'Executando...' : (isCliente ? 'Sincronizar Documentos Agora' : 'Executar de Todos os Clientes')}
              </button>
            </div>

            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 16,
                padding: 24,
                background: '#f9fafb',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <ShieldCheck size={20} color="#0284c7" />
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                    {isCliente ? 'Situação Fiscal & CNDs' : 'Varredura de CNDs'}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                  {isCliente
                    ? 'Acompanhe e emita certidões negativas de débitos e situação cadastral federal e estadual na Receita Federal.'
                    : 'Atualiza certidões negativas de débitos e situação cadastral federal e estadual na Receita Federal.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAbaAtiva('cnd');
                  toast.info('Abrindo painel de CNDs para consulta...');
                }}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 18px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <ShieldCheck size={14} />
                Abrir Painel de CNDs
              </button>
            </div>

            {!isCliente && (
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 16,
                  padding: 24,
                  background: '#f9fafb',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Building2 size={20} color="#16a34a" />
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                      Cadastro de Todos os Clientes
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                    Cadastre novos CNPJs, importe planilhas de clientes ou gerencie certificados digitais A1 da carteira.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCadastrarModal(true)}
                  style={{
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '12px 18px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Plus size={14} />
                  Cadastrar CNPJ / Importar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Cadastro de CNPJ */}
      {showCadastrarModal && (
        <CadastrarCnpjModal
          onFechar={() => setShowCadastrarModal(false)}
          onEmpresaCadastrada={() => {
            setShowCadastrarModal(false);
            toast.success('Empresa cadastrada com sucesso!');
            carregarResumo();
          }}
        />
      )}
    </div>
  );
}
