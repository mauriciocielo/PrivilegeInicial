import { getSessionFromRequest } from './session';

/**
 * Resolve o identificador de instância WhatsApp do usuário autenticado.
 * - O administrador principal usa 'default' (preservando a sessão já pareada da Privilege),
 *   podendo também alternar se desejar.
 * - Cada usuário (consultor, cliente ou emissor de NFS-e) recebe seu próprio namespace
 *   isolado (`user_<userId>`), permitindo que cada usuário conecte um número diferente.
 */
export function resolveWhatsAppOwnerId(req?: Request): string {
  if (!req) return 'default';

  try {
    const url = new URL(req.url);
    const explicitScope = url.searchParams.get('ownerId') || req.headers.get('x-whatsapp-owner');
    const session = getSessionFromRequest(req);

    if (!session) {
      return explicitScope === 'default' ? 'default' : 'default';
    }

    if (session.role === 'administrador') {
      if (explicitScope && explicitScope.trim()) {
        return explicitScope.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      }
      return 'default';
    }

    return `user_${String(session.userId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  } catch {
    return 'default';
  }
}
