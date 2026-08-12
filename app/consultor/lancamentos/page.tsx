'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { store, type Lancamento, type PlanoConta, type Portador, type Empresa, type CentroCusto, uid } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import GeminiQuickEntry from '../../../components/GeminiQuickEntry';
import DateRangeFilter from '../../../components/DateRangeFilter';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy } from 'lucide-react';

type Filtros = { tipo: string; status: string; portadorId: string; search: string; mes: string, semPlano: boolean, planoContaId: string, dataIni: string, dataFim: string };
type CardImportRow = {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  numeroDocumento?: string;
};

const normalizeText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const currentMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

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
    date: find(['data', 'dt compra', 'dt lancamento', 'lancamento', 'dia', 'vencimento']),
    description: find(['descricao', 'descrição', 'historico', 'histórico', 'estabelecimento', 'local', 'detalhe', 'nome']),
    value: find(['valor', 'amount', 'total', 'debito', 'débito', 'saida', 'entrada', 'pago', 'recebido', 'dinheiro', 'pix', 'cartao']),
    valueEntrada: find(['entrada', 'credito', 'recebimento']),
    valueSaida: find(['saida', 'debito', 'pagamento']),
    document: find(['documento', 'doc', 'parcela', 'cartao', 'cartão', 'nf']),
  };
};

export default function LancamentosPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [portadores, setPortadores] = useState<Portador[]>([]);
  const [filtros, setFiltros] = useState<Filtros & { centroCustoId?: string }>({ tipo: '', status: '', portadorId: '', search: '', mes: currentMonthStr(), semPlano: false, centroCustoId: '', planoContaId: '', dataIni: '', dataFim: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Lancamento | null>(null);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [form, setForm] = useState<Partial<Lancamento> & { tipoTransacao?: 'receita' | 'despesa' | 'transferencia', portadorDestinoId?: string, _valorDisplay?: string, isRecorrente?: boolean, parcelas?: number }>({});
  const [contaSearch, setContaSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Estados e funções de apoio para Edição Inline (Rápida)
  const [inlineEditRowId, setInlineEditRowId] = useState<string | null>(null);
  const [inlineEditField, setInlineEditField] = useState<'descricao' | 'planoContaId' | 'portadorId' | 'centroCustoId' | null>(null);
  const [inlineValue, setInlineValue] = useState('');
  const [inlineSearch, setInlineSearch] = useState('');

  const saveInlineEdit = (lanc: Lancamento, field: 'descricao' | 'planoContaId' | 'portadorId', value: string, keepEditing = false) => {
    if (field === 'descricao' && !value.trim()) {
      if (!keepEditing) cancelInlineEdit();
      return;
    }
    try {
      const updated: Lancamento = {
        ...lanc,
        [field]: value
      };
      store.saveLancamento(updated);
      setLancamentos(store.getLancamentos(empresaId));
      window.dispatchEvent(new CustomEvent('lancamentoChange'));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      if (!keepEditing) cancelInlineEdit();
    }
  };

  const cancelInlineEdit = () => {
    setInlineEditRowId(null);
    setInlineEditField(null);
    setInlineValue('');
    setInlineSearch('');
  };
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

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showPrintDuvidosos, setShowPrintDuvidosos] = useState(false);
  const [duvidososList, setDuvidososList] = useState<Lancamento[]>([]);

  const handleOpenC6Boleto = (l: Lancamento) => {
    setC6BoletoLanc(l);
    setShowC6BoletoModal(true);
  };

  const handleExportCsvDuvidosos = () => {
    const duvidosos = lancamentos.filter(l => {
      if (l.planoContaId === 'transf') return false;
      const pc = planoContas.find(p => p.id === l.planoContaId);
      if (pc?.tipo === 'transferencia') return false;
      return !l.planoContaId || l.planoContaId === '' || !pc;
    });

    if (duvidosos.length === 0) {
      alert('Nenhum lançamento duvidoso (sem plano de contas) encontrado para exportar.');
      return;
    }

    const headers = ['Data', 'Descrição', 'Valor (R$)', 'Tipo', 'Portador', 'Identificação do Cliente (O que se refere?)'];
    const rows = duvidosos.map(l => {
      const port = portadores.find(p => p.id === l.portadorId)?.nome || '-';
      const valorStr = (l.tipo === 'receita' ? '+' : '-') + l.valor.toFixed(2).replace('.', ',');
      const dataStr = fmt.date(l.data);
      return [
        `"${dataStr}"`,
        `"${l.descricao.replace(/"/g, '""')}"`,
        `"${valorStr}"`,
        `"${l.tipo === 'receita' ? 'Receita' : 'Despesa'}"`,
        `"${port.replace(/"/g, '""')}"`,
        '""'
      ];
    });

    const csvContent = '\ufeff' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const nomeEmpresa = activeCompany ? activeCompany.nomeFantasia.replace(/[^a-zA-Z0-9]/g, '_') : 'empresa';
    link.setAttribute('href', url);
    link.setAttribute('download', `lancamentos_duvidosos_${nomeEmpresa}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintDuvidosos = () => {
    const list = lancamentos.filter(l => {
      if (l.planoContaId === 'transf') return false;
      const pc = planoContas.find(p => p.id === l.planoContaId);
      if (pc?.tipo === 'transferencia') return false;
      return !l.planoContaId || l.planoContaId === '' || !pc;
    });

    if (list.length === 0) {
      alert('Nenhum lançamento duvidoso (sem plano de contas) encontrado para imprimir.');
      return;
    }

    setDuvidososList(list);
    setShowPrintDuvidosos(true);
    setTimeout(() => {
      window.print();
      setShowPrintDuvidosos(false);
    }, 300);
  };

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    setLancamentos(store.getLancamentos(eId));
    // Carrega todas as contas analíticas (nível 3) incluindo transferências
    setPlanoContas(store.getPlanoContas(eId).filter(p => p.nivel === 3 && p.ativo));
    setPortadores(store.getPortadores(eId).filter(p => p.ativo));
    setCentrosCusto(store.getCentrosCusto(eId).filter(c => c.ativo));

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
    const saved = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
    load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    const dataChangeHandler = () => {
      const current = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
      setPlanoContas(store.getPlanoContas(current).filter(p => p.nivel === 3 && p.ativo));
      setLancamentos(store.getLancamentos(current));
      setCentrosCusto(store.getCentrosCusto(current).filter(c => c.ativo));
    };
    window.addEventListener('empresaChange', handler);
    window.addEventListener('cfDataChange', dataChangeHandler);
    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataChangeHandler);
    };
  }, [load]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
        setShowReclassModal(false);
        setSelectedIds([]);
        setShowCardImportModal(false);
        setShowC6BoletoModal(false);
        cancelInlineEdit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filtered = useMemo(() => {
    return lancamentos.filter(l => {
      if (filtros.tipo && l.tipo !== filtros.tipo) return false;
      if (filtros.status && l.status !== filtros.status) return false;
      if (filtros.portadorId && l.portadorId !== filtros.portadorId) return false;
      if (filtros.search && !l.descricao.toLowerCase().includes(filtros.search.toLowerCase())) return false;
      if (filtros.mes && !l.data.startsWith(filtros.mes)) return false;
      if (filtros.dataIni && l.data < filtros.dataIni) return false;
      if (filtros.dataFim && l.data > filtros.dataFim) return false;
      if (filtros.planoContaId && l.planoContaId !== filtros.planoContaId) return false;
      if (filtros.semPlano) {
        if (l.planoContaId === 'transf') return false;
        const hasPlan = planoContas.some(pc => pc.id === l.planoContaId);
        if (hasPlan && l.planoContaId !== '') return false;
      }
      return true;
    }).sort((a, b) => b.data.localeCompare(a.data));
  }, [lancamentos, filtros, planoContas]);

  // Paginação — evita renderizar milhares de linhas de uma vez (lento e desnecessário).
  useEffect(() => { setPage(1); }, [filtros, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize),
    [filtered, pageSafe, pageSize]
  );

  const totRec = useMemo(() => filtered.filter(l => {
    if (l.planoContaId === 'transf') return false;
    const pc = planoContas.find(p => p.id === l.planoContaId);
    if (pc?.tipo === 'transferencia') return false;
    return l.tipo === 'receita' && l.status === 'realizado';
  }).reduce((a, l) => a + l.valor, 0), [filtered, planoContas]);

  const totDesp = useMemo(() => filtered.filter(l => {
    if (l.planoContaId === 'transf') return false;
    const pc = planoContas.find(p => p.id === l.planoContaId);
    if (pc?.tipo === 'transferencia') return false;
    return l.tipo === 'despesa' && l.status === 'realizado';
  }).reduce((a, l) => a + l.valor, 0), [filtered, planoContas]);

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
    const isTransf = l.planoContaId === 'transf' || (() => {
      const pc = planoContas.find(p => p.id === l.planoContaId);
      return pc?.tipo === 'transferencia' || pc?.codigo.startsWith('6');
    })();
    if (isTransf) {
      const other = lancamentos.find(x => x.id !== l.id && x.createdAt === l.createdAt && (x.planoContaId === 'transf' || (() => {
        const pc = planoContas.find(p => p.id === x.planoContaId);
        return pc?.tipo === 'transferencia' || pc?.codigo.startsWith('6');
      })()));
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

  // Duplica um lançamento existente (data de hoje, sem anexo/nº doc) para agilizar
  // o cadastro de lançamentos parecidos com um recorrente.
  const handleDuplicate = (l: Lancamento) => {
    if (l.planoContaId === 'transf') return;
    setEditItem(null);
    setContaSearch('');
    setForm({
      ...l,
      id: undefined,
      tipoTransacao: l.tipo,
      data: new Date().toISOString().split('T')[0],
      numeroDocumento: '',
      attachmentName: undefined,
      attachmentData: undefined,
    });
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
          const isEditTransf = editItem.planoContaId === 'transf' || (() => {
            const pc = planoContas.find(p => p.id === editItem.planoContaId);
            return pc?.tipo === 'transferencia' || pc?.codigo.startsWith('6');
          })();
          if (isEditTransf) {
            const other = lancamentos.find(x => x.id !== editItem.id && x.createdAt === editItem.createdAt && (x.planoContaId === 'transf' || (() => {
              const pc = planoContas.find(p => p.id === x.planoContaId);
              return pc?.tipo === 'transferencia' || pc?.codigo.startsWith('6');
            })()));
            if (other) {
              store.deleteLancamento(other.id);
            }
          }
        }

        const pcEntrada = planoContas.find(p => p.codigo === '6.1.1');
        const pcSaida = planoContas.find(p => p.codigo === '6.1.2');
        const planoContaIdEntrada = pcEntrada ? pcEntrada.id : 'transf';
        const planoContaIdSaida = pcSaida ? pcSaida.id : 'transf';

        const ts = editItem?.createdAt || new Date().toISOString();
        store.saveLancamento({
          id: uid(), empresaId, data: form.data!, descricao: `[Transf. Saída] ${form.descricao}`, valor: parseMoney(form.valor),
          tipo: 'despesa', planoContaId: planoContaIdSaida, portadorId: form.portadorId!, status: (form.status || 'realizado') as 'previsto' | 'realizado', origem: 'manual', createdAt: ts
        });
        store.saveLancamento({
          id: uid(), empresaId, data: form.data!, descricao: `[Transf. Entrada] ${form.descricao}`, valor: parseMoney(form.valor),
          tipo: 'receita', planoContaId: planoContaIdEntrada, portadorId: form.portadorDestinoId!, status: (form.status || 'realizado') as 'previsto' | 'realizado', origem: 'manual', createdAt: ts
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
        const isEditTransf = editItem && (editItem.planoContaId === 'transf' || (() => {
          const pc = planoContas.find(p => p.id === editItem.planoContaId);
          return pc?.tipo === 'transferencia' || pc?.codigo.startsWith('6');
        })());
        if (isEditTransf) {
          const other = lancamentos.find(x => x.id !== editItem!.id && x.createdAt === editItem!.createdAt && (x.planoContaId === 'transf' || (() => {
            const pc = planoContas.find(p => p.id === x.planoContaId);
            return pc?.tipo === 'transferencia' || pc?.codigo.startsWith('6');
          })()));
          if (other) {
            store.deleteLancamento(other.id);
          }
        }

        const baseDate = new Date(form.data! + 'T12:00:00');
        const count = form.isRecorrente ? Math.max(2, form.parcelas || 2) : 1;
        const nowIso = editItem?.createdAt || new Date().toISOString();

        for (let i = 0; i < count; i++) {
          const dt = new Date(baseDate);
          dt.setMonth(dt.getMonth() + i);
          const dataIso = dt.toISOString().split('T')[0];
          
          let desc = form.descricao!;
          if (count > 1) desc = `${desc} (${i + 1}/${count})`;

          const lanc: Lancamento = {
            id: editItem ? editItem.id : uid(),
            empresaId,
            data: dataIso,
            descricao: desc,
            valor: parseMoney(form.valor),
            tipo: form.tipoTransacao as 'receita' | 'despesa',
            planoContaId: form.planoContaId!,
            portadorId: form.portadorId!,
            status: i === 0 ? ((form.status || 'realizado') as 'previsto' | 'realizado') : 'previsto',
            numeroDocumento: form.numeroDocumento,
            observacao: form.observacao,
            attachmentName: form.attachmentName,
            attachmentData: form.attachmentData,
            centroCustoId: form.centroCustoId,
            origem: 'manual',
            createdAt: nowIso,
          };
          store.saveLancamento(lanc);
          
          // If editing an existing item, break to not duplicate it as recurrence
          if (editItem) break;
        }

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

  const parseCardRows = (rows: unknown[][], defaultDateFromSheet?: string): CardImportRow[] => {
    if (rows.length === 0) return [];
    
    // Procura o cabeçalho nas primeiras 15 linhas (para pular títulos)
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(15, rows.length); i++) {
        const rowStrings = rows[i].map(cell => String(cell || '').trim());
        const hasHeader = rowStrings.some(cell => /data|dia|descri|historico|histórico|valor|entrada|saida/i.test(cell));
        if (hasHeader) {
            headerRowIndex = i;
            break;
        }
    }
    
    let headers: string[];
    let dataRows: unknown[][];
    
    if (headerRowIndex >= 0) {
        headers = rows[headerRowIndex].map(cell => String(cell || '').trim());
        dataRows = rows.slice(headerRowIndex + 1);
    } else {
        headers = ['data', 'descricao', 'valor', 'documento'];
        dataRows = rows;
    }

    const columns = detectCardImportColumns(headers);
    
    return dataRows
      .map((row, index) => {
        let data = '';
        if (columns.date >= 0) {
           data = parseCardDate(row[columns.date]);
           // Se a coluna for apenas "dia" e retornar vazio, ou tentar usar defaultDateFromSheet
           if (!data && defaultDateFromSheet) {
               const cellStr = String(row[columns.date] || '').trim();
               if (cellStr.length <= 2 && !isNaN(Number(cellStr))) {
                   data = `${defaultDateFromSheet}-${cellStr.padStart(2, '0')}`;
               }
           }
        }
        if (!data && defaultDateFromSheet) {
           // Fallback para a data extraída do nome da planilha
           data = `${defaultDateFromSheet}-01`; // ou outra lógica
        }

        const descriptionIndex = columns.description >= 0 ? columns.description : 1;
        const descricao = String(row[descriptionIndex] || '').trim();
        
        let valor = 0;
        if (columns.valueEntrada >= 0 || columns.valueSaida >= 0) {
            const vEntrada = parseMoney(row[columns.valueEntrada]);
            const vSaida = parseMoney(row[columns.valueSaida]);
            valor = vEntrada > 0 ? vEntrada : vSaida; // Pega o que for maior que zero
        } else {
            const valueIndex = columns.value >= 0 ? columns.value : 2;
            valor = parseMoney(row[valueIndex]);
        }

        const numeroDocumento = columns.document >= 0 ? String(row[columns.document] || '').trim() : undefined;

        return {
          id: `card_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
          data,
          descricao,
          valor,
          numeroDocumento: numeroDocumento || undefined,
        };
      })
      .filter(row => row.descricao && row.valor > 0);
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

    if (extension === 'pdf') {
      setCardImporting(true);
      try {
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });

        const promptText = `Extraia todas as transações financeiras deste arquivo PDF (extrato bancário, caixa físico ou fatura de cartão). Retorne ESTRITAMENTE UM ARRAY JSON VÁLIDO no seguinte formato exato, sem formatação markdown:
[
  {
    "data": "YYYY-MM-DD",
    "descricao": "Nome do estabelecimento ou histórico",
    "valor": 123.45,
    "numeroDocumento": "12345"
  }
]
Apenas retorne transações com valor maior que 0. Valores numéricos devem ser expressos como Number. Certifique-se que o JSON é válido.`;

        const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyApsKGqQWqF6LeABZG2fNdzXp4G9_wTq6s';
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: promptText },
                  { inlineData: { mimeType: 'application/pdf', data: base64Data } }
                ]
              }],
              generationConfig: { responseMimeType: "application/json" }
            }),
          }
        );

        if (!response.ok) throw new Error('Falha ao conectar com o Gemini.');
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText.trim());
          if (Array.isArray(parsed)) {
            rawRows = [
              ['data', 'descricao', 'valor', 'documento'],
              ...parsed.map((item: any) => [
                item.data || '', 
                item.descricao || '', 
                item.valor || 0, 
                item.numeroDocumento || ''
              ])
            ];
          }
        }
      } catch (err) {
        console.error(err);
        alert('Erro ao processar PDF com a IA. Verifique se o arquivo não é muito grande ou tente converter para Excel.');
      } finally {
        setCardImporting(false);
      }
    } else 

    if (extension === 'xlsx' || extension === 'xls' || extension === 'xlsm') {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      
      let allParsedRows: CardImportRow[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rawSheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
        if (rawSheetRows.length > 0) {
          const parsedSheetRows = parseCardRows(rawSheetRows);
          allParsedRows = [...allParsedRows, ...parsedSheetRows];
        }
      }
      
      setCardImportRows(allParsedRows);
      setCardSelectedIds(allParsedRows.map(row => row.id));
      setCardCatMap(Object.fromEntries(
        allParsedRows
          .map(row => [row.id, store.classifyDescription(empresaId, row.descricao) || ''])
          .filter(([, planoContaId]) => !!planoContaId)
      ));
      return; // Early return as Excel is fully parsed here
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

      lancamentos.filter(l => selectedIds.includes(l.id)).forEach(l => {
        if (l.portadorId === reclassPortadorId) return;

        // Limpar descrição de qualquer prefixo de transferência
        const cleanDesc = l.descricao
          .replace(/^\[Transf\. Saída\] /, '')
          .replace(/^\[Transf\. Entrada\] /, '');

        const originalCreatedAt = l.createdAt || ts;

        // Determinar o tipo da contrapartida e as descrições
        const originalTipo = l.tipo;
        let originalDesc = '';
        let destTipo: 'receita' | 'despesa';
        let destDesc = '';

        if (originalTipo === 'receita') {
          originalDesc = `[Transf. Entrada] ${cleanDesc}`;
          destTipo = 'despesa';
          destDesc = `[Transf. Saída] ${cleanDesc}`;
        } else {
          originalDesc = `[Transf. Saída] ${cleanDesc}`;
          destTipo = 'receita';
          destDesc = `[Transf. Entrada] ${cleanDesc}`;
        }

        // Modificar o lançamento original (em vez de duplicar no mesmo portador)
        const updatedOriginal: Lancamento = {
          ...l,
          descricao: originalDesc,
          planoContaId: 'transf',
          createdAt: originalCreatedAt,
        };

        // Criar a contrapartida no portador de destino
        const contrapartida: Lancamento = {
          id: uid(),
          empresaId: l.empresaId,
          data: l.data,
          descricao: destDesc,
          valor: l.valor,
          tipo: destTipo,
          planoContaId: 'transf',
          portadorId: reclassPortadorId,
          status: l.status,
          origem: l.origem || 'manual',
          createdAt: originalCreatedAt,
        };

        store.saveLancamento(updatedOriginal);
        store.saveLancamento(contrapartida);
      });

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

  const handleBulkMarkAsPaid = () => {
    if (selectedIds.length === 0) return;
    const updatedItems = lancamentos
      .filter(l => selectedIds.includes(l.id))
      .map(l => ({ ...l, status: 'realizado' as const }));
    
    updatedItems.forEach(item => store.saveLancamento(item));
    setLancamentos(store.getLancamentos(empresaId));
    setSelectedIds([]);
  };

  const handleExportToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const dataToExport = filtered.map(l => {
        const pc = planoContas.find(p => p.id === l.planoContaId);
        const port = portadores.find(p => p.id === l.portadorId);
        return {
          'Data': fmt.date(l.data),
          'Descrição': l.descricao,
          'Categoria': pc ? `${pc.codigo} - ${pc.descricao}` : 'Sem Plano',
          'Portador': port ? port.nome : '-',
          'Valor': Number(l.valor.toFixed(2)),
          'Tipo': l.tipo === 'receita' ? 'Receita' : 'Despesa',
          'Status': l.status === 'realizado' ? 'Realizado' : 'Previsto',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Lançamentos');
      XLSX.writeFile(workbook, `Lancamentos_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Erro ao exportar para Excel:', error);
      alert('Erro ao exportar para Excel. Certifique-se que a biblioteca xlsx foi instalada.');
    }
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
    if (form.tipoTransacao === 'transferencia') {
      // Inclui contas cujo tipo é transferência OU cujo código começa com '6'
      return planoContas.filter(p =>
        (p.tipo === 'transferencia' || p.codigo.startsWith('6')) &&
        matchesConta(p, contaSearch)
      );
    }
    return planoContas.filter(p => p.tipo === form.tipoTransacao && matchesConta(p, contaSearch));
  }, [planoContas, form.tipoTransacao, contaSearch]);

  const selectedLancamentosList = useMemo(() => {
    return lancamentos.filter(l => selectedIds.includes(l.id));
  }, [lancamentos, selectedIds]);

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
              <button className="btn btn-secondary" onClick={handleBulkMarkAsPaid}>
                ✅ Marcar como Pago ({selectedIds.length})
              </button>
              <button className="btn btn-danger" onClick={handleBulkDelete}>
                🗑️ Excluir ({selectedIds.length})
              </button>
            </>
          )}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-secondary" onClick={() => setShowExportMenu(!showExportMenu)}>
              📊 Exportar ▾
            </button>
            {showExportMenu && (
              <div 
                style={{ 
                  position: 'absolute', 
                  right: 0, 
                  top: '100%', 
                  marginTop: 6,
                  background: 'var(--bg-card)', 
                  border: '1px solid var(--border)', 
                  borderRadius: 8, 
                  boxShadow: 'var(--shadow-md)', 
                  padding: 6, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 4, 
                  zIndex: 100,
                  minWidth: 200
                }}
              >
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{ justifyContent: 'flex-start', width: '100%', fontSize: 12, padding: '8px 12px' }} 
                  onClick={() => { handleExportToExcel(); setShowExportMenu(false); }}
                >
                  🟢 Baixar Excel (.xlsx)
                </button>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{ justifyContent: 'flex-start', width: '100%', fontSize: 12, padding: '8px 12px' }} 
                  onClick={() => { handleExportCsvDuvidosos(); setShowExportMenu(false); }}
                >
                  ⚠️ Exportar Duvidosos (CSV)
                </button>
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{ justifyContent: 'flex-start', width: '100%', fontSize: 12, padding: '8px 12px' }} 
                  onClick={() => { handlePrintDuvidosos(); setShowExportMenu(false); }}
                >
                  🖨️ Imprimir Duvidosos (PDF)
                </button>
              </div>
            )}
          </div>
          <button className="btn btn-secondary" onClick={openCardImport}>📂 Importar Caixa/Fatura</button>
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
            <div className="search-bar" style={{ position: 'relative' }}>
              <span>🔍</span>
              <input
                placeholder="Buscar descrição..."
                value={filtros.search}
                onChange={e => setFiltros(f => ({ ...f, search: e.target.value }))}
                style={{ paddingRight: filtros.search ? '32px' : undefined }}
              />
              {filtros.search && (
                <button
                  onClick={() => setFiltros(f => ({ ...f, search: '' }))}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                  }}
                  title="Limpar busca"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <select className="form-control" value={filtros.mes} onChange={e => setFiltros(f => ({ ...f, mes: e.target.value, dataIni: '', dataFim: '' }))} title="Mês Rápido">
                <option value="">Filtro rápido (Mês)</option>
                {meses.map(m => {
                  const [y, mo] = m.split('-');
                  const d = new Date(Number(y), Number(mo) - 1, 1);
                  return <option key={m} value={m}>{d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</option>;
                })}
              </select>
            </div>
            
            <DateRangeFilter
              ini={filtros.dataIni}
              fim={filtros.dataFim}
              onChange={(ini, fim) => setFiltros(f => ({ ...f, dataIni: ini, dataFim: fim, mes: '' }))}
              placeholder="Período (data)"
            />
            <div className="form-group" style={{ margin: 0 }}>
              <select className="form-control" value={filtros.planoContaId} onChange={e => setFiltros(f => ({ ...f, planoContaId: e.target.value }))}>
                <option value="">Todos os planos</option>
                <option value="transf">⇄ Transferência</option>
                {planoContas.map(p => <option key={p.id} value={p.id}>{p.codigo} - {p.descricao}</option>)}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', paddingBottom: '8px' }}>
              <input type="checkbox" id="check-semplano" checked={filtros.semPlano} onChange={e => setFiltros(f => ({ ...f, semPlano: e.target.checked }))} />
              <label htmlFor="check-semplano" style={{ fontSize: 13, color: 'var(--text-secondary)', userSelect: 'none', cursor: 'pointer' }}>🚨 Ver Sem Plano ({filtered.filter(l => l.planoContaId !== 'transf' && (!l.planoContaId || !planoContas.some(pc => pc.id === l.planoContaId))).length})</label>
            </div>
            {(filtros.tipo || filtros.status || filtros.portadorId || filtros.search || filtros.mes || filtros.semPlano || filtros.planoContaId || filtros.dataIni || filtros.dataFim) && (
              <button className="btn btn-ghost btn-sm" style={{ marginBottom: 4 }} onClick={() => setFiltros({ tipo: '', status: '', portadorId: '', search: '', mes: '', semPlano: false, centroCustoId: '', planoContaId: '', dataIni: '', dataFim: '' })}>
                ✕ Limpar Restrições
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
                ) : paginated.map((l, idx) => {
                  const pc = planoContas.find(p => p.id === l.planoContaId);
                  const port = portadores.find(p => p.id === l.portadorId);
                  const nextLanc = paginated[idx + 1];
                  const prevLanc = paginated[idx - 1];

                  const handleTurboNav = (e: React.KeyboardEvent, field: 'descricao' | 'planoContaId' | 'portadorId', currentVal: string) => {
                    const isSelect = field === 'planoContaId' || field === 'portadorId';
                    
                    if (e.key === 'Enter') {
                      if (!isSelect) {
                        e.preventDefault();
                        if (nextLanc) {
                          saveInlineEdit(l, field, currentVal, true);
                          setInlineEditRowId(nextLanc.id);
                          setInlineValue(nextLanc[field] || '');
                        } else {
                          saveInlineEdit(l, field, currentVal, false);
                        }
                      } else {
                        // On select tags, Enter just saves and stops editing immediately.
                        e.preventDefault();
                        saveInlineEdit(l, field, currentVal, false);
                      }
                    } else if (e.key === 'ArrowDown' && (!isSelect || e.shiftKey)) {
                      e.preventDefault();
                      if (nextLanc) {
                        saveInlineEdit(l, field, currentVal, true);
                        setInlineEditRowId(nextLanc.id);
                        setInlineValue(nextLanc[field] || '');
                      }
                    } else if (e.key === 'ArrowUp' && (!isSelect || e.shiftKey)) {
                      e.preventDefault();
                      if (prevLanc) {
                        saveInlineEdit(l, field, currentVal, true);
                        setInlineEditRowId(prevLanc.id);
                        setInlineValue(prevLanc[field] || '');
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelInlineEdit();
                    }
                  };

                  return (
                    <tr key={l.id} style={{ background: selectedIds.includes(l.id) ? 'var(--bg-card2)' : undefined }}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedIds.includes(l.id)} onChange={() => toggleSelect(l.id)} />
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmt.date(l.data)}</td>
                      {/* Descrição - Double Click to Edit */}
                      <td style={{ fontWeight: 500, maxWidth: 200, padding: 0 }}>
                        {inlineEditRowId === l.id && inlineEditField === 'descricao' ? (
                          <div style={{ padding: '8px' }}>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              value={inlineValue}
                              onChange={e => setInlineValue(e.target.value)}
                              onBlur={() => saveInlineEdit(l, 'descricao', inlineValue)}
                              onKeyDown={e => handleTurboNav(e, 'descricao', inlineValue)}
                              autoFocus
                              style={{ width: '100%', padding: '4px 8px', fontSize: '13px' }}
                            />
                          </div>
                        ) : (
                          <div
                            className="editable-cell"
                            onDoubleClick={() => {
                              setInlineEditRowId(l.id);
                              setInlineEditField('descricao');
                              setInlineValue(l.descricao);
                            }}
                            title="Duplo clique para editar descrição"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {l.descricao}
                              {l.attachmentName && (
                                <a
                                  href={`/api/lancamentos/attachment?id=${l.id}`}
                                  download={l.attachmentName}
                                  title={`Anexo: ${l.attachmentName}`}
                                  style={{ textDecoration: 'none', fontSize: 14 }}
                                  onClick={e => e.stopPropagation()}
                                >📎</a>
                              )}
                            </div>
                            {l.observacao && (
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 'normal' }}>
                                {l.observacao}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Plano de Contas - Single Click to Edit */}
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', padding: 0 }}>
                        {l.planoContaId === 'transf' ? (
                          <div style={{ padding: '8px 14px', color: 'var(--accent)', fontStyle: 'italic', fontSize: 11 }}>⇄ Transf.</div>
                        ) : inlineEditRowId === l.id && inlineEditField === 'planoContaId' ? (
                          <div style={{ padding: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <input
                              className="form-control form-control-sm"
                              placeholder="Pesquisar..."
                              value={inlineSearch}
                              onChange={e => setInlineSearch(e.target.value)}
                              onKeyDown={e => handleTurboNav(e, 'planoContaId', inlineValue)}
                              autoFocus
                              style={{ padding: '4px', fontSize: '11px', height: '24px' }}
                            />
                            <select
                              className="form-control form-control-sm"
                              value={inlineValue}
                              onChange={e => {
                                setInlineValue(e.target.value);
                                saveInlineEdit(l, 'planoContaId', e.target.value, false);
                              }}
                              onKeyDown={e => handleTurboNav(e, 'planoContaId', inlineValue)}
                              size={4}
                              style={{ width: '100%', padding: '2px 4px', fontSize: '11px', maxHeight: '100px' }}
                            >
                              <option value="">-- Sem Categoria --</option>
                              {planoContas.filter(p => {
                                const isTransfLanc = l.planoContaId === 'transf' || (() => {
                                  const pcL = planoContas.find(x => x.id === l.planoContaId);
                                  return pcL?.tipo === 'transferencia' || pcL?.codigo.startsWith('6');
                                })();
                                const matchesTipo = isTransfLanc ? (p.tipo === 'transferencia' || p.codigo.startsWith('6')) : p.tipo === l.tipo;
                                const matchesSearch = (p.codigo + p.descricao).toLowerCase().includes(inlineSearch.toLowerCase());
                                return matchesTipo && matchesSearch;
                              }).map(pc => (
                                <option key={pc.id} value={pc.id}>{pc.codigo} - {pc.descricao}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div
                            className="editable-cell"
                            onClick={() => {
                              setInlineEditRowId(l.id);
                              setInlineEditField('planoContaId');
                              setInlineValue(l.planoContaId || '');
                            }}
                            title="Clique para alterar categoria"
                          >
                            {pc ? `${pc.codigo} - ${pc.descricao}` : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>-- Sem Categoria --</span>}
                          </div>
                        )}
                      </td>

                      {/* Portador - Single Click to Edit */}
                      <td style={{ fontSize: 12, padding: 0 }}>
                        {inlineEditRowId === l.id && inlineEditField === 'portadorId' ? (
                          <div style={{ padding: '4px' }}>
                            <select
                              className="form-control form-control-sm"
                              value={inlineValue}
                              onChange={e => {
                                setInlineValue(e.target.value);
                                saveInlineEdit(l, 'portadorId', e.target.value, false);
                              }}
                              onBlur={cancelInlineEdit}
                              onKeyDown={e => handleTurboNav(e, 'portadorId', inlineValue)}
                              autoFocus
                              style={{ width: '100%', padding: '2px 4px', fontSize: '12px' }}
                            >
                              {portadores.map(p => (
                                <option key={p.id} value={p.id}>{p.nome}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div
                            className="editable-cell"
                            onClick={() => {
                              setInlineEditRowId(l.id);
                              setInlineEditField('portadorId');
                              setInlineValue(l.portadorId);
                            }}
                            title="Clique para alterar portador"
                          >
                            {port?.nome || '-'}
                          </div>
                        )}
                      </td>
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
                          {l.planoContaId !== 'transf' && (
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDuplicate(l)} title="Duplicar (cria uma cópia com a data de hoje)">
                              <Copy size={13} />
                            </button>
                          )}
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(l.id)} title="Excluir">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '14px 18px', borderTop: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Mostrando <strong style={{ color: 'var(--text-secondary)' }}>{(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, filtered.length)}</strong> de <strong style={{ color: 'var(--text-secondary)' }}>{filtered.length}</strong>
                {selectedIds.length > 0 && ` · ${selectedIds.length} selecionados`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <select
                  className="form-control form-control-sm"
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                  style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }}
                  title="Itens por página"
                >
                  {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} / página</option>)}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button className="btn btn-ghost btn-sm btn-icon" disabled={pageSafe <= 1} onClick={() => setPage(1)} title="Primeira página">
                    <ChevronsLeft size={14} />
                  </button>
                  <button className="btn btn-ghost btn-sm btn-icon" disabled={pageSafe <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} title="Página anterior">
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '0 8px', minWidth: 90, textAlign: 'center' }}>
                    Página {pageSafe} de {totalPages}
                  </span>
                  <button className="btn btn-ghost btn-sm btn-icon" disabled={pageSafe >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} title="Próxima página">
                    <ChevronRight size={14} />
                  </button>
                  <button className="btn btn-ghost btn-sm btn-icon" disabled={pageSafe >= totalPages} onClick={() => setPage(totalPages)} title="Última página">
                    <ChevronsRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
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
                <input 
                  type="text" 
                  className="form-control" 
                  value={form._valorDisplay ?? (form.valor !== undefined && form.valor !== null ? form.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')} 
                  onChange={e => {
                    let val = e.target.value;
                    let clean = val.replace(/[^0-9.,]/g, '');
                    let numStr = clean.replace(/\./g, '').replace(',', '.');
                    let parsed = parseFloat(numStr);
                    setForm(f => ({ ...f, _valorDisplay: val, valor: isNaN(parsed) ? 0 : parsed }));
                  }}
                  onBlur={() => {
                    setForm(f => ({ ...f, _valorDisplay: undefined }));
                  }}
                />
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

            {centrosCusto.length > 0 && form.tipoTransacao !== 'transferencia' && (
              <div className="form-group">
                <label className="form-label">Rateio (Centro de Custo / Safra)</label>
                <select className="form-control" value={form.centroCustoId || ''} onChange={e => setForm(f => ({ ...f, centroCustoId: e.target.value }))}>
                  <option value="">Não Atribuir (Geral)</option>
                  {centrosCusto.map(c => <option key={c.id} value={c.id}>{c.codigo ? `${c.codigo} - ` : ''}{c.nome}</option>)}
                </select>
              </div>
            )}

            {!editItem && form.tipoTransacao !== 'transferencia' && (
              <div className="form-group" style={{ 
                border: '1px solid var(--border)', 
                padding: '12px 14px', 
                borderRadius: 8,
                background: form.isRecorrente ? 'var(--bg-hover)' : 'transparent',
                transition: '0.2s'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)', marginBottom: form.isRecorrente ? 12 : 0 }}>
                  <input 
                    type="checkbox" 
                    checked={form.isRecorrente || false}
                    onChange={e => setForm(f => ({ ...f, isRecorrente: e.target.checked, parcelas: e.target.checked ? 12 : undefined }))}
                  />
                  🔄 Lançamento Recorrente (Criar parcelas futuras)
                </label>
                {form.isRecorrente && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Frequência</label>
                      <select className="form-control form-control-sm" disabled>
                        <option>Mensal</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Total de Meses</label>
                      <input 
                        type="number" 
                        min={2} 
                        max={360}
                        className="form-control form-control-sm" 
                        value={form.parcelas || 12}
                        onChange={e => setForm(f => ({ ...f, parcelas: parseInt(e.target.value) || 2 }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

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
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) { setShowReclassModal(false); setSelectedIds([]); } }}>
          <div className="modal modal-lg" style={{ maxWidth: '650px', padding: '24px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{bulkMode === 'transferir' ? '⇄ Transferir em Lote' : '🔄 Ações em Lote'}</span>
                <span className="badge badge-purple" style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '12px' }}>
                  {selectedIds.length} selecionados
                </span>
              </h2>
              <button className="modal-close" onClick={() => { setShowReclassModal(false); setSelectedIds([]); }}>✕</button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>
              {bulkMode === 'transferir'
                ? `Mover o saldo de ${selectedIds.length} lançamentos para outro portador criando uma transferência correspondente.`
                : `Alterar categoria ou portador de ${selectedIds.length} lançamentos simultaneamente.`}
            </p>

            {/* Lista resumida de lançamentos selecionados (Visualização Premium) */}
            <div style={{ 
              background: 'var(--bg-card2)', 
              borderRadius: '8px', 
              border: '1px solid var(--border)', 
              padding: '12px', 
              marginBottom: '20px' 
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>📋 Lançamentos selecionados para alteração:</span>
                <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{selectedLancamentosList.length} itens</span>
              </div>
              <div style={{ maxHeight: '110px', overflowY: 'auto', fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                {selectedLancamentosList.map(l => {
                  const port = portadores.find(p => p.id === l.portadorId)?.nome || '-';
                  return (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-base)', padding: '6px 8px', borderRadius: '4px', borderLeft: `3px solid ${l.tipo === 'receita' ? 'var(--green)' : 'var(--red)'}` }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{fmt.date(l.data)}</span>
                      <span style={{ flex: 1, marginLeft: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }} title={l.descricao}>{l.descricao}</span>
                      <span style={{ fontWeight: 700, color: l.tipo === 'receita' ? 'var(--green)' : 'var(--red)', marginLeft: '8px' }}>
                        {l.tipo === 'receita' ? '+' : '-'}{fmt.currency(l.valor)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {bulkMode === 'transferir' ? (
              <div style={{ 
                padding: '12px 14px', 
                background: 'rgba(59, 130, 246, 0.08)', 
                borderRadius: '8px', 
                fontSize: '12.5px', 
                color: 'var(--text-secondary)', 
                marginBottom: '20px', 
                border: '1px solid rgba(59, 130, 246, 0.2)', 
                lineHeight: '1.4' 
              }}>
                💡 <strong>Como funciona a transferência em lote:</strong><br />
                Os lançamentos selecionados serão convertidos em transferências. Para cada um, será mantido o lançamento de saída no portador original e criada uma contrapartida de entrada no portador de destino selecionado (mantendo a mesma data e valor).
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🏷️</span> Nova Categoria (Opcional)
                </label>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    placeholder="🔍 Digite para filtrar categorias..."
                    className="form-control form-control-sm"
                    value={reclassContaSearch}
                    onChange={e => setReclassContaSearch(e.target.value)}
                    style={{ fontSize: '12px' }}
                  />
                  <select 
                    className="form-control" 
                    value={reclassContaId} 
                    onChange={e => setReclassContaId(e.target.value)} 
                    size={4} 
                    style={{ 
                      maxHeight: '120px', 
                      fontSize: '12px',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      background: 'var(--bg-card)'
                    }}
                  >
                    <option value="">Manter categoria original</option>
                    {planoContas.filter(p => matchesConta(p, reclassContaSearch)).map(pc => (
                      <option key={pc.id} value={pc.id}>{pc.codigo} - {pc.descricao}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>💳</span> {bulkMode === 'transferir' ? 'Portador Destino *' : 'Novo Portador (Opcional)'}
              </label>
              <select 
                className="form-control" 
                value={reclassPortadorId} 
                onChange={e => setReclassPortadorId(e.target.value)}
                style={{ fontSize: '12.5px' }}
              >
                <option value="">{bulkMode === 'transferir' ? 'Selecione o destino...' : 'Manter portador original'}</option>
                {portadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>

            <div className="form-actions" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => { setShowReclassModal(false); setSelectedIds([]); }}
                style={{ padding: '8px 16px', fontSize: '12.5px' }}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleBulkReclassify}
                style={{ 
                  padding: '8px 20px', 
                  fontSize: '12.5px',
                  background: bulkMode === 'transferir' ? 'var(--primary-color)' : 'var(--accent)',
                  borderColor: bulkMode === 'transferir' ? 'var(--primary-color)' : 'var(--accent)'
                }}
              >
                {bulkMode === 'transferir' ? '🔄 Realizar Transferências' : '⚡ Executar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Importação de Cartão (Faturas CSV/Excel) */}
      {showCardImportModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && !cardImporting && setShowCardImportModal(false)}>
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
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setShowC6BoletoModal(false)}>
          <div className="modal c6-boleto-modal-container" style={{ maxWidth: 800, padding: 24, background: '#fff', color: '#000', fontFamily: 'Courier New, monospace', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <style dangerouslySetInnerHTML={{
              __html: `
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

      {/* Layout de Impressão de Lançamentos Duvidosos (oculto na tela, visível no papel) */}
      {showPrintDuvidosos && (
        <div className="print-only-layout-duvidosos" style={{ display: 'none' }}>
          <div style={{ padding: '30px', fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff' }}>
            <style dangerouslySetInnerHTML={{
              __html: `
              @media print {
                body * {
                  visibility: hidden !important;
                }
                .print-only-layout-duvidosos, .print-only-layout-duvidosos * {
                  visibility: visible !important;
                }
                .print-only-layout-duvidosos {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  box-shadow: none !important;
                  border: none !important;
                }
              }
            ` }} />
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 15, marginBottom: 20 }}>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 6px 0', textTransform: 'uppercase' }}>
                Lançamentos Pendentes de Classificação (Duvidosos)
              </h1>
              <p style={{ fontSize: '13px', margin: 0, fontWeight: 600 }}>
                {activeCompany?.razaoSocial} • CNPJ {activeCompany?.cnpj}
              </p>
              <p style={{ fontSize: '11px', color: '#666', margin: '4px 0 0 0' }}>
                Gerado em: {new Date().toLocaleDateString('pt-BR')} • Privilege Consultoria Financeira
              </p>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #000' }}>
                  <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #000' }}>Data</th>
                  <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #000' }}>Descrição / Histórico</th>
                  <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #000' }}>Portador</th>
                  <th style={{ textAlign: 'right', padding: '8px', borderBottom: '2px solid #000' }}>Valor</th>
                  <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #000', width: '250px' }}>Identificação do Cliente (O que se refere?)</th>
                </tr>
              </thead>
              <tbody>
                {duvidososList.map(l => {
                  const port = portadores.find(p => p.id === l.portadorId)?.nome || '-';
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{fmt.date(l.data)}</td>
                      <td style={{ padding: '8px', fontWeight: 500 }}>
                        {l.descricao}
                        {l.observacao && <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{l.observacao}</div>}
                      </td>
                      <td style={{ padding: '8px' }}>{port}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: l.tipo === 'receita' ? '#10b981' : '#ef4444' }}>
                        {l.tipo === 'receita' ? '+' : '-'}{fmt.currency(l.valor)}
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #000' }}></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: '50px', fontSize: '11px', color: '#555', borderTop: '1px dashed #ccc', paddingTop: '15px' }}>
              <strong>Instruções para o Cliente:</strong> Por favor, verifique as transações acima listadas e preencha a última coluna indicando a finalidade de cada lançamento (Ex: "Fornecedor X", "Recebimento Cliente Y", "Aluguel", etc.) para que possamos realizar a classificação contábil adequada no sistema.
            </div>
          </div>
        </div>
      )}
    </>
  );
}