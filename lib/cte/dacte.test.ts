import { describe, expect, it } from 'vitest';
import { XmlCteInvalidoError, gerarDactePdf, lerDadosDacte } from './dacte';

// Chave de 44 dígitos com modelo 57 (posições 20-21) = CT-e.
const CHAVE = '41261111222333000181570010000012341000012347';

const xmlCte = (ambiente = '1', situacaoProt = '100') => `<?xml version="1.0"?><cteProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte"><CTe><infCte Id="CTe${CHAVE}" versao="4.00">
  <ide><cUF>41</cUF><CFOP>6352</CFOP><natOp>PRESTACAO DE SERVICO DE TRANSPORTE</natOp><mod>57</mod><serie>1</serie><nCT>1234</nCT><dhEmi>2026-11-03T10:15:00-03:00</dhEmi><tpAmb>${ambiente}</tpAmb><tpCTe>0</tpCTe><tpServ>0</tpServ><modal>01</modal><xMunIni>Curitiba</xMunIni><UFIni>PR</UFIni><xMunFim>Sao Paulo</xMunFim><UFFim>SP</UFFim><toma3><toma>3</toma></toma3></ide>
  <emit><CNPJ>11222333000181</CNPJ><IE>123456</IE><xNome>Transportadora &amp; Cia Ltda</xNome><enderEmit><xLgr>Rua A</xLgr><nro>10</nro><xBairro>Centro</xBairro><xMun>Curitiba</xMun><UF>PR</UF><CEP>80000000</CEP><fone>4133334444</fone></enderEmit></emit>
  <rem><CNPJ>11444777000161</CNPJ><IE>654321</IE><xNome>Remetente Exemplo SA</xNome><enderReme><xLgr>Av B</xLgr><nro>20</nro><xBairro>Sul</xBairro><xMun>Curitiba</xMun><UF>PR</UF><CEP>80010000</CEP></enderReme></rem>
  <dest><CNPJ>99888777000166</CNPJ><xNome>Destinatario Final SA</xNome><enderDest><xLgr>Rua C</xLgr><nro>30</nro><xBairro>Centro</xBairro><xMun>Sao Paulo</xMun><UF>SP</UF><CEP>01000000</CEP></enderDest></dest>
  <vPrest><vTPrest>1500.00</vTPrest><vRec>1500.00</vRec><Comp><xNome>FRETE PESO</xNome><vComp>1200.00</vComp></Comp><Comp><xNome>PEDAGIO</xNome><vComp>300.00</vComp></Comp></vPrest>
  <imp><ICMS><ICMS00><CST>00</CST><vBC>1500.00</vBC><pICMS>12.00</pICMS><vICMS>180.00</vICMS></ICMS00></ICMS></imp>
  <infCTeNorm><infCarga><vCarga>50000.00</vCarga><proPred>Eletronicos</proPred><infQ><cUnid>01</cUnid><tpMed>01</tpMed><qCarga>1200.0000</qCarga></infQ></infCarga></infCTeNorm>
  <compl><xObs>Entrega agendada</xObs></compl>
</infCte></CTe><protCTe><infProt><chCTe>${CHAVE}</chCTe><cStat>${situacaoProt}</cStat><dhRecbto>2026-11-03T10:16:00-03:00</dhRecbto><nProt>141260000000009</nProt></infProt></protCTe></cteProc>`;

const paginas = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) || []).length;

describe('leitura do XML do CT-e', () => {
  const d = lerDadosDacte(xmlCte());

  it('lê identificação, protocolo e percurso', () => {
    expect(d.chave).toBe(CHAVE);
    expect(d.numero).toBe('1234');
    expect(d.protocolo).toBe('141260000000009');
    expect(d.modal).toBe('Rodoviário');
    expect(d.origem).toBe('Curitiba - PR');
    expect(d.destino).toBe('Sao Paulo - SP');
  });

  it('lê partes, valores, ICMS e carga', () => {
    expect(d.emitente.nome).toBe('Transportadora & Cia Ltda');
    expect(d.remetente.documento).toBe('11444777000161');
    expect(d.destinatario.documento).toBe('99888777000166');
    expect(d.tomador).toBe('Destinatário');
    expect(d.valores.total).toBe('1500.00');
    expect(d.valores.componentes).toHaveLength(2);
    expect(d.icms).toMatchObject({ cst: '00', aliquota: '12.00', valor: '180.00' });
    expect(d.carga.produtoPredominante).toBe('Eletronicos');
    expect(d.carga.quantidades[0]).toMatchObject({ tipo: 'KG', quantidade: '1200.0000' });
    expect(d.observacoes).toContain('Entrega agendada');
  });

  it('recusa um XML que não é CT-e', () => {
    expect(() => lerDadosDacte('<resCTe><chCTe>x</chCTe></resCTe>')).toThrow(XmlCteInvalidoError);
  });
});

describe('PDF do DACTE', () => {
  it('gera um PDF de uma folha', () => {
    const pdf = gerarDactePdf(xmlCte());
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(paginas(pdf)).toBe(1);
  });

  it('não quebra cancelado, em homologação ou sem campos opcionais', () => {
    expect(paginas(gerarDactePdf(xmlCte('1', '101'), 'cancelada'))).toBe(1);
    expect(paginas(gerarDactePdf(xmlCte('2')))).toBe(1);
    const minimo = xmlCte().replace(/<vPrest>[\s\S]*<\/vPrest>/, '<vPrest></vPrest>').replace(/<infCTeNorm>[\s\S]*<\/infCTeNorm>/, '').replace(/<compl>[\s\S]*<\/compl>/, '');
    expect(paginas(gerarDactePdf(minimo))).toBe(1);
  });
});
