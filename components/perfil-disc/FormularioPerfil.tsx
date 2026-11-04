'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDF_BRAND_NAME } from '../../lib/pdf-branding';
import type {
  BlocoPublico, EscolhaBloco, EscolhaPublica, QuestionarioPublico, RespostasPerfil,
} from '../../lib/perfil-disc/questionario';

type Parte = 'natural' | 'adaptado' | 'jung' | 'valores';

type Etapa =
  | { tipo: 'bloco'; parte: 'natural' | 'adaptado'; item: BlocoPublico }
  | { tipo: 'escolha'; parte: 'jung' | 'valores'; item: EscolhaPublica };

const PARTES: Record<Parte, { numero: number; titulo: string; instrucao: string }> = {
  natural: {
    numero: 1,
    titulo: 'Como você é',
    instrucao: 'Pense em como você age naturalmente, sem pressão. Marque a frase que mais parece com você e a que menos parece.',
  },
  adaptado: {
    numero: 2,
    titulo: 'O que o dia a dia pede de você',
    instrucao: 'Agora pense na sua rotina de trabalho hoje. Marque o que mais e o que menos é exigido de você, mesmo que não seja o seu jeito.',
  },
  jung: {
    numero: 3,
    titulo: 'Como você prefere agir',
    instrucao: 'Escolha a opção que combina mais com você, mesmo que as duas façam algum sentido.',
  },
  valores: {
    numero: 4,
    titulo: 'O que é importante para você',
    instrucao: 'As duas opções podem ser boas. Escolha a que pesa mais para você.',
  },
};

interface DadosFormulario {
  empresa: string;
  nome: string | null;
  cargo: string | null;
  iniciado: boolean;
  questionario: QuestionarioPublico;
}

type Estado =
  | { fase: 'carregando' }
  | { fase: 'indisponivel'; mensagem: string }
  | { fase: 'invalido' }
  | { fase: 'encerrado' }
  | { fase: 'expirado' }
  | { fase: 'enviado' }
  | { fase: 'inicio'; dados: DadosFormulario }
  | { fase: 'respondendo'; dados: DadosFormulario };

const respostasVazias = (): RespostasPerfil => ({ natural: {}, adaptado: {}, jung: {}, valores: {} });

function montarEtapas(q: QuestionarioPublico): Etapa[] {
  return [
    ...q.natural.map((item): Etapa => ({ tipo: 'bloco', parte: 'natural', item })),
    ...q.adaptado.map((item): Etapa => ({ tipo: 'bloco', parte: 'adaptado', item })),
    ...q.jung.map((item): Etapa => ({ tipo: 'escolha', parte: 'jung', item })),
    ...q.valores.map((item): Etapa => ({ tipo: 'escolha', parte: 'valores', item })),
  ];
}

function etapaRespondida(etapa: Etapa, r: RespostasPerfil): boolean {
  if (etapa.tipo === 'bloco') {
    const e = r[etapa.parte][etapa.item.id];
    return !!e && e.mais >= 0 && e.menos >= 0;
  }
  return r[etapa.parte][etapa.item.id] !== undefined;
}

// Rascunho só neste aparelho: uma queda de conexão ou um recarregamento não perdem o que já foi marcado.
const chaveRascunho = (token: string) => `perfil_disc_rascunho_${token}`;

function lerRascunho(token: string): { respostas: RespostasPerfil; indice: number } | null {
  try {
    const salvo = localStorage.getItem(chaveRascunho(token));
    return salvo ? JSON.parse(salvo) : null;
  } catch {
    return null;
  }
}

function salvarRascunho(token: string, respostas: RespostasPerfil, indice: number) {
  try {
    localStorage.setItem(chaveRascunho(token), JSON.stringify({ respostas, indice }));
  } catch {
    /* Armazenamento indisponível: o formulário segue, só sem rascunho. */
  }
}

function apagarRascunho(token: string) {
  try {
    localStorage.removeItem(chaveRascunho(token));
  } catch {
    /* Nada a fazer. */
  }
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-hover)', padding: '24px 14px 48px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={PDF_BRAND_NAME} style={{ height: 44, width: 'auto' }} />
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '24px 20px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Moldura>
      <div style={{ textAlign: 'center', padding: '20px 4px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>{titulo}</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-secondary)', margin: 0 }}>{texto}</p>
      </div>
    </Moldura>
  );
}

export default function FormularioPerfil({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  const [respostas, setRespostas] = useState<RespostasPerfil>(respostasVazias);
  const [indice, setIndice] = useState(0);
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [consentimento, setConsentimento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const avanco = useRef<ReturnType<typeof setTimeout> | null>(null);

  const url = `/api/perfil-disc/publico/${encodeURIComponent(token)}`;

  const carregar = useCallback(async () => {
    setEstado({ fase: 'carregando' });
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const dados = await res.json().catch(() => ({}));
      if (res.status === 404) { setEstado({ fase: 'invalido' }); return; }
      if (!res.ok) { setEstado({ fase: 'indisponivel', mensagem: dados.error || 'Não foi possível abrir o formulário.' }); return; }
      if (dados.status === 'expirado') {
        apagarRascunho(token);
        setEstado({ fase: 'expirado' });
        return;
      }
      if (dados.status !== 'pendente') {
        apagarRascunho(token);
        setEstado({ fase: 'encerrado' });
        return;
      }
      const formulario: DadosFormulario = {
        empresa: dados.empresa,
        nome: dados.nome,
        cargo: dados.cargo,
        iniciado: dados.iniciado,
        questionario: dados.questionario,
      };
      setCargo(dados.cargo || '');
      // Quem já aceitou e voltou ao link continua de onde parou.
      if (dados.iniciado) {
        const rascunho = lerRascunho(token);
        if (rascunho) {
          setRespostas({ ...respostasVazias(), ...rascunho.respostas });
          setIndice(rascunho.indice || 0);
        }
        setEstado({ fase: 'respondendo', dados: formulario });
      } else {
        setEstado({ fase: 'inicio', dados: formulario });
      }
    } catch {
      setEstado({ fase: 'indisponivel', mensagem: 'Sem conexão com o servidor. Confira sua internet e tente novamente.' });
    }
  }, [token, url]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => () => { if (avanco.current) clearTimeout(avanco.current); }, []);

  const etapas = useMemo(
    () => (estado.fase === 'respondendo' ? montarEtapas(estado.dados.questionario) : []),
    [estado],
  );

  useEffect(() => {
    if (estado.fase === 'respondendo') salvarRascunho(token, respostas, indice);
  }, [estado.fase, token, respostas, indice]);

  // Volta ao topo a cada pergunta: no celular, a próxima pode começar fora da tela.
  useEffect(() => {
    if (estado.fase === 'respondendo') window.scrollTo({ top: 0 });
  }, [estado.fase, indice]);

  const iniciar = async () => {
    if (estado.fase !== 'inicio') return;
    setErro('');
    setEnviando(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'iniciar', consentimento, nome, cargo }),
      });
      const dados = await res.json().catch(() => ({}));
      if (res.status === 409) { setEstado({ fase: 'encerrado' }); return; }
      if (res.status === 410) { setEstado({ fase: 'expirado' }); return; }
      if (!res.ok) { setErro(dados.error || 'Não foi possível começar. Tente novamente.'); return; }
      setEstado({ fase: 'respondendo', dados: estado.dados });
    } catch {
      setErro('Sem conexão com o servidor. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const enviar = async () => {
    setErro('');
    setEnviando(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'concluir', respostas }),
      });
      const dados = await res.json().catch(() => ({}));
      if (res.ok) {
        apagarRascunho(token);
        setEstado({ fase: 'enviado' });
        return;
      }
      if (res.status === 409) {
        apagarRascunho(token);
        setEstado({ fase: 'encerrado' });
        return;
      }
      if (res.status === 410) {
        apagarRascunho(token);
        setEstado({ fase: 'expirado' });
        return;
      }
      setErro(dados.error || 'Não foi possível enviar. Suas respostas continuam aqui: tente novamente.');
    } catch {
      setErro('Sem conexão com o servidor. Suas respostas continuam aqui: tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  if (estado.fase === 'carregando') return <Aviso titulo="Carregando..." texto="Só um instante." />;
  if (estado.fase === 'invalido') return <Aviso titulo="Link inválido" texto="Este link não existe ou foi cancelado. Peça um novo link a quem enviou o convite." />;
  if (estado.fase === 'encerrado') return <Aviso titulo="Este link já foi respondido" texto="Cada link vale para uma única resposta e não pode ser reaberto. Se precisar responder de novo, peça um novo link a quem enviou o convite." />;
  if (estado.fase === 'expirado') return <Aviso titulo="Este link venceu" texto="Cada link vale por 24 horas. Peça um novo link a quem enviou o convite." />;
  if (estado.fase === 'enviado') return <Aviso titulo="Respostas enviadas. Obrigado!" texto="Seu perfil foi registrado e o resultado fica com quem enviou o convite. Você já pode fechar esta página." />;

  if (estado.fase === 'indisponivel') {
    return (
      <Moldura>
        <div style={{ textAlign: 'center', padding: '20px 4px' }}>
          <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', margin: '0 0 16px' }}>{estado.mensagem}</p>
          <button type="button" className="btn btn-primary" onClick={carregar}>Tentar de novo</button>
        </div>
      </Moldura>
    );
  }

  if (estado.fase === 'inicio') {
    const { dados } = estado;
    return (
      <Moldura>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          {dados.nome ? `Olá, ${dados.nome}!` : 'Perfil comportamental'}
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
          Este formulário ajuda a entender como você prefere trabalhar, se comunicar e decidir. O convite foi enviado por {PDF_BRAND_NAME} para a equipe de <strong>{dados.empresa}</strong>.
        </p>
        <ul style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 18px', paddingLeft: 20 }}>
          <li>Leva cerca de 15 minutos. Se puder, responda de uma vez só.</li>
          <li>Não há respostas certas ou erradas. Responda pelo que é verdade hoje, e não pelo que gostaria que fosse.</li>
          <li>Este link é pessoal, vale por 24 horas e aceita uma única resposta. Depois de enviar, não será possível responder de novo.</li>
        </ul>

        {!dados.nome && (
          <div className="form-group">
            <label className="form-label" htmlFor="perfil-nome">Seu nome completo *</label>
            <input id="perfil-nome" className="form-control" value={nome} maxLength={120} onChange={e => setNome(e.target.value)} autoComplete="name" />
          </div>
        )}
        <div className="form-group">
          <label className="form-label" htmlFor="perfil-cargo">Seu cargo ou função (opcional)</label>
          <input id="perfil-cargo" className="form-control" value={cargo} maxLength={120} onChange={e => setCargo(e.target.value)} autoComplete="organization-title" />
        </div>

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '14px 0 18px', cursor: 'pointer' }}>
          <input type="checkbox" checked={consentimento} onChange={e => setConsentimento(e.target.checked)} style={{ marginTop: 3, flexShrink: 0 }} />
          <span>
            Autorizo o uso das minhas respostas para gerar meu relatório de perfil comportamental. O resultado fica guardado por {PDF_BRAND_NAME} e pode ser compartilhado com {dados.empresa}. Para corrigir ou excluir meus dados, posso falar com o escritório a qualquer momento.
          </span>
        </label>

        {erro && <p role="alert" style={{ fontSize: 13.5, color: 'var(--red)', margin: '0 0 12px' }}>{erro}</p>}

        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          disabled={enviando || !consentimento || (!dados.nome && !nome.trim())}
          onClick={iniciar}
        >
          {enviando ? 'Aguarde...' : 'Começar'}
        </button>
      </Moldura>
    );
  }

  const etapa = etapas[Math.min(indice, etapas.length - 1)];
  const ultima = indice >= etapas.length - 1;
  const respondida = etapaRespondida(etapa, respostas);
  const parte = PARTES[etapa.parte];
  const respondidas = etapas.filter(e => etapaRespondida(e, respostas)).length;
  const percentual = Math.round((respondidas / etapas.length) * 100);
  const faltando = etapas.findIndex(e => !etapaRespondida(e, respostas));

  const cancelarAvanco = () => {
    if (avanco.current) clearTimeout(avanco.current);
    avanco.current = null;
  };

  const avancarDepois = () => {
    if (ultima) return;
    cancelarAvanco();
    avanco.current = setTimeout(() => setIndice(i => Math.min(i + 1, etapas.length - 1)), 220);
  };

  // Navegar à mão cancela o avanço automático: senão, a pessoa pularia uma pergunta.
  const irPara = (destino: number) => {
    cancelarAvanco();
    setIndice(Math.max(0, Math.min(destino, etapas.length - 1)));
  };

  const marcarBloco = (campo: keyof EscolhaBloco, opcao: number) => {
    if (etapa.tipo !== 'bloco') return;
    const atual = respostas[etapa.parte][etapa.item.id] ?? { mais: -1, menos: -1 };
    const outro: keyof EscolhaBloco = campo === 'mais' ? 'menos' : 'mais';
    const nova: EscolhaBloco = { ...atual, [campo]: opcao };
    // A mesma frase não pode ser as duas coisas: a marcação nova substitui a anterior.
    if (nova[outro] === opcao) nova[outro] = -1;
    setRespostas(r => ({ ...r, [etapa.parte]: { ...r[etapa.parte], [etapa.item.id]: nova } }));
    if (nova.mais >= 0 && nova.menos >= 0) avancarDepois();
  };

  const marcarEscolha = (opcao: 0 | 1) => {
    if (etapa.tipo !== 'escolha') return;
    setRespostas(r => ({ ...r, [etapa.parte]: { ...r[etapa.parte], [etapa.item.id]: opcao } }));
    avancarDepois();
  };

  return (
    <Moldura>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          <span>Parte {parte.numero} de 4</span>
          <span>{percentual}% respondido</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={percentual}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso do formulário"
          style={{ height: 6, background: 'var(--border-light)', borderRadius: 6, overflow: 'hidden' }}
        >
          <div style={{ height: '100%', width: `${percentual}%`, background: 'var(--accent)', borderRadius: 6, transition: 'width .2s' }} />
        </div>
      </div>

      <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>{parte.titulo}</h1>
      <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '0 0 16px' }}>{parte.instrucao}</p>

      {etapa.tipo === 'bloco' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {etapa.item.opcoes.map((texto, i) => {
            const escolha = respostas[etapa.parte][etapa.item.id];
            const mais = escolha?.mais === i;
            const menos = escolha?.menos === i;
            return (
              <div
                key={texto}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
                  border: `1px solid ${mais || menos ? 'var(--accent-border)' : 'var(--border)'}`,
                  background: mais || menos ? 'var(--accent-glow)' : 'transparent',
                }}
              >
                <span style={{ flex: 1, fontSize: 14, lineHeight: 1.4, color: 'var(--text-primary)' }}>{texto}</span>
                <button
                  type="button"
                  aria-pressed={mais}
                  aria-label={`Mais parecido: ${texto}`}
                  onClick={() => marcarBloco('mais', i)}
                  className={`btn btn-sm ${mais ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ minWidth: 58, minHeight: 36, justifyContent: 'center', fontSize: 12 }}
                >
                  Mais
                </button>
                <button
                  type="button"
                  aria-pressed={menos}
                  aria-label={`Menos parecido: ${texto}`}
                  onClick={() => marcarBloco('menos', i)}
                  className={`btn btn-sm ${menos ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ minWidth: 58, minHeight: 36, justifyContent: 'center', fontSize: 12 }}
                >
                  Menos
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 10px' }}>{etapa.item.pergunta}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {etapa.item.opcoes.map((texto, i) => {
              const marcada = respostas[etapa.parte][etapa.item.id] === i;
              return (
                <button
                  key={texto}
                  type="button"
                  aria-pressed={marcada}
                  onClick={() => marcarEscolha(i as 0 | 1)}
                  style={{
                    textAlign: 'left', fontSize: 14, lineHeight: 1.4, padding: '13px 14px', borderRadius: 12, cursor: 'pointer',
                    color: 'var(--text-primary)', fontWeight: marcada ? 600 : 400, fontFamily: 'inherit',
                    border: `1px solid ${marcada ? 'var(--accent)' : 'var(--border)'}`,
                    background: marcada ? 'var(--accent-glow)' : 'transparent',
                  }}
                >
                  {texto}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {erro && <p role="alert" style={{ fontSize: 13.5, color: 'var(--red)', margin: '14px 0 0' }}>{erro}</p>}

      {ultima && faltando >= 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '14px 0 0' }}>
          Ainda faltam {etapas.length - respondidas} resposta(s).{' '}
          <button
            type="button"
            onClick={() => irPara(faltando)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', textDecoration: 'underline' }}
          >
            Ir para a primeira pendente
          </button>
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 18 }}>
        <button type="button" className="btn btn-secondary" disabled={indice === 0 || enviando} onClick={() => irPara(indice - 1)}>
          Voltar
        </button>
        {ultima ? (
          <button type="button" className="btn btn-primary" disabled={faltando >= 0 || enviando} onClick={enviar}>
            {enviando ? 'Enviando...' : 'Enviar respostas'}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!respondida} onClick={() => irPara(indice + 1)}>
            Próxima
          </button>
        )}
      </div>
      {ultima && faltando < 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '10px 0 0', textAlign: 'right' }}>
          Depois de enviar, este link não abre mais.
        </p>
      )}
    </Moldura>
  );
}
