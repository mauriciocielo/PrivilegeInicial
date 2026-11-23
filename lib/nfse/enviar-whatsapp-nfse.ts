import QRCode from 'qrcode';
import db from '../prisma';
import logoNfse from './dados/logo-nfse.json';
import { apenasDigitos } from './dps';
import { gerarDanfsePdf, lerDadosDanfse, marcaDaguaDaNota, urlConsultaPublica } from './danfse';
import {
  bootAllSavedBaileysSessions,
  ensureBaileysConnected,
  getBaileysSocketForOwner,
  listarSessoesBaileysAtivas,
  sendBaileysLiveMessage,
} from '../baileys-manager';

const NUMERO_ADMIN_PADRAO = '46999800010';

export interface ResultadoWhatsappNfse {
  enviado: boolean;
  ownerId?: string;
  motivo?: string;
}

/**
 * Localiza a sessão Baileys conectada correspondente ao número do administrador
 * (padrão 46999800010). Faz fallback para qualquer sessão de administrador conectada.
 */
export async function encontrarSessaoAdminPorNumero(
  numeroAlvo = NUMERO_ADMIN_PADRAO,
  ownerIdPreferencial?: string
): Promise<string | null> {
  const ult8 = apenasDigitos(numeroAlvo).slice(-8);

  const buscarEmMemoria = (): string | null => {
    const ativas = listarSessoesBaileysAtivas();
    let fallbackConectada: string | null = null;

    for (const s of ativas) {
      if (!s.connected && !s.userId) continue;
      const digitsSessao = s.userId.split(':')[0].replace(/\D/g, '');
      if (ult8 && digitsSessao.endsWith(ult8)) {
        return s.ownerId;
      }
      if (ownerIdPreferencial && s.ownerId === ownerIdPreferencial) {
        fallbackConectada = s.ownerId;
      } else if (!fallbackConectada) {
        fallbackConectada = s.ownerId;
      }
    }

    return fallbackConectada;
  };

  let encontrada = buscarEmMemoria();
  if (encontrada) return encontrada;

  // Caso ainda não tenha subido ou esteja reconectando, inicializa e aguarda abrir
  const booted = await bootAllSavedBaileysSessions().catch(() => [] as string[]);
  const candidatos = new Set<string>();
  if (ownerIdPreferencial) candidatos.add(ownerIdPreferencial);
  candidatos.add('default');
  candidatos.add('default_linha2');
  for (const b of booted) candidatos.add(b);
  for (const s of listarSessoesBaileysAtivas()) candidatos.add(s.ownerId);

  try {
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM whatsapp_config WHERE status = 'conectado'`
    );
    for (const r of rows) {
      if (r.id) candidatos.add(r.id);
    }
  } catch {
    // ignora
  }

  // Aguarda conexão real (sock?.user?.id) para cada candidato
  for (const ownerId of candidatos) {
    let sock = getBaileysSocketForOwner(ownerId);
    if (!sock?.user?.id) {
      sock = await ensureBaileysConnected(true, ownerId).catch(() => null);
    }
    const userId = String(sock?.user?.id || '');
    if (!userId) continue;
    const digitsSessao = userId.split(':')[0].replace(/\D/g, '');
    if (ult8 && digitsSessao.endsWith(ult8)) {
      return ownerId;
    }
    if (!encontrada) encontrada = ownerId;
  }

  return encontrada || buscarEmMemoria();
}

function limparNomeArquivo(texto: string): string {
  return (texto || 'Cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36) || 'Cliente';
}

export async function enviarNfsePorWhatsAppAoEmissor(params: {
  telefoneDestino: string;
  numero: string;
  dataEmissao: string;
  prestadorNome: string;
  tomadorNome: string;
  valorLiquido: number;
  nfseXml: string;
  ambiente: string;
}): Promise<ResultadoWhatsappNfse> {
  try {
    const digits = apenasDigitos(params.telefoneDestino);
    if (digits.length < 10) {
      return { enviado: false, motivo: 'Número de WhatsApp de destino inválido.' };
    }
    const telefone = digits.startsWith('55') ? digits : `55${digits}`;

    const ownerId = await encontrarSessaoAdminPorNumero(NUMERO_ADMIN_PADRAO);
    if (!ownerId) {
      return { enviado: false, motivo: 'WhatsApp 46 99980-0010 não está conectado no momento.' };
    }

    const dados = lerDadosDanfse(params.nfseXml);
    const qrText = dados.chave && dados.chave !== '-' ? urlConsultaPublica(dados.chave) : '';
    const qrPng = qrText
      ? await QRCode.toBuffer(qrText, { errorCorrectionLevel: 'M', margin: 0, width: 140 }).catch(() => Buffer.alloc(0))
      : Buffer.alloc(0);
    const logoPng = Buffer.from(logoNfse.png, 'base64');

    const pdfBytes = gerarDanfsePdf(dados, {
      logoPng,
      qrPng,
      marcaDagua: marcaDaguaDaNota('emitida', null),
    });
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    const valorFmt = Number(params.valorLiquido || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const dataFmt = /^\d{4}-\d{2}-\d{2}$/.test(params.dataEmissao)
      ? `${params.dataEmissao.slice(8, 10)}/${params.dataEmissao.slice(5, 7)}/${params.dataEmissao.slice(0, 4)}`
      : params.dataEmissao;

    const legenda = [
      `✅ *NFS-e nº ${params.numero || 'Emitida'}*${params.ambiente !== 'producao' ? ' (HOMOLOGAÇÃO)' : ''}`,
      ``,
      `• *Prestador:* ${params.prestadorNome}`,
      `• *Tomador:* ${params.tomadorNome}`,
      `• *Valor Líquido:* ${valorFmt}`,
      `• *Emissão:* ${dataFmt}`,
      ``,
      `Segue o PDF oficial (DANFSe) pronto para encaminhar ao cliente.`,
    ].join('\n');

    const fileName = `NFSe_${params.numero || 'emitida'}_${limparNomeArquivo(params.tomadorNome)}.pdf`;

    const res = await sendBaileysLiveMessage(
      telefone,
      legenda,
      {
        mediaType: 'document',
        mediaUrl: `data:application/pdf;base64,${pdfBase64}`,
        fileName,
        mimeType: 'application/pdf',
      },
      ownerId
    );

    if (!res?.sent) {
      return { enviado: false, ownerId, motivo: 'Falha ao entregar o PDF no WhatsApp.' };
    }

    return { enviado: true, ownerId };
  } catch (err) {
    console.error('[NFS-e WhatsApp] Erro ao enviar PDF ao emissor:', err);
    return { enviado: false, motivo: 'Erro interno ao enviar PDF no WhatsApp.' };
  }
}
