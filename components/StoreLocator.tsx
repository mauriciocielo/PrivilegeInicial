'use client';
import { useEffect, useRef } from 'react';

// Chave da API do Google Maps (Maps JavaScript API). Vem do ambiente — NUNCA fixa no código,
// porque o repositório é público. Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY na Vercel, com a chave
// restrita ao domínio (HTTP referrer) e billing habilitado. Sem a chave, cai no mapa simples (fallback).
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const EXTENDED_LIB = 'https://ajax.googleapis.com/ajax/libs/@googlemaps/extended-component-library/0.6.15/index.min.js';

const CONFIGURATION = {
  locations: [
    { title: 'Privilege Contabilidade e Consultoria', address1: 'Rua Pará, 127', address2: 'Francisco Beltrão, PR, Brazil', coords: { lat: -26.0802855, lng: -53.0478953 }, placeId: 'ChIJmbblyQdz8JQReoz1xenqkKA', actions: [{ label: 'Agendar atendimento', defaultUrl: 'https://calendar.app.google/7rGDgpidTfYK8t3g6' }] },
  ],
  // Centrado na Privilege (Francisco Beltrão/PR).
  mapOptions: { center: { lat: -26.0802855, lng: -53.0478953 }, fullscreenControl: true, mapTypeControl: false, streetViewControl: false, zoom: 15, zoomControl: true, maxZoom: 18, mapId: '' },
  mapsApiKey: MAPS_KEY,
  capabilities: { input: true, autocomplete: true, directions: true, distanceMatrix: true, details: true, actions: true },
};

export default function StoreLocator() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!MAPS_KEY || !ref.current) return;
    const host = ref.current;

    // Carrega a biblioteca de componentes uma única vez.
    if (!document.querySelector(`script[src="${EXTENDED_LIB}"]`)) {
      const s = document.createElement('script');
      s.type = 'module';
      s.src = EXTENDED_LIB;
      document.head.appendChild(s);
    }

    host.innerHTML =
      `<gmpx-api-loader key="${MAPS_KEY}" solution-channel="GMP_QB_locatorplus_v11"></gmpx-api-loader>`
      + `<gmpx-store-locator map-id="DEMO_MAP_ID" style="width:100%;height:100%"></gmpx-store-locator>`;

    let cancelado = false;
    (async () => {
      try {
        await customElements.whenDefined('gmpx-store-locator');
        if (cancelado) return;
        const locator = host.querySelector('gmpx-store-locator') as (HTMLElement & { configureFromQuickBuilder?: (c: unknown) => void }) | null;
        locator?.configureFromQuickBuilder?.(CONFIGURATION);
      } catch { /* a biblioteca pode não carregar (offline/bloqueio) — fica o espaço do mapa */ }
    })();

    return () => { cancelado = true; };
  }, []);

  // Sem chave configurada: mantém o mapa simples (iframe), que não exige API key.
  if (!MAPS_KEY) {
    return (
      <iframe
        title="Localização da Privilege Contabilidade e Consultoria em Francisco Beltrão"
        src="https://www.google.com/maps?q=Privilege+Contabilidade+e+Consultoria,+Rua+Par%C3%A1,+127,+Centro,+Francisco+Beltr%C3%A3o+-+PR,+85601-290&hl=pt-BR&z=17&output=embed"
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }

  return (
    <>
      <style>{`
        gmpx-store-locator {
          width: 100%; height: 100%;
          --gmpx-color-surface: #fff;
          --gmpx-color-on-surface: #212121;
          --gmpx-color-on-surface-variant: #757575;
          --gmpx-color-primary: #600000;
          --gmpx-color-outline: #e0e0e0;
          --gmpx-fixed-panel-width-row-layout: 28.5em;
          --gmpx-fixed-panel-height-column-layout: 65%;
          --gmpx-font-family-base: var(--font-sans, "Inter", sans-serif);
          --gmpx-font-family-headings: var(--font-sans, "Inter", sans-serif);
          --gmpx-font-size-base: 0.875rem;
          --gmpx-hours-color-open: #188038;
          --gmpx-hours-color-closed: #d50000;
          --gmpx-rating-color: #ffb300;
          --gmpx-rating-color-empty: #e0e0e0;
        }
      `}</style>
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
    </>
  );
}
