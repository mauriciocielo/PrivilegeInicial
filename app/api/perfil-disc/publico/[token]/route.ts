import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import db from '../../../../../lib/prisma';
import { captureError } from '../../../../../lib/sentry-helper';
import { checkRateLimit, getClientKey } from '../../../../../lib/rate-limit';
import { questionarioPublico, validarRespostas } from '../../../../../lib/perfil-disc/questionario';
import { calcularResultado } from '../../../../../lib/perfil-disc/pontuacao';
import { HORAS_VALIDADE_LINK, linkExpirado } from '../../../../../lib/perfil-disc/prazo';

// Rota pública de propósito: o token de 256 bits é a credencial de quem responde,
// que não tem usuário nem senha. O limite por IP só contém abuso, porque um
// escritório inteiro pode responder atrás do mesmo endereço.
const LIMITE_POR_MINUTO = 120;

const SEM_CACHE = { 'Cache-Control': 'no-store' };

const responder = (corpo: unknown, status = 200) => NextResponse.json(corpo, { status, headers: SEM_CACHE });
const linkInvalido = () => responder({ status: 'invalido', error: 'Este link não é válido.' }, 404);
const jaRespondido = () => responder({ status: 'concluida', error: 'Este link já foi respondido e não pode ser usado de novo.' }, 409);
const expirou = () => responder({ status: 'expirado', error: `Este link venceu: ele vale por ${HORAS_VALIDADE_LINK} horas.` }, 410);

function limitado(request: Request): NextResponse | null {
  const { allowed, retryAfterSeconds } = checkRateLimit(`perfil-disc:${getClientKey(request)}`, LIMITE_POR_MINUTO, 60_000);
  if (allowed) return null;
  return responder({ error: `Muitas tentativas. Aguarde ${retryAfterSeconds} segundos.` }, 429);
}

const texto = (valor: unknown, limite: number): string | null => {
  const limpo = typeof valor === 'string' ? valor.trim().slice(0, limite) : '';
  return limpo || null;
};

/**
 * Só consulta, nunca consome o link: o WhatsApp e os antivírus de e-mail abrem os
 * links para gerar prévia, e o link queimaria antes de a pessoa ver. Quem encerra
 * o link é o envio das respostas.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const bloqueio = limitado(request);
    if (bloqueio) return bloqueio;

    const { token } = await params;
    const avaliacao = await db.perfilDiscAvaliacao.findUnique({
      where: { token },
      select: {
        status: true, nomeRespondente: true, cargoRespondente: true, iniciadoEm: true, createdAt: true,
        empresa: { select: { razaoSocial: true, nomeFantasia: true } },
      },
    });
    if (!avaliacao) return linkInvalido();
    // Link encerrado não mostra mais nome nem empresa de ninguém.
    if (avaliacao.status !== 'pendente') return responder({ status: 'concluida' });
    if (linkExpirado(avaliacao)) return responder({ status: 'expirado' });

    return responder({
      status: 'pendente',
      empresa: avaliacao.empresa.nomeFantasia || avaliacao.empresa.razaoSocial,
      nome: avaliacao.nomeRespondente,
      cargo: avaliacao.cargoRespondente,
      iniciado: !!avaliacao.iniciadoEm,
      questionario: questionarioPublico(),
    });
  } catch (error) {
    console.error('Erro em GET perfil-disc/publico:', error);
    captureError(error);
    return responder({ error: 'Não foi possível abrir o formulário. Tente novamente.' }, 500);
  }
}

/** { acao: 'iniciar', consentimento, nome?, cargo? } ou { acao: 'concluir', respostas }. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const bloqueio = limitado(request);
    if (bloqueio) return bloqueio;

    const { token } = await params;

    const avaliacao = await db.perfilDiscAvaliacao.findUnique({
      where: { token },
      select: { id: true, status: true, nomeRespondente: true, iniciadoEm: true, consentimentoEm: true, createdAt: true },
    });
    if (!avaliacao) return linkInvalido();
    if (avaliacao.status !== 'pendente') return jaRespondido();
    if (linkExpirado(avaliacao)) return expirou();

    // O corpo só é lido depois de confirmar o token: sem link válido, nada é processado.
    const body = await request.json().catch(() => null);

    if (body?.acao === 'iniciar') {
      if (body.consentimento !== true) return responder({ error: 'É preciso concordar com o uso das respostas para continuar.' }, 422);

      const nome = avaliacao.nomeRespondente ?? texto(body.nome, 120);
      if (!nome) return responder({ error: 'Informe seu nome para continuar.' }, 422);

      const cargo = texto(body.cargo, 120);
      const agora = new Date();
      const { count } = await db.perfilDiscAvaliacao.updateMany({
        where: { id: avaliacao.id, status: 'pendente' },
        data: {
          nomeRespondente: nome,
          ...(cargo ? { cargoRespondente: cargo } : {}),
          // Recarregar a página não reinicia o cronômetro nem o aceite.
          iniciadoEm: avaliacao.iniciadoEm ?? agora,
          consentimentoEm: avaliacao.consentimentoEm ?? agora,
        },
      });
      if (count === 0) return jaRespondido();
      return responder({ status: 'iniciada' });
    }

    if (body?.acao === 'concluir') {
      if (!avaliacao.iniciadoEm || !avaliacao.consentimentoEm) {
        return responder({ error: 'Confirme seus dados antes de enviar as respostas.' }, 422);
      }
      const validacao = validarRespostas(body.respostas);
      if (!validacao.ok) return responder({ error: validacao.erro }, 422);

      const agora = new Date();
      const respostas = validacao.respostas as unknown as Prisma.InputJsonValue;
      const resultado = calcularResultado(validacao.respostas) as unknown as Prisma.InputJsonValue;

      // A condição status = pendente fica na própria gravação: de dois envios
      // simultâneos, só um altera a linha. O outro recebe 409 e nada muda.
      const { count } = await db.perfilDiscAvaliacao.updateMany({
        where: { id: avaliacao.id, status: 'pendente' },
        data: {
          status: 'concluida',
          concluidoEm: agora,
          tempoRespostaSeg: Math.max(0, Math.round((agora.getTime() - avaliacao.iniciadoEm.getTime()) / 1000)),
          respostas,
          resultado,
        },
      });
      if (count === 0) return jaRespondido();
      return responder({ status: 'concluida' });
    }

    return responder({ error: 'Ação inválida.' }, 400);
  } catch (error) {
    console.error('Erro em POST perfil-disc/publico:', error);
    captureError(error);
    return responder({ error: 'Não foi possível salvar. Suas respostas continuam neste aparelho: tente novamente.' }, 500);
  }
}
