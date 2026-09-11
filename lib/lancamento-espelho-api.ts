// ============================================================
// LANÇAMENTO-ESPELHO DE UM TÍTULO DA API v1 (CP/CR)
// ============================================================
// A API v1 (app/api/v1/contas-receber, contas-pagar) grava no livro-razão
// imutável (ContaReceber/ContaPagar) — mas o consultor no dia a dia trabalha
// com o fluxo clássico (Contas a Receber/Pagar, dar baixa, Importar OFX).
// Para não obrigar o consultor a aprender uma tela nova, cada título criado
// pela API também gera um Lancamento "previsto" espelho, marcado com
// origem: 'api' e contaReceberId/contaPagarId apontando para a linha do
// livro-razão. Quando esse lançamento é marcado como "realizado" (baixa
// manual ou conciliação OFX), app/api/lancamentos devolve a baixa para a
// conta correspondente — ver registrarBaixaContaFinanceira.
//
// O de-para de plano de contas/portador é configurado uma vez por empresa
// (Empresas → editar → Integração via API), reaproveitando os campos
// osPlanoContaPadraoId/osPortadorPadraoId já existentes no schema (criados
// pela integração "OS Oficina" de outra sessão para o mesmo propósito:
// dar um destino contábil padrão a lançamentos gerados por API).

import type { PrismaClient } from '@prisma/client';

export interface ParametrosLancamentoEspelho {
  empresaId: string;
  tipo: 'receita' | 'despesa';
  clienteId: string;
  valor: number;
  data: string;
  descricao: string;
  numeroDocumento: string | null;
  /** Sugerido pelo ERP no payload do título — usado se pertencer à empresa; senão cai no padrão da empresa. */
  planoContaIdSugerido: string | null;
  contaReceberId?: string;
  contaPagarId?: string;
  /** Informativo — como o ERP espera que este título seja pago. Vai para a observação do lançamento (o modelo Lancamento não tem campo próprio). */
  formaPagamentoPrevista?: string | null;
}

export type ResultadoLancamentoEspelho =
  | { criado: true; lancamentoId: string }
  | { criado: false; motivo: string };

export async function criarLancamentoEspelho(
  db: PrismaClient,
  p: ParametrosLancamentoEspelho
): Promise<ResultadoLancamentoEspelho> {
  const empresa = await db.empresa.findUnique({
    where: { id: p.empresaId },
    select: { osPlanoContaPadraoId: true, osPortadorPadraoId: true },
  });

  let planoContaId = p.planoContaIdSugerido || empresa?.osPlanoContaPadraoId || null;
  let portadorId = empresa?.osPortadorPadraoId || null;

  if (!planoContaId) {
    const defaultPc = await db.planoConta.findFirst({
      where: { empresaId: p.empresaId, tipo: p.tipo, nivel: 3 },
      orderBy: { codigo: 'asc' },
    });
    if (defaultPc) planoContaId = defaultPc.id;
    else {
      // Create a default one if none exists
      const createdPc = await db.planoConta.create({
        data: {
          empresaId: p.empresaId,
          tipo: p.tipo,
          codigo: p.tipo === 'receita' ? '1.01.01' : '2.01.01',
          descricao: 'Recebimentos / Pagamentos Integração',
          nivel: 3,
        }
      });
      planoContaId = createdPc.id;
    }
  }

  if (!portadorId) {
    const defaultPortador = await db.portador.findFirst({
      where: { empresaId: p.empresaId, ativo: true },
    });
    if (defaultPortador) portadorId = defaultPortador.id;
    else {
      const createdPortador = await db.portador.create({
        data: {
          empresaId: p.empresaId,
          nome: 'Conta Integração (API)',
          tipo: 'outro',
          saldoInicial: 0,
        }
      });
      portadorId = createdPortador.id;
    }
  }

  if (!planoContaId || !portadorId) {
    return {
      criado: false,
      motivo: 'Sistema não conseguiu criar nem encontrar plano de conta ou portador padrão.',
    };
  }

  const lancamento = await db.lancamento.create({
    data: {
      empresaId: p.empresaId,
      data: p.data,
      descricao: p.descricao,
      valor: p.valor,
      tipo: p.tipo,
      planoContaId,
      portadorId,
      status: 'previsto',
      numeroDocumento: p.numeroDocumento,
      observacao: p.formaPagamentoPrevista ? `Forma de pagamento prevista: ${p.formaPagamentoPrevista}` : null,
      origem: 'api',
      clienteId: p.clienteId,
      contaReceberId: p.contaReceberId,
      contaPagarId: p.contaPagarId,
    },
  });

  return { criado: true, lancamentoId: lancamento.id };
}

/**
 * Sentido inverso de app/api/lancamentos: quando a baixa é feita direto no
 * livro-razão (POST /api/v1/contas-{receber,pagar}/[id]/baixas com a API key
 * do ERP, ou a baixa manual em app/consultor/contas-erp), marca o
 * lançamento-espelho como "realizado" — assim a tela clássica de Contas a
 * Receber/Pagar não fica "aberta" para um título que já foi pago do lado do
 * livro-razão. Só chamada quando a conta é totalmente liquidada (baixa
 * parcial não tem correspondente no Lancamento, que é binário previsto/realizado).
 */
export async function sincronizarLancamentoEspelhoNaBaixa(
  db: PrismaClient,
  tipo: 'receber' | 'pagar',
  contaId: string
): Promise<void> {
  const where = tipo === 'receber' ? { contaReceberId: contaId } : { contaPagarId: contaId };
  const lancamento = await db.lancamento.findFirst({ where: { ...where, status: { not: 'realizado' } } });
  if (!lancamento) return;

  const atualizado = await db.lancamento.update({ where: { id: lancamento.id }, data: { status: 'realizado' } });

  if (typeof global !== 'undefined' && (global as any).io) {
    (global as any).io.emit('lancamento_atualizado', atualizado);
  }
}
