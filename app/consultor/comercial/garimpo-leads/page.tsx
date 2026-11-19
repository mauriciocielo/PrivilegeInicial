'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
  Search, MapPin, Building2, Globe, Mail, MessageSquare, Sparkles,
  Download, Upload, Trash2, CheckCircle2, ExternalLink, Settings,
  Save, RefreshCw, Copy, Plus, Filter, Star, FileSpreadsheet, X, Radar, Send
} from 'lucide-react';
import type { LeadGarimpado } from '../../../api/garimpo-leads/route';

const SEGMENTOS_RAPIDOS = [
  'Clínica Odontológica',
  'Restaurante',
  'Supermercado',
  'Oficina Mecânica',
  'Farmácia',
  'Construtora',
  'Loja de Roupas',
  'Indústria',
  'Academia',
  'Agropecuária',
  'Imobiliária',
  'Hotel',
];

const STATUS_OPTIONS: { value: LeadGarimpado['status']; label: string; badge: string }[] = [
  { value: 'novo', label: 'Novo', badge: 'badge-gray' },
  { value: 'qualificado', label: 'Qualificado', badge: 'badge-blue' },
  { value: 'contato', label: 'Em Contato', badge: 'badge-yellow' },
  { value: 'reuniao', label: 'Reunião Agendada', badge: 'badge-purple' },
  { value: 'proposta', label: 'Proposta Enviada', badge: 'badge-gold' },
  { value: 'convertido', label: 'Convertido', badge: 'badge-green' },
  { value: 'descartado', label: 'Descartado', badge: 'badge-red' },
];

export default function GarimpoLeadsPage() {
  const [aba, setAba] = useState<'mapa' | 'cnpj' | 'base' | 'config'>('mapa');

  // Busca Mapa / Web
  const [segmento, setSegmento] = useState('Clínica Odontológica');
  const [cidade, setCidade] = useState('Francisco Beltrão');
  const [estado, setEstado] = useState('PR');
  const [limite, setLimite] = useState(25);
  const [fonteBusca, setFonteBusca] = useState<'combinado' | 'google_maps' | 'osm'>('combinado');
  const [enriquecerSites, setEnriquecerSites] = useState(true);
  const [buscandoMapa, setBuscandoMapa] = useState(false);
  const [motorUsado, setMotorUsado] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState<LeadGarimpado[]>([]);
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});

  // Busca por CNPJ
  const [cnpjsTexto, setCnpjsTexto] = useState('');
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [resultadosCnpj, setResultadosCnpj] = useState<LeadGarimpado[]>([]);

  // Base Persistida de Leads
  const [baseLeads, setBaseLeads] = useState<LeadGarimpado[]>([]);
  const [carregandoBase, setCarregandoBase] = useState(true);
  const [salvandoBase, setSalvandoBase] = useState(false);

  // Filtros da Base (Lapidação Avançada)
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroIcp, setFiltroIcp] = useState<'todos' | 'ouro' | 'prata' | 'bronze'>('todos');
  const [filtroNotaMin, setFiltroNotaMin] = useState<number>(0);
  const [apenasWhatsapp, setApenasWhatsapp] = useState(false);
  const [apenasCelular, setApenasCelular] = useState(false);
  const [apenasEmail, setApenasEmail] = useState(false);
  const [lapidandoLote, setLapidandoLote] = useState<{ ativo: boolean; atual: number; total: number } | null>(null);

  // Modal de Qualificação IA & Envio Direto de E-mail
  const [leadModal, setLeadModal] = useState<LeadGarimpado | null>(null);
  const [qualificandoId, setQualificandoId] = useState<string | null>(null);
  const [enriquecendoId, setEnriquecendoId] = useState<string | null>(null);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [enviandoWhatsId, setEnviandoWhatsId] = useState<string | null>(null);
  const [emailMarketingConfig, setEmailMarketingConfig] = useState<any>(null);

  // Configurações (Google Places API + Gosom + Oferta IA)
  const [googlePlacesApiKey, setGooglePlacesApiKey] = useState('');
  const [gosomUrl, setGosomUrl] = useState('');
  const [contextoOferta, setContextoOferta] = useState(
    'Privilege Contabilidade & Consultoria — BPO Financeiro, Precificação Real, Margem de Lucro e Planejamento Tributário'
  );
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega base e configurações do PostgreSQL
  useEffect(() => {
    const carregarTudo = async () => {
      setCarregandoBase(true);
      try {
        const res = await fetch('/api/comercial?empresaId=default');
        if (res.ok) {
          const json = await res.json();
          const data = json?.data || {};
          if (Array.isArray(data.garimpo_leads_db)) {
            setBaseLeads(data.garimpo_leads_db);
          }
          if (data.garimpo_leads_config && typeof data.garimpo_leads_config === 'object') {
            const c = data.garimpo_leads_config;
            if (c.googlePlacesApiKey) setGooglePlacesApiKey(c.googlePlacesApiKey);
            if (c.gosomUrl) setGosomUrl(c.gosomUrl);
            if (c.contextoOferta) setContextoOferta(c.contextoOferta);
            if (c.cidadePadrao) setCidade(c.cidadePadrao);
            if (c.estadoPadrao) setEstado(c.estadoPadrao);
          }
          if (data.email_marketing_config && typeof data.email_marketing_config === 'object') {
            setEmailMarketingConfig(data.email_marketing_config);
          }
        }
      } catch {}
      finally {
        setCarregandoBase(false);
      }
    };
    carregarTudo();
  }, []);

  const persistirBase = async (novaLista: LeadGarimpado[], mensagemToast?: string) => {
    setBaseLeads(novaLista);
    setSalvandoBase(true);
    try {
      const res = await fetch('/api/comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: 'default',
          sectionKey: 'garimpo_leads_db',
          value: novaLista,
        }),
      });
      if (!res.ok) {
        toast.error('Erro ao salvar base de leads no servidor.');
      } else if (mensagemToast) {
        toast.success(mensagemToast);
      }
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e.message}`);
    } finally {
      setSalvandoBase(false);
    }
  };

  const salvarConfig = async () => {
    setSalvandoConfig(true);
    try {
      const res = await fetch('/api/comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: 'default',
          sectionKey: 'garimpo_leads_config',
          value: {
            googlePlacesApiKey: googlePlacesApiKey.trim(),
            gosomUrl: gosomUrl.trim(),
            contextoOferta: contextoOferta.trim(),
            cidadePadrao: cidade.trim(),
            estadoPadrao: estado.trim().toUpperCase(),
          },
        }),
      });
      if (res.ok) {
        toast.success('Configurações do Garimpador salvas com sucesso!');
      } else {
        toast.error('Falha ao salvar configurações.');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvandoConfig(false);
    }
  };

  // Motor 1: Buscar Empresas no Mapa
  const executarBuscaMapa = async () => {
    if (!segmento.trim() || !cidade.trim()) {
      toast.error('Informe o segmento e a cidade para garimpar.');
      return;
    }
    setBuscandoMapa(true);
    setResultadosBusca([]);
    setSelecionados({});
    try {
      const res = await fetch('/api/garimpo-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'buscar_mapa',
          segmento: segmento.trim(),
          cidade: cidade.trim(),
          estado: estado.trim().toUpperCase() || 'PR',
          limite,
          fonteBusca,
          enriquecerSites,
          googlePlacesApiKey: googlePlacesApiKey.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || 'Erro ao buscar empresas.');
        return;
      }
      const lista: LeadGarimpado[] = json.leads || [];
      setResultadosBusca(lista);
      setMotorUsado(json.motor || '');
      const sel: Record<string, boolean> = {};
      lista.forEach(l => { sel[l.id] = true; });
      setSelecionados(sel);
      if (lista.length === 0) {
        toast.info('Nenhuma empresa encontrada com esse termo exato. Tente um segmento mais amplo ou configure a Google Places API.');
      } else {
        toast.success(`${lista.length} empresa(s) garimpadas via ${json.motor}!`);
      }
    } catch (e: any) {
      toast.error(`Erro na busca: ${e.message}`);
    } finally {
      setBuscandoMapa(false);
    }
  };

  // Motor 2: Enriquecer CNPJs em Lote
  const executarBuscaCnpj = async () => {
    if (!cnpjsTexto.trim()) {
      toast.error('Cole ao menos um CNPJ para consultar.');
      return;
    }
    setBuscandoCnpj(true);
    setResultadosCnpj([]);
    try {
      const res = await fetch('/api/garimpo-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enriquecer_cnpj',
          cnpjs: cnpjsTexto,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || 'Erro ao consultar CNPJs.');
        return;
      }
      setResultadosCnpj(json.leads || []);
      toast.success(`${json.leads?.length || 0} empresa(s) enriquecidas na Receita Federal!`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBuscandoCnpj(false);
    }
  };

  // Salvar leads na Base (deduplicando por nome+cidade ou cnpj)
  const adicionarLeadsNaBase = async (novos: LeadGarimpado[]) => {
    if (novos.length === 0) {
      toast.info('Selecione ao menos um lead.');
      return;
    }
    const chavesExistentes = new Set(
      baseLeads.map(l =>
        l.cnpj
          ? `cnpj:${l.cnpj.replace(/\D/g, '')}`
          : `nome:${l.nome.toLowerCase().trim()}|${l.cidade.toLowerCase().trim()}`
      )
    );
    const paraInserir: LeadGarimpado[] = [];
    for (const item of novos) {
      const chave = item.cnpj
        ? `cnpj:${item.cnpj.replace(/\D/g, '')}`
        : `nome:${item.nome.toLowerCase().trim()}|${item.cidade.toLowerCase().trim()}`;
      if (!chavesExistentes.has(chave)) {
        chavesExistentes.add(chave);
        paraInserir.push(item);
      }
    }
    if (paraInserir.length === 0) {
      toast.info('Todos os leads selecionados já estão salvos na sua base.');
      return;
    }
    const atualizada = [...paraInserir, ...baseLeads];
    await persistirBase(atualizada, `${paraInserir.length} lead(s) adicionados à Base de Prospecção!`);
  };

  // Qualificar Lead com IA (estilo Garimpo-Leads)
  const qualificarLeadIA = async (lead: LeadGarimpado) => {
    setQualificandoId(lead.id);
    try {
      const res = await fetch('/api/garimpo-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'qualificar_ia',
          lead,
          contextoOferta,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || 'Erro ao qualificar lead.');
        return;
      }
      const r = json.resultado;
      const atualizado: LeadGarimpado = {
        ...lead,
        score: r.score ?? lead.score,
        status: lead.status === 'novo' ? 'qualificado' : lead.status,
        iaDiagnostico: r.diagnostico,
        iaScriptWhatsapp: r.scriptWhatsapp,
        iaAssuntoEmail: r.assuntoEmail,
        iaCorpoEmail: r.corpoEmail,
      };
      setLeadModal(atualizado);
      if (baseLeads.some(l => l.id === lead.id)) {
        const novaLista = baseLeads.map(l => (l.id === lead.id ? atualizado : l));
        await persistirBase(novaLista, 'Lead qualificado pela IA!');
      } else {
        toast.success('Script e diagnóstico gerados!');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setQualificandoId(null);
    }
  };

  // Lapidação Profunda Individual (Site + /contato + /sobre + Receita CNPJ + Classificação ICP)
  const lapidarLeadProfundo = async (lead: LeadGarimpado) => {
    setEnriquecendoId(lead.id);
    try {
      const res = await fetch('/api/garimpo-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lapidar_lead', lead }),
      });
      const json = await res.json();
      if (res.ok && json.ok && json.lead) {
        const atualizado: LeadGarimpado = json.lead;
        const novaLista = baseLeads.map(l => (l.id === lead.id ? atualizado : l));
        await persistirBase(novaLista, `${lead.nome} lapidado! Score: ${atualizado.score} pts.`);
      } else {
        toast.info('Nenhum dado adicional encontrado para este lead.');
      }
    } catch {
      toast.error('Erro ao lapidar lead.');
    } finally {
      setEnriquecendoId(null);
    }
  };

  // Lapidação em Lote (até 10 leads filtrados ainda não lapidados)
  const lapidarLoteFiltrado = async () => {
    const candidatos = leadsFiltrados.filter(l => !l.lapidadoEm).slice(0, 10);
    const alvos = candidatos.length > 0 ? candidatos : leadsFiltrados.slice(0, 10);
    if (alvos.length === 0) {
      toast.info('Nenhum lead na lista filtrada para lapidar.');
      return;
    }
    setLapidandoLote({ ativo: true, atual: 0, total: alvos.length });
    let listaAtual = [...baseLeads];
    let enriquecidos = 0;

    for (let i = 0; i < alvos.length; i++) {
      setLapidandoLote({ ativo: true, atual: i + 1, total: alvos.length });
      try {
        const res = await fetch('/api/garimpo-leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'lapidar_lead', lead: alvos[i] }),
        });
        const json = await res.json();
        if (res.ok && json.ok && json.lead) {
          listaAtual = listaAtual.map(l => (l.id === alvos[i].id ? json.lead : l));
          enriquecidos++;
        }
      } catch {}
    }

    setLapidandoLote(null);
    await persistirBase(listaAtual, `Lapidação concluída: ${enriquecidos} lead(s) enriquecidos e pontuados!`);
  };

  const atualizarStatusLead = async (id: string, status: LeadGarimpado['status']) => {
    const novaLista = baseLeads.map(l => (l.id === id ? { ...l, status } : l));
    await persistirBase(novaLista);
  };

  const excluirLead = async (id: string) => {
    const novaLista = baseLeads.filter(l => l.id !== id);
    await persistirBase(novaLista, 'Lead removido da base.');
  };

  // Envio direto de Cold Email para o lead usando a configuração de E-mail Marketing
  const enviarEmailDiretoLead = async (lead: LeadGarimpado) => {
    const destino = (lead.email || '').trim();
    if (!destino || !destino.includes('@')) {
      toast.error('Informe um endereço de e-mail válido para este lead antes de enviar.');
      return;
    }
    const assunto = (lead.iaAssuntoEmail || '').trim() || `Diagnóstico Financeiro & Tributário — ${lead.nome}`;
    const mensagem = (lead.iaCorpoEmail || '').trim();
    if (!mensagem) {
      toast.error('Preencha o corpo do e-mail ou clique em "Regenerar com IA" antes de enviar.');
      return;
    }

    setEnviandoEmail(true);
    try {
      const cfg = emailMarketingConfig || {};
      const res = await fetch('/api/email-servicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'newsletter',
          somenteImagem: false,
          assunto,
          mensagem,
          destinatariosLista: [destino],
          smtpHostCustom: cfg.smtpHost || undefined,
          smtpPortCustom: cfg.smtpPort ? Number(cfg.smtpPort) : undefined,
          smtpUserCustom: cfg.smtpUser || undefined,
          smtpPassCustom: cfg.smtpPass || undefined,
          senderNameCustom: cfg.senderName || undefined,
          replyToCustom: cfg.replyTo || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.enviados > 0) {
        toast.success(`E-mail enviado com sucesso para ${destino}!`);
        const proximoStatus: LeadGarimpado['status'] =
          lead.status === 'novo' || lead.status === 'qualificado' ? 'contato' : lead.status;
        const atualizado: LeadGarimpado = { ...lead, email: destino, status: proximoStatus };
        setLeadModal(atualizado);
        if (baseLeads.some(l => l.id === lead.id)) {
          const novaLista = baseLeads.map(l => (l.id === lead.id ? atualizado : l));
          await persistirBase(novaLista);
        }
      } else {
        const erroMsg = json?.logs?.[0]?.erro || json?.error || 'Falha ao disparar e-mail. Verifique as credenciais em E-mail Marketing.';
        toast.error(erroMsg);
      }
    } catch (err: any) {
      toast.error(`Erro ao enviar e-mail: ${err.message}`);
    } finally {
      setEnviandoEmail(false);
    }
  };

  // Envio direto pelo WhatsApp interno do sistema (sem abrir nova tela)
  const enviarWhatsappInterno = async (lead: LeadGarimpado, textoCustom?: string) => {
    const telefoneAlvo = (lead.whatsapp || lead.telefone || '').replace(/\D/g, '');
    if (telefoneAlvo.length < 10) {
      toast.error('Este lead não possui número de WhatsApp/telefone válido.');
      return;
    }

    const textoFinal =
      (textoCustom ?? lead.iaScriptWhatsapp ?? '').trim() ||
      `Olá, pessoal da ${lead.nome}! Tudo bem? Aqui é da equipe do Mauricio na Privilege Consultoria.\n\nAcompanhamos empresas do segmento de ${lead.categoria || 'vocês'} em ${lead.cidade || 'sua região'} e o Mauricio separou dois horários esta semana para um Raio-X rápido e gratuito de precificação, margem e impostos. Faz sentido conversarmos 15 minutinhos?`;

    setEnviandoWhatsId(lead.id);
    try {
      // 1. Garante o chat no WhatsApp interno
      const chatRes = await fetch('/api/whatsapp/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_chat',
          phone: telefoneAlvo,
          name: lead.nome,
        }),
      });
      const chatJson = await chatRes.json();
      if (!chatRes.ok || !chatJson.success || !chatJson.chat?.id) {
        toast.error(chatJson.error || 'Não foi possível criar conversa no WhatsApp interno.');
        return;
      }

      // 2. Dispara a mensagem pelo WhatsApp interno (Baileys)
      const msgRes = await fetch('/api/whatsapp/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chatJson.chat.id,
          text: textoFinal,
          sentBy: 'consultor',
        }),
      });
      const msgJson = await msgRes.json();
      if (!msgRes.ok || !msgJson.success) {
        toast.error(msgJson.error || 'Falha ao enviar pelo WhatsApp interno. Verifique se o QR Code está conectado.');
        return;
      }

      toast.success(`WhatsApp enviado para ${lead.nome} pelo sistema interno!`);

      // Atualiza status para "Em Contato" na base
      const proximoStatus: LeadGarimpado['status'] =
        lead.status === 'novo' || lead.status === 'qualificado' ? 'contato' : lead.status;
      const atualizado: LeadGarimpado = { ...lead, status: proximoStatus, iaScriptWhatsapp: textoFinal };
      if (leadModal?.id === lead.id) {
        setLeadModal(atualizado);
      }
      if (baseLeads.some(l => l.id === lead.id)) {
        const novaLista = baseLeads.map(l => (l.id === lead.id ? atualizado : l));
        await persistirBase(novaLista);
      }
    } catch (err: any) {
      toast.error(`Erro ao enviar WhatsApp: ${err.message}`);
    } finally {
      setEnviandoWhatsId(null);
    }
  };

  // Importar CSV/JSON do gosom/google-maps-scraper ou Excel
  const importarArquivoGosom = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let rows: any[] = [];
      if (file.name.toLowerCase().endsWith('.json')) {
        const txt = await file.text();
        const parsed = JSON.parse(txt);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws);
      }

      const now = new Date().toISOString();
      const convertidos: LeadGarimpado[] = rows
        .map((r, idx): LeadGarimpado | null => {
          const nome = String(r.title || r.nome || r.name || r.empresa || '').trim();
          if (!nome) return null;
          const tel = String(r.phone || r.telefone || r.whatsapp || '').trim();
          const digits = tel.replace(/\D/g, '');
          const whatsapp = digits.length >= 10 ? (digits.startsWith('55') ? digits : `55${digits}`) : '';
          const email = String(r.email || r.emails || '').split(',')[0].trim();
          const website = String(r.web_site || r.website || r.site || '').trim();
          const endereco = String(r.address || r.endereco || '').trim();
          const cidadeRow = String(r.city || r.cidade || cidade).trim();
          const estadoRow = String(r.state || r.estado || estado).trim();
          const nota = r.review_rating ? Number(r.review_rating) : undefined;
          const avaliacoes = r.review_count ? Number(r.review_count) : undefined;
          let score = 25;
          if (whatsapp) score += 25;
          if (email) score += 20;
          if (website) score += 12;
          if (nota && nota >= 4) score += 8;
          if (avaliacoes && avaliacoes >= 20) score += 10;

          return {
            id: `gosom_${Date.now()}_${idx}`,
            nome,
            categoria: String(r.category || r.categoria || 'Google Maps').trim(),
            cidade: cidadeRow,
            estado: estadoRow,
            endereco,
            telefone: tel,
            whatsapp,
            email,
            website,
            instagram: String(r.instagram || '').trim(),
            cnpj: String(r.cnpj || '').trim(),
            nota,
            avaliacoes,
            mapsUrl:
              String(r.link || r.mapsUrl || '').trim() ||
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nome} ${cidadeRow}`)}`,
            fonte: 'gosom_import',
            score: Math.min(100, score),
            status: 'novo',
            criadoEm: now,
          };
        })
        .filter((x): x is LeadGarimpado => x !== null);

      if (convertidos.length === 0) {
        toast.error('Nenhum lead reconhecido no arquivo. Use colunas como title/nome, phone/telefone, email, web_site.');
        return;
      }
      await adicionarLeadsNaBase(convertidos);
      setAba('base');
    } catch (err: any) {
      toast.error(`Erro ao importar arquivo: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Leads filtrados na Base (com filtros de Lapidação ICP)
  const leadsFiltrados = useMemo(() => {
    const q = filtroTexto.toLowerCase().trim();
    return baseLeads.filter(l => {
      if (filtroStatus !== 'todos' && l.status !== filtroStatus) return false;
      const tier = l.icpTier || (l.score >= 80 ? 'ouro' : l.score >= 60 ? 'prata' : 'bronze');
      if (filtroIcp !== 'todos' && tier !== filtroIcp) return false;
      if (filtroNotaMin > 0 && (!l.nota || l.nota < filtroNotaMin)) return false;
      if (apenasWhatsapp && !l.whatsapp) return false;
      if (apenasCelular) {
        const digits = (l.whatsapp || l.telefone || '').replace(/\D/g, '');
        const isCel =
          l.tipoTelefone === 'celular' ||
          (digits.startsWith('55') && digits.length === 13 && digits[4] === '9') ||
          (!digits.startsWith('55') && digits.length === 11 && digits[2] === '9');
        if (!isCel) return false;
      }
      if (apenasEmail && !l.email) return false;
      if (q) {
        const hay = `${l.nome} ${l.categoria} ${l.cidade} ${l.email} ${l.telefone} ${l.cnpj} ${l.socios || ''} ${l.porte || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [baseLeads, filtroTexto, filtroStatus, filtroIcp, filtroNotaMin, apenasWhatsapp, apenasCelular, apenasEmail]);

  const kpis = useMemo(() => {
    const total = baseLeads.length;
    const comWhats = baseLeads.filter(l => l.whatsapp).length;
    const comEmail = baseLeads.filter(l => l.email).length;
    const quentes = baseLeads.filter(l => l.score >= 70).length;
    const emFunil = baseLeads.filter(l => ['contato', 'reuniao', 'proposta', 'convertido'].includes(l.status)).length;
    return { total, comWhats, comEmail, quentes, emFunil };
  }, [baseLeads]);

  const exportarExcel = () => {
    if (leadsFiltrados.length === 0) {
      toast.info('Nenhum lead na lista filtrada para exportar.');
      return;
    }
    const rows = leadsFiltrados.map(l => ({
      Empresa: l.nome,
      Categoria: l.categoria,
      Cidade: l.cidade,
      UF: l.estado,
      Status: STATUS_OPTIONS.find(s => s.value === l.status)?.label || l.status,
      Score: l.score,
      Telefone: l.telefone,
      WhatsApp: l.whatsapp,
      Email: l.email,
      Website: l.website,
      Instagram: l.instagram,
      CNPJ: l.cnpj,
      Porte: l.porte || '',
      Socios: l.socios || '',
      NotaGoogle: l.nota ?? '',
      Avaliacoes: l.avaliacoes ?? '',
      Endereco: l.endereco,
      GoogleMaps: l.mapsUrl,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads Garimpados');
    XLSX.writeFile(wb, `leads-privilege-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${rows.length} lead(s) exportados para Excel!`);
  };

  const copiarEmailsFiltrados = () => {
    const emails = Array.from(new Set(leadsFiltrados.map(l => l.email).filter(e => e && e.includes('@'))));
    if (emails.length === 0) {
      toast.info('Nenhum lead filtrado possui e-mail.');
      return;
    }
    navigator.clipboard.writeText(emails.join('\n'));
    toast.success(`${emails.length} e-mail(s) copiados! Cole na aba "Lista Manual" do E-mail Marketing.`);
  };

  const scoreBadgeClass = (score: number) => {
    if (score >= 75) return 'badge badge-green';
    if (score >= 50) return 'badge badge-yellow';
    return 'badge badge-gray';
  };

  return (
    <div style={{ paddingBottom: 44 }}>
      {/* Cabeçalho Editorial */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Radar size={22} color="var(--accent)" />
            Garimpador de Leads B2B
          </h1>
          <p className="page-subtitle">
            Prospecção geolocalizada, enriquecimento de sites/CNPJ, qualificação com IA e integração direta com WhatsApp & E-mail Marketing
          </p>
        </div>
        <div className="page-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={importarArquivoGosom}
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            title="Importar CSV/JSON do gosom/google-maps-scraper ou planilha Excel"
          >
            <Upload size={14} /> Importar CSV/Gosom
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportarExcel}>
            <FileSpreadsheet size={14} /> Exportar Excel
          </button>
          <button
            className={aba === 'config' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            onClick={() => setAba(aba === 'config' ? 'mapa' : 'config')}
          >
            <Settings size={14} /> Integrações
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* KPIs Executivos */}
        <div className="kpi-grid" style={{ marginBottom: 20 }}>
          <div className="kpi-card">
            <div className="kpi-label">Base de Leads</div>
            <div className="kpi-value">{kpis.total}</div>
            <div className="kpi-sub">Empresas salvas no CRM</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Com WhatsApp / Tel.</div>
            <div className="kpi-value" style={{ color: 'var(--green)' }}>{kpis.comWhats}</div>
            <div className="kpi-sub">Prontos para abordagem ativa</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Com E-mail Corporativo</div>
            <div className="kpi-value" style={{ color: 'var(--blue)' }}>{kpis.comEmail}</div>
            <div className="kpi-sub">Prontos para E-mail Marketing</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Leads Quentes (70+)</div>
            <div className="kpi-value" style={{ color: 'var(--accent)' }}>{kpis.quentes}</div>
            <div className="kpi-sub">{kpis.emFunil} em negociação ativa</div>
          </div>
        </div>

        {/* Barra de Abas */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20, overflowX: 'auto' }}>
          {[
            { id: 'mapa', label: 'Garimpar por Mapa & Nicho', icon: MapPin },
            { id: 'cnpj', label: 'Enriquecer por CNPJ (Receita)', icon: Building2 },
            { id: 'base', label: `Base de Leads (${baseLeads.length})`, icon: Filter },
            { id: 'config', label: 'Google Maps / Gosom / IA', icon: Settings },
          ].map(tab => {
            const Icon = tab.icon;
            const active = aba === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setAba(tab.id as any)}
                style={{
                  padding: '10px 18px',
                  fontWeight: active ? 600 : 500,
                  fontSize: 13.5,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* ABA 1: GARIMPAR POR MAPA & NICHO */}
        {aba === 'mapa' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card">
              <div className="card-header" style={{ marginBottom: 14 }}>
                <div>
                  <h2 className="card-title">Motor de Busca Geolocalizada (Google Maps + OpenStreetMap)</h2>
                  <p className="card-subtitle">
                    Busca empresas diretamente no Google Maps e complementa com OpenStreetMap, extraindo telefone, site, notas, e-mail, Instagram e CNPJ.
                  </p>
                </div>
                <span className="badge badge-green">
                  {googlePlacesApiKey ? 'Google Places API + OSM' : 'Google Maps + OSM'}
                </span>
              </div>

              {/* Chips de Segmentos Rápidos */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {SEGMENTOS_RAPIDOS.map(seg => (
                  <button
                    key={seg}
                    type="button"
                    className={segmento === seg ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                    onClick={() => setSegmento(seg)}
                    style={{ padding: '4px 11px', fontSize: 12 }}
                  >
                    {seg}
                  </button>
                ))}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Segmento / Nicho Alvo</label>
                  <input
                    className="form-control"
                    value={segmento}
                    onChange={e => setSegmento(e.target.value)}
                    placeholder="Ex: Clínica Odontológica, Restaurante, Construtora..."
                    onKeyDown={e => e.key === 'Enter' && executarBuscaMapa()}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Cidade</label>
                  <input
                    className="form-control"
                    value={cidade}
                    onChange={e => setCidade(e.target.value)}
                    placeholder="Ex: Francisco Beltrão"
                    onKeyDown={e => e.key === 'Enter' && executarBuscaMapa()}
                  />
                </div>
                <div className="form-group" style={{ maxWidth: 110 }}>
                  <label className="form-label">UF</label>
                  <input
                    className="form-control"
                    maxLength={2}
                    value={estado}
                    onChange={e => setEstado(e.target.value.toUpperCase())}
                    placeholder="PR"
                  />
                </div>
                <div className="form-group" style={{ maxWidth: 210 }}>
                  <label className="form-label">Motor de Busca</label>
                  <select className="form-control" value={fonteBusca} onChange={e => setFonteBusca(e.target.value as any)}>
                    <option value="combinado">Google Maps + OSM</option>
                    <option value="google_maps">Somente Google Maps</option>
                    <option value="osm">Somente OpenStreetMap</option>
                  </select>
                </div>
                <div className="form-group" style={{ maxWidth: 130 }}>
                  <label className="form-label">Limite</label>
                  <select className="form-control" value={limite} onChange={e => setLimite(Number(e.target.value))}>
                    <option value={15}>15 empresas</option>
                    <option value={25}>25 empresas</option>
                    <option value={40}>40 empresas</option>
                    <option value={60}>60 empresas</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={enriquecerSites}
                    onChange={e => setEnriquecerSites(e.target.checked)}
                  />
                  Enriquecer websites automaticamente (extrair e-mail, WhatsApp, Instagram e CNPJ)
                </label>

                <button
                  className="btn btn-primary"
                  disabled={buscandoMapa}
                  onClick={executarBuscaMapa}
                >
                  <Search size={15} />
                  {buscandoMapa ? 'Garimpando empresas...' : 'Garimpar Leads Agora'}
                </button>
              </div>
            </div>

            {/* Tabela de Resultados da Busca */}
            {resultadosBusca.length > 0 && (
              <div className="card">
                <div className="card-header" style={{ marginBottom: 14 }}>
                  <div>
                    <h3 className="card-title">
                      {resultadosBusca.length} empresa(s) encontrada(s) · {motorUsado}
                    </h3>
                    <p className="card-subtitle">
                      Revise os resultados, qualifique com IA ou salve os selecionados na sua Base de Prospecção.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        adicionarLeadsNaBase(resultadosBusca.filter(l => selecionados[l.id]))
                      }
                    >
                      <Plus size={14} /> Salvar Selecionados ({Object.values(selecionados).filter(Boolean).length})
                    </button>
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 34 }}>
                          <input
                            type="checkbox"
                            checked={resultadosBusca.every(l => selecionados[l.id])}
                            onChange={e => {
                              const next: Record<string, boolean> = {};
                              resultadosBusca.forEach(l => { next[l.id] = e.target.checked; });
                              setSelecionados(next);
                            }}
                          />
                        </th>
                        <th>Empresa / Categoria</th>
                        <th>Score</th>
                        <th>Telefone / WhatsApp</th>
                        <th>E-mail / Site</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadosBusca.map(lead => (
                        <tr key={lead.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={!!selecionados[lead.id]}
                              onChange={e =>
                                setSelecionados(prev => ({ ...prev, [lead.id]: e.target.checked }))
                              }
                            />
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lead.nome}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {lead.categoria} · {lead.endereco || `${lead.cidade}/${lead.estado}`}
                            </div>
                            {lead.nota && (
                              <div style={{ fontSize: 11.5, color: 'var(--yellow)', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                                <Star size={11} fill="currentColor" /> {lead.nota.toFixed(1)} ({lead.avaliacoes || 0})
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={scoreBadgeClass(lead.score)}>{lead.score} pts</span>
                          </td>
                          <td>
                            {lead.whatsapp ? (
                              <button
                                type="button"
                                disabled={enviandoWhatsId === lead.id}
                                onClick={() => enviarWhatsappInterno(lead)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  color: 'var(--green)',
                                  fontWeight: 600,
                                  fontSize: 12.5,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                                title="Clique para enviar mensagem diretamente pelo WhatsApp interno"
                              >
                                {enviandoWhatsId === lead.id ? 'Enviando...' : lead.telefone || lead.whatsapp}
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                            )}
                          </td>
                          <td>
                            {lead.email && (
                              <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{lead.email}</div>
                            )}
                            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                              {lead.website && (
                                <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--blue)' }}>
                                  Site ↗
                                </a>
                              )}
                              {lead.instagram && (
                                <a href={lead.instagram} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--accent)' }}>
                                  Instagram ↗
                                </a>
                              )}
                              <a href={lead.mapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                                Maps ↗
                              </a>
                            </div>
                          </td>
                          <td>
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={qualificandoId === lead.id}
                              onClick={() => qualificarLeadIA(lead)}
                            >
                              <Sparkles size={13} /> {qualificandoId === lead.id ? 'Gerando...' : 'IA Script'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: ENRIQUECER POR CNPJ (RECEITA FEDERAL) */}
        {aba === 'cnpj' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card">
              <div className="card-header" style={{ marginBottom: 14 }}>
                <div>
                  <h2 className="card-title">Consulta & Enriquecimento em Lote por CNPJ</h2>
                  <p className="card-subtitle">
                    Cole até 20 CNPJs (um por linha ou separados por vírgula). Extraímos Razão Social, Sócios (QSA), Porte, Capital Social, CNAE, Telefone e E-mail via BrasilAPI / Receita.
                  </p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Lista de CNPJs</label>
                <textarea
                  className="form-control"
                  rows={5}
                  value={cnpjsTexto}
                  onChange={e => setCnpjsTexto(e.target.value)}
                  placeholder={'58.033.979/0001-84\n00.000.000/0001-91'}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  className="btn btn-primary"
                  disabled={buscandoCnpj}
                  onClick={executarBuscaCnpj}
                >
                  <Building2 size={15} />
                  {buscandoCnpj ? 'Consultando Receita...' : 'Consultar & Enriquecer CNPJs'}
                </button>
              </div>
            </div>

            {resultadosCnpj.length > 0 && (
              <div className="card">
                <div className="card-header" style={{ marginBottom: 14 }}>
                  <h3 className="card-title">{resultadosCnpj.length} empresa(s) enriquecida(s)</h3>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => adicionarLeadsNaBase(resultadosCnpj)}
                  >
                    <Plus size={14} /> Salvar Todos na Base
                  </button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Empresa / CNPJ</th>
                        <th>Sócios (QSA) & Porte</th>
                        <th>Contato</th>
                        <th>Score</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadosCnpj.map(lead => (
                        <tr key={lead.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{lead.nome}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {lead.cnpj} · {lead.cidade}/{lead.estado}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: 12.5 }}>{lead.socios || '—'}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                              {lead.porte || 'Porte N/I'}
                              {lead.capitalSocial ? ` · Capital R$ ${lead.capitalSocial.toLocaleString('pt-BR')}` : ''}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: 12.5 }}>{lead.telefone || '—'}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{lead.email || '—'}</div>
                          </td>
                          <td><span className={scoreBadgeClass(lead.score)}>{lead.score} pts</span></td>
                          <td>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => qualificarLeadIA(lead)}
                            >
                              <Sparkles size={13} /> IA Script
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 3: BASE DE LEADS & FUNIL CRM */}
        {aba === 'base' && (
          <div className="card">
            <div className="card-header" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 className="card-title">Base de Prospecção & Funil</h2>
                <p className="card-subtitle">
                  {leadsFiltrados.length} de {baseLeads.length} lead(s) exibidos · Salvo automaticamente no banco de dados
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!!lapidandoLote}
                  onClick={lapidarLoteFiltrado}
                  title="Varre /contato e /sobre dos sites, busca CNPJ na Receita Federal, identifica Celular vs Fixo e recalcula ICP"
                >
                  <Sparkles size={14} />
                  {lapidandoLote
                    ? `Lapidando ${lapidandoLote.atual}/${lapidandoLote.total}...`
                    : 'Lapidar em Lote (até 10)'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={copiarEmailsFiltrados}>
                  <Copy size={14} /> Copiar E-mails
                </button>
                <Link href="/consultor/newsletter" className="btn btn-secondary btn-sm">
                  <Mail size={14} /> Ir para E-mail Marketing
                </Link>
              </div>
            </div>

            {/* Barra de Filtros de Lapidação */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
              <input
                className="form-control"
                style={{ flex: '1 1 220px' }}
                value={filtroTexto}
                onChange={e => setFiltroTexto(e.target.value)}
                placeholder="Buscar por empresa, segmento, cidade, e-mail, CNPJ ou sócio..."
              />
              <select
                className="form-control"
                style={{ width: 165 }}
                value={filtroStatus}
                onChange={e => setFiltroStatus(e.target.value)}
              >
                <option value="todos">Todos os Status</option>
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <select
                className="form-control"
                style={{ width: 155 }}
                value={filtroIcp}
                onChange={e => setFiltroIcp(e.target.value as any)}
              >
                <option value="todos">Todos ICP</option>
                <option value="ouro">ICP Ouro (80+)</option>
                <option value="prata">ICP Prata (60–79)</option>
                <option value="bronze">ICP Bronze (&lt;60)</option>
              </select>
              <select
                className="form-control"
                style={{ width: 135 }}
                value={filtroNotaMin}
                onChange={e => setFiltroNotaMin(Number(e.target.value))}
              >
                <option value={0}>Qualquer Nota</option>
                <option value={4}>Nota ≥ 4.0★</option>
                <option value={4.5}>Nota ≥ 4.5★</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={apenasCelular} onChange={e => setApenasCelular(e.target.checked)} />
                Só Celular/WhatsApp
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={apenasEmail} onChange={e => setApenasEmail(e.target.checked)} />
                Só E-mail
              </label>
            </div>

            {carregandoBase ? (
              <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
                Carregando base de leads...
              </div>
            ) : leadsFiltrados.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
                Nenhum lead encontrado. Use a aba <strong>Garimpar por Mapa & Nicho</strong> ou importe um CSV do <code>gosom/google-maps-scraper</code>.
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Empresa / Local</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th>Contatos</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadsFiltrados.map(lead => (
                      <tr key={lead.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{lead.nome}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {lead.categoria} · {lead.cidade}/{lead.estado}
                            {lead.cnpj ? ` · ${lead.cnpj}` : ''}
                          </div>
                          {lead.socios && (
                            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                              Sócios: {lead.socios}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                            <span className={scoreBadgeClass(lead.score)}>{lead.score} pts</span>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color:
                                  (lead.icpTier || (lead.score >= 80 ? 'ouro' : lead.score >= 60 ? 'prata' : 'bronze')) === 'ouro'
                                    ? 'var(--gold)'
                                    : 'var(--text-muted)',
                              }}
                            >
                              ICP {lead.icpTier || (lead.score >= 80 ? 'ouro' : lead.score >= 60 ? 'prata' : 'bronze')}
                            </span>
                          </div>
                        </td>
                        <td>
                          <select
                            className="form-control"
                            style={{ padding: '4px 8px', fontSize: 12, width: 145 }}
                            value={lead.status}
                            onChange={e => atualizarStatusLead(lead.id, e.target.value as LeadGarimpado['status'])}
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12.5 }}>
                            {lead.whatsapp && (
                              <button
                                type="button"
                                disabled={enviandoWhatsId === lead.id}
                                onClick={() => enviarWhatsappInterno(lead)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  color: 'var(--green)',
                                  fontWeight: 600,
                                  fontSize: 12.5,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                                title="Clique para disparar diretamente pelo WhatsApp interno"
                              >
                                {enviandoWhatsId === lead.id
                                  ? 'Enviando WhatsApp...'
                                  : `WhatsApp: ${lead.telefone || lead.whatsapp}`}
                              </button>
                            )}
                            {lead.email && <span>{lead.email}</span>}
                            <div style={{ display: 'flex', gap: 8 }}>
                              {lead.website && (
                                <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--blue)' }}>
                                  Site ↗
                                </a>
                              )}
                              <a href={lead.mapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                                Maps ↗
                              </a>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={qualificandoId === lead.id}
                              onClick={() => (lead.iaScriptWhatsapp ? setLeadModal(lead) : qualificarLeadIA(lead))}
                              title="Qualificar com IA e gerar Script de WhatsApp + Cold Email"
                            >
                              <Sparkles size={13} />
                              {qualificandoId === lead.id ? '...' : lead.iaScriptWhatsapp ? 'Ver Script' : 'IA Script'}
                            </button>
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={qualificandoId === lead.id}
                              onClick={() => (lead.iaCorpoEmail ? setLeadModal(lead) : qualificarLeadIA(lead))}
                              title={lead.email ? `Enviar e-mail direto para ${lead.email}` : 'Abrir envio de e-mail para este lead'}
                            >
                              <Send size={13} /> E-mail
                            </button>
                            {lead.whatsapp && (
                              <button
                                className="btn btn-success btn-sm"
                                disabled={enviandoWhatsId === lead.id}
                                onClick={() => enviarWhatsappInterno(lead)}
                                title="Disparar mensagem diretamente pelo WhatsApp interno (sem abrir nova tela)"
                              >
                                <MessageSquare size={13} />
                                {enviandoWhatsId === lead.id ? 'Enviando...' : 'WhatsApp'}
                              </button>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={enriquecendoId === lead.id}
                              onClick={() => lapidarLeadProfundo(lead)}
                              title="Lapidar Lead: varrer /contato e /sobre do site, enriquecer CNPJ/Sócios na Receita e recalcular ICP"
                            >
                              <Globe size={13} />
                              {enriquecendoId === lead.id ? 'Lapidando...' : lead.lapidadoEm ? 'Relapidar' : 'Lapidar'}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => excluirLead(lead.id)}
                              title="Remover da base"
                              style={{ color: 'var(--red)' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ABA 4: CONFIGURAÇÕES & INTEGRAÇÕES (GOOGLE MAPS / GOSOM / IA) */}
        {aba === 'config' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="grid-2">
              <div className="card">
                <div className="card-header" style={{ marginBottom: 14 }}>
                  <div>
                    <h3 className="card-title">Google Maps Places API (Opcional)</h3>
                    <p className="card-subtitle">
                      Sem chave, o sistema usa OpenStreetMap gratuitamente. Com a Google Places API Key, você puxa notas, quantidade de avaliações e telefones oficiais do Google Maps.
                    </p>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Google Places API Key</label>
                  <input
                    type="password"
                    className="form-control"
                    value={googlePlacesApiKey}
                    onChange={e => setGooglePlacesApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">URL da Instância gosom/google-maps-scraper (Opcional)</label>
                  <input
                    className="form-control"
                    value={gosomUrl}
                    onChange={e => setGosomUrl(e.target.value)}
                    placeholder="Ex: http://localhost:8080 ou https://seu-gosom.up.railway.app"
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-header" style={{ marginBottom: 14 }}>
                  <div>
                    <h3 className="card-title">Contexto da Oferta para a IA</h3>
                    <p className="card-subtitle">
                      Define o posicionamento usado para gerar diagnósticos, scripts de WhatsApp e e-mails frios.
                    </p>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Descrição da Oferta / Proposta de Valor</label>
                  <textarea
                    className="form-control"
                    rows={5}
                    value={contextoOferta}
                    onChange={e => setContextoOferta(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Guia rápido para rodar gosom/google-maps-scraper e importar */}
            <div className="card">
              <div className="card-header" style={{ marginBottom: 10 }}>
                <div>
                  <h3 className="card-title">Usando com gosom/google-maps-scraper (Docker / CLI)</h3>
                  <p className="card-subtitle">
                    Caso queira raspar centenas de empresas do Google Maps com o binário open-source do <code>gosom/google-maps-scraper</code>, gere o CSV/JSON e importe aqui pelo botão <strong>Importar CSV/Gosom</strong>.
                  </p>
                </div>
              </div>
              <pre
                style={{
                  background: 'var(--bg-card2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  fontSize: 12,
                  overflowX: 'auto',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
{`docker run -p 8080:8080 gosom/google-maps-scraper:latest -web -data-folder /gmapsdata`}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" disabled={salvandoConfig} onClick={salvarConfig}>
                <Save size={15} /> {salvandoConfig ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE QUALIFICAÇÃO IA & SCRIPTS */}
      {leadModal && (
        <div className="modal-overlay" onClick={() => setLeadModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{leadModal.nome}</h2>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {leadModal.categoria} · {leadModal.cidade}/{leadModal.estado} · Score {leadModal.score}/100
                </div>
              </div>
              <button className="modal-close" onClick={() => setLeadModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div className="form-label">Diagnóstico da Dor Provável</div>
                <div
                  style={{
                    background: 'var(--bg-card2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: 14,
                    fontSize: 13.5,
                    lineHeight: 1.6,
                  }}
                >
                  {leadModal.iaDiagnostico}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="form-label" style={{ margin: 0 }}>Script de Abordagem — WhatsApp</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(leadModal.iaScriptWhatsapp || '');
                        toast.success('Script de WhatsApp copiado!');
                      }}
                    >
                      <Copy size={13} /> Copiar
                    </button>
                    {leadModal.whatsapp && (
                      <button
                        type="button"
                        disabled={enviandoWhatsId === leadModal.id}
                        onClick={() => enviarWhatsappInterno(leadModal, leadModal.iaScriptWhatsapp)}
                        className="btn btn-primary btn-sm"
                      >
                        <MessageSquare size={13} />
                        {enviandoWhatsId === leadModal.id ? 'Enviando...' : 'Enviar no WhatsApp'}
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  className="form-control"
                  rows={5}
                  value={leadModal.iaScriptWhatsapp || ''}
                  onChange={e => setLeadModal({ ...leadModal, iaScriptWhatsapp: e.target.value })}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                  <span className="form-label" style={{ margin: 0 }}>Cold Email Personalizado</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`Assunto: ${leadModal.iaAssuntoEmail}\n\n${leadModal.iaCorpoEmail}`);
                        toast.success('Cold Email copiado!');
                      }}
                    >
                      <Copy size={13} /> Copiar E-mail
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={enviandoEmail}
                      onClick={() => enviarEmailDiretoLead(leadModal)}
                    >
                      <Send size={13} /> {enviandoEmail ? 'Enviando...' : 'Enviar E-mail Agora'}
                    </button>
                  </div>
                </div>
                <div className="form-row" style={{ marginBottom: 8 }}>
                  <input
                    type="email"
                    className="form-control"
                    value={leadModal.email || ''}
                    onChange={e => setLeadModal({ ...leadModal, email: e.target.value })}
                    placeholder="E-mail do destinatário (ex: contato@empresa.com.br)"
                  />
                  <input
                    className="form-control"
                    style={{ fontWeight: 600 }}
                    value={leadModal.iaAssuntoEmail || ''}
                    onChange={e => setLeadModal({ ...leadModal, iaAssuntoEmail: e.target.value })}
                    placeholder="Assunto do e-mail"
                  />
                </div>
                <textarea
                  className="form-control"
                  rows={6}
                  value={leadModal.iaCorpoEmail || ''}
                  onChange={e => setLeadModal({ ...leadModal, iaCorpoEmail: e.target.value })}
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                className="btn btn-secondary"
                onClick={() => qualificarLeadIA(leadModal)}
                disabled={qualificandoId === leadModal.id}
              >
                <RefreshCw size={14} /> Regenerar com IA
              </button>
              <button className="btn btn-primary" onClick={() => setLeadModal(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
