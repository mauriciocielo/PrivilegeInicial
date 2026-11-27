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
  montarCancelamento,
  montarDps,
  validarEmissao,
  type AmbienteNfse,
  type DadosDps,
} from './dps';
import { abrirCredencial, configFiscal, resumirErros } from './servidor';
import { assinarXml } from './assinatura';
import { criarTransporteMtls, emitirNfse, registrarEvento } from './sefin';
import { gerarDanfsePdf, lerDadosDanfse, marcaDaguaDaNota, urlConsultaPublica } from './danfse';
import { obterBrandingDaEmpresa, idsEmpresasDoEscritorio, obterEscritorioDoUsuario } from './escritorios-terceiros';
import { enviarEmailNfseCancelada, enviarEmailNfseEmitida } from './enviar-email-nfse';
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

export interface PedidoEmissaoWhatsApp {
  valor: number;
  tomadorBusca: string;
  prestadorBusca?: string;
  documento?: string;
  email?: string;
  descricao: string;
}

const DESCRICAO_LC116_CURTA: Record<string, string> = {
  '0101': 'Análise e desenvolvimento de sistemas',
  '0107': 'Suporte técnico em informática',
  '0702': 'Execução de obras e construção civil',
  '0802': 'Instrução, treinamento e ensino',
  '1005': 'Agenciamento e intermediação de serviços',
  '1401': 'Manutenção e conservação de máquinas/equipamentos',
  '1701': 'Assessoria ou consultoria de qualquer natureza',
  '1702': 'Apoio administrativo e datilografia',
  '1712': 'Administração e serviços de escritório',
  '1719': 'Contabilidade e auditoria',
  '1720': 'Consultoria e assessoria econômica ou financeira',
  '2401': 'Serviços de chaveiro e confecção de chaves',
};

function formatarCodigoServico(cod: string): string {
  const d = apenasDigitos(cod);
  if (d.length === 6) return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 6)}`;
  if (d.length === 4) return `${d.slice(0, 2)}.${d.slice(2, 4)}`;
  return cod.trim();
}

function limparDescricaoMenu(cod: string, descOriginal?: string): string {
  const d4 = apenasDigitos(cod).slice(0, 4);
  if (DESCRICAO_LC116_CURTA[d4]) return DESCRICAO_LC116_CURTA[d4];
  const limpa = String(descOriginal || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\bchave\s*pix\s*:.*$/i, '')
    .replace(/\bid\s*opera[cç][aã]o\s*:.*$/i, '')
    .replace(/\bref(?:erente)?\.?\s*(?:a\s+)?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|[0-9]{2}\/[0-9]{4}).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (limpa || 'Serviço cadastrado').slice(0, 52);
}

function extrairPrestadorTexto(texto: string): string {
  const mLabel = texto.match(/\b(?:prestador|empresa\s+emissora|emissor)\s*[:=-]\s*([^\n]+)/i);
  if (mLabel?.[1]) return mLabel[1].trim();
  const mFrase = texto.match(/\b(?:pela\s+empresa|da\s+empresa|em\s+nome\s+da|pela)\s+([A-Za-zÀ-ÿ0-9 &.-]{3,45}?)(?=\s+(?:uma\s+nota|nota|nfse|de\s+r?\$?|no\s+valor|para|pro|pra)\b|[,\n]|$)/i);
  return mFrase?.[1]?.trim() || '';
}

function interpretarComandoCancelamento(textoBruto: string): {
  numero: string;
  motivo: string;
  prestadorBusca?: string;
} | null {
  const limpo = textoBruto.replace(/^\[[^\]]+\]:\s*/, '').trim();
  const m = limpo.match(/\b(?:cancel[ae]r?)\s+(?:a\s+)?(?:nfse|nfs-e|nota(?:\s+fiscal)?)\s*(?:n[º°o.]?\s*)?(\d{1,12})\b/i);
  if (!m) return null;
  const numero = m[1];
  const mMotivo = limpo.match(/\b(?:motivo|por|porque|justificativa)\s*[:=-]?\s*(.+)$/i);
  const motivo = (mMotivo?.[1] || 'Erro na emissão da nota fiscal de serviço').trim();
  const prestadorBusca = extrairPrestadorTexto(limpo) || undefined;
  return { numero, motivo: motivo.length >= 15 ? motivo : `${motivo} — cancelamento solicitado via WhatsApp`, prestadorBusca };
}

function extrairDocumentoTexto(texto: string): string {
  const mCnpj = texto.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/);
  if (mCnpj) return apenasDigitos(mCnpj[0]);
  const mCpf = texto.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
  if (mCpf) return apenasDigitos(mCpf[0]);
  return '';
}

function extrairEmailTexto(texto: string): string {
  const m = texto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0].toLowerCase() : '';
}

/**
 * Interpreta ficha estruturada enviada por escrito no WhatsApp, ex.:
 * Emitir nota
 * CNPJ: 12.345.678/0001-90
 * Nome: Empresa X (opcional se for CNPJ)
 * Valor: 2.500,00
 * Descrição: Consultoria mensal
 * E-mail: financeiro@empresa.com
 */
export function interpretarFichaEscritaNfse(textoBruto: string): PedidoEmissaoWhatsApp | null {
  const limpo = textoBruto.replace(/^\[[^\]]+\]:\s*/, '').trim();
  const temValorLabel = /\bvalor\s*[:=-]/i.test(limpo);
  const temDocOuNomeLabel = /\b(cnpj|cpf|tomador|cliente|nome)\s*[:=-]/i.test(limpo);
  if (!temValorLabel && !temDocOuNomeLabel) return null;

  const mVal = limpo.match(/\bvalor(?:\s+da\s+nota|\s+do\s+servi[cç]o)?\s*[:=-]\s*([^\n]+)/i);
  const valor = mVal ? parseValorMonetario(mVal[1]) : parseValorMonetario(limpo);
  if (valor <= 0) return null;

  const documento = extrairDocumentoTexto(limpo);
  const mNome = limpo.match(/\b(?:nome|tomador|cliente|raz[aã]o(?:\s+social)?)\s*[:=-]\s*([^\n]+)/i);
  const nome = (mNome?.[1] || '').replace(/\(.*?\)/g, '').trim();
  const mDesc = limpo.match(/\b(?:descri[cç][aã]o(?:\s+do\s+servi[cç]o)?|servi[cç]o|discrimina[cç][aã]o|referente)\s*[:=-]\s*([^\n]+)/i);
  const descricao = (mDesc?.[1] || '').trim();
  const email = extrairEmailTexto(limpo);

  const tomadorBusca = nome || documento;
  if (!tomadorBusca) return null;
  const prestadorBusca = extrairPrestadorTexto(limpo) || undefined;

  return {
    valor: Math.round(valor * 100) / 100,
    tomadorBusca,
    prestadorBusca,
    documento: documento || undefined,
    email: email || undefined,
    descricao,
  };
}

export function interpretarComandoEmissaoNfse(textoBruto: string): PedidoEmissaoWhatsApp | null {
  // 1. Primeiro tenta ficha estruturada por escrito (CNPJ:/Valor:/Descrição:)
  const ficha = interpretarFichaEscritaNfse(textoBruto);
  if (ficha) return ficha;

  // Remove prefixo de grupo "[Nome]: ..."
  const limpo = textoBruto.replace(/^\[[^\]]+\]:\s*/, '').trim();
  const gatilho = /(?:^\/emitir\b|\b(?:emit[aei]r?|faz(?:er)?|tir[ae]r?|ger[ae]r?|lan[cç][ae]r?)\s+(?:uma\s+)?(?:nfse|nfs-e|nota(?:\s+fiscal)?))/i;
  if (!gatilho.test(limpo)) return null;

  const valor = parseValorMonetario(limpo);
  if (valor <= 0) return null;

  const documento = extrairDocumentoTexto(limpo);
  const email = extrairEmailTexto(limpo);

  // Extrai tomador após "para", "pro", "pra" até "referente", "ref", "sobre", "servico" ou fim
  const mToma = limpo.match(/\b(?:para|pro|pra)\s+(?:a\s+|o\s+)?(.+?)(?=\s+(?:referente|ref\.?|sobre|servi[cç]o|desc(?:ri[cç][aã]o)?|no\s+valor)\b|$)/i);
  const tomadorBusca = (mToma?.[1] || documento || '').trim().replace(/[.,;]+$/, '');

  const mDesc = limpo.match(/\b(?:referente\s+a[o]?|referente|ref\.?|sobre|servi[cç]o(?:\s+de)?|desc(?:ri[cç][aã]o)?)\s+(.+)$/i);
  const descricao = (mDesc?.[1] || '').trim();

  if (!tomadorBusca) return null;
  const prestadorBusca = extrairPrestadorTexto(limpo) || undefined;
  return {
    valor: Math.round(valor * 100) / 100,
    tomadorBusca,
    prestadorBusca,
    documento: documento || undefined,
    email: email || undefined,
    descricao,
  };
}

/**
 * Fallback com IA para entender fala natural (especialmente áudios transcritos e mensagens livres),
 * como "Oi Léo, tira uma nota de dois mil e quinhentos pro Condomínio Solaris de manutenção".
 */
async function interpretarComandoEmissaoComIA(textoBruto: string): Promise<PedidoEmissaoWhatsApp | null> {
  const limpo = textoBruto.replace(/^\[[^\]]+\]:\s*/, '').trim();
  const parecePedidoNota =
    /\b(nota|nfse|nfs-e|faturar|emitir|emite|tira(?:r)?\s+uma\s+nota|faz(?:er)?\s+uma\s+nota)\b/i.test(limpo) &&
    limpo.length >= 12;
  if (!parecePedidoNota) return null;

  try {
    const ai = await generateText({
      jsonMode: true,
      maxTokens: 250,
      temperature: 0.1,
      timeoutMs: 10000,
      system:
        'Você extrai pedidos de emissão de Nota Fiscal de Serviço (NFS-e) de mensagens escritas ou áudios transcritos de WhatsApp. ' +
        'Se a mensagem NÃO for um pedido claro para emitir uma nota fiscal (ex.: apenas dúvida), retorne {"ehPedido": false}. ' +
        'Se FOR um pedido para emitir uma nota com dados, retorne {"ehPedido": true, "valor": numero_float, "tomador": "nome do cliente/tomador ou vazio", "documento": "apenas digitos do CNPJ ou CPF se informado ou vazio", "email": "email se informado ou vazio", "descricao": "descrição do serviço ou vazio"}. ' +
        'Converta valores por extenso (ex.: "dois mil e quinhentos") para número (2500).',
      prompt: limpo,
    });
    if (!ai.text) return null;
    const parsed = JSON.parse(ai.text);
    if (!parsed?.ehPedido) return null;
    const valor = Math.round((Number(parsed.valor) || 0) * 100) / 100;
    const documento = apenasDigitos(String(parsed.documento || '')) || extrairDocumentoTexto(limpo);
    const tomadorBusca = String(parsed.tomador || '').trim() || documento;
    const descricao = String(parsed.descricao || '').trim();
    const email = String(parsed.email || '').trim().toLowerCase() || extrairEmailTexto(limpo);
    if (valor <= 0 || !tomadorBusca) return null;
    return {
      valor,
      tomadorBusca,
      documento: documento || undefined,
      email: email || undefined,
      descricao,
    };
  } catch {
    return null;
  }
}

async function consultarRazaoReceitaCnpj(cnpj14: string): Promise<{ razaoSocial: string; email: string | null } | null> {
  if (cnpj14.length !== 14) return null;
  const tentar = async (url: string) => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'PortalFiscal/1.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(4500),
      });
      if (!res.ok) return null;
      const d = await res.json().catch(() => null);
      const razao = String(d?.razao_social || d?.nome || '').trim();
      if (!razao) return null;
      const emailRaw = String(d?.email || d?.estabelecimento?.email || '').trim().toLowerCase();
      return { razaoSocial: razao, email: emailRaw.includes('@') ? emailRaw : null };
    } catch {
      return null;
    }
  };
  return (
    (await tentar(`https://brasilapi.com.br/api/cnpj/v1/${cnpj14}`)) ||
    (await tentar(`https://minhareceita.org/${cnpj14}`)) ||
    (await tentar(`https://receitaws.com.br/v1/cnpj/${cnpj14}`))
  );
}

async function localizarEmpresaPorChat(
  rawJid: string,
  cleanPhone: string,
  isGroup: boolean,
  prestadorBusca?: string
) {
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

  // Se o remetente é um usuário (admin ou contador parceiro) e informou "pela empresa X", busca na carteira dele!
  const usuarios = await db.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, role: true, phone: true, empresaIds: true },
  });
  const usuario = usuarios.find((u) => apenasDigitos(u.phone || '').endsWith(ult8));

  if (usuario && prestadorBusca) {
    const q = prestadorBusca.toLowerCase().trim();
    const qDig = apenasDigitos(prestadorBusca);
    let permitidas = candidatas;
    if (usuario.role !== 'administrador') {
      const vinculo = await obterEscritorioDoUsuario(usuario.id);
      const idsEsc = vinculo ? await idsEmpresasDoEscritorio(vinculo.escritorioId) : [];
      const setPerm = new Set([...(usuario.empresaIds || []), ...idsEsc]);
      permitidas = candidatas.filter((e) => setPerm.has(e.id));
    }
    const escolhida = permitidas.find(
      (e) =>
        (qDig.length === 14 && apenasDigitos(e.cnpj) === qDig) ||
        e.razaoSocial.toLowerCase().includes(q) ||
        (e.nomeFantasia || '').toLowerCase().includes(q)
    );
    if (escolhida) return escolhida;
  }

  const porTelefoneEmpresa = candidatas.find((e) => apenasDigitos(e.telefone).endsWith(ult8));
  if (porTelefoneEmpresa) return porTelefoneEmpresa;

  if (!usuario) return null;

  if (Array.isArray(usuario.empresaIds) && usuario.empresaIds.length > 0) {
    const empUsuario = candidatas.find((e) => usuario.empresaIds.includes(e.id));
    if (empUsuario) return empUsuario;
  }

  // Para administrador (ex.: Maurício Cielo), prioriza a empresa Privilege Consultoria (58.033.979/0001-84) ou a primeira ativa
  if (usuario.role === 'administrador') {
    return (
      candidatas.find((e) => apenasDigitos(e.cnpj) === '58033979000184') ||
      candidatas[0] ||
      null
    );
  }

  return null;
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

    // 1. Verifica se há rascunho pendente para este chat (escolha de código de serviço OU confirmação SIM)
    await ensureRascunhosTable();
    const rascunhoRows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM nfse_whatsapp_rascunhos WHERE jid = $1 AND expires_at > NOW() LIMIT 1`,
      params.sendJid
    );
    const rascunho = rascunhoRows[0];

    if (rascunho) {
      if (ehCancelamento) {
        await db.$executeRawUnsafe(`DELETE FROM nfse_whatsapp_rascunhos WHERE jid = $1`, params.sendJid);
        await params.enviarMensagem(params.sendJid, '❌ Emissão de NFS-e cancelada conforme solicitado.');
        return true;
      }

      const dadosSalvos = rascunho.dados_json as {
        etapa?: 'escolher_servico' | 'confirmar' | 'confirmar_cancelamento';
        notaId?: string;
        numeroNota?: string;
        motivoCancelamento?: string;
        empresaId: string;
        empresaNome?: string;
        tomadorNome: string;
        tomadorDocumento: string;
        tomadorEmail: string | null;
        codigoServico: string;
        municipioPrestacao: string;
        descricao: string;
        valorServicos: number;
        aliquotaIss: number;
        issRetido: boolean;
        opcoesServico?: Array<{ codigo: string; descricao: string; aliquotaIss: number; issRetido: boolean }>;
      };

      // Confirmação de CANCELAMENTO de NFS-e via WhatsApp
      if (dadosSalvos.etapa === 'confirmar_cancelamento' && ehConfirmacao && dadosSalvos.notaId) {
        await db.$executeRawUnsafe(`DELETE FROM nfse_whatsapp_rascunhos WHERE jid = $1`, params.sendJid);
        const nota = await db.nfsE.findUnique({
          where: { id: dadosSalvos.notaId },
          include: { documento: true },
        });
        if (!nota || !nota.chaveAcesso || nota.status === 'cancelada') {
          await params.enviarMensagem(params.sendJid, '⚠️ Esta nota não pode ser cancelada ou já está cancelada.');
          return true;
        }
        const cfg = await db.nfseConfig.findUnique({ where: { empresaId: nota.empresaId } });
        if (!cfg) {
          await params.enviarMensagem(params.sendJid, '⚠️ Configuração fiscal da empresa não encontrada.');
          return true;
        }
        const aberta = await abrirCredencial(cfg);
        if ('erro' in aberta) {
          await params.enviarMensagem(params.sendJid, `⚠️ Certificado indisponível: ${aberta.erro}`);
          return true;
        }
        const ambiente = (nota.ambiente === 'producao' ? 'producao' : 'homologacao') as AmbienteNfse;
        const justificativa = dadosSalvos.motivoCancelamento || 'Erro na emissão da nota fiscal de serviço';
        const pedido = montarCancelamento({
          chave: nota.chaveAcesso,
          cnpjAutor: nota.prestadorCnpj,
          motivo: 1,
          justificativa,
          ambiente,
          modo: 'direto',
        });
        const assinado = assinarXml(pedido.xml, 'infPedReg', pedido.id, aberta.credencial);
        const resCanc = await registrarEvento(criarTransporteMtls(ambiente, aberta.credencial), nota.chaveAcesso, assinado);

        if (!resCanc.ok && !resCanc.erros.some((e) => e.codigo === 'E0840')) {
          const msgErro = resumirErros(resCanc.erros, resCanc.mensagem, cfg.usarProcuracao);
          await params.enviarMensagem(params.sendJid, `❌ Não foi possível cancelar no Sefin Nacional:\n${msgErro}`);
          return true;
        }

        const motivoFinal = `Erro na emissão: ${justificativa}`;
        await db.nfsE.update({
          where: { id: nota.id },
          data: {
            status: 'cancelada',
            motivoCancelamento: motivoFinal,
            cancelamentoEmAnalise: false,
            ...(resCanc.ok ? { documento: { update: { eventoXml: resCanc.eventoXml } } } : {}),
          },
        });

        await registrarAuditoriaEscritorio({
          userId: 'whatsapp-bot',
          userNome: `WhatsApp (${params.cleanPhone})`,
          acao: 'nfse_cancelada',
          empresaId: nota.empresaId,
          empresaNome: nota.prestadorRazaoSocial,
          detalhes: `Cancelou NFS-e nº ${nota.numero} via WhatsApp (${motivoFinal})`,
        });

        enviarEmailNfseCancelada({
          empresaId: nota.empresaId,
          numero: nota.numero,
          dataEmissao: nota.dataEmissao,
          prestadorNome: nota.prestadorRazaoSocial,
          tomadorNome: nota.tomadorRazaoSocial,
          tomadorDocumento: nota.tomadorCnpjCpf,
          tomadorEmail: nota.tomadorEmail,
          valorLiquido: Number(nota.valorLiquido || nota.valorServicos || 0),
          motivoCancelamento: motivoFinal,
          chaveAcesso: nota.chaveAcesso,
          nfseXml: nota.documento?.nfseXml || null,
          eventoXml: resCanc.ok ? resCanc.eventoXml : null,
          ambiente,
        }).catch(() => {});

        await params.enviarMensagem(
          params.sendJid,
          `✅ *NFS-e nº ${nota.numero} cancelada oficialmente!* O cliente também foi comunicado por e-mail.`
        );
        return true;
      }

      // Etapa intermediária: aguardando o usuário escolher qual código de serviço emitir
      if (dadosSalvos.etapa === 'escolher_servico') {
        const opcoes = Array.isArray(dadosSalvos.opcoesServico) ? dadosSalvos.opcoesServico : [];
        let codigoEscolhido = '';
        let aliquotaEscolhida = dadosSalvos.aliquotaIss || 0;
        let issRetidoEscolhido = Boolean(dadosSalvos.issRetido);

        // 1a. Respondeu com o número da opção do menu (ex.: "1", "2", "opção 1", "um", "primeira", "dois", "segunda")
        const mapaExtenso: Record<string, number> = {
          um: 1, uma: 1, primeiro: 1, primeira: 1,
          dois: 2, duas: 2, segundo: 2, segunda: 2,
          tres: 3, três: 3, terceiro: 3, terceira: 3,
          quatro: 4, quarto: 4, quarta: 4,
          cinco: 5, quinto: 5, quinta: 5,
          seis: 6, sexto: 6, sexta: 6,
          sete: 7, setimo: 7, sétimo: 7, setima: 7, sétima: 7,
          oito: 8, oitavo: 8, oitava: 8,
        };
        const mNum = limpo.match(/^(?:a\s+|o\s+)?(?:op[cç][aã]o\s*|n[uú]mero\s*)?(\d{1,2})\b/i);
        let idxEscolhido = mNum ? Number(mNum[1]) - 1 : -1;
        if (idxEscolhido < 0) {
          const palavras = limpo.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/);
          for (const p of palavras) {
            if (mapaExtenso[p]) {
              idxEscolhido = mapaExtenso[p] - 1;
              break;
            }
          }
        }
        if (idxEscolhido >= 0 && idxEscolhido < opcoes.length) {
          codigoEscolhido = opcoes[idxEscolhido].codigo;
          aliquotaEscolhida = opcoes[idxEscolhido].aliquotaIss;
          issRetidoEscolhido = opcoes[idxEscolhido].issRetido;
        }

        // 1b. Ou digitou/falou um código de serviço diretamente (ex.: "17.01.01", "07.02", "170101")
        if (!codigoEscolhido) {
          const mCod = limpo.match(/\b(\d{2}\.?\d{2}(?:\.?\d{2})?)\b/);
          if (mCod) {
            const digitsCod = apenasDigitos(mCod[1]);
            const pad = digitsCod.length === 4 ? `${digitsCod}01` : digitsCod;
            const matchOpcao = opcoes.find((o) => apenasDigitos(o.codigo) === digitsCod || apenasDigitos(o.codigo) === pad);
            codigoEscolhido = matchOpcao ? matchOpcao.codigo : pad;
            if (matchOpcao) {
              aliquotaEscolhida = matchOpcao.aliquotaIss;
              issRetidoEscolhido = matchOpcao.issRetido;
            }
          }
        }

        // 1c. Ou falou/escreveu parte da descrição do serviço do menu (ex.: "o de consultoria", "manutenção")
        if (!codigoEscolhido && opcoes.length > 0) {
          const tokens = limpo
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .split(/[^a-z0-9]+/)
            .filter((t) => t.length >= 4 && !['codigo', 'servico', 'emitir', 'nota', 'opcao', 'pode', 'usar', 'esse', 'essa'].includes(t));
          if (tokens.length > 0) {
            const matchDesc = opcoes.find((o) => {
              const descNorm = o.descricao.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              return tokens.some((t) => descNorm.includes(t));
            });
            if (matchDesc) {
              codigoEscolhido = matchDesc.codigo;
              aliquotaEscolhida = matchDesc.aliquotaIss;
              issRetidoEscolhido = matchDesc.issRetido;
            }
          }
        }

        if (!codigoEscolhido) {
          await params.enviarMensagem(
            params.sendJid,
            opcoes.length > 0
              ? `Não entendi qual serviço escolher. Você pode responder o *número do menu* (1 a ${opcoes.length}), digitar o *código* (ex.: 17.01.01) ou falar/escrever o *nome do serviço*. Para cancelar, responda *NÃO*.`
              : `Informe o *código de serviço* desejado por texto ou áudio (ex.: 17.01.01 ou 07.02.01). Para cancelar, responda *NÃO*.`
          );
          return true;
        }

        const atualizado = {
          ...dadosSalvos,
          etapa: 'confirmar' as const,
          codigoServico: codigoEscolhido,
          aliquotaIss: aliquotaEscolhida,
          issRetido: issRetidoEscolhido,
        };
        const novoExpira = new Date(Date.now() + 15 * 60 * 1000);
        await db.$executeRawUnsafe(
          `UPDATE nfse_whatsapp_rascunhos SET dados_json = $2::jsonb, expires_at = $3 WHERE jid = $1`,
          params.sendJid,
          JSON.stringify(atualizado),
          novoExpira
        );

        const branding = await obterBrandingDaEmpresa(dadosSalvos.empresaId);
        const assinatura = branding ? `\n\n_${branding.nome}_` : '';
        await params.enviarMensagem(
          params.sendJid,
          [
            `🧾 *Prévia da NFS-e — Confirme para emitir*`,
            '',
            `• *Prestador:* ${dadosSalvos.empresaNome || 'Empresa'}`,
            `• *Tomador:* ${dadosSalvos.tomadorNome} (${dadosSalvos.tomadorDocumento})`,
            `• *Valor:* ${fmtBRL(dadosSalvos.valorServicos)}`,
            `• *Cód. Serviço:* ${codigoEscolhido}${issRetidoEscolhido ? ' (ISS Retido)' : ''}`,
            `• *Serviço:* ${dadosSalvos.descricao}`,
            '',
            `👉 Responda *SIM* para emitir oficialmente agora ou *NÃO* para cancelar.${assinatura}`,
          ].join('\n')
        );
        return true;
      }

      if (ehConfirmacao) {
        // Confirmado: emite oficialmente no Sefin Nacional!
        await db.$executeRawUnsafe(`DELETE FROM nfse_whatsapp_rascunhos WHERE jid = $1`, params.sendJid);

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
        dataCompetencia: hoje.slice(0, 7),
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
    }

    // 2. Verifica se é um pedido de CANCELAMENTO de NFS-e via WhatsApp
    const cmdCanc = interpretarComandoCancelamento(limpo);
    if (cmdCanc) {
      const empCanc = await localizarEmpresaPorChat(params.rawJid, params.cleanPhone, params.isGroup, cmdCanc.prestadorBusca);
      if (!empCanc || !empCanc.nfseConfig) {
        await params.enviarMensagem(params.sendJid, '⚠️ Não identifiquei a empresa emissora vinculada a este WhatsApp.');
        return true;
      }
      const notaAlvo = await db.nfsE.findFirst({
        where: { empresaId: empCanc.id, numero: cmdCanc.numero, status: 'emitida' },
        orderBy: { dataEmissao: 'desc' },
      });
      if (!notaAlvo) {
        await params.enviarMensagem(
          params.sendJid,
          `⚠️ Não encontrei a NFS-e nº *${cmdCanc.numero}* com status emitida em *${empCanc.nomeFantasia || empCanc.razaoSocial}*.`
        );
        return true;
      }
      await ensureRascunhosTable();
      const expCanc = new Date(Date.now() + 15 * 60 * 1000);
      await db.$executeRawUnsafe(
        `INSERT INTO nfse_whatsapp_rascunhos (jid, empresa_id, dados_json, expires_at, created_at)
         VALUES ($1, $2, $3::jsonb, $4, NOW())
         ON CONFLICT (jid) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, dados_json = EXCLUDED.dados_json, expires_at = EXCLUDED.expires_at`,
        params.sendJid,
        empCanc.id,
        JSON.stringify({
          etapa: 'confirmar_cancelamento',
          notaId: notaAlvo.id,
          numeroNota: notaAlvo.numero,
          motivoCancelamento: cmdCanc.motivo,
          empresaId: empCanc.id,
          empresaNome: empCanc.nomeFantasia || empCanc.razaoSocial,
          tomadorNome: notaAlvo.tomadorRazaoSocial,
          tomadorDocumento: notaAlvo.tomadorCnpjCpf,
          tomadorEmail: notaAlvo.tomadorEmail,
          codigoServico: notaAlvo.codigoServico,
          municipioPrestacao: notaAlvo.municipioPrestacao || '',
          descricao: notaAlvo.discriminacao,
          valorServicos: notaAlvo.valorServicos,
          aliquotaIss: notaAlvo.aliquotaIss,
          issRetido: notaAlvo.issRetido,
        }),
        expCanc
      );
      await params.enviarMensagem(
        params.sendJid,
        [
          `⚠️ *Confirmar CANCELAMENTO da NFS-e nº ${notaAlvo.numero}?*`,
          '',
          `• *Prestador:* ${empCanc.nomeFantasia || empCanc.razaoSocial}`,
          `• *Tomador:* ${notaAlvo.tomadorRazaoSocial}`,
          `• *Valor:* ${fmtBRL(notaAlvo.valorServicos)}`,
          `• *Motivo:* ${cmdCanc.motivo}`,
          '',
          `👉 Responda *SIM* para cancelar oficialmente no Sefin Nacional ou *NÃO* para desistir.`,
        ].join('\n')
      );
      return true;
    }

    // 3. Verifica se é um novo comando de emissão natural (ficha escrita, frase livre ou áudio transcrito)
    const cmd = interpretarComandoEmissaoNfse(limpo) || (await interpretarComandoEmissaoComIA(limpo));

    // Se o cliente pediu para emitir nota mas ainda não passou os dados, envia o modelo pronto para preencher!
    if (!cmd) {
      const pedeModelo = /^(?:quero\s+|preciso\s+|pode\s+)?(?:emitir|emite|tirar|fazer|gerar)\s+(?:uma\s+)?(?:nfse|nfs-e|nota(?:\s+fiscal)?)\s*[!?.\s]*$/i.test(limpo);
      if (!pedeModelo) return false;

      const empresaModelo = await localizarEmpresaPorChat(params.rawJid, params.cleanPhone, params.isGroup);
      if (!empresaModelo?.nfseConfig) return false;

      await params.enviarMensagem(
        params.sendJid,
        [
          `📝 *Emitir NFS-e pelo WhatsApp*`,
          `Você pode mandar um *áudio* falando os dados ou copiar e preencher por escrito abaixo:`,
          '',
          `Emitir nota`,
          `CNPJ ou CPF: `,
          `Nome (se for CPF): `,
          `Valor: R$ `,
          `Descrição do serviço: `,
          `E-mail do cliente (opcional): `,
        ].join('\n')
      );
      return true;
    }

    const empresa = await localizarEmpresaPorChat(params.rawJid, params.cleanPhone, params.isGroup, cmd.prestadorBusca);
    if (!empresa || !empresa.nfseConfig) {
      await params.enviarMensagem(
        params.sendJid,
        '⚠️ Não identifiquei uma empresa ativa para emissão de NFS-e vinculada a este WhatsApp/grupo.'
      );
      return true;
    }

    // Busca tomador nas notas anteriores da empresa (puxa CNPJ, serviço e retenções automaticamente)
    const digBusca = cmd.documento || apenasDigitos(cmd.tomadorBusca);
    const notasAnteriores = await db.nfsE.findMany({
      where: { empresaId: empresa.id, status: 'emitida' },
      orderBy: { dataEmissao: 'desc' },
      take: 150,
    });

    const termo = cmd.tomadorBusca.toLowerCase();
    const notaBase = notasAnteriores.find((n) => {
      if (digBusca.length >= 11 && apenasDigitos(n.tomadorCnpjCpf) === digBusca) return true;
      return termo.length >= 3 && (n.tomadorRazaoSocial || '').toLowerCase().includes(termo);
    });

    let tomadorNome = notaBase?.tomadorRazaoSocial || '';
    let tomadorDocumento = notaBase?.tomadorCnpjCpf || '';
    let tomadorEmail = cmd.email || notaBase?.tomadorEmail || null;
    const ultimaNotaQualquer = notasAnteriores[0];

    if (!notaBase) {
      const clientes = await db.cliente.findMany({ where: { empresaId: empresa.id }, take: 200 });
      const cli = clientes.find(
        (c) =>
          (digBusca.length >= 11 && apenasDigitos(c.cpfCnpj) === digBusca) ||
          (termo.length >= 3 && c.nome.toLowerCase().includes(termo))
      );
      if (cli) {
        tomadorNome = cli.nome;
        tomadorDocumento = cli.cpfCnpj;
        tomadorEmail = cmd.email || cli.email || null;
      }
    }

    // Se for um CNPJ NOVO (14 dígitos) enviado por escrito/áudio, busca a Razão Social direto na Receita Federal!
    if ((!tomadorNome || !tomadorDocumento) && digBusca.length === 14) {
      const rf = await consultarRazaoReceitaCnpj(digBusca);
      if (rf?.razaoSocial) {
        tomadorNome = rf.razaoSocial;
        tomadorDocumento = digBusca;
        tomadorEmail = cmd.email || rf.email || null;
      } else if (cmd.tomadorBusca && apenasDigitos(cmd.tomadorBusca) !== digBusca) {
        tomadorNome = cmd.tomadorBusca;
        tomadorDocumento = digBusca;
      }
    }

    // Se for um CPF NOVO (11 dígitos) + Nome informados por escrito/áudio, aceita diretamente!
    if ((!tomadorNome || !tomadorDocumento) && digBusca.length === 11) {
      const nomeLimpo = cmd.tomadorBusca.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, '').replace(/\bcpf\b/i, '').trim();
      if (nomeLimpo.length >= 3) {
        tomadorNome = nomeLimpo;
        tomadorDocumento = digBusca;
      }
    }

    if (!tomadorNome || !tomadorDocumento) {
      await params.enviarMensagem(
        params.sendJid,
        `⚠️ Não encontrei o tomador *"${cmd.tomadorBusca}"* no histórico de *${empresa.nomeFantasia || empresa.razaoSocial}*.\n\nPara emitir para um cliente novo, envie por escrito informando o *CNPJ* (ou *CPF + Nome*):\n\nEmitir nota\nCNPJ ou CPF: \nNome (se for CPF): \nValor: R$ ${cmd.valor.toFixed(2).replace('.', ',')}\nDescrição: ${cmd.descricao || 'Prestação de serviços'}`
      );
      return true;
    }

    const municipioPrestacao = notaBase?.municipioPrestacao || empresa.nfseConfig.codigoMunicipio || '';
    const descricao = cmd.descricao || notaBase?.discriminacao || 'Prestação de serviços conforme contrato.';
    const aliquotaIss = Number(notaBase?.aliquotaIss || 0);
    const issRetido = Boolean(notaBase?.issRetido);

    // Monta lista de códigos de serviço conhecidos da empresa (config + histórico de notas)
    const mapaServicos = new Map<string, { codigo: string; descricao: string; aliquotaIss: number; issRetido: boolean }>();
    const conhecidos = Array.isArray(empresa.nfseConfig.servicosConhecidos)
      ? (empresa.nfseConfig.servicosConhecidos as any[])
      : [];
    for (const s of conhecidos) {
      const cod = String(s?.cTribNac || s?.codigo || '').trim();
      if (!cod || mapaServicos.has(cod)) continue;
      mapaServicos.set(cod, {
        codigo: cod,
        descricao: limparDescricaoMenu(cod, s?.descricao || s?.xDescServ),
        aliquotaIss: Number(s?.aliquotaIss || aliquotaIss || 0),
        issRetido: Boolean(s?.issRetido),
      });
    }
    for (const n of notasAnteriores) {
      const cod = String(n.codigoServico || '').trim();
      if (!cod || mapaServicos.has(cod)) continue;
      mapaServicos.set(cod, {
        codigo: cod,
        descricao: limparDescricaoMenu(cod, n.discriminacao),
        aliquotaIss: Number(n.aliquotaIss || 0),
        issRetido: Boolean(n.issRetido),
      });
      if (mapaServicos.size >= 8) break;
    }

    const opcoesServico = Array.from(mapaServicos.values());

    await ensureRascunhosTable();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.$executeRawUnsafe(
      `INSERT INTO nfse_whatsapp_rascunhos (jid, empresa_id, dados_json, expires_at, created_at)
       VALUES ($1, $2, $3::jsonb, $4, NOW())
       ON CONFLICT (jid) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, dados_json = EXCLUDED.dados_json, expires_at = EXCLUDED.expires_at`,
      params.sendJid,
      empresa.id,
      JSON.stringify({
        etapa: 'escolher_servico',
        empresaId: empresa.id,
        empresaNome: empresa.nomeFantasia || empresa.razaoSocial,
        tomadorNome,
        tomadorDocumento,
        tomadorEmail,
        codigoServico: notaBase?.codigoServico || opcoesServico[0]?.codigo || '',
        municipioPrestacao,
        descricao,
        valorServicos: cmd.valor,
        aliquotaIss,
        issRetido,
        opcoesServico,
      }),
      expiresAt
    );

    const branding = await obterBrandingDaEmpresa(empresa.id);
    const assinatura = branding ? `\n\n_${branding.nome}_` : '';

    const linhasOpcoes = opcoesServico.map(
      (op, idx) => `*${idx + 1}* — \`${formatarCodigoServico(op.codigo)}\` (${op.descricao})`
    );

    await params.enviarMensagem(
      params.sendJid,
      [
        `🧾 *Qual código de serviço deseja usar nesta NFS-e?*`,
        '',
        `• *Prestador:* ${empresa.nomeFantasia || empresa.razaoSocial}`,
        `• *Tomador:* ${tomadorNome} (${tomadorDocumento})`,
        `• *Valor:* ${fmtBRL(cmd.valor)}`,
        `• *Descrição:* ${descricao}`,
        '',
        ...(linhasOpcoes.length > 0
          ? [
              `Menu de serviços da empresa:`,
              ...linhasOpcoes,
              '',
              `👉 Responda pelo *menu* (ex.: *1*), digite o *código* (ex.: *17.01.01*) ou mande por *áudio/escrito* (ex.: "opção um" ou "o de consultoria"). Para cancelar, responda *NÃO*.${assinatura}`,
            ]
          : [
              `👉 Responda por *texto ou áudio* informando o *código de serviço* desejado (ex.: *17.01.01* ou *07.02.01*). Para cancelar, responda *NÃO*.${assinatura}`,
            ]),
      ].join('\n')
    );
    return true;
  } catch (err) {
    console.error('[WhatsApp Emissor NFS-e] Erro:', err);
    return false;
  }
}
