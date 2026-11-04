import { describe, expect, it } from 'vitest';
import { lerJsonResposta } from './resposta-cliente';

describe('lerJsonResposta', () => {
  it('devolve o JSON normalmente', async () => {
    expect(await lerJsonResposta(new Response('{"a":1}'))).toEqual({ a: 1 });
  });

  it('troca a página HTML por uma mensagem com o código e o título', async () => {
    const html = '<HTML>\n<HEAD><TITLE>Gateway Timeout</TITLE></HEAD><BODY>x</BODY></HTML>';
    await expect(lerJsonResposta(new Response(html, { status: 504 }))).rejects.toThrow('HTTP 504: Gateway Timeout');
  });

  it('funciona também sem título', async () => {
    await expect(lerJsonResposta(new Response('<HTML></HTML>', { status: 502 }))).rejects.toThrow('HTTP 502');
  });
});
