/**
 * Lê o JSON de uma rota da API no navegador. Quando chega uma página HTML (erro da
 * hospedagem, proxy, tempo esgotado), troca o erro de sintaxe por uma mensagem com o
 * código HTTP e o título da página, que identificam quem respondeu.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function lerJsonResposta(res: Response): Promise<any> {
  const texto = await res.text();
  try {
    return JSON.parse(texto);
  } catch {
    const titulo = texto.match(/<title[^>]*>([^<]{1,120})/i)?.[1]?.trim();
    throw new Error(`O servidor respondeu com uma página em vez dos dados (HTTP ${res.status}${titulo ? `: ${titulo}` : ''}). Tente de novo em alguns minutos.`);
  }
}
