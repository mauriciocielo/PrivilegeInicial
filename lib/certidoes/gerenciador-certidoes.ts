/**
 * Consulta da situação fiscal federal (relatório SITFIS) e rotina mensal.
 *
 * Só federal: nenhuma SEFAZ está integrada. A certidão estadual é emitida no portal de cada
 * UF (ver portais-estaduais.ts) e anexada pela tela. Não gerar aqui nada que pareça documento
 * de um órgão público.
 */

import nodemailer from 'nodemailer';
import db from '../prisma';
import { consultarCertidaoNegativaFederal, apenasDigitos } from '../serpro/integra-contador';
import { VERSAO_CLASSIFICADOR } from './situacao';

export function isUltimoDiaDoMes(data: Date = new Date()): boolean {
  const amanha = new Date(data);
  amanha.setDate(data.getDate() + 1);
  return amanha.getMonth() !== data.getMonth();
}

export interface ExecucaoCertidaoResult {
  empresaId: string;
  empresaNome: string;
  cnpj: string;
  certidaoId: string;
  situacao: string;
  protocolo?: string;
  mensagem?: string;
}

/** Consulta a situação federal de uma empresa e grava o resultado. Falha também fica registrada. */
export async function processarCertidaoEmpresa(
  empresaId: string,
  opcoes: { automatico?: boolean } = {}
): Promise<ExecucaoCertidaoResult> {
  const automatico = opcoes.automatico === true;

  const empresa = await db.empresa.findUnique({
    where: { id: empresaId },
    select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
  });
  if (!empresa) throw new Error('Empresa não encontrada.');

  const cnpj = apenasDigitos(empresa.cnpj);
  const base = { empresaId, empresaNome: empresa.nomeFantasia || empresa.razaoSocial, cnpj };

  try {
    const federal = await consultarCertidaoNegativaFederal(cnpj);
    const registro = await db.certidaoFiscal.create({
      data: {
        empresaId,
        tipo: 'FEDERAL',
        uf: 'BR',
        situacao: federal.situacao,
        protocolo: federal.protocolo,
        emitidoEm: new Date(),
        pdfBase64: federal.pdfBase64,
        observacoes: federal.mensagem?.slice(0, 500),
        pendencias: { classificador: VERSAO_CLASSIFICADOR },
        criadoAutomaticamente: automatico,
      },
      select: { id: true },
    });
    return { ...base, certidaoId: registro.id, situacao: federal.situacao, protocolo: federal.protocolo, mensagem: federal.mensagem };
  } catch (err) {
    console.error(`[Situação federal] Erro ao consultar a empresa ${empresaId}:`, err);
    const mensagem = err instanceof Error ? err.message : 'Falha ao consultar a situação federal.';
    const registro = await db.certidaoFiscal.create({
      data: {
        empresaId,
        tipo: 'FEDERAL',
        uf: 'BR',
        situacao: 'ERRO',
        emitidoEm: new Date(),
        observacoes: mensagem.slice(0, 500),
        pendencias: { classificador: VERSAO_CLASSIFICADOR },
        criadoAutomaticamente: automatico,
      },
      select: { id: true },
    });
    return { ...base, certidaoId: registro.id, situacao: 'ERRO', mensagem };
  }
}

/**
 * Rotina mensal para toda a carteira. ATENÇÃO: não está agendada em vercel.json e, numa
 * carteira grande, não cabe no tempo de uma função. Precisa rodar em lotes antes de ser agendada.
 */
export async function executarRotinaMensalCertidoes(forcar: boolean = false) {
  const hoje = new Date();

  if (!isUltimoDiaDoMes(hoje) && !forcar) {
    return { executado: false, motivo: 'Hoje não é o último dia do mês. Rotina automática postergada.', data: hoje.toISOString() };
  }

  const config = await db.certidaoConfig.findFirst({ where: { empresaId: null } });
  if (config && !config.ativo && !forcar) {
    return { executado: false, motivo: 'Rotina mensal desativada na configuração.', data: hoje.toISOString() };
  }

  const empresas = await db.empresa.findMany({ select: { id: true }, orderBy: { razaoSocial: 'asc' } });

  const resultados: ExecucaoCertidaoResult[] = [];
  let totalComPendencia = 0;
  for (const emp of empresas) {
    try {
      const res = await processarCertidaoEmpresa(emp.id, { automatico: true });
      resultados.push(res);
      if (res.situacao === 'POSITIVA') totalComPendencia++;
    } catch (err) {
      console.error(`Erro ao processar rotina mensal para empresa ${emp.id}:`, err);
    }
  }
  const totalProcessado = resultados.length;

  const detalhes = { totalProcessado, totalComPendencia, data: hoje.toISOString() };
  await db.certidaoConfig.upsert({
    where: { id: config?.id || 'global_config' },
    create: { id: 'global_config', ativo: true, executarUltimoDia: true, ultimaExecucaoEm: hoje, statusUltimaExecucao: 'SUCESSO', detalhesUltimaExecucao: detalhes },
    update: { ultimaExecucaoEm: hoje, statusUltimaExecucao: 'SUCESSO', detalhesUltimaExecucao: detalhes },
  });

  const notificar = config?.notificarEmail ?? true;
  const emails = config?.emailsNotificacao || process.env.SMTP_USER || 'contato@privilegecontabilidade.com.br';
  if (notificar && emails) await enviarEmailRelatorioMensal(emails, resultados, totalComPendencia);

  return { executado: true, totalProcessado, totalComPendencia, resultados };
}

const ROTULO_SITUACAO: Record<string, string> = {
  NEGATIVA: 'Sem pendências',
  POSITIVA_COM_EFEITO_NEGATIVA: 'Débitos suspensos',
  POSITIVA: 'Com pendências',
  INDETERMINADA: 'Conferir no PDF',
  PROCESSANDO: 'Em processamento',
  ERRO: 'Erro na consulta',
};

async function enviarEmailRelatorioMensal(destinatarios: string, resultados: ExecucaoCertidaoResult[], totalComPendencia: number) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.privilegecontabilidade.com.br',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' },
    });

    const mesAno = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());

    const linhasHtml = resultados.map(r => {
      const ok = r.situacao === 'NEGATIVA' || r.situacao === 'POSITIVA_COM_EFEITO_NEGATIVA';
      return `
        <tr style="background: ${ok ? '#ffffff' : '#fef2f2'}; border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-weight: bold;">${r.empresaNome}</td>
          <td style="padding: 10px; font-family: monospace;">${r.cnpj}</td>
          <td style="padding: 10px; font-weight: bold;">${ROTULO_SITUACAO[r.situacao] || r.situacao}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #1e293b;">
        <h2 style="margin: 0;">Situação fiscal federal da carteira (${mesAno})</h2>
        <p>Resultado do Relatório de Situação Fiscal (SITFIS) de cada empresa. O relatório não substitui a certidão, que é emitida no portal da Receita Federal.</p>
        <p><strong>${resultados.length}</strong> empresa(s) consultada(s), <strong>${totalComPendencia}</strong> com pendências.</p>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 10px;">Empresa</th>
              <th style="padding: 10px;">CNPJ</th>
              <th style="padding: 10px;">Situação federal</th>
            </tr>
          </thead>
          <tbody>${linhasHtml}</tbody>
        </table>
      </div>
    `;

    await transporter.sendMail({
      from: `"Privilege Contabilidade" <${process.env.SMTP_FROM || 'contato@privilegecontabilidade.com.br'}>`,
      to: destinatarios,
      subject: `Situação fiscal federal (${mesAno}): ${totalComPendencia} empresa(s) com pendências`,
      html,
    });
  } catch (err) {
    console.error('Erro ao enviar e-mail de relatório mensal de certidões:', err);
  }
}
