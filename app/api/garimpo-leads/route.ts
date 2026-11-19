import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export interface LeadGarimpado {
  id: string;
  nome: string;
  categoria: string;
  cidade: string;
  estado: string;
  endereco: string;
  telefone: string;
  whatsapp: string;
  email: string;
  website: string;
  instagram: string;
  cnpj: string;
  porte?: string;
  capitalSocial?: number;
  socios?: string;
  nota?: number;
  avaliacoes?: number;
  mapsUrl: string;
  latitude?: number;
  longitude?: number;
  fonte: 'osm' | 'google_places' | 'cnpj' | 'gosom_import';
  score: number;
  status: 'novo' | 'qualificado' | 'contato' | 'reuniao' | 'proposta' | 'convertido' | 'descartado';
  notas?: string;
  iaDiagnostico?: string;
  iaScriptWhatsapp?: string;
  iaAssuntoEmail?: string;
  iaCorpoEmail?: string;
  criadoEm: string;
}

const SEGMENTO_OSM_TAGS: { keywords: string[]; filters: string[] }[] = [
  { keywords: ['restaurante', 'food', 'comida', 'pizzaria', 'lanchonete', 'padaria', 'bar', 'cafe', 'churrascaria'], filters: ['amenity~"restaurant|fast_food|cafe|bar|pub|food_court"', 'shop~"bakery|pastry|butcher|confectionery"'] },
  { keywords: ['clinica', 'clínica', 'odonto', 'dentista', 'medico', 'médico', 'saude', 'saúde', 'hospital', 'fisio', 'laboratorio', 'laboratório', 'psicolog'], filters: ['amenity~"clinic|dentist|doctors|hospital|pharmacy|veterinary"', 'healthcare~".+"'] },
  { keywords: ['farmacia', 'farmácia', 'drogaria'], filters: ['amenity="pharmacy"', 'shop="chemist"'] },
  { keywords: ['supermercado', 'mercado', 'mercearia', 'atacado', 'hortifruti'], filters: ['shop~"supermarket|convenience|greengrocer|department_store|wholesale"'] },
  { keywords: ['oficina', 'mecanica', 'mecânica', 'autopecas', 'autopeças', 'auto', 'funilaria', 'borracharia', 'concessionaria'], filters: ['shop~"car_repair|car_parts|car|tyres|motorcycle"', 'craft~"car_repair"'] },
  { keywords: ['loja', 'varejo', 'roupa', 'moda', 'calcado', 'calçado', 'movel', 'móvel', 'moveis', 'móveis', 'eletro', 'otica', 'ótica', 'joalheria', 'papelaria'], filters: ['shop~"clothes|shoes|furniture|electronics|optician|jewelry|stationery|beauty|cosmetics|gift|sports|hardware|doityourself"'] },
  { keywords: ['construtora', 'engenharia', 'arquitetura', 'imobiliaria', 'imobiliária', 'material de construcao', 'construção'], filters: ['office~"construction_company|architect|estate_agent|engineer"', 'shop~"doityourself|hardware|trade|building_materials"'] },
  { keywords: ['industria', 'indústria', 'fabrica', 'fábrica', 'metalurgica', 'metalúrgica', 'marcenaria', 'serralheria', 'grafica', 'gráfica'], filters: ['man_made="works"', 'landuse="industrial"', 'craft~"metal_construction|carpenter|joiner|welder|print"'] },
  { keywords: ['academia', 'fitness', 'pilates', 'crossfit', 'esporte'], filters: ['leisure~"fitness_centre|sports_centre"'] },
  { keywords: ['hotel', 'pousada', 'turismo', 'viagem'], filters: ['tourism~"hotel|motel|guest_house|hostel"'] },
  { keywords: ['advocacia', 'advogado', 'contabilidade', 'contador', 'consultoria', 'escritorio', 'escritório', 'seguro', 'financeira'], filters: ['office~"lawyer|accountant|consulting|insurance|financial|company"'] },
  { keywords: ['escola', 'colegio', 'colégio', 'curso', 'faculdade', 'educacao', 'educação', 'idiomas'], filters: ['amenity~"school|college|university|language_school|kindergarten"'] },
  { keywords: ['pet', 'veterinari', 'agro', 'agropecuaria', 'agropecuária'], filters: ['shop~"pet|agrarian|farm"', 'amenity="veterinary"'] },
  { keywords: ['salao', 'salão', 'barbearia', 'estetica', 'estética', 'beleza'], filters: ['shop~"hairdresser|beauty|massage|cosmetics"'] },
  { keywords: ['transporte', 'transportadora', 'logistica', 'logística', 'frete'], filters: ['office~"logistics|moving_company|transport"'] },
];

function normalizarTexto(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function limparTelefone(tel: string): string {
  const digits = (tel || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function calcularScoreLead(lead: Partial<LeadGarimpado>): number {
  let score = 20;
  if (lead.telefone || lead.whatsapp) score += 22;
  if (lead.whatsapp) score += 8;
  if (lead.email) score += 20;
  if (lead.website) score += 12;
  if (lead.instagram) score += 6;
  if (lead.cnpj) score += 8;
  if (lead.endereco && lead.endereco.length > 8) score += 4;
  if (lead.nota && lead.nota >= 4.0) score += 5;
  if (lead.avaliacoes && lead.avaliacoes >= 20) score += 5;
  return Math.min(100, Math.max(10, score));
}

async function extrairDadosDoSite(urlRaw: string): Promise<{
  email?: string;
  whatsapp?: string;
  instagram?: string;
  cnpj?: string;
}> {
  if (!urlRaw) return {};
  const url = /^https?:\/\//i.test(urlRaw) ? urlRaw : `https://${urlRaw}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) return {};
    const html = (await res.text()).slice(0, 180000);

    // E-mail corporativo
    const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const emailFiltrado = emailMatches.find(e => {
      const lower = e.toLowerCase();
      return (
        !lower.endsWith('.png') &&
        !lower.endsWith('.jpg') &&
        !lower.endsWith('.jpeg') &&
        !lower.endsWith('.svg') &&
        !lower.endsWith('.webp') &&
        !lower.includes('sentry') &&
        !lower.includes('wixpress') &&
        !lower.includes('example.') &&
        !lower.includes('dominio.') &&
        !lower.includes('seuemail') &&
        lower.length < 70
      );
    });

    // WhatsApp link
    const waMatch = html.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\d{10,15})/i);
    const whatsapp = waMatch ? limparTelefone(waMatch[1]) : undefined;

    // Instagram
    const igMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]{2,35})\/?/i);
    const igUser = igMatch?.[1]?.toLowerCase();
    const instagram =
      igMatch && igUser && !['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'share'].includes(igUser)
        ? `https://instagram.com/${igMatch[1]}`
        : undefined;

    // CNPJ
    const cnpjMatch = html.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
    const cnpj = cnpjMatch ? cnpjMatch[0] : undefined;

    return {
      email: emailFiltrado,
      whatsapp,
      instagram,
      cnpj,
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}

async function buscarViaGooglePlaces(
  segmento: string,
  cidade: string,
  estado: string,
  limite: number,
  apiKey: string
): Promise<LeadGarimpado[]> {
  const query = `${segmento} em ${cidade} ${estado}, Brasil`.trim();
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.primaryTypeDisplayName,places.location',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'pt-BR',
      maxResultCount: Math.min(20, Math.max(5, limite)),
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Google Places API retornou ${res.status}: ${txt.slice(0, 180)}`);
  }

  const data = await res.json();
  const places: any[] = data.places || [];
  const now = new Date().toISOString();

  return places.map((p, idx) => {
    const telefone = p.nationalPhoneNumber || '';
    const whatsapp = limparTelefone(telefone);
    const nome = p.displayName?.text || 'Empresa';
    const item: LeadGarimpado = {
      id: `gp_${p.id || Date.now() + '_' + idx}`,
      nome,
      categoria: p.primaryTypeDisplayName?.text || segmento,
      cidade,
      estado,
      endereco: p.formattedAddress || '',
      telefone,
      whatsapp,
      email: '',
      website: p.websiteUri || '',
      instagram: '',
      cnpj: '',
      nota: typeof p.rating === 'number' ? p.rating : undefined,
      avaliacoes: typeof p.userRatingCount === 'number' ? p.userRatingCount : undefined,
      mapsUrl:
        p.googleMapsUri ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nome} ${cidade} ${estado}`)}`,
      latitude: p.location?.latitude,
      longitude: p.location?.longitude,
      fonte: 'google_places',
      score: 0,
      status: 'novo',
      criadoEm: now,
    };
    item.score = calcularScoreLead(item);
    return item;
  });
}

async function buscarViaOpenStreetMap(
  segmento: string,
  cidade: string,
  estado: string,
  limite: number
): Promise<LeadGarimpado[]> {
  // 1. Geocodifica a cidade via Nominatim
  const qGeo = encodeURIComponent(`${cidade}, ${estado}, Brazil`);
  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${qGeo}&format=json&limit=1&addressdetails=1`,
    {
      headers: {
        'User-Agent': 'PrivilegeConsultoriaLeadFinder/1.0 (contato@privilegecontabilidade.cnt.br)',
      },
    }
  );
  if (!geoRes.ok) {
    throw new Error('Não foi possível localizar a cidade no OpenStreetMap (Nominatim).');
  }
  const geoList: any[] = await geoRes.json();
  if (!geoList.length || !geoList[0].boundingbox) {
    throw new Error(`Cidade "${cidade} - ${estado}" não encontrada. Verifique a grafia.`);
  }

  const [south, north, west, east] = geoList[0].boundingbox.map(Number);
  const bbox = `${south},${west},${north},${east}`;

  // 2. Monta filtros Overpass de acordo com o segmento
  const segNorm = normalizarTexto(segmento);
  const matchedFilters = new Set<string>();
  for (const group of SEGMENTO_OSM_TAGS) {
    if (group.keywords.some(k => segNorm.includes(normalizarTexto(k)))) {
      group.filters.forEach(f => matchedFilters.add(f));
    }
  }

  // Regex seguro para nome do estabelecimento
  const safeNameRegex = segmento.replace(/[.*+?^${}()|[\]\\"]/g, '').trim();
  const queryParts: string[] = [];

  if (matchedFilters.size > 0) {
    for (const f of matchedFilters) {
      queryParts.push(`node[${f}]["name"](${bbox});`);
      queryParts.push(`way[${f}]["name"](${bbox});`);
    }
  }
  if (safeNameRegex.length >= 3) {
    queryParts.push(`node["name"~"${safeNameRegex}",i](${bbox});`);
    queryParts.push(`way["name"~"${safeNameRegex}",i](${bbox});`);
  }
  if (queryParts.length === 0) {
    queryParts.push(`node["shop"]["name"](${bbox});`);
    queryParts.push(`node["office"]["name"](${bbox});`);
    queryParts.push(`node["amenity"~"restaurant|clinic|pharmacy|dentist"]["name"](${bbox});`);
  }

  const overpassQuery = `[out:json][timeout:25];(${queryParts.join('')});out center ${Math.min(120, Math.max(20, limite * 2))};`;

  const overRes = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'PrivilegeConsultoriaLeadFinder/1.0',
    },
    body: `data=${encodeURIComponent(overpassQuery)}`,
  });

  if (!overRes.ok) {
    throw new Error('Serviço de mapas OpenStreetMap temporariamente sobrecarregado. Tente novamente em instantes.');
  }

  const overData = await overRes.json();
  const elements: any[] = overData.elements || [];
  const seen = new Set<string>();
  const now = new Date().toISOString();
  const results: LeadGarimpado[] = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const nome = (tags.name || '').trim();
    if (!nome) continue;

    const key = normalizarTexto(nome);
    if (seen.has(key)) continue;
    seen.add(key);

    const rua = tags['addr:street'] || '';
    const num = tags['addr:housenumber'] || '';
    const bairro = tags['addr:suburb'] || tags['addr:neighbourhood'] || '';
    const cidadeTag = tags['addr:city'] || cidade;
    const endereco = [rua ? `${rua}${num ? `, ${num}` : ''}` : '', bairro, `${cidadeTag}/${estado}`]
      .filter(Boolean)
      .join(' · ');

    const telefone = tags['contact:phone'] || tags.phone || tags['contact:mobile'] || '';
    const whatsappRaw = tags['contact:whatsapp'] || telefone;
    const whatsapp = limparTelefone(whatsappRaw);
    const email = tags['contact:email'] || tags.email || '';
    const website = tags['contact:website'] || tags.website || tags.url || '';
    const instagramRaw = tags['contact:instagram'] || tags.instagram || '';
    const instagram = instagramRaw
      ? instagramRaw.startsWith('http')
        ? instagramRaw
        : `https://instagram.com/${instagramRaw.replace(/^@/, '')}`
      : '';

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const categoria =
      tags.shop || tags.office || tags.amenity || tags.healthcare || tags.craft || tags.tourism || segmento;

    const lead: LeadGarimpado = {
      id: `osm_${el.type}_${el.id}`,
      nome,
      categoria: String(categoria).replace(/_/g, ' '),
      cidade: cidadeTag,
      estado,
      endereco,
      telefone,
      whatsapp,
      email,
      website,
      instagram,
      cnpj: '',
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nome} ${cidadeTag} ${estado}`)}`,
      latitude: lat,
      longitude: lon,
      fonte: 'osm',
      score: 0,
      status: 'novo',
      criadoEm: now,
    };
    lead.score = calcularScoreLead(lead);
    results.push(lead);
    if (results.length >= limite) break;
  }

  // Prioriza quem tem telefone/site/email no topo
  results.sort((a, b) => b.score - a.score);
  return results;
}

async function consultarCnpjUnitario(cnpjRaw: string): Promise<LeadGarimpado | null> {
  const cnpjLimpo = cnpjRaw.replace(/\D/g, '');
  if (cnpjLimpo.length !== 14) return null;
  const now = new Date().toISOString();

  // Tentativa 1: BrasilAPI
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      headers: { 'User-Agent': 'PrivilegeConsultoria/1.0' },
    });
    if (res.ok) {
      const d = await res.json();
      const tel = d.ddd_telefone_1 || d.ddd_telefone_2 || '';
      const nome = d.nome_fantasia || d.razao_social || cnpjLimpo;
      const cidade = d.municipio || '';
      const estado = d.uf || '';
      const socios = Array.isArray(d.qsa)
        ? d.qsa.map((s: any) => s.nome_socio).filter(Boolean).slice(0, 4).join(', ')
        : '';
      const lead: LeadGarimpado = {
        id: `cnpj_${cnpjLimpo}`,
        nome,
        categoria: d.cnae_fiscal_descricao || 'Empresa',
        cidade,
        estado,
        endereco: [
          d.logradouro ? `${d.logradouro}${d.numero ? `, ${d.numero}` : ''}` : '',
          d.bairro,
          cidade && estado ? `${cidade}/${estado}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        telefone: tel,
        whatsapp: limparTelefone(tel),
        email: d.email && d.email !== 'null' ? String(d.email).toLowerCase() : '',
        website: '',
        instagram: '',
        cnpj: cnpjLimpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'),
        porte: d.porte || '',
        capitalSocial: typeof d.capital_social === 'number' ? d.capital_social : undefined,
        socios,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nome} ${cidade} ${estado}`)}`,
        fonte: 'cnpj',
        score: 0,
        status: 'novo',
        notas: d.razao_social ? `Razão Social: ${d.razao_social} · Situação: ${d.descricao_situacao_cadastral || 'ATIVA'}` : '',
        criadoEm: now,
      };
      lead.score = calcularScoreLead(lead);
      return lead;
    }
  } catch {}

  // Tentativa 2: publica.cnpj.ws
  try {
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`);
    if (res.ok) {
      const d = await res.json();
      const est = d.estabelecimento || {};
      const tel = est.ddd1 && est.telefone1 ? `${est.ddd1}${est.telefone1}` : '';
      const nome = est.nome_fantasia || d.razao_social || cnpjLimpo;
      const cidade = est.cidade?.nome || '';
      const estado = est.estado?.sigla || '';
      const socios = Array.isArray(d.socios)
        ? d.socios.map((s: any) => s.nome).filter(Boolean).slice(0, 4).join(', ')
        : '';
      const lead: LeadGarimpado = {
        id: `cnpj_${cnpjLimpo}`,
        nome,
        categoria: est.atividade_principal?.descricao || 'Empresa',
        cidade,
        estado,
        endereco: [
          est.logradouro ? `${est.logradouro}${est.numero ? `, ${est.numero}` : ''}` : '',
          est.bairro,
          cidade && estado ? `${cidade}/${estado}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        telefone: tel,
        whatsapp: limparTelefone(tel),
        email: est.email ? String(est.email).toLowerCase() : '',
        website: '',
        instagram: '',
        cnpj: cnpjLimpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'),
        porte: d.porte?.descricao || '',
        capitalSocial: d.capital_social ? Number(d.capital_social) : undefined,
        socios,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nome} ${cidade} ${estado}`)}`,
        fonte: 'cnpj',
        score: 0,
        status: 'novo',
        notas: `Razão Social: ${d.razao_social || ''} · Situação: ${est.situacao_cadastral || ''}`,
        criadoEm: now,
      };
      lead.score = calcularScoreLead(lead);
      return lead;
    }
  } catch {}

  return null;
}

async function qualificarLeadComIA(lead: LeadGarimpado, contextoOferta: string) {
  const oferta =
    contextoOferta?.trim() ||
    'Privilege Contabilidade & Consultoria (BPO Financeiro, Precificação Real, Margem de Lucro e Planejamento Tributário em Francisco Beltrão/PR e região)';

  const prompt = `Você é um especialista sênior em prospecção B2B consultiva.
Oferta da nossa empresa: ${oferta}
Dados do lead:
- Empresa: ${lead.nome}
- Segmento/Categoria: ${lead.categoria}
- Cidade/UF: ${lead.cidade}/${lead.estado}
- Porte: ${lead.porte || 'Não informado'}
- Sócios: ${lead.socios || 'Não informado'}
- Website: ${lead.website || 'Não informado'}
- Nota Google: ${lead.nota ? `${lead.nota} (${lead.avaliacoes || 0} avaliações)` : 'Não informado'}

Responda APENAS em JSON válido com as chaves:
{
  "score": <numero de 0 a 100>,
  "diagnostico": "<2 frases curtas sobre a provável dor financeira/tributária/gestão desse tipo de empresa>",
  "scriptWhatsapp": "<mensagem curta, natural e consultiva de primeira abordagem no WhatsApp, sem parecer robô, convidando para um Raio-X rápido>",
  "assuntoEmail": "<assunto curto e persuasivo de cold email>",
  "corpoEmail": "<corpo de e-mail B2B objetivo com 3 parágrafos curtos>"
}`;

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.5 },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = JSON.parse(raw);
        if (parsed.diagnostico && parsed.scriptWhatsapp) {
          return {
            score: Math.min(100, Math.max(10, Number(parsed.score) || lead.score)),
            diagnostico: String(parsed.diagnostico),
            scriptWhatsapp: String(parsed.scriptWhatsapp),
            assuntoEmail: String(parsed.assuntoEmail || `Diagnóstico Financeiro & Tributário — ${lead.nome}`),
            corpoEmail: String(parsed.corpoEmail || ''),
          };
        }
      }
    } catch {}
  }

  // Motor consultivo local inteligente (fallback imediato sem dependência de chave externa)
  const primeiroSocio = lead.socios ? lead.socios.split(',')[0].split(' ')[0] : '';
  const saudacao = primeiroSocio ? `Olá, ${primeiroSocio}` : `Olá, pessoal da ${lead.nome}`;
  const scoreFinal = Math.min(100, Math.max(lead.score, 65));

  return {
    score: scoreFinal,
    diagnostico: `Empresas do segmento de ${lead.categoria || 'serviços/comércio'} em ${lead.cidade || 'sua região'} frequentemente vendem bem, mas sofrem com vazamento de margem por formação de preço imprecisa, taxas financeiras ocultas e carga tributária acima do ideal.`,
    scriptWhatsapp: `${saudacao}! Tudo bem? Aqui é da equipe do Mauricio na Privilege Consultoria.\n\nAcompanhamos empresas do ramo de ${lead.categoria || 'vocês'} em ${lead.cidade || 'sua região'} e temos visto muitos empresários faturando bem, mas sem ver o lucro sobrar no caixa por conta de impostos e precificação.\n\nO Mauricio separou 2 horários esta semana para um Raio-X rápido e gratuito de margem e tributos. Faz sentido conversarmos 15 minutinhos?`,
    assuntoEmail: `Raio-X de Lucro & Impostos para a ${lead.nome}`,
    corpoEmail: `${saudacao},\n\nNa Privilege Contabilidade & Consultoria ajudamos empresas de ${lead.categoria || 'gestão empresarial'} em ${lead.cidade || 'sua região'} a estancar vazamentos de caixa através de precificação real, BPO Financeiro e planejamento tributário.\n\nMuitos gestores só percebem que estão pagando imposto a mais ou vendendo com margem apertada no fechamento do ano. Nossa proposta é fazer um Raio-X rápido e sem compromisso da estrutura atual da ${lead.nome}.\n\nPodemos agendar uma conversa objetiva de 15 minutos esta semana? Responda este e-mail ou chame no WhatsApp (46) 99980-0010.`,
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'buscar_mapa') {
      const segmento = String(body.segmento || '').trim();
      const cidade = String(body.cidade || '').trim();
      const estado = String(body.estado || 'PR').trim().toUpperCase();
      const limite = Math.min(60, Math.max(5, Number(body.limite) || 25));
      const enriquecerSites = Boolean(body.enriquecerSites);
      const googleKey = String(body.googlePlacesApiKey || process.env.GOOGLE_PLACES_API_KEY || '').trim();

      if (!segmento || !cidade) {
        return NextResponse.json({ error: 'Informe o segmento e a cidade para garimpar.' }, { status: 400 });
      }

      let leads: LeadGarimpado[] = [];
      let motorUsado = 'OpenStreetMap (Gratuito)';

      if (googleKey) {
        leads = await buscarViaGooglePlaces(segmento, cidade, estado, limite, googleKey);
        motorUsado = 'Google Maps Places API';
      } else {
        leads = await buscarViaOpenStreetMap(segmento, cidade, estado, limite);
      }

      // Enriquecimento automático dos sites encontrados (até 12 em paralelo para manter resposta rápida)
      if (enriquecerSites && leads.length > 0) {
        const comSite = leads.filter(l => l.website).slice(0, 12);
        await Promise.all(
          comSite.map(async lead => {
            const extra = await extrairDadosDoSite(lead.website);
            if (extra.email && !lead.email) lead.email = extra.email;
            if (extra.whatsapp && !lead.whatsapp) lead.whatsapp = extra.whatsapp;
            if (extra.instagram && !lead.instagram) lead.instagram = extra.instagram;
            if (extra.cnpj && !lead.cnpj) lead.cnpj = extra.cnpj;
            lead.score = calcularScoreLead(lead);
          })
        );
        leads.sort((a, b) => b.score - a.score);
      }

      return NextResponse.json({
        ok: true,
        motor: motorUsado,
        total: leads.length,
        leads,
      });
    }

    if (action === 'enriquecer_site') {
      const website = String(body.website || '').trim();
      if (!website) {
        return NextResponse.json({ error: 'Website não informado.' }, { status: 400 });
      }
      const extra = await extrairDadosDoSite(website);
      return NextResponse.json({ ok: true, extra });
    }

    if (action === 'enriquecer_cnpj') {
      const cnpjsRaw: string[] = Array.isArray(body.cnpjs)
        ? body.cnpjs
        : String(body.cnpjs || '')
            .split(/[\n,;]+/)
            .map(s => s.trim())
            .filter(Boolean);

      const unicos = Array.from(new Set(cnpjsRaw.map(c => c.replace(/\D/g, '')).filter(c => c.length === 14))).slice(0, 20);
      if (unicos.length === 0) {
        return NextResponse.json({ error: 'Nenhum CNPJ válido (14 dígitos) informado.' }, { status: 400 });
      }

      const leads: LeadGarimpado[] = [];
      const falhas: string[] = [];

      for (const cnpj of unicos) {
        const res = await consultarCnpjUnitario(cnpj);
        if (res) {
          leads.push(res);
        } else {
          falhas.push(cnpj);
        }
        await new Promise(r => setTimeout(r, 250));
      }

      return NextResponse.json({
        ok: true,
        total: leads.length,
        falhas,
        leads,
      });
    }

    if (action === 'qualificar_ia') {
      const lead = body.lead as LeadGarimpado;
      if (!lead?.nome) {
        return NextResponse.json({ error: 'Dados do lead obrigatórios.' }, { status: 400 });
      }
      const resultado = await qualificarLeadComIA(lead, String(body.contextoOferta || ''));
      return NextResponse.json({ ok: true, resultado });
    }

    return NextResponse.json({ error: 'Ação não reconhecida.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro no Garimpador de Leads' }, { status: 500 });
  }
}
