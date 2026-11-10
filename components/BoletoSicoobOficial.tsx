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

/** Logotipo Oficial Sicoob (Símbolo Triangular + Wordmark SICOOB) */
export function LogoSicoobOficial({ height = 26 }: { height?: number }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, userSelect: 'none' }}>
      <svg
        width={height * 1.05}
        height={height}
        viewBox="0 0 44 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Logo Sicoob"
      >
        {/* Triângulo externo / facetas oficiais Sicoob */}
        <path d="M22 2L41 35H3L22 2Z" fill="#003641" />
        <path d="M22 2L31.5 18.5L22 24L12.5 18.5L22 2Z" fill="#00AE9D" />
        <path d="M12.5 18.5L22 24V35H3L12.5 18.5Z" fill="#7DB61C" />
        <path d="M31.5 18.5L41 35H22V24L31.5 18.5Z" fill="#C9D200" />
        <path d="M22 12L28 22.5H16L22 12Z" fill="#003641" />
      </svg>
      <span
        style={{
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontWeight: 900,
          fontSize: height * 0.78,
          letterSpacing: -0.6,
          color: '#003641',
          lineHeight: 1,
        }}
      >
        SICOOB
      </span>
    </div>
  );
}

/** Código de Barras Oficial FEBRABAN Interleaved 2 of 5 (ITF-14 de 44 dígitos) */
export function CodigoBarrasFebraban({ codigo, altura = 52 }: { codigo: string; altura?: number }) {
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
      style={{ display: 'block', maxWidth: '100%' }}
      aria-label="Código de barras FEBRABAN"
    >
      {barras.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={altura} fill="#000" />
      ))}
    </svg>
  );
}

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

  const cellLabelStyle: React.CSSProperties = {
    fontSize: '7.5pt',
    fontFamily: 'Arial, Helvetica, sans-serif',
    color: '#111827',
    fontWeight: 400,
    lineHeight: '10px',
    marginBottom: 2,
    whiteSpace: 'nowrap',
  };

  const cellValueStyle: React.CSSProperties = {
    fontSize: '8.5pt',
    fontFamily: 'Arial, Helvetica, sans-serif',
    color: '#000',
    fontWeight: 700,
    lineHeight: '12px',
  };

  return (
    <div
      className="boleto-sicoob-oficial-printable"
      style={{
        background: '#fff',
        color: '#000',
        fontFamily: 'Arial, Helvetica, sans-serif',
        width: '100%',
        maxWidth: 780,
        margin: '0 auto',
        padding: '10px 12px',
        boxSizing: 'border-box',
        border: '1px solid #d1d5db',
        borderRadius: 4,
      }}
    >
      {/* =====================================================================
          PARTE 1: RECIBO DO PAGADOR (PADRÃO OFICIAL SICOOB / FEBRABAN)
      ===================================================================== */}
      <div style={{ marginBottom: 8 }}>
        {/* Cabeçalho do Recibo do Pagador */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            borderBottom: '2px solid #000',
            paddingBottom: 4,
          }}
        >
          <div style={{ paddingRight: 12 }}>
            <LogoSicoobOficial height={24} />
          </div>
          <div
            style={{
              borderLeft: '2px solid #000',
              borderRight: '2px solid #000',
              padding: '0 10px',
              fontSize: '14pt',
              fontWeight: 900,
              lineHeight: 1.1,
            }}
          >
            756-0
          </div>
          <div
            style={{
              flex: 1,
              textAlign: 'right',
              fontSize: '9pt',
              fontWeight: 700,
              color: '#111',
            }}
          >
            RECIBO DO PAGADOR
          </div>
        </div>

        {/* Linha 1 do Recibo */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000', borderLeft: '1px solid #000', borderRight: '1px solid #000' }}>
          <div style={{ flex: 3.2, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Beneficiário</div>
            <div style={cellValueStyle}>
              {beneficiarioNome} — CNPJ: {beneficiarioCnpj}
            </div>
          </div>
          <div style={{ flex: 1.4, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Agência / Código do Beneficiário</div>
            <div style={{ ...cellValueStyle, textAlign: 'right' }}>{agCodBenef}</div>
          </div>
          <div style={{ flex: 1, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Data Documento</div>
            <div style={{ ...cellValueStyle, textAlign: 'center' }}>{dataDocumento}</div>
          </div>
          <div style={{ flex: 1.2, padding: '3px 5px', background: '#f3f4f6' }}>
            <div style={cellLabelStyle}>Vencimento</div>
            <div style={{ ...cellValueStyle, textAlign: 'right', fontSize: '9.5pt' }}>{dataVencimento}</div>
          </div>
        </div>

        {/* Linha 2 do Recibo */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000', borderLeft: '1px solid #000', borderRight: '1px solid #000' }}>
          <div style={{ flex: 3.2, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Pagador (Sacado)</div>
            <div style={cellValueStyle}>
              {pagadorNome || 'PAGADOR NÃO INFORMADO'}
              {pagadorCpfCnpj ? ` — CPF/CNPJ: ${pagadorCpfCnpj}` : ''}
            </div>
          </div>
          <div style={{ flex: 1.4, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Nosso Número</div>
            <div style={{ ...cellValueStyle, textAlign: 'right' }}>{nnFormatado}</div>
          </div>
          <div style={{ flex: 1, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Nº do Documento</div>
            <div style={{ ...cellValueStyle, textAlign: 'center' }}>{numeroDocumento}</div>
          </div>
          <div style={{ flex: 1.2, padding: '3px 5px', background: '#f3f4f6' }}>
            <div style={cellLabelStyle}>(=) Valor do Documento</div>
            <div style={{ ...cellValueStyle, textAlign: 'right', fontSize: '9.5pt' }}>{valorDocumento}</div>
          </div>
        </div>

        {/* Linha 3 do Recibo — Endereço Beneficiário / Demonstrativo */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000', borderLeft: '1px solid #000', borderRight: '1px solid #000' }}>
          <div style={{ flex: 4.6, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Demonstrativo / Referência</div>
            <div style={{ fontSize: '8pt', fontWeight: 600 }}>
              {descricaoReferencia}
              {conta ? ` · Cooperativa ${agencia || '4342'} · Conta Corrente ${conta}` : ''}
            </div>
          </div>
          <div style={{ flex: 2.2, padding: '3px 5px' }}>
            <div style={{ ...cellLabelStyle, textAlign: 'right' }}>Autenticação Mecânica</div>
            <div style={{ height: 14 }} />
          </div>
        </div>
      </div>

      {/* =====================================================================
          LINHA PONTILHADA DE CORTE (PADRÃO FEBRABAN)
      ===================================================================== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          margin: '8px 0 10px',
          color: '#374151',
          fontSize: '7.5pt',
        }}
      >
        <span>✂</span>
        <div style={{ flex: 1, borderTop: '1px dashed #000' }} />
        <span style={{ fontWeight: 600 }}>Corte na linha pontilhada</span>
      </div>

      {/* =====================================================================
          PARTE 2: FICHA DE COMPENSAÇÃO OFICIAL SICOOB (756-0) + QR CODE PIX
      ===================================================================== */}
      <div>
        {/* Cabeçalho Oficial da Ficha de Compensação: Logo Sicoob | 756-0 | Linha Digitável */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            borderBottom: '2px solid #000',
            paddingBottom: 4,
          }}
        >
          <div style={{ paddingRight: 12 }}>
            <LogoSicoobOficial height={26} />
          </div>
          <div
            style={{
              borderLeft: '2px solid #000',
              borderRight: '2px solid #000',
              padding: '0 10px',
              fontSize: '15pt',
              fontWeight: 900,
              lineHeight: 1.1,
            }}
          >
            756-0
          </div>
          <div
            style={{
              flex: 1,
              textAlign: 'right',
              fontSize: '11.5pt',
              fontWeight: 800,
              fontFamily: '"Courier New", Courier, monospace',
              letterSpacing: 0.3,
              color: '#000',
            }}
          >
            {linhaDigitavel}
          </div>
        </div>

        {/* Linha 1: Local de Pagamento | Vencimento */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000', borderLeft: '1px solid #000', borderRight: '1px solid #000' }}>
          <div style={{ flex: 3, borderRight: '1px solid #000', padding: '3px 6px' }}>
            <div style={cellLabelStyle}>Local de Pagamento</div>
            <div style={{ ...cellValueStyle, fontSize: '8.5pt' }}>
              PAGÁVEL EM QUALQUER BANCO OU PELO PIX ATÉ O VENCIMENTO
            </div>
          </div>
          <div style={{ flex: 1, padding: '3px 6px', background: '#f3f4f6' }}>
            <div style={cellLabelStyle}>Vencimento</div>
            <div style={{ ...cellValueStyle, textAlign: 'right', fontSize: '10pt' }}>{dataVencimento}</div>
          </div>
        </div>

        {/* Linha 2: Beneficiário + CNPJ + Endereço | Agência / Código do Beneficiário */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000', borderLeft: '1px solid #000', borderRight: '1px solid #000' }}>
          <div style={{ flex: 3, borderRight: '1px solid #000', padding: '3px 6px' }}>
            <div style={cellLabelStyle}>Beneficiário</div>
            <div style={cellValueStyle}>
              {beneficiarioNome} — CNPJ: {beneficiarioCnpj}
            </div>
            {beneficiarioEndereco && (
              <div style={{ fontSize: '7.5pt', color: '#1f2937', marginTop: 1 }}>{beneficiarioEndereco}</div>
            )}
          </div>
          <div style={{ flex: 1, padding: '3px 6px' }}>
            <div style={cellLabelStyle}>Agência / Código do Beneficiário</div>
            <div style={{ ...cellValueStyle, textAlign: 'right' }}>{agCodBenef}</div>
          </div>
        </div>

        {/* Linha 3: Data do Documento | Nº do Documento | Espécie Doc. | Aceite | Data Processamento | Nosso Número */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000', borderLeft: '1px solid #000', borderRight: '1px solid #000' }}>
          <div style={{ flex: 0.75, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Data do Documento</div>
            <div style={{ ...cellValueStyle, textAlign: 'center' }}>{dataDocumento}</div>
          </div>
          <div style={{ flex: 0.9, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Nº do Documento</div>
            <div style={{ ...cellValueStyle, textAlign: 'center' }}>{numeroDocumento}</div>
          </div>
          <div style={{ flex: 0.45, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Espécie Doc.</div>
            <div style={{ ...cellValueStyle, textAlign: 'center' }}>{especieDoc}</div>
          </div>
          <div style={{ flex: 0.35, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Aceite</div>
            <div style={{ ...cellValueStyle, textAlign: 'center' }}>N</div>
          </div>
          <div style={{ flex: 0.55, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Data Processamento</div>
            <div style={{ ...cellValueStyle, textAlign: 'center' }}>{dtProc}</div>
          </div>
          <div style={{ flex: 1, padding: '3px 6px' }}>
            <div style={cellLabelStyle}>Nosso Número</div>
            <div style={{ ...cellValueStyle, textAlign: 'right' }}>{nnFormatado}</div>
          </div>
        </div>

        {/* Linha 4: Uso do Banco | Carteira | Espécie | Quantidade | (x) Valor | (=) Valor do Documento */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000', borderLeft: '1px solid #000', borderRight: '1px solid #000' }}>
          <div style={{ flex: 0.65, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Uso do Banco</div>
            <div style={cellValueStyle}>&nbsp;</div>
          </div>
          <div style={{ flex: 0.5, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Carteira</div>
            <div style={{ ...cellValueStyle, textAlign: 'center' }}>
              {carteira} / {modalidade}
            </div>
          </div>
          <div style={{ flex: 0.45, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Espécie</div>
            <div style={{ ...cellValueStyle, textAlign: 'center' }}>R$</div>
          </div>
          <div style={{ flex: 0.65, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>Quantidade</div>
            <div style={cellValueStyle}>&nbsp;</div>
          </div>
          <div style={{ flex: 0.75, borderRight: '1px solid #000', padding: '3px 5px' }}>
            <div style={cellLabelStyle}>(x) Valor</div>
            <div style={cellValueStyle}>&nbsp;</div>
          </div>
          <div style={{ flex: 1, padding: '3px 6px', background: '#f3f4f6' }}>
            <div style={cellLabelStyle}>(=) Valor do Documento</div>
            <div style={{ ...cellValueStyle, textAlign: 'right', fontSize: '10pt' }}>{valorDocumento}</div>
          </div>
        </div>

        {/* Linha 5: Quadro de Instruções + QR Code Pix Híbrido Sicoob (Esquerda) | 5 Linhas FEBRABAN (Direita) */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000', borderLeft: '1px solid #000', borderRight: '1px solid #000' }}>
          {/* Coluna Esquerda (75%): Instruções + QR Code Pix Híbrido Sicoob */}
          <div
            style={{
              flex: 3,
              borderRight: '1px solid #000',
              padding: '5px 8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              minHeight: 132,
            }}
          >
            <div style={{ flex: 1, alignSelf: 'flex-start' }}>
              <div style={cellLabelStyle}>
                Instruções (Texto de responsabilidade do beneficiário. Qualquer dúvida sobre este boleto, contate o beneficiário)
              </div>
              <div style={{ fontSize: '8pt', lineHeight: '13.5px', marginTop: 4, color: '#000' }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>• REFERENTE A: {descricaoReferencia.toUpperCase()}</div>
                {instrucoesExtras && instrucoesExtras.length > 0 ? (
                  instrucoesExtras.map((inst, idx) => <div key={idx}>• {inst}</div>)
                ) : (
                  <>
                    <div>• APÓS O VENCIMENTO COBRAR MULTA DE 2,00% E JUROS DE 1,00% AO MÊS.</div>
                    <div>• PAGUE PELO CÓDIGO DE BARRAS OU APONTE A CÂMERA DO SEU CELULAR PARA O QR CODE PIX AO LADO.</div>
                    <div>• COOPERATIVA SICOOB 4342 · CONTA CORRENTE {conta} · BENEFICIÁRIO {convenio || '4276485'}.</div>
                  </>
                )}
                {txidPix && (
                  <div style={{ marginTop: 3, fontSize: '7.5pt', color: '#111827' }}>
                    • ID TRANSAÇÃO PIX (TXID BACEN): <strong>{txidPix}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Quadro Oficial QR Code Pix Sicoob */}
            {brcodePix && (
              <div
                style={{
                  border: '1.5px solid #003641',
                  borderRadius: 4,
                  padding: '4px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: '#fff',
                  minWidth: 112,
                }}
              >
                <div
                  style={{
                    background: '#003641',
                    color: '#fff',
                    fontSize: '7pt',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 2,
                    marginBottom: 3,
                    width: '100%',
                    textAlign: 'center',
                    letterSpacing: 0.4,
                  }}
                >
                  PAGUE COM PIX
                </div>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodeURIComponent(brcodePix)}`}
                  alt="QR Code Pix Oficial Sicoob"
                  width={92}
                  height={92}
                  style={{ display: 'block' }}
                />
                <div style={{ fontSize: '6.5pt', fontWeight: 700, color: '#003641', marginTop: 2 }}>
                  SICOOB PIX OFICIAL
                </div>
              </div>
            )}
          </div>

          {/* Coluna Direita (25%): 5 Campos Empilhados Padrão FEBRABAN */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ borderBottom: '1px solid #000', padding: '2px 6px', flex: 1 }}>
              <div style={cellLabelStyle}>(-) Desconto / Abatimento</div>
              <div style={{ ...cellValueStyle, textAlign: 'right' }}>&nbsp;</div>
            </div>
            <div style={{ borderBottom: '1px solid #000', padding: '2px 6px', flex: 1 }}>
              <div style={cellLabelStyle}>(-) Outras Deduções</div>
              <div style={{ ...cellValueStyle, textAlign: 'right' }}>&nbsp;</div>
            </div>
            <div style={{ borderBottom: '1px solid #000', padding: '2px 6px', flex: 1 }}>
              <div style={cellLabelStyle}>(+) Mora / Multa</div>
              <div style={{ ...cellValueStyle, textAlign: 'right' }}>&nbsp;</div>
            </div>
            <div style={{ borderBottom: '1px solid #000', padding: '2px 6px', flex: 1 }}>
              <div style={cellLabelStyle}>(+) Outros Acréscimos</div>
              <div style={{ ...cellValueStyle, textAlign: 'right' }}>&nbsp;</div>
            </div>
            <div style={{ padding: '2px 6px', flex: 1, background: '#f3f4f6' }}>
              <div style={cellLabelStyle}>(=) Valor Cobrado</div>
              <div style={{ ...cellValueStyle, textAlign: 'right' }}>&nbsp;</div>
            </div>
          </div>
        </div>

        {/* Linha 6: Pagador (Sacado) + Sacador/Avalista */}
        <div
          style={{
            borderBottom: '2px solid #000',
            borderLeft: '1px solid #000',
            borderRight: '1px solid #000',
            padding: '4px 6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <span style={{ ...cellLabelStyle, marginRight: 6 }}>Pagador:</span>
              <span style={{ fontSize: '8.5pt', fontWeight: 700 }}>
                {pagadorNome || 'PAGADOR NÃO INFORMADO'}
              </span>
            </div>
            {pagadorCpfCnpj && (
              <div style={{ fontSize: '8.5pt', fontWeight: 700 }}>
                CPF/CNPJ: {pagadorCpfCnpj}
              </div>
            )}
          </div>
          <div style={{ fontSize: '8pt', color: '#111827', marginTop: 2, minHeight: 13 }}>
            {pagadorEndereco || 'Endereço não informado no cadastro'}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginTop: 4,
              paddingTop: 2,
              borderTop: '1px dotted #d1d5db',
            }}
          >
            <div style={cellLabelStyle}>Sacador / Avalista: —</div>
            <div style={cellLabelStyle}>Código de Baixa: —</div>
          </div>
        </div>

        {/* Rodapé da Ficha de Compensação: Código de Barras ITF-14 (Esquerda) + Autenticação Mecânica (Direita) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingTop: 8,
            gap: 14,
          }}
        >
          <div style={{ flex: 1 }}>
            <CodigoBarrasFebraban codigo={codigoBarras} altura={52} />
          </div>
          <div style={{ minWidth: 210, textAlign: 'right' }}>
            <div style={{ fontSize: '7.5pt', fontWeight: 700, color: '#111827' }}>
              Autenticação Mecânica — Ficha de Compensação
            </div>
            <div style={{ fontSize: '7pt', color: '#4b5563', marginTop: 4 }}>
              SICOOB 756-0 · Central de Atendimento: 0800 642 0000
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

