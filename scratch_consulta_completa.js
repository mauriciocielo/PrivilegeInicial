require('dotenv').config();
const db = require('./lib/prisma').default;
const { consultarNfeDestinadas } = require('./lib/nfe/monitor');
const { consultarCteEmpresa } = require('./lib/cte/monitor');
const { sincronizarNotasAdn } = require('./lib/nfse/sincronizar-adn');
const { registrarLogFiscal } = require('./lib/nfe/logger');

const CONCORRENCIA = 3;
const PAUSA_MS = 600;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executarPool(itens, limiteConcorrencia, fn) {
  const resultados = [];
  let index = 0;

  async function trabalhador() {
    while (index < itens.length) {
      const itemAtual = itens[index++];
      try {
        const res = await fn(itemAtual);
        resultados.push(res);
      } catch (err) {
        resultados.push({ item: itemAtual, erro: err.message });
      }
      if (PAUSA_MS > 0) await sleep(PAUSA_MS);
    }
  }

  const trabalhadores = Array.from({ length: limiteConcorrencia }, () => trabalhador());
  await Promise.all(trabalhadores);
  return resultados;
}

async function main() {
  console.log('====================================================');
  console.log('INICIANDO CONSULTA COMPLETA DE TODOS OS CNPJS');
  console.log('NF-e, CT-e e NFS-e (Emitidas e Recebidas)');
  console.log('====================================================\n');

  // 1. Identificar empresas aptas para NF-e / CT-e (certificado A1 ativo)
  const empresasNfe = await db.empresa.findMany({
    where: {
      nfseConfig: { certPfxCifrado: { not: null } },
    },
    select: {
      id: true,
      razaoSocial: true,
      nomeFantasia: true,
      cnpj: true,
      nfeDistribuicao: {
        select: {
          ativo: true,
          proximaConsultaEm: true,
          ultNsu: true,
          ultNsuCte: true,
        },
      },
    },
    orderBy: { razaoSocial: 'asc' },
  });

  console.log(`[1/3] Empresas com Certificado A1 para NF-e e CT-e: ${empresasNfe.length}`);

  let nfeSucessos = 0;
  let nfeNovas = 0;
  let cteNovas = 0;
  let nfeFalhas = 0;
  let nfePuladas = 0;

  await executarPool(empresasNfe, CONCORRENCIA, async (emp) => {
    const nome = emp.nomeFantasia || emp.razaoSocial;
    const proxima = emp.nfeDistribuicao?.proximaConsultaEm;
    if (proxima && new Date(proxima).getTime() > Date.now()) {
      nfePuladas++;
      return { empresa: nome, status: 'pulada', motivo: 'Aguardando SEFAZ (60 min)' };
    }

    try {
      const [resNfe, resCte] = await Promise.allSettled([
        consultarNfeDestinadas(emp.id),
        consultarCteEmpresa(emp.id),
      ]);

      let novasNfe = 0;
      let novasCte = 0;

      if (resNfe.status === 'fulfilled' && resNfe.value.executada) {
        novasNfe = resNfe.value.novas || 0;
        nfeNovas += novasNfe;
      }

      if (resCte.status === 'fulfilled' && resCte.value.executada) {
        novasCte = resCte.value.novas || 0;
        cteNovas += novasCte;
      }

      const sucesso = (resNfe.status === 'fulfilled' && resNfe.value.executada) ||
                      (resCte.status === 'fulfilled' && resCte.value.executada);

      if (sucesso) {
        nfeSucessos++;
        if (novasNfe > 0 || novasCte > 0) {
          console.log(`  ✓ ${nome}: +${novasNfe} NF-e, +${novasCte} CT-e`);
        }
      } else {
        nfeFalhas++;
        const msg = resNfe.status === 'fulfilled' ? resNfe.value.mensagem : resNfe.reason?.message;
        console.log(`  ✗ ${nome}: ${msg}`);
      }

      return { empresa: nome, sucesso, novasNfe, novasCte };
    } catch (err) {
      nfeFalhas++;
      return { empresa: nome, erro: err.message };
    }
  });

  console.log(`\nResumo NF-e & CT-e: ${nfeSucessos} consultadas com sucesso, ${nfeNovas} novas NF-e, ${cteNovas} novos CT-e, ${nfeFalhas} falhas, ${nfePuladas} em espera SEFAZ.\n`);

  // 2. Identificar empresas aptas para NFS-e (ADN Nacional)
  const empresasNfse = await db.empresa.findMany({
    where: {
      OR: [
        { nfseConfig: { certPfxCifrado: { not: null } } },
        { nfseConfig: { usarProcuracao: true } },
      ],
    },
    select: {
      id: true,
      razaoSocial: true,
      nomeFantasia: true,
      cnpj: true,
      nfseConfig: {
        select: {
          usarProcuracao: true,
          procuracaoStatus: true,
          certValidoAte: true,
        },
      },
    },
    orderBy: { razaoSocial: 'asc' },
  });

  console.log(`[2/3] Empresas aptas para consulta de NFS-e (ADN Nacional): ${empresasNfse.length}`);

  let nfseSucessos = 0;
  let nfseNovasEmitidas = 0;
  let nfseNovasTomadas = 0;
  let nfseFalhas = 0;

  await executarPool(empresasNfse, CONCORRENCIA, async (emp) => {
    const nome = emp.nomeFantasia || emp.razaoSocial;
    try {
      const res = await sincronizarNotasAdn(emp.id, { meses: 6 });
      if (res.ok) {
        nfseSucessos++;
        nfseNovasEmitidas += res.criadasEmitidas || 0;
        nfseNovasTomadas += res.criadasTomadas || 0;
        if (res.criadas > 0) {
          console.log(`  ✓ ${nome}: +${res.criadasEmitidas} emitidas, +${res.criadasTomadas} tomadas`);
        }
      } else {
        nfseFalhas++;
        // Não loga aviso se for só falta de procuração para não poluir
        if (!res.error?.includes('sem procuração') && !res.error?.includes('procuração')) {
          console.log(`  ✗ ${nome}: ${res.error}`);
        }
      }
      return { empresa: nome, res };
    } catch (err) {
      nfseFalhas++;
      return { empresa: nome, erro: err.message };
    }
  });

  console.log(`\nResumo NFS-e (ADN): ${nfseSucessos} empresas sincronizadas, +${nfseNovasEmitidas} novas emitidas (prestador), +${nfseNovasTomadas} novas tomadas, ${nfseFalhas} falhas/sem procuração.\n`);

  // 3. Totais consolidados no banco de dados
  const totalNfeEmitidas = await db.nfeDestinada.count({
    where: {
      tipoOperacao: 1, // Saída / Venda
    },
  });

  const totalNfeRecebidas = await db.nfeDestinada.count({
    where: {
      tipoOperacao: 0, // Entrada / Compra
    },
  });

  const totalCte = await db.nfeDestinada.count({
    where: {
      chaveAcesso: { contains: '57' }, // modelo 57
    },
  });

  const totalNfseEmitidas = await db.nfsE.count({
    where: {
      NOT: { prestadorRazaoSocial: 'Prestador não informado' },
    },
  });

  const totalNfseTomadas = await db.nfsE.count({
    where: {
      prestadorRazaoSocial: 'Prestador não informado',
    },
  });

  const resumoGeral = {
    totalNfeNovas: nfeNovas,
    totalCteNovas: cteNovas,
    totalNfseEmitidasNovas: nfseNovasEmitidas,
    totalNfseTomadasNovas: nfseNovasTomadas,
    bancoAtualizado: {
      nfeEmitidasTotal: totalNfeEmitidas,
      nfeRecebidasTotal: totalNfeRecebidas,
      cteTotal: totalCte,
      nfseEmitidasTotal: totalNfseEmitidas,
      nfseTomadasTotal: totalNfseTomadas,
    },
  };

  await registrarLogFiscal({
    tipo: 'geral',
    origem: 'manual',
    status: 'sucesso',
    mensagem: `Consulta completa de todos os CNPJs: +${nfeNovas} NF-e, +${cteNovas} CT-e, +${nfseNovasEmitidas} NFS-e emitidas, +${nfseNovasTomadas} NFS-e tomadas.`,
    novas: nfeNovas + cteNovas + nfseNovasEmitidas + nfseNovasTomadas,
    detalhes: JSON.stringify(resumoGeral, null, 2),
  });

  console.log('====================================================');
  console.log('CONSULTA COMPLETA CONCLUÍDA!');
  console.log(JSON.stringify(resumoGeral, null, 2));
  console.log('====================================================');
}

main().catch(console.error).finally(() => process.exit(0));

