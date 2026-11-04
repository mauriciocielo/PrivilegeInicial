import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { acessoNegado, ID_CERT_ESCRITORIO, abrirCredencialEscritorio } from '../../../../lib/nfse/servidor';
import { lerCertificadoA1, certificadoPertenceAoCnpj, CertificadoInvalidoError } from '../../../../lib/nfse/assinatura';
import { cifrar, CofreNaoConfiguradoError } from '../../../../lib/nfse/cofre';
import { apenasDigitos } from '../../../../lib/nfse/dps';

const TAMANHO_MAX_PFX = 2 * 1024 * 1024; // 2 MB

/** Retorna a situação do certificado digital da empresa (próprio A1 vs procuração do escritório). */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const url = new URL(request.url);
    const empresaId = url.searchParams.get('empresaId') || '';
    if (!empresaId) return NextResponse.json({ error: 'Informe a empresa.' }, { status: 400 });

    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const [empresa, certEscritorio] = await Promise.all([
      db.empresa.findUnique({
        where: { id: empresaId },
        select: {
          id: true, razaoSocial: true, nomeFantasia: true, cnpj: true,
          nfseConfig: {
            select: {
              usarProcuracao: true, procuracaoStatus: true, certValidoAte: true,
              certTitular: true, certCnpj: true, certNomeArquivo: true,
            },
          },
        },
      }),
      db.nfseCertificadoEscritorio.findUnique({
        where: { id: ID_CERT_ESCRITORIO },
        select: { titular: true, documento: true, validoAte: true, nomeArquivo: true },
      }),
    ]);

    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    const agora = Date.now();
    const config = empresa.nfseConfig;

    const certProprioValidoAte = config?.certValidoAte ? new Date(config.certValidoAte) : null;
    const certProprioCadastrado = Boolean(certProprioValidoAte);
    const certProprioVencido = certProprioValidoAte ? certProprioValidoAte.getTime() < agora : false;
    const certProprioDias = certProprioValidoAte ? Math.ceil((certProprioValidoAte.getTime() - agora) / 86400000) : null;

    const certEscritorioValidoAte = certEscritorio?.validoAte ? new Date(certEscritorio.validoAte) : null;
    const certEscritorioCadastrado = Boolean(certEscritorioValidoAte);
    const certEscritorioVencido = certEscritorioValidoAte ? certEscritorioValidoAte.getTime() < agora : false;

    // Determina o modo atual de busca de notas
    const usarProcuracao = config?.usarProcuracao ?? (certProprioCadastrado ? false : true);

    return NextResponse.json({
      empresaId: empresa.id,
      razaoSocial: empresa.razaoSocial,
      cnpj: empresa.cnpj,
      modoAtivo: usarProcuracao ? 'escritorio' : (certProprioCadastrado ? 'propria' : 'ausente'),
      usarProcuracao,
      certProprio: {
        cadastrado: certProprioCadastrado,
        titular: config?.certTitular ?? null,
        cnpj: config?.certCnpj ?? null,
        nomeArquivo: config?.certNomeArquivo ?? null,
        validoAte: certProprioValidoAte?.toISOString() ?? null,
        vencido: certProprioVencido,
        diasParaVencer: certProprioDias,
      },
      certEscritorio: {
        cadastrado: certEscritorioCadastrado,
        titular: certEscritorio?.titular ?? null,
        cnpj: certEscritorio?.documento ?? null,
        validoAte: certEscritorioValidoAte?.toISOString() ?? null,
        vencido: certEscritorioVencido,
        procuracaoStatus: config?.procuracaoStatus ?? null,
      },
    });
  } catch (error) {
    console.error('Erro em GET nfe/certificado:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao consultar certificados.' }, { status: 500 });
  }
}

/**
 * Upload do arquivo PFX do certificado A1 da própria empresa.
 * Extrai dados, valida CNPJ e vigência, cifra no cofre (AES-256-GCM) e ativa para busca de notas.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId : '';
    if (!empresaId) return NextResponse.json({ error: 'Informe a empresa.' }, { status: 400 });

    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { id: true, cnpj: true, razaoSocial: true } });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    const pfxBase64 = typeof body?.pfxBase64 === 'string' ? body.pfxBase64 : '';
    const senha = typeof body?.senha === 'string' ? body.senha : '';
    const nomeArquivo = typeof body?.nomeArquivo === 'string' ? body.nomeArquivo.slice(0, 150) : 'certificado.pfx';

    if (!pfxBase64) return NextResponse.json({ error: 'Selecione o arquivo .pfx ou .p12 do certificado A1.' }, { status: 422 });

    const pfx = Buffer.from(pfxBase64, 'base64');
    if (pfx.length === 0 || pfx.length > TAMANHO_MAX_PFX) {
      return NextResponse.json({ error: 'Arquivo de certificado inválido ou maior que 2 MB.' }, { status: 422 });
    }

    // Leitura e validação da chave privada e cadeia ICP-Brasil
    const credencial = lerCertificadoA1(pfx, senha);
    if (credencial.validoAte.getTime() < Date.now()) {
      return NextResponse.json({ error: `Este certificado A1 está vencido (expirou em ${credencial.validoAte.toLocaleDateString('pt-BR')}).` }, { status: 422 });
    }

    // Valida se o CNPJ do certificado corresponde à empresa (mesma raiz de 8 dígitos para aceitar filiais)
    if (!certificadoPertenceAoCnpj(credencial, empresa.cnpj)) {
      return NextResponse.json({
        error: `O certificado pertence ao CNPJ ${credencial.cnpj || credencial.titular}, diferente do CNPJ da empresa (${empresa.cnpj}).`,
      }, { status: 422 });
    }

    // Criptografa PFX e senha no cofre isolado por empresaId
    const certPfxCifrado = cifrar(pfx, empresaId);
    const certSenhaCifrada = cifrar(Buffer.from(senha, 'utf8'), empresaId);

    // Salva ou atualiza a configuração fiscal da empresa
    await db.nfseConfig.upsert({
      where: { empresaId },
      update: {
        usarProcuracao: false,
        certPfxCifrado,
        certSenhaCifrada,
        certNomeArquivo: nomeArquivo,
        certTitular: credencial.titular,
        certCnpj: credencial.cnpj,
        certValidoAte: credencial.validoAte,
      },
      create: {
        empresaId,
        usarProcuracao: false,
        certPfxCifrado,
        certSenhaCifrada,
        certNomeArquivo: nomeArquivo,
        certTitular: credencial.titular,
        certCnpj: credencial.cnpj,
        certValidoAte: credencial.validoAte,
      },
    });

    // Garante que o monitor de NF-e exista e esteja apto
    await db.nfeDistribuicao.upsert({
      where: { empresaId },
      update: { certOrigem: 'propria', proximaConsultaEm: null }, // Libera consulta imediata com o novo certificado
      create: { empresaId, ativo: true, certOrigem: 'propria' },
    });

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Certificado A1 validado e salvo com sucesso!',
      titular: credencial.titular,
      cnpj: credencial.cnpj,
      validoAte: credencial.validoAte.toISOString(),
    });
  } catch (error) {
    if (error instanceof CertificadoInvalidoError || error instanceof CofreNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Erro em POST nfe/certificado:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao processar certificado A1.' }, { status: 500 });
  }
}

/** Alterna entre Certificado Próprio A1 e Procuração do Escritório. */
export async function PUT(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId : '';
    const usarProcuracao = Boolean(body?.usarProcuracao);

    if (!empresaId) return NextResponse.json({ error: 'Informe a empresa.' }, { status: 400 });

    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const config = await db.nfseConfig.findUnique({ where: { empresaId } });
    if (!usarProcuracao) {
      if (!config?.certPfxCifrado || !config?.certValidoAte || new Date(config.certValidoAte).getTime() < Date.now()) {
        return NextResponse.json({ error: 'Esta empresa não possui um certificado A1 próprio válido cadastrado. Faça o upload do arquivo .pfx primeiro.' }, { status: 422 });
      }
    } else {
      // Se for usar procuração, checa se o escritório possui certificado
      const certEscritorio = await db.nfseCertificadoEscritorio.findUnique({ where: { id: ID_CERT_ESCRITORIO } });
      if (!certEscritorio) {
        return NextResponse.json({ error: 'O escritório ainda não enviou o certificado digital em Emissores por Procuração.' }, { status: 422 });
      }
    }

    await db.nfseConfig.update({
      where: { empresaId },
      data: { usarProcuracao },
    });

    await db.nfeDistribuicao.updateMany({
      where: { empresaId },
      data: { certOrigem: usarProcuracao ? 'escritorio' : 'propria' },
    });

    return NextResponse.json({
      sucesso: true,
      usarProcuracao,
      modoAtivo: usarProcuracao ? 'escritorio' : 'propria',
    });
  } catch (error) {
    console.error('Erro em PUT nfe/certificado:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao alternar modo do certificado.' }, { status: 500 });
  }
}

/** Remove o certificado próprio A1 da empresa (voltando para procuração se disponível). */
export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const url = new URL(request.url);
    const empresaId = url.searchParams.get('empresaId') || '';
    if (!empresaId) return NextResponse.json({ error: 'Informe a empresa.' }, { status: 400 });

    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    await db.nfseConfig.updateMany({
      where: { empresaId },
      data: {
        usarProcuracao: true,
        certPfxCifrado: null,
        certSenhaCifrada: null,
        certNomeArquivo: null,
        certTitular: null,
        certCnpj: null,
        certValidoAte: null,
      },
    });

    await db.nfeDistribuicao.updateMany({
      where: { empresaId },
      data: { certOrigem: 'escritorio' },
    });

    return NextResponse.json({ sucesso: true, mensagem: 'Certificado próprio removido.' });
  } catch (error) {
    console.error('Erro em DELETE nfe/certificado:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao remover certificado.' }, { status: 500 });
  }
}
