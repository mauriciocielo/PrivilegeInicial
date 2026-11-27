import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import {
  ensureEscritoriosNfseTables,
  obterBrandingEscritorioDoUsuario,
  obterEscritorioDoUsuario,
} from '../../../../lib/nfse/escritorios-terceiros';

export const dynamic = 'force-dynamic';

const HEX_COLOR = /^#([0-9a-fA-F]{6})$/;
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB em data URL base64

/**
 * GET /api/escritorio/branding
 * Retorna a identidade visual (logo + cores) do escritório parceiro para o próprio
 * contador e para todos os clientes vinculados às empresas dele.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const branding = await obterBrandingEscritorioDoUsuario(auth.session.userId, auth.session.role);
    if (!branding) {
      return NextResponse.json({ customizado: false, podeEditar: false });
    }

    return NextResponse.json({
      customizado: Boolean(branding.corPrimaria || branding.logoData || branding.nome),
      ...branding,
    });
  } catch (error) {
    console.error('Erro em GET /api/escritorio/branding:', error);
    return NextResponse.json({ customizado: false, podeEditar: false });
  }
}

/**
 * PUT /api/escritorio/branding
 * Permite ao administrador do escritório parceiro (painel ADM dele) alterar a logo,
 * o nome e as cores do painel — refletindo automaticamente para ele e todos os clientes dele.
 */
export async function PUT(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureEscritoriosNfseTables();
    const body = await request.json().catch(() => ({}));

    let escritorioId = '';
    if (auth.session.role === 'administrador' && typeof body?.escritorioId === 'string' && body.escritorioId.trim()) {
      escritorioId = body.escritorioId.trim();
    } else {
      const vinculo = await obterEscritorioDoUsuario(auth.session.userId);
      if (!vinculo || !vinculo.ativo || vinculo.papel === 'operador') {
        return NextResponse.json({ error: 'Apenas o administrador do escritório parceiro pode personalizar o painel.' }, { status: 403 });
      }
      escritorioId = vinculo.escritorioId;
    }

    const brandNome = typeof body?.nome === 'string' ? body.nome.trim().slice(0, 120) : null;
    const corPrimariaRaw = typeof body?.corPrimaria === 'string' ? body.corPrimaria.trim() : '';
    const corSecundariaRaw = typeof body?.corSecundaria === 'string' ? body.corSecundaria.trim() : '';
    const corPrimaria = corPrimariaRaw ? (HEX_COLOR.test(corPrimariaRaw) ? corPrimariaRaw : null) : null;
    const corSecundaria = corSecundariaRaw ? (HEX_COLOR.test(corSecundariaRaw) ? corSecundariaRaw : null) : null;

    if (corPrimariaRaw && !corPrimaria) {
      return NextResponse.json({ error: 'Cor primária inválida. Use formato hexadecimal #RRGGBB.' }, { status: 400 });
    }
    if (corSecundariaRaw && !corSecundaria) {
      return NextResponse.json({ error: 'Cor secundária inválida. Use formato hexadecimal #RRGGBB.' }, { status: 400 });
    }

    let logoData: string | null | undefined = undefined;
    if (body?.logoData === null || body?.logoData === '') {
      logoData = null;
    } else if (typeof body?.logoData === 'string') {
      if (!body.logoData.startsWith('data:image/')) {
        return NextResponse.json({ error: 'A logo deve ser uma imagem válida (PNG, JPG, WebP ou SVG).' }, { status: 400 });
      }
      if (body.logoData.length > MAX_LOGO_BYTES) {
        return NextResponse.json({ error: 'A imagem da logo excede o limite de 1,5 MB.' }, { status: 400 });
      }
      logoData = body.logoData;
    }

    if (logoData !== undefined) {
      await db.$executeRawUnsafe(
        `UPDATE nfse_escritorios
         SET brand_nome = $2, brand_cor_primaria = $3, brand_cor_secundaria = $4, brand_logo_data = $5, updated_at = NOW()
         WHERE id = $1`,
        escritorioId,
        brandNome,
        corPrimaria,
        corSecundaria,
        logoData
      );
    } else {
      await db.$executeRawUnsafe(
        `UPDATE nfse_escritorios
         SET brand_nome = $2, brand_cor_primaria = $3, brand_cor_secundaria = $4, updated_at = NOW()
         WHERE id = $1`,
        escritorioId,
        brandNome,
        corPrimaria,
        corSecundaria
      );
    }

    const atualizado = await obterBrandingEscritorioDoUsuario(auth.session.userId, auth.session.role);
    return NextResponse.json({
      ok: true,
      branding: atualizado || {
        escritorioId,
        nome: brandNome || '',
        corPrimaria,
        corSecundaria,
        logoData: logoData ?? null,
        podeEditar: true,
      },
    });
  } catch (error) {
    console.error('Erro em PUT /api/escritorio/branding:', error);
    return NextResponse.json({ error: 'Erro ao salvar personalização do escritório.' }, { status: 500 });
  }
}
