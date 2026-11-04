'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface EmpresaItem {
  id: string;
  nome: string;
  cnpj: string;
}

interface Props {
  empresaIdInicial?: string;
  onFechar: () => void;
  empresas?: EmpresaItem[];
}

export default function CertidaoFederalModal({ empresaIdInicial, onFechar, empresas }: Props) {
  const [empresaId, setEmpresaId] = useState(empresaIdInicial || (empresas?.[0]?.id || ''));
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  // Se não recebeu lista de empresas, busca do endpoint de emissores
  const [listaEmpresas, setListaEmpresas] = useState<EmpresaItem[]>(empresas || []);

  useEffect(() => {
    if (empresas && empresas.length > 0) return;
    fetch('/api/nfse/emissores')
      .then(res => res.json())
      .then(dados => {
        if (dados && Array.isArray(dados.empresas)) {
          const formatadas = dados.empresas.map((e: any) => ({
            id: e.id,
            nome: e.nomeFantasia || e.razaoSocial,
            cnpj: e.cnpj,
          }));
          setListaEmpresas(formatadas);
          if (!empresaId && formatadas[0]) {
            setEmpresaId(formatadas[0].id);
          }
        }
      })
      .catch(() => {});
  }, [empresas, empresaId]);

  const empresaSelecionada = listaEmpresas.find(e => e.id === empresaId);

  const consultarCertidao = async () => {
    if (!empresaId) {
      toast.error('Selecione uma empresa para consultar.');
      return;
    }
    setCarregando(true);
    setResultado(null);
    try {
      const res = await fetch(`/api/serpro/certidao-federal?empresaId=${empresaId}`);
      const data = await res.json();
      if (res.ok && data.sucesso) {
        setResultado(data);
        if (data.situacao === 'NEGATIVA') {
          toast.success('Certidão Negativa Federal emitida com sucesso!');
        } else if (data.situacao === 'POSITIVA_COM_EFEITO_NEGATIVA') {
          toast.success('Certidão Positiva com Efeito de Negativa emitida com sucesso!');
        } else if (data.situacao === 'PROCESSANDO') {
          toast.info(data.mensagem || 'Processando consulta na Receita Federal.');
        } else {
          toast.warning('Relatório emitido. Verifique o detalhamento de débitos no PDF.');
        }
      } else {
        toast.error(data.error || data.mensagem || 'Não foi possível consultar a certidão.');
      }
    } catch {
      toast.error('Erro de conexão com o Integra Contador do SERPRO.');
    } finally {
      setCarregando(false);
    }
  };

  const abrirPdf = () => {
    if (!empresaId) return;
    window.open(`/api/serpro/certidao-federal/download?empresaId=${empresaId}`, '_blank');
  };

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div
        className="modal-container"
        style={{ maxWidth: 650, width: '95%' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #1e3a8a, #0284c7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 18,
            }}>
              🏛️
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: 18, margin: 0 }}>
                Certidão Negativa Federal (CND / SITFIS)
              </h2>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Integra Contador oficial da Receita Federal & PGFN via SERPRO
              </div>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onFechar}>&times;</button>
        </div>

        <div className="modal-body" style={{ paddingTop: 16 }}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Empresa para Consulta *</label>
            <select
              className="form-control"
              value={empresaId}
              onChange={e => {
                setEmpresaId(e.target.value);
                setResultado(null);
              }}
              disabled={carregando}
            >
              {listaEmpresas.map(e => (
                <option key={e.id} value={e.id}>
                  {e.nome} — {e.cnpj}
                </option>
              ))}
            </select>
          </div>

          <div style={{
            background: 'var(--bg-card2, #f8fafc)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: 8,
            padding: 14,
            marginBottom: 20,
            fontSize: 13,
            lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
              Sobre a Consulta via Integra Contador:
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              Esta rotina utiliza as credenciais do <strong>Integra Contador</strong> e o certificado digital e-CNPJ do escritório para solicitar o protocolo no sistema <strong>SITFIS da Receita Federal</strong> e emitir o relatório de regularidade fiscal de débitos perante a União e Procuradoria-Geral da Fazenda Nacional (PGFN).
            </div>
          </div>

          {resultado && (
            <div style={{
              background: resultado.situacao === 'NEGATIVA' ? 'rgba(16, 185, 129, 0.08)' : resultado.situacao === 'POSITIVA_COM_EFEITO_NEGATIVA' ? 'rgba(2, 132, 199, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${resultado.situacao === 'NEGATIVA' ? '#10b981' : resultado.situacao === 'POSITIVA_COM_EFEITO_NEGATIVA' ? '#0284c7' : '#ef4444'}`,
              borderRadius: 8,
              padding: 16,
              marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Situação Fiscal
                </span>
                <span style={{
                  background: resultado.situacao === 'NEGATIVA' ? '#10b981' : resultado.situacao === 'POSITIVA_COM_EFEITO_NEGATIVA' ? '#0284c7' : '#ef4444',
                  color: '#fff',
                  borderRadius: 16,
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                }}>
                  {resultado.situacao === 'NEGATIVA' && '✓ CERTIDÃO NEGATIVA (REGULAR)'}
                  {resultado.situacao === 'POSITIVA_COM_EFEITO_NEGATIVA' && '✓ POSITIVA C/ EFEITO DE NEGATIVA'}
                  {resultado.situacao === 'POSITIVA' && '⚠ POSITIVA (COM PENDÊNCIAS)'}
                  {resultado.situacao === 'PROCESSANDO' && '⏳ PROCESSANDO NA RFB'}
                </span>
              </div>

              <div style={{ fontSize: 13, marginBottom: 8 }}>
                <strong>Empresa:</strong> {resultado.empresaNome || empresaSelecionada?.nome}
              </div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                <strong>CNPJ:</strong> {resultado.cnpj || empresaSelecionada?.cnpj}
              </div>
              {resultado.protocolo && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, wordBreak: 'break-all' }}>
                  <strong>Protocolo SITFIS:</strong> {resultado.protocolo.slice(0, 45)}...
                </div>
              )}

              {resultado.pdfBase64 && (
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={abrirPdf}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    📄 Abrir / Visualizar Certidão em PDF
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
          <button type="button" className="btn btn-secondary" onClick={onFechar} disabled={carregando}>
            Fechar
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={consultarCertidao}
            disabled={carregando || !empresaId}
            style={{
              background: 'linear-gradient(135deg, #1e3a8a, #0284c7)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {carregando ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Consultando Receita Federal...
              </>
            ) : (
              <>
                🔍 Consultar CND Federal
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
