import { NextResponse } from 'next/server';
import https from 'https';
import { generateSampleOFX } from '../../../lib/ofx-parser';
import { requireAuth } from '../../../lib/api-auth';
import db from '../../../lib/prisma';
import { decifrar } from '../../../lib/nfse/cofre';
import { lerCertificadoA1 } from '../../../lib/nfse/assinatura';

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
    method: 'GET' | 'POST';
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
      const cfg = await db.nfseConfig.findUnique({
        where: { empresaId },
        select: { certTitular: true, certCnpj: true, certValidoAte: true, certPfxCifrado: true },
      });
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
      } else if (usarCertificadoEmpresa && empresaId) {
        const cfg = await db.nfseConfig.findUnique({ where: { empresaId } });
        if (cfg?.certPfxCifrado && cfg?.certSenhaCifrada) {
          const pfxBuf = decifrar(cfg.certPfxCifrado, empresaId);
          const senhaStr = decifrar(cfg.certSenhaCifrada, empresaId).toString('utf8');
          const cred = lerCertificadoA1(pfxBuf, senhaStr);
          certPem = cred.certificadosPem;
          keyPem = cred.chavePem;
        }
      }
    }

    if (!clientId.trim()) {
      return NextResponse.json(
        { error: 'Informe o Client ID gerado gratuitamente no Portal Developers do banco.' },
        { status: 400 }
      );
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

      const callSicoobWithRetry = async (url: string, headers: Record<string, string>) => {
        let res = await httpsRequestMtls(url, { method: 'GET', headers, certPem, keyPem });
        if (res.status === 401) {
          // Aguarda propagação do token JWT no gateway IBM API Connect do Sicoob (~1.5s) e tenta novamente
          await new Promise(r => setTimeout(r, 1500));
          res = await httpsRequestMtls(url, { method: 'GET', headers, certPem, keyPem });
        }
        return res;
      };

      const [anoIni, mesIni, diaIni] = dtInicio.split('-').map(Number);
      const [anoFim, mesFim, diaFim] = dtFim.split('-').map(Number);

      // 1) Consulta PRIMEIRO a API Pix Sicoob v2 (/pix/api/v2/pix), que exige janelas dentro do mesmo mês calendário
      // (evita que uma chamada prévia a uma API não assinada gere bloqueio temporário 403/401 no gateway IBM do Sicoob)
      const monthWindows: Array<{ ini: string; fim: string }> = [];
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
        });
        cur.setUTCMonth(cur.getUTCMonth() + 1);
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
        }
      }

      // Se o período atual não teve Pix e o usuário consultou apenas 1 mês, busca os últimos 2 meses para exibir histórico real
      if (pixOk && pixRawList.length === 0 && monthWindows.length === 1) {
        for (let offset = 1; offset <= 2; offset++) {
          const prevDate = new Date(Date.UTC(anoFim, mesFim - 1 - offset, 1));
          const py = prevDate.getUTCFullYear();
          const pm = prevDate.getUTCMonth() + 1;
          const pmStr = String(pm).padStart(2, '0');
          const pLastDay = String(new Date(Date.UTC(py, pm, 0)).getUTCDate()).padStart(2, '0');
          const pixUrl = `https://api.sicoob.com.br/pix/api/v2/pix?inicio=${encodeURIComponent(`${py}-${pmStr}-01T00:00:00Z`)}&fim=${encodeURIComponent(`${py}-${pmStr}-${pLastDay}T23:59:59Z`)}`;
          const pixRes = await callSicoobWithRetry(pixUrl, sicoobPixHeaders);
          if (pixRes.status >= 200 && pixRes.status < 300) {
            const pixJson = JSON.parse(pixRes.body || '{}');
            if (Array.isArray(pixJson?.pix)) {
              pixRawList.push(...pixJson.pix);
            }
          }
        }
      }

      // 2) Consulta Conta Corrente v4 se o escopo cco_extrato estiver ativo (ou como tentativa secundária)
      let ccoTx: OpenFinanceNormalizedTx[] = [];
      let saldoAtual: number | null = null;
      let ccoOk = false;
      let ccoStatus = 0;

      if (numConta && (grantedScopeStr.includes('cco_extrato') || !pixOk)) {
        const queryParams = new URLSearchParams({ numeroContaCorrente: numConta });
        if (anoIni === anoFim && mesIni === mesFim && diaIni && diaFim) {
          queryParams.set('diaInicial', String(diaIni));
          queryParams.set('diaFinal', String(diaFim));
        }

        const extRes = await callSicoobWithRetry(
          `https://api.sicoob.com.br/conta-corrente/v4/extrato/${mesFim}/${anoFim}?${queryParams.toString()}`,
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
          saldoAtual = extJson?.resultado?.saldoAtual ?? extJson?.saldoAtual ?? null;
          ccoTx = normalizarTransacoes(rawTx, 'sicoob');
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
