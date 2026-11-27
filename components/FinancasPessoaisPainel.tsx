'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Brain,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileSpreadsheet,
  MessageSquare,
  PiggyBank,
  Plus,
  RefreshCw,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { fmt } from '../lib/reports';
import { confirmAsync } from './ConfirmProvider';
import {
  CartoesDividasTab,
  InvestimentosWealthTab,
  RelatoriosConsultorIaTab,
  useWealthData,
} from './FinancasPessoaisWealthTabs';

const CATEGORIAS = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer',
  'Cartão de Crédito',
  'Compras',
  'Contas Fixas',
  'Investimentos',
  'Previdência',
  'Salário / Pró-labore',
  'Renda Extra',
  'Outros',
];

const CORES_PIZZA = ['#1d4ed8', '#15803d', '#b45309', '#7c3aed', '#be123c', '#0f766e', '#c2410c', '#475569'];

interface LancamentoPf {
  id: string;
  tipo: 'despesa' | 'receita';
  valor: number;
  categoria: string;
  formaPagamento: string;
  descricao: string;
  data: string;
  status: 'pago' | 'pendente';
  dedutivelIrpf: boolean;
  origem: string;
}

interface MetaPf {
  id: string;
  categoria: string;
  limiteMensal: number;
  gastoAtual: number;
  percentual: number;
}

export default function FinancasPessoaisPainel() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [aba, setAba] = useState<'geral' | 'cartoes' | 'investimentos' | 'relatorios' | 'irpf'>('geral');
  const [importandoExtrato, setImportandoExtrato] = useState(false);
  const { data: wealthData, recarregar: recarregarWealth } = useWealthData(mes);
  const [carregando, setCarregando] = useState(true);
  const [whatsappVinculado, setWhatsappVinculado] = useState(false);
  const [telefone, setTelefone] = useState<string | null>(null);
  const [resumo, setResumo] = useState({ entrou: 0, saiu: 0, saldo: 0, totalDedutivelAno: 0 });
  const [porCategoria, setPorCategoria] = useState<Array<{ categoria: string; total: number }>>([]);
  const [metas, setMetas] = useState<MetaPf[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoPf[]>([]);
  const [dedutiveisIrpf, setDedutiveisIrpf] = useState<Array<{ id: string; data: string; categoria: string; descricao: string; valor: number; formaPagamento: string }>>([]);

  // Modal Novo Lançamento
  const [modalNovo, setModalNovo] = useState(false);
  const [tipo, setTipo] = useState<'despesa' | 'receita'>('despesa');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('Alimentação');
  const [formaPagamento, setFormaPagamento] = useState('PIX');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [dedutivelIrpf, setDedutivelIrpf] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Modal Nova Meta
  const [modalMeta, setModalMeta] = useState(false);
  const [metaCategoria, setMetaCategoria] = useState('Alimentação');
  const [metaLimite, setMetaLimite] = useState('1000');

  const carregar = useCallback(async (m: string) => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/financas-pessoais?mes=${encodeURIComponent(m)}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Erro ao carregar finanças pessoais.');
        return;
      }
      setWhatsappVinculado(Boolean(d.whatsappVinculado));
      setTelefone(d.telefone || null);
      setResumo(d.resumo || { entrou: 0, saiu: 0, saldo: 0, totalDedutivelAno: 0 });
      setPorCategoria(Array.isArray(d.porCategoria) ? d.porCategoria : []);
      setMetas(Array.isArray(d.metas) ? d.metas : []);
      setLancamentos(Array.isArray(d.lancamentos) ? d.lancamentos : []);
      setDedutiveisIrpf(Array.isArray(d.dedutiveisIrpf) ? d.dedutiveisIrpf : []);
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar(mes);
  }, [mes, carregar]);

  const handleSalvarLancamento = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await fetch('/api/financas-pessoais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          valor: parseFloat(valor.replace(',', '.')) || 0,
          categoria,
          formaPagamento,
          descricao,
          data,
          dedutivelIrpf,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Erro ao salvar lançamento.');
        return;
      }
      toast.success('Lançamento pessoal salvo!');
      setModalNovo(false);
      setValor('');
      setDescricao('');
      setDedutivelIrpf(false);
      carregar(mes);
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/financas-pessoais/metas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoria: metaCategoria,
          limiteMensal: parseFloat(metaLimite.replace(',', '.')) || 0,
        }),
      });
      if (!res.ok) {
        toast.error('Informe um limite válido.');
        return;
      }
      toast.success(`Meta mensal de ${metaCategoria} salva!`);
      setModalMeta(false);
      carregar(mes);
    } catch {
      toast.error('Erro ao salvar meta.');
    }
  };

  const handleAlternarStatus = async (l: LancamentoPf) => {
    const novo = l.status === 'pago' ? 'pendente' : 'pago';
    await fetch('/api/financas-pessoais', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: l.id, status: novo }),
    });
    carregar(mes);
  };

  const handleExcluir = async (l: LancamentoPf) => {
    const ok = await confirmAsync(`Excluir "${l.descricao}" (${fmt.currency(l.valor)})?`);
    if (!ok) return;
    await fetch(`/api/financas-pessoais?id=${encodeURIComponent(l.id)}`, { method: 'DELETE' });
    toast.success('Lançamento removido.');
    carregar(mes);
  };

  const handleImportarExtrato = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportandoExtrato(true);
    try {
      const conteudo = await file.text();
      const res = await fetch('/api/financas-pessoais/importar-extrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conteudo, nomeArquivo: file.name }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Não foi possível conciliar o extrato.');
        return;
      }
      toast.success(
        `Extrato conciliado! ${d.importados} novo(s) lançamento(s) · ${d.duplicados} já existente(s) pulado(s)${d.irpfDetectados ? ` · ${d.irpfDetectados} dedutível(is) IRPF` : ''}.`
      );
      carregar(mes);
      recarregarWealth();
    } catch {
      toast.error('Erro ao ler arquivo de extrato.');
    } finally {
      setImportandoExtrato(false);
    }
  };

  const handleExportarIrpfExcel = () => {
    const ano = mes.slice(0, 4);
    const linhas = dedutiveisIrpf.map((d) => ({
      Data: d.data,
      Categoria: d.categoria,
      Descrição: d.descricao,
      'Forma de Pagamento': d.formaPagamento,
      'Valor (R$)': d.valor,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(
      linhas.length > 0 ? linhas : [{ Aviso: `Nenhuma despesa dedutível registrada em ${ano}.` }]
    );
    XLSX.utils.book_append_sheet(wb, ws, `Dedutiveis_IRPF_${ano}`);
    XLSX.writeFile(wb, `Pasta_IRPF_Dedutiveis_${ano}.xlsx`);
    toast.success('Planilha de Dedutíveis IRPF exportada!');
  };

  return (
    <div className="page-body" style={{ padding: '24px 32px', background: '#f8fafc', minHeight: '100%' }}>
      {/* Cabeçalho estilo App Digital */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent, #600000)' }}>
            Controle Financeiro Pessoal (PF) · Integrado ao WhatsApp
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Minhas Finanças
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>
            Separe sua vida pessoal da empresa lançando gastos por texto, áudio ou foto no WhatsApp + pasta pronta para o IRPF
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="month"
            className="form-control"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            style={{ width: 165, fontWeight: 600 }}
          />
          <button type="button" className="btn btn-secondary" onClick={() => carregar(mes)} style={{ borderRadius: 10 }}>
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
          </button>
          <label
            className="btn btn-secondary"
            style={{ borderRadius: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: 0 }}
            title="Importar e conciliar extrato bancário pessoal (OFX ou CSV) sem duplicar"
          >
            <Upload size={14} /> {importandoExtrato ? 'Conciliando...' : 'Importar Extrato (OFX/CSV)'}
            <input type="file" accept=".ofx,.csv,.txt" onChange={handleImportarExtrato} style={{ display: 'none' }} disabled={importandoExtrato} />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setModalMeta(true)}
            style={{ borderRadius: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Target size={14} /> Definir Meta
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setModalNovo(true)}
            style={{ background: 'var(--accent, #600000)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={15} /> Novo Lançamento
          </button>
        </div>
      </div>

      {/* 4 Cards Principais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 22 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#15803d' }}>
            <ArrowUpCircle size={15} /> Entrou ({mes})
          </div>
          <div style={{ fontSize: 25, fontWeight: 800, color: '#15803d', marginTop: 6 }}>{fmt.currency(resumo.entrou)}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#b91c1c' }}>
            <ArrowDownCircle size={15} /> Saiu ({mes})
          </div>
          <div style={{ fontSize: 25, fontWeight: 800, color: '#b91c1c', marginTop: 6 }}>{fmt.currency(resumo.saiu)}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>
            <Wallet size={15} /> Saldo do Mês
          </div>
          <div style={{ fontSize: 25, fontWeight: 800, color: resumo.saldo >= 0 ? '#0f172a' : '#b91c1c', marginTop: 6 }}>
            {fmt.currency(resumo.saldo)}
          </div>
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#166534' }}>
            <ShieldCheck size={15} /> Dedutíveis IRPF ({mes.slice(0, 4)})
          </div>
          <div style={{ fontSize: 25, fontWeight: 800, color: '#15803d', marginTop: 6 }}>
            {fmt.currency(resumo.totalDedutivelAno)}
          </div>
          <div style={{ fontSize: 11.5, color: '#166534', marginTop: 2 }}>Saúde, Educação e Previdência</div>
        </div>
      </div>

      {/* Dica de Comandos do WhatsApp */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderLeft: '4px solid #16a34a',
          borderRadius: 14,
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageSquare size={20} color="#16a34a" />
          <div style={{ fontSize: 13.5, color: '#334155' }}>
            <strong>Lance pelo WhatsApp em 3 segundos (texto, áudio ou foto do cupom/PIX):</strong>{' '}
            <em>"Gastei 85 no mercado no crédito"</em> · <em>"Recebi 5000 de pró-labore"</em> · <em>"Meta de alimentação 1000"</em> · <em>"Quanto gastei este mês?"</em>
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: whatsappVinculado ? '#15803d' : '#b45309' }}>
          {whatsappVinculado ? `✓ WhatsApp sincronizado (${telefone})` : 'Cadastre seu telefone no perfil para sincronizar com o WhatsApp'}
        </span>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setAba('geral')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 13.5,
            background: aba === 'geral' ? 'var(--accent, #600000)' : '#e2e8f0',
            color: aba === 'geral' ? '#fff' : '#334155',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <PiggyBank size={15} /> Gastos & Extrato ({lancamentos.length})
        </button>
        <button
          type="button"
          onClick={() => setAba('cartoes')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 13.5,
            background: aba === 'cartoes' ? 'var(--accent, #600000)' : '#e2e8f0',
            color: aba === 'cartoes' ? '#fff' : '#334155',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <CreditCard size={15} /> Cartões & Dívidas ({(wealthData?.cartoes.length || 0) + (wealthData?.dividas.length || 0)})
        </button>
        <button
          type="button"
          onClick={() => setAba('investimentos')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 13.5,
            background: aba === 'investimentos' ? 'var(--accent, #600000)' : '#e2e8f0',
            color: aba === 'investimentos' ? '#fff' : '#334155',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <TrendingUp size={15} /> Investimentos, Bolsa, Day Trade & Consórcios ({wealthData?.patrimonio.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setAba('relatorios')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 13.5,
            background: aba === 'relatorios' ? 'var(--accent, #600000)' : '#e2e8f0',
            color: aba === 'relatorios' ? '#fff' : '#334155',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Brain size={15} /> Relatórios & Consultor IA
        </button>
        <button
          type="button"
          onClick={() => setAba('irpf')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 13.5,
            background: aba === 'irpf' ? '#15803d' : '#e2e8f0',
            color: aba === 'irpf' ? '#fff' : '#334155',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <FileSpreadsheet size={15} /> Pasta IRPF ({dedutiveisIrpf.length})
        </button>
      </div>

      {aba === 'geral' ? (
        <>
          {/* Gráfico por Categoria + Termômetro de Metas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Gastos por Categoria ({mes})</h3>
              {porCategoria.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13.5 }}>
                  Nenhuma despesa registrada neste mês ainda.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: '100%', height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={porCategoria} dataKey="total" nameKey="categoria" innerRadius={48} outerRadius={78} paddingAngle={3}>
                          {porCategoria.map((_, idx) => (
                            <Cell key={idx} fill={CORES_PIZZA[idx % CORES_PIZZA.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val: any) => fmt.currency(Number(val || 0))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {porCategoria.slice(0, 6).map((c, idx) => (
                      <div key={c.categoria} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#334155', fontWeight: 600 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 99, background: CORES_PIZZA[idx % CORES_PIZZA.length] }} />
                          {c.categoria}
                        </span>
                        <strong style={{ color: '#0f172a' }}>{fmt.currency(c.total)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Termômetro de Metas</h3>
                <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setModalMeta(true)}>
                  + Meta
                </button>
              </div>
              {metas.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13.5 }}>
                  Nenhuma meta definida ainda. Clique em <strong>+ Meta</strong> ou mande no WhatsApp: <em>"Meta de alimentação 1000"</em>.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {metas.map((m) => {
                    const cor = m.percentual >= 100 ? '#dc2626' : m.percentual >= 80 ? '#d97706' : '#16a34a';
                    return (
                      <div key={m.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                          <strong style={{ color: '#0f172a' }}>{m.categoria}</strong>
                          <span style={{ color: cor, fontWeight: 700 }}>
                            {fmt.currency(m.gastoAtual)} / {fmt.currency(m.limiteMensal)} ({m.percentual}%)
                          </span>
                        </div>
                        <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, m.percentual)}%`, background: cor, borderRadius: 99 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tabela de Lançamentos */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
            {lancamentos.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                Nenhum lançamento pessoal em {mes}. Mande um áudio ou mensagem no WhatsApp ou clique em <strong>Novo Lançamento</strong>!
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Pagamento</th>
                      <th>Origem</th>
                      <th>Valor</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentos.map((l) => (
                      <tr key={l.id}>
                        <td style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>{l.data}</td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>{l.descricao}</div>
                          {l.dedutivelIrpf && (
                            <span style={{ fontSize: 10.5, fontWeight: 800, background: '#f0fdf4', color: '#15803d', padding: '1px 7px', borderRadius: 99 }}>
                              Dedutível IRPF
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{l.categoria}</td>
                        <td style={{ fontSize: 12.5, color: '#64748b' }}>{l.formaPagamento}</td>
                        <td>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: l.origem === 'whatsapp' ? '#15803d' : '#1d4ed8' }}>
                            {l.origem === 'whatsapp' ? 'WhatsApp' : 'Painel Web'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 800, color: l.tipo === 'receita' ? '#15803d' : '#b91c1c', whiteSpace: 'nowrap' }}>
                          {l.tipo === 'receita' ? '+' : '-'} {fmt.currency(l.valor)}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: 11.5, padding: '4px 8px', color: l.status === 'pago' ? '#15803d' : '#b45309' }}
                              onClick={() => handleAlternarStatus(l)}
                            >
                              {l.status === 'pago' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: 11.5, padding: '4px 8px', color: '#b91c1c' }}
                              onClick={() => handleExcluir(l)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : aba === 'cartoes' ? (
        <CartoesDividasTab wealth={wealthData} onAtualizado={recarregarWealth} />
      ) : aba === 'investimentos' ? (
        <InvestimentosWealthTab wealth={wealthData} onAtualizado={recarregarWealth} />
      ) : aba === 'relatorios' ? (
        <RelatoriosConsultorIaTab wealth={wealthData} mes={mes} />
      ) : (
        /* Pasta Dedutíveis IRPF */
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                Pasta de Despesas Dedutíveis para o IRPF ({mes.slice(0, 4)})
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#64748b' }}>
                Todo gasto de <strong>Saúde, Educação ou Previdência</strong> lançado pelo WhatsApp ou aqui fica separado automaticamente para sua Declaração de Imposto de Renda.
              </p>
            </div>
            <button
              type="button"
              className="btn"
              onClick={handleExportarIrpfExcel}
              style={{ background: '#15803d', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={14} /> Exportar Excel para o IRPF
            </button>
          </div>

          {dedutiveisIrpf.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
              Nenhum gasto dedutível registrado em {mes.slice(0, 4)} ainda.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Categoria</th>
                    <th>Descrição</th>
                    <th>Pagamento</th>
                    <th style={{ textAlign: 'right' }}>Valor Dedutível</th>
                  </tr>
                </thead>
                <tbody>
                  {dedutiveisIrpf.map((d) => (
                    <tr key={d.id}>
                      <td>{d.data}</td>
                      <td><strong>{d.categoria}</strong></td>
                      <td>{d.descricao}</td>
                      <td>{d.formaPagamento}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#15803d' }}>{fmt.currency(d.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Novo Lançamento */}
      {modalNovo && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setModalNovo(false)}
        >
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Novo Lançamento Pessoal</h3>
              <button type="button" onClick={() => setModalNovo(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSalvarLancamento} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setTipo('despesa')}
                  style={{ padding: 10, borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer', background: tipo === 'despesa' ? '#b91c1c' : '#f1f5f9', color: tipo === 'despesa' ? '#fff' : '#334155' }}
                >
                  Despesa (Saída)
                </button>
                <button
                  type="button"
                  onClick={() => setTipo('receita')}
                  style={{ padding: 10, borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer', background: tipo === 'receita' ? '#15803d' : '#f1f5f9', color: tipo === 'receita' ? '#fff' : '#334155' }}
                >
                  Receita (Entrada)
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Valor (R$)</label>
                  <input className="form-control" required value={valor} onChange={(e) => setValor(e.target.value)} placeholder="85,00" />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Data</label>
                  <input type="date" className="form-control" required value={data} onChange={(e) => setData(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Descrição</label>
                <input className="form-control" required value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Supermercado / Consulta médica" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Categoria</label>
                  <select className="form-control" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                    {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Pagamento</label>
                  <select className="form-control" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Débito">Débito</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>
              </div>
              {tipo === 'despesa' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#166534', cursor: 'pointer' }}>
                  <input type="checkbox" checked={dedutivelIrpf || ['Saúde', 'Educação', 'Previdência'].includes(categoria)} onChange={(e) => setDedutivelIrpf(e.target.checked)} />
                  Guardar na Pasta de Dedutíveis do IRPF
                </label>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalNovo(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={salvando} style={{ background: 'var(--accent, #600000)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Meta */}
      {modalMeta && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setModalMeta(false)}
        >
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Definir Meta Mensal</h3>
              <button type="button" onClick={() => setModalMeta(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSalvarMeta} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Categoria</label>
                <select className="form-control" value={metaCategoria} onChange={(e) => setMetaCategoria(e.target.value)}>
                  {CATEGORIAS.filter((c) => !['Salário / Pró-labore', 'Renda Extra'].includes(c)).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Limite Mensal (R$)</label>
                <input className="form-control" required value={metaLimite} onChange={(e) => setMetaLimite(e.target.value)} placeholder="1000" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalMeta(false)}>Cancelar</button>
                <button type="submit" className="btn" style={{ background: 'var(--accent, #600000)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}>
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
