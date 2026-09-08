'use client';
import { useState, useEffect, useCallback } from 'react';
import { store, CurvaAbc } from '../lib/store';
import { fmt } from '../lib/reports';

interface CurvaTipsProps {
  empresaId: string;
  curva: CurvaAbc | null;
}

interface TipItem {
  icon: string;
  title: string;
  text: string;
}

export default function GeminiAbc({ empresaId, curva }: CurvaTipsProps) {
  const [tips, setTips] = useState<TipItem[]>([]);
  const [loading, setLoading] = useState(false);
  const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyApsKGqQWqF6LeABZG2fNdzXp4G9_wTq6s';

  const generateTips = useCallback(async () => {
    if (!curva) {
      setTips([]);
      return;
    }
    setLoading(true);

    const totalFat = curva.itens.reduce((acc, i) => acc + i.valorFaturado, 0);
    const classeA = curva.itens.filter(i => i.classificacao === 'A');
    const classeB = curva.itens.filter(i => i.classificacao === 'B');
    const classeC = curva.itens.filter(i => i.classificacao === 'C');
    
    const maxA = classeA.length > 0 ? classeA.reduce((prev, curr) => (prev.valorFaturado > curr.valorFaturado) ? prev : curr).nome : 'Nenhum';

    const prompt = `Você é o analista de dados e assistente de BPO Premium Privilege Copilot.
Analise a curva ABC de faturamento do cliente atual.
Faturamento Total Analisado: R$ ${totalFat.toLocaleString('pt-BR')}
Total de Itens: ${curva.itens.length} (Classe A: ${classeA.length}, Classe B: ${classeB.length}, Classe C: ${classeC.length})
Principal Cliente/Produto (Maior curva A): ${maxA}

Gere 3 "super dicas" automáticas focadas na Curva ABC. Recomende ações como proteção aos clientes da Curva A, up-sell/cross-sell na Curva B, ou reavaliação de custos da Curva C.

Retorne estritamente um array JSON válido (e nada mais) no formato:
[
  { "icon": "Emoji", "title": "Título curto", "text": "Insight direto" }
]`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text.trim()) as TipItem[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTips(parsed);
            setLoading(false);
            return;
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
    
    // Fallback Mock
    await new Promise(r => setTimeout(r, 600));
    setTips([
      { icon: '👑', title: 'Proteção Máxima na Curva A', text: `Os ${classeA.length} itens da Classe A sustentam o negócio. Crie um canal VIP de atendimento exclusivo.` },
      { icon: '📈', title: 'Potencial da Curva B', text: `${classeB.length} itens estão na Classe B. Aplique ofertas de "upsell" para empurrá-los para a faixa A.` },
      { icon: '✂️', title: 'Otimização na Curva C', text: `Avalie reduzir o tempo operacional gasto com os ${classeC.length} itens da Curva C.` }
    ]);
    setLoading(false);

  }, [curva, empresaId]);

  useEffect(() => {
    generateTips();
  }, [generateTips]);

  if (!curva) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
         <div style={{ fontSize: 24 }}>🧠</div>
         <div>
           <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Insights ABC - Privilege Copilot</h3>
           <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Análise automática da sua concentração de faturamento</p>
         </div>
      </div>
      {loading ? (
        <div className="card" style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
           ⏳ Analisando padrão de dependência e vendas...
        </div>
      ) : (
        <div className="grid-3">
          {tips.map((item, idx) => (
             <div key={idx} className="card" style={{ background: 'var(--bg-card)', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>{item.title}</strong>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.text}</div>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}
