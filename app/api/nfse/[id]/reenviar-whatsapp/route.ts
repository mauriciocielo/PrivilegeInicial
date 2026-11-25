import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { acessoEmissaoNegado } from '../../../../../lib/nfse/servidor';
import { apenasDigitos } from '../../../../../lib/nfse/dps';
import { enviarNfsePorWhatsAppAoEmissor } from '../../../../../lib/nfse/enviar-whatsapp-nfse';
import { registrarEntregaNfse } from '../../../../../lib/nfse/entregas-db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/nfse/[id]/reenviar-whatsapp
 * Reenvia a DANFSe (PDF oficial) de uma nota emitida para o WhatsApp informado
 * usando a sessão central (46) 99980-0010.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const nota = await db.nfsE.findUnique({
      where: { id },
      include: { documento: { select: { nfseXml: true } } },
    });
    if (!nota) return NextResponse.json({ error: 'Nota não encontrada.' }, { status: 404 });

    const negado = await acessoEmissaoNegado(auth.session, nota.empresaId);
    if (negado) return negado;

    if (!nota.documento?.nfseXml) {
      return NextResponse.json({ error: 'Esta nota não possui XML autorizado para gerar o PDF.' }, { status: 422 });
    }

    const body = await request.json().catch(() => ({}));
    let telefone = typeof body?.telefone === 'string' ? body.telefone.trim() : '';

    // Se não veio telefone no body, tenta puxar do cadastro de Cliente
    if (apenasDigitos(telefone).length < 10 && nota.clienteId) {
      const cli = await db.cliente.findUnique({
        where: { id: nota.clienteId },
        select: { celular: true, telefone: true },
      });
      telefone = cli?.celular || cli?.telefone || '';
    }

    if (apenasDigitos(telefone).length < 10) {
      return NextResponse.json({ error: 'Informe um número de WhatsApp válido (com DDD).' }, { status: 400 });
    }

    const envio = await enviarNfsePorWhatsAppAoEmissor({
      telefoneDestino: telefone,
      numero: nota.numero || '',
      dataEmissao: nota.dataEmissao,
      prestadorNome: nota.prestadorRazaoSocial,
      tomadorNome: nota.tomadorRazaoSocial,
      valorLiquido: nota.valorLiquido,
      nfseXml: nota.documento.nfseXml,
      ambiente: nota.ambiente || 'producao',
    });

    if (!envio.enviado) {
      return NextResponse.json({ error: envio.motivo || 'Não foi possível enviar no WhatsApp.' }, { status: 422 });
    }

    await registrarEntregaNfse({
      nfseId: nota.id,
      empresaId: nota.empresaId,
      whatsappEnviado: true,
      whatsappDestino: telefone,
    });

    return NextResponse.json({ ok: true, telefone });
  } catch (error) {
    console.error('Erro em POST /api/nfse/[id]/reenviar-whatsapp:', error);
    return NextResponse.json({ error: 'Erro ao reenviar PDF no WhatsApp.' }, { status: 500 });
  }
}
