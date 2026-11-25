import db from '../prisma';
import type { NfseRecorrenciaRecord } from './recorrencias-utils';

export { expandirDescricaoRecorrente, type NfseRecorrenciaRecord } from './recorrencias-utils';

let tabelaGarantida = false;

export async function ensureRecorrenciasTable() {
  if (tabelaGarantida) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS cf_nfse_recorrencias (
      id TEXT PRIMARY KEY,
      empresa_id TEXT NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      dia_emissao INTEGER NOT NULL DEFAULT 5,
      tomador_documento TEXT NOT NULL,
      tomador_nome TEXT NOT NULL,
      tomador_email TEXT NOT NULL DEFAULT '',
      tomador_telefone TEXT NOT NULL DEFAULT '',
      tomador_cep TEXT NOT NULL DEFAULT '',
      tomador_endereco TEXT NOT NULL DEFAULT '',
      tomador_numero TEXT NOT NULL DEFAULT '',
      tomador_bairro TEXT NOT NULL DEFAULT '',
      tomador_cidade TEXT NOT NULL DEFAULT '',
      tomador_uf TEXT NOT NULL DEFAULT '',
      tomador_codigo_municipio TEXT NOT NULL DEFAULT '',
      codigo_servico TEXT NOT NULL DEFAULT '',
      c_trib_mun TEXT NOT NULL DEFAULT '',
      c_nbs TEXT NOT NULL DEFAULT '',
      valor_servicos DOUBLE PRECISION NOT NULL DEFAULT 0,
      aliquota_iss DOUBLE PRECISION NOT NULL DEFAULT 0,
      iss_retido BOOLEAN NOT NULL DEFAULT FALSE,
      descricao_template TEXT NOT NULL DEFAULT '',
      ultima_competencia_gerada TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_cf_nfse_rec_emp ON cf_nfse_recorrencias(empresa_id)`);
  tabelaGarantida = true;
}

export function mapRowToRecorrencia(r: any): NfseRecorrenciaRecord {
  return {
    id: String(r.id),
    empresaId: String(r.empresa_id),
    ativo: Boolean(r.ativo),
    diaEmissao: Number(r.dia_emissao || 5),
    tomadorDocumento: String(r.tomador_documento || ''),
    tomadorNome: String(r.tomador_nome || ''),
    tomadorEmail: String(r.tomador_email || ''),
    tomadorTelefone: String(r.tomador_telefone || ''),
    tomadorCep: String(r.tomador_cep || ''),
    tomadorEndereco: String(r.tomador_endereco || ''),
    tomadorNumero: String(r.tomador_numero || ''),
    tomadorBairro: String(r.tomador_bairro || ''),
    tomadorCidade: String(r.tomador_cidade || ''),
    tomadorUf: String(r.tomador_uf || ''),
    tomadorCodigoMunicipio: String(r.tomador_codigo_municipio || ''),
    codigoServico: String(r.codigo_servico || ''),
    cTribMun: String(r.c_trib_mun || ''),
    cNbs: String(r.c_nbs || ''),
    valorServicos: Number(r.valor_servicos || 0),
    aliquotaIss: Number(r.aliquota_iss || 0),
    issRetido: Boolean(r.iss_retido),
    descricaoTemplate: String(r.descricao_template || ''),
    ultimaCompetenciaGerada: r.ultima_competencia_gerada || null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}
