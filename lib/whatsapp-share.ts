'use client';

import { store } from './store';

export const WHATSAPP_SHARE_STORAGE_KEY = 'cf_whatsapp_share_payload';

export interface WhatsAppShareAttachment {
  dataUrl: string;
  mediaType: 'image' | 'document' | 'audio';
  fileName: string;
  mimeType?: string;
}

export interface WhatsAppSharePayload {
  phone?: string;
  name?: string;
  text?: string;
  attachment?: WhatsAppShareAttachment;
}

export function getWhatsAppRouteForCurrentUser(): '/consultor/whatsapp' | '/cliente/whatsapp' {
  const user = store.getCurrentUser();
  return user?.role === 'cliente' ? '/cliente/whatsapp' : '/consultor/whatsapp';
}

export function normalizeWhatsAppPhone(phone?: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
    return `55${digits}`;
  }
  return digits;
}

export function redirectToWhatsAppShare(
  payload: WhatsAppSharePayload,
  navigate?: (url: string) => void
) {
  if (typeof window === 'undefined') return;
  const cleanPayload: WhatsAppSharePayload = {
    phone: normalizeWhatsAppPhone(payload.phone),
    name: payload.name?.trim() || undefined,
    text: payload.text || '',
    attachment: payload.attachment,
  };
  sessionStorage.setItem(WHATSAPP_SHARE_STORAGE_KEY, JSON.stringify(cleanPayload));
  window.dispatchEvent(new CustomEvent('waSharePayload', { detail: cleanPayload }));
  const target = getWhatsAppRouteForCurrentUser();
  if (navigate) {
    navigate(target);
  } else {
    window.location.assign(target);
  }
}
