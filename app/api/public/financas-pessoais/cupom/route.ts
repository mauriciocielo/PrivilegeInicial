import { NextResponse } from 'next/server';
import { validarCupomPf } from '../../../../../lib/financas-pessoais-assinaturas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/public/financas-pessoais/cupom?codigo=PRIVILEGE20
 * Valida cupom de desconto em tempo real na página de vendas `/financas-pessoais`.
 */
export async function GET(request: Request) {
  try {
    const codigo = (new URL(request.url).searchParams.get('codigo') || '').trim();
    const res = await validarCupomPf(codigo, 29.9);
    if (!res.valido) {
      return NextResponse.json({ valido: false, error: res.erro || 'Cupom inválido.' }, { status: 400 });
    }
    return NextResponse.json(res);
  } catch (error) {
    console.error('Erro em GET /api/public/financas-pessoais/cupom:', error);
    return NextResponse.json({ valido: false, error: 'Erro ao validar cupom.' }, { status: 500 });
  }
}
