import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { abrirCredencial, acessoEmissaoNegado, configFiscal, resumirErros } from '../../../../lib/nfse/servidor';
import { assinarXml, CertificadoInvalidoError } from '../../../../lib/nfse/assinatura';
import { CofreNaoConfiguradoError } from '../../../../lib/nfse/cofre';
import {
  alertasEmissao, apenasDigitos, exigeAliquotaNaDps, hojeBrasilia, idDps, montarDps, validarEmissao,
  type AmbienteNfse, type DadosDps,
} from '../../../../lib/nfse/dps';
import { criarTransporteMtls, emitirNfse, SefinIndisponivelError } from '../../../../lib/nfse/sefin';
import { totalRetidoFederal } from '../../../../lib/nfse/retencao';
import { estimarValoresNota } from '../../../../lib/nfse/lote';

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const textoOuNull = (v: unknown) => texto(v) || null;

/** Reserva o próximo nDPS do ambiente de forma atômica: duas emissões simultâneas nunca recebem o mesmo número. */
async function reservarNDps(empresaId: string, ambiente: AmbienteNfse): Promise<string> {
  const campo = ambiente === 'producao' ? 'proximoNDpsProducao' : 'proximoNDpsHomologacao';
  const config = await db.nfseConfig.update({
    where: { empresaId },
    data: { [campo]: { increment: 1 } },
    select: { [campo]: true },
  });
  return String((config as Record<string, number>)[campo] - 1);
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const empresaId = texto(body?.empresaId);
    const n = (body?.nota || {}) as Record<string, unknown>;
    const notaId = texto(n.id);
    if (!empresaId || !notaId) return NextResponse.json({ error: 'Dados da nota incompletos.' }, { status: 400 });
    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    const [empresa, config, existente] = await Promise.all([
      db.empresa.findUnique({ where: { id: empresaId }, select: { cnpj: true, razaoSocial: true } }),
      db.nfseConfig.findUnique({ where: { empresaId } }),
      db.nfsE.findUnique({ where: { id: notaId } }),
    ]);
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    if (!config) return NextResponse.json({ error: 'Configure o Emissor Nacional antes de transmitir.' }, { status: 422 });
    if (existente && existente.empresaId !== empresaId) return NextResponse.json({ error: 'Nota de outra empresa.' }, { status: 403 });
    if (existente?.chaveAcesso) return NextResponse.json({ error: 'Esta nota já foi autorizada pelo Sefin.' }, { status: 409 });
    if (existente?.status === 'cancelada') return NextResponse.json({ error: 'Esta nota está cancelada.' }, { status: 409 });

    const ambiente = config.ambiente as AmbienteNfse;
    // Um rascunho já transmitido mantém a série e o nDPS: é o que garante a
    // recuperação da nota, sem duplicar, se a resposta anterior tiver se perdido.
    const mesmoAmbiente = existente?.ambiente === ambiente && !!existente?.nDps;
    const serie = mesmoAmbiente ? existente!.serie : config.serie;

    const valorServicos = Math.round(Number(n.valorServicos) * 100) / 100;
    const aliquotaIss = Number(n.aliquotaIss) || 0;
    const issRetido = n.issRetido === true;
    const retido = (v: unknown) => Math.max(0, Math.round((Number(v) || 0) * 100) / 100);
    const retencao = { irrf: retido(n.valorIr), pis: retido(n.valorPis), cofins: retido(n.valorCofins), csll: retido(n.valorCsll), cp: retido(n.valorInss) };
    const dados: DadosDps = {
      ambiente,
      serie,
      nDps: '1',
      dataCompetencia: texto(n.dataCompetencia),
      descricao: texto(n.discriminacao),
      valorServicos,
      cTribNac: apenasDigitos(texto(n.codigoServico)),
      cTribMun: textoOuNull(n.cTribMun),
      cNbs: textoOuNull(n.cNbs),
      municipioPrestacao: texto(n.municipioPrestacao) || config.codigoMunicipio || '',
      issRetido,
      aliquotaIss,
      retencao,
      tomadorDocumento: apenasDigitos(texto(n.tomadorCnpjCpf)),
      tomadorNome: texto(n.tomadorRazaoSocial),
      tomadorInscricaoMunicipal: textoOuNull(n.tomadorInscricaoMunicipal),
      tomadorEmail: textoOuNull(n.tomadorEmail),
      tomadorCodigoMunicipio: textoOuNull(n.tomadorCodigoMunicipio),
      tomadorCep: textoOuNull(n.tomadorCep),
      tomadorLogradouro: textoOuNull(n.tomadorEndereco),
      tomadorNumero: textoOuNull(n.tomadorNumero),
      tomadorBairro: textoOuNull(n.tomadorBairro),
    };

    // A alíquota do Simples muda com o faturamento: a digitada na nota vale para esta emissão.
    const aliquotaDaNota = Number(body?.pTotTribSN);
    const usaAliquotaDaNota = config.opSimpNac === 3 && body?.pTotTribSN != null && aliquotaDaNota > 0 && aliquotaDaNota <= 100;
    const cfg = configFiscal(usaAliquotaDaNota ? { ...config, pTotTribSN: aliquotaDaNota } : config, empresa.cnpj);
    const problemas = validarEmissao(cfg, dados);
    if (problemas.length > 0) return NextResponse.json({ error: problemas.join(' '), problemas }, { status: 422 });

    const aberta = await abrirCredencial(config);
    if ('erro' in aberta) return NextResponse.json({ error: aberta.erro }, { status: 422 });
    const { credencial } = aberta;

    const clienteId = textoOuNull(n.clienteId);
    const clienteValido = clienteId ? await db.cliente.findFirst({ where: { id: clienteId, empresaId }, select: { id: true } }) : null;
    const nDpsInicial = mesmoAmbiente ? existente!.nDps! : await reservarNDps(empresaId, ambiente);

    // Prestador vem do cadastro, nunca do navegador. Os valores são estimativa até o retorno do Sefin.
    const estimado = estimarValoresNota(valorServicos, aliquotaIss, issRetido, totalRetidoFederal(retencao));
    const camposNota = {
      numero: texto(n.numero) || nDpsInicial,
      serie,
      status: 'rascunho',
      prestadorCnpj: empresa.cnpj,
      prestadorRazaoSocial: empresa.razaoSocial,
      prestadorInscricaoMunicipal: config.inscricaoMunicipal,
      clienteId: clienteValido?.id ?? null,
      tomadorCnpjCpf: texto(n.tomadorCnpjCpf),
      tomadorRazaoSocial: dados.tomadorNome,
      tomadorEmail: dados.tomadorEmail,
      tomadorEndereco: dados.tomadorLogradouro,
      tomadorCidade: textoOuNull(n.tomadorCidade),
      tomadorUf: textoOuNull(n.tomadorUf),
      tomadorCep: dados.tomadorCep,
      tomadorInscricaoMunicipal: dados.tomadorInscricaoMunicipal,
      tomadorCodigoMunicipio: dados.tomadorCodigoMunicipio,
      tomadorNumero: dados.tomadorNumero,
      tomadorBairro: dados.tomadorBairro,
      dataEmissao: hojeBrasilia(),
      dataCompetencia: dados.dataCompetencia,
      codigoServico: dados.cTribNac,
      cTribMun: dados.cTribMun,
      cNbs: dados.cNbs,
      discriminacao: dados.descricao,
      municipioPrestacao: dados.municipioPrestacao,
      valorServicos,
      valorDeducoes: 0,
      valorPis: retencao.pis,
      valorCofins: retencao.cofins,
      valorInss: retencao.cp,
      valorIr: retencao.irrf,
      valorCsll: retencao.csll,
      issRetido,
      valorIss: estimado.valorIss,
      aliquotaIss,
      valorBaseCalculo: valorServicos,
      valorLiquido: estimado.valorLiquido,
      ambiente,
      nDps: nDpsInicial,
      idDps: idDps(cfg, serie, nDpsInicial),
      ultimoErro: null,
      gerarContaReceber: n.gerarContaReceber === true,
      portadorId: textoOuNull(n.portadorId),
      planoContaId: textoOuNull(n.planoContaId),
      vencimento: textoOuNull(n.vencimento),
    };

    // O número fica gravado ANTES do envio: sem isso, uma falha de rede faria o
    // reenvio usar outro nDPS e emitir a nota em duplicidade.
    await db.nfsE.upsert({
      where: { id: notaId },
      update: camposNota,
      create: { ...camposNota, id: notaId, empresaId },
    });

    const resultado = await emitirNfse(criarTransporteMtls(ambiente, credencial), {
      nDps: nDpsInicial,
      retomada: mesmoAmbiente,
      valorServicos,
      tomadorDocumento: dados.tomadorDocumento,
      idDoNumero: nDps => idDps(cfg, serie, nDps),
      gerarDps: nDps => {
        const { id, xml } = montarDps(cfg, { ...dados, nDps });
        return { id, xmlAssinado: assinarXml(xml, 'infDPS', id, credencial) };
      },
      proximoNumero: async () => {
        const nDps = await reservarNDps(empresaId, ambiente);
        await db.nfsE.update({ where: { id: notaId }, data: { nDps, idDps: idDps(cfg, serie, nDps) } });
        return nDps;
      },
    });

    if (!resultado.ok) {
      const ultimoErro = resumirErros(resultado.erros, resultado.mensagem, config.usarProcuracao);
      await db.nfsE.update({ where: { id: notaId }, data: { ultimoErro } });
      return NextResponse.json({
        error: ultimoErro,
        erros: resultado.erros,
        nota: { ambiente, serie, nDps: resultado.nDps, idDps: resultado.idDps, ultimoErro, prestadorCnpj: empresa.cnpj },
      }, { status: 422 });
    }

    const v = resultado.valores;
    const autorizada = await db.nfsE.update({
      where: { id: notaId },
      data: {
        status: 'emitida',
        numero: v.numeroNfse || camposNota.numero,
        nDps: resultado.nDps,
        idDps: resultado.idDps,
        chaveAcesso: resultado.chaveAcesso,
        valorIss: v.valorIss ?? camposNota.valorIss,
        aliquotaIss: v.aliquotaIss ?? aliquotaIss,
        valorBaseCalculo: v.valorBaseCalculo ?? valorServicos,
        valorLiquido: v.valorLiquido ?? camposNota.valorLiquido,
        ultimoErro: null,
        documento: {
          upsert: {
            create: { nfseXml: resultado.nfseXml, dpsXml: resultado.dpsXml },
            update: { nfseXml: resultado.nfseXml, ...(resultado.dpsXml ? { dpsXml: resultado.dpsXml } : {}) },
          },
        },
      },
    });

    return NextResponse.json({
      recuperada: resultado.recuperada,
      alertas: [...alertasEmissao(cfg, dados), ...resultado.alertas],
      aliquotaNaDps: exigeAliquotaNaDps(cfg, issRetido),
      nota: {
        status: autorizada.status,
        numero: autorizada.numero,
        serie: autorizada.serie,
        ambiente,
        nDps: autorizada.nDps,
        idDps: autorizada.idDps,
        chaveAcesso: autorizada.chaveAcesso,
        dataEmissao: autorizada.dataEmissao,
        prestadorCnpj: autorizada.prestadorCnpj,
        prestadorRazaoSocial: autorizada.prestadorRazaoSocial,
        prestadorInscricaoMunicipal: autorizada.prestadorInscricaoMunicipal,
        valorIss: autorizada.valorIss,
        aliquotaIss: autorizada.aliquotaIss,
        valorBaseCalculo: autorizada.valorBaseCalculo,
        valorLiquido: autorizada.valorLiquido,
        ultimoErro: null,
      },
    });
  } catch (error) {
    if (error instanceof SefinIndisponivelError) {
      return NextResponse.json({
        error: `${error.message} Não foi possível confirmar a emissão. Transmita de novo: o sistema consulta o Sefin antes e não duplica a nota.`,
        incerto: true,
      }, { status: 503 });
    }
    if (error instanceof CertificadoInvalidoError || error instanceof CofreNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Erro em POST nfse/emitir:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao transmitir a nota.', incerto: true }, { status: 500 });
  }
}
