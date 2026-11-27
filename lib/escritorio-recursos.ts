import crypto from 'crypto';
import db from './prisma';
import { ID_ESCRITORIO_PADRAO, obterEscritorioDoUsuario } from './nfse/escritorios-terceiros';

let recursosGarantidos = false;

export async function ensureEscritorioRecursosTables() {
  if (recursosGarantidos) return;

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS escritorio_chamados (
      id TEXT PRIMARY KEY,
      protocolo TEXT NOT NULL,
      escritorio_id TEXT NOT NULL,
      escritorio_nome TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL,
      user_nome TEXT NOT NULL DEFAULT '',
      user_email TEXT NOT NULL DEFAULT '',
      empresa_id TEXT,
      empresa_nome TEXT,
      categoria TEXT NOT NULL DEFAULT 'duvida',
      prioridade TEXT NOT NULL DEFAULT 'normal',
      assunto TEXT NOT NULL,
      descricao TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'aberto',
      mensagens_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_esc_chamados_esc ON escritorio_chamados(escritorio_id, created_at DESC)`
  );

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS escritorio_cert_convites (
      token TEXT PRIMARY KEY,
      empresa_id TEXT NOT NULL,
      escritorio_id TEXT NOT NULL,
      criado_por_id TEXT NOT NULL,
      criado_por_nome TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pendente',
      expires_at TIMESTAMP NOT NULL,
      concluido_em TIMESTAMP,
      cert_titular TEXT,
      cert_valido_ate TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_esc_cert_conv_emp ON escritorio_cert_convites(empresa_id, created_at DESC)`
  );

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS escritorio_auditoria (
      id TEXT PRIMARY KEY,
      escritorio_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_nome TEXT NOT NULL DEFAULT '',
      user_email TEXT NOT NULL DEFAULT '',
      acao TEXT NOT NULL,
      empresa_id TEXT,
      empresa_nome TEXT,
      detalhes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_esc_audit_esc ON escritorio_auditoria(escritorio_id, created_at DESC)`
  );

  recursosGarantidos = true;
}

/**
 * Registra um evento na trilha de auditoria da equipe do escritório.
 * Silencioso em caso de erro para nunca interromper a operação principal.
 */
export async function registrarAuditoriaEscritorio(params: {
  userId: string;
  userNome?: string;
  userEmail?: string;
  escritorioId?: string;
  acao: string;
  empresaId?: string | null;
  empresaNome?: string | null;
  detalhes: string;
}) {
  try {
    await ensureEscritorioRecursosTables();
    let escritorioId = params.escritorioId;
    if (!escritorioId && params.userId && params.userId !== 'cliente-publico') {
      const vinculo = await obterEscritorioDoUsuario(params.userId);
      escritorioId = vinculo?.escritorioId || ID_ESCRITORIO_PADRAO;
    }
    escritorioId = escritorioId || ID_ESCRITORIO_PADRAO;

    let userNome = params.userNome || '';
    let userEmail = params.userEmail || '';
    if ((!userNome || !userEmail) && params.userId && params.userId !== 'cliente-publico') {
      const u = await db.user.findUnique({
        where: { id: params.userId },
        select: { name: true, email: true },
      });
      if (u) {
        userNome = userNome || u.name;
        userEmail = userEmail || u.email;
      }
    }

    await db.$executeRawUnsafe(
      `INSERT INTO escritorio_auditoria
        (id, escritorio_id, user_id, user_nome, user_email, acao, empresa_id, empresa_nome, detalhes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      crypto.randomUUID(),
      escritorioId,
      params.userId || 'sistema',
      userNome || 'Sistema',
      userEmail || '',
      params.acao,
      params.empresaId || null,
      params.empresaNome || null,
      params.detalhes
    );
  } catch {
    // Nunca quebra o fluxo principal
  }
}
