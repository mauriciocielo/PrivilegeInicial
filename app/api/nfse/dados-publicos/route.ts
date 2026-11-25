import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { apenasDigitos, cnpjValido } from '../../../../lib/nfse/dps';
import { consultarCep, consultarCnpjPublico } from '../../../../lib/nfse/emissor';
import { acessoEmissaoNegado } from '../../../../lib/nfse/servidor';

// Até três provedores em sequência, com 8 s cada.
export const maxDuration = 30;

function cpfValido(cpf: string): boolean {
  const d = apenasDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(d[i]) * (10 - i);
  let r = (soma * 10) % 11;
  if (r === 10) r = 0;
  if (r !== Number(d[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(d[i]) * (11 - i);
  r = (soma * 10) % 11;
  if (r === 10) r = 0;
  return r === Number(d[10]);
}

/** Dados para preencher a nota: `?cnpj=` (Receita Federal), `?cpf=` (base da empresa) ou `?cep=` (endereço). */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const cnpj = apenasDigitos(url.searchParams.get('cnpj') || '');
    const cpf = apenasDigitos(url.searchParams.get('cpf') || '');
    const cep = apenasDigitos(url.searchParams.get('cep') || '');
    const empresaId = (url.searchParams.get('empresaId') || '').trim();

    if (cnpj) {
      if (!cnpjValido(cnpj)) return NextResponse.json({ error: 'CNPJ inválido.' }, { status: 400 });
      const dados = await consultarCnpjPublico(cnpj);
      if (!dados) return NextResponse.json({ error: 'Não foi possível consultar este CNPJ agora. Preencha os dados à mão.' }, { status: 404 });
      return NextResponse.json(dados);
    }

    if (cpf) {
      if (!cpfValido(cpf)) return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });

      if (empresaId) {
        const negado = await acessoEmissaoNegado(auth.session, empresaId);
        if (negado) return negado;
      }

      // 1. Busca em NFS-e já emitidas (prioriza a empresa atual; se não houver, busca na base geral do banco)
      //    Retorna SOMENTE os dados cadastrais da pessoa (nome/e-mail/endereço), sem expor empresa ou nota de terceiros.
      const nfseRows = await db.$queryRawUnsafe<any[]>(
        `SELECT
           "tomadorRazaoSocial", "tomadorEmail", "tomadorEndereco", "tomadorNumero",
           "tomadorBairro", "tomadorCep", "tomadorCodigoMunicipio", "tomadorCidade", "tomadorUf"
         FROM "NfsE"
         WHERE regexp_replace("tomadorCnpjCpf", '[^0-9]', '', 'g') = $1
           AND COALESCE(TRIM("tomadorRazaoSocial"), '') <> ''
         ORDER BY
           CASE WHEN $2 <> '' AND "empresaId" = $2 THEN 0 ELSE 1 END ASC,
           CASE WHEN COALESCE(TRIM("tomadorCep"), '') <> '' THEN 0 ELSE 1 END ASC,
           "createdAt" DESC
         LIMIT 1`,
        cpf,
        empresaId
      );

      // 2. Busca no cadastro de Clientes (prioriza a empresa atual, depois base geral)
      const cliRows = await db.$queryRawUnsafe<any[]>(
        `SELECT nome, email, endereco, cep, cidade, estado
         FROM "Cliente"
         WHERE regexp_replace("cpfCnpj", '[^0-9]', '', 'g') = $1
           AND COALESCE(TRIM(nome), '') <> ''
         ORDER BY
           CASE WHEN $2 <> '' AND "empresaId" = $2 THEN 0 ELSE 1 END ASC,
           CASE WHEN COALESCE(TRIM(cep), '') <> '' THEN 0 ELSE 1 END ASC,
           "createdAt" DESC
         LIMIT 1`,
        cpf,
        empresaId
      );

      // 3. Busca em Unidades de condomínio (prioriza a empresa atual, depois base geral)
      const uniRows = await db.$queryRawUnsafe<any[]>(
        `SELECT proprietario, email, "moradorNome", "moradorEmail",
                regexp_replace(COALESCE("proprietarioCpf", ''), '[^0-9]', '', 'g') AS prop_cpf
         FROM "Unidade"
         WHERE (
           regexp_replace(COALESCE("proprietarioCpf", ''), '[^0-9]', '', 'g') = $1
           OR regexp_replace(COALESCE("moradorCpf", ''), '[^0-9]', '', 'g') = $1
         )
         ORDER BY
           CASE WHEN $2 <> '' AND "condominioId" = $2 THEN 0 ELSE 1 END ASC
         LIMIT 1`,
        cpf,
        empresaId
      );

      const n = nfseRows[0] || null;
      const c = cliRows[0] || null;
      const u = uniRows[0] || null;

      if (!n && !c && !u) {
        return NextResponse.json(
          { error: 'CPF ainda não encontrado na base do sistema (por LGPD, a Receita não libera consulta pública de CPF). Preencha uma vez e nas próximas será automático.' },
          { status: 404 }
        );
      }

      const nomeUnidade = u ? (u.prop_cpf === cpf ? u.proprietario : (u.moradorNome || u.proprietario)) : null;
      const emailUnidade = u ? (u.prop_cpf === cpf ? u.email : (u.moradorEmail || u.email)) : null;

      let cepEncontrado = apenasDigitos(n?.tomadorCep || c?.cep || '');
      let logradouro = n?.tomadorEndereco || c?.endereco || null;
      let numero = n?.tomadorNumero || null;
      let bairro = n?.tomadorBairro || null;
      let cidade = n?.tomadorCidade || c?.cidade || null;
      let uf = n?.tomadorUf || c?.estado || null;
      let codigoMunicipio = n?.tomadorCodigoMunicipio || null;

      // Se encontrou CEP mas ainda falta o código IBGE (ou bairro), enriquece automaticamente pelo CEP
      if (cepEncontrado.length === 8 && (!codigoMunicipio || !bairro)) {
        const endCep = await consultarCep(cepEncontrado).catch(() => null);
        if (endCep) {
          logradouro = logradouro || endCep.logradouro;
          bairro = bairro || endCep.bairro;
          cidade = cidade || endCep.cidade;
          uf = uf || endCep.uf;
          codigoMunicipio = codigoMunicipio || endCep.codigoMunicipio;
        }
      }

      return NextResponse.json({
        razaoSocial: n?.tomadorRazaoSocial || c?.nome || nomeUnidade || null,
        email: n?.tomadorEmail || c?.email || emailUnidade || null,
        logradouro,
        numero,
        bairro,
        cep: cepEncontrado.length === 8 ? cepEncontrado : null,
        codigoMunicipio,
        cidade,
        uf,
        origem: n ? 'historico_nfse' : c ? 'cadastro_clientes' : 'cadastro_unidades',
      });
    }

    if (cep.length === 8) {
      const dados = await consultarCep(cep);
      if (!dados) return NextResponse.json({ error: 'CEP não encontrado.' }, { status: 404 });
      return NextResponse.json(dados);
    }

    return NextResponse.json({ error: 'Informe um CNPJ, CPF ou CEP.' }, { status: 400 });
  } catch (error) {
    console.error('Erro em GET nfse/dados-publicos:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao consultar os dados.' }, { status: 500 });
  }
}
