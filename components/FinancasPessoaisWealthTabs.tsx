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
  Upload,
  X,
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
    rendimentosAcumulados?: number;
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
  assinaturasCartao?: Array<{
    id: string;
    cartaoId: string | null;
    cartaoNome: string;
    nome: string;
    categoria: string;
    valorMensal: number;
    diaCobranca: number;
    ativa: boolean;
  }>;
}

interface ItemFaturaPreview {
  idx: number;
  data: string;
  descricao: string;
  valor: number;
  parcela: string;
  categoria: string;
  dedutivelIrpf: boolean;
  jaLancado: boolean;
  motivoMatch: string | null;
  lancar: boolean;
  pareceAssinatura: boolean;
  jaEhAssinatura: boolean;
  salvarAssinatura: boolean;
}

interface FaturaPreviewState {
  nomeArquivo: string;
  cartaoId: string;
  cartaoNome: string;
  resumo: {
    totalItens: number;
    conferidos: number;
    faltando: number;
    assinaturasDetectadas: number;
    totalFatura: number;
    totalConferido: number;
    totalFaltando: number;
  };
  itens: ItemFaturaPreview[];
}

const CATEGORIAS_FATURA = [
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
  'Outros',
];

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

  // Conferência de Fatura PDF com IA
  const [cartaoFaturaId, setCartaoFaturaId] = useState('');
  const [analisandoFatura, setAnalisandoFatura] = useState(false);
  const [confirmandoFatura, setConfirmandoFatura] = useState(false);
  const [faturaPreview, setFaturaPreview] = useState<FaturaPreviewState | null>(null);

  // Form Assinatura Recorrente no Cartão
  const [assinCartaoId, setAssinCartaoId] = useState('');
  const [assinNome, setAssinNome] = useState('');
  const [assinCategoria, setAssinCategoria] = useState('Lazer');
  const [assinValor, setAssinValor] = useState('');
  const [assinDia, setAssinDia] = useState('10');
  const [lancandoAssinMes, setLancandoAssinMes] = useState(false);

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

  const handleExcluir = async (recurso: 'cartao' | 'divida' | 'assinatura_cartao', id: string, label: string) => {
    const ok = await confirmAsync(`Remover "${label}"?`);
    if (!ok) return;
    await fetch(`/api/financas-pessoais/wealth?recurso=${recurso}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast.success('Removido!');
    onAtualizado();
  };

  const handleAddAssinatura = async (e: React.FormEvent) => {
    e.preventDefault();
    const cartaoSel = (wealth?.cartoes || []).find((c) => c.id === assinCartaoId);
    const res = await fetch('/api/financas-pessoais/wealth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recurso: 'assinatura_cartao',
        cartaoId: assinCartaoId || null,
        cartaoNome: cartaoSel?.nome || '',
        nome: assinNome,
        categoria: assinCategoria,
        valorMensal: parseFloat(assinValor.replace(',', '.')) || 0,
        diaCobranca: Number(assinDia) || 10,
      }),
    });
    if (!res.ok) {
      toast.error('Preencha nome e valor mensal da assinatura.');
      return;
    }
    toast.success('Assinatura cadastrada no cartão!');
    setAssinNome('');
    setAssinValor('');
    onAtualizado();
  };

  const handleLancarAssinaturasMes = async () => {
    setLancandoAssinMes(true);
    try {
      const res = await fetch('/api/financas-pessoais/wealth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurso: 'lancar_assinaturas_mes', mes: wealth?.mes }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Erro ao lançar assinaturas.');
        return;
      }
      toast.success(`Assinaturas do mês: ${d.lancadas || 0} lançada(s) · ${d.puladas || 0} já existente(s).`);
      onAtualizado();
    } finally {
      setLancandoAssinMes(false);
    }
  };

  const handleImportarFaturaPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAnalisandoFatura(true);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      const buffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
      const linhas: string[] = [];
      const maxPages = Math.min(doc.numPages, 25);
      for (let p = 1; p <= maxPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const byY = new Map<number, { x: number; str: string }[]>();
        (content.items as any[]).forEach((item) => {
          const y = Math.round(item.transform[5]);
          if (!byY.has(y)) byY.set(y, []);
          byY.get(y)!.push({ x: item.transform[4], str: item.str });
        });
        Array.from(byY.keys())
          .sort((a, b) => b - a)
          .forEach((y) => {
            const linha = byY
              .get(y)!
              .sort((a, b) => a.x - b.x)
              .map((c) => c.str)
              .join(' ')
              .trim();
            if (linha) linhas.push(linha);
          });
      }
      const textoPdf = linhas.join('\n');
      if (!textoPdf.trim()) {
        toast.error('Não foi possível extrair texto deste PDF de fatura.');
        return;
      }
      const cartaoSel = (wealth?.cartoes || []).find((c) => c.id === cartaoFaturaId);
      const res = await fetch('/api/financas-pessoais/fatura-cartao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: 'analisar',
          conteudo: textoPdf,
          nomeArquivo: file.name,
          cartaoId: cartaoSel?.id || '',
          cartaoNome: cartaoSel?.nome || '',
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Erro ao analisar fatura em PDF.');
        return;
      }
      setFaturaPreview(d);
      toast.success(
        `Fatura conferida! ${d.resumo?.conferidos || 0} já lançado(s) · ${d.resumo?.faltando || 0} faltando lançar.`
      );
    } catch {
      toast.error('Erro ao ler PDF da fatura.');
    } finally {
      setAnalisandoFatura(false);
    }
  };

  const handleConfirmarFatura = async () => {
    if (!faturaPreview) return;
    const ativos = faturaPreview.itens.filter((i) => i.lancar || i.salvarAssinatura);
    if (ativos.length === 0) {
      toast.error('Selecione pelo menos 1 item para lançar ou salvar como assinatura.');
      return;
    }
    setConfirmandoFatura(true);
    try {
      const res = await fetch('/api/financas-pessoais/fatura-cartao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: 'confirmar',
          cartaoId: faturaPreview.cartaoId,
          cartaoNome: faturaPreview.cartaoNome,
          itens: ativos,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Erro ao gravar itens da fatura.');
        return;
      }
      toast.success(
        `Fatura conciliada! ${d.lancados || 0} lançamento(s) incluído(s)${d.assinaturasCriadas ? ` · ${d.assinaturasCriadas} assinatura(s) salva(s)` : ''}.`
      );
      setFaturaPreview(null);
      onAtualizado();
    } finally {
      setConfirmandoFatura(false);
    }
  };

  const atualizarItemFatura = (idx: number, patch: Partial<ItemFaturaPreview>) => {
    setFaturaPreview((prev) =>
      prev ? { ...prev, itens: prev.itens.map((it) => (it.idx === idx ? { ...it, ...patch } : it)) } : null
    );
  };

  const assinaturasLista = wealth?.assinaturasCartao || [];
  const totalAssinaturasMes = assinaturasLista.filter((a) => a.ativa).reduce((acc, a) => acc + a.valorMensal, 0);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {(wealth?.cartoes || []).length > 0 && (
              <select
                className="form-control"
                style={{ width: 'auto', minWidth: 150, fontSize: 13 }}
                value={cartaoFaturaId}
                onChange={(e) => setCartaoFaturaId(e.target.value)}
              >
                <option value="">Cartão da fatura (opc.)</option>
                {(wealth?.cartoes || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            )}
            <label
              className="btn"
              style={{
                background: 'var(--accent, #600000)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                margin: 0,
              }}
              title="Suba o PDF da fatura do cartão para conferir se todas as compras foram lançadas e detectar assinaturas"
            >
              <Upload size={14} /> {analisandoFatura ? 'Conferindo PDF com IA...' : 'Conferir Fatura PDF (IA)'}
              <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} disabled={analisandoFatura} onChange={handleImportarFaturaPdf} />
            </label>
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

      {/* Assinaturas Recorrentes no Cartão */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={17} color="#7c3aed" /> Assinaturas Recorrentes no Cartão
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
              Total mensal fixo: <strong style={{ color: '#7c3aed' }}>{fmt.currency(totalAssinaturasMes)}/mês</strong> · Custo anual projetado:{' '}
              <strong>{fmt.currency(totalAssinaturasMes * 12)}/ano</strong>
            </p>
          </div>
          {assinaturasLista.length > 0 && (
            <button
              type="button"
              disabled={lancandoAssinMes}
              onClick={handleLancarAssinaturasMes}
              className="btn btn-secondary"
              style={{ borderRadius: 10, fontWeight: 700, fontSize: 12.5 }}
            >
              {lancandoAssinMes ? 'Lançando...' : `Lançar assinaturas em ${wealth?.mes || 'mês atual'}`}
            </button>
          )}
        </div>

        <form onSubmit={handleAddAssinatura} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8, marginBottom: 16 }}>
          <select className="form-control" value={assinCartaoId} onChange={(e) => setAssinCartaoId(e.target.value)}>
            <option value="">Qualquer cartão</option>
            {(wealth?.cartoes || []).map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <input className="form-control" required placeholder="Assinatura (ex.: Netflix, iCloud)" value={assinNome} onChange={(e) => setAssinNome(e.target.value)} />
          <select className="form-control" value={assinCategoria} onChange={(e) => setAssinCategoria(e.target.value)}>
            {CATEGORIAS_FATURA.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="form-control" required placeholder="Valor R$/mês" value={assinValor} onChange={(e) => setAssinValor(e.target.value)} />
          <input className="form-control" type="number" min={1} max={31} placeholder="Dia cobrança" value={assinDia} onChange={(e) => setAssinDia(e.target.value)} />
          <button type="submit" className="btn" style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}>
            <Plus size={14} /> Assinatura
          </button>
        </form>

        {assinaturasLista.length === 0 ? (
          <div style={{ padding: 18, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            Nenhuma assinatura cadastrada ainda. Cadastre acima ou importe a fatura em PDF para a IA detectar automaticamente!
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Assinatura</th>
                  <th>Cartão</th>
                  <th>Categoria</th>
                  <th>Dia</th>
                  <th>Valor/Mês</th>
                  <th>Custo/Ano</th>
                  <th style={{ textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {assinaturasLista.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 700 }}>{a.nome}</td>
                    <td style={{ fontSize: 13, color: '#64748b' }}>{a.cartaoNome || 'Cartão'}</td>
                    <td style={{ fontSize: 13 }}>{a.categoria}</td>
                    <td style={{ fontSize: 13 }}>Dia {a.diaCobranca}</td>
                    <td style={{ fontWeight: 800, color: '#7c3aed' }}>{fmt.currency(a.valorMensal)}</td>
                    <td style={{ fontSize: 13, color: '#475569' }}>{fmt.currency(a.valorMensal * 12)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ color: '#b91c1c', padding: '4px 8px' }}
                        onClick={() => handleExcluir('assinatura_cartao', a.id, a.nome)}
                      >
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

      {/* Modal de Conferência de Fatura PDF com IA */}
      {faturaPreview && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}
          onClick={() => !confirmandoFatura && setFaturaPreview(null)}
        >
          <div
            className="fp-modal-card"
            style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 1020, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17.5, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={18} color="var(--accent, #600000)" /> Conferência de Fatura PDF ({faturaPreview.nomeArquivo})
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>
                  Validamos cada compra da fatura contra o que você já lançou. Itens faltantes já vêm marcados e assinaturas recorrentes podem ser salvas em 1 clique.
                </p>
              </div>
              <button type="button" disabled={confirmandoFatura} onClick={() => setFaturaPreview(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#e2e8f0', color: '#0f172a' }}>
                Total Fatura: {fmt.currency(faturaPreview.resumo.totalFatura)} ({faturaPreview.resumo.totalItens} itens)
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#dcfce7', color: '#166534' }}>
                ✓ Conferidos: {faturaPreview.resumo.conferidos} ({fmt.currency(faturaPreview.resumo.totalConferido)})
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#fee2e2', color: '#b91c1c' }}>
                Faltando lançar: {faturaPreview.resumo.faltando} ({fmt.currency(faturaPreview.resumo.totalFaltando)})
              </span>
              {faturaPreview.resumo.assinaturasDetectadas > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#f3e8ff', color: '#6b21a8' }}>
                  Assinaturas detectadas: {faturaPreview.resumo.assinaturasDetectadas}
                </span>
              )}
            </div>

            <div style={{ overflow: 'auto', flex: 1, padding: '0 14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: 12 }}>
                    <th style={{ padding: '10px 6px' }}>Lançar</th>
                    <th style={{ padding: '10px 6px' }}>Data</th>
                    <th style={{ padding: '10px 6px' }}>Compra na Fatura</th>
                    <th style={{ padding: '10px 6px' }}>Categoria</th>
                    <th style={{ padding: '10px 6px', textAlign: 'center' }}>Assinatura?</th>
                    <th style={{ padding: '10px 6px', textAlign: 'center' }}>IRPF</th>
                    <th style={{ padding: '10px 6px', textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {faturaPreview.itens.map((it) => (
                    <tr key={it.idx} style={{ borderBottom: '1px solid #f1f5f9', background: it.jaLancado && !it.lancar ? '#f8fafc' : '#fff' }}>
                      <td style={{ padding: '8px 6px' }}>
                        <input
                          type="checkbox"
                          checked={it.lancar}
                          onChange={(e) => atualizarItemFatura(it.idx, { lancar: e.target.checked })}
                        />
                      </td>
                      <td style={{ padding: '8px 6px', whiteSpace: 'nowrap', color: '#475569' }}>{it.data}</td>
                      <td style={{ padding: '8px 6px', minWidth: 210 }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {it.descricao} {it.parcela ? <span style={{ fontSize: 11.5, color: '#1d4ed8' }}>({it.parcela})</span> : null}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 3 }}>
                          {it.jaLancado ? (
                            <span style={{ fontSize: 10.5, fontWeight: 800, background: '#dcfce7', color: '#166534', padding: '1px 7px', borderRadius: 99 }}>
                              ✓ Já lançado
                            </span>
                          ) : (
                            <span style={{ fontSize: 10.5, fontWeight: 800, background: '#fee2e2', color: '#b91c1c', padding: '1px 7px', borderRadius: 99 }}>
                              Faltando
                            </span>
                          )}
                          {it.pareceAssinatura && (
                            <span style={{ fontSize: 10.5, fontWeight: 800, background: '#f3e8ff', color: '#6b21a8', padding: '1px 7px', borderRadius: 99 }}>
                              Assinatura
                            </span>
                          )}
                          {it.motivoMatch && <span style={{ fontSize: 11, color: '#64748b' }}>{it.motivoMatch}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <select
                          className="form-control"
                          style={{ fontSize: 12, padding: '4px 6px', minWidth: 130 }}
                          value={it.categoria}
                          onChange={(e) => atualizarItemFatura(it.idx, { categoria: e.target.value })}
                        >
                          {CATEGORIAS_FATURA.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        {it.jaEhAssinatura ? (
                          <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700 }}>Já salva</span>
                        ) : (
                          <input
                            type="checkbox"
                            title="Incluir na lista de Assinaturas Recorrentes do Cartão"
                            checked={it.salvarAssinatura}
                            onChange={(e) => atualizarItemFatura(it.idx, { salvarAssinatura: e.target.checked })}
                          />
                        )}
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          title="Dedutível no IRPF"
                          checked={it.dedutivelIrpf}
                          onChange={(e) => atualizarItemFatura(it.idx, { dedutivelIrpf: e.target.checked })}
                        />
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 800, color: '#b91c1c' }}>
                        {fmt.currency(it.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, background: '#f8fafc' }}>
              <div style={{ fontSize: 13, color: '#475569' }}>
                Lançar: <strong>{faturaPreview.itens.filter((i) => i.lancar).length}</strong> · Salvar assinaturas:{' '}
                <strong>{faturaPreview.itens.filter((i) => i.salvarAssinatura).length}</strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary" disabled={confirmandoFatura} onClick={() => setFaturaPreview(null)}>
                  Fechar
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={confirmandoFatura}
                  onClick={handleConfirmarFatura}
                  style={{ background: '#15803d', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, padding: '8px 16px' }}
                >
                  {confirmandoFatura ? 'Salvando...' : 'Confirmar Conferência da Fatura'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

  // Form Rendimento / Provento (vinculado a investimento cadastrado)
  const [rendAtivoId, setRendAtivoId] = useState('');
  const [rendTipo, setRendTipo] = useState('dividendo');
  const [rendData, setRendData] = useState(() => new Date().toISOString().slice(0, 10));
  const [rendBruto, setRendBruto] = useState('');
  const [rendIr, setRendIr] = useState('');
  const [rendSomarAtual, setRendSomarAtual] = useState(false);
  const [rendLancarCaixa, setRendLancarCaixa] = useState(true);
  const [salvandoRend, setSalvandoRend] = useState(false);

  const investimentosElegiveis = (wealth?.patrimonio || []).filter((p) => p.classe !== 'day_trade');

  const handleAddRendimento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rendAtivoId) {
      toast.error('Selecione um investimento cadastrado na sua carteira.');
      return;
    }
    setSalvandoRend(true);
    try {
      const res = await fetch('/api/financas-pessoais/wealth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recurso: 'rendimento',
          patrimonioId: rendAtivoId,
          tipoRendimento: rendTipo,
          data: rendData,
          valorBruto: parseFloat(rendBruto.replace(',', '.')) || 0,
          irRetido: parseFloat(rendIr.replace(',', '.')) || 0,
          somarNoValorAtual: rendSomarAtual,
          lancarNoCaixa: rendLancarCaixa,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Erro ao lançar rendimento.');
        return;
      }
      toast.success(
        rendSomarAtual
          ? 'Rendimento lançado e somado ao saldo atual do investimento!'
          : rendLancarCaixa
          ? 'Rendimento lançado no investimento e somado ao seu caixa!'
          : 'Rendimento lançado no investimento!'
      );
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

      {/* Lançar Rendimentos / Proventos dos Investimentos Cadastrados */}
      <div id="secao-rendimentos-pf" style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: 16, padding: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#14532d', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={17} color="#15803d" /> Lançar Rendimentos & Proventos por Investimento Cadastrado
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
            Escolha o investimento já cadastrado na sua carteira para registrar o rendimento (Dividendos, JCP, FII, CDB, Tesouro) e acompanhar o retorno real de cada ativo.
          </p>
        </div>

        {investimentosElegiveis.length === 0 ? (
          <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px dashed #cbd5e1', fontSize: 13.5, color: '#475569' }}>
            Cadastre primeiro um investimento abaixo (ex.: CDB, Tesouro, Ação ou FII) para poder lançar os rendimentos vinculados a ele.
          </div>
        ) : (
          <form onSubmit={handleAddRendimento} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
              <select
                className="form-control"
                required
                value={rendAtivoId}
                onChange={(e) => {
                  const idSel = e.target.value;
                  setRendAtivoId(idSel);
                  const found = investimentosElegiveis.find((p) => p.id === idSel);
                  if (found?.classe === 'renda_fixa') {
                    setRendTipo('renda_fixa');
                    setRendSomarAtual(true);
                  }
                }}
              >
                <option value="">Selecione o investimento cadastrado...</option>
                {investimentosElegiveis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} {p.instituicao ? `(${p.instituicao})` : ''}
                  </option>
                ))}
              </select>
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#1d4ed8', cursor: 'pointer' }}>
                <input type="checkbox" checked={rendSomarAtual} onChange={(e) => setRendSomarAtual(e.target.checked)} />
                Somar ao Valor Atual deste investimento (rendimento reinvestido / CDB / Fundo)
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#166534', cursor: 'pointer' }}>
                <input type="checkbox" checked={rendLancarCaixa} onChange={(e) => setRendLancarCaixa(e.target.checked)} />
                Lançar também como receita no caixa mensal (ex.: dividendos na conta)
              </label>
            </div>
          </form>
        )}

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
                  <th>Rendimentos</th>
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
                      <td style={{ fontWeight: 700, color: (p.rendimentosAcumulados || 0) > 0 ? '#15803d' : '#94a3b8', whiteSpace: 'nowrap' }}>
                        {(p.rendimentosAcumulados || 0) > 0 ? `+ ${fmt.currency(p.rendimentosAcumulados || 0)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {p.classe !== 'day_trade' && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              title="Lançar rendimento para este investimento"
                              style={{ color: '#15803d', fontSize: 11.5, padding: '4px 8px', fontWeight: 700 }}
                              onClick={() => {
                                setRendAtivoId(p.id);
                                if (p.classe === 'renda_fixa') {
                                  setRendTipo('renda_fixa');
                                  setRendSomarAtual(true);
                                }
                                document.getElementById('secao-rendimentos-pf')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                            >
                              + Rend.
                            </button>
                          )}
                          <button type="button" className="btn btn-secondary" style={{ color: '#b91c1c', padding: '4px 8px' }} onClick={() => handleExcluir(p.id, p.nome)}>
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
