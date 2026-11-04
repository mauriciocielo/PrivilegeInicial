'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Building2, Search, Plus, Upload, Download, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { lerJsonResposta } from '../lib/nfe/resposta-cliente';

interface Props {
  onFechar: () => void;
  onEmpresaCadastrada: () => void;
}

export default function CadastrarCnpjModal({ onFechar, onEmpresaCadastrada }: Props) {
  const [modo, setModo] = useState<'individual' | 'lote'>('individual');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [buscandoReceita, setBuscandoReceita] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Lote
  const [textoLote, setTextoLote] = useState('');
  const [resultadoLote, setResultadoLote] = useState<{ totalProcessadas?: number; totalErros?: number; erros?: any[] } | null>(null);

  // Consulta individual de dados da Receita
  const handleBuscarReceita = async () => {
    const limpo = cnpj.replace(/\D/g, '');
    if (limpo.length !== 14) {
      toast.warning('Digite um CNPJ válido com 14 dígitos.');
      return;
    }

    setBuscandoReceita(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`);
      if (!res.ok) throw new Error('Não foi possível obter dados automáticos da Receita.');
      const data = await res.json();
      setRazaoSocial((data.razao_social || data.nome || '').toUpperCase());
      setNomeFantasia((data.nome_fantasia || data.fantasia || data.razao_social || '').toUpperCase());
      toast.success('Dados da empresa localizados na Receita Federal!');
    } catch (e: any) {
      toast.info('Preencha a Razão Social manualmente caso a consulta pública esteja lenta.');
    } finally {
      setBuscandoReceita(false);
    }
  };

  // Salvar Individual
  const handleSalvarIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    const limpo = cnpj.replace(/\D/g, '');
    if (limpo.length !== 14) {
      toast.warning('Informe um CNPJ válido com 14 dígitos.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/empresas/cadastrar-cnpj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj: limpo, razaoSocial, nomeFantasia }),
      });
      const data = await lerJsonResposta(res);
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar CNPJ.');

      toast.success(data.mensagem || 'Empresa cadastrada com sucesso na base de dados!');
      onEmpresaCadastrada();
      onFechar();
    } catch (err: any) {
      toast.error(err.message || 'Falha ao salvar CNPJ na base.');
    } finally {
      setSalvando(false);
    }
  };

  // Salvar em Lote
  const handleSalvarLote = async () => {
    const linhas = textoLote.split(/[\n,;]+/).map(s => s.trim().replace(/\D/g, '')).filter(s => s.length === 14);
    if (linhas.length === 0) {
      toast.warning('Nenhum CNPJ válido com 14 dígitos encontrado no texto colado.');
      return;
    }

    setSalvando(true);
    setResultadoLote(null);
    try {
      const res = await fetch('/api/empresas/cadastrar-cnpj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpjs: linhas }),
      });
      const data = await lerJsonResposta(res);
      if (!res.ok) throw new Error(data.error || 'Erro ao importar lote de CNPJs.');

      setResultadoLote(data);
      toast.success(data.mensagem || `${data.totalProcessadas} CNPJs processados com sucesso!`);
      onEmpresaCadastrada();
    } catch (err: any) {
      toast.error(err.message || 'Falha ao importar lote.');
    } finally {
      setSalvando(false);
    }
  };

  // Baixar Backup da Base
  const handleBaixarBackup = async () => {
    try {
      const res = await fetch('/api/empresas/cadastrar-cnpj');
      if (!res.ok) throw new Error('Falha ao gerar backup.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-empresas-cnpjs-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Backup da base de dados de empresas baixado com sucesso!');
    } catch (e: any) {
      toast.error('Erro ao baixar backup.');
    }
  };

  return (
    <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 9999 }}>
      <div className="modal" style={{ maxWidth: 600, width: '95%', background: '#ffffff', borderRadius: 12, padding: 0, overflow: 'hidden' }}>
        {/* Topo */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={20} color="#2563eb" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Cadastrar CNPJs para Monitoramento & Emissão
            </h2>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onFechar}
            disabled={salvando}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        {/* Abas Modo */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#fafafa', padding: '0 24px' }}>
          <button
            type="button"
            onClick={() => setModo('individual')}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: modo === 'individual' ? 700 : 500,
              color: modo === 'individual' ? '#2563eb' : '#64748b',
              borderBottom: modo === 'individual' ? '2px solid #2563eb' : '2px solid transparent',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            + Cadastrar 1 CNPJ
          </button>
          <button
            type="button"
            onClick={() => setModo('lote')}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: modo === 'lote' ? 700 : 500,
              color: modo === 'lote' ? '#2563eb' : '#64748b',
              borderBottom: modo === 'lote' ? '2px solid #2563eb' : '2px solid transparent',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            📋 Importar Vários CNPJs em Lote
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{ padding: 24 }}>
          {modo === 'individual' ? (
            <form onSubmit={handleSalvarIndividual} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                  CNPJ da Empresa *
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    required
                    style={{ flex: 1, padding: '9px 12px', fontSize: 14, border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={handleBuscarReceita}
                    disabled={buscandoReceita}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, whiteSpace: 'nowrap' }}
                  >
                    <Search size={13} /> {buscandoReceita ? 'Consultando...' : 'Buscar na Receita'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Razão Social (preenchida automaticamente ou manual) *
                </label>
                <input
                  type="text"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="RAZÃO SOCIAL DA EMPRESA"
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Nome Fantasia (opcional)
                </label>
                <input
                  type="text"
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  placeholder="NOME FANTASIA"
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none' }}
                />
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#166534', lineHeight: 1.45 }}>
                ✓ O CNPJ será gravado permanentemente no banco PostgreSQL.<br />
                ✓ Já habilita o monitoramento SEFAZ e a emissão de NFS-e Nacional com a Procuração do Escritório.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={onFechar} className="btn btn-secondary" disabled={salvando}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="btn btn-primary"
                  style={{ background: '#1d4ed8', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={15} /> {salvando ? 'Salvando...' : 'Salvar Empresa'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Cole a lista de CNPJs (um por linha ou separados por vírgula):
                </label>
                <textarea
                  value={textoLote}
                  onChange={(e) => setTextoLote(e.target.value)}
                  placeholder="03.098.741/0001-45&#10;40.769.006/0001-42&#10;50.168.148/0001-08"
                  rows={6}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ fontSize: 12, color: '#64748b' }}>
                O sistema fará a validação dos 14 dígitos e cadastrará cada empresa no banco de dados automaticamente.
              </div>

              {resultadoLote && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: 12 }}>
                  <strong style={{ color: '#0f172a' }}>Resultado:</strong> {resultadoLote.totalProcessadas} CNPJ(s) processados com sucesso.
                  {resultadoLote.totalErros! > 0 && (
                    <div style={{ color: '#b91c1c', marginTop: 4 }}>
                      {resultadoLote.totalErros} CNPJ(s) inválidos ignorados.
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={onFechar} className="btn btn-secondary" disabled={salvando}>
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarLote}
                  disabled={salvando || !textoLote.trim()}
                  className="btn btn-primary"
                  style={{ background: '#1d4ed8', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Upload size={14} /> {salvando ? 'Processando Lote...' : 'Processar & Cadastrar Lote'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Download de Backup */}
        <div style={{ background: '#f8fafc', borderTop: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
          <span>Proteção contra perda de dados</span>
          <button
            type="button"
            onClick={handleBaixarBackup}
            style={{ background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#334155', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <Download size={13} /> Baixar Backup da Carteira (JSON)
          </button>
        </div>
      </div>
    </div>
  );
}

