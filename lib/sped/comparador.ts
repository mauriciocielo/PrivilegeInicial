// ============================================================
// COMPARADOR SPED FISCAL / CONTRIBUIÇÕES VS SISTEMA (SEFAZ/ADN)
// ============================================================

export interface DocumentoSped {
  linha: number;
  registro: 'C100' | 'D100' | 'A100';
  modelo: string; // '55' (NF-e), '65' (NFC-e), '57' (CT-e), '01', etc.
  tipo: 'nfe' | 'cte' | 'nfse' | 'outros';
  operacao: 'entrada' | 'saida'; // entrada = 0, saida = 1
  chave: string; // 44 dígitos
  numero: string;
  serie: string;
  dataEmissao: string; // YYYY-MM-DD
  dataEntradaSaida?: string; // YYYY-MM-DD
  valorTotal: number;
  situacaoCodigo: string; // '00' = Regular, '02' = Cancelado, etc.
  situacaoDescricao: string;
  codParticipante: string;
  participanteNome?: string;
  participanteCnpjCpf?: string;
}

export interface DocumentoSistema {
  id: string;
  origem: 'nfe_destinada' | 'nfse';
  tipo: 'nfe' | 'cte' | 'nfse';
  chave: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  operacao: 'entrada' | 'saida';
  valorTotal: number;
  situacao: string; // 'autorizada' | 'cancelada' | 'denegada' | 'emitida'
  contraparteNome: string;
  contraparteCnpjCpf: string;
}

export type TipoDivergencia =
  | 'faltando_no_sped'    // Consta no Sistema (SEFAZ/ADN), mas não está escriturado no SPED!
  | 'faltando_no_sistema' // Consta no SPED, mas não foi importado no Sistema!
  | 'valor_divergente'    // Consta em ambos, mas o valor diverge!
  | 'situacao_divergente' // Consta em ambos, mas a situação diverge (ex: cancelada no SEFAZ vs regular no SPED)!
  | 'conciliado';         // Bateu 100% (chave, valor, situação).

export interface ItemComparacaoSped {
  id: string;
  chave: string;
  numero: string;
  serie: string;
  modelo: string;
  tipoDoc: 'nfe' | 'cte' | 'nfse' | 'outros';
  operacao: 'entrada' | 'saida';
  dataEmissao: string;
  participanteNome: string;
  participanteCnpjCpf: string;
  valorSped: number | null;
  valorSistema: number | null;
  diferencaValor: number;
  situacaoSped: string | null;
  situacaoSistema: string | null;
  status: TipoDivergencia;
  gravidade: 'alta' | 'media' | 'baixa' | 'ok';
  motivo: string;
}

export interface MetricasComparacaoSped {
  periodoInicio: string;
  periodoFim: string;
  mesCompetencia: string; // YYYY-MM
  empresaCnpj: string;
  empresaNomeSped: string;
  totalDocsSped: number;
  valorTotalSped: number;
  totalDocsSistema: number;
  valorTotalSistema: number;
  totalConciliadas: number;
  totalFaltandoNoSped: number;
  valorFaltandoNoSped: number;
  totalFaltandoNoSistema: number;
  valorFaltandoNoSistema: number;
  totalDivergenciasValor: number;
  totalDivergenciasSituacao: number;
  indiceAderenciaPct: number; // ex: 94.5%
}

export interface ResultadoComparacaoSped {
  metricas: MetricasComparacaoSped;
  itens: ItemComparacaoSped[];
  resumoPorTipo: {
    nfe: { sped: number; sistema: number; conciliadas: number; divergencias: number };
    cte: { sped: number; sistema: number; conciliadas: number; divergencias: number };
    nfse: { sped: number; sistema: number; conciliadas: number; divergencias: number };
  };
}

/** Converte DDMMAAAA em YYYY-MM-DD */
export function formatarDataSped(dataStr: string): string {
  const limpo = (dataStr || '').replace(/\D/g, '');
  if (limpo.length !== 8) return dataStr || '';
  const d = limpo.slice(0, 2);
  const m = limpo.slice(2, 4);
  const y = limpo.slice(4, 8);
  return `${y}-${m}-${d}`;
}

/** Converte valor decimal com vírgula do SPED em float */
export function parseDecimalSped(str: string): number {
  if (!str) return 0;
  const num = parseFloat(str.replace(/\./g, '').replace(',', '.'));
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

export const SITUACOES_SPED: Record<string, string> = {
  '00': 'Documento Regular',
  '01': 'Regular Extemporâneo',
  '02': 'Documento Cancelado',
  '03': 'Cancelado Extemporâneo',
  '04': 'NF-e / CT-e Denegado',
  '05': 'NF-e / CT-e Inutilizado',
  '06': 'Complementar',
  '07': 'Complementar Extemporâneo',
  '08': 'Regime Especial',
};

/**
 * Faz o parsing completo do arquivo SPED (.txt) em memória,
 * extraindo cadastro (0000), participantes (0150) e documentos (C100, D100, A100).
 */
export function parseSpedFiscalConteudo(conteudo: string): {
  cnpjEmpresa: string;
  razaoSocialSped: string;
  dataInicio: string;
  dataFim: string;
  mesCompetencia: string;
  documentos: DocumentoSped[];
} {
  const linhas = conteudo.split(/\r?\n/);

  let cnpjEmpresa = '';
  let razaoSocialSped = '';
  let dataInicio = '';
  let dataFim = '';
  let mesCompetencia = '';

  const participantes = new Map<string, { nome: string; cnpjCpf: string }>();
  const documentos: DocumentoSped[] = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha || !linha.startsWith('|')) continue;

    const f = linha.split('|');
    const registro = f[1]?.toUpperCase();

    // 0000: Abertura e Identificação
    if (registro === '0000') {
      const dtIni = f[4] || '';
      const dtFin = f[5] || '';
      razaoSocialSped = f[6] || '';
      cnpjEmpresa = (f[7] || f[8] || '').replace(/\D/g, '');

      dataInicio = formatarDataSped(dtIni);
      dataFim = formatarDataSped(dtFin);

      if (dataInicio && dataInicio.length >= 7) {
        mesCompetencia = dataInicio.slice(0, 7);
      }
    }

    // 0150: Cadastro de Participantes
    else if (registro === '0150') {
      const codPart = f[2] || '';
      const nome = f[3] || '';
      const cnpjCpf = (f[5] || f[6] || '').replace(/\D/g, '');
      if (codPart) {
        participantes.set(codPart, { nome, cnpjCpf });
      }
    }

    // C100: NF-e / NFC-e / Notas Fiscais
    else if (registro === 'C100') {
      const indOper = f[2]; // 0=entrada, 1=saída
      const codPart = f[4] || '';
      const codMod = f[5] || '55';
      const codSit = f[6] || '00';
      const serie = f[7] || '';
      const numDoc = f[8] || '';
      const chave = (f[9] || '').replace(/\D/g, '');
      const dtDoc = formatarDataSped(f[10]);
      const dtES = formatarDataSped(f[11]);
      const vlDoc = parseDecimalSped(f[12]);

      const part = participantes.get(codPart);

      let tipo: 'nfe' | 'outros' = 'nfe';
      if (codMod === '65') tipo = 'nfe'; // NFC-e tratada junto com NF-e
      else if (codMod !== '55') tipo = 'outros';

      documentos.push({
        linha: i + 1,
        registro: 'C100',
        modelo: codMod,
        tipo,
        operacao: indOper === '1' ? 'saida' : 'entrada',
        chave,
        numero: numDoc,
        serie,
        dataEmissao: dtDoc || dtES,
        dataEntradaSaida: dtES,
        valorTotal: vlDoc,
        situacaoCodigo: codSit,
        situacaoDescricao: SITUACOES_SPED[codSit] || `Situação ${codSit}`,
        codParticipante: codPart,
        participanteNome: part?.nome || 'Não informado',
        participanteCnpjCpf: part?.cnpjCpf || '',
      });
    }

    // D100: Conhecimento de Transporte (CT-e)
    else if (registro === 'D100') {
      const indOper = f[2]; // 0=aquisição/tomador, 1=prestação
      const codPart = f[4] || '';
      const codMod = f[5] || '57';
      const codSit = f[6] || '00';
      const serie = f[7] || '';
      const numDoc = f[9] || f[8] || '';
      const chave = (f[10] || f[9] || '').replace(/\D/g, '');
      const dtDoc = formatarDataSped(f[11]);
      const vlDoc = parseDecimalSped(f[12] || f[15]);

      const part = participantes.get(codPart);

      documentos.push({
        linha: i + 1,
        registro: 'D100',
        modelo: codMod,
        tipo: 'cte',
        operacao: indOper === '1' ? 'saida' : 'entrada',
        chave: chave.length === 44 ? chave : '',
        numero: numDoc,
        serie,
        dataEmissao: dtDoc,
        valorTotal: vlDoc,
        situacaoCodigo: codSit,
        situacaoDescricao: SITUACOES_SPED[codSit] || `Situação ${codSit}`,
        codParticipante: codPart,
        participanteNome: part?.nome || 'Não informado',
        participanteCnpjCpf: part?.cnpjCpf || '',
      });
    }

    // A100: Serviços (EFD Contribuições)
    else if (registro === 'A100') {
      const indOper = f[2];
      const codPart = f[4] || '';
      const numDoc = f[7] || f[8] || '';
      const chave = (f[8] || f[9] || '').replace(/\D/g, '');
      const dtDoc = formatarDataSped(f[9] || f[10]);
      const vlDoc = parseDecimalSped(f[11] || f[12]);

      const part = participantes.get(codPart);

      documentos.push({
        linha: i + 1,
        registro: 'A100',
        modelo: 'NFS-e',
        tipo: 'nfse',
        operacao: indOper === '1' ? 'saida' : 'entrada',
        chave,
        numero: numDoc,
        serie: '',
        dataEmissao: dtDoc,
        valorTotal: vlDoc,
        situacaoCodigo: '00',
        situacaoDescricao: 'Documento Regular',
        codParticipante: codPart,
        participanteNome: part?.nome || 'Não informado',
        participanteCnpjCpf: part?.cnpjCpf || '',
      });
    }
  }

  return {
    cnpjEmpresa,
    razaoSocialSped,
    dataInicio,
    dataFim,
    mesCompetencia,
    documentos,
  };
}

/**
 * Realiza o cruzamento das notas do SPED contra os documentos do Sistema.
 */
export function executarCruzamentoSped(
  docsSped: DocumentoSped[],
  docsSistema: DocumentoSistema[],
  metaSped: {
    cnpjEmpresa: string;
    razaoSocialSped: string;
    dataInicio: string;
    dataFim: string;
    mesCompetencia: string;
  }
): ResultadoComparacaoSped {
  const itens: ItemComparacaoSped[] = [];

  // Mapeamento das notas do SPED por chave (e fallback por número_série)
  const mapaSpedChave = new Map<string, DocumentoSped>();
  const mapaSpedNum = new Map<string, DocumentoSped>();

  for (const doc of docsSped) {
    if (doc.chave && doc.chave.length === 44) {
      mapaSpedChave.set(doc.chave, doc);
    }
    const chaveSecundaria = `${doc.tipo}_${doc.numero}_${doc.serie || ''}_${doc.operacao}`;
    mapaSpedNum.set(chaveSecundaria, doc);
  }

  // Mapeamento das notas do Sistema por chave
  const chavesSpedProcessadas = new Set<string>();

  let totalConciliadas = 0;
  let totalDivergenciasValor = 0;
  let totalDivergenciasSituacao = 0;
  let totalFaltandoNoSped = 0;
  let valorFaltandoNoSped = 0;

  const resumoPorTipo = {
    nfe: { sped: 0, sistema: 0, conciliadas: 0, divergencias: 0 },
    cte: { sped: 0, sistema: 0, conciliadas: 0, divergencias: 0 },
    nfse: { sped: 0, sistema: 0, conciliadas: 0, divergencias: 0 },
  };

  // Contabiliza totais no SPED por tipo
  for (const doc of docsSped) {
    if (doc.tipo in resumoPorTipo) {
      resumoPorTipo[doc.tipo as 'nfe' | 'cte' | 'nfse'].sped += 1;
    }
  }

  // 1. Itera sobre os documentos do SISTEMA para verificar se constam no SPED
  for (const docSis of docsSistema) {
    if (docSis.tipo in resumoPorTipo) {
      resumoPorTipo[docSis.tipo as 'nfe' | 'cte' | 'nfse'].sistema += 1;
    }

    const chaveSis = docSis.chave;
    let docSped = chaveSis ? mapaSpedChave.get(chaveSis) : undefined;

    if (!docSped && docSis.numero) {
      const chaveSecundaria = `${docSis.tipo}_${docSis.numero}_${docSis.serie || ''}_${docSis.operacao}`;
      docSped = mapaSpedNum.get(chaveSecundaria);
    }

    if (docSped) {
      // Documento encontrado em ambos: validar valor e situação
      if (docSped.chave) chavesSpedProcessadas.add(docSped.chave);
      const chaveSec = `${docSped.tipo}_${docSped.numero}_${docSped.serie || ''}_${docSped.operacao}`;
      chavesSpedProcessadas.add(chaveSec);

      const diffValor = Math.round(Math.abs(docSped.valorTotal - docSis.valorTotal) * 100) / 100;
      const ehCanceladaSis = docSis.situacao === 'cancelada';
      const ehCanceladaSped = docSped.situacaoCodigo === '02' || docSped.situacaoCodigo === '03';

      if (ehCanceladaSis !== ehCanceladaSped) {
        // Divergência crítica de situação
        totalDivergenciasSituacao += 1;
        if (docSis.tipo in resumoPorTipo) resumoPorTipo[docSis.tipo as 'nfe' | 'cte' | 'nfse'].divergencias += 1;

        itens.push({
          id: docSis.id || `div_sit_${docSis.chave}`,
          chave: docSis.chave || docSped.chave,
          numero: docSis.numero || docSped.numero,
          serie: docSis.serie || docSped.serie,
          modelo: docSped.modelo,
          tipoDoc: docSis.tipo,
          operacao: docSis.operacao,
          dataEmissao: docSis.dataEmissao || docSped.dataEmissao,
          participanteNome: docSis.contraparteNome || docSped.participanteNome || '—',
          participanteCnpjCpf: docSis.contraparteCnpjCpf || docSped.participanteCnpjCpf || '',
          valorSped: docSped.valorTotal,
          valorSistema: docSis.valorTotal,
          diferencaValor: diffValor,
          situacaoSped: docSped.situacaoDescricao,
          situacaoSistema: docSis.situacao,
          status: 'situacao_divergente',
          gravidade: 'alta',
          motivo: ehCanceladaSis
            ? 'Nota consta como CANCELADA na SEFAZ, mas está escriturada como Regular no SPED.'
            : 'Nota consta como CANCELADA no SPED, mas está Autorizada e Vigente na SEFAZ.',
        });
      } else if (diffValor > 0.05) {
        // Divergência de valor
        totalDivergenciasValor += 1;
        if (docSis.tipo in resumoPorTipo) resumoPorTipo[docSis.tipo as 'nfe' | 'cte' | 'nfse'].divergencias += 1;

        itens.push({
          id: docSis.id || `div_val_${docSis.chave}`,
          chave: docSis.chave || docSped.chave,
          numero: docSis.numero || docSped.numero,
          serie: docSis.serie || docSped.serie,
          modelo: docSped.modelo,
          tipoDoc: docSis.tipo,
          operacao: docSis.operacao,
          dataEmissao: docSis.dataEmissao || docSped.dataEmissao,
          participanteNome: docSis.contraparteNome || docSped.participanteNome || '—',
          participanteCnpjCpf: docSis.contraparteCnpjCpf || docSped.participanteCnpjCpf || '',
          valorSped: docSped.valorTotal,
          valorSistema: docSis.valorTotal,
          diferencaValor: diffValor,
          situacaoSped: docSped.situacaoDescricao,
          situacaoSistema: docSis.situacao,
          status: 'valor_divergente',
          gravidade: 'media',
          motivo: `Valor difere em R$ ${diffValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (SPED: R$ ${docSped.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vs Sistema: R$ ${docSis.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
        });
      } else {
        // 100% Conciliado
        totalConciliadas += 1;
        if (docSis.tipo in resumoPorTipo) resumoPorTipo[docSis.tipo as 'nfe' | 'cte' | 'nfse'].conciliadas += 1;

        itens.push({
          id: docSis.id || `conc_${docSis.chave}`,
          chave: docSis.chave || docSped.chave,
          numero: docSis.numero || docSped.numero,
          serie: docSis.serie || docSped.serie,
          modelo: docSped.modelo,
          tipoDoc: docSis.tipo,
          operacao: docSis.operacao,
          dataEmissao: docSis.dataEmissao || docSped.dataEmissao,
          participanteNome: docSis.contraparteNome || docSped.participanteNome || '—',
          participanteCnpjCpf: docSis.contraparteCnpjCpf || docSped.participanteCnpjCpf || '',
          valorSped: docSped.valorTotal,
          valorSistema: docSis.valorTotal,
          diferencaValor: 0,
          situacaoSped: docSped.situacaoDescricao,
          situacaoSistema: docSis.situacao,
          status: 'conciliado',
          gravidade: 'ok',
          motivo: 'Documento escriturado com chave, valor e situação 100% idênticos.',
        });
      }
    } else {
      // Documento presente no SISTEMA, mas NÃO FOI ENCONTRADO NO SPED (Omissão no SPED)
      // Se for denegada ou cancelada na SEFAZ e não escriturada, pode ser aceitável, mas autorizada é gravíssimo
      const ehCancelada = docSis.situacao === 'cancelada';
      if (!ehCancelada) {
        totalFaltandoNoSped += 1;
        valorFaltandoNoSped += docSis.valorTotal;
        if (docSis.tipo in resumoPorTipo) resumoPorTipo[docSis.tipo as 'nfe' | 'cte' | 'nfse'].divergencias += 1;

        itens.push({
          id: docSis.id || `falt_sped_${docSis.chave}`,
          chave: docSis.chave,
          numero: docSis.numero,
          serie: docSis.serie,
          modelo: docSis.tipo === 'cte' ? '57' : (docSis.tipo === 'nfse' ? 'NFS-e' : '55'),
          tipoDoc: docSis.tipo,
          operacao: docSis.operacao,
          dataEmissao: docSis.dataEmissao,
          participanteNome: docSis.contraparteNome,
          participanteCnpjCpf: docSis.contraparteCnpjCpf,
          valorSped: null,
          valorSistema: docSis.valorTotal,
          diferencaValor: docSis.valorTotal,
          situacaoSped: null,
          situacaoSistema: docSis.situacao,
          status: 'faltando_no_sped',
          gravidade: 'alta',
          motivo: 'Documento autorizado na SEFAZ/Prefeitura que NÃO foi declarado no arquivo SPED enviado.',
        });
      }
    }
  }

  // 2. Itera sobre os documentos do SPED para identificar os que NÃO FORAM ENCONTRADOS NO SISTEMA
  let totalFaltandoNoSistema = 0;
  let valorFaltandoNoSistema = 0;

  for (const docSped of docsSped) {
    const processado = (docSped.chave && chavesSpedProcessadas.has(docSped.chave)) ||
      chavesSpedProcessadas.has(`${docSped.tipo}_${docSped.numero}_${docSped.serie || ''}_${docSped.operacao}`);

    if (!processado) {
      totalFaltandoNoSistema += 1;
      valorFaltandoNoSistema += docSped.valorTotal;
      if (docSped.tipo in resumoPorTipo) resumoPorTipo[docSped.tipo as 'nfe' | 'cte' | 'nfse'].divergencias += 1;

      itens.push({
        id: `falt_sis_${docSped.chave || docSped.linha}`,
        chave: docSped.chave,
        numero: docSped.numero,
        serie: docSped.serie,
        modelo: docSped.modelo,
        tipoDoc: docSped.tipo,
        operacao: docSped.operacao,
        dataEmissao: docSped.dataEmissao,
        participanteNome: docSped.participanteNome || '—',
        participanteCnpjCpf: docSped.participanteCnpjCpf || '',
        valorSped: docSped.valorTotal,
        valorSistema: null,
        diferencaValor: docSped.valorTotal,
        situacaoSped: docSped.situacaoDescricao,
        situacaoSistema: null,
        status: 'faltando_no_sistema',
        gravidade: 'media',
        motivo: 'Nota escriturada na contabilidade pelo SPED que ainda não consta importada no sistema.',
      });
    }
  }

  // Ordena os itens: primeiros os de risco alto (faltando no sped / situacao divergente), depois media, e por fim conciliadas
  const ordemGravidade: Record<string, number> = {
    alta: 1,
    media: 2,
    baixa: 3,
    ok: 4,
  };
  itens.sort((a, b) => {
    const gDiff = ordemGravidade[a.gravidade] - ordemGravidade[b.gravidade];
    if (gDiff !== 0) return gDiff;
    return (b.valorSistema || b.valorSped || 0) - (a.valorSistema || a.valorSped || 0);
  });

  const totalBase = Math.max(1, docsSistema.length + totalFaltandoNoSistema);
  const indiceAderencia = Math.round((totalConciliadas / totalBase) * 1000) / 10;

  const valorTotalSped = Math.round(docsSped.reduce((s, d) => s + d.valorTotal, 0) * 100) / 100;
  const valorTotalSistema = Math.round(docsSistema.reduce((s, d) => s + d.valorTotal, 0) * 100) / 100;

  return {
    metricas: {
      periodoInicio: metaSped.dataInicio,
      periodoFim: metaSped.dataFim,
      mesCompetencia: metaSped.mesCompetencia,
      empresaCnpj: metaSped.cnpjEmpresa,
      empresaNomeSped: metaSped.razaoSocialSped,
      totalDocsSped: docsSped.length,
      valorTotalSped,
      totalDocsSistema: docsSistema.length,
      valorTotalSistema,
      totalConciliadas,
      totalFaltandoNoSped,
      valorFaltandoNoSped: Math.round(valorFaltandoNoSped * 100) / 100,
      totalFaltandoNoSistema,
      valorFaltandoNoSistema: Math.round(valorFaltandoNoSistema * 100) / 100,
      totalDivergenciasValor,
      totalDivergenciasSituacao,
      indiceAderenciaPct: indiceAderencia,
    },
    itens,
    resumoPorTipo,
  };
}

