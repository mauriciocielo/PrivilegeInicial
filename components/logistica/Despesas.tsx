'use client';
import { useEffect, useState } from 'react';
import { logisticaStore, GastoLogistica, Veiculo } from '@/lib/logisticaStore';
import { toast } from 'sonner';
import { confirmAsync } from '../ConfirmProvider';

export default function Despesas() {
  const [empresaId, setEmpresaId] = useState('');
  const [gastos, setGastos] = useState<GastoLogistica[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);

  useEffect(() => {
    const eid = sessionStorage.getItem('cf_empresa_sel') || '';
    setEmpresaId(eid);

    const load = () => {
      if (!eid) return;
      setGastos(logisticaStore.getGastos(eid));
      setVeiculos(logisticaStore.getVeiculos(eid));
    };

    load();
    window.addEventListener('cfDataChange', load);
    window.addEventListener('empresaChange', (e: Event) => {
      const newId = (e as CustomEvent).detail;
      setEmpresaId(newId);
      setGastos(logisticaStore.getGastos(newId));
      setVeiculos(logisticaStore.getVeiculos(newId));
    });
    return () => window.removeEventListener('cfDataChange', load);
  }, []);

  const handleAddGasto = () => {
    if (veiculos.length === 0) return toast.error('Cadastre um veículo primeiro!');
    const v = veiculos[0].id; // Simplificado
    const val = prompt('Valor do gasto (ex: 150.50):');
    if (!val) return;
    const cat = prompt('Categoria (Combustível, Manutenção, Pedágio):') || 'Outros';

    logisticaStore.saveGasto({
      id: 'g_' + Date.now(),
      empresaId,
      veiculoId: v,
      data: new Date().toISOString().split('T')[0],
      categoria: cat as any,
      kmAtual: 0,
      valorTotal: parseFloat(val.replace(',','.')),
      descricao: 'Lançamento Manual',
      createdAt: new Date().toISOString()
    });
  };

  const handleDelete = async (id: string) => {
    if((await confirmAsync('Tem certeza?'))) logisticaStore.deleteGasto(id);
  };

  return (
    <div className="page-container" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Controle de Gastos da Frota</h1>
        <button className="btn btn-primary" onClick={handleAddGasto}>+ Lançar Gasto</button>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--border-light)', fontSize: 12, textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 16px' }}>Data</th>
              <th style={{ padding: '12px 16px' }}>Veículo</th>
              <th style={{ padding: '12px 16px' }}>Categoria</th>
              <th style={{ padding: '12px 16px' }}>Valor</th>
              <th style={{ padding: '12px 16px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {gastos.sort((a,b) => b.data.localeCompare(a.data)).map(g => (
              <tr key={g.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '12px 16px' }}>{g.data.split('-').reverse().join('/')}</td>
                <td style={{ padding: '12px 16px' }}>{veiculos.find(v => v.id === g.veiculoId)?.placa || 'N/A'}</td>
                <td style={{ padding: '12px 16px' }}>{g.categoria}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--red)' }}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(g.valorTotal)}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(g.id)}>Excluir</button>
                </td>
              </tr>
            ))}
            {gastos.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center' }}>Nenhum gasto registrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
