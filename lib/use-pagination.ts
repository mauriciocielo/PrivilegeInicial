'use client';
import { useEffect, useMemo, useState } from 'react';

/**
 * Pagina uma lista já carregada em memória (o sistema é "local-first": os
 * dados já estão todos no navegador, o problema é só renderizar milhares de
 * linhas de DOM de uma vez). Volta pra página 1 automaticamente sempre que o
 * tamanho da lista de origem muda (ex: usuário aplicou um filtro novo).
 */
export function usePagination<T>(items: T[], initialPageSize = 50) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [items.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    pageItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems: items.length,
  };
}
