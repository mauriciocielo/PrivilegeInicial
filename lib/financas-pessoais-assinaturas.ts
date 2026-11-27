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

  tabelaAssinaturasGarantida = true;
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
  if (assinaturaId) {
    await db.$executeRawUnsafe(
      `UPDATE financas_pessoais_assinaturas
       SET nome = $1, phone = $2, plano = $3, valor_mensal = $4, status = $5, valido_ate = $6,
           gateway = COALESCE(NULLIF($7, ''), gateway),
           external_id = COALESCE(NULLIF($8, ''), external_id),
           updated_at = NOW()
       WHERE id = $9`,
      nome || user.name,
      phone || user.phone || '',
      planoKey,
      valorMensal,
      status,
      validoAte,
      params.gateway || '',
      params.externalId || '',
      assinaturaId
    );
  } else {
    assinaturaId = crypto.randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO financas_pessoais_assinaturas
        (id, user_id, nome, email, phone, plano, valor_mensal, status, valido_ate, origem, gateway, external_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
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
      params.externalId || ''
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
