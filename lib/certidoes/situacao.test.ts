import { describe, expect, it } from 'vitest';
import { ORIGEM_ANEXO, VERSAO_CLASSIFICADOR, categoriaFederal, classificarRelatorioSitfis, ehAnexoManual, statusValidade, temPdfRelatorio } from './situacao';

describe('validade da certidão anexada', () => {
  const hoje = '2026-11-04';

  it('compara só o dia, sem efeito de fuso', () => {
    expect(statusValidade('2026-11-04T12:00:00.000Z', hoje)).toEqual({ status: 'vencendo', dias: 0 });
    expect(statusValidade('2026-11-03T23:59:00.000Z', hoje)).toEqual({ status: 'vencida', dias: -1 });
  });

  it('avisa nos últimos 15 dias', () => {
    expect(statusValidade('2026-11-19', hoje).status).toBe('vencendo');
    expect(statusValidade('2026-11-20', hoje).status).toBe('valida');
  });

  it('sem data, não finge que está válida', () => {
    expect(statusValidade(null, hoje)).toEqual({ status: 'sem_validade', dias: null });
  });

  it('só reconhece o que foi anexado', () => {
    expect(ehAnexoManual({ origem: ORIGEM_ANEXO })).toBe(true);
    expect(ehAnexoManual(null)).toBe(false);
    expect(ehAnexoManual({ classificador: 2 })).toBe(false);
  });
});

const relatorio = (corpo: string) => `MINISTERIO DA FAZENDA - RECEITA FEDERAL - RELATORIO DE SITUACAO FISCAL. ${corpo}`;

describe('leitura do relatório SITFIS', () => {
  it('sem pendências só com a frase expressa, com ou sem acento', () => {
    expect(classificarRelatorioSitfis(relatorio('Não foram detectadas pendências/exigibilidades suspensas nos controles'))).toBe('NEGATIVA');
    expect(classificarRelatorioSitfis(relatorio('NAO FORAM DETECTADAS PENDENCIAS'))).toBe('NEGATIVA');
  });

  it('pendência listada vence, mesmo com a outra frase em outra seção', () => {
    expect(classificarRelatorioSitfis(relatorio('Pendência - Débito (SIEF) 01/2026'))).toBe('POSITIVA');
    expect(classificarRelatorioSitfis(relatorio('Não foram detectadas pendências no CNPJ raiz. Pendência - Omissão de declaração'))).toBe('POSITIVA');
  });

  it('só débito suspenso conta como com efeito de negativa', () => {
    expect(classificarRelatorioSitfis(relatorio('Débito com Exigibilidade Suspensa (SIEF)'))).toBe('POSITIVA_COM_EFEITO_NEGATIVA');
  });

  it('a frase de que nada foi detectado não conta como suspensão', () => {
    expect(classificarRelatorioSitfis(relatorio('Não foram detectadas pendências/exigibilidades suspensas'))).not.toBe('POSITIVA_COM_EFEITO_NEGATIVA');
  });

  it('PDF ilegível ou texto desconhecido nunca vira "sem pendências"', () => {
    expect(classificarRelatorioSitfis('')).toBe('INDETERMINADA');
    expect(classificarRelatorioSitfis('curto')).toBe('INDETERMINADA');
    expect(classificarRelatorioSitfis(relatorio('Situação regular conforme nossos controles internos'))).toBe('INDETERMINADA');
  });
});

describe('categoria na tela', () => {
  const nova = { classificador: VERSAO_CLASSIFICADOR };

  it('classifica as consultas novas', () => {
    expect(categoriaFederal(null)).toBe('nao_consultada');
    expect(categoriaFederal({ situacao: 'NEGATIVA', pendencias: nova })).toBe('sem_pendencias');
    expect(categoriaFederal({ situacao: 'POSITIVA_COM_EFEITO_NEGATIVA', pendencias: nova })).toBe('com_efeito');
    expect(categoriaFederal({ situacao: 'POSITIVA', pendencias: nova })).toBe('pendencias');
    expect(categoriaFederal({ situacao: 'INDETERMINADA', pendencias: nova })).toBe('atencao');
    expect(categoriaFederal({ situacao: 'ERRO' })).toBe('atencao');
  });

  it('"sem pendências" antigo não é confiável e pede nova consulta', () => {
    expect(categoriaFederal({ situacao: 'NEGATIVA', pendencias: null })).toBe('atencao');
    expect(categoriaFederal({ situacao: 'POSITIVA_COM_EFEITO_NEGATIVA' })).toBe('atencao');
  });

  it('pendência antiga continua aparecendo como pendência', () => {
    expect(categoriaFederal({ situacao: 'POSITIVA', pendencias: null })).toBe('pendencias');
  });

  it('erro e processamento não têm PDF', () => {
    expect(temPdfRelatorio('ERRO')).toBe(false);
    expect(temPdfRelatorio('PROCESSANDO')).toBe(false);
    expect(temPdfRelatorio('INDETERMINADA')).toBe(true);
  });
});
