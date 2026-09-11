'use client';
import { useState, useEffect } from 'react';
import { store, Empresa, PlanoConta, Portador } from '../../../lib/store';
import { uid } from '../../../lib/store';
import ImageCropper from '../../../components/ImageCropper';
import { toast } from 'sonner';
import { confirmAsync } from '../../../components/ConfirmProvider';

interface ApiKeyResumo {
  id: string;
  nome: string;
  prefixo: string;
  ativo: boolean;
  ultimoUsoEm: string | null;
  createdAt: string;
  revokedAt: string | null;
}

const AVAILABLE_SCREENS = [
  { label: '📊 Dashboard', route: '/consultor/dashboard' },
  { label: '🗺️ Radar Administrativo', route: '/consultor/administrativo' },
  { label: '💡 Inteligência Tributária', route: '/consultor/inteligencia-tributaria' },
  { label: '🔍 Diagnóstico 360º', route: '/consultor/diagnostico-360' },
  { label: '⏱️ Atividades e Tempos', route: '/consultor/atividades' },
  { label: '📅 Agenda Semanal', route: '/consultor/agenda' },
  { label: '🎬 Apresentação Cliente', route: '/consultor/apresentacao' },
  { label: '🧠 Inteligência Financeira', route: '/consultor/inteligencia' },
  { label: '📝 Lançamentos', route: '/consultor/lancamentos' },
  { label: '📂 Importar OFX', route: '/consultor/importar-ofx' },
  { label: '⚖️ Endividamento', route: '/consultor/endividamento' },
  { label: '🎯 Indicadores', route: '/consultor/indicadores' },
  { label: '💰 Orçamento', route: '/consultor/orcamento' },
  { label: '👥 Clientes / Fornecedores', route: '/consultor/clientes' },
  { label: '💸 Contas a Pagar', route: '/consultor/contas-pagar' },
  { label: '💵 Contas a Receber', route: '/consultor/contas-receber' },
  { label: '🧾 NFS-e', route: '/consultor/nfse' },
  { label: '🏦 APIs Open Finance', route: '/consultor/open-finance' },
  { label: '📋 Políticas Financeiras', route: '/consultor/politicas' },
  { label: '🏦 Integração C6 Bank', route: '/consultor/integracao-c6' },
  { label: '🔮 Projeção de Caixa', route: '/consultor/projecao-caixa' },
  { label: '🤖 Ecossistema BPO (IA)', route: '/consultor/bpo' },
  { label: '🏢 Empresas', route: '/consultor/empresas' },
  { label: '👥 Usuários e Permissões', route: '/consultor/usuarios' },
  { label: '📋 Plano de Contas', route: '/consultor/plano-de-contas' },
  { label: '🏷️ Centros de Custo', route: '/consultor/centros-custo' },
  { label: '📝 Atas de Atendimento', route: '/consultor/atas' },
  { label: '🏦 Portadores / Contas', route: '/consultor/portadores' },
  { label: '🔒 Segurança & Auditoria', route: '/consultor/configuracoes-avancadas' },
  { label: '📈 Relatórios', route: '/consultor/relatorios' },
  { label: '🚚 Logística', route: '/consultor/logistica' },
  { label: '🏘️ Painel Condomínio', route: '/consultor/condominio' },
];

export default function EmpresasPage() {
  const [list, setList] = useState<Empresa[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState<Empresa | null>(null);
  const [form, setForm] = useState<Partial<Empresa>>({});
  const [search, setSearch] = useState('');
  const [fetchingCnpj, setFetchingCnpj] = useState(false);
  const [rawImageData, setRawImageData] = useState<string | null>(null);
  // IDs das empresas que já possuem plano de contas
  const [planosMap, setPlanosMap] = useState<Record<string, boolean>>({});
  // Modal Criar Plano Padrão
  const [showPlanoModal, setShowPlanoModal] = useState(false);
  const [planoEmpresaId, setPlanoEmpresaId] = useState('');

  const inferAtividade = (descricao?: string): Empresa['atividade'] => {
    const text = (descricao || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (text.includes('industria') || text.includes('fabricacao') || text.includes('confeccao')) return 'Indústria';
    if (text.includes('comercio') || text.includes('varejista') || text.includes('atacadista')) return 'Comércio';
    if (text.includes('servico') || text.includes('consultoria') || text.includes('manutencao')) return 'Serviço';
    return undefined;
  };

  const fetchCnpjData = async () => {
    const rawCnpj = form.cnpj?.replace(/\D/g, '');
    if (!rawCnpj || rawCnpj.length !== 14) {
      toast.error('Por favor, insira um CNPJ válido com 14 dígitos (apenas números) para consultar.');
      return;
    }
    setFetchingCnpj(true);
    try {
      // Usando v1 como fallback ou v2 para dados mais detalhados
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${rawCnpj}`);
      if (res.status === 404) throw new Error('CNPJ não encontrado na base de dados da Receita Federal.');
      if (res.status === 429) throw new Error('Limite de consultas excedido. Tente novamente em alguns minutos.');
      if (!res.ok) throw new Error('O serviço de consulta de CNPJ está temporariamente instável. Preencha manualmente.');

      const data = await res.json();
      const responsavel = data.qsa?.[0]?.nome_socio || data.qsa?.[0]?.nome || data.nome_socio_administrador || '';
      const atividadeTexto = data.cnae_fiscal_descricao || data.estabelecimento?.atividade_principal?.descricao || data.razao_social;
      const atividade = inferAtividade(atividadeTexto);

      setForm(f => ({
        ...f,
        razaoSocial: (data.razao_social || data.nome || data.nome_fantasia || '').toUpperCase(),
        nomeFantasia: (data.nome_fantasia || data.fantasia || data.razao_social || '').toUpperCase(),
        responsavel,
        email: data.email || '',
        telefone: data.ddd_telefone_1 || data.telefone || '',
        atividade: atividade || f.atividade,
        cnpj: rawCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
      }));
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Erro inesperado ao buscar dados do CNPJ.');
    } finally {
      setFetchingCnpj(false);
    }
  };

  useEffect(() => {
    const load = () => {
      const empresas = store.getEmpresas();
      setList(empresas);
      // Mapeia quais empresas já possuem plano de contas
      const mapa: Record<string, boolean> = {};
      empresas.forEach(e => {
        mapa[e.id] = store.getPlanoContas(e.id).length > 0;
      });
      setPlanosMap(mapa);
    };
    load();
    // Atualiza sozinho quando os dados mudam (localmente, via WebSocket ou sync).
    window.addEventListener('cfDataChange', load);
    return () => window.removeEventListener('cfDataChange', load);
  }, []);

  // Integração via API (CP/CR) — só existe para empresa já salva (precisa de
  // um id real para a chave apontar).
  const [apiKeys, setApiKeys] = useState<ApiKeyResumo[]>([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);
  const [novoTokenGerado, setNovoTokenGerado] = useState<string | null>(null);
  const [nomeNovaChave, setNomeNovaChave] = useState('');
  const [gerandoChave, setGerandoChave] = useState(false);

  // Plano de conta/portador padrão para o lançamento-espelho de títulos
  // vindos da API v1 — sem isso, o título fica só no livro-razão imutável e
  // não aparece em Contas a Receber/Pagar.
  const [planosDaEmpresa, setPlanosDaEmpresa] = useState<PlanoConta[]>([]);
  const [portadoresDaEmpresa, setPortadoresDaEmpresa] = useState<Portador[]>([]);
  const [planoContaPadraoId, setPlanoContaPadraoId] = useState('');
  const [portadorPadraoId, setPortadorPadraoId] = useState('');
  const [carregandoConfigLancamento, setCarregandoConfigLancamento] = useState(false);
  const [salvandoConfigLancamento, setSalvandoConfigLancamento] = useState(false);

  const carregarConfigLancamentoApi = async (empresaId: string) => {
    setPlanosDaEmpresa(store.getPlanoContas(empresaId).filter(p => p.nivel === 3 && p.ativo));
    setPortadoresDaEmpresa(store.getPortadores(empresaId).filter(p => p.ativo));
    setCarregandoConfigLancamento(true);
    try {
      const res = await fetch(`/api/empresas/${empresaId}/config-lancamento-api`);
      const json = await res.json();
      if (res.ok) {
        setPlanoContaPadraoId(json.planoContaId || '');
        setPortadorPadraoId(json.portadorId || '');
      }
    } catch { /* silencioso — os selects ficam vazios se falhar */ }
    finally { setCarregandoConfigLancamento(false); }
  };

  const salvarConfigLancamentoApi = async () => {
    if (!edit) return;
    setSalvandoConfigLancamento(true);
    try {
      const res = await fetch(`/api/empresas/${edit.id}/config-lancamento-api`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planoContaId: planoContaPadraoId || null, portadorId: portadorPadraoId || null }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Erro ao salvar.'); return; }
      toast.success('Configuração salva — próximos títulos da API já aparecem em Contas a Receber/Pagar.');
    } catch {
      toast.error('Erro de conexão ao salvar.');
    } finally {
      setSalvandoConfigLancamento(false);
    }
  };

  const carregarApiKeys = async (empresaId: string) => {
    setLoadingApiKeys(true);
    try {
      const res = await fetch(`/api/empresas/${empresaId}/api-keys`);
      const json = await res.json();
      if (res.ok) setApiKeys(json.chaves || []);
    } catch { /* silencioso — a seção mostra "nenhuma chave" se falhar */ }
    finally { setLoadingApiKeys(false); }
  };

  const gerarNovaChave = async () => {
    if (!edit) return;
    setGerandoChave(true);
    try {
      const res = await fetch(`/api/empresas/${edit.id}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeNovaChave.trim() || 'Integração ERP' }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Erro ao gerar a chave.'); return; }
      setNovoTokenGerado(json.token);
      setNomeNovaChave('');
      carregarApiKeys(edit.id);
    } catch {
      toast.error('Erro de conexão ao gerar a chave.');
    } finally {
      setGerandoChave(false);
    }
  };

  const revogarChave = async (keyId: string) => {
    if (!edit) return;
    if (!(await confirmAsync('Revogar esta chave? Qualquer integração que a use para de funcionar imediatamente.'))) return;
    const res = await fetch(`/api/empresas/${edit.id}/api-keys/${keyId}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Chave revogada.'); carregarApiKeys(edit.id); }
    else toast.error('Erro ao revogar a chave.');
  };

  const openNew = () => {
    setEdit(null);
    setForm({ allowedRoutes: AVAILABLE_SCREENS.map(s => s.route) });
    setShowModal(true);
  };
  const openEdit = (e: Empresa) => {
    setEdit(e);
    setForm({ ...e, allowedRoutes: e.allowedRoutes || AVAILABLE_SCREENS.map(s => s.route) });
    setApiKeys([]);
    setNovoTokenGerado(null);
    setNomeNovaChave('');
    carregarApiKeys(e.id);
    carregarConfigLancamentoApi(e.id);
    setShowModal(true);
  };

  const toggleRoute = (route: string) => {
    const routes = form.allowedRoutes || AVAILABLE_SCREENS.map(s => s.route);
    setForm(f => ({
      ...f,
      allowedRoutes: routes.includes(route) ? routes.filter(x => x !== route) : [...routes, route]
    }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setRawImageData(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Permite selecionar o mesmo arquivo novamente
  };

  const handleSave = () => {
    if (!form.razaoSocial || !form.cnpj) { toast.error('Preencha Razão Social e CNPJ.'); return; }
    const emp: Empresa = {
      id: edit?.id || uid(),
      razaoSocial: form.razaoSocial!,
      nomeFantasia: form.nomeFantasia || form.razaoSocial!,
      cnpj: form.cnpj!,
      responsavel: form.responsavel || '',
      email: form.email || '',
      telefone: form.telefone || '',
      atividade: form.atividade,
      tipo: form.tipo || 'empresa',
      taxaMensalPadrao: form.taxaMensalPadrao,
      fundoReservaPct: form.fundoReservaPct,
      dataInicioContrato: form.dataInicioContrato,
      grupoEconomico: form.grupoEconomico,
      receitaMensalEstimada: Number(form.receitaMensalEstimada) || 0,
      comprasMensalEstimada: Number(form.comprasMensalEstimada) || 0,
      logoData: form.logoData,
      bancoBoleto: form.bancoBoleto || 'nenhum',
      allowedRoutes: form.allowedRoutes || AVAILABLE_SCREENS.map(s => s.route),
      createdAt: edit?.createdAt || new Date().toISOString(),
      politicaReceberName: form.politicaReceberName,
      politicaReceberData: form.politicaReceberData,
      politicaComprasName: form.politicaComprasName,
      politicaComprasData: form.politicaComprasData,
      politicaCobrancaName: form.politicaCobrancaName,
      politicaCobrancaData: form.politicaCobrancaData,
    };
    store.saveEmpresa(emp);
    const updated = store.getEmpresas();
    setList(updated);
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmAsync('Excluir esta empresa? Todos os dados relacionados serão afetados.'))) return;
    store.deleteEmpresa(id);
    const updated = store.getEmpresas();
    setList(updated);
  };

  const handleImportarPlano = async (e: Empresa) => {
    const jaTemPlano = store.getPlanoContas(e.id).length > 0;
    if (jaTemPlano) {
      if (!(await confirmAsync(`A empresa "${e.nomeFantasia || e.razaoSocial}" já possui ${store.getPlanoContas(e.id).length} contas. Deseja ADICIONAR o plano padrão mesmo assim? Isso pode criar duplicatas.`))) return;
    }
    const result = store.seedPlanoContasForEmpresa(e.id);
    toast.success(`✅ Plano de contas importado com sucesso!
${result.planosAdded} contas adicionadas
${result.portadoresAdded} portadores criados`);
    // Atualiza estado
    setPlanosMap(prev => ({ ...prev, [e.id]: true }));
    const updated = store.getEmpresas();
    setList(updated);
  };

  const handleGerarPlanoModal = () => {
    if (!planoEmpresaId) {
      toast.error('Selecione uma empresa.');
      return;
    }
    const e = list.find(x => x.id === planoEmpresaId);
    if (!e) return;
    
    handleImportarPlano(e);
    setShowPlanoModal(false);
    setPlanoEmpresaId('');
  };

  const filtered = list.filter(e =>
    !search || e.razaoSocial.toLowerCase().includes(search.toLowerCase()) ||
    e.nomeFantasia.toLowerCase().includes(search.toLowerCase()) ||
    e.cnpj.includes(search)
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Empresas</div>
          <div className="page-subtitle">{list.length} empresas cadastradas</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setShowPlanoModal(true)}>📋 Criar Plano Padrão</button>
          <button className="btn btn-primary" onClick={openNew}>＋ Nova Empresa</button>
        </div>
      </div>

      <div className="page-body">
        <div className="card card-sm" style={{ marginBottom: 20 }}>
          <div className="search-bar">
            <span>🔍</span>
            <input placeholder="Buscar por nome, fantasia ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Razão Social</th>
                  <th>Nome Fantasia</th>
                  <th>CNPJ</th>
                  <th>Responsável</th>
                  <th>Atividade</th>
                  <th>Tipo</th>
                  <th>Contato</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {e.logoData ? (
                          <img src={e.logoData === '__PRUNED_IN_LOCAL_STAGE__' ? `/api/empresas/file?id=${e.id}&type=logo` : e.logoData} alt="Logo" style={{ maxHeight: 24, maxWidth: 48, objectFit: 'contain', borderRadius: 4 }} />
                        ) : (
                          <div style={{ width: 24, height: 24, background: 'var(--bg-hover)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>🏢</div>
                        )}
                        <div>
                          <div>{e.razaoSocial}</div>
                          {e.bancoBoleto === 'c6' && (
                            <span className="badge badge-gray" style={{ fontSize: 9, padding: '2px 6px', background: '#000', color: '#fff', display: 'inline-block', marginTop: 4 }}>🖤 C6 Bank Boletos</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{e.nomeFantasia}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.cnpj}</td>
                    <td>{e.responsavel || '-'}</td>
                    <td>{e.atividade ? <span className="badge badge-blue">{e.atividade}</span> : '-'}</td>
                    <td>
                      {e.tipo === 'cooperativa' ? (
                        <span className="badge" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)', fontSize: 10 }}>🤝 Cooperativa</span>
                      ) : e.tipo === 'condominio' ? (
                        <span className="badge badge-gray" style={{ fontSize: 10 }}>🏘️ Condomínio</span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)', fontSize: 10 }}>🏢 Empresa</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.email}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        {!planosMap[e.id] && (
                          <button
                            className="btn btn-sm"
                            onClick={() => handleImportarPlano(e)}
                            title="Esta empresa não possui plano de contas. Clique para importar o padrão."
                            style={{
                              background: 'rgba(245,158,11,0.15)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245,158,11,0.4)',
                              fontSize: 10,
                              padding: '3px 7px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            ⚠️ Importar Plano
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(e)}>✏️</button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(e.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-icon">🏢</div><h3>Nenhuma empresa encontrada</h3></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">{edit ? 'Editar Empresa' : 'Nova Empresa'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Início do Contrato</label>
                <input type="date" className="form-control" value={form.dataInicioContrato || ''} onChange={e => setForm(f => ({ ...f, dataInicioContrato: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Grupo Econômico</label>
                <input className="form-control" placeholder="Ex: Grupo Privilege" value={form.grupoEconomico || ''} onChange={e => setForm(f => ({ ...f, grupoEconomico: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Razão Social *</label>
                <input className="form-control" value={form.razaoSocial || ''} onChange={e => setForm(f => ({ ...f, razaoSocial: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Nome Fantasia</label>
                <input className="form-control" value={form.nomeFantasia || ''} onChange={e => setForm(f => ({ ...f, nomeFantasia: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">CNPJ *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-control" placeholder="Apenas números (14 dígitos)" value={form.cnpj || ''} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} />
                  {!edit && (
                    <button type="button" className="btn btn-secondary" onClick={fetchCnpjData} disabled={fetchingCnpj} style={{ padding: '8px 12px', fontSize: 12 }}>
                      {fetchingCnpj ? '⏳' : '🔍 Buscar Receita'}
                    </button>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Responsável</label>
                <input className="form-control" value={form.responsavel || ''} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input type="email" className="form-control" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de Gestão</label>
                <select className="form-control" value={form.tipo || 'empresa'} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as Empresa['tipo'] }))}>
                  <option value="empresa">🏢 Empresa Tradicional</option>
                  <option value="condominio">🏘️ Condomínio</option>
                  <option value="cooperativa">🤝 Cooperativa</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Atividade da Empresa</label>
                <select className="form-control" value={form.atividade || ''} onChange={e => setForm(f => ({ ...f, atividade: e.target.value as Empresa['atividade'] }))}>
                  <option value="">Selecione...</option>
                  <option value="Comércio">Comércio</option>
                  <option value="Serviço">Serviço</option>
                  <option value="Indústria">Indústria</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input className="form-control" placeholder="(00) 00000-0000" value={form.telefone || ''} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Receita Mensal Esperada (R$)</label>
                <input type="number" step="0.01" className="form-control" value={form.receitaMensalEstimada || 0} onChange={e => setForm(f => ({ ...f, receitaMensalEstimada: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Compras Mensais Esperadas (R$)</label>
                <input type="number" step="0.01" className="form-control" value={form.comprasMensalEstimada || 0} onChange={e => setForm(f => ({ ...f, comprasMensalEstimada: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Integração de Boleto (Banco Emissor)</label>
                <select className="form-control" value={form.bancoBoleto || 'nenhum'} onChange={e => setForm(f => ({ ...f, bancoBoleto: e.target.value as any }))}>
                  <option value="nenhum">Nenhuma integração (Padrão)</option>
                  <option value="c6">C6 Bank (Emissão de Boletos)</option>
                </select>
              </div>
            </div>

            {/* Políticas e Diretrizes Estratégicas (PDFs) */}
            <div style={{ marginTop: 20, borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>Políticas e Diretrizes Estratégicas (PDF)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                
                {/* Política Contas a Receber */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11.5 }}>Contas a Receber</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      style={{ fontSize: 11 }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64 = (reader.result as string).split(',')[1];
                          setForm(f => ({ ...f, politicaReceberName: file.name, politicaReceberData: base64 }));
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    {form.politicaReceberName && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                        <a 
                          href={form.politicaReceberData === '__PRUNED_IN_LOCAL_STAGE__' || !form.politicaReceberData ? `/api/empresas/policy?id=${form.id}&type=receber` : `data:application/pdf;base64,${form.politicaReceberData}`} 
                          download={form.politicaReceberName}
                          style={{ textDecoration: 'underline', color: 'var(--primary)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}
                          title={form.politicaReceberName}
                        >
                          📄 {form.politicaReceberName}
                        </a>
                        <button 
                          type="button" 
                          onClick={() => setForm(f => ({ ...f, politicaReceberName: undefined, politicaReceberData: undefined }))}
                          style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontWeight: 'bold', padding: '0 2px' }}
                          title="Excluir política"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Política Compras */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11.5 }}>Compras / Suprimentos</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      style={{ fontSize: 11 }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64 = (reader.result as string).split(',')[1];
                          setForm(f => ({ ...f, politicaComprasName: file.name, politicaComprasData: base64 }));
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    {form.politicaComprasName && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                        <a 
                          href={form.politicaComprasData === '__PRUNED_IN_LOCAL_STAGE__' || !form.politicaComprasData ? `/api/empresas/policy?id=${form.id}&type=compras` : `data:application/pdf;base64,${form.politicaComprasData}`} 
                          download={form.politicaComprasName}
                          style={{ textDecoration: 'underline', color: 'var(--primary)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}
                          title={form.politicaComprasName}
                        >
                          📄 {form.politicaComprasName}
                        </a>
                        <button 
                          type="button" 
                          onClick={() => setForm(f => ({ ...f, politicaComprasName: undefined, politicaComprasData: undefined }))}
                          style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontWeight: 'bold', padding: '0 2px' }}
                          title="Excluir política"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Política Cobrança */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11.5 }}>Cobrança / Crédito</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      style={{ fontSize: 11 }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64 = (reader.result as string).split(',')[1];
                          setForm(f => ({ ...f, politicaCobrancaName: file.name, politicaCobrancaData: base64 }));
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    {form.politicaCobrancaName && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                        <a 
                          href={form.politicaCobrancaData === '__PRUNED_IN_LOCAL_STAGE__' || !form.politicaCobrancaData ? `/api/empresas/policy?id=${form.id}&type=cobranca` : `data:application/pdf;base64,${form.politicaCobrancaData}`} 
                          download={form.politicaCobrancaName}
                          style={{ textDecoration: 'underline', color: 'var(--primary)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}
                          title={form.politicaCobrancaName}
                        >
                          📄 {form.politicaCobrancaName}
                        </a>
                        <button 
                          type="button" 
                          onClick={() => setForm(f => ({ ...f, politicaCobrancaName: undefined, politicaCobrancaData: undefined }))}
                          style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontWeight: 'bold', padding: '0 2px' }}
                          title="Excluir política"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Telas Autorizadas para esta Empresa (Selecione quais recursos estarão ativos)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginTop: 8, padding: '12px', background: 'var(--bg-card2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                {AVAILABLE_SCREENS.map(screen => {
                  const checked = (form.allowedRoutes || []).includes(screen.route);
                  const isDashboard = screen.route === '/consultor/dashboard';
                  return (
                    <label 
                      key={screen.route} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 8, 
                        padding: '6px 10px', 
                        borderRadius: 'var(--radius-sm)', 
                        border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-light)'}`, 
                        cursor: isDashboard ? 'not-allowed' : 'pointer', 
                        background: checked ? 'var(--accent-glow)' : 'transparent', 
                        fontSize: 12, 
                        color: checked ? 'var(--accent-light)' : 'var(--text-secondary)',
                        opacity: isDashboard ? 0.7 : 1
                      }}
                    >
                      <input 
                        type="checkbox" 
                        checked={checked || isDashboard} 
                        disabled={isDashboard}
                        onChange={() => toggleRoute(screen.route)}
                      />
                      {screen.label}
                    </label>
                  );
                })}
              </div>
            </div>
            {/* Integração via API (CP/CR) — exige empresa já salva */}
            {edit && (
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  🔌 Integração via API (Contas a Pagar/Receber)
                </label>
                <div style={{ padding: 14, background: 'var(--bg-card2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                    O ERP desta empresa usa essas chaves para lançar sacados e contas a pagar/receber
                    direto no sistema. Documentação dos endpoints (POST /api/v1/sacados,
                    /api/v1/contas-receber, /api/v1/contas-pagar) disponível com o time técnico.
                  </div>

                  <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                      Destino dos títulos no fluxo clássico
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
                      Todo título lançado pela API também aparece em Contas a Receber/Pagar,
                      pronto para dar baixa manual ou conciliar via Importar OFX — igual a um
                      lançamento normal. Para isso, informe o plano de conta e o portador padrão
                      que serão usados nesses lançamentos.
                    </div>
                    {carregandoConfigLancamento ? (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Carregando...</div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <label className="form-label" style={{ fontSize: 11 }}>Plano de conta padrão</label>
                          <select className="form-control form-control-sm" value={planoContaPadraoId} onChange={e => setPlanoContaPadraoId(e.target.value)}>
                            <option value="">— selecione —</option>
                            {planosDaEmpresa.map(p => <option key={p.id} value={p.id}>{p.codigo} - {p.descricao}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <label className="form-label" style={{ fontSize: 11 }}>Portador padrão</label>
                          <select className="form-control form-control-sm" value={portadorPadraoId} onChange={e => setPortadorPadraoId(e.target.value)}>
                            <option value="">— selecione —</option>
                            {portadoresDaEmpresa.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                          </select>
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={salvandoConfigLancamento} onClick={salvarConfigLancamentoApi}>
                          {salvandoConfigLancamento ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    )}
                    {!carregandoConfigLancamento && (!planoContaPadraoId || !portadorPadraoId) && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--yellow)' }}>
                        ⚠️ Sem os dois configurados, os títulos da API ficam só na tela "Contas via ERP" (não aparecem em Contas a Receber/Pagar).
                      </div>
                    )}
                  </div>

                  {novoTokenGerado && (
                    <div style={{
                      marginBottom: 14, padding: 12, background: 'var(--yellow-bg)',
                      border: '1px solid var(--yellow)', borderRadius: 'var(--radius-sm)',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
                        ⚠️ Copie agora — este token não será mostrado novamente
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <code style={{
                          flex: 1, fontSize: 11.5, padding: '8px 10px', background: 'var(--bg-card)',
                          borderRadius: 6, wordBreak: 'break-all', border: '1px solid var(--border-light)',
                        }}>
                          {novoTokenGerado}
                        </code>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => { navigator.clipboard.writeText(novoTokenGerado); toast.success('Token copiado.'); }}
                        >
                          📋 Copiar
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ marginTop: 8, padding: '2px 8px', fontSize: 11 }}
                        onClick={() => setNovoTokenGerado(null)}
                      >
                        Entendi, já salvei
                      </button>
                    </div>
                  )}

                  {loadingApiKeys ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Carregando chaves...</div>
                  ) : apiKeys.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      Nenhuma chave gerada para esta empresa ainda.
                    </div>
                  ) : (
                    <div style={{ marginBottom: 12 }}>
                      {apiKeys.map(k => (
                        <div key={k.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 10px', borderBottom: '1px solid var(--border-light)', fontSize: 12,
                        }}>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {k.nome} {!k.ativo && <span style={{ color: 'var(--red)', fontWeight: 500 }}>(revogada)</span>}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11 }}>
                              {k.prefixo}.•••••••• · criada {new Date(k.createdAt).toLocaleDateString('pt-BR')}
                              {k.ultimoUsoEm && ` · último uso ${new Date(k.ultimoUsoEm).toLocaleDateString('pt-BR')}`}
                            </div>
                          </div>
                          {k.ativo && (
                            <button type="button" className="btn btn-danger btn-sm" style={{ padding: '3px 8px', fontSize: 11 }}
                              onClick={() => revogarChave(k.id)}>
                              Revogar
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="form-control" style={{ fontSize: 12 }}
                      placeholder="Nome da chave (ex: Integração Omie)"
                      value={nomeNovaChave}
                      onChange={e => setNomeNovaChave(e.target.value)}
                    />
                    <button type="button" className="btn btn-primary btn-sm" onClick={gerarNovaChave} disabled={gerandoChave} style={{ whiteSpace: 'nowrap' }}>
                      {gerandoChave ? 'Gerando...' : '+ Gerar Chave'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>✓ Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Plano Padrão */}
      {showPlanoModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPlanoModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Criar Plano Padrão</h2>
              <button className="modal-close" onClick={() => setShowPlanoModal(false)}>✕</button>
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Selecione a Empresa *</label>
              <select className="form-control" value={planoEmpresaId} onChange={e => setPlanoEmpresaId(e.target.value)}>
                <option value="">Selecione...</option>
                {list.map(p => (
                  <option key={p.id} value={p.id}>{p.razaoSocial} {p.nomeFantasia && p.nomeFantasia !== p.razaoSocial ? `(${p.nomeFantasia})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowPlanoModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGerarPlanoModal}>✓ Gerar Plano</button>
            </div>
          </div>
        </div>
      )}

      {rawImageData && (
        <ImageCropper
          src={rawImageData}
          aspectRatio="rect"
          onCrop={(cropped) => {
            setForm(f => ({ ...f, logoData: cropped }));
            setRawImageData(null);
          }}
          onCancel={() => setRawImageData(null)}
        />
      )}
    </>
  );
}
