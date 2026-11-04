import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../../lib/nfse/servidor';
import { interpretarDocumento } from '../../../../../lib/nfe/distribuicao';
import { apenasDigitos } from '../../../../../lib/nfse/dps';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const empresaId = body?.empresaId || '';
    if (!empresaId) return NextResponse.json({ error: 'Informe a empresa.' }, { status: 400 });

    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const xmls: string[] = Array.isArray(body?.xmls) ? body.xmls : [];
    if (xmls.length === 0) return NextResponse.json({ error: 'Nenhum XML enviado.' }, { status: 400 });

    let importadas = 0;
    let atualizadas = 0;

    for (const xml of xmls) {
      if (!xml || typeof xml !== 'string') continue;
      const doc = interpretarDocumento('procNFe', xml);
      if (!doc || (doc.tipo !== 'completa' && doc.tipo !== 'resumo')) continue;

      const nota = doc.nota;
      const chave = { empresaId_chaveAcesso: { empresaId, chaveAcesso: nota.chave } };
      const existente = await db.nfeDestinada.findUnique({ where: chave, select: { id: true, possuiXml: true } });

      const dados = {
        numero: nota.numero,
        serie: nota.serie,
        emitenteCnpj: apenasDigitos(nota.emitenteCnpj),
        emitenteNome: nota.emitenteNome,
        emitenteIe: nota.emitenteIe,
        dataEmissao: nota.dataEmissao,
        tipoOperacao: nota.tipoOperacao,
        valorNf: nota.valorNf,
        situacao: nota.situacao,
        protocolo: nota.protocolo,
        possuiXml: true,
        xml,
      };

      if (!existente) {
        await db.nfeDestinada.create({
          data: {
            empresaId,
            chaveAcesso: nota.chave,
            nsu: '0',
            ...dados,
          },
        });
        importadas++;
      } else {
        await db.nfeDestinada.update({
          where: chave,
          data: dados,
        });
        atualizadas++;
      }
    }

    return NextResponse.json({
      ok: true,
      importadas,
      atualizadas,
      total: importadas + atualizadas,
      mensagem: `${importadas} nota(s) importada(s) com sucesso${atualizadas > 0 ? ` e ${atualizadas} atualizada(s)` : ''}!`,
    });
  } catch (error) {
    console.error('Erro em POST nfe/destinadas/importar:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao importar XMLs de NF-e.' }, { status: 500 });
  }
}

