import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import {
  getSaasOverview,
  saveSaasTenant,
  deleteSaasTenant,
  saveSaasMovement,
  deleteSaasMovement,
  syncEmpresasIntoSaas,
  generateMonthlyBilling,
} from '@/lib/saas-manager';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  if (auth.session.role !== 'administrador') {
    return NextResponse.json({ success: false, error: 'Acesso restrito ao administrador.' }, { status: 403 });
  }

  try {
    const overview = await getSaasOverview();
    return NextResponse.json({ success: true, ...overview });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  if (auth.session.role !== 'administrador') {
    return NextResponse.json({ success: false, error: 'Acesso restrito ao administrador.' }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (body.action === 'save_tenant') {
      if (!body.company_name?.trim()) {
        return NextResponse.json({ success: false, error: 'Nome da empresa obrigatório.' }, { status: 400 });
      }
      const tenant = await saveSaasTenant(body);
      return NextResponse.json({ success: true, tenant });
    }

    if (body.action === 'delete_tenant') {
      await deleteSaasTenant(body.id);
      return NextResponse.json({ success: true });
    }

    if (body.action === 'save_movement') {
      if (!body.tenant_id || !body.tenant_name) {
        return NextResponse.json({ success: false, error: 'Assinante obrigatório.' }, { status: 400 });
      }
      const movement = await saveSaasMovement(body);
      return NextResponse.json({ success: true, movement });
    }

    if (body.action === 'delete_movement') {
      await deleteSaasMovement(body.id);
      return NextResponse.json({ success: true });
    }

    if (body.action === 'sync_empresas') {
      const added = await syncEmpresasIntoSaas();
      return NextResponse.json({ success: true, added });
    }

    if (body.action === 'generate_monthly_billing') {
      const refMonth = body.reference_month || new Date().toISOString().slice(0, 7);
      const created = await generateMonthlyBilling(refMonth);
      return NextResponse.json({ success: true, created });
    }

    return NextResponse.json({ success: false, error: 'Ação inválida.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
