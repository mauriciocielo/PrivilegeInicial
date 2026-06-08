'use client';
import { useEffect, useState } from 'react';
import { logisticaStore, Veiculo, Motorista } from '@/lib/logisticaStore';

export default function VeiculosPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);

  useEffect(() => {
    const eid = sessionStorage.getItem('cf_empresa_sel') || '';
    setEmpresaId(eid);

    const load = () => {
      if (!eid) return;
      setVeiculos(logisticaStore.getVeiculos(eid));
      setMotoristas(logisticaStore.getMotoristas(eid));
    };

    load();
    window.addEventListener('cfDataChange', load);
    window.addEventListener('empresaChange', (e: Event) => {
      const newId = (e as CustomEvent).detail;
      setEmpresaId(newId);
      setVeiculos(logisticaStore.getVeiculos(newId));
      setMotoristas(logisticaStore.getMotoristas(newId));
    });
    return () => window.removeEventListener('cfDataChange', load);
  }, []);

  const handleAddVeiculo = () => {
    const placa = prompt('Placa do veículo:');
    if (!placa) return;
    const modelo = prompt('Modelo:');
    logisticaStore.saveVeiculo({
      id: 'v_' + Date.now(),
      empresaId,
      placa,
      modelo: modelo || '',
      marca: '',
      ano: 2024,
      capacidadeTanque: 50,
      status: 'ativo',
      createdAt: new Date().toISOString()
    });
  };

  const handleDelete = (id: string) => {
    if(confirm('Tem certeza?')) logisticaStore.deleteVeiculo(id);
  };

  return (
    <div className="page-container" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Veículos e Motoristas</h1>
        <button className="btn btn-primary" onClick={handleAddVeiculo}>+ Novo Veículo</button>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--border-light)', fontSize: 12, textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 16px' }}>Placa</th>
              <th style={{ padding: '12px 16px' }}>Modelo</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {veiculos.map(v => (
              <tr key={v.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{v.placa}</td>
                <td style={{ padding: '12px 16px' }}>{v.modelo}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: 4, background: v.status === 'ativo' ? 'var(--green-bg)' : 'var(--red-bg)', color: v.status === 'ativo' ? 'var(--green)' : 'var(--red)', fontSize: 12 }}>
                    {v.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(v.id)}>Excluir</button>
                </td>
              </tr>
            ))}
            {veiculos.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center' }}>Nenhum veículo cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}