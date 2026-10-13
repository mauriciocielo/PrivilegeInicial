// Relatório diário de Contas a Pagar / Contas a Receber (lançamentos "previsto").
// Usado pelo e-mail diário enviado ao cliente e ao consultor (app/api/cron/daily-report).

export type ContaPendente = {
  data: string;
  descricao: string;
  valor: number;
  tipo: string;
  numeroDocumento?: string | null;
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (d: string) => d.split('-').reverse().join('/');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().split('T')[0];
};

const MAX_ITENS = 15;

export interface ResumoContas {
  vencidas: ContaPendente[];
  hoje: ContaPendente[];
  proximos7: ContaPendente[];
}

export function agruparContas(pendentes: ContaPendente[], today: string): ResumoContas {
  const limite = addDays(today, 7);
  const ord = (a: ContaPendente, b: ContaPendente) => a.data.localeCompare(b.data);
  return {
    vencidas: pendentes.filter(l => l.data < today).sort(ord),
    hoje: pendentes.filter(l => l.data === today).sort(ord),
    proximos7: pendentes.filter(l => l.data > today && l.data <= limite).sort(ord),
  };
}

const soma = (l: ContaPendente[]) => l.reduce((s, x) => s + x.valor, 0);

function bloco(titulo: string, cor: string, itens: ContaPendente[]): string {
  if (itens.length === 0) return '';
  const linhas = itens.slice(0, MAX_ITENS).map(l => `
    <tr>
      <td style="padding:3px 6px;color:#6b7280;white-space:nowrap;">${br(l.data)}</td>
      <td style="padding:3px 6px;">${esc(l.descricao)}${l.numeroDocumento ? ` <span style="color:#9ca3af;">(${esc(l.numeroDocumento)})</span>` : ''}</td>
      <td style="padding:3px 6px;text-align:right;white-space:nowrap;">${brl(l.valor)}</td>
    </tr>`).join('');
  const resto = itens.length > MAX_ITENS ? `<tr><td colspan="3" style="padding:3px 6px;color:#9ca3af;">… e mais ${itens.length - MAX_ITENS} conta(s)</td></tr>` : '';
  return `
    <div style="margin-top:8px;">
      <div style="font-size:12px;font-weight:bold;color:${cor};">${titulo} — ${itens.length} conta(s) · ${brl(soma(itens))}</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">${linhas}${resto}</table>
    </div>`;
}

/** HTML do relatório de uma empresa (Contas a Pagar e Contas a Receber). */
export function relatorioContasHtml(pagar: ResumoContas, receber: ResumoContas): string {
  const secao = (nome: string, cor: string, r: ResumoContas) => {
    const corpo = bloco('🔴 Vencidas', '#b91c1c', r.vencidas) + bloco('🟡 Vencem hoje', '#b45309', r.hoje) + bloco('📅 Próximos 7 dias', cor, r.proximos7);
    return `
      <div style="margin-top:16px;padding:12px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;">
        <h4 style="margin:0;color:${cor};font-size:13px;">${nome}</h4>
        ${corpo || '<div style="font-size:12px;color:#9ca3af;margin-top:6px;">Nenhuma conta pendente nos próximos 7 dias.</div>'}
      </div>`;
  };
  return secao('💸 Contas a Pagar', '#b45309', pagar) + secao('💰 Contas a Receber', '#047857', receber);
}

const MAX_ITENS_TEXTO = 5;

/** Texto (WhatsApp) do relatório de uma empresa: totais e as primeiras contas de cada grupo. */
export function relatorioContasTexto(pagar: ResumoContas, receber: ResumoContas): string {
  const grupo = (rotulo: string, itens: ContaPendente[]) => {
    if (itens.length === 0) return '';
    let t = `  ${rotulo}: ${itens.length} conta(s) · ${brl(soma(itens))}\n`;
    itens.slice(0, MAX_ITENS_TEXTO).forEach(l => {
      t += `    - ${br(l.data).slice(0, 5)} ${l.descricao} — ${brl(l.valor)}\n`;
    });
    if (itens.length > MAX_ITENS_TEXTO) t += `    … e mais ${itens.length - MAX_ITENS_TEXTO}\n`;
    return t;
  };
  const secao = (nome: string, r: ResumoContas) => {
    const corpo = grupo('🔴 Vencidas', r.vencidas) + grupo('🟡 Hoje', r.hoje) + grupo('📅 Próx. 7 dias', r.proximos7);
    return corpo ? `*${nome}*\n${corpo}` : '';
  };
  return secao('💸 Contas a Pagar', pagar) + secao('💰 Contas a Receber', receber);
}
