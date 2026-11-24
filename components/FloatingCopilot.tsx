'use client';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { store } from '../lib/store';
import { fmt } from '../lib/reports';
import { askClaudeDetailed } from '../lib/claude-client';
import { Brain, Send, X } from 'lucide-react';
import MarkdownLeve from './ui/MarkdownLeve';

// Telas fiscais: aqui o copilot troca o contexto financeiro pelo fiscal (notas, CND, certificados).
const EH_TELA_FISCAL = (p: string) => /\/dashboard2|\/nfe-destinadas|\/nfse|\/cnd-federal/.test(p);
const EH_TELA_COMERCIAL_MKT = (p: string) => /\/comercial|\/marketing|\/curva-abc/.test(p);
const EH_TELA_SAAS = (p: string) => /\/saas/.test(p);

function getVisibleScreenSnapshot(): string {
  if (typeof document === 'undefined') return '';
  try {
    const mainEl = document.querySelector('main') || document.body;
    const text = (mainEl as HTMLElement)?.innerText || '';
    return text.replace(/\s+/g, ' ').trim().slice(0, 3200);
  } catch {
    return '';
  }
}

interface Message {
  sender: 'ai' | 'user';
  text: string;
  /** Aviso de falha: aparece na conversa, mas não volta para a IA como histórico. */
  erro?: boolean;
  timestamp: string;
}

export default function FloatingCopilot() {
  const pathname = usePathname() || '';
  const ehFiscal = EH_TELA_FISCAL(pathname);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: 'Olá! Sou seu Copiloto de Inteligência Financeira. Estou em todas as telas para te auxiliar. Como posso ajudar com os dados da empresa hoje?',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  // A escolha do motor fica no servidor (Groq → Ollama → configuração → Gemini → Claude → OpenAI).
  const provider = 'auto' as const;
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Outras telas (ex.: o Dashboard Fiscal) podem abrir o copilot por um evento.
  useEffect(() => {
    const abrir = () => setOpen(true);
    window.addEventListener('abrirCopilotoFiscal', abrir);
    return () => window.removeEventListener('abrirCopilotoFiscal', abrir);
  }, []);

  const sendMessage = async (overrideText?: string) => {
    const finalInput = (overrideText ?? input).trim();
    if (!finalInput) return;

    const userMsg: Message = { sender: 'user', text: finalInput, timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideText) setInput('');
    setLoading(true);

    const visibleSnapshot = getVisibleScreenSnapshot();
    const ehComercialMkt = EH_TELA_COMERCIAL_MKT(pathname);
    const ehSaas = EH_TELA_SAAS(pathname);

    let contextStr = '';
    let systemInstruction = '';

    if (ehFiscal) {
      // Painel fiscal: o mesmo copilot, agora com o contexto da carteira fiscal (notas, CND, certificados, monitor).
      let resumo: any = null;
      try {
        const r = await fetch('/api/dashboard2/resumo');
        if (r.ok) resumo = (await r.json())?.resumo;
      } catch { /* segue sem o resumo; a IA avisa que não carregou */ }

      if (resumo) {
        const n = resumo.notas || {};
        const c = resumo.cnds || {};
        const cert = resumo.certificados || {};
        const mon = resumo.monitor || {};
        contextStr = `
CONTEXTO FISCAL DA CARTEIRA (consolidado de ${resumo.totalEmpresas ?? '?'} empresa(s)):
Notas fiscais: ${n.totalGeral ?? 0} no total — ${n.totalNfe ?? 0} NF-e, ${n.totalCte ?? 0} CT-e, ${n.totalNfse ?? 0} NFS-e. Valor movimentado: ${fmt.currency(n.valorTotal || 0)}.
NF-e: ${n.totalNfeEmitidas ?? 0} emitidas / ${n.totalNfeRecebidas ?? 0} recebidas. NFS-e: ${n.totalNfseEmitidas ?? 0} emitidas / ${n.totalNfseTomadas ?? 0} tomadas.
Situação fiscal (CND/SITFIS): ${c.semPendencias ?? 0} sem pendências, ${c.comEfeito ?? 0} com débito suspenso (positiva c/ efeito de negativa), ${c.comPendencias ?? 0} com pendências, ${c.atencao ?? 0} a conferir, ${c.naoConsultadas ?? 0} não consultadas.
Certificados A1: ${cert.comCertificado ?? 0} ativos, ${cert.comProcuracao ?? 0} por procuração, ${cert.vencendo30d ?? 0} vencendo em 30 dias, ${cert.vencidos ?? 0} vencidos, ${cert.semCertificado ?? 0} sem certificado.
Monitor automático: ${mon.totalAtivos ?? 0} empresa(s) ativa(s), ${mon.erros24h ?? 0} erro(s) nas últimas 24h.`;
      } else {
        contextStr = 'Não foi possível carregar o resumo fiscal da carteira agora. Responda com base no que o analista descrever e sugira recarregar o painel.';
      }

      systemInstruction = `Você é o "Privilege Copilot Fiscal", assistente de IA acoplado ao painel fiscal do escritório contábil "Privilege" (NF-e, CT-e, NFS-e, certidões/CND e certificados digitais).
Um analista fiscal está olhando o painel agora. Baseie-se no contexto consolidado da carteira:
${contextStr}

Regras:
1. Responda sempre em Markdown conciso e profissional, rápido e direto ao ponto. O chat é um painel estreito: prefira títulos curtos e bullet points; evite tabelas (se usar, no máximo 2 colunas).
2. Ajude o analista a PRIORIZAR: certidões com pendência ou vencendo, certificados A1 a vencer, empresas sem consulta, erros do monitor. Sempre sugira a próxima ação concreta.
3. Use só os números do contexto; pode fazer deduções simples, mas nunca invente valores, nomes de empresas ou situações que não estão no contexto.
4. Quando pertinente, lembre que a CND só tem validade se emitida no portal oficial (Receita/SEFAZ) e que o relatório SITFIS não é certidão.`;
    } else {
      // Puxa Contexto dinâmico ativo (financeiro)
      const empresaId = sessionStorage.getItem('cf_empresa_sel') || store.getSafeEmpresaId() || store.getEmpresas()[0]?.id;
      const empresa = store.getEmpresas().find(e => e.id === empresaId);

      contextStr = 'Nenhuma empresa selecionada.';
      if (empresaId && empresa) {
        const lancs = store.getLancamentos(empresaId).filter(l => l.status === 'realizado');
        const ports = store.getPortadores(empresaId);
        const caixa = ports.reduce((acc, p) => acc + store.getSaldoPortador(p.id, p.empresaId), 0);

        const mesAtual = new Date().toISOString().slice(0, 7);
        const lancsMes = lancs.filter(l => l.data.startsWith(mesAtual));
        const rM = lancsMes.filter(l => l.tipo === 'receita').reduce((a,l) => a+l.valor, 0);
        const dM = lancsMes.filter(l => l.tipo === 'despesa').reduce((a,l) => a+l.valor, 0);

        // Inteligência Global Compartilhada
        const docs = store.getInteligenciaDocs() || [];
        const dContext = docs.filter(d => d.type.startsWith('text/') || d.name.endsWith('.txt')).map(d => `- ${d.name}: ${d.content.substring(0,250)}`).join('\n');

        let comercialMktStr = '';
        if (ehComercialMkt) {
          try {
            const comRes = await fetch(`/api/comercial?empresaId=${encodeURIComponent(empresaId)}`);
            if (comRes.ok) {
              const comJson = await comRes.json();
              if (comJson?.data) {
                comercialMktStr = `\nDADOS COMERCIAL & MARKETING DA EMPRESA:\n${JSON.stringify(comJson.data).slice(0, 2600)}`;
              }
            }
          } catch {}
        }

        let saasStr = '';
        if (ehSaas) {
          try {
            const saasRes = await fetch('/api/saas');
            if (saasRes.ok) {
              const saasJson = await saasRes.json();
              saasStr = `\nDADOS BACKOFFICE SAAS:\nAssinantes: ${saasJson?.tenants?.length || 0}, Movimentações: ${saasJson?.movements?.length || 0}, Stats: ${JSON.stringify(saasJson?.platformStats || {})}`;
            }
          } catch {}
        }

        contextStr = `
ROTA ATUAL: ${pathname}
CONTEXTO DA EMPRESA SESSÃO ATIVA:
Empresa: ${empresa.razaoSocial}
Saldo de Caixa Atual: ${fmt.currency(caixa)}
Mês Corrente (${mesAtual}): Receitas: ${fmt.currency(rM)} / Despesas: ${fmt.currency(dM)}
Total de registros processados: ${lancs.length}
Políticas globais da empresa:
- Cobrança: ${empresa.politicaCobrancaTexto || 'N/A'}
- Pagamento: ${empresa.politicaPagamentosTexto || 'N/A'}
${comercialMktStr}
${saasStr}

CONTEÚDO VISÍVEL NA TELA / RELATÓRIO ATUAL:
${visibleSnapshot || 'N/A'}

Diretrizes Base de Conhecimento:
${dContext}
      `;
      }

      systemInstruction = `Você é o "Privilege Copilot 360º", inteligência analítica acoplada globalmente no sistema ERP/SaaS da Privilege Contabilidade e Consultoria.
Você analisa dashboards, relatórios financeiros, comerciais, de marketing, fiscais e SaaS em tempo real.
Responda baseado no contexto injetado da tela e da empresa:
${contextStr}

Regras:
1. Responda sempre em Markdown com formatação profissional, limpa e espaçada, mas seja conciso e prático. O chat é um painel estreito: prefira títulos curtos e bullet points; evite tabelas (se usar, no máximo 2 colunas).
2. Analise os números e tabelas visíveis na tela atual e dê recomendações acionáveis para gerar mais caixa, lucro, conversão ou segurança fiscal. Nunca invente números fora do contexto.
3. Se perguntarem sobre qualquer área (Financeiro, Comercial, Marketing, Pessoas ou Administrativo), conecte os indicadores de forma estratégica.`;
    }

    const chatHist = [...messages, userMsg].filter(m => !m.erro).slice(-8).map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    try {
      const result = await askClaudeDetailed({
        messages: chatHist.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.parts.map(p => p.text).join('\n'),
        })),
        systemInstruction,
        maxTokens: 1500,
        preferredProvider: provider,
      });

      if (result.text) {
        setMessages(prev => [...prev, { sender: 'ai', text: result.text!, timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            sender: 'ai',
            text: result.error || 'Não foi possível obter resposta da IA agora. Tente de novo em instantes.',
            erro: true,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch(err) {
      console.error(err);
      setMessages(prev => [...prev, { sender: 'ai', erro: true, text: 'Não consegui falar com o servidor de IA. Verifique a conexão e tente de novo.', timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }]);
    }
    setLoading(false);
  };

  return (
    <div className="floating-copilot-root no-print" style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 1400,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
    }}>
      {open && (
        <div className="floating-copilot-box" role="dialog" aria-label="Assistente de IA" style={{
          width: 400,
          maxWidth: 'calc(100vw - 32px)',
          height: 560,
          // Desconta a barra do topo (64px) e o botão com as margens (~110px): em notebooks o topo do painel ficava escondido.
          maxHeight: 'calc(100dvh - 180px)',
          minHeight: 280,
          background: 'var(--bg-card)',
          borderRadius: 18,
          border: '1px solid var(--border)',
          boxShadow: '0 24px 60px -12px rgba(20,20,19,0.28)',
          marginBottom: 14,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeUp 0.25s ease-out',
        }}>
          {/* Cabeçalho */}
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #600000 0%, #3b0000 100%)',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.14)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Brain size={20} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.2 }}>{ehFiscal ? 'Copiloto Fiscal' : 'Copiloto Privilege'}</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>{ehFiscal ? 'Notas, CNDs e certificados' : 'Analisa a tela que você está vendo'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar assistente"
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center', borderRadius: 8 }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--bg-base)' }}>
            {messages.map((m, idx) => (
              <div key={idx} style={{
                alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: m.sender === 'user' ? '85%' : '95%',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <div style={{
                  background: m.sender === 'user' ? '#600000' : m.erro ? '#fffbeb' : 'var(--bg-card)',
                  color: m.sender === 'user' ? '#fff' : m.erro ? '#92400e' : 'var(--text-primary)',
                  padding: '10px 14px',
                  borderRadius: 14,
                  borderBottomRightRadius: m.sender === 'user' ? 4 : 14,
                  borderBottomLeftRadius: m.sender === 'ai' ? 4 : 14,
                  border: m.sender === 'ai' ? `1px solid ${m.erro ? '#fde68a' : 'var(--border)'}` : 'none',
                  fontSize: 14.5,
                  lineHeight: 1.55,
                  overflowWrap: 'break-word',
                }}>
                  {m.sender === 'ai' && !m.erro
                    ? <MarkdownLeve texto={m.text} tabelaEmCartoes />
                    : <span style={{ whiteSpace: 'pre-line' }}>{m.text}</span>}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start' }}>{m.timestamp}</span>
              </div>
            ))}
            {loading && (
              <div aria-label="A IA está respondendo" style={{ alignSelf: 'flex-start', background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 14, borderBottomLeftRadius: 4, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)' }}>
                {[0, 0.2, 0.4].map(d => (
                  <span key={d} className="animate-pulse" style={{ width: 7, height: 7, background: '#600000', borderRadius: '50%', animationDelay: `${d}s` }} />
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Sugestões rápidas */}
          <div style={{ padding: '8px 12px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-light)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { label: 'Analisar esta tela', prompt: 'Analise os dados, KPIs e tabelas visíveis nesta tela atual e me dê os principais insights.' },
              { label: 'Riscos', prompt: 'Quais os principais gargalos ou riscos que você identifica nos números atuais?' },
              { label: 'Plano de ação', prompt: 'Com base nesta tela e nos indicadores da empresa, sugira 3 ações práticas imediatas.' },
            ].map(chip => (
              <button
                key={chip.label}
                type="button"
                disabled={loading}
                onClick={() => sendMessage(chip.prompt)}
                style={{
                  fontSize: 13.5,
                  padding: '5px 11px',
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Campo de pergunta */}
          <form
            onSubmit={e => { e.preventDefault(); sendMessage(); }}
            style={{ padding: 12, background: 'var(--bg-card)', borderTop: '1px solid var(--border-light)', display: 'flex', gap: 8 }}
          >
            <input
              type="text"
              placeholder={ehFiscal ? 'Pergunte sobre notas, CNDs, certificados...' : 'Pergunte sobre esta tela ou a empresa...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              aria-label="Sua pergunta"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                fontSize: 15,
                outline: 'none',
              }}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Enviar pergunta"
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: '#600000',
                color: '#fff',
                border: 'none',
                display: 'grid',
                placeItems: 'center',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !input.trim() ? 0.5 : 1,
                flexShrink: 0,
              }}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      {/* Botão flutuante */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Fechar assistente de IA' : 'Abrir assistente de IA'}
        title="Assistente de IA"
        style={{
          width: 58,
          height: 58,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7f1d1d 0%, #600000 100%)',
          border: 'none',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 10px 28px rgba(96,0,0,0.35)',
          cursor: 'pointer',
          transition: 'transform 0.2s',
          transform: open ? 'scale(0.92)' : 'scale(1)',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = open ? 'scale(0.92)' : 'scale(1)'; }}
      >
        {open ? <X size={24} /> : <Brain size={26} />}
      </button>
    </div>
  );
}
