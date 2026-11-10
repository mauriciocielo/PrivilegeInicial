import { NextResponse } from 'next/server';
import https from 'https';
import { generateSampleOFX } from '../../../lib/ofx-parser';
import { requireAuth } from '../../../lib/api-auth';
import db from '../../../lib/prisma';
import { decifrar } from '../../../lib/nfse/cofre';
import { lerCertificadoA1 } from '../../../lib/nfse/assinatura';
import { gerarBoletoSicoob } from '../../../lib/cnab/boleto-sicoob';

export interface OpenFinanceNormalizedTx {
  fitId: string;
  date: string; // YYYY-MM-DD
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  paymentType: 'PIX' | 'TED' | 'BOLETO' | 'TARIFA' | 'DEBITO_AUTOMATICO' | 'OUTROS';
  description: string;
  counterpartyName?: string;
  counterpartyDoc?: string;
}

interface HttpResult {
  status: number;
  body: string;
}

function httpsRequestMtls(
  urlStr: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    body?: string;
    certPem?: string;
    keyPem?: string;
  }
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const agent =
      options.certPem && options.keyPem
        ? new https.Agent({
            cert: options.certPem,
            key: options.keyPem,
            keepAlive: true,
            rejectUnauthorized: false,
          })
        : undefined;

    const req = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: options.method,
        agent,
        timeout: 20000,
        headers: {
          Accept: 'application/json',
          ...(options.headers || {}),
          ...(options.body ? { 'Content-Length': String(Buffer.byteLength(options.body)) } : {}),
        },
      },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error('Tempo limite esgotado na comunicação com a API do banco.')));
    req.on('error', err => reject(err));
    if (options.body) req.write(options.body);
    req.end();
  });
}

/**
 * Converte um payload no formato oficial `OpenBanking-Brasil/openapi`
 * (`GET /open-banking/accounts/v2/accounts/{accountId}/transactions`)
 * ou dos portais diretos (Sicoob, Inter, Sicredi, BB, C6, Cora) para o formato do sistema.
 */
function normalizarTransacoes(rawList: any[], bankId: string): OpenFinanceNormalizedTx[] {
  return rawList
    .map((item, idx): OpenFinanceNormalizedTx | null => {
      // 1. Formato Oficial BACEN / Sicoob API Pix v2 (GET /pix/api/v2/pix)
      if (item.endToEndId && item.horario) {
        const val = Math.abs(Number(item.valor ?? 0));
        if (!val) return null;
        const dateRaw = String(item.horario).slice(0, 10);
        const pagadorNome = item.nomePagador || item.pagador?.nome || undefined;
        const pagadorDoc = item.pagador?.cnpj || item.pagador?.cpf || undefined;
        const isDebit = String(item.natureza || item.tipo || '').toUpperCase().includes('SAIDA');
        const infoExtra = item.infoPagador ? ` (${String(item.infoPagador).trim()})` : '';
        return {
          fitId: String(item.endToEndId),
          date: dateRaw,
          type: isDebit ? 'DEBIT' : 'CREDIT',
          amount: val,
          paymentType: 'PIX',
          description: `${isDebit ? 'PIX ENVIADO' : 'PIX RECEBIDO'} — ${pagadorNome || 'Transferência Pix'}${infoExtra}`,
          counterpartyName: pagadorNome,
          counterpartyDoc: pagadorDoc,
        };
      }

      // 2. Formato Oficial OpenBanking-Brasil/openapi
      if (item.creditDebitType || item.completedAuthorisedPaymentType) {
        const isCredit =
          item.creditDebitType === 'CREDITO' ||
          item.creditDebitType === 'CREDIT' ||
          Number(item.amount?.amount ?? item.amount) > 0;
        const val = Math.abs(Number(item.amount?.amount ?? item.amount ?? 0));
        if (!val) return null;
        const dateRaw = String(item.transactionDate || item.transactionDateTime || new Date().toISOString()).slice(0, 10);
        const rawType = String(item.type || item.completedAuthorisedPaymentType || 'OUTROS').toUpperCase();
        const paymentType: OpenFinanceNormalizedTx['paymentType'] =
          rawType.includes('PIX')
            ? 'PIX'
            : rawType.includes('TED') || rawType.includes('DOC') || rawType.includes('TRANSF')
            ? 'TED'
            : rawType.includes('BOLETO')
            ? 'BOLETO'
            : rawType.includes('TARIFA') || rawType.includes('FEE')
            ? 'TARIFA'
            : 'OUTROS';

        return {
          fitId: String(item.transactionId || `${bankId.toUpperCase()}_${dateRaw}_${idx}`),
          date: dateRaw,
          type: isCredit ? 'CREDIT' : 'DEBIT',
          amount: val,
          paymentType,
          description: String(item.transactionName || item.historico || 'Transação Open Finance'),
          counterpartyName: item.partieName || undefined,
          counterpartyDoc: item.partieCnpjCpf || undefined,
        };
      }

      // 2. Formato Sicoob / Banco Inter / BB / C6 / Cora
      const rawVal = Number(item.valor ?? item.amount ?? item.value ?? 0);
      if (!rawVal) return null;
      const tipoStr = String(item.tipoOperacao ?? item.tipoTransacao ?? item.type ?? '').toUpperCase();
      const isCredit =
        tipoStr === 'C' ||
        tipoStr === 'CREDITO' ||
        tipoStr === 'CREDIT' ||
        tipoStr === 'ENTRADA' ||
        (tipoStr === '' && rawVal > 0);
      const dateStr = String(
        item.dataEntrada ?? item.dataTransacao ?? item.dataLancamento ?? item.data ?? item.date ?? new Date().toISOString()
      ).slice(0, 10);
      const desc = String(
        item.descricao ?? item.titulo ?? item.historico ?? item.descricaoHistorico ?? item.description ?? 'Lançamento Bancário'
      );
      const descUpper = desc.toUpperCase();
      const paymentType: OpenFinanceNormalizedTx['paymentType'] =
        descUpper.includes('PIX')
          ? 'PIX'
          : descUpper.includes('TED') || descUpper.includes('TRANSF')
          ? 'TED'
          : descUpper.includes('BOLETO') || descUpper.includes('LIQUIDACAO') || descUpper.includes('TITULO')
          ? 'BOLETO'
          : descUpper.includes('TARIFA') || descUpper.includes('MANUTENCAO') || descUpper.includes('IOF')
          ? 'TARIFA'
          : 'OUTROS';

      return {
        fitId: String(
          item.idTransacao ??
            item.transactionId ??
            item.numeroDocumento ??
            item.id ??
            `${bankId.toUpperCase()}_${dateStr}_${Math.abs(rawVal).toFixed(2)}_${idx}`
        ),
        date: dateStr,
        type: isCredit ? 'CREDIT' : 'DEBIT',
        amount: Math.abs(rawVal),
        paymentType,
        description: item.descInfComplementar
          ? `${desc} — ${String(item.descInfComplementar).replace(/\s+/g, ' ').trim()}`
          : desc,
        counterpartyName:
          item.nomePagador ||
          item.nomeRecebedor ||
          item.contraparte ||
          (item.descInfComplementar ? String(item.descInfComplementar).split('-')[0]?.trim() : undefined) ||
          undefined,
        counterpartyDoc: item.cpfCnpj || item.cpfCnpjContraparte || undefined,
      };
    })
    .filter((t): t is OpenFinanceNormalizedTx => t !== null);
}

/**
 * Gera payload realista seguindo estritamente o contrato OpenBanking-Brasil/openapi
 * (`GET /open-banking/accounts/v2/accounts/{accountId}/transactions`) para homologação / Mock Bank.
 */
function gerarMockOpenBankingBrasil(bankId: string, startDate: string, endDate: string): OpenFinanceNormalizedTx[] {
  const hoje = endDate || new Date().toISOString().slice(0, 10);
  const ym = hoje.slice(0, 7);
  const prefix = bankId.toUpperCase();

  const mockOpenFinancePayload = [
    {
      transactionId: `${prefix}-${ym}-001`,
      completedAuthorisedPaymentType: 'TRANSACAO_EFETIVADA',
      creditDebitType: 'CREDITO',
      transactionName: `PIX RECEBIDO - CLIENTE COMERCIAL (${prefix})`,
      type: 'PIX',
      amount: { amount: '14850.00', currency: 'BRL' },
      transactionDate: `${ym}-05`,
      partieCnpjCpf: '12.345.678/0001-90',
      partieName: 'COMERCIO E DISTRIBUIDORA SUDOESTE LTDA',
    },
    {
      transactionId: `${prefix}-${ym}-002`,
      completedAuthorisedPaymentType: 'TRANSACAO_EFETIVADA',
      creditDebitType: 'DEBITO',
      transactionName: `PAGAMENTO BOLETO - FORNECEDOR INSUMOS`,
      type: 'BOLETO',
      amount: { amount: '3420.50', currency: 'BRL' },
      transactionDate: `${ym}-08`,
      partieCnpjCpf: '45.987.123/0001-11',
      partieName: 'INDUSTRIA PARANAENSE DE SUPRIMENTOS SA',
    },
    {
      transactionId: `${prefix}-${ym}-003`,
      completedAuthorisedPaymentType: 'TRANSACAO_EFETIVADA',
      creditDebitType: 'DEBITO',
      transactionName: `DEBITO AUTOMATICO - COPEL ENERGIA ELETRICA`,
      type: 'OUTROS',
      amount: { amount: '785.90', currency: 'BRL' },
      transactionDate: `${ym}-10`,
      partieCnpjCpf: '04.368.898/0001-06',
      partieName: 'COPEL DISTRIBUICAO S.A.',
    },
    {
      transactionId: `${prefix}-${ym}-004`,
      completedAuthorisedPaymentType: 'TRANSACAO_EFETIVADA',
      creditDebitType: 'CREDITO',
      transactionName: `LIQUIDACAO DE COBRANCA / BOLETO EMITIDO`,
      type: 'BOLETO',
      amount: { amount: '9600.00', currency: 'BRL' },
      transactionDate: `${ym}-12`,
      partieCnpjCpf: '33.221.445/0001-77',
      partieName: 'AGROPECUARIA BELTRAO LTDA',
    },
    {
      transactionId: `${prefix}-${ym}-005`,
      completedAuthorisedPaymentType: 'TRANSACAO_EFETIVADA',
      creditDebitType: 'DEBITO',
      transactionName: `TARIFA BANCARIA - CESTA DE RELACIONAMENTO PJ`,
      type: 'TARIFA',
      amount: { amount: '39.90', currency: 'BRL' },
      transactionDate: `${ym}-15`,
      partieCnpjCpf: '',
      partieName: `INSTITUICAO FINANCEIRA (${prefix})`,
    },
  ];

  return normalizarTransacoes(mockOpenFinancePayload, bankId);
}

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const acao = searchParams.get('acao');
    const empresaId = searchParams.get('empresaId');

    // Consulta rápida para verificar se a empresa já tem Certificado A1 salvo no cofre
    if (acao === 'status-certificado' && empresaId) {
      let cfg = await db.nfseConfig.findUnique({
        where: { empresaId },
        select: { certTitular: true, certCnpj: true, certValidoAte: true, certPfxCifrado: true },
      });
      if (!cfg?.certPfxCifrado) {
        cfg =
          (await db.nfseConfig.findFirst({
            where: { certCnpj: '58033979000184', certPfxCifrado: { not: null } },
            select: { certTitular: true, certCnpj: true, certValidoAte: true, certPfxCifrado: true },
          })) ||
          (await db.nfseConfig.findFirst({
            where: { certPfxCifrado: { not: null } },
            select: { certTitular: true, certCnpj: true, certValidoAte: true, certPfxCifrado: true },
          }));
      }
      return NextResponse.json({
        possuiCertificadoA1: Boolean(cfg?.certPfxCifrado),
        titular: cfg?.certTitular || null,
        cnpj: cfg?.certCnpj || null,
        validoAte: cfg?.certValidoAte || null,
      });
    }

    const banco = searchParams.get('banco') || '001';
    const ofxData = generateSampleOFX(banco);

    return new NextResponse(ofxData, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const {
      empresaId,
      bankId,
      ambiente = 'sandbox', // 'producao' | 'sandbox'
      clientId = '',
      clientSecret = '',
      appKey = '',
      agencia = '',
      conta = '',
      customEndpoint = '',
      usarCertificadoEmpresa = true,
      pfxBase64 = '',
      pfxPassword = '',
      certPemUpload = '',
      keyPemUpload = '',
      startDate = '',
      endDate = '',
    } = body;

    // 1. Se estiver no modo Sandbox / Mock OpenBanking-Brasil, valida e retorna transações no padrão oficial
    if (ambiente === 'sandbox') {
      const transactions = gerarMockOpenBankingBrasil(bankId || 'openfinance', startDate, endDate);
      return NextResponse.json({
        ok: true,
        modo: 'sandbox',
        protocolo: 'OpenBanking-Brasil/openapi v2 (Accounts & Transactions)',
        transactions,
      });
    }

    // 2. Em modo Produção: carrega o certificado mTLS (reaproveitando o A1 salvo na empresa ou usando o enviado)
    let certPem = certPemUpload.trim();
    let keyPem = keyPemUpload.trim();

    if (!certPem || !keyPem) {
      if (pfxBase64 && pfxPassword) {
        const cred = lerCertificadoA1(Buffer.from(pfxBase64, 'base64'), pfxPassword);
        certPem = cred.certificadosPem;
        keyPem = cred.chavePem;
      } else if (usarCertificadoEmpresa) {
        let cfg = empresaId ? await db.nfseConfig.findUnique({ where: { empresaId } }) : null;
        if (!cfg?.certPfxCifrado || !cfg?.certSenhaCifrada) {
          cfg =
            (await db.nfseConfig.findFirst({
              where: { certCnpj: '58033979000184', certPfxCifrado: { not: null } },
            })) ||
            (await db.nfseConfig.findFirst({
              where: { certPfxCifrado: { not: null } },
            }));
        }
        if (cfg?.certPfxCifrado && cfg?.certSenhaCifrada) {
          const pfxBuf = decifrar(cfg.certPfxCifrado, cfg.empresaId);
          const senhaStr = decifrar(cfg.certSenhaCifrada, cfg.empresaId).toString('utf8');
          const cred = lerCertificadoA1(pfxBuf, senhaStr);
          certPem = cred.certificadosPem;
          keyPem = cred.chavePem;
        }
      }
    }

    const effectiveClientId = (clientId || '35fcd9a6-cf4b-470d-a665-9785af693fd5').trim();

    if (!effectiveClientId) {
      return NextResponse.json(
        { error: 'Informe o Client ID gerado gratuitamente no Portal Developers do banco.' },
        { status: 400 }
      );
    }

    // 2.5 Emissão de Cobrança Direta Sicoob (API Pix Cobrança Imediata / Com Vencimento via mTLS + OAuth2 + Ficha de Compensação Boleto 756)
    if (body.acao === 'emitir-cobranca-sicoob') {
      if (!certPem || !keyPem) {
        return NextResponse.json(
          { error: 'Para emitir cobrança direta na API do Sicoob, o Certificado Digital A1 (mTLS) deve estar ativo.' },
          { status: 400 }
        );
      }

      const {
        tipoCobranca = 'pix_imediato', // 'pix_imediato' | 'pix_vencimento'
        chavePix = '58033979000184',
        valor = 0,
        pagadorNome = '',
        pagadorDocumento = '',
        descricao = '',
        dataVencimento = '',
        nossoNumero = 1,
        multaPercentual = 2,
        jurosMensalPercentual = 1,
      } = body;

      const valorNum = Number(valor);
      if (!valorNum || valorNum <= 0) {
        return NextResponse.json({ error: 'Informe um valor válido maior que zero para a cobrança.' }, { status: 400 });
      }

      const docLimpo = String(pagadorDocumento || '').replace(/\D/g, '');
      const docValido = docLimpo.length === 11 || docLimpo.length === 14;
      // Se o usuário selecionou CobV mas não informou CPF/CNPJ válido ou nome, usa automaticamente Cobrança Imediata (Cob) para não bloquear a emissão do boleto!
      const usarCobV =
        tipoCobranca === 'pix_vencimento' && docValido && Boolean(pagadorNome.trim()) && Boolean(dataVencimento);

      const cobScopes = [
        'cob.write cob.read cobv.write cobv.read pix.write pix.read boletos_inclusao boletos_consulta',
        'cob.write cob.read cobv.write cobv.read pix.write pix.read',
        'cob.write cob.read',
        'cobv.write cobv.read',
        'pix.write pix.read cob.read cobv.read',
      ];

      let accessToken = '';
      let lastAuthError = '';
      for (const sc of cobScopes) {
        const tokenBody = new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: effectiveClientId,
          scope: sc,
        }).toString();

        const tokRes = await httpsRequestMtls(
          'https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenBody,
            certPem,
            keyPem,
          }
        );
        if (tokRes.status >= 200 && tokRes.status < 300) {
          const parsed = JSON.parse(tokRes.body || '{}');
          if (parsed.access_token) {
            accessToken = parsed.access_token;
            break;
          }
        } else {
          lastAuthError = `HTTP ${tokRes.status}: ${tokRes.body.slice(0, 200)}`;
        }
      }

      if (!accessToken) {
        return NextResponse.json(
          {
            error: `Não foi possível obter o escopo de emissão de cobrança (cob.write / cobv.write) no Sicoob (${lastAuthError}). No portal developers.sicoob.com.br > Aplicativos > API Pix, marque as permissões 'cob.write' e 'cobv.write'.`,
          },
          { status: 400 }
        );
      }

      const headersCob: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        client_id: effectiveClientId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      const devedorObj =
        docValido && pagadorNome.trim()
          ? docLimpo.length === 14
            ? { cnpj: docLimpo, nome: pagadorNome.trim() }
            : { cpf: docLimpo, nome: pagadorNome.trim() }
          : undefined;

      // Gera txid alfanumérico de 32 caracteres (exigido pelo padrão BACEN: [a-zA-Z0-9]{26,35})
      const randomHex = Array.from({ length: 20 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const txid = (`PRIV${Date.now()}${randomHex}`).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32).padEnd(28, '0');

      let cobUrl = `https://api.sicoob.com.br/pix/api/v2/cob/${txid}`;
      let cobPayload: Record<string, any> = {
        calendario: { expiracao: 86400 * 30 },
        ...(devedorObj ? { devedor: devedorObj } : {}),
        valor: { original: valorNum.toFixed(2) },
        chave: chavePix.trim() || '58033979000184',
        solicitacaoPagador: (descricao || 'Cobrança Privilege Consultoria').slice(0, 140),
      };

      if (usarCobV) {
        cobUrl = `https://api.sicoob.com.br/pix/api/v2/cobv/${txid}`;
        cobPayload = {
          calendario: {
            dataDeVencimento: dataVencimento,
            validadeAposVencimento: 30,
          },
          devedor: devedorObj,
          valor: {
            original: valorNum.toFixed(2),
            ...(Number(multaPercentual) > 0
              ? { multa: { modalidade: 2, valorPerc: Number(multaPercentual).toFixed(2) } }
              : {}),
            ...(Number(jurosMensalPercentual) > 0
              ? { juros: { modalidade: 2, valorPerc: Number(jurosMensalPercentual).toFixed(2) } }
              : {}),
          },
          chave: chavePix.trim() || '58033979000184',
          solicitacaoPagador: (descricao || 'Cobrança Privilege Consultoria').slice(0, 140),
        };
      }

      let cobRes = await httpsRequestMtls(cobUrl, {
        method: 'PUT',
        headers: headersCob,
        body: JSON.stringify(cobPayload),
        certPem,
        keyPem,
      });

      if (cobRes.status === 401 || cobRes.status === 429) {
        await new Promise(r => setTimeout(r, 1500));
        cobRes = await httpsRequestMtls(cobUrl, {
          method: 'PUT',
          headers: headersCob,
          body: JSON.stringify(cobPayload),
          certPem,
          keyPem,
        });
      }

      if (cobRes.status < 200 || cobRes.status >= 300) {
        return NextResponse.json(
          {
            error: `Sicoob API Cobrança retornou HTTP ${cobRes.status}: ${cobRes.body.slice(0, 300)}`,
          },
          { status: 400 }
        );
      }

      const cobJson = JSON.parse(cobRes.body || '{}');
      const dtVenc = dataVencimento || new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
      const hojeIso = new Date().toISOString().slice(0, 10);

      // 2.6 Tenta registrar também o BOLETO BANCÁRIO OFICIAL (Código de Barras 44 dígitos na CIP/FEBRABAN + PDF Oficial Sicoob)
      // Endpoint oficial Sicoob: POST https://api.sicoob.com.br/cobranca-bancaria/v3/boletos
      let boletoRegistradoOnline = false;
      let pdfBoletoOficialBase64 = '';
      let motivoCodigoBarrasNaoRegistrado = '';
      let boletoSicoob: {
        codigoBarras: string;
        linhaDigitavel: string;
        nossoNumero: string;
        campoLivre?: string;
        fatorVencimento?: string;
      } | null = null;

      try {
        // Obtém token específico com os 6 escopos oficiais da API 1 - Cobrança Bancária v3
        let tokenBoleto = accessToken;
        const tokBolRes = await httpsRequestMtls(
          'https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: effectiveClientId,
              scope:
                'boletos_inclusao boletos_consulta boletos_alteracao webhooks_inclusao webhooks_consulta webhooks_alteracao',
            }).toString(),
            certPem,
            keyPem,
          }
        );
        if (tokBolRes.status >= 200 && tokBolRes.status < 300) {
          const parsedBolTok = JSON.parse(tokBolRes.body || '{}');
          if (parsedBolTok.access_token) tokenBoleto = parsedBolTok.access_token;
        }

        const headersBoletoV3: Record<string, string> = {
          Authorization: `Bearer ${tokenBoleto}`,
          client_id: effectiveClientId,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };

        const payloadBoletoV3 = {
          numeroCliente: 4276485,
          codigoModalidade: 1,
          numeroContaCorrente: 1752049,
          codigoEspecieDocumento: 'DM',
          dataEmissao: hojeIso,
          seuNumero: String(nossoNumero || Math.floor((Date.now() / 1000) % 900000)).slice(0, 15),
          identificacaoEmissaoBoleto: 2, // 2 = Beneficiário emite
          identificacaoDistribuicaoBoleto: 2, // 2 = Beneficiário distribui
          valor: Number(valorNum.toFixed(2)),
          dataVencimento: dtVenc,
          tipoDesconto: 0,
          tipoMulta: Number(multaPercentual) > 0 ? 2 : 0,
          dataMulta: Number(multaPercentual) > 0 ? dtVenc : undefined,
          valorMulta: Number(multaPercentual) > 0 ? Number(multaPercentual) : undefined,
          tipoJurosMora: Number(jurosMensalPercentual) > 0 ? 2 : 0,
          dataJurosMora: Number(jurosMensalPercentual) > 0 ? dtVenc : undefined,
          valorJurosMora: Number(jurosMensalPercentual) > 0 ? Number(jurosMensalPercentual) : undefined,
          numeroParcela: 1,
          aceite: false,
          codigoCadastrarPIX: 1, // 1 = Com Pix Híbrido Sicoob
          gerarPdf: true, // Solicita o PDF Oficial do Sicoob
          pagador: {
            numeroCpfCnpj: docValido ? docLimpo : '58033979000184',
            nome: (pagadorNome || 'CLIENTE CONSUMIDOR').trim().slice(0, 50),
            endereco: (body.pagadorEndereco || 'RUA DO COMERCIO, CENTRO').slice(0, 40),
            bairro: (body.pagadorBairro || 'CENTRO').slice(0, 30),
            cidade: (body.pagadorCidade || 'FRANCISCO BELTRAO').slice(0, 40),
            cep: String(body.pagadorCep || '85601000').replace(/\D/g, '').padEnd(8, '0').slice(0, 8),
            uf: (body.pagadorUf || 'PR').slice(0, 2).toUpperCase(),
          },
          mensagensInstrucao: [
            (descricao || 'Cobrança Privilege Consultoria').slice(0, 40),
            'Pague pelo QR Code Pix ou Código de Barras até o vencimento.',
          ],
        };

        await new Promise(r => setTimeout(r, 800));
        const bolRes = await httpsRequestMtls('https://api.sicoob.com.br/cobranca-bancaria/v3/boletos', {
          method: 'POST',
          headers: headersBoletoV3,
          body: JSON.stringify(payloadBoletoV3),
          certPem,
          keyPem,
        });

        if (bolRes.status >= 200 && bolRes.status < 300) {
          const bolJson = JSON.parse(bolRes.body || '{}');
          const resBol = bolJson.resultado || bolJson;
          if (resBol?.codigoBarras && resBol?.linhaDigitavel) {
            boletoRegistradoOnline = true;
            pdfBoletoOficialBase64 = resBol.pdfBoleto || '';
            boletoSicoob = {
              codigoBarras: String(resBol.codigoBarras),
              linhaDigitavel: String(resBol.linhaDigitavel),
              nossoNumero: String(resBol.nossoNumero || nossoNumero || '1'),
            };
          }
        } else if (bolRes.status === 403 && bolRes.body.includes('Not registered to plan')) {
          motivoCodigoBarrasNaoRegistrado =
            "O servidor de autenticação do Sicoob liberou os 6 escopos (boletos_inclusao, boletos_consulta, etc.), mas o Gateway do Sicoob retornou 'HTTP 403 Not registered to plan' na URL /cobranca-bancaria/v3/boletos. Isso ocorre no Sicoob por 2 motivos: (1) A conta 175.204-9 (Beneficiário 4276485) precisa ter a 'Carteira de Cobrança Registrada via API/Webservice' ativa na Cooperativa 4342 (ou no Sicoobnet Empresarial > Cobrança Bancária), ou (2) Quando uma API é adicionada depois em um aplicativo já criado no developers.sicoob.com.br, o Gateway IBM do Sicoob exige clicar em Editar > Salvar novamente no aplicativo (ou criar um novo aplicativo já marcando Cobrança Bancária, Pix e Conta Corrente juntos). Enquanto isso, o QR Code Pix do boleto já está 100% registrado online e ativo para pagamento!";
        } else {
          motivoCodigoBarrasNaoRegistrado = `Retorno Sicoob Cobrança Bancária (HTTP ${bolRes.status}): ${bolRes.body.slice(0, 220)}`;
        }
      } catch (errBol) {
        motivoCodigoBarrasNaoRegistrado = (errBol as Error).message;
      }

      if (!boletoSicoob) {
        try {
          boletoSicoob = gerarBoletoSicoob(
            {
              agencia: agencia || '4342',
              convenio: '4276485',
              carteira: '1',
              variacao: '01',
            },
            {
              nossoNumero: Number(nossoNumero) || Math.floor((Date.now() / 1000) % 9000000) + 1,
              valor: valorNum,
              dataVencimento: dtVenc,
            }
          );
        } catch {
          boletoSicoob = null;
        }
      }

      return NextResponse.json({
        ok: true,
        txid: cobJson.txid || txid,
        status: cobJson.status || 'ATIVA',
        brcode: cobJson.brcode || cobJson.pixCopiaECola || '',
        location: cobJson.location || cobJson.loc?.location || '',
        valor: cobJson.valor?.original || valorNum.toFixed(2),
        chave: cobJson.chave || chavePix,
        calendario: cobJson.calendario || {},
        devedor: cobJson.devedor || devedorObj || null,
        boletoRegistradoOnline,
        pdfBoletoOficialBase64: pdfBoletoOficialBase64 || null,
        motivoCodigoBarrasNaoRegistrado: motivoCodigoBarrasNaoRegistrado || null,
        boleto: boletoSicoob
          ? {
              ...boletoSicoob,
              agencia: agencia || '4342',
              convenio: '4276485',
              conta: conta || '175.204-9',
              dataVencimento: dtVenc,
              registradoOnline: boletoRegistradoOnline,
              pdfBoleto: pdfBoletoOficialBase64 || null,
            }
          : null,
      });
    }

    const hoje = new Date();
    const dtFim = endDate || hoje.toISOString().slice(0, 10);
    const dtInicio =
      startDate || new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);

    // 3. Execução direta nos endpoints gratuitos de cada banco (mTLS + OAuth2)
    if (bankId === 'sicoob') {
      if (!certPem || !keyPem) {
        return NextResponse.json(
          { error: 'A API direta do Sicoob exige Certificado Digital ICP-Brasil A1 (mTLS). Cadastre na empresa ou envie o .pfx.' },
          { status: 400 }
        );
      }

      // Tenta os escopos oficiais de cooperado Sicoob (cco_consulta + pix.read + cob.read + boletos_consulta) e também cco_extrato
      const scopesToTry = [
        'cco_consulta cco_transferencias pix.read cob.read boletos_consulta pagamentos_consulta spb_consulta',
        'cco_consulta pix.read',
        'cco_extrato cco_saldo pix.read',
        'cco_extrato cco_saldo',
        'cco_consulta',
        'pix.read',
        'cco_extrato',
        '',
      ];
      let accessToken = '';
      let lastAuthError = '';

      for (const scopeStr of scopesToTry) {
        const params: Record<string, string> = {
          grant_type: 'client_credentials',
          client_id: clientId.trim(),
        };
        if (scopeStr) {
          params.scope = scopeStr;
        }
        const tokenBody = new URLSearchParams(params).toString();

        const tokenRes = await httpsRequestMtls(
          'https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenBody,
            certPem,
            keyPem,
          }
        );

        if (tokenRes.status >= 200 && tokenRes.status < 300) {
          const parsed = JSON.parse(tokenRes.body || '{}');
          if (parsed.access_token) {
            accessToken = parsed.access_token;
            break;
          }
        } else {
          lastAuthError = `HTTP ${tokenRes.status}: ${tokenRes.body.slice(0, 200)}`;
        }
      }

      if (!accessToken) {
        return NextResponse.json(
          {
            error: `Sicoob OAuth2 recusou a autenticação (${lastAuthError}). Verifique se o Client ID de developers.sicoob.com.br pertence ao mesmo CNPJ do Certificado A1.`,
          },
          { status: 400 }
        );
      }

      // Extrai conta corrente e cooperativa automaticamente do JWT do Sicoob caso não preenchidos
      let jwtPayload: Record<string, any> = {};
      try {
        jwtPayload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString('utf8'));
      } catch {}

      const numConta =
        conta.replace(/\D/g, '') ||
        String(jwtPayload?.contaCorrente || jwtPayload?.contasCorrente?.[0]?.numero || '').replace(/\D/g, '');
      const numCooperativa =
        agencia.replace(/\D/g, '') ||
        String(jwtPayload?.numCooperativa || jwtPayload?.cooperativa1 || '').replace(/\D/g, '');
      const grantedScopeStr = String(jwtPayload?.scope || '');

      const sicoobPixHeaders: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        client_id: clientId.trim(),
        Accept: 'application/json',
      };

      const sicoobCcoHeaders: Record<string, string> = {
        ...sicoobPixHeaders,
        ...(numCooperativa ? { 'x-sicoob-cie': numCooperativa } : {}),
      };

      let lastCallTime = 0;
      const callSicoobWithRetry = async (url: string, headers: Record<string, string>) => {
        const elapsed = Date.now() - lastCallTime;
        if (elapsed < 750) {
          await new Promise(r => setTimeout(r, 750 - elapsed));
        }
        lastCallTime = Date.now();
        let res = await httpsRequestMtls(url, { method: 'GET', headers, certPem, keyPem });
        if (res.status === 401 || res.status === 429) {
          // Aguarda propagação do token ou janela de rate-limit (Assembly Rate Limit) do Sicoob e tenta novamente
          await new Promise(r => setTimeout(r, 1600));
          lastCallTime = Date.now();
          res = await httpsRequestMtls(url, { method: 'GET', headers, certPem, keyPem });
        }
        return res;
      };

      const [anoIni, mesIni, diaIni] = dtInicio.split('-').map(Number);
      const [anoFim, mesFim, diaFim] = dtFim.split('-').map(Number);

      // 1) Consulta PRIMEIRO a API Pix Sicoob v2 (/pix/api/v2/pix), que exige janelas dentro do mesmo mês calendário
      // (evita que uma chamada prévia a uma API não assinada gere bloqueio temporário 403/401 no gateway IBM do Sicoob)
      const monthWindows: Array<{ ini: string; fim: string; ym: string }> = [];
      const cur = new Date(Date.UTC(anoIni, mesIni - 1, 1));
      const endMonth = new Date(Date.UTC(anoFim, mesFim - 1, 1));
      while (cur <= endMonth) {
        const y = cur.getUTCFullYear();
        const m = cur.getUTCMonth() + 1;
        const mStr = String(m).padStart(2, '0');
        const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const dIni = y === anoIni && m === mesIni ? String(diaIni).padStart(2, '0') : '01';
        const dFim = y === anoFim && m === mesFim ? String(diaFim).padStart(2, '0') : String(lastDay).padStart(2, '0');
        monthWindows.push({
          ini: `${y}-${mStr}-${dIni}T00:00:00Z`,
          fim: `${y}-${mStr}-${dFim}T23:59:59Z`,
          ym: `${y}-${mStr}`,
        });
        cur.setUTCMonth(cur.getUTCMonth() + 1);
      }

      // Se o filtro na tela cobrir até 2 meses, inclui automaticamente até 4 meses anteriores para carregar todo o histórico recente
      if (monthWindows.length <= 2) {
        const seenYm = new Set(monthWindows.map(w => w.ym));
        for (let offset = 1; offset <= 4; offset++) {
          const prevDate = new Date(Date.UTC(anoFim, mesFim - 1 - offset, 1));
          const py = prevDate.getUTCFullYear();
          const pm = prevDate.getUTCMonth() + 1;
          const pmStr = String(pm).padStart(2, '0');
          const ymKey = `${py}-${pmStr}`;
          if (!seenYm.has(ymKey)) {
            seenYm.add(ymKey);
            const pLastDay = String(new Date(Date.UTC(py, pm, 0)).getUTCDate()).padStart(2, '0');
            monthWindows.push({
              ini: `${py}-${pmStr}-01T00:00:00Z`,
              fim: `${py}-${pmStr}-${pLastDay}T23:59:59Z`,
              ym: ymKey,
            });
          }
        }
      }

      const pixRawList: any[] = [];
      let pixOk = false;

      for (const win of monthWindows) {
        const pixUrl = `https://api.sicoob.com.br/pix/api/v2/pix?inicio=${encodeURIComponent(win.ini)}&fim=${encodeURIComponent(win.fim)}`;
        const pixRes = await callSicoobWithRetry(pixUrl, sicoobPixHeaders);
        if (pixRes.status >= 200 && pixRes.status < 300) {
          pixOk = true;
          const pixJson = JSON.parse(pixRes.body || '{}');
          if (Array.isArray(pixJson?.pix)) {
            pixRawList.push(...pixJson.pix);
          }
          const totalPaginas = Number(pixJson?.parametros?.paginacao?.quantidadeDePaginas || 1);
          for (let pag = 1; pag < totalPaginas && pag < 10; pag++) {
            const pagRes = await callSicoobWithRetry(`${pixUrl}&paginacao.paginaAtual=${pag}`, sicoobPixHeaders);
            if (pagRes.status >= 200 && pagRes.status < 300) {
              const pagJson = JSON.parse(pagRes.body || '{}');
              if (Array.isArray(pagJson?.pix)) {
                pixRawList.push(...pagJson.pix);
              }
            }
          }
        }
      }

      // 2) Consulta Conta Corrente v4 em todos os meses do período se o escopo cco_extrato estiver ativo (ou como tentativa secundária)
      let ccoTx: OpenFinanceNormalizedTx[] = [];
      let saldoAtual: number | null = null;
      let ccoOk = false;
      let ccoStatus = 0;

      if (numConta && (grantedScopeStr.includes('cco_extrato') || !pixOk)) {
        for (const win of monthWindows) {
          const [wy, wm] = win.ym.split('-').map(Number);
          const queryParams = new URLSearchParams({ numeroContaCorrente: numConta });
          const extRes = await callSicoobWithRetry(
            `https://api.sicoob.com.br/conta-corrente/v4/extrato/${wm}/${wy}?${queryParams.toString()}`,
            sicoobCcoHeaders
          );
          ccoStatus = extRes.status;
          if (extRes.status >= 200 && extRes.status < 300) {
            ccoOk = true;
            const extJson = JSON.parse(extRes.body || '{}');
            const rawTx =
              extJson?.resultado?.transacoes ||
              extJson?.transacoes ||
              (Array.isArray(extJson?.resultado) ? extJson.resultado : []);
            if (saldoAtual === null) {
              saldoAtual = extJson?.resultado?.saldoAtual ?? extJson?.saldoAtual ?? null;
            }
            ccoTx.push(...normalizarTransacoes(rawTx, 'sicoob'));
          } else {
            break;
          }
        }
      }

      const pixTx = normalizarTransacoes(pixRawList, 'sicoob');

      if (!ccoOk && !pixOk) {
        return NextResponse.json(
          {
            error: `OAuth2 Sicoob autenticou com sucesso (Conta ${numConta}), mas o aplicativo ainda não possui a API 'Conta Corrente' ou 'Pix' vinculada no plano (HTTP ${ccoStatus}). Acesse developers.sicoob.com.br > Aplicativos > seção APIs e marque 'Conta Corrente' e 'Pix'.`,
          },
          { status: 400 }
        );
      }

      // Mescla transações sem duplicar
      const mergedMap = new Map<string, OpenFinanceNormalizedTx>();
      for (const tx of [...ccoTx, ...pixTx]) {
        mergedMap.set(tx.fitId, tx);
      }
      const mergedTx = Array.from(mergedMap.values()).sort((a, b) => b.date.localeCompare(a.date));

      return NextResponse.json({
        ok: true,
        modo: 'producao',
        protocolo: ccoOk
          ? 'API Oficial Sicoob Conta Corrente v4 + Pix v2 (mTLS + OAuth2)'
          : 'API Oficial Sicoob Pix v2 (mTLS + OAuth2 — Produção)',
        saldoAtual,
        contaAutenticada: numConta,
        cooperativaAutenticada: numCooperativa,
        titularAutenticado: jwtPayload?.descNomePessoa || null,
        aviso: !ccoOk
          ? 'Extrato Pix Sicoob sincronizado em Produção! Para incluir também boletos liquidados, TEDs e tarifas bancárias, acesse developers.sicoob.com.br > seu aplicativo > seção "APIs" (no rodapé) e adicione a API "Conta Corrente".'
          : undefined,
        transactions: mergedTx,
      });
    }

    if (bankId === 'inter') {
      if (!certPem || !keyPem) {
        return NextResponse.json(
          { error: 'A API do Banco Inter PJ exige o certificado (.crt/.key ou .pfx) na conexão mTLS.' },
          { status: 400 }
        );
      }
      const tokenBody = new URLSearchParams({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        grant_type: 'client_credentials',
        scope: 'extrato.read',
      }).toString();

      const tokenRes = await httpsRequestMtls('https://cdpj.partners.bancointer.com.br/oauth/v2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody,
        certPem,
        keyPem,
      });

      if (tokenRes.status < 200 || tokenRes.status >= 300) {
        return NextResponse.json(
          { error: `Banco Inter OAuth2 retornou HTTP ${tokenRes.status}: verifique Client ID, Secret e Certificado.` },
          { status: 400 }
        );
      }

      const { access_token } = JSON.parse(tokenRes.body);
      const extRes = await httpsRequestMtls(
        `https://cdpj.partners.bancointer.com.br/banking/v2/extrato?dataInicio=${dtInicio}&dataFim=${dtFim}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${access_token}`,
            ...(conta ? { 'x-conta-corrente': conta.replace(/\D/g, '') } : {}),
          },
          certPem,
          keyPem,
        }
      );

      const extJson = JSON.parse(extRes.body || '{}');
      const rawTx = extJson?.transacoes || [];
      return NextResponse.json({
        ok: true,
        modo: 'producao',
        protocolo: 'API Direta Banco Inter PJ v2 (mTLS)',
        transactions: normalizarTransacoes(rawTx, 'inter'),
      });
    }

    if (bankId === 'cora') {
      if (!certPem || !keyPem) {
        return NextResponse.json(
          { error: 'A API Direta da Cora PJ exige certificado mTLS.' },
          { status: 400 }
        );
      }
      const tokenBody = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId.trim(),
      }).toString();

      const tokenRes = await httpsRequestMtls('https://matls-clients.api.cora.com.br/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody,
        certPem,
        keyPem,
      });

      if (tokenRes.status < 200 || tokenRes.status >= 300) {
        return NextResponse.json(
          { error: `Cora OAuth2 retornou HTTP ${tokenRes.status}: verifique o Client ID e Certificado mTLS.` },
          { status: 400 }
        );
      }

      const { access_token } = JSON.parse(tokenRes.body);
      const extRes = await httpsRequestMtls(
        `https://matls-clients.api.cora.com.br/bank-statement/statement?start=${dtInicio}&end=${dtFim}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${access_token}` },
          certPem,
          keyPem,
        }
      );

      const extJson = JSON.parse(extRes.body || '{}');
      const rawTx = extJson?.entries || extJson?.items || [];
      return NextResponse.json({
        ok: true,
        modo: 'producao',
        protocolo: 'API Direta Cora PJ (mTLS)',
        transactions: normalizarTransacoes(rawTx, 'cora'),
      });
    }

    if (bankId === 'bb') {
      const basic = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64');
      const tokenRes = await httpsRequestMtls('https://oauth.bb.com.br/oauth/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials&scope=extrato-info',
        certPem: certPem || undefined,
        keyPem: keyPem || undefined,
      });

      if (tokenRes.status < 200 || tokenRes.status >= 300) {
        return NextResponse.json(
          { error: `Banco do Brasil OAuth2 retornou HTTP ${tokenRes.status}: verifique Client ID, Secret e gw-dev-app-key em developers.bb.com.br.` },
          { status: 400 }
        );
      }

      const { access_token } = JSON.parse(tokenRes.body);
      const agLimpa = agencia.replace(/\D/g, '').replace(/^0+/, '');
      const ccLimpa = conta.replace(/\D/g, '').replace(/^0+/, '');
      const extRes = await httpsRequestMtls(
        `https://api.bb.com.br/extratos/v1/conta-corrente/agencia/${agLimpa}/conta/${ccLimpa}?gw-dev-app-key=${encodeURIComponent(appKey.trim())}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${access_token}` },
          certPem: certPem || undefined,
          keyPem: keyPem || undefined,
        }
      );

      const extJson = JSON.parse(extRes.body || '{}');
      const rawTx = extJson?.listaLancamento || [];
      return NextResponse.json({
        ok: true,
        modo: 'producao',
        protocolo: 'API Direta Banco do Brasil Extratos v1',
        transactions: normalizarTransacoes(rawTx, 'bb'),
      });
    }

    // 4. Endpoint padrão OpenBanking-Brasil/openapi customizado ou demais bancos (Sicredi, Itaú, C6)
    if (customEndpoint.trim()) {
      const extRes = await httpsRequestMtls(customEndpoint.trim(), {
        method: 'GET',
        headers: {
          ...(clientSecret ? { Authorization: `Bearer ${clientSecret.trim()}` } : {}),
          ...(clientId ? { 'x-client-id': clientId.trim() } : {}),
        },
        certPem: certPem || undefined,
        keyPem: keyPem || undefined,
      });

      const extJson = JSON.parse(extRes.body || '{}');
      const rawTx = extJson?.data || extJson?.transacoes || extJson?.items || [];
      return NextResponse.json({
        ok: true,
        modo: 'producao',
        protocolo: 'OpenBanking-Brasil/openapi v2 Custom Endpoint',
        transactions: normalizarTransacoes(Array.isArray(rawTx) ? rawTx : [], bankId || 'openfinance'),
      });
    }

    return NextResponse.json(
      {
        error:
          'Para este banco em Produção, informe o Endpoint OpenAPI/Developers ou utilize o modo Homologação (Sandbox OpenBanking-Brasil) para testar.',
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
