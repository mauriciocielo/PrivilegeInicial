// OFX Parser — lê arquivos OFX/QFX dos bancos

export interface OFXTransaction {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  date: string;
  amount: number;
  description: string;
  checkNum?: string;
  fitId: string;
}

export interface OFXResult {
  bankId?: string;
  acctId?: string;
  acctType?: string;
  dtStart?: string;
  dtEnd?: string;
  transactions: OFXTransaction[];
}

function parseDate(raw: string): string {
  // Format: YYYYMMDD or YYYYMMDDHHMMSS
  const y = raw.slice(0, 4);
  const m = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  return `${y}-${m}-${d}`;
}

function extractTag(content: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^<\\n\\r]*)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function extractAllBlocks(content: string, tag: string): string[] {
  const blocks: string[] = [];
  const openTag = new RegExp(`<${tag}>`, 'gi');
  const closeTag = new RegExp(`</${tag}>`, 'gi');
  
  let match;
  const opens: number[] = [];
  openTag.lastIndex = 0;
  
  while ((match = openTag.exec(content)) !== null) {
    opens.push(match.index + match[0].length);
  }
  
  const closes: number[] = [];
  closeTag.lastIndex = 0;
  while ((match = closeTag.exec(content)) !== null) {
    closes.push(match.index);
  }
  
  for (let i = 0; i < Math.min(opens.length, closes.length); i++) {
    blocks.push(content.slice(opens[i], closes[i]));
  }
  
  // If no closing tags, try to parse as SGML (OFX 1.x format)
  if (blocks.length === 0) {
    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi;
    while ((match = stmtTrnRegex.exec(content)) !== null) {
      blocks.push(match[1]);
    }
  }
  
  return blocks;
}

export function parseOFX(content: string): OFXResult {
  const result: OFXResult = { transactions: [] };
  
  result.bankId = extractTag(content, 'BANKID');
  result.acctId = extractTag(content, 'ACCTID');
  result.acctType = extractTag(content, 'ACCTTYPE');
  result.dtStart = extractTag(content, 'DTSTART') ? parseDate(extractTag(content, 'DTSTART')) : undefined;
  result.dtEnd = extractTag(content, 'DTEND') ? parseDate(extractTag(content, 'DTEND')) : undefined;
  
  const trnBlocks = extractAllBlocks(content, 'STMTTRN');
  
  for (const block of trnBlocks) {
    const trntype = extractTag(block, 'TRNTYPE') || 'DEBIT';
    const dtposted = extractTag(block, 'DTPOSTED');
    const trnamt = extractTag(block, 'TRNAMT');
    const fitid = extractTag(block, 'FITID');
    const memo = extractTag(block, 'MEMO') || extractTag(block, 'NAME') || 'Lançamento OFX';
    const checknum = extractTag(block, 'CHECKNUM');
    
    if (!dtposted || !trnamt) continue;
    
    const amount = parseFloat(trnamt.replace(',', '.'));
    
    result.transactions.push({
      id: fitid || `ofx_${Date.now()}_${Math.random()}`,
      fitId: fitid,
      type: amount > 0 ? 'CREDIT' : 'DEBIT',
      date: parseDate(dtposted),
      amount: Math.abs(amount),
      description: memo,
      checkNum: checknum || undefined,
    });
  }
  
  return result;
}

// Gera OFX de exemplo para testes
export function generateSampleOFX(): string {
  const hoje = new Date();
  const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  
  const transactions = [
    { type: 'CREDIT', date: new Date(hoje.getFullYear(), hoje.getMonth(), 5), amount: 12500.00, memo: 'TED RECEBIDA - CLIENTE ABC', fitId: 'FIT001' },
    { type: 'DEBIT', date: new Date(hoje.getFullYear(), hoje.getMonth(), 7), amount: -3500.00, memo: 'PAGTO FORNECEDOR XYZ', fitId: 'FIT002' },
    { type: 'CREDIT', date: new Date(hoje.getFullYear(), hoje.getMonth(), 10), amount: 8750.50, memo: 'PIX RECEBIDO - VENDAS', fitId: 'FIT003' },
    { type: 'DEBIT', date: new Date(hoje.getFullYear(), hoje.getMonth(), 12), amount: -850.00, memo: 'ENERGIA ELETRICA - CPFL', fitId: 'FIT004' },
    { type: 'DEBIT', date: new Date(hoje.getFullYear(), hoje.getMonth(), 15), amount: -12000.00, memo: 'FOLHA DE PAGAMENTO', fitId: 'FIT005' },
    { type: 'CREDIT', date: new Date(hoje.getFullYear(), hoje.getMonth(), 18), amount: 5000.00, memo: 'SERVICOS PRESTADOS - NF 0045', fitId: 'FIT006' },
    { type: 'DEBIT', date: new Date(hoje.getFullYear(), hoje.getMonth(), 20), amount: -2100.00, memo: 'SIMPLES NACIONAL', fitId: 'FIT007' },
    { type: 'DEBIT', date: new Date(hoje.getFullYear(), hoje.getMonth(), 22), amount: -45.80, memo: 'TARIFA BANCARIA', fitId: 'FIT008' },
  ];
  
  const trnList = transactions.map(t => `
    <STMTTRN>
      <TRNTYPE>${t.amount > 0 ? 'CREDIT' : 'DEBIT'}</TRNTYPE>
      <DTPOSTED>${fmt(t.date)}</DTPOSTED>
      <TRNAMT>${t.amount.toFixed(2)}</TRNAMT>
      <FITID>${t.fitId}</FITID>
      <MEMO>${t.memo}</MEMO>
    </STMTTRN>`).join('');
  
  return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:UTF-8
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
      <DTSERVER>${fmt(hoje)}</DTSERVER>
      <LANGUAGE>POR</LANGUAGE>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>1001</TRNUID>
      <STMTRS>
        <CURDEF>BRL</CURDEF>
        <BANKACCTFROM>
          <BANKID>001</BANKID>
          <ACCTID>00001-2</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>${fmt(mesPassado)}</DTSTART>
          <DTEND>${fmt(hoje)}</DTEND>
          ${trnList}
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>45500.00</BALAMT>
          <DTASOF>${fmt(hoje)}</DTASOF>
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;
}
