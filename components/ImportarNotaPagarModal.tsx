'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Building2, Calendar, CheckCircle2, Plus, Trash2, Wallet, X } from 'lucide-react';
import { store, type Cliente, type Lancamento, type PlanoConta, type Portador } from '../lib/store';
import { fmt } from '../lib/reports';
import { formatarCpfCnpj } from '../lib/formatar-documento';

export interface NotaParaImportarPagar {
  origem: 'nfe' | 'nfse';
  notaId: string;
  empresaId: string;
  chaveAcesso: string;
  numero: string;
  dataEmissao: string;
  valorTotal: number;
  descricaoPadrao: string;
  fornecedor: {
    cpfCnpj: string;
    nome: string;
    nomeFantasia?: string | null;
    email?: string | null;
    telefone?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
  };
}

interface Props {
  nota: NotaParaImportarPagar;
  onFechar: () => void;
  onImportado: (res: { fornecedorCriado: boolean; totalParcelas: number; chaveAcesso: string }) => void;
}

function somarDias(isoDate: string, dias: number): string {
  const base = isoDate && /^\d{4}-\d{2}-\d{2}/.test(isoDate) ? isoDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export default function ImportarNotaPagarModal({ nota, onFechar, onImportado }: Props) {
  const [mounted, setMounted] = useState(false);
  const [carregandoXml, setCarregandoXml] = useState(nota.origem === 'nfe');
  const [salvando, setSalvando] = useState(false);
  const [jaLancada, setJaLancada] = useState(false);

  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [portadores, setPortadores] = useState<Portador[]>([]);
  const [fornecedorExistente, setFornecedorExistente] = useState<Cliente | null>(null);
  const [fornecedorExtra, setFornecedorExtra] = useState<Record<string, string | null> | null>(null);

  const [descricao, setDescricao] = useState(nota.descricaoPadrao);
  const [planoContaId, setPlanoContaId] = useState('');
  const [portadorId, setPortadorId] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('Boleto');
  const [parcelas, setParcelas] = useState<Array<{ numero: string; dataVencimento: string; valor: number }>>([
    { numero: '001', dataVencimento: somarDias(nota.dataEmissao, 30), valor: Math.round(nota.valorTotal * 100) / 100 },
  ]);

  useEffect(() => {
    setMounted(true);
    const contas = store.getPlanoContas(nota.empresaId).filter(p => p.nivel === 3 && p.ativo && p.tipo === 'despesa');
    const ports = store.getPortadores(nota.empresaId).filter(p => p.ativo);
    const clis = store.getClientes(nota.empresaId);
    setPlanoContas(contas);
    setPortadores(ports);
    if (ports.length === 1) setPortadorId(ports[0].id);

    const dig = (nota.fornecedor.cpfCnpj || '').replace(/\D/g, '');
    const achado = clis.find(c => (c.cpfCnpj || '').replace(/\D/g, '') === dig) || null;
    setFornecedorExistente(achado);

    // Consulta detalhes no servidor (duplicatas do XML da NF-e + checagem de duplicidade)
    let cancelado = false;
    const qs = new URLSearchParams({
      empresaId: nota.empresaId,
      ...(nota.origem === 'nfe' ? { nfeId: nota.notaId } : {}),
      ...(nota.chaveAcesso ? { chaveAcesso: nota.chaveAcesso } : {}),
    });
    fetch(`/api/financeiro/importar-nota-pagar?${qs.toString()}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelado || !d) return;
        if (d.jaLancada) setJaLancada(true);
        if (Array.isArray(d.parcelas) && d.parcelas.length > 0) {
          setParcelas(d.parcelas);
        }
        if (d.resumoProdutos && !nota.descricaoPadrao.includes(d.resumoProdutos.slice(0, 15))) {
          setDescricao(`${nota.descricaoPadrao} — ${d.resumoProdutos.slice(0, 80)}`);
        }
        if (d.fornecedorExtra) setFornecedorExtra(d.fornecedorExtra);
      })
      .catch(() => {})
      .finally(() => { if (!cancelado) setCarregandoXml(false); });

    return () => { cancelado = true; };
  }, [nota]);

  const somaParcelas = useMemo(
    () => Math.round(parcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0) * 100) / 100,
    [parcelas]
  );

  const adicionarParcela = () => {
    const ultima = parcelas[parcelas.length - 1];
    const proxData = somarDias(ultima?.dataVencimento || nota.dataEmissao, 30);
    setParcelas(prev => [...prev, { numero: String(prev.length + 1).padStart(3, '0'), dataVencimento: proxData, valor: 0 }]);
  };

  const dividirIgual = (qtd: number) => {
    const n = Math.max(1, Math.min(24, qtd));
    const valorBase = Math.floor((nota.valorTotal / n) * 100) / 100;
    const resto = Math.round((nota.valorTotal - valorBase * n) * 100) / 100;
    const novas = Array.from({ length: n }, (_, i) => ({
      numero: String(i + 1).padStart(3, '0'),
      dataVencimento: somarDias(nota.dataEmissao, 30 * (i + 1)),
      valor: i === n - 1 ? Math.round((valorBase + resto) * 100) / 100 : valorBase,
    }));
    setParcelas(novas);
  };

  const handleConfirmar = async () => {
    const validas = parcelas.filter(p => p.dataVencimento && Number(p.valor) > 0);
    if (validas.length === 0) {
      toast.error('Informe pelo menos uma parcela com vencimento e valor maior que zero.');
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch('/api/financeiro/importar-nota-pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: nota.empresaId,
          origem: nota.origem,
          notaId: nota.notaId,
          chaveAcesso: nota.chaveAcesso,
          numeroDocumento: `${nota.origem === 'nfe' ? 'NF-e' : 'NFS-e'} ${nota.numero}`,
          dataEmissao: nota.dataEmissao,
          descricao: descricao.trim(),
          planoContaId,
          portadorId,
          formaPagamento,
          fornecedor: {
            ...nota.fornecedor,
            ...(fornecedorExtra || {}),
          },
          parcelas: validas,
        }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(dados.error || 'Erro ao lançar nota no Contas a Pagar.');
        return;
      }

      // Atualiza o store local imediatamente para refletir em Contas a Pagar e Fornecedores
      if (dados.fornecedor) {
        store.saveCliente({
          ...dados.fornecedor,
          createdAt: String(dados.fornecedor.createdAt || new Date().toISOString()),
        } as Cliente);
      }
      if (Array.isArray(dados.lancamentos)) {
        for (const l of dados.lancamentos) {
          store.saveLancamento({
            ...l,
            createdAt: String(l.createdAt || new Date().toISOString()),
          } as Lancamento);
        }
      }

      toast.success(
        `${dados.totalParcelas} título(s) lançado(s) no Contas a Pagar${dados.fornecedorCriado ? ' e fornecedor cadastrado automaticamente!' : '!'}`
      );
      onImportado({
        fornecedorCriado: Boolean(dados.fornecedorCriado),
        totalParcelas: Number(dados.totalParcelas || validas.length),
        chaveAcesso: nota.chaveAcesso,
      });
      onFechar();
    } catch {
      toast.error('Erro de conexão ao lançar no Contas a Pagar.');
    } finally {
      setSalvando(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onFechar}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(22, 163, 74, 0.12)', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>
                Importar para Contas a Pagar ({nota.origem === 'nfe' ? 'NF-e' : 'NFS-e'} nº {nota.numero})
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                Cadastra o fornecedor automaticamente e cria o título para controle financeiro
              </p>
            </div>
          </div>
          <button type="button" onClick={onFechar} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {jaLancada && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', fontSize: 13.5, fontWeight: 600 }}>
              Esta nota fiscal já possui lançamento no Contas a Pagar desta empresa.
            </div>
          )}

          {/* Fornecedor */}
          <div style={{ padding: 12, borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Building2 size={18} color="#374151" />
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: '#111827' }}>{nota.fornecedor.nome}</div>
                <div style={{ fontSize: 12.5, color: '#6b7280' }}>{formatarCpfCnpj(nota.fornecedor.cpfCnpj)}</div>
              </div>
            </div>
            {fornecedorExistente ? (
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: '#dcfce7', color: '#166534', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={13} /> Fornecedor já cadastrado
              </span>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: '#eff6ff', color: '#1d4ed8' }}>
                + Será cadastrado em Fornecedores
              </span>
            )}
          </div>

          {/* Descrição e Classificação */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Descrição no Contas a Pagar</label>
            <input className="form-control" value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Categoria (Plano de Contas)</label>
              <select className="form-control" value={planoContaId} onChange={e => setPlanoContaId(e.target.value)}>
                <option value="">-- Selecionar depois --</option>
                {planoContas.map(p => (
                  <option key={p.id} value={p.id}>{p.codigo} · {p.descricao}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Conta / Portador Previsto</label>
              <select className="form-control" value={portadorId} onChange={e => setPortadorId(e.target.value)}>
                <option value="">-- Selecionar depois --</option>
                {portadores.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Forma de Pagamento</label>
              <select className="form-control" value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}>
                <option value="Boleto">Boleto</option>
                <option value="Pix">Pix</option>
                <option value="Transferência">Transferência</option>
                <option value="Cartão">Cartão</option>
                <option value="Débito Automático">Débito Automático</option>
              </select>
            </div>
          </div>

          {/* Parcelas / Vencimentos */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={15} /> Parcelas / Vencimentos {carregandoXml && <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 400 }}>(lendo duplicatas do XML...)</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => dividirIgual(n)}
                    style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151' }}
                  >
                    {n}x
                  </button>
                ))}
                <button
                  type="button"
                  onClick={adicionarParcela}
                  style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid #600000', background: '#fff', cursor: 'pointer', color: '#600000', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                >
                  <Plus size={12} /> Parcela
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {parcelas.map((p, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 1fr 34px', gap: 8, alignItems: 'center' }}>
                  <input
                    className="form-control"
                    value={p.numero}
                    onChange={e => setParcelas(prev => prev.map((x, i) => (i === idx ? { ...x, numero: e.target.value } : x)))}
                    placeholder="001"
                  />
                  <input
                    type="date"
                    className="form-control"
                    value={p.dataVencimento}
                    onChange={e => setParcelas(prev => prev.map((x, i) => (i === idx ? { ...x, dataVencimento: e.target.value } : x)))}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={p.valor}
                    onChange={e => setParcelas(prev => prev.map((x, i) => (i === idx ? { ...x, valor: Number(e.target.value) } : x)))}
                  />
                  <button
                    type="button"
                    disabled={parcelas.length <= 1}
                    onClick={() => setParcelas(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: 'transparent', border: '1px solid #fecaca', borderRadius: 6, padding: 6, cursor: parcelas.length <= 1 ? 'not-allowed' : 'pointer', color: '#b91c1c', opacity: parcelas.length <= 1 ? 0.4 : 1 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 6, textAlign: 'right' }}>
              Valor da nota: <strong>{fmt.currency(nota.valorTotal)}</strong> · Soma das parcelas: <strong>{fmt.currency(somaParcelas)}</strong>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onFechar} className="btn btn-secondary">Cancelar</button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={salvando || jaLancada}
            className="btn"
            style={{ background: '#15803d', color: '#fff', border: 'none', fontWeight: 700, opacity: jaLancada ? 0.5 : 1 }}
          >
            {salvando ? 'Lançando...' : jaLancada ? 'Já Lançada' : 'Cadastrar Fornecedor e Lançar no Contas a Pagar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
