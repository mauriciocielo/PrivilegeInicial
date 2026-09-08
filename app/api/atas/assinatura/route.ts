import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { checkRateLimit, getClientKey } from '../../../../lib/rate-limit';
import { captureError } from '../../../../lib/sentry-helper';
import {
  autentiqueConfigurado, criarDocumentoParaAssinatura, consultarDocumento,
  type AutentiqueSigner,
} from '../../../../lib/autentique';

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/**
 * Envia o PDF da ata para assinatura no Autentique.
 * Recebe multipart/form-data: `file` (PDF), `nome` e `signers` (JSON).
 */
export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    if (!autentiqueConfigurado()) {
      return NextResponse.json(
        { error: 'Assinatura eletrônica não configurada no servidor (AUTENTIQUE_TOKEN ausente).' },
        { status: 501 }
      );
    }

    // Cada envio consome crédito na conta do Autentique — limite estreito de propósito.
    const rate = checkRateLimit(`ata-assinatura:${getClientKey(request)}`, 20, 60 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Muitos envios. Tente novamente em ${Math.ceil(rate.retryAfterSeconds / 60)} minuto(s).` },
        { status: 429 }
      );
    }

    const form = await request.formData();
    const file = form.get('file');
    const nome = String(form.get('nome') || '').trim();
    const mensagem = String(form.get('mensagem') || '').trim();

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Arquivo PDF da ata não recebido.' }, { status: 400 });
    }
    if (!nome) {
      return NextResponse.json({ error: 'Nome do documento é obrigatório.' }, { status: 400 });
    }

    let signers: AutentiqueSigner[];
    try {
      signers = JSON.parse(String(form.get('signers') || '[]'));
    } catch {
      return NextResponse.json({ error: 'Lista de signatários inválida.' }, { status: 400 });
    }

    signers = signers
      .filter(s => s && typeof s.email === 'string' && emailValido(s.email.trim()))
      .map(s => ({ email: s.email.trim(), name: s.name?.trim() || undefined, action: s.action || 'SIGN' }));

    if (signers.length === 0) {
      return NextResponse.json({ error: 'Informe ao menos um signatário com e-mail válido.' }, { status: 400 });
    }

    const doc = await criarDocumentoParaAssinatura({
      nome,
      pdf: file,
      nomeArquivo: `${nome}.pdf`.replace(/[\\/:*?"<>|]/g, '-'),
      signers,
      mensagem: mensagem || undefined,
    });

    return NextResponse.json({ success: true, documento: doc });
  } catch (error) {
    console.error('Erro ao enviar ata para assinatura:', error);
    captureError(error);
    const msg = error instanceof Error ? error.message : 'Erro ao enviar para assinatura.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Consulta a situação das assinaturas: /api/atas/assinatura?id=<documentoId> */
export async function GET(request: Request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    if (!autentiqueConfigurado()) {
      return NextResponse.json({ configurado: false });
    }

    // Sem `id`, a rota serve para a interface descobrir se o recurso está
    // disponível — é assim que o botão de assinatura aparece ou não na tela.
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ configurado: true });

    const doc = await consultarDocumento(id);
    return NextResponse.json({ configurado: true, documento: doc });
  } catch (error) {
    console.error('Erro ao consultar assinatura da ata:', error);
    captureError(error);
    const msg = error instanceof Error ? error.message : 'Erro ao consultar a assinatura.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
