import { describe, it, expect } from 'vitest';
import { gerarApiDocsPdfBlob } from './api-docs-pdf';

describe('gerarApiDocsPdfBlob', () => {
  it('gera um PDF válido, com múltiplas páginas, sem lançar exceção', async () => {
    const { bytes, paginas, nome } = await gerarApiDocsPdfBlob('https://portal.privilegecontabilidade.com.br');

    // Assinatura de arquivo PDF: começa com "%PDF-".
    const header = new TextDecoder().decode(new Uint8Array(bytes).slice(0, 5));
    expect(header).toBe('%PDF-');

    expect(bytes.byteLength).toBeGreaterThan(1000);
    // 10 seções com bastante código — não deve caber numa página só.
    expect(paginas).toBeGreaterThanOrEqual(2);
    expect(nome).toContain('Documentacao-API');
  });

  it('não quebra com uma base URL diferente (garante que os textos interpolados não estouram a paginação)', async () => {
    const { paginas } = await gerarApiDocsPdfBlob('http://localhost:3000');
    expect(paginas).toBeGreaterThanOrEqual(2);
  });
});
