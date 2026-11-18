// Gerador de arquivo ZIP puro no navegador (Uint8Array, sem dependências externas)

const TABELA_CRC32 = (() => {
  const tabela = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabela[i] = c >>> 0;
  }
  return tabela;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = TABELA_CRC32[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export interface ArquivoZipClient {
  nome: string;
  conteudo: Uint8Array;
}

export function criarZipBlobClient(arquivos: ArquivoZipClient[]): Blob {
  const encoder = new TextEncoder();
  const partesLocais: Uint8Array[] = [];
  const partesCentrais: Uint8Array[] = [];
  let offset = 0;

  for (const arq of arquivos) {
    const nomeBytes = encoder.encode(arq.nome.replace(/\\/g, '/'));
    const dados = arq.conteudo;
    const tamanho = dados.length;
    const crc = crc32(dados);

    // Local File Header (30 bytes + nome)
    const local = new Uint8Array(30 + nomeBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8
    lv.setUint16(8, 0, true); // STORE (sem limite de memória no browser)
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x21, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, tamanho, true);
    lv.setUint32(22, tamanho, true);
    lv.setUint16(26, nomeBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nomeBytes, 30);

    partesLocais.push(local, dados);

    // Central Directory File Header (46 bytes + nome)
    const central = new Uint8Array(46 + nomeBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, tamanho, true);
    cv.setUint32(24, tamanho, true);
    cv.setUint16(28, nomeBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nomeBytes, 46);

    partesCentrais.push(central);
    offset += local.length + dados.length;
  }

  const centralSize = partesCentrais.reduce((s, b) => s + b.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, arquivos.length, true);
  ev.setUint16(10, arquivos.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...partesLocais, ...partesCentrais, eocd] as BlobPart[], { type: 'application/zip' });
}
