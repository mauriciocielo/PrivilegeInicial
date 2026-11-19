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
  linkedin?: string;
  cnpj: string;
  porte?: string;
  capitalSocial?: number;
  socios?: string;
  regimeTributario?: string;
  dataAbertura?: string;
  tipoTelefone?: 'celular' | 'fixo' | 'desconhecido';
  icpTier?: 'ouro' | 'prata' | 'bronze';
  lapidadoEm?: string;
  nota?: number;
  avaliacoes?: number;
  mapsUrl: string;
  latitude?: number;
  longitude?: number;
  fonte: 'osm' | 'google_places' | 'google_maps' | 'cnpj' | 'gosom_import';
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

function detectarTipoTelefone(tel: string): 'celular' | 'fixo' | 'desconhecido' {
  const digits = limparTelefone(tel);
  if (!digits) return 'desconhecido';
  // Brasil: 55 + DD (2) + 9 + 8 dígitos = 13 dígitos
  if (digits.startsWith('55') && digits.length === 13 && digits[4] === '9') return 'celular';
  if (digits.startsWith('55') && digits.length === 12) return 'fixo';
  return 'desconhecido';
}

function calcularIcpTier(score: number): 'ouro' | 'prata' | 'bronze' {
  if (score >= 80) return 'ouro';
  if (score >= 60) return 'prata';
  return 'bronze';
}

function calcularScoreLead(lead: Partial<LeadGarimpado>): number {
  let score = 15;
  const tipoTel = detectarTipoTelefone(lead.whatsapp || lead.telefone || '');
  if (tipoTel === 'celular') score += 26;
  else if (lead.telefone || lead.whatsapp) score += 16;

  if (lead.email) score += 18;
  if (lead.website) score += 10;
  if (lead.instagram || lead.linkedin) score += 5;
  if (lead.cnpj) score += 8;
  if (lead.socios) score += 8;
  if (lead.porte && !normalizarTexto(lead.porte).includes('mei')) score += 5;
  if (lead.capitalSocial && lead.capitalSocial >= 50000) score += 5;
  if (lead.nota && lead.nota >= 4.0) score += 5;
  if (lead.avaliacoes && lead.avaliacoes >= 20) score += 5;
  return Math.min(100, Math.max(10, score));
}

function extrairContatosDeHtml(html: string): {
  email?: string;
  whatsapp?: string;
  instagram?: string;
  linkedin?: string;
  cnpj?: string;
} {
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

  const waMatch = html.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\d{10,15})/i);
  const whatsapp = waMatch ? limparTelefone(waMatch[1]) : undefined;

  const igMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]{2,35})\/?/i);
  const igUser = igMatch?.[1]?.toLowerCase();
  const instagram =
    igMatch && igUser && !['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'share'].includes(igUser)
      ? `https://instagram.com/${igMatch[1]}`
      : undefined;

  const liMatch = html.match(/https?:\/\/(?:[a-z]{2}\.)?linkedin\.com\/company\/([a-zA-Z0-9._-]{2,50})\/?/i);
  const linkedin = liMatch ? `https://linkedin.com/company/${liMatch[1]}` : undefined;

  const cnpjMatch = html.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
  const cnpj = cnpjMatch ? cnpjMatch[0] : undefined;

  return {
    email: emailFiltrado,
    whatsapp,
    instagram,
    linkedin,
    cnpj,
  };
}

async function extrairDadosDoSite(urlRaw: string, profundo = false): Promise<{
  email?: string;
  whatsapp?: string;
  instagram?: string;
  linkedin?: string;
  cnpj?: string;
}> {
  if (!urlRaw) return {};
  const url = /^https?:\/\//i.test(urlRaw) ? urlRaw : `https://${urlRaw}`;

  const fetchHtml = async (target: string, timeoutMs: number) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(target, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });
      if (!res.ok) return '';
      return (await res.text()).slice(0, 180000);
    } catch {
      return '';
    } finally {
      clearTimeout(timer);
    }
  };

  const homeHtml = await fetchHtml(url, 4500);
  const acumulado = homeHtml ? extrairContatosDeHtml(homeHtml) : {};

  // No modo profundo (Lapidação), varre também /contato, /fale-conosco e /sobre se ainda faltar e-mail, CNPJ ou WhatsApp
  if (profundo && (!acumulado.email || !acumulado.cnpj || !acumulado.whatsapp)) {
    try {
      const origin = new URL(url).origin;
      const subpaths = ['/contato', '/fale-conosco', '/sobre', '/quem-somos'];
      const htmls = await Promise.all(subpaths.map(p => fetchHtml(`${origin}${p}`, 3500)));
      for (const h of htmls) {
        if (!h) continue;
        const extra = extrairContatosDeHtml(h);
        if (!acumulado.email && extra.email) acumulado.email = extra.email;
        if (!acumulado.whatsapp && extra.whatsapp) acumulado.whatsapp = extra.whatsapp;
        if (!acumulado.instagram && extra.instagram) acumulado.instagram = extra.instagram;
        if (!acumulado.linkedin && extra.linkedin) acumulado.linkedin = extra.linkedin;
        if (!acumulado.cnpj && extra.cnpj) acumulado.cnpj = extra.cnpj;
      }
    } catch {}
  }

  return acumulado;
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

async function fetchComTimeout(url: string, options: RequestInit = {}, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function buscarViaNominatimPOI(
  segmento: string,
  cidade: string,
  estado: string,
  limite: number
): Promise<LeadGarimpado[]> {
  const q = encodeURIComponent(`${segmento} ${cidade} ${estado} Brasil`);
  const res = await fetchComTimeout(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&addressdetails=1&extratags=1&namedetails=1&limit=${Math.min(40, limite)}`,
    {
      headers: {
        'User-Agent': 'PrivilegeConsultoriaLeadFinder/1.0 (contato@privilegecontabilidade.cnt.br)',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    },
    10000
  );
  if (!res.ok) return [];
  const list: any[] = await res.json();
  const now = new Date().toISOString();
  const seen = new Set<string>();
  const results: LeadGarimpado[] = [];

  for (const item of list) {
    const extra = item.extratags || {};
    const addr = item.address || {};
    const nome = (
      item.name ||
      item.namedetails?.name ||
      (item.display_name ? String(item.display_name).split(',')[0] : '')
    ).trim();
    if (!nome) continue;
    const key = normalizarTexto(nome);
    if (seen.has(key)) continue;
    seen.add(key);

    const cidadeTag = addr.city || addr.town || addr.municipality || cidade;
    const rua = addr.road || '';
    const num = addr.house_number || '';
    const bairro = addr.suburb || addr.neighbourhood || '';
    const endereco = [rua ? `${rua}${num ? `, ${num}` : ''}` : '', bairro, `${cidadeTag}/${estado}`]
      .filter(Boolean)
      .join(' · ');

    const telefone = extra['contact:phone'] || extra.phone || extra['contact:mobile'] || '';
    const whatsapp = limparTelefone(extra['contact:whatsapp'] || telefone);
    const email = extra['contact:email'] || extra.email || '';
    const website = extra['contact:website'] || extra.website || extra.url || '';
    const igRaw = extra['contact:instagram'] || extra.instagram || '';
    const instagram = igRaw
      ? igRaw.startsWith('http')
        ? igRaw
        : `https://instagram.com/${igRaw.replace(/^@/, '')}`
      : '';

    const lead: LeadGarimpado = {
      id: `nom_${item.place_id || Date.now()}_${results.length}`,
      nome,
      categoria: String(item.type || item.class || segmento).replace(/_/g, ' '),
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
      latitude: item.lat ? Number(item.lat) : undefined,
      longitude: item.lon ? Number(item.lon) : undefined,
      fonte: 'osm',
      score: 0,
      status: 'novo',
      criadoEm: now,
    };
    lead.score = calcularScoreLead(lead);
    results.push(lead);
    if (results.length >= limite) break;
  }

  return results;
}

async function buscarViaPhoton(
  segmento: string,
  cidade: string,
  estado: string,
  limite: number
): Promise<LeadGarimpado[]> {
  const q = encodeURIComponent(`${segmento} ${cidade} ${estado}`);
  const res = await fetchComTimeout(
    `https://photon.komoot.io/api/?q=${q}&limit=${Math.min(35, limite)}`,
    { headers: { 'User-Agent': 'PrivilegeConsultoriaLeadFinder/1.0' } },
    9000
  );
  if (!res.ok) return [];
  const data = await res.json();
  const features: any[] = data?.features || [];
  const now = new Date().toISOString();
  const seen = new Set<string>();
  const results: LeadGarimpado[] = [];

  for (const f of features) {
    const p = f.properties || {};
    const nome = (p.name || '').trim();
    if (!nome) continue;
    // Filtra para manter no Brasil / cidade aproximada
    if (p.countrycode && String(p.countrycode).toUpperCase() !== 'BR') continue;
    const key = normalizarTexto(nome);
    if (seen.has(key)) continue;
    seen.add(key);

    const cidadeTag = p.city || p.county || cidade;
    const endereco = [
      p.street ? `${p.street}${p.housenumber ? `, ${p.housenumber}` : ''}` : '',
      p.district || '',
      `${cidadeTag}/${estado}`,
    ]
      .filter(Boolean)
      .join(' · ');

    const coords = f.geometry?.coordinates || [];
    const lead: LeadGarimpado = {
      id: `pho_${p.osm_id || Date.now()}_${results.length}`,
      nome,
      categoria: String(p.osm_value || segmento).replace(/_/g, ' '),
      cidade: cidadeTag,
      estado,
      endereco,
      telefone: '',
      whatsapp: '',
      email: '',
      website: '',
      instagram: '',
      cnpj: '',
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nome} ${cidadeTag} ${estado}`)}`,
      latitude: typeof coords[1] === 'number' ? coords[1] : undefined,
      longitude: typeof coords[0] === 'number' ? coords[0] : undefined,
      fonte: 'osm',
      score: 0,
      status: 'novo',
      criadoEm: now,
    };
    lead.score = calcularScoreLead(lead);
    results.push(lead);
    if (results.length >= limite) break;
  }

  return results;
}

async function buscarViaGoogleMapsDireto(
  segmento: string,
  cidade: string,
  estado: string,
  limite: number,
  coords?: { lat: number; lon: number }
): Promise<LeadGarimpado[]> {
  try {
    const lat = coords?.lat ?? -26.0811;
    const lon = coords?.lon ?? -53.055;
    const query = `${segmento} em ${cidade} ${estado}`;
    const count = Math.min(20, Math.max(10, limite));

    const url =
      `https://www.google.com/search?tbm=map&authuser=0&hl=pt-BR&gl=br` +
      `&pb=!4m12!1m3!1d45000!2d${lon}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!7i${count}!10b1` +
      `&q=${encodeURIComponent(query)}`;

    const res = await fetchComTimeout(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      },
      10000
    );

    if (!res.ok) return [];
    let raw = await res.text();
    // Remove prefixo anti-XSSI do Google Maps: )]}'
    raw = raw.replace(/^\)\]\}'\s*/, '');
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }

    // O payload do tbm=map vem em parsed[0][1] ou dentro de uma string JSON em parsed.d
    let root: any = parsed;
    if (parsed && typeof parsed.d === 'string') {
      try {
        root = JSON.parse(parsed.d.replace(/^\)\]\}'\s*/, ''));
      } catch {
        return [];
      }
    }

    const listaBruta: any[] = Array.isArray(root?.[0]?.[1]) ? root[0][1] : [];
    const now = new Date().toISOString();
    const seen = new Set<string>();
    const results: LeadGarimpado[] = [];

    for (const entry of listaBruta) {
      const place = Array.isArray(entry) ? entry[14] : null;
      if (!Array.isArray(place)) continue;

      const nome = typeof place[11] === 'string' ? place[11].trim() : '';
      if (!nome) continue;
      const key = normalizarTexto(nome);
      if (seen.has(key)) continue;
      seen.add(key);

      // Endereço
      const endereco =
        (typeof place[39] === 'string' && place[39]) ||
        (typeof place[18] === 'string' && place[18]) ||
        (Array.isArray(place[2]) ? place[2].filter((x: any) => typeof x === 'string').join(', ') : '') ||
        `${cidade}/${estado}`;

      // Categoria
      const categoria =
        (Array.isArray(place[13]) && typeof place[13][0] === 'string' ? place[13][0] : '') || segmento;

      // Nota e Avaliações
      const nota = Array.isArray(place[4]) && typeof place[4][7] === 'number' ? place[4][7] : undefined;
      const avaliacoes = Array.isArray(place[4]) && typeof place[4][8] === 'number' ? place[4][8] : undefined;

      // Website
      const website =
        Array.isArray(place[7]) && typeof place[7][0] === 'string' ? place[7][0].trim() : '';

      // Telefone (varre sub-arrays conhecidos de telefone do Maps)
      let telefone = '';
      if (Array.isArray(place[178])) {
        const flat = JSON.stringify(place[178]);
        const telMatch = flat.match(/(\+55\s?)?\(?\d{2}\)?\s?\d{4,5}-?\d{4}/);
        if (telMatch) telefone = telMatch[0];
      }
      if (!telefone) {
        const flatAll = JSON.stringify(place);
        const telMatch = flatAll.match(/\(?\d{2}\)\s?\d{4,5}-\d{4}/);
        if (telMatch) telefone = telMatch[0];
      }

      const latP = Array.isArray(place[9]) && typeof place[9][2] === 'number' ? place[9][2] : undefined;
      const lonP = Array.isArray(place[9]) && typeof place[9][3] === 'number' ? place[9][3] : undefined;
      const placeId = typeof place[78] === 'string' ? place[78] : `${Date.now()}_${results.length}`;

      const lead: LeadGarimpado = {
        id: `gm_${placeId}`,
        nome,
        categoria,
        cidade,
        estado,
        endereco,
        telefone,
        whatsapp: limparTelefone(telefone),
        email: '',
        website,
        instagram: '',
        cnpj: '',
        nota,
        avaliacoes,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nome} ${cidade} ${estado}`)}`,
        latitude: latP,
        longitude: lonP,
        fonte: 'google_maps',
        score: 0,
        status: 'novo',
        criadoEm: now,
      };
      lead.score = calcularScoreLead(lead);
      results.push(lead);
      if (results.length >= limite) break;
    }

    return results;
  } catch {
    return [];
  }
}

async function geocodificarCidade(cidade: string, estado: string): Promise<{ lat: number; lon: number } | undefined> {
  try {
    const qGeo = encodeURIComponent(`${cidade}, ${estado}, Brazil`);
    const geoRes = await fetchComTimeout(
      `https://nominatim.openstreetmap.org/search?q=${qGeo}&format=json&limit=1`,
      { headers: { 'User-Agent': 'PrivilegeConsultoriaLeadFinder/1.0' } },
      6000
    );
    if (geoRes.ok) {
      const list: any[] = await geoRes.json();
      if (list[0]?.lat && list[0]?.lon) {
        return { lat: Number(list[0].lat), lon: Number(list[0].lon) };
      }
    }
  } catch {}
  return undefined;
}

async function buscarViaOpenStreetMap(
  segmento: string,
  cidade: string,
  estado: string,
  limite: number
): Promise<{ leads: LeadGarimpado[]; motor: string }> {
  // 1. Geocodifica a cidade via Nominatim
  let bbox: string | null = null;
  try {
    const qGeo = encodeURIComponent(`${cidade}, ${estado}, Brazil`);
    const geoRes = await fetchComTimeout(
      `https://nominatim.openstreetmap.org/search?q=${qGeo}&format=json&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'PrivilegeConsultoriaLeadFinder/1.0 (contato@privilegecontabilidade.cnt.br)',
        },
      },
      8000
    );
    if (geoRes.ok) {
      const geoList: any[] = await geoRes.json();
      if (geoList.length && geoList[0].boundingbox) {
        const [south, north, west, east] = geoList[0].boundingbox.map(Number);
        bbox = `${south},${west},${north},${east}`;
      }
    }
  } catch {}

  // 2. Tier 1: Tenta 3 servidores Overpass diferentes com query leve (nwr) e timeout curto
  if (bbox) {
    const segNorm = normalizarTexto(segmento);
    const matchedFilters = new Set<string>();
    for (const group of SEGMENTO_OSM_TAGS) {
      if (group.keywords.some(k => segNorm.includes(normalizarTexto(k)))) {
        group.filters.forEach(f => matchedFilters.add(f));
      }
    }

    const safeNameRegex = segmento.replace(/[.*+?^${}()|[\]\\"]/g, '').trim();
    const queryParts: string[] = [];

    if (matchedFilters.size > 0) {
      for (const f of matchedFilters) {
        queryParts.push(`nwr[${f}]["name"](${bbox});`);
      }
    } else if (safeNameRegex.length >= 3) {
      queryParts.push(`nwr["name"~"${safeNameRegex}",i](${bbox});`);
    } else {
      queryParts.push(`node["shop"]["name"](${bbox});`);
      queryParts.push(`node["office"]["name"](${bbox});`);
    }

    const overpassQuery = `[out:json][timeout:14];(${queryParts.join('')});out center ${Math.min(100, Math.max(25, limite * 2))};`;

    const mirrors = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    ];

    for (const mirror of mirrors) {
      try {
        const overRes = await fetchComTimeout(
          mirror,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'PrivilegeConsultoriaLeadFinder/1.0',
            },
            body: `data=${encodeURIComponent(overpassQuery)}`,
          },
          11000
        );

        if (!overRes.ok) continue;

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

        if (results.length > 0) {
          results.sort((a, b) => b.score - a.score);
          return { leads: results, motor: 'OpenStreetMap Overpass (Gratuito)' };
        }
      } catch {
        // Tenta próximo espelho Overpass
      }
    }
  }

  // 3. Tier 2: Fallback automático via Nominatim POI Search
  try {
    const nomLeads = await buscarViaNominatimPOI(segmento, cidade, estado, limite);
    if (nomLeads.length > 0) {
      nomLeads.sort((a, b) => b.score - a.score);
      return { leads: nomLeads, motor: 'OpenStreetMap Nominatim (Fallback)' };
    }
  } catch {}

  // 4. Tier 3: Fallback automático via Photon Komoot
  try {
    const phoLeads = await buscarViaPhoton(segmento, cidade, estado, limite);
    if (phoLeads.length > 0) {
      phoLeads.sort((a, b) => b.score - a.score);
      return { leads: phoLeads, motor: 'Photon Maps (Fallback)' };
    }
  } catch {}

  return { leads: [], motor: 'OpenStreetMap' };
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
      const fonteBusca = String(body.fonteBusca || 'combinado'); // 'combinado' | 'google_maps' | 'osm'

      if (!segmento || !cidade) {
        return NextResponse.json({ error: 'Informe o segmento e a cidade para garimpar.' }, { status: 400 });
      }

      let leads: LeadGarimpado[] = [];
      const motoresUsados: string[] = [];

      if (googleKey && fonteBusca !== 'osm') {
        const gpLeads = await buscarViaGooglePlaces(segmento, cidade, estado, limite, googleKey);
        leads.push(...gpLeads);
        if (gpLeads.length > 0) motoresUsados.push('Google Maps Places API');
      } else if (fonteBusca !== 'osm') {
        const coords = await geocodificarCidade(cidade, estado);
        const gmLeads = await buscarViaGoogleMapsDireto(segmento, cidade, estado, limite, coords);
        leads.push(...gmLeads);
        if (gmLeads.length > 0) motoresUsados.push('Google Maps');
      }

      // Complementa com OpenStreetMap quando modo combinado ou se Google Maps retornou poucos resultados
      if (fonteBusca === 'osm' || (fonteBusca === 'combinado' && leads.length < limite)) {
        const osmRes = await buscarViaOpenStreetMap(segmento, cidade, estado, limite);
        if (osmRes.leads.length > 0) {
          const vistos = new Set(leads.map(l => normalizarTexto(l.nome)));
          for (const item of osmRes.leads) {
            const k = normalizarTexto(item.nome);
            if (!vistos.has(k)) {
              vistos.add(k);
              leads.push(item);
            }
            if (leads.length >= limite) break;
          }
          motoresUsados.push(osmRes.motor);
        }
      }

      const motorUsado = motoresUsados.length > 0 ? motoresUsados.join(' + ') : 'Google Maps + OpenStreetMap';

      // Enriquecimento automático dos sites encontrados (até 12 em paralelo para manter resposta rápida)
      if (enriquecerSites && leads.length > 0) {
        const comSite = leads.filter(l => l.website).slice(0, 12);
        await Promise.all(
          comSite.map(async lead => {
            const extra = await extrairDadosDoSite(lead.website, false);
            if (extra.email && !lead.email) lead.email = extra.email;
            if (extra.whatsapp && !lead.whatsapp) lead.whatsapp = extra.whatsapp;
            if (extra.instagram && !lead.instagram) lead.instagram = extra.instagram;
            if (extra.linkedin && !lead.linkedin) lead.linkedin = extra.linkedin;
            if (extra.cnpj && !lead.cnpj) lead.cnpj = extra.cnpj;
          })
        );
      }

      // Classifica telefone (Celular vs Fixo), Score e ICP Tier em todos os resultados
      for (const lead of leads) {
        lead.tipoTelefone = detectarTipoTelefone(lead.whatsapp || lead.telefone || '');
        lead.score = calcularScoreLead(lead);
        lead.icpTier = calcularIcpTier(lead.score);
      }
      leads.sort((a, b) => b.score - a.score);

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
      const extra = await extrairDadosDoSite(website, true);
      return NextResponse.json({ ok: true, extra });
    }

    if (action === 'lapidar_lead') {
      const leadOriginal = body.lead as LeadGarimpado;
      if (!leadOriginal?.nome) {
        return NextResponse.json({ error: 'Lead inválido.' }, { status: 400 });
      }

      const lapidado: LeadGarimpado = { ...leadOriginal };

      // 1. Varredura profunda do site (Home + /contato + /fale-conosco + /sobre)
      if (lapidado.website) {
        const extraSite = await extrairDadosDoSite(lapidado.website, true);
        if (extraSite.email && !lapidado.email) lapidado.email = extraSite.email;
        if (extraSite.whatsapp && !lapidado.whatsapp) lapidado.whatsapp = extraSite.whatsapp;
        if (extraSite.instagram && !lapidado.instagram) lapidado.instagram = extraSite.instagram;
        if (extraSite.linkedin && !lapidado.linkedin) lapidado.linkedin = extraSite.linkedin;
        if (extraSite.cnpj && !lapidado.cnpj) lapidado.cnpj = extraSite.cnpj;
      }

      // 2. Se possui ou descobriu CNPJ, enriquece automaticamente na Receita Federal (Sócios, Porte, Capital, Regime)
      if (lapidado.cnpj && (!lapidado.socios || !lapidado.porte)) {
        const dadosCnpj = await consultarCnpjUnitario(lapidado.cnpj);
        if (dadosCnpj) {
          if (!lapidado.socios && dadosCnpj.socios) lapidado.socios = dadosCnpj.socios;
          if (!lapidado.porte && dadosCnpj.porte) lapidado.porte = dadosCnpj.porte;
          if (!lapidado.capitalSocial && dadosCnpj.capitalSocial) lapidado.capitalSocial = dadosCnpj.capitalSocial;
          if (!lapidado.email && dadosCnpj.email) lapidado.email = dadosCnpj.email;
          if (!lapidado.telefone && dadosCnpj.telefone) lapidado.telefone = dadosCnpj.telefone;
          if (!lapidado.whatsapp && dadosCnpj.whatsapp) lapidado.whatsapp = dadosCnpj.whatsapp;
          if (dadosCnpj.notas && !lapidado.notas) lapidado.notas = dadosCnpj.notas;
        }
      }

      // 3. Classifica tipo de telefone (Celular/WhatsApp vs Fixo) e recalcula Score ICP
      lapidado.tipoTelefone = detectarTipoTelefone(lapidado.whatsapp || lapidado.telefone || '');
      lapidado.score = calcularScoreLead(lapidado);
      lapidado.icpTier = calcularIcpTier(lapidado.score);
      lapidado.lapidadoEm = new Date().toISOString();

      return NextResponse.json({ ok: true, lead: lapidado });
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
