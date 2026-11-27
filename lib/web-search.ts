// ============================================================
// BUSCA NA INTERNET EM TEMPO REAL PARA O BOT DO WHATSAPP
// ============================================================
// Usada automaticamente quando o assistente de IA não tem certeza
// sobre uma legislação, tabela vigente, prazo fiscal ou dúvida factual.
// Prioridade: Tavily/Serper (se houver chave) -> DuckDuckGo BR (gratuito) -> Wikipedia PT.

export interface ResultadoBuscaWeb {
  titulo: string;
  trecho: string;
  url: string;
}

function limparHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function buscarDuckDuckGoHtml(query: string): Promise<ResultadoBuscaWeb[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=br-pt`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(6500),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const resultados: ResultadoBuscaWeb[] = [];

    const blocos = html.split(/class="result__body"/i).slice(1, 7);
    for (const bloco of blocos) {
      const mTitle = bloco.match(/class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      const mSnip = bloco.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/i);
      const titulo = limparHtml(mTitle?.[2] || '');
      const trecho = limparHtml(mSnip?.[1] || '');
      let link = mTitle?.[1] || '';
      const mUddg = link.match(/uddg=([^&]+)/);
      if (mUddg) link = decodeURIComponent(mUddg[1]);
      if (titulo && trecho) {
        resultados.push({ titulo, trecho: trecho.slice(0, 320), url: link });
      }
      if (resultados.length >= 4) break;
    }
    return resultados;
  } catch {
    return [];
  }
}

async function buscarTavily(query: string): Promise<ResultadoBuscaWeb[]> {
  const apiKey = (process.env.TAVILY_API_KEY || '').trim();
  if (!apiKey) return [];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 4,
        include_answer: true,
      }),
      signal: AbortSignal.timeout(6500),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const out: ResultadoBuscaWeb[] = [];
    if (data?.answer) {
      out.push({ titulo: 'Resumo Pesquisado', trecho: String(data.answer).slice(0, 450), url: '' });
    }
    for (const r of data?.results || []) {
      if (r?.title && r?.content) {
        out.push({
          titulo: String(r.title),
          trecho: String(r.content).slice(0, 320),
          url: String(r.url || ''),
        });
      }
    }
    return out.slice(0, 4);
  } catch {
    return [];
  }
}

async function buscarWikipediaPt(query: string): Promise<ResultadoBuscaWeb[]> {
  try {
    const url = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=3`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const items = data?.query?.search || [];
    return items.map((it: any) => ({
      titulo: String(it.title || ''),
      trecho: limparHtml(String(it.snippet || '')),
      url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(String(it.title || '').replace(/\s+/g, '_'))}`,
    }));
  } catch {
    return [];
  }
}

/**
 * Executa busca na internet e retorna um resumo pronto para injetar no prompt da IA,
 * ou string vazia se nenhum resultado confiável for encontrado.
 */
export async function buscarNaInternetParaBot(query: string): Promise<string> {
  const q = query.trim().slice(0, 180);
  if (!q) return '';

  let resultados = await buscarTavily(q);
  if (resultados.length === 0) {
    resultados = await buscarDuckDuckGoHtml(q);
  }
  if (resultados.length === 0) {
    resultados = await buscarWikipediaPt(q);
  }
  if (resultados.length === 0) return '';

  return resultados
    .map((r, i) => `${i + 1}. ${r.titulo}\n   ${r.trecho}${r.url ? `\n   Fonte: ${r.url}` : ''}`)
    .join('\n\n');
}
