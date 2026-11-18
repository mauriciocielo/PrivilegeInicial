import { getEmailDbPool } from './email-db';
import db from './prisma';

export interface SaasTenant {
  id: string;
  empresa_id?: string | null;
  company_name: string;
  cnpj?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  plan_name: string;
  monthly_value: number;
  billing_day: number;
  status: 'ativa' | 'trial' | 'pendente' | 'suspensa' | 'cancelada';
  modules: string[];
  trial_ends_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SaasMovement {
  id: string;
  tenant_id: string;
  tenant_name: string;
  movement_type: 'mensalidade' | 'implantacao' | 'upgrade' | 'downgrade' | 'novo_cadastro' | 'cancelamento' | 'estorno';
  amount: number;
  status: 'pago' | 'pendente' | 'atrasado' | 'cancelado';
  reference_month?: string | null;
  due_date?: string | null;
  paid_at?: string | null;
  payment_method?: string | null;
  description?: string | null;
  created_at?: string;
}

let __saasTablesEnsured = false;

export async function ensureSaasTables() {
  const pool = getEmailDbPool();
  if (!pool) return null;

  if (!__saasTablesEnsured) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saas_tenants (
        id TEXT PRIMARY KEY,
        empresa_id TEXT,
        company_name TEXT NOT NULL,
        cnpj TEXT,
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        plan_name TEXT DEFAULT 'Pro 360º',
        monthly_value NUMERIC(12,2) DEFAULT 0,
        billing_day INTEGER DEFAULT 10,
        status TEXT DEFAULT 'ativa',
        modules JSONB DEFAULT '["administrativo","financeiro","comercial","marketing","pessoas"]'::jsonb,
        trial_ends_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS saas_movements (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        tenant_name TEXT NOT NULL,
        movement_type TEXT DEFAULT 'mensalidade',
        amount NUMERIC(12,2) DEFAULT 0,
        status TEXT DEFAULT 'pendente',
        reference_month TEXT,
        due_date DATE,
        paid_at TIMESTAMPTZ,
        payment_method TEXT DEFAULT 'Pix',
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    __saasTablesEnsured = true;
  }

  return pool;
}

function mapTenantRow(r: any): SaasTenant {
  return {
    id: r.id,
    empresa_id: r.empresa_id || null,
    company_name: r.company_name,
    cnpj: r.cnpj || null,
    contact_name: r.contact_name || null,
    contact_email: r.contact_email || null,
    contact_phone: r.contact_phone || null,
    plan_name: r.plan_name || 'Pro 360º',
    monthly_value: Number(r.monthly_value || 0),
    billing_day: Number(r.billing_day || 10),
    status: (r.status || 'ativa') as SaasTenant['status'],
    modules: typeof r.modules === 'string' ? JSON.parse(r.modules) : r.modules || [],
    trial_ends_at: r.trial_ends_at ? new Date(r.trial_ends_at).toISOString() : null,
    notes: r.notes || null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function mapMovementRow(r: any): SaasMovement {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    tenant_name: r.tenant_name,
    movement_type: (r.movement_type || 'mensalidade') as SaasMovement['movement_type'],
    amount: Number(r.amount || 0),
    status: (r.status || 'pendente') as SaasMovement['status'],
    reference_month: r.reference_month || null,
    due_date: r.due_date ? new Date(r.due_date).toISOString().slice(0, 10) : null,
    paid_at: r.paid_at ? new Date(r.paid_at).toISOString() : null,
    payment_method: r.payment_method || 'Pix',
    description: r.description || null,
    created_at: r.created_at,
  };
}

export async function getSaasOverview() {
  const pool = await ensureSaasTables();
  if (!pool) {
    return {
      tenants: [] as SaasTenant[],
      movements: [] as SaasMovement[],
      platformStats: { empresasCount: 0, usersCount: 0, whatsappConnectedCount: 0, quizzesCount: 0 },
      availableEmpresas: [] as Array<{ id: string; nome: string; cnpj: string; email: string; telefone: string; responsavel: string }>,
    };
  }

  const [tenantsRes, movementsRes, waRes, quizRes, empresasList, usersCount] = await Promise.all([
    pool.query(`SELECT * FROM saas_tenants ORDER BY updated_at DESC`),
    pool.query(`SELECT * FROM saas_movements ORDER BY created_at DESC LIMIT 200`),
    pool.query(`SELECT COUNT(*)::int AS cnt FROM whatsapp_config WHERE status = 'conectado'`).catch(() => ({ rows: [{ cnt: 0 }] })),
    pool.query(`SELECT COUNT(*)::int AS cnt FROM quiz_games`).catch(() => ({ rows: [{ cnt: 0 }] })),
    db.empresa.findMany({
      select: { id: true, nomeFantasia: true, razaoSocial: true, cnpj: true, email: true, telefone: true, responsavel: true },
      orderBy: { nomeFantasia: 'asc' },
    }).catch(() => []),
    db.user.count().catch(() => 0),
  ]);

  return {
    tenants: tenantsRes.rows.map(mapTenantRow),
    movements: movementsRes.rows.map(mapMovementRow),
    platformStats: {
      empresasCount: empresasList.length,
      usersCount,
      whatsappConnectedCount: Number(waRes.rows?.[0]?.cnt || 0),
      quizzesCount: Number(quizRes.rows?.[0]?.cnt || 0),
    },
    availableEmpresas: empresasList.map(e => ({
      id: e.id,
      nome: e.nomeFantasia || e.razaoSocial,
      cnpj: e.cnpj,
      email: e.email,
      telefone: e.telefone,
      responsavel: e.responsavel,
    })),
  };
}

export async function saveSaasTenant(input: Partial<SaasTenant> & { company_name: string }): Promise<SaasTenant> {
  const pool = await ensureSaasTables();
  if (!pool) throw new Error('Banco de dados indisponível');

  const isNew = !input.id;
  const id = input.id || `saas_ten_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const prevRes = isNew ? null : await pool.query(`SELECT * FROM saas_tenants WHERE id = $1`, [id]);
  const prev = prevRes?.rows?.[0] ? mapTenantRow(prevRes.rows[0]) : null;

  const res = await pool.query(
    `INSERT INTO saas_tenants (
      id, empresa_id, company_name, cnpj, contact_name, contact_email, contact_phone,
      plan_name, monthly_value, billing_day, status, modules, trial_ends_at, notes, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,NOW())
    ON CONFLICT (id) DO UPDATE SET
      empresa_id = EXCLUDED.empresa_id,
      company_name = EXCLUDED.company_name,
      cnpj = EXCLUDED.cnpj,
      contact_name = EXCLUDED.contact_name,
      contact_email = EXCLUDED.contact_email,
      contact_phone = EXCLUDED.contact_phone,
      plan_name = EXCLUDED.plan_name,
      monthly_value = EXCLUDED.monthly_value,
      billing_day = EXCLUDED.billing_day,
      status = EXCLUDED.status,
      modules = EXCLUDED.modules,
      trial_ends_at = EXCLUDED.trial_ends_at,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING *`,
    [
      id,
      input.empresa_id || null,
      input.company_name.trim(),
      input.cnpj || null,
      input.contact_name || null,
      input.contact_email || null,
      input.contact_phone || null,
      input.plan_name || 'Pro 360º',
      Number(input.monthly_value || 0),
      Number(input.billing_day || 10),
      input.status || 'ativa',
      JSON.stringify(input.modules || ['administrativo', 'financeiro', 'comercial', 'marketing', 'pessoas']),
      input.trial_ends_at || null,
      input.notes || null,
    ]
  );

  const saved = mapTenantRow(res.rows[0]);

  // Registra movimentação automática de auditoria SaaS
  if (isNew) {
    await saveSaasMovement({
      tenant_id: saved.id,
      tenant_name: saved.company_name,
      movement_type: 'novo_cadastro',
      amount: saved.monthly_value,
      status: saved.status === 'trial' ? 'pendente' : 'pago',
      reference_month: new Date().toISOString().slice(0, 7),
      description: `Novo cadastro SaaS — Plano ${saved.plan_name}`,
    });
  } else if (prev && prev.status !== saved.status && saved.status === 'cancelada') {
    await saveSaasMovement({
      tenant_id: saved.id,
      tenant_name: saved.company_name,
      movement_type: 'cancelamento',
      amount: saved.monthly_value,
      status: 'cancelado',
      reference_month: new Date().toISOString().slice(0, 7),
      description: `Assinatura cancelada (era ${prev.plan_name})`,
    });
  } else if (prev && prev.monthly_value !== saved.monthly_value) {
    await saveSaasMovement({
      tenant_id: saved.id,
      tenant_name: saved.company_name,
      movement_type: saved.monthly_value > prev.monthly_value ? 'upgrade' : 'downgrade',
      amount: saved.monthly_value,
      status: 'pago',
      reference_month: new Date().toISOString().slice(0, 7),
      description: `Alteração de plano: ${prev.plan_name} (R$ ${prev.monthly_value}) → ${saved.plan_name} (R$ ${saved.monthly_value})`,
    });
  }

  return saved;
}

export async function deleteSaasTenant(id: string) {
  const pool = await ensureSaasTables();
  if (!pool) return;
  await pool.query(`DELETE FROM saas_tenants WHERE id = $1`, [id]);
}

export async function saveSaasMovement(
  input: Partial<SaasMovement> & { tenant_id: string; tenant_name: string }
): Promise<SaasMovement> {
  const pool = await ensureSaasTables();
  if (!pool) throw new Error('Banco de dados indisponível');

  const id = input.id || `saas_mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const paidAt =
    input.status === 'pago' ? input.paid_at || new Date().toISOString() : input.paid_at || null;

  const res = await pool.query(
    `INSERT INTO saas_movements (
      id, tenant_id, tenant_name, movement_type, amount, status,
      reference_month, due_date, paid_at, payment_method, description
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (id) DO UPDATE SET
      movement_type = EXCLUDED.movement_type,
      amount = EXCLUDED.amount,
      status = EXCLUDED.status,
      reference_month = EXCLUDED.reference_month,
      due_date = EXCLUDED.due_date,
      paid_at = EXCLUDED.paid_at,
      payment_method = EXCLUDED.payment_method,
      description = EXCLUDED.description
    RETURNING *`,
    [
      id,
      input.tenant_id,
      input.tenant_name,
      input.movement_type || 'mensalidade',
      Number(input.amount || 0),
      input.status || 'pendente',
      input.reference_month || new Date().toISOString().slice(0, 7),
      input.due_date || null,
      paidAt,
      input.payment_method || 'Pix',
      input.description || null,
    ]
  );

  return mapMovementRow(res.rows[0]);
}

export async function deleteSaasMovement(id: string) {
  const pool = await ensureSaasTables();
  if (!pool) return;
  await pool.query(`DELETE FROM saas_movements WHERE id = $1`, [id]);
}

export async function syncEmpresasIntoSaas(): Promise<number> {
  const pool = await ensureSaasTables();
  if (!pool) return 0;

  const empresas = await db.empresa.findMany({
    select: { id: true, nomeFantasia: true, razaoSocial: true, cnpj: true, email: true, telefone: true, responsavel: true },
  });
  const existingRes = await pool.query(`SELECT empresa_id, cnpj FROM saas_tenants`);
  const existingEmpresaIds = new Set(existingRes.rows.map((r: any) => r.empresa_id).filter(Boolean));
  const existingCnpjs = new Set(existingRes.rows.map((r: any) => r.cnpj).filter(Boolean));

  let added = 0;
  for (const emp of empresas) {
    if (existingEmpresaIds.has(emp.id) || (emp.cnpj && existingCnpjs.has(emp.cnpj))) continue;
    await saveSaasTenant({
      empresa_id: emp.id,
      company_name: emp.nomeFantasia || emp.razaoSocial,
      cnpj: emp.cnpj,
      contact_name: emp.responsavel,
      contact_email: emp.email,
      contact_phone: emp.telefone,
      plan_name: 'Pro 360º',
      monthly_value: 0,
      billing_day: 10,
      status: 'ativa',
      modules: ['administrativo', 'financeiro', 'comercial', 'marketing', 'pessoas'],
    });
    added++;
  }
  return added;
}

export async function generateMonthlyBilling(referenceMonth: string): Promise<number> {
  const pool = await ensureSaasTables();
  if (!pool) return 0;

  const tenantsRes = await pool.query(`SELECT * FROM saas_tenants WHERE status = 'ativa' AND monthly_value > 0`);
  const existingRes = await pool.query(
    `SELECT tenant_id FROM saas_movements WHERE movement_type = 'mensalidade' AND reference_month = $1`,
    [referenceMonth]
  );
  const alreadyBilled = new Set(existingRes.rows.map((r: any) => r.tenant_id));

  let created = 0;
  for (const row of tenantsRes.rows) {
    const t = mapTenantRow(row);
    if (alreadyBilled.has(t.id)) continue;
    const dayStr = String(Math.min(28, Math.max(1, t.billing_day))).padStart(2, '0');
    await saveSaasMovement({
      tenant_id: t.id,
      tenant_name: t.company_name,
      movement_type: 'mensalidade',
      amount: t.monthly_value,
      status: 'pendente',
      reference_month: referenceMonth,
      due_date: `${referenceMonth}-${dayStr}`,
      payment_method: 'Pix',
      description: `Mensalidade ${referenceMonth} — Plano ${t.plan_name}`,
    });
    created++;
  }
  return created;
}
