'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { TIPO_EMPRESA_SO_EMISSOR, extrairCnpjs, formatarCnpj } from '../lib/nfse/emissor';
import NfseAcessoClienteModal from './NfseAcessoClienteModal';

type StatusProcuracao = 'ativa' | 'sem_procuracao' | 'indeterminada';

export interface EmpresaEmissora {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  tipo: string;
  usuariosCliente?: Array<{ id: string; name: string; email: string }>;
  nfseConfig: {
    ambiente: string;
    usarProcuracao: boolean;
    codigoMunicipio: string | null;
    procuracaoStatus: StatusProcuracao | null;
    procuracaoMensagem: string | null;
    procuracaoVerificadaEm: string | null;
    dadosImportadosEm: string | null;
    servicosConhecidos: unknown[] | null;
  } | null;
}

interface ResultadoImportacao {
  cnpj: string;
  ok: boolean;
  texto: string;
}

function descreverImportacao(cnpj: string, r: Record<string, unknown>): ResultadoImportacao {
  const doc = formatarCnpj(cnpj);
  if (r.status === 'sem_procuracao') return { cnpj, ok: false, texto: `${doc}: sem procuração para o certificado do contador. Nada foi criado.` };
  if (r.status !== 'ativa') return { cnpj, ok: false, texto: `${doc}: não foi possível confirmar agora. ${r.mensagem || ''}` };
  const notas = Number(r.notasEmitidas) || 0;
  const partes = [notas > 0 ? `${notas} nota(s) lida(s), ${r.servicos} serviço(s)` : 'nenhuma nota emitida: informe o código do serviço na nota'];
  if (r.parcial) partes.push('leitura parcial');
  if (r.faltaMunicipio) partes.push('falta o código IBGE');
  return { cnpj, ok: true, texto: `${doc}: procuração confirmada. ${partes.join('; ')}.` };
}

interface CertificadoEscritorio {
  titular: string;
  documento: string | null;
  nomeArquivo: string | null;
  validoAte: string;
}

function lerArquivoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',')[1] || '');
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.readAsDataURL(arquivo);
  });
}

const PAUSA_ENTRE_CONSULTAS_MS = 1000; // o ADN limita a taxa (HTTP 429)

const ORDEM_STATUS: Record<string, number> = { ativa: 0, indeterminada: 1, nao_verificada: 2, sem_procuracao: 3 };

function badgeStatus(status: StatusProcuracao | null | undefined) {
  if (status === 'ativa') return <span className="badge badge-green">Procuração ativa</span>;
  if (status === 'sem_procuracao') return <span className="badge badge-red">Sem procuração</span>;
  if (status === 'indeterminada') return <span className="badge badge-yellow">Não confirmada</span>;
  return <span className="badge" style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--text-muted)' }}>Não verificada</span>;
}

interface Props {
  empresaAtualId: string;
  onFechar: () => void;
  onSelecionar: (empresa: EmpresaEmissora) => void;
  /** Avisa a tela de que o certificado do contador mudou. */
  onCertificadoAlterado: () => void;
}

export default function NfseEmissoresModal({ empresaAtualId, onFechar, onSelecionar, onCertificadoAlterado }: Props) {
  const [empresas, setEmpresas] = useState<EmpresaEmissora[] | null>(null);
  const [certificado, setCertificado] = useState<CertificadoEscritorio | null>(null);
  const [podeAlterar, setPodeAlterar] = useState(false);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [soAtivas, setSoAtivas] = useState(true);
  const [textoCnpjs, setTextoCnpjs] = useState('');
  const [resultados, setResultados] = useState<ResultadoImportacao[]>([]);
  const [progressoImportacao, setProgressoImportacao] = useState<{ feitas: number; total: number } | null>(null);
  const [verificando, setVerificando] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [empresaAcessoModal, setEmpresaAcessoModal] = useState<EmpresaEmissora | null>(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const res = await fetch('/api/nfse/emissores');
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) { setErro(dados.error || 'Não foi possível carregar as empresas.'); return; }
      setEmpresas(dados.empresas);
      setCertificado(dados.certificado);
      setPodeAlterar(!!dados.podeAlterarCertificado);
    } catch {
      setErro('Sem conexão com o servidor.');
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const certVencido = !!certificado && new Date(certificado.validoAte).getTime() < Date.now();

  const salvarCertificado = async () => {
    if (!arquivo || !senha) { toast.error('Selecione o arquivo e informe a senha.'); return; }
    setSalvando(true);
    try {
      const res = await fetch('/api/nfse/emissores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pfxBase64: await lerArquivoBase64(arquivo), senha, nomeArquivo: arquivo.name }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(dados.error || 'Erro ao salvar o certificado.'); return; }
      setArquivo(null);
      setSenha('');
      toast.success('Certificado do contador salvo. Verifique as procurações.');
      onCertificadoAlterado();
      await carregar();
    } catch {
      toast.error('Erro de conexão ao salvar o certificado.');
    } finally {
      setSalvando(false);
    }
  };

  /** Devolve false se a falha for geral (ex.: sem certificado) e não adiantar seguir para as demais. */
  const verificar = async (empresaId: string): Promise<boolean> => {
    setVerificando(empresaId);
    try {
      const res = await fetch(`/api/nfse/emissores/${empresaId}/verificar`, { method: 'POST' });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(dados.error || 'Não foi possível verificar a procuração.'); return false; }
      setEmpresas(lista => (lista || []).map(e => e.id === empresaId
        ? { ...e, nfseConfig: { ambiente: 'homologacao', usarProcuracao: true, codigoMunicipio: null, ...e.nfseConfig, ...dados } }
        : e));
      return true;
    } catch {
      toast.error('Sem conexão com o servidor.');
      return false;
    } finally {
      setVerificando(null);
    }
  };

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const digitos = termo.replace(/\D/g, '');
    return (empresas || [])
      .filter(e => !soAtivas || e.nfseConfig?.procuracaoStatus === 'ativa')
      .filter(e => !termo
        || e.razaoSocial.toLowerCase().includes(termo)
        || e.nomeFantasia.toLowerCase().includes(termo)
        || (!!digitos && e.cnpj.replace(/\D/g, '').includes(digitos)))
      .sort((a, b) => ORDEM_STATUS[a.nfseConfig?.procuracaoStatus || 'nao_verificada'] - ORDEM_STATUS[b.nfseConfig?.procuracaoStatus || 'nao_verificada']
        || a.razaoSocial.localeCompare(b.razaoSocial));
  }, [empresas, busca, soAtivas]);

  const verificarTodas = async () => {
    const fila = [...visiveis];
    setProgresso({ feitas: 0, total: fila.length });
    for (let i = 0; i < fila.length; i++) {
      if (!(await verificar(fila[i].id))) break;
      setProgresso({ feitas: i + 1, total: fila.length });
      if (i < fila.length - 1) await new Promise(r => setTimeout(r, PAUSA_ENTRE_CONSULTAS_MS));
    }
    setProgresso(null);
  };

  const cnpjsColados = useMemo(() => extrairCnpjs(textoCnpjs), [textoCnpjs]);

  const buscarEmpresas = async () => {
    const fila = cnpjsColados.validos;
    setResultados([]);
    setProgressoImportacao({ feitas: 0, total: fila.length });
    for (let i = 0; i < fila.length; i++) {
      try {
        const res = await fetch('/api/nfse/emissores/importar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cnpj: fila[i] }),
        });
        const dados = await res.json().catch(() => ({}));
        if (!res.ok) {
          // Falha geral (certificado, chave, permissão): repetir só geraria o mesmo erro.
          toast.error(dados.error || 'Não foi possível consultar a empresa.');
          break;
        }
        setResultados(atual => [...atual, descreverImportacao(fila[i], dados)]);
      } catch {
        toast.error('Sem conexão com o servidor.');
        break;
      }
      setProgressoImportacao({ feitas: i + 1, total: fila.length });
      if (i < fila.length - 1) await new Promise(r => setTimeout(r, PAUSA_ENTRE_CONSULTAS_MS));
    }
    setProgressoImportacao(null);
    setTextoCnpjs('');
    setSoAtivas(true);
    await carregar();
  };

  const ocupado = !!progresso || !!verificando || !!progressoImportacao;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !ocupado && onFechar()}>
      <div className="modal modal-lg" style={{ maxWidth: 900, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">🏢 Emissores por procuração</h2>
          <button className="modal-close" onClick={onFechar} disabled={ocupado}>✕</button>
        </div>

        <div style={{ background: 'var(--bg-card2)', borderRadius: 8, padding: 14, marginBottom: 16, border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>🔐 Certificado do contador</div>
          {certificado ? (
            <div style={{ fontSize: 13, marginBottom: podeAlterar ? 10 : 0 }}>
              <strong>{certificado.titular}</strong><br />
              <span style={{ color: certVencido ? 'var(--red)' : 'var(--text-muted)' }}>
                {certVencido ? 'Vencido em' : 'Válido até'} {new Date(certificado.validoAte).toLocaleDateString('pt-BR')}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 13, marginBottom: 10 }}>Nenhum certificado enviado.</div>
          )}
          {podeAlterar ? (
            <div className="form-row" style={{ alignItems: 'flex-end' }}>
              <div className="form-group">
                <label className="form-label">{certificado ? 'Substituir (.pfx)' : 'Arquivo (.pfx) *'}</label>
                <input type="file" accept=".pfx,.p12" style={{ fontSize: 12 }} onChange={e => setArquivo(e.target.files?.[0] || null)} />
              </div>
              <div className="form-group">
                <label className="form-label">Senha</label>
                <input type="password" className="form-control" autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} disabled={!arquivo} />
              </div>
              <button className="btn btn-primary" onClick={salvarCertificado} disabled={!arquivo || salvando}>
                {salvando ? '⏳ Salvando...' : '✓ Salvar'}
              </button>
            </div>
          ) : !certificado && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Peça a um administrador para enviar o certificado.</div>
          )}
        </div>

        {podeAlterar && (
          <div style={{ background: 'var(--bg-card2)', borderRadius: 8, padding: 14, marginBottom: 16, border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>📥 Buscar empresas com procuração</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              Nenhuma API oficial lista quem outorgou procuração. Cole os CNPJs da aba <strong>Recebidas</strong> em Minhas Autorizações de Acesso (Portal de Serviços da Receita). O sistema confirma cada procuração e preenche município, regime e serviços pelas notas já emitidas, sem cadastrar a empresa como cliente.
            </div>
            <textarea className="form-control" rows={3} style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
              placeholder="Cole aqui os CNPJs, em qualquer formato..." value={textoCnpjs} onChange={e => setTextoCnpjs(e.target.value)} disabled={!!progressoImportacao} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {cnpjsColados.validos.length} CNPJ(s) válido(s)
                {cnpjsColados.invalidos.length > 0 && <span style={{ color: 'var(--red)' }}> · inválidos: {cnpjsColados.invalidos.join(', ')}</span>}
              </span>
              <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={buscarEmpresas} disabled={ocupado || cnpjsColados.validos.length === 0 || !certificado || certVencido}>
                {progressoImportacao ? `⏳ Consultando ${Math.min(progressoImportacao.feitas + 1, progressoImportacao.total)} de ${progressoImportacao.total}...` : '🔍 Buscar'}
              </button>
            </div>
            {resultados.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, maxHeight: 130, overflowY: 'auto' }}>
                {resultados.map(r => (
                  <div key={r.cnpj} style={{ color: r.ok ? 'var(--green)' : 'var(--red)', marginBottom: 2 }}>{r.ok ? '✓' : '✕'} {r.texto}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {erro && <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>{erro}</div>}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <span>🔍</span>
            <input placeholder="Buscar por nome ou CNPJ..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={soAtivas} onChange={e => setSoAtivas(e.target.checked)} />
            Só com procuração ativa
          </label>
          <button className="btn btn-secondary" onClick={verificarTodas} disabled={ocupado || !certificado || certVencido || visiveis.length === 0}>
            {progresso ? `⏳ Verificando ${progresso.feitas + 1} de ${progresso.total}...` : `🔄 Verificar ${visiveis.length} empresa(s)`}
          </button>
        </div>

        <div className="table-wrap" style={{ maxHeight: 380, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>CNPJ</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {empresas === null ? (
                <tr><td colSpan={4} style={{ fontSize: 13 }}>{erro ? '—' : '⏳ Carregando...'}</td></tr>
              ) : visiveis.length === 0 ? (
                <tr><td colSpan={4} style={{ fontSize: 13 }}>{soAtivas ? 'Nenhuma empresa com procuração confirmada ainda. Cole os CNPJs acima ou desmarque o filtro para verificar o cadastro.' : 'Nenhuma empresa encontrada.'}</td></tr>
              ) : visiveis.map(e => {
                const c = e.nfseConfig;
                return (
                  <tr key={e.id} style={{ background: e.id === empresaAtualId ? 'rgba(99,102,241,0.08)' : undefined }}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{e.nomeFantasia || e.razaoSocial}</div>
                      {c?.usarProcuracao === false && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Emite com certificado próprio</div>}
                      {e.tipo === TIPO_EMPRESA_SO_EMISSOR && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Só emissor, não é cliente</div>}
                      {!!c?.dadosImportadosEm && (
                        <div style={{ fontSize: 11, color: c.codigoMunicipio ? 'var(--text-muted)' : 'var(--red)' }}>
                          {c.codigoMunicipio ? `IBGE ${c.codigoMunicipio}` : 'Falta o código IBGE'} · {(c.servicosConhecidos || []).length} serviço(s)
                        </div>
                      )}
                      {(e.usuariosCliente?.length || 0) > 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>
                          👤 Login cliente: {e.usuariosCliente!.map(u => u.email).join(', ')}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          👤 Sem login de cliente criado
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{e.cnpj}</td>
                    <td>
                      {badgeStatus(c?.procuracaoStatus)}
                      {c?.procuracaoVerificadaEm && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                          Verificada em {new Date(c.procuracaoVerificadaEm).toLocaleString('pt-BR')}
                        </div>
                      )}
                      {c?.procuracaoStatus === 'indeterminada' && c.procuracaoMensagem && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, maxWidth: 260 }}>{c.procuracaoMensagem}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '4px 8px' }}
                          onClick={() => verificar(e.id)} disabled={ocupado || !certificado || certVencido}>
                          {verificando === e.id ? '⏳' : '🔄'} Verificar
                        </button>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '4px 8px' }}
                          onClick={() => setEmpresaAcessoModal(e)} disabled={ocupado}
                          title="Criar ou gerenciar o login para o cliente emitir NFS-e desta empresa">
                          🔑 Login Cliente {(e.usuariosCliente?.length || 0) > 0 ? `(${e.usuariosCliente!.length})` : ''}
                        </button>
                        <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '4px 8px' }}
                          onClick={() => onSelecionar(e)} disabled={ocupado || e.id === empresaAtualId}>
                          {e.id === empresaAtualId ? 'Emissor atual' : 'Emitir por esta'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {empresaAcessoModal && (
        <NfseAcessoClienteModal
          empresa={{
            id: empresaAcessoModal.id,
            razaoSocial: empresaAcessoModal.razaoSocial,
            nomeFantasia: empresaAcessoModal.nomeFantasia,
            cnpj: empresaAcessoModal.cnpj,
            procuracaoStatus: empresaAcessoModal.nfseConfig?.procuracaoStatus ?? null,
          }}
          onFechar={() => setEmpresaAcessoModal(null)}
          onAtualizado={() => carregar()}
        />
      )}
    </div>
  );
}
