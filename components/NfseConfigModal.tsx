'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { confirmAsync } from './ConfirmProvider';
import NfseServicoPicker from './NfseServicoPicker';
import NfseRegrasRetencao from './NfseRegrasRetencao';
import type { RegraRetencao } from '../lib/nfse/retencao';
import type { CnaeEmpresa } from '../lib/nfse/cnae-servicos';

export interface NfseServicoConhecido {
  cTribNac: string;
  cTribMun: string | null;
  cNbs: string | null;
  descricao: string;
  quantidade: number;
}

export interface NfseParametros {
  ambiente: 'homologacao' | 'producao';
  servicosConhecidos: NfseServicoConhecido[] | null;
  regrasRetencao: RegraRetencao[] | null;
  usarProcuracao: boolean;
  procuracaoStatus: 'ativa' | 'sem_procuracao' | 'indeterminada' | null;
  procuracaoMensagem: string | null;
  procuracaoVerificadaEm: string | null;
  codigoMunicipio: string | null;
  inscricaoMunicipal: string | null;
  opSimpNac: number;
  regApTribSN: number | null;
  regEspTrib: number;
  pTotTribSN: number | null;
  piscofinsCst: string;
  tpRetPisCofins: string | null;
  pTotTribFed: number | null;
  pTotTribEst: number | null;
  pTotTribMun: number | null;
  convenioAtivo: boolean;
  ibsCbsCIndOp: string | null;
  ibsCbsCst: string | null;
  ibsCbsCClassTrib: string | null;
  ibsCbsIndFinal: string | null;
  leiaute: string | null;
  serie: string;
  proximoNDpsHomologacao: number;
  proximoNDpsProducao: number;
  cTribNacPadrao: string | null;
  cTribMunPadrao: string | null;
  cNbsPadrao: string | null;
}

export interface NfseConfigResposta {
  parametros: NfseParametros | null;
  certificado: { nomeArquivo: string | null; titular: string | null; cnpj: string | null; validoAte: string | null } | null;
  escritorio: { titular: string; documento: string | null; validoAte: string } | null;
  cofreConfigurado: boolean;
}

const PARAMETROS_INICIAIS: NfseParametros = {
  ambiente: 'homologacao',
  servicosConhecidos: null,
  regrasRetencao: null,
  usarProcuracao: true,
  procuracaoStatus: null,
  procuracaoMensagem: null,
  procuracaoVerificadaEm: null,
  codigoMunicipio: '',
  inscricaoMunicipal: '',
  opSimpNac: 3,
  regApTribSN: 1,
  regEspTrib: 0,
  pTotTribSN: null,
  piscofinsCst: '08',
  tpRetPisCofins: '',
  pTotTribFed: null,
  pTotTribEst: null,
  pTotTribMun: null,
  convenioAtivo: true,
  ibsCbsCIndOp: '',
  ibsCbsCst: '',
  ibsCbsCClassTrib: '',
  ibsCbsIndFinal: '',
  leiaute: '',
  serie: '10',
  proximoNDpsHomologacao: 1,
  proximoNDpsProducao: 1,
  cTribNacPadrao: '',
  cTribMunPadrao: '',
  cNbsPadrao: '',
};

const secaoStyle = { background: 'var(--bg-card2)', borderRadius: 8, padding: 14, marginBottom: 16, border: '1px solid var(--border-light)' };
const tituloStyle = { fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: 0.5 };
const ajudaStyle = { fontSize: 11, color: 'var(--text-muted)', marginTop: 4 };

function lerArquivoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',')[1] || '');
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.readAsDataURL(arquivo);
  });
}

interface Props {
  empresaId: string;
  cnpj?: string;
  cnaes?: CnaeEmpresa[] | null;
  config: NfseConfigResposta | null;
  onFechar: () => void;
  onSalvo: (config: NfseConfigResposta) => void;
}

export default function NfseConfigModal({ empresaId, cnpj, cnaes, config, onFechar, onSalvo }: Props) {
  const [p, setP] = useState<NfseParametros>(config?.parametros || PARAMETROS_INICIAIS);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [buscandoSerpro, setBuscandoSerpro] = useState(false);

  const buscarAliquotaSerpro = async () => {
    if (!empresaId) return;
    setBuscandoSerpro(true);
    try {
      const res = await fetch(`/api/serpro/aliquota-simples?empresaId=${empresaId}`);
      const data = await res.json();
      if (data.sucesso && data.aliquota > 0) {
        set('pTotTribSN', data.aliquota);
        toast.success(`Alíquota do Simples Nacional obtida via Integra Contador: ${data.aliquota}% (${data.periodoApuracao || 'último PA'})`);
      } else {
        toast.error(data.error || 'Nenhuma apuração recente encontrada no SERPRO.');
      }
    } catch {
      toast.error('Erro ao consultar o Integra Contador.');
    } finally {
      setBuscandoSerpro(false);
    }
  };

  const set = <K extends keyof NfseParametros>(campo: K, valor: NfseParametros[K]) => setP(atual => ({ ...atual, [campo]: valor }));
  const num = (v: string) => (v === '' ? null : Number(v));

  // O CNPJ da empresa já é conhecido: município e regime vêm do cadastro público.
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [sincronizandoOficial, setSincronizandoOficial] = useState(false);
  const [municipioNome, setMunicipioNome] = useState('');

  const sincronizarOficial = async () => {
    setSincronizandoOficial(true);
    try {
      const res = await fetch(`/api/nfse/emissores/${empresaId}/sequencia`, { method: 'POST' });
      const dados = await res.json().catch(() => ({}));
      if (res.ok) {
        set('proximoNDpsProducao', dados.proximoNDpsProducao);
        toast.success(dados.mensagem || `Sequência sincronizada: próxima DPS ${dados.proximoNDpsProducao}!`);
      } else {
        toast.error(dados.error || 'Não foi possível consultar a base oficial.');
      }
    } catch {
      toast.error('Erro de conexão ao sincronizar com a base oficial.');
    } finally {
      setSincronizandoOficial(false);
    }
  };
  const preencherPeloCnpj = useCallback(async (avisar: boolean) => {
    if (!cnpj) return;
    setBuscandoCnpj(true);
    try {
      const res = await fetch(`/api/nfse/dados-publicos?cnpj=${encodeURIComponent(cnpj)}`);
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) { if (avisar) toast.warning(dados.error || 'Não foi possível consultar o CNPJ.'); return; }
      setP(a => ({
        ...a,
        codigoMunicipio: dados.codigoMunicipio || a.codigoMunicipio,
        opSimpNac: dados.opSimpNac ?? a.opSimpNac,
      }));
      setMunicipioNome(dados.cidade ? `${dados.cidade}${dados.uf ? `/${dados.uf}` : ''}` : '');
      if (avisar) toast.success('Município e regime preenchidos pelo CNPJ. Confira antes de salvar.');
    } catch {
      if (avisar) toast.warning('Sem conexão para consultar o CNPJ.');
    } finally {
      setBuscandoCnpj(false);
    }
  }, [cnpj]);

  const municipioVazioAoAbrir = !config?.parametros?.codigoMunicipio;
  useEffect(() => {
    if (municipioVazioAoAbrir) preencherPeloCnpj(false);
  }, [municipioVazioAoAbrir, preencherPeloCnpj]);

  const salvar = async () => {
    const enviarCertificado = !p.usarProcuracao && !!arquivo;
    if (enviarCertificado && !senha) { toast.error('Informe a senha do certificado.'); return; }
    if (p.ambiente === 'producao' && config?.parametros?.ambiente !== 'producao') {
      const confirmado = await confirmAsync('Em Produção, cada transmissão gera uma nota fiscal real, com valor jurídico e tributário. Deseja ativar?');
      if (!confirmado) return;
    }
    setSalvando(true);
    try {
      const corpo = {
        ...p,
        ...(enviarCertificado && arquivo ? { certificado: { pfxBase64: await lerArquivoBase64(arquivo), senha, nomeArquivo: arquivo.name } } : {}),
      };
      const res = await fetch(`/api/empresas/${empresaId}/nfse-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(dados.error || 'Erro ao salvar a configuração.'); return; }
      toast.success('Configuração do Emissor Nacional salva.');
      onSalvo(dados);
    } catch {
      toast.error('Erro de conexão ao salvar a configuração.');
    } finally {
      setSalvando(false);
    }
  };

  const certificado = config?.certificado;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal modal-lg" style={{ maxWidth: 760, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
          <h2 className="modal-title">⚙️ Configuração do Emissor Nacional</h2>
          <button className="modal-close" onClick={onFechar}>✕</button>
        </div>

        {config && !config.cofreConfigurado && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            O servidor ainda não tem a variável <code>NFSE_CERT_KEY</code>. Sem ela o certificado não pode ser guardado.
          </div>
        )}

        <div style={secaoStyle}>
          <div style={tituloStyle}>🔐 Certificado usado na emissão</div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <select className="form-control" value={p.usarProcuracao ? 'procuracao' : 'proprio'} onChange={e => set('usarProcuracao', e.target.value === 'procuracao')}>
              <option value="procuracao">Certificado do contador, por procuração</option>
              <option value="proprio">Certificado próprio da empresa</option>
            </select>
          </div>
          {p.usarProcuracao ? (
            <div style={{ fontSize: 13 }}>
              {config?.escritorio ? (
                <>
                  <strong>{config.escritorio.titular}</strong><br />
                  <span style={{ color: 'var(--text-muted)' }}>Válido até {new Date(config.escritorio.validoAte).toLocaleDateString('pt-BR')}</span>
                </>
              ) : 'Nenhum certificado do contador enviado. Envie em Emissores por Procuração.'}
            </div>
          ) : (
            <>
              {certificado && (
                <div style={{ fontSize: 13, marginBottom: 10 }}>
                  <strong>{certificado.titular}</strong><br />
                  <span style={{ color: 'var(--text-muted)' }}>
                    Válido até {certificado.validoAte ? new Date(certificado.validoAte).toLocaleDateString('pt-BR') : '—'}
                  </span>
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{certificado ? 'Substituir certificado (.pfx)' : 'Arquivo do certificado (.pfx) *'}</label>
                  <input type="file" accept=".pfx,.p12" style={{ fontSize: 12 }} onChange={e => setArquivo(e.target.files?.[0] || null)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Senha do certificado</label>
                  <input type="password" className="form-control" autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} disabled={!arquivo} />
                </div>
              </div>
              <div style={ajudaStyle}>O arquivo e a senha ficam cifrados no servidor e não voltam para o navegador.</div>
            </>
          )}
        </div>

        <div style={secaoStyle}>
          <div style={tituloStyle}>🏢 Prestador</div>
          {cnpj && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12, fontSize: 13 }}>
              <span>CNPJ <strong>{cnpj}</strong></span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => preencherPeloCnpj(true)} disabled={buscandoCnpj}>
                {buscandoCnpj ? 'Consultando...' : 'Preencher pelo CNPJ'}
              </button>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Ambiente</label>
              <select className="form-control" value={p.ambiente} onChange={e => set('ambiente', e.target.value as NfseParametros['ambiente'])}>
                <option value="homologacao">Produção restrita (teste, sem valor fiscal)</option>
                <option value="producao">Produção (nota real)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Município (código IBGE) *</label>
              <input className="form-control" maxLength={7} value={p.codigoMunicipio || ''} onChange={e => { setMunicipioNome(''); set('codigoMunicipio', e.target.value); }} />
              {municipioNome && <div style={ajudaStyle}>{municipioNome}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Inscrição municipal</label>
              <input className="form-control" value={p.inscricaoMunicipal || ''} onChange={e => set('inscricaoMunicipal', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Regime tributário</label>
              <select className="form-control" value={p.opSimpNac} onChange={e => set('opSimpNac', Number(e.target.value))}>
                <option value={3}>Simples Nacional (ME/EPP)</option>
                <option value={2}>MEI</option>
                <option value={1}>Regime Regular (Presumido/Real)</option>
              </select>
            </div>
            {p.opSimpNac === 3 && (
              <>
                <div className="form-group">
                  <label className="form-label">Apuração do ISS</label>
                  <select className="form-control" value={p.regApTribSN ?? 1} onChange={e => set('regApTribSN', Number(e.target.value))}>
                    <option value={1}>Pelo Simples Nacional</option>
                    <option value={2}>Federais pelo SN, ISS fora</option>
                    <option value={3}>Federais e ISS fora do SN</option>
                  </select>
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Alíquota do Simples Nacional (%) *</label>
                    <button
                      type="button"
                      onClick={buscarAliquotaSerpro}
                      disabled={buscandoSerpro}
                      style={{
                        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: buscandoSerpro ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Busca a alíquota oficial apurada na Receita Federal via Integra Contador (SERPRO)"
                    >
                      {buscandoSerpro ? 'Buscando...' : '⚡ Buscar no SERPRO'}
                    </button>
                  </div>
                  <input type="number" step="0.01" min="0" className="form-control" value={p.pTotTribSN ?? ''} onChange={e => set('pTotTribSN', num(e.target.value))} />
                </div>
              </>
            )}
          </div>
          {p.opSimpNac === 1 && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Tributos aprox. federais (%)</label>
                <input type="number" step="0.01" min="0" className="form-control" value={p.pTotTribFed ?? ''} onChange={e => set('pTotTribFed', num(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Estaduais (%)</label>
                <input type="number" step="0.01" min="0" className="form-control" value={p.pTotTribEst ?? ''} onChange={e => set('pTotTribEst', num(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Municipais (%)</label>
                <input type="number" step="0.01" min="0" className="form-control" value={p.pTotTribMun ?? ''} onChange={e => set('pTotTribMun', num(e.target.value))} />
              </div>
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={p.convenioAtivo} onChange={e => set('convenioAtivo', e.target.checked)} />
            Município com convênio ativo no Sistema Nacional (a alíquota vem da parametrização municipal)
          </label>
        </div>

        <div style={secaoStyle}>
          <div style={tituloStyle}>⚙️ Serviço padrão e numeração</div>
          <NfseServicoPicker
            cnaes={cnaes}
            cTribNac={p.cTribNacPadrao || ''}
            cNbs={p.cNbsPadrao || ''}
            onChange={m => setP(a => ({
              ...a,
              ...(m.cTribNac !== undefined ? { cTribNacPadrao: m.cTribNac } : {}),
              ...(m.cNbs !== undefined ? { cNbsPadrao: m.cNbs } : {}),
            }))}
          />
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cód. Tributação Nacional</label>
              <input className="form-control" maxLength={6} placeholder="6 dígitos" value={p.cTribNacPadrao || ''} onChange={e => set('cTribNacPadrao', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Cód. Tributação Municipal</label>
              <input className="form-control" value={p.cTribMunPadrao || ''} onChange={e => set('cTribMunPadrao', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Código NBS</label>
              <input className="form-control" placeholder="9 dígitos" value={p.cNbsPadrao || ''} onChange={e => set('cNbsPadrao', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Série da DPS *</label>
              <input className="form-control" maxLength={5} value={p.serie} onChange={e => set('serie', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Próxima DPS (produção restrita)</label>
              <input type="number" min="1" className="form-control" value={p.proximoNDpsHomologacao} onChange={e => set('proximoNDpsHomologacao', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Próxima DPS (produção)</label>
                <button
                  type="button"
                  onClick={sincronizarOficial}
                  disabled={sincronizandoOficial}
                  style={{ background: 'transparent', border: 'none', color: '#16a34a', fontSize: 11, cursor: 'pointer', fontWeight: 600, padding: 0 }}
                  title="Busca o último número emitido no portal da Receita Federal e ajusta a sequência"
                >
                  {sincronizandoOficial ? 'Consultando...' : '🔄 Puxar da base oficial'}
                </button>
              </div>
              <input type="number" min="1" className="form-control" value={p.proximoNDpsProducao} onChange={e => set('proximoNDpsProducao', Number(e.target.value))} />
            </div>
          </div>
          <div style={ajudaStyle}>Use uma série que a empresa não usa em outro sistema. O número fiscal da NFS-e é definido pelo Sefin.</div>
        </div>

        <div style={secaoStyle}>
          <div style={tituloStyle}>🧾 PIS/COFINS e IBS/CBS</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">CST PIS/COFINS</label>
              <select className="form-control" value={p.piscofinsCst} onChange={e => set('piscofinsCst', e.target.value)} disabled={p.opSimpNac === 2}>
                <option value="08">08 — Operação sem incidência</option>
                <option value="00">00 — Nenhum</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nota sem retenção informa</label>
              <select className="form-control" value={p.tpRetPisCofins === '0' || p.tpRetPisCofins === '2' ? p.tpRetPisCofins : ''} onChange={e => set('tpRetPisCofins', e.target.value)} disabled={p.opSimpNac === 2}>
                <option value="">Não informar o tipo</option>
                <option value="0">0 — PIS/COFINS/CSLL não retidos</option>
                <option value="2">2 — PIS/COFINS não retidos</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">cIndOp</label>
              <input className="form-control" maxLength={6} value={p.ibsCbsCIndOp || ''} onChange={e => set('ibsCbsCIndOp', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">CST IBS/CBS</label>
              <input className="form-control" maxLength={3} value={p.ibsCbsCst || ''} onChange={e => set('ibsCbsCst', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">cClassTrib</label>
              <input className="form-control" maxLength={6} value={p.ibsCbsCClassTrib || ''} onChange={e => set('ibsCbsCClassTrib', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Uso/consumo pessoal</label>
              <select className="form-control" value={p.ibsCbsIndFinal || ''} onChange={e => set('ibsCbsIndFinal', e.target.value)}>
                <option value="">Não informar</option>
                <option value="0">Não</option>
                <option value="1">Sim</option>
              </select>
            </div>
          </div>
          <div style={ajudaStyle}>Grupo IBS/CBS: já exigido no Regime Regular e obrigatório no Simples a partir da competência 01/2027. Confirme os códigos com a contabilidade.</div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Leiaute da DPS</label>
            <select className="form-control" value={p.leiaute || ''} onChange={e => set('leiaute', e.target.value)}>
              <option value="">Automático pelo ambiente</option>
              <option value="20260209">Forçar 09/02/2026</option>
              <option value="20261020">Forçar NT 009 (20/10/2026)</option>
            </select>
            <div style={ajudaStyle}>Altere só se o Sefin devolver E1235 citando finNFSe: é sinal de que a produção mudou de pacote.</div>
          </div>
        </div>

        <div style={secaoStyle}>
          <div style={tituloStyle}>✂️ Quando há retenção de tributos</div>
          <NfseRegrasRetencao
            regras={p.regrasRetencao || []}
            mei={p.opSimpNac === 2}
            simples={p.opSimpNac === 3}
            onChange={regras => set('regrasRetencao', regras)}
          />
        </div>

        <div className="form-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? '⏳ Salvando...' : '✓ Salvar Configuração'}</button>
        </div>
      </div>
    </div>
  );
}
