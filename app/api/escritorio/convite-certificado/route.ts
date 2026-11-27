import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { acessoEmissaoNegado } from '../../../../lib/nfse/servidor';
import {
  ID_ESCRITORIO_PADRAO,
  obterBrandingDaEmpresa,
  obterEscritorioDoUsuario,
} from '../../../../lib/nfse/escritorios-terceiros';
import {
  ensureEscritorioRecursosTables,
  registrarAuditoriaEscritorio,
} from '../../../../lib/escritorio-recursos';
import { apenasDigitos } from '../../../../lib/nfse/dps';
import { buscarGrupoWhatsAppEmpresa } from '../../../../lib/agenda-lembretes';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../lib/baileys-manager';
import { resolveWhatsAppOwnerId } from '../../../../lib/whatsapp-owner';

export const dynamic = 'force-dynamic';

/**
 * POST /api/escritorio/convite-certificado
 * Gera um link exclusivo (white-label, válido por 7 dias) para o cliente subir
 * o próprio Certificado Digital A1 (.pfx + senha) direto para o cofre criptografado.
 * Opcionalmente já dispara o link no WhatsApp do cliente.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const empresaId = String(body?.empresaId || '').trim();
    const enviarWhatsapp = Boolean(body?.enviarWhatsapp);
    const telefoneManual = typeof body?.telefone === 'string' ? body.telefone.trim() : '';

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId obrigatório.' }, { status: 400 });
    }

    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    await ensureEscritorioRecursosTables();

    const [empresa, vinculo, user] = await Promise.all([
      db.empresa.findUnique({
        where: { id: empresaId },
        select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, telefone: true },
      }),
      obterEscritorioDoUsuario(auth.session.userId),
      db.user.findUnique({ where: { id: auth.session.userId }, select: { name: true, email: true } }),
    ]);

    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    const escritorioId = vinculo?.escritorioId || ID_ESCRITORIO_PADRAO;
    const token = crypto.randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.$executeRawUnsafe(
      `INSERT INTO escritorio_cert_convites
        (token, empresa_id, escritorio_id, criado_por_id, criado_por_nome, status, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pendente', $6, NOW())`,
      token,
      empresaId,
      escritorioId,
      auth.session.userId,
      user?.name || 'Contador',
      expiresAt
    );

    const origin =
      request.headers.get('origin') ||
      (request.headers.get('host') ? `https://${request.headers.get('host')}` : 'https://privilegecontabilidade.cnt.br');
    const link = `${origin.replace(/\/$/, '')}/enviar-certificado/${token}`;

    await registrarAuditoriaEscritorio({
      userId: auth.session.userId,
      userNome: user?.name,
      userEmail: user?.email,
      escritorioId,
      acao: 'convite_certificado_criado',
      empresaId,
      empresaNome: empresa.nomeFantasia || empresa.razaoSocial,
      detalhes: `Gerou link seguro de envio do Certificado A1 (válido 7 dias)${enviarWhatsapp ? ' e disparou no WhatsApp' : ''}`,
    });

    let whatsappEnviado = false;
    let whatsappAviso = '';

    if (enviarWhatsapp) {
      let destino = '';
      const dig = apenasDigitos(telefoneManual || empresa.telefone || '');
      if (dig.length >= 10) {
        destino = dig.startsWith('55') ? dig : `55${dig}`;
      } else {
        const grupo = await buscarGrupoWhatsAppEmpresa(empresaId);
        if (grupo?.groupJid) destino = grupo.groupJid;
      }

      if (destino) {
        const ownerId = await encontrarSessaoAdminPorNumero('46999800010', resolveWhatsAppOwnerId(request));
        if (ownerId) {
          const branding = await obterBrandingDaEmpresa(empresaId);
          const nomeMarca = branding?.nome || 'Privilege Consultoria';
          const contatoMarca = branding?.telefone ? ` · ${branding.telefone}` : '';
          const msg = [
            `🔐 *Envio Seguro de Certificado Digital A1 — ${nomeMarca}*`,
            '',
            `Olá! Para ativarmos a emissão e o monitoramento fiscal automático da empresa *${empresa.nomeFantasia || empresa.razaoSocial}* (CNPJ ${empresa.cnpj}), acesse o link seguro abaixo e envie o arquivo *.pfx* junto com a senha:`,
            '',
            link,
            '',
            `🔒 _Link exclusivo e criptografado (válido por 7 dias)._`,
            `_${nomeMarca}${contatoMarca}_`,
          ].join('\n');
          const res = await sendBaileysLiveMessage(destino, msg, undefined, ownerId);
          whatsappEnviado = Boolean(res?.sent);
          if (!whatsappEnviado) whatsappAviso = res?.error || 'Não foi possível enviar no WhatsApp.';
        } else {
          whatsappAviso = 'WhatsApp não conectado no servidor.';
        }
      } else {
        whatsappAviso = 'Empresa sem telefone ou grupo WhatsApp vinculado.';
      }
    }

    return NextResponse.json({
      ok: true,
      token,
      link,
      expiresAt: expiresAt.toISOString(),
      whatsappEnviado,
      whatsappAviso,
    });
  } catch (error) {
    console.error('Erro em POST /api/escritorio/convite-certificado:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao gerar link de certificado.' }, { status: 500 });
  }
}
