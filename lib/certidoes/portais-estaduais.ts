// ============================================================
// Portais oficiais de certidão estadual, das 27 unidades da federação
// ============================================================
// Só links: nenhuma SEFAZ está integrada, e a certidão é emitida no portal do estado.
// Endereços diretos da tela de emissão, passados pelo escritório em novembro de 2026.
// Mudam com frequência: quando um estado trocar de sistema, corrija aqui.

export interface LinkCertidao {
  rotulo: string;
  url: string;
}

export interface PortalEstadual {
  nome: string;
  links: LinkCertidao[];
  /** O que muda em relação a "informar o CNPJ e emitir". */
  observacao?: string;
}

const CND = 'Emitir certidão';
const DIVIDA_ATIVA = 'Dívida ativa';

export const PORTAIS_ESTADUAIS: Record<string, PortalEstadual> = {
  AC: {
    nome: 'Acre',
    links: [{ rotulo: CND, url: 'https://sefazonline.ac.gov.br/sefazonline/app.cndprincipal' }, { rotulo: DIVIDA_ATIVA, url: 'https://www.sitad.ac.gov.br/certidao.aspx' }],
    observacao: 'A certidão da dívida ativa (PGE) não substitui a da SEFAZ.',
  },
  AL: { nome: 'Alagoas', links: [{ rotulo: CND, url: 'https://contribuinte.sefaz.al.gov.br/certidao/#/emitir-certidao' }] },
  AM: {
    nome: 'Amazonas',
    links: [{ rotulo: CND, url: 'https://sistemas.sefaz.am.gov.br/GAE/mnt/dividaAtiva/certidaoNegativa/emitirCertidaoNegativaNaoContPortal.do' }],
    observacao: 'Esta tela é para quem não tem inscrição de ICMS no Amazonas. Contribuinte pode precisar do acesso com certificado digital.',
  },
  AP: { nome: 'Amapá', links: [{ rotulo: CND, url: 'https://www.sefaz.ap.gov.br/sate/seg/SEGf_AcessarFuncao.jsp?cdFuncao=DIA_060' }] },
  BA: {
    nome: 'Bahia',
    links: [{ rotulo: CND, url: 'https://servicos.sefaz.ba.gov.br/sistemas/DSCRE/Modulos/Publico/EmissaoCertidao.aspx' }, { rotulo: DIVIDA_ATIVA, url: 'https://dividaativa.pge.ba.gov.br/portal-divida-ativa/portal/certidao-regularidade' }],
    observacao: 'A dívida ativa fica com a PGE, em certidão separada.',
  },
  CE: { nome: 'Ceará', links: [{ rotulo: CND, url: 'https://consultapublica.sefaz.ce.gov.br/certidaonegativa/preparar-consultar' }] },
  DF: { nome: 'Distrito Federal', links: [{ rotulo: CND, url: 'https://ww1.receita.fazenda.df.gov.br/cidadao/certidoes/Certidao' }] },
  ES: { nome: 'Espírito Santo', links: [{ rotulo: CND, url: 'https://s2-internet.sefaz.es.gov.br/certidao/cnd' }] },
  GO: { nome: 'Goiás', links: [{ rotulo: CND, url: 'https://www.sefaz.go.gov.br/Certidao/Emissao/' }] },
  MA: {
    nome: 'Maranhão',
    links: [{ rotulo: CND, url: 'https://sistemas1.sefaz.ma.gov.br/certidoes/jsp/emissaoCertidaoNegativa/emissaoCertidaoNegativa.jsf' }, { rotulo: DIVIDA_ATIVA, url: 'http://sistemas.sefaz.ma.gov.br/sco/portal/' }],
    observacao: 'A certidão da dívida ativa (CNDA) é separada, no menu Certidões do portal.',
  },
  MG: {
    nome: 'Minas Gerais',
    links: [{ rotulo: CND, url: 'https://cdt.fazenda.mg.gov.br/' }],
    observacao: 'Exige login gov.br, e cada filial é emitida à parte.',
  },
  MS: { nome: 'Mato Grosso do Sul', links: [{ rotulo: CND, url: 'https://servicos.efazenda.ms.gov.br/pndfis/Home/Emissao' }] },
  MT: {
    nome: 'Mato Grosso',
    links: [{ rotulo: 'Certidão conjunta SEFAZ/PGE', url: 'https://www.sefaz.mt.gov.br/cnd/certidao/servlet/ServletRotdAberto?origem=60' }],
    observacao: 'Com inscrição estadual, usa login da SEFAZ. Sem inscrição, gov.br ou certificado digital.',
  },
  PA: {
    nome: 'Pará',
    links: [{ rotulo: CND, url: 'https://app.sefa.pa.gov.br/emissao-certidao/template.action' }],
    observacao: 'A emissão pode pedir login com certificado digital. Débitos tributários e não tributários têm certidões separadas.',
  },
  PB: { nome: 'Paraíba', links: [{ rotulo: CND, url: 'https://www.sefaz.pb.gov.br/servirtual/certidoes/emissao-de-certidao-de-debitos-cidadao' }] },
  PE: {
    nome: 'Pernambuco',
    links: [{ rotulo: CND, url: 'https://efisco.sefaz.pe.gov.br/sfi_trb_gpf/PREmitirCertidaoNegativaNarrativaDebitoFiscal' }],
    observacao: 'Leva ao login do e-Fisco. Débitos com menos de 30 dias não aparecem na certidão.',
  },
  PI: {
    nome: 'Piauí',
    links: [
      { rotulo: 'Portal da SEFAZ', url: 'https://siatweb.sefaz.pi.gov.br/portal-publico/' },
      { rotulo: DIVIDA_ATIVA, url: 'https://pidigital.pi.gov.br/app/catalog/financas-e-pagamentos/emitir-certidao-negativa-divida-ativa' },
    ],
    observacao: 'A certidão da dívida ativa (CNDA) é separada e pede login no Gov.pi Cidadão.',
  },
  PR: { nome: 'Paraná', links: [{ rotulo: CND, url: 'https://cdwfazenda.paas.pr.gov.br/cdwportal/certidao/automatica' }] },
  RJ: {
    nome: 'Rio de Janeiro',
    links: [{ rotulo: 'Certidão conjunta SEFAZ/PGE', url: 'https://crf-unificada-web.fazenda.rj.gov.br/crf-unificada-web/#/' }, { rotulo: DIVIDA_ATIVA, url: 'https://pge.rj.gov.br/divida-ativa-certidao-de-regularidade-fiscal' }],
    observacao: 'Certidão conjunta lançada em outubro de 2026. Dívida ativa com exigibilidade suspensa ainda é pedida à parte, na PGE.',
  },
  RN: { nome: 'Rio Grande do Norte', links: [{ rotulo: 'Certidão conjunta', url: 'https://uvt2.set.rn.gov.br/#/services/certidao-negativa/emitir' }] },
  RO: { nome: 'Rondônia', links: [{ rotulo: CND, url: 'https://portalcontribuinte.sefin.ro.gov.br/Publico/certidaoNegativa.jsp' }] },
  RR: {
    nome: 'Roraima',
    links: [{ rotulo: CND, url: 'https://portalweb.sefaz.rr.gov.br/cnd/servlet/wp_siate_emitircndcentralservicopublica' }, { rotulo: 'Página da SEFAZ', url: 'https://www.sefaz.rr.gov.br/empresa/certidao-negativa-de-debitos' }],
  },
  RS: { nome: 'Rio Grande do Sul', links: [{ rotulo: CND, url: 'https://www.sefaz.rs.gov.br/sat/CertidaoSitFiscalSolic.aspx' }] },
  SC: { nome: 'Santa Catarina', links: [{ rotulo: CND, url: 'https://tributario.sef.sc.gov.br/tax.NET/Sat.CtaCte.Web/SolicitacaoCnd.aspx' }] },
  SE: { nome: 'Sergipe', links: [{ rotulo: CND, url: 'https://www.sefaz.se.gov.br/SitePages/emissao_certidao_negativa.aspx' }] },
  SP: {
    nome: 'São Paulo',
    links: [{ rotulo: 'Certidão Única de Débitos', url: 'https://www4.fazenda.sp.gov.br/SIDEB/CertidaoNegativaDebitos/EmitirECND' }],
    observacao: 'Desde 14/10/2026, um único documento reúne SEFAZ e dívida ativa (PGE). Leva ao login do estado.',
  },
  TO: { nome: 'Tocantins', links: [{ rotulo: CND, url: 'https://www.to.gov.br/sefaz/cnd-certidao-negativa-de-debitos/7h3xx8lr88vg' }] },
};

export const UFS = Object.keys(PORTAIS_ESTADUAIS).sort();

export const portalDaUf = (uf: string | null | undefined): PortalEstadual | null =>
  PORTAIS_ESTADUAIS[(uf || '').trim().toUpperCase()] || null;
