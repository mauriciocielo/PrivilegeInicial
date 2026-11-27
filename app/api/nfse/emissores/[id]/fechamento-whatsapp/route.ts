import { NextResponse } from 'next/server';
import db from '../../../../../../lib/prisma';
import { requireAuth } from '../../../../../../lib/api-auth';
import { acessoEmissaoNegado } from '../../../../../../lib/nfse/servidor';
import { apenasDigitos } from '../../../../../../lib/nfse/dps';
import { buscarGrupoWhatsAppEmpresa } from '../../../../../../lib/agenda-lembretes';
import { encontrarSessaoAdminPorNumero } from '../../../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../../../lib/baileys-manager';
import { resolveWhatsAppOwnerId } from '../../../../../../lib/whatsapp-owner';
import { registrarDisparoWhatsApp } from '../../../../../../lib/whatsapp-disparos-log';
import { obterBrandingDaEmpresa } from '../../../../../../lib/nfse/escritorios-terceiros';

export const dynamic = 'force-dynamic';

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

/**
 * POST /api/nfse/emissores/[id]/fechamento-whatsapp
 * Gera e envia o Resumo Executivo de Fechamento Mensal de NFS-e (Emitidas + Tomadas + Impostos)
 * no grupo de WhatsApp vinculado à empresa (ou telefone informado) via (46) 99980-0010.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { id: empresaId } = await params;
    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    const body = await request.json().catch(() => ({}));
    const competencia = typeof body?.competencia === 'string' && /^\d{4}-\d{2}$/.test(body.competencia)
      ? body.competencia
      : new Date().toISOString().slice(0, 7);
    const telefoneManual = typeof body?.telefone === 'string' ? body.telefone.trim() : '';

    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
    });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    const cnpjEmp = apenasDigitos(empresa.cnpj);
    const notas = await db.nfsE.findMany({
      where: {
        empresaId,
        status: 'emitida',
        OR: [
          { dataCompetencia: { startsWith: competencia } },
          { dataEmissao: { startsWith: competencia } },
        ],
      },
      select: {
        prestadorCnpj: true,
        valorServicos: true,
        valorLiquido: true,
        valorIss: true,
        issRetido: true,
        valorIr: true,
        valorPis: true,
        valorCofins: true,
        valorCsll: true,
        valorInss: true,
      },
    });

    let qtdEmitidas = 0;
    let totalEmitidas = 0;
    let issProprio = 0;
    let issRetido = 0;
    let retFederais = 0;
    let qtdTomadas = 0;
    let totalTomadas = 0;

    for (const n of notas) {
      const pCnpj = apenasDigitos(n.prestadorCnpj);
      const ehPrestada = !pCnpj || pCnpj === cnpjEmp;
      if (ehPrestada) {
        qtdEmitidas++;
        totalEmitidas += Number(n.valorServicos || 0);
        if (n.issRetido) issRetido += Number(n.valorIss || 0);
        else issProprio += Number(n.valorIss || 0);
        retFederais += Number(n.valorIr || 0) + Number(n.valorPis || 0) + Number(n.valorCofins || 0) + Number(n.valorCsll || 0) + Number(n.valorInss || 0);
      } else {
        qtdTomadas++;
        totalTomadas += Number(n.valorServicos || 0);
      }
    }

    const [ano, mes] = competencia.split('-');
    const compBr = `${mes}/${ano}`;
    const nomeEmp = empresa.nomeFantasia || empresa.razaoSocial;

    let destino = '';
    let destinoNome = '';
    if (apenasDigitos(telefoneManual).length >= 10) {
      const d = apenasDigitos(telefoneManual);
      destino = d.startsWith('55') ? d : `55${d}`;
      destinoNome = telefoneManual;
    } else {
      const grupo = await buscarGrupoWhatsAppEmpresa(empresaId);
      if (grupo?.groupJid) {
        destino = grupo.groupJid;
        destinoNome = grupo.groupName;
      }
    }

    if (!destino) {
      return NextResponse.json(
        { error: 'Nenhum grupo WhatsApp vinculado a esta empresa. Informe um número de WhatsApp ou vincule um grupo na Agenda.' },
        { status: 400 }
      );
    }

    const brandingParceiro = await obterBrandingDaEmpresa(empresaId);
    const assinaturaRodape = brandingParceiro
      ? `_Relatório gerado por ${brandingParceiro.nome}${brandingParceiro.telefone ? ` · ${brandingParceiro.telefone}` : ''} — os PDFs e XMLs oficiais estão disponíveis no portal._`
      : `_Relatório gerado pelo Portal Privilege — os PDFs e XMLs oficiais estão disponíveis no sistema._`;

    const mensagem = [
      `📊 *Fechamento Mensal NFS-e — ${compBr}*`,
      `*Empresa:* ${nomeEmp}`,
      `*CNPJ:* ${empresa.cnpj}`,
      '',
      `🧾 *Serviços Prestados (Emitidas):* ${qtdEmitidas} nota(s)`,
      `💰 *Faturamento Bruto:* ${fmtBRL(totalEmitidas)}`,
      issProprio > 0 ? `🏛️ *ISS Próprio:* ${fmtBRL(issProprio)}` : '',
      issRetido > 0 ? `📌 *ISS Retido na Fonte:* ${fmtBRL(issRetido)}` : '',
      retFederais > 0 ? `📋 *Retenções Federais (IR/PIS/COFINS/CSLL/INSS):* ${fmtBRL(retFederais)}` : '',
      '',
      `📥 *Serviços Tomados:* ${qtdTomadas} nota(s) (${fmtBRL(totalTomadas)})`,
      '',
      assinaturaRodape,
    ].filter(Boolean).join('\n');

    const ownerIdPreferencial = resolveWhatsAppOwnerId(request);
    const ownerId = await encontrarSessaoAdminPorNumero('46999800010', ownerIdPreferencial);
    if (!ownerId) {
      return NextResponse.json({ error: 'WhatsApp (46) 99980-0010 não está conectado no servidor.' }, { status: 422 });
    }

    const res = await sendBaileysLiveMessage(destino, mensagem, undefined, ownerId);
    await registrarDisparoWhatsApp({
      categoria: 'agenda_criacao',
      destino,
      destinoNome,
      mensagem,
      status: res?.sent ? 'enviado' : 'erro',
      erro: res?.sent ? null : (res?.error || ownerId),
      ownerId,
    });

    if (!res?.sent) {
      return NextResponse.json({ error: `Falha ao enviar resumo no WhatsApp: ${res?.error || ownerId}` }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      destinoNome,
      resumo: { qtdEmitidas, totalEmitidas, issProprio, issRetido, retFederais, qtdTomadas, totalTomadas },
    });
  } catch (error) {
    console.error('Erro em POST /api/nfse/emissores/[id]/fechamento-whatsapp:', error);
    return NextResponse.json({ error: 'Erro ao enviar fechamento mensal no WhatsApp.' }, { status: 500 });
  }
}
