'use client';
import { useState, useRef, useEffect } from 'react';
import { store } from '../lib/store';
import { fmt } from '../lib/reports';

interface Message {
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

export default function FloatingCopilot() {
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { sender: 'user', text: input, timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyApsKGqQWqF6LeABZG2fNdzXp4G9_wTq6s';

    // Puxa Contexto dinâmico ativo
    const empresaId = sessionStorage.getItem('cf_empresa_sel') || store.getEmpresas()[0]?.id;
    const empresa = store.getEmpresas().find(e => e.id === empresaId);
    
    let contextStr = 'Nenhuma empresa selecionada.';
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

      contextStr = `
CONTEXTO DA EMPRESA SESSÃO ATIVA:
Empresa: ${empresa.razaoSocial}
Saldo de Caixa Atual: ${fmt.currency(caixa)}
Mês Corrente (${mesAtual}): Receitas: ${fmt.currency(rM)} / Despesas: ${fmt.currency(dM)} 
Total de registros processados: ${lancs.length}
Políticas globais da empresa: 
- Cobrança: ${empresa.politicaCobrancaTexto || 'N/A'}
- Pagamento: ${empresa.politicaPagamentosTexto || 'N/A'}

Diretrizes Base de Conhecimento:
${dContext}
      `;
    }

    const systemInstruction = `Você é o "Privilege Copilot", inteligência financeira assistente acoplada globalmente no sistema ERP web do escritório contabil "Privilege". 
Você age como um CFO e braço direito virtual hiper-responsivo.
O usuário está visualizando e editando dados do sistema. Responda baseado no contexto injetado:
${contextStr}

Regras:
1. Responda sempre em Markdown com formatação profissional, limpa e espaçada, mas seja muito conciso e rápido em suas observações. Use tabelas ou bullet points.
2. Analise os fatos financeiros fornecidos da empresa selecionada e dê dicas precisas ou cruze informações. Não invente números fora do escopo, mas pode fazer deduções usando matemática comum de CF.
3. Se perguntarem algo fora da contabilidade da empresa, você pode ajudar com excelência como um braço direito corporativo, utilizando todo seu raciocínio financeiro amplo do Gemini.`;

    const chatHist = [...messages, userMsg].slice(-8).map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: chatHist,
            systemInstruction: { parts: [{ text: systemInstruction }] }
          })
      });

      if(response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if(text) {
           setMessages(prev => [...prev, { sender: 'ai', text, timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }]);
        }
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
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Privilege Copilot</h3>
                <span style={{ fontSize: 11, opacity: 0.8 }}>IA Assistente Global</span>
              </div>
            </div>
            <button 
              onClick={() => setOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: 4 }}
            >
              ✕
            </button>
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

          {/* Input Area */}
          <div style={{ padding: 12, background: 'var(--bg-base)', borderTop: '1px solid var(--border-light)', display: 'flex', gap: 8 }}>
            <input 
              type="text"
              placeholder="Pergunte sobre finanças..."
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
              onClick={sendMessage}
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
