'use client';
import { useEffect, useState } from 'react';
import { logisticaStore, OrcamentoFrota, Veiculo } from '@/lib/logisticaStore';
import { toast } from 'sonner';
import { confirmAsync } from '../ConfirmProvider';

export default function Orcamentos() {
  const [empresaId, setEmpresaId] = useState('');
  const [orcamentos, setOrcamentos] = useState<OrcamentoFrota[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);

  useEffect(() => {
    const eid = sessionStorage.getItem('cf_empresa_sel') || '';
    setEmpresaId(eid);

    const load = () => {
      if (!eid) return;
      setOrcamentos(logisticaStore.getOrcamentos(eid));
      setVeiculos(logisticaStore.getVeiculos(eid));
    };

    load();
    window.addEventListener('cfDataChange', load);
    window.addEventListener('empresaChange', (e: Event) => {
      const newId = (e as CustomEvent).detail;
      setEmpresaId(newId);
      setOrcamentos(logisticaStore.getOrcamentos(newId));
      setVeiculos(logisticaStore.getVeiculos(newId));
    });
    return () => window.removeEventListener('cfDataChange', load);
  }, []);

  const handleAddOrcamento = () => {
    if (veiculos.length === 0) return toast.error('Cadastre um veículo primeiro!');
    const v = veiculos[0].id; // Simplificado
    const val = prompt('Limite de gasto mensal (ex: 2000):');
    if (!val) return;

    logisticaStore.saveOrcamento({
      id: 'o_' + Date.now(),
      empresaId,
      veiculoId: v,
      mes: new Date().toISOString().slice(0, 7),
      limiteGasto: parseFloat(val),
      createdAt: new Date().toISOString()
    });
  };

  const handleDelete = async (id: string) => {
    if((await confirmAsync('Tem certeza?'))) logisticaStore.deleteOrcamento(id);
  };

  return (
    <div className="page-container" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Orçamentos por Veículo</h1>
        <button className="btn btn-primary" onClick={handleAddOrcamento}>+ Definir Orçamento</button>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--border-light)', fontSize: 12, textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 16px' }}>Mês</th>
              <th style={{ padding: '12px 16px' }}>Veículo</th>
              <th style={{ padding: '12px 16px' }}>Limite de Gasto</th>
              <th style={{ padding: '12px 16px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {orcamentos.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '12px 16px' }}>{o.mes}</td>
                <td style={{ padding: '12px 16px' }}>{veiculos.find(v => v.id === o.veiculoId)?.placa || 'N/A'}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(o.limiteGasto)}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(o.id)}>Excluir</button>
                </td>
              </tr>
            ))}
            {orcamentos.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center' }}>Nenhum orçamento definido.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
