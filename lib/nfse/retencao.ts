// ============================================================
// NFS-e NACIONAL — retenções de tributos
// ============================================================
// Pela NT 007, PIS, COFINS e CSLL retidos vão SOMADOS em vRetCSLL, e o
// tpRetPisCofins diz quais estão na soma. vPis/vCofins são só apuração própria:
// usá-los para retenção reduz indevidamente a base do IBS/CBS. Os percentuais e
// as condições vêm das regras de cada empresa: a obrigação depende da legislação
// e do tomador, e quem decide é a contabilidade.

import { apenasDigitos } from './dps';

export interface ValoresRetidos {
  irrf: number;
  pis: number;
  cofins: number;
  csll: number;
  cp: number;
}

export const SEM_RETENCAO: ValoresRetidos = { irrf: 0, pis: 0, cofins: 0, csll: 0, cp: 0 };

export const TRIBUTOS_RETIDOS: { chave: keyof ValoresRetidos; nome: string }[] = [
  { chave: 'irrf', nome: 'IRRF' },
  { chave: 'pis', nome: 'PIS' },
  { chave: 'cofins', nome: 'COFINS' },
  { chave: 'csll', nome: 'CSLL' },
  { chave: 'cp', nome: 'INSS (CP)' },
];

export type TomadorRegra = 'todos' | 'pj' | 'pf';

export interface RegraRetencao {
  id: string;
  nome: string;
  ativa: boolean;
  /** Códigos de tributação nacional. Vazio: vale para todos os serviços. */
  servicos: string[];
  tomador: TomadorRegra;
  /** A regra só vale a partir deste valor de nota. */
  valorMinimo: number;
  issRetido: boolean;
  /** Alíquota do ISS retido. Nula: mantém a já informada na nota. */
  aliquotaIss: number | null;
  /** Percentuais de retenção. */
  percentuais: ValoresRetidos;
}

const dinheiro = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function totalRetidoFederal(r: ValoresRetidos): number {
  return dinheiro(r.irrf + r.pis + r.cofins + r.csll + r.cp);
}

export function calcularRetidos(valorServico: number, percentuais: ValoresRetidos): ValoresRetidos {
  const calc = (p: number) => dinheiro(valorServico * (Number(p) || 0) / 100);
  return { irrf: calc(percentuais.irrf), pis: calc(percentuais.pis), cofins: calc(percentuais.cofins), csll: calc(percentuais.csll), cp: calc(percentuais.cp) };
}

export function percentuaisDosValores(valorServico: number, r: ValoresRetidos): ValoresRetidos {
  const pct = (v: number) => (valorServico > 0 ? dinheiro(v / valorServico * 100) : 0);
  return { irrf: pct(r.irrf), pis: pct(r.pis), cofins: pct(r.cofins), csll: pct(r.csll), cp: pct(r.cp) };
}

/** Código oficial para a combinação retida. Sem retenção, null: quem define é a configuração. */
export function tipoRetencaoPisCofins(r: Pick<ValoresRetidos, 'pis' | 'cofins' | 'csll'>): string | null {
  const chave = `${r.pis > 0 ? 'P' : ''}${r.cofins > 0 ? 'C' : ''}${r.csll > 0 ? 'L' : ''}`;
  const codigos: Record<string, string> = { PCL: '3', PC: '4', P: '5', C: '6', CL: '7', L: '8', PL: '9' };
  return codigos[chave] ?? null;
}

// Proporção das alíquotas usuais, só para separar uma soma já emitida.
const PESO = { pis: 0.65, cofins: 3, csll: 1 };

/**
 * Separa o vRetCSLL de uma nota emitida fora do sistema. O XML guarda só a soma,
 * então a divisão é aproximada, mas o total sempre fecha. Serve para exibir e
 * para copiar a nota, que soma os mesmos valores de novo.
 */
export function dividirRetencaoAgrupada(total: number, tpRetPisCofins: string | null): Pick<ValoresRetidos, 'pis' | 'cofins' | 'csll'> {
  const composicao: Record<string, (keyof typeof PESO)[]> = {
    '1': ['pis', 'cofins'], '3': ['pis', 'cofins', 'csll'], '4': ['pis', 'cofins'], '5': ['pis'],
    '6': ['cofins'], '7': ['cofins', 'csll'], '8': ['csll'], '9': ['pis', 'csll'],
  };
  // Sem código, vale o sentido literal do campo: só CSLL.
  const partes = composicao[tpRetPisCofins || ''] || ['csll'];
  const soma = partes.reduce((acc, p) => acc + PESO[p], 0);
  const resultado = { pis: 0, cofins: 0, csll: 0 };
  let restante = dinheiro(total);
  partes.forEach((p, i) => {
    const valor = i === partes.length - 1 ? restante : dinheiro(total * PESO[p] / soma);
    resultado[p] = valor;
    restante = dinheiro(restante - valor);
  });
  return resultado;
}

/** Primeira regra que se aplica. Regra de serviço específico ganha da regra geral. */
export function escolherRegra(
  regras: RegraRetencao[] | null | undefined,
  nota: { cTribNac: string; tomadorDocumento: string; valorServicos: number },
): RegraRetencao | null {
  const doc = apenasDigitos(nota.tomadorDocumento);
  const tipoTomador = doc.length === 14 ? 'pj' : doc.length === 11 ? 'pf' : null;
  const candidatas = (regras || []).filter(r =>
    r.ativa
    && (r.servicos.length === 0 || r.servicos.includes(nota.cTribNac))
    && (r.tomador === 'todos' || r.tomador === tipoTomador)
    && nota.valorServicos >= (r.valorMinimo || 0));
  return candidatas.find(r => r.servicos.length > 0) || candidatas[0] || null;
}

const numero = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

/** Regras vindas da tela: descarta o que não é válido em vez de confiar no navegador. */
export function normalizarRegras(entrada: unknown): RegraRetencao[] {
  if (!Array.isArray(entrada)) return [];
  return entrada.slice(0, 50).filter(r => r && typeof r === 'object').map((bruta, i) => {
    const r = bruta as Record<string, unknown>;
    const p = (r.percentuais && typeof r.percentuais === 'object' ? r.percentuais : {}) as Record<string, unknown>;
    const aliquota = r.aliquotaIss === null || r.aliquotaIss === undefined || r.aliquotaIss === '' ? null : numero(r.aliquotaIss, 0, 100);
    return {
      id: typeof r.id === 'string' && r.id ? r.id : `regra-${i + 1}`,
      nome: typeof r.nome === 'string' && r.nome.trim() ? r.nome.trim().slice(0, 80) : `Regra ${i + 1}`,
      ativa: r.ativa !== false,
      servicos: Array.isArray(r.servicos) ? r.servicos.map(s => apenasDigitos(String(s))).filter(s => /^\d{6}$/.test(s)) : [],
      tomador: r.tomador === 'pj' || r.tomador === 'pf' ? r.tomador : 'todos',
      valorMinimo: numero(r.valorMinimo, 0, 1e12),
      issRetido: r.issRetido === true,
      aliquotaIss: aliquota,
      percentuais: {
        irrf: numero(p.irrf, 0, 100), pis: numero(p.pis, 0, 100), cofins: numero(p.cofins, 0, 100),
        csll: numero(p.csll, 0, 100), cp: numero(p.cp, 0, 100),
      },
    };
  });
}
