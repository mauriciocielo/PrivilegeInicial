import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { acessoEmissaoNegado } from '../../../../lib/nfse/servidor';
import { apenasDigitos } from '../../../../lib/nfse/dps';
import { obterBrandingDaEmpresa } from '../../../../lib/nfse/escritorios-terceiros';
import { buscarGrupoWhatsAppEmpresa } from '../../../../lib/agenda-lembretes';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../lib/baileys-manager';
import { resolveWhatsAppOwnerId } from '../../../../lib/whatsapp-owner';
import { registrarDisparoWhatsApp } from '../../../../lib/whatsapp-disparos-log';

export const dynamic = 'force-dynamic';

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

/**
 * POST /api/escritorio/avisar-cliente-whatsapp
 * Envia um aviso proativo no WhatsApp do cliente (certificado A1 vencendo/vencido ou alerta de teto RBT12)
 * assinado 100% com o nome e telefone do escritório parceiro (white-label).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const empresaId = String(body?.empresaId || '').trim();
    const tipo = body?.tipo === 'rbt12' ? 'rbt12' : 'certificado';
    const telefoneInformado = typeof body?.telefone === 'string' ? body.telefone.trim() : '';

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId obrigatório.' }, { status: 400 });
    }

    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: {
        id: true,
        razaoSocial: true,
        nomeFantasia: true,
        cnpj: true,
        telefone: true,
        nfseConfig: { select: { certValidoAte: true, opSimpNac: true } },
      },
    });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    let destino = '';
    let destinoNome = '';
    const telFinal = telefoneInformado || empresa.telefone || '';
    const digitosTel = apenasDigitos(telFinal);

    if (digitosTel.length >= 10) {
      destino = digitosTel.startsWith('55') ? digitosTel : `55${digitosTel}`;
      destinoNome = empresa.nomeFantasia || empresa.razaoSocial;
    } else {
      const grupo = await buscarGrupoWhatsAppEmpresa(empresaId);
      if (grupo?.groupJid) {
        destino = grupo.groupJid;
        destinoNome = grupo.groupName;
      }
    }

    if (!destino) {
      return NextResponse.json(
        { error: 'Esta empresa não possui telefone cadastrado nem grupo de WhatsApp vinculado.' },
        { status: 400 }
      );
    }

    const branding = await obterBrandingDaEmpresa(empresaId);
    const nomeMarca = branding?.nome || 'Privilege Consultoria';
    const contatoMarca = branding?.telefone ? ` · ${branding.telefone}` : '';
    const nomeEmp = empresa.nomeFantasia || empresa.razaoSocial;

    let mensagem = '';
    if (tipo === 'certificado') {
      const validade = empresa.nfseConfig?.certValidoAte;
      const validadeBr = validade ? validade.toLocaleDateString('pt-BR') : 'em breve';
      const dias = validade ? Math.ceil((validade.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
      const situacao =
        dias !== null && dias < 0
          ? `🚨 *venceu em ${validadeBr}* (há ${Math.abs(dias)} dia(s))`
          : `⚠️ *vence em ${validadeBr}*${dias !== null ? ` (faltam ${dias} dia(s))` : ''}`;

      mensagem = [
        `🔐 *Aviso de Certificado Digital A1 — ${nomeMarca}*`,
        '',
        `Olá! Passando para avisar que o Certificado Digital A1 da empresa *${nomeEmp}* (CNPJ ${empresa.cnpj}) ${situacao}.`,
        '',
        `Para não interromper a emissão de notas fiscais (NFS-e / NF-e) nem a consulta automática na SEFAZ, por favor providencie a renovação e nos envie o novo arquivo *.pfx* e a senha.`,
        '',
        `_${nomeMarca}${contatoMarca}_`,
      ].join('\n');
    } else {
      const rbt12 = Number(body?.rbt12 || 0);
      const teto = Number(body?.teto || 0);
      const regime = String(body?.regime || 'Simples Nacional');
      mensagem = [
        `📈 *Alerta de Faturamento Acumulado (RBT12) — ${nomeMarca}*`,
        '',
        `Olá! Identificamos no acompanhamento fiscal que a empresa *${nomeEmp}* (CNPJ ${empresa.cnpj}) atingiu *${fmtBRL(rbt12)}* de faturamento nos últimos 12 meses.`,
        teto > 0 ? `• *Regime:* ${regime} (Limite referência: ${fmtBRL(teto)})` : `• *Regime:* ${regime}`,
        '',
        `Recomendamos alinharmos um planejamento tributário preventivo para evitar desenquadramento ou aumento inesperado de alíquota.`,
        '',
        `_${nomeMarca}${contatoMarca}_`,
      ].join('\n');
    }

    const ownerIdPreferencial = resolveWhatsAppOwnerId(request);
    const ownerId = await encontrarSessaoAdminPorNumero('46999800010', ownerIdPreferencial);
    if (!ownerId) {
      return NextResponse.json({ error: 'Sessão de WhatsApp não está conectada no servidor.' }, { status: 422 });
    }

    const res = await sendBaileysLiveMessage(destino, mensagem, undefined, ownerId);
    await registrarDisparoWhatsApp({
      categoria: 'certificado_alerta',
      destino,
      destinoNome,
      mensagem,
      status: res?.sent ? 'enviado' : 'erro',
      erro: res?.sent ? null : (res?.error || 'Falha ao enviar mensagem'),
      ownerId,
    });

    if (!res?.sent) {
      return NextResponse.json({ error: res?.error || 'Falha ao entregar mensagem no WhatsApp.' }, { status: 422 });
    }

    return NextResponse.json({ ok: true, destinoNome });
  } catch (error) {
    console.error('Erro em POST /api/escritorio/avisar-cliente-whatsapp:', error);
    return NextResponse.json({ error: 'Erro ao enviar aviso no WhatsApp do cliente.' }, { status: 500 });
  }
}
