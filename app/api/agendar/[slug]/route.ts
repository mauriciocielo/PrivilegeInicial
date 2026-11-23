import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../lib/baileys-manager';
import { registrarDisparoWhatsApp } from '../../../../lib/whatsapp-disparos-log';

export const dynamic = 'force-dynamic';

const SLOTS_PADRAO = ['08:30', '09:30', '10:30', '11:30', '13:30', '14:30', '15:30', '16:30', '17:30'];

function slugify(nome: string): string {
  return (nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function localizarConsultorPorSlug(slug: string) {
  const alvo = decodeURIComponent(slug || '').trim().toLowerCase();
  const usuarios = await db.user.findMany({
    where: { role: { not: 'cliente' } },
    select: { id: true, name: true, email: true, phone: true, role: true },
  });
  return (
    usuarios.find(u => u.id.toLowerCase() === alvo) ||
    usuarios.find(u => slugify(u.name) === alvo) ||
    usuarios.find(u => slugify(u.name.split(' ')[0]) === alvo) ||
    (alvo === 'privilege' ? usuarios.find(u => u.role === 'administrador') || usuarios[0] : null)
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const consultor = await localizarConsultorPorSlug(slug);
    if (!consultor) {
      return NextResponse.json({ error: 'Consultor não encontrado.' }, { status: 404 });
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
        nome: consultor.name,
        cargo: consultor.role === 'administrador' ? 'Diretoria & Consultoria' : 'Consultor Privilege',
      },
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
    const emailCliente = typeof body?.email === 'string' ? body.email.trim() : '';
    const telefoneCliente = typeof body?.telefone === 'string' ? body.telefone.replace(/\D/g, '') : '';
    const assunto = typeof body?.assunto === 'string' && body.assunto.trim() ? body.assunto.trim() : 'Reunião de Consultoria';
    const modalidade = typeof body?.modalidade === 'string' && body.modalidade.trim() ? body.modalidade.trim() : 'Online (Google Meet)';
    const observacoes = typeof body?.observacoes === 'string' ? body.observacoes.trim() : '';
    const dateStr = typeof body?.dateStr === 'string' ? body.dateStr.trim() : '';
    const horario = typeof body?.horario === 'string' ? body.horario.trim() : '';

    if (!nomeCliente || telefoneCliente.length < 10 || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(horario)) {
      return NextResponse.json({ error: 'Preencha nome, WhatsApp com DDD, data e horário.' }, { status: 400 });
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
        location: modalidade,
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
          ...(emailCliente ? [`• *E-mail:* ${emailCliente}`] : []),
          `• *Assunto:* ${assunto}`,
          `• *Formato:* ${modalidade}`,
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
    });
  } catch (error) {
    console.error('Erro em POST /api/agendar/[slug]:', error);
    return NextResponse.json({ error: 'Erro ao confirmar agendamento.' }, { status: 500 });
  }
}
