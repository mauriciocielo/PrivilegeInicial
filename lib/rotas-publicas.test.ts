import { describe, expect, it } from 'vitest';
import { ehRotaPublica } from './rotas-publicas';

describe('rotas públicas', () => {
  it.each(['/', '/login', '/novo-layout', '/novo-layout/x', '/perfil/abc123'])('%s abre sem login', rota => {
    expect(ehRotaPublica(rota)).toBe(true);
  });

  it.each(['/consultor/dashboard', '/consultor/perfil-disc', '/consultor/perfil-disc/abc', '/cliente/dashboard', '/perfil', '/perfilx/abc'])(
    '%s continua exigindo login',
    rota => {
      expect(ehRotaPublica(rota)).toBe(false);
    },
  );
});
