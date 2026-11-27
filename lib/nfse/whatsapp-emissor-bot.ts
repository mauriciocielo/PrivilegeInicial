// ============================================================
// EMISSOR DE NFS-e VIA WHATSAPP (Comando Natural + Confirmação SIM)
// ============================================================
// Permite que o cliente ou contador solicite a emissão de uma NFS-e
// direto no WhatsApp (ex.: "Emite uma nota de 2500 para Condominio Solaris referente a manutencao").
// Fluxo seguro em 2 passos:
//   1. Identifica empresa + tomador histórico + monta prévia e pede confirmação ("Responda SIM").
//   2. Ao confirmar "SIM", assina e transmite ao Sefin Nacional e devolve o DANFSe PDF na conversa.

import crypto from 'crypto';
import QRCode from 'qrcode';
import db from '../prisma';
import logoNfse from './dados/logo-nfse.json';
import {
  apenasDigitos,
  hojeBrasilia,
  idDps,
  montarDps,
  validarEmissao,
  type AmbienteNfse,
  type DadosDps,
} from './dps';
import { abrirCredencial, configFiscal, resumirErros } from './servidor';
import { assinarXml } from './assinatura';
import { criarTransporteMtls, emitirNfse } from './sefin';
import { gerarDanfsePdf, lerDadosDanfse, marcaDaguaDaNota, urlConsultaPublica } from './danfse';
import { obterBrandingDaEmpresa } from './escritorios-terceiros';
import { enviarEmailNfseEmitida } from './enviar-email-nfse';
import { registrarAuditoriaEscritorio } from '../escritorio-recursos';
import { generateText } from '../ai-provider';

let tabelaRascunhoGarantida = false;

async function ensureRascunhosTable() {
  if (tabelaRascunhoGarantida) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS nfse_whatsapp_rascunhos (
      jid TEXT PRIMARY KEY,
      empresa_id TEXT NOT NULL,
      dados_json JSONB NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  tabelaRascunhoGarantida = true;
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

function parseValorMonetario(texto: string): number {
  const m = texto.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)/i);
  if (!m) return 0;
  const raw = m[1];
  if (raw.includes(',')) {
    return parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return parseFloat(raw) || 0;
}

export function interpretarComandoEmissaoNfse(textoBruto: string): {
  valor: number;
  tomadorBusca: string;
  descricao: string;
} | null {
  // Remove prefixo de grupo "[Nome]: ..."
  const limpo = textoBruto.replace(/^\[[^\]]+\]:\s*/, '').trim();
  const gatilho = /(?:^\/emitir\b|\b(?:emit[aei]r?|faz(?:er)?|tir[ae]r?|ger[ae]r?|lan[cç][ae]r?)\s+(?:uma\s+)?(?:nfse|nfs-e|nota(?:\s+fiscal)?))/i;
  if (!gatilho.test(limpo)) return null;

  const valor = parseValorMonetario(limpo);
  if (valor <= 0) return null;

  // Extrai tomador após "para", "pro", "pra" até "referente", "ref", "sobre", "servico" ou fim
  const mToma = limpo.match(/\b(?:para|pro|pra)\s+(?:a\s+|o\s+)?(.+?)(?=\s+(?:referente|ref\.?|sobre|servi[cç]o|desc(?:ri[cç][aã]o)?|no\s+valor)\b|$)/i);
  const tomadorBusca = (mToma?.[1] || '').trim().replace(/[.,;]+$/, '');

  const mDesc = limpo.match(/\b(?:referente\s+a[o]?|referente|ref\.?|sobre|servi[cç]o(?:\s+de)?|desc(?:ri[cç][aã]o)?)\s+(.+)$/i);
  const descricao = (mDesc?.[1] || '').trim();

  if (!tomadorBusca) return null;
  return { valor: Math.round(valor * 100) / 100, tomadorBusca, descricao };
}

/**
 * Fallback com IA para entender fala natural (especialmente áudios transcritos),
 * como "Oi Léo, tira uma nota de dois mil e quinhentos pro Condomínio Solaris de manutenção".
 */
async function interpretarComandoEmissaoComIA(textoBruto: string): Promise<{
  valor: number;
  tomadorBusca: string;
  descricao: string;
} | null> {
  const limpo = textoBruto.replace(/^\[[^\]]+\]:\s*/, '').trim();
  const parecePedidoNota =
    /\b(nota|nfse|nfs-e|faturar|emitir|emite|tira(?:r)?\s+uma\s+nota|faz(?:er)?\s+uma\s+nota)\b/i.test(limpo) &&
    limpo.length >= 12;
  if (!parecePedidoNota) return null;

  try {
    const ai = await generateText({
      jsonMode: true,
      maxTokens: 220,
      temperature: 0.1,
      timeoutMs: 10000,
      system:
        'Você extrai pedidos de emissão de Nota Fiscal de Serviço (NFS-e) de mensagens ou áudios transcritos de WhatsApp. ' +
        'Se a mensagem NÃO for um pedido claro para emitir uma nota fiscal (por exemplo, se for apenas uma dúvida sobre notas fiscais), retorne {"ehPedido": false}. ' +
        'Se FOR um pedido para emitir uma nota, retorne {"ehPedido": true, "valor": numero_float, "tomador": "nome ou CNPJ/CPF do cliente/tomador", "descricao": "descrição do serviço ou vazio"}. ' +
        'Converta valores por extenso (ex.: "dois mil e quinhentos") para número (2500).',
      prompt: limpo,
    });
    if (!ai.text) return null;
    const parsed = JSON.parse(ai.text);
    if (!parsed?.ehPedido) return null;
    const valor = Math.round((Number(parsed.valor) || 0) * 100) / 100;
    const tomadorBusca = String(parsed.tomador || '').trim();
    const descricao = String(parsed.descricao || '').trim();
    if (valor <= 0 || !tomadorBusca) return null;
    return { valor, tomadorBusca, descricao };
  } catch {
    return null;
  }
}

async function localizarEmpresaPorChat(rawJid: string, cleanPhone: string, isGroup: boolean) {
  if (isGroup) {
    try {
      const rows = await db.$queryRawUnsafe<Array<{ empresa_id: string }>>(
        `SELECT empresa_id FROM whatsapp_empresa_grupos WHERE group_jid = $1 LIMIT 1`,
        rawJid
      );
      if (rows[0]?.empresa_id) {
        return db.empresa.findUnique({
          where: { id: String(rows[0].empresa_id) },
          include: { nfseConfig: true },
        });
      }
    } catch {
      // ignora
    }
    return null;
  }

  const ult8 = apenasDigitos(cleanPhone).slice(-8);
  if (ult8.length < 8) return null;
  const candidatas = await db.empresa.findMany({
    where: { nfseConfig: { isNot: null } },
    include: { nfseConfig: true },
  });
  return candidatas.find((e) => apenasDigitos(e.telefone).endsWith(ult8)) || null;
}

async function reservarProximoNDps(empresaId: string, ambiente: AmbienteNfse): Promise<string> {
  const col = ambiente === 'producao' ? 'proximoNDpsProducao' : 'proximoNDpsHomologacao';
  const cfg = await db.nfseConfig.findUnique({ where: { empresaId } });
  const atual = Number((cfg as any)?.[col] || 1);
  await db.nfseConfig.update({
    where: { empresaId },
    data: { [col]: atual + 1 } as any,
  });
  return String(atual);
}

/**
 * Processa comandos de emissão de NFS-e via WhatsApp (prévia + confirmação SIM).
 * Retorna `true` se a mensagem foi tratada pelo bot emissor.
 */
export async function processarComandoNfseWhatsApp(params: {
  rawJid: string;
  sendJid: string;
  cleanPhone: string;
  isGroup: boolean;
  text: string;
  ownerId: string;
  enviarMensagem: (
    jid: string,
    texto: string,
    media?: { mediaType: 'document'; mediaUrl: string; fileName: string; mimeType: string }
  ) => Promise<any>;
}): Promise<boolean> {
  try {
    const limpo = params.text.replace(/^\[[^\]]+\]:\s*/, '').trim();
    if (!limpo) return false;

    const ehConfirmacao = /^(sim|confirmar|confirmo|pode emitir|emitir)$/i.test(limpo);
    const ehCancelamento = /^(n[aã]o|nao|cancelar|cancela)$/i.test(limpo);

    // 1. Verifica se há rascunho pendente para este chat
    if (ehConfirmacao || ehCancelamento) {
      await ensureRascunhosTable();
      const rows = await db.$queryRawUnsafe<any[]>(
        `SELECT * FROM nfse_whatsapp_rascunhos WHERE jid = $1 AND expires_at > NOW() LIMIT 1`,
        params.sendJid
      );
      const rascunho = rows[0];
      if (!rascunho) return false;

      if (ehCancelamento) {
        await db.$executeRawUnsafe(`DELETE FROM nfse_whatsapp_rascunhos WHERE jid = $1`, params.sendJid);
        await params.enviarMensagem(params.sendJid, '❌ Emissão de NFS-e cancelada conforme solicitado.');
        return true;
      }

      // Confirmado: emite oficialmente no Sefin Nacional!
      await db.$executeRawUnsafe(`DELETE FROM nfse_whatsapp_rascunhos WHERE jid = $1`, params.sendJid);
      const dadosSalvos = rascunho.dados_json as {
        empresaId: string;
        tomadorNome: string;
        tomadorDocumento: string;
        tomadorEmail: string | null;
        codigoServico: string;
        municipioPrestacao: string;
        descricao: string;
        valorServicos: number;
        aliquotaIss: number;
        issRetido: boolean;
      };

      const [empresa, branding] = await Promise.all([
        db.empresa.findUnique({ where: { id: dadosSalvos.empresaId }, include: { nfseConfig: true } }),
        obterBrandingDaEmpresa(dadosSalvos.empresaId),
      ]);
      const cfg = empresa?.nfseConfig;
      if (!empresa || !cfg) {
        await params.enviarMensagem(params.sendJid, '⚠️ Configuração fiscal da empresa não encontrada.');
        return true;
      }

      const aberta = await abrirCredencial(cfg);
      if ('erro' in aberta) {
        await params.enviarMensagem(params.sendJid, `⚠️ Certificado indisponível: ${aberta.erro}`);
        return true;
      }

      const ambiente = (cfg.ambiente === 'producao' ? 'producao' : 'homologacao') as AmbienteNfse;
      const nDpsInicial = await reservarProximoNDps(empresa.id, ambiente);
      const hoje = hojeBrasilia();
      const serie = cfg.serie || '1';
      const cfgFiscal = configFiscal(cfg, empresa.cnpj);

      const dadosDps: DadosDps = {
        ambiente,
        serie,
        nDps: nDpsInicial,
        dataCompetencia: hoje,
        tomadorDocumento: dadosSalvos.tomadorDocumento,
        tomadorNome: dadosSalvos.tomadorNome,
        tomadorEmail: dadosSalvos.tomadorEmail || null,
        cTribNac: dadosSalvos.codigoServico,
        municipioPrestacao: dadosSalvos.municipioPrestacao || cfg.codigoMunicipio || '',
        descricao: dadosSalvos.descricao,
        valorServicos: dadosSalvos.valorServicos,
        aliquotaIss: dadosSalvos.aliquotaIss || null,
        issRetido: dadosSalvos.issRetido,
      };

      const problemas = validarEmissao(cfgFiscal, dadosDps);
      if (problemas.length > 0) {
        await params.enviarMensagem(params.sendJid, `⚠️ Não foi possível emitir: ${problemas.join(' ')}`);
        return true;
      }

      const retorno = await emitirNfse(criarTransporteMtls(ambiente, aberta.credencial), {
        nDps: nDpsInicial,
        retomada: false,
        valorServicos: dadosSalvos.valorServicos,
        tomadorDocumento: dadosSalvos.tomadorDocumento,
        idDoNumero: (num) => idDps(cfgFiscal, serie, num),
        gerarDps: (num) => {
          const { id, xml } = montarDps(cfgFiscal, { ...dadosDps, nDps: num });
          return { id, xmlAssinado: assinarXml(xml, 'infDPS', id, aberta.credencial) };
        },
        proximoNumero: async () => reservarProximoNDps(empresa.id, ambiente),
      });

      if (!retorno.ok) {
        const msgErro = resumirErros(retorno.erros, retorno.mensagem, cfg.usarProcuracao);
        await params.enviarMensagem(params.sendJid, `❌ A prefeitura/Sefin recusou a emissão:\n${msgErro}`);
        return true;
      }

      const numeroOficial = retorno.valores.numeroNfse || retorno.nDps;
      const valorIssFinal =
        retorno.valores.valorIss ??
        (dadosSalvos.aliquotaIss
          ? Math.round(dadosSalvos.valorServicos * (dadosSalvos.aliquotaIss / 100) * 100) / 100
          : 0);
      const valorLiquidoFinal = retorno.valores.valorLiquido ?? dadosSalvos.valorServicos;

      const notaSalva = await db.nfsE.create({
        data: {
          id: crypto.randomUUID(),
          empresaId: empresa.id,
          numero: numeroOficial,
          serie,
          chaveAcesso: retorno.chaveAcesso,
          nDps: retorno.nDps,
          idDps: retorno.idDps,
          ambiente,
          status: 'emitida',
          prestadorCnpj: empresa.cnpj,
          prestadorRazaoSocial: empresa.razaoSocial,
          tomadorCnpjCpf: dadosSalvos.tomadorDocumento,
          tomadorRazaoSocial: dadosSalvos.tomadorNome,
          tomadorEmail: dadosSalvos.tomadorEmail,
          dataEmissao: hoje,
          dataCompetencia: hoje,
          codigoServico: dadosSalvos.codigoServico,
          discriminacao: dadosSalvos.descricao,
          municipioPrestacao: dadosDps.municipioPrestacao,
          valorServicos: dadosSalvos.valorServicos,
          valorBaseCalculo: retorno.valores.valorBaseCalculo ?? dadosSalvos.valorServicos,
          valorDeducoes: 0,
          valorPis: 0,
          valorCofins: 0,
          valorInss: 0,
          valorIr: 0,
          valorCsll: 0,
          valorIss: valorIssFinal,
          aliquotaIss: retorno.valores.aliquotaIss ?? dadosSalvos.aliquotaIss ?? 0,
          issRetido: dadosSalvos.issRetido,
          valorLiquido: valorLiquidoFinal,
          documento: {
            create: {
              dpsXml: retorno.dpsXml,
              nfseXml: retorno.nfseXml,
            },
          },
        },
      });

      await registrarAuditoriaEscritorio({
        userId: 'whatsapp-bot',
        userNome: `WhatsApp (${params.cleanPhone})`,
        acao: 'nfse_emitida',
        empresaId: empresa.id,
        empresaNome: empresa.nomeFantasia || empresa.razaoSocial,
        detalhes: `Emitiu NFS-e nº ${numeroOficial} via WhatsApp para ${dadosSalvos.tomadorNome} (${fmtBRL(dadosSalvos.valorServicos)})`,
      });

      // Envia e-mail automático white-label em segundo plano
      enviarEmailNfseEmitida({
        empresaId: empresa.id,
        numero: numeroOficial,
        dataEmissao: hoje,
        prestadorNome: empresa.razaoSocial,
        tomadorNome: dadosSalvos.tomadorNome,
        tomadorDocumento: dadosSalvos.tomadorDocumento,
        tomadorEmail: dadosSalvos.tomadorEmail,
        valorLiquido: notaSalva.valorLiquido,
        nfseXml: retorno.nfseXml,
        ambiente,
      }).catch(() => {});

      // Gera DANFSe PDF e envia direto na conversa do WhatsApp!
      const dadosDanfse = lerDadosDanfse(retorno.nfseXml);
      const qrText = dadosDanfse.chave ? urlConsultaPublica(dadosDanfse.chave) : '';
      const qrPng = qrText
        ? await QRCode.toBuffer(qrText, { errorCorrectionLevel: 'M', margin: 0, width: 140 }).catch(() => Buffer.alloc(0))
        : Buffer.alloc(0);
      const pdfBytes = gerarDanfsePdf(dadosDanfse, {
        logoPng: Buffer.from(logoNfse.png, 'base64'),
        qrPng,
        marcaDagua: marcaDaguaDaNota('emitida', null),
      });

      const assinatura = branding
        ? `\n\n_${branding.nome}${branding.telefone ? ` · ${branding.telefone}` : ''}_`
        : '';

      await params.enviarMensagem(
        params.sendJid,
        `✅ *NFS-e nº ${numeroOficial} emitida com sucesso!*\n\n• *Tomador:* ${dadosSalvos.tomadorNome}\n• *Valor:* ${fmtBRL(dadosSalvos.valorServicos)}\n• *Serviço:* ${dadosSalvos.descricao}${assinatura}`,
        {
          mediaType: 'document',
          mediaUrl: `data:application/pdf;base64,${Buffer.from(pdfBytes).toString('base64')}`,
          fileName: `DANFSe_${numeroOficial}.pdf`,
          mimeType: 'application/pdf',
        }
      );
      return true;
    }

    // 2. Verifica se é um novo comando de emissão natural (texto ou áudio transcrito)
    const cmd = interpretarComandoEmissaoNfse(limpo) || (await interpretarComandoEmissaoComIA(limpo));
    if (!cmd) return false;

    const empresa = await localizarEmpresaPorChat(params.rawJid, params.cleanPhone, params.isGroup);
    if (!empresa || !empresa.nfseConfig) {
      await params.enviarMensagem(
        params.sendJid,
        '⚠️ Não identifiquei uma empresa ativa para emissão de NFS-e vinculada a este WhatsApp/grupo.'
      );
      return true;
    }

    // Busca tomador nas notas anteriores da empresa (puxa CNPJ, serviço e retenções automaticamente)
    const digBusca = apenasDigitos(cmd.tomadorBusca);
    const notasAnteriores = await db.nfsE.findMany({
      where: { empresaId: empresa.id, status: 'emitida' },
      orderBy: { dataEmissao: 'desc' },
      take: 150,
    });

    const termo = cmd.tomadorBusca.toLowerCase();
    const notaBase = notasAnteriores.find((n) => {
      if (digBusca.length >= 11 && apenasDigitos(n.tomadorCnpjCpf) === digBusca) return true;
      return (n.tomadorRazaoSocial || '').toLowerCase().includes(termo);
    });

    let tomadorNome = notaBase?.tomadorRazaoSocial || '';
    let tomadorDocumento = notaBase?.tomadorCnpjCpf || '';
    let tomadorEmail = notaBase?.tomadorEmail || null;
    const ultimaNotaQualquer = notasAnteriores[0];

    if (!notaBase) {
      const clientes = await db.cliente.findMany({ where: { empresaId: empresa.id }, take: 200 });
      const cli = clientes.find(
        (c) =>
          (digBusca.length >= 11 && apenasDigitos(c.cpfCnpj) === digBusca) ||
          c.nome.toLowerCase().includes(termo)
      );
      if (cli) {
        tomadorNome = cli.nome;
        tomadorDocumento = cli.cpfCnpj;
        tomadorEmail = cli.email || null;
      }
    }

    if (!tomadorNome || !tomadorDocumento) {
      await params.enviarMensagem(
        params.sendJid,
        `⚠️ Não encontrei o tomador *"${cmd.tomadorBusca}"* no histórico de notas ou clientes de *${empresa.nomeFantasia || empresa.razaoSocial}*.\nEnvie o nome exato de um cliente já atendido ou o CNPJ/CPF dele.`
      );
      return true;
    }

    const codigoServico = notaBase?.codigoServico || ultimaNotaQualquer?.codigoServico || '';
    const municipioPrestacao = notaBase?.municipioPrestacao || empresa.nfseConfig.codigoMunicipio || '';
    const descricao = cmd.descricao || notaBase?.discriminacao || 'Prestação de serviços conforme contrato.';
    const aliquotaIss = Number(notaBase?.aliquotaIss || 0);
    const issRetido = Boolean(notaBase?.issRetido);

    if (!codigoServico) {
      await params.enviarMensagem(
        params.sendJid,
        '⚠️ Esta empresa ainda não possui um código de serviço padrão no histórico. Emita a primeira nota pelo painel web.'
      );
      return true;
    }

    await ensureRascunhosTable();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.$executeRawUnsafe(
      `INSERT INTO nfse_whatsapp_rascunhos (jid, empresa_id, dados_json, expires_at, created_at)
       VALUES ($1, $2, $3::jsonb, $4, NOW())
       ON CONFLICT (jid) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, dados_json = EXCLUDED.dados_json, expires_at = EXCLUDED.expires_at`,
      params.sendJid,
      empresa.id,
      JSON.stringify({
        empresaId: empresa.id,
        tomadorNome,
        tomadorDocumento,
        tomadorEmail,
        codigoServico,
        municipioPrestacao,
        descricao,
        valorServicos: cmd.valor,
        aliquotaIss,
        issRetido,
      }),
      expiresAt
    );

    const branding = await obterBrandingDaEmpresa(empresa.id);
    const assinatura = branding ? `\n\n_${branding.nome}_` : '';

    await params.enviarMensagem(
      params.sendJid,
      [
        `🧾 *Prévia da NFS-e — Confirme para emitir*`,
        '',
        `• *Prestador:* ${empresa.nomeFantasia || empresa.razaoSocial}`,
        `• *Tomador:* ${tomadorNome} (${tomadorDocumento})`,
        `• *Valor:* ${fmtBRL(cmd.valor)}`,
        `• *Serviço:* ${descricao}`,
        `• *Cód. Serviço:* ${codigoServico}${issRetido ? ' (ISS Retido)' : ''}`,
        '',
        `👉 Responda *SIM* nos próximos 15 minutos para emitir oficialmente ou *NÃO* para cancelar.${assinatura}`,
      ].join('\n')
    );
    return true;
  } catch (err) {
    console.error('[WhatsApp Emissor NFS-e] Erro:', err);
    return false;
  }
}
