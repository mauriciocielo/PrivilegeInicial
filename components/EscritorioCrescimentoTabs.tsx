'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  Gift,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '../lib/reports';

interface RaioXResultado {
  prospect: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string;
    situacao: string;
    porte: string;
    cnaePrincipal: string;
    municipio: string;
    optanteSimples: boolean;
    optanteMei: boolean;
    capitalSocial: number;
  };
  simulacao: {
    faturamentoMensal: number;
    rbt12Projetado: number;
    folhaMensal: number;
    folhaIdeal28: number;
    fatorRAtual: number;
    economiaMensalFatorR: number;
    economiaAnualFatorR: number;
  };
  oportunidades: string[];
}

export function RaioXProspectTab() {
  const [cnpj, setCnpj] = useState('');
  const [faturamentoMensal, setFaturamentoMensal] = useState('25000');
  const [folhaMensal, setFolhaMensal] = useState('1518');
  const [analisando, setAnalisando] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const [resultado, setResultado] = useState<RaioXResultado | null>(null);

  const handleAnalisar = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalisando(true);
    try {
      const res = await fetch('/api/escritorio/raio-x-prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj,
          faturamentoMensal: Number(faturamentoMensal) || 0,
          folhaMensal: Number(folhaMensal) || 0,
          formato: 'json',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível consultar este CNPJ.');
        return;
      }
      setResultado(data);
      toast.success('Raio-X Fiscal gerado com sucesso!');
    } catch {
      toast.error('Erro de conexão ao consultar CNPJ.');
    } finally {
      setAnalisando(false);
    }
  };

  const handleBaixarPdf = async () => {
    setBaixandoPdf(true);
    try {
      const res = await fetch('/api/escritorio/raio-x-prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj,
          faturamentoMensal: Number(faturamentoMensal) || 0,
          folhaMensal: Number(folhaMensal) || 0,
          formato: 'pdf',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Erro ao gerar PDF.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RaioX_Fiscal_${cnpj.replace(/\D/g, '')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF Comercial White-Label baixado!');
    } catch {
      toast.error('Erro ao baixar PDF.');
    } finally {
      setBaixandoPdf(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="var(--accent, #600000)" />
            Raio-X Fiscal do Prospect (Máquina de Vendas)
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#6b7280' }}>
            Digite o CNPJ de um potencial cliente para gerar em segundos um diagnóstico tributário (Fator R 28%, teto MEI/Simples, Reforma Tributária) com a <strong>logo e cores do seu escritório</strong> para apresentar na reunião comercial.
          </p>
        </div>

        <form onSubmit={handleAnalisar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>CNPJ do Prospect</label>
            <input
              className="form-control"
              required
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0001-00"
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Faturamento Mensal Estimado (R$)</label>
            <input
              type="number"
              className="form-control"
              min={0}
              step="100"
              value={faturamentoMensal}
              onChange={(e) => setFaturamentoMensal(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Folha / Pró-labore Atual (R$)</label>
            <input
              type="number"
              className="form-control"
              min={0}
              step="100"
              value={folhaMensal}
              onChange={(e) => setFolhaMensal(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn"
            disabled={analisando}
            style={{
              background: 'var(--accent, #600000)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              height: 40,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Search size={15} />
            {analisando ? 'Consultando Receita...' : 'Gerar Raio-X'}
          </button>
        </form>
      </div>

      {resultado && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
                {resultado.prospect.cnpj} · {resultado.prospect.situacao} · {resultado.prospect.municipio}
              </div>
              <h3 style={{ margin: '4px 0 2px', fontSize: 20, fontWeight: 800, color: '#111827' }}>
                {resultado.prospect.nomeFantasia}
              </h3>
              <div style={{ fontSize: 13, color: '#4b5563' }}>
                {resultado.prospect.razaoSocial} · <strong>{resultado.prospect.cnaePrincipal}</strong>
              </div>
            </div>

            <button
              type="button"
              className="btn"
              onClick={handleBaixarPdf}
              disabled={baixandoPdf}
              style={{
                background: '#15803d',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Download size={15} />
              {baixandoPdf ? 'Gerando PDF...' : 'Baixar PDF Comercial White-Label'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Faturamento Anual (Proj.)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                {fmt.currency(resultado.simulacao.rbt12Projetado)}
              </div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Pró-Labore Ideal (Fator R 28%)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                {fmt.currency(resultado.simulacao.folhaIdeal28)}/mês
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Fator R atual: {resultado.simulacao.fatorRAtual}%</div>
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#166534', fontWeight: 700 }}>Economia Estimada (Anexo V → III)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d', marginTop: 4 }}>
                {fmt.currency(resultado.simulacao.economiaAnualFatorR)}/ano
              </div>
              <div style={{ fontSize: 11.5, color: '#166534', marginTop: 2 }}>
                ~{fmt.currency(resultado.simulacao.economiaMensalFatorR)}/mês
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={15} color="var(--accent, #600000)" />
              Argumentos Consultivos para a Reunião de Fechamento
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5, color: '#374151', lineHeight: 1.5 }}>
              {resultado.oportunidades.map((op, idx) => (
                <li key={idx}>{op}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

interface IndicacaoItem {
  id: string;
  escritorioNome: string;
  indicadoNome: string;
  indicadoEscritorio: string;
  indicadoWhatsapp: string;
  indicadoEmail: string;
  status: string;
  descontoMensal: number;
  createdAt: string;
}

export function IndiqueContadorTab() {
  const [carregando, setCarregando] = useState(true);
  const [ehAdminGeral, setEhAdminGeral] = useState(false);
  const [codigoRef, setCodigoRef] = useState('');
  const [linkIndicacao, setLinkIndicacao] = useState('');
  const [descontoPorIndicacao, setDescontoPorIndicacao] = useState(100);
  const [resumo, setResumo] = useState({ total: 0, pendentes: 0, ativas: 0, descontoMensalTotal: 0 });
  const [indicacoes, setIndicacoes] = useState<IndicacaoItem[]>([]);

  const [indicadoNome, setIndicadoNome] = useState('');
  const [indicadoEscritorio, setIndicadoEscritorio] = useState('');
  const [indicadoWhatsapp, setIndicadoWhatsapp] = useState('');
  const [indicadoEmail, setIndicadoEmail] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch('/api/escritorio/indicacoes');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEhAdminGeral(Boolean(data.ehAdminGeral));
        setCodigoRef(data.codigoRef || '');
        setLinkIndicacao(data.linkIndicacao || '');
        setDescontoPorIndicacao(Number(data.descontoPorIndicacao || 100));
        setResumo(data.resumo || { total: 0, pendentes: 0, ativas: 0, descontoMensalTotal: 0 });
        setIndicacoes(Array.isArray(data.indicacoes) ? data.indicacoes : []);
      }
    } catch {
      toast.error('Erro ao carregar indicações.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleIndicar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const res = await fetch('/api/escritorio/indicacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indicadoNome, indicadoEscritorio, indicadoWhatsapp, indicadoEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível registrar a indicação.');
        return;
      }
      toast.success('Indicação registrada! Nossa equipe comercial entrará em contato e seu bônus será creditado assim que ativar.');
      setIndicadoNome('');
      setIndicadoEscritorio('');
      setIndicadoWhatsapp('');
      setIndicadoEmail('');
      carregar();
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setEnviando(false);
    }
  };

  const handleAlterarStatus = async (id: string, status: string) => {
    try {
      const res = await fetch('/api/escritorio/indicacoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        toast.success('Status atualizado!');
        carregar();
      }
    } catch {
      toast.error('Erro ao atualizar status.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Banner + Link de Indicação */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ maxWidth: 620 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Gift size={20} color="var(--accent, #600000)" />
              Indique um Contador — Programa Mensalidade Zero
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#4b5563', lineHeight: 1.5 }}>
              A cada escritório contábil parceiro indicado que ativar a assinatura, você ganha{' '}
              <strong>{fmt.currency(descontoPorIndicacao)}/mês de desconto recorrente</strong> (acumulativo até zerar sua mensalidade!).
            </p>
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 18px', textAlign: 'right' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Seu Crédito Mensal Ativo</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d' }}>{fmt.currency(resumo.descontoMensalTotal)}/mês</div>
            <div style={{ fontSize: 12, color: '#166534' }}>{resumo.ativas} ativo(s) · {resumo.pendentes} em andamento</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <input className="form-control" readOnly value={linkIndicacao} style={{ flex: '1 1 300px', fontFamily: 'monospace', fontSize: 13 }} />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              navigator.clipboard.writeText(linkIndicacao);
              toast.success(`Link copiado! (Código: ${codigoRef})`);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Copy size={14} /> Copiar meu Link
          </button>
        </div>
      </div>

      {/* Formulário de Indicação Direta */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Indicar um Colega Contador Agora</h3>
        <form onSubmit={handleIndicar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome do Contador *</label>
            <input className="form-control" required value={indicadoNome} onChange={(e) => setIndicadoNome(e.target.value)} placeholder="Ex.: João Silva" />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome do Escritório</label>
            <input className="form-control" value={indicadoEscritorio} onChange={(e) => setIndicadoEscritorio(e.target.value)} placeholder="Ex.: Silva Contabilidade" />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>WhatsApp</label>
            <input className="form-control" value={indicadoWhatsapp} onChange={(e) => setIndicadoWhatsapp(e.target.value)} placeholder="(46) 99999-9999" />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>E-mail</label>
            <input type="email" className="form-control" value={indicadoEmail} onChange={(e) => setIndicadoEmail(e.target.value)} placeholder="contato@escritorio.com.br" />
          </div>
          <button
            type="submit"
            className="btn"
            disabled={enviando}
            style={{ background: 'var(--accent, #600000)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Plus size={15} /> {enviando ? 'Enviando...' : 'Enviar Indicação'}
          </button>
        </form>
      </div>

      {/* Lista de Indicações */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {ehAdminGeral ? 'Todas as Indicações de Parceiros' : 'Minhas Indicações'} ({indicacoes.length})
          </h3>
          <button type="button" className="btn btn-secondary" onClick={carregar} style={{ borderRadius: 8 }}>
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
          </button>
        </div>

        {indicacoes.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13.5 }}>
            Nenhuma indicação registrada ainda. Indique seu primeiro colega acima!
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  {ehAdminGeral && <th>Indicado por</th>}
                  <th>Contador / Escritório</th>
                  <th>Contato</th>
                  <th>Crédito</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {indicacoes.map((ind) => (
                  <tr key={ind.id}>
                    <td style={{ fontSize: 12.5, color: '#6b7280' }}>{new Date(ind.createdAt).toLocaleDateString('pt-BR')}</td>
                    {ehAdminGeral && <td style={{ fontWeight: 600, fontSize: 13 }}>{ind.escritorioNome}</td>}
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{ind.indicadoNome}</div>
                      {ind.indicadoEscritorio && <div style={{ fontSize: 12, color: '#6b7280' }}>{ind.indicadoEscritorio}</div>}
                    </td>
                    <td style={{ fontSize: 12.5 }}>
                      {ind.indicadoWhatsapp && <div>{ind.indicadoWhatsapp}</div>}
                      {ind.indicadoEmail && <div style={{ color: '#6b7280' }}>{ind.indicadoEmail}</div>}
                    </td>
                    <td style={{ fontWeight: 700, color: '#15803d' }}>{fmt.currency(ind.descontoMensal)}/mês</td>
                    <td>
                      {ehAdminGeral ? (
                        <select
                          className="form-control"
                          style={{ width: 'auto', fontSize: 12.5, padding: '4px 8px' }}
                          value={ind.status}
                          onChange={(e) => handleAlterarStatus(ind.id, e.target.value)}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="em_negociacao">Em negociação</option>
                          <option value="ativo">Ativo (Crédito liberado)</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      ) : (
                        <span
                          style={{
                            padding: '3px 9px',
                            borderRadius: 99,
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: ind.status === 'ativo' ? '#f0fdf4' : '#fffbeb',
                            color: ind.status === 'ativo' ? '#15803d' : '#b45309',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {ind.status === 'ativo' && <CheckCircle2 size={12} />}
                          {ind.status === 'ativo' ? 'Ativo' : ind.status === 'em_negociacao' ? 'Em negociação' : ind.status === 'cancelado' ? 'Cancelado' : 'Pendente'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
