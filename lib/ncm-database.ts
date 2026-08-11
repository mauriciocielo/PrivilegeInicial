// ============================================================
// ncm-database.ts — Banco de Dados Tributário da Reforma
// EC 132/2023 | LC 214/2025 | LC 227/2026
//
// Consultável tanto via SPED/XML quanto de forma standalone.
// ============================================================

export const ALIQ_IBS = 0.177;   // art. 9 LC 214/2025
export const ALIQ_CBS = 0.088;   // art. 10 LC 214/2025
export const ALIQ_TOTAL = ALIQ_IBS + ALIQ_CBS; // 26.5%

export type TratamentoReforma =
  | 'isencao_plena'    // 100% redução, alíquota zero
  | 'reducao_60'       // 60% de redução (serv. saúde, alimentos processados)
  | 'regime_especial'  // monofásico, serv. financeiros, imóveis
  | 'imposto_seletivo' // IS incide sobre o produto
  | 'normal';          // alíquota de referência integral

export type AnexoLC214 = 'Anexo_I' | 'Anexo_II' | 'Anexo_III' | 'Anexo_IV' | 'art_especifico' | 'nenhum';

export interface NCMEntry {
  ncm: string;            // Prefixo NCM (2, 4 ou 8 dígitos)
  descricao: string;      // Descrição do produto/serviço
  categoria: string;      // Grupo semântico
  setor: string;          // Setor econômico
  tratamento: TratamentoReforma;
  reducaoAliq: number;    // 0, 0.3, 0.6, 1.0
  aliqIBS: number;        // efetiva após redução
  aliqCBS: number;        // efetiva após redução
  aliqIS: number;         // Imposto Seletivo
  aliqTotal: number;      // IBS + CBS + IS (efetivo)
  anexo: AnexoLC214;
  artigo: string;         // artigo(s) específicos
  baseLegal: string;      // referência completa
  observacao?: string;
  cashback?: boolean;     // produto com cashback CadÚnico (art. 107)
  monofasico?: boolean;   // cobrança monofásica (combustíveis, etc.)
  isHidden?: boolean;     // para NCMs agrupados em prefixos
}

// ── Fábrica de entradas ──────────────────────────────────────
function entry(
  ncm: string,
  descricao: string,
  categoria: string,
  setor: string,
  tratamento: TratamentoReforma,
  reducaoAliq: number,
  aliqIS: number,
  anexo: AnexoLC214,
  artigo: string,
  observacao?: string,
  cashback?: boolean,
  monofasico?: boolean
): NCMEntry {
  const efIBS = ALIQ_IBS * (1 - reducaoAliq);
  const efCBS = ALIQ_CBS * (1 - reducaoAliq);
  return {
    ncm, descricao, categoria, setor, tratamento,
    reducaoAliq,
    aliqIBS: efIBS,
    aliqCBS: efCBS,
    aliqIS,
    aliqTotal: efIBS + efCBS + aliqIS,
    anexo,
    artigo,
    baseLegal: `LC 214/2025 ${artigo}${anexo !== 'nenhum' ? ', ' + anexo.replace('_', ' ') : ''}`,
    observacao,
    cashback,
    monofasico,
  };
}

// ============================================================
// BANCO DE DADOS NCM — 120+ entradas
// ============================================================
export const NCM_DATABASE: NCMEntry[] = [
  // ─── CARNES E PROTEÍNAS (Cesta Básica — Anexo III) ──────────────
  entry('0201','Carne bovina fresca/refrigerada','Carnes','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('0202','Carne bovina congelada','Carnes','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('0203','Carne suína fresca/congelada','Carnes','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('0204','Carne ovina/caprina','Carnes','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('0206','Miúdos bovinos/suínos','Carnes','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0207','Carne de aves frescas/congeladas','Carnes','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('0208','Outras carnes (coelho, pombo)','Carnes','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0209','Gordura de suíno e aves','Carnes','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),

  // ─── PESCADOS (Cesta Básica) ──────────────────────────────────────
  entry('0302','Peixe fresco/refrigerado','Pescados','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('0303','Peixe congelado','Pescados','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('0304','Filés de peixe','Pescados','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0306','Crustáceos','Pescados','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0307','Moluscos','Pescados','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),

  // ─── LATICÍNIOS E OVOS (Cesta Básica) ────────────────────────────
  entry('0401','Leite não concentrado','Laticínios','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('0402','Leite em pó/concentrado','Laticínios','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('0403','Iogurte e leitelho','Laticínios','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0404','Soro de leite','Laticínios','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0405','Manteiga','Laticínios','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0406','Queijos e requeijão','Laticínios','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0407','Ovos de aves','Ovos','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),

  // ─── CEREAIS E GRÃOS (Cesta Básica) ──────────────────────────────
  entry('1001','Trigo em grão','Cereais','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('1002','Centeio','Cereais','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('1003','Cevada','Cereais','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('1004','Aveia','Cereais','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('1005','Milho em grão','Cereais','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('1006','Arroz em grão','Cereais','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('1101','Farinha de trigo','Farinhas','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('1102','Farinha de milho','Farinhas','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('1104','Outros grãos trabalhados','Cereais','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('1108','Amidos e féculas','Amidos','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),

  // ─── LEGUMES E HORTALIÇAS ─────────────────────────────────────────
  entry('0701','Batatas frescas/refrigeradas','Hortaliças','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0702','Tomates frescos','Hortaliças','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0703','Cebolas e alho frescos','Hortaliças','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0704','Couves e brócolos frescos','Hortaliças','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0713','Leguminosas secas (feijão, lentilhas)','Leguminosas','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),

  // ─── FRUTAS (Cesta Básica / Redução) ─────────────────────────────
  entry('0801','Coqueiros (coco fresco)','Frutas','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0803','Bananas','Frutas','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0804','Tâmaras, abacaxi, manga','Frutas','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0805','Frutas cítricas frescas','Frutas','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('0806','Uvas frescas/secas','Frutas','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),

  // ─── ÓLEOS VEGETAIS (Cesta Básica) ───────────────────────────────
  entry('1507','Óleo de soja bruto/refinado','Óleos','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('1511','Óleo de palma','Óleos','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('1512','Óleos de girassol/cártamo/algodão','Óleos','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('1515','Óleo de milho','Óleos','Alimentos','isencao_plena',1.0,0,'Anexo_III','art. 107'),

  // ─── ALIMENTOS PROCESSADOS (Redução 60%) ─────────────────────────
  entry('1601','Embutidos (salsicha, linguiça)','Processados','Alimentos','reducao_60',0.6,0,'Anexo_I','art. 120 §1º','Incluídos no Anexo I com redução de 60%'),
  entry('1602','Outras preparações de carne','Processados','Alimentos','reducao_60',0.6,0,'Anexo_I','art. 120 §1º'),
  entry('1901','Preparações de farinha (massas)','Massas','Alimentos','reducao_60',0.6,0,'Anexo_I','art. 120 §1º'),
  entry('1902','Macarrão e massas alimentícias','Massas','Alimentos','reducao_60',0.6,0,'Anexo_I','art. 120 §1º'),
  entry('1905','Pães, biscoitos, bolos','Panificação','Alimentos','reducao_60',0.6,0,'Anexo_I','art. 120 §1º'),
  entry('2001','Hortaliças preparadas/conservadas','Conservas','Alimentos','reducao_60',0.6,0,'Anexo_I','art. 120 §1º'),
  entry('2002','Tomates preparados/conservados','Conservas','Alimentos','reducao_60',0.6,0,'Anexo_I','art. 120 §1º'),
  entry('2007','Geleias e geléias de frutas','Confeitos','Alimentos','reducao_60',0.6,0,'Anexo_I','art. 120 §1º'),
  entry('2009','Sucos de frutas e vegetais','Bebidas','Alimentos','reducao_60',0.6,0,'Anexo_I','art. 120 §1º'),

  // ─── BEBIDAS NÃO ALCOÓLICAS AÇUCARADAS (IS 8%) ───────────────────
  entry('2202','Águas com açúcar/bebidas gaseif.','Bebidas','Bebidas','imposto_seletivo',0,0.08,'Anexo_IV','art. 413 §3º','IS de 8% sobre bebidas com açúcar adicionado'),

  // ─── BEBIDAS ALCOÓLICAS (IS 20%) ―────────────────────────────────
  entry('2203','Cerveja','Bebidas Alcoólicas','Bebidas','imposto_seletivo',0,0.20,'Anexo_IV','art. 413','IS de 20% sobre bebidas alcoólicas fermentadas'),
  entry('2204','Vinhos de uvas frescas','Bebidas Alcoólicas','Bebidas','imposto_seletivo',0,0.20,'Anexo_IV','art. 413'),
  entry('2205','Vermute e similares','Bebidas Alcoólicas','Bebidas','imposto_seletivo',0,0.20,'Anexo_IV','art. 413'),
  entry('2206','Outras bebidas fermentadas','Bebidas Alcoólicas','Bebidas','imposto_seletivo',0,0.20,'Anexo_IV','art. 413'),
  entry('2207','Álcool etílico não desnaturado ≥80%','Bebidas Alcoólicas','Bebidas','imposto_seletivo',0,0.20,'Anexo_IV','art. 413'),
  entry('2208','Aguardente, uísques, gin, vodca','Bebidas Alcoólicas','Bebidas','imposto_seletivo',0,0.20,'Anexo_IV','art. 413','Destilados e spirits em geral'),

  // ─── TABACO (IS 150%) ────────────────────────────────────────────
  entry('2401','Tabaco em folha não manufaturado','Tabaco','Tabaco','imposto_seletivo',0,1.50,'Anexo_IV','art. 413','IS = 150% ad valorem'),
  entry('2402','Charutos, cigarrilhas e cigarros','Tabaco','Tabaco','imposto_seletivo',0,1.50,'Anexo_IV','art. 413','IS = 150% ad valorem'),
  entry('2403','Tabaco manufaturado e seus sucedâneos','Tabaco','Tabaco','imposto_seletivo',0,1.50,'Anexo_IV','art. 413'),

  // ─── MEDICAMENTOS E SAÚDE (Redução 60%) ──────────────────────────
  entry('3003','Medicamentos (não dosados)','Medicamentos','Saúde','reducao_60',0.6,0,'Anexo_I','art. 120 §1º','Redução 60% IBS/CBS. Cashback para CadÚnico possível',true),
  entry('3004','Medicamentos dosados','Medicamentos','Saúde','reducao_60',0.6,0,'Anexo_I','art. 120 §1º','Principais: antibióticos, anti-hipertensivos',true),
  entry('3006','Preparações farmacêuticas','Medicamentos','Saúde','reducao_60',0.6,0,'Anexo_I','art. 120 §1º',undefined,true),
  entry('3307','Produtos de higiene pessoal básicos','Higiene','Saúde','reducao_60',0.6,0,'Anexo_I','art. 120 §1º'),
  entry('3808','Defensivos agrícolas e pesticidas','Defensivos','Agropecuária','isencao_plena',1.0,0,'Anexo_III','art. 107 (Agropec.)','Verificar exclusão IS p/ contaminantes'),
  entry('3813','Preparações para extinção de fogo','Segurança','Industrial','normal',0,0,'nenhum','art. 9'),
  entry('8713','Cadeiras de rodas e equiv. para defic.','Acessibilidade','Saúde','reducao_60',0.6,0,'Anexo_I','art. 120 §1º'),

  // ─── FERTILIZANTES E INSUMOS AGRO (Isenção 100%) ─────────────────
  entry('3101','Fertilizantes à base de nitrogênio','Insumos Agro','Agropecuária','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('3102','Adubos nitrogenados','Insumos Agro','Agropecuária','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),
  entry('3103','Fertilizantes fosfatados','Insumos Agro','Agropecuária','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('3104','Fertilizantes potássicos','Insumos Agro','Agropecuária','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('3105','Fertilizantes compostos (NPK)','Insumos Agro','Agropecuária','isencao_plena',1.0,0,'Anexo_III','art. 107',undefined,true),

  // ─── EDUCAÇÃO E CULTURA (Isenção 100%) ───────────────────────────
  entry('4901','Livros impressos','Educação','Educação','isencao_plena',1.0,0,'Anexo_III','art. 107 + CF art. 150 VI d','Imunidade constitucional mantida'),
  entry('4902','Jornais e periódicos impressos','Impressos','Educação','isencao_plena',1.0,0,'Anexo_III','art. 107 + CF art. 150 VI d'),
  entry('4903','Álbuns e livros infantis','Educação','Educação','isencao_plena',1.0,0,'Anexo_III','art. 107'),
  entry('4904','Músicas impressas (partituras)','Educação','Educação','isencao_plena',1.0,0,'Anexo_III','art. 107'),

  // ─── COMBUSTÍVEIS (Regime Monofásico + IS) ────────────────────────
  entry('2709','Petróleo bruto','Combustíveis','Energia','regime_especial',0,0,'art_especifico','art. 139','Tributação monofásica. Crédito vedado na revenda.',false,true),
  entry('2710','Óleos derivados de petróleo','Combustíveis','Energia','regime_especial',0,0.10,'art_especifico','art. 139','Monofásico IBS/CBS + IS. Gasolina, diesel, querosene.',false,true),
  entry('2711','Gás natural e GLP','Gás','Energia','reducao_60',0.6,0,'Anexo_I','art. 120','Gás de cozinha com redução 60%'),
  entry('2712','Vaselina e parafinas','Derivados','Energia','normal',0,0,'nenhum','art. 9'),
  entry('2716','Energia elétrica','Energia Elétrica','Energia','reducao_60',0.6,0,'Anexo_I','art. 120','Fornecimento de energia com redução 60%'),

  // ─── MINERAÇÃO E EXTRAÇÃO (IS) ────────────────────────────────────
  entry('2601','Minérios de ferro e concentrados','Mineração','Mineração','imposto_seletivo',0,0.04,'Anexo_IV','art. 413 §2º','IS sobre bens minerais extraídos'),
  entry('2602','Minérios de manganês','Mineração','Mineração','imposto_seletivo',0,0.04,'Anexo_IV','art. 413 §2º'),
  entry('2603','Minérios de cobre','Mineração','Mineração','imposto_seletivo',0,0.04,'Anexo_IV','art. 413 §2º'),
  entry('2606','Minérios de alumínio (bauxita)','Mineração','Mineração','imposto_seletivo',0,0.04,'Anexo_IV','art. 413 §2º'),
  entry('2614','Minérios de titânio','Mineração','Mineração','imposto_seletivo',0,0.04,'Anexo_IV','art. 413 §2º'),
  entry('2615','Nióbio e tântalo (minérios)','Mineração','Mineração','imposto_seletivo',0,0.04,'Anexo_IV','art. 413 §2º','Brasil é o maior produtor mundial de nióbio'),
  entry('2701','Carvão mineral','Carvão','Mineração','imposto_seletivo',0,0.20,'Anexo_IV','art. 413 (poluição)','Alta alíquota IS por impacto ambiental'),
  entry('7102','Diamantes (naturais)','Pedras Preciosas','Mineração','imposto_seletivo',0,0.04,'Anexo_IV','art. 413 §2º'),

  // ─── VEÍCULOS AUTOMOTORES (IS 7%) ─────────────────────────────────
  entry('8701','Tratores agrícolas','Máquinas Agro','Agrotecnologia','isencao_plena',1.0,0,'Anexo_III','art. 107 (Agropec.)','Tratores para uso agrícola: isentos IBS/CBS'),
  entry('8702','Ônibus/Micro-ônibus','Transporte Coletivo','Transporte','normal',0,0,'nenhum','art. 9'),
  entry('8703','Automóveis de passeio','Veículos','Automotivo','imposto_seletivo',0,0.07,'Anexo_IV','art. 413','IS 7% — possível desconto por eficiência energética (veíc. elétricos)'),
  entry('8704','Veículos comerciais leves','Veículos','Automotivo','imposto_seletivo',0,0.07,'Anexo_IV','art. 413'),
  entry('8705','Veículos especiais','Veículos','Automotivo','normal',0,0,'nenhum','art. 9'),
  entry('8706','Chassis com motor','Veículos','Automotivo','normal',0,0,'nenhum','art. 9'),
  entry('8711','Motocicletas','Veículos','Automotivo','imposto_seletivo',0,0.04,'Anexo_IV','art. 413','IS reduzido para motos'),
  entry('8712','Bicicletas','Transporte Ativo','Transporte','normal',0,0,'nenhum','art. 9','Incentivo à mobilidade limpa — sem IS'),

  // ─── ELETRÔNICOS — ZONA FRANCA DE MANAUS ─────────────────────────
  entry('8471','Computadores e periféricos','Informática','Tecnologia','normal',0,0,'nenhum','art. 9','ZFM: regras específicas para benefícios fiscais regionais'),
  entry('8517','Telefones e smartphones','Telefonia','Tecnologia','normal',0,0,'nenhum','art. 9','ZFM: avaliar permanência dos benefícios'),
  entry('8528','Televisores','Eletrônicos','Tecnologia','normal',0,0,'nenhum','art. 9'),

  // ─── CONSTRUÇÃO CIVIL ─────────────────────────────────────────────
  entry('6901','Tijolos refratários','Construção','Construção Civil','normal',0,0,'nenhum','art. 9'),
  entry('6907','Revestimentos cerâmicos','Construção','Construção Civil','normal',0,0,'nenhum','art. 9'),
  entry('7210','Chapas de ferro ou aço','Metalurgia','Industrial','normal',0,0,'nenhum','art. 9'),
  entry('7308','Estruturas metálicas','Metalurgia','Industrial','normal',0,0,'nenhum','art. 9'),

  // ─── TÊXTEIS E VESTUÁRIO ─────────────────────────────────────────
  entry('5201','Algodão em bruto','Têxtil','Moda','isencao_plena',1.0,0,'Anexo_III','art. 107 (Agropec.)','Insumo agropecuário isento'),
  entry('5209','Tecidos de algodão','Têxtil','Moda','normal',0,0,'nenhum','art. 9'),
  entry('6101','Casacos masculinos (malha)','Vestuário','Moda','normal',0,0,'nenhum','art. 9'),
  entry('6110','Suéteres e similares','Vestuário','Moda','normal',0,0,'nenhum','art. 9'),

  // ─── PRODUTOS DE LIMPEZA E HIGIENE ────────────────────────────────
  entry('3401','Sabão e saponáceos','Limpeza','Higiene','normal',0,0,'nenhum','art. 9'),
  entry('3402','Tensoativos e detergentes','Limpeza','Higiene','normal',0,0,'nenhum','art. 9'),
  entry('3405','Pomadas e cremes (não farmacêuticos)','Cosméticos','Higiene','normal',0,0,'nenhum','art. 9'),
  entry('3405','Ceras e lustres para pisos','Limpeza','Higiene','normal',0,0,'nenhum','art. 9'),

  // ─── SERVIÇOS (CNAES) — Regime Geral ─────────────────────────────
  entry('9999','Serviços financeiros (bancos/seguros)','Serviços Financeiros','Serviços','regime_especial',0,0,'art_especifico','art. 183-201','Regime específico — alíquota diferenciada conforme deliberação'),
  entry('9998','Serviços imobiliários','Serv. Imobiliários','Serviços','regime_especial',0,0,'art_especifico','art. 202-205','Regime específico para locação e incorporação'),
  entry('9997','Saúde (planos e hospitais)','Saúde Privada','Saúde','reducao_60',0.6,0,'Anexo_I','art. 120 + 162','Planos de saúde com redução 60%. Verificar regras de crédito.'),
  entry('9996','Educação (ensino privado)','Ensino Privado','Educação','reducao_60',0.6,0,'Anexo_I','art. 120 + 168','Serviços educacionais privados com redução 60%'),
  entry('9995','Transporte público municipal','Transporte Coletivo','Transporte','isencao_plena',1.0,0,'Anexo_III','art. 107','Ônibus municipais e metrô: isenção plena IBS/CBS'),
  entry('9994','Transporte intermunicipal/ferroviário','Transporte','Transporte','reducao_60',0.6,0,'Anexo_I','art. 120','Transporte de passageiros inter-urban com redução 60%'),
  entry('9993','Serviços agropecuários diretos','Agro-serviços','Agropecuária','isencao_plena',1.0,0,'Anexo_III','art. 107 (Agropec.)','Arrendamento rural, produção animal etc.'),
  entry('9992','Saneamento básico público','Saneamento','Utilities','isencao_plena',1.0,0,'Anexo_III','art. 107','Água e esgoto por concessionária pública'),
  entry('9991','Comunicações (telecom)','Telecom','Tecnologia','normal',0,0,'nenhum','art. 9','Alíquota cheia IBS+CBS. Sem redução prevista.'),
];

// ── Funções de consulta ──────────────────────────────────────

/** Busca todos os registros do banco de NCMs */
export function getAllNCMs(): NCMEntry[] {
  return NCM_DATABASE;
}

/** Busca por código NCM (prefixo 2, 4 ou 8 dígitos) */
export function consultarPorNCM(ncm: string): NCMEntry | null {
  const clean = ncm.replace(/\D/g, '');
  for (const len of [8, 6, 4, 2]) {
    const prefix = clean.slice(0, len);
    const found = NCM_DATABASE.find(e => e.ncm === prefix);
    if (found) return found;
  }
  return null;
}

/** Busca textual no banco por NCM, descrição, categoria ou setor */
export function pesquisarNCM(query: string): NCMEntry[] {
  if (!query.trim()) return NCM_DATABASE;
  const q = query.toLowerCase().trim();
  return NCM_DATABASE.filter(e =>
    e.ncm.includes(q) ||
    e.descricao.toLowerCase().includes(q) ||
    e.categoria.toLowerCase().includes(q) ||
    e.setor.toLowerCase().includes(q) ||
    e.tratamento.toLowerCase().includes(q) ||
    e.baseLegal.toLowerCase().includes(q) ||
    (e.observacao?.toLowerCase().includes(q))
  );
}

/** Filtra por setor econômico */
export function filtrarPorSetor(setor: string): NCMEntry[] {
  return NCM_DATABASE.filter(e => e.setor === setor);
}

/** Lista setores únicos */
export function listarSetores(): string[] {
  return Array.from(new Set(NCM_DATABASE.map(e => e.setor))).sort();
}

/** Lista tratamentos únicos */
export function listarTratamentos(): TratamentoReforma[] {
  return Array.from(new Set(NCM_DATABASE.map(e => e.tratamento))) as TratamentoReforma[];
}

/** Labels amigáveis para tratamento */
export const TRATAMENTO_LABELS: Record<TratamentoReforma, string> = {
  isencao_plena: 'Isenção Plena (0%)',
  reducao_60: 'Redução 60%',
  regime_especial: 'Regime Especial',
  imposto_seletivo: 'Imposto Seletivo',
  normal: 'Alíquota Normal (26.5%)',
};

export const TRATAMENTO_COLORS: Record<TratamentoReforma, string> = {
  isencao_plena: 'var(--green)',
  reducao_60: 'var(--blue)',
  regime_especial: 'var(--orange)',
  imposto_seletivo: 'var(--red)',
  normal: 'var(--text-secondary)',
};

export const TRATAMENTO_BADGE: Record<TratamentoReforma, string> = {
  isencao_plena: 'badge-green',
  reducao_60: 'badge-blue',
  regime_especial: 'badge-yellow',
  imposto_seletivo: 'badge-red',
  normal: 'badge-gray',
};
