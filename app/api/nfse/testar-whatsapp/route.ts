import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { enviarNfsePorWhatsAppAoEmissor } from '../../../../lib/nfse/enviar-whatsapp-nfse';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const telefone = typeof body?.telefone === 'string' ? body.telefone.trim() : '';
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId.trim() : '';

    if (telefone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ error: 'Informe um WhatsApp válido com DDD (ex.: 46999016003).' }, { status: 400 });
    }

    // Busca última NFS-e emitida com XML (da empresa ou do escritório) para testar o PDF real
    let nota = empresaId
      ? await db.nfsE.findFirst({
          where: { empresaId, status: 'emitida', documento: { isNot: null } },
          include: { documento: true },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    if (!nota) {
      nota = await db.nfsE.findFirst({
        where: { status: 'emitida', documento: { isNot: null } },
        include: { documento: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!nota || !nota.documento?.nfseXml) {
      return NextResponse.json(
        { error: 'Nenhuma NFS-e emitida com XML encontrada para gerar o PDF de teste.' },
        { status: 404 }
      );
    }

    const res = await enviarNfsePorWhatsAppAoEmissor({
      telefoneDestino: telefone,
      numero: nota.numero || 'TESTE',
      dataEmissao: nota.dataEmissao,
      prestadorNome: nota.prestadorRazaoSocial,
      tomadorNome: nota.tomadorRazaoSocial,
      valorLiquido: nota.valorLiquido,
      nfseXml: nota.documento.nfseXml,
      ambiente: nota.ambiente || 'producao',
    });

    if (!res.enviado) {
      return NextResponse.json({ error: res.motivo || 'Não foi possível enviar o teste no WhatsApp.' }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      notaNumero: nota.numero,
      tomador: nota.tomadorRazaoSocial,
      ownerId: res.ownerId,
    });
  } catch (err) {
    console.error('Erro em POST /api/nfse/testar-whatsapp:', err);
    return NextResponse.json({ error: 'Erro interno ao enviar teste no WhatsApp.' }, { status: 500 });
  }
}
