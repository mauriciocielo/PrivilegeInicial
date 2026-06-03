'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { store, type Lancamento, type PlanoConta, type Portador, type Empresa, uid } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import GeminiQuickEntry from '../../../components/GeminiQuickEntry';

type Filtros = { tipo: string; status: string; portadorId: string; search: string; mes: string, semPlano: boolean };
type CardImportRow = {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  numeroDocumento?: string;
};

const normalizeText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const parseMoney = (value: unknown): number => {
  if (typeof value === 'number') return Math.abs(value);
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/[R$\s]/g, '')
    .replace(/\((.*)\)/, '-$1')
    .replace(/\./g, '')
    .replace(',', '.');
  return Math.abs(Number(normalized)) || 0;
};

const parseCardDate = (value: unknown): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().split('T')[0];
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value);
    return excelEpoch.toISOString().split('T')[0];
  }

  const raw = String(value || '').trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }

  return '';
};

const detectCardImportColumns = (headers: string[]) => {
  const normalized = headers.map(normalizeText);
  const find = (terms: string[]) => normalized.findIndex(header => terms.some(term => header.includes(term)));

  return {
    date: find(['data', 'dt compra', 'dt lancamento', 'lancamento']),
    description: find(['descricao', 'descrição', 'historico', 'histórico', 'estabelecimento', 'local', 'detalhe']),
    value: find(['valor', 'amount', 'total', 'debito', 'débito']),
    document: find(['documento', 'doc', 'parcela', 'cartao', 'cartão']),
  };
};

export default function LancamentosPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [portadores, setPortadores] = useState<Portador[]>([]);
  const [filtros, setFiltros] = useState<Filtros>({ tipo: '', status: '', portadorId: '', search: '', mes: '', semPlano: false });
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Lancamento | null>(null);
  const [form, setForm] = useState<Partial<Lancamento> & { tipoTransacao?: 'receita' | 'despesa' | 'transferencia', portadorDestinoId?: string }>({});
  const [contaSearch, setContaSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showReclassModal, setShowReclassModal] = useState(false);
  const [bulkMode, setBulkMode] = useState<'reclassificar' | 'transferir'>('reclassificar');
  const [reclassContaId, setReclassContaId] = useState('');
  const [reclassContaSearch, setReclassContaSearch] = useState('');
  const [reclassPortadorId, setReclassPortadorId] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [showCardImportModal, setShowCardImportModal] = useState(false);
  const [cardImportRows, setCardImportRows] = useState<CardImportRow[]>([]);
  const [cardSelectedIds, setCardSelectedIds] = useState<string[]>([]);
  const [cardCatMap, setCardCatMap] = useState<Record<string, string>>({});
  const [cardPortadorId, setCardPortadorId] = useState('');
  const [cardStatus, setCardStatus] = useState<'realizado' | 'previsto'>('realizado');
  const [cardFileName, setCardFileName] = useState('');
  const [cardImporting, setCardImporting] = useState(false);

  const [activeCompany, setActiveCompany] = useState<Empresa | null>(null);
  const [showC6BoletoModal, setShowC6BoletoModal] = useState(false);
  const [c6BoletoLanc, setC6BoletoLanc] = useState<Lancamento | null>(null);

  const handleOpenC6Boleto = (l: Lancamento) => {
    setC6BoletoLanc(l);
    setShowC6BoletoModal(true);
  };

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    setLancamentos(store.getLancamentos(eId));
    setPlanoContas(store.getPlanoContas(eId).filter(p => p.nivel === 3 && p.ativo));
    setPortadores(store.getPortadores(eId).filter(p => p.ativo));
    
    const emp = store.getEmpresas().find(e => e.id === eId) || null;
    setActiveCompany(emp);
  }, []);

  useEffect(() => {
    if (!cardPortadorId && portadores.length > 0) {
      const cartao = portadores.find(p => p.tipo === 'cartao');
      setCardPortadorId(cartao?.id || portadores[0].id);
    }
  }, [cardPortadorId, portadores]);

  const matchesConta = (conta: PlanoConta, search: string) => {
    const term = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (!term) return true;
    const text = `${conta.codigo} ${conta.descricao}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return text.includes(term);
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || 'e1';
    load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, [load]);

  const filtered = useMemo(() => {
    return lancamentos.filter(l => {
      if (filtros.tipo && l.tipo !== filtros.tipo) return false;
      if (filtros.status && l.status !== filtros.status) return false;
      if (filtros.portadorId && l.portadorId !== filtros.portadorId) return false;
      if (filtros.search && !l.descricao.toLowerCase().includes(filtros.search.toLowerCase())) return false;
      if (filtros.mes && !l.data.startsWith(filtros.mes)) return false;
      if (filtros.semPlano) {
        if (l.planoContaId === 'transf') return false;
        const hasPlan = planoContas.some(pc => pc.id === l.planoContaId);
        if (hasPlan && l.planoContaId !== '') return false;
      }
      return true;
    }).sort((a, b) => b.data.localeCompare(a.data));
  }, [lancamentos, filtros, planoContas]);

  const totRec = useMemo(() => filtered.filter(l => l.tipo === 'receita' && l.status === 'realizado').reduce((a, l) => a + l.valor, 0), [filtered]);
  const totDesp = useMemo(() => filtered.filter(l => l.tipo === 'despesa' && l.status === 'realizado').reduce((a, l) => a + l.valor, 0), [filtered]);

  const openNew = () => {
    setEditItem(null);
    setContaSearch('');
    setForm({
      tipoTransacao: 'receita',
      tipo: 'receita',
      status: 'realizado',
      origem: 'manual',
      data: new Date().toISOString().split('T')[0],
      empresaId,
    });
    setShowModal(true);
  };

  const openEdit = (l: Lancamento) => {
    setEditItem(l);
    setContaSearch('');
    if (l.planoContaId === 'transf') {
      const other = lancamentos.find(x => x.id !== l.id && x.createdAt === l.createdAt && x.planoContaId === 'transf');
      let portadorId = l.portadorId;
      let portadorDestinoId = other ? other.portadorId : '';
      
      if (l.tipo === 'receita') {
        portadorId = other ? other.portadorId : '';
        portadorDestinoId = l.portadorId;
      }

      const cleanDesc = l.descricao
        .replace(/^\[Transf\. Saída\] /, '')
        .replace(/^\[Transf\. Entrada\] /, '');

      setForm({
        ...l,
        descricao: cleanDesc,
        tipoTransacao: 'transferencia',
        portadorId,
        portadorDestinoId
      });
    } else {
      setForm({ ...l, tipoTransacao: l.tipo });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (form.tipoTransacao === 'transferencia') {
      if (!form.descricao || !form.valor || !form.portadorId || !form.portadorDestinoId || !form.data) {
        alert('Preencha todos os campos da transferência.');
        return;
      }
      if (form.portadorId === form.portadorDestinoId) {
        alert('Os portadores de origem e destino devem ser diferentes.');
        return;
      }
      setSaving(true);
      await new Promise(r => setTimeout(r, 300));

      try {
        if (editItem) {
          store.deleteLancamento(editItem.id);
          if (editItem.planoContaId === 'transf') {
            const other = lancamentos.find(x => x.id !== editItem.id && x.createdAt === editItem.createdAt && x.planoContaId === 'transf');
            if (other) {
              store.deleteLancamento(other.id);
            }
          }
        }

        const ts = new Date().toISOString();
        store.saveLancamento({
          id: uid(), empresaId, data: form.data!, descricao: `[Transf. Saída] ${form.descricao}`, valor: parseMoney(form.valor),
          tipo: 'despesa', planoContaId: 'transf', portadorId: form.portadorId!, status: (form.status || 'realizado') as 'previsto' | 'realizado', origem: 'manual', createdAt: ts
        });
        store.saveLancamento({
          id: uid(), empresaId, data: form.data!, descricao: `[Transf. Entrada] ${form.descricao}`, valor: parseMoney(form.valor),
          tipo: 'receita', planoContaId: 'transf', portadorId: form.portadorDestinoId!, status: (form.status || 'realizado') as 'previsto' | 'realizado', origem: 'manual', createdAt: ts
        });

        setLancamentos(store.getLancamentos(empresaId));
        setShowModal(false);
      } catch (e) {
        alert((e as Error).message);
      } finally {
        setSaving(false);
      }

    } else {
      if (!form.descricao || !form.valor || !form.planoContaId || !form.portadorId || !form.data) {
        alert('Preencha todos os campos obrigatórios.');
        return;
      }
      setSaving(true);
      await new Promise(r => setTimeout(r, 300));

      try {
        if (editItem && editItem.planoContaId === 'transf') {
          const other = lancamentos.find(x => x.id !== editItem.id && x.createdAt === editItem.createdAt && x.planoContaId === 'transf');
          if (other) {
            store.deleteLancamento(other.id);
          }
        }

        const lanc: Lancamento = {
          id: editItem?.id || uid(),
          empresaId,
          data: form.data!,
          descricao: form.descricao!,
          valor: parseMoney(form.valor),
          tipo: form.tipoTransacao as 'receita' | 'despesa',
          planoContaId: form.planoContaId!,
          portadorId: form.portadorId!,
          status: (form.status || 'realizado') as 'previsto' | 'realizado',
          numeroDocumento: form.numeroDocumento,
          observacao: form.observacao,
          attachmentName: form.attachmentName,
          attachmentData: form.attachmentData,
          origem: 'manual',
          createdAt: editItem?.createdAt || new Date().toISOString(),
        };
        store.saveLancamento(lanc);

        setLancamentos(store.getLancamentos(empresaId));
        setShowModal(false);
      } catch (e) {
        alert((e as Error).message);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm('Deseja excluir este lançamento?')) return;
    try {
      store.deleteLancamento(id);
      setLancamentos(store.getLancamentos(empresaId));
      setSelectedIds(prev => prev.filter(x => x !== id));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleBulkDelete = () => {
    if (!confirm(`Deseja excluir os ${selectedIds.length} lançamentos selecionados?`)) return;
    try {
      selectedIds.forEach(id => store.deleteLancamento(id));
      setLancamentos(store.getLancamentos(empresaId));
      setSelectedIds([]);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      setForm(f => ({ ...f, attachmentName: file.name, attachmentData: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const openCardImport = () => {
    const cartao = portadores.find(p => p.tipo === 'cartao');
    setCardPortadorId(cartao?.id || portadores[0]?.id || '');
    setCardStatus('realizado');
    setCardImportRows([]);
    setCardSelectedIds([]);
    setCardCatMap({});
    setCardFileName('');
    setShowCardImportModal(true);
  };

  const parseCardRows = (rows: unknown[][]): CardImportRow[] => {
    if (rows.length === 0) return [];
    const firstRow = rows[0].map(cell => String(cell || '').trim());
    const hasHeader = firstRow.some(cell => /data|descri|historico|histórico|valor|amount|estabelecimento/i.test(cell));
    const headers = hasHeader ? firstRow : ['data', 'descricao', 'valor', 'documento'];
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const columns = detectCardImportColumns(headers);
    const dateIndex = columns.date >= 0 ? columns.date : 0;
    const descriptionIndex = columns.description >= 0 ? columns.description : 1;
    const valueIndex = columns.value >= 0 ? columns.value : 2;

    return dataRows
      .map((row, index) => {
        const data = parseCardDate(row[dateIndex]);
        const descricao = String(row[descriptionIndex] || '').trim();
        const valor = parseMoney(row[valueIndex]);
        const numeroDocumento = columns.document >= 0 ? String(row[columns.document] || '').trim() : undefined;

        return {
          id: `card_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
          data,
          descricao,
          valor,
          numeroDocumento: numeroDocumento || undefined,
        };
      })
      .filter(row => row.data && row.descricao && row.valor > 0);
  };

  const parseDelimitedCardFile = (text: string): unknown[][] => {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
    return lines.map(line => line.split(delimiter).map(cell => cell.replace(/^"|"$/g, '').trim()));
  };

  const handleCardFile = async (file: File) => {
    setCardFileName(file.name);
    setCardCatMap({});

    const extension = file.name.split('.').pop()?.toLowerCase();
    let rawRows: unknown[][] = [];

    if (extension === 'xlsx' || extension === 'xls') {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rawRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as unknown[][];
    } else {
      const text = await file.text();
      rawRows = parseDelimitedCardFile(text);
    }

    const parsedRows = parseCardRows(rawRows);
    setCardImportRows(parsedRows);
    setCardSelectedIds(parsedRows.map(row => row.id));
    setCardCatMap(Object.fromEntries(
      parsedRows
        .map(row => [row.id, store.classifyDescription(empresaId, row.descricao) || ''])
        .filter(([, planoContaId]) => !!planoContaId)
    ));
  };

  const toggleCardImportRow = (id: string) => {
    setCardSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAllCardImportRows = () => {
    setCardSelectedIds(prev => prev.length === cardImportRows.length ? [] : cardImportRows.map(row => row.id));
  };

  const handleCardImport = async () => {
    if (!cardPortadorId) { alert('Selecione o portador do cartão.'); return; }
    const rowsToImport = cardImportRows.filter(row => cardSelectedIds.includes(row.id));
    if (rowsToImport.length === 0) { alert('Nenhum lançamento selecionado.'); return; }

    const missingCategory = rowsToImport.some(row => !cardCatMap[row.id]);
    if (missingCategory && !confirm('Alguns lançamentos estão sem plano de contas. Deseja importar mesmo assim?')) return;

    setCardImporting(true);
    const now = new Date().toISOString();
    const newLancamentos: Lancamento[] = rowsToImport.map(row => ({
      id: uid(),
      empresaId,
      data: row.data,
      descricao: row.descricao,
      valor: row.valor,
      tipo: 'despesa',
      planoContaId: cardCatMap[row.id] || '',
      portadorId: cardPortadorId,
      status: cardStatus,
      numeroDocumento: row.numeroDocumento,
      observacao: cardFileName ? `Importado da fatura/cartao: ${cardFileName}` : 'Importado da fatura/cartao',
      origem: 'manual',
      createdAt: now,
    }));

    newLancamentos.forEach(item => store.saveLancamento(item));
    setLancamentos(store.getLancamentos(empresaId));
    setCardImporting(false);
    setShowCardImportModal(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(l => l.id));
    }
  };

  const selectMissing = () => {
    const ids = filtered
      .filter(l => l.planoContaId !== 'transf' && (!l.planoContaId || !planoContas.some(pc => pc.id === l.planoContaId)))
      .map(l => l.id);
    setSelectedIds(ids);
  };

  const handleBulkReclassify = () => {
    if (bulkMode === 'transferir') {
      if (!reclassPortadorId) { alert('Selecione o portador destino.'); return; }
      const ts = new Date().toISOString();
      const newLancamentos: Lancamento[] = [];
      lancamentos.filter(l => selectedIds.includes(l.id)).forEach(l => {
        if (l.portadorId === reclassPortadorId) return;
        newLancamentos.push({
          id: uid(),
          empresaId,
          data: l.data,
          descricao: `[Transf. Saída] ${l.descricao}`,
          valor: Math.abs(l.valor),
          tipo: 'despesa', planoContaId: 'transf', portadorId: l.portadorId,
          status: 'realizado', origem: 'manual', createdAt: ts,
        });
        newLancamentos.push({
          id: uid(),
          empresaId,
          data: l.data,
          descricao: `[Transf. Entrada] ${l.descricao}`,
          valor: Math.abs(l.valor),
          tipo: 'receita', planoContaId: 'transf', portadorId: reclassPortadorId,
          status: 'realizado', origem: 'manual', createdAt: ts,
        });
      });

      newLancamentos.forEach(item => store.saveLancamento(item));
      setLancamentos(store.getLancamentos(empresaId));
      setSelectedIds([]);
      setShowReclassModal(false);
      return;
    }

    if (!reclassContaId && !reclassPortadorId) { alert('Selecione uma conta ou um portador.'); return; }
    const updatedItems = lancamentos
      .filter(l => selectedIds.includes(l.id))
      .map(l => ({
        ...l,
        planoContaId: reclassContaId || l.planoContaId,
        portadorId: reclassPortadorId || l.portadorId
      }));

    updatedItems.forEach(item => store.saveLancamento(item));
    setLancamentos(store.getLancamentos(empresaId));
    setSelectedIds([]);
    setShowReclassModal(false);
  };

  const meses = useMemo(() => {
    const list: string[] = [];
    const hoje = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return list;
  }, []);

  const modalPlanoContas = useMemo(() => {
    return planoContas.filter(p => p.tipo === form.tipoTransacao && matchesConta(p, contaSearch));
  }, [planoContas, form.tipoTransacao, contaSearch]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Lançamentos</div>
          <div className="page-subtitle">{filtered.length} lançamentos encontrados</div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={selectMissing} title="Selecionar todos os lançamentos sem plano de contas configurado">
            🎯 Selecionar s/ Plano
          </button>
          {selectedIds.length > 0 && (
            <>
              <button className="btn btn-secondary" onClick={() => { setBulkMode('reclassificar'); setReclassContaId(''); setReclassContaSearch(''); setReclassPortadorId(''); setTransferDate(new Date().toISOString().split('T')[0]); setShowReclassModal(true); }}>
                🔄 Ações em Lote ({selectedIds.length})
              </button>
              <button className="btn btn-primary" onClick={() => { setBulkMode('transferir'); setReclassContaId(''); setReclassContaSearch(''); setReclassPortadorId(''); setTransferDate(new Date().toISOString().split('T')[0]); setShowReclassModal(true); }}>
                ⇄ Transferir em Lote
              </button>
              <button className="btn btn-danger" onClick={handleBulkDelete}>
                🗑️ Excluir ({selectedIds.length})
              </button>
            </>
          )}
          <button className="btn btn-secondary" onClick={openCardImport}>💳 Importar Cartão</button>
          <button className="btn btn-primary" onClick={openNew}>＋ Novo Lançamento</button>
        </div>
      </div>

      <div className="page-body">
        <GeminiQuickEntry empresaId={empresaId} onSuccess={() => load(empresaId)} />

        {/* Quick Tabs for Accounts Payable/Receivable */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-light)', paddingBottom: 12, overflowX: 'auto' }}>
          <button 
            className={`btn ${(!filtros.status && !filtros.tipo) ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ fontSize: 12.5 }}
            onClick={() => setFiltros(f => ({ ...f, status: '', tipo: '' }))}
          >
            📋 Todos os Lançamentos
          </button>
          <button 
            className={`btn ${(filtros.status === 'previsto' && filtros.tipo === 'receita') ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ fontSize: 12.5 }}
            onClick={() => setFiltros(f => ({ ...f, status: 'previsto', tipo: 'receita' }))}
          >
            💰 Contas a Receber (Pendentes)
          </button>
          <button 
            className={`btn ${(filtros.status === 'previsto' && filtros.tipo === 'despesa') ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ fontSize: 12.5 }}
            onClick={() => setFiltros(f => ({ ...f, status: 'previsto', tipo: 'despesa' }))}
          >
            💸 Contas a Pagar (Pendentes)
          </button>
        </div>

        {/* Totais */}
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card green">
            <div className="stat-icon green">↑</div>
            <div className="stat-label">Receitas (filtro)</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{fmt.currency(totRec)}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-icon red">↓</div>
            <div className="stat-label">Despesas (filtro)</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{fmt.currency(totDesp)}</div>
          </div>
          <div className={`stat-card ${totRec - totDesp >= 0 ? 'blue' : 'red'}`}>
            <div className={`stat-icon ${totRec - totDesp >= 0 ? 'blue' : 'red'}`}>≈</div>
            <div className="stat-label">Resultado</div>
            <div className="stat-value" style={{ fontSize: 18, color: totRec - totDesp >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmt.currency(totRec - totDesp)}
            </div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple">#</div>
            <div className="stat-label">Total de Registros</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{filtered.length}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="card card-sm" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="search-bar">
              <span>🔍</span>
              <input
                placeholder="Buscar descrição..."
                value={filtros.search}
                onChange={e => setFiltros(f => ({ ...f, search: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <select className="form-control" value={filtros.mes} onChange={e => setFiltros(f => ({ ...f, mes: e.target.value }))}>
                <option value="">Todos os meses</option>
                {meses.map(m => {
                  const [y, mo] = m.split('-');
                  const d = new Date(Number(y), Number(mo) - 1, 1);
                  return <option key={m} value={m}>{d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</option>;
                })}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <select className="form-control" value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}>
                <option value="">Todos os tipos</option>
                <option value="receita">Receitas</option>
                <option value="despesa">Despesas</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <select className="form-control" value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}>
                <option value="">Todos os status</option>
                <option value="realizado">Realizado</option>
                <option value="previsto">Previsto</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <select className="form-control" value={filtros.portadorId} onChange={e => setFiltros(f => ({ ...f, portadorId: e.target.value }))}>
                <option value="">Todos os portadores</option>
                {portadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" id="check-semplano" checked={filtros.semPlano} onChange={e => setFiltros(f => ({ ...f, semPlano: e.target.checked }))} />
              <label htmlFor="check-semplano" style={{ fontSize: 13, color: 'var(--text-secondary)', userSelect: 'none', cursor: 'pointer' }}>Sem Plano</label>
            </div>
            {(filtros.tipo || filtros.status || filtros.portadorId || filtros.search || filtros.mes || filtros.semPlano) && (
              <button className="btn btn-ghost btn-sm" onClick={() => setFiltros({ tipo: '', status: '', portadorId: '', search: '', mes: '', semPlano: false })}>
                ✕ Limpar
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Plano de Contas</th>
                  <th>Portador</th>
                  <th>Nº Doc.</th>
                  <th>Status</th>
                  <th>Origem</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📭</div>
                      <h3>Nenhum lançamento encontrado</h3>
                      <p>Ajuste os filtros ou adicione um novo lançamento.</p>
                    </div>
                  </td></tr>
                ) : filtered.map(l => {
                  const pc = planoContas.find(p => p.id === l.planoContaId);
                  const port = portadores.find(p => p.id === l.portadorId);
                  return (
                    <tr key={l.id} style={{ background: selectedIds.includes(l.id) ? 'var(--bg-card2)' : undefined }}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedIds.includes(l.id)} onChange={() => toggleSelect(l.id)} />
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmt.date(l.data)}</td>
                      <td style={{ fontWeight: 500, maxWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {l.descricao}
                          {l.attachmentData && (
                            <a
                              href={`data:application/octet-stream;base64,${l.attachmentData}`}
                              download={l.attachmentName}
                              title={`Anexo: ${l.attachmentName}`}
                              style={{ textDecoration: 'none', fontSize: 14 }}
                            >📎</a>
                          )}
                        </div>
                        {l.observacao && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 'normal' }}>
                            {l.observacao}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{pc ? `${pc.codigo} - ${pc.descricao}` : '-'}</td>
                      <td style={{ fontSize: 12 }}>{port?.nome || '-'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.numeroDocumento || '-'}</td>
                      <td><span className={`badge ${l.status === 'realizado' ? 'badge-blue' : 'badge-yellow'}`}>{l.status === 'realizado' ? 'Realizado' : 'Previsto'}</span></td>
                      <td><span className={`badge ${l.origem === 'ofx' ? 'badge-purple' : 'badge-gray'}`}>{l.origem === 'ofx' ? 'OFX' : 'Manual'}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: (l.tipo === 'receita' && pc && pc.descricao.trim().startsWith('( - )')) ? 'var(--red)' : l.tipo === 'receita' ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                        {(l.tipo === 'receita' && pc && pc.descricao.trim().startsWith('( - )')) ? '-' : l.tipo === 'receita' ? '+' : '-'}{fmt.currency(l.valor)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {l.status === 'previsto' && l.tipo === 'receita' && activeCompany?.bancoBoleto === 'c6' && (
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ padding: '4px 8px', fontSize: 11, background: '#000', color: '#fff', border: 'none', marginRight: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              onClick={() => handleOpenC6Boleto(l)}
                            >
                              🖤 Boleto C6
                            </button>
                          )}
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(l)} title="Editar">✏️</button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(l.id)} title="Excluir">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editItem ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['receita', 'despesa', 'transferencia'] as const).map(t => {
                const isSelected = form.tipoTransacao === t;
                let colorClass = 'btn-secondary';
                if (isSelected) {
                  if (t === 'receita') colorClass = 'btn-success';
                  else if (t === 'despesa') colorClass = 'btn-danger';
                  else colorClass = 'btn-primary';
                }
                return (
                  <button
                    key={t}
                    className={`btn ${colorClass}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setForm(f => ({ ...f, tipoTransacao: t }))}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                );
              })}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Data *</label>
                <input type="date" className="form-control" value={form.data || ''} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor *</label>
                <input type="number" step="0.01" className="form-control" value={form.valor ?? ''} onChange={e => setForm(f => ({ ...f, valor: e.target.value as any }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Descrição *</label>
              <input className="form-control" value={form.descricao || ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>

            {form.tipoTransacao === 'transferencia' ? (
              <div className="form-group">
                <label className="form-label">Portador Destino *</label>
                <select className="form-control" value={form.portadorDestinoId || ''} onChange={e => setForm(f => ({ ...f, portadorDestinoId: e.target.value }))}>
                  <option value="">Selecione o destino...</option>
                  {portadores.filter(p => p.id !== form.portadorId).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Categoria (Plano de Contas) *</label>
                <div className="search-bar" style={{ marginBottom: 8 }}>
                  <input
                    placeholder="Filtrar categorias..."
                    className="form-control form-control-sm"
                    value={contaSearch}
                    onChange={e => setContaSearch(e.target.value)}
                  />
                </div>
                <select
                  className="form-control"
                  value={form.planoContaId || ''}
                  onChange={e => setForm(f => ({ ...f, planoContaId: e.target.value }))}
                  style={{ maxHeight: '120px' }}
                  size={4}
                >
                  <option value="">-- Selecione --</option>
                  {modalPlanoContas.map(pc => (
                    <option key={pc.id} value={pc.id}>{pc.codigo} - {pc.descricao}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Portador *</label>
                <select className="form-control" value={form.portadorId || ''} onChange={e => setForm(f => ({ ...f, portadorId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {portadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={form.status || ''} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'realizado' | 'previsto' }))}>
                  <option value="realizado">Realizado</option>
                  <option value="previsto">Previsto</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Anexo (Opcional)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="file" onChange={handleFileChange} style={{ fontSize: 12 }} />
                {form.attachmentName && <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ {form.attachmentName}</span>}
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ações em Lote (Reclassificação ou Transferência) */}
      {showReclassModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowReclassModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{bulkMode === 'transferir' ? 'Transferir em Lote' : 'Ações em Lote'}</h2>
              <button className="modal-close" onClick={() => setShowReclassModal(false)}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              {bulkMode === 'transferir'
                ? `Mover o saldo de ${selectedIds.length} lançamentos para outro portador criando uma transferência correspondente.`
                : `Alterar categoria ou portador de ${selectedIds.length} lançamentos simultaneamente.`}
            </p>

            {bulkMode === 'transferir' ? (
              <div style={{ padding: '12px 14px', background: 'var(--bg-card2)', borderRadius: 8, fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 16, border: '1px dashed var(--border-light)', lineHeight: '1.4' }}>
                ℹ️ <strong>Nota:</strong> As datas e os portadores dos lançamentos originais serão mantidos intactos. As transferências serão geradas automaticamente na mesma data de cada lançamento selecionado.
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Nova Categoria (Opcional)</label>
                <div className="search-bar" style={{ marginBottom: 8 }}>
                  <input
                    placeholder="Filtrar categorias..."
                    className="form-control form-control-sm"
                    value={reclassContaSearch}
                    onChange={e => setReclassContaSearch(e.target.value)}
                  />
                </div>
                <select className="form-control" value={reclassContaId} onChange={e => setReclassContaId(e.target.value)} size={4} style={{ maxHeight: 100 }}>
                  <option value="">Manter original</option>
                  {planoContas.filter(p => matchesConta(p, reclassContaSearch)).map(pc => (
                    <option key={pc.id} value={pc.id}>{pc.codigo} - {pc.descricao}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{bulkMode === 'transferir' ? 'Portador Destino' : 'Novo Portador (Opcional)'}</label>
              <select className="form-control" value={reclassPortadorId} onChange={e => setReclassPortadorId(e.target.value)}>
                <option value="">{bulkMode === 'transferir' ? 'Selecione...' : 'Manter original'}</option>
                {portadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowReclassModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleBulkReclassify}>Executar Ação</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Importação de Cartão (Faturas CSV/Excel) */}
      {showCardImportModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !cardImporting && setShowCardImportModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">Importar Fatura de Cartão</h2>
              <button className="modal-close" onClick={() => setShowCardImportModal(false)}>✕</button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  id="card-file-input"
                  style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && handleCardFile(e.target.files[0])}
                />
                <button className="btn btn-secondary" onClick={() => document.getElementById('card-file-input')?.click()}>
                  {cardFileName ? '📎 Alterar Arquivo' : '📂 Selecionar Arquivo (CSV/Excel)'}
                </button>
                {cardFileName && <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>{cardFileName}</span>}
              </div>

              {cardImportRows.length > 0 && (
                <div className="form-row" style={{ background: 'var(--bg-base)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Portador do Cartão</label>
                    <select className="form-control" value={cardPortadorId} onChange={e => setCardPortadorId(e.target.value)}>
                      {portadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-control" value={cardStatus} onChange={e => setCardStatus(e.target.value as any)}>
                      <option value="realizado">Realizado</option>
                      <option value="previsto">Previsto</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}><input type="checkbox" checked={cardImportRows.length > 0 && cardSelectedIds.length === cardImportRows.length} onChange={toggleAllCardImportRows} /></th>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th style={{ width: 250 }}>Plano de Contas</th>
                  </tr>
                </thead>
                <tbody>
                  {cardImportRows.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Selecione um arquivo para visualizar os lançamentos.</td></tr>
                  ) : cardImportRows.map(row => (
                    <tr key={row.id}>
                      <td><input type="checkbox" checked={cardSelectedIds.includes(row.id)} onChange={() => toggleCardImportRow(row.id)} /></td>
                      <td style={{ fontSize: 12 }}>{fmt.date(row.data)}</td>
                      <td style={{ fontSize: 12, fontWeight: 500 }}>{row.descricao}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt.currency(row.valor)}</td>
                      <td>
                        <select
                          className="form-control form-control-sm"
                          value={cardCatMap[row.id] || ''}
                          onChange={e => setCardCatMap(prev => ({ ...prev, [row.id]: e.target.value }))}
                        >
                          <option value="">-- Vincular Categoria --</option>
                          {planoContas.filter(p => p.tipo === 'despesa').map(pc => (
                            <option key={pc.id} value={pc.id}>{pc.codigo} - {pc.descricao}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="form-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowCardImportModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCardImport} disabled={cardImporting || cardSelectedIds.length === 0}>
                {cardImporting ? '⏳ Importando...' : `Importar ${cardSelectedIds.length} Selecionados`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* C6 Bank Boleto Modal */}
      {showC6BoletoModal && c6BoletoLanc && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowC6BoletoModal(false)}>
          <div className="modal c6-boleto-modal-container" style={{ maxWidth: 800, padding: 24, background: '#fff', color: '#000', fontFamily: 'Courier New, monospace', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                body * {
                  visibility: hidden !important;
                }
                .c6-boleto-modal-container, .c6-boleto-modal-container * {
                  visibility: visible !important;
                }
                .c6-boleto-modal-container {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  box-shadow: none !important;
                  border: none !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            ` }} />

            {/* Header with Print action */}
            <div className="modal-header no-print" style={{ fontFamily: 'var(--font-sans)', borderBottom: '1px solid var(--border-light)', paddingBottom: 12, marginBottom: 20 }}>
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>🖤</span> Emissão de Boleto C6 Bank
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ background: '#000', borderColor: '#000' }} onClick={() => window.print()}>🖨️ Imprimir / Salvar PDF</button>
                <button className="modal-close" onClick={() => setShowC6BoletoModal(false)}>✕</button>
              </div>
            </div>

            {/* Simulated Boleto layout sheet */}
            <div className="boleto-sheet" style={{ border: '2px solid #000', padding: 15, background: '#fff' }}>
              {/* Top Header */}
              <div style={{ display: 'flex', borderBottom: '2px solid #000', paddingBottom: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, marginRight: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 22, background: '#000', color: '#fff', padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-sans)', fontWeight: 800 }}>C6</span>
                  <strong style={{ fontFamily: 'var(--font-sans)', letterSpacing: -0.5 }}>C6 BANK</strong>
                </div>
                <div style={{ borderLeft: '2px solid #000', borderRight: '2px solid #000', padding: '0 15px', fontSize: 18, fontWeight: 900 }}>
                  336-7
                </div>
                <div style={{ flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 900, fontFamily: 'monospace' }}>
                  33690.00004 98765.432104 00000.456008 1 980100000{Math.floor(c6BoletoLanc.valor).toString().padStart(4, '0')}
                </div>
              </div>

              {/* Row 1 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 3, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Local de Pagamento</div>
                  <div style={{ fontSize: 10 }}>PAGÁVEL EM QUALQUER AGÊNCIA BANCÁRIA OU VIA PIX C6</div>
                </div>
                <div style={{ flex: 1, padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Vencimento</div>
                  <div style={{ fontSize: 11, fontWeight: 'bold', textAlign: 'right' }}>{fmt.date(c6BoletoLanc.data)}</div>
                </div>
              </div>

              {/* Row 2 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 3, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Beneficiário</div>
                  <div style={{ fontSize: 10, fontWeight: 'bold' }}>{activeCompany?.razaoSocial} — CNPJ: {activeCompany?.cnpj}</div>
                </div>
                <div style={{ flex: 1, padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Agência / Código do Beneficiário</div>
                  <div style={{ fontSize: 10, textAlign: 'right' }}>0001 / 951357-8</div>
                </div>
              </div>

              {/* Row 3 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Data do Documento</div>
                  <div style={{ fontSize: 10 }}>{new Date(c6BoletoLanc.createdAt || Date.now()).toISOString().split('T')[0]}</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Número do Documento</div>
                  <div style={{ fontSize: 10 }}>{c6BoletoLanc.numeroDocumento || c6BoletoLanc.id.slice(0, 8).toUpperCase()}</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Espécie Doc.</div>
                  <div style={{ fontSize: 10 }}>DM</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Aceite</div>
                  <div style={{ fontSize: 10 }}>N</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Data Processamento</div>
                  <div style={{ fontSize: 10 }}>{new Date(c6BoletoLanc.createdAt || Date.now()).toISOString().split('T')[0]}</div>
                </div>
                <div style={{ flex: 1, padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Nosso Número</div>
                  <div style={{ fontSize: 10, textAlign: 'right' }}>01/98765432-1</div>
                </div>
              </div>

              {/* Row 4 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Uso do Banco</div>
                  <div style={{ fontSize: 10 }}></div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Carteira</div>
                  <div style={{ fontSize: 10 }}>01 (C6 COB)</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Espécie</div>
                  <div style={{ fontSize: 10 }}>R$</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Quantidade</div>
                  <div style={{ fontSize: 10 }}></div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Valor</div>
                  <div style={{ fontSize: 10 }}></div>
                </div>
                <div style={{ flex: 1, padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>(=) Valor do Documento</div>
                  <div style={{ fontSize: 11, fontWeight: 'bold', textAlign: 'right' }}>{fmt.currency(c6BoletoLanc.valor)}</div>
                </div>
              </div>

              {/* Row 5 Instructions & Details */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 3, borderRight: '1px solid #000', padding: 6, minHeight: 120 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Instruções (Texto de responsabilidade do Beneficiário)</div>
                  <div style={{ fontSize: 10, marginTop: 5, lineHeight: '14px' }}>
                    • COBRANÇA REFERENTE A DUPLICATA MERCANTIL DE SERVIÇOS / MERCADORIAS.<br />
                    • APÓS O VENCIMENTO COBRAR MORA DE R$ 1,50 AO DIA E MULTA DE 2,0%.<br />
                    • SAC CONSTITUINTE: 0800 666 2000 — C6 BANK.<br />
                    <br />
                    <strong style={{ color: '#000' }}>PAGUE UTILIZANDO O QR CODE PIX DO C6 BANK AO LADO.</strong>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ padding: 4, borderBottom: '1px solid #000' }}>
                    <div style={{ fontSize: 8, fontWeight: 'bold' }}>(-) Desconto / Abatimento</div>
                    <div style={{ fontSize: 10, textAlign: 'right' }}>-</div>
                  </div>
                  <div style={{ padding: 4, borderBottom: '1px solid #000' }}>
                    <div style={{ fontSize: 8, fontWeight: 'bold' }}>(-) Outras Deduções</div>
                    <div style={{ fontSize: 10, textAlign: 'right' }}>-</div>
                  </div>
                  <div style={{ padding: 4, borderBottom: '1px solid #000' }}>
                    <div style={{ fontSize: 8, fontWeight: 'bold' }}>(+) Mora / Multa</div>
                    <div style={{ fontSize: 10, textAlign: 'right' }}>-</div>
                  </div>
                  <div style={{ padding: 4 }}>
                    <div style={{ fontSize: 8, fontWeight: 'bold' }}>(=) Valor Cobrado</div>
                    <div style={{ fontSize: 10, textAlign: 'right' }}>-</div>
                  </div>
                </div>
              </div>

              {/* Row 6 Payer info */}
              <div style={{ padding: 6, borderBottom: '1px solid #000' }}>
                <div style={{ fontSize: 8, fontWeight: 'bold' }}>Pagador</div>
                <div style={{ fontSize: 10, lineHeight: '14px' }}>
                  <strong>SACADO GERAL / CLIENTE PARCEIRO LTDA</strong><br />
                  CNPJ: 00.000.000/0001-00 — IE: ISENTO<br />
                  RUA DO COMÉRCIO, 100 — CENTRO — Caxias do Sul — RS
                </div>
              </div>

              {/* Barcode & Pix Code Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, padding: '0 10px' }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 5 }}>Ficha de Compensação (C6 Bank Barcode System)</div>
                  {/* Simulated Barcode */}
                  <div style={{ display: 'flex', height: 45, width: 420, alignItems: 'stretch' }}>
                    {Array.from({ length: 55 }).map((_, idx) => {
                      const isWide = (idx * 5) % 3 === 0;
                      const isGap = (idx * 7) % 4 === 0;
                      return (
                        <div 
                          key={idx} 
                          style={{ 
                            width: isWide ? 4.5 : 1.5, 
                            background: isGap ? 'transparent' : '#000', 
                            marginRight: 1 
                          }} 
                        />
                      );
                    })}
                  </div>
                </div>

                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>PIX C6 BANK:</div>
                  {/* Pix QR Code simulation */}
                  <div style={{ width: 80, height: 80, border: '2px solid #000', padding: 3, display: 'flex', flexWrap: 'wrap', background: '#fff' }}>
                    {Array.from({ length: 64 }).map((_, idx) => {
                      const fill = (idx * 5) % 3 === 0 || idx < 8 || idx % 8 === 0 || (idx > 50 && idx % 2 === 0);
                      return (
                        <div 
                          key={idx} 
                          style={{ 
                            width: '12.5%', 
                            height: '12.5%', 
                            background: fill ? '#000' : 'transparent' 
                          }} 
                        />
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 7, fontWeight: 'bold', color: '#000' }}>PIX COBRANÇA</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}