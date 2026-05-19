'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { store, Empresa, Lancamento, User } from '../../../lib/store';
import { fmt } from '../../../lib/reports';

export default function AdministrativoPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);

  const load = useCallback(() => {
    setEmpresas(store.getEmpresas());
    setUsers(store.getUsers());
    setLancamentos(store.getLancamentos());
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('cfDataChange', load);
    return () => window.removeEventListener('cfDataChange', load);
  }, [load]);

  const data = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7);
    const realizadosMes = lancamentos.filter(l => l.status === 'realizado' && l.data.startsWith(mes));
    const receitas = realizadosMes.filter(l => l.tipo === 'receita').reduce((acc, l) => acc + l.valor, 0);
    const despesas = realizadosMes.filter(l => l.tipo === 'despesa').reduce((acc, l) => acc + l.valor, 0);
    const endividamentos = empresas.flatMap(e => store.getEndividamentos(e.id));
    const dividaTotal = endividamentos.reduce((acc, e) => acc + Math.max(0, e.valorAPagar - e.pagamentoMes), 0);
    const portadoresTotal = empresas.reduce((acc, empresa) => {
      return acc + store.getPortadores(empresa.id).reduce((sum, p) => sum + store.getSaldoPortador(p.id, empresa.id), 0);
    }, 0);

    const porEmpresa = empresas.map(empresa => {
      const lancs = realizadosMes.filter(l => l.empresaId === empresa.id);
      const rec = lancs.filter(l => l.tipo === 'receita').reduce((acc, l) => acc + l.valor, 0);
      const desp = lancs.filter(l => l.tipo === 'despesa').reduce((acc, l) => acc + l.valor, 0);
      return { empresa, receitas: rec, despesas: desp, saldo: rec - desp, registros: lancs.length };
    }).sort((a, b) => b.receitas - a.receitas);

    const atividades = empresas.reduce<Record<string, number>>((acc, e) => {
      const key = e.atividade || 'Não informado';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return { receitas, despesas, resultado: receitas - despesas, dividaTotal, portadoresTotal, porEmpresa, atividades };
  }, [empresas, lancamentos]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Painel Administrativo</div>
          <div className="page-subtitle">Visão global do escritório e da carteira de clientes</div>
        </div>
      </div>

      <div className="page-body">
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card blue">
            <div className="stat-icon blue">🏢</div>
            <div className="stat-label">Empresas Ativas</div>
            <div className="stat-value">{empresas.length}</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple">👥</div>
            <div className="stat-label">Usuários</div>
            <div className="stat-value">{users.length}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-icon green">↑</div>
            <div className="stat-label">Receitas do Mês</div>
            <div className="stat-value">{fmt.currency(data.receitas)}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-icon red">↓</div>
            <div className="stat-label">Despesas do Mês</div>
            <div className="stat-value">{fmt.currency(data.despesas)}</div>
          </div>
          <div className={`stat-card ${data.resultado >= 0 ? 'green' : 'red'}`}>
            <div className={`stat-icon ${data.resultado >= 0 ? 'green' : 'red'}`}>≈</div>
            <div className="stat-label">Resultado Global</div>
            <div className="stat-value">{fmt.currency(data.resultado)}</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple">🏦</div>
            <div className="stat-label">Saldo em Portadores</div>
            <div className="stat-value" style={{ color: data.portadoresTotal >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt.currency(data.portadoresTotal)}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 20 }}>
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>Ranking de Empresas no Mês</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Atividade</th>
                    <th style={{ textAlign: 'right' }}>Receitas</th>
                    <th style={{ textAlign: 'right' }}>Despesas</th>
                    <th style={{ textAlign: 'right' }}>Resultado</th>
                    <th>Registros</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porEmpresa.map(item => (
                    <tr key={item.empresa.id}>
                      <td style={{ fontWeight: 600 }}>{item.empresa.nomeFantasia || item.empresa.razaoSocial}</td>
                      <td>{item.empresa.atividade || '-'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{fmt.currency(item.receitas)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--red)', fontWeight: 600 }}>{fmt.currency(item.despesas)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: item.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt.currency(item.saldo)}</td>
                      <td>{item.registros}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>Carteira por Atividade</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(data.atividades).map(([atividade, total]) => (
                <div key={atividade} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span>{atividade}</span>
                  <strong>{total}</strong>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Endividamento global em aberto</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#b45309', marginTop: 4 }}>{fmt.currency(data.dividaTotal)}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
