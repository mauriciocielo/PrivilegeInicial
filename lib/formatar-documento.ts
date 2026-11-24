/** CNPJ (00.000.000/0000-00) ou CPF (000.000.000-00) para exibição; outro texto volta como veio. */
export function formatarCpfCnpj(valor?: string | null): string {
  const d = (valor || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return valor || '';
}
