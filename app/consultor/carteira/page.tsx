'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  FileText,
  Gift,
  Headphones,
  History,
  KeyRound,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '../../../lib/reports';
import { confirmAsync } from '../../../components/ConfirmProvider';
import { AuditoriaEquipeTab, SuporteChamadosTab } from '../../../components/EscritorioChamadosAuditoria';
import { IndiqueContadorTab, RaioXProspectTab } from '../../../components/EscritorioCrescimentoTabs';

interface EmpresaSaude {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  telefone: string;
  email: string;
  regime: 'MEI' | 'Simples Nacional' | 'Regime Normal';
  statusCertificado: 'valido' | 'vencendo' | 'vencido' | 'procuracao' | 'ausente';
  diasCertificado: number | null;
  certValidoAte: string | null;
  faturamentoMes: number;
  nfseMesQtd: number;
  nfseMesValor: number;
  nfeEmitMesQtd: number;
  nfeEmitMesValor: number;
  nfeRecMesQtd: number;
  nfeRecMesValor: number;
  rbt12: number;
  tetoRbt12: number | null;
  sublimiteRbt12: number | null;
  percentualTeto: number | null;
  alertaRbt12: 'ok' | 'atencao' | 'critico';
  totalRecorrencias: number;
  recorrenciaPendente: boolean;
  semaforo: 'verde' | 'amarelo' | 'vermelho';
  alertas: string[];
}

interface ResumoCarteira {
  totalEmpresas: number;
  verdes: number;
  amarelas: number;
  vermelhas: number;
  certVencidos: number;
  certVencendo: number;
  alertasRbt12: number;
  recorrenciasPendentes: number;
  faturamentoMesTotal: number;
  rbt12CarteiraTotal: number;
}

interface MembroEquipe {
  id: string;
  name: string;
  email: string;
  phone: string;
  papel: 'admin_escritorio' | 'operador';
  empresaIds: string[];
  createdAt: string;
}

interface EmpresaSimples {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
}

function formatCnpj(cnpj: string): string {
  const d = (cnpj || '').replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export default function CarteiraEscritorioPage() {
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().slice(0, 7));
  const [aba, setAba] = useState<'saude' | 'equipe' | 'chamados' | 'auditoria' | 'raiox' | 'indicacoes'>('saude');
  const [abrirModalChamado, setAbrirModalChamado] = useState(false);
  const [enviandoDossieId, setEnviandoDossieId] = useState<string | null>(null);

  // Modal Link A1 Self-Service
  const [conviteA1Modal, setConviteA1Modal] = useState<{
    empresa: EmpresaSaude;
    link: string;
    whatsappEnviado?: boolean;
  } | null>(null);
  const [gerandoLinkA1Id, setGerandoLinkA1Id] = useState<string | null>(null);

  // Saúde da carteira
  const [carregando, setCarregando] = useState(true);
  const [baixandoZip, setBaixandoZip] = useState(false);
  const [escritorio, setEscritorio] = useState<{ id: string; nome: string; papel: string } | null>(null);
  const [ehAdminEscritorio, setEhAdminEscritorio] = useState(false);
  const [resumo, setResumo] = useState<ResumoCarteira | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaSaude[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroSemaforo, setFiltroSemaforo] = useState<'todos' | 'vermelho' | 'amarelo' | 'verde'>('todos');
  const [enviandoWhatsId, setEnviandoWhatsId] = useState<string | null>(null);

  // Equipe do escritório
  const [carregandoEquipe, setCarregandoEquipe] = useState(false);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [empresasEquipe, setEmpresasEquipe] = useState<EmpresaSimples[]>([]);
  const [modalMembroAberto, setModalMembroAberto] = useState(false);
  const [editandoMembro, setEditandoMembro] = useState<MembroEquipe | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formSenha, setFormSenha] = useState('');
  const [formTodasEmpresas, setFormTodasEmpresas] = useState(true);
  const [formEmpresaIds, setFormEmpresaIds] = useState<string[]>([]);
  const [salvandoMembro, setSalvandoMembro] = useState(false);

  const carregarSaude = useCallback(async (mes: string) => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/escritorio/saude-carteira?mes=${encodeURIComponent(mes)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível carregar a saúde da carteira.');
        return;
      }
      setEscritorio(data.escritorio || null);
      setEhAdminEscritorio(Boolean(data.ehAdminEscritorio));
      setResumo(data.resumo || null);
      setEmpresas(Array.isArray(data.empresas) ? data.empresas : []);
    } catch {
      toast.error('Erro de conexão ao carregar a carteira.');
    } finally {
      setCarregando(false);
    }
  }, []);

  const carregarEquipe = useCallback(async () => {
    setCarregandoEquipe(true);
    try {
      const res = await fetch('/api/escritorio/equipe');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMembros(Array.isArray(data.membros) ? data.membros : []);
        setEmpresasEquipe(Array.isArray(data.empresas) ? data.empresas : []);
      }
    } catch {
      // ignora
    } finally {
      setCarregandoEquipe(false);
    }
  }, []);

  useEffect(() => {
    carregarSaude(competencia);
  }, [competencia, carregarSaude]);

  useEffect(() => {
    if (aba === 'equipe' && escritorio && ehAdminEscritorio) {
      carregarEquipe();
    }
  }, [aba, escritorio, ehAdminEscritorio, carregarEquipe]);

  const empresasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const dig = busca.replace(/\D/g, '');
    return empresas.filter((e) => {
      if (filtroSemaforo !== 'todos' && e.semaforo !== filtroSemaforo) return false;
      if (!q) return true;
      return (
        e.razaoSocial.toLowerCase().includes(q) ||
        (e.nomeFantasia || '').toLowerCase().includes(q) ||
        e.cnpj.includes(q) ||
        (dig && e.cnpj.replace(/\D/g, '').includes(dig))
      );
    });
  }, [empresas, busca, filtroSemaforo]);

  const handleBaixarFechamentoZip = async () => {
    setBaixandoZip(true);
    try {
      const res = await fetch(`/api/escritorio/fechamento-fiscal?mes=${encodeURIComponent(competencia)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Não foi possível gerar o pacote fiscal.');
        return;
      }
      const blob = await res.blob();
      const totalXmls = res.headers.get('X-Total-Xmls') || '0';
      const totalEmp = res.headers.get('X-Total-Empresas') || '0';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Fechamento_Fiscal_${competencia}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Pacote fiscal baixado! ${totalEmp} empresa(s) · ${totalXmls} XML(s) + planilha Excel consolidada.`);
    } catch {
      toast.error('Erro de conexão ao gerar pacote fiscal.');
    } finally {
      setBaixandoZip(false);
    }
  };

  const handleAvisarCliente = async (emp: EmpresaSaude, tipo: 'certificado' | 'rbt12' | 'resumo') => {
    const chave = `${emp.id}:${tipo}`;
    setEnviandoWhatsId(chave);
    try {
      if (tipo === 'resumo') {
        const res = await fetch(`/api/nfse/emissores/${emp.id}/fechamento-whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ competencia, telefone: emp.telefone || '' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error || 'Não foi possível enviar o resumo no WhatsApp.');
          return;
        }
        toast.success(`Resumo mensal enviado no WhatsApp para ${emp.nomeFantasia || emp.razaoSocial}!`);
      } else {
        const res = await fetch('/api/escritorio/avisar-cliente-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empresaId: emp.id,
            tipo,
            telefone: emp.telefone || '',
            rbt12: emp.rbt12,
            teto: emp.sublimiteRbt12 || emp.tetoRbt12 || 0,
            regime: emp.regime,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error || 'Não foi possível enviar o aviso no WhatsApp.');
          return;
        }
        toast.success(`Aviso enviado no WhatsApp para ${data.destinoNome || emp.razaoSocial}!`);
      }
    } catch {
      toast.error('Erro de conexão ao disparar WhatsApp.');
    } finally {
      setEnviandoWhatsId(null);
    }
  };

  const handleDossiePdf = async (emp: EmpresaSaude, enviarWhatsapp = false) => {
    if (!enviarWhatsapp) {
      window.open(
        `/api/escritorio/dossie-cliente?empresaId=${encodeURIComponent(emp.id)}&mes=${encodeURIComponent(competencia)}`,
        '_blank'
      );
      return;
    }
    setEnviandoDossieId(emp.id);
    try {
      const res = await fetch('/api/escritorio/dossie-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: emp.id, competencia, telefone: emp.telefone || '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível enviar o Dossiê no WhatsApp.');
        return;
      }
      toast.success(`Dossiê Executivo PDF enviado no WhatsApp para ${emp.nomeFantasia || emp.razaoSocial}!`);
    } catch {
      toast.error('Erro de conexão ao enviar Dossiê.');
    } finally {
      setEnviandoDossieId(null);
    }
  };

  const handleGerarLinkA1 = async (emp: EmpresaSaude, enviarWhatsapp = false) => {
    setGerandoLinkA1Id(emp.id);
    try {
      const res = await fetch('/api/escritorio/convite-certificado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: emp.id, enviarWhatsapp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível gerar o link do Certificado A1.');
        return;
      }
      setConviteA1Modal({ empresa: emp, link: data.link, whatsappEnviado: data.whatsappEnviado });
      if (enviarWhatsapp) {
        if (data.whatsappEnviado) toast.success('Link seguro enviado no WhatsApp do cliente!');
        else toast.info(`Link gerado! (${data.whatsappAviso || 'Copie e envie manualmente ao cliente.'})`);
      } else {
        toast.success('Link seguro de envio do Certificado A1 gerado!');
      }
    } catch {
      toast.error('Erro de conexão ao gerar link A1.');
    } finally {
      setGerandoLinkA1Id(null);
    }
  };

  const abrirModalNovoMembro = () => {
    setEditandoMembro(null);
    setFormNome('');
    setFormEmail('');
    setFormPhone('');
    setFormSenha('');
    setFormTodasEmpresas(true);
    setFormEmpresaIds(empresasEquipe.map((e) => e.id));
    setModalMembroAberto(true);
  };

  const abrirModalEditarMembro = (m: MembroEquipe) => {
    setEditandoMembro(m);
    setFormNome(m.name);
    setFormEmail(m.email);
    setFormPhone(m.phone || '');
    setFormSenha('');
    const temTodas = empresasEquipe.length > 0 && m.empresaIds.length >= empresasEquipe.length;
    setFormTodasEmpresas(temTodas);
    setFormEmpresaIds(m.empresaIds || []);
    setModalMembroAberto(true);
  };

  const handleSalvarMembro = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoMembro(true);
    try {
      const metodo = editandoMembro ? 'PATCH' : 'POST';
      const payload = editandoMembro
        ? {
            id: editandoMembro.id,
            name: formNome.trim(),
            phone: formPhone.trim(),
            password: formSenha.trim() || undefined,
            todasEmpresas: formTodasEmpresas,
            empresaIds: formEmpresaIds,
          }
        : {
            name: formNome.trim(),
            email: formEmail.trim().toLowerCase(),
            phone: formPhone.trim(),
            password: formSenha.trim(),
            todasEmpresas: formTodasEmpresas,
            empresaIds: formEmpresaIds,
          };

      const res = await fetch('/api/escritorio/equipe', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar membro da equipe.');
        return;
      }
      toast.success(editandoMembro ? 'Membro atualizado com sucesso!' : 'Auxiliar criado! Já pode acessar com o e-mail e senha.');
      setModalMembroAberto(false);
      carregarEquipe();
    } catch {
      toast.error('Erro de conexão ao salvar membro.');
    } finally {
      setSalvandoMembro(false);
    }
  };

  const handleRemoverMembro = async (m: MembroEquipe) => {
    const ok = await confirmAsync(`Remover o acesso de ${m.name} (${m.email}) da sua equipe?`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/escritorio/equipe?id=${encodeURIComponent(m.id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Erro ao remover membro.');
        return;
      }
      toast.success('Acesso removido da equipe.');
      carregarEquipe();
    } catch {
      toast.error('Erro de conexão ao remover membro.');
    }
  };

  const toggleEmpresaMembro = (id: string) => {
    setFormEmpresaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="page-body" style={{ padding: '24px 32px', background: '#fdfdfd', minHeight: '100%' }}>
      {/* Cabeçalho Executivo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent, #600000)' }}>
            {escritorio ? escritorio.nome : 'Gestão Fiscal Multi-CNPJ'}
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>
            Carteira & Fechamento Fiscal
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>
            Semáforo de certificados A1, termômetro RBT12 (MEI/Simples), fechamento em 1 clique e equipe do escritório
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="month"
            className="form-control"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            style={{ width: 170, fontSize: 14, fontWeight: 600 }}
            aria-label="Competência do fechamento"
          />

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => carregarSaude(competencia)}
            disabled={carregando}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10 }}
          >
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
            Atualizar
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setAba('chamados');
              setAbrirModalChamado(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10, fontWeight: 600 }}
          >
            <Headphones size={14} />
            Abrir Chamado
          </button>

          <button
            type="button"
            className="btn"
            onClick={handleBaixarFechamentoZip}
            disabled={baixandoZip || carregando || empresas.length === 0}
            style={{
              background: 'var(--accent, #600000)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              padding: '9px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
            title="Baixa 1 único arquivo ZIP organizado por empresa com todos os XMLs de NFS-e e NF-e do mês + planilha Excel consolidada"
          >
            <Archive size={15} />
            {baixandoZip ? 'Montando pacote ZIP...' : 'Baixar Fechamento do Mês (ZIP + Excel)'}
          </button>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 10 }}>
        <button
          type="button"
          onClick={() => setAba('saude')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: aba === 'saude' ? 'var(--accent, #600000)' : '#f3f4f6',
            color: aba === 'saude' ? '#fff' : '#374151',
          }}
        >
          <Activity size={15} />
          Saúde da Carteira & RBT12 ({empresas.length})
        </button>

        {escritorio && ehAdminEscritorio && (
          <button
            type="button"
            onClick={() => setAba('equipe')}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: aba === 'equipe' ? 'var(--accent, #600000)' : '#f3f4f6',
              color: aba === 'equipe' ? '#fff' : '#374151',
            }}
          >
            <Users size={15} />
            Equipe do Escritório ({membros.length})
          </button>
        )}

        <button
          type="button"
          onClick={() => setAba('chamados')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: aba === 'chamados' ? 'var(--accent, #600000)' : '#f3f4f6',
            color: aba === 'chamados' ? '#fff' : '#374151',
          }}
        >
          <Headphones size={15} />
          Suporte & Chamados
        </button>

        <button
          type="button"
          onClick={() => setAba('auditoria')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: aba === 'auditoria' ? 'var(--accent, #600000)' : '#f3f4f6',
            color: aba === 'auditoria' ? '#fff' : '#374151',
          }}
        >
          <History size={15} />
          Auditoria da Equipe
        </button>

        <button
          type="button"
          onClick={() => setAba('raiox')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: aba === 'raiox' ? 'var(--accent, #600000)' : '#f3f4f6',
            color: aba === 'raiox' ? '#fff' : '#374151',
          }}
        >
          <Sparkles size={15} />
          Raio-X do Prospect
        </button>

        <button
          type="button"
          onClick={() => setAba('indicacoes')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: aba === 'indicacoes' ? 'var(--accent, #600000)' : '#f3f4f6',
            color: aba === 'indicacoes' ? '#fff' : '#374151',
          }}
        >
          <Gift size={15} />
          Indique e Ganhe
        </button>
      </div>

      {aba === 'saude' ? (
        <>
          {/* KPIs Consolidados */}
          {resumo && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 22 }}>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 12.5, color: '#6b7280', fontWeight: 600 }}>Semáforo da Carteira</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 4 }}>{resumo.totalEmpresas} empresas</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 12.5, fontWeight: 700 }}>
                  <span style={{ color: '#b91c1c' }}>● {resumo.vermelhas} críticas</span>
                  <span style={{ color: '#b45309' }}>● {resumo.amarelas} atenção</span>
                  <span style={{ color: '#15803d' }}>● {resumo.verdes} ok</span>
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 12.5, color: '#6b7280', fontWeight: 600 }}>Faturamento da Carteira ({competencia})</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent, #600000)', marginTop: 4 }}>
                  {fmt.currency(resumo.faturamentoMesTotal)}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>NFS-e prestadas + NF-e emitidas</div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 12.5, color: '#6b7280', fontWeight: 600 }}>RBT12 Consolidado (12m)</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 4 }}>
                  {fmt.currency(resumo.rbt12CarteiraTotal)}
                </div>
                <div style={{ fontSize: 12, color: resumo.alertasRbt12 > 0 ? '#b91c1c' : '#15803d', fontWeight: 600, marginTop: 6 }}>
                  {resumo.alertasRbt12 > 0
                    ? `${resumo.alertasRbt12} empresa(s) perto/acima do teto`
                    : 'Nenhuma empresa perto do teto'}
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 12.5, color: '#6b7280', fontWeight: 600 }}>Certificados A1</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: resumo.certVencidos > 0 ? '#b91c1c' : '#111827', marginTop: 4 }}>
                  {resumo.certVencidos} vencido(s) · {resumo.certVencendo} vencendo
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                  {resumo.recorrenciasPendentes > 0
                    ? `${resumo.recorrenciasPendentes} empresa(s) com recorrência pendente`
                    : 'Recorrências em dia no mês'}
                </div>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 420 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                className="form-control"
                style={{ paddingLeft: 36, fontSize: 14 }}
                placeholder="Buscar empresa por nome ou CNPJ..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            {(['todos', 'vermelho', 'amarelo', 'verde'] as const).map((st) => {
              const ativo = filtroSemaforo === st;
              const labels = { todos: 'Todas', vermelho: 'Críticas', amarelo: 'Atenção', verde: 'Em dia' };
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFiltroSemaforo(st)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 99,
                    border: '1px solid #e5e7eb',
                    background: ativo ? '#111827' : '#fff',
                    color: ativo ? '#fff' : '#374151',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {labels[st]}
                </button>
              );
            })}
          </div>

          {/* Tabela Principal */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden' }}>
            {carregando ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Calculando saúde da carteira e RBT12...</div>
            ) : empresasFiltradas.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Nenhuma empresa encontrada para este filtro.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Empresa / Regime</th>
                      <th>Certificado A1</th>
                      <th>Faturamento ({competencia})</th>
                      <th>Termômetro RBT12 (12m)</th>
                      <th style={{ textAlign: 'right' }}>Ações WhatsApp (White-Label)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empresasFiltradas.map((emp) => {
                      const corSem =
                        emp.semaforo === 'vermelho'
                          ? { bg: '#fef2f2', fg: '#b91c1c', label: 'Crítico' }
                          : emp.semaforo === 'amarelo'
                          ? { bg: '#fffbeb', fg: '#b45309', label: 'Atenção' }
                          : { bg: '#f0fdf4', fg: '#15803d', label: 'Em dia' };

                      const pctBar = Math.min(100, emp.percentualTeto || 0);
                      const corBar =
                        emp.alertaRbt12 === 'critico' ? '#dc2626' : emp.alertaRbt12 === 'atencao' ? '#d97706' : '#16a34a';

                      return (
                        <tr key={emp.id}>
                          <td>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '4px 10px',
                                borderRadius: 99,
                                background: corSem.bg,
                                color: corSem.fg,
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {emp.semaforo === 'vermelho' ? (
                                <ShieldAlert size={13} />
                              ) : emp.semaforo === 'amarelo' ? (
                                <AlertTriangle size={13} />
                              ) : (
                                <CheckCircle2 size={13} />
                              )}
                              {corSem.label}
                            </span>
                          </td>

                          <td>
                            <div style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>
                              {emp.nomeFantasia || emp.razaoSocial}
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>
                              {formatCnpj(emp.cnpj)} · <strong>{emp.regime}</strong>
                            </div>
                            {emp.alertas.length > 0 && (
                              <div style={{ fontSize: 11.5, color: corSem.fg, marginTop: 3, fontWeight: 600 }}>
                                {emp.alertas.join(' · ')}
                              </div>
                            )}
                          </td>

                          <td>
                            {emp.statusCertificado === 'vencido' ? (
                              <span style={{ color: '#b91c1c', fontWeight: 700, fontSize: 13 }}>
                                Vencido ({Math.abs(emp.diasCertificado || 0)}d)
                              </span>
                            ) : emp.statusCertificado === 'vencendo' ? (
                              <span style={{ color: '#b45309', fontWeight: 700, fontSize: 13 }}>
                                Vence em {emp.diasCertificado}d
                              </span>
                            ) : emp.statusCertificado === 'valido' ? (
                              <span style={{ color: '#15803d', fontWeight: 600, fontSize: 13 }}>
                                Válido ({emp.diasCertificado}d)
                              </span>
                            ) : emp.statusCertificado === 'procuracao' ? (
                              <span style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 13 }}>Procuração</span>
                            ) : (
                              <span style={{ color: '#9ca3af', fontSize: 13 }}>Sem certificado</span>
                            )}
                          </td>

                          <td>
                            <div style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>
                              {fmt.currency(emp.faturamentoMes)}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#6b7280' }}>
                              {emp.nfseMesQtd} NFS-e · {emp.nfeEmitMesQtd} NF-e · {emp.nfeRecMesQtd} compras
                            </div>
                          </td>

                          <td style={{ minWidth: 190 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: '#111827' }}>
                              <span>{fmt.currency(emp.rbt12)}</span>
                              {emp.percentualTeto !== null && (
                                <span style={{ color: corBar }}>{emp.percentualTeto}%</span>
                              )}
                            </div>
                            {emp.tetoRbt12 ? (
                              <div style={{ marginTop: 5 }}>
                                <div style={{ height: 6, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pctBar}%`, background: corBar, borderRadius: 99 }} />
                                </div>
                                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                                  Teto {emp.regime}: {fmt.currency(emp.tetoRbt12)}
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Sem teto Simples/MEI</div>
                            )}
                          </td>

                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {(emp.statusCertificado === 'vencido' || emp.statusCertificado === 'vencendo') && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, color: '#b45309', borderColor: '#fde68a', background: '#fffbeb' }}
                                  disabled={enviandoWhatsId !== null}
                                  onClick={() => handleAvisarCliente(emp, 'certificado')}
                                  title="Enviar aviso de renovação de Certificado A1 no WhatsApp do cliente com a assinatura do escritório"
                                >
                                  <ShieldCheck size={12} style={{ marginRight: 4 }} />
                                  {enviandoWhatsId === `${emp.id}:certificado` ? 'Enviando...' : 'Avisar A1'}
                                </button>
                              )}

                              {emp.alertaRbt12 !== 'ok' && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2' }}
                                  disabled={enviandoWhatsId !== null}
                                  onClick={() => handleAvisarCliente(emp, 'rbt12')}
                                  title="Avisar cliente no WhatsApp sobre aproximação/estouro do teto RBT12"
                                >
                                  <TrendingUp size={12} style={{ marginRight: 4 }} />
                                  {enviandoWhatsId === `${emp.id}:rbt12` ? 'Enviando...' : 'Avisar RBT12'}
                                </button>
                              )}

                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, color: '#6d28d9', borderColor: '#ddd6fe', background: '#f5f3ff' }}
                                onClick={() => handleDossiePdf(emp, false)}
                                title="Baixar Dossiê Executivo Mensal em PDF White-Label (6 meses + Top 5 + RBT12)"
                              >
                                <FileText size={12} style={{ marginRight: 4 }} />
                                Dossiê PDF
                              </button>

                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, color: '#047857', borderColor: '#a7f3d0', background: '#ecfdf5' }}
                                disabled={enviandoDossieId !== null}
                                onClick={() => handleDossiePdf(emp, true)}
                                title="Enviar Dossiê Executivo PDF White-Label direto no WhatsApp do cliente"
                              >
                                <MessageSquare size={12} style={{ marginRight: 4 }} />
                                {enviandoDossieId === emp.id ? 'Enviando...' : 'Dossiê Whats'}
                              </button>

                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}
                                disabled={gerandoLinkA1Id !== null}
                                onClick={() => handleGerarLinkA1(emp, false)}
                                title="Gerar link white-label para o cliente enviar o próprio Certificado A1 (.pfx)"
                              >
                                <KeyRound size={12} style={{ marginRight: 4 }} />
                                {gerandoLinkA1Id === emp.id ? 'Gerando...' : 'Link A1'}
                              </button>

                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, color: '#15803d', borderColor: '#bbf7d0', background: '#f0fdf4' }}
                                disabled={enviandoWhatsId !== null}
                                onClick={() => handleAvisarCliente(emp, 'resumo')}
                                title="Enviar resumo mensal de NFS-e no WhatsApp do cliente assinado pelo escritório"
                              >
                                <MessageSquare size={12} style={{ marginRight: 4 }} />
                                {enviandoWhatsId === `${emp.id}:resumo` ? 'Enviando...' : 'Resumo Whats'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : aba === 'chamados' ? (
        <SuporteChamadosTab
          empresas={empresas}
          abrirModalInicial={abrirModalChamado}
          onConsumirAbrirModal={() => setAbrirModalChamado(false)}
        />
      ) : aba === 'auditoria' ? (
        <AuditoriaEquipeTab />
      ) : aba === 'raiox' ? (
        <RaioXProspectTab />
      ) : aba === 'indicacoes' ? (
        <IndiqueContadorTab />
      ) : (
        /* Aba Equipe do Escritório */
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Equipe do Escritório (Auxiliares Fiscais)</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#6b7280' }}>
                Crie logins individuais para sua equipe escolhendo quais CNPJs da sua carteira cada auxiliar pode operar. Todos herdam automaticamente sua logo e cores.
              </p>
            </div>
            <button
              type="button"
              className="btn"
              onClick={abrirModalNovoMembro}
              style={{
                background: 'var(--accent, #600000)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                padding: '9px 16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <UserPlus size={15} />
              Adicionar Auxiliar
            </button>
          </div>

          {carregandoEquipe ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Carregando equipe...</div>
          ) : membros.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Nenhum membro encontrado.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail / WhatsApp</th>
                    <th>Função</th>
                    <th>Empresas Permitidas</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {membros.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 700, color: '#111827' }}>{m.name}</td>
                      <td>
                        <div style={{ fontSize: 13.5 }}>{m.email}</div>
                        {m.phone && <div style={{ fontSize: 12, color: '#6b7280' }}>{m.phone}</div>}
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: 99,
                            fontSize: 12,
                            fontWeight: 700,
                            background: m.papel === 'admin_escritorio' ? '#eff6ff' : '#f3f4f6',
                            color: m.papel === 'admin_escritorio' ? '#1d4ed8' : '#374151',
                          }}
                        >
                          {m.papel === 'admin_escritorio' ? 'Administrador' : 'Auxiliar / Operador'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: '#374151' }}>
                        {m.papel === 'admin_escritorio'
                          ? 'Toda a carteira (ilimitado)'
                          : `${m.empresaIds.length} de ${empresasEquipe.length} empresa(s)`}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {m.papel === 'operador' ? (
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: 12.5, padding: '5px 10px', borderRadius: 8 }}
                              onClick={() => abrirModalEditarMembro(m)}
                            >
                              <Edit3 size={13} style={{ marginRight: 4 }} /> Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: 12.5, padding: '5px 10px', borderRadius: 8, color: '#b91c1c', borderColor: '#fecaca' }}
                              onClick={() => handleRemoverMembro(m)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>Titular</span>
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

      {/* Modal Link Self-Service Certificado A1 */}
      {conviteA1Modal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setConviteA1Modal(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              width: '100%',
              maxWidth: 540,
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={17} color="var(--accent, #600000)" />
                Link Seguro — Envio de Certificado A1
              </h3>
              <button type="button" onClick={() => setConviteA1Modal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13.5, color: '#4b5563', lineHeight: 1.55 }}>
                Envie o link abaixo para <strong>{conviteA1Modal.empresa.nomeFantasia || conviteA1Modal.empresa.razaoSocial}</strong>.
                O cliente verá a <strong>sua logo e cores</strong>, subirá o arquivo <code>.pfx</code> + senha direto no cofre criptografado e você receberá um aviso no WhatsApp assim que concluir.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-control" readOnly value={conviteA1Modal.link} style={{ fontSize: 12.5, fontFamily: 'monospace' }} />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(conviteA1Modal.link);
                    toast.success('Link copiado!');
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
                >
                  <Copy size={14} /> Copiar
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={gerandoLinkA1Id !== null}
                  onClick={() => handleGerarLinkA1(conviteA1Modal.empresa, true)}
                  style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <MessageSquare size={14} />
                  {conviteA1Modal.whatsappEnviado ? 'Reenviar no WhatsApp do Cliente' : 'Enviar no WhatsApp do Cliente'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setConviteA1Modal(null)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar / Editar Auxiliar */}
      {modalMembroAberto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setModalMembroAberto(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              width: '100%',
              maxWidth: 560,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>
                {editandoMembro ? `Editar ${editandoMembro.name}` : 'Novo Auxiliar da Equipe'}
              </h3>
              <button type="button" onClick={() => setModalMembroAberto(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSalvarMembro} style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome completo</label>
                  <input className="form-control" required value={formNome} onChange={(e) => setFormNome(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>WhatsApp / Telefone</label>
                  <input className="form-control" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="(46) 99999-9999" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>E-mail de acesso</label>
                  <input
                    type="email"
                    className="form-control"
                    required
                    disabled={Boolean(editandoMembro)}
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    {editandoMembro ? 'Nova senha (opcional)' : 'Senha inicial (mín. 6 caracteres)'}
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    required={!editandoMembro}
                    minLength={editandoMembro ? undefined : 6}
                    value={formSenha}
                    onChange={(e) => setFormSenha(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formTodasEmpresas}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setFormTodasEmpresas(v);
                      if (v) setFormEmpresaIds(empresasEquipe.map((emp) => emp.id));
                    }}
                  />
                  Acesso a todas as empresas da carteira ({empresasEquipe.length})
                </label>

                {!formTodasEmpresas && (
                  <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {empresasEquipe.map((emp) => (
                      <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formEmpresaIds.includes(emp.id)}
                          onChange={() => toggleEmpresaMembro(emp.id)}
                        />
                        <span>{emp.nomeFantasia || emp.razaoSocial}</span>
                        <span style={{ color: '#9ca3af', fontSize: 11.5 }}>{formatCnpj(emp.cnpj)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalMembroAberto(false)}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={salvandoMembro}
                  style={{ background: 'var(--accent, #600000)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}
                >
                  {salvandoMembro ? 'Salvando...' : editandoMembro ? 'Salvar Alterações' : 'Criar Acesso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
