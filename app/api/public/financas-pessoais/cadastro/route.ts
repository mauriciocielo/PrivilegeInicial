import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { checkRateLimit, getClientKey } from '../../../../../lib/rate-limit';
import { createSessionToken, extractWhatsAppScopeFromRoutes, sessionCookieHeader } from '../../../../../lib/session';
import { captureError } from '../../../../../lib/sentry-helper';
import {
  consumirCupomPf,
  criarOuAtivarAssinantePf,
  validarCupomPf,
} from '../../../../../lib/financas-pessoais-assinaturas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/public/financas-pessoais/cadastro
 * Autocadastro público da página de vendas `/financas-pessoais`.
 * Cria conta PF com 7 dias grátis (trial), envia boas-vindas no WhatsApp e já autentica a sessão.
 */
export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(`pf-signup:${getClientKey(request)}`, 6, 15 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas em sequência. Aguarde alguns minutos e tente novamente.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const nome = String(body?.nome || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const phone = String(body?.phone || '').trim();
    const senha = String(body?.senha || '').trim();
    const cupomRaw = String(body?.cupom || '').trim();
    const cpf = String(body?.cpf || '').trim();
    const cep = String(body?.cep || '').trim();
    const endereco = String(body?.endereco || '').trim();
    const cidade = String(body?.cidade || '').trim();
    const uf = String(body?.uf || '').trim();
    const empregoEmpresa = String(body?.empregoEmpresa || '').trim();
    const empregoCargo = String(body?.empregoCargo || '').trim();
    const empregoTipo = String(body?.empregoTipo || 'clt').trim();

    if (!nome || nome.length < 2) {
      return NextResponse.json({ error: 'Informe seu nome completo.' }, { status: 400 });
    }
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
    }
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ error: 'Informe seu WhatsApp com DDD (ex.: 46 99999-9999).' }, { status: 400 });
    }
    if (!senha || senha.length < 6) {
      return NextResponse.json({ error: 'Crie uma senha com pelo menos 6 caracteres.' }, { status: 400 });
    }

    const jaExiste = await db.user.findFirst({ where: { email } });
    if (jaExiste) {
      return NextResponse.json(
        { error: 'Este e-mail já possui cadastro. Faça login na tela de acesso.' },
        { status: 409 }
      );
    }

    let cupomAplicado = '';
    let valorRenovacao = 29.9;
    let diasTrial = 7;

    if (cupomRaw) {
      const check = await validarCupomPf(cupomRaw, 29.9);
      if (!check.valido) {
        return NextResponse.json({ error: check.erro || 'Cupom de desconto inválido.' }, { status: 400 });
      }
      cupomAplicado = check.codigo || '';
      valorRenovacao = check.valorFinal;
      diasTrial = 7 + check.diasTrialExtra;
    }

    const origin = new URL(request.url).origin;
    const res = await criarOuAtivarAssinantePf({
      nome,
      email,
      phone,
      senha,
      plano: 'trial_7d',
      diasValidade: diasTrial,
      cupomCodigo: cupomAplicado,
      valorRenovacao,
      cpf,
      cep,
      endereco,
      cidade,
      uf,
      empregoEmpresa,
      empregoCargo,
      empregoTipo,
      origem: cupomAplicado ? `pagina_vendas:${cupomAplicado}` : 'pagina_vendas',
      enviarWhatsapp: true,
      appUrl: origin,
    });

    if (cupomAplicado) {
      await consumirCupomPf(cupomAplicado).catch(() => {});
    }

    const token = createSessionToken({
      userId: res.user.id,
      email: res.user.email,
      role: res.user.role,
      empresaIds: res.user.empresaIds,
      whatsappScope: extractWhatsAppScopeFromRoutes(res.user.allowedRoutes, res.user.role),
    });

    const response = NextResponse.json({
      ok: true,
      redirectTo: '/cliente/financas-pessoais',
      validoAte: res.validoAte,
      whatsappEnviado: res.whatsappEnviado,
    });
    response.headers.set('Set-Cookie', sessionCookieHeader(token));
    return response;
  } catch (error) {
    console.error('Erro em POST /api/public/financas-pessoais/cadastro:', error);
    captureError(error);
    return NextResponse.json({ error: 'Não foi possível concluir seu cadastro agora.' }, { status: 500 });
  }
}
