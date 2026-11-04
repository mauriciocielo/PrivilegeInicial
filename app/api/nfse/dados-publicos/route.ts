import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { apenasDigitos, cnpjValido } from '../../../../lib/nfse/dps';
import { consultarCep, consultarCnpjPublico } from '../../../../lib/nfse/emissor';

// Até três provedores em sequência, com 8 s cada.
export const maxDuration = 30;

/** Dados públicos para preencher a nota: `?cnpj=` (cadastro e endereço) ou `?cep=` (endereço). */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const cnpj = apenasDigitos(url.searchParams.get('cnpj') || '');
    const cep = apenasDigitos(url.searchParams.get('cep') || '');

    if (cnpj) {
      if (!cnpjValido(cnpj)) return NextResponse.json({ error: 'CNPJ inválido.' }, { status: 400 });
      const dados = await consultarCnpjPublico(cnpj);
      if (!dados) return NextResponse.json({ error: 'Não foi possível consultar este CNPJ agora. Preencha os dados à mão.' }, { status: 404 });
      return NextResponse.json(dados);
    }

    if (cep.length === 8) {
      const dados = await consultarCep(cep);
      if (!dados) return NextResponse.json({ error: 'CEP não encontrado.' }, { status: 404 });
      return NextResponse.json(dados);
    }

    return NextResponse.json({ error: 'Informe um CNPJ ou um CEP.' }, { status: 400 });
  } catch (error) {
    console.error('Erro em GET nfse/dados-publicos:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao consultar os dados.' }, { status: 500 });
  }
}
