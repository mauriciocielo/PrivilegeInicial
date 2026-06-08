'use client';
import { useEffect, useState } from 'react';
import { logisticaStore, Veiculo, GastoLogistica, OrcamentoFrota } from '@/lib/logisticaStore';

export default function LogisticaDashboardPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [gastos, setGastos] = useState<GastoLogistica[]>([]);
  const [orcamentos, setOrcamentos] = useState<OrcamentoFrota[]>([]);

  useEffect(() => {
    const eid = sessionStorage.getItem('cf_empresa_sel') || '';
    setEmpresaId(eid);

    const load = () => {
      if (!eid) return;
      setVeiculos(logisticaStore.getVeiculos(eid));
      setGastos(logisticaStore.getGastos(eid));
      setOrcamentos(logisticaStore.getOrcamentos(eid));
    };

    load();
    window.addEventListener('cfDataChange', load);
    window.addEventListener('empresaChange', (e: Event) => {
      const newId = (e as CustomEvent).detail;
      setEmpresaId(newId);
      setVeiculos(logisticaStore.getVeiculos(newId));
      setGastos(logisticaStore.getGastos(newId));
      setOrcamentos(logisticaStore.getOrcamentos(newId));
    });
    return () => {
      window.removeEventListener('cfDataChange', load);
    };
  }, []);

  const totalGastos = gastos.reduce((acc, g) => acc + g.valorTotal, 0);
  const totalCombustivel = gastos.filter(g => g.categoria === 'Combustível').reduce((acc, g) => acc + g.valorTotal, 0);
  const totalManutencao = gastos.filter(g => g.categoria === 'Manutenção').reduce((acc, g) => acc + g.valorTotal, 0);

  // Calcula custo por veículo
  const custoPorVeiculo = veiculos.map(v => {
    const gastosV = gastos.filter(g => g.veiculoId === v.id);
    return {
      placa: v.placa,
      modelo: v.modelo,
      total: gastosV.reduce((acc, g) => acc + g.valorTotal, 0)
    };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="page-container" style={{ padding: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Dashboard de Frota</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 30 }}>
        <div style={{ padding: 20, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total Gasto (Geral)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red)' }}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGastos)}
          </div>
        </div>
        <div style={{ padding: 20, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Combustível</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCombustivel)}
          </div>
        </div>
        <div style={{ padding: 20, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Manutenção</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalManutencao)}
          </div>
        </div>
        <div style={{ padding: 20, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Veículos Ativos</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{veiculos.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Top Gastos por Veículo</h3>
          {custoPorVeiculo.slice(0, 5).map(v => (
            <div key={v.placa} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span>{v.modelo} ({v.placa})</span>
              <span style={{ fontWeight: 600 }}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.total)}</span>
            </div>
          ))}
          {custoPorVeiculo.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Sem gastos registrados.</div>}
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Alerta de Orçamento (Mês Atual)</h3>
          {veiculos.map(v => {
            const mesAtual = new Date().toISOString().slice(0, 7);
            const orc = orcamentos.find(o => o.veiculoId === v.id && o.mes === mesAtual);
            if (!orc) return null;

            const gastosMes = gastos.filter(g => g.veiculoId === v.id && g.data.startsWith(mesAtual)).reduce((acc, g) => acc + g.valorTotal, 0);
            const pct = orc.limiteGasto > 0 ? (gastosMes / orc.limiteGasto) * 100 : 0;
            const isWarning = pct >= 80;

            return (
              <div key={v.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{v.placa}</span>
                  <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(gastosMes)} / {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orc.limiteGasto)}</span>
                </div>
                <div style={{ width: '100%', height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: \`\${Math.min(pct, 100)}%\`, background: isWarning ? 'var(--red)' : 'var(--green)', borderRadius: 4 }}></div>
                </div>
              </div>
            );
          })}
          {orcamentos.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Nenhum orçamento definido para o mês atual.</div>}
        </div>
      </div>
    </div>
  );
}
