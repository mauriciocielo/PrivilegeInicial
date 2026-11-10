'use client';

import { useState, useEffect } from 'react';
import { store, Empresa, Cliente } from '../../../lib/store';
import { toast } from 'sonner';
import { Mail, Send, Users, CheckCircle2, Image as ImageIcon, X, ListPlus, Sparkles } from 'lucide-react';

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
  const [resultadoEnvio, setResultadoEnvio] = useState<{
    ok: boolean;
    enviados: number;
    falhas: number;
    totalDestinatarios: number;
  } | null>(null);

  const load = (eId: string) => {
    if (!eId) return;
    setEmpresaId(eId);
    setEmpresa(store.getEmpresas().find(e => e.id === eId) || null);
    const clis = store.getClientes(eId).filter(c => c.ativo);
    setClientes(clis);
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
      toast.success(`Disparo realizado com sucesso! (${data.enviados} enviados de ${data.totalDestinatarios})`);
    } catch (err: any) {
      toast.error(`Falha na conexão: ${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="page-body" style={{ maxWidth: 1080, margin: '0 auto', paddingBottom: 40 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
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
                Envie comunicados fiscais, panfletos, imagens e informativos para a base de clientes ou lista personalizada de e-mails
              </p>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Empresa Selecionada</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#8c1a22' }}>
            {empresa?.razaoSocial || 'Privilege Consultoria'}
          </div>
        </div>
      </div>

      {/* Cartões de Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 24 }}>
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
            <CheckCircle2 size={18} /> Destinatários do Disparo Atual
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#059669', marginTop: 6 }}>
            {totalDestinatariosEstimados}
          </div>
          <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>
            {modoDestinatarios === 'clientes' ? 'Base ativa de clientes' : 'Lista manual de e-mails'}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#4b5563', fontSize: 13, fontWeight: 600 }}>
            <Mail size={18} /> Servidor SMTP
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginTop: 8 }}>
            mail.privilegecontabilidade.com.br
          </div>
          <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>● E-mail institucional configurado</div>
        </div>
      </div>

      {/* Modelos Prontos */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 24 }}>
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
        <div style={{ marginBottom: 20 }}>
          <label className="form-label" style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8, display: 'block' }}>
            🎯 Para quem enviar?
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
          <div style={{ marginBottom: 20, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>
              Cole os e-mails separados por vírgula ou um por linha:
            </label>
            <textarea
              className="form-input"
              rows={4}
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
              placeholder="cliente1@empresa.com.br, cliente2@outro.com.br ou um por linha"
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
            placeholder="Ex: Privilege Consultoria — Informativo Mensal"
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

        {/* Seção de Imagens Anexadas / Embutidas */}
        <div style={{ marginBottom: 22, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ImageIcon size={16} color="#8c1a22" /> Imagens / Panfletos do E-mail (Exibidas diretamente no corpo do e-mail)
            </label>
            <label
              className="btn btn-secondary btn-sm"
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}
            >
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
                  <img
                    src={img.base64}
                    alt={img.filename}
                    style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 4, display: 'block' }}
                  />
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
                    title="Remover imagem"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feedback de Envio */}
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
              {resultadoEnvio.falhas === 0 ? '✓ Todos os e-mails foram enviados com sucesso!' : 'Aviso no envio de e-mails:'}
            </div>
            <div style={{ fontSize: 12.5, color: '#374151', marginTop: 4 }}>
              <strong>{resultadoEnvio.enviados}</strong> e-mail(s) entregues com sucesso de um total de <strong>{resultadoEnvio.totalDestinatarios}</strong> destinatários.
              {resultadoEnvio.falhas > 0 && ` (${resultadoEnvio.falhas} falhas registradas).`}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            Destinatários: <strong>{totalDestinatariosEstimados} e-mail(s)</strong> selecionado(s)
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
    </div>
  );
}
