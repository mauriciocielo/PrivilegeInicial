// ============================================================
// Situação fiscal federal: leitura do relatório SITFIS e classificação na tela
// ============================================================
// O SITFIS é um RELATÓRIO de situação fiscal, não uma certidão: quem emite a CND é a
// Receita, no serviço próprio. Regra de segurança: só dizemos "sem pendências" quando o
// texto do relatório afirma isso. Em qualquer dúvida, a pessoa precisa abrir o PDF.

export type SituacaoFederal = 'NEGATIVA' | 'POSITIVA_COM_EFEITO_NEGATIVA' | 'POSITIVA' | 'PROCESSANDO' | 'ERRO' | 'INDETERMINADA';

export type CategoriaFederal = 'pendencias' | 'atencao' | 'nao_consultada' | 'com_efeito' | 'sem_pendencias';

/** Prioridade na lista: o que exige ação vem primeiro. */
export const ORDEM_CATEGORIAS: CategoriaFederal[] = ['pendencias', 'atencao', 'nao_consultada', 'com_efeito', 'sem_pendencias'];

/** Marca gravada junto da consulta: registros sem ela usaram a classificação antiga, que não era confiável. */
export const VERSAO_CLASSIFICADOR = 2;

/** Sem texto suficiente não dá para concluir nada (PDF em imagem ou com fonte codificada). */
const TAMANHO_MINIMO_TEXTO = 50;

export function classificarRelatorioSitfis(texto: string): 'NEGATIVA' | 'POSITIVA_COM_EFEITO_NEGATIVA' | 'POSITIVA' | 'INDETERMINADA' {
  const t = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ');
  if (t.length < TAMANHO_MINIMO_TEXTO) return 'INDETERMINADA';
  // A pendência vence qualquer outra frase do relatório.
  if (/PENDENCIA\s*-/.test(t)) return 'POSITIVA';
  if (/NAO FORAM DETECTADAS PENDENCIAS/.test(t)) return 'NEGATIVA';
  if (/EXIGIBILIDADE SUSPENSA/.test(t)) return 'POSITIVA_COM_EFEITO_NEGATIVA';
  return 'INDETERMINADA';
}

export function categoriaFederal(c: { situacao: string; pendencias?: unknown } | null | undefined): CategoriaFederal {
  if (!c) return 'nao_consultada';
  const classificadorAtual = (c.pendencias as { classificador?: number } | null | undefined)?.classificador === VERSAO_CLASSIFICADOR;
  if (c.situacao === 'POSITIVA') return 'pendencias';
  if (!classificadorAtual) return 'atencao';
  if (c.situacao === 'NEGATIVA') return 'sem_pendencias';
  if (c.situacao === 'POSITIVA_COM_EFEITO_NEGATIVA') return 'com_efeito';
  return 'atencao';
}

// ---------- Certidão estadual anexada ----------
// Emitida pela pessoa no portal do estado e guardada aqui. Registros estaduais sem esta marca
// são os antigos, gerados pelo sistema sem consultar a SEFAZ, e nunca aparecem nem são baixados.

export const ORIGEM_ANEXO = 'anexo_manual';

export const ehAnexoManual = (pendencias: unknown) => (pendencias as { origem?: string } | null | undefined)?.origem === ORIGEM_ANEXO;

export const SITUACOES_ANEXO: Record<string, string> = {
  NEGATIVA: 'Negativa',
  POSITIVA_COM_EFEITO_NEGATIVA: 'Positiva com efeito de negativa',
  POSITIVA: 'Positiva (com débitos)',
};

/** Limite do PDF: em base64 ele cresce um terço e precisa caber no limite de 4,5 MB da Vercel. */
export const TAMANHO_MAX_PDF = 3 * 1024 * 1024;

export const DIAS_AVISO_VALIDADE = 15;

export type StatusValidade = 'sem_validade' | 'vencida' | 'vencendo' | 'valida';

/** Compara só as datas (AAAA-MM-DD): o horário e o fuso não podem mudar o dia do vencimento. */
export function statusValidade(validoAte: string | null | undefined, hoje: string): { status: StatusValidade; dias: number | null } {
  if (!validoAte) return { status: 'sem_validade', dias: null };
  const dias = Math.round((Date.parse(`${validoAte.slice(0, 10)}T12:00:00Z`) - Date.parse(`${hoje.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
  if (dias < 0) return { status: 'vencida', dias };
  return { status: dias <= DIAS_AVISO_VALIDADE ? 'vencendo' : 'valida', dias };
}

/** Situações em que a consulta gravou o PDF do relatório. */
export const temPdfRelatorio = (situacao: string) => ['NEGATIVA', 'POSITIVA_COM_EFEITO_NEGATIVA', 'POSITIVA', 'INDETERMINADA'].includes(situacao);

/** Portal oficial onde a CND federal é emitida. */
export const URL_CND_RECEITA = 'https://solucoes.receita.fazenda.gov.br/servicos/certidaointernet/PJ/emitir';
