'use client';
import { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { ResultadoPerfil } from '../../lib/perfil-disc/pontuacao';
import {
  formatarTempoResposta, montarRelatorio, nomeTipoRespondente,
  type LinhaCompetencia, type LinhaJung,
} from '../../lib/perfil-disc/relatorio';
import { AVISO_METODOLOGICO } from '../../lib/perfil-disc/textos';

export interface DadosRespondente {
  nome: string;
  cargo?: string | null;
  empresa: string;
  tipo: string;
  concluidoEm?: string | null;
  consentimentoEm?: string | null;
  tempoRespostaSeg?: number | null;
}

// Cores por papel da série, com passos próprios para cada tema (paleta validada).
const ESTILOS = `
  .pd-viz { --pd-natural: #2a78d6; --pd-adaptado: #eb6834; }
  [data-theme="dark"] .pd-viz { --pd-natural: #3987e5; --pd-adaptado: #d95926; }
  .pd-grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .pd-grade-larga { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap: 18px; }
  .pd-num { font-variant-numeric: tabular-nums; }
`;

// No celular, a regra global dá 520px a toda tabela: aqui os valores sumiriam da tela.
const TABELA_COMPACTA: React.CSSProperties = { minWidth: 0 };

const tituloSecao: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' };
const subtituloSecao: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '0 0 14px' };
const texto: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 };
const rotulo: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' };

function Secao({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 style={tituloSecao}>{titulo}</h2>
      {subtitulo ? <p style={subtituloSecao}>{subtitulo}</p> : <div style={{ height: 10 }} />}
      {children}
    </section>
  );
}

function Legenda() {
  const item = (cor: string, nome: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: cor }} />
      {nome}
    </span>
  );
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
      {item('var(--pd-natural)', 'Natural')}
      {item('var(--pd-adaptado)', 'Adaptado')}
    </div>
  );
}

function Lista({ itens }: { itens: readonly string[] }) {
  return (
    <ul style={{ ...texto, paddingLeft: 18 }}>
      {itens.map(i => <li key={i} style={{ marginBottom: 3 }}>{i}</li>)}
    </ul>
  );
}

/** O nome do fator só aparece quando cabe; em telas estreitas, fica a letra, e a tabela abaixo dá o nome. */
function RotuloFator({ x, y, payload, width, visibleTicksCount }: {
  x?: number | string; y?: number | string; payload?: { value?: unknown }; width?: number | string; visibleTicksCount?: number;
}) {
  const cabeNome = Number(width) / Number(visibleTicksCount || 4) >= 110;
  const valor = String(payload?.value ?? '');
  return (
    <text x={x} y={y} dy={14} textAnchor="middle" fontSize={12} fill="var(--text-secondary)">
      {cabeNome ? valor : valor.charAt(0)}
    </text>
  );
}

function GraficoDisc({ dados }: { dados: Array<{ nome: string; Natural: number; Adaptado: number }> }) {
  return (
    <div role="img" aria-label="Pontuação dos fatores D, I, S e C no estilo natural e no adaptado. Os valores estão na tabela abaixo.">
      <ResponsiveContainer width="100%" height={270}>
        <BarChart data={dados} barGap={2} margin={{ top: 14, right: 10, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="nome" interval={0} axisLine={{ stroke: 'var(--border-dark)' }} tickLine={false} tick={RotuloFator} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <ReferenceLine y={50} stroke="var(--text-muted)" />
          <Tooltip
            cursor={{ fill: 'var(--bg-hover)' }}
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text-primary)' }}
          />
          <Bar dataKey="Natural" fill="var(--pd-natural)" barSize={22} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Adaptado" fill="var(--pd-adaptado)" barSize={22} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarraValor({ nome, detalhe, valor, sufixo = '' }: { nome: string; detalhe?: string; valor: number; sufixo?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 170px) 1fr 44px', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{nome}</div>
        {detalhe && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{detalhe}</div>}
      </div>
      <div style={{ height: 10, background: 'var(--border-light)', borderRadius: 5 }}>
        <div style={{ height: '100%', width: `${Math.min(100, valor)}%`, background: 'var(--pd-natural)', borderRadius: 5 }} />
      </div>
      <span className="pd-num" style={{ fontSize: 12.5, color: 'var(--text-primary)', textAlign: 'right' }}>{valor}{sufixo}</span>
    </div>
  );
}

function BarraJung({ linha }: { linha: LinhaJung }) {
  const [a, b] = linha.polos;
  const bloco = (pct: number, cor: string) => pct > 0 && (
    <div style={{ width: `${pct}%`, background: cor, borderRadius: 4, color: '#fff', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', paddingLeft: 8, overflow: 'visible', whiteSpace: 'nowrap' }}>
      {/* Bloco estreito não comporta o número: ele fica nos nomes logo acima. */}
      {pct >= 15 ? `${pct}%` : ''}
    </div>
  );
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>
        <span>{a.nome} ({a.letra}): {a.pct}%</span>
        <span>{b.nome} ({b.letra}): {b.pct}%</span>
      </div>
      <div
        role="img"
        aria-label={`${a.nome} ${a.pct}%, ${b.nome} ${b.pct}%`}
        style={{ display: 'flex', gap: 2, height: 28 }}
      >
        {bloco(a.pct, 'var(--pd-natural)')}
        {bloco(b.pct, 'var(--pd-adaptado)')}
      </div>
      <p style={{ ...texto, marginTop: 6 }}>
        <strong style={{ color: 'var(--text-primary)' }}>{linha.preferencia.nome}:</strong> {linha.preferencia.descricao} {linha.preferencia.tracos.join('. ')}.
      </p>
    </div>
  );
}

function CelulaMedidor({ valor, cor }: { valor: number; cor: string }) {
  return (
    <td style={{ padding: '6px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 50, height: 8, background: 'var(--border-light)', borderRadius: 4 }}>
          <div style={{ width: `${valor}%`, height: '100%', background: cor, borderRadius: 4 }} />
        </div>
        <span className="pd-num" style={{ fontSize: 12.5, color: 'var(--text-primary)', minWidth: 22, textAlign: 'right' }}>{valor}</span>
      </div>
    </td>
  );
}

function LinhaCompetenciaTabela({ item }: { item: LinhaCompetencia }) {
  return (
    <tr>
      <td style={{ padding: '6px 8px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.nome}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{item.descricao}</div>
      </td>
      <CelulaMedidor valor={item.natural} cor="var(--pd-natural)" />
      <CelulaMedidor valor={item.adaptado} cor="var(--pd-adaptado)" />
    </tr>
  );
}

export default function RelatorioPerfil({ resultado, respondente }: { resultado: ResultadoPerfil; respondente: DadosRespondente }) {
  const rel = useMemo(() => montarRelatorio(resultado), [resultado]);

  const dadosDisc = rel.fatores.map(f => ({ nome: `${f.fator} · ${f.nome}`, Natural: f.natural, Adaptado: f.adaptado }));

  return (
    <div className="pd-viz">
      <style>{ESTILOS}</style>

      <section className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{nomeTipoRespondente(respondente.tipo)} · {respondente.empresa}</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{respondente.nome}</h2>
            {respondente.cargo && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{respondente.cargo}</div>}
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {respondente.concluidoEm && <div>Respondido em {new Date(respondente.concluidoEm).toLocaleDateString('pt-BR')}</div>}
            <div>Tempo de resposta: {formatarTempoResposta(respondente.tempoRespostaSeg)}</div>
            {respondente.consentimentoEm && <div>Aceite registrado em {new Date(respondente.consentimentoEm).toLocaleDateString('pt-BR')}</div>}
          </div>
        </div>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{rel.perfil}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 8px' }}>{rel.titulo}</div>
          {rel.visaoGeral.map(p => <p key={p} style={{ ...texto, marginBottom: 6 }}>{p}</p>)}
        </div>
      </section>

      <Secao
        titulo="Intensidade dos fatores DISC"
        subtitulo="Natural é como a pessoa tende a agir sem pressão. Adaptado é o que ela percebe que o dia a dia exige. Acima de 50, o fator está acima da própria média."
      >
        <Legenda />
        <GraficoDisc dados={dadosDisc} />
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table style={TABELA_COMPACTA}>
            <thead><tr><th>Fator</th><th style={{ textAlign: 'right' }}>Natural</th><th style={{ textAlign: 'right' }}>Adaptado</th></tr></thead>
            <tbody>
              {rel.fatores.map(f => (
                <tr key={f.fator}>
                  <td>{f.fator} · {f.nome}</td>
                  <td className="pd-num" style={{ textAlign: 'right' }}>{f.natural}</td>
                  <td className="pd-num" style={{ textAlign: 'right' }}>{f.adaptado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Esforço de adaptação</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{rel.esforco.nome} ({rel.esforco.valor})</div>
          <p style={{ ...texto, marginTop: 4 }}>{rel.esforco.texto}</p>
        </div>
      </Secao>

      <Secao titulo="Características principais">
        <div className="pd-grade">
          <div><p style={rotulo}>Potencialidades</p><p style={texto}>{rel.potencialidades}</p></div>
          <div><p style={rotulo}>Relações interpessoais</p><p style={texto}>{rel.relacoes}</p></div>
          <div><p style={rotulo}>Tomada de decisão</p><p style={texto}>{rel.decisao}</p></div>
          <div><p style={rotulo}>O que motiva</p><p style={texto}>{rel.motivacao}</p></div>
          <div><p style={rotulo}>Onde tende a render mais</p><p style={texto}>{rel.adequacao}</p></div>
          <div><p style={rotulo}>Receios comuns</p><Lista itens={rel.receios} /></div>
        </div>
      </Secao>

      <Secao titulo="Leitura de cada fator">
        <div className="pd-grade-larga">
          {rel.fatores.map(f => (
            <div key={f.fator}>
              <p style={rotulo}>{f.titulo} ({f.fator}: {f.natural} → {f.adaptado})</p>
              <p style={{ ...texto, marginBottom: 6 }}>{f.leitura}</p>
              <p style={texto}><strong style={{ color: 'var(--text-primary)' }}>No ambiente atual:</strong> {f.adaptacao}</p>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Pontos de atenção sob pressão" subtitulo="Comportamentos que costumam aparecer neste perfil em momentos de estresse. Vale avaliar quais já foram superados e quais ainda pedem atenção.">
        <Lista itens={rel.pressao} />
      </Secao>

      <Secao titulo={`Tipos psicológicos: ${rel.tipoJung}`} subtitulo="Preferências baseadas nos conceitos de Jung: onde foca a atenção, como capta informação e como tira conclusões.">
        {rel.jung.map(l => <BarraJung key={l.preferencia.letra} linha={l} />)}
      </Secao>

      <Secao titulo="Valores e motivadores" subtitulo="O que tende a impulsionar as escolhas da pessoa, do mais forte para o mais fraco.">
        {rel.valores.map(v => <BarraValor key={v.valor} nome={v.nome} detalhe={`${v.motivador} · ${v.nomeNivel}`} valor={v.pontos} />)}
        <div style={{ marginTop: 12 }}>
          {rel.valores.filter(v => v.nivel === 'significativo').map(v => (
            <p key={v.valor} style={{ ...texto, marginBottom: 8 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{v.nome}:</strong> {v.descricao} <em>O que costuma estimular:</em> {v.estimulo}
            </p>
          ))}
        </div>
      </Secao>

      <Secao titulo="Estilo de liderança" subtitulo={`Estilo predominante: ${rel.liderancaPrincipal.nome}. ${rel.liderancaPrincipal.resumo}`}>
        {rel.lideranca.map(l => <BarraValor key={l.fator} nome={l.nome} detalhe={l.resumo} valor={l.pct} sufixo="%" />)}
        <div className="pd-grade" style={{ marginTop: 12 }}>
          <div><p style={rotulo}>Pontos fortes</p><Lista itens={rel.liderancaPrincipal.fortes} /></div>
          <div><p style={rotulo}>Cuidados</p><Lista itens={rel.liderancaPrincipal.cuidados} /></div>
        </div>
      </Secao>

      <Secao titulo="Mapa de competências" subtitulo="Estimativas calculadas a partir dos fatores DISC, nos estilos natural e adaptado.">
        <Legenda />
        <div className="table-wrap">
          <table style={TABELA_COMPACTA}>
            <thead><tr><th>Competência</th><th>Natural</th><th>Adaptado</th></tr></thead>
            {rel.competencias.map(grupo => (
              <tbody key={grupo.fator}>
                <tr><td colSpan={3} style={{ padding: '10px 8px 2px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{grupo.nome}</td></tr>
                {grupo.itens.map(item => <LinhaCompetenciaTabela key={item.id} item={item} />)}
              </tbody>
            ))}
          </table>
        </div>
      </Secao>

      <Secao titulo="Tendências de comportamento" subtitulo="Para que lado a pessoa tende a pender em cada par, no estilo natural.">
        <div className="table-wrap">
          <table style={TABELA_COMPACTA}>
            <tbody>
              {rel.tendencias.map(t => (
                <tr key={t.a}>
                  <td style={{ width: '40%', fontWeight: t.lado === 'a' ? 700 : 400, color: t.lado === 'a' ? 'var(--text-primary)' : 'var(--text-muted)' }}>{t.lado === 'a' ? '● ' : ''}{t.a}</td>
                  <td style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-muted)' }}>{t.lado === 'equilibrio' ? 'equilíbrio' : ''}</td>
                  <td style={{ width: '40%', textAlign: 'right', fontWeight: t.lado === 'b' ? 700 : 400, color: t.lado === 'b' ? 'var(--text-primary)' : 'var(--text-muted)' }}>{t.b}{t.lado === 'b' ? ' ●' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao titulo="Comunicação">
        <p style={rotulo}>Para se comunicar bem com esta pessoa</p>
        <Lista itens={rel.comunicarComPessoa} />
        <p style={{ ...rotulo, marginTop: 14 }}>Como esta pessoa pode se adaptar a cada perfil</p>
        <div className="pd-grade">
          {rel.comunicarComOutros.map(g => (
            <div key={g.fator}>
              <p style={{ ...texto, fontWeight: 600, color: 'var(--text-primary)' }}>Com quem tem {g.nome} alta</p>
              <Lista itens={g.dicas} />
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Plano de ação">
        <div className="pd-grade">
          <div><p style={rotulo}>Forças para aproveitar</p><Lista itens={rel.plano.forcas} /></div>
          <div><p style={rotulo}>O que desenvolver primeiro</p><Lista itens={rel.plano.desenvolver} /></div>
          <div><p style={rotulo}>Ações sugeridas</p><Lista itens={rel.plano.acoes} /></div>
          <div><p style={rotulo}>Perguntas para a conversa de retorno</p><Lista itens={rel.plano.perguntas} /></div>
        </div>
      </Secao>

      <p style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-muted)', margin: '0 4px 8px' }}>{AVISO_METODOLOGICO}</p>
    </div>
  );
}
