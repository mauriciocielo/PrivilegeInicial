'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { CalendarClock, Plus, Sparkles, Trash2, Pause, Play, X, Download } from 'lucide-react';
import type { NfsE } from '../lib/store';
import type { DadosCopiaveis } from '../lib/nfse/lote';
import { expandirDescricaoRecorrente, type NfseRecorrenciaRecord } from '../lib/nfse/recorrencias-db';
import { hojeBrasilia } from '../lib/nfse/dps';
import { fmt } from '../lib/reports';
import { formatarCpfCnpj } from '../lib/formatar-documento';

interface Props {
  empresaId: string;
  empresaNome: string;
  notasPrestadas: NfsE[];
  codigoServicoPadrao?: string | null;
  cTribMunPadrao?: string | null;
  cNbsPadrao?: string | null;
  municipioPrestacaoPadrao?: string | null;
  onFechar: () => void;
  onGerarRascunhos: (itens: DadosCopiaveis[]) => void;
}

const REGEX_REF_DATA = /\b(0?[1-9]|1[0-2])\/(20\d{2})\b/g;

function transformarEmTemplate(descricao: string): string {
  if (!descricao) return 'Prestação de serviços referente a {{mes_anterior}}';
  // Substitui a primeira referência MM/AAAA encontrada por {{mes_anterior}}
  let trocou = false;
  return descricao.replace(REGEX_REF_DATA, (match) => {
    if (trocou) return match;
    trocou = true;
    return '{{mes_anterior}}';
  });
}

export default function NfseRecorrenciasModal({
  empresaId,
  empresaNome,
  notasPrestadas,
  codigoServicoPadrao,
  cTribMunPadrao,
  cNbsPadrao,
  municipioPrestacaoPadrao,
  onFechar,
  onGerarRascunhos,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [recorrencias, setRecorrencias] = useState<NfseRecorrenciaRecord[]>([]);
  const [competenciaAlvo, setCompetenciaAlvo] = useState(() => hojeBrasilia().slice(0, 7));
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);

  const [novo, setNovo] = useState({
    tomadorDocumento: '',
    tomadorNome: '',
    tomadorEmail: '',
    tomadorTelefone: '',
    diaEmissao: 5,
    codigoServico: codigoServicoPadrao || '',
    valorServicos: '',
    aliquotaIss: '',
    issRetido: false,
    descricaoTemplate: 'Prestação de serviços referente a {{mes_anterior}}',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/nfse/recorrencias?empresaId=${encodeURIComponent(empresaId)}`);
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(dados.error || 'Erro ao carregar contratos recorrentes.');
        return;
      }
      const lista: NfseRecorrenciaRecord[] = Array.isArray(dados.recorrencias) ? dados.recorrencias : [];
      setRecorrencias(lista);
      setSelecionados(new Set(lista.filter(r => r.ativo).map(r => r.id)));
    } catch {
      toast.error('Sem conexão ao carregar contratos recorrentes.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const notasRecentesUnicas = useMemo(() => {
    const porTomador = new Map<string, NfsE>();
    const ordenadas = [...notasPrestadas]
      .filter(n => n.status === 'emitida' && n.tomadorCnpjCpf && n.valorServicos > 0)
      .sort((a, b) => (b.dataEmissao || '').localeCompare(a.dataEmissao || ''));
    for (const n of ordenadas) {
      const doc = (n.tomadorCnpjCpf || '').replace(/\D/g, '');
      if (doc && !porTomador.has(doc)) porTomador.set(doc, n);
    }
    return Array.from(porTomador.values());
  }, [notasPrestadas]);

  const importarDasNotas = async () => {
    const docsExistentes = new Set(recorrencias.map(r => r.tomadorDocumento.replace(/\D/g, '')));
    const novas = notasRecentesUnicas.filter(n => !docsExistentes.has((n.tomadorCnpjCpf || '').replace(/\D/g, '')));
    if (novas.length === 0) {
      toast.info('Todos os clientes das suas notas emitidas já estão nos contratos recorrentes.');
      return;
    }
    setSalvando(true);
    try {
      const itens = novas.map(n => ({
        tomadorDocumento: (n.tomadorCnpjCpf || '').replace(/\D/g, ''),
        tomadorNome: n.tomadorRazaoSocial,
        tomadorEmail: n.tomadorEmail || '',
        tomadorTelefone: n.tomadorTelefone || '',
        tomadorCep: n.tomadorCep || '',
        tomadorEndereco: n.tomadorEndereco || '',
        tomadorNumero: n.tomadorNumero || '',
        tomadorBairro: n.tomadorBairro || '',
        tomadorCidade: n.tomadorCidade || '',
        tomadorUf: n.tomadorUf || '',
        tomadorCodigoMunicipio: n.tomadorCodigoMunicipio || '',
        codigoServico: n.codigoServico || codigoServicoPadrao || '',
        cTribMun: n.cTribMun || cTribMunPadrao || '',
        cNbs: n.cNbs || cNbsPadrao || '',
        valorServicos: n.valorServicos,
        aliquotaIss: n.aliquotaIss || 0,
        issRetido: Boolean(n.issRetido),
        diaEmissao: Number((n.dataEmissao || '').slice(8, 10)) || 5,
        descricaoTemplate: transformarEmTemplate(n.discriminacao || ''),
      }));
      const res = await fetch('/api/nfse/recorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, itens }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(dados.error || 'Erro ao importar contratos.');
      toast.success(`${itens.length} contrato(s) recorrente(s) importado(s) das notas emitidas!`);
      await carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const salvarNovo = async () => {
    const doc = novo.tomadorDocumento.replace(/\D/g, '');
    const valor = Number(String(novo.valorServicos).replace(',', '.'));
    if (doc.length !== 11 && doc.length !== 14) {
      toast.error('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      return;
    }
    if (!novo.tomadorNome.trim()) {
      toast.error('Informe o nome ou razão social do tomador.');
      return;
    }
    if (!valor || valor <= 0) {
      toast.error('Informe o valor mensal do serviço.');
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch('/api/nfse/recorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          tomadorDocumento: doc,
          tomadorNome: novo.tomadorNome.trim(),
          tomadorEmail: novo.tomadorEmail.trim(),
          tomadorTelefone: novo.tomadorTelefone.trim(),
          diaEmissao: Math.min(28, Math.max(1, Number(novo.diaEmissao) || 5)),
          codigoServico: novo.codigoServico.replace(/\D/g, '') || codigoServicoPadrao || '',
          cTribMun: cTribMunPadrao || '',
          cNbs: cNbsPadrao || '',
          valorServicos: valor,
          aliquotaIss: Number(String(novo.aliquotaIss).replace(',', '.')) || 0,
          issRetido: novo.issRetido,
          descricaoTemplate: novo.descricaoTemplate.trim(),
        }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(dados.error || 'Erro ao salvar contrato.');
      toast.success('Contrato recorrente adicionado!');
      setMostrarNovo(false);
      setNovo({
        tomadorDocumento: '',
        tomadorNome: '',
        tomadorEmail: '',
        tomadorTelefone: '',
        diaEmissao: 5,
        codigoServico: codigoServicoPadrao || '',
        valorServicos: '',
        aliquotaIss: '',
        issRetido: false,
        descricaoTemplate: 'Prestação de serviços referente a {{mes_anterior}}',
      });
      await carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (r: NfseRecorrenciaRecord) => {
    try {
      const res = await fetch('/api/nfse/recorrencias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, empresaId, ativo: !r.ativo }),
      });
      if (!res.ok) throw new Error('Falha ao atualizar.');
      setRecorrencias(prev => prev.map(x => (x.id === r.id ? { ...x, ativo: !r.ativo } : x)));
      setSelecionados(prev => {
        const next = new Set(prev);
        if (!r.ativo) next.add(r.id);
        else next.delete(r.id);
        return next;
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const excluir = async (id: string) => {
    try {
      const res = await fetch(`/api/nfse/recorrencias?id=${encodeURIComponent(id)}&empresaId=${encodeURIComponent(empresaId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Falha ao excluir.');
      setRecorrencias(prev => prev.filter(x => x.id !== id));
      setSelecionados(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Contrato removido.');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const gerarRascunhosDoMes = async () => {
    const escolhidos = recorrencias.filter(r => selecionados.has(r.id));
    if (escolhidos.length === 0) {
      toast.error('Selecione ao menos um contrato para gerar rascunhos.');
      return;
    }
    setGerando(true);
    try {
      const itens: DadosCopiaveis[] = escolhidos.map(r => ({
        dataCompetencia: competenciaAlvo,
        tomadorCnpjCpf: r.tomadorDocumento,
        tomadorRazaoSocial: r.tomadorNome,
        tomadorEmail: r.tomadorEmail || undefined,
        tomadorTelefone: r.tomadorTelefone || undefined,
        tomadorCep: r.tomadorCep || undefined,
        tomadorEndereco: r.tomadorEndereco || undefined,
        tomadorNumero: r.tomadorNumero || undefined,
        tomadorBairro: r.tomadorBairro || undefined,
        tomadorCidade: r.tomadorCidade || undefined,
        tomadorUf: r.tomadorUf || undefined,
        tomadorCodigoMunicipio: r.tomadorCodigoMunicipio || undefined,
        codigoServico: r.codigoServico || codigoServicoPadrao || '',
        cTribMun: r.cTribMun || cTribMunPadrao || undefined,
        cNbs: r.cNbs || cNbsPadrao || undefined,
        municipioPrestacao: municipioPrestacaoPadrao || undefined,
        discriminacao: expandirDescricaoRecorrente(r.descricaoTemplate, competenciaAlvo),
        valorServicos: r.valorServicos,
        valorDeducoes: 0,
        aliquotaIss: r.aliquotaIss,
        issRetido: r.issRetido,
        valorPis: 0,
        valorCofins: 0,
        valorInss: 0,
        valorIr: 0,
        valorCsll: 0,
      }));

      onGerarRascunhos(itens);

      // Marca ultimaCompetenciaGerada em paralelo (melhor esforço)
      await Promise.allSettled(
        escolhidos.map(r =>
          fetch('/api/nfse/recorrencias', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: r.id, empresaId, ultimaCompetenciaGerada: competenciaAlvo }),
          }),
        ),
      );

      toast.success(`${itens.length} rascunho(s) criado(s) para ${competenciaAlvo}! Eles já estão selecionados para transmitir em lote.`);
      onFechar();
    } finally {
      setGerando(false);
    }
  };

  const totalSelecionado = useMemo(
    () => recorrencias.filter(r => selecionados.has(r.id)).reduce((s, r) => s + r.valorServicos, 0),
    [recorrencias, selecionados],
  );

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
          background: '#ffffff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 960,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(96,0,0,0.08)', color: '#600000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarClock size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Contratos Mensais (Faturamento Recorrente)</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{empresaNome} — gere todas as notas do mês em 1 clique com datas atualizadas</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: '#6b7280', borderRadius: 8 }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1 }}>
          {/* Barra superior de ações */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 13.5, fontWeight: 600, color: '#374151' }}>Competência a gerar:</label>
              <input
                type="month"
                className="form-control"
                value={competenciaAlvo}
                onChange={e => setCompetenciaAlvo(e.target.value)}
                style={{ width: 165, padding: '6px 10px', fontSize: 14 }}
              />
              <span style={{ fontSize: 12.5, color: '#6b7280' }}>
                Variáveis: <code>{'{{mes_anterior}}'}</code>, <code>{'{{mes_atual}}'}</code>, <code>{'{{ano}}'}</code>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {notasRecentesUnicas.length > 0 && (
                <button
                  type="button"
                  onClick={importarDasNotas}
                  disabled={salvando}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    color: '#111827',
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Download size={14} /> Importar das Notas Emitidas ({notasRecentesUnicas.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setMostrarNovo(v => !v)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#111827',
                  color: '#fff',
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={14} /> Novo Contrato
              </button>
            </div>
          </div>

          {mostrarNovo && (
            <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, border: '1px solid #d1d5db', background: '#fff' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 10 }}>Cadastrar novo contrato mensal</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>CPF / CNPJ *</label>
                  <input className="form-control" value={novo.tomadorDocumento} onChange={e => setNovo(n => ({ ...n, tomadorDocumento: e.target.value }))} placeholder="00.000.000/0001-00" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nome / Razão Social *</label>
                  <input className="form-control" value={novo.tomadorNome} onChange={e => setNovo(n => ({ ...n, tomadorNome: e.target.value }))} placeholder="Nome do cliente" />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Valor Mensal (R$) *</label>
                  <input className="form-control" value={novo.valorServicos} onChange={e => setNovo(n => ({ ...n, valorServicos: e.target.value }))} placeholder="1500.00" />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>WhatsApp</label>
                  <input className="form-control" value={novo.tomadorTelefone} onChange={e => setNovo(n => ({ ...n, tomadorTelefone: e.target.value }))} placeholder="(46) 99999-9999" />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>E-mail</label>
                  <input className="form-control" value={novo.tomadorEmail} onChange={e => setNovo(n => ({ ...n, tomadorEmail: e.target.value }))} placeholder="financeiro@cliente.com.br" />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Cód. Serviço (6 díg.)</label>
                  <input className="form-control" value={novo.codigoServico} onChange={e => setNovo(n => ({ ...n, codigoServico: e.target.value }))} placeholder="171901" />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Dia Emissão</label>
                  <input type="number" min={1} max={28} className="form-control" value={novo.diaEmissao} onChange={e => setNovo(n => ({ ...n, diaEmissao: Number(e.target.value) || 5 }))} />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Descrição (com variáveis dinâmicas)</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={novo.descricaoTemplate}
                  onChange={e => setNovo(n => ({ ...n, descricaoTemplate: e.target.value }))}
                />
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  Prévia para {competenciaAlvo}: <em>{expandirDescricaoRecorrente(novo.descricaoTemplate, competenciaAlvo)}</em>
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setMostrarNovo(false)} className="btn btn-secondary btn-sm">Cancelar</button>
                <button type="button" onClick={salvarNovo} disabled={salvando} className="btn btn-sm" style={{ background: '#600000', color: '#fff', border: 'none' }}>
                  {salvando ? 'Salvando...' : 'Salvar Contrato'}
                </button>
              </div>
            </div>
          )}

          {carregando ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Carregando contratos...</div>
          ) : recorrencias.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', border: '1px dashed #d1d5db', borderRadius: 12 }}>
              <p style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600, color: '#111827' }}>Nenhum contrato mensal cadastrado ainda</p>
              <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#6b7280' }}>
                Clique em <strong>Importar das Notas Emitidas</strong> para criar automaticamente a lista de contratos mensais a partir das notas já emitidas desta empresa.
              </p>
            </div>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#4b5563' }}>
                    <th style={{ padding: '10px 12px', width: 34 }}>
                      <input
                        type="checkbox"
                        checked={selecionados.size > 0 && selecionados.size === recorrencias.filter(r => r.ativo).length}
                        onChange={e => {
                          if (e.target.checked) setSelecionados(new Set(recorrencias.filter(r => r.ativo).map(r => r.id)));
                          else setSelecionados(new Set());
                        }}
                      />
                    </th>
                    <th style={{ padding: '10px 12px' }}>Tomador</th>
                    <th style={{ padding: '10px 12px' }}>Descrição para {competenciaAlvo}</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Valor</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {recorrencias.map(r => {
                    const jaGeradoNesteMes = r.ultimaCompetenciaGerada === competenciaAlvo;
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: r.ativo ? 1 : 0.55 }}>
                        <td style={{ padding: '10px 12px' }}>
                          <input
                            type="checkbox"
                            disabled={!r.ativo}
                            checked={selecionados.has(r.id)}
                            onChange={() => {
                              setSelecionados(prev => {
                                const next = new Set(prev);
                                if (next.has(r.id)) next.delete(r.id);
                                else next.add(r.id);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{r.tomadorNome}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>
                            {formatarCpfCnpj(r.tomadorDocumento)}
                            {r.tomadorTelefone ? ` · WhatsApp: ${r.tomadorTelefone}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', maxWidth: 320 }}>
                          <div style={{ color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={expandirDescricaoRecorrente(r.descricaoTemplate, competenciaAlvo)}>
                            {expandirDescricaoRecorrente(r.descricaoTemplate, competenciaAlvo)}
                          </div>
                          {jaGeradoNesteMes && (
                            <span style={{ fontSize: 11.5, color: '#15803d', fontWeight: 600 }}>✓ Já gerado em {competenciaAlvo}</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>
                          {fmt.currency(r.valorServicos)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 99,
                              background: r.ativo ? '#dcfce7' : '#f3f4f6',
                              color: r.ativo ? '#166534' : '#6b7280',
                            }}
                          >
                            {r.ativo ? 'Ativo' : 'Pausado'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => alternarAtivo(r)}
                            title={r.ativo ? 'Pausar contrato' : 'Reativar contrato'}
                            style={{ background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', marginRight: 6, color: '#374151' }}
                          >
                            {r.ativo ? <Pause size={13} /> : <Play size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => excluir(r.id)}
                            title="Remover contrato"
                            style={{ background: 'transparent', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', color: '#b91c1c' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid #e5e7eb',
            background: '#f9fafb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 14, color: '#374151' }}>
            <strong>{selecionados.size}</strong> contrato(s) selecionado(s) · Total: <strong>{fmt.currency(totalSelecionado)}</strong>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onFechar} className="btn btn-secondary">Fechar</button>
            <button
              type="button"
              onClick={gerarRascunhosDoMes}
              disabled={gerando || selecionados.size === 0}
              className="btn"
              style={{ background: '#600000', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
            >
              <Sparkles size={15} /> {gerando ? 'Gerando...' : `Gerar ${selecionados.size} Rascunho(s) de ${competenciaAlvo}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
