import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { cnpjValido, apenasDigitos } from '../../../../lib/nfse/dps';

export const maxDuration = 60;

/** Consulta dados cadastrais do CNPJ na Receita Federal via provedores públicos */
async function buscarDadosCnpjReceita(cnpj: string) {
  const limpo = apenasDigitos(cnpj);
  if (limpo.length !== 14) return null;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`, {
      headers: { 'User-Agent': 'CashflowFiscal/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        razaoSocial: (data.razao_social || data.nome || '').toUpperCase(),
        nomeFantasia: (data.nome_fantasia || data.fantasia || data.razao_social || '').toUpperCase(),
        email: data.email || 'contato@privilegecontabilidade.com.br',
        telefone: data.ddd_telefone_1 || data.telefone || '(00) 0000-0000',
        responsavel: data.qsa?.[0]?.nome_socio || data.nome_socio_administrador || 'Responsável Legal',
        cidade: data.municipio || '',
        uf: data.uf || 'PR',
        cep: data.cep || '',
        codigoMunicipio: data.codigo_municipio_ibge ? String(data.codigo_municipio_ibge) : '',
        atividade: data.cnae_fiscal_descricao || 'Serviço',
      };
    }
  } catch (e) {
    console.warn(`[CNPJ] Falha ao consultar BrasilAPI para ${limpo}:`, e);
  }

  // Fallback para MinhaReceita
  try {
    const res2 = await fetch(`https://minhareceita.org/${limpo}`, {
      headers: { 'User-Agent': 'CashflowFiscal/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (res2.ok) {
      const data = await res2.json();
      return {
        razaoSocial: (data.razao_social || '').toUpperCase(),
        nomeFantasia: (data.nome_fantasia || data.razao_social || '').toUpperCase(),
        email: data.email || 'contato@privilegecontabilidade.com.br',
        telefone: data.ddd_telefone_1 || '(00) 0000-0000',
        responsavel: data.qsa?.[0]?.nome_socio || 'Responsável Legal',
        cidade: data.municipio || '',
        uf: data.uf || 'PR',
        cep: data.cep || '',
        codigoMunicipio: data.codigo_municipio_ibge ? String(data.codigo_municipio_ibge) : '',
        atividade: data.cnae_fiscal_descricao || 'Serviço',
      };
    }
  } catch (e) {
    console.warn(`[CNPJ] Falha no fallback MinhaReceita para ${limpo}:`, e);
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Apenas consultores e administradores podem cadastrar CNPJs.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));

    // Modo 1: Cadastro ou importação de múltiplos CNPJs em lote
    if (Array.isArray(body?.cnpjs) && body.cnpjs.length > 0) {
      const listaCnpjs: string[] = body.cnpjs;
      const criadas: any[] = [];
      const erros: any[] = [];

      for (const raw of listaCnpjs) {
        const limpo = apenasDigitos(raw);
        if (!cnpjValido(limpo)) {
          erros.push({ cnpj: raw, erro: 'CNPJ com formato ou dígitos verificadores inválidos.' });
          continue;
        }

        const cnpjFormatado = limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

        // Checa se já existe
        const existente = await db.empresa.findFirst({
          where: { OR: [{ cnpj: cnpjFormatado }, { cnpj: limpo }] },
          select: { id: true, razaoSocial: true, cnpj: true },
        });

        if (existente) {
          // Garante que o monitor e emissor estejam criados
          await db.nfeDistribuicao.upsert({
            where: { empresaId: existente.id },
            create: { empresaId: existente.id, ativo: true, apenasNoturno: false },
            update: { ativo: true },
          });
          await db.nfseConfig.upsert({
            where: { empresaId: existente.id },
            create: { empresaId: existente.id, usarProcuracao: true },
            update: {},
          });
          criadas.push({ ...existente, jaExistia: true });
          continue;
        }

        // Busca dados na Receita
        const dadosReceita = await buscarDadosCnpjReceita(limpo);
        const razaoSocial = dadosReceita?.razaoSocial || `EMPRESA CNPJ ${cnpjFormatado}`;
        const nomeFantasia = dadosReceita?.nomeFantasia || razaoSocial;

        const nova = await db.empresa.create({
          data: {
            cnpj: cnpjFormatado,
            razaoSocial,
            nomeFantasia,
            email: dadosReceita?.email || 'contato@privilegecontabilidade.com.br',
            telefone: dadosReceita?.telefone || '(00) 0000-0000',
            responsavel: dadosReceita?.responsavel || 'Responsável',
            atividade: dadosReceita?.atividade || 'Serviço',
            tipo: 'empresa',
          },
        });

        // Cria configuração do monitor SEFAZ e emissor NFS-e com Procuração
        await db.nfeDistribuicao.create({
          data: { empresaId: nova.id, ativo: true, apenasNoturno: false },
        });

        await db.nfseConfig.create({
          data: {
            empresaId: nova.id,
            usarProcuracao: true,
            codigoMunicipio: dadosReceita?.codigoMunicipio || '',
          },
        });

        criadas.push(nova);
      }

      return NextResponse.json({
        sucesso: true,
        mensagem: `${criadas.length} empresa(s) processada(s) com sucesso na base de dados!`,
        totalProcessadas: criadas.length,
        totalErros: erros.length,
        erros,
      });
    }

    // Modo 2: Cadastro individual de um único CNPJ
    const rawCnpj = body?.cnpj ? String(body.cnpj) : '';
    const limpo = apenasDigitos(rawCnpj);

    if (!cnpjValido(limpo)) {
      return NextResponse.json({ error: 'CNPJ inválido. Verifique os números informados.' }, { status: 400 });
    }

    const cnpjFormatado = limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

    // Checa se já existe
    const existente = await db.empresa.findFirst({
      where: { OR: [{ cnpj: cnpjFormatado }, { cnpj: limpo }] },
      include: { nfseConfig: true, nfeDistribuicao: true },
    });

    if (existente) {
      // Garante que o monitor e procuração estejam ativos
      await db.nfeDistribuicao.upsert({
        where: { empresaId: existente.id },
        create: { empresaId: existente.id, ativo: true, apenasNoturno: false },
        update: { ativo: true },
      });
      await db.nfseConfig.upsert({
        where: { empresaId: existente.id },
        create: { empresaId: existente.id, usarProcuracao: true },
        update: {},
      });
      return NextResponse.json({
        sucesso: true,
        jaExistia: true,
        mensagem: `A empresa ${existente.razaoSocial} já estava cadastrada no sistema. O monitoramento fiscal foi assegurado.`,
        empresa: existente,
      });
    }

    // Busca dados cadastrais automáticos na Receita Federal
    let dadosReceita = null;
    if (!body?.razaoSocial || body.razaoSocial.trim() === '') {
      dadosReceita = await buscarDadosCnpjReceita(limpo);
    }

    const razaoSocial = (body?.razaoSocial || dadosReceita?.razaoSocial || `EMPRESA CNPJ ${cnpjFormatado}`).toUpperCase();
    const nomeFantasia = (body?.nomeFantasia || dadosReceita?.nomeFantasia || razaoSocial).toUpperCase();
    const email = body?.email || dadosReceita?.email || 'contato@privilegecontabilidade.com.br';
    const telefone = body?.telefone || dadosReceita?.telefone || '(00) 0000-0000';
    const responsavel = body?.responsavel || dadosReceita?.responsavel || 'Responsável';

    const novaEmpresa = await db.empresa.create({
      data: {
        cnpj: cnpjFormatado,
        razaoSocial,
        nomeFantasia,
        email,
        telefone,
        responsavel,
        atividade: body?.atividade || dadosReceita?.atividade || 'Serviço',
        tipo: 'empresa',
      },
    });

    // Vincula o monitor SEFAZ
    await db.nfeDistribuicao.create({
      data: {
        empresaId: novaEmpresa.id,
        ativo: true,
        apenasNoturno: Boolean(body?.apenasNoturno),
      },
    });

    // Vincula configuração de NFS-e com procuração
    await db.nfseConfig.create({
      data: {
        empresaId: novaEmpresa.id,
        usarProcuracao: true,
        codigoMunicipio: dadosReceita?.codigoMunicipio || '',
      },
    });

    return NextResponse.json({
      sucesso: true,
      mensagem: `Empresa ${razaoSocial} cadastrada com sucesso na base de dados!`,
      empresa: novaEmpresa,
    });
  } catch (error: any) {
    console.error('Erro em POST /api/empresas/cadastrar-cnpj:', error);
    captureError(error);
    return NextResponse.json({ error: error?.message || 'Erro ao cadastrar CNPJ na base de dados.' }, { status: 500 });
  }
}

/** Retorna backup completo em JSON de todas as empresas e seus CNPJs para proteção de dados */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const empresas = await db.empresa.findMany({
      select: {
        id: true,
        cnpj: true,
        razaoSocial: true,
        nomeFantasia: true,
        email: true,
        telefone: true,
        atividade: true,
        createdAt: true,
      },
      orderBy: { razaoSocial: 'asc' },
    });

    return NextResponse.json({
      sucesso: true,
      total: empresas.length,
      exportadoEm: new Date().toISOString(),
      empresas,
    });
  } catch (error: any) {
    captureError(error);
    return NextResponse.json({ error: 'Erro ao gerar backup da base de empresas.' }, { status: 500 });
  }
}

