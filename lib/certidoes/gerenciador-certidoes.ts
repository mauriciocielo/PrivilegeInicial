/**
 * Gerenciador Unificado de Certidões Negativas (Federal & Estadual).
 * Controla consultas avulsas, em lote e a rotina automática mensal do último dia do mês.
 */

import nodemailer from 'nodemailer';
import db from '../prisma';
import { consultarCertidaoNegativaFederal, apenasDigitos } from '../serpro/integra-contador';
import { consultarCndEstadual } from './cnd-estadual';

export function isUltimoDiaDoMes(data: Date = new Date()): boolean {
  const amanha = new Date(data);
  amanha.setDate(data.getDate() + 1);
  return amanha.getMonth() !== data.getMonth();
}

export interface ExecucaoCertidaoResult {
  empresaId: string;
  empresaNome: string;
  cnpj: string;
  uf: string;
  federal?: {
    sucesso: boolean;
    situacao: string;
    protocolo?: string;
    pdfBase64?: string;
    mensagem?: string;
  };
  estadual?: {
    sucesso: boolean;
    situacao: string;
    numeroCertidao?: string;
    codigoAutenticidade?: string;
    pdfBase64?: string;
    mensagem?: string;
  };
}

/**
 * Executa a consulta completa de CND (Federal e/ou Estadual) para uma empresa e grava no banco.
 */
export async function processarCertidaoEmpresa(
  empresaId: string,
  opcoes: { federal?: boolean; estadual?: boolean; automatico?: boolean } = {}
): Promise<ExecucaoCertidaoResult> {
  const consultarFed = opcoes.federal !== false;
  const consultarEst = opcoes.estadual !== false;
  const automatico = opcoes.automatico === true;

  const empresa = await db.empresa.findUnique({
    where: { id: empresaId },
    select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, uf: true },
  });

  if (!empresa) {
    throw new Error('Empresa não encontrada.');
  }

  const cnpj = apenasDigitos(empresa.cnpj);
  const uf = (empresa.uf || 'PR').toUpperCase();
  const nome = empresa.nomeFantasia || empresa.razaoSocial;

  const resultado: ExecucaoCertidaoResult = {
    empresaId,
    empresaNome: nome,
    cnpj,
    uf,
  };

  // 1. CND Federal (Integra Contador / SERPRO)
  if (consultarFed) {
    try {
      const resFed = await consultarCertidaoNegativaFederal(cnpj);
      resultado.federal = {
        sucesso: resFed.sucesso,
        situacao: resFed.situacao,
        protocolo: resFed.protocolo,
        pdfBase64: resFed.pdfBase64,
        mensagem: resFed.mensagem,
      };

      await db.certidaoFiscal.create({
        data: {
          empresaId,
          tipo: 'FEDERAL',
          uf: 'BR',
          situacao: resFed.situacao,
          protocolo: resFed.protocolo,
          emitidoEm: new Date(),
          pdfBase64: resFed.pdfBase64,
          observacoes: resFed.mensagem,
          criadoAutomaticamente: automatico,
        },
      });
    } catch (err) {
      console.error(`[CND Federal] Erro ao consultar empresa ${cnpj}:`, err);
      resultado.federal = {
        sucesso: false,
        situacao: 'ERRO',
        mensagem: err instanceof Error ? err.message : 'Falha ao consultar CND Federal',
      };
      await db.certidaoFiscal.create({
        data: {
          empresaId,
          tipo: 'FEDERAL',
          uf: 'BR',
          situacao: 'ERRO',
          observacoes: err instanceof Error ? err.message : 'Erro na consulta',
          criadoAutomaticamente: automatico,
        },
      });
    }
  }

  // 2. CND Estadual (SEFAZ)
  if (consultarEst) {
    try {
      const resEst = await consultarCndEstadual(cnpj, uf);
      resultado.estadual = {
        sucesso: resEst.sucesso,
        situacao: resEst.situacao,
        numeroCertidao: resEst.numeroCertidao,
        codigoAutenticidade: resEst.codigoAutenticidade,
        pdfBase64: resEst.pdfBase64,
        mensagem: resEst.mensagem,
      };

      await db.certidaoFiscal.create({
        data: {
          empresaId,
          tipo: 'ESTADUAL',
          uf,
          situacao: resEst.situacao,
          numeroCertidao: resEst.numeroCertidao,
          codigoAutenticidade: resEst.codigoAutenticidade,
          emitidoEm: new Date(resEst.emitidoEm),
          validoAte: resEst.validoAte ? new Date(resEst.validoAte) : null,
          pdfBase64: resEst.pdfBase64,
          observacoes: resEst.mensagem,
          criadoAutomaticamente: automatico,
        },
      });
    } catch (err) {
      console.error(`[CND Estadual] Erro ao consultar empresa ${cnpj} (${uf}):`, err);
      resultado.estadual = {
        sucesso: false,
        situacao: 'ERRO',
        mensagem: err instanceof Error ? err.message : 'Falha ao consultar CND Estadual',
      };
      await db.certidaoFiscal.create({
        data: {
          empresaId,
          tipo: 'ESTADUAL',
          uf,
          situacao: 'ERRO',
          observacoes: err instanceof Error ? err.message : 'Erro na consulta',
          criadoAutomaticamente: automatico,
        },
      });
    }
  }

  return resultado;
}

/**
 * Executa a rotina mensal de consulta de certidões para todas as empresas da carteira.
 */
export async function executarRotinaMensalCertidoes(forcar: boolean = false) {
  const hoje = new Date();
  const ehUltimoDia = isUltimoDiaDoMes(hoje);

  if (!ehUltimoDia && !forcar) {
    return {
      executado: false,
      motivo: 'Hoje não é o último dia do mês. Rotina automática postergada.',
      data: hoje.toISOString(),
    };
  }

  // Busca configuração global
  const config = await db.certidaoConfig.findFirst({
    where: { empresaId: null },
  });

  const empresas = await db.empresa.findMany({
    select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, uf: true },
    orderBy: { razaoSocial: 'asc' },
  });

  const resultados: ExecucaoCertidaoResult[] = [];
  let totalProcessado = 0;
  let totalComPendencia = 0;

  for (const emp of empresas) {
    try {
      const res = await processarCertidaoEmpresa(emp.id, {
        federal: config?.consultarFederal ?? true,
        estadual: config?.consultarEstadual ?? true,
        automatico: true,
      });
      resultados.push(res);
      totalProcessado++;

      const temPendencia = res.federal?.situacao === 'POSITIVA' || res.estadual?.situacao === 'POSITIVA';
      if (temPendencia) totalComPendencia++;
    } catch (err) {
      console.error(`Erro ao processar rotina mensal para empresa ${emp.id}:`, err);
    }
  }

  // Atualiza timestamp da última execução
  await db.certidaoConfig.upsert({
    where: { id: config?.id || 'global_config' },
    create: {
      id: 'global_config',
      ativo: true,
      executarUltimoDia: true,
      ultimaExecucaoEm: hoje,
      statusUltimaExecucao: 'SUCESSO',
      detalhesUltimaExecucao: {
        totalProcessado,
        totalComPendencia,
        data: hoje.toISOString(),
      },
    },
    update: {
      ultimaExecucaoEm: hoje,
      statusUltimaExecucao: 'SUCESSO',
      detalhesUltimaExecucao: {
        totalProcessado,
        totalComPendencia,
        data: hoje.toISOString(),
      },
    },
  });

  // Notificação por E-mail (se configurado)
  const notificar = config?.notificarEmail ?? true;
  const emails = config?.emailsNotificacao || process.env.SMTP_USER || 'contato@privilegecontabilidade.com.br';

  if (notificar && emails) {
    await enviarEmailRelatorioMensal(emails, resultados, totalComPendencia);
  }

  return {
    executado: true,
    totalProcessado,
    totalComPendencia,
    resultados,
  };
}

async function enviarEmailRelatorioMensal(
  destinatarios: string,
  resultados: ExecucaoCertidaoResult[],
  totalComPendencia: number
) {
  try {
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'mail.privilegecontabilidade.com.br',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });

    const mesAno = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());

    const linhasHtml = resultados.map(r => {
      const fedOk = r.federal?.situacao === 'NEGATIVA' || r.federal?.situacao === 'POSITIVA_COM_EFEITO_NEGATIVA';
      const estOk = r.estadual?.situacao === 'NEGATIVA' || r.estadual?.situacao === 'POSITIVA_COM_EFEITO_NEGATIVA';
      const bg = (!fedOk || !estOk) ? '#fef2f2' : '#ffffff';

      return `
        <tr style="background: ${bg}; border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-weight: bold;">${r.empresaNome}</td>
          <td style="padding: 10px; font-family: monospace;">${r.cnpj}</td>
          <td style="padding: 10px;">${r.uf}</td>
          <td style="padding: 10px; color: ${fedOk ? '#10b981' : '#ef4444'}; font-weight: bold;">
            ${r.federal?.situacao || 'NÃO CONSULTADA'}
          </td>
          <td style="padding: 10px; color: ${estOk ? '#10b981' : '#ef4444'}; font-weight: bold;">
            ${r.estadual?.situacao || 'NÃO CONSULTADA'}
          </td>
        </tr>
      `;
    }).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #1e293b;">
        <div style="background: #1e3a8a; color: #ffffff; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Relatório Mensal de Situação Fiscal e CNDs (${mesAno})</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Rotina Automática de Regularidade Fiscal do Escritório</p>
        </div>
        <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none; background: #ffffff;">
          <p>Olá,</p>
          <p>A rotina automática de consulta das <strong>Certidões Negativas Federais e Estaduais</strong> foi concluída com sucesso no fechamento deste mês.</p>
          <div style="display: flex; gap: 20px; margin: 20px 0;">
            <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; flex: 1;">
              <div style="font-size: 12px; color: #64748b; font-weight: bold;">TOTAL DE EMPRESAS</div>
              <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${resultados.length}</div>
            </div>
            <div style="background: #fef2f2; padding: 15px; border-radius: 8px; flex: 1;">
              <div style="font-size: 12px; color: #ef4444; font-weight: bold;">COM PENDÊNCIAS FISCAIS</div>
              <div style="font-size: 24px; font-weight: bold; color: #ef4444;">${totalComPendencia}</div>
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; margin-top: 15px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 10px;">Empresa</th>
                <th style="padding: 10px;">CNPJ</th>
                <th style="padding: 10px;">UF</th>
                <th style="padding: 10px;">CND Federal</th>
                <th style="padding: 10px;">CND Estadual</th>
              </tr>
            </thead>
            <tbody>
              ${linhasHtml}
            </tbody>
          </table>
          <p style="margin-top: 25px; font-size: 12px; color: #64748b;">
            Este é um e-mail automático gerado pelo Sistema Contábil Privilege.
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Privilege Contabilidade" <${process.env.SMTP_FROM || 'contato@privilegecontabilidade.com.br'}>`,
      to: destinatarios,
      subject: `🏛️ Relatório de CNDs (${mesAno}) - ${totalComPendencia} pendência(s) detectada(s)`,
      html,
    });
  } catch (err) {
    console.error('Erro ao enviar e-mail de relatório mensal de certidões:', err);
  }
}

