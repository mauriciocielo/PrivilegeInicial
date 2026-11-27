import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { captureError } from '../../../../../lib/sentry-helper';
import { CertificadoInvalidoError, lerCertificadoA1 } from '../../../../../lib/nfse/assinatura';
import { CofreNaoConfiguradoError, cifrar } from '../../../../../lib/nfse/cofre';
import {
  ID_ESCRITORIO_PADRAO,
  obterBrandingDaEmpresa,
} from '../../../../../lib/nfse/escritorios-terceiros';
import {
  ensureEscritorioRecursosTables,
  registrarAuditoriaEscritorio,
} from '../../../../../lib/escritorio-recursos';
import { apenasDigitos } from '../../../../../lib/nfse/dps';
import { encontrarSessaoAdminPorNumero } from '../../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../../lib/baileys-manager';

export const dynamic = 'force-dynamic';

const TAMANHO_MAX_PFX = 64 * 1024;

/**
 * GET /api/public/enviar-certificado/[token]
 * Retorna dados públicos seguros (nome/CNPJ da empresa + identidade visual do escritório parceiro)
 * para a página de envio self-service do Certificado Digital A1 pelo cliente.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await ensureEscritorioRecursosTables();
    const { token } = await params;
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM escritorio_cert_convites WHERE token = $1 LIMIT 1`,
      token
    );
    const convite = rows[0];
    if (!convite) {
      return NextResponse.json({ error: 'Link inválido ou não encontrado.' }, { status: 404 });
    }

    const expirado = new Date(convite.expires_at).getTime() < Date.now();
    const [empresa, branding] = await Promise.all([
      db.empresa.findUnique({
        where: { id: String(convite.empresa_id) },
        select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
      }),
      obterBrandingDaEmpresa(String(convite.empresa_id)),
    ]);

    if (!empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    }

    return NextResponse.json({
      status: convite.status === 'concluido' ? 'concluido' : expirado ? 'expirado' : 'pendente',
      expiresAt: new Date(convite.expires_at).toISOString(),
      certTitular: convite.cert_titular || null,
      certValidoAte: convite.cert_valido_ate ? new Date(convite.cert_valido_ate).toISOString() : null,
      empresa: {
        razaoSocial: empresa.razaoSocial,
        nomeFantasia: empresa.nomeFantasia,
        cnpj: empresa.cnpj,
      },
      branding: branding
        ? {
            nome: branding.nome,
            corPrimaria: branding.corPrimaria || '#1d4ed8',
            corSecundaria: branding.corSecundaria || branding.corPrimaria || '#1e3a8a',
            logoData: branding.logoData,
            telefone: branding.telefone,
          }
        : {
            nome: 'Privilege Consultoria',
            corPrimaria: '#600000',
            corSecundaria: '#450000',
            logoData: null,
            telefone: '(46) 99980-0010',
          },
    });
  } catch (error) {
    console.error('Erro em GET /api/public/enviar-certificado/[token]:', error);
    return NextResponse.json({ error: 'Erro ao validar link de envio.' }, { status: 500 });
  }
}

/**
 * POST /api/public/enviar-certificado/[token]
 * Recebe o .pfx + senha enviados pelo cliente, valida o certificado A1, cifra com AES-256-GCM,
 * grava no cofre da empresa e notifica o escritório contábil via WhatsApp.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await ensureEscritorioRecursosTables();
    const { token } = await params;
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM escritorio_cert_convites WHERE token = $1 LIMIT 1`,
      token
    );
    const convite = rows[0];
    if (!convite) {
      return NextResponse.json({ error: 'Link inválido ou não encontrado.' }, { status: 404 });
    }
    if (convite.status === 'concluido') {
      return NextResponse.json({ error: 'Este link já foi utilizado com sucesso.' }, { status: 409 });
    }
    if (new Date(convite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Este link expirou. Solicite um novo link ao seu escritório contábil.' }, { status: 410 });
    }

    const body = await request.json().catch(() => ({}));
    const pfxBase64 = typeof body?.pfxBase64 === 'string' ? body.pfxBase64.trim() : '';
    const senha = typeof body?.senha === 'string' ? body.senha : '';
    const nomeArquivo = typeof body?.nomeArquivo === 'string' ? body.nomeArquivo.slice(0, 140) : 'certificado-a1.pfx';

    if (!pfxBase64 || !senha) {
      return NextResponse.json({ error: 'Selecione o arquivo .pfx/.p12 e informe a senha do certificado.' }, { status: 400 });
    }

    const limpo = pfxBase64.includes(',') ? pfxBase64.split(',').pop() || '' : pfxBase64;
    const pfx = Buffer.from(limpo, 'base64');
    if (pfx.length === 0 || pfx.length > TAMANHO_MAX_PFX) {
      return NextResponse.json({ error: 'Arquivo de certificado inválido ou acima de 64 KB.' }, { status: 400 });
    }

    const credencial = lerCertificadoA1(pfx, senha);
    if (credencial.validoAte.getTime() < Date.now()) {
      return NextResponse.json(
        { error: `Este certificado venceu em ${credencial.validoAte.toLocaleDateString('pt-BR')}. Envie o certificado renovado.` },
        { status: 422 }
      );
    }

    const empresaId = String(convite.empresa_id);
    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: { razaoSocial: true, nomeFantasia: true, cnpj: true },
    });
    if (!empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    }

    // Valida se o CNPJ do certificado bate com a empresa (se o cert tiver CNPJ)
    const cnpjEmpresa = apenasDigitos(empresa.cnpj);
    const cnpjCert = apenasDigitos(credencial.documento || '');
    if (cnpjCert.length === 14 && cnpjEmpresa.length === 14 && cnpjCert !== cnpjEmpresa) {
      return NextResponse.json(
        { error: `O CNPJ deste certificado (${cnpjCert}) não corresponde ao CNPJ da empresa (${empresa.cnpj}).` },
        { status: 422 }
      );
    }

    const certPfxCifrado = cifrar(pfx, empresaId);
    const certSenhaCifrada = cifrar(Buffer.from(senha, 'utf8'), empresaId);

    await db.nfseConfig.upsert({
      where: { empresaId },
      create: {
        empresaId,
        ambiente: 'producao',
        usarProcuracao: false,
        certPfxCifrado,
        certSenhaCifrada,
        certNomeArquivo: nomeArquivo,
        certTitular: credencial.titular,
        certValidoAte: credencial.validoAte,
      },
      update: {
        usarProcuracao: false,
        certPfxCifrado,
        certSenhaCifrada,
        certNomeArquivo: nomeArquivo,
        certTitular: credencial.titular,
        certValidoAte: credencial.validoAte,
      },
    });

    await db.$executeRawUnsafe(
      `UPDATE escritorio_cert_convites
       SET status = 'concluido', concluido_em = NOW(), cert_titular = $2, cert_valido_ate = $3
       WHERE token = $1`,
      token,
      credencial.titular,
      credencial.validoAte
    );

    const escritorioId = String(convite.escritorio_id || ID_ESCRITORIO_PADRAO);
    await registrarAuditoriaEscritorio({
      userId: 'cliente-publico',
      userNome: 'Cliente (Link Self-Service)',
      escritorioId,
      acao: 'certificado_recebido_cliente',
      empresaId,
      empresaNome: empresa.nomeFantasia || empresa.razaoSocial,
      detalhes: `Certificado A1 enviado pelo cliente (${credencial.titular}, válido até ${credencial.validoAte.toLocaleDateString('pt-BR')})`,
    });

    // Notifica o escritório contábil via WhatsApp
    (async () => {
      try {
        let telDestino = '5546999800010';
        if (escritorioId !== ID_ESCRITORIO_PADRAO) {
          const escRows = await db.$queryRawUnsafe<Array<{ telefone: string | null }>>(
            `SELECT telefone FROM nfse_escritorios WHERE id = $1 LIMIT 1`,
            escritorioId
          );
          const dig = apenasDigitos(escRows[0]?.telefone || '');
          if (dig.length >= 10) telDestino = dig.startsWith('55') ? dig : `55${dig}`;
          else return;
        }
        const ownerId = await encontrarSessaoAdminPorNumero('46999800010');
        if (!ownerId) return;
        const msg = [
          `✅ *Certificado Digital A1 Recebido!*`,
          '',
          `🏢 *Empresa:* ${empresa.nomeFantasia || empresa.razaoSocial}`,
          `📄 *CNPJ:* ${empresa.cnpj}`,
          `🔐 *Titular:* ${credencial.titular}`,
          `📅 *Validade:* ${credencial.validoAte.toLocaleDateString('pt-BR')}`,
          '',
          `O certificado já foi validado, criptografado no cofre e ativado automaticamente no painel.`,
        ].join('\n');
        await sendBaileysLiveMessage(telDestino, msg, undefined, ownerId);
      } catch {
        // ignora
      }
    })();

    return NextResponse.json({
      ok: true,
      titular: credencial.titular,
      validoAte: credencial.validoAte.toISOString(),
    });
  } catch (error) {
    if (error instanceof CertificadoInvalidoError || error instanceof CofreNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Erro em POST /api/public/enviar-certificado/[token]:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao validar e salvar o certificado.' }, { status: 500 });
  }
}
