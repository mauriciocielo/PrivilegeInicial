// ============================================================
// VALIDAÇÕES DE NEGÓCIO — API v1 (CP/CR)
// ============================================================
// Funções puras (sem acesso a banco/rede), para serem testadas isoladamente e
// reaproveitadas pelas rotas de contas-receber e contas-pagar sem duplicar a
// regra em cada handler.

export interface ValidacaoErro {
  campo: string;
  mensagem: string;
}

/** Remove tudo que não é dígito. */
const somenteDigitos = (v: string) => (v || '').replace(/\D/g, '');

/**
 * Valida CPF (11 dígitos) ou CNPJ (14 dígitos) pelos dígitos verificadores
 * oficiais — rejeita não só o formato, mas números como "11111111111" que
 * têm o tamanho certo só por coincidência.
 */
export function validarCpfCnpj(valor: string): boolean {
  const v = somenteDigitos(valor);
  if (v.length === 11) return validarCpf(v);
  if (v.length === 14) return validarCnpj(v);
  return false;
}

function validarCpf(cpf: string): boolean {
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = calc(cpf.slice(0, 9), 10);
  if (d1 !== Number(cpf[9])) return false;
  const d2 = calc(cpf.slice(0, 10), 11);
  return d2 === Number(cpf[10]);
}

function validarCnpj(cnpj: string): boolean {
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, pesos: number[]) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), p1);
  if (d1 !== Number(cnpj[12])) return false;
  const d2 = calc(cnpj.slice(0, 13), p2);
  return d2 === Number(cnpj[13]);
}

/**
 * Valida um valor monetário recebido via API: precisa ser um número finito,
 * com no máximo 2 casas decimais — um ERP que manda `10.999` (3 casas) ou
 * `"1000"` (string) indica um bug de integração do lado do cliente, e é
 * melhor rejeitar na porta do que arredondar em silêncio e gerar diferença
 * de centavos que ninguém consegue explicar depois na conciliação.
 */
export function validarValorMonetario(
  valor: unknown,
  opts: { permitirZero?: boolean; permitirNegativo?: boolean } = {}
): { valido: true; valor: number } | { valido: false; erro: string } {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return { valido: false, erro: 'Deve ser um número (não string, não nulo, não NaN/Infinity).' };
  }
  if (!opts.permitirNegativo && valor < 0) {
    return { valido: false, erro: 'Não pode ser negativo.' };
  }
  if (!opts.permitirZero && valor === 0) {
    return { valido: false, erro: 'Não pode ser zero.' };
  }
  // Compara o valor com ele mesmo arredondado a 2 casas — mais confiável que
  // regex sobre a representação em string, que varia (1e-10, 10.0, etc).
  const arredondado = Math.round(valor * 100) / 100;
  if (Math.abs(arredondado - valor) > 1e-9) {
    return { valido: false, erro: 'Deve ter no máximo 2 casas decimais.' };
  }
  return { valido: true, valor: arredondado };
}

/** YYYY-MM-DD estrito — evita "2026-2-5" ou datas com hora embutida. */
export function validarDataIso(valor: unknown): boolean {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/**
 * Regra explícita do escopo: vencimento no passado é rejeitado, a menos que
 * o payload autorize explicitamente (ex.: migração de um saldo já vencido).
 */
export function validarVencimento(
  dataVencimento: string,
  opts: { permitirRetroativo?: boolean; hoje?: Date } = {}
): { valido: true } | { valido: false; erro: string } {
  if (!validarDataIso(dataVencimento)) {
    return { valido: false, erro: 'dataVencimento deve estar no formato YYYY-MM-DD.' };
  }
  if (opts.permitirRetroativo) return { valido: true };
  const hoje = opts.hoje || new Date();
  const hojeIso = hoje.toISOString().split('T')[0];
  if (dataVencimento < hojeIso) {
    return {
      valido: false,
      erro: 'dataVencimento está no passado. Envie "permitirRetroativo": true para autorizar explicitamente.',
    };
  }
  return { valido: true };
}

/** valorLiquido = original + acréscimos − descontos, arredondado a 2 casas. */
export function calcularValorLiquido(original: number, acrescimos: number, descontos: number): number {
  return Math.round((original + acrescimos - descontos) * 100) / 100;
}

export interface ContaFinanceiraStatus {
  valorLiquido: number;
  totalBaixado: number;
}

/** Deriva o status (aberto/parcial/liquidado) a partir do que já foi baixado. */
export function calcularStatus(c: ContaFinanceiraStatus): 'aberto' | 'parcial' | 'liquidado' {
  if (c.totalBaixado <= 0) return 'aberto';
  if (c.totalBaixado >= c.valorLiquido - 0.005) return 'liquidado';
  return 'parcial';
}

/**
 * Payload de cadastro de sacado/fornecedor — valida os campos mínimos exigidos
 * pelo endpoint POST /api/v1/sacados.
 */
export function validarPayloadSacado(body: any): ValidacaoErro[] {
  const erros: ValidacaoErro[] = [];
  if (!body || typeof body !== 'object') return [{ campo: 'body', mensagem: 'Payload ausente ou inválido.' }];
  if (!body.nome || typeof body.nome !== 'string' || !body.nome.trim()) {
    erros.push({ campo: 'nome', mensagem: 'Obrigatório.' });
  }
  if (!body.cpfCnpj || !validarCpfCnpj(String(body.cpfCnpj))) {
    erros.push({ campo: 'cpfCnpj', mensagem: 'CPF ou CNPJ inválido.' });
  }
  if (body.email && typeof body.email === 'string' && body.email.includes('@') === false) {
    erros.push({ campo: 'email', mensagem: 'E-mail em formato inválido.' });
  }
  return erros;
}

/** Payload de POST /api/v1/contas-receber (e, com os mesmos campos, contas-pagar). */
export function validarPayloadContaFinanceira(body: any): { erros: ValidacaoErro[]; valorLiquido?: number } {
  const erros: ValidacaoErro[] = [];
  if (!body || typeof body !== 'object') return { erros: [{ campo: 'body', mensagem: 'Payload ausente ou inválido.' }] };

  if (!body.sacadoId && !body.fornecedorId) {
    erros.push({ campo: 'sacadoId', mensagem: 'Obrigatório (sacadoId em CR, fornecedorId em CP).' });
  }
  if (!validarDataIso(body.dataEmissao)) erros.push({ campo: 'dataEmissao', mensagem: 'Formato YYYY-MM-DD obrigatório.' });

  const venc = validarVencimento(body.dataVencimento, { permitirRetroativo: body.permitirRetroativo === true });
  if (!venc.valido) erros.push({ campo: 'dataVencimento', mensagem: venc.erro });

  const original = validarValorMonetario(body.valorOriginal);
  if (!original.valido) erros.push({ campo: 'valorOriginal', mensagem: original.erro });

  const acrescimos = validarValorMonetario(body.acrescimos ?? 0, { permitirZero: true });
  if (!acrescimos.valido) erros.push({ campo: 'acrescimos', mensagem: acrescimos.erro });

  const descontos = validarValorMonetario(body.descontos ?? 0, { permitirZero: true });
  if (!descontos.valido) erros.push({ campo: 'descontos', mensagem: descontos.erro });

  if (erros.length > 0) return { erros };

  return {
    erros: [],
    valorLiquido: calcularValorLiquido(
      (original as any).valor, (acrescimos as any).valor, (descontos as any).valor
    ),
  };
}
