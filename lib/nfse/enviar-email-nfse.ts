import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import logoNfse from './dados/logo-nfse.json';
import { apenasDigitos } from './dps';
import { gerarDanfsePdf, lerDadosDanfse, marcaDaguaDaNota, urlConsultaPublica } from './danfse';
import { obterBrandingDaEmpresa } from './escritorios-terceiros';

function dataUrlParaBuffer(dataUrl?: string | null): { buffer: Buffer; contentType: string; ext: string } | null {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const contentType = m[1];
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  try {
    return { buffer: Buffer.from(m[2], 'base64'), contentType, ext };
  } catch {
    return null;
  }
}

const DEFAULT_SMTP_HOST = 'email-ssl.com.br';
const DEFAULT_SMTP_PORT = 465;
const DEFAULT_SMTP_USER = 'consultoria@privilegecontabilidade.cnt.br';
const DEFAULT_SMTP_PASS = '@Karen1702';

async function buscarEmailReceitaCnpj(cnpjLimpo: string): Promise<string | null> {
  if (cnpjLimpo.length !== 14) return null;

  const tentar = async (url: string): Promise<string | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'User-Agent': 'PrivilegeContabilidade/1.0', Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      const raw = data?.estabelecimento?.email || data?.email || '';
      const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
      return email && email.includes('@') ? email : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  return (
    (await tentar(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`)) ||
    (await tentar(`https://receitaws.com.br/v1/cnpj/${cnpjLimpo}`)) ||
    (await tentar(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`)) ||
    (await tentar(`https://minhareceita.org/${cnpjLimpo}`))
  );
}

export interface ResultadoEmailNfse {
  enviado: boolean;
  destinatarios: string[];
  motivo?: string;
}

export async function enviarEmailNfseEmitida(params: {
  empresaId?: string;
  numero: string;
  dataEmissao: string;
  prestadorNome: string;
  tomadorNome: string;
  tomadorDocumento: string;
  tomadorEmail?: string | null;
  valorLiquido: number;
  nfseXml: string;
  ambiente: string;
}): Promise<ResultadoEmailNfse> {
  try {
    if (params.ambiente !== 'producao') {
      return { enviado: false, destinatarios: [], motivo: 'Ambiente de homologação.' };
    }

    const cnpjTomador = apenasDigitos(params.tomadorDocumento || '');
    const emailReceita = await buscarEmailReceitaCnpj(cnpjTomador);
    const emailNota = typeof params.tomadorEmail === 'string' ? params.tomadorEmail.trim().toLowerCase() : '';

    const destinatarios = Array.from(
      new Set([emailReceita, emailNota].filter((e): e is string => Boolean(e && e.includes('@'))))
    );

    if (destinatarios.length === 0) {
      return { enviado: false, destinatarios: [], motivo: 'Nenhum e-mail encontrado no CNPJ da Receita ou na nota.' };
    }

    const smtpUser = DEFAULT_SMTP_USER;
    const smtpPass = DEFAULT_SMTP_PASS;
    const smtpHost = DEFAULT_SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT) || DEFAULT_SMTP_PORT;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const dados = lerDadosDanfse(params.nfseXml);
    const qrText = dados.chave ? urlConsultaPublica(dados.chave) : '';
    const qrPng = qrText
      ? await QRCode.toBuffer(qrText, { errorCorrectionLevel: 'M', margin: 0, width: 140 }).catch(() => Buffer.alloc(0))
      : Buffer.alloc(0);
    const logoPng = Buffer.from(logoNfse.png, 'base64');
    const pdfBuffer = gerarDanfsePdf(dados, {
      logoPng,
      qrPng,
      marcaDagua: marcaDaguaDaNota('emitida', null),
    });

    const numLimpo = (params.numero || 'SN').replace(/\D/g, '') || 'SN';
    const valorFmt = params.valorLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const linkPortal = dados.chave ? urlConsultaPublica(dados.chave) : '';

    const brandingParceiro = params.empresaId ? await obterBrandingDaEmpresa(params.empresaId) : null;
    const ehParceiro = Boolean(brandingParceiro);
    const corPrimaria = brandingParceiro?.corPrimaria || '#600000';
    const corSecundaria = brandingParceiro?.corSecundaria || (ehParceiro ? corPrimaria : '#8c1a22');
    const nomeMarca = brandingParceiro?.nome || 'Privilege Consultoria';
    const logoParceiroImg = dataUrlParaBuffer(brandingParceiro?.logoData);

    let emailLogoBuffer: Buffer | null = null;
    let emailLogoType = 'image/png';
    let emailLogoName = 'logo-escritorio.png';

    if (ehParceiro) {
      if (logoParceiroImg) {
        emailLogoBuffer = logoParceiroImg.buffer;
        emailLogoType = logoParceiroImg.contentType;
        emailLogoName = `logo-escritorio.${logoParceiroImg.ext}`;
      }
    } else {
      for (const candidate of ['privilege-logo-email.png', 'privilege-email-logo.png', 'logo.png']) {
        try {
          const p = path.join(process.cwd(), 'public', candidate);
          if (fs.existsSync(p)) {
            emailLogoBuffer = fs.readFileSync(p);
            break;
          }
        } catch {
          // tenta o próximo
        }
      }
    }

    const attachments: Array<{ filename: string; content: Buffer; contentType: string; cid?: string }> = [
      { filename: `DANFSe_${numLimpo}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
      { filename: `NFSe_${numLimpo}.xml`, content: Buffer.from(params.nfseXml, 'utf8'), contentType: 'application/xml' },
    ];
    if (emailLogoBuffer) {
      attachments.push({
        filename: emailLogoName,
        content: emailLogoBuffer,
        contentType: emailLogoType,
        cid: 'privilege-logo',
      });
    }

    const rodapeTexto = ehParceiro
      ? `NFS-e emitida por ${params.prestadorNome} · ${nomeMarca}${brandingParceiro?.telefone ? ` | Tel/WhatsApp: ${brandingParceiro.telefone}` : ''}`
      : `NFS-e emitida por ${params.prestadorNome} · Sistema PRIVILEGE CONSULTORIA LTDA\nSite: https://privilegecontabilidade.cnt.br | WhatsApp: (46) 99980-0010 (https://wa.me/5546999800010)`;

    const rodapeHtml = ehParceiro
      ? `<div style="font-size:12px;font-weight:700;color:${corPrimaria};margin-bottom:4px;">
           NFS-e emitida por ${params.prestadorNome}
         </div>
         <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">
           ${nomeMarca}${brandingParceiro?.telefone ? ` · ${brandingParceiro.telefone}` : ''}${brandingParceiro?.email ? ` · ${brandingParceiro.email}` : ''}
         </div>`
      : `<div style="font-size:12px;font-weight:700;color:#600000;margin-bottom:4px;">
           NFS-e emitida por ${params.prestadorNome}
         </div>
         <div style="font-size:11px;color:#6b7280;margin-bottom:10px;">
           Sistema fiscal disponibilizado por PRIVILEGE CONSULTORIA LTDA
         </div>
         <div style="margin-bottom:10px;">
           <a href="https://privilegecontabilidade.cnt.br" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 4px;padding:6px 12px;border-radius:6px;background:#ffffff;border:1px solid #d1d5db;color:#111827;text-decoration:none;font-size:11.5px;font-weight:600;">
             🌐 privilegecontabilidade.cnt.br
           </a>
           <a href="https://wa.me/5546999800010" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 4px;padding:6px 12px;border-radius:6px;background:#16a34a;color:#ffffff;text-decoration:none;font-size:11.5px;font-weight:700;">
             💬 WhatsApp (46) 99980-0010
           </a>
         </div>
         <div style="font-size:11px;color:#9ca3af;">
           E-mail enviado automaticamente pelo sistema fiscal · ${smtpUser}
         </div>`;

    await transporter.sendMail({
      from: `"${nomeMarca}" <${smtpUser}>`,
      to: destinatarios.join(', '),
      cc: ehParceiro ? (brandingParceiro?.email || undefined) : smtpUser,
      subject: `NFS-e nº ${numLimpo} — ${params.prestadorNome}`,
      text:
        `Olá, ${params.tomadorNome || 'Cliente'}!\n\n` +
        `Segue em anexo a Nota Fiscal de Serviço Eletrônica (NFS-e) nº ${numLimpo}, emitida em ${params.dataEmissao} no valor líquido de ${valorFmt} por ${params.prestadorNome}.\n\n` +
        `Arquivos anexos: DANFSe (PDF) e XML oficial.\n\n` +
        rodapeTexto,
      html: `
        <!doctype html>
        <html>
          <body style="margin:0;padding:24px 12px;background-color:#f3f4f6;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#111827;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
              <!-- Cabeçalho Institucional com Logo -->
              <tr>
                <td style="background:linear-gradient(135deg,${corPrimaria} 0%,${corSecundaria} 100%);padding:24px 28px;color:#ffffff;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="vertical-align:middle;">
                        ${
                          emailLogoBuffer
                            ? `<div style="display:inline-block;background:#ffffff;padding:8px 14px;border-radius:10px;margin-bottom:14px;">
                                 <img src="cid:privilege-logo" alt="${nomeMarca}" style="height:36px;width:auto;display:block;" />
                               </div>`
                            : ''
                        }
                        <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.85);">
                          Documento Fiscal Eletrônico • Autorizado
                        </div>
                        <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;line-height:1.25;">
                          NFS-e nº ${numLimpo}
                        </h1>
                      </td>
                      <td style="text-align:right;vertical-align:top;">
                        <span style="display:inline-block;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.28);color:#ffffff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;">
                          ✓ Emitida
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Saudação -->
              <tr>
                <td style="padding:26px 28px 10px;">
                  <p style="margin:0 0 12px;font-size:15px;color:#111827;">
                    Olá, <strong>${params.tomadorNome || 'Cliente'}</strong>!
                  </p>
                  <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.65;">
                    Informamos que a <strong>Nota Fiscal de Serviço Eletrônica (NFS-e) nº ${numLimpo}</strong> foi emitida e autorizada com sucesso por <strong>${params.prestadorNome}</strong>. Os arquivos oficiais seguem anexados a este e-mail.
                  </p>
                </td>
              </tr>

              <!-- Card Resumo da Nota -->
              <tr>
                <td style="padding:14px 28px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;">
                    <tr>
                      <td style="padding:6px 0;font-size:12.5px;color:#64748b;width:150px;">Prestador de Serviço</td>
                      <td style="padding:6px 0;font-size:13px;font-weight:700;color:#0f172a;">${params.prestadorNome}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:12.5px;color:#64748b;">Número da NFS-e</td>
                      <td style="padding:6px 0;font-size:13px;font-weight:700;color:#0f172a;">${numLimpo}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:12.5px;color:#64748b;">Data de Emissão</td>
                      <td style="padding:6px 0;font-size:13px;font-weight:600;color:#0f172a;">${params.dataEmissao}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0 4px;font-size:12.5px;color:#64748b;border-top:1px solid #e2e8f0;">Valor Líquido</td>
                      <td style="padding:10px 0 4px;font-size:18px;font-weight:800;color:${corPrimaria};border-top:1px solid #e2e8f0;">${valorFmt}</td>
                    </tr>
                    ${
                      dados.chave
                        ? `<tr>
                             <td style="padding:8px 0 0;font-size:11.5px;color:#64748b;">Chave de Acesso</td>
                             <td style="padding:8px 0 0;font-size:11px;font-family:monospace;color:#334155;word-break:break-all;">${dados.chave}</td>
                           </tr>`
                        : ''
                    }
                  </table>
                </td>
              </tr>

              <!-- Anexos e Botão Portal -->
              <tr>
                <td style="padding:8px 28px 24px;">
                  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin-bottom:18px;font-size:12.5px;color:#334155;">
                    📎 <strong>Anexos incluídos:</strong> DANFSe_${numLimpo}.pdf (Documento Auxiliar) e NFSe_${numLimpo}.xml (Arquivo Fiscal Oficial).
                  </div>
                  ${
                    linkPortal
                      ? `<div style="text-align:center;">
                           <a href="${linkPortal}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${corPrimaria};color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 24px;border-radius:8px;">
                             Consultar Autenticidade no Portal Nacional
                           </a>
                         </div>`
                      : ''
                  }
                </td>
              </tr>

              <!-- Rodapé -->
              <tr>
                <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 28px;text-align:center;">
                  ${rodapeHtml}
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
      attachments,
    });

    return { enviado: true, destinatarios };
  } catch (err: any) {
    console.error('Falha ao enviar e-mail automático da NFS-e:', err?.message || err);
    return { enviado: false, destinatarios: [], motivo: err?.message || 'Erro ao enviar e-mail' };
  }
}

export async function enviarEmailNfseCancelada(params: {
  numero: string;
  dataEmissao: string;
  prestadorNome: string;
  tomadorNome: string;
  tomadorDocumento: string;
  tomadorEmail?: string | null;
  valorLiquido: number;
  motivoCancelamento: string;
  chaveAcesso?: string | null;
  nfseXml?: string | null;
  eventoXml?: string | null;
  ambiente: string;
}): Promise<ResultadoEmailNfse> {
  try {
    if (params.ambiente !== 'producao') {
      return { enviado: false, destinatarios: [], motivo: 'Ambiente de homologação.' };
    }

    const cnpjTomador = apenasDigitos(params.tomadorDocumento || '');
    const emailReceita = await buscarEmailReceitaCnpj(cnpjTomador);
    const emailNota = typeof params.tomadorEmail === 'string' ? params.tomadorEmail.trim().toLowerCase() : '';

    const destinatarios = Array.from(
      new Set([emailReceita, emailNota].filter((e): e is string => Boolean(e && e.includes('@'))))
    );

    if (destinatarios.length === 0) {
      return { enviado: false, destinatarios: [], motivo: 'Nenhum e-mail encontrado no CNPJ da Receita ou na nota.' };
    }

    const smtpUser = DEFAULT_SMTP_USER;
    const smtpPass = DEFAULT_SMTP_PASS;
    const smtpHost = DEFAULT_SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT) || DEFAULT_SMTP_PORT;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false },
    });

    const numLimpo = (params.numero || 'SN').replace(/\D/g, '') || 'SN';
    const valorFmt = params.valorLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const linkPortal = params.chaveAcesso ? urlConsultaPublica(params.chaveAcesso) : '';

    let emailLogoBuffer: Buffer | null = null;
    for (const candidate of ['privilege-logo-email.png', 'privilege-email-logo.png', 'logo.png']) {
      try {
        const p = path.join(process.cwd(), 'public', candidate);
        if (fs.existsSync(p)) {
          emailLogoBuffer = fs.readFileSync(p);
          break;
        }
      } catch {}
    }

    const attachments: Array<{ filename: string; content: Buffer; contentType: string; cid?: string }> = [];

    // Se temos o XML da nota, gera a DANFSe com marca d'água CANCELADA
    if (params.nfseXml) {
      try {
        const dados = lerDadosDanfse(params.nfseXml);
        const qrText = dados.chave ? urlConsultaPublica(dados.chave) : '';
        const qrPng = qrText
          ? await QRCode.toBuffer(qrText, { errorCorrectionLevel: 'M', margin: 0, width: 140 }).catch(() => Buffer.alloc(0))
          : Buffer.alloc(0);
        const logoPng = Buffer.from(logoNfse.png, 'base64');
        const pdfCancelada = gerarDanfsePdf(dados, {
          logoPng,
          qrPng,
          marcaDagua: marcaDaguaDaNota('cancelada', null),
        });
        attachments.push({
          filename: `DANFSe_${numLimpo}_CANCELADA.pdf`,
          content: pdfCancelada,
          contentType: 'application/pdf',
        });
      } catch {}
    }

    if (params.eventoXml) {
      attachments.push({
        filename: `EventoCancelamento_NFSe_${numLimpo}.xml`,
        content: Buffer.from(params.eventoXml, 'utf8'),
        contentType: 'application/xml',
      });
    }

    if (emailLogoBuffer) {
      attachments.push({
        filename: 'privilege-logo.png',
        content: emailLogoBuffer,
        contentType: 'image/png',
        cid: 'privilege-logo',
      });
    }

    await transporter.sendMail({
      from: `"Privilege Consultoria" <${smtpUser}>`,
      to: destinatarios.join(', '),
      cc: smtpUser,
      subject: `CANCELAMENTO — NFS-e nº ${numLimpo} — ${params.prestadorNome}`,
      text:
        `Olá, ${params.tomadorNome || 'Cliente'}!\n\n` +
        `Informamos que a Nota Fiscal de Serviço Eletrônica (NFS-e) nº ${numLimpo}, emitida em ${params.dataEmissao} no valor líquido de ${valorFmt} por ${params.prestadorNome}, foi CANCELADA junto ao Sefin Nacional.\n\n` +
        `Motivo do cancelamento: ${params.motivoCancelamento}\n\n` +
        `Por favor, desconsidere a nota anterior (e eventual cobrança vinculada a ela).\n\n` +
        `Sistema PRIVILEGE CONSULTORIA LTDA · Site: https://privilegecontabilidade.cnt.br | WhatsApp: (46) 99980-0010`,
      html: `
        <!doctype html>
        <html>
          <body style="margin:0;padding:24px 12px;background-color:#f3f4f6;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#111827;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
              <tr>
                <td style="background:linear-gradient(135deg,#7f1d1d 0%,#991b1b 100%);padding:24px 28px;color:#ffffff;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="vertical-align:middle;">
                        ${
                          emailLogoBuffer
                            ? `<div style="display:inline-block;background:#ffffff;padding:8px 14px;border-radius:10px;margin-bottom:14px;">
                                 <img src="cid:privilege-logo" alt="Privilege Consultoria" style="height:36px;width:auto;display:block;" />
                               </div>`
                            : ''
                        }
                        <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#fecaca;">
                          Comunicado Fiscal Oficial • Nota Cancelada
                        </div>
                        <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;line-height:1.25;">
                          Cancelamento — NFS-e nº ${numLimpo}
                        </h1>
                      </td>
                      <td style="text-align:right;vertical-align:top;">
                        <span style="display:inline-block;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.35);color:#ffffff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;">
                          ✕ Cancelada
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:26px 28px;">
                  <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
                    Olá, <strong>${params.tomadorNome || 'Cliente'}</strong>!
                  </p>
                  <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#374151;">
                    Informamos que a Nota Fiscal de Serviço Eletrônica (<strong>NFS-e nº ${numLimpo}</strong>), emitida por <strong>${params.prestadorNome}</strong>, foi <strong>cancelada oficialmente</strong> no Sefin Nacional. Por favor, desconsidere o documento anterior.
                  </p>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin-bottom:18px;">
                    <tr>
                      <td style="padding:14px 16px;">
                        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#991b1b;margin-bottom:4px;">
                          Motivo do Cancelamento
                        </div>
                        <div style="font-size:14px;font-weight:600;color:#7f1d1d;line-height:1.5;">
                          ${params.motivoCancelamento}
                        </div>
                      </td>
                    </tr>
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:18px;font-size:13px;">
                    <tr style="background:#f9fafb;">
                      <td style="padding:9px 14px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Prestador</td>
                      <td style="padding:9px 14px;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">${params.prestadorNome}</td>
                    </tr>
                    <tr>
                      <td style="padding:9px 14px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Número da NFS-e</td>
                      <td style="padding:9px 14px;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">${numLimpo}</td>
                    </tr>
                    <tr style="background:#f9fafb;">
                      <td style="padding:9px 14px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Data de Emissão</td>
                      <td style="padding:9px 14px;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">${params.dataEmissao}</td>
                    </tr>
                    <tr>
                      <td style="padding:9px 14px;color:#6b7280;">Valor Líquido</td>
                      <td style="padding:9px 14px;font-weight:700;color:#991b1b;text-align:right;">${valorFmt}</td>
                    </tr>
                  </table>

                  ${
                    linkPortal
                      ? `<div style="text-align:center;margin:18px 0 6px;">
                           <a href="${linkPortal}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">
                             Consultar situação no Portal Nacional da NFS-e
                           </a>
                         </div>`
                      : ''
                  }
                </td>
              </tr>
              <tr>
                <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 28px;text-align:center;">
                  <div style="font-size:12px;font-weight:700;color:#600000;margin-bottom:4px;">
                    NFS-e cancelada por ${params.prestadorNome}
                  </div>
                  <div style="font-size:11px;color:#6b7280;margin-bottom:10px;">
                    Sistema fiscal disponibilizado por PRIVILEGE CONSULTORIA LTDA
                  </div>
                  <div style="margin-bottom:10px;">
                    <a href="https://privilegecontabilidade.cnt.br" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 4px;padding:6px 12px;border-radius:6px;background:#ffffff;border:1px solid #d1d5db;color:#111827;text-decoration:none;font-size:11.5px;font-weight:600;">
                      🌐 privilegecontabilidade.cnt.br
                    </a>
                    <a href="https://wa.me/5546999800010" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 4px;padding:6px 12px;border-radius:6px;background:#16a34a;color:#ffffff;text-decoration:none;font-size:11.5px;font-weight:700;">
                      💬 WhatsApp (46) 99980-0010
                    </a>
                  </div>
                  <div style="font-size:11px;color:#9ca3af;">
                    E-mail enviado automaticamente pelo sistema fiscal · ${smtpUser}
                  </div>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
      attachments,
    });

    return { enviado: true, destinatarios };
  } catch (err: any) {
    console.error('Falha ao enviar e-mail de cancelamento da NFS-e:', err?.message || err);
    return { enviado: false, destinatarios: [], motivo: err?.message || 'Erro ao enviar e-mail' };
  }
}
