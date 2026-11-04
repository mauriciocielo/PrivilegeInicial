import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../lib/nfse/servidor';
import { hojeBrasilia } from '../../../../lib/nfse/dps';
import { UFS } from '../../../../lib/certidoes/portais-estaduais';
import { ORIGEM_ANEXO, TAMANHO_MAX_PDF, situacoesAnexo, statusValidade } from '../../../../lib/certidoes/situacao';

/** Guarda a CND (federal ou estadual) que a pessoa emitiu no portal oficial. Só armazena: não atesta a autenticidade. */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId : '';
    if (!empresaId) return NextResponse.json({ error: 'Selecione a empresa.' }, { status: 400 });

    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const tipo = body?.tipo === 'FEDERAL' ? 'FEDERAL' : 'ESTADUAL';
    // Federal cobre o país inteiro (uf = BR); estadual precisa de uma UF válida.
    let uf = 'BR';
    if (tipo === 'ESTADUAL') {
      uf = typeof body?.uf === 'string' ? body.uf.trim().toUpperCase() : '';
      if (!UFS.includes(uf)) return NextResponse.json({ error: 'Selecione o estado da certidão.' }, { status: 422 });
    }

    const situacao = typeof body?.situacao === 'string' ? body.situacao : '';
    if (!situacoesAnexo(tipo)[situacao]) return NextResponse.json({ error: 'Selecione a situação que consta na certidão.' }, { status: 422 });

    const validoAte = typeof body?.validoAte === 'string' ? body.validoAte : '';
    const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(validoAte) && !Number.isNaN(Date.parse(`${validoAte}T12:00:00Z`));
    // Certidão positiva pode não trazer validade; as demais sempre trazem.
    if (situacao === 'POSITIVA' ? validoAte !== '' && !dataValida : !dataValida) {
      return NextResponse.json({ error: 'Informe a data de validade que consta na certidão.' }, { status: 422 });
    }
    if (dataValida && statusValidade(validoAte, hojeBrasilia()).status === 'vencida') {
      return NextResponse.json({ error: `Esta certidão já está vencida. Emita uma nova no portal ${tipo === 'FEDERAL' ? 'da Receita' : 'do estado'}.` }, { status: 422 });
    }

    const pdfBase64 = typeof body?.pdfBase64 === 'string' ? body.pdfBase64 : '';
    const pdf = Buffer.from(pdfBase64, 'base64');
    if (pdf.length === 0 || pdf.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return NextResponse.json({ error: 'O arquivo precisa ser um PDF.' }, { status: 422 });
    }
    if (pdf.length > TAMANHO_MAX_PDF) return NextResponse.json({ error: 'O PDF precisa ter no máximo 3 MB.' }, { status: 413 });

    const nomeArquivo = typeof body?.nomeArquivo === 'string' ? body.nomeArquivo.slice(0, 150) : 'certidao.pdf';
    const registro = await db.certidaoFiscal.create({
      data: {
        empresaId,
        tipo,
        uf,
        situacao,
        emitidoEm: new Date(),
        validoAte: dataValida ? new Date(`${validoAte}T12:00:00Z`) : null,
        pdfBase64,
        observacoes: `Anexada por ${auth.session.email}`,
        pendencias: { origem: ORIGEM_ANEXO, usuarioId: auth.session.userId, nomeArquivo },
      },
      select: { id: true },
    });
    return NextResponse.json({ sucesso: true, id: registro.id });
  } catch (error) {
    console.error('Erro em POST /api/certidoes/anexar:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao guardar a certidão.' }, { status: 500 });
  }
}
