export type TipoAcaoErroNfse = 'zerar_deducao' | 'editar_nota' | 'abrir_config';

export interface SugestaoErroNfse {
  codigo: string | null;
  dica: string;
  acaoLabel: string;
  acaoTipo: TipoAcaoErroNfse;
}

/**
 * Traduz códigos de rejeição comuns do Sefin Nacional em uma explicação curta
 * e uma ação direta na interface para acelerar a correção pelo usuário.
 */
export function diagnosticarErroNfse(ultimoErro?: string | null): SugestaoErroNfse | null {
  const txt = (ultimoErro || '').trim();
  if (!txt) return null;
  const upper = txt.toUpperCase();

  if (upper.includes('E0441') || upper.includes('E0446') || upper.includes('E0447')) {
    return {
      codigo: upper.match(/E\d{4}/)?.[0] || null,
      dica: 'O município não aceita dedução na base para este serviço/Simples Nacional.',
      acaoLabel: 'Zerar dedução e editar',
      acaoTipo: 'zerar_deducao',
    };
  }

  if (upper.includes('E0237')) {
    return {
      codigo: 'E0237',
      dica: 'Com ISS retido, preencha CEP, IBGE, logradouro e bairro do tomador.',
      acaoLabel: 'Completar endereço',
      acaoTipo: 'editar_nota',
    };
  }

  if (upper.includes('E0322')) {
    return {
      codigo: 'E0322',
      dica: 'O grupo IBS/CBS exige o código NBS (9 dígitos) preenchido no serviço.',
      acaoLabel: 'Informar NBS',
      acaoTipo: 'editar_nota',
    };
  }

  if (upper.includes('E0617') || upper.includes('E0619') || upper.includes('E0621') || upper.includes('E0625') || upper.includes('E0635') || upper.includes('E0640')) {
    return {
      codigo: upper.match(/E\d{4}/)?.[0] || null,
      dica: 'Conflito entre a alíquota de ISS da nota e o regime tributário/convênio na configuração.',
      acaoLabel: 'Revisar configuração',
      acaoTipo: 'abrir_config',
    };
  }

  if (upper.includes('OBRA') || upper.includes('COBRA') || upper.includes('TCINFOOBRA')) {
    return {
      codigo: upper.match(/E\d{4}/)?.[0] || null,
      dica: 'Serviços de construção civil exigem Código da Obra (CNO) ou endereço completo da obra.',
      acaoLabel: 'Preencher dados da obra',
      acaoTipo: 'editar_nota',
    };
  }

  if (upper.includes('CERTIFICADO') || upper.includes('PROCURA') || upper.includes('401') || upper.includes('403')) {
    return {
      codigo: upper.match(/E\d{4}/)?.[0] || null,
      dica: 'Verifique o certificado A1 ou a procuração eletrônica no Emissor Nacional.',
      acaoLabel: 'Abrir configuração',
      acaoTipo: 'abrir_config',
    };
  }

  if (upper.includes('E1235')) {
    return {
      codigo: 'E1235',
      dica: 'Algum campo da nota está fora do formato do XSD (ex.: código municipal, NBS ou texto).',
      acaoLabel: 'Revisar campos',
      acaoTipo: 'editar_nota',
    };
  }

  return null;
}
