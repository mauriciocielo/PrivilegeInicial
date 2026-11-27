// ============================================================
// NFS-e MULTI-TENANT — Contadores Terceiros & Isolamento de Certificados
// ============================================================
// Permite vender o emissor de NFS-e para escritórios contábeis terceiros:
// cada escritório possui seu próprio Certificado A1 (cifrado com escopo
// exclusivo), sua própria carteira de empresas e seus próprios usuários,
// sem nenhum cruzamento com a Privilege ('padrao') nem com outros contadores.

import db from '../prisma';

export const ID_ESCRITORIO_PADRAO = 'padrao';

export interface EscritorioNfseInfo {
  id: string;
  nome: string;
  cnpj: string;
  responsavel: string;
  email: string;
  telefone: string;
  ativo: boolean;
  limiteEmpresas: number;
}

export interface VinculoUsuarioEscritorio {
  escritorioId: string;
  papel: 'admin_escritorio' | 'operador';
  nomeEscritorio: string;
  ativo: boolean;
  limiteEmpresas: number;
}

let tabelasGarantidas = false;

export async function ensureEscritoriosNfseTables() {
  if (tabelasGarantidas) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS nfse_escritorios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      cnpj TEXT NOT NULL DEFAULT '',
      responsavel TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      telefone TEXT NOT NULL DEFAULT '',
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      limite_empresas INTEGER NOT NULL DEFAULT 0,
      brand_nome TEXT,
      brand_cor_primaria TEXT,
      brand_cor_secundaria TEXT,
      brand_logo_data TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  // Garante colunas de white-label em bancos já existentes
  await db.$executeRawUnsafe(`ALTER TABLE nfse_escritorios ADD COLUMN IF NOT EXISTS brand_nome TEXT`);
  await db.$executeRawUnsafe(`ALTER TABLE nfse_escritorios ADD COLUMN IF NOT EXISTS brand_cor_primaria TEXT`);
  await db.$executeRawUnsafe(`ALTER TABLE nfse_escritorios ADD COLUMN IF NOT EXISTS brand_cor_secundaria TEXT`);
  await db.$executeRawUnsafe(`ALTER TABLE nfse_escritorios ADD COLUMN IF NOT EXISTS brand_logo_data TEXT`);
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS nfse_escritorio_usuarios (
      user_id TEXT PRIMARY KEY,
      escritorio_id TEXT NOT NULL REFERENCES nfse_escritorios(id) ON DELETE CASCADE,
      papel TEXT NOT NULL DEFAULT 'admin_escritorio',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS nfse_empresa_escritorio (
      empresa_id TEXT PRIMARY KEY,
      escritorio_id TEXT NOT NULL REFERENCES nfse_escritorios(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_nfse_esc_usr_esc ON nfse_escritorio_usuarios(escritorio_id)`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_nfse_emp_esc_esc ON nfse_empresa_escritorio(escritorio_id)`
  );
  tabelasGarantidas = true;
}

/**
 * Dado autenticado usado pelo cofre AES-256-GCM para cifrar o .pfx e a senha.
 * Mantém 'escritorio' para o 'padrao' (compatibilidade 100% com o cert atual)
 * e isola criptograficamente cada contador terceiro em 'escritorio:<id>'.
 */
export function escopoCertificadoEscritorio(escritorioId: string): string {
  return !escritorioId || escritorioId === ID_ESCRITORIO_PADRAO
    ? 'escritorio'
    : `escritorio:${escritorioId}`;
}

/**
 * Retorna o vínculo de contador terceiro do usuário, ou null se ele for
 * da equipe interna do escritório padrão (Privilege).
 */
export async function obterEscritorioDoUsuario(userId: string): Promise<VinculoUsuarioEscritorio | null> {
  if (!userId) return null;
  try {
    await ensureEscritoriosNfseTables();
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT
         u.escritorio_id,
         u.papel,
         e.nome,
         e.ativo,
         e.limite_empresas
       FROM nfse_escritorio_usuarios u
       INNER JOIN nfse_escritorios e ON e.id = u.escritorio_id
       WHERE u.user_id = $1
       LIMIT 1`,
      userId
    );
    const r = rows[0];
    if (!r) return null;
    return {
      escritorioId: String(r.escritorio_id),
      papel: r.papel === 'operador' ? 'operador' : 'admin_escritorio',
      nomeEscritorio: String(r.nome || ''),
      ativo: Boolean(r.ativo),
      limiteEmpresas: Number(r.limite_empresas || 0),
    };
  } catch {
    return null;
  }
}

/**
 * Retorna o ID do escritório contábil dono da procuração desta empresa.
 * Empresas sem vínculo explícito pertencem ao escritório 'padrao' (Privilege).
 */
export async function obterEscritorioDaEmpresa(empresaId: string): Promise<string> {
  if (!empresaId) return ID_ESCRITORIO_PADRAO;
  try {
    await ensureEscritoriosNfseTables();
    const rows = await db.$queryRawUnsafe<Array<{ escritorio_id: string }>>(
      `SELECT escritorio_id FROM nfse_empresa_escritorio WHERE empresa_id = $1 LIMIT 1`,
      empresaId
    );
    return rows[0]?.escritorio_id || ID_ESCRITORIO_PADRAO;
  } catch {
    return ID_ESCRITORIO_PADRAO;
  }
}

/** Lista todos os empresaId vinculados a um escritório terceiro específico. */
export async function idsEmpresasDoEscritorio(escritorioId: string): Promise<string[]> {
  if (!escritorioId || escritorioId === ID_ESCRITORIO_PADRAO) return [];
  try {
    await ensureEscritoriosNfseTables();
    const rows = await db.$queryRawUnsafe<Array<{ empresa_id: string }>>(
      `SELECT empresa_id FROM nfse_empresa_escritorio WHERE escritorio_id = $1`,
      escritorioId
    );
    return rows.map((r) => String(r.empresa_id));
  } catch {
    return [];
  }
}

/** Lista todos os empresaId que pertencem a QUALQUER contador terceiro (para não misturar na carteira padrão). */
export async function idsEmpresasDeTerceiros(): Promise<string[]> {
  try {
    await ensureEscritoriosNfseTables();
    const rows = await db.$queryRawUnsafe<Array<{ empresa_id: string }>>(
      `SELECT empresa_id FROM nfse_empresa_escritorio WHERE escritorio_id <> $1`,
      ID_ESCRITORIO_PADRAO
    );
    return rows.map((r) => String(r.empresa_id));
  } catch {
    return [];
  }
}

export interface BrandingEscritorio {
  escritorioId: string;
  nome: string;
  corPrimaria: string | null;
  corSecundaria: string | null;
  logoData: string | null;
  podeEditar: boolean;
}

/**
 * Retorna a personalização visual (white-label: logo + cores) do escritório parceiro
 * tanto para o próprio contador quanto para todos os clientes das empresas dele.
 */
export async function obterBrandingEscritorioDoUsuario(
  userId: string,
  role: string
): Promise<BrandingEscritorio | null> {
  if (!userId || role === 'administrador') return null;
  try {
    await ensureEscritoriosNfseTables();

    // 1. Usuário é membro do escritório parceiro (contador / operador)
    const escUser = await db.$queryRawUnsafe<any[]>(
      `SELECT u.escritorio_id, u.papel, e.nome, e.brand_nome, e.brand_cor_primaria, e.brand_cor_secundaria, e.brand_logo_data
       FROM nfse_escritorio_usuarios u
       INNER JOIN nfse_escritorios e ON e.id = u.escritorio_id
       WHERE u.user_id = $1 AND e.ativo = TRUE
       LIMIT 1`,
      userId
    );
    if (escUser[0]) {
      const r = escUser[0];
      return {
        escritorioId: String(r.escritorio_id),
        nome: String(r.brand_nome || r.nome || ''),
        corPrimaria: r.brand_cor_primaria || null,
        corSecundaria: r.brand_cor_secundaria || null,
        logoData: r.brand_logo_data || null,
        podeEditar: r.papel !== 'operador',
      };
    }

    // 2. Usuário é cliente de uma empresa vinculada a um escritório parceiro
    if (role === 'cliente') {
      const u = await db.user.findUnique({ where: { id: userId }, select: { empresaIds: true } });
      const empIds = Array.isArray(u?.empresaIds) ? u!.empresaIds : [];
      if (empIds.length > 0) {
        const escEmp = await db.$queryRawUnsafe<any[]>(
          `SELECT e.id AS escritorio_id, e.nome, e.brand_nome, e.brand_cor_primaria, e.brand_cor_secundaria, e.brand_logo_data
           FROM nfse_empresa_escritorio ee
           INNER JOIN nfse_escritorios e ON e.id = ee.escritorio_id
           WHERE ee.empresa_id = ANY($1::text[]) AND e.ativo = TRUE
           LIMIT 1`,
          empIds
        );
        if (escEmp[0]) {
          const r = escEmp[0];
          return {
            escritorioId: String(r.escritorio_id),
            nome: String(r.brand_nome || r.nome || ''),
            corPrimaria: r.brand_cor_primaria || null,
            corSecundaria: r.brand_cor_secundaria || null,
            logoData: r.brand_logo_data || null,
            podeEditar: false,
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Retorna a identidade visual (logo, cores, nome, e-mail, telefone) do escritório parceiro
 * dono de uma empresa específica (para e-mails automáticos e PDFs no servidor).
 * Retorna null se a empresa pertencer ao escritório padrão (Privilege).
 */
export async function obterBrandingDaEmpresa(empresaId: string): Promise<{
  escritorioId: string;
  nome: string;
  email: string;
  telefone: string;
  corPrimaria: string | null;
  corSecundaria: string | null;
  logoData: string | null;
} | null> {
  if (!empresaId) return null;
  try {
    await ensureEscritoriosNfseTables();
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT e.id AS escritorio_id, e.nome, e.email, e.telefone,
              e.brand_nome, e.brand_cor_primaria, e.brand_cor_secundaria, e.brand_logo_data
       FROM nfse_empresa_escritorio ee
       INNER JOIN nfse_escritorios e ON e.id = ee.escritorio_id
       WHERE ee.empresa_id = $1 AND e.id <> $2 AND e.ativo = TRUE
       LIMIT 1`,
      empresaId,
      ID_ESCRITORIO_PADRAO
    );
    const r = rows[0];
    if (!r) return null;
    return {
      escritorioId: String(r.escritorio_id),
      nome: String(r.brand_nome || r.nome || ''),
      email: String(r.email || ''),
      telefone: String(r.telefone || ''),
      corPrimaria: r.brand_cor_primaria || null,
      corSecundaria: r.brand_cor_secundaria || null,
      logoData: r.brand_logo_data || null,
    };
  } catch {
    return null;
  }
}

/** Vincula uma empresa a um escritório terceiro (usado na importação por procuração). */
export async function vincularEmpresaAoEscritorio(empresaId: string, escritorioId: string): Promise<void> {
  if (!empresaId || !escritorioId || escritorioId === ID_ESCRITORIO_PADRAO) return;
  await ensureEscritoriosNfseTables();
  await db.$executeRawUnsafe(
    `INSERT INTO nfse_empresa_escritorio (empresa_id, escritorio_id, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (empresa_id) DO UPDATE SET escritorio_id = EXCLUDED.escritorio_id`,
    empresaId,
    escritorioId
  );
}
