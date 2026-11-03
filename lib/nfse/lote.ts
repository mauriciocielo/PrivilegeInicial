// ============================================================
// NFS-e NACIONAL — cópia de notas e importação de planilha
// ============================================================
// Copiar e importar só criam rascunhos. A transmissão é sempre um passo separado.

import type { NfsE } from '../store';
import { apenasDigitos, cnpjValido, cpfValido, hojeBrasilia } from './dps';

export const MAX_LINHAS_IMPORTACAO = 1000;

export function mesAnterior(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number);
  return mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, '0')}`;
}

const mesAnoBr = (competencia: string) => `${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`;

/** vLiq = vServ - (vRetCP + vRetIRRF + vRetCSLL + ISS, se retido), como o Sefin calcula. */
export function estimarValoresNota(valorServicos: number, aliquotaIss: number, issRetido: boolean, retidoFederal = 0) {
  const valorIss = Math.round(valorServicos * aliquotaIss) / 100;
  const liquido = valorServicos - (issRetido ? valorIss : 0) - retidoFederal;
  return { valorIss, valorLiquido: Math.max(0, Math.round(liquido * 100) / 100) };
}

/** Já existe nota viva para o mesmo tomador, valor e competência? Evita cobrar o cliente duas vezes. */
export function existeNotaIgual(
  notas: Pick<NfsE, 'status' | 'tomadorCnpjCpf' | 'valorServicos' | 'dataCompetencia' | 'id' | 'chaveAcesso'>[],
  alvo: { tomadorCnpjCpf: string; valorServicos: number; dataCompetencia: string; idIgnorado?: string },
): boolean {
  const doc = apenasDigitos(alvo.tomadorCnpjCpf);
  return notas.some(n =>
    n.id !== alvo.idIgnorado
    && n.status !== 'cancelada'
    // Nota simulada nunca existiu no Sefin: não bloqueia a emissão real.
    && (n.status === 'rascunho' || !!n.chaveAcesso)
    && n.dataCompetencia === alvo.dataCompetencia
    && apenasDigitos(n.tomadorCnpjCpf) === doc
    && Math.abs(n.valorServicos - alvo.valorServicos) < 0.005);
}

export type DadosCopiaveis = Partial<NfsE> & Pick<NfsE, 'tomadorCnpjCpf' | 'tomadorRazaoSocial' | 'discriminacao' | 'codigoServico' | 'valorServicos' | 'dataCompetencia'>;

/**
 * Dados do rascunho copiado. Fica de fora tudo que identifica a nota original no
 * Sefin (chave, nDPS, número): reaproveitar o nDPS devolveria a nota antiga.
 */
export function copiarParaCompetencia(original: NfsE, competencia: string, atualizarDescricao: boolean): DadosCopiaveis {
  const discriminacao = atualizarDescricao
    ? original.discriminacao.split(mesAnoBr(original.dataCompetencia)).join(mesAnoBr(competencia))
    : original.discriminacao;
  return {
    clienteId: original.clienteId,
    tomadorCnpjCpf: original.tomadorCnpjCpf,
    tomadorRazaoSocial: original.tomadorRazaoSocial,
    tomadorEmail: original.tomadorEmail,
    tomadorEndereco: original.tomadorEndereco,
    tomadorNumero: original.tomadorNumero,
    tomadorBairro: original.tomadorBairro,
    tomadorCidade: original.tomadorCidade,
    tomadorUf: original.tomadorUf,
    tomadorCep: original.tomadorCep,
    tomadorCodigoMunicipio: original.tomadorCodigoMunicipio,
    tomadorInscricaoMunicipal: original.tomadorInscricaoMunicipal,
    dataCompetencia: competencia,
    codigoServico: original.codigoServico,
    cTribMun: original.cTribMun,
    cNbs: original.cNbs,
    cnae: original.cnae,
    discriminacao,
    municipioPrestacao: original.municipioPrestacao,
    valorServicos: original.valorServicos,
    issRetido: original.issRetido,
    aliquotaIss: original.aliquotaIss,
    valorIr: original.valorIr,
    valorPis: original.valorPis,
    valorCofins: original.valorCofins,
    valorCsll: original.valorCsll,
    valorInss: original.valorInss,
  };
}

// ------------------------------------------------------------
// Planilha
// ------------------------------------------------------------

export const COLUNAS_MODELO = [
  'tomador_documento', 'tomador_nome', 'valor', 'descricao', 'competencia',
  'codigo_tributacao_nacional', 'codigo_tributacao_municipal', 'codigo_nbs', 'municipio_prestacao_ibge',
  'iss_retido', 'aliquota_iss', 'tomador_email', 'tomador_inscricao_municipal',
  'tomador_cep', 'tomador_ibge', 'tomador_logradouro', 'tomador_numero', 'tomador_bairro', 'vencimento',
] as const;

type Coluna = typeof COLUNAS_MODELO[number];

const SINONIMOS: Record<string, Coluna> = {
  documento: 'tomador_documento', cnpj: 'tomador_documento', cpf: 'tomador_documento', cpf_cnpj: 'tomador_documento', cnpj_cpf: 'tomador_documento', cnpj_tomador: 'tomador_documento', cpf_cnpj_tomador: 'tomador_documento',
  tomador: 'tomador_nome', cliente: 'tomador_nome', nome: 'tomador_nome', razao_social: 'tomador_nome', nome_tomador: 'tomador_nome',
  valor_servico: 'valor', valor_servicos: 'valor', valor_do_servico: 'valor', valor_dos_servicos: 'valor',
  discriminacao: 'descricao', descricao_servico: 'descricao', descricao_do_servico: 'descricao', servico: 'descricao',
  mes_competencia: 'competencia',
  codigo_servico: 'codigo_tributacao_nacional', ctribnac: 'codigo_tributacao_nacional', cod_tributacao_nacional: 'codigo_tributacao_nacional',
  ctribmun: 'codigo_tributacao_municipal', cod_tributacao_municipal: 'codigo_tributacao_municipal',
  nbs: 'codigo_nbs', cnbs: 'codigo_nbs',
  municipio_prestacao: 'municipio_prestacao_ibge',
  retido: 'iss_retido',
  aliquota: 'aliquota_iss',
  email: 'tomador_email',
  cep: 'tomador_cep', ibge: 'tomador_ibge', logradouro: 'tomador_logradouro', endereco: 'tomador_logradouro', tomador_endereco: 'tomador_logradouro', numero: 'tomador_numero', bairro: 'tomador_bairro',
  data_vencimento: 'vencimento',
};

function normalizarCabecalho(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

const emTexto = (v: unknown) => (v === null || v === undefined ? '' : v instanceof Date ? '' : String(v).trim());

/** Excel apaga zeros à esquerda de células numéricas: o documento volta ao tamanho certo. */
function normalizarDocumento(v: unknown): string {
  const d = apenasDigitos(emTexto(v));
  if (d.length > 0 && d.length < 11) return d.padStart(11, '0');
  if (d.length === 12 || d.length === 13) return d.padStart(14, '0');
  return d;
}

function formatarDocumento(d: string): string {
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

export function lerValor(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let t = emTexto(v).replace(/R\$/gi, '').replace(/\s/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Datas de célula chegam perto da meia-noite local, às vezes segundos antes: o meio-dia absorve o desvio.
function dataDaCelula(d: Date): string {
  const ajustada = new Date(d.getTime() + 12 * 3600 * 1000);
  return `${ajustada.getFullYear()}-${String(ajustada.getMonth() + 1).padStart(2, '0')}-${String(ajustada.getDate()).padStart(2, '0')}`;
}

export function lerCompetencia(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : dataDaCelula(v).slice(0, 7);
  const t = emTexto(v);
  let m = t.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (m) return validarMes(m[1], m[2]);
  m = t.match(/^(?:\d{1,2}\/)?(\d{1,2})\/(\d{4})$/);
  if (m) return validarMes(m[2], m[1]);
  return null;
}

function validarMes(ano: string, mes: string): string | null {
  const n = Number(mes);
  return n >= 1 && n <= 12 ? `${ano}-${String(n).padStart(2, '0')}` : null;
}

export function lerData(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : dataDaCelula(v);
  const t = emTexto(v);
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return t;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

function lerSimNao(v: unknown): boolean {
  return ['s', 'sim', 'x', '1', 'true', 'verdadeiro', 'retido'].includes(emTexto(v).toLowerCase());
}

export interface PadroesImportacao {
  competencia: string;
  cTribNac?: string | null;
  cTribMun?: string | null;
  cNbs?: string | null;
  municipioPrestacao?: string | null;
}

export interface ClienteImportacao {
  id: string;
  nome: string;
  cpfCnpj: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

export interface LinhaImportada {
  linha: number;
  dados: DadosCopiaveis;
  erros: string[];
}

export function interpretarLinhas(
  linhas: Record<string, unknown>[],
  padroes: PadroesImportacao,
  clientes: ClienteImportacao[],
  agora: Date = new Date(),
): LinhaImportada[] {
  const clientePorDoc = new Map(clientes.map(c => [apenasDigitos(c.cpfCnpj), c]));
  const mesAtual = hojeBrasilia(agora).slice(0, 7);
  const resultado: LinhaImportada[] = [];

  linhas.forEach((bruta, indice) => {
    const c: Partial<Record<Coluna, unknown>> = {};
    for (const [nome, valor] of Object.entries(bruta)) {
      const chave = normalizarCabecalho(nome);
      const coluna = (COLUNAS_MODELO as readonly string[]).includes(chave) ? chave as Coluna : SINONIMOS[chave];
      if (coluna && c[coluna] === undefined) c[coluna] = valor;
    }
    if (Object.values(bruta).every(v => emTexto(v) === '' && !(v instanceof Date))) return;

    const erros: string[] = [];
    const doc = normalizarDocumento(c.tomador_documento);
    if (doc.length === 14 ? !cnpjValido(doc) : !cpfValido(doc)) erros.push('CPF/CNPJ inválido');
    const cliente = clientePorDoc.get(doc);

    const nome = emTexto(c.tomador_nome) || cliente?.nome || '';
    if (!nome) erros.push('nome do tomador ausente');

    const valor = lerValor(c.valor);
    if (valor === null || valor <= 0) erros.push('valor inválido');

    const descricao = emTexto(c.descricao);
    if (!descricao) erros.push('descrição ausente');

    const celulaCompetencia = c.competencia;
    const temCompetencia = celulaCompetencia instanceof Date || !!emTexto(celulaCompetencia);
    const competencia = temCompetencia ? lerCompetencia(celulaCompetencia) : padroes.competencia;
    if (!competencia) erros.push('competência inválida (use MM/AAAA)');
    else if (competencia > mesAtual) erros.push('competência futura');

    // Excel apaga o zero à esquerda de códigos como 010101.
    const codigoBruto = apenasDigitos(emTexto(c.codigo_tributacao_nacional)) || apenasDigitos(padroes.cTribNac);
    const codigo = codigoBruto ? codigoBruto.padStart(6, '0') : '';
    if (!/^\d{6}$/.test(codigo)) erros.push('código de tributação nacional ausente ou inválido');

    const nbsBruto = apenasDigitos(emTexto(c.codigo_nbs)) || apenasDigitos(padroes.cNbs);
    const nbs = nbsBruto ? nbsBruto.padStart(9, '0') : '';
    if (nbs && nbs.length !== 9) erros.push('código NBS inválido');

    const municipio = apenasDigitos(emTexto(c.municipio_prestacao_ibge)) || apenasDigitos(padroes.municipioPrestacao);
    if (municipio.length !== 7) erros.push('município da prestação sem código IBGE de 7 dígitos');

    const aliquotaBruta = emTexto(c.aliquota_iss);
    const aliquota = aliquotaBruta ? lerValor(c.aliquota_iss) : 0;
    if (aliquota === null || aliquota < 0) erros.push('alíquota inválida');

    const celulaVencimento = c.vencimento;
    const temVencimento = celulaVencimento instanceof Date || !!emTexto(celulaVencimento);
    const vencimento = temVencimento ? lerData(celulaVencimento) : null;
    if (temVencimento && !vencimento) erros.push('vencimento inválido');

    resultado.push({
      linha: indice + 2, // a linha 1 é o cabeçalho
      erros,
      dados: {
        clienteId: cliente?.id,
        tomadorCnpjCpf: cliente?.cpfCnpj || formatarDocumento(doc),
        tomadorRazaoSocial: nome,
        tomadorEmail: emTexto(c.tomador_email) || cliente?.email || '',
        tomadorInscricaoMunicipal: emTexto(c.tomador_inscricao_municipal),
        tomadorEndereco: emTexto(c.tomador_logradouro) || cliente?.endereco || '',
        tomadorNumero: emTexto(c.tomador_numero),
        tomadorBairro: emTexto(c.tomador_bairro),
        tomadorCep: emTexto(c.tomador_cep) || cliente?.cep || '',
        tomadorCodigoMunicipio: apenasDigitos(emTexto(c.tomador_ibge)),
        tomadorCidade: cliente?.cidade || '',
        tomadorUf: cliente?.estado || '',
        dataCompetencia: competencia || '',
        codigoServico: codigo,
        cTribMun: emTexto(c.codigo_tributacao_municipal) || padroes.cTribMun || '',
        cNbs: nbs,
        discriminacao: descricao,
        municipioPrestacao: municipio,
        valorServicos: Math.round((valor || 0) * 100) / 100,
        issRetido: lerSimNao(c.iss_retido),
        aliquotaIss: aliquota || 0,
        vencimento: vencimento || undefined,
      },
    });
  });

  return resultado;
}

function decodificarTexto(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer); // CSV salvo pelo Excel em português
  }
}

/** Lê a primeira aba. Em CSV todas as células ficam como texto, preservando zeros à esquerda. */
export async function lerPlanilha(buffer: ArrayBuffer, nomeArquivo: string): Promise<Record<string, unknown>[]> {
  const XLSX = await import('xlsx');
  const ehCsv = /\.(csv|txt)$/i.test(nomeArquivo);
  const planilha = ehCsv
    ? XLSX.read(decodificarTexto(buffer), { type: 'string', raw: true })
    : XLSX.read(buffer, { type: 'array', cellDates: true });
  const aba = planilha.Sheets[planilha.SheetNames[0]];
  return aba ? XLSX.utils.sheet_to_json<Record<string, unknown>>(aba, { defval: '' }) : [];
}

export async function baixarModeloImportacao(): Promise<void> {
  const XLSX = await import('xlsx');
  const exemplo: Record<Coluna, string> = {
    tomador_documento: '11.222.333/0001-81',
    tomador_nome: 'Cliente Exemplo Ltda',
    valor: '1500,00',
    descricao: 'Serviço de consultoria referente a 10/2026',
    competencia: '10/2026',
    codigo_tributacao_nacional: '',
    codigo_tributacao_municipal: '',
    codigo_nbs: '',
    municipio_prestacao_ibge: '',
    iss_retido: 'não',
    aliquota_iss: '',
    tomador_email: 'financeiro@exemplo.com.br',
    tomador_inscricao_municipal: '',
    tomador_cep: '',
    tomador_ibge: '',
    tomador_logradouro: '',
    tomador_numero: '',
    tomador_bairro: '',
    vencimento: '',
  };
  const aba = XLSX.utils.json_to_sheet([exemplo], { header: [...COLUNAS_MODELO] });
  const planilha = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(planilha, aba, 'Notas');
  XLSX.writeFile(planilha, 'modelo-importacao-nfse.xlsx');
}
