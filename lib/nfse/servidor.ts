// ============================================================
// NFS-e NACIONAL — helpers das rotas de API
// ============================================================

import { NextResponse } from 'next/server';
import type { NfseConfig } from '@prisma/client';
import db from '../prisma';
import type { SessionPayload } from '../session';
import { lerCertificadoA1, type CredencialA1 } from './assinatura';
import { decifrar } from './cofre';
import type { ConfigFiscalNfse } from './dps';
import type { ErroSefin } from './sefin';

export const ID_CERT_ESCRITORIO = 'padrao';
/** Dado autenticado da cifra do certificado do escritório (nas empresas, é o empresaId). */
export const ESCOPO_CERT_ESCRITORIO = 'escritorio';

/** A emissão fica na área do consultor: o perfil cliente não opera certificado nem nota fiscal. */
export function acessoNegado(session: SessionPayload, empresaId: string): NextResponse | null {
  if (session.role === 'administrador') return null;
  if (session.role !== 'cliente' && session.empresaIds.includes(empresaId)) return null;
  return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
}

/**
 * Para as rotas de uso da nota (emitir, cancelar, baixar, buscar). Aqui o cliente
 * entra, mas só na própria empresa e com procuração confirmada para o escritório.
 * Certificado, configuração e verificação seguem em acessoNegado.
 */
export async function acessoEmissaoNegado(session: SessionPayload, empresaId: string): Promise<NextResponse | null> {
  if (session.role !== 'cliente') return acessoNegado(session, empresaId);
  if (session.empresaIds.includes(empresaId)) {
    const config = await db.nfseConfig.findUnique({ where: { empresaId }, select: { usarProcuracao: true, procuracaoStatus: true } });
    if (config?.usarProcuracao && config.procuracaoStatus === 'ativa') return null;
  }
  return NextResponse.json({ error: 'Esta empresa não tem procuração ativa para emitir por aqui. Fale com o escritório.' }, { status: 403 });
}

export function configFiscal(config: NfseConfig, cnpj: string): ConfigFiscalNfse {
  return {
    cnpj,
    codigoMunicipio: config.codigoMunicipio || '',
    inscricaoMunicipal: config.inscricaoMunicipal,
    opSimpNac: config.opSimpNac,
    regApTribSN: config.regApTribSN,
    regEspTrib: config.regEspTrib,
    pTotTribSN: config.pTotTribSN,
    piscofinsCst: config.piscofinsCst,
    tpRetPisCofins: config.tpRetPisCofins,
    pTotTribFed: config.pTotTribFed,
    pTotTribEst: config.pTotTribEst,
    pTotTribMun: config.pTotTribMun,
    convenioAtivo: config.convenioAtivo,
    ibsCbsCIndOp: config.ibsCbsCIndOp,
    ibsCbsCst: config.ibsCbsCst,
    ibsCbsCClassTrib: config.ibsCbsCClassTrib,
    ibsCbsIndFinal: config.ibsCbsIndFinal,
    leiaute: config.leiaute,
  };
}

function abrirValidade(pfxCifrado: string, senhaCifrada: string, escopo: string): { credencial: CredencialA1 } | { erro: string } {
  let pfx: Buffer;
  let senha: string;
  try {
    pfx = decifrar(pfxCifrado, escopo);
    senha = decifrar(senhaCifrada, escopo).toString('utf8');
  } catch (err) {
    if (err instanceof Error && err.name === 'CofreNaoConfiguradoError') throw err;
    return {
      erro: 'Não foi possível decifrar o certificado salvo (chave de criptografia diferente de quando ele foi enviado). Selecione novamente o arquivo .pfx, informe a senha e clique em Salvar.',
    };
  }
  const credencial = lerCertificadoA1(pfx, senha);
  if (credencial.validoAte.getTime() < Date.now()) {
    return { erro: 'O certificado digital A1 está vencido. Envie um novo na configuração.' };
  }
  return { credencial };
}

export async function abrirCredencialEscritorio(): Promise<{ credencial: CredencialA1 } | { erro: string }> {
  const cert = await db.nfseCertificadoEscritorio.findUnique({ where: { id: ID_CERT_ESCRITORIO } });
  if (!cert) return { erro: 'Envie o certificado do contador em Emissores por Procuração.' };
  return abrirValidade(cert.certPfxCifrado, cert.certSenhaCifrada, ESCOPO_CERT_ESCRITORIO);
}

/** Certificado usado na emissão: o do contador por procuração ou, se configurado, o da própria empresa. */
export async function abrirCredencial(config: NfseConfig): Promise<{ credencial: CredencialA1 } | { erro: string }> {
  if (config.usarProcuracao) return abrirCredencialEscritorio();
  if (!config.certPfxCifrado || !config.certSenhaCifrada) {
    return { erro: 'Envie o certificado digital A1 da empresa na configuração do Emissor Nacional.' };
  }
  return abrirValidade(config.certPfxCifrado, config.certSenhaCifrada, config.empresaId);
}

// E2245: sem procuração. E0718: "a assinatura deve ser feita com o certificado do emitente".
const CODIGOS_PROCURACAO = ['E2245', 'E0718'];

export function resumirErros(erros: ErroSefin[], mensagem: string, usarProcuracao = false): string {
  if (erros.length === 0) return mensagem;
  const resumo = erros
    .map(e => [e.codigo && `[${e.codigo}]`, e.descricao, e.complemento].filter(Boolean).join(' '))
    .join(' | ');
  const dica = usarProcuracao && erros.some(e => e.codigo && CODIGOS_PROCURACAO.includes(e.codigo))
    ? ' Confira se a procuração está ativa no Portal de Serviços da Receita, com o serviço da NFS-e, e o aceite do certificado do contador por esse município.'
    : '';
  return resumo + dica;
}
