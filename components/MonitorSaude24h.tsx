'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity, Database, MessageSquare, Mail, ShieldAlert, RefreshCw, Play, Send, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { KpiCard, StatusBadge, TableSkeleton } from './ui';

interface SaudePayload {
  atualizadoEm: string;
  uptimeSegundos: number;
  banco: { ok: boolean; latencyMs: number };
  whatsapp: {
    totalSessoes: number;
    conectadas: number;
    sessoes: Array<{ ownerId: string; status: string; conectada: boolean }>;
  };
  filas24h: {
    campanhasAtivas: number;
    campanhasPausadas: number;
    campanhasTotalRestante: number;
    emailsPendentes: number;
    emailsErros: number;
  };
  fiscal: {
    certificadosAlerta: Array<{ nome: string; validoAte: string; vencido: boolean; dias: number }>;
    nfseComErro: number;
  };
  integracoes: {
    gemini: boolean;
    serpro: boolean;
    smtp: boolean;
  };
}

function formatUptime(seg: number): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return `${h}h ${m}m`;
}

export default function MonitorSaude24h() {
  const [dados, setDados] = useState<SaudePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [rodandoDaemon, setRodandoDaemon] = useState(false);
  const [enviandoAlerta, setEnviandoAlerta] = useState(false);
  const [telefoneGestao, setTelefoneGestao] = useState('46999048990');
  const [telefoneCertificados, setTelefoneCertificados] = useState('4630351018');
  const [enviandoCertificados, setEnviandoCertificados] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/saude');
      if (!res.ok) throw new Error('Falha ao consultar saúde do servidor');
      const json = await res.json();
      setDados(json);
    } catch (e) {
      toast.error((e as Error).message || 'Erro ao carregar Monitor 24h');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 45_000);
    return () => clearInterval(t);
  }, [carregar]);

  const forcarPulso24h = async () => {
    setRodandoDaemon(true);
    try {
      const res = await fetch('/api/system/saude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rodar_daemon' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao executar pulso 24h');
      if (json.saude) setDados(json.saude);
      toast.success('Pulso 24h executado! Robôs, campanhas e fila de e-mails verificados.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRodandoDaemon(false);
    }
  };

  const enviarRelatorioWhatsApp = async () => {
    setEnviandoAlerta(true);
    try {
      const res = await fetch('/api/system/saude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enviar_alerta_gestao', telefone: telefoneGestao }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao enviar alerta');
      toast.success(`Resumo 24h enviado no WhatsApp (${telefoneGestao})!`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviandoAlerta(false);
    }
  };

  const enviarAlertaCertificados = async () => {
    setEnviandoCertificados(true);
    try {
      const res = await fetch('/api/system/saude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enviar_alerta_certificados', telefone: telefoneCertificados }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao enviar aviso de certificados');
      toast.success(`Aviso de certificados enviado no WhatsApp (${telefoneCertificados})!`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviandoCertificados(false);
    }
  };

  if (loading && !dados) {
    return (
      <div className="card">
        <TableSkeleton rows={4} cols={4} />
      </div>
    );
  }

  if (!dados) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '16px 20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Activity size={18} style={{ color: '#600000' }} />
            <strong style={{ fontSize: 15 }}>Monitor de Saúde 24h do Servidor</strong>
            <StatusBadge tone={dados.banco.ok ? 'success' : 'danger'} dot>
              {dados.banco.ok ? `Online • Uptime ${formatUptime(dados.uptimeSegundos)}` : 'Atenção no Banco'}
            </StatusBadge>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            Última verificação: {new Date(dados.atualizadoEm).toLocaleTimeString('pt-BR')}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={carregar}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={13} /> Atualizar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={forcarPulso24h}
            disabled={rodandoDaemon}
            style={{ background: '#600000', borderColor: '#600000', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Play size={13} /> {rodandoDaemon ? 'Executando...' : 'Forçar Pulso 24h'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <KpiCard
          label="PostgreSQL"
          value={dados.banco.ok ? `${dados.banco.latencyMs} ms` : 'Offline'}
          hint={dados.banco.ok ? 'Conexão saudável' : 'Falha ao responder SELECT 1'}
          icon={<Database size={16} />}
          tone={dados.banco.ok ? 'success' : 'danger'}
        />
        <KpiCard
          label="WhatsApp 24h"
          value={`${dados.whatsapp.conectadas} / ${dados.whatsapp.totalSessoes}`}
          hint={`${dados.filas24h.campanhasAtivas} campanha(s) em andamento (${dados.filas24h.campanhasTotalRestante} restantes)`}
          icon={<MessageSquare size={16} />}
          tone={dados.whatsapp.conectadas > 0 ? 'success' : 'warning'}
        />
        <KpiCard
          label="Fila de E-mail 24h"
          value={dados.filas24h.emailsPendentes}
          hint={dados.filas24h.emailsErros > 0 ? `${dados.filas24h.emailsErros} com erro` : 'Sem falhas pendentes'}
          icon={<Mail size={16} />}
          tone={dados.filas24h.emailsErros > 0 ? 'warning' : 'info'}
        />
        <KpiCard
          label="Fiscal & Certificados"
          value={dados.fiscal.certificadosAlerta.length + dados.fiscal.nfseComErro}
          hint={`${dados.fiscal.certificadosAlerta.length} cert. vencendo • ${dados.fiscal.nfseComErro} NFS-e com erro`}
          icon={<ShieldAlert size={16} />}
          tone={dados.fiscal.certificadosAlerta.length + dados.fiscal.nfseComErro > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Integrações + Alerta WhatsApp */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Integrações &amp; Variáveis</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { nome: 'Google Gemini (IA Server-side)', ok: dados.integracoes.gemini },
              { nome: 'SERPRO Integra Contador (PGDAS-D / CND)', ok: dados.integracoes.serpro },
              { nome: 'SMTP / Envio de E-mails', ok: dados.integracoes.smtp },
            ].map(item => (
              <div
                key={item.nome}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'var(--bg-base)',
                  fontSize: 14,
                }}
              >
                <span>{item.nome}</span>
                <StatusBadge tone={item.ok ? 'success' : 'warning'}>
                  {item.ok ? 'Configurado' : 'Verificar .env'}
                </StatusBadge>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Alerta no WhatsApp da Gestão</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>
            Dispare agora um resumo executivo da saúde do servidor, lotes 24h e certificados A1 para o WhatsApp do gestor.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-control"
              value={telefoneGestao}
              onChange={e => setTelefoneGestao(e.target.value)}
              placeholder="DDD + Número (ex: 46999048990)"
              style={{ flex: '1 1 180px' }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={enviarRelatorioWhatsApp}
              disabled={enviandoAlerta}
              style={{ background: '#15803d', borderColor: '#15803d', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Send size={13} /> {enviandoAlerta ? 'Enviando...' : 'Enviar no WhatsApp'}
            </button>
          </div>
        </div>
      </div>

      {/* Certificados em atenção */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Certificados Digitais A1 (próximos 30 dias)</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Avisos automáticos (30, 15, 7, 3 e 1 dia antes + vencidos) enviados via (46) 99980-0010 para <strong>(46) 3035-1018</strong>.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-control"
              value={telefoneCertificados}
              onChange={e => setTelefoneCertificados(e.target.value)}
              placeholder="4630351018"
              style={{ width: 150, fontSize: 14, padding: '6px 10px' }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={enviarAlertaCertificados}
              disabled={enviandoCertificados}
              style={{ background: '#15803d', borderColor: '#15803d', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Send size={13} /> {enviandoCertificados ? 'Enviando...' : 'Enviar Aviso Agora'}
            </button>
          </div>
        </div>
        {dados.fiscal.certificadosAlerta.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, color: '#15803d' }}>
            <CheckCircle2 size={16} /> Todos os certificados A1 estão com validade em dia.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dados.fiscal.certificadosAlerta.map((c, idx) => (
              <div
                key={`${c.nome}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: c.vencido ? '#fef2f2' : '#fffbeb',
                  border: `1px solid ${c.vencido ? '#fecaca' : '#fde68a'}`,
                  fontSize: 14,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  <AlertTriangle size={14} style={{ color: c.vencido ? '#dc2626' : '#d97706' }} />
                  {c.nome}
                </span>
                <StatusBadge tone={c.vencido ? 'danger' : 'warning'}>
                  {c.vencido ? `Vencido (${c.validoAte})` : `Vence em ${c.dias}d (${c.validoAte})`}
                </StatusBadge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
