'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CreditCard,
  Landmark,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';
import { fmt } from '../lib/reports';
import { confirmAsync } from './ConfirmProvider';

export interface WealthData {
  mes: string;
  gastoCreditoMes: number;
  resumoWealth: {
    totalAtivos: number;
    totalDividas: number;
    patrimonioLiquido: number;
    parcelaMensalDividas: number;
    lucroDayTradeMes: number;
    darfDayTradeEstimado: number;
    rendimentosMes?: number;
    rendimentosAno?: number;
  };
  relatorioSemanal: {
    periodoInicio: string;
    entrou: number;
    saiu: number;
    saldo: number;
    topCategorias: Array<{ categoria: string; total: number }>;
  };
  evolucao6Meses: Array<{ mes: string; receitas: number; despesas: number; saldo: number }>;
  cartoes: Array<{
    id: string;
    nome: string;
    banco: string;
    limiteTotal: number;
    diaFechamento: number;
    diaVencimento: number;
    cor: string;
  }>;
  patrimonio: Array<{
    id: string;
    classe: string;
    nome: string;
    instituicao: string;
    quantidade: number;
    valorAplicado: number;
    valorAtual: number;
    resultado: number;
    rentabilidadePct: number;
    taxaOuDetalhe: string;
    dataReferencia: string;
  }>;
  dividas: Array<{
    id: string;
    credor: string;
    tipo: string;
    saldoDevedor: number;
    taxaJurosMensal: number;
    valorParcela: number;
    parcelasRestantes: number;
    diaVencimento: number;
  }>;
  rendimentos?: Array<{
    id: string;
    patrimonioId: string | null;
    ativoNome: string;
    tipoRendimento: string;
    valorBruto: number;
    irRetido: number;
    valorLiquido: number;
    data: string;
    observacao: string;
  }>;
}

const TIPOS_RENDIMENTO: Record<string, { label: string; cor: string }> = {
  dividendo: { label: 'Dividendos', cor: '#15803d' },
  jcp: { label: 'JCP', cor: '#0f766e' },
  aluguel_fii: { label: 'Rendimento FII', cor: '#1d4ed8' },
  renda_fixa: { label: 'Renda Fixa / CDB / Tesouro', cor: '#7c3aed' },
  fundo: { label: 'Fundo / Previdência', cor: '#b45309' },
  outros: { label: 'Outros Proventos', cor: '#475569' },
};

const CLASSES_PATRIMONIO: Record<string, { label: string; cor: string }> = {
  renda_fixa: { label: 'Renda Fixa / Aplicações', cor: '#15803d' },
  bolsa: { label: 'Bolsa (Ações / FIIs / ETFs)', cor: '#1d4ed8' },
  day_trade: { label: 'Day Trade', cor: '#b45309' },
  consorcio: { label: 'Consórcio', cor: '#7c3aed' },
  previdencia: { label: 'Previdência / Cripto', cor: '#0f766e' },
};

export function useWealthData(mes: string) {
  const [data, setData] = useState<WealthData | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/financas-pessoais/wealth?mes=${encodeURIComponent(mes)}`);
      const json = await res.json().catch(() => null);
      if (res.ok && json) setData(json);
    } catch {
      // ignora
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { data, carregando, recarregar: carregar };
}

export function CartoesDividasTab({
  wealth,
  onAtualizado,
}: {
  wealth: WealthData | null;
  onAtualizado: () => void;
}) {
  // Form Cartão
  const [nomeCartao, setNomeCartao] = useState('');
  const [bancoCartao, setBancoCartao] = useState('');
  const [limiteCartao, setLimiteCartao] = useState('');
  const [diaFech, setDiaFech] = useState('5');
  const [diaVenc, setDiaVenc] = useState('15');

  // Form Dívida / Empréstimo
  const [credor, setCredor] = useState('');
  const [tipoDivida, setTipoDivida] = useState('emprestimo');
  const [saldoDevedor, setSaldoDevedor] = useState('');
  const [taxaJuros, setTaxaJuros] = useState('');
  const [valorParcela, setValorParcela] = useState('');
  const [parcelasRestantes, setParcelasRestantes] = useState('12');

  const handleAddCartao = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/financas-pessoais/wealth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recurso: 'cartao',
        nome: nomeCartao,
        banco: bancoCartao,
        limiteTotal: parseFloat(limiteCartao.replace(',', '.')) || 0,
        diaFechamento: Number(diaFech) || 5,
        diaVencimento: Number(diaVenc) || 15,
      }),
    });
    if (!res.ok) {
      toast.error('Preencha nome e limite do cartão.');
      return;
    }
    toast.success('Cartão cadastrado!');
    setNomeCartao('');
    setBancoCartao('');
    setLimiteCartao('');
    onAtualizado();
  };

  const handleAddDivida = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/financas-pessoais/wealth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recurso: 'divida',
        credor,
        tipo: tipoDivida,
        saldoDevedor: parseFloat(saldoDevedor.replace(',', '.')) || 0,
        taxaJurosMensal: parseFloat(taxaJuros.replace(',', '.')) || 0,
        valorParcela: parseFloat(valorParcela.replace(',', '.')) || 0,
        parcelasRestantes: Number(parcelasRestantes) || 1,
      }),
    });
    if (!res.ok) {
      toast.error('Preencha credor e saldo devedor.');
      return;
    }
    toast.success('Empréstimo/dívida cadastrado!');
    setCredor('');
    setSaldoDevedor('');
    setTaxaJuros('');
    setValorParcela('');
    onAtualizado();
  };

  const handleExcluir = async (recurso: 'cartao' | 'divida', id: string, label: string) => {
    const ok = await confirmAsync(`Remover "${label}"?`);
    if (!ok) return;
    await fetch(`/api/financas-pessoais/wealth?recurso=${recurso}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast.success('Removido!');
    onAtualizado();
  };

  const limiteTotalCartoes = (wealth?.cartoes || []).reduce((a, c) => a + c.limiteTotal, 0);
  const gastoCred = wealth?.gastoCreditoMes || 0;
  const pctUsoGlobal = limiteTotalCartoes > 0 ? Math.round((gastoCred / limiteTotalCartoes) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Cartões de Crédito */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CreditCard size={18} color="#1d4ed8" /> Controle de Cartões de Crédito
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
              Gastos no crédito no mês: <strong>{fmt.currency(gastoCred)}</strong> · Limite somado: <strong>{fmt.currency(limiteTotalCartoes)}</strong> ({pctUsoGlobal}% usado)
            </p>
          </div>
        </div>

        <form onSubmit={handleAddCartao} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 16 }}>
          <input className="form-control" required placeholder="Nome (ex.: Nubank Black)" value={nomeCartao} onChange={(e) => setNomeCartao(e.target.value)} />
          <input className="form-control" placeholder="Banco" value={bancoCartao} onChange={(e) => setBancoCartao(e.target.value)} />
          <input className="form-control" required placeholder="Limite R$ (ex.: 15000)" value={limiteCartao} onChange={(e) => setLimiteCartao(e.target.value)} />
          <input className="form-control" type="number" min={1} max={31} placeholder="Dia fechamento" value={diaFech} onChange={(e) => setDiaFech(e.target.value)} />
          <input className="form-control" type="number" min={1} max={31} placeholder="Dia vencimento" value={diaVenc} onChange={(e) => setDiaVenc(e.target.value)} />
          <button type="submit" className="btn" style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}>
            <Plus size={14} /> Cartão
          </button>
        </form>

        {(wealth?.cartoes || []).length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Nenhum cartão cadastrado ainda.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
            {wealth!.cartoes.map((c) => (
              <div key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 14.5, color: '#0f172a' }}>{c.nome}</strong>
                  <button type="button" onClick={() => handleExcluir('cartao', c.id, c.nome)} style={{ background: 'transparent', border: 'none', color: '#b91c1c', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {c.banco || 'Cartão de Crédito'} · Fecha dia {c.diaFechamento} · Vence dia {c.diaVencimento}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1d4ed8', marginTop: 8 }}>
                  Limite: {fmt.currency(c.limiteTotal)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Empréstimos & Dívidas */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Landmark size={18} color="#b91c1c" /> Empréstimos, Financiamentos & Dívidas (Ordenado por Maior Juros)
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
            Saldo devedor total: <strong style={{ color: '#b91c1c' }}>{fmt.currency(wealth?.resumoWealth.totalDividas || 0)}</strong> · Parcelas/mês:{' '}
            <strong>{fmt.currency(wealth?.resumoWealth.parcelaMensalDividas || 0)}</strong>
          </p>
        </div>

        <form onSubmit={handleAddDivida} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8, marginBottom: 16 }}>
          <input className="form-control" required placeholder="Credor / Banco" value={credor} onChange={(e) => setCredor(e.target.value)} />
          <select className="form-control" value={tipoDivida} onChange={(e) => setTipoDivida(e.target.value)}>
            <option value="emprestimo">Empréstimo Pessoal</option>
            <option value="consignado">Consignado</option>
            <option value="financiamento_veiculo">Financ. Veículo</option>
            <option value="financiamento_imovel">Financ. Imóvel</option>
            <option value="rotativo_cartao">Rotativo / Parcelamento Cartão</option>
            <option value="cheque_especial">Cheque Especial</option>
          </select>
          <input className="form-control" required placeholder="Saldo devedor R$" value={saldoDevedor} onChange={(e) => setSaldoDevedor(e.target.value)} />
          <input className="form-control" placeholder="Juros % ao mês (ex.: 2.5)" value={taxaJuros} onChange={(e) => setTaxaJuros(e.target.value)} />
          <input className="form-control" placeholder="Parcela R$/mês" value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} />
          <input className="form-control" type="number" min={1} placeholder="Parcelas rest." value={parcelasRestantes} onChange={(e) => setParcelasRestantes(e.target.value)} />
          <button type="submit" className="btn" style={{ background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}>
            <Plus size={14} /> Dívida
          </button>
        </form>

        {(wealth?.dividas || []).length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#15803d', fontSize: 13.5, fontWeight: 600 }}>
            Nenhuma dívida cadastrada. Excelente!
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Prioridade</th>
                  <th>Credor / Tipo</th>
                  <th>Taxa de Juros</th>
                  <th>Saldo Devedor</th>
                  <th>Parcela</th>
                  <th>Restantes</th>
                  <th style={{ textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {wealth!.dividas.map((d, idx) => (
                  <tr key={d.id}>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11.5, fontWeight: 800, background: idx === 0 ? '#fef2f2' : '#f1f5f9', color: idx === 0 ? '#b91c1c' : '#475569' }}>
                        #{idx + 1} {idx === 0 ? 'Atacar 1º' : ''}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{d.credor}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{d.tipo.replace('_', ' ')}</div>
                    </td>
                    <td style={{ fontWeight: 700, color: d.taxaJurosMensal >= 3 ? '#b91c1c' : '#334155' }}>
                      {d.taxaJurosMensal}% a.m.
                    </td>
                    <td style={{ fontWeight: 800, color: '#b91c1c' }}>{fmt.currency(d.saldoDevedor)}</td>
                    <td>{fmt.currency(d.valorParcela)}/mês</td>
                    <td>{d.parcelasRestantes}x</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn btn-secondary" style={{ color: '#b91c1c', padding: '4px 8px' }} onClick={() => handleExcluir('divida', d.id, d.credor)}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function InvestimentosWealthTab({
  wealth,
  onAtualizado,
}: {
  wealth: WealthData | null;
  onAtualizado: () => void;
}) {
  const [filtroClasse, setFiltroClasse] = useState('todos');
  const [classe, setClasse] = useState('renda_fixa');
  const [nome, setNome] = useState('');
  const [instituicao, setInstituicao] = useState('');
  const [valorAplicado, setValorAplicado] = useState('');
  const [valorAtual, setValorAtual] = useState('');
  const [taxaOuDetalhe, setTaxaOuDetalhe] = useState('');

  // Form Rendimento / Provento
  const [rendAtivoId, setRendAtivoId] = useState('');
  const [rendAtivoNome, setRendAtivoNome] = useState('');
  const [rendTipo, setRendTipo] = useState('dividendo');
  const [rendData, setRendData] = useState(() => new Date().toISOString().slice(0, 10));
  const [rendBruto, setRendBruto] = useState('');
  const [rendIr, setRendIr] = useState('');
  const [rendLancarCaixa, setRendLancarCaixa] = useState(true);
  const [salvandoRend, setSalvandoRend] = useState(false);

  const handleAddRendimento = async (e: React.FormEvent) => {
    e.preventDefault();
    const ativoSelecionado = (wealth?.patrimonio || []).find((p) => p.id === rendAtivoId);
    const nomeFinal = (rendAtivoNome.trim() || ativoSelecionado?.nome || '').trim();
    if (!nomeFinal) {
      toast.error('Selecione ou digite o nome do investimento.');
      return;
    }
    setSalvandoRend(true);
    try {
      const res = await fetch('/api/financas-pessoais/wealth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recurso: 'rendimento',
          patrimonioId: rendAtivoId || null,
          ativoNome: nomeFinal,
          tipoRendimento: rendTipo,
          data: rendData,
          valorBruto: parseFloat(rendBruto.replace(',', '.')) || 0,
          irRetido: parseFloat(rendIr.replace(',', '.')) || 0,
          lancarNoCaixa: rendLancarCaixa,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Erro ao lançar rendimento.');
        return;
      }
      toast.success(
        rendLancarCaixa
          ? 'Rendimento lançado e somado no seu caixa mensal!'
          : 'Rendimento lançado na carteira!'
      );
      setRendAtivoId('');
      setRendAtivoNome('');
      setRendBruto('');
      setRendIr('');
      onAtualizado();
    } finally {
      setSalvandoRend(false);
    }
  };

  const handleExcluirRendimento = async (id: string, label: string) => {
    const ok = await confirmAsync(`Excluir rendimento de "${label}"?`);
    if (!ok) return;
    await fetch(`/api/financas-pessoais/wealth?recurso=rendimento&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast.success('Rendimento removido!');
    onAtualizado();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/financas-pessoais/wealth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recurso: 'patrimonio',
        classe,
        nome,
        instituicao,
        valorAplicado: parseFloat(valorAplicado.replace(',', '.')) || 0,
        valorAtual: parseFloat(valorAtual.replace(',', '.')) || 0,
        taxaOuDetalhe,
      }),
    });
    if (!res.ok) {
      toast.error('Preencha os dados do investimento.');
      return;
    }
    toast.success('Ativo / operação adicionado!');
    setNome('');
    setInstituicao('');
    setValorAplicado('');
    setValorAtual('');
    setTaxaOuDetalhe('');
    onAtualizado();
  };

  const handleExcluir = async (id: string, label: string) => {
    const ok = await confirmAsync(`Remover "${label}" da carteira?`);
    if (!ok) return;
    await fetch(`/api/financas-pessoais/wealth?recurso=patrimonio&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast.success('Removido!');
    onAtualizado();
  };

  const lista = (wealth?.patrimonio || []).filter((p) => filtroClasse === 'todos' || p.classe === filtroClasse);
  const r = wealth?.resumoWealth;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Resumo Patrimonial + Day Trade DARF */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Total em Investimentos & Consórcios</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d', marginTop: 4 }}>{fmt.currency(r?.totalAtivos || 0)}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Patrimônio Líquido (Ativos − Dívidas)</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: (r?.patrimonioLiquido || 0) >= 0 ? '#0f172a' : '#b91c1c', marginTop: 4 }}>
            {fmt.currency(r?.patrimonioLiquido || 0)}
          </div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>Rendimentos / Renda Passiva ({wealth?.mes})</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d', marginTop: 4 }}>{fmt.currency(r?.rendimentosMes || 0)}</div>
          <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>
            Acumulado no ano: <strong>{fmt.currency(r?.rendimentosAno || 0)}</strong>
          </div>
        </div>
        <div style={{ background: (r?.darfDayTradeEstimado || 0) > 0 ? '#fffbeb' : '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309', display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertTriangle size={13} /> Day Trade ({wealth?.mes}) · DARF 20%
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: (r?.lucroDayTradeMes || 0) >= 0 ? '#15803d' : '#b91c1c', marginTop: 4 }}>
            Resultado: {fmt.currency(r?.lucroDayTradeMes || 0)}
          </div>
          <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>
            DARF estimado (20%): <strong>{fmt.currency(r?.darfDayTradeEstimado || 0)}</strong>
          </div>
        </div>
      </div>

      {/* Lançar Rendimentos / Proventos dos Investimentos */}
      <div style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: 16, padding: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#14532d', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={17} color="#15803d" /> Lançar Rendimentos & Proventos (Dividendos, JCP, FIIs, CDB, Tesouro)
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
            Registre os rendimentos recebidos das suas aplicações e acompanhe sua renda passiva mensal e anual.
          </p>
        </div>
        <form onSubmit={handleAddRendimento} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            <select
              className="form-control"
              value={rendAtivoId}
              onChange={(e) => {
                const idSel = e.target.value;
                setRendAtivoId(idSel);
                const found = (wealth?.patrimonio || []).find((p) => p.id === idSel);
                if (found) setRendAtivoNome(found.nome);
              }}
            >
              <option value="">Ativo avulso (digitar ao lado)</option>
              {(wealth?.patrimonio || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} {p.instituicao ? `(${p.instituicao})` : ''}
                </option>
              ))}
            </select>
            <input
              className="form-control"
              required
              placeholder="Nome do ativo (ex.: MXRF11, CDB Inter)"
              value={rendAtivoNome}
              onChange={(e) => setRendAtivoNome(e.target.value)}
            />
            <select className="form-control" value={rendTipo} onChange={(e) => setRendTipo(e.target.value)}>
              {Object.entries(TIPOS_RENDIMENTO).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <input type="date" className="form-control" required value={rendData} onChange={(e) => setRendData(e.target.value)} />
            <input className="form-control" required placeholder="Valor Bruto R$" value={rendBruto} onChange={(e) => setRendBruto(e.target.value)} />
            <input className="form-control" placeholder="IR Retido R$ (opcional)" value={rendIr} onChange={(e) => setRendIr(e.target.value)} />
            <button
              type="submit"
              disabled={salvandoRend}
              className="btn"
              style={{ background: '#15803d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}
            >
              <Plus size={14} /> {salvandoRend ? 'Salvando...' : 'Lançar Rendimento'}
            </button>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#166534', cursor: 'pointer' }}>
            <input type="checkbox" checked={rendLancarCaixa} onChange={(e) => setRendLancarCaixa(e.target.checked)} />
            Lançar também como receita (categoria Investimentos) no meu caixa mensal
          </label>
        </form>

        {(wealth?.rendimentos || []).length > 0 && (
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Ativo</th>
                  <th>Tipo</th>
                  <th>Bruto</th>
                  <th>IR Retido</th>
                  <th>Líquido Recebido</th>
                  <th style={{ textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {(wealth?.rendimentos || []).map((rd) => {
                  const meta = TIPOS_RENDIMENTO[rd.tipoRendimento] || { label: rd.tipoRendimento, cor: '#475569' };
                  return (
                    <tr key={rd.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{rd.data}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{rd.ativoNome}</div>
                        {rd.observacao && <div style={{ fontSize: 11.5, color: '#64748b' }}>{rd.observacao}</div>}
                      </td>
                      <td>
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, background: `${meta.cor}18`, color: meta.cor }}>
                          {meta.label}
                        </span>
                      </td>
                      <td>{fmt.currency(rd.valorBruto)}</td>
                      <td style={{ color: rd.irRetido > 0 ? '#b91c1c' : '#94a3b8' }}>
                        {rd.irRetido > 0 ? `- ${fmt.currency(rd.irRetido)}` : 'Isento'}
                      </td>
                      <td style={{ fontWeight: 800, color: '#15803d' }}>+ {fmt.currency(rd.valorLiquido)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ color: '#b91c1c', padding: '4px 8px' }}
                          onClick={() => handleExcluirRendimento(rd.id, rd.ativoNome)}
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

      {/* Cadastro Rápido */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={17} color="#15803d" /> Cadastrar Aplicação, Ação/FII, Day Trade ou Consórcio
        </h3>
        <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          <select className="form-control" value={classe} onChange={(e) => setClasse(e.target.value)}>
            {Object.entries(CLASSES_PATRIMONIO).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <input className="form-control" required placeholder="Ativo (ex.: PETR4, CDB 110%, Carta Imóvel)" value={nome} onChange={(e) => setNome(e.target.value)} />
          <input className="form-control" placeholder="Corretora / Administradora" value={instituicao} onChange={(e) => setInstituicao(e.target.value)} />
          <input className="form-control" required placeholder={classe === 'day_trade' ? 'Custo / Entrada R$' : 'Valor Aplicado/Pago R$'} value={valorAplicado} onChange={(e) => setValorAplicado(e.target.value)} />
          <input className="form-control" required placeholder={classe === 'day_trade' ? 'Saída / Final R$' : 'Valor Atual / Carta R$'} value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} />
          <input className="form-control" placeholder="Detalhe (110% CDI / 48x rest.)" value={taxaOuDetalhe} onChange={(e) => setTaxaOuDetalhe(e.target.value)} />
          <button type="submit" className="btn" style={{ background: '#15803d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}>
            <Plus size={14} /> Adicionar
          </button>
        </form>
      </div>

      {/* Filtros + Tabela */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setFiltroClasse('todos')}
            style={{ padding: '6px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, background: filtroClasse === 'todos' ? '#0f172a' : '#f1f5f9', color: filtroClasse === 'todos' ? '#fff' : '#334155' }}
          >
            Todos ({wealth?.patrimonio.length || 0})
          </button>
          {Object.entries(CLASSES_PATRIMONIO).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFiltroClasse(k)}
              style={{ padding: '6px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, background: filtroClasse === k ? v.cor : '#f1f5f9', color: filtroClasse === k ? '#fff' : '#334155' }}
            >
              {v.label}
            </button>
          ))}
        </div>

        {lista.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13.5 }}>Nenhum ativo cadastrado nesta categoria.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Classe</th>
                  <th>Ativo / Consórcio</th>
                  <th>Instituição</th>
                  <th>Aplicado / Pago</th>
                  <th>Atual / Saída</th>
                  <th>Resultado</th>
                  <th style={{ textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const meta = CLASSES_PATRIMONIO[p.classe] || { label: p.classe, cor: '#475569' };
                  return (
                    <tr key={p.id}>
                      <td>
                        <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, background: `${meta.cor}18`, color: meta.cor }}>
                          {meta.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{p.nome}</div>
                        {p.taxaOuDetalhe && <div style={{ fontSize: 11.5, color: '#64748b' }}>{p.taxaOuDetalhe}</div>}
                      </td>
                      <td style={{ fontSize: 13 }}>{p.instituicao || '—'}</td>
                      <td>{fmt.currency(p.valorAplicado)}</td>
                      <td style={{ fontWeight: 700 }}>{fmt.currency(p.valorAtual)}</td>
                      <td style={{ fontWeight: 800, color: p.resultado >= 0 ? '#15803d' : '#b91c1c' }}>
                        {p.resultado >= 0 ? '+' : ''}{fmt.currency(p.resultado)} ({p.rentabilidadePct}%)
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className="btn btn-secondary" style={{ color: '#b91c1c', padding: '4px 8px' }} onClick={() => handleExcluir(p.id, p.nome)}>
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
    </div>
  );
}

export function RelatoriosConsultorIaTab({
  wealth,
  mes,
}: {
  wealth: WealthData | null;
  mes: string;
}) {
  const [objetivo, setObjetivo] = useState('');
  const [gerando, setGerando] = useState(false);
  const [planoIa, setPlanoIa] = useState('');

  const handleGerarPlano = async (enviarWhatsapp = false) => {
    setGerando(true);
    try {
      const res = await fetch('/api/financas-pessoais/ia-consultor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, objetivo, enviarWhatsapp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Erro ao gerar plano com IA.');
        return;
      }
      setPlanoIa(data.analise || '');
      if (enviarWhatsapp) {
        toast.success(data.whatsappEnviado ? 'Plano Financeiro IA enviado no seu WhatsApp!' : 'Plano gerado! (Cadastre seu telefone no perfil para receber no WhatsApp)');
      } else {
        toast.success('Plano Financeiro Personalizado gerado pela IA!');
      }
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Relatório Semanal + Evolução 6 Meses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 7 }}>
            <BarChart3 size={17} color="var(--accent, #600000)" /> Relatório Semanal (Últimos 7 dias)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 10 }}>
              <div style={{ fontSize: 11.5, color: '#166534', fontWeight: 700 }}>Entrou (7d)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#15803d', marginTop: 2 }}>{fmt.currency(wealth?.relatorioSemanal.entrou || 0)}</div>
            </div>
            <div style={{ background: '#fef2f2', padding: 12, borderRadius: 10 }}>
              <div style={{ fontSize: 11.5, color: '#991b1b', fontWeight: 700 }}>Saiu (7d)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#b91c1c', marginTop: 2 }}>{fmt.currency(wealth?.relatorioSemanal.saiu || 0)}</div>
            </div>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
              <div style={{ fontSize: 11.5, color: '#475569', fontWeight: 700 }}>Saldo (7d)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{fmt.currency(wealth?.relatorioSemanal.saldo || 0)}</div>
            </div>
          </div>
          {(wealth?.relatorioSemanal.topCategorias || []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {wealth!.relatorioSemanal.topCategorias.map((c) => (
                <div key={c.categoria} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#334155' }}>{c.categoria}</span>
                  <strong>{fmt.currency(c.total)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Sem gastos registrados nos últimos 7 dias.</div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Evolução Mensal (6 Meses)</h3>
          <div style={{ width: '100%', height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wealth?.evolucao6Meses || []}>
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmt.currency(Number(v || 0))} />
                <Legend />
                <Bar dataKey="receitas" name="Entrou" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Saiu" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Consultor IA de Dívidas & Investimentos */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 22 }}>
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={20} color="var(--accent, #600000)" /> Consultor IA — Plano para Resolver Dívidas & Melhorar Investimentos
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#64748b' }}>
            A IA analisa seus gastos, cartões, taxas de juros das dívidas, aplicações, bolsa, day trade e consórcios para montar um plano prático personalizado.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <input
            className="form-control"
            style={{ flex: '1 1 280px' }}
            placeholder="Objetivo opcional (ex.: quitar o financiamento do carro em 12 meses ou montar reserva de R$ 50 mil)..."
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
          />
          <button
            type="button"
            className="btn"
            disabled={gerando}
            onClick={() => handleGerarPlano(false)}
            style={{ background: 'var(--accent, #600000)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {gerando ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={15} />}
            {gerando ? 'Analisando carteira...' : 'Gerar Plano com IA'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={gerando}
            onClick={() => handleGerarPlano(true)}
            style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <MessageSquare size={14} /> Enviar no WhatsApp
          </button>
        </div>

        {planoIa && (
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 14, padding: 18, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.65, color: '#0f172a' }}>
            {planoIa}
          </div>
        )}
      </div>
    </div>
  );
}
