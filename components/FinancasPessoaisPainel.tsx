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
  temComprovante?: boolean;
  comprovanteNome?: string | null;
}

interface DedutivelIrpfItem {
  id: string;
  data: string;
  categoria: string;
  descricao: string;
  valor: number;
  formaPagamento: string;
  temComprovante?: boolean;
  comprovanteNome?: string | null;
}

interface MetaPf {
  id: string;
  categoria: string;
  limiteMensal: number;
  gastoAtual: number;
  percentual: number;
}

interface ItemExtratoPreview {
  idx: number;
  data: string;
  tipo: 'despesa' | 'receita';
  valor: number;
  descricao: string;
  jaLancado: boolean;
  motivoMatch: string | null;
  selecionado: boolean;
  categoria: string;
  destino: 'lancamento' | 'rendimento_investimento';
  tipoRendimento: string;
  dedutivelIrpf: boolean;
  origemClassificacao: 'existente' | 'historico' | 'ia' | 'regra';
  motivoClassificacao: string;
}

interface PreviewExtratoState {
  nomeArquivo: string;
  resumo: {
    totalLidas: number;
    novos: number;
    jaLancados: number;
    classificadosPorHistorico: number;
    classificadosPorIa: number;
    rendimentosDetectados: number;
    irpfDetectados: number;
  };
  itens: ItemExtratoPreview[];
}

export default function FinancasPessoaisPainel() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [aba, setAba] = useState<'geral' | 'cartoes' | 'investimentos' | 'relatorios' | 'irpf'>('geral');
  const [importandoExtrato, setImportandoExtrato] = useState(false);
  const [previewExtrato, setPreviewExtrato] = useState<PreviewExtratoState | null>(null);
  const [mostrarJaLancados, setMostrarJaLancados] = useState(true);
  const [confirmandoExtrato, setConfirmandoExtrato] = useState(false);
  const { data: wealthData, recarregar: recarregarWealth } = useWealthData(mes);
  const [carregando, setCarregando] = useState(true);
  const [whatsappVinculado, setWhatsappVinculado] = useState(false);
  const [telefone, setTelefone] = useState<string | null>(null);
  const [resumo, setResumo] = useState({ entrou: 0, saiu: 0, saldo: 0, totalDedutivelAno: 0 });
  const [porCategoria, setPorCategoria] = useState<Array<{ categoria: string; total: number }>>([]);
  const [metas, setMetas] = useState<MetaPf[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoPf[]>([]);
  const [dedutiveisIrpf, setDedutiveisIrpf] = useState<DedutivelIrpfItem[]>([]);
  const [enviandoDocId, setEnviandoDocId] = useState<string | null>(null);

  // Modal Novo Lançamento
  const [modalNovo, setModalNovo] = useState(false);
  const [tipo, setTipo] = useState<'despesa' | 'receita'>('despesa');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('Alimentação');
  const [formaPagamento, setFormaPagamento] = useState('PIX');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [dedutivelIrpf, setDedutivelIrpf] = useState(false);
  const [comprovanteData, setComprovanteData] = useState<string | null>(null);
  const [comprovanteNome, setComprovanteNome] = useState<string | null>(null);
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

  const lerArquivoComoDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (file.size > 3 * 1024 * 1024) {
        reject(new Error('Arquivo muito grande (limite de 3 MB).'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
      reader.readAsDataURL(file);
    });

  const handleAnexarDocumentoIrpf = async (id: string, file: File) => {
    setEnviandoDocId(id);
    try {
      const dataUrl = await lerArquivoComoDataUrl(file);
      const res = await fetch('/api/financas-pessoais', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, comprovanteData: dataUrl, comprovanteNome: file.name }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Erro ao anexar documento fiscal.');
        return;
      }
      toast.success('Documento fiscal salvo na Pasta IRPF!');
      carregar(mes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao ler o arquivo.');
    } finally {
      setEnviandoDocId(null);
    }
  };

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
          comprovanteData,
          comprovanteNome,
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
      setComprovanteData(null);
      setComprovanteNome(null);
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
        body: JSON.stringify({ modo: 'analisar', conteudo, nomeArquivo: file.name }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Não foi possível analisar o extrato.');
        return;
      }
      setPreviewExtrato({
        nomeArquivo: d.nomeArquivo || file.name,
        resumo: d.resumo,
        itens: Array.isArray(d.itens) ? d.itens : [],
      });
      setMostrarJaLancados(true);
      toast.success(
        `IA analisou ${d.resumo?.totalLidas || 0} lançamento(s): ${d.resumo?.novos || 0} novo(s) e ${d.resumo?.jaLancados || 0} já lançado(s).`
      );
    } catch {
      toast.error('Erro ao ler arquivo de extrato.');
    } finally {
      setImportandoExtrato(false);
    }
  };

  const handleConfirmarExtrato = async () => {
    if (!previewExtrato) return;
    const selecionados = previewExtrato.itens.filter((i) => i.selecionado);
    if (selecionados.length === 0) {
      toast.error('Selecione pelo menos 1 item para lançar.');
      return;
    }
    setConfirmandoExtrato(true);
    try {
      const res = await fetch('/api/financas-pessoais/importar-extrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'confirmar', itens: selecionados }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Erro ao gravar itens conciliados.');
        return;
      }
      toast.success(
        `Conciliação concluída! ${d.importados} lançado(s)${d.rendimentosCriados ? ` · ${d.rendimentosCriados} rendimento(s)` : ''}${d.irpfDetectados ? ` · ${d.irpfDetectados} dedutível(is) IRPF` : ''}.`
      );
      setPreviewExtrato(null);
      carregar(mes);
      recarregarWealth();
    } catch {
      toast.error('Erro de conexão ao confirmar conciliação.');
    } finally {
      setConfirmandoExtrato(false);
    }
  };

  const atualizarItemPreview = (idx: number, patch: Partial<ItemExtratoPreview>) => {
    setPreviewExtrato((prev) =>
      prev
        ? {
            ...prev,
            itens: prev.itens.map((it) => (it.idx === idx ? { ...it, ...patch } : it)),
          }
        : null
    );
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
    <div className="page-body fp-shell" style={{ padding: '24px 32px', background: '#f8fafc', minHeight: '100%' }}>
      <style jsx global>{`
        .fp-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }
        .fp-tabs::-webkit-scrollbar {
          height: 4px;
        }
        .fp-tabs::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 99px;
        }
        .fp-shell .table-wrap {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        @media (max-width: 768px) {
          .fp-shell {
            padding: 14px 12px 72px !important;
          }
          .fp-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
            margin-bottom: 14px !important;
          }
          .fp-header h1 {
            font-size: 22px !important;
          }
          .fp-header-actions {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            width: 100%;
          }
          .fp-header-actions .fp-btn-full {
            grid-column: 1 / -1 !important;
            justify-content: center !important;
            min-height: 42px;
          }
          .fp-header-actions .btn,
          .fp-header-actions input {
            width: 100% !important;
            justify-content: center !important;
            min-height: 40px;
            font-size: 13px !important;
          }
          .fp-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
            margin-bottom: 14px !important;
          }
          .fp-kpis > div {
            padding: 13px 12px !important;
            border-radius: 13px !important;
          }
          .fp-kpis .fp-kpi-val {
            font-size: 18px !important;
          }
          .fp-tabs {
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 6px;
            margin-left: -4px;
            margin-right: -4px;
            padding-left: 4px;
            padding-right: 4px;
          }
          .fp-tabs > button {
            white-space: nowrap !important;
            flex-shrink: 0 !important;
            min-height: 40px;
            font-size: 13px !important;
          }
          .fp-shell input,
          .fp-shell select {
            font-size: 16px !important;
          }
          .fp-modal-card {
            max-height: 92vh !important;
            border-radius: 14px !important;
          }
        }
      `}</style>

      {/* Cabeçalho estilo App Digital */}
      <div className="fp-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 22 }}>
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

        <div className="fp-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
            className="btn btn-secondary fp-btn-full"
            style={{ borderRadius: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: 0 }}
            title="Importar e conciliar extrato bancário pessoal (OFX ou CSV) com IA sem duplicar"
          >
            <Upload size={14} /> {importandoExtrato ? 'Analisando com IA...' : 'Conciliar Extrato IA (OFX/CSV)'}
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
            className="btn fp-btn-full"
            onClick={() => setModalNovo(true)}
            style={{ background: 'var(--accent, #600000)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={15} /> Novo Lançamento
          </button>
        </div>
      </div>

      {/* 4 Cards Principais */}
      <div className="fp-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 22 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#15803d' }}>
            <ArrowUpCircle size={15} /> Entrou ({mes})
          </div>
          <div className="fp-kpi-val" style={{ fontSize: 25, fontWeight: 800, color: '#15803d', marginTop: 6 }}>{fmt.currency(resumo.entrou)}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#b91c1c' }}>
            <ArrowDownCircle size={15} /> Saiu ({mes})
          </div>
          <div className="fp-kpi-val" style={{ fontSize: 25, fontWeight: 800, color: '#b91c1c', marginTop: 6 }}>{fmt.currency(resumo.saiu)}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>
            <Wallet size={15} /> Saldo do Mês
          </div>
          <div className="fp-kpi-val" style={{ fontSize: 25, fontWeight: 800, color: resumo.saldo >= 0 ? '#0f172a' : '#b91c1c', marginTop: 6 }}>
            {fmt.currency(resumo.saldo)}
          </div>
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#166534' }}>
            <ShieldCheck size={15} /> Dedutíveis IRPF ({mes.slice(0, 4)})
          </div>
          <div className="fp-kpi-val" style={{ fontSize: 25, fontWeight: 800, color: '#15803d', marginTop: 6 }}>
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
      <div className="fp-tabs">
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
                            {l.temComprovante && (
                              <a
                                href={`/api/financas-pessoais/comprovante?id=${encodeURIComponent(l.id)}`}
                                className="btn btn-secondary"
                                title={l.comprovanteNome || 'Baixar documento fiscal'}
                                style={{ fontSize: 11.5, padding: '4px 8px', color: '#1d4ed8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                              >
                                <Download size={12} />
                              </a>
                            )}
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
                Todo recibo, nota ou PDF de <strong>Saúde, Educação ou Previdência</strong> enviado pelo WhatsApp ou anexado aqui fica guardado com o documento fiscal pronto para baixar na declaração do IRPF.
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
              Nenhum gasto dedutível registrado em {mes.slice(0, 4)} ainda. Envie um PDF ou foto de recibo médico/escolar no WhatsApp ou lance acima.
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
                    <th>Documento Fiscal</th>
                    <th style={{ textAlign: 'right' }}>Valor Dedutível</th>
                  </tr>
                </thead>
                <tbody>
                  {dedutiveisIrpf.map((d) => (
                    <tr key={d.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{d.data}</td>
                      <td><strong>{d.categoria}</strong></td>
                      <td>{d.descricao}</td>
                      <td>{d.formaPagamento}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {d.temComprovante ? (
                            <>
                              <a
                                href={`/api/financas-pessoais/comprovante?id=${encodeURIComponent(d.id)}`}
                                className="btn"
                                title={d.comprovanteNome || 'Baixar documento fiscal'}
                                style={{
                                  background: '#1d4ed8',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  padding: '5px 10px',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                              >
                                <Download size={13} /> Baixar PDF / Doc
                              </a>
                              <label
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  color: '#475569',
                                  cursor: 'pointer',
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  border: '1px solid #cbd5e1',
                                }}
                              >
                                {enviandoDocId === d.id ? 'Salvando...' : 'Trocar'}
                                <input
                                  type="file"
                                  accept=".pdf,image/*"
                                  style={{ display: 'none' }}
                                  disabled={enviandoDocId === d.id}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleAnexarDocumentoIrpf(d.id, file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </>
                          ) : (
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#0f172a',
                                background: '#f8fafc',
                                border: '1px dashed #94a3b8',
                                borderRadius: 8,
                                padding: '5px 10px',
                                cursor: 'pointer',
                              }}
                            >
                              <Upload size={13} /> {enviandoDocId === d.id ? 'Salvando...' : 'Anexar PDF / Foto'}
                              <input
                                type="file"
                                accept=".pdf,image/*"
                                style={{ display: 'none' }}
                                disabled={enviandoDocId === d.id}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleAnexarDocumentoIrpf(d.id, file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#15803d', whiteSpace: 'nowrap' }}>{fmt.currency(d.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Conciliação Inteligente de Extrato com IA */}
      {previewExtrato && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !confirmandoExtrato && setPreviewExtrato(null)}
        >
          <div
            className="fp-modal-card"
            style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 1020, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Brain size={19} color="var(--accent, #600000)" /> Conciliação Inteligente de Extrato ({previewExtrato.nomeArquivo})
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>
                  A IA comparou com o que você já lançou, aprendeu com o seu histórico e sugeriu a categoria e destino de cada item. Revise e confirme:
                </p>
              </div>
              <button type="button" disabled={confirmandoExtrato} onClick={() => setPreviewExtrato(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Resumo em Badges */}
            <div style={{ padding: '12px 22px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#e2e8f0', color: '#0f172a' }}>
                  Total lido: {previewExtrato.resumo.totalLidas}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#dcfce7', color: '#166534' }}>
                  Novos: {previewExtrato.resumo.novos}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#f1f5f9', color: '#475569' }}>
                  Já lançados (ignorados): {previewExtrato.resumo.jaLancados}
                </span>
                {previewExtrato.resumo.classificadosPorHistorico > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#f3e8ff', color: '#6b21a8' }}>
                    Pelo seu histórico: {previewExtrato.resumo.classificadosPorHistorico}
                  </span>
                )}
                {previewExtrato.resumo.classificadosPorIa > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#dbeafe', color: '#1d4ed8' }}>
                    Classificados pela IA: {previewExtrato.resumo.classificadosPorIa}
                  </span>
                )}
                {previewExtrato.resumo.rendimentosDetectados > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#ecfdf5', color: '#047857' }}>
                    Rendimentos detectados: {previewExtrato.resumo.rendimentosDetectados}
                  </span>
                )}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                <input type="checkbox" checked={mostrarJaLancados} onChange={(e) => setMostrarJaLancados(e.target.checked)} />
                Mostrar já lançados
              </label>
            </div>

            {/* Tabela Revisável */}
            <div style={{ overflow: 'auto', flex: 1, padding: '0 14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: 12 }}>
                    <th style={{ padding: '10px 6px' }}>Lançar</th>
                    <th style={{ padding: '10px 6px' }}>Data</th>
                    <th style={{ padding: '10px 6px' }}>Descrição & Inteligência</th>
                    <th style={{ padding: '10px 6px' }}>Destino</th>
                    <th style={{ padding: '10px 6px' }}>Categoria</th>
                    <th style={{ padding: '10px 6px' }}>IRPF</th>
                    <th style={{ padding: '10px 6px', textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {previewExtrato.itens
                    .filter((it) => mostrarJaLancados || !it.jaLancado)
                    .map((it) => (
                      <tr
                        key={it.idx}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: it.jaLancado && !it.selecionado ? '#f8fafc' : '#fff',
                          opacity: it.jaLancado && !it.selecionado ? 0.65 : 1,
                        }}
                      >
                        <td style={{ padding: '8px 6px' }}>
                          <input
                            type="checkbox"
                            checked={it.selecionado}
                            onChange={(e) => atualizarItemPreview(it.idx, { selecionado: e.target.checked })}
                          />
                        </td>
                        <td style={{ padding: '8px 6px', whiteSpace: 'nowrap', color: '#475569' }}>{it.data}</td>
                        <td style={{ padding: '8px 6px', minWidth: 220 }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{it.descricao}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginTop: 3 }}>
                            {it.jaLancado && (
                              <span style={{ fontSize: 10.5, fontWeight: 800, background: '#e2e8f0', color: '#334155', padding: '1px 7px', borderRadius: 99 }}>
                                Já lançado
                              </span>
                            )}
                            {it.origemClassificacao === 'historico' && (
                              <span style={{ fontSize: 10.5, fontWeight: 800, background: '#f3e8ff', color: '#6b21a8', padding: '1px 7px', borderRadius: 99 }}>
                                Histórico
                              </span>
                            )}
                            {it.origemClassificacao === 'ia' && (
                              <span style={{ fontSize: 10.5, fontWeight: 800, background: '#dbeafe', color: '#1d4ed8', padding: '1px 7px', borderRadius: 99 }}>
                                IA
                              </span>
                            )}
                            <span style={{ fontSize: 11, color: '#64748b' }}>{it.motivoClassificacao}</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          {it.tipo === 'receita' ? (
                            <select
                              className="form-control"
                              style={{ fontSize: 12, padding: '4px 6px', minWidth: 135 }}
                              value={it.destino}
                              onChange={(e) =>
                                atualizarItemPreview(it.idx, {
                                  destino: e.target.value === 'rendimento_investimento' ? 'rendimento_investimento' : 'lancamento',
                                  categoria: e.target.value === 'rendimento_investimento' ? 'Investimentos' : it.categoria,
                                })
                              }
                            >
                              <option value="lancamento">Caixa Normal</option>
                              <option value="rendimento_investimento">Rendimento Invest.</option>
                            </select>
                          ) : (
                            <span style={{ fontSize: 12, color: '#64748b' }}>Caixa Normal</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          <select
                            className="form-control"
                            style={{ fontSize: 12, padding: '4px 6px', minWidth: 140 }}
                            value={it.categoria}
                            onChange={(e) => atualizarItemPreview(it.idx, { categoria: e.target.value })}
                          >
                            {CATEGORIAS.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                          {it.tipo === 'despesa' ? (
                            <input
                              type="checkbox"
                              title="Marcar como dedutível no IRPF"
                              checked={it.dedutivelIrpf}
                              onChange={(e) => atualizarItemPreview(it.idx, { dedutivelIrpf: e.target.checked })}
                            />
                          ) : (
                            <span style={{ color: '#cbd5e1' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 800, color: it.tipo === 'receita' ? '#15803d' : '#b91c1c' }}>
                          {it.tipo === 'receita' ? '+' : '-'} {fmt.currency(it.valor)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: '#f8fafc' }}>
              <div style={{ fontSize: 13, color: '#475569' }}>
                Selecionados para lançar:{' '}
                <strong style={{ color: '#0f172a' }}>{previewExtrato.itens.filter((i) => i.selecionado).length}</strong> de {previewExtrato.itens.length}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary" disabled={confirmandoExtrato} onClick={() => setPreviewExtrato(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={confirmandoExtrato || previewExtrato.itens.filter((i) => i.selecionado).length === 0}
                  onClick={handleConfirmarExtrato}
                  style={{ background: '#15803d', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, padding: '8px 16px' }}
                >
                  {confirmandoExtrato
                    ? 'Lançando...'
                    : `Confirmar e Lançar (${previewExtrato.itens.filter((i) => i.selecionado).length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Lançamento */}
      {modalNovo && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setModalNovo(false)}
        >
          <div className="fp-modal-card" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '92vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
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
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Documento Fiscal / Recibo (PDF ou foto, opcional)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12.5,
                      fontWeight: 600,
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: '1px dashed #94a3b8',
                      background: '#f8fafc',
                      cursor: 'pointer',
                    }}
                  >
                    <Upload size={14} /> {comprovanteNome ? 'Trocar arquivo' : 'Anexar PDF ou Imagem'}
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl = await lerArquivoComoDataUrl(file);
                          setComprovanteData(dataUrl);
                          setComprovanteNome(file.name);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Erro ao ler arquivo.');
                        }
                      }}
                    />
                  </label>
                  {comprovanteNome && (
                    <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                      {comprovanteNome}
                    </span>
                  )}
                </div>
              </div>
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
