import db from './prisma';
import { encontrarSessaoAdminPorNumero } from './nfse/enviar-whatsapp-nfse';
import { listarSessoesBaileysAtivas, sendBaileysLiveMessage } from './baileys-manager';

export const TELEFONE_ALERTA_CERTIFICADO_PADRAO =
  (process.env.CERTIFICADO_ALERTA_WHATSAPP || '4630351018').replace(/\D/g, '') || '4630351018';

export interface CertificadoEmAtencao {
  chave: string;
  tipo: 'escritorio' | 'empresa';
  nome: string;
  cnpj?: string;
  titular?: string;
  validoAte: string; // YYYY-MM-DD
  validoAteBr: string; // DD/MM/YYYY
  dias: number;
  vencido: boolean;
}

let tabelaGarantida = false;
let ultimaExecucaoMs = 0;

async function ensureTabelaAlertasCertificado() {
  if (tabelaGarantida) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS certificado_alertas_enviados (
      cert_chave TEXT NOT NULL,
      marco TEXT NOT NULL,
      valido_ate TEXT NOT NULL,
      destino TEXT NOT NULL,
      enviado_em TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (cert_chave, marco, valido_ate)
    )
  `);
  tabelaGarantida = true;
}

export function normalizarTelefoneCertificado(raw?: string): string {
  const digits = String(raw || TELEFONE_ALERTA_CERTIFICADO_PADRAO).replace(/\D/g, '');
  if (!digits) return `55${TELEFONE_ALERTA_CERTIFICADO_PADRAO}`;
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function formatarDataBr(d: Date): string {
  const iso = d.toISOString().slice(0, 10);
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Coleta o certificado A1 do escritório e todos os certificados A1 próprios das empresas
 * que já estão vencidos ou vencem nos próximos 30 dias.
 */
export async function coletarCertificadosEmAtencao(): Promise<CertificadoEmAtencao[]> {
  const agora = new Date();
  const em30Dias = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);
  const itens: CertificadoEmAtencao[] = [];

  try {
    const certEsc = await db.nfseCertificadoEscritorio.findFirst({
      select: { titular: true, documento: true, validoAte: true },
    });
    if (certEsc?.validoAte && certEsc.validoAte <= em30Dias) {
      const diffDias = Math.ceil((certEsc.validoAte.getTime() - agora.getTime()) / (24 * 60 * 60 * 1000));
      itens.push({
        chave: 'escritorio',
        tipo: 'escritorio',
        nome: 'Certificado A1 do Escritório (Procuração)',
        cnpj: certEsc.documento || undefined,
        titular: certEsc.titular || undefined,
        validoAte: certEsc.validoAte.toISOString().slice(0, 10),
        validoAteBr: formatarDataBr(certEsc.validoAte),
        dias: Math.max(0, diffDias),
        vencido: certEsc.validoAte < agora,
      });
    }
  } catch {
    // ignora erro pontual
  }

  try {
    const certsEmp = await db.nfseConfig.findMany({
      where: { usarProcuracao: false, certValidoAte: { lte: em30Dias } },
      select: {
        empresaId: true,
        certTitular: true,
        certCnpj: true,
        certValidoAte: true,
        empresa: { select: { nomeFantasia: true, razaoSocial: true, cnpj: true } },
      },
      orderBy: { certValidoAte: 'asc' },
    });

    for (const c of certsEmp) {
      if (!c.certValidoAte) continue;
      const diffDias = Math.ceil((c.certValidoAte.getTime() - agora.getTime()) / (24 * 60 * 60 * 1000));
      itens.push({
        chave: `empresa:${c.empresaId}`,
        tipo: 'empresa',
        nome: c.empresa?.nomeFantasia || c.empresa?.razaoSocial || 'Empresa',
        cnpj: c.certCnpj || c.empresa?.cnpj || undefined,
        titular: c.certTitular || undefined,
        validoAte: c.certValidoAte.toISOString().slice(0, 10),
        validoAteBr: formatarDataBr(c.certValidoAte),
        dias: Math.max(0, diffDias),
        vencido: c.certValidoAte < agora,
      });
    }
  } catch {
    // ignora erro pontual
  }

  return itens.sort((a, b) => a.validoAte.localeCompare(b.validoAte));
}

function formatarDocumento(doc?: string): string {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return doc || '';
}

export function montarMensagemAlertaCertificados(itens: CertificadoEmAtencao[]): string {
  const vencidos = itens.filter(i => i.vencido);
  const vencendo = itens.filter(i => !i.vencido);

  const linhas: string[] = [
    `🔐 *Aviso de Certificados Digitais A1*`,
    `Privilege Contabilidade`,
    ``,
  ];

  if (itens.length === 0) {
    linhas.push(`✅ Todos os certificados digitais A1 monitorados estão válidos e em dia.`);
  } else {
    if (vencidos.length > 0) {
      linhas.push(`🔴 *Vencidos (${vencidos.length}):*`);
      for (const c of vencidos) {
        const docFmt = formatarDocumento(c.cnpj);
        linhas.push(`🏢 *${c.nome}*${docFmt ? `\n   • CNPJ: ${docFmt}` : ''}\n   • 📅 Vencido em *${c.validoAteBr}*`);
      }
      linhas.push(``);
    }

    if (vencendo.length > 0) {
      linhas.push(`⚠️ *Vencendo em até 30 dias (${vencendo.length}):*`);
      for (const c of vencendo) {
        const docFmt = formatarDocumento(c.cnpj);
        const prazo = c.dias === 0 ? 'vence hoje' : c.dias === 1 ? 'vence amanhã' : `vence em ${c.dias} dias`;
        linhas.push(`🏢 *${c.nome}*${docFmt ? `\n   • CNPJ: ${docFmt}` : ''}\n   • 📅 ${prazo} (*${c.validoAteBr}*)`);
      }
      linhas.push(``);
    }

    linhas.push(`📌 Providencie a renovação para evitar interrupção na emissão e consulta de notas fiscais.`);
  }

  linhas.push(``, `_Monitoramento Automático • Privilege Contabilidade_`);
  return linhas.join('\n');
}

function definirMarco(item: CertificadoEmAtencao): string | null {
  if (item.vencido) return 'vencido';
  if (item.dias <= 1) return '1d';
  if (item.dias <= 3) return '3d';
  if (item.dias <= 7) return '7d';
  if (item.dias <= 15) return '15d';
  if (item.dias <= 30) return '30d';
  return null;
}

/**
 * Disparo imediato (manual/teste) do relatório de certificados A1 para o WhatsApp configurado
 * (padrão: 4630351018), utilizando a sessão oficial 46999800010.
 */
export async function enviarAlertaCertificadosWhatsApp(
  telefoneOpcional?: string,
  ownerIdPreferencial?: string
): Promise<{
  ok: boolean;
  enviadoPara?: string;
  quantidade?: number;
  erro?: string;
}> {
  const destino = normalizarTelefoneCertificado(telefoneOpcional);
  const ownerId = await encontrarSessaoAdminPorNumero('46999800010', ownerIdPreferencial);
  if (!ownerId) {
    const ativas = listarSessoesBaileysAtivas().map(s => `${s.ownerId}:${s.connected ? 'on' : 'off'}`).join(', ');
    return {
      ok: false,
      erro: `Nenhuma sessão Baileys conectada no servidor no momento (${ativas || '0 sessões em memória'}). Verifique o painel WhatsApp ou reconecte o QR Code.`,
    };
  }

  const itens = await coletarCertificadosEmAtencao();
  const mensagem = montarMensagemAlertaCertificados(itens);
  const res = await sendBaileysLiveMessage(destino, mensagem, undefined, ownerId);

  if (!res?.sent) {
    return { ok: false, erro: `Sessão "${ownerId}" localizada, mas o WhatsApp recusou o envio para ${destino}.` };
  }

  return { ok: true, enviadoPara: destino, quantidade: itens.length };
}

/**
 * Rotina automática 24h (acionada pelo daemon a cada 30s, com throttle de 30 min):
 * verifica certificados A1 vencidos ou vencendo em 30, 15, 7, 3 e 1 dia(s) e envia
 * um único aviso consolidado no WhatsApp 4630351018 (a partir das 08h de Brasília).
 */
export async function processarAlertasCertificados24h(): Promise<{ enviados: number }> {
  const agoraMs = Date.now();
  if (agoraMs - ultimaExecucaoMs < 30 * 60 * 1000) {
    return { enviados: 0 };
  }
  ultimaExecucaoMs = agoraMs;

  // Só dispara em horário comercial (entre 08h e 19h no horário de Brasília)
  const horaBrasilia = new Date(agoraMs - 3 * 3600 * 1000).getUTCHours();
  if (horaBrasilia < 8 || horaBrasilia >= 19) {
    return { enviados: 0 };
  }

  const itens = await coletarCertificadosEmAtencao();
  if (itens.length === 0) return { enviados: 0 };

  await ensureTabelaAlertasCertificado();
  const destino = normalizarTelefoneCertificado();

  const pendentes: Array<{ item: CertificadoEmAtencao; marco: string }> = [];
  for (const item of itens) {
    const marco = definirMarco(item);
    if (!marco) continue;

    const jaEnviado = await db.$queryRawUnsafe<Array<{ cert_chave: string }>>(
      `SELECT cert_chave FROM certificado_alertas_enviados
        WHERE cert_chave = $1 AND marco = $2 AND valido_ate = $3
        LIMIT 1`,
      item.chave,
      marco,
      item.validoAte
    );
    if (jaEnviado.length === 0) {
      pendentes.push({ item, marco });
    }
  }

  if (pendentes.length === 0) return { enviados: 0 };

  const ownerId = await encontrarSessaoAdminPorNumero('46999800010');
  if (!ownerId) return { enviados: 0 };

  const mensagem = montarMensagemAlertaCertificados(pendentes.map(p => p.item));
  const res = await sendBaileysLiveMessage(destino, mensagem, undefined, ownerId);
  if (!res?.sent) return { enviados: 0 };

  for (const { item, marco } of pendentes) {
    await db.$executeRawUnsafe(
      `INSERT INTO certificado_alertas_enviados (cert_chave, marco, valido_ate, destino)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (cert_chave, marco, valido_ate) DO NOTHING`,
      item.chave,
      marco,
      item.validoAte,
      destino
    );
  }

  return { enviados: pendentes.length };
}
