import { describe, expect, it } from 'vitest';
import { inflateRawSync } from 'zlib';
import { XmlNfeInvalidoError, code128C, formatarDocumento, gerarDanfePdf, gerarDanfePdfUnico, lerDadosDanfe } from './danfe';
import { filtroNotasDestinadas } from './filtro';
import { criarZipBuffer } from '../nfse/zip';

const CHAVE = '41261111222333000181550010000012341000012345';

const item = (n: number, descricao = `Produto ${n}`) => `
  <det nItem="${n}"><prod><cProd>P${n}</cProd><xProd>${descricao}</xProd><NCM>84713012</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>50.5000000000</vUnCom><vProd>101.00</vProd></prod>
  <imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST><vBC>101.00</vBC><pICMS>18.00</pICMS><vICMS>18.18</vICMS></ICMS00></ICMS><IPI><IPITrib><vBC>101.00</vBC><pIPI>5.00</pIPI><vIPI>5.05</vIPI></IPITrib></IPI></imposto></det>`;

const xmlNota = (itens: string, ambiente = '1') => `<?xml version="1.0"?><nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${CHAVE}" versao="4.00">
  <ide><natOp>VENDA DE MERCADORIA</natOp><serie>1</serie><nNF>1234</nNF><dhEmi>2026-11-03T10:15:00-03:00</dhEmi><dhSaiEnt>2026-11-03T11:00:00-03:00</dhSaiEnt><tpNF>1</tpNF><tpAmb>${ambiente}</tpAmb></ide>
  <emit><CNPJ>11222333000181</CNPJ><xNome>Fornecedor &amp; Filhos Ltda</xNome><enderEmit><xLgr>Rua A</xLgr><nro>10</nro><xBairro>Centro</xBairro><xMun>Curitiba</xMun><UF>PR</UF><CEP>80000000</CEP><fone>4133334444</fone></enderEmit><IE>123456</IE></emit>
  <dest><CNPJ>11444777000161</CNPJ><xNome>Cliente Exemplo SA</xNome><enderDest><xLgr>Av B</xLgr><nro>20</nro><xBairro>Sul</xBairro><xMun>Francisco Beltrao</xMun><UF>PR</UF><CEP>85600000</CEP></enderDest><IE>654321</IE></dest>
  ${itens}
  <total><ICMSTot><vBC>101.00</vBC><vICMS>18.18</vICMS><vBCST>0.00</vBCST><vST>0.00</vST><vProd>101.00</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vIPI>5.05</vIPI><vOutro>0.00</vOutro><vNF>106.05</vNF></ICMSTot></total>
  <transp><modFrete>1</modFrete><transporta><CNPJ>11222333000181</CNPJ><xNome>Transportes X</xNome></transporta><vol><qVol>3</qVol><esp>CAIXA</esp><pesoB>12.500</pesoB></vol></transp>
  <cobr><dup><nDup>001</nDup><dVenc>2026-12-03</dVenc><vDup>106.05</vDup></dup></cobr>
  <infAdic><infCpl>Pedido 77</infCpl></infAdic>
</infNFe></NFe><protNFe><infProt><chNFe>${CHAVE}</chNFe><dhRecbto>2026-11-03T10:16:00-03:00</dhRecbto><nProt>141260000000001</nProt></infProt></protNFe></nfeProc>`;

const paginas = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) || []).length;

describe('leitura do XML da NF-e', () => {
  const d = lerDadosDanfe(xmlNota(item(1) + item(2)));

  it('lê identificação, protocolo e partes', () => {
    expect(d.chave).toBe(CHAVE);
    expect(d.numero).toBe('1234');
    expect(d.protocolo).toBe('141260000000001');
    expect(d.emitente.nome).toBe('Fornecedor & Filhos Ltda');
    expect(d.emitente.endereco.municipio).toBe('Curitiba');
    expect(d.destinatario.documento).toBe('11444777000161');
  });

  it('lê itens, impostos, totais, transporte e duplicatas', () => {
    expect(d.itens).toHaveLength(2);
    expect(d.itens[1]).toMatchObject({ codigo: 'P2', cst: '000', cfop: '5102', valorIcms: '18.18', valorIpi: '5.05', aliqIcms: '18.00' });
    expect(d.totais.vNF).toBe('106.05');
    expect(d.transporte.frete).toContain('destinatário');
    expect(d.transporte.pesoBruto).toBe('12.500');
    expect(d.duplicatas).toEqual([{ numero: '001', vencimento: '2026-12-03', valor: '106.05' }]);
    expect(d.informacoes).toBe('Pedido 77');
  });

  it('lê o CSOSN do Simples Nacional', () => {
    const simples = item(1).replace(/<ICMS00>.*<\/ICMS00>/, '<ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102>');
    expect(lerDadosDanfe(xmlNota(simples)).itens[0].cst).toBe('0102');
  });

  it('recusa um resumo (resNFe), que não traz a nota', () => {
    expect(() => lerDadosDanfe(`<resNFe><chNFe>${CHAVE}</chNFe></resNFe>`)).toThrow(XmlNfeInvalidoError);
  });

  it('formata CNPJ e CPF', () => {
    expect(formatarDocumento('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatarDocumento('12345678909')).toBe('123.456.789-09');
  });
});

describe('código de barras', () => {
  it('codifica pares de dígitos com início, verificador e parada', () => {
    const larguras = code128C('1234');
    // Início + 2 pares + verificador = 4 símbolos de 11 módulos, e parada de 13.
    expect(larguras.reduce((a, b) => a + b, 0)).toBe(4 * 11 + 13);
    // Início C (105), 12, 34: soma 105 + 12 + 68 = 185; verificador 185 % 103 = 82.
    expect(larguras.slice(0, 6).join('')).toBe('211232');
    expect(larguras.slice(6, 12).join('')).toBe('112232');
    expect(larguras.slice(12, 18).join('')).toBe('131123');
    expect(larguras.slice(18, 24).join('')).toBe('121241');
    expect(larguras.slice(24).join('')).toBe('2331112');
  });

  it('comporta a chave de 44 dígitos: 22 pares', () => {
    expect(code128C(CHAVE).reduce((a, b) => a + b, 0)).toBe(24 * 11 + 13);
  });

  it('recusa número ímpar de dígitos', () => {
    expect(() => code128C('123')).toThrow();
  });
});

describe('PDF', () => {
  it('gera um PDF válido de uma folha para uma nota pequena', () => {
    const pdf = gerarDanfePdf(xmlNota(item(1)));
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(paginas(pdf)).toBe(1);
  });

  it('continua os itens em novas folhas', () => {
    const muitos = Array.from({ length: 120 }, (_, i) => item(i + 1)).join('');
    expect(paginas(gerarDanfePdf(xmlNota(muitos)))).toBeGreaterThan(1);
  });

  it('não quebra com nota cancelada, em homologação ou sem dados opcionais', () => {
    expect(paginas(gerarDanfePdf(xmlNota(item(1)), 'cancelada'))).toBe(1);
    expect(paginas(gerarDanfePdf(xmlNota(item(1), '2')))).toBe(1);
    const minima = xmlNota(item(1)).replace(/<transp>[\s\S]*<\/cobr>/, '').replace(/<infAdic>.*<\/infAdic>/, '');
    expect(paginas(gerarDanfePdf(minima))).toBe(1);
  });

  it('junta várias notas num arquivo só', () => {
    const dados = lerDadosDanfe(xmlNota(item(1)));
    expect(paginas(gerarDanfePdfUnico([{ dados, situacao: 'autorizada' }, { dados, situacao: 'cancelada' }]))).toBe(2);
  });
});

describe('filtro da exportação', () => {
  it('prende na empresa e aplica o mês', () => {
    expect(filtroNotasDestinadas('e1', { mes: '2026-11' })).toEqual({ empresaId: 'e1', dataEmissao: { gte: '2026-11-01', lte: '2026-11-31' } });
  });

  it('ignora mês e situação inválidos', () => {
    expect(filtroNotasDestinadas('e1', { mes: "1' OR 1=1", situacao: 'x' })).toEqual({ empresaId: 'e1' });
  });
});

describe('ZIP comprimido', () => {
  /** Lê as entradas pelo diretório central, como um descompactador real. */
  function lerZip(zip: Buffer): Record<string, Buffer> {
    const fim = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const total = zip.readUInt16LE(fim + 10);
    let pos = zip.readUInt32LE(fim + 16);
    const saida: Record<string, Buffer> = {};
    for (let i = 0; i < total; i++) {
      const metodo = zip.readUInt16LE(pos + 10);
      const tamanho = zip.readUInt32LE(pos + 20);
      const tamNome = zip.readUInt16LE(pos + 28);
      const nome = zip.subarray(pos + 46, pos + 46 + tamNome).toString();
      const local = zip.readUInt32LE(pos + 42);
      const inicio = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const dados = zip.subarray(inicio, inicio + tamanho);
      saida[nome] = metodo === 8 ? inflateRawSync(dados) : Buffer.from(dados);
      pos += 46 + tamNome;
    }
    return saida;
  }

  it('devolve o conteúdo intacto e encolhe o XML', () => {
    const xml = Buffer.from(xmlNota(Array.from({ length: 50 }, (_, i) => item(i)).join('')));
    const curto = Buffer.from('a');
    const zip = criarZipBuffer([{ nome: 'xml/nota.xml', conteudo: xml }, { nome: 'curto.txt', conteudo: curto }]);
    const lidos = lerZip(zip);
    expect(lidos['xml/nota.xml'].equals(xml)).toBe(true);
    expect(lidos['curto.txt'].equals(curto)).toBe(true);
    expect(zip.length).toBeLessThan(xml.length / 3);
  });
});
