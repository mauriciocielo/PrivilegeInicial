import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import logoNfse from './dados/logo-nfse.json';
import { gerarDanfsePdf, lerDadosDanfse, marcaDaguaDaNota, urlConsultaPublica } from './danfse';

const chave = '43051082211222333000181000000000014726107654321098';

export function xmlExemplo(extra: { tpAmb?: string; toma?: string; tribFed?: string; dCompet?: string } = {}) {
  const toma = extra.toma ?? `<toma><CNPJ>04252011000110</CNPJ><xNome>Cliente &amp; Cia Ltda</xNome><end><endNac><cMun>4305108</cMun><CEP>95000000</CEP></endNac><xLgr>Rua A</xLgr><nro>10</nro><xCpl>Sala 2</xCpl><xBairro>Centro</xBairro></end><fone>5433334444</fone><email>a@b.com</email></toma>`;
  const tribFed = extra.tribFed ?? `<tribFed><piscofins><CST>00</CST><tpRetPisCofins>3</tpRetPisCofins></piscofins><vRetIRRF>15.00</vRetIRRF><vRetCSLL>46.50</vRetCSLL></tribFed>`;
  return `<NFSe xmlns="x" versao="1.01"><infNFSe Id="NFS${chave}"><xLocEmi>Caxias do Sul</xLocEmi><xLocPrestacao>Caxias do Sul</xLocPrestacao><nNFSe>147</nNFSe><cLocIncid>4305108</cLocIncid><xLocIncid>Caxias do Sul</xLocIncid>`
    + `<xTribNac>Assessoria ou consultoria de qualquer natureza</xTribNac><verAplic>1</verAplic><ambGer>2</ambGer><tpEmis>1</tpEmis><cStat>100</cStat><dhProc>2026-10-15T10:00:07-03:00</dhProc><nDFSe>1</nDFSe>`
    + `<emit><CNPJ>11222333000181</CNPJ><xNome>Empresa Exemplo Ltda</xNome><enderNac><xLgr>Av. Brasil</xLgr><nro>100</nro><xBairro>Centro</xBairro><cMun>4305108</cMun><UF>RS</UF><CEP>95010000</CEP></enderNac></emit>`
    + `<valores><vBC>1000.00</vBC><pAliqAplic>3.00</pAliqAplic><vISSQN>30.00</vISSQN><vTotalRet>91.50</vTotalRet><vLiq>908.50</vLiq></valores>`
    + `<DPS versao="1.01"><infDPS Id="DPS1"><tpAmb>${extra.tpAmb ?? '1'}</tpAmb><dhEmi>2026-10-15T10:00:00-03:00</dhEmi><serie>900</serie><nDPS>5</nDPS><dCompet>${extra.dCompet ?? '2026-10-01'}</dCompet><tpEmit>1</tpEmit><cLocEmi>4305108</cLocEmi>`
    + `<prest><CNPJ>11222333000181</CNPJ><IM>55</IM><fone>5499998888</fone><email>contato@exemplo.com</email><regTrib><opSimpNac>3</opSimpNac><regApTribSN>1</regApTribSN><regEspTrib>0</regEspTrib></regTrib></prest>${toma}`
    + `<serv><locPrest><cLocPrestacao>4305108</cLocPrestacao></locPrest><cServ><cTribNac>170101</cTribNac><cTribMun>001</cTribMun><xDescServ>Consultoria financeira referente a 10/2026</xDescServ><cNBS>115021000</cNBS></cServ></serv>`
    + `<valores><vServPrest><vServ>1000.00</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>2</tpRetISSQN><pAliq>3.00</pAliq></tribMun>${tribFed}<totTrib><pTotTribSN>6.00</pTotTribSN></totTrib></trib></valores></infDPS></DPS></infNFSe></NFSe>`;
}

describe('dados do DANFSe', () => {
  const d = lerDadosDanfse(xmlExemplo());

  it('identifica a nota como manda o item 2.4.5', () => {
    expect(d).toMatchObject({
      chave, numero: '147', competencia: '01/10/2026', dhProc: '15/10/2026 10:00:07', dhEmi: '15/10/2026 10:00:00', nDps: '5', serie: '900',
      emitente: 'Prestador', situacao: 'NFS-e Gerada', finalidade: 'NFS-e regular',
      municipioEmissor: 'Caxias do Sul / RS', ambienteGerador: 'Sefin Nacional NFS-e', tipoAmbiente: 'Produção', semValidade: false,
    });
  });

  it('completa nome e endereço do prestador pelo grupo emit', () => {
    expect(d.prestador).toEqual({
      documento: '11.222.333/0001-81', inscricao: '55', telefone: '5499998888', nome: 'Empresa Exemplo Ltda',
      municipio: 'Caxias do Sul / RS', ibgeCep: '4305108 / 95.010-000', endereco: 'Av. Brasil, 100, Centro', email: 'contato@exemplo.com',
    });
    expect(d.simplesNacional).toContain('ME/EPP');
    expect(d.regimeApuracao).toContain('pelo Simples Nacional');
  });

  it('formata o tomador e o serviço', () => {
    expect(d.tomador).toMatchObject({ documento: '04.252.011/0001-10', nome: 'Cliente & Cia Ltda', municipio: 'Caxias do Sul / RS', endereco: 'Rua A, 10, Sala 2, Centro' });
    expect(d).toMatchObject({ codigoTributacao: '17.01.01 / 001', nbs: '1.1502.10.00', localPrestacao: 'Caxias do Sul / RS / BR', incidencia: 'Caxias do Sul / RS / BR' });
  });

  it('traz tributos e totais', () => {
    expect(d).toMatchObject({
      tipoTributacao: 'Operação Tributável', regimeEspecial: 'Nenhum', retencaoIssqn: 'Retido pelo Tomador',
      bcIssqn: 'R$ 1.000,00', aliquota: '3,00%', issqn: 'R$ 30,00', irrf: 'R$ 15,00', cp: '-', contribuicoes: 'R$ 46,50',
      descricaoContribuicoes: 'PIS/COFINS/CSLL Retidos', valorServico: 'R$ 1.000,00', totalRetencoes: 'R$ 91,50', valorLiquido: 'R$ 908,50', valorLiquidoTotal: '-',
    });
    expect(d.informacoes).toContain('Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: Simples Nacional: 6,00%');
  });

  it('preenche com traço o que não está no XML', () => {
    expect(d.destinatario).toBeNull();
    expect(d.intermediario).toBeNull();
    expect(d.ibs[0].valor).toBe('-');
    expect(d.ibsLinhas[0][1].valor).toBe('-');
  });

  it('no código 1 soma vPis e vCofins às retidas e zera a apuração própria', () => {
    const r = lerDadosDanfse(xmlExemplo({ tribFed: '<tribFed><piscofins><CST>00</CST><vPis>6.50</vPis><vCofins>30.00</vCofins><tpRetPisCofins>1</tpRetPisCofins></piscofins><vRetCSLL>10.00</vRetCSLL></tribFed>' }));
    expect(r).toMatchObject({ contribuicoes: 'R$ 46,50', pis: 'R$ 0,00', cofins: 'R$ 0,00' });
  });

  it('marca nota de teste e tira a linha de apuração própria a partir de 2027', () => {
    expect(lerDadosDanfse(xmlExemplo({ tpAmb: '2' }))).toMatchObject({ semValidade: true, tipoAmbiente: 'Homologação' });
    expect(lerDadosDanfse(xmlExemplo({ dCompet: '2027-01-01' })).exibirApuracaoPropria).toBe(false);
    expect(d.exibirApuracaoPropria).toBe(true);
  });

  it('aponta o QR Code para a consulta pública', () => {
    expect(urlConsultaPublica(chave)).toBe(`https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${chave}`);
  });

  it('escolhe a marca d\'água pelo evento', () => {
    expect(marcaDaguaDaNota('emitida', null)).toBeNull();
    expect(marcaDaguaDaNota('cancelada', '<e101101/>')).toBe('CANCELADA');
    expect(marcaDaguaDaNota('cancelada', '<e105102/>')).toBe('SUBSTITUÍDA');
    expect(marcaDaguaDaNota('cancelada', null)).toBe('CANCELADA');
  });
});

describe('PDF do DANFSe', () => {
  const logoPng = Buffer.from(logoNfse.png, 'base64');

  async function gerar(xml: string, marcaDagua: 'CANCELADA' | null = null) {
    const dados = lerDadosDanfse(xml);
    const qrPng = await QRCode.toBuffer(urlConsultaPublica(dados.chave), { margin: 0, width: 300 });
    return gerarDanfsePdf(dados, { logoPng, qrPng, marcaDagua });
  }

  it('gera um PDF de uma única página A4, mesmo com descrição longa', async () => {
    const longa = 'Serviço de consultoria. '.repeat(120);
    const pdf = await gerar(xmlExemplo().replace('Consultoria financeira referente a 10/2026', longa));
    const texto = pdf.toString('latin1');
    expect(texto.startsWith('%PDF-')).toBe(true);
    expect((texto.match(/\/Type\s*\/Page\b/g) || []).length).toBe(1);
    expect(texto).toMatch(/\/MediaBox\s*\[0 0 595\.\d+ 841\.\d+\]/);
    if (process.env.SAIDA_DANFSE) {
      fs.writeFileSync(path.join(process.env.SAIDA_DANFSE, 'normal.pdf'), await gerar(xmlExemplo()));
      fs.writeFileSync(path.join(process.env.SAIDA_DANFSE, 'teste-cancelada-sem-tomador.pdf'), await gerar(xmlExemplo({ tpAmb: '2', toma: '' }), 'CANCELADA'));
    }
  });
});
