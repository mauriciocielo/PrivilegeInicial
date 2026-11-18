import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import logoNfse from './dados/logo-nfse.json';
import { apenasDigitos } from './dps';
import { gerarDanfsePdf, lerDadosDanfse, marcaDaguaDaNota, urlConsultaPublica } from './danfse';

const DEFAULT_SMTP_HOST = 'mail.privilegecontabilidade.cnt.br';
const DEFAULT_SMTP_PORT = 465;
const DEFAULT_SMTP_USER = 'consultoria@privilegecontabilidade.cnt.br';
const DEFAULT_SMTP_PASS = '@Karen1702';

async function buscarEmailReceitaCnpj(cnpjLimpo: string): Promise<string | null> {
  if (cnpjLimpo.length !== 14) return null;

  const tentar = async (url: string): Promise<string | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
      return email && email.includes('@') ? email : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  return (
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
    const smtpHost = process.env.SMTP_HOST?.includes('.cnt.br')
      ? process.env.SMTP_HOST
      : DEFAULT_SMTP_HOST;
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

    await transporter.sendMail({
      from: `"Privilege Consultoria" <${smtpUser}>`,
      to: destinatarios.join(', '),
      subject: `NFS-e nº ${numLimpo} — ${params.prestadorNome}`,
      text:
        `Olá, ${params.tomadorNome || 'Cliente'}!\n\n` +
        `Segue em anexo a Nota Fiscal de Serviço Eletrônica (NFS-e) nº ${numLimpo}, emitida em ${params.dataEmissao} no valor líquido de ${valorFmt} por ${params.prestadorNome}.\n\n` +
        `Arquivos anexos: DANFSe (PDF) e XML oficial.\n\n` +
        `NFS-e emitida por PRIVILEGE CONSULTORIA LTDA`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
          <div style="background: #600000; color: #ffffff; padding: 16px 20px; border-radius: 8px; margin-bottom: 18px;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85;">Privilege Consultoria Ltda</div>
            <h2 style="margin: 4px 0 0; font-size: 18px;">Nota Fiscal de Serviço Eletrônica (NFS-e nº ${numLimpo})</h2>
          </div>
          <p style="font-size: 14px; color: #1f2937;">Olá, <strong>${params.tomadorNome || 'Cliente'}</strong>!</p>
          <p style="font-size: 14px; color: #374151; line-height: 1.6;">
            Segue em anexo a <strong>NFS-e nº ${numLimpo}</strong> (DANFSe em PDF e arquivo XML oficial), emitida por <strong>${params.prestadorNome}</strong>.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13.5px; color: #1e293b;">
            <div><strong>Data de Emissão:</strong> ${params.dataEmissao}</div>
            <div><strong>Valor Líquido:</strong> ${valorFmt}</div>
          </div>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 18px 0;" />
          <p style="font-size: 11.5px; color: #6b7280; text-align: center; margin: 0;">
            NFS-e emitida por PRIVILEGE CONSULTORIA LTDA
          </p>
        </div>
      `,
      attachments: [
        { filename: `DANFSe_${numLimpo}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
        { filename: `NFSe_${numLimpo}.xml`, content: Buffer.from(params.nfseXml, 'utf8'), contentType: 'application/xml' },
      ],
    });

    return { enviado: true, destinatarios };
  } catch (err: any) {
    console.error('Falha ao enviar e-mail automático da NFS-e:', err?.message || err);
    return { enviado: false, destinatarios: [], motivo: err?.message || 'Erro ao enviar e-mail' };
  }
}
