import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { hashPassword } from '../../../../lib/auth-hash';
import { captureError } from '../../../../lib/sentry-helper';
import {
  ensureFinancasAssinaturasTable,
  enviarBoasVindasPfWhatsApp,
  normalizarTelefoneBr,
} from '../../../../lib/financas-pessoais-assinaturas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financas-pessoais/perfil
 * Retorna os dados pessoais (CPF, endereço), emprego/renda e vínculo de cônjuge do usuário logado.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureFinancasAssinaturasTable();
    const user = await db.user.findUnique({ where: { id: auth.session.userId } });
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM financas_pessoais_assinaturas WHERE user_id = $1 LIMIT 1`,
      user.id
    );
    const reg = rows[0];

    // Verifica se este usuário é cônjuge vinculado a um titular
    const titularRows = await db.$queryRawUnsafe<any[]>(
      `SELECT id, nome, email, phone, valido_ate, status, compartilhar_financas
       FROM financas_pessoais_assinaturas
       WHERE conjuge_user_id = $1
       LIMIT 1`,
      user.id
    );
    const titular = titularRows[0] || null;

    return NextResponse.json({
      perfil: {
        nome: reg?.nome || user.name,
        email: reg?.email || user.email,
        phone: reg?.phone || user.phone || '',
        cpf: String(reg?.cpf || ''),
        cep: String(reg?.cep || ''),
        endereco: String(reg?.endereco || ''),
        cidade: String(reg?.cidade || ''),
        uf: String(reg?.uf || ''),
        empregoEmpresa: String(reg?.emprego_empresa || ''),
        empregoCargo: String(reg?.emprego_cargo || ''),
        empregoTipo: String(reg?.emprego_tipo || 'clt'),
        rendaMensal: Number(reg?.renda_mensal || 0),
        diaPagamento: Number(reg?.dia_pagamento || 5),
        compartilharFinancas: reg ? Boolean(reg.compartilhar_financas) : true,
      },
      ehConjuge: Boolean(titular),
      titular: titular
        ? {
            nome: String(titular.nome || ''),
            email: String(titular.email || ''),
            compartilharFinancas: Boolean(titular.compartilhar_financas),
          }
        : null,
      conjuge: reg?.conjuge_user_id
        ? {
            userId: String(reg.conjuge_user_id),
            nome: String(reg.conjuge_nome || ''),
            email: String(reg.conjuge_email || ''),
            phone: String(reg.conjuge_phone || ''),
          }
        : null,
    });
  } catch (error) {
    console.error('Erro em GET /api/financas-pessoais/perfil:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar perfil financeiro.' }, { status: 500 });
  }
}

/**
 * PUT /api/financas-pessoais/perfil
 * Salva CPF, endereço (CEP/Rua/Cidade/UF), emprego/ocupação, renda mensal e preferência de compartilhamento.
 */
export async function PUT(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureFinancasAssinaturasTable();
    const user = await db.user.findUnique({ where: { id: auth.session.userId } });
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const cpf = String(body?.cpf || '').trim().slice(0, 20);
    const cep = String(body?.cep || '').trim().slice(0, 12);
    const endereco = String(body?.endereco || '').trim().slice(0, 200);
    const cidade = String(body?.cidade || '').trim().slice(0, 80);
    const uf = String(body?.uf || '').trim().toUpperCase().slice(0, 2);
    const empregoEmpresa = String(body?.empregoEmpresa || '').trim().slice(0, 120);
    const empregoCargo = String(body?.empregoCargo || '').trim().slice(0, 100);
    const empregoTipo = String(body?.empregoTipo || 'clt').trim().slice(0, 30);
    const rendaMensal = Math.max(0, Number(body?.rendaMensal || 0));
    const diaPagamento = Math.min(31, Math.max(1, Number(body?.diaPagamento || 5)));
    const compartilharFinancas = body?.compartilharFinancas !== false;

    const existentes = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM financas_pessoais_assinaturas WHERE user_id = $1 LIMIT 1`,
      user.id
    );

    if (existentes[0]) {
      await db.$executeRawUnsafe(
        `UPDATE financas_pessoais_assinaturas
         SET cpf = $1, cep = $2, endereco = $3, cidade = $4, uf = $5,
             emprego_empresa = $6, emprego_cargo = $7, emprego_tipo = $8,
             renda_mensal = $9, dia_pagamento = $10, compartilhar_financas = $11,
             updated_at = NOW()
         WHERE id = $12`,
        cpf,
        cep,
        endereco,
        cidade,
        uf,
        empregoEmpresa,
        empregoCargo,
        empregoTipo,
        rendaMensal,
        diaPagamento,
        compartilharFinancas,
        existentes[0].id
      );
    } else {
      const validoAte = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await db.$executeRawUnsafe(
        `INSERT INTO financas_pessoais_assinaturas
          (id, user_id, nome, email, phone, plano, valor_mensal, status, valido_ate, origem,
           cpf, cep, endereco, cidade, uf, emprego_empresa, emprego_cargo, emprego_tipo, renda_mensal, dia_pagamento, compartilhar_financas, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'cortesia', 0, 'ativo', $6, 'perfil_interno',
                 $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())`,
        crypto.randomUUID(),
        user.id,
        user.name,
        user.email,
        user.phone || '',
        validoAte,
        cpf,
        cep,
        endereco,
        cidade,
        uf,
        empregoEmpresa,
        empregoCargo,
        empregoTipo,
        rendaMensal,
        diaPagamento,
        compartilharFinancas
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em PUT /api/financas-pessoais/perfil:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao salvar dados do perfil.' }, { status: 500 });
  }
}

/**
 * POST /api/financas-pessoais/perfil
 * Compartilha a assinatura PF com o cônjuge (cria acesso próprio + envia boas-vindas no WhatsApp).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureFinancasAssinaturasTable();
    const titularUser = await db.user.findUnique({ where: { id: auth.session.userId } });
    if (!titularUser) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const conjugeNome = String(body?.conjugeNome || '').trim();
    const conjugeEmail = String(body?.conjugeEmail || '').trim().toLowerCase();
    const conjugePhone = normalizarTelefoneBr(String(body?.conjugePhone || ''));
    const compartilharFinancas = body?.compartilharFinancas !== false;

    if (!conjugeNome || !conjugeEmail || !conjugeEmail.includes('@')) {
      return NextResponse.json({ error: 'Informe nome e e-mail válido do cônjuge.' }, { status: 400 });
    }
    if (conjugeEmail === titularUser.email.toLowerCase()) {
      return NextResponse.json({ error: 'Use um e-mail diferente do seu para o acesso do cônjuge.' }, { status: 400 });
    }

    // Garante registro do titular
    let titularRows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM financas_pessoais_assinaturas WHERE user_id = $1 LIMIT 1`,
      titularUser.id
    );
    let titularReg = titularRows[0];
    if (!titularReg) {
      const idNovo = crypto.randomUUID();
      const validoAte = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await db.$executeRawUnsafe(
        `INSERT INTO financas_pessoais_assinaturas
          (id, user_id, nome, email, phone, plano, valor_mensal, status, valido_ate, origem, compartilhar_financas, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'cortesia', 0, 'ativo', $6, 'perfil_interno', $7, NOW(), NOW())`,
        idNovo,
        titularUser.id,
        titularUser.name,
        titularUser.email,
        titularUser.phone || '',
        validoAte,
        compartilharFinancas
      );
      titularRows = await db.$queryRawUnsafe<any[]>(
        `SELECT * FROM financas_pessoais_assinaturas WHERE id = $1 LIMIT 1`,
        idNovo
      );
      titularReg = titularRows[0];
    }

    // Cria ou atualiza User do cônjuge
    let conjugeUser = await db.user.findFirst({ where: { email: conjugeEmail } });
    let senhaGerada: string | null = null;
    if (!conjugeUser) {
      senhaGerada = String(Math.floor(100000 + Math.random() * 900000));
      conjugeUser = await db.user.create({
        data: {
          name: conjugeNome,
          email: conjugeEmail,
          password: hashPassword(senhaGerada),
          role: 'cliente',
          empresaIds: [],
          allowedRoutes: ['/cliente/financas-pessoais'],
          phone: conjugePhone || null,
        },
      });
    } else {
      const rotas = Array.isArray(conjugeUser.allowedRoutes) ? [...conjugeUser.allowedRoutes] : [];
      if (!rotas.includes('/cliente/financas-pessoais')) rotas.push('/cliente/financas-pessoais');
      conjugeUser = await db.user.update({
        where: { id: conjugeUser.id },
        data: {
          allowedRoutes: rotas,
          ...(conjugePhone ? { phone: conjugePhone } : {}),
        },
      });
    }

    // Vincula no registro do titular
    await db.$executeRawUnsafe(
      `UPDATE financas_pessoais_assinaturas
       SET conjuge_user_id = $1, conjuge_nome = $2, conjuge_email = $3, conjuge_phone = $4, compartilhar_financas = $5, updated_at = NOW()
       WHERE id = $6`,
      conjugeUser.id,
      conjugeNome,
      conjugeEmail,
      conjugePhone,
      compartilharFinancas,
      String(titularReg.id)
    );

    // Garante assinatura espelhada (inclusa, R$ 0) para o cônjuge
    const existConj = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM financas_pessoais_assinaturas WHERE user_id = $1 LIMIT 1`,
      conjugeUser.id
    );
    if (existConj[0]) {
      await db.$executeRawUnsafe(
        `UPDATE financas_pessoais_assinaturas
         SET titular_assinatura_id = $1, status = $2, valido_ate = $3, compartilhar_financas = $4, updated_at = NOW()
         WHERE id = $5`,
        String(titularReg.id),
        String(titularReg.status || 'ativo'),
        String(titularReg.valido_ate || ''),
        compartilharFinancas,
        existConj[0].id
      );
    } else {
      await db.$executeRawUnsafe(
        `INSERT INTO financas_pessoais_assinaturas
          (id, user_id, nome, email, phone, plano, valor_mensal, status, valido_ate, origem, titular_assinatura_id, compartilhar_financas, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'conjuge_incluso', 0, $6, $7, 'compartilhado_conjuge', $8, $9, NOW(), NOW())`,
        crypto.randomUUID(),
        conjugeUser.id,
        conjugeNome,
        conjugeEmail,
        conjugePhone,
        String(titularReg.status || 'ativo'),
        String(titularReg.valido_ate || ''),
        String(titularReg.id),
        compartilharFinancas
      );
    }

    let whatsappEnviado = false;
    if (conjugePhone) {
      whatsappEnviado = await enviarBoasVindasPfWhatsApp({
        nome: conjugeNome,
        email: conjugeEmail,
        senhaPlana: senhaGerada,
        phone: conjugePhone,
        planoNome: `Acesso Compartilhado com ${titularUser.name}`,
        validoAte: String(titularReg.valido_ate || ''),
        appUrl: new URL(request.url).origin,
      });
    }

    return NextResponse.json({
      ok: true,
      senhaGerada,
      whatsappEnviado,
    });
  } catch (error) {
    console.error('Erro em POST /api/financas-pessoais/perfil:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao compartilhar assinatura com cônjuge.' }, { status: 500 });
  }
}

/**
 * DELETE /api/financas-pessoais/perfil
 * Desvincula o cônjuge da assinatura do titular.
 */
export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureFinancasAssinaturasTable();
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT id, conjuge_user_id FROM financas_pessoais_assinaturas WHERE user_id = $1 LIMIT 1`,
      auth.session.userId
    );
    const reg = rows[0];
    if (!reg) return NextResponse.json({ ok: true });

    await db.$executeRawUnsafe(
      `UPDATE financas_pessoais_assinaturas
       SET conjuge_user_id = NULL, conjuge_nome = '', conjuge_email = '', conjuge_phone = '', updated_at = NOW()
       WHERE id = $1`,
      String(reg.id)
    );
    if (reg.conjuge_user_id) {
      await db.$executeRawUnsafe(
        `UPDATE financas_pessoais_assinaturas SET status = 'suspenso', titular_assinatura_id = NULL, updated_at = NOW() WHERE user_id = $1 AND plano = 'conjuge_incluso'`,
        String(reg.conjuge_user_id)
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em DELETE /api/financas-pessoais/perfil:', error);
    return NextResponse.json({ error: 'Erro ao desvincular cônjuge.' }, { status: 500 });
  }
}
