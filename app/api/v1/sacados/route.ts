import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireApiKey } from '../../../../lib/api-v1-auth';
import { validarPayloadSacado } from '../../../../lib/api-v1-validation';
import { registrarAuditoriaApi } from '../../../../lib/api-v1-audit';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { captureError } from '../../../../lib/sentry-helper';

const formatarCpfCnpj = (digitos: string) =>
  digitos.length === 11
    ? digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
    : digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

/**
 * POST /api/v1/sacados — cadastra (ou atualiza, se o CPF/CNPJ já existir) um
 * sacado/fornecedor do cliente do BPO. Reaproveita o model Cliente já usado
 * pelo portal interno — mesma tabela que aparece em /consultor/clientes.
 */
export async function POST(request: Request) {
  let empresaId: string | undefined;
  let apiKeyId: string | undefined;
  let status = 500;
  let corpo: any;

  try {
    const auth = await requireApiKey(request);
    if (auth.error) return auth.error;
    empresaId = auth.contexto.empresaId;
    apiKeyId = auth.contexto.apiKeyId;

    const rate = checkRateLimit(`api-v1-sacados:${empresaId}`, 120, 60 * 1000);
    if (!rate.allowed) {
      status = 429;
      return NextResponse.json(
        { error: `Limite de requisições excedido. Tente novamente em ${rate.retryAfterSeconds}s.` },
        { status }
      );
    }

    corpo = await request.json().catch(() => null);
    const erros = validarPayloadSacado(corpo);
    if (erros.length > 0) {
      status = 422;
      return NextResponse.json({ error: 'Payload inválido.', detalhes: erros }, { status });
    }

    const cpfCnpjDigitos = String(corpo.cpfCnpj).replace(/\D/g, '');
    const cpfCnpjFormatado = formatarCpfCnpj(cpfCnpjDigitos);

    // Bloqueio de duplicidade explícito no escopo — checado na aplicação
    // (não via constraint única no banco) porque o cadastro interno do
    // portal permite hoje registros sem CPF/CNPJ preenchido; uma unique
    // constraint quebraria esse fluxo existente.
    const existentes = await db.cliente.findMany({ where: { empresaId, cpfCnpj: { not: '' } } });
    const duplicado = existentes.find(c => c.cpfCnpj.replace(/\D/g, '') === cpfCnpjDigitos);

    const tipo = ['cliente', 'fornecedor', 'ambos'].includes(corpo.tipo) ? corpo.tipo : 'cliente';

    const dados = {
      tipo,
      nome: String(corpo.nome).trim(),
      nomeFantasia: corpo.nomeFantasia ? String(corpo.nomeFantasia).trim() : null,
      cpfCnpj: cpfCnpjFormatado,
      email: corpo.email ? String(corpo.email).trim() : null,
      telefone: corpo.telefone ? String(corpo.telefone).trim() : null,
      endereco: corpo.endereco ? String(corpo.endereco).trim() : null,
      cidade: corpo.cidade ? String(corpo.cidade).trim() : null,
      estado: corpo.estado ? String(corpo.estado).trim() : null,
      cep: corpo.cep ? String(corpo.cep).trim() : null,
      contato: corpo.contato ? String(corpo.contato).trim() : null,
    };

    const sacado = duplicado
      ? await db.cliente.update({ where: { id: duplicado.id }, data: dados })
      : await db.cliente.create({ data: { empresaId, ativo: true, ...dados } });

    status = duplicado ? 200 : 201;
    return NextResponse.json({
      id: sacado.id,
      nome: sacado.nome,
      cpfCnpj: sacado.cpfCnpj,
      tipo: sacado.tipo,
      atualizado: Boolean(duplicado),
    }, { status });
  } catch (error) {
    console.error('Erro em POST /api/v1/sacados:', error);
    captureError(error);
    status = 500;
    return NextResponse.json({ error: 'Erro interno ao processar o sacado.' }, { status });
  } finally {
    await registrarAuditoriaApi({ request, empresaId, apiKeyId, statusCode: status, payload: corpo });
  }
}
