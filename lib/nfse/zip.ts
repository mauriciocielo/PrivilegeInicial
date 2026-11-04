// ============================================================
// NFS-e NACIONAL — gerador de arquivo ZIP em memória (puro Node.js)
// ============================================================
// Implementa o formato PKZIP padrão ( método STORE / sem dependência externa )
// para exportar pacotes de XML e PDF das notas fiscais do mês.

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

function calcularCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = TABELA_CRC32[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ArquivoZip {
  nome: string;
  conteudo: Buffer;
}

export function criarZipBuffer(arquivos: ArquivoZip[]): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let offset = 0;

  for (const arq of arquivos) {
    const nomeBytes = Buffer.from(arq.nome.replace(/\\/g, '/'), 'utf8');
    const dados = arq.conteudo;
    const crc = calcularCrc32(dados);
    const tamanho = dados.length;

    // Local File Header (30 bytes + nome)
    const local = Buffer.alloc(30 + nomeBytes.length);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4);         // version needed
    local.writeUInt16LE(0x0800, 6);     // flags: UTF-8 filename
    local.writeUInt16LE(0, 8);          // method: 0 (STORE)
    local.writeUInt16LE(0, 10);         // mod time
    local.writeUInt16LE(0x21, 12);      // mod date
    local.writeUInt32LE(crc, 14);       // crc32
    local.writeUInt32LE(tamanho, 18);   // compressed size
    local.writeUInt32LE(tamanho, 22);   // uncompressed size
    local.writeUInt16LE(nomeBytes.length, 26); // filename length
    local.writeUInt16LE(0, 28);         // extra field length
    nomeBytes.copy(local, 30);

    locais.push(local, dados);

    // Central Directory File Header (46 bytes + nome)
    const central = Buffer.alloc(46 + nomeBytes.length);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4);         // version made by
    central.writeUInt16LE(20, 6);         // version needed
    central.writeUInt16LE(0x0800, 8);     // flags: UTF-8
    central.writeUInt16LE(0, 10);         // method: 0 (STORE)
    central.writeUInt16LE(0, 12);         // mod time
    central.writeUInt16LE(0x21, 14);      // mod date
    central.writeUInt32LE(crc, 16);       // crc32
    central.writeUInt32LE(tamanho, 20);   // compressed size
    central.writeUInt32LE(tamanho, 24);   // uncompressed size
    central.writeUInt16LE(nomeBytes.length, 28); // filename length
    central.writeUInt16LE(0, 30);         // extra length
    central.writeUInt16LE(0, 32);         // comment length
    central.writeUInt16LE(0, 34);         // disk number
    central.writeUInt16LE(0, 36);         // internal attrs
    central.writeUInt32LE(0, 38);         // external attrs
    central.writeUInt32LE(offset, 42);    // local header offset
    nomeBytes.copy(central, 46);

    centrais.push(central);
    offset += local.length + dados.length;
  }

  const centralDirSize = centrais.reduce((acc, b) => acc + b.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); // End of central directory signature
  fim.writeUInt16LE(0, 4);          // disk number
  fim.writeUInt16LE(0, 6);          // disk with central dir
  fim.writeUInt16LE(arquivos.length, 8);  // entries on disk
  fim.writeUInt16LE(arquivos.length, 10); // total entries
  fim.writeUInt32LE(centralDirSize, 12);  // central directory size
  fim.writeUInt32LE(offset, 16);          // central directory offset
  fim.writeUInt16LE(0, 20);               // comment length

  return Buffer.concat([...locais, ...centrais, fim]);
}

