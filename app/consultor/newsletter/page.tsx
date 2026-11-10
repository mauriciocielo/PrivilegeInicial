'use client';

import { useState, useEffect } from 'react';
import { store, Empresa, Cliente } from '../../../lib/store';
import { toast } from 'sonner';
import {
  Mail, Send, Users, CheckCircle2, Image as ImageIcon, X, ListPlus, Sparkles,
  Eye, Download, RefreshCw, Key, ShieldCheck, AlertCircle
} from 'lucide-react';

export default function NewsletterPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [modoDestinatarios, setModoDestinatarios] = useState<'clientes' | 'manual'>('clientes');
  const [listaManual, setListaManual] = useState('');
  const [imagens, setImagens] = useState<{ filename: string; base64: string }[]>([]);
  const [enviando, setEnviando] = useState(false);
  
  // Customização / Ajuste de Senha SMTP em tela
  const [showSmtpConfig, setShowSmtpConfig] = useState(false);
  const [smtpUser, setSmtpUser] = useState('contato@privilegecontabilidade.com.br');
  const [smtpPass, setSmtpPass] = useState('Con@*010203');

  // Logs e Auditoria de E-mails
  const [logs, setLogs] = useState<any[]>([]);
  const [carregandoLogs, setCarregandoLogs] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'novo' | 'historico'>('novo');

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
    const clis = store.getClientes(eId).filter(c => c.ativo);
    setClientes(clis);
    carregarLogsServidor(eId);
  };

  const carregarLogsServidor = async (eId?: string) => {
    setCarregandoLogs(true);
    try {
      const res = await fetch(`/api/email-servicos/log?empresaId=${encodeURIComponent(eId || empresaId)}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {}
    finally {
      setCarregandoLogs(false);
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || '';
    if (saved) load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, []);

  const clientesComEmail = clientes.filter(c => c.email && c.email.includes('@'));

  const destinatariosManuaisValidos = listaManual
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(s => s.includes('@'));

  const totalDestinatariosEstimados =
    modoDestinatarios === 'clientes' ? clientesComEmail.length : destinatariosManuaisValidos.length;

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
        const base64 = reader.result as string;
        setImagens(prev => [...prev, { filename: file.name, base64 }]);
        toast.success(`Imagem ${file.name} anexada com sucesso!`);
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
      toast.error('Informe o assunto da newsletter.');
      return;
    }
    if (!mensagem.trim() && imagens.length === 0) {
      toast.error('Escreva o conteúdo da mensagem ou anexe uma imagem.');
      return;
    }
    if (totalDestinatariosEstimados === 0) {
      toast.error(
        modoDestinatarios === 'clientes'
          ? 'Nenhum cliente com e-mail cadastrado nesta empresa.'
          : 'Insira pelo menos um e-mail válido na lista de disparo.'
      );
      return;
    }

    if (!confirm(`Confirmar o disparo deste comunicado para ${totalDestinatariosEstimados} destinatário(s)?`)) {
      return;
    }

    setEnviando(true);
    setResultadoEnvio(null);

    try {
      const res = await fetch('/api/email-servicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'newsletter',
          empresaId,
          assunto,
          mensagem,
          destinatariosLista: modoDestinatarios === 'manual' ? listaManual : undefined,
          smtpUserCustom: smtpUser.trim(),
          smtpPassCustom: smtpPass.trim(),
          imagens: imagens.map((img, idx) => ({
            filename: img.filename,
            base64: img.base64,
            cid: `img_anexo_${idx}`,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || 'Erro ao realizar o disparo da newsletter.');
        return;
      }

      setResultadoEnvio(data);
      if (data.enviados > 0) {
        toast.success(`Disparo realizado! ${data.enviados} enviado(s) com sucesso.`);
      } else {
        toast.error(`Falha no envio: verifique a senha do e-mail (${data.logs?.[0]?.erro || 'Erro de autenticação'})`);
      }
      carregarLogsServidor();
    } catch (err: any) {
      toast.error(`Falha na conexão: ${err.message}`);
    } finally {
      setEnviando(false);
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

      {/* Abas: Novo Disparo vs Histórico & Rastreamento */}
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

      {abaAtiva === 'novo' ? (
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

          {/* Modelos Prontos */}
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

          {/* Formulário Principal */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
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
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                  Total identificados: <strong>{destinatariosManuaisValidos.length} e-mail(s) válidos</strong>
                </div>
              </div>
            )}

            {/* Assunto */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                Assunto do E-mail *
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '9px 12px', fontSize: 14, borderRadius: 6, border: '1px solid #d1d5db' }}
                placeholder="Ex: Privilege Consultoria — Lembrete de Fechamento Fiscal"
                value={assunto}
                onChange={e => setAssunto(e.target.value)}
              />
            </div>

            {/* Mensagem */}
            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                Texto da Mensagem
              </label>
              <textarea
                className="form-input"
                rows={8}
                style={{ width: '100%', padding: '10px 12px', fontSize: 13.5, borderRadius: 6, border: '1px solid #d1d5db', fontFamily: 'Arial, sans-serif' }}
                placeholder="Digite aqui o texto do informativo..."
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
              />
            </div>

            {/* Imagens Anexadas */}
            <div style={{ marginBottom: 22, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ImageIcon size={16} color="#8c1a22" /> Panfletos & Imagens (Incorporadas no corpo do e-mail)
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
            </div>

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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                Destinatários: <strong>{totalDestinatariosEstimados} e-mail(s)</strong>
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
                }}
                disabled={enviando || totalDestinatariosEstimados === 0}
                onClick={handleDisparar}
              >
                <Send size={16} />
                {enviando ? '⏳ Disparando E-mails...' : `🚀 Disparar para os ${totalDestinatariosEstimados} Destinatários`}
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Aba 2: HISTÓRICO COMPLETO COM RASTREAMENTO (Entregue, Visualizado, Baixado) */
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
                        {log.visualizadoEm ? (
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
                            <Eye size={13} /> Visualizado às {new Date(log.visualizadoEm).toLocaleTimeString('pt-BR')}
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
