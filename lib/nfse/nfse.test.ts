import { beforeAll, describe, expect, it } from 'vitest';
import { gunzipSync, gzipSync } from 'zlib';
import forge from 'node-forge';
import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import {
  LEIAUTE_NT009, LEIAUTE_PRODUCAO, cnpjValido, cpfValido, dataCompetenciaFiscal, dataHoraFiscal,
  exigeAliquotaNaDps, idDps, montarCancelamento, montarDps, validarCancelamento, validarEmissao,
  type ConfigFiscalNfse, type DadosDps,
} from './dps';
import { assinarXml, certificadoPertenceAoCnpj, lerCertificadoA1, CertificadoInvalidoError, type CredencialA1 } from './assinatura';
import { cifrar, decifrar, CofreNaoConfiguradoError } from './cofre';
import { emitirNfse, lerErros, lerValoresNfse, SefinIndisponivelError, verificarProcuracao, type RespostaHttp, type Transporte } from './sefin';

const CNPJ = '11222333000181';
const SENHA = 'senha-de-teste';

const cfgBase: ConfigFiscalNfse = {
  cnpj: CNPJ,
  codigoMunicipio: '4305108',
  opSimpNac: 3,
  regApTribSN: 1,
  regEspTrib: 0,
  pTotTribSN: 6,
  piscofinsCst: '08',
  convenioAtivo: true,
};

const dadosBase: DadosDps = {
  ambiente: 'producao',
  serie: '10',
  nDps: '278',
  dataCompetencia: '2026-11',
  descricao: 'Consultoria financeira',
  valorServicos: 1500,
  cTribNac: '170101',
  municipioPrestacao: '4305108',
  issRetido: false,
  tomadorDocumento: '52998224725',
  tomadorNome: 'Maria & Filhos <Ltda>',
};

const AGORA = new Date('2026-11-03T15:00:10Z');

function gerarPfx(cnpjNoCertificado = CNPJ, validade = new Date('2030-01-01')): Buffer {
  const chaves = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2020-01-01');
  cert.validity.notAfter = validade;
  const atributos = [{ name: 'commonName', value: `EMPRESA TESTE LTDA:${cnpjNoCertificado}` }];
  cert.setSubject(atributos);
  cert.setIssuer(atributos);
  cert.sign(chaves.privateKey, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(chaves.privateKey, [cert], SENHA, { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary');
}

describe('validação de documentos', () => {
  it('aceita CNPJ e CPF válidos e recusa dígito errado', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
    expect(cnpjValido('11111111111111')).toBe(false);
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-26')).toBe(false);
  });
});

describe('datas fiscais', () => {
  it('gera dhEmi em Brasília, com offset e recuo de 5s', () => {
    expect(dataHoraFiscal(AGORA)).toBe('2026-11-03T12:00:05-03:00');
  });

  it('não atravessa a meia-noite ao recuar', () => {
    expect(dataHoraFiscal(new Date('2026-11-01T03:00:02Z'))).toBe('2026-11-01T00:00:00-03:00');
  });

  it('usa hoje na competência corrente e o último dia em mês passado', () => {
    expect(dataCompetenciaFiscal('2026-11', AGORA)).toBe('2026-11-03');
    expect(dataCompetenciaFiscal('2026-02', AGORA)).toBe('2026-02-28');
  });
});

describe('montagem da DPS', () => {
  it('gera o Id de 45 caracteres no formato do Sefin', () => {
    const id = idDps({ cnpj: '17.281.973/0010-30', codigoMunicipio: '3106705' }, '1', '278524');
    expect(id).toBe('DPS310670521728197300103000001000000000278524');
    expect(id).toHaveLength(45);
  });

  it('segue a ordem do XSD no leiaute de produção', () => {
    const { xml, leiaute } = montarDps(cfgBase, dadosBase, AGORA);
    expect(leiaute).toBe(LEIAUTE_PRODUCAO);
    expect(xml).not.toContain('<finNFSe>');
    expect(xml.indexOf('<cTribNac>')).toBeLessThan(xml.indexOf('<xDescServ>'));
    const ordem = ['<tpAmb>1', '<dhEmi>', '<verAplic>', '<serie>10', '<nDPS>278', '<dCompet>', '<tpEmit>', '<cLocEmi>', '<prest>', '<toma>', '<serv>', '<valores>'];
    const posicoes = ordem.map(t => xml.indexOf(t));
    expect(posicoes.every(p => p >= 0)).toBe(true);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });

  it('no leiaute NT 009 move finNFSe para o infDPS e xDescServ para o fim do cServ', () => {
    const { xml, leiaute } = montarDps(cfgBase, { ...dadosBase, ambiente: 'homologacao', cNbs: '123456789' }, AGORA);
    expect(leiaute).toBe(LEIAUTE_NT009);
    expect(xml).toContain('<tpAmb>2');
    expect(xml.indexOf('<tpEmit>')).toBeLessThan(xml.indexOf('<finNFSe>'));
    expect(xml.indexOf('<finNFSe>')).toBeLessThan(xml.indexOf('<cLocEmi>'));
    expect(xml.indexOf('<cNBS>')).toBeLessThan(xml.indexOf('<xDescServ>'));
  });

  it('não envia nome nem endereço do prestador (E0128/E0121)', () => {
    const { xml } = montarDps(cfgBase, dadosBase, AGORA);
    const prest = xml.match(/<prest>.*<\/prest>/)![0];
    expect(prest).not.toContain('xNome');
    expect(prest).not.toContain('<end>');
  });

  it('escapa caracteres especiais do texto', () => {
    const { xml } = montarDps(cfgBase, dadosBase, AGORA);
    expect(xml).toContain('<xNome>Maria &amp; Filhos &lt;Ltda&gt;</xNome>');
  });

  it('aplica as regras de cada regime', () => {
    const meepp = montarDps(cfgBase, dadosBase, AGORA).xml;
    expect(meepp).toContain('<regApTribSN>1</regApTribSN>');
    expect(meepp).toContain('<pTotTribSN>6.00</pTotTribSN>');
    expect(meepp).not.toContain('indTotTrib');

    const mei = montarDps({ ...cfgBase, opSimpNac: 2 }, dadosBase, AGORA).xml;
    expect(mei).not.toContain('regApTribSN');
    expect(mei).not.toContain('tribFed');
    expect(mei).toContain('<indTotTrib>0</indTotTrib>');

    const regular = montarDps({ ...cfgBase, opSimpNac: 1 }, dadosBase, AGORA).xml;
    expect(regular).not.toContain('regApTribSN');
    expect(regular).toContain('<tribFed>');
    expect(regular).not.toContain('pAliq');
  });

  it('emite o grupo IBS/CBS conforme o leiaute', () => {
    const cfg = { ...cfgBase, ibsCbsCIndOp: '030101', ibsCbsCst: '000', ibsCbsCClassTrib: '000001', ibsCbsIndFinal: '0' };
    const producao = montarDps(cfg, { ...dadosBase, cNbs: '123456789' }, AGORA).xml;
    expect(producao).toContain('<IBSCBS><finNFSe>0</finNFSe><indFinal>0</indFinal><cIndOp>030101</cIndOp><indDest>0</indDest><valores><trib><gIBSCBS><CST>000</CST>');
    const nt009 = montarDps(cfg, { ...dadosBase, ambiente: 'homologacao', cNbs: '123456789' }, AGORA).xml;
    expect(nt009).toContain('<valores><trib><CST>000</CST><cClassTrib>000001</cClassTrib></trib></valores></IBSCBS>');
  });

  it('omite o endereço do tomador se incompleto e o envia na ordem do XSD se completo', () => {
    expect(montarDps(cfgBase, { ...dadosBase, tomadorLogradouro: 'Rua A' }, AGORA).xml).not.toContain('<end>');
    const { xml } = montarDps(cfgBase, {
      ...dadosBase, tomadorCodigoMunicipio: '4305108', tomadorCep: '95000-000', tomadorLogradouro: 'Rua A', tomadorBairro: 'Centro',
    }, AGORA);
    expect(xml).toContain('<end><endNac><cMun>4305108</cMun><CEP>95000000</CEP></endNac><xLgr>Rua A</xLgr><nro>S/N</nro><xBairro>Centro</xBairro></end>');
  });
});

describe('alíquota na DPS', () => {
  it('segue a tabela de regime, convênio e retenção', () => {
    expect(exigeAliquotaNaDps({ ...cfgBase, opSimpNac: 1 }, false)).toBe(false);
    expect(exigeAliquotaNaDps({ ...cfgBase, opSimpNac: 1, convenioAtivo: false }, false)).toBe(true);
    expect(exigeAliquotaNaDps(cfgBase, false)).toBe(false);
    expect(exigeAliquotaNaDps(cfgBase, true)).toBe(true);
    expect(exigeAliquotaNaDps({ ...cfgBase, regApTribSN: 2, convenioAtivo: false }, false)).toBe(true);
    expect(exigeAliquotaNaDps({ ...cfgBase, opSimpNac: 2 }, true)).toBe(false);
  });

  it('coloca pAliq depois de tpRetISSQN', () => {
    const { xml } = montarDps(cfgBase, {
      ...dadosBase, issRetido: true, aliquotaIss: 3, tomadorCodigoMunicipio: '4305108', tomadorCep: '95000000', tomadorLogradouro: 'Rua A', tomadorBairro: 'Centro',
    }, AGORA);
    expect(xml).toContain('<tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>2</tpRetISSQN><pAliq>3.00</pAliq></tribMun>');
  });
});

describe('validação da emissão', () => {
  it('passa com dados completos', () => {
    expect(validarEmissao(cfgBase, dadosBase, AGORA)).toEqual([]);
  });

  it('barra documento inválido, competência futura e retenção sem endereço', () => {
    const problemas = validarEmissao(cfgBase, { ...dadosBase, tomadorDocumento: '52998224726', dataCompetencia: '2026-12', issRetido: true }, AGORA).join(' ');
    expect(problemas).toContain('CPF/CNPJ do tomador');
    expect(problemas).toContain('posterior ao mês atual');
    expect(problemas).toContain('E0237');
  });

  it('exige o grupo IBS/CBS a partir de 2027', () => {
    const emJaneiro = new Date('2027-01-15T15:00:00Z');
    const problemas = validarEmissao(cfgBase, { ...dadosBase, dataCompetencia: '2027-01' }, emJaneiro).join(' ');
    expect(problemas).toContain('IBS/CBS');
  });
});

describe('cancelamento', () => {
  const chave = '4'.repeat(50);

  it('valida a justificativa e monta o evento acentuado', () => {
    expect(validarCancelamento(chave, 1, 'curta')).toHaveLength(1);
    expect(validarCancelamento(chave, 3, 'justificativa suficiente')).toHaveLength(1);
    const { id, xml } = montarCancelamento({ chave, cnpjAutor: CNPJ, motivo: 1, justificativa: 'Erro no valor informado', ambiente: 'producao', modo: 'analise', agora: AGORA });
    expect(id).toBe(`PRE${chave}101103`);
    expect(xml).toContain('<e101103><xDesc>Solicitação de Análise Fiscal para Cancelamento de NFS-e</xDesc><cMotivo>1</cMotivo>');
  });
});

describe('certificado e assinatura', () => {
  let pfx: Buffer;
  let credencial: CredencialA1;

  beforeAll(() => {
    pfx = gerarPfx();
    credencial = lerCertificadoA1(pfx, SENHA);
  });

  it('lê o titular, o CNPJ e a validade do .pfx', () => {
    expect(credencial.cnpj).toBe(CNPJ);
    expect(credencial.documento).toBe(CNPJ);
    expect(credencial.titular).toContain('EMPRESA TESTE');
    expect(credencial.validoAte.getUTCFullYear()).toBe(2030);
    expect(credencial.chavePem).toContain('PRIVATE KEY');
  });

  it('recusa senha incorreta', () => {
    expect(() => lerCertificadoA1(pfx, 'errada')).toThrow(CertificadoInvalidoError);
  });

  it('compara o certificado pela raiz do CNPJ', () => {
    expect(certificadoPertenceAoCnpj({ cnpj: CNPJ }, '11.222.333/0002-62')).toBe(true);
    expect(certificadoPertenceAoCnpj({ cnpj: CNPJ }, '99.222.333/0001-00')).toBe(false);
  });

  // A assinatura é conferida por uma implementação independente (xml-crypto).
  function assinaturaValida(xmlAssinado: string): boolean {
    const doc = new DOMParser().parseFromString(xmlAssinado, 'text/xml');
    const signature = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0];
    const verificador = new SignedXml({ publicCert: credencial.certificadosPem });
    verificador.loadSignature(signature as unknown as Node);
    return verificador.checkSignature(xmlAssinado);
  }

  it('produz uma DPS com assinatura válida, inclusive com acentos e escapes', () => {
    const { id, xml } = montarDps(cfgBase, { ...dadosBase, descricao: 'Serviço de gestão — "açúcar" & cia\r\nLinha 2' }, AGORA);
    const assinado = assinarXml(xml, 'infDPS', id, credencial);
    expect(assinado.startsWith('<?xml version="1.0" encoding="UTF-8"?><DPS ')).toBe(true);
    expect(assinado.endsWith('</Signature></DPS>')).toBe(true);
    expect(assinaturaValida(assinado)).toBe(true);
  });

  it('invalida a assinatura se o conteúdo mudar depois de assinado', () => {
    const { id, xml } = montarDps(cfgBase, dadosBase, AGORA);
    const adulterado = assinarXml(xml, 'infDPS', id, credencial).replace('<vServ>1500.00', '<vServ>1.00');
    expect(assinaturaValida(adulterado)).toBe(false);
  });

  it('assina o pedido de cancelamento', () => {
    const { id, xml } = montarCancelamento({ chave: '4'.repeat(50), cnpjAutor: CNPJ, motivo: 1, justificativa: 'Valor informado errado', ambiente: 'homologacao', modo: 'direto', agora: AGORA });
    expect(assinaturaValida(assinarXml(xml, 'infPedReg', id, credencial))).toBe(true);
  });
});

describe('cofre do certificado', () => {
  it('cifra, decifra e recusa outra empresa ou chave ausente', () => {
    const anterior = process.env.NFSE_CERT_KEY;
    process.env.NFSE_CERT_KEY = Buffer.alloc(32, 7).toString('base64');
    try {
      const cifrado = cifrar(Buffer.from('conteudo'), 'empresa-a');
      expect(cifrado).not.toContain('conteudo');
      expect(decifrar(cifrado, 'empresa-a').toString()).toBe('conteudo');
      expect(() => decifrar(cifrado, 'empresa-b')).toThrow();
      delete process.env.NFSE_CERT_KEY;
      expect(() => cifrar(Buffer.from('x'), 'empresa-a')).toThrow(CofreNaoConfiguradoError);
    } finally {
      if (anterior === undefined) delete process.env.NFSE_CERT_KEY;
      else process.env.NFSE_CERT_KEY = anterior;
    }
  });
});

describe('fluxo de emissão', () => {
  const chave = '4'.repeat(50);
  const nfseXml = (vServ = '1500.00', doc = '52998224725') =>
    `<NFSe><infNFSe Id="NFS${chave}"><nNFSe>147</nNFSe><valores><vBC>1500.00</vBC><pAliqAplic>3.00</pAliqAplic><vISSQN>45.00</vISSQN><vLiq>1455.00</vLiq></valores><DPS><toma><CPF>${doc}</CPF></toma><vServ>${vServ}</vServ></DPS></infNFSe></NFSe>`;
  const b64 = (xml: string) => gzipSync(Buffer.from(xml)).toString('base64');

  function transporteFalso(rotas: Record<string, (corpo?: unknown) => RespostaHttp>) {
    const chamadas: string[] = [];
    const transporte: Transporte = async (metodo, caminho, corpo) => {
      const rota = `${metodo} ${caminho}`;
      chamadas.push(rota);
      if (!rotas[rota]) throw new Error(`rota inesperada: ${rota}`);
      return rotas[rota](corpo);
    };
    return { transporte, chamadas };
  }

  const pedido = (extra: Partial<Parameters<typeof emitirNfse>[1]> = {}) => ({
    nDps: '5',
    retomada: false,
    valorServicos: 1500,
    tomadorDocumento: '52998224725',
    idDoNumero: (n: string) => `ID${n}`,
    gerarDps: (n: string) => ({ id: `ID${n}`, xmlAssinado: `<DPS n="${n}"/>` }),
    proximoNumero: async () => '6',
    ...extra,
  });

  it('emite, comprime o XML e lê os valores oficiais do retorno', async () => {
    let enviado = '';
    const { transporte } = transporteFalso({
      'HEAD dps/ID5': () => ({ status: 404, corpo: '' }),
      'POST nfse': corpo => {
        enviado = gunzipSync(Buffer.from((corpo as { dpsXmlGZipB64: string }).dpsXmlGZipB64, 'base64')).toString();
        return { status: 201, corpo: JSON.stringify({ chaveAcesso: chave, nfseXmlGZipB64: b64(nfseXml()), alertas: [{ descricao: 'aviso' }] }) };
      },
    });
    const r = await emitirNfse(transporte, pedido());
    expect(enviado).toBe('<DPS n="5"/>');
    expect(r).toMatchObject({ ok: true, recuperada: false, chaveAcesso: chave, alertas: ['aviso'] });
    if (r.ok) expect(r.valores).toMatchObject({ numeroNfse: '147', valorLiquido: 1455, valorIss: 45, aliquotaIss: 3 });
  });

  it('recupera a nota sem transmitir de novo se a resposta anterior se perdeu', async () => {
    const { transporte, chamadas } = transporteFalso({
      'HEAD dps/ID5': () => ({ status: 200, corpo: '' }),
      'GET dps/ID5': () => ({ status: 200, corpo: JSON.stringify({ chaveAcesso: chave }) }),
      [`GET nfse/${chave}`]: () => ({ status: 200, corpo: JSON.stringify({ nfseXmlGZipB64: b64(nfseXml()) }) }),
    });
    const r = await emitirNfse(transporte, pedido({ retomada: true }));
    expect(r).toMatchObject({ ok: true, recuperada: true, chaveAcesso: chave });
    expect(chamadas).not.toContain('POST nfse');
  });

  it('não duplica se a nota foi editada depois de uma tentativa que saiu', async () => {
    const { transporte, chamadas } = transporteFalso({
      'HEAD dps/ID5': () => ({ status: 200, corpo: '' }),
      'GET dps/ID5': () => ({ status: 200, corpo: JSON.stringify({ chaveAcesso: chave }) }),
      [`GET nfse/${chave}`]: () => ({ status: 200, corpo: JSON.stringify({ nfseXmlGZipB64: b64(nfseXml('99.00')) }) }),
    });
    const r = await emitirNfse(transporte, pedido({ retomada: true }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toContain(chave);
    expect(chamadas).not.toContain('POST nfse');
  });

  it('pula número novo já usado no Sefin, mesmo com valor e tomador iguais (mensalidades)', async () => {
    const { transporte } = transporteFalso({
      'HEAD dps/ID5': () => ({ status: 200, corpo: '' }),
      'HEAD dps/ID6': () => ({ status: 404, corpo: '' }),
      'POST nfse': () => ({ status: 201, corpo: JSON.stringify({ chaveAcesso: chave, nfseXmlGZipB64: b64(nfseXml()) }) }),
    });
    const r = await emitirNfse(transporte, pedido());
    expect(r).toMatchObject({ ok: true, recuperada: false, nDps: '6', idDps: 'ID6' });
  });

  it('retoma sem consultar número novo se a tentativa anterior não chegou ao Sefin', async () => {
    const { transporte, chamadas } = transporteFalso({
      'HEAD dps/ID5': () => ({ status: 404, corpo: '' }),
      'POST nfse': () => ({ status: 201, corpo: JSON.stringify({ chaveAcesso: chave, nfseXmlGZipB64: b64(nfseXml()) }) }),
    });
    const r = await emitirNfse(transporte, pedido({ retomada: true }));
    expect(r).toMatchObject({ ok: true, recuperada: false, nDps: '5' });
    expect(chamadas).toEqual(['HEAD dps/ID5', 'POST nfse']);
  });

  it('devolve os erros de rejeição do Sefin', async () => {
    const { transporte } = transporteFalso({
      'HEAD dps/ID5': () => ({ status: 404, corpo: '' }),
      'POST nfse': () => ({ status: 400, corpo: JSON.stringify({ erros: [{ Codigo: 'E0312', Descricao: 'cTribMun ausente' }] }) }),
    });
    const r = await emitirNfse(transporte, pedido());
    expect(r).toMatchObject({ ok: false, nDps: '5' });
    if (!r.ok) expect(r.erros[0]).toEqual({ codigo: 'E0312', descricao: 'cTribMun ausente', complemento: null });
  });

  it('trata falha de estado incerto como indisponibilidade, não como rejeição', async () => {
    const consulta = transporteFalso({ 'HEAD dps/ID5': () => ({ status: 503, corpo: '' }) });
    await expect(emitirNfse(consulta.transporte, pedido())).rejects.toThrow(SefinIndisponivelError);

    const envio = transporteFalso({
      'HEAD dps/ID5': () => ({ status: 404, corpo: '' }),
      'POST nfse': () => ({ status: 502, corpo: '<html>Bad Gateway</html>' }),
    });
    await expect(emitirNfse(envio.transporte, pedido())).rejects.toThrow(SefinIndisponivelError);
  });
});

describe('verificação de procuração', () => {
  const transporte = (status: number, corpo: string): Transporte => async () => ({ status, corpo });

  it('reconhece a recusa E2245 como falta de procuração', async () => {
    const corpo = JSON.stringify({ StatusProcessamento: 'REJEICAO', Erros: [{ Codigo: 'E2245', Descricao: 'Não há procuração da inscrição' }] });
    await expect(verificarProcuracao(transporte(400, corpo), CNPJ)).resolves.toEqual({ status: 'sem_procuracao', mensagem: 'Não há procuração da inscrição' });
  });

  it('considera ativa a consulta aceita, mesmo com a caixa vazia', async () => {
    await expect(verificarProcuracao(transporte(200, '{"LoteDFe":[]}'), CNPJ)).resolves.toMatchObject({ status: 'ativa' });
    await expect(verificarProcuracao(transporte(404, '{"StatusProcessamento":"NENHUM_DOCUMENTO_LOCALIZADO"}'), CNPJ)).resolves.toMatchObject({ status: 'ativa' });
  });

  it('considera ativa a empresa sem documentos (E2230)', async () => {
    const corpo = JSON.stringify({ StatusProcessamento: 'REJEICAO', Erros: [{ Codigo: 'E2230', Descricao: 'Nenhum documento localizado' }] });
    await expect(verificarProcuracao(transporte(400, corpo), CNPJ)).resolves.toEqual({ status: 'ativa', mensagem: null });
  });

  it('não conclui nada de certificado recusado, instabilidade ou outro erro', async () => {
    await expect(verificarProcuracao(transporte(403, ''), CNPJ)).resolves.toMatchObject({ status: 'indeterminada' });
    await expect(verificarProcuracao(transporte(503, '<html>'), CNPJ)).resolves.toMatchObject({ status: 'indeterminada' });
    await expect(verificarProcuracao(transporte(404, ''), CNPJ)).resolves.toMatchObject({ status: 'indeterminada' });
    await expect(verificarProcuracao(transporte(400, '{"Erros":[{"Codigo":"E9999","Descricao":"x"}]}'), CNPJ)).resolves.toMatchObject({ status: 'indeterminada' });
  });
});

describe('leitura das respostas', () => {
  it('normaliza erro único e variações de maiúsculas', () => {
    expect(lerErros({ erro: { codigo: 'E1', mensagem: 'x' } })).toEqual([{ codigo: 'E1', descricao: 'x', complemento: null }]);
  });

  it('extrai a chave do Id do infNFSe quando não há chNFSe', () => {
    expect(lerValoresNfse(`<infNFSe versao="1.01" Id="NFS${'4'.repeat(50)}"></infNFSe>`).chaveAcesso).toBe('4'.repeat(50));
  });
});
