'use client';
import { useState, useEffect } from 'react';
import { store, Empresa, Lancamento, Cliente, NfsE } from '../../../lib/store';

export default function ApresentacaoClientePage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
  const [activeEmpresa, setActiveEmpresa] = useState<Empresa | null>(null);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nfseList, setNfseList] = useState<NfsE[]>([]);

  // Presentation State
  const [currentSlide, setCurrentSlide] = useState(0);
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    const emps = store.getEmpresas();
    setEmpresas(emps);

    const saved = sessionStorage.getItem('cf_empresa_sel');
    if (saved) {
      setSelectedEmpresaId(saved);
      loadData(saved);
    } else if (emps.length > 0) {
      setSelectedEmpresaId(emps[0].id);
      loadData(emps[0].id);
    }

    const handler = (e: any) => {
      if (e.detail) {
        setSelectedEmpresaId(e.detail);
        loadData(e.detail);
      }
    };
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, []);

  const loadData = (empId: string) => {
    const emp = store.getEmpresas().find(e => e.id === empId) || null;
    setActiveEmpresa(emp);

    const lancs = store.getLancamentos(empId);
    setLancamentos(lancs);

    const cls = store.getClientes(empId);
    setClientes(cls);

    const nfs = store.getNfsE(empId);
    setNfseList(nfs);
  };

  // Calculations for Financial Summary
  const receitasRealizadas = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'realizado').reduce((acc, curr) => acc + curr.valor, 0);
  const despesasRealizadas = lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'realizado').reduce((acc, curr) => acc + curr.valor, 0);
  const saldoAtual = receitasRealizadas - despesasRealizadas;

  const receitasPrevistas = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'previsto').reduce((acc, curr) => acc + curr.valor, 0);
  const despesasPrevistas = lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'previsto').reduce((acc, curr) => acc + curr.valor, 0);
  const saldoProjetado = saldoAtual + receitasPrevistas - despesasPrevistas;

  const totalNfsEmitidas = nfseList.filter(n => n.status === 'emitida').reduce((acc, curr) => acc + curr.valorServicos, 0);

  const slides = [
    // Slide 1: Executive Opening
    {
      title: 'Apresentação de Resultados Financeiros',
      subtitle: 'Reunião de Fechamento & Alinhamento Estratégico',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '40px 20px' }}>
          {activeEmpresa?.logoData ? (
            <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', marginBottom: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.3)', display: 'inline-block' }}>
              <img src={activeEmpresa.logoData} alt="Logo" style={{ maxHeight: 80, maxWidth: 280, objectFit: 'contain' }} />
            </div>
          ) : (
            <div style={{ fontSize: 72, marginBottom: 20 }}>🏢</div>
          )}
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '1px' }}>
            {activeEmpresa?.razaoSocial || 'NOME DA EMPRESA'}
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--accent-light)', fontWeight: 500, marginBottom: 40 }}>
            {activeEmpresa?.nomeFantasia ? `(${activeEmpresa.nomeFantasia})` : ''} • CNPJ: {activeEmpresa?.cnpj}
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, width: '100%', maxWidth: 700, marginTop: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '20px 10px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4 }}>Consultoria Responsável</div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Privilege BPO Financeiro</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '20px 10px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4 }}>Responsável Técnico</div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{activeEmpresa?.responsavel || 'Consultor Privilege'}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '20px 10px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4 }}>Período de Análise</div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Ano Corrente 2026</div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 2: Cash Flow Performance
    {
      title: 'Desempenho do Fluxo de Caixa',
      subtitle: 'Entradas, Saídas e Evolução do Saldo do Período',
      content: (
        <div style={{ padding: '20px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 30 }}>
            <div className="stat-card" style={{ background: 'rgba(46, 204, 113, 0.08)', border: '1px solid rgba(46, 204, 113, 0.2)' }}>
              <div className="stat-label" style={{ color: 'var(--green)' }}>Total Recebido (Efetivo)</div>
              <div className="stat-value" style={{ color: '#fff', fontSize: 28 }}>R$ {receitasRealizadas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Contas liquidadas no período</div>
            </div>
            <div className="stat-card" style={{ background: 'rgba(231, 76, 60, 0.08)', border: '1px solid rgba(231, 76, 60, 0.2)' }}>
              <div className="stat-label" style={{ color: 'var(--red)' }}>Total Pago (Efetivo)</div>
              <div className="stat-value" style={{ color: '#fff', fontSize: 28 }}>R$ {despesasRealizadas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Despesas pagas no período</div>
            </div>
            <div className="stat-card" style={{ background: saldoAtual >= 0 ? 'rgba(52, 152, 219, 0.08)' : 'rgba(241, 196, 15, 0.08)', border: '1px solid rgba(52, 152, 219, 0.2)' }}>
              <div className="stat-label" style={{ color: 'var(--accent)' }}>Saldo Líquido Atual</div>
              <div className="stat-value" style={{ color: '#fff', fontSize: 28 }}>R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div style={{ fontSize: 12, color: saldoAtual >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4, fontWeight: 600 }}>
                {saldoAtual >= 0 ? '📈 Superávit Caixa' : '📉 Déficit Caixa'}
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 15, color: '#fff', marginBottom: 15 }}>📊 Prospecção do Fluxo de Caixa (Realizado + Previsto)</h3>
            <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Receitas Previstas (A Receber):</span>
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>+ R$ {receitasPrevistas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Despesas Previstas (A Pagar):</span>
                  <span style={{ color: 'var(--red)', fontWeight: 600 }}>- R$ {despesasPrevistas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                  <span style={{ color: '#fff', fontWeight: 600 }}>Saldo Projetado Final:</span>
                  <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>R$ {saldoProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Mini CSS Bar Chart */}
              <div style={{ display: 'flex', gap: 24, height: 140, alignItems: 'flex-end', padding: '0 20px', borderLeft: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ height: 80, width: 36, background: 'var(--green)', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Receitas</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ height: 60, width: 36, background: 'var(--red)', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Despesas</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ height: 45, width: 36, background: 'var(--accent)', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Saldo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 3: Liquidity and Aging
    {
      title: 'Planejamento de Contas a Pagar e Receber',
      subtitle: 'Controle de Inadimplência, Liquidez de Curto Prazo e Agendamentos',
      content: (
        <div style={{ padding: '10px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', margin: 0 }}>
              <h3 style={{ fontSize: 14, color: 'var(--green)', marginBottom: 12 }}>💵 Contas a Receber (Próximos Vencimentos)</h3>
              <div className="table-wrap">
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Data</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentos.filter(l => l.tipo === 'receita' && l.status === 'previsto').slice(0, 4).map(l => (
                      <tr key={l.id}>
                        <td>{l.descricao}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{new Date(l.data).toLocaleDateString('pt-BR')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {lancamentos.filter(l => l.tipo === 'receita' && l.status === 'previsto').length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Sem recebíveis futuros pendentes.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', margin: 0 }}>
              <h3 style={{ fontSize: 14, color: 'var(--red)', marginBottom: 12 }}>💸 Contas a Pagar (Próximas Despesas)</h3>
              <div className="table-wrap">
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Data</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'previsto').slice(0, 4).map(l => (
                      <tr key={l.id}>
                        <td>{l.descricao}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{new Date(l.data).toLocaleDateString('pt-BR')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'previsto').length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Sem contas a pagar pendentes.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15, marginTop: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Clientes</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 4 }}>{clientes.length}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>A Receber Total</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)', marginTop: 4 }}>R$ {receitasPrevistas.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>A Pagar Total</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)', marginTop: 4 }}>R$ {despesasPrevistas.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Índice Liquidez</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-light)', marginTop: 4 }}>
                {despesasPrevistas > 0 ? (receitasPrevistas / despesasPrevistas).toFixed(1) : '100%'}
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 4: Fiscal Health & National Portal
    {
      title: 'Emissão Fiscal & NFS-e Portal Nacional',
      subtitle: 'Conformidade com a Receita Federal e Faturamento de Serviços',
      content: (
        <div style={{ padding: '20px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            {/* Left Block */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 15, color: '#fff', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                🛡️ Integração de Notas de Serviços
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: 20 }}>
                Nossa solução conecta diretamente ao **Portal Nacional da NFS-e (SPED)** para a transmissão automatizada de serviços. O faturamento está diretamente integrado com as contas a receber, reduzindo a redigitação de informações e minimizando erros humanos.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                <div style={{ padding: 12, background: 'rgba(52, 152, 219, 0.05)', border: '1px solid rgba(52, 152, 219, 0.1)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Faturamento pelo Portal Nacional</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-light)', marginTop: 4 }}>
                    R$ {totalNfsEmitidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ padding: 12, background: 'rgba(46, 204, 113, 0.05)', border: '1px solid rgba(46, 204, 113, 0.1)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>NFS-e Emitidas (Sucesso)</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)', marginTop: 4 }}>
                    {nfseList.filter(n => n.status === 'emitida').length} Notas
                  </div>
                </div>
              </div>
            </div>

            {/* Right Block */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>🛡️</div>
              <h4 style={{ fontSize: 14, color: '#fff', marginBottom: 8 }}>Situação Fiscal Cadastrada</h4>
              <span className="badge badge-green" style={{ fontSize: 12, padding: '4px 12px' }}>✓ Portal Nacional Conectado</span>
              
              <div style={{ marginTop: 24, textAlign: 'left', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Ambiente:</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>Produção</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Certificado:</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>A1 (Válido)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Status Conexão:</span>
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>100% Operacional</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 5: Strategic Actions & Next Steps
    {
      title: 'Plano de Ação e Recomendações',
      subtitle: 'Oportunidades mapeadas pela Privilege BPO para os próximos meses',
      content: (
        <div style={{ padding: '10px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            
            <div style={{ background: 'rgba(52, 152, 219, 0.05)', border: '1px solid rgba(52, 152, 219, 0.2)', padding: 24, borderRadius: 12 }}>
              <div style={{ fontSize: 32, marginBottom: 15 }}>🏦</div>
              <h3 style={{ fontSize: 16, color: '#fff', marginBottom: 10 }}>1. Otimização Bancária</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Habilitar a API do Banco C6 para liquidação em tempo real e conciliação em lote, reduzindo as tarifas de boletos e otimizando a cobrança dos clientes.
              </p>
            </div>

            <div style={{ background: 'rgba(46, 204, 113, 0.05)', border: '1px solid rgba(46, 204, 113, 0.2)', padding: 24, borderRadius: 12 }}>
              <div style={{ fontSize: 32, marginBottom: 15 }}>📈</div>
              <h3 style={{ fontSize: 16, color: '#fff', marginBottom: 10 }}>2. Controle de Inadimplência</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Integrar avisos preventivos e régua de cobrança automática por e-mail, reduzindo o tempo médio de recebimento das parcelas de vendas de serviços.
              </p>
            </div>

            <div style={{ background: 'rgba(155, 89, 182, 0.05)', border: '1px solid rgba(155, 89, 182, 0.2)', padding: 24, borderRadius: 12 }}>
              <div style={{ fontSize: 32, marginBottom: 15 }}>🧠</div>
              <h3 style={{ fontSize: 16, color: '#fff', marginBottom: 10 }}>3. Planejamento Orçamentário</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Fazer o acompanhamento semanal do Previsto vs Realizado no plano de contas para evitar desvios significativos de despesas de pessoal e operacionais fixas.
              </p>
            </div>

          </div>

          <div style={{ marginTop: 30, padding: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 10, textAlign: 'center' }}>
            <span style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>💡 Privilege BPO: "Parceria estratégica para impulsionar o faturamento e blindar o caixa do seu negócio!"</span>
          </div>
        </div>
      )
    }
  ];

  return (
    <div style={{ minHeight: focusMode ? '100vh' : 'auto', background: focusMode ? '#0d0e14' : 'transparent', color: '#fff', padding: focusMode ? '40px' : '0', transition: 'all 0.3s' }}>
      
      {/* Presentation Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        {!focusMode ? (
          <div>
            <div className="page-title">Apresentação Executiva</div>
            <div className="page-subtitle">Exibição de resultados e relatórios finais para reuniões com clientes</div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ background: 'var(--accent)', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>MODO REUNIÃO</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{activeEmpresa?.nomeFantasia || activeEmpresa?.razaoSocial}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setFocusMode(!focusMode)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {focusMode ? '📺 Sair do Modo Foco' : '📺 Modo Apresentação'}
          </button>
        </div>
      </div>

      {/* Main presentation canvas */}
      <div style={{ 
        background: '#121420', 
        borderRadius: 16, 
        border: '1px solid #1f233b', 
        padding: focusMode ? '48px' : '36px', 
        minHeight: focusMode ? 'calc(100vh - 150px)' : '480px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        transition: 'all 0.3s'
      }}>
        
        {/* Slide Header */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: 0 }}>
              {slides[currentSlide].title}
            </h2>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Slide {currentSlide + 1} de {slides.length}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}>
            {slides[currentSlide].subtitle}
          </p>
        </div>

        {/* Slide Content */}
        <div style={{ flex: 1, padding: '30px 0 20px 0' }}>
          {slides[currentSlide].content}
        </div>

        {/* Slide Footer / Navigation Controls */}
        <div style={{ 
          borderTop: '1px solid rgba(255,255,255,0.05)', 
          paddingTop: 16, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                  background: idx === currentSlide ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
                  transition: 'background 0.2s'
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button 
              className="btn btn-secondary btn-sm" 
              disabled={currentSlide === 0} 
              onClick={() => setCurrentSlide(currentSlide - 1)}
            >
              ← Anterior
            </button>
            <button 
              className="btn btn-primary btn-sm" 
              disabled={currentSlide === slides.length - 1} 
              onClick={() => setCurrentSlide(currentSlide + 1)}
            >
              Próximo →
            </button>
          </div>
        </div>

      </div>

      {!focusMode && (
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          Dica do Consultor: Use o <strong>Modo Apresentação</strong> acima para ocultar a barra lateral e obter uma experiência ideal em reuniões presenciais ou chamadas online.
        </div>
      )}
    </div>
  );
}
