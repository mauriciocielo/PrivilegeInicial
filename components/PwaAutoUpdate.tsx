'use client';
import { useEffect } from 'react';

/**
 * Recarrega a página automaticamente quando um novo service worker (PWA) assume o controle.
 * Assim um novo deploy aparece sozinho, sem o usuário precisar desregistrar o service worker
 * ou limpar cache a cada atualização. Não recarrega na primeira visita (quando ainda não havia
 * service worker controlando a página), evitando um reload desnecessário no primeiro acesso.
 */
export default function PwaAutoUpdate() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const haviaController = !!navigator.serviceWorker.controller;
    let recarregando = false;

    const aoTrocarController = () => {
      if (!haviaController || recarregando) return; // 1ª instalação não dispara reload
      recarregando = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', aoTrocarController);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', aoTrocarController);
  }, []);

  return null;
}
