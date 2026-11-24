import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { ID_CERT_ESCRITORIO } from '../../../../lib/nfse/servidor';
import { filtroEmpresasNfse } from '../../../../lib/nfse/escopo';
import {
  escopoCertificadoEscritorio,
  idsEmpresasDeTerceiros,
  idsEmpresasDoEscritorio,
  obterEscritorioDoUsuario,
} from '../../../../lib/nfse/escritorios-terceiros';
import { cnpjValido } from '../../../../lib/nfse/dps';
import { CertificadoInvalidoError, lerCertificadoA1 } from '../../../../lib/nfse/assinatura';
import { CofreNaoConfiguradoError, cifrar } from '../../../../lib/nfse/cofre';

const TAMANHO_MAX_PFX = 64 * 1024;

const certificadoPublico = { titular: true, documento: true, nomeArquivo: true, validoAte: true } as const;

/** Empresas que o usuário pode operar, com a situação da procuração, e o certificado do contador. */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const vinculoTerceiro = await obterEscritorioDoUsuario(auth.session.userId);
    if (vinculoTerceiro && !vinculoTerceiro.ativo) {
      return NextResponse.json({ error: 'Conta do escritório contábil suspensa.' }, { status: 403 });
    }
    const certId = vinculoTerceiro ? vinculoTerceiro.escritorioId : ID_CERT_ESCRITORIO;
    const filtroEmpresas = await filtroEmpresasNfse(auth.session);

    const [empresas, certificado] = await Promise.all([
      db.empresa.findMany({
        where: filtroEmpresas,
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
      db.nfseCertificadoEscritorio.findUnique({ where: { id: certId }, select: certificadoPublico }),
    ]);

    const idsEmpresasVisiveis = empresas.map(e => e.id);
    const usuariosClientes = idsEmpresasVisiveis.length > 0
      ? await db.user.findMany({
          where: { role: 'cliente', empresaIds: { hasSome: idsEmpresasVisiveis } },
          select: { id: true, name: true, email: true, empresaIds: true },
          orderBy: { name: 'asc' },
        })
      : [];

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
      escritorioNome: vinculoTerceiro?.nomeEscritorio || null,
      podeAlterarCertificado: auth.session.role === 'administrador' || vinculoTerceiro?.papel === 'admin_escritorio',
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
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const vinculoTerceiro = await obterEscritorioDoUsuario(auth.session.userId);
    const podeAlterar = auth.session.role === 'administrador' || (vinculoTerceiro?.ativo && vinculoTerceiro.papel === 'admin_escritorio');
    if (!podeAlterar) {
      return NextResponse.json({ error: 'Só um administrador pode alterar o certificado do contador.' }, { status: 403 });
    }
    const certId = vinculoTerceiro ? vinculoTerceiro.escritorioId : ID_CERT_ESCRITORIO;
    const escopoCifra = escopoCertificadoEscritorio(certId);

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
      certPfxCifrado: cifrar(pfx, escopoCifra),
      certSenhaCifrada: cifrar(Buffer.from(senha, 'utf8'), escopoCifra),
      nomeArquivo: typeof body?.nomeArquivo === 'string' ? body.nomeArquivo : null,
      titular: credencial.titular,
      documento: credencial.documento,
      validoAte: credencial.validoAte,
    };
    // Procurações verificadas com outro certificado deixam de valer — APENAS para as empresas deste escritório.
    const whereReset = vinculoTerceiro
      ? { empresaId: { in: await idsEmpresasDoEscritorio(vinculoTerceiro.escritorioId) } }
      : { empresaId: { notIn: await idsEmpresasDeTerceiros() } };

    const [certificado] = await db.$transaction([
      db.nfseCertificadoEscritorio.upsert({
        where: { id: certId },
        update: dados,
        create: { id: certId, ...dados },
        select: certificadoPublico,
      }),
      db.nfseConfig.updateMany({
        where: whereReset,
        data: { procuracaoStatus: null, procuracaoMensagem: null, procuracaoVerificadaEm: null },
      }),
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
