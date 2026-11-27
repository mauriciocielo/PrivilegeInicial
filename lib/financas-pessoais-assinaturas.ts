// ============================================================
// ASSINATURAS E CADASTRO DE CLIENTES PF (FINANÇAS PESSOAIS)
// ============================================================

import crypto from 'crypto';
import db from './prisma';
import { hashPassword } from './auth-hash';
import { apenasDigitos } from './nfse/dps';
import { encontrarSessaoAdminPorNumero } from './nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from './baileys-manager';

let tabelaAssinaturasGarantida = false;

export const PLANOS_PF: Record<
  string,
  { id: string; nome: string; valorMensal: number; dias: number; statusInicial: 'trial' | 'ativo' }
> = {
  trial_7d: { id: 'trial_7d', nome: 'Teste Grátis (7 dias)', valorMensal: 0, dias: 7, statusInicial: 'trial' },
  mensal: { id: 'mensal', nome: 'Mensal PF', valorMensal: 29.9, dias: 30, statusInicial: 'ativo' },
  anual: { id: 'anual', nome: 'Anual PF', valorMensal: 24.75, dias: 365, statusInicial: 'ativo' },
  cortesia: { id: 'cortesia', nome: 'Cortesia / VIP', valorMensal: 0, dias: 365, statusInicial: 'ativo' },
};

export async function ensureFinancasAssinaturasTable() {
  if (tabelaAssinaturasGarantida) return;

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS financas_pessoais_assinaturas (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      plano TEXT NOT NULL DEFAULT 'trial_7d',
      valor_mensal DOUBLE PRECISION NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'trial',
      valido_ate TEXT NOT NULL,
      origem TEXT NOT NULL DEFAULT 'painel',
      gateway TEXT NOT NULL DEFAULT '',
      external_id TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_fp_assin_user ON financas_pessoais_assinaturas(user_id)`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_fp_assin_email ON financas_pessoais_assinaturas(email)`
  );

  // Colunas de cupom/valor de renovação (idempotente)
  await db.$executeRawUnsafe(
    `ALTER TABLE financas_pessoais_assinaturas ADD COLUMN IF NOT EXISTS cupom_codigo TEXT NOT NULL DEFAULT ''`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE financas_pessoais_assinaturas ADD COLUMN IF NOT EXISTS valor_renovacao DOUBLE PRECISION NOT NULL DEFAULT 29.9`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE financas_pessoais_assinaturas ADD COLUMN IF NOT EXISTS boas_vindas_enviadas_em TIMESTAMP`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE financas_pessoais_assinaturas ADD COLUMN IF NOT EXISTS ultimo_lembrete_data TEXT NOT NULL DEFAULT ''`
  );

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS financas_pessoais_cupons (
      id TEXT PRIMARY KEY,
      codigo TEXT UNIQUE NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'percentual',
      valor DOUBLE PRECISION NOT NULL DEFAULT 0,
      dias_trial_extra INTEGER NOT NULL DEFAULT 0,
      limite_usos INTEGER,
      usos_atuais INTEGER NOT NULL DEFAULT 0,
      valido_ate TEXT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  tabelaAssinaturasGarantida = true;
}

export async function validarCupomPf(codigoRaw: string, valorBase = 29.9): Promise<{
  valido: boolean;
  erro?: string;
  codigo?: string;
  tipo?: 'percentual' | 'fixo';
  valorDescontoConfig?: number;
  valorOriginal: number;
  desconto: number;
  valorFinal: number;
  diasTrialExtra: number;
}> {
  await ensureFinancasAssinaturasTable();
  const codigo = String(codigoRaw || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!codigo) {
    return { valido: false, erro: 'Informe um código de cupom.', valorOriginal: valorBase, desconto: 0, valorFinal: valorBase, diasTrialExtra: 0 };
  }

  const rows = await db.$queryRawUnsafe<any[]>(
    `SELECT * FROM financas_pessoais_cupons WHERE codigo = $1 LIMIT 1`,
    codigo
  );
  const c = rows[0];
  if (!c || !c.ativo) {
    return { valido: false, erro: 'Cupom inválido ou inativo.', valorOriginal: valorBase, desconto: 0, valorFinal: valorBase, diasTrialExtra: 0 };
  }

  const hoje = new Date().toISOString().slice(0, 10);
  if (c.valido_ate && String(c.valido_ate) < hoje) {
    return { valido: false, erro: 'Este cupom já expirou.', valorOriginal: valorBase, desconto: 0, valorFinal: valorBase, diasTrialExtra: 0 };
  }
  if (c.limite_usos !== null && c.limite_usos !== undefined && Number(c.usos_atuais || 0) >= Number(c.limite_usos)) {
    return { valido: false, erro: 'Este cupom atingiu o limite de usos.', valorOriginal: valorBase, desconto: 0, valorFinal: valorBase, diasTrialExtra: 0 };
  }

  const tipo: 'percentual' | 'fixo' = c.tipo === 'fixo' ? 'fixo' : 'percentual';
  const valCfg = Math.max(0, Number(c.valor || 0));
  const descontoBruto = tipo === 'percentual' ? valorBase * (Math.min(100, valCfg) / 100) : valCfg;
  const desconto = Math.round(Math.min(valorBase, descontoBruto) * 100) / 100;
  const valorFinal = Math.max(0, Math.round((valorBase - desconto) * 100) / 100);
  const diasTrialExtra = Math.max(0, Number(c.dias_trial_extra || 0));

  return {
    valido: true,
    codigo,
    tipo,
    valorDescontoConfig: valCfg,
    valorOriginal: valorBase,
    desconto,
    valorFinal,
    diasTrialExtra,
  };
}

export async function consumirCupomPf(codigo: string) {
  if (!codigo) return;
  await ensureFinancasAssinaturasTable();
  await db.$executeRawUnsafe(
    `UPDATE financas_pessoais_cupons SET usos_atuais = usos_atuais + 1 WHERE codigo = $1`,
    codigo.trim().toUpperCase()
  );
}

export function normalizarTelefoneBr(tel: string): string {
  const dig = apenasDigitos(tel || '');
  if (!dig) return '';
  if (dig.startsWith('55') && dig.length >= 12) return dig;
  if (dig.length === 10 || dig.length === 11) return `55${dig}`;
  return dig;
}

export function calcularDataValidade(dias: number, base?: Date): string {
  const d = base ? new Date(base.getTime()) : new Date();
  d.setDate(d.getDate() + Math.max(1, dias));
  return d.toISOString().slice(0, 10);
}

export async function enviarBoasVindasPfWhatsApp(params: {
  nome: string;
  email: string;
  senhaPlana?: string | null;
  phone: string;
  planoNome: string;
  validoAte: string;
  appUrl?: string;
}): Promise<boolean> {
  const phoneNorm = normalizarTelefoneBr(params.phone);
  if (!phoneNorm || phoneNorm.length < 10) return false;

  try {
    const ownerId = await encontrarSessaoAdminPorNumero();
    if (!ownerId) return false;

    const baseUrl = (
      params.appUrl ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://privilegecontabilidade.cnt.br'
    ).replace(/\/$/, '');

    const primeiroNome = params.nome.trim().split(/\s+/)[0] || 'Cliente';
    const blocoSenha = params.senhaPlana
      ? `🔑 *Senha:* ${params.senhaPlana}\n`
      : `🔑 Use a senha que você cadastrou no acesso.\n`;

    const texto = [
      `🎉 *Bem-vindo(a) ao Minhas Finanças PF, ${primeiroNome}!*`,
      ``,
      `Seu acesso ao controle financeiro pessoal integrado ao WhatsApp já está liberado (${params.planoNome} · válido até ${params.validoAte}).`,
      ``,
      `🌐 *Painel Web / Celular:* ${baseUrl}/login`,
      `📧 *E-mail:* ${params.email}`,
      blocoSenha.trimEnd(),
      ``,
      `💬 *Comece agora mesmo por aqui no WhatsApp!*`,
      `Você pode mandar texto, áudio ou foto/PDF de recibo:`,
      `• _"Gastei 85 no mercado no pix"_`,
      `• _"Recebi 3500 de salário"_`,
      `• _"Paguei 250 de consulta médica"_ (já vai pra Pasta IRPF!)`,
      `• _"Resumo do mês"_`,
    ].join('\n');

    const resWa = await sendBaileysLiveMessage(phoneNorm, texto, undefined, ownerId);
    return Boolean(resWa?.sent);
  } catch (err) {
    console.warn('Falha ao enviar boas-vindas PF no WhatsApp:', err);
    return false;
  }
}

export async function criarOuAtivarAssinantePf(params: {
  nome: string;
  email: string;
  phone: string;
  senha?: string;
  plano?: string;
  valorMensal?: number;
  diasValidade?: number;
  status?: 'trial' | 'ativo' | 'suspenso' | 'cancelado';
  origem?: string;
  gateway?: string;
  externalId?: string;
  cupomCodigo?: string;
  valorRenovacao?: number;
  enviarWhatsapp?: boolean;
  appUrl?: string;
}) {
  await ensureFinancasAssinaturasTable();

  const nome = String(params.nome || '').trim();
  const email = String(params.email || '').trim().toLowerCase();
  const phone = normalizarTelefoneBr(params.phone || '');
  const planoKey = params.plano && PLANOS_PF[params.plano] ? params.plano : 'trial_7d';
  const spec = PLANOS_PF[planoKey];
  const valorMensal =
    typeof params.valorMensal === 'number' && Number.isFinite(params.valorMensal)
      ? params.valorMensal
      : spec.valorMensal;
  const dias = params.diasValidade || spec.dias;
  const status = params.status || spec.statusInicial;
  const validoAte = calcularDataValidade(dias);

  // 1. Cria ou atualiza User
  let user = await db.user.findFirst({ where: { email } });
  let senhaGerada: string | null = null;
  let usuarioNovo = false;

  if (!user) {
    usuarioNovo = true;
    const senhaFinal = (params.senha || '').trim() || String(Math.floor(100000 + Math.random() * 900000));
    senhaGerada = senhaFinal;
    user = await db.user.create({
      data: {
        name: nome,
        email,
        password: hashPassword(senhaFinal),
        role: 'cliente',
        empresaIds: [],
        allowedRoutes: ['/cliente/financas-pessoais'],
        phone: phone || null,
      },
    });
  } else {
    const rotas = Array.isArray(user.allowedRoutes) ? [...user.allowedRoutes] : [];
    if (!rotas.includes('/cliente/financas-pessoais')) {
      rotas.push('/cliente/financas-pessoais');
    }
    const updateData: any = {
      allowedRoutes: rotas,
      ...(phone ? { phone } : {}),
    };
    if (params.senha && params.senha.trim().length >= 6) {
      updateData.password = hashPassword(params.senha.trim());
      senhaGerada = params.senha.trim();
    }
    user = await db.user.update({
      where: { id: user.id },
      data: updateData,
    });
  }

  // 2. Cria ou atualiza assinatura PF
  const existentes = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM financas_pessoais_assinaturas WHERE user_id = $1 OR email = $2 LIMIT 1`,
    user.id,
    email
  );

  let assinaturaId = existentes[0]?.id;
  const cupomCodigo = String(params.cupomCodigo || '').trim().toUpperCase();
  const valorRenovacao =
    typeof params.valorRenovacao === 'number' && Number.isFinite(params.valorRenovacao)
      ? Math.max(0, params.valorRenovacao)
      : PLANOS_PF.mensal.valorMensal;

  if (assinaturaId) {
    await db.$executeRawUnsafe(
      `UPDATE financas_pessoais_assinaturas
       SET nome = $1, phone = $2, plano = $3, valor_mensal = $4, status = $5, valido_ate = $6,
           gateway = COALESCE(NULLIF($7, ''), gateway),
           external_id = COALESCE(NULLIF($8, ''), external_id),
           cupom_codigo = COALESCE(NULLIF($9, ''), cupom_codigo),
           valor_renovacao = CASE WHEN $10 >= 0 THEN $10 ELSE valor_renovacao END,
           updated_at = NOW()
       WHERE id = $11`,
      nome || user.name,
      phone || user.phone || '',
      planoKey,
      valorMensal,
      status,
      validoAte,
      params.gateway || '',
      params.externalId || '',
      cupomCodigo,
      typeof params.valorRenovacao === 'number' ? valorRenovacao : -1,
      assinaturaId
    );
  } else {
    assinaturaId = crypto.randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO financas_pessoais_assinaturas
        (id, user_id, nome, email, phone, plano, valor_mensal, status, valido_ate, origem, gateway, external_id, cupom_codigo, valor_renovacao, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
      assinaturaId,
      user.id,
      nome || user.name,
      email,
      phone || user.phone || '',
      planoKey,
      valorMensal,
      status,
      validoAte,
      params.origem || 'painel',
      params.gateway || '',
      params.externalId || '',
      cupomCodigo,
      valorRenovacao
    );
  }

  let whatsappEnviado = false;
  if (params.enviarWhatsapp !== false && (phone || user.phone)) {
    whatsappEnviado = await enviarBoasVindasPfWhatsApp({
      nome: nome || user.name,
      email,
      senhaPlana: senhaGerada,
      phone: phone || user.phone || '',
      planoNome: spec.nome,
      validoAte,
      appUrl: params.appUrl,
    });
    if (whatsappEnviado) {
      await db.$executeRawUnsafe(
        `UPDATE financas_pessoais_assinaturas SET boas_vindas_enviadas_em = NOW() WHERE id = $1`,
        assinaturaId
      );
    }
  }

  return {
    assinaturaId,
    user,
    usuarioNovo,
    senhaGerada,
    plano: planoKey,
    status,
    validoAte,
    whatsappEnviado,
  };
}
