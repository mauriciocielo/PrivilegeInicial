'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Instrument_Serif } from 'next/font/google';
import {
  UploadCloud, FileText, CheckCircle2, AlertTriangle, AlertCircle, Copy, Check,
  Download, RefreshCw, Search, ArrowLeftRight, Sparkles, Filter, ChevronRight,
  ShieldCheck, FileSearch, Layers, Eye, X, ArrowUpRight, ArrowDownLeft, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '../lib/reports';
import type {
  ResultadoComparacaoSped,
  ItemComparacaoSped,
  TipoDivergencia,
} from '../lib/sped/comparador';

const serif = Instrument_Serif({ subsets: ['latin'], weight: ['400'] });

interface EmpresaOpcao {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
}

interface ComparadorSpedPainelProps {
  modoCliente?: boolean;
}

export default function ComparadorSpedPainel({ modoCliente = false }: ComparadorSpedPainelProps) {
  // Estado de upload e arquivo
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string>('');
  const [processando, setProcessando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  // Empresas cadastradas para vinculação manual
  const [empresas, setEmpresas] = useState<EmpresaOpcao[]>([]);
  const [empresaIdSelecionada, setEmpresaIdSelecionada] = useState<string>('');

  // Resultado da Comparação
  const [resultado, setResultado] = useState<ResultadoComparacaoSped | null>(null);
  const [empresaResultado, setEmpresaResultado] = useState<EmpresaOpcao | null>(null);
  const [metaSpedSemEmpresa, setMetaSpedSemEmpresa] = useState<any | null>(null);

  // Filtros da Tabela
  const [abaAtiva, setAbaAtiva] = useState<TipoDivergencia | 'todas'>('faltando_no_sped');
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'nfe' | 'cte' | 'nfse'>('todos');
  const [filtroOperacao, setFiltroOperacao] = useState<'todas' | 'entrada' | 'saida'>('todas');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 25;

  // Cópia de chaves e IA
  const [copiouChave, setCopiouChave] = useState<string | null>(null);
  const [copiandoTodas, setCopiandoTodas] = useState(false);
  const [analiseIaGerada, setAnaliseIaGerada] = useState<string | null>(null);
  const [gerandoIa, setGerandoIa] = useState(false);
  const [mostrarSecaoIa, setMostrarSecaoIa] = useState(false);

  // Carrega lista de empresas para fallback
  useEffect(() => {
    async function carregarEmpresas() {
      try {
        const res = await fetch('/api/nfe/monitor');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.empresas)) {
            setEmpresas(data.empresas);
          }
        }
      } catch (err) {
        console.error('Erro ao listar empresas para comparador SPED:', err);
      }
    }
    carregarEmpresas();
  }, []);

  // Envia arquivo SPED para a API de comparação
  const executarComparacao = useCallback(async (file: File, empresaIdForcada?: string) => {
    try {
      setProcessando(true);
      setResultado(null);
      setEmpresaResultado(null);
      setMetaSpedSemEmpresa(null);
      setAnaliseIaGerada(null);

      const formData = new FormData();
      formData.append('file', file);
      if (empresaIdForcada) {
        formData.append('empresaId', empresaIdForcada);
      } else if (empresaIdSelecionada) {
        formData.append('empresaId', empresaIdSelecionada);
      }

      const res = await fetch('/api/sped/comparar', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.sucesso) {
        throw new Error(data.error || 'Não foi possível processar o arquivo SPED.');
      }

      if (!data.empresaEncontrada) {
        setMetaSpedSemEmpresa(data.metaSped);
        toast.warning('O CNPJ deste SPED não foi identificado automaticamente nas empresas cadastradas.');
        return;
      }

      setEmpresaResultado(data.empresa);
      setResultado(data.resultado);

      // Define a primeira aba conforme as ocorrências
      if (data.resultado.metricas.totalFaltandoNoSped > 0) {
        setAbaAtiva('faltando_no_sped');
      } else if (data.resultado.metricas.totalFaltandoNoSistema > 0) {
        setAbaAtiva('faltando_no_sistema');
      } else if (data.resultado.metricas.totalDivergenciasValor + data.resultado.metricas.totalDivergenciasSituacao > 0) {
        setAbaAtiva('valor_divergente');
      } else {
        setAbaAtiva('todas');
      }

      setPaginaAtual(1);
      toast.success('Cruzamento SPED x Sistema concluído com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao processar e comparar arquivo SPED.');
    } finally {
      setProcessando(false);
    }
  }, [empresaIdSelecionada]);

  // Handler de seleção de arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArquivo(file);
      setNomeArquivo(file.name);
      executarComparacao(file);
    }
  };

  // Drag and Drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setArquivo(file);
      setNomeArquivo(file.name);
      executarComparacao(file);
    }
  };

  // Reseta análise
  const handleLimpar = () => {
    setArquivo(null);
    setNomeArquivo('');
    setResultado(null);
    setEmpresaResultado(null);
    setMetaSpedSemEmpresa(null);
    setAnaliseIaGerada(null);
    setMostrarSecaoIa(false);
    if (inputArquivoRef.current) inputArquivoRef.current.value = '';
  };

  // Filtragem dos Itens
  const itensFiltrados = useMemo(() => {
    if (!resultado) return [];
    let list = resultado.itens;

    // Aba
    if (abaAtiva === 'faltando_no_sped') {
      list = list.filter(i => i.status === 'faltando_no_sped');
    } else if (abaAtiva === 'faltando_no_sistema') {
      list = list.filter(i => i.status === 'faltando_no_sistema');
    } else if (abaAtiva === 'valor_divergente') {
      list = list.filter(i => i.status === 'valor_divergente' || i.status === 'situacao_divergente');
    } else if (abaAtiva === 'conciliado') {
      list = list.filter(i => i.status === 'conciliado');
    }

    // Tipo de Documento
    if (filtroTipo !== 'todos') {
      list = list.filter(i => i.tipoDoc === filtroTipo);
    }

    // Operação
    if (filtroOperacao !== 'todas') {
      list = list.filter(i => i.operacao === filtroOperacao);
    }

    // Busca textual
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter(i =>
        i.chave.toLowerCase().includes(q) ||
        i.numero.toLowerCase().includes(q) ||
        i.participanteNome.toLowerCase().includes(q) ||
        i.participanteCnpjCpf.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
      );
    }

    return list;
  }, [resultado, abaAtiva, filtroTipo, filtroOperacao, busca]);

  // Paginação
  const totalPaginas = Math.ceil(itensFiltrados.length / itensPorPagina) || 1;
  const itensPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return itensFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [itensFiltrados, paginaAtual]);

  // Copiar chave individual
  const copiarChave = (chave: string) => {
    if (!chave) return;
    navigator.clipboard.writeText(chave);
    setCopiouChave(chave);
    toast.success('Chave copiada para a área de transferência!');
    setTimeout(() => setCopiouChave(null), 2000);
  };

  // Copiar todas as chaves da aba ativa
  const copiarTodasChaves = () => {
    const chaves = itensFiltrados.map(i => i.chave).filter(Boolean);
    if (chaves.length === 0) {
      toast.info('Nenhuma chave de acesso encontrada nesta listagem.');
      return;
    }
    setCopiandoTodas(true);
    navigator.clipboard.writeText(chaves.join('\n'));
    toast.success(`${chaves.length} chave(s) copiada(s) para a área de transferência!`);
    setTimeout(() => setCopiandoTodas(false), 2000);
  };

  // Exportar relatório em CSV
  const exportarCsv = () => {
    if (!resultado) return;

    const cabecalho = [
      'Status Auditoria',
      'Tipo Doc',
      'Modelo',
      'Operação',
      'Número',
      'Série',
      'Data Emissão',
      'Chave de Acesso',
      'Contraparte / Participante',
      'CNPJ/CPF Contraparte',
      'Valor no SPED (R$)',
      'Valor no Sistema (R$)',
      'Diferença (R$)',
      'Situação SPED',
      'Situação Sistema',
      'Motivo / Análise Fiscal',
    ];

    const linhas = [
      '\uFEFF' + cabecalho.join(';'),
      ...itensFiltrados.map(item => {
        const statusLabel =
          item.status === 'faltando_no_sped'
            ? 'FALTANDO NO SPED (OMISSÃO)'
            : item.status === 'faltando_no_sistema'
            ? 'FALTANDO NO SISTEMA'
            : item.status === 'valor_divergente'
            ? 'VALOR DIVERGENTE'
            : item.status === 'situacao_divergente'
            ? 'SITUAÇÃO DIVERGENTE'
            : 'CONCILIADO 100%';

        return [
          `"${statusLabel}"`,
          `"${item.tipoDoc.toUpperCase()}"`,
          `"${item.modelo}"`,
          `"${item.operacao === 'entrada' ? 'Entrada (Aquisição)' : 'Saída (Faturamento)'}"`,
          `"${item.numero}"`,
          `"${item.serie}"`,
          `"${item.dataEmissao}"`,
          `"${item.chave}"`,
          `"${(item.participanteNome || '').replace(/"/g, '""')}"`,
          `"${item.participanteCnpjCpf}"`,
          item.valorSped != null ? item.valorSped.toFixed(2).replace('.', ',') : '',
          item.valorSistema != null ? item.valorSistema.toFixed(2).replace('.', ',') : '',
          item.diferencaValor.toFixed(2).replace('.', ','),
          `"${item.situacaoSped || ''}"`,
          `"${item.situacaoSistema || ''}"`,
          `"${(item.motivo || '').replace(/"/g, '""')}"`,
        ].join(';');
      }),
    ];

    const blob = new Blob([linhas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const mes = resultado.metricas.mesCompetencia || 'periodo';
    a.download = `cruzamento-sped-${resultado.metricas.empresaCnpj.replace(/\D/g, '')}-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório CSV de auditoria baixado com sucesso!');
  };

  // Gerar Parecer Auditor com IA Gemini
  const gerarParecerIa = async () => {
    if (!resultado) return;
    try {
      setGerandoIa(true);
      setMostrarSecaoIa(true);

      const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyApsKGqQWqF6LeABZG2fNdzXp4G9_wTq6s';

      const prompt = `Você é o Auditor Fiscal Chefe e Perito Tributário do sistema.
Analise os resultados do cruzamento entre o arquivo SPED Fiscal (EFD) e os Documentos Fiscais Eletrônicos (NF-e, CT-e, NFS-e) autorizados pelo SEFAZ/ADN:

DADOS DA AUDITORIA:
- Empresa: ${empresaResultado?.razaoSocial || resultado.metricas.empresaNomeSped}
- CNPJ: ${resultado.metricas.empresaCnpj}
- Mês de Competência: ${resultado.metricas.mesCompetencia}
- Total Documentos SPED: ${resultado.metricas.totalDocsSped} (R$ ${resultado.metricas.valorTotalSped.toLocaleString('pt-BR')})
- Total Documentos no Sistema/SEFAZ: ${resultado.metricas.totalDocsSistema} (R$ ${resultado.metricas.valorTotalSistema.toLocaleString('pt-BR')})
- Notas Omitidas no SPED (constam no SEFAZ mas faltam no SPED): ${resultado.metricas.totalFaltandoNoSped} notas, totalizando R$ ${resultado.metricas.valorFaltandoNoSped.toLocaleString('pt-BR')}
- Notas no SPED que faltam no Sistema: ${resultado.metricas.totalFaltandoNoSistema} notas, totalizando R$ ${resultado.metricas.valorFaltandoNoSistema.toLocaleString('pt-BR')}
- Divergências de Valores: ${resultado.metricas.totalDivergenciasValor} notas
- Divergências de Situação (ex: canceladas): ${resultado.metricas.totalDivergenciasSituacao} notas
- Índice de Aderência da Escrituração: ${resultado.metricas.indiceAderenciaPct.toFixed(1)}%

Por favor, elabore um parecer executivo formal e direto em 4 tópicos:
1. Grau de Risco Fiscal da Empresa (Classificação: Baixo, Moderado, Elevado ou Crítico);
2. Impacto Financeiro e Riscos de Autuação (multas por omissão de documentos fiscais conforme legislação do SPED e ICMS/PIS/COFINS);
3. Recomendações Práticas Imediatas para a Equipe Fiscal/Contábil (retificação do SPED, importação de XMLs ou ajuste de valores);
4. Conclusão da Auditoria.

Responda em Português do Brasil com linguagem profissional e objetiva de auditoria fiscal.`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!res.ok) throw new Error('Falha na resposta do serviço de IA.');
      const data = await res.json();
      const resposta = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (resposta) {
        setAnaliseIaGerada(resposta);
      }
    } catch (err: any) {
      console.error('Erro na auditoria com IA:', err);
      toast.error('Não foi possível gerar o parecer de IA no momento.');
    } finally {
      setGerandoIa(false);
    }
  };

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 60 }}>
      {/* =========================================================================
          PAGE HEADER
          ========================================================================= */}
      <div
        className="page-header"
        style={{
          background: '#fdfdfd',
          borderBottom: '1px solid #e5e5e5',
          padding: '24px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#600000',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ShieldCheck size={14} /> AUDITORIA & CONCILIAÇÃO FISCAL AVANÇADA
          </div>
          <h1
            className={serif.className}
            style={{
              fontSize: 34,
              fontWeight: 400,
              color: '#000',
              margin: 0,
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
            }}
          >
            Comparador de SPED Fiscal
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#525252' }}>
            Cruze arquivos SPED (.txt EFD ICMS/IPI e EFD Contribuições) com os documentos fiscais (NF-e, CT-e, NFS-e) do sistema e identifique omissões e divergências.
          </p>

          {resultado && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  background: '#f3f4f6',
                  color: '#171717',
                  padding: '3px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid #e5e7eb',
                }}
              >
                {empresaResultado?.razaoSocial || resultado.metricas.empresaNomeSped} · CNPJ {resultado.metricas.empresaCnpj}
              </span>
              <span
                style={{
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  padding: '3px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid #bfdbfe',
                }}
              >
                Competência: {resultado.metricas.mesCompetencia || `${resultado.metricas.periodoInicio} a ${resultado.metricas.periodoFim}`}
              </span>
              <span style={{ fontSize: 12, color: '#737373' }}>
                Arquivo: <strong>{nomeArquivo}</strong>
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {resultado && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  background: '#fff',
                  border: '1px solid #e5e5e5',
                  color: '#171717',
                  borderRadius: 8,
                  fontWeight: 500,
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                }}
                onClick={copiarTodasChaves}
                disabled={copiandoTodas}
                title="Copia todas as chaves de acesso exibidas na aba atual para colar em programas de escrituração ou SEFAZ"
              >
                {copiandoTodas ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                {copiandoTodas ? 'Chaves Copiadas!' : 'Copiar Chaves da Aba'}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  background: '#fff',
                  border: '1px solid #e5e5e5',
                  color: '#171717',
                  borderRadius: 8,
                  fontWeight: 500,
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                }}
                onClick={exportarCsv}
                title="Baixar planilha CSV completa com todos os apontamentos de auditoria"
              >
                <Download size={14} /> Exportar Relatório CSV
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  background: '#faf5ff',
                  border: '1px solid #d8b4fe',
                  color: '#6b21a8',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                }}
                onClick={() => {
                  if (!analiseIaGerada && !gerandoIa) {
                    gerarParecerIa();
                  } else {
                    setMostrarSecaoIa(!mostrarSecaoIa);
                  }
                }}
                disabled={gerandoIa}
              >
                <Sparkles size={14} className={gerandoIa ? 'animate-spin' : ''} />
                {gerandoIa ? 'Auditor IA Analisando...' : analiseIaGerada ? 'Ver Parecer IA' : 'Parecer Auditor IA'}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  borderRadius: 8,
                  fontWeight: 500,
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                }}
                onClick={handleLimpar}
              >
                <X size={14} /> Novo Arquivo SPED
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {/* =========================================================================
            ZONA DE UPLOAD / DRAG AND DROP (SE NENHUM RESULTADO AINDA)
            ========================================================================= */}
        {!resultado && (
          <div style={{ maxWidth: 880, margin: '30px auto' }}>
            <div
              onDragOver={e => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={handleDrop}
              onClick={() => inputArquivoRef.current?.click()}
              style={{
                background: arrastando ? '#fef2f2' : '#ffffff',
                border: `2px dashed ${arrastando ? '#600000' : '#d1d5db'}`,
                borderRadius: 16,
                padding: '48px 32px',
                textAlign: 'center',
                cursor: processando ? 'wait' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
              }}
            >
              <input
                ref={inputArquivoRef}
                type="file"
                accept=".txt,.sped"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={processando}
              />

              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: '#fff1f2',
                  color: '#600000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                {processando ? (
                  <RefreshCw size={28} className="animate-spin" />
                ) : (
                  <UploadCloud size={30} />
                )}
              </div>

              <h2
                className={serif.className}
                style={{ fontSize: 26, fontWeight: 400, color: '#171717', margin: '0 0 8px' }}
              >
                {processando
                  ? 'Auditando e Cruzando Registros SPED...'
                  : 'Selecione ou Arraste o Arquivo SPED (.txt)'}
              </h2>

              <p style={{ fontSize: 14, color: '#525252', maxWidth: 560, margin: '0 auto 20px', lineHeight: 1.5 }}>
                {processando
                  ? 'Processando blocos 0000, 0150, C100 (NF-e/NFC-e), D100 (CT-e) e A100 (NFS-e) e comparando com as notas autorizadas no sistema.'
                  : 'Carregue o arquivo do SPED Fiscal (EFD ICMS/IPI) ou EFD Contribuições. O sistema identificará automaticamente o CNPJ e o mês de competência para o cruzamento.'}
              </p>

              {!processando && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      background: '#600000',
                      borderColor: '#600000',
                      padding: '10px 24px',
                      fontSize: 14,
                      fontWeight: 600,
                      borderRadius: 8,
                    }}
                  >
                    Escolher Arquivo do Computador
                  </button>
                </div>
              )}
            </div>

            {/* Alerta de fallback caso o CNPJ do SPED não esteja cadastrado */}
            {metaSpedSemEmpresa && (
              <div
                style={{
                  marginTop: 24,
                  background: '#fffbeb',
                  border: '1px solid #fcd34d',
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <AlertTriangle size={20} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: '#92400e', margin: '0 0 4px' }}>
                      CNPJ do SPED não vinculado automaticamente
                    </h3>
                    <p style={{ fontSize: 13.5, color: '#78350f', margin: '0 0 12px' }}>
                      O arquivo SPED informado pertence ao CNPJ <strong>{metaSpedSemEmpresa.cnpjSped}</strong> ({metaSpedSemEmpresa.razaoSocialSped || 'Empresa'}), período {metaSpedSemEmpresa.dataInicio} a {metaSpedSemEmpresa.dataFim}.
                      Para cruzar com as notas fiscais do sistema, selecione a qual empresa da sua carteira este arquivo corresponde:
                    </p>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        className="form-input"
                        value={empresaIdSelecionada}
                        onChange={e => setEmpresaIdSelecionada(e.target.value)}
                        style={{ maxWidth: 380, fontSize: 13, padding: '7px 12px', background: '#fff' }}
                      >
                        <option value="">Selecione uma empresa do sistema...</option>
                        {empresas.map(e => (
                          <option key={e.id} value={e.id}>
                            {e.razaoSocial || e.nomeFantasia} ({e.cnpj})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ background: '#b45309', borderColor: '#b45309', fontSize: 13, padding: '7px 16px' }}
                        disabled={!empresaIdSelecionada || !arquivo}
                        onClick={() => {
                          if (arquivo && empresaIdSelecionada) {
                            executarComparacao(arquivo, empresaIdSelecionada);
                          }
                        }}
                      >
                        Cruzar com a Empresa Selecionada
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Informações dos Blocos Suportados */}
            <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                    REGISTRO C100
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#171717' }}>NF-e e NFC-e</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#525252', lineHeight: 1.4 }}>
                  Cruza notas modelo 55 e 65 de compras (entradas) e vendas (saídas) pela chave de 44 dígitos e valores totais.
                </p>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                    REGISTRO D100
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#171717' }}>CT-e (Transportes)</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#525252', lineHeight: 1.4 }}>
                  Audita conhecimentos de transporte eletrônico modelo 57 tomados e emitidos vinculados às operações da empresa.
                </p>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ background: '#ecfdf5', color: '#065f46', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                    REGISTRO A100
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#171717' }}>NFS-e (Serviços)</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#525252', lineHeight: 1.4 }}>
                  Compara notas de serviços tomados e prestados (EFD Contribuições / PIS-COFINS) com as notas da plataforma ADN.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            PAINEL DE RESULTADOS APÓS ANÁLISE
            ========================================================================= */}
        {resultado && (
          <div>
            {/* CARDS DE RESUMO EXECUTIVO (KPIS) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: 14,
                marginBottom: 20,
              }}
            >
              {/* Card 1: SPED Total */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.04em' }}>
                  Escriturado no SPED
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginTop: 4 }}>
                  {resultado.metricas.totalDocsSped} <span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>docs</span>
                </div>
                <div style={{ fontSize: 13, color: '#4b5563', marginTop: 2 }}>
                  {fmt.currency(resultado.metricas.valorTotalSped)}
                </div>
              </div>

              {/* Card 2: Sistema Total */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.04em' }}>
                  Autorizado no Sistema / SEFAZ
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginTop: 4 }}>
                  {resultado.metricas.totalDocsSistema} <span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>docs</span>
                </div>
                <div style={{ fontSize: 13, color: '#4b5563', marginTop: 2 }}>
                  {fmt.currency(resultado.metricas.valorTotalSistema)}
                </div>
              </div>

              {/* Card 3: Faltando no SPED (Omissões) - DESTAQUE VERMELHO */}
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 12,
                  padding: '16px 20px',
                  cursor: 'pointer',
                  boxShadow: abaAtiva === 'faltando_no_sped' ? '0 0 0 2px #991b1b' : 'none',
                }}
                onClick={() => setAbaAtiva('faltando_no_sped')}
                title="Clique para filtrar apenas as notas que constam no sistema/SEFAZ mas faltam no SPED"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: '#991b1b', letterSpacing: '0.04em' }}>
                    🚨 Faltando no SPED (Omissão)
                  </div>
                  <span style={{ background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                    RISCO ALTO
                  </span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#991b1b', marginTop: 4 }}>
                  {resultado.metricas.totalFaltandoNoSped} <span style={{ fontSize: 13, fontWeight: 600 }}>notas</span>
                </div>
                <div style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600, marginTop: 2 }}>
                  {fmt.currency(resultado.metricas.valorFaltandoNoSped)}
                </div>
              </div>

              {/* Card 4: Faltando no Sistema */}
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fcd34d',
                  borderRadius: 12,
                  padding: '16px 20px',
                  cursor: 'pointer',
                  boxShadow: abaAtiva === 'faltando_no_sistema' ? '0 0 0 2px #b45309' : 'none',
                }}
                onClick={() => setAbaAtiva('faltando_no_sistema')}
                title="Clique para filtrar apenas notas escrituradas no SPED que ainda não foram baixadas no sistema"
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: '#92400e', letterSpacing: '0.04em' }}>
                  📥 Faltando no Sistema
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#92400e', marginTop: 4 }}>
                  {resultado.metricas.totalFaltandoNoSistema} <span style={{ fontSize: 13, fontWeight: 500 }}>notas</span>
                </div>
                <div style={{ fontSize: 13, color: '#b45309', marginTop: 2 }}>
                  {fmt.currency(resultado.metricas.valorFaltandoNoSistema)}
                </div>
              </div>

              {/* Card 5: Divergências de Valor / Situação */}
              <div
                style={{
                  background: '#fdf4ff',
                  border: '1px solid #f0abfc',
                  borderRadius: 12,
                  padding: '16px 20px',
                  cursor: 'pointer',
                  boxShadow: abaAtiva === 'valor_divergente' ? '0 0 0 2px #86198f' : 'none',
                }}
                onClick={() => setAbaAtiva('valor_divergente')}
                title="Clique para filtrar divergências de valor ou situação"
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: '#86198f', letterSpacing: '0.04em' }}>
                  ⚠️ Divergências
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#86198f', marginTop: 4 }}>
                  {resultado.metricas.totalDivergenciasValor + resultado.metricas.totalDivergenciasSituacao} <span style={{ fontSize: 13, fontWeight: 500 }}>docs</span>
                </div>
                <div style={{ fontSize: 12, color: '#a21caf', marginTop: 2 }}>
                  {resultado.metricas.totalDivergenciasValor} de valor · {resultado.metricas.totalDivergenciasSituacao} de status
                </div>
              </div>

              {/* Card 6: Conciliadas 100% */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: 12,
                  padding: '16px 20px',
                  cursor: 'pointer',
                  boxShadow: abaAtiva === 'conciliado' ? '0 0 0 2px #15803d' : 'none',
                }}
                onClick={() => setAbaAtiva('conciliado')}
                title="Clique para filtrar apenas notas 100% conciliadas"
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: '#15803d', letterSpacing: '0.04em' }}>
                  🟢 Conciliadas 100%
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#15803d', marginTop: 4 }}>
                  {resultado.metricas.totalConciliadas} <span style={{ fontSize: 13, fontWeight: 500 }}>notas</span>
                </div>
                <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>
                  Chave, valor e status idênticos
                </div>
              </div>
            </div>

            {/* BARRA DE ADERÊNCIA FISCAL */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: '16px 24px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 200 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                  Índice de Aderência Fiscal
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 30,
                      fontWeight: 800,
                      color:
                        resultado.metricas.indiceAderenciaPct >= 95
                          ? '#15803d'
                          : resultado.metricas.indiceAderenciaPct >= 80
                          ? '#b45309'
                          : '#991b1b',
                    }}
                  >
                    {resultado.metricas.indiceAderenciaPct.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {resultado.metricas.indiceAderenciaPct >= 95
                      ? 'Conformidade Alta'
                      : resultado.metricas.indiceAderenciaPct >= 80
                      ? 'Atenção Necessária'
                      : 'Risco Elevado de Glosa'}
                  </span>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ width: '100%', height: 10, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(0, resultado.metricas.indiceAderenciaPct))}%`,
                      height: '100%',
                      background:
                        resultado.metricas.indiceAderenciaPct >= 95
                          ? '#22c55e'
                          : resultado.metricas.indiceAderenciaPct >= 80
                          ? '#f59e0b'
                          : '#ef4444',
                      borderRadius: 99,
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  <span>0% (Divergência Total)</span>
                  <span>50%</span>
                  <span>100% (SPED e SEFAZ Espelhados)</span>
                </div>
              </div>

              {/* Mini resumo por tipo de documento */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ padding: '6px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: '#171717' }}>NF-e: </span>
                  <span style={{ color: '#059669' }}>{resultado.resumoPorTipo.nfe.conciliadas} ok</span>
                  {resultado.resumoPorTipo.nfe.divergencias > 0 && (
                    <span style={{ color: '#dc2626', fontWeight: 600 }}> · {resultado.resumoPorTipo.nfe.divergencias} div.</span>
                  )}
                </div>
                <div style={{ padding: '6px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: '#171717' }}>CT-e: </span>
                  <span style={{ color: '#059669' }}>{resultado.resumoPorTipo.cte.conciliadas} ok</span>
                  {resultado.resumoPorTipo.cte.divergencias > 0 && (
                    <span style={{ color: '#dc2626', fontWeight: 600 }}> · {resultado.resumoPorTipo.cte.divergencias} div.</span>
                  )}
                </div>
                <div style={{ padding: '6px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: '#171717' }}>NFS-e: </span>
                  <span style={{ color: '#059669' }}>{resultado.resumoPorTipo.nfse.conciliadas} ok</span>
                  {resultado.resumoPorTipo.nfse.divergencias > 0 && (
                    <span style={{ color: '#dc2626', fontWeight: 600 }}> · {resultado.resumoPorTipo.nfse.divergencias} div.</span>
                  )}
                </div>
              </div>
            </div>

            {/* SEÇÃO DO PARECER AUDITOR DE IA (QUANDO GERADO OU ATIVADO) */}
            {mostrarSecaoIa && (
              <div
                style={{
                  background: '#faf5ff',
                  border: '1px solid #d8b4fe',
                  borderRadius: 12,
                  padding: 24,
                  marginBottom: 20,
                  boxShadow: '0 4px 12px rgba(107, 33, 168, 0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={18} color="#7c3aed" />
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#581c87' }}>
                      Parecer do Auditor Fiscal com IA (Gemini 2.5 Flash)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMostrarSecaoIa(false)}
                    style={{ background: 'transparent', border: 'none', color: '#7c3aed', cursor: 'pointer' }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {gerandoIa ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6b21a8', padding: '16px 0' }}>
                    <RefreshCw size={18} className="animate-spin" />
                    <span style={{ fontSize: 14 }}>Auditor IA analisando os riscos tributários e gerando parecer fiscal...</span>
                  </div>
                ) : analiseIaGerada ? (
                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: '#3b0764',
                      whiteSpace: 'pre-wrap',
                      background: '#ffffff',
                      padding: 18,
                      borderRadius: 8,
                      border: '1px solid #f3e8ff',
                    }}
                  >
                    {analiseIaGerada}
                  </div>
                ) : null}
              </div>
            )}

            {/* ABAS DE NAVEGAÇÃO DOS ITENS */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                borderBottom: '1px solid #e5e7eb',
                marginBottom: 16,
                overflowX: 'auto',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setAbaAtiva('faltando_no_sped');
                  setPaginaAtual(1);
                }}
                style={{
                  padding: '10px 16px',
                  fontSize: 13.5,
                  fontWeight: 600,
                  border: 'none',
                  borderBottom: abaAtiva === 'faltando_no_sped' ? '3px solid #991b1b' : '3px solid transparent',
                  background: 'transparent',
                  color: abaAtiva === 'faltando_no_sped' ? '#991b1b' : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>🚨 Faltando no SPED</span>
                <span
                  style={{
                    background: abaAtiva === 'faltando_no_sped' ? '#fee2e2' : '#f3f4f6',
                    color: abaAtiva === 'faltando_no_sped' ? '#991b1b' : '#374151',
                    padding: '2px 8px',
                    borderRadius: 99,
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  {resultado.metricas.totalFaltandoNoSped}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAbaAtiva('faltando_no_sistema');
                  setPaginaAtual(1);
                }}
                style={{
                  padding: '10px 16px',
                  fontSize: 13.5,
                  fontWeight: 600,
                  border: 'none',
                  borderBottom: abaAtiva === 'faltando_no_sistema' ? '3px solid #b45309' : '3px solid transparent',
                  background: 'transparent',
                  color: abaAtiva === 'faltando_no_sistema' ? '#b45309' : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>📥 Faltando no Sistema</span>
                <span
                  style={{
                    background: abaAtiva === 'faltando_no_sistema' ? '#fef3c7' : '#f3f4f6',
                    color: abaAtiva === 'faltando_no_sistema' ? '#92400e' : '#374151',
                    padding: '2px 8px',
                    borderRadius: 99,
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  {resultado.metricas.totalFaltandoNoSistema}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAbaAtiva('valor_divergente');
                  setPaginaAtual(1);
                }}
                style={{
                  padding: '10px 16px',
                  fontSize: 13.5,
                  fontWeight: 600,
                  border: 'none',
                  borderBottom: abaAtiva === 'valor_divergente' ? '3px solid #86198f' : '3px solid transparent',
                  background: 'transparent',
                  color: abaAtiva === 'valor_divergente' ? '#86198f' : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>⚠️ Divergências de Valor/Status</span>
                <span
                  style={{
                    background: abaAtiva === 'valor_divergente' ? '#fae8ff' : '#f3f4f6',
                    color: abaAtiva === 'valor_divergente' ? '#86198f' : '#374151',
                    padding: '2px 8px',
                    borderRadius: 99,
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  {resultado.metricas.totalDivergenciasValor + resultado.metricas.totalDivergenciasSituacao}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAbaAtiva('conciliado');
                  setPaginaAtual(1);
                }}
                style={{
                  padding: '10px 16px',
                  fontSize: 13.5,
                  fontWeight: 600,
                  border: 'none',
                  borderBottom: abaAtiva === 'conciliado' ? '3px solid #15803d' : '3px solid transparent',
                  background: 'transparent',
                  color: abaAtiva === 'conciliado' ? '#15803d' : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>🟢 Conciliadas (100%)</span>
                <span
                  style={{
                    background: abaAtiva === 'conciliado' ? '#dcfce7' : '#f3f4f6',
                    color: abaAtiva === 'conciliado' ? '#15803d' : '#374151',
                    padding: '2px 8px',
                    borderRadius: 99,
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  {resultado.metricas.totalConciliadas}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAbaAtiva('todas');
                  setPaginaAtual(1);
                }}
                style={{
                  padding: '10px 16px',
                  fontSize: 13.5,
                  fontWeight: 600,
                  border: 'none',
                  borderBottom: abaAtiva === 'todas' ? '3px solid #1f2937' : '3px solid transparent',
                  background: 'transparent',
                  color: abaAtiva === 'todas' ? '#1f2937' : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>📋 Todas as Notas</span>
                <span
                  style={{
                    background: '#f3f4f6',
                    color: '#374151',
                    padding: '2px 8px',
                    borderRadius: 99,
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  {resultado.itens.length}
                </span>
              </button>
            </div>

            {/* BARRA DE FILTROS E BUSCA */}
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: 16,
              }}
            >
              {/* Campo de Busca */}
              <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                <Search
                  size={16}
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
                />
                <input
                  type="text"
                  placeholder="Buscar por número da nota, chave de 44 dígitos, nome ou CNPJ do parceiro..."
                  className="form-input"
                  value={busca}
                  onChange={e => {
                    setBusca(e.target.value);
                    setPaginaAtual(1);
                  }}
                  style={{ paddingLeft: 36, width: '100%', fontSize: 13 }}
                />
                {busca && (
                  <button
                    type="button"
                    onClick={() => setBusca('')}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#9ca3af',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filtro de Tipo */}
              <select
                className="form-input"
                value={filtroTipo}
                onChange={e => {
                  setFiltroTipo(e.target.value as any);
                  setPaginaAtual(1);
                }}
                style={{ width: 'auto', minWidth: 140, fontSize: 13 }}
              >
                <option value="todos">Todos os Documentos</option>
                <option value="nfe">NF-e / NFC-e</option>
                <option value="cte">CT-e (Transportes)</option>
                <option value="nfse">NFS-e (Serviços)</option>
              </select>

              {/* Filtro de Operação */}
              <select
                className="form-input"
                value={filtroOperacao}
                onChange={e => {
                  setFiltroOperacao(e.target.value as any);
                  setPaginaAtual(1);
                }}
                style={{ width: 'auto', minWidth: 130, fontSize: 13 }}
              >
                <option value="todas">Entradas e Saídas</option>
                <option value="entrada">Apenas Entradas (Compras/Tomados)</option>
                <option value="saida">Apenas Saídas (Vendas/Prestados)</option>
              </select>

              <div style={{ fontSize: 13, color: '#6b7280', marginLeft: 'auto' }}>
                Exibindo <strong>{itensFiltrados.length}</strong> de {resultado.itens.length} registros
              </div>
            </div>

            {/* TABELA DE RESULTADOS */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: '#374151' }}>Status / Apontamento</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151' }}>Tipo</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151' }}>Nº / Série</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151' }}>Emissão</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151' }}>Operação</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151' }}>Contraparte (Cliente / Fornecedor)</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Valor SPED</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Valor Sistema</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Diferença</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151' }}>Chave de Acesso</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: '#374151' }}>Análise / Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensPaginados.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: 'center', padding: '40px 16px', color: '#6b7280' }}>
                          Nenhum documento encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      itensPaginados.map(item => {
                        const isOmissaoSped = item.status === 'faltando_no_sped';
                        const isOmissaoSistema = item.status === 'faltando_no_sistema';
                        const isDivergenciaValor = item.status === 'valor_divergente';
                        const isDivergenciaStatus = item.status === 'situacao_divergente';
                        const isConciliada = item.status === 'conciliado';

                        return (
                          <tr
                            key={item.id}
                            style={{
                              borderBottom: '1px solid #f3f4f6',
                              background: isOmissaoSped ? '#fefefe' : '#ffffff',
                            }}
                          >
                            {/* STATUS */}
                            <td style={{ padding: '12px 16px' }}>
                              {isOmissaoSped && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    background: '#fee2e2',
                                    color: '#991b1b',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                  }}
                                >
                                  <AlertCircle size={12} /> Faltando no SPED
                                </span>
                              )}
                              {isOmissaoSistema && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                  }}
                                >
                                  <AlertTriangle size={12} /> Faltando no Sistema
                                </span>
                              )}
                              {isDivergenciaValor && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    background: '#fae8ff',
                                    color: '#86198f',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                  }}
                                >
                                  <Info size={12} /> Valor Divergente
                                </span>
                              )}
                              {isDivergenciaStatus && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    background: '#ffedd5',
                                    color: '#9a3412',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                  }}
                                >
                                  <AlertTriangle size={12} /> Status Divergente
                                </span>
                              )}
                              {isConciliada && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                  }}
                                >
                                  <CheckCircle2 size={12} /> Conciliado 100%
                                </span>
                              )}
                            </td>

                            {/* TIPO */}
                            <td style={{ padding: '12px 14px' }}>
                              <span
                                style={{
                                  background:
                                    item.tipoDoc === 'nfe'
                                      ? '#fee2e2'
                                      : item.tipoDoc === 'cte'
                                      ? '#e0e7ff'
                                      : '#ecfdf5',
                                  color:
                                    item.tipoDoc === 'nfe'
                                      ? '#991b1b'
                                      : item.tipoDoc === 'cte'
                                      ? '#3730a3'
                                      : '#065f46',
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {item.tipoDoc.toUpperCase()} ({item.modelo})
                              </span>
                            </td>

                            {/* NUMERO / SERIE */}
                            <td style={{ padding: '12px 14px', fontWeight: 600, color: '#111827' }}>
                              {item.numero || 'S/N'}
                              {item.serie && <span style={{ fontSize: 11, color: '#6b7280' }}> / {item.serie}</span>}
                            </td>

                            {/* EMISSAO */}
                            <td style={{ padding: '12px 14px', color: '#4b5563', whiteSpace: 'nowrap' }}>
                              {fmt.date(item.dataEmissao)}
                            </td>

                            {/* OPERAÇÃO */}
                            <td style={{ padding: '12px 14px' }}>
                              {item.operacao === 'entrada' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#1d4ed8', fontSize: 12, fontWeight: 500 }}>
                                  <ArrowDownLeft size={13} /> Entrada
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#047857', fontSize: 12, fontWeight: 500 }}>
                                  <ArrowUpRight size={13} /> Saída
                                </span>
                              )}
                            </td>

                            {/* CONTRAPARTE */}
                            <td style={{ padding: '12px 14px', maxWidth: 220 }}>
                              <div style={{ fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.participanteNome || 'Não identificado'}
                              </div>
                              {item.participanteCnpjCpf && (
                                <div style={{ fontSize: 11, color: '#6b7280' }}>
                                  {item.participanteCnpjCpf}
                                </div>
                              )}
                            </td>

                            {/* VALOR SPED */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>
                              {item.valorSped != null ? fmt.currency(item.valorSped) : <span style={{ color: '#9ca3af' }}>—</span>}
                            </td>

                            {/* VALOR SISTEMA */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>
                              {item.valorSistema != null ? fmt.currency(item.valorSistema) : <span style={{ color: '#9ca3af' }}>—</span>}
                            </td>

                            {/* DIFERENÇA */}
                            <td
                              style={{
                                padding: '12px 14px',
                                textAlign: 'right',
                                fontWeight: 700,
                                color: item.diferencaValor !== 0 ? '#dc2626' : '#16a34a',
                              }}
                            >
                              {item.diferencaValor !== 0 ? fmt.currency(item.diferencaValor) : 'R$ 0,00'}
                            </td>

                            {/* CHAVE DE ACESSO */}
                            <td style={{ padding: '12px 14px' }}>
                              {item.chave ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span
                                    title={item.chave}
                                    style={{
                                      fontFamily: 'monospace',
                                      fontSize: 11,
                                      color: '#4b5563',
                                      maxWidth: 120,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {item.chave.slice(0, 6)}...{item.chave.slice(-6)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copiarChave(item.chave)}
                                    title="Copiar chave de acesso completa"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: copiouChave === item.chave ? '#16a34a' : '#9ca3af',
                                      padding: 2,
                                    }}
                                  >
                                    {copiouChave === item.chave ? <Check size={13} /> : <Copy size={13} />}
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: 11, color: '#9ca3af' }}>Sem chave</span>
                              )}
                            </td>

                            {/* MOTIVO */}
                            <td style={{ padding: '12px 16px', maxWidth: 260, fontSize: 12, color: '#4b5563' }}>
                              {item.motivo}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINAÇÃO */}
              {totalPaginas > 1 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 20px',
                    borderTop: '1px solid #e5e7eb',
                    background: '#f9fafb',
                    fontSize: 13,
                  }}
                >
                  <div style={{ color: '#6b7280' }}>
                    Página <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={paginaAtual <= 1}
                      onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                      style={{ fontSize: 12, padding: '4px 10px' }}
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={paginaAtual >= totalPaginas}
                      onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                      style={{ fontSize: 12, padding: '4px 10px' }}
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

