import crypto from 'crypto';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import forge from 'node-forge';
import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';

const db = vi.hoisted(() => ({
  empresa: { findUnique: vi.fn() },
  nfeDestinada: { findMany: vi.fn(), update: vi.fn() },
  nfeManifestacaoEvento: { createMany: vi.fn(), updateMany: vi.fn() },
}));
const soap = vi.hoisted(() => ({ enviar: vi.fn() }));
const cred = vi.hoisted(() => ({ abrir: vi.fn() }));

vi.mock('../prisma', () => ({ default: db }));
vi.mock('../nfse/servidor', () => ({ abrirCredencial: cred.abrir }));
vi.mock('./distribuicao', async (original) => ({ ...(await original<typeof import('./distribuicao')>()), enviarSoap: soap.enviar }));

import { SefazIndisponivelError } from './distribuicao';
import { EVENTOS_POR_LOTE, dataEvento, idEventoCiencia, lerRespostaEventos, montarEnvelopeEventos, montarEventoCiencia, registrarCiencia } from './manifestacao';

const CHAVE = '41261111222333000181550010000012341000012345';
const CNPJ = '11222333000181';
const autor = { userId: 'u1', email: 'fiscal@x.com' };

function credencialDeTeste() {
  const chaves = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 86400000);
  const nome = [{ name: 'commonName', value: `TESTE:${CNPJ}` }];
  cert.setSubject(nome);
  cert.setIssuer(nome);
  cert.sign(chaves.privateKey, forge.md.sha256.create());
  return {
    chavePem: forge.pki.privateKeyToPem(chaves.privateKey),
    certificadosPem: forge.pki.certificateToPem(cert),
    certificadoB64: forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()),
    titular: `TESTE:${CNPJ}`,
    cnpj: CNPJ,
    documento: CNPJ,
    validoAte: cert.validity.notAfter,
  };
}
const credencial = credencialDeTeste();

const retorno = (chave: string, cStat: string, xMotivo = 'Evento registrado') =>
  `<retEvento versao="1.00"><infEvento Id="ID1"><tpAmb>1</tpAmb><cOrgao>91</cOrgao><cStat>${cStat}</cStat><xMotivo>${xMotivo}</xMotivo><chNFe>${chave}</chNFe><tpEvento>210210</tpEvento><nProt>891260000000001</nProt></infEvento></retEvento>`;
const soapLote = (eventos: string, cStat = '128', xMotivo = 'Lote de Evento Processado') =>
  `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><retEnvEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe"><idLote>1</idLote><tpAmb>1</tpAmb><cStat>${cStat}</cStat><xMotivo>${xMotivo}</xMotivo>${eventos}</retEnvEvento></nfeResultMsg></soap:Body></soap:Envelope>`;

describe('montagem do evento', () => {
  const dhEvento = '2026-11-04T10:00:00-03:00';
  const evento = () => montarEventoCiencia({ chave: CHAVE, cnpj: CNPJ, ambiente: 'producao', dhEvento, credencial });

  it('usa o Id, o órgão nacional e o texto exigidos pela SEFAZ', () => {
    const xml = evento();
    expect(idEventoCiencia(CHAVE)).toBe(`ID210210${CHAVE}01`);
    expect(xml).toContain(`<infEvento Id="ID210210${CHAVE}01"><cOrgao>91</cOrgao><tpAmb>1</tpAmb><CNPJ>${CNPJ}</CNPJ><chNFe>${CHAVE}</chNFe>`);
    expect(xml).toContain('<tpEvento>210210</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento>');
    expect(xml).toContain('<descEvento>Ciencia da Operacao</descEvento>');
    expect(xml).toContain(`</infEvento><Signature xmlns="http://www.w3.org/2000/09/xmldsig#">`);
  });

  it('assina o infEvento com o namespace herdado: digest e assinatura conferem', () => {
    const xml = evento();
    const interno = xml.match(/<infEvento Id="[^"]+">([\s\S]*)<\/infEvento>/)![1];
    const canonico = `<infEvento xmlns="http://www.portalfiscal.inf.br/nfe" Id="${idEventoCiencia(CHAVE)}">${interno}</infEvento>`;
    const digest = crypto.createHash('sha1').update(canonico, 'utf8').digest('base64');
    expect(xml).toContain(`<DigestValue>${digest}</DigestValue>`);

    const signedInfo = xml.match(/<SignedInfo>[\s\S]*<\/SignedInfo>/)![0].replace('<SignedInfo>', '<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">');
    const valor = xml.match(/<SignatureValue>([^<]+)</)![1];
    const certPem = forge.pki.certificateToPem(forge.pki.certificateFromPem(credencial.certificadosPem));
    expect(crypto.createVerify('RSA-SHA1').update(signedInfo, 'utf8').verify(certPem, valor, 'base64')).toBe(true);
  });

  it('a assinatura passa em um verificador independente, dentro do envEvento', () => {
    const lote = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>1</idLote>${evento()}</envEvento>`;
    const conferir = (xml: string) => {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const signature = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0];
      const verificador = new SignedXml({ publicCert: credencial.certificadosPem });
      verificador.loadSignature(signature as unknown as Node);
      return verificador.checkSignature(xml);
    };
    expect(conferir(lote)).toBe(true);
    expect(conferir(lote.replace(CNPJ, '99888777000166'))).toBe(false);
  });

  it('não coloca prolog dentro do envelope e usa o namespace do serviço', () => {
    const envelope = montarEnvelopeEventos('123', [evento()]);
    expect(envelope.match(/<\?xml/g)).toHaveLength(1);
    expect(envelope).toContain('<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>123</idLote><evento versao="1.00">');
  });

  it('data no fuso de Brasília e um minuto atrás do relógio', () => {
    expect(dataEvento(new Date('2026-11-04T13:00:30Z'))).toBe('2026-11-04T09:59:30-03:00');
  });
});

describe('leitura da resposta', () => {
  it('separa o status do lote do status de cada evento', () => {
    const r = lerRespostaEventos(soapLote(retorno(CHAVE, '135')));
    expect(r.cStat).toBe('128');
    expect(r.eventos).toEqual([{ chave: CHAVE, cStat: '135', xMotivo: 'Evento registrado', protocolo: '891260000000001' }]);
  });

  it('trata página HTML como indisponibilidade, sem quebrar', () => {
    expect(() => lerRespostaEventos('<HTML><HEAD><TITLE>Erro</TITLE></HEAD></HTML>')).toThrow(SefazIndisponivelError);
  });
});

describe('registrarCiencia', () => {
  const nota = (i = 0) => ({ id: `n${i}`, chaveAcesso: String(BigInt(CHAVE) + BigInt(i)), numero: String(i) });

  beforeEach(() => {
    db.empresa.findUnique.mockReset().mockResolvedValue({ cnpj: CNPJ, nfseConfig: { usarProcuracao: false, empresaId: 'e1' } });
    db.nfeDestinada.findMany.mockReset().mockResolvedValue([nota()]);
    db.nfeDestinada.update.mockReset().mockResolvedValue({});
    db.nfeManifestacaoEvento.createMany.mockReset().mockResolvedValue({ count: 1 });
    db.nfeManifestacaoEvento.updateMany.mockReset().mockResolvedValue({ count: 1 });
    cred.abrir.mockReset().mockResolvedValue({ credencial });
    soap.enviar.mockReset();
  });

  it('só considera notas da empresa, sem XML, autorizadas e sem manifestação', async () => {
    db.nfeDestinada.findMany.mockResolvedValue([]);
    const r = await registrarCiencia('e1', ['n0', 'n0', 'n1'], autor);
    expect(db.nfeDestinada.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['n0', 'n1'] }, empresaId: 'e1', possuiXml: false, situacao: 'autorizada', manifestacao: null });
    expect(r.ignoradas).toBe(2);
    expect(soap.enviar).not.toHaveBeenCalled();
  });

  it('registra o autor antes de enviar e marca a nota ao receber 135', async () => {
    soap.enviar.mockImplementation(async () => {
      expect(db.nfeManifestacaoEvento.createMany).toHaveBeenCalledTimes(1);
      return { status: 200, corpo: soapLote(retorno(nota().chaveAcesso, '135')) };
    });
    const r = await registrarCiencia('e1', ['n0'], autor);
    expect(db.nfeManifestacaoEvento.createMany.mock.calls[0][0].data[0]).toMatchObject({ usuarioEmail: 'fiscal@x.com', tpEvento: '210210' });
    expect(db.nfeDestinada.update).toHaveBeenCalledWith({ where: { id: 'n0' }, data: { manifestacao: 'ciencia' } });
    expect(r).toMatchObject({ registradas: 1, rejeitadas: [], erro: null });
  });

  it('573 significa que já estava registrado: conta como sucesso', async () => {
    soap.enviar.mockResolvedValue({ status: 200, corpo: soapLote(retorno(nota().chaveAcesso, '573', 'Duplicidade de evento')) });
    expect((await registrarCiencia('e1', ['n0'], autor)).registradas).toBe(1);
    expect(db.nfeDestinada.update).toHaveBeenCalled();
  });

  it('rejeição não marca a nota e devolve o motivo', async () => {
    soap.enviar.mockResolvedValue({ status: 200, corpo: soapLote(retorno(nota().chaveAcesso, '596', 'Evento fora do prazo')) });
    const r = await registrarCiencia('e1', ['n0'], autor);
    expect(db.nfeDestinada.update).not.toHaveBeenCalled();
    expect(r.rejeitadas[0]).toMatchObject({ cStat: '596', motivo: 'Evento fora do prazo' });
  });

  it('lote recusado inteiro: nenhuma nota é marcada', async () => {
    soap.enviar.mockResolvedValue({ status: 200, corpo: soapLote('', '215', 'Falha no schema') });
    const r = await registrarCiencia('e1', ['n0'], autor);
    expect(db.nfeDestinada.update).not.toHaveBeenCalled();
    expect(r.rejeitadas[0]).toMatchObject({ cStat: '215', motivo: 'Falha no schema' });
  });

  it('divide em lotes de 20 e, se a SEFAZ cair, informa o que não foi enviado', async () => {
    const notas = Array.from({ length: EVENTOS_POR_LOTE + 5 }, (_, i) => nota(i));
    db.nfeDestinada.findMany.mockResolvedValue(notas);
    soap.enviar
      .mockImplementationOnce(async (_c: unknown, _u: unknown, _a: unknown, env: string) => {
        expect(env.match(/<evento /g)).toHaveLength(EVENTOS_POR_LOTE);
        return { status: 200, corpo: soapLote(notas.slice(0, EVENTOS_POR_LOTE).map(n => retorno(n.chaveAcesso, '135')).join('')) };
      })
      .mockRejectedValueOnce(new SefazIndisponivelError('fora do ar'));
    const r = await registrarCiencia('e1', notas.map(n => n.id), autor);
    expect(r).toMatchObject({ registradas: EVENTOS_POR_LOTE, naoEnviadas: 5, erro: 'fora do ar' });
  });

  it('não envia com certificado próprio de outro CNPJ', async () => {
    cred.abrir.mockResolvedValue({ credencial: { ...credencial, cnpj: '99888777000166' } });
    expect((await registrarCiencia('e1', ['n0'], autor)).erro).toMatch(/outro CNPJ/);
    expect(soap.enviar).not.toHaveBeenCalled();
  });
});
