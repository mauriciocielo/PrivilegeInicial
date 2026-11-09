// ============================================================
// Remessa de cobrança CNAB 240 — SICOOB (código 756)
// ============================================================
// Gera o arquivo de remessa (.REM) para enviar boletos ao Sicoob.
// Layout portado do BRCobranca (kivanio/brcobranca, MIT) — lib/brcobranca/remessa/cnab240/sicoob.rb.
// Regras puras: não acessa banco nem rede. Cada registro tem exatamente 240 caracteres.
//
// ATENÇÃO: o arquivo gerado precisa passar pela HOMOLOGAÇÃO do Sicoob antes do uso em produção.
// Os dígitos verificadores de agência/conta e os códigos (convênio, carteira, modalidade) devem
// ser exatamente os fornecidos pelo banco ao beneficiário.

const BANCO = '756';
const NOME_BANCO = 'SICOOB';
const VERSAO_ARQUIVO = '081';
const VERSAO_LOTE = '040';

export interface BeneficiarioSicoob {
  empresaMae: string;        // Razão social do beneficiário
  documentoCedente: string;  // CNPJ (14) ou CPF (11) do beneficiário
  agencia: string;           // 4 dígitos
  digitoAgencia?: string;    // 1 dígito (como o banco informou; padrão espaço)
  conta: string;             // até 12 dígitos
  digitoConta: string;       // 1 dígito verificador da conta (do banco)
  modalidadeCarteira?: string; // 2 dígitos (padrão '01')
  tipoFormulario?: string;   // 1 (padrão '4' — A4 sem envelopamento)
  parcela?: string;          // 2 (padrão '01')
  sequencialRemessa: number; // nº da remessa; não pode repetir nem zerar
  mensagem1?: string;
  mensagem2?: string;
}

export interface SacadoCnab {
  documento: string; // CPF/CNPJ do pagador
  nome: string;
  endereco: string;
  bairro?: string;
  cep: string;       // 8 dígitos
  cidade: string;
  uf: string;        // 2 letras
}

export interface PagamentoCnab {
  nossoNumero: string | number; // até 10 dígitos
  numeroDocumento: string | number; // "seu número" / identificação do título
  valor: number;                // em reais
  dataVencimento: string;       // YYYY-MM-DD
  dataEmissao?: string;         // YYYY-MM-DD (padrão: hoje)
  sacado: SacadoCnab;
  multaPercentual?: number;     // % de multa (0 = sem)
  jurosValor?: number;          // valor de juros/mora ao dia (0 = sem)
  descontoValor?: number;       // valor de desconto (0 = sem)
  descontoData?: string;        // YYYY-MM-DD do desconto
  protesto?: boolean;           // protestar? (padrão: não)
  diasProtesto?: number;
}

// ---------- Helpers de formatação ----------

const soDigitos = (v: string | number) => String(v ?? '').replace(/\D/g, '');

const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, ' ');

/** Texto de tamanho fixo: maiúsculo, sem acento, cortado e preenchido com espaço à direita. */
function texto(valor: string, tamanho: number): string {
  return semAcento(String(valor ?? '')).toUpperCase().slice(0, tamanho).padEnd(tamanho, ' ');
}

/** Número à direita com zeros à esquerda (só dígitos). */
function numZ(valor: string | number, tamanho: number): string {
  return soDigitos(valor).slice(-tamanho).padStart(tamanho, '0');
}

/** Valor monetário em centavos, com zeros à esquerda. */
function valorZ(valor: number, tamanho: number): string {
  return String(Math.round((valor || 0) * 100)).padStart(tamanho, '0').slice(-tamanho);
}

const zeros = (n: number) => '0'.repeat(n);
const espacos = (n: number) => ' '.repeat(n);

/** ddmmaaaa a partir de YYYY-MM-DD (ou '00000000' se vazio). */
function dataDDMMAAAA(iso?: string): string {
  if (!iso) return zeros(8);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}${m[2]}${m[1]}` : zeros(8);
}

/** 1 = CPF (<=11), 2 = CNPJ. */
const tipoInscricao = (doc: string) => (soDigitos(doc).length > 11 ? '2' : '1');

/** Dígito verificador por módulo 11 (pesos 2..9, da direita). DV 10 ou 11 → '0'. Util opcional. */
export function modulo11Sicoob(num: string): string {
  const digitos = soDigitos(num);
  let soma = 0;
  let peso = 2;
  for (let i = digitos.length - 1; i >= 0; i--) {
    soma += Number(digitos[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const dv = 11 - (soma % 11);
  return dv >= 10 ? '0' : String(dv);
}

// ---------- Blocos ----------

function infoConta(b: BeneficiarioSicoob): string {
  // agência(5) + DV agência(1) + conta(12) + DV conta(1) + espaço(1) = 20
  return numZ(b.agencia, 5) + (b.digitoAgencia?.trim() ? b.digitoAgencia.trim()[0] : ' ')
    + numZ(b.conta, 12) + (soDigitos(b.digitoConta)[0] ?? '0') + ' ';
}

/** Nosso número no layout Sicoob (20): nº(10) + parcela(2) + modalidade(2) + tipoForm(1) + 5 espaços. */
function nossoNumeroFmt(p: PagamentoCnab, b: BeneficiarioSicoob): string {
  return numZ(p.nossoNumero, 10) + (b.parcela || '01').padStart(2, '0')
    + (b.modalidadeCarteira || '01').padStart(2, '0') + (b.tipoFormulario || '4').slice(0, 1) + espacos(5);
}

function headerArquivo(b: BeneficiarioSicoob, dataGer: Date): string {
  const linha =
    BANCO + '0000' + '0' + espacos(9)
    + tipoInscricao(b.documentoCedente) + numZ(b.documentoCedente, 14)
    + espacos(20)                 // código convênio (Sicoob: brancos)
    + infoConta(b)
    + texto(b.empresaMae, 30) + texto(NOME_BANCO, 30) + espacos(10)
    + '1'
    + ddmmaaaaDe(dataGer) + horaDe(dataGer)
    + numZ(b.sequencialRemessa, 6) + VERSAO_ARQUIVO + '00000'
    + espacos(20) + espacos(20) + espacos(29);
  return garante240(linha, 'header arquivo');
}

function headerLote(b: BeneficiarioSicoob, dataGer: Date): string {
  const linha =
    BANCO + '0001' + '1' + 'R' + '01' + espacos(2) + VERSAO_LOTE + ' '
    + tipoInscricao(b.documentoCedente) + numZ(b.documentoCedente, 15)
    + espacos(20)                 // convênio lote (brancos)
    + infoConta(b)
    + texto(b.empresaMae, 30)
    + texto(b.mensagem1 || '', 40) + texto(b.mensagem2 || '', 40)
    + numZ(b.sequencialRemessa, 8) + ddmmaaaaDe(dataGer) + zeros(8) + espacos(33);
  return garante240(linha, 'header lote');
}

function segmentoP(p: PagamentoCnab, b: BeneficiarioSicoob, seq: number): string {
  const moraLigada = (p.jurosValor || 0) > 0;
  const descontoLigado = (p.descontoValor || 0) > 0;
  const linha =
    BANCO + '0001' + '3' + numZ(seq, 5) + 'P' + ' ' + '01'
    + numZ(b.agencia, 5) + (b.digitoAgencia?.trim() ? b.digitoAgencia.trim()[0] : ' ')
    + numZ(b.conta, 12) + (soDigitos(b.digitoConta)[0] ?? '0') + ' '
    + nossoNumeroFmt(p, b)
    + '1'   // código carteira
    + '0'   // forma de cadastramento
    + ' '   // tipo de documento
    + '2'   // emissão boleto (cliente emite)
    + '2'   // distribuição (cliente distribui)
    + numZ(p.numeroDocumento, 15)
    + dataDDMMAAAA(p.dataVencimento) + valorZ(p.valor, 15)
    + '00000' + ' '           // agência cobradora + DV
    + '02' + 'N'              // espécie do título (DM) + aceite
    + dataDDMMAAAA(p.dataEmissao || hojeISO())
    + (moraLigada ? '1' : '3')                              // tipo de mora
    + (moraLigada ? dataDDMMAAAA(p.dataVencimento) : zeros(8))
    + valorZ(p.jurosValor || 0, 15)
    + (descontoLigado ? '1' : '0')                          // código desconto
    + (descontoLigado ? dataDDMMAAAA(p.descontoData || p.dataVencimento) : zeros(8))
    + valorZ(p.descontoValor || 0, 15)
    + zeros(15)               // IOF
    + zeros(15)               // abatimento
    + texto(String(p.numeroDocumento ?? ''), 25)           // id. do título na empresa
    + (p.protesto ? '1' : '3')                              // código de protesto
    + numZ(p.protesto ? (p.diasProtesto || 5) : 0, 2)
    + '0'                     // código de baixa
    + espacos(3)              // dias para baixa (Sicoob: brancos)
    + '09' + zeros(10) + ' ';
  return garante240(linha, 'segmento P');
}

function segmentoQ(p: PagamentoCnab, seq: number): string {
  const s = p.sacado;
  const cep = numZ(s.cep, 8);
  const linha =
    BANCO + '0001' + '3' + numZ(seq, 5) + 'Q' + ' ' + '01'
    + tipoInscricao(s.documento) + numZ(s.documento, 15)
    + texto(s.nome, 40) + texto(s.endereco, 40) + texto(s.bairro || '', 15)
    + cep.slice(0, 5) + cep.slice(5, 8)
    + texto(s.cidade, 15) + texto(s.uf, 2)
    + '0' + zeros(15) + espacos(40)   // avalista (nenhum)
    + '000' + espacos(20) + espacos(8);
  return garante240(linha, 'segmento Q');
}

function segmentoR(p: PagamentoCnab, seq: number): string {
  const multaLigada = (p.multaPercentual || 0) > 0;
  const linha =
    BANCO + '0001' + '3' + numZ(seq, 5) + 'R' + ' ' + '01'
    + '0' + zeros(8) + zeros(15)   // desconto 2
    + '0' + zeros(8) + zeros(15)   // desconto 3
    + (multaLigada ? '2' : '0')    // código da multa (2 = percentual)
    + (multaLigada ? dataDDMMAAAA(p.dataVencimento) : zeros(8))
    + valorZ(p.multaPercentual || 0, 15)
    + espacos(10) + espacos(40) + espacos(40) + espacos(20)
    + zeros(8) + zeros(3) + zeros(5) + ' ' + zeros(12) + ' ' + ' ' + '0' + espacos(9);
  return garante240(linha, 'segmento R');
}

function trailerLote(qtdPagamentos: number, somaValores: number): string {
  const registrosNoLote = 2 + qtdPagamentos * 3; // header lote + P/Q/R por título + trailer lote
  const linha =
    BANCO + '0001' + '5' + espacos(9) + numZ(registrosNoLote, 6)
    + numZ(qtdPagamentos, 6) + valorZ(somaValores, 17)
    + zeros(23) + zeros(23) + zeros(23) + espacos(125);
  return garante240(linha, 'trailer lote');
}

function trailerArquivo(totalLinhas: number): string {
  const linha =
    BANCO + '99999' + espacos(9) + '000001' + numZ(totalLinhas, 6) + zeros(6) + espacos(205);
  return garante240(linha, 'trailer arquivo');
}

// datas/horas de geração (ddmmaaaa / HHMMSS)
function ddmmaaaaDe(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}${p(d.getMonth() + 1)}${d.getFullYear()}`;
}
function horaDe(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
const hojeISO = () => new Date().toISOString().slice(0, 10);

function garante240(linha: string, nome: string): string {
  if (linha.length !== 240) {
    throw new Error(`Linha CNAB "${nome}" tem ${linha.length} caracteres (esperado 240).`);
  }
  return linha;
}

export class RemessaSicoobInvalidaError extends Error {}

/** Valida o mínimo necessário antes de gerar. */
function validar(b: BeneficiarioSicoob, pagamentos: PagamentoCnab[]): void {
  const faltando: string[] = [];
  if (!b.empresaMae?.trim()) faltando.push('razão social do beneficiário');
  if (soDigitos(b.documentoCedente).length < 11) faltando.push('CNPJ/CPF do beneficiário');
  if (soDigitos(b.agencia).length < 1) faltando.push('agência');
  if (soDigitos(b.conta).length < 1) faltando.push('conta');
  if (!(b.sequencialRemessa > 0)) faltando.push('sequencial da remessa (> 0)');
  if (!pagamentos.length) faltando.push('ao menos um boleto');
  if (faltando.length) throw new RemessaSicoobInvalidaError('Faltam dados para a remessa: ' + faltando.join(', ') + '.');

  pagamentos.forEach((p, i) => {
    const n = i + 1;
    if (!(p.valor > 0)) throw new RemessaSicoobInvalidaError(`Boleto ${n}: valor inválido.`);
    if (!p.dataVencimento) throw new RemessaSicoobInvalidaError(`Boleto ${n}: sem vencimento.`);
    if (soDigitos(p.nossoNumero).length < 1) throw new RemessaSicoobInvalidaError(`Boleto ${n}: sem nosso número.`);
    if (!p.sacado?.nome?.trim()) throw new RemessaSicoobInvalidaError(`Boleto ${n}: sem nome do sacado.`);
    if (soDigitos(p.sacado?.documento).length < 11) throw new RemessaSicoobInvalidaError(`Boleto ${n}: CPF/CNPJ do sacado inválido.`);
  });
}

/**
 * Gera o conteúdo do arquivo de remessa CNAB 240 do Sicoob (uma string, linhas separadas por CRLF).
 */
export function gerarRemessaSicoob240(b: BeneficiarioSicoob, pagamentos: PagamentoCnab[], agora = new Date()): string {
  validar(b, pagamentos);

  const linhas: string[] = [];
  linhas.push(headerArquivo(b, agora));
  linhas.push(headerLote(b, agora));

  let seq = 0;
  let soma = 0;
  for (const p of pagamentos) {
    linhas.push(segmentoP(p, b, ++seq));
    linhas.push(segmentoQ(p, ++seq));
    linhas.push(segmentoR(p, ++seq));
    soma += p.valor || 0;
  }

  linhas.push(trailerLote(pagamentos.length, soma));
  linhas.push(trailerArquivo(linhas.length + 1)); // +1 inclui o próprio trailer de arquivo

  return linhas.join('\r\n') + '\r\n';
}

/** Nome sugerido do arquivo de remessa. */
export function nomeArquivoRemessa(sequencial: number, agora = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `REMESSA_SICOOB_${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}_${String(sequencial).padStart(4, '0')}.REM`;
}
