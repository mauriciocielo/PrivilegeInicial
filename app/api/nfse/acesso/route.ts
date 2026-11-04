import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { abrirCredencialEscritorio } from '../../../../lib/nfse/servidor';
import { apenasDigitos, cnpjValido } from '../../../../lib/nfse/dps';
import { criarTransporteMtls, SefinIndisponivelError, verificarProcuracao } from '../../../../lib/nfse/sefin';

const VALIDADE_VERIFICACAO_MS = 24 * 60 * 60 * 1000;

/**
 * Diz a um cliente quais empresas dele podem emitir: as que deram procuração ao
 * titular do certificado do escritório. A verificação vale por 24 horas, então uma
 * procuração revogada corta o acesso, e uma nova libera sem ação do escritório.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role !== 'cliente') return NextResponse.json({ liberado: false, empresas: [] });

    const empresas = await db.empresa.findMany({
      where: { id: { in: auth.session.empresaIds } },
      select: {
        id: true, razaoSocial: true, nomeFantasia: true, cnpj: true,
        nfseConfig: { select: { usarProcuracao: true, procuracaoStatus: true, procuracaoVerificadaEm: true } },
      },
    });

    const vencida = (e: (typeof empresas)[number]) => {
      const em = e.nfseConfig?.procuracaoVerificadaEm;
      return !em || Date.now() - em.getTime() > VALIDADE_VERIFICACAO_MS;
    };

    const status = new Map(empresas.map(e => [e.id, e.nfseConfig?.procuracaoStatus ?? null]));
    const aVerificar = empresas.filter(e => cnpjValido(e.cnpj) && e.nfseConfig?.usarProcuracao !== false && vencida(e));

    if (aVerificar.length > 0) {
      const aberta = await abrirCredencialEscritorio().catch(() => ({ erro: 'certificado indisponível' }));
      if ('credencial' in aberta) {
        const transporte = criarTransporteMtls('producao', aberta.credencial, 'adn');
        for (const empresa of aVerificar) {
          try {
            const r = await verificarProcuracao(transporte, apenasDigitos(empresa.cnpj));
            // Sem resposta conclusiva, vale a última verificação: instabilidade do Sefin não muda o acesso.
            if (r.status === 'indeterminada') continue;
            const dados = { procuracaoStatus: r.status, procuracaoMensagem: r.mensagem, procuracaoVerificadaEm: new Date() };
            await db.nfseConfig.upsert({ where: { empresaId: empresa.id }, update: dados, create: { ...dados, empresaId: empresa.id } });
            status.set(empresa.id, r.status);
          } catch (error) {
            if (!(error instanceof SefinIndisponivelError)) throw error;
          }
        }
      }
    }

    const liberadas = empresas
      .filter(e => status.get(e.id) === 'ativa' && e.nfseConfig?.usarProcuracao !== false)
      .map(({ id, razaoSocial, nomeFantasia, cnpj }) => ({ id, razaoSocial, nomeFantasia, cnpj }));

    return NextResponse.json({ liberado: liberadas.length > 0, empresas: liberadas });
  } catch (error) {
    console.error('Erro em GET nfse/acesso:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao verificar o acesso.' }, { status: 500 });
  }
}
