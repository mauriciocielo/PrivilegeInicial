'use client';
import { useState, useEffect } from 'react';
import { store, PlanoConta, Portador, Lancamento } from '../lib/store';
import { uid } from '../lib/store';
import { fmt } from '../lib/reports';

interface GeminiQuickEntryProps {
  empresaId: string;
  onSuccess: () => void;
}

interface Attachment {
  base64: string;
  mimeType: string;
  name: string;
}

export default function GeminiQuickEntry({ empresaId, onSuccess }: GeminiQuickEntryProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileData, setFileData] = useState<Attachment | null>(null);
  const [detected, setDetected] = useState<Partial<Lancamento> | null>(null);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [portadores, setPortadores] = useState<Portador[]>([]);
  const API_KEY = 'AIzaSyApsKGqQWqF6LeABZG2fNdzXp4G9_wTq6s';

  useEffect(() => {
    setPlanoContas(store.getPlanoContas(empresaId).filter(p => p.nivel === 3 && p.ativo));
    setPortadores(store.getPortadores(empresaId).filter(p => p.ativo));
  }, [empresaId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      setFileData({
        base64: base64String,
        mimeType: file.type,
        name: file.name
      });
      // Sugerir ao usuário que a IA lerá o comprovante
      if (!text.trim()) {
        setText(`Lançar transação conforme comprovante "${file.name}" anexado`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleParse = async () => {
    if (!text.trim() && !fileData) return;
    setLoading(true);
    setDetected(null);

    const hoje = new Date().toISOString().split('T')[0];
    const ontemD = new Date(); ontemD.setDate(ontemD.getDate() - 1);
    const ontem = ontemD.toISOString().split('T')[0];

    const promptText = `Você é um robô assistente especializado em contabilidade financeira para a Privilege Consultoria.
Analise a descrição textual fornecida: "${text}".
${fileData ? 'Analise também visualmente o arquivo de comprovante/fatura/nota fiscal anexado e extraia prioritariamente dele os valores exatos, data do pagamento e descrição.' : ''}

Com base nesses dados, preencha o lançamento financeiro e escolha a subconta contábil mais apropriada do Plano de Contas e o Portador mais apropriado das listas fornecidas abaixo:

PLANO DE CONTAS DISPONÍVEL (Subcontas Nível 3):
${planoContas.map(p => `- ID: ${p.id}, CÓDIGO: ${p.codigo}, DESCRIÇÃO: ${p.descricao}, TIPO: ${p.tipo}`).join('\n')}

PORTADORES DISPONÍVEIS:
${portadores.map(p => `- ID: ${p.id}, NOME: ${p.nome}`).join('\n')}

Retorne estritamente um objeto JSON válido sem blocos de código markdown contendo:
{
  "descricao": "Descrição curta do lançamento (ex: Pagamento de Lentes Essilor, Recebimento Pix Cliente João, Tarifa Bancária)",
  "valor": 123.45 (número exato extraído do texto ou arquivo),
  "tipo": "receita" ou "despesa",
  "data": "AAAA-MM-DD" (data do pagamento extraída do comprovante/texto, se for hoje use "${hoje}", se ontem use "${ontem}", senão deduza),
  "planoContaId": "ID do plano de contas mais adequado",
  "portadorId": "ID do portador mais adequado",
  "status": "realizado"
}
Se o documento/texto não especificar o portador ou plano de contas, escolha a categoria mais lógica do plano e o primeiro portador como padrão.`;

    const parts: any[] = [{ text: promptText }];
    if (fileData) {
      parts.push({
        inlineData: {
          mimeType: fileData.mimeType,
          data: fileData.base64
        }
      });
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseMimeType: "application/json" }
          }),
        }
      );
      if (!response.ok) throw new Error('Falha ao conectar com o Gemini.');
      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText.trim());
        setDetected(parsed);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao processar o arquivo/texto com o Gemini AI. Verifique se o arquivo não é muito grande ou se está em formato válido.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!detected) return;
    const item: Lancamento = {
      id: uid(),
      empresaId,
      data: detected.data || new Date().toISOString().split('T')[0],
      descricao: detected.descricao || 'Lançamento via IA',
      valor: Number(detected.valor || 0),
      tipo: (detected.tipo as 'receita' | 'despesa') || 'despesa',
      planoContaId: detected.planoContaId || planoContas[0]?.id || '',
      portadorId: detected.portadorId || portadores[0]?.id || '',
      status: 'realizado',
      origem: 'manual',
      attachmentName: fileData?.name,
      attachmentData: fileData?.base64,
      createdAt: new Date().toISOString(),
    };
    store.saveLancamento(item);
    setText('');
    setFileData(null);
    setDetected(null);
    onSuccess();
  };

  const handleClearFile = () => {
    setFileData(null);
    if (text.startsWith('Lançar transação conforme comprovante')) {
      setText('');
    }
  };

  const selectedPc = planoContas.find(p => p.id === detected?.planoContaId);
  const selectedPort = portadores.find(p => p.id === detected?.portadorId);

  return (
    <div className="card" style={{ marginBottom: 24, border: '1px solid rgba(96,0,0,0.15)', background: 'linear-gradient(135deg, rgba(96,0,0,0.03) 0%, #ffffff 100%)', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>🤖</span>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>Privilege AI Lançador Multimodal</h3>
          <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Anexe um comprovante de pagamento/fatura (imagem/pdf) ou digite a transação em linguagem natural</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="form-control"
            placeholder="Ex: Recebi R$ 350,00 via Pix ontem para o Caixa Geral..."
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={loading}
            style={{ fontSize: 13, flex: 1 }}
            onKeyDown={e => e.key === 'Enter' && handleParse()}
          />

          <input
            type="file"
            accept="image/*,application/pdf"
            id="gemini-file-upload"
            onChange={handleFileChange}
            disabled={loading}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => document.getElementById('gemini-file-upload')?.click()}
            disabled={loading}
            title="Anexar Comprovante ou Nota Fiscal (Imagem/PDF)"
            style={{ padding: '10px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            📎 {fileData ? 'Alterar' : 'Anexar'}
          </button>

          <button
            className="btn btn-primary"
            onClick={handleParse}
            disabled={loading || (!text.trim() && !fileData)}
            style={{ padding: '10px 18px' }}
          >
            {loading ? '⏳ Processando...' : '→ Identificar'}
          </button>
        </div>

        {fileData && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(96,0,0,0.06)', padding: '6px 12px', borderRadius: 20, width: 'fit-content', border: '1px solid rgba(96,0,0,0.1)' }}>
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>📄 {fileData.name}</span>
            <button
              type="button"
              onClick={handleClearFile}
              style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
              title="Remover anexo"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {detected && (
        <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: 0.5, marginBottom: 8 }}>
            🔍 Lançamento Identificado com Sucesso
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Descrição</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{detected.descricao}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Valor</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: detected.tipo === 'receita' ? 'var(--green)' : 'var(--red)' }}>
                {detected.tipo === 'receita' ? '+' : '-'}{fmt.currency(detected.valor || 0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Data</div>
              <div style={{ fontSize: 13 }}>{detected.data ? fmt.date(detected.data) : '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Tipo</div>
              <div>
                <span className={`badge ${detected.tipo === 'receita' ? 'badge-green' : 'badge-red'}`}>
                  {detected.tipo === 'receita' ? '↑ Receita' : '↓ Despesa'}
                </span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Plano de Contas</div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{selectedPc ? `${selectedPc.codigo} - ${selectedPc.descricao}` : '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Portador</div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{selectedPort?.nome || '-'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setDetected(null)}>✕ Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleConfirm}>✓ Confirmar Lançamento</button>
          </div>
        </div>
      )}
    </div>
  );
}
