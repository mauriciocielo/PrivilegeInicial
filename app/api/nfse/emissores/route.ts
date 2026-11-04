import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { ESCOPO_CERT_ESCRITORIO, ID_CERT_ESCRITORIO } from '../../../../lib/nfse/servidor';
import { cnpjValido } from '../../../../lib/nfse/dps';
import { CertificadoInvalidoError, lerCertificadoA1 } from '../../../../lib/nfse/assinatura';
import { CofreNaoConfiguradoError, cifrar } from '../../../../lib/nfse/cofre';

const TAMANHO_MAX_PFX = 64 * 1024;

const certificadoPublico = { titular: true, documento: true, nomeArquivo: true, validoAte: true } as const;

/** Empresas que o usuário pode operar, com a situação da procuração, e o certificado do contador. */
export async function GET(request: Request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const [empresas, certificado, usuariosClientes] = await Promise.all([
      db.empresa.findMany({
        where: auth.session.role === 'administrador' ? {} : { id: { in: auth.session.empresaIds } },
        select: {
          id: true,
          razaoSocial: true,
          nomeFantasia: true,
          cnpj: true,
          tipo: true,
          nfseConfig: {
            select: {
              ambiente: true, usarProcuracao: true, codigoMunicipio: true,
              procuracaoStatus: true, procuracaoMensagem: true, procuracaoVerificadaEm: true,
              dadosImportadosEm: true, servicosConhecidos: true,
            },
          },
        },
        orderBy: { razaoSocial: 'asc' },
      }),
      db.nfseCertificadoEscritorio.findUnique({ where: { id: ID_CERT_ESCRITORIO }, select: certificadoPublico }),
      db.user.findMany({
        where: { role: 'cliente' },
        select: { id: true, name: true, email: true, empresaIds: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const usuariosPorEmpresa = new Map<string, Array<{ id: string; name: string; email: string }>>();
    for (const u of usuariosClientes) {
      for (const empId of u.empresaIds || []) {
        const lista = usuariosPorEmpresa.get(empId) || [];
        lista.push({ id: u.id, name: u.name, email: u.email });
        usuariosPorEmpresa.set(empId, lista);
      }
    }

    return NextResponse.json({
      certificado,
      podeAlterarCertificado: auth.session.role === 'administrador',
      // Cadastros sem CNPJ real (ex.: criados por sincronização) não podem emitir.
      empresas: empresas
        .filter(e => cnpjValido(e.cnpj))
        .map(e => ({
          ...e,
          usuariosCliente: usuariosPorEmpresa.get(e.id) || [],
        })),
    });
  } catch (error) {
    console.error('Erro em GET nfse/emissores:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar as empresas emissoras.' }, { status: 500 });
  }
}

/** Troca o certificado do contador. Ele emite por todas as empresas: só administrador altera. */
export async function PUT(request: Request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role !== 'administrador') {
      return NextResponse.json({ error: 'Só um administrador pode alterar o certificado do contador.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const pfx = Buffer.from(typeof body?.pfxBase64 === 'string' ? body.pfxBase64 : '', 'base64');
    if (pfx.length === 0 || pfx.length > TAMANHO_MAX_PFX) {
      return NextResponse.json({ error: 'Arquivo de certificado inválido.' }, { status: 422 });
    }
    const senha = typeof body?.senha === 'string' ? body.senha : '';
    const credencial = lerCertificadoA1(pfx, senha);
    if (credencial.validoAte.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Este certificado está vencido.' }, { status: 422 });
    }

    const dados = {
      certPfxCifrado: cifrar(pfx, ESCOPO_CERT_ESCRITORIO),
      certSenhaCifrada: cifrar(Buffer.from(senha, 'utf8'), ESCOPO_CERT_ESCRITORIO),
      nomeArquivo: typeof body?.nomeArquivo === 'string' ? body.nomeArquivo : null,
      titular: credencial.titular,
      documento: credencial.documento,
      validoAte: credencial.validoAte,
    };
    // Procurações verificadas com outro certificado deixam de valer.
    const [certificado] = await db.$transaction([
      db.nfseCertificadoEscritorio.upsert({
        where: { id: ID_CERT_ESCRITORIO },
        update: dados,
        create: { id: ID_CERT_ESCRITORIO, ...dados },
        select: certificadoPublico,
      }),
      db.nfseConfig.updateMany({ data: { procuracaoStatus: null, procuracaoMensagem: null, procuracaoVerificadaEm: null } }),
    ]);
    return NextResponse.json({ certificado });
  } catch (error) {
    if (error instanceof CertificadoInvalidoError || error instanceof CofreNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Erro em PUT nfse/emissores:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao salvar o certificado.' }, { status: 500 });
  }
}
