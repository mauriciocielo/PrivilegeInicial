import db from '../prisma';
import { apenasDigitos, buscarAliquotaSimplesNacional } from './integra-contador';

let tabelaGarantida = false;
let rodandoEmSegundoPlano = false;
let ultimaChecagemMs = 0;

async function ensureTabelaSyncAliquota() {
  if (tabelaGarantida) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS cf_serpro_aliquota_sync (
      empresa_id TEXT NOT NULL,
      ciclo TEXT NOT NULL,
      aliquota DOUBLE PRECISION,
      aliquota_iss DOUBLE PRECISION,
      periodo_apuracao TEXT,
      status TEXT NOT NULL,
      erro TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (empresa_id, ciclo)
    )
  `);
  tabelaGarantida = true;
}

/** Data/hora atual no fuso de Brasília (UTC-3). */
function agoraBrasilia(agora = new Date()) {
  const d = new Date(agora.getTime() - 3 * 3600 * 1000);
  const ano = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = d.getUTCDate();
  const hora = d.getUTCHours();
  return { ano, mes, dia, hora, competencia: `${ano}-${mes}` };
}

/**
 * Define o ciclo mensal de sincronização:
 * - Dias 1 a 20: ciclo "AAAA-MM" (virada do mês)
 * - Dias 21 a 31: ciclo "AAAA-MM:pos20" (re-sincronização após entrega do PGDAS-D no dia 20)
 */
export function cicloAtualSimples(agora = new Date()): string {
  const { competencia, dia } = agoraBrasilia(agora);
  return dia >= 21 ? `${competencia}:pos20` : competencia;
}

export interface ResumoAtualizacaoSimples {
  ciclo: string;
  totalElegiveis: number;
  processadas: number;
  atualizadas: number;
  semDados: number;
  erros: number;
}

/**
 * Atualiza em lote a alíquota efetiva do Simples Nacional (`pTotTribSN`) via SERPRO Integra Contador
 * para todas as empresas optantes do Simples Nacional (ME/EPP) ainda pendentes no ciclo atual.
 */
export async function atualizarAliquotasSimplesEmLote(opcoes?: {
  forcar?: boolean;
  limite?: number;
}): Promise<ResumoAtualizacaoSimples> {
  await ensureTabelaSyncAliquota();
  const ciclo = cicloAtualSimples();
  const forcar = Boolean(opcoes?.forcar);
  const limite = Math.max(1, Math.min(500, Number(opcoes?.limite) || 50));

  const empresas = await db.empresa.findMany({
    where: {
      OR: [
        { nfseConfig: { is: { opSimpNac: 3 } } },
        { regimeTributario: { in: ['simples', 'Simples Nacional', 'SIMPLES'] } },
      ],
    },
    select: {
      id: true,
      cnpj: true,
      razaoSocial: true,
      nfseConfig: { select: { opSimpNac: true, pTotTribSN: true } },
    },
  });

  // Exclui MEI (opSimpNac === 2) e CNPJs inválidos
  const elegiveis = empresas.filter(e => {
    const dig = apenasDigitos(e.cnpj);
    if (dig.length !== 14) return false;
    if (e.nfseConfig?.opSimpNac === 2 || e.nfseConfig?.opSimpNac === 1) return false;
    return true;
  });

  const jaFeitas = forcar
    ? new Set<string>()
    : new Set(
        (
          await db.$queryRawUnsafe<Array<{ empresa_id: string }>>(
            `SELECT empresa_id FROM cf_serpro_aliquota_sync WHERE ciclo = $1 AND status IN ('ok', 'sem_dados')`,
            ciclo
          )
        ).map(r => String(r.empresa_id))
      );

  const pendentes = elegiveis.filter(e => !jaFeitas.has(e.id)).slice(0, limite);

  let atualizadas = 0;
  let semDados = 0;
  let erros = 0;

  for (const emp of pendentes) {
    const cnpj = apenasDigitos(emp.cnpj);
    try {
      const res = await buscarAliquotaSimplesNacional(cnpj);
      if (res.sucesso && res.aliquota > 0) {
        await db.nfseConfig.upsert({
          where: { empresaId: emp.id },
          create: {
            empresaId: emp.id,
            ambiente: 'producao',
            opSimpNac: 3,
            pTotTribSN: res.aliquota,
          },
          update: {
            opSimpNac: 3,
            pTotTribSN: res.aliquota,
          },
        });
        await db.$executeRawUnsafe(
          `INSERT INTO cf_serpro_aliquota_sync (empresa_id, ciclo, aliquota, aliquota_iss, periodo_apuracao, status, erro, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'ok', NULL, NOW())
           ON CONFLICT (empresa_id, ciclo) DO UPDATE SET
             aliquota = EXCLUDED.aliquota,
             aliquota_iss = EXCLUDED.aliquota_iss,
             periodo_apuracao = EXCLUDED.periodo_apuracao,
             status = 'ok',
             erro = NULL,
             updated_at = NOW()`,
          emp.id,
          ciclo,
          res.aliquota,
          res.aliquotaIss ?? null,
          res.periodoApuracao || null
        );
        atualizadas++;
      } else {
        await db.$executeRawUnsafe(
          `INSERT INTO cf_serpro_aliquota_sync (empresa_id, ciclo, aliquota, aliquota_iss, periodo_apuracao, status, erro, updated_at)
           VALUES ($1, $2, NULL, NULL, NULL, 'sem_dados', $3, NOW())
           ON CONFLICT (empresa_id, ciclo) DO UPDATE SET
             status = 'sem_dados',
             erro = EXCLUDED.erro,
             updated_at = NOW()`,
          emp.id,
          ciclo,
          (res.aviso || 'Sem apuração PGDAS-D localizada').slice(0, 300)
        );
        semDados++;
      }
    } catch (err: any) {
      await db.$executeRawUnsafe(
        `INSERT INTO cf_serpro_aliquota_sync (empresa_id, ciclo, aliquota, aliquota_iss, periodo_apuracao, status, erro, updated_at)
         VALUES ($1, $2, NULL, NULL, NULL, 'erro', $3, NOW())
         ON CONFLICT (empresa_id, ciclo) DO UPDATE SET
           status = 'erro',
           erro = EXCLUDED.erro,
           updated_at = NOW()`,
        emp.id,
        ciclo,
        String(err?.message || 'Erro ao consultar SERPRO').slice(0, 300)
      ).catch(() => {});
      erros++;
    }

    // Pausa curta para respeitar o limite de requisições da API do SERPRO
    await new Promise(r => setTimeout(r, 400));
  }

  return {
    ciclo,
    totalElegiveis: elegiveis.length,
    processadas: pendentes.length,
    atualizadas,
    semDados,
    erros,
  };
}

/**
 * Gatilho não-bloqueante chamado pelo daemon 24h (a cada 30s).
 * Na virada de todo mês (e novamente após o dia 20, pós-PGDAS-D), atualiza automaticamente
 * em lotes de 20 empresas a cada 15 minutos até cobrir 100% das empresas do Simples Nacional.
 */
export function processarAtualizacaoMensalAliquotaSimples24h(): { iniciado: boolean; ciclo: string; rodando: boolean } {
  const agoraMs = Date.now();
  const { hora } = agoraBrasilia(new Date(agoraMs));
  const ciclo = cicloAtualSimples(new Date(agoraMs));

  if (rodandoEmSegundoPlano) {
    return { iniciado: false, ciclo, rodando: true };
  }
  // Executa entre 06h e 22h (horário de Brasília) com intervalo mínimo de 15 min entre lotes
  if (hora < 6 || hora >= 22 || agoraMs - ultimaChecagemMs < 15 * 60 * 1000) {
    return { iniciado: false, ciclo, rodando: false };
  }

  ultimaChecagemMs = agoraMs;
  rodandoEmSegundoPlano = true;

  void atualizarAliquotasSimplesEmLote({ limite: 20 })
    .then(res => {
      if (res.processadas > 0) {
        console.log(
          `[SERPRO-SIMPLES-MENSAL] Ciclo ${res.ciclo}: ${res.atualizadas} atualizadas, ${res.semDados} sem dados, ${res.erros} erros (lote ${res.processadas}/${res.totalElegiveis}).`
        );
      }
    })
    .catch(err => {
      console.warn('[SERPRO-SIMPLES-MENSAL] Falha no lote automático:', err?.message || err);
    })
    .finally(() => {
      rodandoEmSegundoPlano = false;
    });

  return { iniciado: true, ciclo, rodando: true };
}
