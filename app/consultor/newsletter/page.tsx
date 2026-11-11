'use client';

import { useState, useEffect, useRef } from 'react';
import { store, Empresa, Cliente } from '../../../lib/store';
import { LISTA_PADRAO_CLIENTES_NEWSLETTER } from '../../../lib/lista-clientes-newsletter';
import { toast } from 'sonner';
import {
  Mail, Send, Users, CheckCircle2, Image as ImageIcon, X, ListPlus, Sparkles,
  Eye, Download, RefreshCw, Key, ShieldCheck, AlertCircle, Bold, Italic, Underline,
  Heading2, List, Quote, Link as LinkIcon, Palette, Clock, Play, Pause, Trash2, Timer, Layers
} from 'lucide-react';

export default function NewsletterPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [tipoFormato, setTipoFormato] = useState<'imagem' | 'texto'>('imagem');
  const [modoDestinatarios, setModoDestinatarios] = useState<'clientes' | 'manual'>('clientes');
  const [listaManual, setListaManual] = useState('');
  const [imagens, setImagens] = useState<{ filename: string; base64: string }[]>([]);
  const [linkDestinoImagem, setLinkDestinoImagem] = useState('https://wa.me/5546999048990');
  const [enviando, setEnviando] = useState(false);
  const [filtrarHotmailOutlook, setFiltrarHotmailOutlook] = useState(false);
  const [evitarDuplicados, setEvitarDuplicados] = useState(true);
  const [progressoEnvio, setProgressoEnvio] = useState<{
    ativo: boolean;
    atual: number;
    total: number;
    loteAtual: number;
    totalLotes: number;
  } | null>(null);
  
  // Customização / Ajuste de Senha SMTP em tela
  const [showSmtpConfig, setShowSmtpConfig] = useState(false);
  const [smtpUser, setSmtpUser] = useState('consultoria@privilegecontabilidade.com.br');
  const [smtpPass, setSmtpPass] = useState('@Privilege1452');

  // Logs e Auditoria de E-mails
  const [logs, setLogs] = useState<any[]>([]);
  const [carregandoLogs, setCarregandoLogs] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'novo' | 'fila' | 'historico'>('novo');
  const [abaMensagem, setAbaMensagem] = useState<'editor' | 'previa'>('editor');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fila de Disparos em Lotes a cada 65 minutos
  const [campanhaAtiva, setCampanhaAtiva] = useState<any>(null);
  const [filas, setFilas] = useState<any[]>([]);
  const [carregandoFila, setCarregandoFila] = useState(false);
  const [processandoAcaoFila, setProcessandoAcaoFila] = useState(false);
  const [modoEnvio, setModoEnvio] = useState<'fila' | 'imediato'>('fila');
  const [tamanhoLoteFila, setTamanhoLoteFila] = useState<number>(70);
  const [intervaloMinutosFila, setIntervaloMinutosFila] = useState<number>(65);
  const [iniciarFilaEmMinutos, setIniciarFilaEmMinutos] = useState<number>(65);
  const [tempoRestanteFormatado, setTempoRestanteFormatado] = useState<string>('');

  const aplicarFormatacao = (prefixo: string, sufixo: string = '', textoPadrao: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selecionado = mensagem.substring(start, end) || textoPadrao;
    const novoTexto = mensagem.substring(0, start) + prefixo + selecionado + sufixo + mensagem.substring(end);

    setMensagem(novoTexto);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefixo.length, start + prefixo.length + selecionado.length);
    }, 50);
  };

  const renderPreviewHtml = (txt: string) => {
    if (!txt) return '<span style="color: #94a3b8; font-style: italic;">Nenhum texto digitado ainda...</span>';
    let h = txt;
    h = h.replace(/^### (.*$)/gim, '<h3 style="color: #600000; font-size: 16px; font-weight: bold; margin: 14px 0 4px;">$1</h3>');
    h = h.replace(/^## (.*$)/gim, '<h2 style="color: #600000; font-size: 18px; font-weight: bold; margin: 18px 0 6px;">$1</h2>');
    h = h.replace(/^# (.*$)/gim, '<h1 style="color: #600000; font-size: 20px; font-weight: 800; margin: 20px 0 8px;">$1</h1>');
    h = h.replace(/^\> (.*$)/gim, '<div style="background: #fdf2f2; border-left: 4px solid #600000; padding: 10px 14px; margin: 12px 0; border-radius: 4px; color: #475569; font-style: italic;">$1</div>');
    h = h.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #0f172a; font-weight: bold;">$1</strong>');
    h = h.replace(/(^|[^\w])\*(.*?)\*([^\w]|$)/g, '$1<em>$2</em>$3');
    h = h.replace(/\[(.*?)\]\((https?:\/\/.*?)\)/gi, '<a href="$2" target="_blank" style="color: #600000; font-weight: bold; text-decoration: underline;">$1</a>');
    
    const lines = h.split('\n');
    const processed: string[] = [];
    let inList = false;
    for (const l of lines) {
      const t = l.trim();
      if (t.startsWith('• ') || t.startsWith('- ') || t.startsWith('* ')) {
        if (!inList) { processed.push('<ul style="margin: 8px 0; padding-left: 20px; color: #334155;">'); inList = true; }
        processed.push(`<li>${t.replace(/^[•\-\*]\s+/, '')}</li>`);
      } else {
        if (inList) { processed.push('</ul>'); inList = false; }
        processed.push(l);
      }
    }
    if (inList) processed.push('</ul>');
    h = processed.join('\n').replace(/\n\n/g, '<p style="margin: 10px 0;"></p>').replace(/\n/g, '<br />');
    return h;
  };

  const [resultadoEnvio, setResultadoEnvio] = useState<{
    ok: boolean;
    enviados: number;
    falhas: number;
    totalDestinatarios: number;
    logs?: { email: string; status: 'ok' | 'erro'; erro?: string }[];
  } | null>(null);

  const load = (eId: string) => {
    if (!eId) return;
    setEmpresaId(eId);
    setEmpresa(store.getEmpresas().find(e => e.id === eId) || null);
    let clis = store.getClientes(eId).filter(c => c.ativo);
    if (clis.filter(c => c.email && c.email.includes('@')).length === 0) {
      const todos = store.getEmpresas().flatMap(emp => store.getClientes(emp.id)).filter(c => c.ativo);
      if (todos.filter(c => c.email && c.email.includes('@')).length > 0) {
        clis = todos;
      }
    }
    setClientes(clis);
    carregarLogsServidor();
  };

  const carregarLogsServidor = async (_eId?: string) => {
    setCarregandoLogs(true);
    try {
      const res = await fetch('/api/email-servicos/log');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {}
    finally {
      setCarregandoLogs(false);
    }
  };

  const carregarFilaServidor = async () => {
    setCarregandoFila(true);
    try {
      const res = await fetch('/api/email-servicos/queue');
      if (res.ok) {
        const data = await res.json();
        setCampanhaAtiva(data.campanhaAtiva || null);
        setFilas(data.fila || []);
      }
    } catch {}
    finally {
      setCarregandoFila(false);
    }
  };

  const executarAcaoFila = async (action: 'process_now' | 'pause' | 'resume' | 'delete', cId?: string) => {
    const targetId = cId || campanhaAtiva?.id;
    if (!targetId && action !== 'process_now') return;
    setProcessandoAcaoFila(true);
    try {
      const res = await fetch('/api/email-servicos/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, campanhaId: targetId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || 'Erro ao processar ação na fila.');
      } else {
        if (action === 'process_now') toast.success('Lote processado com sucesso!');
        if (action === 'pause') toast.info('Fila pausada.');
        if (action === 'resume') toast.success('Fila retomada!');
        if (action === 'delete') toast.success('Fila cancelada.');
        carregarFilaServidor();
        carregarLogsServidor();
      }
    } catch (e: any) {
      toast.error(`Falha: ${e.message}`);
    } finally {
      setProcessandoAcaoFila(false);
    }
  };

  useEffect(() => {
    carregarLogsServidor();
    carregarFilaServidor();

    const timerFila = setInterval(() => {
      carregarFilaServidor();
    }, 20000);

    const saved = sessionStorage.getItem('cf_empresa_sel') || '';
    if (saved) load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => {
      window.removeEventListener('empresaChange', handler);
      clearInterval(timerFila);
    };
  }, []);

  // Timer regressivo para o próximo lote a cada 65 min
  useEffect(() => {
    const timer = setInterval(() => {
      if (!campanhaAtiva || campanhaAtiva.status !== 'aguardando' || !campanhaAtiva.proximoLoteEm) {
        setTempoRestanteFormatado('');
        return;
      }
      const diff = new Date(campanhaAtiva.proximoLoteEm).getTime() - Date.now();
      if (diff <= 0) {
        setTempoRestanteFormatado('Pronto para disparar!');
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTempoRestanteFormatado(`${m}m ${s < 10 ? '0' : ''}${s}s`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [campanhaAtiva]);

  const clientesComEmail = clientes.filter(c => c.email && c.email.includes('@'));

  const destinatariosManuaisValidos = listaManual
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(s => s.includes('@'));

  const todosDestinatariosBrutos =
    modoDestinatarios === 'clientes'
      ? clientesComEmail.map(c => c.email!)
      : destinatariosManuaisValidos;

  const destinatariosFinais = todosDestinatariosBrutos.filter(e => {
    if (!filtrarHotmailOutlook) return true;
    const lower = e.toLowerCase();
    return !lower.includes('@hotmail') && !lower.includes('@outlook') && !lower.includes('@live.');
  });

  const totalHotmailOutlook = todosDestinatariosBrutos.filter(e => {
    const lower = e.toLowerCase();
    return lower.includes('@hotmail') || lower.includes('@outlook') || lower.includes('@live.');
  }).length;

  // Proteção Antiduplicação: Checa se já houve envio deste mesmo assunto nas últimas 24h
  const emailsJaEnviadosHoje = new Set(
    logs
      .filter(l => {
        if (!l.destinatarioEmail || (l.status !== 'entregue' && l.status !== 'visualizado')) return false;
        if (assunto.trim() && l.assunto?.trim().toLowerCase() === assunto.trim().toLowerCase()) {
          const diffHoras = (Date.now() - new Date(l.enviadoEm).getTime()) / (1000 * 60 * 60);
          return diffHoras < 24;
        }
        return false;
      })
      .map(l => l.destinatarioEmail.trim().toLowerCase())
  );

  const destinatariosPendentes = destinatariosFinais.filter(e => {
    if (!evitarDuplicados) return true;
    return !emailsJaEnviadosHoje.has(e.trim().toLowerCase());
  });

  const totalJaEnviadosHoje = destinatariosFinais.filter(e =>
    emailsJaEnviadosHoje.has(e.trim().toLowerCase())
  ).length;

  const totalDestinatariosEstimados = evitarDuplicados ? destinatariosPendentes.length : destinatariosFinais.length;

  const modelosProntos = [
    {
      titulo: '📅 Lembrete de Envio de Documentos e Fechamento Mensal',
      assunto: 'Privilege Consultoria — Lembrete de Documentos para Fechamento Fiscal/Contábil',
      texto: `Prezados clientes,\n\nSolicitamos a gentileza do envio dos extratos bancários em formato OFX/PDF, notas fiscais de entrada e comprovantes de pagamentos referentes ao mês anterior até o 5º dia útil.\n\nO envio tempestivo dos documentos garante a apuração correta dos seus impostos e evita multas ou inconsistências com o fisco.\n\nQualquer dúvida, nossa equipe está à disposição!\n\nAtenciosamente,\nEquipe Privilege Consultoria`,
    },
    {
      titulo: '📢 Alerta sobre Atualizações na Legislação Tributária',
      assunto: 'Informativo Tributário Importante — Novas Regras e Impactos Fiscais',
      texto: `Prezado cliente parceiro,\n\nGostaríamos de compartilhar um informativo importante sobre as atualizações recentes nas normas fiscais e de faturamento que entraram em vigor neste mês.\n\nRecomendamos a revisão dos parâmetros de emissão de suas notas fiscais de serviços e mercadorias para garantir conformidade contínua.\n\nNossa equipe de consultoria preparou um acompanhamento personalizado para orientar sua empresa em qualquer ajuste necessário.\n\nAtenciosamente,\nPrivilege Consultoria`,
    },
    {
      titulo: '💡 Boas Práticas de Gestão Financeira e Fluxo de Caixa',
      assunto: 'Dicas de Gestão Financeira para o Crescimento da sua Empresa',
      texto: `Olá!\n\nManter um fluxo de caixa saudável é o alicerce para decisões estratégicas seguras. Neste mês, destacamos três pontos fundamentais para o sucesso financeiro da sua empresa:\n\n1. Conciliação bancária diária ou semanal;\n2. Acompanhamento rigoroso da inadimplência em Contas a Receber;\n3. Projeção de fluxo de caixa para os próximos 30 a 90 dias.\n\nConte sempre conosco para otimizar os resultados do seu negócio!\n\nCordialmente,\nPrivilege Consultoria`,
    },
  ];

  const handleUploadImagem = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        toast.error(`O arquivo ${file.name} não é uma imagem válida.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const rawBase64 = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const opt = canvas.toDataURL('image/jpeg', 0.85);
              setImagens(prev => [...prev, { filename: file.name.replace(/\.[^.]+$/, '.jpg'), base64: opt }]);
            } else {
              setImagens(prev => [...prev, { filename: file.name, base64: rawBase64 }]);
            }
          } else {
            setImagens(prev => [...prev, { filename: file.name, base64: rawBase64 }]);
          }
          setTipoFormato('imagem');
          toast.success(`Imagem ${file.name} carregada e otimizada!`);
        };
        img.onerror = () => {
          setImagens(prev => [...prev, { filename: file.name, base64: rawBase64 }]);
          setTipoFormato('imagem');
        };
        img.src = rawBase64;
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleRemoverImagem = (index: number) => {
    setImagens(prev => prev.filter((_, i) => i !== index));
  };

  const handleDisparar = async () => {
    if (!assunto.trim()) {
      toast.error('Informe o assunto do e-mail.');
      return;
    }

    if (tipoFormato === 'imagem') {
      if (imagens.length === 0) {
        toast.error('Selecione ou anexe a imagem do panfleto/flyer para disparo.');
        return;
      }
    } else {
      if (!mensagem.trim() && imagens.length === 0) {
        toast.error('Escreva o conteúdo da mensagem ou anexe uma imagem.');
        return;
      }
    }

    if (totalDestinatariosEstimados === 0) {
      toast.error(
        modoDestinatarios === 'clientes'
          ? 'Nenhum cliente com e-mail cadastrado nesta empresa.'
          : 'Insira pelo menos um e-mail válido na lista de disparo.'
      );
      return;
    }

    const listaParaEnviar = evitarDuplicados ? destinatariosPendentes : destinatariosFinais;
    if (listaParaEnviar.length === 0) {
      toast.error('Nenhum destinatário pendente para envio. Todos já receberam este comunicado ou a lista está vazia.');
      return;
    }

    if (!confirm(`Confirmar o disparo deste comunicado para ${listaParaEnviar.length} destinatário(s)?`)) {
      return;
    }

    setEnviando(true);
    setResultadoEnvio(null);

    // Dividir em lotes de 15 destinatários para prevenir qualquer tempo limite (timeout 504)
    const CHUNK_SIZE = 15;
    const lotes: string[][] = [];
    for (let i = 0; i < listaParaEnviar.length; i += CHUNK_SIZE) {
      lotes.push(listaParaEnviar.slice(i, i + CHUNK_SIZE));
    }

    setProgressoEnvio({
      ativo: true,
      atual: 0,
      total: listaParaEnviar.length,
      loteAtual: 1,
      totalLotes: lotes.length,
    });

    let totalEnviados = 0;
    let totalFalhas = 0;
    let todosLogs: any[] = [];

    try {
      // 1. Otimiza previamente qualquer imagem para no máximo 800px / JPEG 75% (< 100KB)
      const imagensOtimizadas = await Promise.all(
        imagens.map(async (img) => {
          if (!img.base64 || img.base64.length < 250000) return img;
          return new Promise<{ filename: string; base64: string }>((resolve) => {
            const imageObj = new Image();
            imageObj.onload = () => {
              const canvas = document.createElement('canvas');
              const maxDim = 800;
              let { width, height } = imageObj;
              if (width > maxDim || height > maxDim) {
                if (width > height) {
                  height = Math.round((height * maxDim) / width);
                  width = maxDim;
                } else {
                  width = Math.round((width * maxDim) / height);
                  height = maxDim;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(imageObj, 0, 0, width, height);
                resolve({
                  filename: img.filename.replace(/\.[^.]+$/, '.jpg'),
                  base64: canvas.toDataURL('image/jpeg', 0.75),
                });
              } else {
                resolve(img);
              }
            };
            imageObj.onerror = () => resolve(img);
            imageObj.src = img.base64;
          });
        })
      );

      // CASO A: Envio através da Fila Inteligente (Lotes a cada 65 min)
      if (modoEnvio === 'fila') {
        const resQueue = await fetch('/api/email-servicos/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'enqueue',
            empresaId,
            assunto,
            mensagem: tipoFormato === 'imagem' ? '' : mensagem,
            somenteImagem: tipoFormato === 'imagem',
            linkImagem: linkDestinoImagem.trim() || 'https://wa.me/5546999048990',
            destinatarios: listaParaEnviar.map(email => ({ email, nome: 'Cliente' })),
            tamanhoLote: tamanhoLoteFila,
            intervaloMinutos: intervaloMinutosFila,
            iniciarEmMinutos: iniciarFilaEmMinutos,
            smtpUserCustom: smtpUser.trim(),
            smtpPassCustom: smtpPass.trim(),
            imagens: imagensOtimizadas.map((img, idx) => ({
              filename: img.filename,
              base64: img.base64,
              cid: `img_anexo_${idx}`,
            })),
          }),
        });

        const dataQueue = await resQueue.json();
        if (!resQueue.ok || dataQueue.error) {
          toast.error(dataQueue.error || 'Erro ao colocar campanha na fila.');
          return;
        }

        if (iniciarFilaEmMinutos > 0) {
          toast.success(`Campanha adicionada à fila! O 1º lote será disparado em ${iniciarFilaEmMinutos} minutos.`);
        } else {
          toast.success(`1º lote disparado! Próximos lotes serão enviados automaticamente a cada ${intervaloMinutosFila} min.`);
        }
        setAbaAtiva('fila');
        carregarFilaServidor();
        carregarLogsServidor();
        return;
      }

      // CASO B: Disparo Imediato
      for (let i = 0; i < lotes.length; i++) {
        const lote = lotes[i];
        setProgressoEnvio({
          ativo: true,
          atual: totalEnviados + totalFalhas,
          total: listaParaEnviar.length,
          loteAtual: i + 1,
          totalLotes: lotes.length,
        });

        try {
          const res = await fetch('/api/email-servicos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'newsletter',
              somenteImagem: tipoFormato === 'imagem',
              empresaId,
              assunto,
              mensagem: tipoFormato === 'imagem' ? '' : mensagem,
              destinatariosLista: lote,
              smtpUserCustom: smtpUser.trim(),
              smtpPassCustom: smtpPass.trim(),
              linkImagem: linkDestinoImagem.trim() || 'https://wa.me/5546999048990',
              imagens: imagensOtimizadas.map((img, idx) => ({
                filename: img.filename,
                base64: img.base64,
                cid: `img_anexo_${idx}`,
              })),
            }),
          });

          const rawText = await res.text();
          let data: any;
          try {
            data = JSON.parse(rawText);
          } catch {
            totalFalhas += lote.length;
            continue;
          }

          if (res.ok && data) {
            totalEnviados += data.enviados || 0;
            totalFalhas += data.falhas || 0;
            if (data.logs) todosLogs = [...todosLogs, ...data.logs];
          } else {
            totalFalhas += lote.length;
          }
        } catch {
          totalFalhas += lote.length;
        }
      }

      setResultadoEnvio({
        ok: totalEnviados > 0,
        enviados: totalEnviados,
        falhas: totalFalhas,
        totalDestinatarios: listaParaEnviar.length,
        logs: todosLogs,
      });

      if (totalEnviados > 0) {
        toast.success(`Disparo realizado! ${totalEnviados} enviado(s) de ${listaParaEnviar.length}.`);
      } else {
        toast.error('Falha no envio de e-mails. Verifique as credenciais ou a conexão SMTP.');
      }
      carregarLogsServidor();
    } catch (err: any) {
      toast.error(`Falha na conexão: ${err.message}`);
    } finally {
      setEnviando(false);
      setProgressoEnvio(null);
    }
  };

  return (
    <div className="page-body" style={{ maxWidth: 1080, margin: '0 auto', paddingBottom: 40 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#8c1a22', color: '#fff', padding: 8, borderRadius: 8, display: 'flex' }}>
              <Mail size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#111827' }}>
                Disparador de Newsletter & Comunicados
              </h1>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 0' }}>
                Informativos fiscais, panfletos, boletos e relatórios de rastreamento (Entregue, Visualizado, Baixado)
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSmtpConfig(!showSmtpConfig)}
            title="Configurar senha do servidor SMTP"
          >
            <Key size={14} /> {showSmtpConfig ? 'Ocultar Config. SMTP' : '⚙️ Configurar Senha SMTP'}
          </button>
        </div>
      </div>

      {/* Caixa de Ajuste de Senha SMTP */}
      {showSmtpConfig && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Key size={16} /> Credenciais do Servidor de E-mail (mail.privilegecontabilidade.com.br)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#78350f' }}>E-mail Remetente</label>
              <input
                className="form-input"
                style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db' }}
                value={smtpUser}
                onChange={e => setSmtpUser(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#78350f' }}>Senha da Caixa Postal (Webmail / cPanel)</label>
              <input
                type="password"
                className="form-input"
                style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db' }}
                value={smtpPass}
                onChange={e => setSmtpPass(e.target.value)}
                placeholder="Insira a senha do e-mail contato@"
              />
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: '#92400e', marginTop: 6 }}>
            ⚠️ Se o servidor retornar <code>Invalid login 535</code>, confirme a senha da sua caixa postal no cPanel/Webmail da Privilege e digite-a acima.
          </div>
        </div>
      )}

      {/* Abas: Novo Disparo vs Fila Automática vs Histórico & Rastreamento */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: 20 }}>
        <button
          onClick={() => setAbaAtiva('novo')}
          style={{
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: 14,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: abaAtiva === 'novo' ? '3px solid #8c1a22' : '3px solid transparent',
            color: abaAtiva === 'novo' ? '#8c1a22' : '#6b7280',
          }}
        >
          ✉️ Novo Disparo de E-mail
        </button>
        <button
          onClick={() => {
            setAbaAtiva('fila');
            carregarFilaServidor();
          }}
          style={{
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: 14,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: abaAtiva === 'fila' ? '3px solid #8c1a22' : '3px solid transparent',
            color: abaAtiva === 'fila' ? '#8c1a22' : '#6b7280',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Clock size={16} /> ⏳ Fila Automática (a cada 65 min)
          {campanhaAtiva && campanhaAtiva.destinatariosPendentes?.length > 0 && (
            <span style={{ background: '#f59e0b', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>
              {campanhaAtiva.destinatariosPendentes.length} pendentes
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setAbaAtiva('historico');
            carregarLogsServidor();
          }}
          style={{
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: 14,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: abaAtiva === 'historico' ? '3px solid #8c1a22' : '3px solid transparent',
            color: abaAtiva === 'historico' ? '#8c1a22' : '#6b7280',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          📊 Histórico de Envios & Rastreamento ({logs.length})
        </button>
      </div>

      {abaAtiva === 'novo' && (
        <>
          {/* Cartões de Status */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#4b5563', fontSize: 13, fontWeight: 600 }}>
                <Users size={18} /> Clientes Cadastrados
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginTop: 6 }}>
                {clientes.length}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{clientesComEmail.length} possuem e-mail válido</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #10b981', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#047857', fontSize: 13, fontWeight: 600 }}>
                <CheckCircle2 size={18} /> Destinatários do Disparo
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#059669', marginTop: 6 }}>
                {totalDestinatariosEstimados}
              </div>
              <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>
                {modoDestinatarios === 'clientes' ? 'Base de clientes' : 'Lista manual de e-mails'}
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#4b5563', fontSize: 13, fontWeight: 600 }}>
                <Eye size={18} /> Taxa de Visualização dos Envios
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb', marginTop: 6 }}>
                {logs.length > 0 ? `${Math.round((logs.filter(l => l.visualizadoEm).length / logs.length) * 100)}%` : '0%'}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Rastreamento por pixel ativo</div>
            </div>
          </div>

          {/* Modelos Prontos (Visíveis apenas no modo Texto) */}
          {tipoFormato === 'texto' && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 12 }}>
                <Sparkles size={16} color="#8c1a22" /> Modelos Prontos de Comunicados (Clique para carregar)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                {modelosProntos.map((mod, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setAssunto(mod.assunto);
                      setMensagem(mod.texto);
                      toast.info('Modelo carregado no formulário!');
                    }}
                    style={{
                      textAlign: 'left',
                      background: '#fff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      padding: '10px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#8c1a22')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>{mod.titulo}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>{mod.assunto}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Formulário Principal */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            
            {/* Escolha do Formato do Comunicado */}
            <div style={{ marginBottom: 20, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10, display: 'block', color: '#1e293b' }}>
                🎨 Formato do E-mail
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div
                  onClick={() => setTipoFormato('imagem')}
                  style={{
                    border: `2px solid ${tipoFormato === 'imagem' ? '#8c1a22' : '#cbd5e1'}`,
                    background: tipoFormato === 'imagem' ? '#fdf2f2' : '#fff',
                    borderRadius: 8,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5, color: tipoFormato === 'imagem' ? '#8c1a22' : '#1e293b' }}>
                    <ImageIcon size={18} /> 🖼️ Somente Imagem (Flyer / Arte / Panfleto)
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
                    Habilita <strong>apenas o Assunto e a Imagem</strong>. O e-mail exibe a logo oficial do escritório e o flyer em destaque.
                  </div>
                </div>

                <div
                  onClick={() => setTipoFormato('texto')}
                  style={{
                    border: `2px solid ${tipoFormato === 'texto' ? '#8c1a22' : '#cbd5e1'}`,
                    background: tipoFormato === 'texto' ? '#fdf2f2' : '#fff',
                    borderRadius: 8,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5, color: tipoFormato === 'texto' ? '#8c1a22' : '#1e293b' }}>
                    <Sparkles size={18} /> 📝 Texto & Comunicado Completo
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
                    Permite redigir texto com parágrafos, modelos prontos e assinatura formal do escritório.
                  </div>
                </div>
              </div>
            </div>

            {/* Seletor de Destinatários */}
            <div style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8, display: 'block' }}>
                🎯 Destinatários do Envio
              </label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: modoDestinatarios === 'clientes' ? '#fdf2f2' : '#f8fafc',
                    border: `1.5px solid ${modoDestinatarios === 'clientes' ? '#8c1a22' : '#d1d5db'}`,
                    padding: '8px 16px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13,
                    color: modoDestinatarios === 'clientes' ? '#8c1a22' : '#374151',
                  }}
                >
                  <input
                    type="radio"
                    name="modoDestinatarios"
                    checked={modoDestinatarios === 'clientes'}
                    onChange={() => setModoDestinatarios('clientes')}
                  />
                  <Users size={16} /> Todos os Clientes Cadastrados ({clientesComEmail.length})
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: modoDestinatarios === 'manual' ? '#fdf2f2' : '#f8fafc',
                    border: `1.5px solid ${modoDestinatarios === 'manual' ? '#8c1a22' : '#d1d5db'}`,
                    padding: '8px 16px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13,
                    color: modoDestinatarios === 'manual' ? '#8c1a22' : '#374151',
                  }}
                >
                  <input
                    type="radio"
                    name="modoDestinatarios"
                    checked={modoDestinatarios === 'manual'}
                    onChange={() => setModoDestinatarios('manual')}
                  />
                  <ListPlus size={16} /> Digitar / Colar Lista de E-mails Personalizada
                </label>
              </div>
            </div>

            {/* Caixa de Lista Manual de E-mails */}
            {modoDestinatarios === 'manual' && (
              <div style={{ marginBottom: 18, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>
                  Cole os e-mails separados por vírgula ou um por linha:
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                  placeholder="cliente1@empresa.com.br, cliente2@outro.com.br"
                  value={listaManual}
                  onChange={e => setListaManual(e.target.value)}
                />
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span>Total identificados: <strong>{destinatariosManuaisValidos.length} e-mail(s) válidos</strong></span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setListaManual(LISTA_PADRAO_CLIENTES_NEWSLETTER.join(';\n'));
                        toast.success('351 e-mails da base carregados na lista!');
                      }}
                      style={{ fontSize: 11, background: '#fdf2f2', border: '1px solid #8c1a22', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontWeight: 700, color: '#8c1a22' }}
                    >
                      📋 Carregar Base Geral (351 e-mails)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setListaManual(prev => (prev ? `${prev}, consultoria@privilegecontabilidade.com.br` : 'consultoria@privilegecontabilidade.com.br'));
                        toast.success('consultoria@privilegecontabilidade.com.br adicionado!');
                      }}
                      style={{ fontSize: 11, background: '#e2e8f0', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontWeight: 600, color: '#1e293b' }}
                    >
                      + Inserir consultoria@...
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Aviso sobre Bloqueio Spamhaus em Hotmail/Outlook */}
            {totalHotmailOutlook > 0 && (
              <div style={{ marginBottom: 18, background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                  <AlertCircle size={16} /> Atenção aos e-mails @hotmail e @outlook ({totalHotmailOutlook} contatos)
                </div>
                <div style={{ fontSize: 12, color: '#78350f', marginTop: 4, lineHeight: 1.5 }}>
                  O IP do servidor de envio da Privilege (<code>177.101.135.181</code>) está em lista de verificação na Spamhaus. Por esse motivo, a Microsoft devolve esses e-mails com <em>MAILER-DAEMON</em>.
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#b45309' }}>
                  <input
                    type="checkbox"
                    checked={filtrarHotmailOutlook}
                    onChange={e => setFiltrarHotmailOutlook(e.target.checked)}
                  />
                  <span>
                    Pular temporariamente contas @hotmail e @outlook (disparar apenas para os outros {todosDestinatariosBrutos.length - totalHotmailOutlook} e-mails até o IP ser deslistado)
                  </span>
                </label>
              </div>
            )}

            {/* Proteção Antiduplicação (Não reenviar para quem já recebeu este assunto hoje) */}
            {totalJaEnviadosHoje > 0 && (
              <div style={{ marginBottom: 18, background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#166534' }}>
                  <ShieldCheck size={18} color="#16a34a" /> 🛡️ Proteção Antiduplicação Inteligente
                </div>
                <div style={{ fontSize: 12, color: '#15803d', marginTop: 4, lineHeight: 1.5 }}>
                  Identificamos que <strong>{totalJaEnviadosHoje}</strong> destinatário(s) desta lista já receberam com sucesso este mesmo comunicado nas últimas 24 horas.
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#166534' }}>
                  <input
                    type="checkbox"
                    checked={evitarDuplicados}
                    onChange={e => setEvitarDuplicados(e.target.checked)}
                  />
                  <span>
                    Não reenviar para quem já recebeu hoje (enviar apenas para os {destinatariosPendentes.length} pendentes)
                  </span>
                </label>
              </div>
            )}

            {/* Assunto */}
            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 13.5, color: '#111827' }}>
                🏷️ Assunto do E-mail *
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e1', fontWeight: 500 }}
                placeholder={tipoFormato === 'imagem' ? 'Ex: Comunicado Importante — Privilege Contabilidade' : 'Ex: Privilege Consultoria — Lembrete de Fechamento Fiscal'}
                value={assunto}
                onChange={e => setAssunto(e.target.value)}
              />
            </div>

            {/* SE MODO SOMENTE IMAGEM: Exibe apenas o Box de Imagem em Destaque */}
            {tipoFormato === 'imagem' ? (
              <div style={{ marginBottom: 22, background: '#fff', border: '2px dashed #8c1a22', borderRadius: 10, padding: 20, textAlign: 'center' }}>
                <div style={{ maxWidth: 500, margin: '0 auto' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#8c1a22', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <ImageIcon size={20} /> Imagem / Flyer do Comunicado *
                  </div>
                  <p style={{ fontSize: 12.5, color: '#64748b', margin: '0 0 16px' }}>
                    O e-mail será enviado com a logo oficial da Privilege no topo e esta arte em largura total.
                  </p>

                  {imagens.length === 0 ? (
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#8c1a22',
                        color: '#fff',
                        padding: '12px 24px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 14,
                        boxShadow: '0 2px 6px rgba(140,26,34,0.25)',
                      }}
                    >
                      <ImageIcon size={18} />
                      <span>Selecionar Imagem (PNG ou JPG)</span>
                      <input type="file" accept="image/*" onChange={handleUploadImagem} style={{ display: 'none' }} />
                    </label>
                  ) : (
                    <div>
                      {imagens.map((img, idx) => (
                        <div key={idx} style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                          <img
                            src={img.base64}
                            alt={img.filename}
                            style={{
                              maxWidth: '100%',
                              maxHeight: 380,
                              borderRadius: 8,
                              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                              border: '1px solid #e2e8f0',
                            }}
                          />
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginTop: 8 }}>
                            Arquivo: {img.filename}
                          </div>
                          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
                            <label
                              style={{
                                cursor: 'pointer',
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: '#8c1a22',
                                background: '#fdf2f2',
                                padding: '6px 14px',
                                borderRadius: 6,
                                border: '1px solid #fecaca',
                              }}
                            >
                              Trocar Imagem
                              <input type="file" accept="image/*" onChange={handleUploadImagem} style={{ display: 'none' }} />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoverImagem(idx)}
                              style={{
                                cursor: 'pointer',
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: '#dc2626',
                                background: '#fef2f2',
                                padding: '6px 14px',
                                borderRadius: 6,
                                border: '1px solid #fee2e2',
                              }}
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {imagens.length > 0 && (
                    <div style={{ marginTop: 20, background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 8, padding: '14px 16px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                        <label style={{ fontSize: 13, fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 16 }}>💬</span> Link de Destino ao Clicar na Imagem (WhatsApp)
                        </label>
                        <button
                          type="button"
                          onClick={() => setLinkDestinoImagem('https://wa.me/5546999048990?text=' + encodeURIComponent('Olá! Vi o comunicado da Privilege e gostaria de mais informações.'))}
                          style={{ fontSize: 11.5, background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                        >
                          Usar WhatsApp Oficial (46) 99904-8990
                        </button>
                      </div>
                      <input
                        type="text"
                        className="input input-bordered w-full"
                        value={linkDestinoImagem}
                        onChange={e => setLinkDestinoImagem(e.target.value)}
                        placeholder="https://wa.me/5546999048990?text=Olá"
                        style={{ fontSize: 13, borderColor: '#86efac', background: '#ffffff', color: '#14532d', fontWeight: 500 }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, color: '#15803d', flexWrap: 'wrap', gap: 6 }}>
                        <span>✅ Quando o cliente clicar no panfleto ou no botão verde no e-mail, abrirá seu WhatsApp instantaneamente!</span>
                        <a href={linkDestinoImagem} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: 700, color: '#166534' }}>
                          Testar Link ↗
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* SE MODO TEXTO: Exibe a Mensagem e as Imagens Opcionais */
              <>
                {/* MODO TEXTO: Editor Formatado com Toolbar e Prévia em Tempo Real */}
                <div className="form-group" style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', margin: 0 }}>
                      ✍️ Conteúdo da Mensagem (com Formatação)
                    </label>
                    <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 2, borderRadius: 6 }}>
                      <button
                        type="button"
                        onClick={() => setAbaMensagem('editor')}
                        style={{
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: abaMensagem === 'editor' ? '#fff' : 'transparent',
                          color: abaMensagem === 'editor' ? '#8c1a22' : '#64748b',
                          boxShadow: abaMensagem === 'editor' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        }}
                      >
                        ✏️ Editor
                      </button>
                      <button
                        type="button"
                        onClick={() => setAbaMensagem('previa')}
                        style={{
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: abaMensagem === 'previa' ? '#fff' : 'transparent',
                          color: abaMensagem === 'previa' ? '#8c1a22' : '#64748b',
                          boxShadow: abaMensagem === 'previa' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        }}
                      >
                        👁️ Prévia Formatada
                      </button>
                    </div>
                  </div>

                  {/* Barra de Ferramentas de Formatação */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 4,
                      background: '#f8fafc',
                      border: '1px solid #d1d5db',
                      borderBottom: 'none',
                      borderRadius: '6px 6px 0 0',
                      padding: '6px 8px',
                      alignItems: 'center',
                    }}
                  >
                    <button
                      type="button"
                      title="Negrito (**texto**)"
                      onClick={() => aplicarFormatacao('**', '**', 'texto em negrito')}
                      style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}
                    >
                      B
                    </button>
                    <button
                      type="button"
                      title="Itálico (*texto*)"
                      onClick={() => aplicarFormatacao('*', '*', 'texto em itálico')}
                      style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontStyle: 'italic', fontSize: 13 }}
                    >
                      I
                    </button>
                    <button
                      type="button"
                      title="Sublinhado (<u>texto</u>)"
                      onClick={() => aplicarFormatacao('<u>', '</u>', 'texto sublinhado')}
                      style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}
                    >
                      U
                    </button>
                    <span style={{ width: 1, height: 18, background: '#cbd5e1', margin: '0 4px' }} />
                    <button
                      type="button"
                      title="Título Grande (# Título)"
                      onClick={() => aplicarFormatacao('### ', '\n', 'Título da Seção')}
                      style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                    >
                      H3 Título
                    </button>
                    <button
                      type="button"
                      title="Lista com Marcadores (• Item)"
                      onClick={() => aplicarFormatacao('• ', '\n', 'Item da lista')}
                      style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12 }}
                    >
                      • Lista
                    </button>
                    <button
                      type="button"
                      title="Caixa de Aviso / Destaque (> Aviso)"
                      onClick={() => aplicarFormatacao('> ', '\n', 'Importante: insira aqui o comunicado de destaque.')}
                      style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12 }}
                    >
                      💬 Destaque
                    </button>
                    <span style={{ width: 1, height: 18, background: '#cbd5e1', margin: '0 4px' }} />
                    <button
                      type="button"
                      title="Inserir Link"
                      onClick={() => {
                        const url = prompt('Digite a URL do link (ex: https://privilegecontabilidade.cnt.br):', 'https://');
                        if (url) aplicarFormatacao('[', `](${url})`, 'Clique aqui');
                      }}
                      style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12 }}
                    >
                      🔗 Link
                    </button>
                    <button
                      type="button"
                      title="Texto em Cor Vinho Privilege"
                      onClick={() => aplicarFormatacao('<span style="color: #600000; font-weight: bold;">', '</span>', 'Texto Vinho')}
                      style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', color: '#600000', fontWeight: 700, fontSize: 12 }}
                    >
                      🍷 Vinho Privilege
                    </button>
                    <button
                      type="button"
                      title="Texto em Cor Verde Sucesso"
                      onClick={() => aplicarFormatacao('<span style="color: #16a34a; font-weight: bold;">', '</span>', 'Texto Verde')}
                      style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', color: '#16a34a', fontWeight: 700, fontSize: 12 }}
                    >
                      🟢 Verde
                    </button>
                  </div>

                  {/* Conteúdo: Editor ou Prévia */}
                  {abaMensagem === 'editor' ? (
                    <textarea
                      ref={textareaRef}
                      className="form-input"
                      rows={9}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        fontSize: 14,
                        borderRadius: '0 0 6px 6px',
                        border: '1px solid #d1d5db',
                        fontFamily: 'Arial, Helvetica, sans-serif',
                        lineHeight: 1.6,
                      }}
                      placeholder="Escreva sua mensagem aqui... Use os botões acima para aplicar Negrito (**texto**), Itálico (*texto*), Título (###), Listas (•) e Cores!"
                      value={mensagem}
                      onChange={e => setMensagem(e.target.value)}
                    />
                  ) : (
                    <div
                      style={{
                        minHeight: 200,
                        maxHeight: 360,
                        overflowY: 'auto',
                        padding: '16px 20px',
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '0 0 6px 6px',
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: '#1e293b',
                      }}
                      dangerouslySetInnerHTML={{ __html: renderPreviewHtml(mensagem) }}
                    />
                  )}
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                    💡 Dica: Você pode usar formatação rápida com botões acima ou digitar diretamente em <strong>HTML</strong> e <strong>Markdown</strong>.
                  </div>
                </div>

                {/* Imagens Anexadas Opcionais */}
                <div style={{ marginBottom: 22, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <label style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ImageIcon size={16} color="#8c1a22" /> Panfletos & Imagens (Opcional)
                    </label>
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}>
                      <span>+ Adicionar Imagem</span>
                      <input type="file" accept="image/*" multiple onChange={handleUploadImagem} style={{ display: 'none' }} />
                    </label>
                  </div>

                  {imagens.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                      Nenhuma imagem anexada. Você pode adicionar panfletos, banners ou comunicados visuais em PNG/JPG.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {imagens.map((img, idx) => (
                        <div
                          key={idx}
                          style={{
                            position: 'relative',
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            padding: 4,
                            background: '#fff',
                            textAlign: 'center',
                            maxWidth: 160,
                          }}
                        >
                          <img src={img.base64} alt={img.filename} style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
                          <div style={{ fontSize: 11, color: '#374151', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {img.filename}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoverImagem(idx)}
                            style={{
                              position: 'absolute',
                              top: -6,
                              right: -6,
                              background: '#ef4444',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '50%',
                              width: 20,
                              height: 20,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {imagens.length > 0 && (
                    <div style={{ marginTop: 20, background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 8, padding: '14px 16px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                        <label style={{ fontSize: 13, fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 16 }}>💬</span> Link de Destino ao Clicar na Imagem (WhatsApp)
                        </label>
                        <button
                          type="button"
                          onClick={() => setLinkDestinoImagem('https://wa.me/5546999048990?text=' + encodeURIComponent('Olá! Vi o comunicado da Privilege e gostaria de mais informações.'))}
                          style={{ fontSize: 11.5, background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                        >
                          Usar WhatsApp Oficial (46) 99904-8990
                        </button>
                      </div>
                      <input
                        type="text"
                        className="input input-bordered w-full"
                        value={linkDestinoImagem}
                        onChange={e => setLinkDestinoImagem(e.target.value)}
                        placeholder="https://wa.me/5546999048990?text=Olá"
                        style={{ fontSize: 13, borderColor: '#86efac', background: '#ffffff', color: '#14532d', fontWeight: 500 }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, color: '#15803d', flexWrap: 'wrap', gap: 6 }}>
                        <span>✅ Quando o cliente clicar no panfleto ou no botão verde no e-mail, abrirá seu WhatsApp instantaneamente!</span>
                        <a href={linkDestinoImagem} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: 700, color: '#166534' }}>
                          Testar Link ↗
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Feedback Detalhado de Envio */}
            {resultadoEnvio && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 20,
                  background: resultadoEnvio.falhas === 0 ? '#ecfdf5' : '#fffbeb',
                  border: `1px solid ${resultadoEnvio.falhas === 0 ? '#10b981' : '#f59e0b'}`,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: resultadoEnvio.falhas === 0 ? '#065f46' : '#92400e' }}>
                  {resultadoEnvio.falhas === 0 ? '✓ Todos os e-mails foram entregues com sucesso!' : 'Aviso no envio de e-mails:'}
                </div>
                <div style={{ fontSize: 12.5, color: '#374151', marginTop: 4 }}>
                  <strong>{resultadoEnvio.enviados}</strong> entregue(s) de <strong>{resultadoEnvio.totalDestinatarios}</strong> destinatários.
                </div>
                {resultadoEnvio.logs && resultadoEnvio.logs.some(l => l.status === 'erro') && (
                  <div style={{ marginTop: 8, padding: 8, background: '#fee2e2', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>
                    <strong>Detalhe da falha retornado pelo servidor:</strong>
                    <div>{resultadoEnvio.logs.find(l => l.status === 'erro')?.erro}</div>
                    <div style={{ marginTop: 4, fontStyle: 'italic' }}>
                      👉 Dica: Se a falha for <code>Invalid login 535</code>, clique em <strong>"⚙️ Configurar Senha SMTP"</strong> no topo da tela e digite a senha correta do e-mail.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Barra de Progresso em Tempo Real (Lotes) */}
            {progressoEnvio?.ativo && (
              <div style={{ background: '#fdf2f2', border: '1.5px solid #8c1a22', borderRadius: 8, padding: 14, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontWeight: 700, fontSize: 13, color: '#8c1a22' }}>
                  <span>📨 Enviando em Lotes: Lote {progressoEnvio.loteAtual} de {progressoEnvio.totalLotes}...</span>
                  <span>{progressoEnvio.atual} / {progressoEnvio.total} ({Math.round((progressoEnvio.atual / Math.max(progressoEnvio.total, 1)) * 100)}%)</span>
                </div>
                <div style={{ width: '100%', height: 10, background: '#fee2e2', borderRadius: 5, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.round((progressoEnvio.atual / Math.max(progressoEnvio.total, 1)) * 100)}%`,
                      height: '100%',
                      background: '#8c1a22',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Enviando com pool SMTP protegido contra tempo limite.</span>
                  <span>Aguarde a conclusão de todos os lotes...</span>
                </div>
              </div>
            )}

            {/* Seletor de Modo de Envio: Fila a cada 65 min vs Disparo Imediato */}
            <div style={{ marginBottom: 20, background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Timer size={16} color="#8c1a22" /> Escolha o Modo de Envio
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div
                  onClick={() => setModoEnvio('fila')}
                  style={{
                    border: `2px solid ${modoEnvio === 'fila' ? '#8c1a22' : '#e2e8f0'}`,
                    background: modoEnvio === 'fila' ? '#fdf2f2' : '#fff',
                    borderRadius: 8,
                    padding: 12,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: modoEnvio === 'fila' ? '#8c1a22' : '#1e293b' }}>
                    <Clock size={16} /> ⏳ Fila Segura (Lotes a cada 65 min)
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
                    <strong>Recomendado!</strong> Envia em lotes de {tamanhoLoteFila} e-mails a cada {intervaloMinutosFila} min. <strong>Nunca estoura o limite por hora</strong> da hospedagem.
                  </div>
                </div>

                <div
                  onClick={() => setModoEnvio('imediato')}
                  style={{
                    border: `2px solid ${modoEnvio === 'imediato' ? '#8c1a22' : '#e2e8f0'}`,
                    background: modoEnvio === 'imediato' ? '#fdf2f2' : '#fff',
                    borderRadius: 8,
                    padding: 12,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: modoEnvio === 'imediato' ? '#8c1a22' : '#1e293b' }}>
                    <Send size={16} /> ⚡ Disparo Direto Imediato
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
                    Dispara todos os {totalDestinatariosEstimados} e-mails na sequência agora (pode falhar se o limite da hospedagem já estiver esgotado).
                  </div>
                </div>
              </div>

              {modoEnvio === 'fila' && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        E-mails por Ciclo (Tamanho do Lote)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={150}
                        value={tamanhoLoteFila}
                        onChange={e => setTamanhoLoteFila(Number(e.target.value) || 70)}
                        style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Recomendado: 60 a 80</span>
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Intervalo entre Lotes (Minutos)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={180}
                        value={intervaloMinutosFila}
                        onChange={e => setIntervaloMinutosFila(Number(e.target.value) || 65)}
                        style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Recomendado: 65 min</span>
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Quando Iniciar o 1º Lote?
                      </label>
                      <select
                        value={iniciarFilaEmMinutos}
                        onChange={e => setIniciarFilaEmMinutos(Number(e.target.value))}
                        style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
                      >
                        <option value={65}>Em 65 min (pois a hospedagem já bateu o limite)</option>
                        <option value={0}>Imediatamente agora (1º lote)</option>
                        <option value={30}>Em 30 minutos</option>
                      </select>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Garante que não bloqueie</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                Destinatários: <strong>{totalDestinatariosEstimados} e-mail(s) pendente(s)</strong>
                {totalJaEnviadosHoje > 0 && evitarDuplicados && (
                  <span style={{ color: '#16a34a', marginLeft: 8, fontWeight: 600 }}>
                    ({totalJaEnviadosHoje} já entregue(s) hoje preservado(s))
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  background: '#8c1a22',
                  borderColor: '#8c1a22',
                  padding: '10px 22px',
                  fontSize: 14,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: (enviando || totalDestinatariosEstimados === 0) ? 0.7 : 1,
                  cursor: (enviando || totalDestinatariosEstimados === 0) ? 'not-allowed' : 'pointer',
                }}
                disabled={enviando || totalDestinatariosEstimados === 0}
                onClick={handleDisparar}
              >
                <Send size={16} />
                {enviando
                  ? '⏳ Processando Disparo...'
                  : totalDestinatariosEstimados === 0 && totalJaEnviadosHoje > 0
                  ? '✓ Todos já Receberam Hoje'
                  : modoEnvio === 'fila'
                  ? `📦 Adicionar à Fila (${totalDestinatariosEstimados} a cada ${intervaloMinutosFila} min)`
                  : `🚀 Disparar Imediatamente para os ${totalDestinatariosEstimados} Destinatários`}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ABA 2: FILA AUTOMÁTICA DE DISPAROS (A CADA 65 MINUTOS) */}
      {abaAtiva === 'fila' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#111827' }}>
                    📦 Fila de Disparos em Lotes Automáticos
                  </h2>
                  {campanhaAtiva && (
                    <span style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 12,
                      background: campanhaAtiva.status === 'processando' ? '#dbeafe' : campanhaAtiva.status === 'pausada' ? '#fef3c7' : campanhaAtiva.status === 'concluida' ? '#dcfce7' : '#fef3c7',
                      color: campanhaAtiva.status === 'processando' ? '#1d4ed8' : campanhaAtiva.status === 'pausada' ? '#b45309' : campanhaAtiva.status === 'concluida' ? '#15803d' : '#b45309',
                    }}>
                      {campanhaAtiva.status === 'processando' && '🔄 Processando Lote Agora...'}
                      {campanhaAtiva.status === 'aguardando' && '⏳ Aguardando Próximo Ciclo'}
                      {campanhaAtiva.status === 'pausada' && '⏸ Fila Pausada'}
                      {campanhaAtiva.status === 'concluida' && '✅ Campanha Concluída'}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 0' }}>
                  Os lotes são processados automaticamente a cada 65 minutos no servidor para respeitar a cota de envio da sua hospedagem.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => carregarFilaServidor()}
                  disabled={carregandoFila}
                >
                  <RefreshCw size={14} className={carregandoFila ? 'spin' : ''} /> Atualizar Fila
                </button>
              </div>
            </div>

            {campanhaAtiva ? (
              <>
                {/* Assunto e Detalhes da Campanha */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Assunto da Mensagem</span>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>
                        {campanhaAtiva.assunto}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Regra de Envio dos Lotes</span>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginTop: 2 }}>
                        {campanhaAtiva.tamanhoLote} e-mails a cada {campanhaAtiva.intervaloMinutos} minutos
                      </div>
                    </div>
                  </div>

                  {/* Alerta de tempo limite ou erro do servidor */}
                  {campanhaAtiva.erroUltimaTentativa && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12.5, color: '#92400e' }}>
                      <strong>⚠️ Observação da Hospedagem:</strong> {campanhaAtiva.erroUltimaTentativa}
                    </div>
                  )}

                  {/* Contagem Regressiva para o Próximo Lote */}
                  {campanhaAtiva.status === 'aguardando' && campanhaAtiva.proximoLoteEm && (
                    <div style={{ marginTop: 14, background: '#fdf2f2', border: '1.5px solid #8c1a22', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Timer size={22} color="#8c1a22" />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#8c1a22' }}>
                            Próximo Lote Agendado
                          </div>
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>
                            Disparo automático às {new Date(campanhaAtiva.proximoLoteEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: 18, fontWeight: 800, color: '#8c1a22', fontFamily: 'monospace' }}>
                        ⏳ {tempoRestanteFormatado || 'Calculando...'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Métricas e Barra de Progresso */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Total de Destinatários</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{campanhaAtiva.totalDestinatarios}</div>
                  </div>

                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 11.5, color: '#166534', fontWeight: 600 }}>Enviados com Sucesso</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d', marginTop: 4 }}>{campanhaAtiva.destinatariosEnviados?.length || 0}</div>
                  </div>

                  <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 11.5, color: '#854d0e', fontWeight: 600 }}>Pendentes na Fila</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#a16207', marginTop: 4 }}>{campanhaAtiva.destinatariosPendentes?.length || 0}</div>
                  </div>

                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 11.5, color: '#991b1b', fontWeight: 600 }}>Falhas Registradas</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#b91c1c', marginTop: 4 }}>{campanhaAtiva.destinatariosFalhas?.length || 0}</div>
                  </div>
                </div>

                {/* Barra de Progresso Geral */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                    <span>Progresso da Campanha</span>
                    <span>{Math.round(((campanhaAtiva.destinatariosEnviados?.length || 0) / Math.max(campanhaAtiva.totalDestinatarios, 1)) * 100)}%</span>
                  </div>
                  <div style={{ width: '100%', height: 12, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.round(((campanhaAtiva.destinatariosEnviados?.length || 0) / Math.max(campanhaAtiva.totalDestinatarios, 1)) * 100)}%`,
                        height: '100%',
                        background: '#8c1a22',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Painel de Controle da Fila */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: 18 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: '#8c1a22', borderColor: '#8c1a22', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    disabled={processandoAcaoFila || campanhaAtiva.destinatariosPendentes?.length === 0}
                    onClick={() => executarAcaoFila('process_now')}
                    title="Dispara o próximo lote imediatamente sem esperar os 65 minutos"
                  >
                    <Play size={16} /> Disparar Próximo Lote Agora ({Math.min(campanhaAtiva.tamanhoLote, campanhaAtiva.destinatariosPendentes?.length || 0)} e-mails)
                  </button>

                  {campanhaAtiva.status === 'pausada' ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      disabled={processandoAcaoFila}
                      onClick={() => executarAcaoFila('resume')}
                    >
                      <Play size={16} /> Retomar Fila
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      disabled={processandoAcaoFila || campanhaAtiva.status === 'concluida'}
                      onClick={() => executarAcaoFila('pause')}
                    >
                      <Pause size={16} /> Pausar Fila
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ color: '#dc2626', borderColor: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}
                    disabled={processandoAcaoFila}
                    onClick={() => {
                      if (confirm('Deseja realmente cancelar e excluir esta campanha da fila?')) {
                        executarAcaoFila('delete');
                      }
                    }}
                  >
                    <Trash2 size={16} /> Cancelar Fila
                  </button>
                </div>

                {/* Próximos Destinatários na Linha */}
                {campanhaAtiva.destinatariosPendentes?.length > 0 && (
                  <div style={{ marginTop: 22 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={16} /> Próximos e-mails da fila ({campanhaAtiva.destinatariosPendentes.length} restantes):
                    </div>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', maxHeight: 150, overflowY: 'auto', fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>
                      {campanhaAtiva.destinatariosPendentes.slice(0, 30).map((d: any, idx: number) => (
                        <div key={idx} style={{ padding: '2px 0' }}>
                          #{idx + 1}: {d.email}
                        </div>
                      ))}
                      {campanhaAtiva.destinatariosPendentes.length > 30 && (
                        <div style={{ padding: '4px 0', color: '#94a3b8', fontStyle: 'italic' }}>
                          ... e mais {campanhaAtiva.destinatariosPendentes.length - 30} destinatários aguardando os próximos lotes.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#9ca3af' }}>
                <Clock size={48} style={{ margin: '0 auto 12px', opacity: 0.5, color: '#8c1a22' }} />
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Nenhuma fila em andamento no momento</div>
                <p style={{ fontSize: 13, color: '#64748b', maxWidth: 440, margin: '6px auto 16px' }}>
                  Quando você fizer um disparo de newsletter e escolher a opção <strong>"Fila Segura (Lotes a cada 65 min)"</strong>, ela aparecerá aqui e disparará os lotes automaticamente a cada 65 min sem estourar o limite da sua hospedagem.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ background: '#8c1a22', borderColor: '#8c1a22', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => setAbaAtiva('novo')}
                >
                  <Mail size={16} /> Iniciar Novo Disparo de E-mail
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: HISTÓRICO COMPLETO COM RASTREAMENTO (Entregue, Visualizado, Baixado) */}
      {abaAtiva === 'historico' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827' }}>
                Relatório de Disparos e Rastreamento de E-mails
              </h2>
              <p style={{ fontSize: 12.5, color: '#6b7280', margin: '2px 0 0' }}>
                Acompanhe em tempo real se o cliente recebeu, abriu/visualizou o comunicado ou se houve falha na entrega
              </p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => carregarLogsServidor()}
              disabled={carregandoLogs}
            >
              <RefreshCw size={14} className={carregandoLogs ? 'spin' : ''} /> Atualizar Lista
            </button>
          </div>

          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
              <Mail size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>Nenhum envio registrado ainda</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Os disparos de newsletter e cobranças aparecerão aqui automaticamente.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', color: '#475569' }}>Data / Hora</th>
                    <th style={{ padding: '10px 12px', color: '#475569' }}>Destinatário</th>
                    <th style={{ padding: '10px 12px', color: '#475569' }}>Tipo / Assunto</th>
                    <th style={{ padding: '10px 12px', color: '#475569' }}>Status de Entrega</th>
                    <th style={{ padding: '10px 12px', color: '#475569' }}>Visualização</th>
                    <th style={{ padding: '10px 12px', color: '#475569' }}>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#64748b' }}>
                        {new Date(log.enviadoEm || log.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{log.destinatarioNome || 'Cliente'}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{log.destinatarioEmail}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontWeight: 700,
                            background: log.tipo === 'cobranca_boleto' ? '#dcfce7' : '#f1f5f9',
                            color: log.tipo === 'cobranca_boleto' ? '#166534' : '#475569',
                            marginRight: 6,
                          }}
                        >
                          {log.tipo === 'cobranca_boleto' ? 'Boleto/NFS-e' : 'Newsletter'}
                        </span>
                        <span style={{ color: '#334155' }}>{log.assunto}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {log.status === 'falha' ? (
                          <span style={{ color: '#dc2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <AlertCircle size={14} /> Falha no Envio
                          </span>
                        ) : (
                          <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={14} /> Entregue
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {log.visualizadoEm || log.status === 'visualizado' ? (
                          <span
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: 11.5,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Eye size={13} /> Visualizado{log.visualizadoEm ? ` às ${new Date(log.visualizadoEm).toLocaleTimeString('pt-BR')}` : ''}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>Aguardando abertura</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>
                        {log.erroMensagem ? (
                          <span style={{ color: '#dc2626' }} title={log.erroMensagem}>
                            {log.erroMensagem.slice(0, 35)}...
                          </span>
                        ) : log.ipAcesso ? (
                          <span>IP: {log.ipAcesso}</span>
                        ) : (
                          <span>OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
