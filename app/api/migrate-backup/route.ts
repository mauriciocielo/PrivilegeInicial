import { NextResponse } from 'next/server';
import db from '../../../lib/prisma';

export async function POST(request: Request) {
  try {
    const { data } = await request.json();
    if (!data) {
      return NextResponse.json({ error: 'Nenhum dado fornecido' }, { status: 400 });
    }

    console.log('Iniciando migração de backup para o PostgreSQL com tratamento individual de erros...');

    // 1. Migrar Empresas
    if (Array.isArray(data.cf_empresas)) {
      console.log(`Migrando ${data.cf_empresas.length} empresas...`);
      for (const e of data.cf_empresas) {
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
            }
          });
        } catch (err) {
          console.error('Erro na Empresa:', e, err);
          return NextResponse.json({ error: `Erro na Empresa (ID: ${e.id}): ${(err as Error).message}` }, { status: 500 });
        }
      }
    }

    // 2. Migrar Usuários
    if (Array.isArray(data.cf_users)) {
      console.log(`Migrando ${data.cf_users.length} usuários...`);
      for (const u of data.cf_users) {
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
              allowedRoutes: Array.isArray(u.allowedRoutes) ? u.allowedRoutes.map(String) : [],
            }
          });
        } catch (err) {
          console.error('Erro no Usuário:', u, err);
          return NextResponse.json({ error: `Erro no Usuário (Email: ${u.email}): ${(err as Error).message}` }, { status: 500 });
        }
      }
    }

    // 3. Migrar Unidades
    if (Array.isArray(data.cf_unidades)) {
      console.log(`Migrando ${data.cf_unidades.length} unidades...`);
      for (const uni of data.cf_unidades) {
        if (!uni.id) continue;
        try {
          const condominioId = String(uni.condominioId || 'condo_default');
          // Garantir que a empresa condominio existe
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
          return NextResponse.json({ error: `Erro na Unidade (ID: ${uni.id}): ${(err as Error).message}` }, { status: 500 });
        }
      }
    }

    // 4. Migrar Plano de Contas
    if (Array.isArray(data.cf_plano_contas)) {
      console.log(`Migrando ${data.cf_plano_contas.length} planos de contas (Passo 1)...`);
      for (const pc of data.cf_plano_contas) {
        if (!pc.id) continue;
        try {
          const empresaId = String(pc.empresaId || 'empresa_default');
          // Garantir que a empresa associada existe
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
              parentId: null, // Ignora parentId provisoriamente
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
          return NextResponse.json({ error: `Erro no PlanoConta (ID: ${pc.id}): ${(err as Error).message}` }, { status: 500 });
        }
      }

      console.log('Atualizando relações hierárquicas do plano de contas (Passo 2)...');
      for (const pc of data.cf_plano_contas) {
        if (pc.id && pc.parentId) {
          try {
            await db.planoConta.update({
              where: { id: String(pc.id) },
              data: { parentId: String(pc.parentId) }
            });
          } catch (err) {
            console.error('Erro no PlanoConta (Passo 2 - parentId):', pc, err);
            // Ignoramos erro de parentId para evitar que quebre toda a migração se houver inconsistência no parentId
          }
        }
      }
    }

    // 5. Migrar Portadores
    if (Array.isArray(data.cf_portadores)) {
      console.log(`Migrando ${data.cf_portadores.length} portadores...`);
      for (const p of data.cf_portadores) {
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
          return NextResponse.json({ error: `Erro no Portador (ID: ${p.id}): ${(err as Error).message}` }, { status: 500 });
        }
      }
    }

    // 6. Migrar Clientes
    if (Array.isArray(data.cf_clientes)) {
      console.log(`Migrando ${data.cf_clientes.length} clientes...`);
      for (const c of data.cf_clientes) {
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
          return NextResponse.json({ error: `Erro no Cliente (ID: ${c.id}): ${(err as Error).message}` }, { status: 500 });
        }
      }
    }

    // 7. Migrar Lançamentos
    if (Array.isArray(data.cf_lancamentos)) {
      console.log(`Migrando ${data.cf_lancamentos.length} lançamentos...`);
      for (const l of data.cf_lancamentos) {
        if (!l.id) continue;
        try {
          const empresaId = String(l.empresaId || 'empresa_default');
          const planoContaId = String(l.planoContaId || 'plano_default');
          const portadorId = String(l.portadorId || 'portador_default');

          // Garantir que a empresa, planoConta e portador existem no banco
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

          // Tratar relacionamentos opcionais se existirem
          if (l.unidadeId) {
            await db.unidade.upsert({
              where: { id: String(l.unidadeId) },
              update: {},
              create: {
                id: String(l.unidadeId),
                condominioId: empresaId, // Assumindo que a empresa é o condomínio nesse caso
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
          return NextResponse.json({ error: `Erro no Lançamento (ID: ${l.id}): ${(err as Error).message}` }, { status: 500 });
        }
      }
    }

    // 8. Migrar Endividamentos
    if (Array.isArray(data.cf_endividamentos)) {
      console.log(`Migrando ${data.cf_endividamentos.length} endividamentos...`);
      for (const end of data.cf_endividamentos) {
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

          await db.endividamento.upsert({
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
        } catch (err) {
          console.error('Erro no Endividamento:', end, err);
          return NextResponse.json({ error: `Erro no Endividamento (ID: ${end.id}): ${(err as Error).message}` }, { status: 500 });
        }
      }
    }

    // 9. Migrar Atas
    if (Array.isArray(data.cf_atas)) {
      console.log(`Migrando ${data.cf_atas.length} atas de atendimento...`);
      for (const ata of data.cf_atas) {
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
          return NextResponse.json({ error: `Erro na Ata (ID: ${ata.id}): ${(err as Error).message}` }, { status: 500 });
        }
      }
    }

    // 10. Migrar Indicadores
    if (Array.isArray(data.cf_indicadores)) {
      console.log(`Migrando ${data.cf_indicadores.length} indicadores mensais...`);
      for (const ind of data.cf_indicadores) {
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
          return NextResponse.json({ error: `Erro no Indicador (ID: ${ind.id}): ${(err as Error).message}` }, { status: 500 });
        }
      }
    }

    // 11. Migrar NFS-e
    if (Array.isArray(data.cf_nfse)) {
      console.log(`Migrando ${data.cf_nfse.length} notas fiscais (NFS-e)...`);
      for (const n of data.cf_nfse) {
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
          return NextResponse.json({ error: `Erro na NFS-e (ID: ${n.id}): ${(err as Error).message}` }, { status: 500 });
        }
      }
    }

    console.log('✅ Migração de backup concluída com sucesso!');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro na migração:', error);
    return NextResponse.json({ error: (error as Error).message || 'Erro desconhecido' }, { status: 500 });
  }
}
