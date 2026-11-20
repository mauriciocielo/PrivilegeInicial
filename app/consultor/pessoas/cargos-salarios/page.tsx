'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ComercialExportBar from '@/components/ComercialExportBar';
import { store } from '@/lib/store';
import {
  DollarSign, Calculator, Plus, Edit3, Trash2, CheckCircle2, X, Users
} from 'lucide-react';

interface CargoSalarioItem {
  id: string;
  funcionario: string;
  funcao: string;
  setor: string;
  unidade: string;
  regime: 'CLT LP/LR' | 'CLT Simples' | 'RPA' | 'PJ';
  remuneracaoFixa: number;
  variavelPctVendas: number;
  baseVendasMensal: number;
  remuneracaoExtra: number;
}

const DEFAULT_LISTA: CargoSalarioItem[] = [
  { id: 'cs-1', funcionario: 'Ana Paula', funcao: 'Gerente Administrativo', setor: 'Administrativo', unidade: 'Matriz', regime: 'CLT Simples', remuneracaoFixa: 4800, variavelPctVendas: 0, baseVendasMensal: 0, remuneracaoExtra: 400 },
  { id: 'cs-2', funcionario: 'Carlos Eduardo', funcao: 'Consultor Comercial', setor: 'Comercial', unidade: 'Matriz', regime: 'CLT Simples', remuneracaoFixa: 2400, variavelPctVendas: 2.5, baseVendasMensal: 80000, remuneracaoExtra: 0 },
  { id: 'cs-3', funcionario: 'Mariana Souza', funcao: 'Analista Financeiro', setor: 'Financeiro', unidade: 'Matriz', regime: 'CLT Simples', remuneracaoFixa: 3200, variavelPctVendas: 0, baseVendasMensal: 0, remuneracaoExtra: 250 },
  { id: 'cs-4', funcionario: 'Lucas Mendes', funcao: 'Especialista de Marketing', setor: 'Marketing', unidade: 'Matriz', regime: 'PJ', remuneracaoFixa: 4500, variavelPctVendas: 0, baseVendasMensal: 0, remuneracaoExtra: 500 },
];

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

export default function PessoasCargosSalariosPage() {
  const [empresaId, setEmpresaId] = useState('default');
  const [tab, setTab] = useState<'lista' | 'comparativo'>('lista');
  const [lista, setLista] = useState<CargoSalarioItem[]>(DEFAULT_LISTA);
  const [filtroSetor, setFiltroSetor] = useState<string>('Todos');
  const [salarioSimulacao, setSalarioSimulacao] = useState<number>(5000);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [editing, setEditing] = useState<CargoSalarioItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async (empId: string) => {
    try {
      const res = await fetch(`/api/comercial?empresaId=${encodeURIComponent(empId)}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success && json.data?.pessoas_cargos_salarios) {
        const d = json.data.pessoas_cargos_salarios;
        if (Array.isArray(d.lista) && d.lista.length > 0) setLista(d.lista);
        if (typeof d.salarioSimulacao === 'number' && d.salarioSimulacao > 0) {
          setSalarioSimulacao(d.salarioSimulacao);
        }
      }
    } catch {
      // default
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const emp = store.getSafeEmpresaId() || 'default';
    setEmpresaId(emp);
    loadData(emp);
  }, [loadData]);

  const persist = useCallback(
    (nextLista: CargoSalarioItem[], nextSal: number) => {
      if (!loaded) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          await fetch('/api/comercial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              empresaId,
              sectionKey: 'pessoas_cargos_salarios',
              value: { lista: nextLista, salarioSimulacao: nextSal },
            }),
          });
          setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        } finally {
          setSaving(false);
        }
      }, 900);
    },
    [empresaId, loaded]
  );

  const updateLista = (next: CargoSalarioItem[]) => {
    setLista(next);
    persist(next, salarioSimulacao);
  };

  const calcTotalItem = (item: CargoSalarioItem) => {
    const varVal = (item.baseVendasMensal || 0) * ((item.variavelPctVendas || 0) / 100);
    return (item.remuneracaoFixa || 0) + varVal + (item.remuneracaoExtra || 0);
  };

  const setores = useMemo(() => ['Todos', ...Array.from(new Set(lista.map((i) => i.setor).filter(Boolean)))], [lista]);

  const listaFiltrada = useMemo(
    () => (filtroSetor === 'Todos' ? lista : lista.filter((i) => i.setor === filtroSetor)),
    [lista, filtroSetor]
  );

  const totais = useMemo(() => {
    const fixa = listaFiltrada.reduce((a, i) => a + (i.remuneracaoFixa || 0), 0);
    const extra = listaFiltrada.reduce((a, i) => a + (i.remuneracaoExtra || 0), 0);
    const variavel = listaFiltrada.reduce((a, i) => a + (i.baseVendasMensal || 0) * ((i.variavelPctVendas || 0) / 100), 0);
    const total = fixa + extra + variavel;
    return { fixa, extra, variavel, total };
  }, [listaFiltrada]);

  const comp = useMemo(() => {
    const base = Math.max(0, salarioSimulacao || 0);
    const regimes = [
      {
        nome: 'CLT Lucro Presumido / Real',
        inssEmp: 0.28,
        fgts: 0.08,
        decimoTerceiro: 0.1133,
        ferias: 0.1507,
        multaFgts: 0.03333333,
        impostoPj: 0,
        simplesContratado: 0,
        issContratado: 0,
        inssDesc: 0.1,
        irpfDesc: 0.07,
      },
      {
        nome: 'CLT Simples Nacional',
        inssEmp: 0.11,
        fgts: 0.08,
        decimoTerceiro: 0.09,
        ferias: 0.1197,
        multaFgts: 0.03333333,
        impostoPj: 0,
        simplesContratado: 0,
        issContratado: 0,
        inssDesc: 0.1,
        irpfDesc: 0.07,
      },
      {
        nome: 'Contrato Autônomo RPA',
        inssEmp: 0.2,
        fgts: 0,
        decimoTerceiro: 0,
        ferias: 0,
        multaFgts: 0,
        impostoPj: 0,
        simplesContratado: 0,
        issContratado: 0.05,
        inssDesc: 0.1,
        irpfDesc: 0.07,
      },
      {
        nome: 'Contrato PJ / MEI',
        inssEmp: 0,
        fgts: 0,
        decimoTerceiro: 0,
        ferias: 0,
        multaFgts: 0,
        impostoPj: 0.04,
        simplesContratado: 0.045,
        issContratado: 0,
        inssDesc: 0,
        irpfDesc: 0,
      },
    ];

    return regimes.map((r) => {
      const encargoPct = r.inssEmp + r.fgts + r.decimoTerceiro + r.ferias + r.multaFgts + r.impostoPj;
      const custoTotal = base * (1 + encargoPct);
      const descPct = r.simplesContratado + r.issContratado + r.inssDesc + r.irpfDesc;
      const liquidoContratado = base * (1 - descPct);
      return {
        ...r,
        base,
        encargoPct,
        custoTotal,
        descPct,
        liquidoContratado,
      };
    });
  }, [salarioSimulacao]);

  const openNew = () => {
    setEditing({
      id: `cs-${Date.now()}`,
      funcionario: '',
      funcao: '',
      setor: '',
      unidade: 'Matriz',
      regime: 'CLT Simples',
      remuneracaoFixa: 0,
      variavelPctVendas: 0,
      baseVendasMensal: 0,
      remuneracaoExtra: 0,
    });
    setShowModal(true);
  };

  const handleSaveItem = () => {
    if (!editing || !editing.funcao.trim()) return;
    const exists = lista.some((i) => i.id === editing.id);
    const next = exists ? lista.map((i) => (i.id === editing.id ? editing : i)) : [...lista, editing];
    updateLista(next);
    setShowModal(false);
  };

  const handleDeleteItem = (id: string) => {
    updateLista(lista.filter((i) => i.id !== id));
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <DollarSign size={26} color="var(--accent)" />
            Cargos, Salários & Comparativo CLT x PJ
          </div>
          <div className="page-subtitle">
            Levantamento de remuneração fixa, variável e extra por setor + simulador de custos CLT (LP/LR e Simples), RPA e PJ.
          </div>
        </div>
        <div className="header-actions">
          {saving && <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Salvando...</span>}
          {!saving && lastSaved && (
            <span style={{ fontSize: 14, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={14} /> Salvo às {lastSaved}
            </span>
          )}
          <button onClick={openNew} className="btn btn-primary">
            <Plus size={15} /> Adicionar Cargo / Salário
          </button>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <ComercialExportBar
          title={tab === 'lista' ? 'Relatório de Cargos e Salários' : 'Comparativo de Regimes de Contratação (CLT x RPA x PJ)'}
          fileNameBase={tab === 'lista' ? 'cargos-e-salarios' : 'comparativo-clt-pj'}
          kpis={[
            { label: 'Colaboradores', value: String(listaFiltrada.length) },
            { label: 'Folha Fixa', value: fmtBRL(totais.fixa) },
            { label: 'Variável + Extra', value: fmtBRL(totais.variavel + totais.extra) },
            { label: 'Folha Total Mensal', value: fmtBRL(totais.total) },
          ]}
          columns={
            tab === 'lista'
              ? [
                  { header: 'Funcionário', key: 'funcionario' },
                  { header: 'Função', key: 'funcao' },
                  { header: 'Setor', key: 'setor' },
                  { header: 'Unidade', key: 'unidade' },
                  { header: 'Regime', key: 'regime' },
                  { header: 'Fixo', key: 'fixo' },
                  { header: 'Variável', key: 'variavel' },
                  { header: 'Extra', key: 'extra' },
                  { header: 'Total', key: 'total' },
                ]
              : [
                  { header: 'Regime', key: 'regime' },
                  { header: 'Base', key: 'base' },
                  { header: '% Encargos Empresa', key: 'encargos' },
                  { header: 'Custo Total Contratante', key: 'custo' },
                  { header: '% Descontos', key: 'descontos' },
                  { header: 'Líquido Contratado', key: 'liquido' },
                ]
          }
          rows={
            tab === 'lista'
              ? listaFiltrada.map((i) => ({
                  funcionario: i.funcionario || 'A definir',
                  funcao: i.funcao,
                  setor: i.setor,
                  unidade: i.unidade,
                  regime: i.regime,
                  fixo: fmtBRL(i.remuneracaoFixa),
                  variavel: `${i.variavelPctVendas}% (${fmtBRL((i.baseVendasMensal || 0) * ((i.variavelPctVendas || 0) / 100))})`,
                  extra: fmtBRL(i.remuneracaoExtra),
                  total: fmtBRL(calcTotalItem(i)),
                }))
              : comp.map((c) => ({
                  regime: c.nome,
                  base: fmtBRL(c.base),
                  encargos: fmtPct(c.encargoPct),
                  custo: fmtBRL(c.custoTotal),
                  descontos: fmtPct(c.descPct),
                  liquido: fmtBRL(c.liquidoContratado),
                }))
          }
        />

        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Posições Listadas</div>
            <div className="kpi-value">{listaFiltrada.length}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Remuneração Fixa</div>
            <div className="kpi-value">{fmtBRL(totais.fixa)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Variável + Extra</div>
            <div className="kpi-value">{fmtBRL(totais.variavel + totais.extra)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Total Geral Mensal</div>
            <div className="kpi-value" style={{ color: 'var(--accent)' }}>{fmtBRL(totais.total)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setTab('lista')} className={tab === 'lista' ? 'btn btn-primary' : 'btn btn-secondary'}>
            <Users size={15} /> Lista de Cargos e Salários
          </button>
          <button onClick={() => setTab('comparativo')} className={tab === 'comparativo' ? 'btn btn-primary' : 'btn btn-secondary'}>
            <Calculator size={15} /> Simulador CLT x RPA x PJ
          </button>
        </div>

        {tab === 'lista' ? (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Filtrar Setor:</span>
                <select className="form-input" style={{ width: 'auto' }} value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)}>
                  {setores.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Funcionário</th>
                    <th>Função</th>
                    <th>Setor</th>
                    <th>Unidade</th>
                    <th>Regime</th>
                    <th style={{ textAlign: 'right' }}>Fixo</th>
                    <th style={{ textAlign: 'right' }}>Variável (% Vendas)</th>
                    <th style={{ textAlign: 'right' }}>Extra</th>
                    <th style={{ textAlign: 'right' }}>TOTAL</th>
                    <th style={{ textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map((item) => {
                    const varVal = (item.baseVendasMensal || 0) * ((item.variavelPctVendas || 0) / 100);
                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600 }}>{item.funcionario || 'A definir'}</td>
                        <td>{item.funcao}</td>
                        <td>{item.setor}</td>
                        <td>{item.unidade}</td>
                        <td><span className="badge badge-info">{item.regime}</span></td>
                        <td style={{ textAlign: 'right' }}>{fmtBRL(item.remuneracaoFixa)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {item.variavelPctVendas > 0 ? `${item.variavelPctVendas}% (${fmtBRL(varVal)})` : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>{fmtBRL(item.remuneracaoExtra)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{fmtBRL(calcTotalItem(item))}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              onClick={() => {
                                setEditing({ ...item });
                                setShowModal(true);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px' }}
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', color: '#dc2626' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 18, padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div>
                <div className="card-title">Levantamento dos Custos de Contratação</div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '3px 0 0' }}>
                  Informe o salário / remuneração base para comparar o custo total da empresa e o líquido recebido pelo profissional.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ fontWeight: 700, fontSize: 14.5 }}>SALÁRIO FIXO (R$):</label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  className="form-input"
                  style={{ width: 160, fontWeight: 800, fontSize: 16 }}
                  value={salarioSimulacao}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setSalarioSimulacao(val);
                    persist(lista, val);
                  }}
                />
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rubrica / Encargo</th>
                    {comp.map((c) => (
                      <th key={c.nome} style={{ textAlign: 'right' }}>{c.nome}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Remuneração Base (100%)</td>
                    {comp.map((c) => <td key={c.nome} style={{ textAlign: 'right' }}>{fmtBRL(c.base)}</td>)}
                  </tr>
                  <tr>
                    <td>INSS Empregador</td>
                    {comp.map((c) => <td key={c.nome} style={{ textAlign: 'right' }}>{fmtPct(c.inssEmp)} · {fmtBRL(c.base * c.inssEmp)}</td>)}
                  </tr>
                  <tr>
                    <td>FGTS (8%)</td>
                    {comp.map((c) => <td key={c.nome} style={{ textAlign: 'right' }}>{fmtPct(c.fgts)} · {fmtBRL(c.base * c.fgts)}</td>)}
                  </tr>
                  <tr>
                    <td>13º Salário + Encargos FGTS/INSS</td>
                    {comp.map((c) => <td key={c.nome} style={{ textAlign: 'right' }}>{fmtPct(c.decimoTerceiro)} · {fmtBRL(c.base * c.decimoTerceiro)}</td>)}
                  </tr>
                  <tr>
                    <td>Férias + 1/3 + Encargos FGTS/INSS</td>
                    {comp.map((c) => <td key={c.nome} style={{ textAlign: 'right' }}>{fmtPct(c.ferias)} · {fmtBRL(c.base * c.ferias)}</td>)}
                  </tr>
                  <tr>
                    <td>Provisão Multa FGTS (40% rescisão)</td>
                    {comp.map((c) => <td key={c.nome} style={{ textAlign: 'right' }}>{fmtBRL(c.base * c.multaFgts)}</td>)}
                  </tr>
                  <tr>
                    <td>Imposto PJ / MEI (Contratante)</td>
                    {comp.map((c) => <td key={c.nome} style={{ textAlign: 'right' }}>{fmtPct(c.impostoPj)} · {fmtBRL(c.base * c.impostoPj)}</td>)}
                  </tr>
                  <tr style={{ background: 'rgba(59, 130, 246, 0.12)', fontWeight: 800 }}>
                    <td style={{ color: '#60a5fa' }}>CUSTO TOTAL DO CONTRATANTE</td>
                    {comp.map((c) => (
                      <td key={c.nome} style={{ textAlign: 'right', color: '#60a5fa' }}>
                        {fmtBRL(c.custoTotal)} <span style={{ fontSize: 13, fontWeight: 600 }}>(+{fmtPct(c.encargoPct)})</span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td colSpan={5} style={{ background: 'var(--bg-secondary)', fontWeight: 800, fontSize: 14, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Provisão de Recebimento do Contratado
                    </td>
                  </tr>
                  <tr>
                    <td>Simples Nacional do Contratado</td>
                    {comp.map((c) => <td key={c.nome} style={{ textAlign: 'right' }}>{fmtPct(c.simplesContratado)} · {fmtBRL(c.base * c.simplesContratado)}</td>)}
                  </tr>
                  <tr>
                    <td>ISS do Contratado</td>
                    {comp.map((c) => <td key={c.nome} style={{ textAlign: 'right' }}>{fmtPct(c.issContratado)} · {fmtBRL(c.base * c.issContratado)}</td>)}
                  </tr>
                  <tr>
                    <td>INSS Descontado do Contratado</td>
                    {comp.map((c) => <td key={c.nome} style={{ textAlign: 'right' }}>{fmtPct(c.inssDesc)} · {fmtBRL(c.base * c.inssDesc)}</td>)}
                  </tr>
                  <tr>
                    <td>IRPF Descontado do Contratado</td>
                    {comp.map((c) => <td key={c.nome} style={{ textAlign: 'right' }}>{fmtPct(c.irpfDesc)} · {fmtBRL(c.base * c.irpfDesc)}</td>)}
                  </tr>
                  <tr style={{ background: 'rgba(22, 163, 74, 0.12)', fontWeight: 800 }}>
                    <td style={{ color: '#4ade80' }}>RECEBIMENTO LÍQUIDO DO CONTRATADO</td>
                    {comp.map((c) => (
                      <td key={c.nome} style={{ textAlign: 'right', color: '#4ade80' }}>
                        {fmtBRL(c.liquidoContratado)} <span style={{ fontSize: 13, fontWeight: 600 }}>(-{fmtPct(c.descPct)})</span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && editing && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Cargo e Remuneração</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="form-label">Funcionário</label>
                <input className="form-input" value={editing.funcionario} onChange={(e) => setEditing({ ...editing, funcionario: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Função *</label>
                <input className="form-input" value={editing.funcao} onChange={(e) => setEditing({ ...editing, funcao: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Setor</label>
                <input className="form-input" value={editing.setor} onChange={(e) => setEditing({ ...editing, setor: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Unidade</label>
                <input className="form-input" value={editing.unidade} onChange={(e) => setEditing({ ...editing, unidade: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Regime de Contratação</label>
                <select className="form-input" value={editing.regime} onChange={(e) => setEditing({ ...editing, regime: e.target.value as CargoSalarioItem['regime'] })}>
                  <option value="CLT LP/LR">CLT LP / LR</option>
                  <option value="CLT Simples">CLT Simples Nacional</option>
                  <option value="RPA">Autônomo RPA</option>
                  <option value="PJ">Contrato PJ</option>
                </select>
              </div>
              <div>
                <label className="form-label">Remuneração Fixa (R$)</label>
                <input type="number" className="form-input" value={editing.remuneracaoFixa} onChange={(e) => setEditing({ ...editing, remuneracaoFixa: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="form-label">Variável (% s/ vendas)</label>
                <input type="number" step="0.1" className="form-input" value={editing.variavelPctVendas} onChange={(e) => setEditing({ ...editing, variavelPctVendas: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="form-label">Base Vendas Mensal (R$)</label>
                <input type="number" className="form-input" value={editing.baseVendasMensal} onChange={(e) => setEditing({ ...editing, baseVendasMensal: Number(e.target.value) || 0 })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Remuneração Extra / Benefícios (R$)</label>
                <input type="number" className="form-input" value={editing.remuneracaoExtra} onChange={(e) => setEditing({ ...editing, remuneracaoExtra: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={handleSaveItem} className="btn btn-primary">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
