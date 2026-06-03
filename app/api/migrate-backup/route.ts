import { NextResponse } from 'next/server';
import db from '../../../lib/prisma';
import crypto from 'crypto';

async function migrateEmpresas(empresas: any[]) {
  console.log(`Migrando ${empresas.length} empresas...`);
  for (const e of empresas) {
    if (!e.id) continue;
    try {
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
          logoData: e.logoData ? String(e.logoData) : null,
          bancoBoleto: String(e.bancoBoleto || 'nenhum'),
          allowedRoutes: Array.isArray(e.allowedRoutes) ? e.allowedRoutes.map(String) : [],
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
        }
      });
    } catch (err) {
      console.error('Erro na Empresa:', e, err);
      throw new Error(`Erro na Empresa (ID: ${e.id}): ${(err as Error).message}`);
    }
  }
}

async function migrateUsers(users: any[]) {
  console.log(`Migrando ${users.length} usuários...`);
  for (const u of users) {
    if (!u.email) continue;
    try {
      await db.user.upsert({
        where: { email: String(u.email) },
        update: {
          name: String(u.name || ''),
          password: String(u.password || ''),
          role: String(u.role || 'cliente'),
          empresaIds: Array.isArray(u.empresaIds) ? u.empresaIds.map(String) : [],
          avatarData: u.avatarData ? String(u.avatarData) : null,
          receberEmailDiario: Boolean(u.receberEmailDiario),
          phone: u.phone ? String(u.phone) : null,
          allowedRoutes: Array.isArray(u.allowedRoutes) ? u.allowedRoutes.map(String) : [],
        },
        create: {
          id: String(u.id || crypto.randomUUID()),
          name: String(u.name || ''),
          email: String(u.email),
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
      console.error('Erro no Usuário:', u, err);
      throw new Error(`Erro no Usuário (Email: ${u.email}): ${(err as Error).message}`);
    }
  }
}

async function migrateUnidades(unidades: any[]) {
  console.log(`Migrando ${unidades.length} unidades...`);
  for (const uni of unidades) {
    if (!uni.id) continue;
    try {
      const condominioId = String(uni.condominioId || 'condo_default');
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
      console.error('Erro na Unidade:', uni, err);
      throw new Error(`Erro na Unidade (ID: ${uni.id}): ${(err as Error).message}`);
    }
  }
}

async function migratePlanoContas(planoContas: any[]) {
  console.log(`Migrando ${planoContas.length} planos de contas (Passo 1)...`);
  for (const pc of planoContas) {
    if (!pc.id) continue;
    try {
      const empresaId = String(pc.empresaId || 'empresa_default');
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
    } catch (err) {
      console.error('Erro no PlanoConta (Passo 1):', pc, err);
      throw new Error(`Erro no PlanoConta (ID: ${pc.id}): ${(err as Error).message}`);
    }
  }

  console.log('Atualizando relações hierárquicas do plano de contas (Passo 2)...');
  for (const pc of planoContas) {
    if (pc.id && pc.parentId) {
      try {
        await db.planoConta.update({
          where: { id: String(pc.id) },
          data: { parentId: String(pc.parentId) }
        });
      } catch (err) {
        console.error('Erro no PlanoConta (Passo 2 - parentId):', pc, err);
      }
    }
  }
}

async function migratePortadores(portadores: any[]) {
  console.log(`Migrando ${portadores.length} portadores...`);
  for (const p of portadores) {
    if (!p.id) continue;
    try {
      const empresaId = String(p.empresaId || 'empresa_default');
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
      console.error('Erro no Portador:', p, err);
      throw new Error(`Erro no Portador (ID: ${p.id}): ${(err as Error).message}`);
    }
  }
}

async function migrateClientes(clientes: any[]) {
  console.log(`Migrando ${clientes.length} clientes...`);
  for (const c of clientes) {
    if (!c.id) continue;
    try {
      const empresaId = String(c.empresaId || 'empresa_default');
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
      console.error('Erro no Cliente:', c, err);
      throw new Error(`Erro no Cliente (ID: ${c.id}): ${(err as Error).message}`);
    }
  }
}

async function migrateLancamentos(lancamentos: any[]) {
  console.log(`Migrando ${lancamentos.length} lançamentos...`);
  for (const l of lancamentos) {
    if (!l.id) continue;
    try {
      const empresaId = String(l.empresaId || 'empresa_default');
      const planoContaId = String(l.planoContaId || 'plano_default');
      const portadorId = String(l.portadorId || 'portador_default');

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

      if (l.unidadeId) {
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
      }

      if (l.clienteId) {
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
      }

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
          attachmentName: l.attachmentName ? String(l.attachmentName) : null,
          attachmentData: l.attachmentData ? String(l.attachmentData) : null,
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
    } catch (err) {
      console.error('Erro no Lançamento:', l, err);
      throw new Error(`Erro no Lançamento (ID: ${l.id}): ${(err as Error).message}`);
    }
  }
}

async function migrateEndividamentos(endividamentos: any[]) {
  console.log(`Migrando ${endividamentos.length} endividamentos...`);
  for (const end of endividamentos) {
    if (!end.id) continue;
    try {
      const empresaId = String(end.empresaId || 'empresa_default');
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
      console.error('Erro no Endividamento:', end, err);
      throw new Error(`Erro no Endividamento (ID: ${end.id}): ${(err as Error).message}`);
    }
  }
}

async function migrateAtas(atas: any[]) {
  console.log(`Migrando ${atas.length} atas de atendimento...`);
  for (const ata of atas) {
    if (!ata.id) continue;
    try {
      const empresaId = String(ata.empresaId || 'empresa_default');
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
      console.error('Erro na Ata:', ata, err);
      throw new Error(`Erro na Ata (ID: ${ata.id}): ${(err as Error).message}`);
    }
  }
}

async function migrateIndicadores(indicadores: any[]) {
  console.log(`Migrando ${indicadores.length} indicadores mensais...`);
  for (const ind of indicadores) {
    if (!ind.id) continue;
    try {
      const empresaId = String(ind.empresaId || 'empresa_default');
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
      console.error('Erro no Indicador:', ind, err);
      throw new Error(`Erro no Indicador (ID: ${ind.id}): ${(err as Error).message}`);
    }
  }
}

async function migrateOrcamentos(orcamentos: any[]) {
  console.log(`Migrando ${orcamentos.length} orçamentos mensais...`);
  for (const orc of orcamentos) {
    if (!orc.id) continue;
    try {
      const empresaId = String(orc.empresaId || 'empresa_default');
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
      console.error('Erro no Orçamento:', orc, err);
      throw new Error(`Erro no Orçamento (ID: ${orc.id}): ${(err as Error).message}`);
    }
  }
}

async function migrateNfse(nfse: any[]) {
  console.log(`Migrando ${nfse.length} notas fiscais (NFS-e)...`);
  for (const n of nfse) {
    if (!n.id) continue;
    try {
      const empresaId = String(n.empresaId || 'empresa_default');
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
      console.error('Erro na NFS-e:', n, err);
      throw new Error(`Erro na NFS-e (ID: ${n.id}): ${(err as Error).message}`);
    }
  }
}

async function migrateSituacaoFiscal(situacaoFiscal: any[]) {
  console.log(`Migrando ${situacaoFiscal.length} situações fiscais...`);
  for (const sf of situacaoFiscal) {
    if (!sf.id) continue;
    try {
      const empresaId = String(sf.empresaId || 'empresa_default');
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
      console.error('Erro na Situação Fiscal:', sf, err);
      throw new Error(`Erro na Situação Fiscal (ID: ${sf.id}): ${(err as Error).message}`);
    }
  }
}

async function migrateTransactionPatterns(patterns: any[]) {
  console.log(`Migrando ${patterns.length} padrões de transação...`);
  for (const tp of patterns) {
    if (!tp.id) continue;
    try {
      const empresaId = String(tp.empresaId || 'empresa_default');
      const categoryId = String(tp.categoryId || 'plano_default');

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
      console.error('Erro no Padrão de Transação:', tp, err);
      throw new Error(`Erro no Padrão de Transação (ID: ${tp.id}): ${(err as Error).message}`);
    }
  }
}

export async function GET() {
  try {
    const cf_empresas = await db.empresa.findMany();
    const cf_users = await db.user.findMany();
    const cf_unidades = await db.unidade.findMany();
    const cf_plano_contas = await db.planoConta.findMany();
    const cf_portadores = await db.portador.findMany();
    const cf_clientes = await db.cliente.findMany();
    const cf_lancamentos = await db.lancamento.findMany();
    const cf_endividamentosRaw = await db.endividamento.findMany({
      include: { pagamentos: true }
    });
    const cf_atas = await db.ataAtendimento.findMany();
    const cf_indicadores = await db.indicadorMensal.findMany();
    const cf_orcamentosRaw = await db.orcamentoMensal.findMany({
      include: { valores: true }
    });
    const cf_situacao_fiscal = await db.situacaoFiscal.findMany();
    const cf_transaction_patterns = await db.transactionPattern.findMany();
    const cf_nfse = await db.nfsE.findMany();

    const cf_endividamentos = cf_endividamentosRaw.map(e => ({
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

    const cf_orcamentos = cf_orcamentosRaw.map(orc => {
      const categorias: Record<string, number> = {};
      orc.valores.forEach(v => {
        categorias[v.planoContaId] = v.valor;
      });
      return {
        id: orc.id,
        empresaId: orc.empresaId,
        mes: orc.mes,
        categorias
      };
    });

    const backupData = {
      cf_empresas,
      cf_users,
      cf_unidades,
      cf_plano_contas,
      cf_portadores,
      cf_clientes,
      cf_lancamentos,
      cf_endividamentos,
      cf_atas,
      cf_indicadores,
      cf_orcamentos,
      cf_situacao_fiscal,
      cf_transaction_patterns,
      cf_nfse
    };

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

    if (collection) {
      console.log(`[Chunked Migration] Iniciando migração da coleção: ${collection}...`);
      
      switch (collection) {
        case 'cf_empresas':
          if (Array.isArray(data)) await migrateEmpresas(data);
          break;
        case 'cf_users':
          if (Array.isArray(data)) await migrateUsers(data);
          break;
        case 'cf_unidades':
          if (Array.isArray(data)) await migrateUnidades(data);
          break;
        case 'cf_plano_contas':
          if (Array.isArray(data)) await migratePlanoContas(data);
          break;
        case 'cf_portadores':
          if (Array.isArray(data)) await migratePortadores(data);
          break;
        case 'cf_clientes':
          if (Array.isArray(data)) await migrateClientes(data);
          break;
        case 'cf_lancamentos':
          if (Array.isArray(data)) await migrateLancamentos(data);
          break;
        case 'cf_endividamentos':
          if (Array.isArray(data)) await migrateEndividamentos(data);
          break;
        case 'cf_atas':
          if (Array.isArray(data)) await migrateAtas(data);
          break;
        case 'cf_indicadores':
          if (Array.isArray(data)) await migrateIndicadores(data);
          break;
        case 'cf_orcamentos':
          if (Array.isArray(data)) await migrateOrcamentos(data);
          break;
        case 'cf_nfse':
          if (Array.isArray(data)) await migrateNfse(data);
          break;
        case 'cf_situacao_fiscal':
          if (Array.isArray(data)) await migrateSituacaoFiscal(data);
          break;
        case 'cf_transaction_patterns':
          if (Array.isArray(data)) await migrateTransactionPatterns(data);
          break;
        default:
          return NextResponse.json({ error: `Coleção desconhecida para migração: ${collection}` }, { status: 400 });
      }

      console.log(`[Chunked Migration] ✅ Sincronização da coleção ${collection} concluída com sucesso.`);
      return NextResponse.json({ success: true });
    } else {
      console.log('Iniciando migração de backup (monolítico) para o PostgreSQL...');
      
      if (Array.isArray(data.cf_empresas)) await migrateEmpresas(data.cf_empresas);
      if (Array.isArray(data.cf_users)) await migrateUsers(data.cf_users);
      if (Array.isArray(data.cf_unidades)) await migrateUnidades(data.cf_unidades);
      if (Array.isArray(data.cf_plano_contas)) await migratePlanoContas(data.cf_plano_contas);
      if (Array.isArray(data.cf_portadores)) await migratePortadores(data.cf_portadores);
      if (Array.isArray(data.cf_clientes)) await migrateClientes(data.cf_clientes);
      if (Array.isArray(data.cf_lancamentos)) await migrateLancamentos(data.cf_lancamentos);
      if (Array.isArray(data.cf_endividamentos)) await migrateEndividamentos(data.cf_endividamentos);
      if (Array.isArray(data.cf_atas)) await migrateAtas(data.cf_atas);
      if (Array.isArray(data.cf_indicadores)) await migrateIndicadores(data.cf_indicadores);
      if (Array.isArray(data.cf_orcamentos)) await migrateOrcamentos(data.cf_orcamentos);
      if (Array.isArray(data.cf_nfse)) await migrateNfse(data.cf_nfse);
      if (Array.isArray(data.cf_situacao_fiscal)) await migrateSituacaoFiscal(data.cf_situacao_fiscal);
      if (Array.isArray(data.cf_transaction_patterns)) await migrateTransactionPatterns(data.cf_transaction_patterns);

      console.log('✅ Migração de backup (monolítico) concluída com sucesso!');
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('Erro na migração:', error);
    return NextResponse.json({ error: (error as Error).message || 'Erro desconhecido' }, { status: 500 });
  }
}
