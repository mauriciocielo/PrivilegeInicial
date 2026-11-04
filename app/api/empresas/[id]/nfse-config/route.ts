import { NextResponse } from 'next/server';
import type { NfseConfig, Prisma } from '@prisma/client';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { acessoEmissaoNegado, acessoNegado, ID_CERT_ESCRITORIO } from '../../../../../lib/nfse/servidor';
import { apenasDigitos, LEIAUTE_NT009, LEIAUTE_PRODUCAO } from '../../../../../lib/nfse/dps';
import { CertificadoInvalidoError, certificadoPertenceAoCnpj, lerCertificadoA1 } from '../../../../../lib/nfse/assinatura';
import { CofreNaoConfiguradoError, cifrar } from '../../../../../lib/nfse/cofre';
import { normalizarRegras } from '../../../../../lib/nfse/retencao';

const TAMANHO_MAX_PFX = 64 * 1024;

const cofreConfigurado = () => Buffer.from(process.env.NFSE_CERT_KEY || '', 'base64').length === 32;

/** Nunca devolve certPfxCifrado nem certSenhaCifrada. */
async function paraResposta(config: NfseConfig | null) {
  const certEscritorio = await db.nfseCertificadoEscritorio.findUnique({
    where: { id: ID_CERT_ESCRITORIO },
    select: { titular: true, documento: true, validoAte: true },
  });
  const certificado = config?.certPfxCifrado ? {
    nomeArquivo: config.certNomeArquivo,
    titular: config.certTitular,
    cnpj: config.certCnpj,
    validoAte: config.certValidoAte,
  } : null;
  const parametros = config ? {
    ambiente: config.ambiente,
    usarProcuracao: config.usarProcuracao,
    procuracaoStatus: config.procuracaoStatus,
    procuracaoMensagem: config.procuracaoMensagem,
    procuracaoVerificadaEm: config.procuracaoVerificadaEm,
    servicosConhecidos: config.servicosConhecidos,
    regrasRetencao: config.regrasRetencao,
    codigoMunicipio: config.codigoMunicipio,
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
    serie: config.serie,
    proximoNDpsHomologacao: config.proximoNDpsHomologacao,
    proximoNDpsProducao: config.proximoNDpsProducao,
    cTribNacPadrao: config.cTribNacPadrao,
    cTribMunPadrao: config.cTribMunPadrao,
    cNbsPadrao: config.cNbsPadrao,
  } : null;
  return { parametros, certificado, escritorio: certEscritorio, cofreConfigurado: cofreConfigurado() };
}

const textoOuNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const digitosOuNull = (v: unknown) => (typeof v === 'string' ? apenasDigitos(v) || null : null);
const numeroOuNull = (v: unknown) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

function validarParametros(b: Record<string, unknown>): string | null {
  if (b.ambiente !== 'homologacao' && b.ambiente !== 'producao') return 'Ambiente inválido.';
  if (![1, 2, 3].includes(Number(b.opSimpNac))) return 'Regime tributário inválido.';
  if (Number(b.opSimpNac) === 3 && ![1, 2, 3].includes(Number(b.regApTribSN))) return 'Regime de apuração do Simples inválido.';
  const municipio = digitosOuNull(b.codigoMunicipio);
  if (municipio && municipio.length !== 7) return 'O código IBGE do município deve ter 7 dígitos.';
  if (!/^\d{1,5}$/.test(String(b.serie || ''))) return 'A série da DPS deve ter de 1 a 5 dígitos.';
  for (const contador of ['proximoNDpsHomologacao', 'proximoNDpsProducao']) {
    const valor = Number(b[contador]);
    if (!Number.isInteger(valor) || valor < 1) return 'O próximo número de DPS deve ser um inteiro positivo.';
  }
  const leiaute = textoOuNull(b.leiaute);
  if (leiaute && leiaute !== LEIAUTE_PRODUCAO && leiaute !== LEIAUTE_NT009) return 'Leiaute inválido.';
  return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;
    // O cliente lê para emitir; alterar segue restrito ao escritório (PUT).
    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    const config = await db.nfseConfig.findUnique({ where: { empresaId } });
    return NextResponse.json(await paraResposta(config));
  } catch (error) {
    console.error('Erro em GET nfse-config:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar a configuração.' }, { status: 500 });
  }
}

/**
 * Altera só a alíquota do Simples, a partir da tela da nota. Fora do PUT de propósito: ele regrava
 * todos os parâmetros, e um valor antigo do contador de DPS poderia repetir o número de uma nota.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;
    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const pTotTribSN = Number(body.pTotTribSN);
    if (body.pTotTribSN == null || !(pTotTribSN > 0) || pTotTribSN > 100) {
      return NextResponse.json({ error: 'Informe uma alíquota do Simples entre 0 e 100%.' }, { status: 422 });
    }
    const alterado = await db.nfseConfig.updateMany({ where: { empresaId }, data: { pTotTribSN } });
    if (alterado.count === 0) return NextResponse.json({ error: 'Configure o Emissor Nacional desta empresa primeiro.' }, { status: 404 });
    return NextResponse.json({ pTotTribSN });
  } catch (error) {
    console.error('Erro em PATCH nfse-config:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao salvar a alíquota do Simples.' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;
    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const invalido = validarParametros(body);
    if (invalido) return NextResponse.json({ error: invalido }, { status: 422 });

    const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { cnpj: true } });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    const opSimpNac = Number(body.opSimpNac);
    const dados: Prisma.NfseConfigUncheckedUpdateInput = {
      ambiente: String(body.ambiente),
      usarProcuracao: body.usarProcuracao !== false,
      regrasRetencao: normalizarRegras(body.regrasRetencao) as unknown as Prisma.InputJsonValue,
      codigoMunicipio: digitosOuNull(body.codigoMunicipio),
      inscricaoMunicipal: digitosOuNull(body.inscricaoMunicipal),
      opSimpNac,
      regApTribSN: opSimpNac === 3 ? Number(body.regApTribSN) : null,
      regEspTrib: Number(body.regEspTrib) || 0,
      pTotTribSN: numeroOuNull(body.pTotTribSN),
      piscofinsCst: textoOuNull(body.piscofinsCst) || '08',
      tpRetPisCofins: textoOuNull(body.tpRetPisCofins),
      pTotTribFed: numeroOuNull(body.pTotTribFed),
      pTotTribEst: numeroOuNull(body.pTotTribEst),
      pTotTribMun: numeroOuNull(body.pTotTribMun),
      convenioAtivo: body.convenioAtivo !== false,
      ibsCbsCIndOp: digitosOuNull(body.ibsCbsCIndOp),
      ibsCbsCst: digitosOuNull(body.ibsCbsCst),
      ibsCbsCClassTrib: digitosOuNull(body.ibsCbsCClassTrib),
      ibsCbsIndFinal: textoOuNull(body.ibsCbsIndFinal),
      leiaute: textoOuNull(body.leiaute),
      serie: String(body.serie),
      proximoNDpsHomologacao: Number(body.proximoNDpsHomologacao),
      proximoNDpsProducao: Number(body.proximoNDpsProducao),
      cTribNacPadrao: digitosOuNull(body.cTribNacPadrao),
      cTribMunPadrao: textoOuNull(body.cTribMunPadrao),
      cNbsPadrao: digitosOuNull(body.cNbsPadrao),
    };

    const certificado = body.certificado as { pfxBase64?: string; senha?: string; nomeArquivo?: string } | undefined;
    if (certificado?.pfxBase64) {
      const pfx = Buffer.from(certificado.pfxBase64, 'base64');
      if (pfx.length === 0 || pfx.length > TAMANHO_MAX_PFX) {
        return NextResponse.json({ error: 'Arquivo de certificado inválido.' }, { status: 422 });
      }
      const senha = certificado.senha || '';
      const credencial = lerCertificadoA1(pfx, senha);
      if (credencial.validoAte.getTime() < Date.now()) {
        return NextResponse.json({ error: 'Este certificado está vencido.' }, { status: 422 });
      }
      if (!certificadoPertenceAoCnpj(credencial, empresa.cnpj)) {
        return NextResponse.json({ error: `O certificado é do CNPJ ${credencial.cnpj}, de outra empresa.` }, { status: 422 });
      }
      dados.certPfxCifrado = cifrar(pfx, empresaId);
      dados.certSenhaCifrada = cifrar(Buffer.from(senha, 'utf8'), empresaId);
      dados.certNomeArquivo = textoOuNull(certificado.nomeArquivo);
      dados.certTitular = credencial.titular;
      dados.certCnpj = credencial.cnpj;
      dados.certValidoAte = credencial.validoAte;
    }

    const config = await db.nfseConfig.upsert({
      where: { empresaId },
      update: dados,
      create: { ...(dados as Prisma.NfseConfigUncheckedCreateInput), empresaId },
    });
    return NextResponse.json(await paraResposta(config));
  } catch (error) {
    if (error instanceof CertificadoInvalidoError || error instanceof CofreNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Erro em PUT nfse-config:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao salvar a configuração.' }, { status: 500 });
  }
}
