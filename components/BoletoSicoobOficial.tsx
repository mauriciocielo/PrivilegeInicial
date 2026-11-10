'use client';

import React from 'react';
import { barrasITF } from '../lib/cnab/boleto-sicoob';

export interface BoletoSicoobOficialProps {
  beneficiarioNome: string;
  beneficiarioCnpj: string;
  beneficiarioEndereco?: string;
  agencia: string;
  convenio: string;
  conta?: string;
  carteira?: string;
  modalidade?: string;
  nossoNumero: string;
  numeroDocumento: string;
  dataDocumento: string; // DD/MM/AAAA
  dataProcessamento?: string; // DD/MM/AAAA
  dataVencimento: string; // DD/MM/AAAA
  valorDocumento: string; // R$ formatado
  linhaDigitavel: string;
  codigoBarras: string;
  pagadorNome: string;
  pagadorCpfCnpj?: string;
  pagadorEndereco?: string;
  descricaoReferencia: string;
  instrucoesExtras?: string[];
  brcodePix?: string;
  txidPix?: string;
  especieDoc?: string;
}

/** Formata Nosso Número 8 dígitos Sicoob com hífen no DV (ex: 00000013 -> 0000001-3) */
function formatarNossoNumeroSicoob(nn: string): string {
  const limpo = (nn || '').replace(/\D/g, '');
  if (limpo.length >= 2) {
    return `${limpo.slice(0, -1)}-${limpo.slice(-1)}`;
  }
  return nn || '0000001-0';
}

/** Logotipo Oficial Sicoob (Usa o logotipo oficial baixado de developers.sicoob.com.br/portal/assets/images/logo.png) */
export function LogoSicoobOficial({ height = 26 }: { height?: number }) {
  return (
    <img
      src="/sicoob-logo-oficial.png"
      alt="Sicoob 756-0"
      style={{ height, display: 'inline-block', verticalAlign: 'bottom' }}
    />
  );
}

/** Código de Barras Oficial FEBRABAN Interleaved 2 of 5 (ITF-14 de 44 dígitos) */
export function CodigoBarrasFebraban({ codigo, altura = 50 }: { codigo: string; altura?: number }) {
  let larguras: number[];
  try {
    larguras = barrasITF(codigo);
  } catch {
    return null;
  }
  const unidade = 1.15;
  const total = larguras.reduce((a, b) => a + b, 0) * unidade;
  let x = 0;
  const barras: { x: number; w: number }[] = [];
  larguras.forEach((l, i) => {
    const w = l * unidade;
    if (i % 2 === 0) barras.push({ x, w });
    x += w;
  });
  return (
    <svg
      width={total}
      height={altura}
      viewBox={`0 0 ${total} ${altura}`}
      style={{ display: 'block', maxWidth: '100%', marginTop: 4 }}
      aria-label="Código de barras FEBRABAN"
    >
      {barras.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={altura} fill="#000" />
      ))}
    </svg>
  );
}

const OPENBOLETO_CSS = `
.openboleto-wrapper {
  background-color: #ffffff;
  color: #000000;
  font-family: Arial, Helvetica, sans-serif;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 12px 14px;
  box-sizing: border-box;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}
.openboleto-wrapper * {
  box-sizing: border-box;
}
.openboleto-wrapper .info-empresa {
  font: 11px Arial, Helvetica, sans-serif;
  color: #000;
  margin-bottom: 6px;
}
.openboleto-wrapper .table-boleto {
  font: 9pt Arial, Helvetica, sans-serif;
  width: 100% !important;
  border-collapse: collapse;
}
.openboleto-wrapper .table-boleto td {
  border-left: 1px solid #000;
  border-top: 1px solid #000;
  padding: 2px 5px;
  vertical-align: top;
}
.openboleto-wrapper .table-boleto tr td:last-child {
  border-right: 1px solid #000;
}
.openboleto-wrapper .table-boleto .titulo {
  color: #000033;
  font: 8.5px Arial, Helvetica, sans-serif;
  line-height: 11px;
}
.openboleto-wrapper .table-boleto .conteudo {
  font: bold 10px Arial, Helvetica, sans-serif;
  color: #000;
  min-height: 13px;
  line-height: 13px;
}
.openboleto-wrapper .linha-pontilhada {
  color: #000033;
  font: 9px Arial, Helvetica, sans-serif;
  width: 100%;
  border-bottom: 1px dashed #000;
  text-align: right;
  margin: 8px 0 10px 0;
  padding-bottom: 2px;
}
.openboleto-wrapper .table-boleto .noleftborder {
  border-left: none !important;
}
.openboleto-wrapper .table-boleto .notopborder {
  border-top: none !important;
}
.openboleto-wrapper .table-boleto .norightborder {
  border-right: none !important;
}
.openboleto-wrapper .table-boleto .noborder {
  border: none !important;
}
.openboleto-wrapper .table-boleto .bottomborder {
  border-bottom: 1px solid #000 !important;
}
.openboleto-wrapper .table-boleto .rtl {
  text-align: right;
}
.openboleto-wrapper .table-boleto .nopadding {
  padding: 0px !important;
}
.openboleto-wrapper .table-boleto .header-row-cell {
  border: none !important;
  border-bottom: 2px solid #000 !important;
  padding: 0 0 3px 0 !important;
}
.openboleto-wrapper .table-boleto .header-flex {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  width: 100%;
}
.openboleto-wrapper .table-boleto .logocontainer {
  display: inline-flex;
  align-items: flex-end;
}
.openboleto-wrapper .table-boleto .logobanco {
  display: inline-block;
  max-width: 160px;
}
.openboleto-wrapper .table-boleto .logobanco img {
  height: 25px;
  display: block;
}
.openboleto-wrapper .table-boleto .codbanco {
  font: bold 20px Arial, Helvetica, sans-serif;
  padding: 0 8px;
  display: inline-block;
  border-left: 2px solid #000;
  border-right: 2px solid #000;
  margin-left: 14px;
  line-height: 22px;
  color: #000;
}
.openboleto-wrapper .table-boleto .linha-digitavel {
  font: bold 13.5px Arial, Helvetica, sans-serif;
  text-align: right;
  color: #000;
  flex: 1;
  padding-left: 8px;
  white-space: nowrap;
}
.openboleto-wrapper .float_left {
  float: left;
}
.openboleto-wrapper .conteudo.cpf_cnpj {
  float: right;
  text-align: right;
}
.openboleto-wrapper .caixa-gray-bg {
  background: #f3f4f6;
}
`;

export default function BoletoSicoobOficial({
  beneficiarioNome,
  beneficiarioCnpj,
  beneficiarioEndereco = 'RUA DO COMERCIO, CENTRO — FRANCISCO BELTRAO/PR',
  agencia,
  convenio,
  conta = '175.204-9',
  carteira = '1',
  modalidade = '01',
  nossoNumero,
  numeroDocumento,
  dataDocumento,
  dataProcessamento,
  dataVencimento,
  valorDocumento,
  linhaDigitavel,
  codigoBarras,
  pagadorNome,
  pagadorCpfCnpj,
  pagadorEndereco,
  descricaoReferencia,
  instrucoesExtras,
  brcodePix,
  txidPix,
  especieDoc = 'DM',
}: BoletoSicoobOficialProps) {
  const nnFormatado = formatarNossoNumeroSicoob(nossoNumero);
  const agCodBenef = `${agencia || '4342'} / ${convenio || '4276485'}`;
  const dtProc = dataProcessamento || dataDocumento;
  const qrCodeUrl = brcodePix
    ? `https://api.qrserver.com/v1/create-qr-code/?size=92x92&data=${encodeURIComponent(brcodePix)}`
    : null;

  const demonstrativoLines = [
    `REFERENTE A: ${descricaoReferencia.toUpperCase()}`,
    `COOPERATIVA SICOOB ${agencia || '4342'} · CONTA CORRENTE ${conta} · BENEFICIÁRIO ${convenio || '4276485'}`,
    txidPix ? `ID TRANSAÇÃO PIX (TXID BACEN): ${txidPix}` : 'PAGÁVEL EM QUALQUER BANCO OU VIA PIX QR CODE',
    'EMISSÃO OFICIAL SICOOB (BANCO COOPERATIVO DO BRASIL S.A. - 756-0)',
  ];

  const instrucoesLines =
    instrucoesExtras && instrucoesExtras.length > 0
      ? instrucoesExtras
      : [
          `REFERENTE A: ${descricaoReferencia.toUpperCase()}`,
          'APÓS O VENCIMENTO COBRAR MULTA DE 2,00% E JUROS DE 1,00% AO MÊS.',
          'PAGUE COM PIX APONTANDO A CÂMERA DO CELULAR PARA O QR CODE AO LADO.',
          `COOPERATIVA SICOOB ${agencia || '4342'} · CONTA ${conta} · CONVÊNIO ${convenio || '4276485'}.`,
          txidPix ? `TXID PIX REGISTRADO NO SICOOB: ${txidPix}` : '',
        ].filter(Boolean);

  return (
    <div className="openboleto-wrapper boleto-sicoob-oficial-printable">
      <style dangerouslySetInnerHTML={{ __html: OPENBOLETO_CSS }} />

      {/* =====================================================================
          CABEÇALHO DE IDENTIFICAÇÃO DA EMPRESA (.info-empresa do OpenBoleto)
      ===================================================================== */}
      <div className="info-empresa" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div>
            <strong>{beneficiarioNome}</strong>
          </div>
          <div>CNPJ: {beneficiarioCnpj}</div>
          <div>{beneficiarioEndereco}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '10px', color: '#000033' }}>
          <strong>Recibo do Pagador</strong>
          <div>Cooperativa {agencia || '4342'} · Conta {conta}</div>
        </div>
      </div>

      {/* =====================================================================
          TABELA 1: RECIBO DO PAGADOR (OpenBoleto resources/views/default.phtml)
      ===================================================================== */}
      <table className="table-boleto" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td valign="bottom" colSpan={5} className="header-row-cell">
              <div className="header-flex">
                <div className="logocontainer">
                  <div className="logobanco">
                    <img src="/sicoob-logo-oficial.png" alt="logotipo do banco" />
                  </div>
                  <div className="codbanco">756-0</div>
                </div>
                <div className="linha-digitavel">{linhaDigitavel}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td colSpan={2} width={250}>
              <div className="titulo">Beneficiário</div>
              <div className="conteudo">{beneficiarioNome}</div>
            </td>
            <td>
              <div className="titulo">CPF/CNPJ</div>
              <div className="conteudo">{beneficiarioCnpj}</div>
            </td>
            <td width={135}>
              <div className="titulo">Agência/Código do Beneficiário</div>
              <div className="conteudo rtl">{agCodBenef}</div>
            </td>
            <td width={115} className="caixa-gray-bg">
              <div className="titulo">Vencimento</div>
              <div className="conteudo rtl">{dataVencimento}</div>
            </td>
          </tr>
          <tr>
            <td colSpan={3}>
              <div className="titulo">Pagador</div>
              <div className="conteudo">
                {pagadorNome || 'PAGADOR NÃO INFORMADO'}
                {pagadorCpfCnpj ? ` — CPF/CNPJ: ${pagadorCpfCnpj}` : ''}
              </div>
            </td>
            <td>
              <div className="titulo">Nº documento</div>
              <div className="conteudo rtl">{numeroDocumento}</div>
            </td>
            <td>
              <div className="titulo">Nosso número</div>
              <div className="conteudo rtl">{nnFormatado}</div>
            </td>
          </tr>
          <tr>
            <td>
              <div className="titulo">Espécie</div>
              <div className="conteudo">R$</div>
            </td>
            <td>
              <div className="titulo">Quantidade</div>
              <div className="conteudo rtl">&nbsp;</div>
            </td>
            <td>
              <div className="titulo">Valor</div>
              <div className="conteudo rtl">&nbsp;</div>
            </td>
            <td>
              <div className="titulo">(-) Descontos / Abatimentos</div>
              <div className="conteudo rtl">&nbsp;</div>
            </td>
            <td className="caixa-gray-bg">
              <div className="titulo">(=) Valor Documento</div>
              <div className="conteudo rtl">{valorDocumento}</div>
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <div className="titulo">Demonstrativo</div>
              <div className="conteudo"></div>
            </td>
            <td>
              <div className="titulo">(-) Outras deduções</div>
              <div className="conteudo">&nbsp;</div>
            </td>
            <td>
              <div className="titulo">(+) Outros acréscimos</div>
              <div className="conteudo rtl">&nbsp;</div>
            </td>
            <td>
              <div className="titulo">(=) Valor cobrado</div>
              <div className="conteudo rtl">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td colSpan={4} className="bottomborder">
              <div style={{ marginTop: 4 }} className="conteudo">
                {demonstrativoLines[0]}
              </div>
              <div className="conteudo">{demonstrativoLines[1]}</div>
              <div className="conteudo">{demonstrativoLines[2]}</div>
              <div style={{ marginBottom: 4 }} className="conteudo">
                {demonstrativoLines[3]}
              </div>
            </td>
            <td className="noleftborder bottomborder" style={{ textAlign: 'center' }}>
              <div className="titulo" style={{ textAlign: 'left', marginBottom: 2 }}>
                Autenticação mecânica
              </div>
              {qrCodeUrl && (
                <img
                  src={qrCodeUrl}
                  alt="QR Code Pix"
                  width={68}
                  height={68}
                  style={{ display: 'inline-block', marginTop: 2 }}
                />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="linha-pontilhada">Corte na linha pontilhada</div>

      {/* =====================================================================
          TABELA 2: FICHA DE COMPENSAÇÃO (OpenBoleto partials/ficha-de-compensacao.phtml)
      ===================================================================== */}
      <table className="table-boleto" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td valign="bottom" colSpan={8} className="header-row-cell">
              <div className="header-flex">
                <div className="logocontainer">
                  <div className="logobanco">
                    <img src="/sicoob-logo-oficial.png" alt="logotipo do banco" />
                  </div>
                  <div className="codbanco">756-0</div>
                </div>
                <div className="linha-digitavel">{linhaDigitavel}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td colSpan={7}>
              <div className="titulo">Local de pagamento</div>
              <div className="conteudo">Pagável em qualquer banco até o vencimento ou via Pix QR Code</div>
            </td>
            <td width={165} className="caixa-gray-bg">
              <div className="titulo">Vencimento</div>
              <div className="conteudo rtl">{dataVencimento}</div>
            </td>
          </tr>
          <tr>
            <td colSpan={7} rowSpan={2} valign="top">
              <div className="titulo">Beneficiário</div>
              <div className="conteudo float_left">
                {beneficiarioNome}
                <br />
                {beneficiarioEndereco}
              </div>
              <div className="conteudo cpf_cnpj">CNPJ: {beneficiarioCnpj}</div>
            </td>
            <td>
              <div className="titulo">Agência/Código beneficiário</div>
              <div className="conteudo rtl">{agCodBenef}</div>
            </td>
          </tr>
          <tr>
            <td>
              <div className="titulo">Nosso número</div>
              <div className="conteudo rtl">{nnFormatado}</div>
            </td>
          </tr>
          <tr>
            <td width={105} colSpan={2}>
              <div className="titulo">Data do documento</div>
              <div className="conteudo">{dataDocumento}</div>
            </td>
            <td width={115} colSpan={2}>
              <div className="titulo">Nº documento</div>
              <div className="conteudo">{numeroDocumento}</div>
            </td>
            <td width={65}>
              <div className="titulo">Espécie doc.</div>
              <div className="conteudo">{especieDoc}</div>
            </td>
            <td width={45}>
              <div className="titulo">Aceite</div>
              <div className="conteudo">N</div>
            </td>
            <td width={105}>
              <div className="titulo">Data processamento</div>
              <div className="conteudo">{dtProc}</div>
            </td>
            <td className="caixa-gray-bg">
              <div className="titulo">(=) Valor do Documento</div>
              <div className="conteudo rtl">{valorDocumento}</div>
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <div className="titulo">Uso do banco</div>
              <div className="conteudo">&nbsp;</div>
            </td>
            <td>
              <div className="titulo">Carteira</div>
              <div className="conteudo">
                {carteira}/{modalidade}
              </div>
            </td>
            <td width={45}>
              <div className="titulo">Espécie</div>
              <div className="conteudo">R$</div>
            </td>
            <td colSpan={2}>
              <div className="titulo">Quantidade</div>
              <div className="conteudo">&nbsp;</div>
            </td>
            <td width={105}>
              <div className="titulo">Valor</div>
              <div className="conteudo">&nbsp;</div>
            </td>
            <td>
              <div className="titulo">(-) Descontos / Abatimentos</div>
              <div className="conteudo rtl">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td colSpan={7} rowSpan={4} valign="top">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div className="titulo" style={{ marginBottom: 3 }}>
                    Instruções (Texto de responsabilidade do beneficiário)
                  </div>
                  {instrucoesLines.map((linha, idx) => (
                    <div key={idx} className="conteudo" style={{ marginBottom: 2 }}>
                      {linha}
                    </div>
                  ))}
                </div>
                {qrCodeUrl && (
                  <div
                    style={{
                      textAlign: 'center',
                      border: '1px solid #000033',
                      padding: '3px 5px',
                      background: '#fff',
                      marginTop: 2,
                    }}
                  >
                    <div style={{ fontSize: '7.5px', fontWeight: 700, color: '#000033', marginBottom: 2 }}>
                      PAGUE COM PIX
                    </div>
                    <img src={qrCodeUrl} alt="QR Code Pix Sicoob" width={82} height={82} style={{ display: 'block' }} />
                  </div>
                )}
              </div>
            </td>
            <td>
              <div className="titulo">(-) Outras deduções</div>
              <div className="conteudo rtl">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td>
              <div className="titulo">(+) Mora / Multa</div>
              <div className="conteudo rtl">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td>
              <div className="titulo">(+) Outros acréscimos</div>
              <div className="conteudo rtl">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td className="caixa-gray-bg">
              <div className="titulo">(=) Valor cobrado</div>
              <div className="conteudo rtl">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td colSpan={7} valign="top" className="bottomborder">
              <div className="titulo">Pagador</div>
              <div className="conteudo float_left">
                {pagadorNome || 'PAGADOR NÃO INFORMADO'}
                <br />
                {pagadorEndereco || 'Endereço não informado no cadastro'}
              </div>
              <div className="conteudo cpf_cnpj">
                {pagadorCpfCnpj ? `CPF/CNPJ: ${pagadorCpfCnpj}` : ''}
              </div>
            </td>
            <td className="noleftborder bottomborder">
              <div className="titulo" style={{ marginTop: 26 }}>
                Cód. Baixa
              </div>
            </td>
          </tr>
          <tr>
            <td colSpan={6} className="noborder" style={{ paddingTop: 3 }}>
              <div className="titulo">
                Pagador / Avalista <span className="conteudo sacador">&nbsp;</span>
              </div>
            </td>
            <td colSpan={2} className="noborder" style={{ paddingTop: 3 }}>
              <div className="conteudo noborder rtl" style={{ fontSize: '8.5px', fontWeight: 400, color: '#000033' }}>
                Autenticação mecânica - Ficha de Compensação
              </div>
            </td>
          </tr>
          <tr>
            <td colSpan={8} className="noborder" style={{ paddingTop: 2 }}>
              <CodigoBarrasFebraban codigo={codigoBarras} altura={50} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
