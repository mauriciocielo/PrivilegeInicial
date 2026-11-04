import { NextResponse } from 'next/server';
import { GET as getMonitor } from '../../monitor/route';

/** Alias para /api/nfe/monitor que lista as empresas monitoradas */
export async function GET(request: Request) {
  return getMonitor(request);
}

