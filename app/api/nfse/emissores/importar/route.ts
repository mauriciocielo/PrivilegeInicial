import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { abrirCredencialEscritorio } from '../../../../../lib/nfse/servidor';
import { apenasDigitos, cnpjValido } from '../../../../../lib/nfse/dps';
import { CertificadoInvalidoError } from '../../../../../lib/nfse/assinatura';
import { CofreNaoConfiguradoError } from '../../../../../lib/nfse/cofre';
import { criarTransporteMtls, lerCaixaDfe, SefinIndisponivelError } from '../../../../../lib/nfse/sefin';
import {
  TIPO_EMPRESA_SO_EMISSOR, consultarCnpjPublico, escolherSerie, extrairDadosEmissor, formatarCnpj,
} from '../../../../../lib/nfse/emissor';

/**
 * Traz uma empresa pela procuração: confirma o vínculo no ADN e lê as notas já
 * emitidas para preencher o emissor. A leitura é sempre em produção, onde estão as
 * notas reais; o ambiente de emissão da empresa não muda. Sem procuração confirmada,
 * nada é criado.
 */
export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role !== 'administrador') {
      return NextResponse.json({ error: 'Só um administrador pode adicionar emissores.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const cnpj = apenasDigitos(typeof body?.cnpj === 'string' ? body.cnpj : '');
    if (!cnpjValido(cnpj)) return NextResponse.json({ error: 'CNPJ inválido.' }, { status: 422 });

    const aberta = await abrirCredencialEscritorio();
    if ('erro' in aberta) return NextResponse.json({ error: aberta.erro }, { status: 422 });

    let caixa;
    try {
      caixa = await lerCaixaDfe(criarTransporteMtls('producao', aberta.credencial, 'adn'), cnpj);
    } catch (error) {
      if (!(error instanceof SefinIndisponivelError)) throw error;
      return NextResponse.json({ cnpj, status: 'indeterminada', mensagem: error.message });
    }

    const todas = await db.empresa.findMany({ select: { id: true, cnpj: true, razaoSocial: true, nomeFantasia: true, tipo: true, nfseConfig: true } });
    const existente = todas.find(e => apenasDigitos(e.cnpj) === cnpj);
    const verificacao = { procuracaoStatus: caixa.status, procuracaoMensagem: caixa.mensagem, procuracaoVerificadaEm: new Date() };

    if (caixa.status !== 'ativa') {
      if (existente) {
        await db.nfseConfig.upsert({ where: { empresaId: existente.id }, update: verificacao, create: { ...verificacao, empresaId: existente.id } });
      }
      return NextResponse.json({ cnpj, status: caixa.status, mensagem: caixa.mensagem });
    }

    const notas = extrairDadosEmissor(caixa.xmls, cnpj);
    // O cadastro público só entra para o que as notas não responderam.
    const publico = notas.razaoSocial && notas.codigoMunicipio && notas.opSimpNac ? null : await consultarCnpjPublico(cnpj);

    const razaoReal = notas.razaoSocial || publico?.razaoSocial || null;
    const fantasiaReal = notas.nomeFantasia || publico?.nomeFantasia || razaoReal || null;

    if (existente && razaoReal && /^Empresa\s+\d/.test(existente.razaoSocial || '')) {
      await db.empresa.update({
        where: { id: existente.id },
        data: {
          razaoSocial: razaoReal,
          nomeFantasia: fantasiaReal || razaoReal,
          ...(publico?.cidade ? { cidade: publico.cidade } : {}),
          ...(publico?.uf ? { uf: publico.uf } : {}),
          ...(publico?.cep ? { cep: publico.cep } : {}),
        },
      });
    }

    const empresaId = existente?.id ?? (await db.empresa.create({
      data: {
        razaoSocial: razaoReal || `Empresa ${formatarCnpj(cnpj)}`,
        nomeFantasia: fantasiaReal || '',
        cnpj: formatarCnpj(cnpj),
        responsavel: '',
        email: '',
        telefone: '',
        tipo: TIPO_EMPRESA_SO_EMISSOR,
        cidade: publico?.cidade,
        uf: publico?.uf,
        cep: publico?.cep,
      },
      select: { id: true },
    })).id;

    const config = existente?.nfseConfig;
    const jaImportado = !!config?.dadosImportadosEm;
    const servicoPrincipal = notas.servicos[0];
    const municipio = notas.codigoMunicipio || publico?.codigoMunicipio || null;
    const regime = notas.opSimpNac ?? publico?.opSimpNac ?? null;

    const dados: Prisma.NfseConfigUncheckedUpdateInput = {
      ...verificacao,
      dadosImportadosEm: new Date(),
      servicosConhecidos: notas.servicos as unknown as Prisma.InputJsonValue,
    };

    // A partir da primeira importação, o que a pessoa ajustou à mão é preservado:
    // só se preenche o que ainda está vazio.
    const vazio = <T,>(atual: T | null | undefined, novo: T | null) => (atual === null || atual === undefined || atual === '' ? novo ?? undefined : undefined);
    dados.codigoMunicipio = vazio(config?.codigoMunicipio, municipio);
    dados.inscricaoMunicipal = vazio(config?.inscricaoMunicipal, notas.inscricaoMunicipal);
    dados.cTribNacPadrao = vazio(config?.cTribNacPadrao, servicoPrincipal?.cTribNac ?? null);
    dados.cTribMunPadrao = vazio(config?.cTribMunPadrao, servicoPrincipal?.cTribMun ?? null);
    dados.cNbsPadrao = vazio(config?.cNbsPadrao, servicoPrincipal?.cNbs ?? null);
    dados.pTotTribSN = vazio(config?.pTotTribSN, notas.pTotTribSN);
    dados.tpRetPisCofins = vazio(config?.tpRetPisCofins, notas.tpRetPisCofins);

    if (!jaImportado) {
      // Campos com valor padrão no banco: "vazio" não existe, então só a primeira leitura os define.
      if (regime) dados.opSimpNac = regime;
      if (regime && regime !== 3) dados.regApTribSN = null;
      else if (notas.regApTribSN) dados.regApTribSN = notas.regApTribSN;
      if (notas.regEspTrib !== null) dados.regEspTrib = notas.regEspTrib;
      if (notas.piscofinsCst === '00' || notas.piscofinsCst === '08') dados.piscofinsCst = notas.piscofinsCst;
      dados.serie = escolherSerie(notas.seriesUsadas);
    }

    await db.nfseConfig.upsert({
      where: { empresaId },
      update: dados,
      create: { ...(dados as Prisma.NfseConfigUncheckedCreateInput), empresaId },
    });

    return NextResponse.json({
      cnpj,
      status: 'ativa',
      empresaId,
      tipoConsulta: caixa.tipoConsulta,
      notasEmitidas: notas.notasEmitidas,
      servicos: notas.servicos.length,
      parcial: caixa.parcial,
      usouCadastroPublico: !!publico,
      faltaMunicipio: !(config?.codigoMunicipio || municipio),
    });
  } catch (error) {
    if (error instanceof CertificadoInvalidoError || error instanceof CofreNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Erro em POST nfse/emissores/importar:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao importar a empresa.' }, { status: 500 });
  }
}
