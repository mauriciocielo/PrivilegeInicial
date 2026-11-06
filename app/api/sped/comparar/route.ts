import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../lib/nfse/servidor';
import { apenasDigitos } from '../../../../lib/nfse/dps';
import {
  parseSpedFiscalConteudo,
  executarCruzamentoSped,
  type DocumentoSistema,
} from '../../../../lib/sped/comparador';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    let conteudoSped = '';
    let empresaIdParam = '';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'Nenhum arquivo SPED (.txt) enviado.' }, { status: 400 });
      }
      conteudoSped = await file.text();
      empresaIdParam = (formData.get('empresaId') as string) || '';
    } else {
      const body = await request.json().catch(() => ({}));
      conteudoSped = typeof body?.conteudoSped === 'string' ? body.conteudoSped : '';
      empresaIdParam = typeof body?.empresaId === 'string' ? body.empresaId : '';
    }

    if (!conteudoSped || conteudoSped.trim().length === 0) {
      return NextResponse.json({ error: 'Arquivo SPED vazio ou inválido.' }, { status: 400 });
    }

    // 1. Parsing do arquivo SPED
    const parseado = parseSpedFiscalConteudo(conteudoSped);
    const cnpjSpedLimpo = apenasDigitos(parseado.cnpjEmpresa);

    if (parseado.documentos.length === 0 && !parseado.cnpjEmpresa) {
      return NextResponse.json(
        { error: 'Não foram encontrados registros SPED válidos (0000, C100, D100). Verifique o formato do arquivo.' },
        { status: 422 }
      );
    }

    // 2. Identificação da Empresa no Sistema
    let empresa = null;
    if (empresaIdParam) {
      const negado = await acessoNegado(auth.session, empresaIdParam);
      if (negado) return negado;
      empresa = await db.empresa.findUnique({
        where: { id: empresaIdParam },
        select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
      });
    } else if (cnpjSpedLimpo) {
      const empresasCandidatas = await db.empresa.findMany({
        select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
      });
      empresa = empresasCandidatas.find(e => apenasDigitos(e.cnpj) === cnpjSpedLimpo) || null;

      if (empresa && auth.session.role === 'cliente') {
        const negado = await acessoNegado(auth.session, empresa.id);
        if (negado) return negado;
      }
    }

    // Se nenhuma empresa no sistema bater com o CNPJ do SPED
    if (!empresa) {
      return NextResponse.json({
        sucesso: true,
        empresaEncontrada: false,
        aviso: 'Nenhuma empresa cadastrada no sistema corresponde ao CNPJ deste SPED.',
        metaSped: {
          cnpjSped: parseado.cnpjEmpresa,
          razaoSocialSped: parseado.razaoSocialSped,
          dataInicio: parseado.dataInicio,
          dataFim: parseado.dataFim,
          mesCompetencia: parseado.mesCompetencia,
          totalDocsSped: parseado.documentos.length,
        },
      });
    }

    const mes = parseado.mesCompetencia || parseado.dataInicio.slice(0, 7);

    // 3. Busca de Documentos do Sistema para o Período
    // a) NF-e (Mercadorias) e CT-e (Fretes)
    const nfesDestinadas = await db.nfeDestinada.findMany({
      where: {
        empresaId: empresa.id,
        dataEmissao: {
          gte: `${mes}-01`,
          lte: `${mes}-31T23:59:59`,
        },
      },
      select: {
        id: true,
        chaveAcesso: true,
        numero: true,
        serie: true,
        emitenteCnpj: true,
        emitenteNome: true,
        dataEmissao: true,
        tipoOperacao: true,
        valorNf: true,
        situacao: true,
      },
    });

    // b) NFS-e (Serviços)
    const nfses = await db.nfsE.findMany({
      where: {
        empresaId: empresa.id,
        OR: [
          { dataCompetencia: mes },
          { dataEmissao: { startsWith: mes } },
        ],
      },
      select: {
        id: true,
        numero: true,
        chaveAcesso: true,
        prestadorCnpj: true,
        prestadorRazaoSocial: true,
        tomadorCnpjCpf: true,
        tomadorRazaoSocial: true,
        dataEmissao: true,
        valorServicos: true,
        valorLiquido: true,
        status: true,
      },
    });

    // 4. Mapeia para o formato unificado de DocumentoSistema
    const docsSistema: DocumentoSistema[] = [];

    const cnpjEmpresaDigitos = apenasDigitos(empresa.cnpj);

    for (const n of nfesDestinadas) {
      const chaveLimpa = (n.chaveAcesso || '').replace(/\D/g, '');
      const modelo = chaveLimpa.length >= 22 ? chaveLimpa.slice(20, 22) : '55';
      const isCte = modelo === '57';

      const emitCnpjLimpo = apenasDigitos(n.emitenteCnpj);
      const isEmitida = emitCnpjLimpo === cnpjEmpresaDigitos;

      docsSistema.push({
        id: n.id,
        origem: 'nfe_destinada',
        tipo: isCte ? 'cte' : 'nfe',
        chave: chaveLimpa,
        numero: n.numero || '',
        serie: n.serie || '',
        dataEmissao: n.dataEmissao.split('T')[0],
        operacao: isEmitida ? 'saida' : 'entrada',
        valorTotal: n.valorNf || 0,
        situacao: n.situacao || 'autorizada',
        contraparteNome: n.emitenteNome || 'Fornecedor',
        contraparteCnpjCpf: n.emitenteCnpj || '',
      });
    }

    for (const nf of nfses) {
      const emitCnpjLimpo = apenasDigitos(nf.prestadorCnpj);
      const isEmitida = emitCnpjLimpo === cnpjEmpresaDigitos;

      docsSistema.push({
        id: nf.id,
        origem: 'nfse',
        tipo: 'nfse',
        chave: (nf.chaveAcesso || '').replace(/\D/g, ''),
        numero: nf.numero || '',
        serie: '',
        dataEmissao: nf.dataEmissao.split('T')[0],
        operacao: isEmitida ? 'saida' : 'entrada',
        valorTotal: nf.valorServicos || nf.valorLiquido || 0,
        situacao: nf.status === 'emitida' ? 'autorizada' : nf.status,
        contraparteNome: isEmitida ? nf.tomadorRazaoSocial : nf.prestadorRazaoSocial,
        contraparteCnpjCpf: isEmitida ? nf.tomadorCnpjCpf : nf.prestadorCnpj,
      });
    }

    // 5. Executa Cruzamento e Auditoria
    const resultado = executarCruzamentoSped(parseado.documentos, docsSistema, {
      cnpjEmpresa: empresa.cnpj,
      razaoSocialSped: parseado.razaoSocialSped,
      dataInicio: parseado.dataInicio,
      dataFim: parseado.dataFim,
      mesCompetencia: mes,
    });

    return NextResponse.json({
      sucesso: true,
      empresaEncontrada: true,
      empresa: {
        id: empresa.id,
        cnpj: empresa.cnpj,
        razaoSocial: empresa.razaoSocial,
        nomeFantasia: empresa.nomeFantasia,
      },
      resultado,
    });
  } catch (error) {
    console.error('Erro em POST /api/sped/comparar:', error);
    captureError(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao processar e comparar arquivo SPED.' },
      { status: 500 }
    );
  }
}

