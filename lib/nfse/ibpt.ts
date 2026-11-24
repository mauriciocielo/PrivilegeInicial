// ============================================================
// IBPT — Consulta de Tributos Aproximados (Lei 12.741/2012)
// ============================================================
// Camada 1: API oficial do IBPT (apidoni.ibpt.org.br/api/v1/servicos) quando
//           IBPT_TOKEN está configurado no servidor.
// Camada 2: Tabela de referência IBPT para Serviços (LC 116/2003) como
//           fallback automático zero-configuração, garantindo que empresas
//           Não Optantes do Simples (opSimpNac = 1) sempre emitam com
//           pTotTribFed / pTotTribEst / pTotTribMun válidos.

export interface ResultadoIbpt {
  pTotTribFed: number;
  pTotTribEst: number;
  pTotTribMun: number;
  fonte: string;
  versao: string;
}

const cacheMemoria = new Map<string, { expiraEm: number; dados: ResultadoIbpt }>();
const TTL_CACHE_MS = 24 * 60 * 60 * 1000;

// Percentuais de referência IBPT (Serviços LC 116/2003 — Regime Regular) por grupo (2 primeiros dígitos do cTribNac)
const TABELA_IBPT_SERVICOS: Record<string, { fed: number; est: number; mun: number }> = {
  '01': { fed: 13.45, est: 0.0, mun: 2.0 }, // Informática e congêneres
  '02': { fed: 13.45, est: 0.0, mun: 2.0 }, // Pesquisas e desenvolvimento
  '03': { fed: 13.45, est: 0.0, mun: 2.0 }, // Locação / cessão de direito de uso
  '04': { fed: 13.45, est: 0.0, mun: 2.0 }, // Saúde, assistência médica e congêneres
  '05': { fed: 13.45, est: 0.0, mun: 2.0 }, // Medicina e assistência veterinária
  '06': { fed: 13.45, est: 0.0, mun: 3.0 }, // Cuidados pessoais, estética
  '07': { fed: 13.45, est: 0.0, mun: 3.0 }, // Engenharia, arquitetura, construção civil
  '08': { fed: 13.45, est: 0.0, mun: 2.0 }, // Educação, ensino, treinamento
  '09': { fed: 13.45, est: 0.0, mun: 3.0 }, // Hospedagem, turismo, viagens
  '10': { fed: 13.45, est: 0.0, mun: 3.0 }, // Intermediação e congêneres
  '11': { fed: 13.45, est: 0.0, mun: 3.0 }, // Guarda, estacionamento, vigilância
  '12': { fed: 13.45, est: 0.0, mun: 5.0 }, // Diversões, lazer, entretenimento
  '13': { fed: 13.45, est: 0.0, mun: 3.0 }, // Fonografia, fotografia, reprografia
  '14': { fed: 13.45, est: 0.0, mun: 3.0 }, // Serviços relativos a bens de terceiros / manutenção
  '15': { fed: 15.45, est: 0.0, mun: 5.0 }, // Serviços bancários / financeiros
  '16': { fed: 13.45, est: 0.0, mun: 2.0 }, // Transporte de natureza municipal
  '17': { fed: 13.45, est: 0.0, mun: 2.0 }, // Apoio técnico, administrativo, jurídico, contábil, comercial
  '18': { fed: 13.45, est: 0.0, mun: 3.0 }, // Regulação de sinistros / seguros
  '25': { fed: 13.45, est: 0.0, mun: 3.0 }, // Serviços funerários
  '26': { fed: 13.45, est: 0.0, mun: 3.0 }, // Coleta, remessa ou entrega
  '27': { fed: 13.45, est: 0.0, mun: 2.0 }, // Assistência social
  '28': { fed: 13.45, est: 0.0, mun: 3.0 }, // Avaliação de bens e serviços
  '29': { fed: 13.45, est: 0.0, mun: 2.0 }, // Biblioteconomia
  '30': { fed: 13.45, est: 0.0, mun: 2.0 }, // Biologia, biotecnologia e química
  '31': { fed: 13.45, est: 0.0, mun: 3.0 }, // Serviços técnicos em edificações, eletrônica, mecânica
  '32': { fed: 13.45, est: 0.0, mun: 2.0 }, // Desenhos técnicos
  '33': { fed: 13.45, est: 0.0, mun: 3.0 }, // Desembaraço aduaneiro
  '34': { fed: 13.45, est: 0.0, mun: 3.0 }, // Investigações particulares
  '35': { fed: 13.45, est: 0.0, mun: 3.0 }, // Reportagem, jornalismo, relações públicas
  '37': { fed: 13.45, est: 0.0, mun: 2.0 }, // Artistas, atletas, modelos
  '38': { fed: 13.45, est: 0.0, mun: 2.0 }, // Museologia
  '39': { fed: 13.45, est: 0.0, mun: 3.0 }, // Ourivesaria e lapidação
  '40': { fed: 13.45, est: 0.0, mun: 3.0 }, // Obras de arte sob encomenda
};

function arred2(n: number): number {
  return Math.round(Math.max(0, Number(n) || 0) * 100) / 100;
}

/** Converte cTribNac de 6 dígitos (ex.: "171201") para código LC 116 de 4 dígitos (ex.: "1712"). */
function paraCodigoLc116(codigoServico?: string | null): string {
  const dig = String(codigoServico || '').replace(/\D/g, '');
  if (dig.length >= 4) return dig.slice(0, 4);
  return dig.padStart(4, '0');
}

export function obterReferenciaIbptLocal(codigoServico?: string | null, aliquotaIss?: number | null): ResultadoIbpt {
  const lc116 = paraCodigoLc116(codigoServico);
  const grupo = lc116.slice(0, 2);
  const ref = TABELA_IBPT_SERVICOS[grupo] || { fed: 13.45, est: 0.0, mun: 2.0 };
  const mun = aliquotaIss != null && Number(aliquotaIss) > 0 && Number(aliquotaIss) <= 5
    ? arred2(Number(aliquotaIss))
    : ref.mun;

  return {
    pTotTribFed: ref.fed,
    pTotTribEst: ref.est,
    pTotTribMun: mun,
    fonte: 'Tabela IBPT (Serviços LC 116)',
    versao: '2026',
  };
}

export async function consultarTributosIbpt(params: {
  cnpj?: string | null;
  codigoServico?: string | null;
  uf?: string | null;
  aliquotaIss?: number | null;
  descricao?: string | null;
}): Promise<ResultadoIbpt> {
  const lc116 = paraCodigoLc116(params.codigoServico);
  const uf = String(params.uf || 'PR').trim().toUpperCase().slice(0, 2) || 'PR';
  const cnpj = String(params.cnpj || '').replace(/\D/g, '');
  const token = (process.env.IBPT_TOKEN || '').trim();

  const chaveCache = `${lc116}:${uf}:${token ? 'api' : 'local'}`;
  const emCache = cacheMemoria.get(chaveCache);
  if (emCache && emCache.expiraEm > Date.now()) {
    return emCache.dados;
  }

  // Camada 1: API oficial do IBPT (se IBPT_TOKEN estiver configurado)
  if (token && cnpj.length === 14 && lc116 !== '0000') {
    try {
      const qs = new URLSearchParams({
        token,
        cnpj,
        codigo: lc116,
        uf,
        descricao: (params.descricao || 'Prestacao de servicos').slice(0, 120),
        unidadeMedida: 'UN',
        valor: '100',
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`https://apidoni.ibpt.org.br/api/v1/servicos?${qs.toString()}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);

      if (res.ok) {
        const j = await res.json().catch(() => null);
        if (j && (j.Nacional != null || j.Municipal != null)) {
          const dados: ResultadoIbpt = {
            pTotTribFed: arred2(Number(j.Nacional ?? 13.45)),
            pTotTribEst: arred2(Number(j.Estadual ?? 0)),
            pTotTribMun: arred2(Number(j.Municipal ?? (params.aliquotaIss || 2))),
            fonte: String(j.Fonte || 'IBPT API Oficial'),
            versao: String(j.Versao || '2026'),
          };
          cacheMemoria.set(chaveCache, { expiraEm: Date.now() + TTL_CACHE_MS, dados });
          return dados;
        }
      }
    } catch {
      // Fallback automático para a tabela IBPT local
    }
  }

  // Camada 2: Tabela IBPT local de referência para Serviços (LC 116/2003)
  const local = obterReferenciaIbptLocal(params.codigoServico, params.aliquotaIss);
  cacheMemoria.set(chaveCache, { expiraEm: Date.now() + TTL_CACHE_MS, dados: local });
  return local;
}
