export interface NfseRecorrenciaRecord {
  id: string;
  empresaId: string;
  ativo: boolean;
  diaEmissao: number;
  tomadorDocumento: string;
  tomadorNome: string;
  tomadorEmail: string;
  tomadorTelefone: string;
  tomadorCep: string;
  tomadorEndereco: string;
  tomadorNumero: string;
  tomadorBairro: string;
  tomadorCidade: string;
  tomadorUf: string;
  tomadorCodigoMunicipio: string;
  codigoServico: string;
  cTribMun: string;
  cNbs: string;
  valorServicos: number;
  aliquotaIss: number;
  issRetido: boolean;
  descricaoTemplate: string;
  ultimaCompetenciaGerada: string | null;
  createdAt: string;
}

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/**
 * Expande variáveis dinâmicas na descrição da nota recorrente para a competência AAAA-MM.
 * Suporta: {{mes_atual}}, {{mes_anterior}}, {{ano}}, {{competencia}}, {{mes_atual_extenso}}, {{mes_anterior_extenso}}.
 */
export function expandirDescricaoRecorrente(template: string, competenciaIso: string): string {
  const [anoStr, mesStr] = competenciaIso.split('-');
  const ano = Number(anoStr) || new Date().getFullYear();
  const mes = Number(mesStr) || new Date().getMonth() + 1;
  const mesAntDate = new Date(ano, mes - 2, 1);
  const mesAnt = mesAntDate.getMonth() + 1;
  const anoAnt = mesAntDate.getFullYear();

  const mmAtual = String(mes).padStart(2, '0');
  const mmAnt = String(mesAnt).padStart(2, '0');

  return String(template || '')
    .replace(/\{\{\s*competencia\s*\}\}/gi, `${mmAtual}/${ano}`)
    .replace(/\{\{\s*mes_atual\s*\}\}/gi, `${mmAtual}/${ano}`)
    .replace(/\{\{\s*mes_anterior\s*\}\}/gi, `${mmAnt}/${anoAnt}`)
    .replace(/\{\{\s*ano\s*\}\}/gi, String(ano))
    .replace(/\{\{\s*mes_atual_extenso\s*\}\}/gi, `${MESES_PT[mes - 1]}/${ano}`)
    .replace(/\{\{\s*mes_anterior_extenso\s*\}\}/gi, `${MESES_PT[mesAnt - 1]}/${anoAnt}`);
}
