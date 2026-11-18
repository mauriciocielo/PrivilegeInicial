'use client';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { store } from '../lib/store';
import { fmt } from '../lib/reports';
import { askClaudeDetailed } from '../lib/claude-client';

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
  const [provider, setProvider] = useState<'auto' | 'gemini' | 'claude' | 'ollama'>('auto');
  
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
1. Responda sempre em Markdown conciso e profissional (tabelas ou bullet points), rápido e direto ao ponto.
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
1. Responda sempre em Markdown com formatação profissional, limpa e espaçada, mas seja conciso e prático. Use tabelas ou bullet points.
2. Analise os números e tabelas visíveis na tela atual e dê recomendações acionáveis para gerar mais caixa, lucro, conversão ou segurança fiscal. Nunca invente números fora do contexto.
3. Se perguntarem sobre qualquer área (Financeiro, Comercial, Marketing, Pessoas ou Administrativo), conecte os indicadores de forma estratégica.`;
    }

    const chatHist = [...messages, userMsg].slice(-8).map(m => ({
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
            text: `⚠️ ${result.error || 'Não foi possível obter resposta da IA. Verifique se o servidor Ollama (OLLAMA_BASE_URL) está acessível.'}`,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch(err) {
      console.error(err);
      setMessages(prev => [...prev, { sender: 'ai', text: 'Desculpe, ocorreu uma instabilidade na minha antena. Verifique sua conexão com o servidor AI.', timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }]);
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Container do Chat Box */}
      {open && (
        <div style={{
          width: 380,
          height: 520,
          background: 'var(--bg-base)',
          borderRadius: 16,
          boxShadow: '0 12px 48px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeUp 0.3s ease-out'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, var(--accent) 0%, rgba(96,0,0,0.8) 100%)',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>🧠</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{ehFiscal ? 'Privilege Copilot Fiscal' : 'Privilege Copilot 360º'}</h3>
                <span style={{ fontSize: 11, opacity: 0.8 }}>{ehFiscal ? 'Apoio ao analista fiscal' : 'Analisa Dash, Relatórios & Site'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={provider}
                onChange={e => setProvider(e.target.value as any)}
                title="Motor de IA"
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.28)',
                  borderRadius: 8,
                  padding: '3px 6px',
                  fontSize: 11,
                  fontWeight: 600,
                  outline: 'none',
                }}
              >
                <option value="auto" style={{ color: '#111' }}>IA: Auto (Ollama)</option>
                <option value="gemini" style={{ color: '#111' }}>Gemini</option>
                <option value="claude" style={{ color: '#111' }}>Claude</option>
                <option value="ollama" style={{ color: '#111' }}>Ollama</option>
              </select>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--bg-card)' }}>
            {messages.map((m, idx) => (
              <div key={idx} style={{
                alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  background: m.sender === 'user' ? 'var(--blue)' : 'var(--bg-card2)',
                  color: m.sender === 'user' ? '#fff' : 'var(--text-main)',
                  padding: '12px 14px',
                  borderRadius: 12,
                  borderBottomRightRadius: m.sender === 'user' ? 0 : 12,
                  borderBottomLeftRadius: m.sender === 'ai' ? 0 : 12,
                  border: m.sender === 'ai' ? '1px solid var(--border-light)' : 'none',
                  fontSize: 13,
                  lineHeight: '1.5',
                  whiteSpace: 'pre-line' 
                }}>
                  {m.text}
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start' }}>{m.timestamp}</span>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '85%', background: 'var(--bg-card2)', padding: '12px 16px', borderRadius: 12, borderBottomLeftRadius: 0, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border-light)' }}>
                <div className="animate-pulse" style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%' }} />
                <div className="animate-pulse" style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%', animationDelay: '0.2s' }} />
                <div className="animate-pulse" style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%', animationDelay: '0.4s' }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts (ai-chat-widget) */}
          <div style={{ padding: '8px 12px', background: 'var(--bg-card2)', borderTop: '1px solid var(--border-light)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { label: '📊 Analisar esta tela', prompt: 'Analise os dados, KPIs e tabelas visíveis nesta tela atual e me dê os principais insights.' },
              { label: '⚠️ Gargalos', prompt: 'Quais os principais gargalos ou riscos que você identifica nos números atuais?' },
              { label: '🚀 Plano de Ação', prompt: 'Com base nesta tela e nos indicadores da empresa, sugira 3 ações práticas imediatas.' },
            ].map(chip => (
              <button
                key={chip.label}
                type="button"
                disabled={loading}
                onClick={() => sendMessage(chip.prompt)}
                style={{
                  fontSize: 11,
                  padding: '4px 9px',
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div style={{ padding: 12, background: 'var(--bg-base)', borderTop: '1px solid var(--border-light)', display: 'flex', gap: 8 }}>
            <input 
              type="text"
              placeholder={ehFiscal ? 'Pergunte sobre notas, CND, certificados...' : 'Pergunte sobre qualquer dash ou relatório...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 20,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: 13,
                outline: 'none'
              }}
              disabled={loading}
            />
            <button 
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'var(--primary)',
                color: '#000',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: loading || !input.trim() ? 0.6 : 1
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button 
        onClick={() => setOpen(!open)}
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent) 0%, rgba(96,0,0,0.8) 100%)',
          border: 'none',
          color: '#fff',
          fontSize: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(96,0,0,0.3)',
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          transform: open ? 'scale(0.9)' : 'scale(1)',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={e => e.currentTarget.style.transform = open ? 'scale(0.9)' : 'scale(1)'}
      >
        {open ? '✕' : '🧠'}
      </button>
    </div>
  );
}
