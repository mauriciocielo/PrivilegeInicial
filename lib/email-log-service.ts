import fs from 'fs';
import path from 'path';

function getStoragePath(filename: string): string {
  // No ambiente Serverless da Vercel (Linux), somente o diretório /tmp é gravável
  if (process.env.VERCEL || (process.env.NODE_ENV === 'production' && process.platform !== 'win32')) {
    return path.join('/tmp', filename);
  }
  return path.resolve(process.cwd(), filename);
}

const LOG_FILE = getStoragePath('data-email-logs.json');

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
  html?: string;
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
    logs.unshift(entry);
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

