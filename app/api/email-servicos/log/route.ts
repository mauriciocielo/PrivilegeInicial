import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.resolve(process.cwd(), 'data-email-logs.json');

export interface EmailLogEntry {
  id: string;
  empresaId?: string;
  tipo: 'newsletter' | 'cobranca_boleto' | 'avulso';
  assunto: string;
  destinatarioEmail: string;
  destinatarioNome?: string;
  status: 'entregue' | 'falha' | 'visualizado' | 'baixado';
  erroMensagem?: string;
  enviadoEm: string;
  visualizadoEm?: string;
  baixadoEm?: string;
  ipAcesso?: string;
  userAgent?: string;
}

export function lerLogs(): EmailLogEntry[] {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const data = fs.readFileSync(LOG_FILE, 'utf8');
      return JSON.parse(data) || [];
    }
  } catch {}
  return [];
}

export function salvarLog(entry: EmailLogEntry) {
  try {
    const logs = lerLogs();
    logs.unshift(entry); // Mais recente no topo
    if (logs.length > 2000) logs.pop();
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro ao salvar log de email:', e);
  }
}

export function atualizarStatusLog(
  id: string,
  novoStatus: 'visualizado' | 'baixado',
  ip?: string,
  ua?: string
) {
  try {
    const logs = lerLogs();
    const item = logs.find(l => l.id === id);
    if (item) {
      if (novoStatus === 'visualizado' && !item.visualizadoEm) {
        item.visualizadoEm = new Date().toISOString();
        if (item.status !== 'baixado') item.status = 'visualizado';
      } else if (novoStatus === 'baixado') {
        item.baixadoEm = new Date().toISOString();
        item.status = 'baixado';
      }
      if (ip) item.ipAcesso = ip;
      if (ua) item.userAgent = ua;
      fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
    }
  } catch (e) {
    console.error('Erro ao atualizar status do log:', e);
  }
}

// GET: Retorna os logs para a interface da Newsletter
export async function GET(req: Request) {
  const url = new URL(req.url);
  const empresaId = url.searchParams.get('empresaId');
  const tipo = url.searchParams.get('tipo');

  let logs = lerLogs();
  if (empresaId) logs = logs.filter(l => !l.empresaId || l.empresaId === empresaId);
  if (tipo) logs = logs.filter(l => l.tipo === tipo);

  return NextResponse.json({ ok: true, logs });
}

