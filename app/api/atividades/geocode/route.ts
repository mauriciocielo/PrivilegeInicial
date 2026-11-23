import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/atividades/geocode?lat=...&lng=...  (reverse geocoding: coordenadas -> endereço)
 * GET /api/atividades/geocode?q=...            (busca endereço/local -> endereço + lat/lng)
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const q = (searchParams.get('q') || '').trim();

  try {
    if (lat && lng) {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=pt-BR`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'PrivilegeContabilidadeERP/1.0 (contato@privilegecontabilidade.com.br)' },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) {
        return NextResponse.json({ endereco: `Lat ${Number(lat).toFixed(5)}, Lng ${Number(lng).toFixed(5)}` });
      }
      const data = await res.json();
      const addr = data.address || {};
      const rua = [addr.road || addr.pedestrian || addr.suburb, addr.house_number].filter(Boolean).join(', ');
      const cidade = addr.city || addr.town || addr.village || addr.municipality || '';
      const uf = addr.state || '';
      const bairro = addr.suburb || addr.neighbourhood || '';
      const formatado = [rua, bairro && bairro !== rua ? bairro : '', cidade, uf].filter(Boolean).join(' — ');
      return NextResponse.json({
        endereco: formatado || data.display_name || `Lat ${Number(lat).toFixed(5)}, Lng ${Number(lng).toFixed(5)}`,
        lat: Number(lat),
        lng: Number(lng),
      });
    }

    if (q.length >= 3) {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'PrivilegeContabilidadeERP/1.0 (contato@privilegecontabilidade.com.br)' },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) return NextResponse.json({ resultados: [] });
      const arr = await res.json();
      const resultados = Array.isArray(arr)
        ? arr.map((item: any) => ({
            endereco: String(item.display_name || ''),
            lat: Number(item.lat),
            lng: Number(item.lon),
          }))
        : [];
      return NextResponse.json({ resultados });
    }

    return NextResponse.json({ error: 'Informe lat/lng ou q (mínimo 3 caracteres).' }, { status: 400 });
  } catch (err) {
    console.warn('[geocode] Falha ao consultar Nominatim:', err);
    return NextResponse.json({
      endereco: lat && lng ? `Lat ${Number(lat).toFixed(5)}, Lng ${Number(lng).toFixed(5)}` : '',
      resultados: [],
    });
  }
}
