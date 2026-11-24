import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { acessoEmissaoNegado } from '../../../../../lib/nfse/servidor';
import { CertificadoInvalidoError, certificadoPertenceAoCnpj, lerCertificadoA1 } from '../../../../../lib/nfse/assinatura';
import { CofreNaoConfiguradoError, cifrar } from '../../../../../lib/nfse/cofre';

export const dynamic = 'force-dynamic';

const TAMANHO_MAX_PFX = 64 * 1024;

/**
 * POST /api/empresas/[id]/nfse-certificado-cliente
 * Permite que um cliente avulso (sem procuração do escritório) cadastre ou renove
 * o próprio Certificado Digital A1 (.pfx + senha) para emitir NFS-e pela sua empresa.
 * Força usarProcuracao = false para nunca usar o certificado de nenhum escritório.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;

    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, cnpj: true, razaoSocial: true },
    });
    if (!empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const pfxBase64 = typeof body?.pfxBase64 === 'string' ? body.pfxBase64 : '';
    const senha = typeof body?.senha === 'string' ? body.senha : '';
    const nomeArquivo = typeof body?.nomeArquivo === 'string' ? body.nomeArquivo : 'certificado.pfx';

    const pfx = Buffer.from(pfxBase64, 'base64');
    if (pfx.length === 0 || pfx.length > TAMANHO_MAX_PFX) {
      return NextResponse.json({ error: 'Arquivo .pfx inválido ou acima de 64 KB.' }, { status: 422 });
    }

    const credencial = lerCertificadoA1(pfx, senha);
    if (credencial.validoAte.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Este certificado digital A1 está vencido.' }, { status: 422 });
    }

    if (!certificadoPertenceAoCnpj(credencial, empresa.cnpj)) {
      return NextResponse.json(
        { error: `O certificado enviado (${credencial.documento || credencial.titular}) não pertence ao CNPJ desta empresa (${empresa.cnpj}).` },
        { status: 422 }
      );
    }

    const dadosCert = {
      usarProcuracao: false,
      certPfxCifrado: cifrar(pfx, empresaId),
      certSenhaCifrada: cifrar(Buffer.from(senha, 'utf8'), empresaId),
      certNomeArquivo: nomeArquivo,
      certTitular: credencial.titular,
      certCnpj: credencial.documento,
      certValidoAte: credencial.validoAte,
    };

    await db.nfseConfig.upsert({
      where: { empresaId },
      update: dadosCert,
      create: {
        empresaId,
        ambiente: 'producao',
        ...dadosCert,
      },
    });

    return NextResponse.json({
      ok: true,
      certificado: {
        nomeArquivo: dadosCert.certNomeArquivo,
        titular: dadosCert.certTitular,
        cnpj: dadosCert.certCnpj,
        validoAte: dadosCert.certValidoAte,
      },
    });
  } catch (error) {
    if (error instanceof CertificadoInvalidoError || error instanceof CofreNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Erro em POST nfse-certificado-cliente:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao salvar certificado digital A1.' }, { status: 500 });
  }
}
