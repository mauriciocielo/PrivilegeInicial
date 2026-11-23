import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { buscarGrupoWhatsAppEmpresa } from '../../../../lib/agenda-lembretes';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../lib/baileys-manager';
import { resolveWhatsAppOwnerId } from '../../../../lib/whatsapp-owner';
import { registrarDisparoWhatsApp } from '../../../../lib/whatsapp-disparos-log';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito a consultores e administradores.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId.trim() : '';
    const titulo = typeof body?.titulo === 'string' && body.titulo.trim() ? body.titulo.trim() : 'Reunião de Acompanhamento';
    const data = typeof body?.data === 'string' && body.data.trim() ? body.data.trim() : new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const topicos = typeof body?.topicos === 'string' ? body.topicos.trim() : '';
    const participantes = typeof body?.participantes === 'string' ? body.participantes.trim() : 'Equipe Privilege e Cliente';
    const enviarNoGrupo = body?.enviarNoGrupo !== false;

    if (!empresaId || !topicos) {
      return NextResponse.json({ error: 'Informe a empresa e os tópicos discutidos na reunião.' }, { status: 400 });
    }

    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, nomeFantasia: true, razaoSocial: true },
    });
    if (!empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    }
    const empNome = empresa.nomeFantasia || empresa.razaoSocial;
    const dataBr = data.includes('-') ? data.split('-').reverse().join('/') : data;

    // 1. Formata a Ata Executiva via Gemini (com fallback estruturado)
    let ataFormatada = '';
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (geminiKey) {
      try {
        const prompt = [
          `Você é um consultor executivo da Privilege Contabilidade e Consultoria.`,
          `Transforme os tópicos abaixo em uma Ata Executiva clara, objetiva e pronta para enviar no WhatsApp do cliente.`,
          `Empresa: ${empNome}`,
          `Reunião: ${titulo} (${dataBr})`,
          `Participantes: ${participantes}`,
          `Tópicos anotados pelo consultor:\n${topicos}`,
          ``,
          `Estrutura obrigatória (use negrito com *asteriscos* do WhatsApp, sem markdown com ##):`,
          `1. *Resumo da Reunião* (2 frases)`,
          `2. *Decisões & Alinhamentos* (bullet points com •)`,
          `3. *Próximos Passos* (bullet points com • indicando responsável se mencionado)`,
        ].join('\n');

        const gRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            signal: AbortSignal.timeout(10000),
          }
        );
        if (gRes.ok) {
          const gJson = await gRes.json();
          ataFormatada = String(gJson?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
        }
      } catch {
        // usa fallback
      }
    }

    if (!ataFormatada) {
      const linhas = topicos.split('\n').map((l: string) => l.trim()).filter(Boolean).map((l: string) => `• ${l.replace(/^[-•*]\s*/, '')}`);
      ataFormatada = [
        `*Resumo & Alinhamentos:*`,
        ...linhas,
      ].join('\n');
    }

    // 2. Salva na tabela AtaAtendimento do PostgreSQL
    const ataSalva = await db.ataAtendimento.create({
      data: {
        empresaId,
        consultorId: auth.session.userId,
        data,
        titulo,
        conteudo: ataFormatada,
        participantes,
      },
    });

    // 3. Se solicitado e a empresa tiver grupo vinculado, dispara no grupo do cliente
    let enviadoGrupo = false;
    let grupoNome: string | null = null;
    let erroGrupo: string | null = null;

    if (enviarNoGrupo) {
      const grupo = await buscarGrupoWhatsAppEmpresa(empresaId);
      if (grupo?.groupJid) {
        grupoNome = grupo.groupName;
        const mensagemGrupo = [
          `📋 *Ata de Reunião — ${empNome}*`,
          `📅 ${dataBr} • *${titulo}*`,
          participantes ? `👥 Participantes: ${participantes}` : '',
          ``,
          ataFormatada,
          ``,
          `_Privilege Contabilidade e Consultoria_`,
        ]
          .filter(Boolean)
          .join('\n');

        const ownerIdPreferencial = resolveWhatsAppOwnerId(request);
        const ownerId = await encontrarSessaoAdminPorNumero('46999800010', ownerIdPreferencial);
        if (ownerId) {
          const res = await sendBaileysLiveMessage(grupo.groupJid, mensagemGrupo, undefined, ownerId);
          enviadoGrupo = Boolean(res?.sent);
          erroGrupo = res?.sent ? null : (res?.error || 'Falha no envio ao grupo');
          await registrarDisparoWhatsApp({
            categoria: 'agenda_criacao',
            destino: grupo.groupJid,
            destinoNome: `Ata • ${grupo.groupName}`,
            mensagem: mensagemGrupo,
            status: res?.sent ? 'enviado' : 'erro',
            erro: erroGrupo,
            ownerId,
          });
        } else {
          erroGrupo = 'WhatsApp não está conectado no servidor no momento.';
        }
      } else {
        erroGrupo = 'Empresa não possui grupo de WhatsApp vinculado.';
      }
    }

    return NextResponse.json({
      ok: true,
      ataId: ataSalva.id,
      conteudo: ataFormatada,
      enviadoGrupo,
      grupoNome,
      erroGrupo,
    });
  } catch (error) {
    console.error('Erro em POST /api/agenda/ata-pos-reuniao:', error);
    return NextResponse.json({ error: 'Erro ao gerar e salvar Ata Pós-Reunião.' }, { status: 500 });
  }
}
