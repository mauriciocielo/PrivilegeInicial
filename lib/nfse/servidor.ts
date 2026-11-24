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
import { operaEmpresaDoCertificado } from './escopo';
import {
  escopoCertificadoEscritorio,
  obterEscritorioDaEmpresa,
  obterEscritorioDoUsuario,
} from './escritorios-terceiros';

export const ID_CERT_ESCRITORIO = 'padrao';
/** Dado autenticado da cifra do certificado do escritório padrão (nas empresas, é o empresaId). */
export const ESCOPO_CERT_ESCRITORIO = 'escritorio';

async function usuarioPossuiEmpresa(session: SessionPayload, empresaId: string): Promise<boolean> {
  if (session.empresaIds.includes(empresaId)) return true;
  if (!session.userId) return false;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { empresaIds: true },
  });
  return Array.isArray(user?.empresaIds) && user.empresaIds.includes(empresaId);
}

/**
 * Verifica se o usuário tem acesso à empresa (administrador, consultor com carteira/procuração,
 * ou cliente vinculado à empresa no módulo Usuários).
 */
export async function acessoNegado(session: SessionPayload, empresaId: string): Promise<NextResponse | null> {
  if (session.role === 'administrador') return null;

  // Se o usuário pertence a um contador terceiro, só acessa empresas do próprio escritório
  const vinculoTerceiro = await obterEscritorioDoUsuario(session.userId);
  if (vinculoTerceiro) {
    if (!vinculoTerceiro.ativo) {
      return NextResponse.json({ error: 'Conta do escritório contábil suspensa.' }, { status: 403 });
    }
    const escEmp = await obterEscritorioDaEmpresa(empresaId);
    if (escEmp === vinculoTerceiro.escritorioId) return null;
    if (await usuarioPossuiEmpresa(session, empresaId)) return null;
    return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
  }

  if (await usuarioPossuiEmpresa(session, empresaId)) return null;
  if (session.role !== 'cliente') {
    if (await operaEmpresaDoCertificado(session.userId, empresaId)) return null;
  }
  return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
}

/**
 * Para as rotas de uso da nota (emitir, cancelar, baixar, buscar).
 * O cliente entra apenas nas empresas vinculadas a ele no módulo Usuários.
 */
export async function acessoEmissaoNegado(session: SessionPayload, empresaId: string): Promise<NextResponse | null> {
  if (session.role !== 'cliente') return acessoNegado(session, empresaId);
  if (await usuarioPossuiEmpresa(session, empresaId)) return null;
  return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
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

export async function abrirCredencialEscritorio(
  escritorioId: string = ID_CERT_ESCRITORIO
): Promise<{ credencial: CredencialA1 } | { erro: string }> {
  const idAlvo = escritorioId || ID_CERT_ESCRITORIO;
  const cert = await db.nfseCertificadoEscritorio.findUnique({ where: { id: idAlvo } });
  if (!cert) return { erro: 'Envie o certificado do contador em Emissores por Procuração.' };
  return abrirValidade(cert.certPfxCifrado, cert.certSenhaCifrada, escopoCertificadoEscritorio(idAlvo));
}

/** Certificado usado na emissão: o do contador (padrão ou terceiro) por procuração ou o da própria empresa. */
export async function abrirCredencial(config: NfseConfig): Promise<{ credencial: CredencialA1 } | { erro: string }> {
  if (config.usarProcuracao) {
    const escritorioId = await obterEscritorioDaEmpresa(config.empresaId);
    return abrirCredencialEscritorio(escritorioId);
  }
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
