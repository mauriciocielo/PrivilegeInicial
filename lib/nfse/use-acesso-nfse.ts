'use client';
import { useEffect, useState } from 'react';
import { store } from '../store';

export interface EmpresaLiberada {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
}

export interface AcessoNfse {
  carregando: boolean;
  liberado: boolean;
  empresas: EmpresaLiberada[];
}

// Layout, menu e tela leem o mesmo resultado: uma única consulta por usuário e página aberta.
let consulta: { usuario: string; promessa: Promise<Omit<AcessoNfse, 'carregando'>> } | null = null;

const chaveCache = (usuario: string) => `cf_acesso_nfse_${usuario}`;

function consultar(usuario: string) {
  if (consulta?.usuario !== usuario) {
    consulta = {
      usuario,
      promessa: fetch('/api/nfse/acesso')
        .then(r => (r.ok ? r.json() : Promise.reject(new Error('sem acesso'))))
        .then(d => {
          const resultado = { liberado: !!d.liberado, empresas: d.empresas || [] };
          sessionStorage.setItem(chaveCache(usuario), JSON.stringify(resultado));
          return resultado;
        })
        .catch(() => {
          consulta = null; // Falhou: a próxima tela tenta de novo.
          return { liberado: false, empresas: [] };
        }),
    };
  }
  return consulta.promessa;
}

/** Empresas do cliente com procuração confirmada. Para outros perfis, nunca há liberação. */
export function useAcessoNfse(ativo: boolean): AcessoNfse {
  const [acesso, setAcesso] = useState<AcessoNfse>({ carregando: ativo, liberado: false, empresas: [] });

  useEffect(() => {
    if (!ativo) return;
    const usuario = store.getCurrentUser()?.id;
    if (!usuario) { setAcesso({ carregando: false, liberado: false, empresas: [] }); return; }
    let cancelado = false;
    // O último resultado aparece na hora, para o cliente não ver as outras telas piscarem.
    const salvo = sessionStorage.getItem(chaveCache(usuario));
    if (salvo) {
      try { setAcesso({ carregando: false, ...JSON.parse(salvo) }); } catch { /* cache ilegível: aguarda a consulta */ }
    }
    consultar(usuario).then(r => { if (!cancelado) setAcesso({ carregando: false, ...r }); });
    return () => { cancelado = true; };
  }, [ativo]);

  return acesso;
}
