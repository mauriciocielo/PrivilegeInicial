'use client';

import { useState, useMemo, useCallback } from 'react';
import type { NfsE, Empresa } from '../lib/store';
import { fmt } from '../lib/reports';
import type { NfseConfigResposta } from './NfseConfigModal';
import {
  Sparkles, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  Building2, ReceiptText, Coins, ShieldCheck, FileWarning, RefreshCw,
  ChevronDown, ChevronUp, ArrowRight, BrainCircuit, Lightbulb, type LucideIcon
} from 'lucide-react';
import { Instrument_Serif } from 'next/font/google';

const serif = Instrument_Serif({ subsets: ['latin'], weight: ['400'] });

export interface NfseInsightItem {
  id: string;
  tipo: 'positivo' | 'alerta' | 'perigo' | 'estrategico';
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  badge?: string;
  acaoRotulo?: string;
  aoClicarAcao?: () => void;
}

interface NfseInsightsProps {
  notas: NfsE[];
  empresa: Empresa | null;
  config: NfseConfigResposta | null;
  papelFiltro: 'prestadas' | 'tomadas';
  mesFiltro?: string;
  onFiltrarRascunhos?: () => void;
  onFiltrarTomadas?: () => void;
  onFiltrarPrestadas?: () => void;
  onBuscarTomador?: (termo: string) => void;
  onAbrirConfig?: () => void;
  onAbrirCopilot?: () => void;
}

export default function NfseInsights({
  notas,
  empresa,
  config,
  papelFiltro,
  mesFiltro,
  onFiltrarRascunhos,
  onFiltrarTomadas,
  onFiltrarPrestadas,
  onBuscarTomador,
  onAbrirConfig,
  onAbrirCopilot,
}: NfseInsightsProps) {
  const [expandido, setExpandido] = useState(true);
  const [analiseIaGerada, setAnaliseIaGerada] = useState<string | null>(null);
  const [gerandoIa, setGerandoIa] = useState(false);

  // 1. Geração determinística de insights instantâneos a partir dos dados da empresa
  const insightsDeterministas = useMemo<NfseInsightItem[]>(() => {
    const list: NfseInsightItem[] = [];
    if (!empresa) return list;

    const cnpjEmpresaLimpo = (empresa.cnpj || '').replace(/\D/g, '');

    // Separação em prestadas (emitidas) e tomadas (recebidas)
    const notasPrestadas = notas.filter(n => {
      const cnpjPrestador = (n.prestadorCnpj || '').replace(/\D/g, '');
      return n.status !== 'rascunho' && cnpjPrestador === cnpjEmpresaLimpo;
    });

    const notasRascunho = notas.filter(n => n.status === 'rascunho');

    const notasTomadas = notas.filter(n => {
      const cnpjPrestador = (n.prestadorCnpj || '').replace(/\D/g, '');
      return n.status !== 'rascunho' && cnpjPrestador && cnpjPrestador !== cnpjEmpresaLimpo;
    });

    const totalFaturado = notasPrestadas.reduce((acc, n) => acc + (n.valorServicos || 0), 0);
    const totalTomado = notasTomadas.reduce((acc, n) => acc + (n.valorServicos || 0), 0);

    // REGRA 1: Rascunhos aguardando emissão oficial
    if (notasRascunho.length > 0) {
      const totalRascunho = notasRascunho.reduce((acc, n) => acc + (n.valorServicos || 0), 0);
      list.push({
        id: 'rascunhos_pendentes',
        tipo: 'alerta',
        icone: FileWarning,
        titulo: `${notasRascunho.length} Rascunho(s) Aguardando Transmissão`,
        descricao: `Existem R$ ${fmt.currency(totalRascunho)} em notas salvas que ainda não foram enviadas ao Sefin Nacional. Verifique antes do fechamento da competência.`,
        badge: 'Ação Recomendada',
        acaoRotulo: 'Ver rascunhos',
        aoClicarAcao: onFiltrarRascunhos,
      });
    }

    // REGRA 2: Concentração de Tomadores (Risco de Carteira / Dependência)
    if (notasPrestadas.length >= 2 && totalFaturado > 0) {
      const tomadoresMap = new Map<string, { nome: string; doc: string; valor: number; qtd: number }>();
      for (const n of notasPrestadas) {
        const chave = n.tomadorCnpjCpf || n.tomadorRazaoSocial || 'desconhecido';
        const atual = tomadoresMap.get(chave) || {
          nome: n.tomadorRazaoSocial || 'Tomador',
          doc: n.tomadorCnpjCpf || '',
          valor: 0,
          qtd: 0,
        };
        atual.valor += n.valorServicos || 0;
        atual.qtd += 1;
        tomadoresMap.set(chave, atual);
      }

      const ordenados = Array.from(tomadoresMap.values()).sort((a, b) => b.valor - a.valor);
      const maiorTomador = ordenados[0];
      if (maiorTomador && maiorTomador.valor > 0) {
        const pct = (maiorTomador.valor / totalFaturado) * 100;
        if (pct >= 35) {
          list.push({
            id: 'concentracao_tomador',
            tipo: pct >= 60 ? 'alerta' : 'estrategico',
            icone: Building2,
            titulo: `Concentração de Receita: ${pct.toFixed(0)}% com ${maiorTomador.nome}`,
            descricao: `O cliente ${maiorTomador.nome} representa R$ ${fmt.currency(maiorTomador.valor)} (${maiorTomador.qtd} nota(s)). Alto índice de dependência econômica nesta competência.`,
            badge: pct >= 60 ? 'Risco Alto' : 'Concentrado',
            acaoRotulo: 'Filtrar cliente',
            aoClicarAcao: () => onBuscarTomador?.(maiorTomador.doc || maiorTomador.nome),
          });
        }
      }
    }

    // REGRA 3: Retenções na Fonte (Créditos Tributários & Fluxo de Caixa)
    let totalRetencoes = 0;
    let totalIssRetido = 0;
    for (const n of notasPrestadas) {
      const pis = n.valorPis || 0;
      const cofins = n.valorCofins || 0;
      const csll = n.valorCsll || 0;
      const ir = n.valorIr || 0;
      const inss = n.valorInss || 0;
      const iss = n.issRetido ? (n.valorIss || 0) : 0;
      totalRetencoes += (pis + cofins + csll + ir + inss);
      totalIssRetido += iss;
    }

    if (totalRetencoes > 0 || totalIssRetido > 0) {
      list.push({
        id: 'retencoes_tributarias',
        tipo: 'estrategico',
        icone: Coins,
        titulo: `R$ ${fmt.currency(totalRetencoes + totalIssRetido)} Retidos na Fonte`,
        descricao: `Tributos federais (R$ ${fmt.currency(totalRetencoes)}) e ISS retido (R$ ${fmt.currency(totalIssRetido)}) deduzem o valor a pagar na guia mensal da Receita/Prefeitura e preservam seu caixa contra bitributação.`,
        badge: 'Crédito Fiscal',
      });
    }

    // REGRA 4: Saldo Operacional de Serviços (Prestados vs Tomados)
    if (totalFaturado > 0 && totalTomado > 0) {
      const saldoServicos = totalFaturado - totalTomado;
      const proporcaoTomados = (totalTomado / totalFaturado) * 100;

      if (saldoServicos > 0) {
        list.push({
          id: 'saldo_servicos_positivo',
          tipo: 'positivo',
          icone: TrendingUp,
          titulo: `Superávit em Serviços: R$ ${fmt.currency(saldoServicos)}`,
          descricao: `A empresa faturou R$ ${fmt.currency(totalFaturado)} e terceirizou R$ ${fmt.currency(totalTomado)} (${proporcaoTomados.toFixed(1)}% de terceirização sobre o faturamento).`,
          badge: 'Equilíbrio Saudável',
          acaoRotulo: 'Ver tomadas',
          aoClicarAcao: onFiltrarTomadas,
        });
      } else {
        list.push({
          id: 'saldo_servicos_negativo',
          tipo: 'perigo',
          icone: TrendingDown,
          titulo: `Volume Tomado Supera Emitido (-R$ ${fmt.currency(Math.abs(saldoServicos))})`,
          descricao: `Neste período, os serviços tomados de fornecedores (R$ ${fmt.currency(totalTomado)}) foram superiores às notas de serviços prestadas (R$ ${fmt.currency(totalFaturado)}).`,
          badge: 'Atenção aos Custos',
          acaoRotulo: 'Ver notas tomadas',
          aoClicarAcao: onFiltrarTomadas,
        });
      }
    }

    // REGRA 5: Saúde do Certificado Digital A1 ou Procuração
    const cert = config?.certificado;
    if (cert?.validoAte) {
      const dVenc = new Date(cert.validoAte).getTime();
      const diasRestantes = Math.ceil((dVenc - Date.now()) / (1000 * 60 * 60 * 24));
      if (diasRestantes <= 0) {
        list.push({
          id: 'cert_vencido',
          tipo: 'perigo',
          icone: AlertTriangle,
          titulo: 'Certificado Digital A1 Vencido',
          descricao: 'O certificado digital cadastrado expirou. A transmissão de novas NFS-e ficará bloqueada na SEFIN até o envio do novo arquivo .pfx.',
          badge: 'Crítico',
          acaoRotulo: 'Renovar certificado',
          aoClicarAcao: onAbrirConfig,
        });
      } else if (diasRestantes <= 30) {
        list.push({
          id: 'cert_vencendo',
          tipo: 'alerta',
          icone: ShieldCheck,
          titulo: `Certificado Vence em ${diasRestantes} Dia(s)`,
          descricao: `O certificado A1 expira em ${new Date(cert.validoAte).toLocaleDateString('pt-BR')}. Agende a renovação para não interromper o faturamento.`,
          badge: 'Renovação Próxima',
          acaoRotulo: 'Configurar emissor',
          aoClicarAcao: onAbrirConfig,
        });
      }
    }

    // Se nenhuma nota ou se estiver tudo limpo
    if (list.length === 0 && notas.length > 0) {
      list.push({
        id: 'operacao_regular',
        tipo: 'positivo',
        icone: CheckCircle2,
        titulo: 'Operação Fiscal Regular e Saudável',
        descricao: `${notasPrestadas.length} nota(s) emitida(s) somando R$ ${fmt.currency(totalFaturado)} com sequência e retenções em conformidade.`,
        badge: 'Tudo em Ordem',
      });
    }

    return list;
  }, [notas, empresa, config, onFiltrarRascunhos, onFiltrarTomadas, onBuscarTomador, onAbrirConfig]);

  // 2. Consulta à IA Generativa (Gemini) para diagnóstico estratégico avançado
  const gerarAnaliseComIa = useCallback(async () => {
    try {
      setGerandoIa(true);
      const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyApsKGqQWqF6LeABZG2fNdzXp4G9_wTq6s';

      const totalPrestadas = notas.filter(n => n.status !== 'rascunho').reduce((s, n) => s + (n.valorServicos || 0), 0);
      const totalRascunho = notas.filter(n => n.status === 'rascunho').length;
      const servicosUnicos = Array.from(new Set(notas.map(n => n.discriminacao).filter(Boolean))).slice(0, 5).join('; ');

      const prompt = `Você é o Auditor e Analista Fiscal de Elite do sistema.
Analise a situação de emissão e tomada de NFS-e (Notas Fiscais de Serviço Eletrônicas) da empresa:
- Razão Social: ${empresa?.razaoSocial || 'Cliente'}
- CNPJ: ${empresa?.cnpj || 'Não informado'}
- Faturamento de Serviços no Período: R$ ${totalPrestadas.toLocaleString('pt-BR')}
- Quantidade Total de Notas Registradas: ${notas.length}
- Notas em Rascunho (não transmitidas): ${totalRascunho}
- Principais Serviços Prestados/Tomados: ${servicosUnicos || 'Serviços em geral'}

Escreva um parecer executivo conciso em 3 pontos objetivos:
1. Avaliação do Volume e Faturamento de Serviços (tendência e regularidade);
2. Ponto de Atenção Contábil/Tributário (retenções na fonte, alíquotas ou rascunhos);
3. Recomendação Estratégica para o Próximo Mês.

Responda em linguagem direta, profissional, em Português do Brasil, formatado com tópicos claros.`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!res.ok) throw new Error('Falha na comunicação com o Gemini');
      const data = await res.json();
      const respostaTexto = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (respostaTexto) {
        setAnaliseIaGerada(respostaTexto);
      }
    } catch (err) {
      console.error('Erro ao gerar análise profunda de NFS-e com IA:', err);
      setAnaliseIaGerada('Não foi possível conectar com o motor de IA no momento. Consulte as recomendações automáticas acima.');
    } finally {
      setGerandoIa(false);
    }
  }, [notas, empresa]);

  if (!empresa) return null;

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 20,
        padding: '22px 24px',
        marginBottom: 24,
        boxShadow: '0 4px 12px -2px rgba(0,0,0,0.03)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Cabeçalho do Bloco de Insights */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          paddingBottom: expandido ? 18 : 0,
          borderBottom: expandido ? '1px solid #f3f4f6' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #600000 0%, #8b0000 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(96,0,0,0.25)',
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  background: '#fef2f2',
                  color: '#991b1b',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 99,
                  letterSpacing: '0.04em',
                }}
              >
                Inteligência Fiscal IA
              </span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                {insightsDeterministas.length} diagnóstico(s) identificado(s)
              </span>
            </div>
            <h2
              className={serif.className}
              style={{
                fontSize: 22,
                fontWeight: 400,
                color: '#111827',
                margin: '2px 0 0',
                lineHeight: 1.1,
              }}
            >
              Auditoria & Insights de Notas de Serviço
            </h2>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={gerarAnaliseComIa}
            disabled={gerandoIa}
            style={{
              background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: gerandoIa ? 'wait' : 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            }}
          >
            <BrainCircuit size={14} className={gerandoIa ? 'animate-spin' : ''} />
            {gerandoIa ? 'Auditando com IA...' : (analiseIaGerada ? 'Atualizar Parecer IA' : 'Parecer Completo com IA')}
          </button>

          {onAbrirCopilot && (
            <button
              type="button"
              onClick={onAbrirCopilot}
              style={{
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #e5e7eb',
                padding: '8px 14px',
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <Lightbulb size={14} color="#600000" />
              Perguntar ao Copiloto
            </button>
          )}

          <button
            type="button"
            onClick={() => setExpandido(!expandido)}
            style={{
              background: 'transparent',
              border: '1px solid #e5e7eb',
              color: '#6b7280',
              padding: '8px 10px',
              borderRadius: 10,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            title={expandido ? 'Minimizar Insights' : 'Expandir Insights'}
          >
            {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Conteúdo Expansível */}
      {expandido && (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Grid de Cards de Insights Fiscais */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            {insightsDeterministas.map(item => {
              const Icone = item.icone;
              const cores = {
                positivo: { borda: '#86efac', bg: '#f0fdf4', texto: '#166534', acento: '#16a34a' },
                alerta: { borda: '#fde047', bg: '#fefce8', texto: '#854d0e', acento: '#ca8a04' },
                perigo: { borda: '#fca5a5', bg: '#fef2f2', texto: '#991b1b', acento: '#dc2626' },
                estrategico: { borda: '#bae6fd', bg: '#f0f9ff', texto: '#075985', acento: '#0284c7' },
              }[item.tipo];

              return (
                <div
                  key={item.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderLeft: `4px solid ${cores.acento}`,
                    borderRadius: 14,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: cores.bg,
                            color: cores.acento,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icone size={15} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                          {item.titulo}
                        </span>
                      </div>
                      {item.badge && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 99,
                            background: cores.bg,
                            color: cores.texto,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 12.5, color: '#4b5563', lineHeight: 1.5 }}>
                      {item.descricao}
                    </p>
                  </div>

                  {item.acaoRotulo && item.aoClicarAcao && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                      <button
                        type="button"
                        onClick={item.aoClicarAcao}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          color: '#600000',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {item.acaoRotulo} <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bloco de Parecer Profundo Gerado pela IA (Gemini) */}
          {analiseIaGerada && (
            <div
              style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #1e293b 100%)',
                color: '#ffffff',
                borderRadius: 16,
                padding: '20px 24px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BrainCircuit size={18} color="#a5b4fc" />
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#c7d2fe' }}>
                    Parecer do Auditor Fiscal IA (Gemini 2.5 Flash)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAnaliseIaGerada(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  ✕ Fechar
                </button>
              </div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: '#e2e8f0',
                  whiteSpace: 'pre-line',
                }}
              >
                {analiseIaGerada}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

