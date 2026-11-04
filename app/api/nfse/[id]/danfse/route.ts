import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import logoNfse from '../../../../../lib/nfse/dados/logo-nfse.json';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { acessoEmissaoNegado } from '../../../../../lib/nfse/servidor';
import { gerarDanfsePdf, lerDadosDanfse, marcaDaguaDaNota, urlConsultaPublica } from '../../../../../lib/nfse/danfse';

/** DANFSe em PDF, gerado do XML autorizado. Com ?baixar=1, força o download. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { id } = await params;

    const nota = await db.nfsE.findUnique({
      where: { id },
      select: { empresaId: true, status: true, chaveAcesso: true, documento: { select: { nfseXml: true, eventoXml: true } } },
    });
    if (!nota?.documento) return NextResponse.json({ error: 'O XML desta nota não está no sistema.' }, { status: 404 });
    const negado = await acessoEmissaoNegado(auth.session, nota.empresaId);
    if (negado) return negado;

    const dados = lerDadosDanfse(nota.documento.nfseXml);
    // A logo vai no código: a função na Netlify não enxerga a pasta public.
    const logoPng = Buffer.from(logoNfse.png, 'base64');
    const qrPng = await QRCode.toBuffer(urlConsultaPublica(dados.chave), { errorCorrectionLevel: 'M', margin: 0, width: 300 });
    const pdf = gerarDanfsePdf(dados, { logoPng, qrPng, marcaDagua: marcaDaguaDaNota(nota.status, nota.documento.eventoXml) });

    const baixar = new URL(request.url).searchParams.get('baixar') === '1';
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="DANFSe-${nota.chaveAcesso || id}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Erro em GET nfse/danfse:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao gerar o DANFSe.' }, { status: 500 });
  }
}
