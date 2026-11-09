// ============================================================
// Boleto SICOOB (756) — código de barras FEBRABAN + linha digitável
// ============================================================
// Regras numéricas portadas do BRCobranca (kivanio/brcobranca, MIT) — boleto/sicoob.rb e boleto/base.rb,
// mais o padrão FEBRABAN da linha digitável. Regras puras: não acessam banco nem rede.
//
// ATENÇÃO: conferir com o Sicoob (homologação) antes de usar em produção. O "convênio" é o código do
// beneficiário/cedente que o banco fornece (não é a conta corrente).

const soD = (v: string | number) => String(v ?? '').replace(/\D/g, '');

export interface BeneficiarioBoletoSicoob {
  agencia: string;   // 4 dígitos
  convenio: string;  // código do beneficiário/cedente (até 7 dígitos)
  carteira?: string; // 1 dígito (padrão '1')
  variacao?: string; // modalidade, 2 dígitos (padrão '01')
}

export interface DadosBoleto {
  nossoNumero: string | number; // até 7 dígitos
  valor: number;                // reais
  dataVencimento: string;       // YYYY-MM-DD
  quantidade?: string;          // nº de parcelas, 3 dígitos (padrão '001')
}

/** Módulo 10 (campos da linha digitável). */
export function modulo10(num: string): string {
  let soma = 0;
  let peso = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    let p = Number(num[i]) * peso;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    soma += p;
    peso = peso === 2 ? 1 : 2;
  }
  const dv = 10 - (soma % 10);
  return String(dv === 10 ? 0 : dv);
}

/** DV geral do código de barras: módulo 11, pesos 2..9 da direita; resto 0/1/10 → DV 1. */
export function dvGeralBarras(cod43: string): string {
  let soma = 0;
  let peso = 2;
  for (let i = cod43.length - 1; i >= 0; i--) {
    soma += Number(cod43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const dv = 11 - (soma % 11);
  return dv === 0 || dv === 10 || dv === 11 ? '1' : String(dv);
}

/** DV do nosso número Sicoob: módulo 11 sobre agência(4)+convênio(10)+nossoNumero(7), multiplicadores 3,1,9,7 da esquerda; 10/11 → 0. */
export function nossoNumeroDvSicoob(agencia: string, convenio: string, nossoNumero: string): string {
  const base = soD(agencia).padStart(4, '0').slice(-4)
    + soD(convenio).padStart(10, '0').slice(-10)
    + soD(nossoNumero).padStart(7, '0').slice(-7);
  const mult = [3, 1, 9, 7];
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * mult[i % 4];
  let dv = 11 - (soma % 11);
  if (dv >= 10) dv = 0;
  return String(dv);
}

/** Fator de vencimento FEBRABAN (base 07/10/1997 = 1000; cicla em 1000-9999, reinício em 22/02/2025). */
export function fatorVencimento(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '0000';
  const venc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const base = Date.UTC(1997, 9, 7); // 07/10/1997 — dias decorridos até o vencimento
  let fator = Math.floor((venc - base) / 86400000);
  while (fator > 9999) fator -= 9000; // ciclo 1000-9999 (virada em 22/02/2025)
  return String(fator).padStart(4, '0').slice(-4);
}

const valorFmt = (valor: number) => String(Math.round((valor || 0) * 100)).padStart(10, '0').slice(-10);

/** Nosso número com DV, como impresso (8 dígitos: 7 + DV). */
export function nossoNumeroFormatado(b: BeneficiarioBoletoSicoob, nossoNumero: string | number): string {
  const nn = soD(nossoNumero).padStart(7, '0').slice(-7);
  return nn + nossoNumeroDvSicoob(b.agencia, b.convenio, nn);
}

/** Campo livre do Sicoob (25): carteira(1)+agência(4)+variação(2)+convênio(7)+nossoNumero+DV(8)+quantidade(3). */
function campoLivreSicoob(b: BeneficiarioBoletoSicoob, d: DadosBoleto): string {
  return (b.carteira || '1').slice(0, 1)
    + soD(b.agencia).padStart(4, '0').slice(-4)
    + (b.variacao || '01').padStart(2, '0').slice(-2)
    + soD(b.convenio).padStart(7, '0').slice(-7)
    + nossoNumeroFormatado(b, d.nossoNumero)
    + (d.quantidade || '001').padStart(3, '0').slice(-3);
}

export interface BoletoSicoob {
  codigoBarras: string;      // 44 dígitos
  linhaDigitavel: string;    // formatada com pontos e espaços
  nossoNumero: string;       // com DV
  campoLivre: string;        // 25 dígitos
  fatorVencimento: string;
}

export function gerarBoletoSicoob(b: BeneficiarioBoletoSicoob, d: DadosBoleto): BoletoSicoob {
  const banco = '756';
  const moeda = '9';
  const fator = fatorVencimento(d.dataVencimento);
  const valor = valorFmt(d.valor);
  const campoLivre = campoLivreSicoob(b, d);

  const cod43 = banco + moeda + fator + valor + campoLivre; // 3+1+4+10+25 = 43
  const dv = dvGeralBarras(cod43);
  const barras = cod43.slice(0, 4) + dv + cod43.slice(4);    // DV geral na posição 5 → 44

  return {
    codigoBarras: barras,
    linhaDigitavel: linhaDigitavel(barras),
    nossoNumero: nossoNumeroFormatado(b, d.nossoNumero),
    campoLivre,
    fatorVencimento: fator,
  };
}

/** Monta a linha digitável (47) a partir do código de barras (44), no padrão FEBRABAN. */
export function linhaDigitavel(barras: string): string {
  if (barras.length !== 44) throw new Error('Código de barras deve ter 44 dígitos.');
  const campo1 = barras.slice(0, 4) + barras.slice(19, 24); // banco+moeda + campo livre[0..5]
  const campo2 = barras.slice(24, 34);                      // campo livre[5..15]
  const campo3 = barras.slice(34, 44);                      // campo livre[15..25]
  const dvGeral = barras[4];
  const campo5 = barras.slice(5, 19);                       // fator + valor

  const c1 = campo1 + modulo10(campo1);
  const c2 = campo2 + modulo10(campo2);
  const c3 = campo3 + modulo10(campo3);

  return `${c1.slice(0, 5)}.${c1.slice(5)} ${c2.slice(0, 5)}.${c2.slice(5)} ${c3.slice(0, 5)}.${c3.slice(5)} ${dvGeral} ${campo5}`;
}

// ---------- Código de barras Interleaved 2 of 5 (ITF) — o padrão do boleto ----------

const ITF: Record<string, string> = {
  '0': 'nnwwn', '1': 'wnnnw', '2': 'nwnnw', '3': 'wwnnn', '4': 'nnwnw',
  '5': 'wnwnn', '6': 'nwwnn', '7': 'nnnww', '8': 'wnnwn', '9': 'nwnwn',
};

/**
 * Larguras (em módulos) das barras/espaços do código de barras ITF para os 44 dígitos.
 * Alterna barra/espaço começando em barra. narrow = 1, wide = 3.
 */
export function barrasITF(codigo: string): number[] {
  const dig = soD(codigo);
  if (dig.length % 2 !== 0) throw new Error('ITF exige número par de dígitos.');
  const larguras: number[] = [];
  const add = (padrao: string) => { for (const c of padrao) larguras.push(c === 'w' ? 3 : 1); };
  // Início: narrow bar, narrow space, narrow bar, narrow space
  add('nnnn');
  for (let i = 0; i < dig.length; i += 2) {
    const a = ITF[dig[i]];
    const b = ITF[dig[i + 1]];
    for (let k = 0; k < 5; k++) { larguras.push(a[k] === 'w' ? 3 : 1); larguras.push(b[k] === 'w' ? 3 : 1); }
  }
  // Fim: wide bar, narrow space, narrow bar
  add('wnn');
  return larguras;
}
