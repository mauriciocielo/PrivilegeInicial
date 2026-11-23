import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../lib/baileys-manager';
import { registrarDisparoWhatsApp } from '../../../../lib/whatsapp-disparos-log';

export const dynamic = 'force-dynamic';

const SLOTS_PADRAO = ['08:00', '09:00', '10:00', '11:00', '13:30', '14:30', '15:30', '16:30', '17:30'];

async function obterGoogleAccessTokenConsultor(userId: string): Promise<string | null> {
  try {
    const rows = await db.$queryRawUnsafe<
      Array<{ user_id: string; access_token: string; refresh_token: string | null; expires_at: string | number }>
    >(
      `SELECT user_id, access_token, refresh_token, expires_at
         FROM google_calendar_tokens
        WHERE user_id = $1
        LIMIT 1`,
      userId
    );
    const row = rows[0];
    if (!row) return null;

    const exp = Number(row.expires_at || 0);
    if (row.access_token && exp > Date.now() + 2 * 60 * 1000) {
      return row.access_token;
    }

    if (row.refresh_token) {
      const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
      if (clientId && clientSecret) {
        const tRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: row.refresh_token,
            grant_type: 'refresh_token',
          }),
          signal: AbortSignal.timeout(7000),
        });
        const tJson = await tRes.json().catch(() => ({}));
        if (tRes.ok && tJson.access_token) {
          const novoExp = Date.now() + Number(tJson.expires_in || 3600) * 1000;
          await db.$executeRawUnsafe(
            `UPDATE google_calendar_tokens SET access_token = $2, expires_at = $3, updated_at = NOW() WHERE user_id = $1`,
            row.user_id,
            tJson.access_token,
            novoExp
          );
          return String(tJson.access_token);
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function slugify(nome: string): string {
  return (nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function listarConsultoresPublicos() {
  const usuarios = await db.user.findMany({
    where: { role: { not: 'cliente' } },
    select: { id: true, name: true, email: true, phone: true, role: true },
    orderBy: { name: 'asc' },
  });
  return usuarios;
}

async function localizarConsultorPorSlug(slug: string, usuariosParam?: Awaited<ReturnType<typeof listarConsultoresPublicos>>) {
  const alvo = decodeURIComponent(slug || '').trim().toLowerCase();
  const usuarios = usuariosParam || (await listarConsultoresPublicos());
  return (
    usuarios.find(u => u.id.toLowerCase() === alvo) ||
    usuarios.find(u => slugify(u.name) === alvo) ||
    usuarios.find(u => slugify(u.name.split(' ')[0]) === alvo) ||
    usuarios.find(u => u.role === 'administrador') ||
    usuarios[0] ||
    null
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const todosConsultores = await listarConsultoresPublicos();
    const consultor = await localizarConsultorPorSlug(slug, todosConsultores);
    if (!consultor) {
      return NextResponse.json({ error: 'Nenhum consultor disponível no momento.' }, { status: 404 });
    }

    const agoraBr = new Date(Date.now() - 3 * 3600 * 1000);
    const diasDisponiveis: Array<{ dateStr: string; label: string; diaSemana: string; horarios: string[] }> = [];

    const datasConsulta: string[] = [];
    const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    for (let i = 0; i < 16 && datasConsulta.length < 10; i++) {
      const d = new Date(agoraBr.getTime() + i * 86400000);
      const dow = d.getUTCDay();
      if (dow === 0 || dow === 6) continue; // apenas dias úteis
      const iso = d.toISOString().slice(0, 10);
      datasConsulta.push(iso);
    }

    const ocupados = await db.agendaTask.findMany({
      where: {
        dateStr: { in: datasConsulta },
        completed: false,
      },
      select: { dateStr: true, horario: true, consultorId: true, consultoresIds: true },
    });

    // Cruza também com o Google Calendar do consultor (se conectado) para evitar choque de horários externos
    const intervalosGoogle: Array<{ startMs: number; endMs: number }> = [];
    if (datasConsulta.length > 0) {
      try {
        const gToken = await obterGoogleAccessTokenConsultor(consultor.id);
        if (gToken) {
          const timeMin = `${datasConsulta[0]}T00:00:00-03:00`;
          const timeMax = `${datasConsulta[datasConsulta.length - 1]}T23:59:59-03:00`;
          const gRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true`,
            { headers: { Authorization: `Bearer ${gToken}` }, signal: AbortSignal.timeout(6000) }
          );
          if (gRes.ok) {
            const gData = await gRes.json();
            for (const ev of gData.items || []) {
              if (ev.status === 'cancelled') continue;
              if (ev.transparency === 'transparent') continue; // evento marcado como "livre"
              const sRaw = ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T00:00:00-03:00` : null);
              const eRaw = ev.end?.dateTime || (ev.end?.date ? `${ev.end.date}T23:59:59-03:00` : null);
              if (!sRaw || !eRaw) continue;
              const startMs = Date.parse(sRaw);
              const endMs = Date.parse(eRaw);
              if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
                intervalosGoogle.push({ startMs, endMs });
              }
            }
          }
        }
      } catch {
        // fallback silencioso apenas com a Agenda do sistema
      }
    }

    const horaAtualMin = agoraBr.getUTCHours() * 60 + agoraBr.getUTCMinutes();
    const hojeIso = agoraBr.toISOString().slice(0, 10);

    for (const iso of datasConsulta) {
      const [ano, mes, dia] = iso.split('-').map(Number);
      const dt = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
      const ocupadosDia = new Set(
        ocupados
          .filter(o => {
            if (o.dateStr !== iso) return false;
            const ids = Array.isArray(o.consultoresIds) ? (o.consultoresIds as string[]) : [];
            return o.consultorId === consultor.id || ids.includes(consultor.id);
          })
          .map(o => String(o.horario || '').slice(0, 5))
      );

      const livres = SLOTS_PADRAO.filter(slot => {
        if (ocupadosDia.has(slot)) return false;
        if (iso === hojeIso) {
          const [sh, sm] = slot.split(':').map(Number);
          if (sh * 60 + sm <= horaAtualMin + 60) return false; // mínimo 1h de antecedência
        }
        if (intervalosGoogle.length > 0) {
          const slotStart = Date.parse(`${iso}T${slot}:00-03:00`);
          const slotEnd = slotStart + 60 * 60 * 1000;
          const conflitoGoogle = intervalosGoogle.some(ev => slotStart < ev.endMs && slotEnd > ev.startMs);
          if (conflitoGoogle) return false;
        }
        return true;
      });

      if (livres.length > 0) {
        diasDisponiveis.push({
          dateStr: iso,
          label: `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`,
          diaSemana: nomesDias[dt.getUTCDay()],
          horarios: livres,
        });
      }
    }

    return NextResponse.json({
      consultor: {
        id: consultor.id,
        slug: slugify(consultor.name) || consultor.id,
        nome: consultor.name,
        cargo: consultor.role === 'administrador' ? 'Diretoria & Consultoria' : 'Consultor Privilege',
      },
      consultores: todosConsultores.map(u => ({
        id: u.id,
        slug: slugify(u.name) || u.id,
        nome: u.name,
        cargo: u.role === 'administrador' ? 'Diretoria & Consultoria' : 'Consultor Privilege',
      })),
      diasDisponiveis,
    });
  } catch (error) {
    console.error('Erro em GET /api/agendar/[slug]:', error);
    return NextResponse.json({ error: 'Erro ao carregar agenda disponível.' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const consultor = await localizarConsultorPorSlug(slug);
    if (!consultor) {
      return NextResponse.json({ error: 'Consultor não encontrado.' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const nomeCliente = typeof body?.nome === 'string' ? body.nome.trim() : '';
    const empresaCliente = typeof body?.empresa === 'string' ? body.empresa.trim() : '';
    const emailCliente = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const emailsExtrasRaw = typeof body?.emailsExtras === 'string' ? body.emailsExtras : '';
    const telefoneCliente = typeof body?.telefone === 'string' ? body.telefone.replace(/\D/g, '') : '';
    const assunto = typeof body?.assunto === 'string' && body.assunto.trim() ? body.assunto.trim() : 'Reunião de Consultoria';
    const modalidade = typeof body?.modalidade === 'string' && body.modalidade.trim() ? body.modalidade.trim() : 'Online (Google Meet)';
    const observacoes = typeof body?.observacoes === 'string' ? body.observacoes.trim() : '';
    const dateStr = typeof body?.dateStr === 'string' ? body.dateStr.trim() : '';
    const horario = typeof body?.horario === 'string' ? body.horario.trim() : '';

    if (!nomeCliente || telefoneCliente.length < 10 || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(horario)) {
      return NextResponse.json({ error: 'Preencha nome, WhatsApp com DDD, data e horário.' }, { status: 400 });
    }

    const emailsConvidados = Array.from(
      new Set(
        [emailCliente, ...emailsExtrasRaw.split(/[;,\s]+/), consultor.email || '']
          .map(s => s.trim().toLowerCase())
          .filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
      )
    );

    // 1. Tenta criar o evento no Google Calendar do consultor (com Invite por e-mail + Google Meet se online)
    let googleEventId: string | null = null;
    let meetLink: string | null = null;
    let inviteGoogleEnviado = false;

    try {
      const rows = await db.$queryRawUnsafe<
        Array<{ user_id: string; access_token: string; refresh_token: string | null; expires_at: string | number }>
      >(
        `SELECT user_id, access_token, refresh_token, expires_at
           FROM google_calendar_tokens
          WHERE user_id = $1
          LIMIT 1`,
        consultor.id
      );

      const row = rows[0];
      let gToken: string | null = null;
      if (row) {
        const exp = Number(row.expires_at || 0);
        if (row.access_token && exp > Date.now() + 2 * 60 * 1000) {
          gToken = row.access_token;
        } else if (row.refresh_token) {
          const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
          const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
          if (clientId && clientSecret) {
            const tRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: row.refresh_token,
                grant_type: 'refresh_token',
              }),
            });
            const tJson = await tRes.json().catch(() => ({}));
            if (tRes.ok && tJson.access_token) {
              gToken = tJson.access_token;
              const novoExp = Date.now() + Number(tJson.expires_in || 3600) * 1000;
              await db.$executeRawUnsafe(
                `UPDATE google_calendar_tokens SET access_token = $2, expires_at = $3, updated_at = NOW() WHERE user_id = $1`,
                row.user_id,
                gToken,
                novoExp
              );
            }
          }
        }
      }

      if (gToken) {
        const [hh, mm] = horario.split(':').map(Number);
        const fimHh = Math.min(23, (hh || 9) + 1);
        const ehOnline = modalidade.toLowerCase().includes('online') || modalidade.toLowerCase().includes('meet');
        const evBody: any = {
          summary: empresaCliente ? `${assunto} — ${empresaCliente}` : `${assunto} — ${nomeCliente}`,
          description: [
            `Cliente: ${nomeCliente}${empresaCliente ? ` (${empresaCliente})` : ''}`,
            `WhatsApp: ${telefoneCliente}`,
            observacoes ? `Pauta: ${observacoes}` : '',
            'Agendado via Privilege Contabilidade e Consultoria',
          ]
            .filter(Boolean)
            .join('\n'),
          start: { dateTime: `${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00-03:00` },
          end: { dateTime: `${dateStr}T${String(fimHh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00-03:00` },
          location: modalidade,
        };
        if (emailsConvidados.length > 0) {
          evBody.attendees = emailsConvidados.map(email => ({ email }));
        }
        if (ehOnline) {
          evBody.conferenceData = {
            createRequest: {
              requestId: `pub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          };
        }

        const gRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${gToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(evBody),
          }
        );
        if (gRes.ok) {
          const gData = await gRes.json();
          googleEventId = gData.id || null;
          meetLink =
            gData.hangoutLink ||
            gData.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ||
            null;
          inviteGoogleEnviado = emailsConvidados.length > 0;
        }
      }
    } catch {
      // ignora falha pontual do Google Calendar; agendamento segue normalmente
    }

    // Garante empresa_default para satisfazer FK de AgendaTask
    await db.empresa.upsert({
      where: { id: 'empresa_default' },
      update: {},
      create: {
        id: 'empresa_default',
        razaoSocial: 'Agendamentos Externos',
        nomeFantasia: 'Agendamentos Externos',
        cnpj: '00000000000000',
        responsavel: 'Privilege',
        email: 'contato@privilegecontabilidade.com.br',
        telefone: '4630351018',
      },
    });

    const id = `pub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const tituloFinal = empresaCliente ? `${assunto} — ${empresaCliente}` : `${assunto} — ${nomeCliente}`;
    const detalhesParticipante = [
      nomeCliente,
      telefoneCliente,
      emailCliente || null,
      observacoes ? `Obs: ${observacoes}` : null,
    ]
      .filter(Boolean)
      .join(' • ');

    await db.agendaTask.create({
      data: {
        id,
        title: tituloFinal,
        empresaId: 'empresa_default',
        consultorId: consultor.id,
        consultoresIds: [consultor.id],
        clienteParticipante: detalhesParticipante,
        dateStr,
        horario,
        completed: false,
        recurrent: false,
        location: meetLink || modalidade,
        googleEventId,
      },
    });

    // Dispara confirmação no WhatsApp do cliente e do consultor (se sessão conectada)
    const dataBr = dateStr.split('-').reverse().join('/');
    const ownerId = await encontrarSessaoAdminPorNumero('46999800010').catch(() => null);
    if (ownerId) {
      const destCliente = telefoneCliente.startsWith('55') ? telefoneCliente : `55${telefoneCliente}`;
      const msgCliente = [
        `✅ *Agendamento Confirmado — Privilege Contabilidade*`,
        ``,
        `Olá, *${nomeCliente}*! Sua reunião foi reservada com sucesso:`,
        ``,
        `• *Assunto:* ${assunto}`,
        `• *Consultor:* ${consultor.name}`,
        `• *Data:* ${dataBr}`,
        `• *Horário:* ${horario}`,
        `• *Formato:* ${modalidade}`,
        ...(meetLink ? [`• *Link Google Meet:* ${meetLink}`] : []),
        ...(inviteGoogleEnviado && emailCliente ? [`• *Invite enviado para:* ${emailCliente}`] : []),
        ``,
        `Caso precise ajustar o horário, basta responder por aqui.`,
        ``,
        `_Privilege Contabilidade e Consultoria_`,
      ].join('\n');

      const resCli = await sendBaileysLiveMessage(destCliente, msgCliente, undefined, ownerId).catch(() => ({ sent: false, error: 'erro' }));
      await registrarDisparoWhatsApp({
        categoria: 'agenda_criacao',
        destino: destCliente,
        destinoNome: `${nomeCliente} (Link Agendamento)`,
        mensagem: msgCliente,
        status: resCli?.sent ? 'enviado' : 'erro',
        erro: resCli?.sent ? null : (resCli?.error || null),
        ownerId,
      });

      const telCons = String(consultor.phone || '').replace(/\D/g, '');
      if (telCons.length >= 10) {
        const destCons = telCons.startsWith('55') ? telCons : `55${telCons}`;
        const msgCons = [
          `📅 *Novo Agendamento pelo seu Link*`,
          ``,
          `• *Cliente:* ${nomeCliente}${empresaCliente ? ` (${empresaCliente})` : ''}`,
          `• *WhatsApp:* ${telefoneCliente}`,
          ...(emailCliente ? [`• *E-mail (Invite):* ${emailCliente}`] : []),
          `• *Assunto:* ${assunto}`,
          `• *Formato:* ${modalidade}`,
          ...(meetLink ? [`• *Meet:* ${meetLink}`] : []),
          `• *Data:* ${dataBr} às ${horario}`,
          ...(observacoes ? [`• *Obs:* ${observacoes}`] : []),
        ].join('\n');
        await sendBaileysLiveMessage(destCons, msgCons, undefined, ownerId).catch(() => {});
      }
    }

    return NextResponse.json({
      ok: true,
      id,
      consultor: consultor.name,
      dataBr,
      dateStr,
      horario,
      assunto,
      modalidade,
      meetLink,
      inviteGoogleEnviado,
    });
  } catch (error) {
    console.error('Erro em POST /api/agendar/[slug]:', error);
    return NextResponse.json({ error: 'Erro ao confirmar agendamento.' }, { status: 500 });
  }
}
