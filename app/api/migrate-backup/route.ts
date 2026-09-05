import { NextResponse } from 'next/server';
import db from '../../../lib/prisma';
import crypto from 'crypto';
import { SYNC_COLLECTION_KEYS } from '../../../lib/sync-registry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Nota: maxDuration requer plano Pro da Vercel — removido para compatibilidade com plano gratuito.

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>
) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(fn));
  }
}

async function migrateEmpresas(empresas: any[]) {
  console.log(`Migrando ${empresas.length} empresas...`);
  for (const e of empresas) {
    if (!e.id) continue;
    const empresaId = String(e.id);
    const cnpj = String(e.cnpj || '');
    try {
      if (cnpj) {
        const conflictCnpj = await db.empresa.findFirst({
          where: {
            cnpj: cnpj,
            NOT: { id: empresaId }
          }
        });
        if (conflictCnpj) {
          console.log(`Resolvendo conflito de CNPJ para ${cnpj}: excluindo ID antigo ${conflictCnpj.id}`);
          await db.empresa.delete({
            where: { id: conflictCnpj.id }
          });
        }
      }

      const existing = await db.empresa.findUnique({ where: { id: String(e.id) } });

      await db.empresa.upsert({
        where: { id: String(e.id) },
        update: {
          razaoSocial: String(e.razaoSocial || ''),
          nomeFantasia: String(e.nomeFantasia || ''),
          cnpj: String(e.cnpj || ''),
          responsavel: String(e.responsavel || ''),
          email: String(e.email || ''),
          telefone: String(e.telefone || ''),
          atividade: e.atividade ? String(e.atividade) : null,
          tipo: String(e.tipo || 'empresa'),
          taxaMensalPadrao: e.taxaMensalPadrao !== undefined ? Number(e.taxaMensalPadrao) : null,
          fundoReservaPct: e.fundoReservaPct !== undefined ? Number(e.fundoReservaPct) : null,
          dataInicioContrato: e.dataInicioContrato ? String(e.dataInicioContrato) : null,
          grupoEconomico: e.grupoEconomico ? String(e.grupoEconomico) : null,
          receitaMensalEstimada: e.receitaMensalEstimada !== undefined ? Number(e.receitaMensalEstimada) : null,
          comprasMensalEstimada: e.comprasMensalEstimada !== undefined ? Number(e.comprasMensalEstimada) : null,
          logoData: e.logoData ? String(e.logoData) : (existing?.logoData || null),
          bancoBoleto: String(e.bancoBoleto || 'nenhum'),
          allowedRoutes: Array.isArray(e.allowedRoutes) ? e.allowedRoutes.map(String) : [],
          politicaReceberName: e.politicaReceberName ? String(e.politicaReceberName) : (existing?.politicaReceberName || null),
          politicaReceberData: e.politicaReceberData ? String(e.politicaReceberData) : (existing?.politicaReceberData || null),
          politicaComprasName: e.politicaComprasName ? String(e.politicaComprasName) : (existing?.politicaComprasName || null),
          politicaComprasData: e.politicaComprasData ? String(e.politicaComprasData) : (existing?.politicaComprasData || null),
          politicaCobrancaName: e.politicaCobrancaName ? String(e.politicaCobrancaName) : (existing?.politicaCobrancaName || null),
          politicaCobrancaData: e.politicaCobrancaData ? String(e.politicaCobrancaData) : (existing?.politicaCobrancaData || null),
        },
        create: {
          id: String(e.id),
          razaoSocial: String(e.razaoSocial || ''),
          nomeFantasia: String(e.nomeFantasia || ''),
          cnpj: String(e.cnpj || ''),
          responsavel: String(e.responsavel || ''),
          email: String(e.email || ''),
          telefone: String(e.telefone || ''),
          atividade: e.atividade ? String(e.atividade) : null,
          tipo: String(e.tipo || 'empresa'),
          taxaMensalPadrao: e.taxaMensalPadrao !== undefined ? Number(e.taxaMensalPadrao) : null,
          fundoReservaPct: e.fundoReservaPct !== undefined ? Number(e.fundoReservaPct) : null,
          dataInicioContrato: e.dataInicioContrato ? String(e.dataInicioContrato) : null,
          grupoEconomico: e.grupoEconomico ? String(e.grupoEconomico) : null,
          receitaMensalEstimada: e.receitaMensalEstimada !== undefined ? Number(e.receitaMensalEstimada) : null,
          comprasMensalEstimada: e.comprasMensalEstimada !== undefined ? Number(e.comprasMensalEstimada) : null,
          logoData: e.logoData ? String(e.logoData) : null,
          bancoBoleto: String(e.bancoBoleto || 'nenhum'),
          allowedRoutes: Array.isArray(e.allowedRoutes) ? e.allowedRoutes.map(String) : [],
          politicaReceberName: e.politicaReceberName ? String(e.politicaReceberName) : null,
          politicaReceberData: e.politicaReceberData ? String(e.politicaReceberData) : null,
          politicaComprasName: e.politicaComprasName ? String(e.politicaComprasName) : null,
          politicaComprasData: e.politicaComprasData ? String(e.politicaComprasData) : null,
          politicaCobrancaName: e.politicaCobrancaName ? String(e.politicaCobrancaName) : null,
          politicaCobrancaData: e.politicaCobrancaData ? String(e.politicaCobrancaData) : null,
        }
      });
    } catch (err) {
      console.error(`Erro na Empresa (ID: ${e.id}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

async function migrateAuditLogs(logs: any[]) {
  console.log(`Migrando ${logs.length} logs de auditoria...`);

  for (const log of logs) {
    if (!log.id) continue;
    try {
      await db.auditLog.upsert({
        where: { id: String(log.id) },
        update: {
          empresaId: String(log.empresaId || 'empresa_default'),
          timestamp: String(log.timestamp || new Date().toISOString()),
          userName: String(log.userName || 'Sistema/BPO'),
          action: String(log.action || ''),
          details: String(log.details || ''),
        },
        create: {
          id: String(log.id),
          empresaId: String(log.empresaId || 'empresa_default'),
          timestamp: String(log.timestamp || new Date().toISOString()),
          userName: String(log.userName || 'Sistema/BPO'),
          action: String(log.action || ''),
          details: String(log.details || ''),
        }
      });
    } catch (err) {
      console.error(`Erro no Log de Auditoria (ID: ${log.id}), pulando este item e continuando o lote:`, err);
    }
  }
}

async function migrateCentrosCusto(centros: any[]) {
  console.log(`Migrando ${centros.length} centros de custo...`);

  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const cc of centros) {
    if (!cc.id) continue;
    try {
      const empresaId = String(cc.empresaId || 'empresa_default');

      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      await db.centroCusto.upsert({
        where: { id: String(cc.id) },
        update: {
          empresaId: empresaId,
          nome: String(cc.nome || ''),
          codigo: cc.codigo ? String(cc.codigo) : null,
          ativo: cc.ativo === undefined ? true : Boolean(cc.ativo),
        },
        create: {
          id: String(cc.id),
          empresaId: empresaId,
          nome: String(cc.nome || ''),
          codigo: cc.codigo ? String(cc.codigo) : null,
          ativo: cc.ativo === undefined ? true : Boolean(cc.ativo),
        }
      });
    } catch (err) {
      console.error(`Erro no Centro de Custo (ID: ${cc.id}), pulando este item e continuando o lote:`, err);
    }
  }
}

async function migrateAgendaTasks(tasks: any[]) {
  console.log(`Migrando ${tasks.length} tarefas da agenda...`);

  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const t of tasks) {
    if (!t.id) continue;
    try {
      const empresaId = String(t.empresaId || 'empresa_default');

      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      await db.agendaTask.upsert({
        where: { id: String(t.id) },
        update: {
          title: String(t.title || ''),
          empresaId: empresaId,
          consultorId: String(t.consultorId || ''),
          horario: String(t.horario || ''),
          day: String(t.day || ''),
          completed: Boolean(t.completed),
          recurrent: Boolean(t.recurrent),
        },
        create: {
          id: String(t.id),
          title: String(t.title || ''),
          empresaId: empresaId,
          consultorId: String(t.consultorId || ''),
          horario: String(t.horario || ''),
          day: String(t.day || ''),
          completed: Boolean(t.completed),
          recurrent: Boolean(t.recurrent),
        }
      });
    } catch (err) {
      console.error(`Erro na Tarefa da Agenda (ID: ${t.id}), pulando este item e continuando o lote:`, err);
    }
  }
}

async function migrateInteligenciaDocs(docs: any[]) {
  console.log(`Migrando ${docs.length} documentos de inteligência...`);

  for (const d of docs) {
    if (!d.id) continue;
    try {
      await db.inteligenciaDoc.upsert({
        where: { id: String(d.id) },
        update: {
          name: String(d.name || ''),
          type: String(d.type || ''),
          size: Number(d.size || 0),
          content: String(d.content || ''),
        },
        create: {
          id: String(d.id),
          name: String(d.name || ''),
          type: String(d.type || ''),
          size: Number(d.size || 0),
          content: String(d.content || ''),
        }
      });
    } catch (err) {
      console.error(`Erro no Documento de Inteligência (ID: ${d.id}), pulando este item e continuando o lote:`, err);
    }
  }
}

async function migrateAtividades(atividades: any[]) {
  console.log(`Migrando ${atividades.length} atividades...`);
  
  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const at of atividades) {
    if (!at.id) continue;
    const empresaId = String(at.empresaId || 'empresa_default');
    
    try {
      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      const existing = await db.atividade.findUnique({ where: { id: String(at.id) } });

      await db.atividade.upsert({
        where: { id: String(at.id) },
        update: {
          empresaId: empresaId,
          descricao: String(at.descricao || ''),
          tempoSegundos: Number(at.tempoSegundos || 0),
          data: String(at.data || new Date().toISOString()),
          lat: at.localizacao?.lat ? Number(at.localizacao.lat) : at.lat ? Number(at.lat) : null,
          lng: at.localizacao?.lng ? Number(at.localizacao.lng) : at.lng ? Number(at.lng) : null,
          fotoInicio: at.fotoInicio && at.fotoInicio !== '__PRUNED_IN_LOCAL_STAGE__' ? String(at.fotoInicio) : (existing?.fotoInicio || null),
          fotoFim: at.fotoFim && at.fotoFim !== '__PRUNED_IN_LOCAL_STAGE__' ? String(at.fotoFim) : (existing?.fotoFim || null),
        },
        create: {
          id: String(at.id),
          empresaId: empresaId,
          descricao: String(at.descricao || ''),
          tempoSegundos: Number(at.tempoSegundos || 0),
          data: String(at.data || new Date().toISOString()),
          lat: at.localizacao?.lat ? Number(at.localizacao.lat) : at.lat ? Number(at.lat) : null,
          lng: at.localizacao?.lng ? Number(at.localizacao.lng) : at.lng ? Number(at.lng) : null,
          fotoInicio: at.fotoInicio ? String(at.fotoInicio) : null,
          fotoFim: at.fotoFim ? String(at.fotoFim) : null,
        }
      });
    } catch (err) {
      console.error(`Erro na Atividade (ID: ${at.id}), pulando este item e continuando o lote:`, err);
    }
  }
}

async function migrateUsers(users: any[]) {
  console.log(`Migrando ${users.length} usuários...`);
  for (const u of users) {
    if (!u.email) continue;
    const userId = String(u.id || crypto.randomUUID());
    const email = String(u.email);
    try {
      const conflictEmail = await db.user.findFirst({
        where: {
          email: email,
          NOT: { id: userId }
        }
      });
      if (conflictEmail) {
        console.log(`Resolvendo conflito de email para ${email}: excluindo ID antigo ${conflictEmail.id}`);
        await db.user.delete({
          where: { id: conflictEmail.id }
        });
      }

      const conflictId = await db.user.findFirst({
        where: {
          id: userId,
          NOT: { email: email }
        }
      });
      if (conflictId) {
        console.log(`Resolvendo conflito de ID para ${userId}: excluindo email antigo ${conflictId.email}`);
        await db.user.delete({
          where: { id: conflictId.id }
        });
      }

      const existing = await db.user.findUnique({ where: { id: userId } });

      await db.user.upsert({
        where: { id: userId },
        update: {
          email: email,
          name: String(u.name || ''),
          password: String(u.password || ''),
          role: String(u.role || 'cliente'),
          empresaIds: Array.isArray(u.empresaIds) ? u.empresaIds.map(String) : [],
          avatarData: u.avatarData && u.avatarData !== '__PRUNED_IN_LOCAL_STAGE__' ? String(u.avatarData) : (existing?.avatarData || null),
          receberEmailDiario: Boolean(u.receberEmailDiario),
          phone: u.phone ? String(u.phone) : null,
          allowedRoutes: Array.isArray(u.allowedRoutes) ? u.allowedRoutes.map(String) : [],
        },
        create: {
          id: userId,
          email: email,
          name: String(u.name || ''),
          password: String(u.password || ''),
          role: String(u.role || 'cliente'),
          empresaIds: Array.isArray(u.empresaIds) ? u.empresaIds.map(String) : [],
          avatarData: u.avatarData ? String(u.avatarData) : null,
          receberEmailDiario: Boolean(u.receberEmailDiario),
          phone: u.phone ? String(u.phone) : null,
          allowedRoutes: Array.isArray(u.allowedRoutes) ? u.allowedRoutes.map(String) : [],
        }
      });
    } catch (err) {
      console.error(`Erro no Usuário (Email: ${u.email}), pulando este item e continuando o lote:`, err);
    }
  }
}

async function migrateUnidades(unidades: any[]) {
  console.log(`Migrando ${unidades.length} unidades...`);
  
  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const uni of unidades) {
    if (!uni.id) continue;
    try {
      const condominioId = String(uni.condominioId || 'condo_default');
      
      if (!empresaIdsSet.has(condominioId)) {
        await db.empresa.upsert({
          where: { id: condominioId },
          update: {},
          create: {
            id: condominioId,
            razaoSocial: 'Condomínio Auto-Criado',
            nomeFantasia: 'Condomínio Auto-Criado',
            cnpj: `CNPJ-${condominioId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@condominio.com',
            telefone: '0000000000',
            tipo: 'condominio'
          }
        });
        empresaIdsSet.add(condominioId);
      }

      await db.unidade.upsert({
        where: { id: String(uni.id) },
        update: {
          condominioId: condominioId,
          identificacao: String(uni.identificacao || ''),
          proprietario: String(uni.proprietario || ''),
          proprietarioCpf: uni.proprietarioCpf ? String(uni.proprietarioCpf) : null,
          fracaoIdeal: Number(uni.fracaoIdeal || 0),
          email: String(uni.email || ''),
          telefone: String(uni.telefone || ''),
          moradorNome: uni.moradorNome ? String(uni.moradorNome) : null,
          moradorCpf: uni.moradorCpf ? String(uni.moradorCpf) : null,
          moradorEmail: uni.moradorEmail ? String(uni.moradorEmail) : null,
          moradorTelefone: uni.moradorTelefone ? String(uni.moradorTelefone) : null,
        },
        create: {
          id: String(uni.id),
          condominioId: condominioId,
          identificacao: String(uni.identificacao || ''),
          proprietario: String(uni.proprietario || ''),
          proprietarioCpf: uni.proprietarioCpf ? String(uni.proprietarioCpf) : null,
          fracaoIdeal: Number(uni.fracaoIdeal || 0),
          email: String(uni.email || ''),
          telefone: String(uni.telefone || ''),
          moradorNome: uni.moradorNome ? String(uni.moradorNome) : null,
          moradorCpf: uni.moradorCpf ? String(uni.moradorCpf) : null,
          moradorEmail: uni.moradorEmail ? String(uni.moradorEmail) : null,
          moradorTelefone: uni.moradorTelefone ? String(uni.moradorTelefone) : null,
        }
      });
    } catch (err) {
      console.error(`Erro na Unidade (ID: ${uni.id}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

async function migratePlanoContas(planoContas: any[]) {
  console.log(`Migrando ${planoContas.length} planos de contas (Passo 1)...`);
  
  // 1. Upsert unique companies first to prevent concurrency issues
  const uniqueEmpresaIds = Array.from(new Set(planoContas.map(pc => String(pc.empresaId || 'empresa_default'))));
  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const empresaId of uniqueEmpresaIds) {
    if (!empresaIdsSet.has(empresaId)) {
      await db.empresa.upsert({
        where: { id: empresaId },
        update: {},
        create: {
          id: empresaId,
          razaoSocial: 'Empresa Auto-Criada',
          nomeFantasia: 'Empresa Auto-Criada',
          cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
          responsavel: 'Responsável',
          email: 'contato@empresa.com',
          telefone: '0000000000',
        }
      });
      empresaIdsSet.add(empresaId);
    }
  }

  // 2. Upsert PlanoConta + parentId em um único loop sequencial (reduz tempo de resposta e evita Inactivity Timeout em serverless)
  for (const pc of planoContas) {
    if (!pc.id) continue;
    const empresaId = String(pc.empresaId || 'empresa_default');
    try {
      await db.planoConta.upsert({
        where: { id: String(pc.id) },
        update: {
          codigo: String(pc.codigo || ''),
          descricao: String(pc.descricao || ''),
          tipo: String(pc.tipo || 'receita'),
          nivel: Math.round(Number(pc.nivel)) || 1,
          parentId: pc.parentId ? String(pc.parentId) : null,
          ativo: pc.ativo === undefined ? true : Boolean(pc.ativo),
          empresaId: empresaId,
          dreCategoria: pc.dreCategoria ? String(pc.dreCategoria) : null,
        },
        create: {
          id: String(pc.id),
          codigo: String(pc.codigo || ''),
          descricao: String(pc.descricao || ''),
          tipo: String(pc.tipo || 'receita'),
          nivel: Math.round(Number(pc.nivel)) || 1,
          parentId: pc.parentId ? String(pc.parentId) : null,
          ativo: pc.ativo === undefined ? true : Boolean(pc.ativo),
          empresaId: empresaId,
          dreCategoria: pc.dreCategoria ? String(pc.dreCategoria) : null,
        }
      });
    } catch (err) {
      // Se falhou com parentId (FK violation), tenta sem parentId e ignora hierarquia para não travar a migração
      try {
        await db.planoConta.upsert({
          where: { id: String(pc.id) },
          update: {
            codigo: String(pc.codigo || ''),
            descricao: String(pc.descricao || ''),
            tipo: String(pc.tipo || 'receita'),
            nivel: Math.round(Number(pc.nivel)) || 1,
            parentId: null,
            ativo: pc.ativo === undefined ? true : Boolean(pc.ativo),
            empresaId: empresaId,
            dreCategoria: pc.dreCategoria ? String(pc.dreCategoria) : null,
          },
          create: {
            id: String(pc.id),
            codigo: String(pc.codigo || ''),
            descricao: String(pc.descricao || ''),
            tipo: String(pc.tipo || 'receita'),
            nivel: Math.round(Number(pc.nivel)) || 1,
            parentId: null,
            ativo: pc.ativo === undefined ? true : Boolean(pc.ativo),
            empresaId: empresaId,
            dreCategoria: pc.dreCategoria ? String(pc.dreCategoria) : null,
          }
        });
        console.warn(`⚠️ PlanoConta ${pc.id}: salvo SEM parentId (FK inválido para parentId=${pc.parentId}). Ignorando hierarquia.`);
      } catch (fallbackErr) {
        console.error(`Erro no PlanoConta (ID: ${pc.id}), pulando este item e continuando o lote:`, fallbackErr);
      }
    }
  }
}

async function migratePortadores(portadores: any[]) {
  console.log(`Migrando ${portadores.length} portadores...`);
  
  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const p of portadores) {
    if (!p.id) continue;
    try {
      const empresaId = String(p.empresaId || 'empresa_default');
      
      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      await db.portador.upsert({
        where: { id: String(p.id) },
        update: {
          nome: String(p.nome || ''),
          tipo: String(p.tipo || 'conta_corrente'),
          banco: p.banco ? String(p.banco) : null,
          agencia: p.agencia ? String(p.agencia) : null,
          conta: p.conta ? String(p.conta) : null,
          saldoInicial: Number(p.saldoInicial || 0),
          saldoInicialData: p.saldoInicialData ? String(p.saldoInicialData) : null,
          ativo: p.ativo === undefined ? true : Boolean(p.ativo),
          empresaId: empresaId,
        },
        create: {
          id: String(p.id),
          nome: String(p.nome || ''),
          tipo: String(p.tipo || 'conta_corrente'),
          banco: p.banco ? String(p.banco) : null,
          agencia: p.agencia ? String(p.agencia) : null,
          conta: p.conta ? String(p.conta) : null,
          saldoInicial: Number(p.saldoInicial || 0),
          saldoInicialData: p.saldoInicialData ? String(p.saldoInicialData) : null,
          ativo: p.ativo === undefined ? true : Boolean(p.ativo),
          empresaId: empresaId,
        }
      });
    } catch (err) {
      console.error(`Erro no Portador (ID: ${p.id}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

async function migrateClientes(clientes: any[]) {
  console.log(`Migrando ${clientes.length} clientes...`);
  
  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const c of clientes) {
    if (!c.id) continue;
    try {
      const empresaId = String(c.empresaId || 'empresa_default');
      
      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      await db.cliente.upsert({
        where: { id: String(c.id) },
        update: {
          empresaId: empresaId,
          tipo: String(c.tipo || 'cliente'),
          nome: String(c.nome || ''),
          nomeFantasia: c.nomeFantasia ? String(c.nomeFantasia) : null,
          cpfCnpj: String(c.cpfCnpj || ''),
          email: c.email ? String(c.email) : null,
          telefone: c.telefone ? String(c.telefone) : null,
          celular: c.celular ? String(c.celular) : null,
          endereco: c.endereco ? String(c.endereco) : null,
          cidade: c.cidade ? String(c.cidade) : null,
          estado: c.estado ? String(c.estado) : null,
          cep: c.cep ? String(c.cep) : null,
          contato: c.contato ? String(c.contato) : null,
          observacao: c.observacao ? String(c.observacao) : null,
          limiteCredito: c.limiteCredito !== undefined ? Number(c.limiteCredito) : null,
          ativo: c.ativo === undefined ? true : Boolean(c.ativo),
        },
        create: {
          id: String(c.id),
          empresaId: empresaId,
          tipo: String(c.tipo || 'cliente'),
          nome: String(c.nome || ''),
          nomeFantasia: c.nomeFantasia ? String(c.nomeFantasia) : null,
          cpfCnpj: String(c.cpfCnpj || ''),
          email: c.email ? String(c.email) : null,
          telefone: c.telefone ? String(c.telefone) : null,
          celular: c.celular ? String(c.celular) : null,
          endereco: c.endereco ? String(c.endereco) : null,
          cidade: c.cidade ? String(c.cidade) : null,
          estado: c.estado ? String(c.estado) : null,
          cep: c.cep ? String(c.cep) : null,
          contato: c.contato ? String(c.contato) : null,
          observacao: c.observacao ? String(c.observacao) : null,
          limiteCredito: c.limiteCredito !== undefined ? Number(c.limiteCredito) : null,
          ativo: c.ativo === undefined ? true : Boolean(c.ativo),
        }
      });
    } catch (err) {
      console.error(`Erro no Cliente (ID: ${c.id}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

async function migrateLancamentos(lancamentos: any[]) {
  console.log(`Migrando ${lancamentos.length} lançamentos com cache de ID local...`);
  
  // Cache check for existing rows to reduce queries drastically
  const [
    existingEmpresas,
    existingPlanoContas,
    existingPortadores,
    existingUnidades,
    existingClientes
  ] = await Promise.all([
    db.empresa.findMany({ select: { id: true } }),
    db.planoConta.findMany({ select: { id: true } }),
    db.portador.findMany({ select: { id: true } }),
    db.unidade.findMany({ select: { id: true } }),
    db.cliente.findMany({ select: { id: true } })
  ]);

  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));
  const planoContaIdsSet = new Set(existingPlanoContas.map(pc => pc.id));
  const portadorIdsSet = new Set(existingPortadores.map(p => p.id));
  const unidadeIdsSet = new Set(existingUnidades.map(u => u.id));
  const clienteIdsSet = new Set(existingClientes.map(c => c.id));

  for (const l of lancamentos) {
    if (!l.id) continue;
    try {
      const empresaId = String(l.empresaId || 'empresa_default');
      const planoContaId = String(l.planoContaId || 'plano_default');
      const portadorId = String(l.portadorId || 'portador_default');

      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      if (!planoContaIdsSet.has(planoContaId)) {
        await db.planoConta.upsert({
          where: { id: planoContaId },
          update: {},
          create: {
            id: planoContaId,
            codigo: '999',
            descricao: 'Plano de Conta Auto-Criado',
            tipo: String(l.tipo || 'despesa'),
            nivel: 1,
            empresaId: empresaId,
            ativo: true
          }
        });
        planoContaIdsSet.add(planoContaId);
      }

      if (!portadorIdsSet.has(portadorId)) {
        await db.portador.upsert({
          where: { id: portadorId },
          update: {},
          create: {
            id: portadorId,
            nome: 'Portador Auto-Criado',
            tipo: 'outro',
            saldoInicial: 0,
            empresaId: empresaId,
            ativo: true
          }
        });
        portadorIdsSet.add(portadorId);
      }

      if (l.unidadeId && !unidadeIdsSet.has(l.unidadeId)) {
        await db.unidade.upsert({
          where: { id: String(l.unidadeId) },
          update: {},
          create: {
            id: String(l.unidadeId),
            condominioId: empresaId,
            identificacao: 'Unidade Auto-Criada',
            proprietario: 'Proprietário',
            email: 'contato@unidade.com',
            telefone: '0000000000',
            fracaoIdeal: 0
          }
        });
        unidadeIdsSet.add(l.unidadeId);
      }

      if (l.clienteId && !clienteIdsSet.has(l.clienteId)) {
        await db.cliente.upsert({
          where: { id: String(l.clienteId) },
          update: {},
          create: {
            id: String(l.clienteId),
            empresaId: empresaId,
            tipo: 'cliente',
            nome: 'Cliente Auto-Criado',
            cpfCnpj: '00000000000',
            ativo: true
          }
        });
        clienteIdsSet.add(l.clienteId);
      }

      const existing = await db.lancamento.findUnique({
        where: { id: String(l.id) }
      });

      await db.lancamento.upsert({
        where: { id: String(l.id) },
        update: {
          empresaId: empresaId,
          data: String(l.data || ''),
          descricao: String(l.descricao || ''),
          valor: Number(l.valor || 0),
          tipo: String(l.tipo || 'despesa'),
          planoContaId: planoContaId,
          portadorId: portadorId,
          status: String(l.status || 'previsto'),
          numeroDocumento: l.numeroDocumento ? String(l.numeroDocumento) : null,
          observacao: l.observacao ? String(l.observacao) : null,
          origem: String(l.origem || 'manual'),
          ofxId: l.ofxId ? String(l.ofxId) : null,
          unidadeId: l.unidadeId ? String(l.unidadeId) : null,
          clienteId: l.clienteId ? String(l.clienteId) : null,
          attachmentName: l.attachmentName ? String(l.attachmentName) : (existing?.attachmentName || null),
          attachmentData: l.attachmentData && l.attachmentData !== '__PRUNED_IN_LOCAL_STAGE__' ? String(l.attachmentData) : (existing?.attachmentData || null),
        },
        create: {
          id: String(l.id),
          empresaId: empresaId,
          data: String(l.data || ''),
          descricao: String(l.descricao || ''),
          valor: Number(l.valor || 0),
          tipo: String(l.tipo || 'despesa'),
          planoContaId: planoContaId,
          portadorId: portadorId,
          status: String(l.status || 'previsto'),
          numeroDocumento: l.numeroDocumento ? String(l.numeroDocumento) : null,
          observacao: l.observacao ? String(l.observacao) : null,
          origem: String(l.origem || 'manual'),
          ofxId: l.ofxId ? String(l.ofxId) : null,
          unidadeId: l.unidadeId ? String(l.unidadeId) : null,
          clienteId: l.clienteId ? String(l.clienteId) : null,
          attachmentName: l.attachmentName ? String(l.attachmentName) : null,
          attachmentData: l.attachmentData ? String(l.attachmentData) : null,
        }
      });

      if ((global as any).io) {
        const itemPayload = {
          id: String(l.id),
          empresaId: empresaId,
          data: String(l.data || ''),
          descricao: String(l.descricao || ''),
          valor: Number(l.valor || 0),
          tipo: String(l.tipo || 'despesa'),
          planoContaId: planoContaId,
          portadorId: portadorId,
          status: String(l.status || 'previsto'),
          numeroDocumento: l.numeroDocumento ? String(l.numeroDocumento) : null,
          observacao: l.observacao ? String(l.observacao) : null,
          origem: String(l.origem || 'manual'),
          ofxId: l.ofxId ? String(l.ofxId) : null,
          unidadeId: l.unidadeId ? String(l.unidadeId) : null,
          clienteId: l.clienteId ? String(l.clienteId) : null,
          attachmentName: l.attachmentName ? String(l.attachmentName) : null,
          createdAt: existing ? existing.createdAt.toISOString() : new Date().toISOString(),
        };

        if (!existing) {
          (global as any).io.emit('lancamento_criado', itemPayload);
        } else {
          const isUpdated = 
            existing.valor !== Number(l.valor) ||
            existing.descricao !== String(l.descricao) ||
            existing.data !== String(l.data) ||
            existing.planoContaId !== String(l.planoContaId) ||
            existing.portadorId !== String(l.portadorId) ||
            existing.status !== String(l.status);
          
          if (isUpdated) {
            (global as any).io.emit('lancamento_atualizado', itemPayload);
          }
        }
      }
    } catch (err) {
      // Não aborta o lote inteiro por causa de UM lançamento malformado — isso
      // fazia uma importação de 50 itens ser descartada por completo (e o
      // cliente re-sincronizar do zero, apagando localmente o que tinha sido
      // importado) quando só um item tinha um problema. Pula só o item ruim.
      console.error(`Erro no Lançamento (ID: ${l.id}), pulando este item e continuando o lote:`, err);
    }
  }
}

async function migrateEndividamentos(endividamentos: any[]) {
  console.log(`Migrando ${endividamentos.length} endividamentos...`);
  
  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const end of endividamentos) {
    if (!end.id) continue;
    try {
      const empresaId = String(end.empresaId || 'empresa_default');
      
      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      const currentEnd = await db.endividamento.upsert({
        where: { id: String(end.id) },
        update: {
          empresaId: empresaId,
          tipo: String(end.tipo || 'bancario'),
          banco: String(end.banco || ''),
          conta: String(end.conta || ''),
          contrato: String(end.contrato || ''),
          descricaoContrato: end.descricaoContrato ? String(end.descricaoContrato) : null,
          taxa: Number(end.taxa || 0),
          taxaTipo: end.taxaTipo ? String(end.taxaTipo) : null,
          indexador: String(end.indexador || ''),
          parcela: Math.round(Number(end.parcela)) || 0,
          parcelasFaltantes: Math.round(Number(end.parcelasFaltantes)) || 0,
          valorQuitacao: Number(end.valorQuitacao || 0),
          valorAPagar: Number(end.valorAPagar || 0),
          garantia: String(end.garantia || ''),
          pagamentoMes: Math.round(Number(end.pagamentoMes)) || 0,
        },
        create: {
          id: String(end.id),
          empresaId: empresaId,
          tipo: String(end.tipo || 'bancario'),
          banco: String(end.banco || ''),
          conta: String(end.conta || ''),
          contrato: String(end.contrato || ''),
          descricaoContrato: end.descricaoContrato ? String(end.descricaoContrato) : null,
          taxa: Number(end.taxa || 0),
          taxaTipo: end.taxaTipo ? String(end.taxaTipo) : null,
          indexador: String(end.indexador || ''),
          parcela: Math.round(Number(end.parcela)) || 0,
          parcelasFaltantes: Math.round(Number(end.parcelasFaltantes)) || 0,
          valorQuitacao: Number(end.valorQuitacao || 0),
          valorAPagar: Number(end.valorAPagar || 0),
          garantia: String(end.garantia || ''),
          pagamentoMes: Math.round(Number(end.pagamentoMes)) || 0,
        }
      });

      if (Array.isArray(end.pagamentos)) {
        await db.pagamentoEndividamento.deleteMany({
          where: { endividamentoId: currentEnd.id }
        });
        for (const pag of end.pagamentos) {
          await db.pagamentoEndividamento.create({
            data: {
              id: String(pag.id || crypto.randomUUID()),
              endividamentoId: currentEnd.id,
              data: String(pag.data || ''),
              valorTotal: Number(pag.valorTotal || 0),
              valorJuros: Number(pag.valorJuros || 0),
              valorAmortizacao: Number(pag.valorAmortizacao || 0),
            }
          });
        }
      }
    } catch (err) {
      console.error(`Erro no Endividamento (ID: ${end.id}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

async function migrateAtas(atas: any[]) {
  console.log(`Migrando ${atas.length} atas de atendimento...`);
  
  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const ata of atas) {
    if (!ata.id) continue;
    try {
      const empresaId = String(ata.empresaId || 'empresa_default');
      
      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      await db.ataAtendimento.upsert({
        where: { id: String(ata.id) },
        update: {
          empresaId: empresaId,
          consultorId: String(ata.consultorId || ''),
          data: String(ata.data || ''),
          titulo: String(ata.titulo || ''),
          conteudo: String(ata.conteudo || ''),
          participantes: String(ata.participantes || ''),
        },
        create: {
          id: String(ata.id),
          empresaId: empresaId,
          consultorId: String(ata.consultorId || ''),
          data: String(ata.data || ''),
          titulo: String(ata.titulo || ''),
          conteudo: String(ata.conteudo || ''),
          participantes: String(ata.participantes || ''),
        }
      });
    } catch (err) {
      console.error(`Erro na Ata (ID: ${ata.id}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

async function migrateIndicadores(indicadores: any[]) {
  console.log(`Migrando ${indicadores.length} indicadores mensais...`);
  
  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const ind of indicadores) {
    if (!ind.id) continue;
    try {
      const empresaId = String(ind.empresaId || 'empresa_default');
      
      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      await db.indicadorMensal.upsert({
        where: { id: String(ind.id) },
        update: {
          empresaId: empresaId,
          mes: String(ind.mes || ''),
          faturamento: Number(ind.faturamento || 0),
          compras: Number(ind.compras || 0),
          inadimplencia: Number(ind.inadimplencia || 0),
        },
        create: {
          id: String(ind.id),
          empresaId: empresaId,
          mes: String(ind.mes || ''),
          faturamento: Number(ind.faturamento || 0),
          compras: Number(ind.compras || 0),
          inadimplencia: Number(ind.inadimplencia || 0),
        }
      });
    } catch (err) {
      console.error(`Erro no Indicador (ID: ${ind.id}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

async function migrateOrcamentos(orcamentos: any[]) {
  console.log(`Migrando ${orcamentos.length} orçamentos mensais...`);
  
  const [existingEmpresas, existingPlanoContas] = await Promise.all([
    db.empresa.findMany({ select: { id: true } }),
    db.planoConta.findMany({ select: { id: true } })
  ]);
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));
  const planoContaIdsSet = new Set(existingPlanoContas.map(pc => pc.id));

  for (const orc of orcamentos) {
    if (!orc.id) continue;
    try {
      const empresaId = String(orc.empresaId || 'empresa_default');
      
      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      const currentOrc = await db.orcamentoMensal.upsert({
        where: { id: String(orc.id) },
        update: {
          empresaId: empresaId,
          mes: String(orc.mes || ''),
        },
        create: {
          id: String(orc.id),
          empresaId: empresaId,
          mes: String(orc.mes || ''),
        }
      });

      if (orc.categorias && typeof orc.categorias === 'object') {
        await db.orcamentoValor.deleteMany({
          where: { orcamentoId: currentOrc.id }
        });
        for (const [planoContaId, valor] of Object.entries(orc.categorias)) {
          if (!planoContaIdsSet.has(planoContaId)) {
            await db.planoConta.upsert({
              where: { id: planoContaId },
              update: {},
              create: {
                id: planoContaId,
                codigo: '999',
                descricao: 'Plano de Conta Auto-Criado',
                tipo: 'despesa',
                nivel: 1,
                empresaId: empresaId,
                ativo: true
              }
            });
            planoContaIdsSet.add(planoContaId);
          }

          await db.orcamentoValor.create({
            data: {
              id: crypto.randomUUID(),
              orcamentoId: currentOrc.id,
              planoContaId: planoContaId,
              valor: Number(valor || 0)
            }
          });
        }
      }
    } catch (err) {
      console.error(`Erro no Orçamento (ID: ${orc.id}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

async function migrateContasBalanco(contas: any[]) {
  console.log(`Migrando ${contas.length} contas do balanço patrimonial...`);

  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const c of contas) {
    if (!c.id) continue;
    try {
      const empresaId = String(c.empresaId || 'empresa_default');

      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      await db.contaBalanco.upsert({
        where: { id: String(c.id) },
        update: {
          empresaId: empresaId,
          grupo: String(c.grupo || 'ativo_circulante'),
          subgrupo: c.subgrupo ? String(c.subgrupo) : null,
          codigo: String(c.codigo || ''),
          descricao: String(c.descricao || ''),
          ordem: Math.round(Number(c.ordem)) || 0,
          ativo: c.ativo === undefined ? true : Boolean(c.ativo),
        },
        create: {
          id: String(c.id),
          empresaId: empresaId,
          grupo: String(c.grupo || 'ativo_circulante'),
          subgrupo: c.subgrupo ? String(c.subgrupo) : null,
          codigo: String(c.codigo || ''),
          descricao: String(c.descricao || ''),
          ordem: Math.round(Number(c.ordem)) || 0,
          ativo: c.ativo === undefined ? true : Boolean(c.ativo),
        }
      });
    } catch (err) {
      console.error(`Erro na Conta de Balanço (ID: ${c.id}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

async function migrateBalancosPatrimoniais(balancos: any[]) {
  console.log(`Migrando ${balancos.length} balanços patrimoniais...`);

  const [existingEmpresas, existingContasBalanco] = await Promise.all([
    db.empresa.findMany({ select: { id: true } }),
    db.contaBalanco.findMany({ select: { id: true } })
  ]);
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));
  const contaBalancoIdsSet = new Set(existingContasBalanco.map(c => c.id));

  for (const b of balancos) {
    if (!b.id) continue;
    try {
      const empresaId = String(b.empresaId || 'empresa_default');

      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      const currentBalanco = await db.balancoPatrimonial.upsert({
        where: { id: String(b.id) },
        update: {
          empresaId: empresaId,
          competencia: String(b.competencia || ''),
          observacao: b.observacao ? String(b.observacao) : null,
        },
        create: {
          id: String(b.id),
          empresaId: empresaId,
          competencia: String(b.competencia || ''),
          observacao: b.observacao ? String(b.observacao) : null,
        }
      });

      if (b.valores && typeof b.valores === 'object') {
        await db.balancoValor.deleteMany({
          where: { balancoId: currentBalanco.id }
        });
        for (const [contaBalancoId, valor] of Object.entries(b.valores)) {
          if (!contaBalancoIdsSet.has(contaBalancoId)) continue;

          await db.balancoValor.create({
            data: {
              id: crypto.randomUUID(),
              balancoId: currentBalanco.id,
              contaBalancoId: contaBalancoId,
              valor: Number(valor || 0)
            }
          });
        }
      }
    } catch (err) {
      console.error(`Erro no Balanço Patrimonial (ID: ${b.id}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

async function migrateDiagnosticos360(diagnosticos: any[]) {
  console.log(`Migrando ${diagnosticos.length} diagnósticos 360º...`);

  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const d of diagnosticos) {
    if (!d.id) continue;
    try {
      const empresaId = String(d.empresaId || 'empresa_default');

      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      await db.diagnostico360.upsert({
        where: { id: String(d.id) },
        update: {
          empresaId: empresaId,
          data: String(d.data || ''),
          consultor: String(d.consultor || ''),
          respondente: d.respondente || {},
          respostas: d.respostas || {},
          anotacoes: d.anotacoes || {},
          parecer: String(d.parecer || ''),
        },
        create: {
          id: String(d.id),
          empresaId: empresaId,
          data: String(d.data || ''),
          consultor: String(d.consultor || ''),
          respondente: d.respondente || {},
          respostas: d.respostas || {},
          anotacoes: d.anotacoes || {},
          parecer: String(d.parecer || ''),
        }
      });
    } catch (err) {
      console.error(`Erro no Diagnóstico 360º (ID: ${d.id}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

async function migrateCurvaAbcConfig(configs: any[]) {
  console.log(`Migrando ${configs.length} configurações de Curva ABC...`);

  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const c of configs) {
    if (!c.empresaId) continue;
    try {
      const empresaId = String(c.empresaId);

      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      await db.curvaAbcConfig.upsert({
        where: { empresaId },
        update: {
          percentualA: Number(c.percentualA ?? 80),
          percentualB: Number(c.percentualB ?? 95),
        },
        create: {
          id: crypto.randomUUID(),
          empresaId,
          percentualA: Number(c.percentualA ?? 80),
          percentualB: Number(c.percentualB ?? 95),
        }
      });
    } catch (err) {
      console.error(`Erro na Configuração de Curva ABC (Empresa: ${c.empresaId}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

async function migrateCurvasAbc(curvas: any[]) {
  console.log(`Migrando ${curvas.length} curvas ABC...`);

  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const cv of curvas) {
    if (!cv.id) continue;
    try {
      const empresaId = String(cv.empresaId || 'empresa_default');

      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      const currentCurva = await db.curvaAbc.upsert({
        where: { id: String(cv.id) },
        update: {
          empresaId: empresaId,
          nome: String(cv.nome || ''),
          dataImportacao: String(cv.dataImportacao || ''),
          percentualA: Number(cv.percentualA ?? 80),
          percentualB: Number(cv.percentualB ?? 95),
        },
        create: {
          id: String(cv.id),
          empresaId: empresaId,
          nome: String(cv.nome || ''),
          dataImportacao: String(cv.dataImportacao || ''),
          percentualA: Number(cv.percentualA ?? 80),
          percentualB: Number(cv.percentualB ?? 95),
        }
      });

      if (Array.isArray(cv.itens)) {
        await db.curvaAbcItem.deleteMany({
          where: { curvaId: currentCurva.id }
        });
        for (const item of cv.itens) {
          await db.curvaAbcItem.create({
            data: {
              id: String(item.id || crypto.randomUUID()),
              curvaId: currentCurva.id,
              nome: String(item.nome || ''),
              valorFaturado: Number(item.valorFaturado || 0),
              percentualIndividual: Number(item.percentualIndividual || 0),
              percentualAcumulado: Number(item.percentualAcumulado || 0),
              classificacao: String(item.classificacao || 'C'),
              ordem: Math.round(Number(item.ordem)) || 0,
            }
          });
        }
      }
    } catch (err) {
      console.error(`Erro na Curva ABC (ID: ${cv.id}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

async function migrateNfse(nfse: any[]) {
  console.log(`Migrando ${nfse.length} notas fiscais (NFS-e)...`);
  
  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const n of nfse) {
    if (!n.id) continue;
    try {
      const empresaId = String(n.empresaId || 'empresa_default');
      
      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      await db.nfsE.upsert({
        where: { id: String(n.id) },
        update: {
          empresaId: empresaId,
          numero: String(n.numero || ''),
          serie: String(n.serie || '1'),
          codigoVerificacao: n.codigoVerificacao ? String(n.codigoVerificacao) : null,
          status: String(n.status || 'rascunho'),
          motivoCancelamento: n.motivoCancelamento ? String(n.motivoCancelamento) : null,
          prestadorCnpj: String(n.prestadorCnpj || ''),
          prestadorRazaoSocial: String(n.prestadorRazaoSocial || ''),
          prestadorInscricaoMunicipal: n.prestadorInscricaoMunicipal ? String(n.prestadorInscricaoMunicipal) : null,
          prestadorEndereco: n.prestadorEndereco ? String(n.prestadorEndereco) : null,
          prestadorCidade: n.prestadorCidade ? String(n.prestadorCidade) : null,
          prestadorUf: n.prestadorUf ? String(n.prestadorUf) : null,
          prestadorCep: n.prestadorCep ? String(n.prestadorCep) : null,
          clienteId: n.clienteId ? String(n.clienteId) : null,
          tomadorCnpjCpf: String(n.tomadorCnpjCpf || ''),
          tomadorRazaoSocial: String(n.tomadorRazaoSocial || ''),
          tomadorEmail: n.tomadorEmail ? String(n.tomadorEmail) : null,
          tomadorEndereco: n.tomadorEndereco ? String(n.tomadorEndereco) : null,
          tomadorCidade: n.tomadorCidade ? String(n.tomadorCidade) : null,
          tomadorUf: n.tomadorUf ? String(n.tomadorUf) : null,
          tomadorCep: n.tomadorCep ? String(n.tomadorCep) : null,
          tomadorInscricaoMunicipal: n.tomadorInscricaoMunicipal ? String(n.tomadorInscricaoMunicipal) : null,
          dataEmissao: String(n.dataEmissao || ''),
          dataCompetencia: String(n.dataCompetencia || ''),
          codigoServico: String(n.codigoServico || ''),
          cnae: n.cnae ? String(n.cnae) : null,
          discriminacao: String(n.discriminacao || ''),
          municipioPrestacao: n.municipioPrestacao ? String(n.municipioPrestacao) : null,
          valorServicos: Number(n.valorServicos || 0),
          valorDeducoes: Number(n.valorDeducoes || 0),
          valorPis: Number(n.valorPis || 0),
          valorCofins: Number(n.valorCofins || 0),
          valorInss: Number(n.valorInss || 0),
          valorIr: Number(n.valorIr || 0),
          valorCsll: Number(n.valorCsll || 0),
          issRetido: Boolean(n.issRetido),
          valorIss: Number(n.valorIss || 0),
          aliquotaIss: Number(n.aliquotaIss || 0),
          valorBaseCalculo: Number(n.valorBaseCalculo || 0),
          valorLiquido: Number(n.valorLiquido || 0),
          lancamentoId: n.lancamentoId ? String(n.lancamentoId) : null,
        },
        create: {
          id: String(n.id),
          empresaId: empresaId,
          numero: String(n.numero || ''),
          serie: String(n.serie || '1'),
          codigoVerificacao: n.codigoVerificacao ? String(n.codigoVerificacao) : null,
          status: String(n.status || 'rascunho'),
          motivoCancelamento: n.motivoCancelamento ? String(n.motivoCancelamento) : null,
          prestadorCnpj: String(n.prestadorCnpj || ''),
          prestadorRazaoSocial: String(n.prestadorRazaoSocial || ''),
          prestadorInscricaoMunicipal: n.prestadorInscricaoMunicipal ? String(n.prestadorInscricaoMunicipal) : null,
          prestadorEndereco: n.prestadorEndereco ? String(n.prestadorEndereco) : null,
          prestadorCidade: n.prestadorCidade ? String(n.prestadorCidade) : null,
          prestadorUf: n.prestadorUf ? String(n.prestadorUf) : null,
          prestadorCep: n.prestadorCep ? String(n.prestadorCep) : null,
          clienteId: n.clienteId ? String(n.clienteId) : null,
          tomadorCnpjCpf: String(n.tomadorCnpjCpf || ''),
          tomadorRazaoSocial: String(n.tomadorRazaoSocial || ''),
          tomadorEmail: n.tomadorEmail ? String(n.tomadorEmail) : null,
          tomadorEndereco: n.tomadorEndereco ? String(n.tomadorEndereco) : null,
          tomadorCidade: n.tomadorCidade ? String(n.tomadorCidade) : null,
          tomadorUf: n.tomadorUf ? String(n.tomadorUf) : null,
          tomadorCep: n.tomadorCep ? String(n.tomadorCep) : null,
          tomadorInscricaoMunicipal: n.tomadorInscricaoMunicipal ? String(n.tomadorInscricaoMunicipal) : null,
          dataEmissao: String(n.dataEmissao || ''),
          dataCompetencia: String(n.dataCompetencia || ''),
          codigoServico: String(n.codigoServico || ''),
          cnae: n.cnae ? String(n.cnae) : null,
          discriminacao: String(n.discriminacao || ''),
          municipioPrestacao: n.municipioPrestacao ? String(n.municipioPrestacao) : null,
          valorServicos: Number(n.valorServicos || 0),
          valorDeducoes: Number(n.valorDeducoes || 0),
          valorPis: Number(n.valorPis || 0),
          valorCofins: Number(n.valorCofins || 0),
          valorInss: Number(n.valorInss || 0),
          valorIr: Number(n.valorIr || 0),
          valorCsll: Number(n.valorCsll || 0),
          issRetido: Boolean(n.issRetido),
          valorIss: Number(n.valorIss || 0),
          aliquotaIss: Number(n.aliquotaIss || 0),
          valorBaseCalculo: Number(n.valorBaseCalculo || 0),
          valorLiquido: Number(n.valorLiquido || 0),
          lancamentoId: n.lancamentoId ? String(n.lancamentoId) : null,
        }
      });
    } catch (err) {
      console.error(`Erro na NFS-e (ID: ${n.id}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

async function migrateSituacaoFiscal(situacaoFiscal: any[]) {
  console.log(`Migrando ${situacaoFiscal.length} situações fiscais...`);
  
  const existingEmpresas = await db.empresa.findMany({ select: { id: true } });
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));

  for (const sf of situacaoFiscal) {
    if (!sf.id) continue;
    try {
      const empresaId = String(sf.empresaId || 'empresa_default');
      
      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      await db.situacaoFiscal.upsert({
        where: { id: String(sf.id) },
        update: {
          empresaId: empresaId,
          dataVerificacao: String(sf.dataVerificacao || ''),
          status: String(sf.status || 'regular'),
          observacoes: String(sf.observacoes || ''),
        },
        create: {
          id: String(sf.id),
          empresaId: empresaId,
          dataVerificacao: String(sf.dataVerificacao || ''),
          status: String(sf.status || 'regular'),
          observacoes: String(sf.observacoes || ''),
        }
      });
    } catch (err) {
      console.error(`Erro na Situação Fiscal (ID: ${sf.id}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

async function migrateTransactionPatterns(patterns: any[]) {
  console.log(`Migrando ${patterns.length} padrões de transação...`);
  
  const [existingEmpresas, existingPlanoContas] = await Promise.all([
    db.empresa.findMany({ select: { id: true } }),
    db.planoConta.findMany({ select: { id: true } })
  ]);
  const empresaIdsSet = new Set(existingEmpresas.map(e => e.id));
  const planoContaIdsSet = new Set(existingPlanoContas.map(pc => pc.id));

  for (const tp of patterns) {
    if (!tp.id) continue;
    try {
      const empresaId = String(tp.empresaId || 'empresa_default');
      const categoryId = String(tp.categoryId || 'plano_default');

      if (!empresaIdsSet.has(empresaId)) {
        await db.empresa.upsert({
          where: { id: empresaId },
          update: {},
          create: {
            id: empresaId,
            razaoSocial: 'Empresa Auto-Criada',
            nomeFantasia: 'Empresa Auto-Criada',
            cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
            responsavel: 'Responsável',
            email: 'contato@empresa.com',
            telefone: '0000000000',
          }
        });
        empresaIdsSet.add(empresaId);
      }

      if (!planoContaIdsSet.has(categoryId)) {
        await db.planoConta.upsert({
          where: { id: categoryId },
          update: {},
          create: {
            id: categoryId,
            codigo: '999',
            descricao: 'Plano de Conta Auto-Criado',
            tipo: 'despesa',
            nivel: 1,
            empresaId: empresaId,
            ativo: true
          }
        });
        planoContaIdsSet.add(categoryId);
      }

      await db.transactionPattern.upsert({
        where: { id: String(tp.id) },
        update: {
          empresaId: empresaId,
          pattern: String(tp.pattern || ''),
          categoryId: categoryId,
        },
        create: {
          id: String(tp.id),
          empresaId: empresaId,
          pattern: String(tp.pattern || ''),
          categoryId: categoryId,
        }
      });
    } catch (err) {
      console.error(`Erro no Padrão de Transação (ID: ${tp.id}), pulando este item e continuando o lote:`, err);
      continue;
    }
  }
}

// ============================================================
// REGISTRO ÚNICO: migrator (POST) e query (GET) de cada coleção
// ============================================================
// Antes disso existiam DUAS listas de dispatch (switch-case do POST em lote +
// if-chain do POST monolítico) e uma construção manual de array posicional
// pro GET (destructuring + Promise.all + objeto, três lugares que precisavam
// concordar na mesma ordem). Bastava atualizar um lugar e esquecer outro pra
// uma coleção parar de sincronizar silenciosamente — foi o que aconteceu 5
// vezes. Agora é um Record por chave, usado igual nos dois métodos.

type CollectionMigrator = (data: any[]) => Promise<void>;

const MIGRATORS: Record<string, CollectionMigrator> = {
  cf_empresas: migrateEmpresas,
  cf_users: migrateUsers,
  cf_unidades: migrateUnidades,
  cf_plano_contas: migratePlanoContas,
  cf_portadores: migratePortadores,
  cf_clientes: migrateClientes,
  cf_lancamentos: migrateLancamentos,
  cf_endividamentos: migrateEndividamentos,
  cf_atas: migrateAtas,
  cf_indicadores: migrateIndicadores,
  cf_orcamentos: migrateOrcamentos,
  cf_contas_balanco: migrateContasBalanco,
  cf_balancos_patrimoniais: migrateBalancosPatrimoniais,
  cf_diagnosticos_360: migrateDiagnosticos360,
  cf_curva_abc_config: migrateCurvaAbcConfig,
  cf_curvas_abc: migrateCurvasAbc,
  cf_nfse: migrateNfse,
  cf_situacao_fiscal: migrateSituacaoFiscal,
  cf_transaction_patterns: migrateTransactionPatterns,
  cf_atividades_log: migrateAtividades,
  cf_audit_logs: migrateAuditLogs,
  cf_centros_custo: migrateCentrosCusto,
  cf_agenda_semanal: migrateAgendaTasks,
  cf_inteligencia_docs: migrateInteligenciaDocs,
};

type CollectionQuery = () => Promise<any>;

const QUERIES: Record<string, CollectionQuery> = {
  cf_empresas: () => db.empresa.findMany({
    select: {
      id: true,
      razaoSocial: true,
      nomeFantasia: true,
      cnpj: true,
      responsavel: true,
      email: true,
      telefone: true,
      atividade: true,
      tipo: true,
      taxaMensalPadrao: true,
      fundoReservaPct: true,
      dataInicioContrato: true,
      grupoEconomico: true,
      receitaMensalEstimada: true,
      comprasMensalEstimada: true,
      logoData: true,
      bancoBoleto: true,
      createdAt: true,
      allowedRoutes: true,
      politicaReceberName: true,
      politicaComprasName: true,
      politicaCobrancaName: true,
    }
  }),
  cf_users: () => db.user.findMany(),
  cf_unidades: () => db.unidade.findMany(),
  cf_plano_contas: () => db.planoConta.findMany(),
  cf_portadores: () => db.portador.findMany(),
  cf_clientes: () => db.cliente.findMany(),
  cf_lancamentos: () => db.lancamento.findMany({
    select: {
      id: true,
      empresaId: true,
      data: true,
      descricao: true,
      valor: true,
      tipo: true,
      planoContaId: true,
      portadorId: true,
      status: true,
      numeroDocumento: true,
      observacao: true,
      origem: true,
      ofxId: true,
      unidadeId: true,
      clienteId: true,
      attachmentName: true,
      createdAt: true,
    },
    orderBy: [
      { data: 'desc' },
      { createdAt: 'desc' }
    ]
  }),
  cf_endividamentos: async () => {
    const raw = await db.endividamento.findMany({ include: { pagamentos: true } });
    return raw.map(e => ({
      id: e.id,
      empresaId: e.empresaId,
      tipo: e.tipo,
      banco: e.banco,
      conta: e.conta,
      contrato: e.contrato,
      descricaoContrato: e.descricaoContrato,
      taxa: e.taxa,
      taxaTipo: e.taxaTipo,
      indexador: e.indexador,
      parcela: e.parcela,
      parcelasFaltantes: e.parcelasFaltantes,
      valorQuitacao: e.valorQuitacao,
      valorAPagar: e.valorAPagar,
      garantia: e.garantia,
      pagamentoMes: e.pagamentoMes,
      pagamentos: e.pagamentos.map(p => ({
        id: p.id,
        data: p.data,
        valorTotal: p.valorTotal,
        valorJuros: p.valorJuros,
        valorAmortizacao: p.valorAmortizacao
      }))
    }));
  },
  cf_atas: () => db.ataAtendimento.findMany(),
  cf_indicadores: () => db.indicadorMensal.findMany(),
  cf_orcamentos: async () => {
    const raw = await db.orcamentoMensal.findMany({ include: { valores: true } });
    return raw.map(orc => {
      const categorias: Record<string, number> = {};
      orc.valores.forEach(v => { categorias[v.planoContaId] = v.valor; });
      return { id: orc.id, empresaId: orc.empresaId, mes: orc.mes, categorias };
    });
  },
  cf_contas_balanco: () => db.contaBalanco.findMany(),
  cf_balancos_patrimoniais: async () => {
    const raw = await db.balancoPatrimonial.findMany({ include: { valores: true } });
    return raw.map(b => {
      const valores: Record<string, number> = {};
      b.valores.forEach(v => { valores[v.contaBalancoId] = v.valor; });
      return { id: b.id, empresaId: b.empresaId, competencia: b.competencia, observacao: b.observacao, valores };
    });
  },
  cf_diagnosticos_360: () => db.diagnostico360.findMany(),
  cf_curva_abc_config: () => db.curvaAbcConfig.findMany(),
  cf_curvas_abc: async () => {
    const raw = await db.curvaAbc.findMany({ include: { itens: true } });
    return raw.map(cv => ({
      id: cv.id,
      empresaId: cv.empresaId,
      nome: cv.nome,
      dataImportacao: cv.dataImportacao,
      percentualA: cv.percentualA,
      percentualB: cv.percentualB,
      createdAt: cv.createdAt.toISOString(),
      itens: cv.itens
        .slice()
        .sort((a, b) => a.ordem - b.ordem)
        .map(i => ({
          id: i.id,
          nome: i.nome,
          valorFaturado: i.valorFaturado,
          percentualIndividual: i.percentualIndividual,
          percentualAcumulado: i.percentualAcumulado,
          classificacao: i.classificacao,
          ordem: i.ordem,
        }))
    }));
  },
  cf_nfse: () => db.nfsE.findMany(),
  cf_situacao_fiscal: () => db.situacaoFiscal.findMany(),
  cf_transaction_patterns: () => db.transactionPattern.findMany(),
  cf_atividades_log: async () => {
    const raw = await db.atividade.findMany();
    return raw.map(a => ({
      ...a,
      localizacao: (a.lat && a.lng) ? { lat: a.lat, lng: a.lng } : null
    }));
  },
  cf_audit_logs: () => db.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 1000 }),
  cf_centros_custo: () => db.centroCusto.findMany(),
  cf_agenda_semanal: () => db.agendaTask.findMany(),
  cf_inteligencia_docs: () => db.inteligenciaDoc.findMany(),
};

// Checagem de consistência em tempo de execução: se uma coleção for adicionada
// no registro central (lib/sync-registry.ts) e faltar o migrator/query
// correspondente aqui, isso aparece BEM alto nos logs do servidor assim que a
// rota carrega — em vez de virar um bug invisível por meses.
for (const key of SYNC_COLLECTION_KEYS) {
  if (!MIGRATORS[key]) console.error(`🚨 [sync-registry] Coleção "${key}" está no registro mas não tem migrator implementado em app/api/migrate-backup/route.ts!`);
  if (!QUERIES[key]) console.error(`🚨 [sync-registry] Coleção "${key}" está no registro mas não tem query implementada em app/api/migrate-backup/route.ts!`);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedCollection = searchParams.get('collection');

    if (requestedCollection) {
      const query = QUERIES[requestedCollection];
      if (!query) {
        return NextResponse.json({ error: `Coleção desconhecida: ${requestedCollection}` }, { status: 400 });
      }
      const collectionData = await query();
      return NextResponse.json({
        version: '7',
        isPartial: true,
        timestamp: new Date().toISOString(),
        data: { [requestedCollection]: collectionData }
      });
    }

    // Sem "collection" na query string: busca tudo de uma vez (usado no sync
    // inicial ao carregar o site e na inicialização de banco vazio).
    const entries = Object.entries(QUERIES);
    const results = await Promise.all(entries.map(([, fn]) => fn()));
    const backupData = Object.fromEntries(entries.map(([key], i) => [key, results[i]]));

    return NextResponse.json({
      version: '7',
      timestamp: new Date().toISOString(),
      data: backupData
    });
  } catch (error) {
    console.error('Erro ao buscar backup do PostgreSQL:', error);
    return NextResponse.json({ error: (error as Error).message || 'Erro ao carregar dados' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const collection = body.collection;
    const data = body.data;

    if (!data) {
      return NextResponse.json({ error: 'Nenhum dado fornecido' }, { status: 400 });
    }

    if (collection === 'cf_deleted_records') {
      console.log('Processando exclusões: ' + data.length + ' registros');
      for (const record of data) {
        if (!record.id || !record.collection) continue;
        try {
          switch(record.collection) {
            case 'cf_empresas': await db.empresa.deleteMany({ where: { id: record.id } }); break;
            case 'cf_users': await db.user.deleteMany({ where: { id: record.id } }); break;
            case 'cf_plano_contas': await db.planoConta.deleteMany({ where: { id: record.id } }); break;
            case 'cf_portadores': await db.portador.deleteMany({ where: { id: record.id } }); break;
            case 'cf_clientes': await db.cliente.deleteMany({ where: { id: record.id } }); break;
            case 'cf_lancamentos': await db.lancamento.deleteMany({ where: { id: record.id } }); break;
            case 'cf_endividamentos': await db.endividamento.deleteMany({ where: { id: record.id } }); break;
            case 'cf_atas': await db.ataAtendimento.deleteMany({ where: { id: record.id } }); break;
            case 'cf_indicadores': await db.indicadorMensal.deleteMany({ where: { id: record.id } }); break;
            case 'cf_orcamentos': await db.orcamentoMensal.deleteMany({ where: { id: record.id } }); break;
            case 'cf_nfse': await db.nfsE.deleteMany({ where: { id: record.id } }); break;
            case 'cf_situacao_fiscal': await db.situacaoFiscal.deleteMany({ where: { id: record.id } }); break;
            case 'cf_transaction_patterns': await db.transactionPattern.deleteMany({ where: { id: record.id } }); break;
            case 'cf_atividades_log': await db.atividade.deleteMany({ where: { id: record.id } }); break;
            case 'cf_audit_logs': await db.auditLog.deleteMany({ where: { id: record.id } }); break;
            case 'cf_centros_custo': await db.centroCusto.deleteMany({ where: { id: record.id } }); break;
            case 'cf_agenda_semanal': await db.agendaTask.deleteMany({ where: { id: record.id } }); break;
            case 'cf_inteligencia_docs': await db.inteligenciaDoc.deleteMany({ where: { id: record.id } }); break;
            case 'cf_unidades': await db.unidade.deleteMany({ where: { id: record.id } }); break;
          }
        } catch(e) {
          console.error('Falha ao excluir ' + record.id, e);
        }
      }
      return NextResponse.json({ success: true });
    }

    if (collection) {
      console.log(`[Chunked Migration] Iniciando migração da coleção: ${collection}...`);

      const migrator = MIGRATORS[collection];
      if (!migrator) {
        return NextResponse.json({ error: `Coleção desconhecida para migração: ${collection}` }, { status: 400 });
      }
      if (Array.isArray(data)) await migrator(data);

      console.log(`[Chunked Migration] ✅ Sincronização da coleção ${collection} concluída com sucesso.`);

      // Propaga a atualização da coleção via WebSocket para todos os clientes conectados
      // ATENÇÃO: Desabilitado durante importação/chunking para evitar sobrecarga de memória no banco de dados e OOM timeouts no Vercel (fetching completo da coleção após cada lote de 25 é muito pesado)
      if ((global as any).io) {
        try {
            console.log(`🔌 WebSocket: Migração da coleção ${collection} efetuada de forma silenciosa e performática (sem broadcast massivo).`);
            // Os clientes têm sistema próprio de Polling para verificar atualizações, então não necessita broadcast de toda a tabela.
        } catch (wsErr) {
          console.error(`Erro no processamento WebSocket silencioso de ${collection}:`, wsErr);
        }
      }

      return NextResponse.json({ success: true });
    } else {
      console.log('Iniciando migração de backup (monolítico) para o PostgreSQL...');

      for (const [key, migrator] of Object.entries(MIGRATORS)) {
        if (Array.isArray(data[key])) await migrator(data[key]);
      }

      console.log('✅ Migração de backup (monolítico) concluída com sucesso!');
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('Erro na migração:', error);
    return NextResponse.json({ error: (error as Error).message || 'Erro desconhecido' }, { status: 500 });
  }
}
