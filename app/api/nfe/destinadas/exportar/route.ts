import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../../lib/nfse/servidor';
import { filtroNotasDestinadas } from '../../../../../lib/nfe/filtro';
import { gerarDanfePdf, gerarDanfePdfUnico, lerDadosDanfe, type DadosDanfe } from '../../../../../lib/nfe/danfe';
import { criarZipBuffer, type ArquivoZip } from '../../../../../lib/nfse/zip';

const FORMATOS = ['ambos', 'pdf', 'xml', 'pdf_unico'];
const LIMITE_NOTAS = 1000;
// A Vercel recusa respostas acima de 4,5 MB. Melhor explicar do que devolver um erro genérico.
const LIMITE_RESPOSTA = 4_200_000;

function limparNome(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'Nota';
}

/**
 * Exporta as notas com XML completo: as selecionadas (`ids`) ou as do filtro atual
 * (`mes`, `de`, `ate`, `situacao`, `busca`). Notas só com resumo não têm o que exportar:
 * entram na contagem do cabeçalho X-Notas-Sem-Xml, para a tela avisar.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => null);
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId : '';
    if (!empresaId) return NextResponse.json({ error: 'Informe a empresa.' }, { status: 400 });
    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const formato = FORMATOS.includes(body?.formato) ? body.formato : 'ambos';
    const ids: string[] | null = Array.isArray(body?.ids)
      ? body.ids.filter((i: unknown): i is string => typeof i === 'string').slice(0, LIMITE_NOTAS)
      : null;
    if (ids && ids.length === 0) return NextResponse.json({ error: 'Selecione ao menos uma nota.' }, { status: 422 });

    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: { cnpj: true, razaoSocial: true, nomeFantasia: true },
    });

    // A empresa fica sempre no filtro: um id de outra empresa simplesmente não é encontrado.
    const where = ids ? { empresaId, id: { in: ids } } : filtroNotasDestinadas(empresaId, { ...(body ?? {}), cnpjEmpresa: empresa?.cnpj });

    const [notas, semXml] = await Promise.all([
      db.nfeDestinada.findMany({
        where: { ...where, possuiXml: true, xml: { not: null } },
        select: { numero: true, chaveAcesso: true, dataEmissao: true, emitenteNome: true, situacao: true, xml: true },
        orderBy: [{ dataEmissao: 'asc' }, { numero: 'asc' }],
        take: LIMITE_NOTAS,
      }),
      db.nfeDestinada.count({ where: { ...where, possuiXml: false } }),
    ]);

    if (notas.length === 0) {
      return NextResponse.json(
        { error: semXml > 0
            ? `Nenhuma nota com XML completo: ${semXml} nota(s) só têm o resumo da SEFAZ, liberado para exportação depois da Manifestação do Destinatário.`
            : 'Nenhuma nota encontrada para exportar.' },
        { status: 404 },
      );
    }

    const referencia = ids ? 'Selecionadas' : (typeof body?.mes === 'string' && body.mes) || 'Filtro';
    const nomeBase = `NFe-${limparNome(empresa?.nomeFantasia || empresa?.razaoSocial || 'Empresa')}-${referencia}`;
    let comErro = 0;
    let corpo: Buffer;
    let tipo: string;
    let nomeArquivo: string;

    if (formato === 'pdf_unico') {
      const paginas: Array<{ dados: DadosDanfe; situacao: string }> = [];
      for (const n of notas) {
        try {
          paginas.push({ dados: lerDadosDanfe(n.xml as string), situacao: n.situacao });
        } catch {
          comErro++;
        }
      }
      if (paginas.length === 0) return NextResponse.json({ error: 'Nenhum XML pôde ser lido para gerar o PDF.' }, { status: 422 });
      corpo = gerarDanfePdfUnico(paginas);
      tipo = 'application/pdf';
      nomeArquivo = `${nomeBase}.pdf`;
    } else {
      const arquivos: ArquivoZip[] = [];
      const usados = new Set<string>();
      const nomeUnico = (base: string, ext: string) => {
        let nome = `${base}.${ext}`;
        for (let seq = 2; usados.has(nome); seq++) nome = `${base}_${seq}.${ext}`;
        usados.add(nome);
        return nome;
      };

      for (const n of notas) {
        const prefixo = n.situacao === 'autorizada' ? '' : `${n.situacao.toUpperCase()}_`;
        const base = `${prefixo}NFe_${n.numero || n.chaveAcesso}_${n.dataEmissao.slice(0, 10)}_${limparNome(n.emitenteNome)}`;
        const xml = n.xml as string;
        if (formato !== 'pdf') {
          arquivos.push({ nome: nomeUnico(formato === 'ambos' ? `xml/${base}` : base, 'xml'), conteudo: Buffer.from(xml, 'utf8') });
        }
        if (formato !== 'xml') {
          try {
            arquivos.push({ nome: nomeUnico(formato === 'ambos' ? `pdf/${base}` : base, 'pdf'), conteudo: gerarDanfePdf(xml, n.situacao) });
          } catch {
            comErro++;
          }
        }
      }
      if (arquivos.length === 0) return NextResponse.json({ error: 'Nenhum XML pôde ser lido para gerar o PDF.' }, { status: 422 });
      corpo = criarZipBuffer(arquivos);
      tipo = 'application/zip';
      nomeArquivo = `${nomeBase}.zip`;
    }

    if (corpo.length > LIMITE_RESPOSTA) {
      return NextResponse.json(
        { error: `O arquivo de ${notas.length} notas ficou grande demais para baixar de uma vez. Exporte só o XML ou divida por período.` },
        { status: 413 },
      );
    }

    return new Response(new Uint8Array(corpo), {
      headers: {
        'Content-Type': tipo,
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
        'Cache-Control': 'private, no-store',
        'X-Notas-Exportadas': String(notas.length - comErro),
        'X-Notas-Sem-Xml': String(semXml),
        'X-Notas-Com-Erro': String(comErro),
      },
    });
  } catch (error) {
    console.error('Erro em POST nfe/destinadas/exportar:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao exportar as notas.' }, { status: 500 });
  }
}
