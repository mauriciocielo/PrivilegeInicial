import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { acessoEmissaoNegado } from '../../../../lib/nfse/servidor';
import { apenasDigitos } from '../../../../lib/nfse/dps';
import { ensureRecorrenciasTable, mapRowToRecorrencia } from '../../../../lib/nfse/recorrencias-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const empresaId = (searchParams.get('empresaId') || '').trim();
    if (!empresaId) return NextResponse.json({ error: 'empresaId obrigatório.' }, { status: 400 });

    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    await ensureRecorrenciasTable();
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM cf_nfse_recorrencias WHERE empresa_id = $1 ORDER BY ativo DESC, tomador_nome ASC`,
      empresaId
    );
    return NextResponse.json({ recorrencias: rows.map(mapRowToRecorrencia) });
  } catch (error) {
    console.error('Erro em GET /api/nfse/recorrencias:', error);
    return NextResponse.json({ error: 'Erro ao carregar contratos recorrentes.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const empresaId = String(body?.empresaId || '').trim();
    if (!empresaId) return NextResponse.json({ error: 'empresaId obrigatório.' }, { status: 400 });

    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    await ensureRecorrenciasTable();

    // Suporta criação individual ou em lote (ex.: "Importar contratos das notas do mês passado")
    const itens: any[] = Array.isArray(body?.itens) ? body.itens : [body];
    const criadas: any[] = [];

    for (const item of itens) {
      const tomadorNome = String(item?.tomadorNome || '').trim();
      const tomadorDocumento = apenasDigitos(String(item?.tomadorDocumento || ''));
      if (!tomadorNome || (tomadorDocumento.length !== 11 && tomadorDocumento.length !== 14)) continue;

      const id = crypto.randomUUID();
      await db.$executeRawUnsafe(
        `INSERT INTO cf_nfse_recorrencias (
           id, empresa_id, ativo, dia_emissao,
           tomador_documento, tomador_nome, tomador_email, tomador_telefone,
           tomador_cep, tomador_endereco, tomador_numero, tomador_bairro,
           tomador_cidade, tomador_uf, tomador_codigo_municipio,
           codigo_servico, c_trib_mun, c_nbs,
           valor_servicos, aliquota_iss, iss_retido, descricao_template,
           created_at, updated_at
         ) VALUES (
           $1, $2, TRUE, $3,
           $4, $5, $6, $7,
           $8, $9, $10, $11,
           $12, $13, $14,
           $15, $16, $17,
           $18, $19, $20, $21,
           NOW(), NOW()
         )`,
        id,
        empresaId,
        Math.max(1, Math.min(28, Number(item?.diaEmissao) || 5)),
        tomadorDocumento,
        tomadorNome,
        String(item?.tomadorEmail || '').trim(),
        String(item?.tomadorTelefone || '').trim(),
        apenasDigitos(String(item?.tomadorCep || '')),
        String(item?.tomadorEndereco || '').trim(),
        String(item?.tomadorNumero || '').trim(),
        String(item?.tomadorBairro || '').trim(),
        String(item?.tomadorCidade || '').trim(),
        String(item?.tomadorUf || '').trim(),
        apenasDigitos(String(item?.tomadorCodigoMunicipio || '')),
        apenasDigitos(String(item?.codigoServico || '')),
        String(item?.cTribMun || '').trim(),
        apenasDigitos(String(item?.cNbs || '')),
        Number(item?.valorServicos) || 0,
        Number(item?.aliquotaIss) || 0,
        Boolean(item?.issRetido),
        String(item?.descricaoTemplate || '').trim()
      );
      criadas.push(id);
    }

    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM cf_nfse_recorrencias WHERE empresa_id = $1 ORDER BY ativo DESC, tomador_nome ASC`,
      empresaId
    );
    return NextResponse.json({ ok: true, criadas: criadas.length, recorrencias: rows.map(mapRowToRecorrencia) }, { status: 201 });
  } catch (error) {
    console.error('Erro em POST /api/nfse/recorrencias:', error);
    return NextResponse.json({ error: 'Erro ao salvar recorrência.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const empresaId = String(body?.empresaId || '').trim();
    const id = String(body?.id || '').trim();
    if (!empresaId) return NextResponse.json({ error: 'empresaId obrigatório.' }, { status: 400 });

    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    await ensureRecorrenciasTable();

    // Marcar competência gerada em lote
    if (Array.isArray(body?.idsGerados) && typeof body?.competencia === 'string') {
      await db.$executeRawUnsafe(
        `UPDATE cf_nfse_recorrencias SET ultima_competencia_gerada = $2, updated_at = NOW()
         WHERE empresa_id = $1 AND id = ANY($3::text[])`,
        empresaId,
        body.competencia,
        body.idsGerados
      );
      return NextResponse.json({ ok: true });
    }

    if (!id) return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 });
    if (typeof body?.ativo === 'boolean') {
      await db.$executeRawUnsafe(
        `UPDATE cf_nfse_recorrencias SET ativo = $3, updated_at = NOW() WHERE id = $1 AND empresa_id = $2`,
        id,
        empresaId,
        body.ativo
      );
    }
    if (body?.valorServicos != null) {
      await db.$executeRawUnsafe(
        `UPDATE cf_nfse_recorrencias SET valor_servicos = $3, updated_at = NOW() WHERE id = $1 AND empresa_id = $2`,
        id,
        empresaId,
        Number(body.valorServicos) || 0
      );
    }
    if (typeof body?.descricaoTemplate === 'string') {
      await db.$executeRawUnsafe(
        `UPDATE cf_nfse_recorrencias SET descricao_template = $3, updated_at = NOW() WHERE id = $1 AND empresa_id = $2`,
        id,
        empresaId,
        body.descricaoTemplate.trim()
      );
    }
    if (typeof body?.tomadorTelefone === 'string') {
      await db.$executeRawUnsafe(
        `UPDATE cf_nfse_recorrencias SET tomador_telefone = $3, updated_at = NOW() WHERE id = $1 AND empresa_id = $2`,
        id,
        empresaId,
        body.tomadorTelefone.trim()
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em PATCH /api/nfse/recorrencias:', error);
    return NextResponse.json({ error: 'Erro ao atualizar recorrência.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = (searchParams.get('id') || '').trim();
    const empresaId = (searchParams.get('empresaId') || '').trim();
    if (!id || !empresaId) return NextResponse.json({ error: 'id e empresaId obrigatórios.' }, { status: 400 });

    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    await ensureRecorrenciasTable();
    await db.$executeRawUnsafe(`DELETE FROM cf_nfse_recorrencias WHERE id = $1 AND empresa_id = $2`, id, empresaId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em DELETE /api/nfse/recorrencias:', error);
    return NextResponse.json({ error: 'Erro ao excluir recorrência.' }, { status: 500 });
  }
}
