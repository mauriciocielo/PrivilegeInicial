'use client';

import { useCallback, useEffect, useState } from 'react';
import { Briefcase, Heart, MapPin, Save, Trash2, UserCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { confirmAsync } from './ConfirmProvider';

export default function FinancasPessoaisPerfilTab({ onAtualizado }: { onAtualizado: () => void }) {
  const [carregando, setCarregando] = useState(true);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [salvandoConjuge, setSalvandoConjuge] = useState(false);

  // Dados pessoais + endereço + emprego
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [empregoEmpresa, setEmpregoEmpresa] = useState('');
  const [empregoCargo, setEmpregoCargo] = useState('');
  const [empregoTipo, setEmpregoTipo] = useState('clt');
  const [rendaMensal, setRendaMensal] = useState('');
  const [diaPagamento, setDiaPagamento] = useState('5');
  const [compartilharFinancas, setCompartilharFinancas] = useState(true);

  // Vínculo cônjuge
  const [ehConjuge, setEhConjuge] = useState(false);
  const [titularInfo, setTitularInfo] = useState<{ nome: string; email: string } | null>(null);
  const [conjugeAtual, setConjugeAtual] = useState<{ nome: string; email: string; phone: string } | null>(null);
  const [conjugeNome, setConjugeNome] = useState('');
  const [conjugeEmail, setConjugeEmail] = useState('');
  const [conjugePhone, setConjugePhone] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch('/api/financas-pessoais/perfil');
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.perfil) {
        setCpf(d.perfil.cpf || '');
        setCep(d.perfil.cep || '');
        setEndereco(d.perfil.endereco || '');
        setCidade(d.perfil.cidade || '');
        setUf(d.perfil.uf || '');
        setEmpregoEmpresa(d.perfil.empregoEmpresa || '');
        setEmpregoCargo(d.perfil.empregoCargo || '');
        setEmpregoTipo(d.perfil.empregoTipo || 'clt');
        setRendaMensal(d.perfil.rendaMensal ? String(d.perfil.rendaMensal) : '');
        setDiaPagamento(String(d.perfil.diaPagamento || 5));
        setCompartilharFinancas(d.perfil.compartilharFinancas !== false);
        setEhConjuge(Boolean(d.ehConjuge));
        setTitularInfo(d.titular || null);
        setConjugeAtual(d.conjuge || null);
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const buscarViaCep = async (cepRaw: string) => {
    const dig = cepRaw.replace(/\D/g, '');
    if (dig.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${dig}/json/`);
      const d = await res.json();
      if (!d.erro) {
        setEndereco([d.logradouro, d.bairro].filter(Boolean).join(', '));
        setCidade(d.localidade || '');
        setUf(d.uf || '');
      }
    } catch {
      // ignora
    }
  };

  const handleSalvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoPerfil(true);
    try {
      const res = await fetch('/api/financas-pessoais/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf,
          cep,
          endereco,
          cidade,
          uf,
          empregoEmpresa,
          empregoCargo,
          empregoTipo,
          rendaMensal: parseFloat(rendaMensal.replace(',', '.')) || 0,
          diaPagamento: Number(diaPagamento) || 5,
          compartilharFinancas,
        }),
      });
      if (!res.ok) {
        toast.error('Erro ao salvar perfil.');
        return;
      }
      toast.success('Dados pessoais, endereço e emprego salvos!');
      onAtualizado();
    } finally {
      setSalvandoPerfil(false);
    }
  };

  const handleVincularConjuge = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoConjuge(true);
    try {
      const res = await fetch('/api/financas-pessoais/perfil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conjugeNome,
          conjugeEmail,
          conjugePhone,
          compartilharFinancas,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Erro ao vincular cônjuge.');
        return;
      }
      toast.success(
        `Assinatura compartilhada com ${conjugeNome}!${d.senhaGerada ? ` Senha: ${d.senhaGerada}.` : ''}${d.whatsappEnviado ? ' Acesso enviado no WhatsApp!' : ''}`
      );
      setConjugeNome('');
      setConjugeEmail('');
      setConjugePhone('');
      carregar();
      onAtualizado();
    } finally {
      setSalvandoConjuge(false);
    }
  };

  const handleDesvincularConjuge = async () => {
    const ok = await confirmAsync(`Desvincular ${conjugeAtual?.nome || 'o cônjuge'} da sua assinatura?`);
    if (!ok) return;
    await fetch('/api/financas-pessoais/perfil', { method: 'DELETE' });
    toast.success('Cônjuge desvinculado.');
    carregar();
    onAtualizado();
  };

  if (carregando) {
    return <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Carregando perfil...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Compartilhar Assinatura com Cônjuge */}
      <div style={{ background: '#fff', border: '1px solid #e6e4de', borderLeft: '4px solid var(--accent, #600000)', borderRadius: 16, padding: 20 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#141413', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Heart size={18} color="var(--accent, #600000)" /> Compartilhar Assinatura com Cônjuge (Sem custo extra)
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#6e6c66' }}>
          Seu cônjuge ganha acesso próprio ao painel e ao WhatsApp na mesma assinatura. Os lançamentos dos dois podem ser unificados no orçamento familiar em tempo real!
        </p>

        {ehConjuge && titularInfo ? (
          <div style={{ padding: 14, borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13.5, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCheck size={17} /> Você está usando o acesso compartilhado pela assinatura de <strong>{titularInfo.nome}</strong> ({titularInfo.email}).
          </div>
        ) : conjugeAtual ? (
          <div style={{ padding: 14, borderRadius: 12, background: '#f6f5f2', border: '1px solid #e6e4de', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: '#141413', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={15} color="#15803d" /> {conjugeAtual.nome}
              </div>
              <div style={{ fontSize: 13, color: '#6e6c66', marginTop: 2 }}>
                {conjugeAtual.email} {conjugeAtual.phone ? `· WhatsApp: ${conjugeAtual.phone}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={handleDesvincularConjuge}
              className="btn btn-secondary"
              style={{ color: '#b91c1c', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Trash2 size={13} /> Desvincular Cônjuge
            </button>
          </div>
        ) : (
          <form onSubmit={handleVincularConjuge} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 8 }}>
              <input className="form-control" required placeholder="Nome do cônjuge" value={conjugeNome} onChange={(e) => setConjugeNome(e.target.value)} />
              <input className="form-control" type="email" required placeholder="E-mail de acesso do cônjuge" value={conjugeEmail} onChange={(e) => setConjugeEmail(e.target.value)} />
              <input className="form-control" required placeholder="WhatsApp com DDD do cônjuge" value={conjugePhone} onChange={(e) => setConjugePhone(e.target.value)} />
              <button
                type="submit"
                disabled={salvandoConjuge}
                className="btn"
                style={{ background: 'var(--accent, #600000)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}
              >
                {salvandoConjuge ? 'Liberando...' : 'Compartilhar Acesso'}
              </button>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#4a4945', cursor: 'pointer' }}>
              <input type="checkbox" checked={compartilharFinancas} onChange={(e) => setCompartilharFinancas(e.target.checked)} />
              Unificar gastos, receitas, cartões e investimentos do casal na mesma visão
            </label>
          </form>
        )}
      </div>

      {/* Formulário Dados Pessoais (CPF + Endereço) e Emprego */}
      <form onSubmit={handleSalvarPerfil} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ background: '#fff', border: '1px solid #e6e4de', borderRadius: 16, padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16.5, fontWeight: 800, color: '#141413', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={17} color="var(--accent, #600000)" /> Dados Pessoais (CPF & Endereço)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>CPF</label>
              <input className="form-control" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>CEP</label>
              <input
                className="form-control"
                placeholder="85601-000"
                value={cep}
                onChange={(e) => {
                  setCep(e.target.value);
                  if (e.target.value.replace(/\D/g, '').length === 8) buscarViaCep(e.target.value);
                }}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Endereço (Rua, nº, bairro)</label>
              <input className="form-control" placeholder="Rua Exemplo, 123, Centro" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Cidade</label>
              <input className="form-control" placeholder="Francisco Beltrão" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>UF</label>
              <input className="form-control" maxLength={2} placeholder="PR" value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} />
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e6e4de', borderRadius: 16, padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16.5, fontWeight: 800, color: '#141413', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Briefcase size={17} color="#15803d" /> Emprego, Ocupação & Renda Principal
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Tipo de Vínculo</label>
              <select className="form-control" value={empregoTipo} onChange={(e) => setEmpregoTipo(e.target.value)}>
                <option value="clt">CLT (Carteira Assinada)</option>
                <option value="pj_socio">Empresário / Sócio PJ</option>
                <option value="autonomo">Autônomo / Profissional Liberal</option>
                <option value="servidor">Servidor Público</option>
                <option value="aposentado">Aposentado / Pensionista</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Empresa / Fonte Pagadora</label>
              <input className="form-control" placeholder="Ex.: Empresa XYZ Ltda" value={empregoEmpresa} onChange={(e) => setEmpregoEmpresa(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Cargo / Profissão</label>
              <input className="form-control" placeholder="Ex.: Analista, Médico, Vendedor" value={empregoCargo} onChange={(e) => setEmpregoCargo(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Renda Mensal Líquida (R$)</label>
              <input className="form-control" placeholder="Ex.: 5500,00" value={rendaMensal} onChange={(e) => setRendaMensal(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Dia do Recebimento</label>
              <input className="form-control" type="number" min={1} max={31} value={diaPagamento} onChange={(e) => setDiaPagamento(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#4a4945', cursor: 'pointer' }}>
              <input type="checkbox" checked={compartilharFinancas} onChange={(e) => setCompartilharFinancas(e.target.checked)} />
              Compartilhar lançamentos com o cônjuge vinculado
            </label>
            <button
              type="submit"
              disabled={salvandoPerfil}
              className="btn"
              style={{ background: 'var(--accent, #600000)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px' }}
            >
              <Save size={15} /> {salvandoPerfil ? 'Salvando...' : 'Salvar Dados & Emprego'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
