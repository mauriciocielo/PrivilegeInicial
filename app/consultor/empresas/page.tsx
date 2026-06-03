'use client';
import { useState, useEffect } from 'react';
import { store, Empresa } from '../../../lib/store';
import { uid } from '../../../lib/store';
import ImageCropper from '../../../components/ImageCropper';

const AVAILABLE_SCREENS = [
  { label: '📊 Dashboard', route: '/consultor/dashboard' },
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
  { label: '🏦 Integração C6 Bank', route: '/consultor/integracao-c6' },
  { label: '🏢 Empresas', route: '/consultor/empresas' },
  { label: '👥 Usuários e Permissões', route: '/consultor/usuarios' },
  { label: '📋 Plano de Contas', route: '/consultor/plano-de-contas' },
  { label: '📝 Atas de Atendimento', route: '/consultor/atas' },
  { label: '🏦 Portadores / Contas', route: '/consultor/portadores' },
  { label: '📈 Relatórios', route: '/consultor/relatorios' },
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
      alert('Por favor, insira um CNPJ válido com 14 dígitos (apenas números) para consultar.');
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
      alert(err instanceof Error ? err.message : 'Erro inesperado ao buscar dados do CNPJ.');
    } finally {
      setFetchingCnpj(false);
    }
  };

  useEffect(() => {
    setList(store.getEmpresas());
  }, []);

  const openNew = () => { 
    setEdit(null); 
    setForm({ allowedRoutes: AVAILABLE_SCREENS.map(s => s.route) }); 
    setShowModal(true); 
  };
  const openEdit = (e: Empresa) => { 
    setEdit(e); 
    setForm({ ...e, allowedRoutes: e.allowedRoutes || AVAILABLE_SCREENS.map(s => s.route) }); 
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
    if (!form.razaoSocial || !form.cnpj) { alert('Preencha Razão Social e CNPJ.'); return; }
    const emp: Empresa = {
      id: edit?.id || uid(),
      razaoSocial: form.razaoSocial!,
      nomeFantasia: form.nomeFantasia || form.razaoSocial!,
      cnpj: form.cnpj!,
      responsavel: form.responsavel || '',
      email: form.email || '',
      telefone: form.telefone || '',
      atividade: form.atividade,
      dataInicioContrato: form.dataInicioContrato,
      grupoEconomico: form.grupoEconomico,
      receitaMensalEstimada: Number(form.receitaMensalEstimada) || 0,
      comprasMensalEstimada: Number(form.comprasMensalEstimada) || 0,
      logoData: form.logoData,
      bancoBoleto: form.bancoBoleto || 'nenhum',
      allowedRoutes: form.allowedRoutes || AVAILABLE_SCREENS.map(s => s.route),
      createdAt: edit?.createdAt || new Date().toISOString(),
    };
    store.saveEmpresa(emp);
    const updated = store.getEmpresas();
    setList(updated);
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir esta empresa? Todos os dados relacionados serão afetados.')) return;
    store.deleteEmpresa(id);
    const updated = store.getEmpresas();
    setList(updated);
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
                          <img src={e.logoData} alt="Logo" style={{ maxHeight: 24, maxWidth: 48, objectFit: 'contain', borderRadius: 4 }} />
                        ) : (
                          <div style={{ width: 32, height: 24, background: 'var(--bg-card2)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)' }}>🏢</div>
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
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.email}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(e)}>✏️</button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(e.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-icon">🏢</div><h3>Nenhuma empresa encontrada</h3></div></td></tr>
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
                <label className="form-label">Atividade da Empresa</label>
                <select className="form-control" value={form.atividade || ''} onChange={e => setForm(f => ({ ...f, atividade: e.target.value as Empresa['atividade'] }))}>
                  <option value="">Selecione...</option>
                  <option value="Comércio">Comércio</option>
                  <option value="Serviço">Serviço</option>
                  <option value="Indústria">Indústria</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input type="email" className="form-control" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input className="form-control" placeholder="(00) 00000-0000" value={form.telefone || ''} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Logotipo da Empresa</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="file" accept="image/*" onChange={handleLogoChange} style={{ fontSize: 12 }} />
                  {form.logoData && <img src={form.logoData} alt="Miniatura" style={{ maxHeight: 28, maxWidth: 60, objectFit: 'contain', border: '1px solid var(--border-light)', borderRadius: 4 }} />}
                </div>
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
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>✓ Salvar</button>
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
