'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { store, uid, type Empresa } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import {
    AREAS,
    QUESTOES_POR_AREA,
    TOTAL_QUESTOES,
    calcularResultado,
    diagnostico360Store,
    radarPontos,
    type AreaKey,
    type Diagnostico360,
    type Letra,
} from '../../../lib/diagnostico360';
import { gerarPdfDiagnostico360, type FinanceiroSnapshot } from '../../../lib/diagnostico360-pdf';
import { confirmAsync } from '../../../components/ConfirmProvider';

type Aba = 'identificacao' | AreaKey | 'resultado';

const ABAS: { key: Aba; label: string; icone: string }[] = [
    { key: 'identificacao', label: 'Identificação', icone: '📋' },
    ...AREAS.map(a => ({ key: a.key as Aba, label: a.nome, icone: a.icone })),
    { key: 'resultado', label: 'Resultado', icone: '📊' },
];

function novoDiagnostico(empresaId: string, empresa: Empresa | null): Diagnostico360 {
    const agora = new Date().toISOString();
    return {
        id: uid(),
        empresaId,
        data: agora.split('T')[0],
        consultor: store.getCurrentUser()?.name || '',
        respondente: {
            nome: empresa?.responsavel || '',
            cargo: '',
            nomeEmpresa: empresa?.nomeFantasia || empresa?.razaoSocial || '',
            cidade: '',
            cnpj: empresa?.cnpj || '',
            segmento: empresa?.atividade || '',
            telefone: empresa?.telefone || '',
            faturamentoMedio: empresa?.receitaMensalEstimada || 0,
            numFuncionarios: 0,
        },
        respostas: {},
        anotacoes: {},
        parecer: '',
        createdAt: agora,
        updatedAt: agora,
    };
}

export default function Diagnostico360Page() {
    const [empresaId, setEmpresaId] = useState('');
    const [empresa, setEmpresa] = useState<Empresa | null>(null);
    const [diagnostico, setDiagnostico] = useState<Diagnostico360 | null>(null);
    const [historico, setHistorico] = useState<Diagnostico360[]>([]);
    const [financeiro, setFinanceiro] = useState<FinanceiroSnapshot | null>(null);
    const [aba, setAba] = useState<Aba>('identificacao');
    const [dirty, setDirty] = useState(false);
    const [gerando, setGerando] = useState(false);
    const [mesSelecionado, setMesSelecionado] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const mesesOptions = useMemo(() => {
        const list: string[] = [];
        const hoje = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return list;
    }, []);

    const loadData = useCallback((id: string) => {
        if (!id) return;
        setEmpresaId(id);

        const isGrupo = id.startsWith('grupo:');
        const empresas = store.getEmpresas();
        const grupoNome = isGrupo ? id.slice('grupo:'.length) : '';
        const empresasDoEscopo = isGrupo ? empresas.filter(e => e.grupoEconomico === grupoNome) : empresas.filter(e => e.id === id);

        const atual: Empresa | null = isGrupo
            ? ({
                id,
                razaoSocial: `Grupo Consolidado - ${grupoNome}`,
                nomeFantasia: `Grupo ${grupoNome}`,
                cnpj: '',
                responsavel: '',
                email: '',
                telefone: '',
                createdAt: '',
                tipo: 'empresa',
            } as Empresa)
            : empresasDoEscopo[0] || null;

        setEmpresa(atual);

        // Snapshot financeiro do sistema (dados já existentes DO MES)
        const ids = new Set(empresasDoEscopo.map(e => e.id));
        const lancamentos = store.getLancamentos().filter(l => ids.has(l.empresaId) && l.data.startsWith(mesSelecionado));
        const receitas = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'realizado').reduce((acc, l) => acc + l.valor, 0);
        const despesas = lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'realizado').reduce((acc, l) => acc + l.valor, 0);
        const indicadores = store.getIndicadores().filter(i => ids.has(i.empresaId));
        const endividamentos = store.getEndividamentos().filter(e => ids.has(e.empresaId));

        setFinanceiro({
            receitas,
            despesas,
            saldo: receitas - despesas,
            mediaFaturamento: indicadores.length ? indicadores.reduce((acc, i) => acc + i.faturamento, 0) / indicadores.length : 0,
            totalEndividamento: endividamentos.reduce((acc, e) => acc + e.valorQuitacao, 0),
        });

        const salvos = diagnostico360Store.getAll(id);
        setHistorico(salvos);
        setDiagnostico(salvos[0] ? { ...salvos[0] } : novoDiagnostico(id, atual));
        setDirty(false);
        setAba('identificacao');
    }, []);

    useEffect(() => {
        const saved = sessionStorage.getItem('cf_empresa_sel') || store.getEmpresas()[0]?.id || '';
        loadData(saved);

        const handler = (event: Event) => loadData((event as CustomEvent<string>).detail);
        const dataChangeHandler = () => {
            const current = sessionStorage.getItem('cf_empresa_sel') || store.getEmpresas()[0]?.id || '';
            loadData(current);
        };
        window.addEventListener('empresaChange', handler);
        window.addEventListener('cfDataChange', dataChangeHandler);
        return () => {
            window.removeEventListener('empresaChange', handler);
            window.removeEventListener('cfDataChange', dataChangeHandler);
        };
    }, [loadData]);

    // Recarrega o snapshot se o mes for alterado
    useEffect(() => {
       if (empresaId) loadData(empresaId);
    }, [mesSelecionado, loadData]);

    const resultado = useMemo(() => calcularResultado(diagnostico?.respostas || {}), [diagnostico]);

    const patch = (mudanca: Partial<Diagnostico360>) => {
        setDiagnostico(atual => (atual ? { ...atual, ...mudanca } : atual));
        setDirty(true);
    };

    const responder = (questaoId: string, letra: Letra) => {
        setDiagnostico(atual => {
            if (!atual) return atual;
            const respostas = { ...atual.respostas };
            if (respostas[questaoId] === letra) delete respostas[questaoId];
            else respostas[questaoId] = letra;
            return { ...atual, respostas };
        });
        setDirty(true);
    };

    const handleSalvar = () => {
        if (!diagnostico) return;
        diagnostico360Store.save(diagnostico);
        setHistorico(diagnostico360Store.getAll(empresaId));
        setDirty(false);
        toast.success('Diagnóstico salvo.');
    };

    const handleNovo = async () => {
        if (dirty && !(await confirmAsync('Há alterações não salvas. Iniciar um novo diagnóstico mesmo assim?'))) return;
        setDiagnostico(novoDiagnostico(empresaId, empresa));
        setDirty(false);
        setAba('identificacao');
    };

    const handleCarregar = async (item: Diagnostico360) => {
        if (dirty && !(await confirmAsync('Há alterações não salvas. Carregar outro diagnóstico mesmo assim?'))) return;
        setDiagnostico({ ...item });
        setDirty(false);
        setAba('resultado');
    };

    const handleExcluir = async (id: string) => {
        if (!(await confirmAsync('Excluir este diagnóstico?'))) return;
        diagnostico360Store.delete(id);
        const restantes = diagnostico360Store.getAll(empresaId);
        setHistorico(restantes);
        if (diagnostico?.id === id) {
            setDiagnostico(restantes[0] ? { ...restantes[0] } : novoDiagnostico(empresaId, empresa));
            setDirty(false);
        }
    };

    const handlePdf = async () => {
        if (!diagnostico) return;
        if (resultado.respondidas === 0) {
            toast.error('Responda ao menos uma questão antes de gerar o PDF.');
            return;
        }
        setGerando(true);
        try {
            await gerarPdfDiagnostico360({
                diagnostico,
                resultado,
                empresa,
                financeiro: financeiro || undefined,
            });
            toast.success('PDF gerado.');
        } catch (err) {
            console.error(err);
            toast.error('Não foi possível gerar o PDF.');
        } finally {
            setGerando(false);
        }
    };

    if (!empresa || !diagnostico) {
        return <div className="page-body">Selecione uma empresa para iniciar o diagnóstico.</div>;
    }

    const progresso = (resultado.respondidas / TOTAL_QUESTOES) * 100;
    const areaAtual = AREAS.find(a => a.key === aba);
    const resultadoArea = resultado.areas.find(a => a.area.key === aba);

    return (
        <>
            <div className="page-header">
                <div>
                    <div className="page-title">Diagnóstico 360º</div>
                    <div className="page-subtitle">
                        Avaliação de maturidade em 5 áreas de gestão · {empresa.nomeFantasia || empresa.razaoSocial}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', padding: '4px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Mês-Base:</span>
                        <select 
                            className="form-control" 
                            style={{ height: 32, fontSize: 13, border: 'none', background: 'transparent', width: 140, cursor: 'pointer' }}
                            value={mesSelecionado}
                            onChange={e => setMesSelecionado(e.target.value)}
                        >
                            {mesesOptions.map(m => {
                                const [y, mo] = m.split('-');
                                const d = new Date(Number(y), Number(mo)-1, 1);
                                return <option key={m} value={m}>{d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</option>;
                            })}
                        </select>
                    </div>
                </div>
                <div className="header-actions">
                    {dirty && <span className="badge badge-yellow">Alterações não salvas</span>}
                    <button className="btn btn-ghost" onClick={handleNovo}>+ Novo</button>
                    <button className="btn btn-secondary" onClick={handleSalvar} disabled={!dirty}>💾 Salvar</button>
                    <button className="btn btn-primary" onClick={handlePdf} disabled={gerando}>
                        {gerando ? 'Gerando…' : '📄 Gerar PDF'}
                    </button>
                </div>
            </div>

            <div className="page-body">
                {/* Resumo do progresso */}
                <div className="card d360-resumo">
                    <div className="d360-resumo-score">
                        <div className="stat-label">Índice de maturidade</div>
                        <div className="d360-score" style={{ color: resultado.nivelGeral.cor }}>
                            {resultado.geral.toFixed(1)}%
                        </div>
                        <span className="badge" style={{ background: `${resultado.nivelGeral.cor}1a`, color: resultado.nivelGeral.cor }}>
                            {resultado.nivelGeral.label}
                        </span>
                    </div>
                    <div className="d360-resumo-progresso">
                        <div className="d360-linha">
                            <span className="stat-label">Progresso do questionário</span>
                            <strong>{resultado.respondidas} / {TOTAL_QUESTOES}</strong>
                        </div>
                        <div className="d360-bar">
                            <div className="d360-bar-fill" style={{ width: `${progresso}%`, background: 'var(--accent)' }} />
                        </div>
                        <div className="d360-chips">
                            {resultado.areas.map(a => (
                                <button
                                    key={a.area.key}
                                    type="button"
                                    className="d360-chip"
                                    style={{ borderColor: a.respondidas ? a.area.cor : 'var(--border)' }}
                                    onClick={() => setAba(a.area.key)}
                                >
                                    <span>{a.area.icone} {a.area.nome}</span>
                                    <strong style={{ color: a.respondidas ? a.nivel.cor : 'var(--text-muted)' }}>
                                        {a.respondidas ? `${a.pontuacao.toFixed(0)}%` : `0/${a.total}`}
                                    </strong>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Abas */}
                <div className="tabs d360-tabs">
                    {ABAS.map(t => {
                        const area = AREAS.find(a => a.key === t.key);
                        const r = area ? resultado.areas.find(x => x.area.key === area.key) : null;
                        return (
                            <button key={t.key} className={`tab ${aba === t.key ? 'active' : ''}`} onClick={() => setAba(t.key)}>
                                {t.icone} {t.label}
                                {r && <span className="d360-tab-count">{r.respondidas}/{r.total}</span>}
                            </button>
                        );
                    })}
                </div>

                {/* --- Identificação --- */}
                {aba === 'identificacao' && (
                    <>
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Identificação</div>
                                    <div className="card-subtitle">Dados do respondente e da empresa avaliada</div>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Nome</label>
                                    <input
                                        className="form-control"
                                        value={diagnostico.respondente.nome}
                                        onChange={e => patch({ respondente: { ...diagnostico.respondente, nome: e.target.value } })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cargo</label>
                                    <input
                                        className="form-control"
                                        value={diagnostico.respondente.cargo}
                                        onChange={e => patch({ respondente: { ...diagnostico.respondente, cargo: e.target.value } })}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Nome Empresa</label>
                                    <input
                                        className="form-control"
                                        value={diagnostico.respondente.nomeEmpresa}
                                        onChange={e => patch({ respondente: { ...diagnostico.respondente, nomeEmpresa: e.target.value } })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cidade</label>
                                    <input
                                        className="form-control"
                                        value={diagnostico.respondente.cidade}
                                        onChange={e => patch({ respondente: { ...diagnostico.respondente, cidade: e.target.value } })}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">CNPJ</label>
                                    <input
                                        className="form-control"
                                        value={diagnostico.respondente.cnpj}
                                        onChange={e => patch({ respondente: { ...diagnostico.respondente, cnpj: e.target.value } })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Segmento</label>
                                    <input
                                        className="form-control"
                                        value={diagnostico.respondente.segmento}
                                        onChange={e => patch({ respondente: { ...diagnostico.respondente, segmento: e.target.value } })}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Telefone (WhatsApp)</label>
                                    <input
                                        className="form-control"
                                        value={diagnostico.respondente.telefone}
                                        onChange={e => patch({ respondente: { ...diagnostico.respondente, telefone: e.target.value } })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fat. Médio (Mensal)</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={diagnostico.respondente.faturamentoMedio || ''}
                                        onChange={e => patch({ respondente: { ...diagnostico.respondente, faturamentoMedio: Number(e.target.value) || 0 } })}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Nº de Funcionários</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={diagnostico.respondente.numFuncionarios || ''}
                                        onChange={e => patch({ respondente: { ...diagnostico.respondente, numFuncionarios: Number(e.target.value) || 0 } })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Data do diagnóstico</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={diagnostico.data}
                                        onChange={e => patch({ data: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Consultor responsável</label>
                                <input
                                    className="form-control"
                                    value={diagnostico.consultor}
                                    onChange={e => patch({ consultor: e.target.value })}
                                />
                            </div>

                            <div className="alert alert-info" style={{ marginTop: 8 }}>
                                O diagnóstico avalia <strong>Estratégia, Finanças, Marketing, Recursos Humanos e Operações</strong> por meio de
                                perguntas em escala crescente de maturidade. Cada resposta gera uma pontuação de 0 a 100%, e o relatório final
                                consolida o índice por área com um plano de ação priorizado.
                            </div>
                        </div>

                        {historico.length > 0 && (
                            <div className="card" style={{ marginTop: 20 }}>
                                <div className="card-header">
                                    <div>
                                        <div className="card-title">Diagnósticos salvos</div>
                                        <div className="card-subtitle">Histórico desta empresa</div>
                                    </div>
                                </div>
                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th style={{ width: 110 }}>Data</th>
                                                <th>Respondente</th>
                                                <th style={{ width: 120 }}>Respondidas</th>
                                                <th style={{ width: 110 }}>Índice</th>
                                                <th style={{ width: 150 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historico.map(item => {
                                                const r = calcularResultado(item.respostas);
                                                return (
                                                    <tr key={item.id}>
                                                        <td>{fmt.date(item.data)}</td>
                                                        <td>{item.respondente.nome || '—'}</td>
                                                        <td>{r.respondidas}/{TOTAL_QUESTOES}</td>
                                                        <td style={{ color: r.nivelGeral.cor, fontWeight: 700 }}>{r.geral.toFixed(1)}%</td>
                                                        <td>
                                                            <button className="btn btn-sm btn-ghost" onClick={() => handleCarregar(item)}>Abrir</button>
                                                            <button className="btn btn-sm btn-ghost" onClick={() => handleExcluir(item.id)}>Excluir</button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* --- Áreas --- */}
                {areaAtual && resultadoArea && (
                    <div className="card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">{areaAtual.icone} {areaAtual.nome}</div>
                                <div className="card-subtitle">{areaAtual.descricao}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div className="d360-score-sm" style={{ color: resultadoArea.nivel.cor }}>
                                    {resultadoArea.pontuacao.toFixed(0)}%
                                </div>
                                <div className="stat-label">{resultadoArea.respondidas}/{resultadoArea.total} respondidas</div>
                            </div>
                        </div>

                        {QUESTOES_POR_AREA(areaAtual.key).map(questao => {
                            const selecionada = diagnostico.respostas[questao.id];
                            return (
                                <div key={questao.id} className="d360-questao">
                                    <div className="d360-questao-head">
                                        <span className="d360-num" style={{ background: areaAtual.cor }}>
                                            {String(questao.numero).padStart(2, '0')}
                                        </span>
                                        <span className="d360-enunciado">{questao.enunciado}</span>
                                    </div>
                                    <div className="d360-opcoes">
                                        {questao.opcoes.map((opcao, idx) => {
                                            const ativa = selecionada === opcao.letra;
                                            const pct = (idx / (questao.opcoes.length - 1)) * 100;
                                            return (
                                                <button
                                                    key={opcao.letra}
                                                    type="button"
                                                    className={`d360-opcao ${ativa ? 'ativa' : ''}`}
                                                    style={ativa ? { borderColor: areaAtual.cor, background: `${areaAtual.cor}12` } : undefined}
                                                    onClick={() => responder(questao.id, opcao.letra)}
                                                >
                                                    <span className="d360-letra" style={ativa ? { background: areaAtual.cor, color: '#fff' } : undefined}>
                                                        {opcao.letra}
                                                    </span>
                                                    <span className="d360-opcao-texto">{opcao.texto}</span>
                                                    <span className="d360-opcao-pct">{pct.toFixed(0)}%</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        <div className="form-group" style={{ marginTop: 20 }}>
                            <label className="form-label">Anotações — {areaAtual.nome}</label>
                            <textarea
                                className="form-control"
                                rows={4}
                                placeholder="Observações levantadas na conversa com o cliente…"
                                value={diagnostico.anotacoes[areaAtual.key] || ''}
                                onChange={e => patch({ anotacoes: { ...diagnostico.anotacoes, [areaAtual.key]: e.target.value } })}
                            />
                        </div>
                    </div>
                )}

                {/* --- Resultado --- */}
                {aba === 'resultado' && (
                    <>
                        <div className="grid-2">
                            <div className="card">
                                <div className="card-header">
                                    <div>
                                        <div className="card-title">Mapa das áreas</div>
                                        <div className="card-subtitle">Maturidade relativa por área de gestão</div>
                                    </div>
                                </div>
                                <RadarAreas resultado={resultado} />
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <div>
                                        <div className="card-title">Pontuação por área</div>
                                        <div className="card-subtitle">Média das questões respondidas</div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 8 }}>
                                    {resultado.areas.map(a => (
                                        <div key={a.area.key} style={{ marginBottom: 16 }}>
                                            <div className="d360-linha">
                                                <span style={{ fontWeight: 600 }}>{a.area.icone} {a.area.nome}</span>
                                                <span style={{ color: a.nivel.cor, fontWeight: 700 }}>{a.pontuacao.toFixed(0)}%</span>
                                            </div>
                                            <div className="d360-bar">
                                                <div className="d360-bar-fill" style={{ width: `${a.pontuacao}%`, background: a.area.cor }} />
                                            </div>
                                            <div className="stat-label" style={{ marginTop: 4 }}>
                                                Nível {a.nivel.label} · {a.respondidas}/{a.total} respondidas
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {financeiro && (
                            <div className="card" style={{ marginTop: 20 }}>
                                <div className="card-header">
                                    <div>
                                        <div className="card-title">Indicadores financeiros do sistema</div>
                                        <div className="card-subtitle">Dados reais já lançados na plataforma — anexados ao relatório</div>
                                    </div>
                                </div>
                                <div className="grid-3" style={{ marginTop: 8 }}>
                                    <div className="card-sm">
                                        <div className="stat-label">Receitas realizadas</div>
                                        <div className="stat-value" style={{ color: 'var(--green)' }}>{fmt.currency(financeiro.receitas)}</div>
                                    </div>
                                    <div className="card-sm">
                                        <div className="stat-label">Despesas realizadas</div>
                                        <div className="stat-value" style={{ color: 'var(--red)' }}>{fmt.currency(financeiro.despesas)}</div>
                                    </div>
                                    <div className="card-sm">
                                        <div className="stat-label">Resultado</div>
                                        <div className="stat-value" style={{ color: financeiro.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                            {fmt.currency(financeiro.saldo)}
                                        </div>
                                    </div>
                                    <div className="card-sm">
                                        <div className="stat-label">Faturamento médio (histórico)</div>
                                        <div className="stat-value">{fmt.currency(financeiro.mediaFaturamento)}</div>
                                    </div>
                                    <div className="card-sm">
                                        <div className="stat-label">Dívidas ativas</div>
                                        <div className="stat-value" style={{ color: 'var(--red)' }}>{fmt.currency(financeiro.totalEndividamento)}</div>
                                    </div>
                                    <div className="card-sm">
                                        <div className="stat-label">Dívida / Fat. médio</div>
                                        <div className="stat-value">
                                            {financeiro.mediaFaturamento > 0
                                                ? `${((financeiro.totalEndividamento / financeiro.mediaFaturamento) * 100).toFixed(1)}%`
                                                : 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="card" style={{ marginTop: 20 }}>
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Plano de ação recomendado</div>
                                    <div className="card-subtitle">Prioridades geradas a partir das respostas de menor maturidade</div>
                                </div>
                            </div>
                            {resultado.pontosCriticos.length === 0 ? (
                                <div className="alert alert-success" style={{ marginTop: 8 }}>
                                    {resultado.respondidas === 0
                                        ? 'Responda ao questionário para gerar o plano de ação.'
                                        : 'Todas as questões respondidas estão no nível máximo de maturidade.'}
                                </div>
                            ) : (
                                <div style={{ marginTop: 8 }}>
                                    {resultado.pontosCriticos.map((qa, i) => {
                                        const area = AREAS.find(a => a.key === qa.questao.area)!;
                                        return (
                                            <div key={qa.questao.id} className="d360-acao">
                                                <div className="d360-acao-num" style={{ background: area.cor }}>
                                                    <strong>{String(i + 1).padStart(2, '0')}</strong>
                                                    <span>{(qa.pontuacao ?? 0).toFixed(0)}%</span>
                                                </div>
                                                <div>
                                                    <div className="d360-acao-area" style={{ color: area.cor }}>{area.nome.toUpperCase()}</div>
                                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{qa.questao.enunciado}</div>
                                                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{qa.questao.recomendacao}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="card" style={{ marginTop: 20 }}>
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Parecer do consultor</div>
                                    <div className="card-subtitle">Texto livre incluído na última página do relatório</div>
                                </div>
                            </div>
                            <textarea
                                className="form-control"
                                rows={8}
                                placeholder="Direcionamentos estratégicos, alocação de caixa, mitigação de riscos e redução de dívidas…"
                                value={diagnostico.parecer}
                                onChange={e => patch({ parecer: e.target.value })}
                            />
                        </div>
                    </>
                )}
            </div>

            <style>{`
        .d360-resumo {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 28px;
          align-items: center;
          margin-bottom: 20px;
        }
        .d360-resumo-score {
          border-right: 1px solid var(--border);
          padding-right: 24px;
        }
        .d360-score {
          font-size: 40px;
          font-weight: 800;
          line-height: 1.1;
          margin: 4px 0 8px;
        }
        .d360-score-sm {
          font-size: 26px;
          font-weight: 800;
        }
        .d360-linha {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 6px;
        }
        .d360-bar {
          height: 8px;
          border-radius: 999px;
          background: var(--bg-hover);
          overflow: hidden;
        }
        .d360-bar-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.3s ease;
        }
        .d360-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }
        .d360-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--bg-card);
          color: var(--text-secondary);
          font-size: 12px;
          font-family: inherit;
          cursor: pointer;
        }
        .d360-chip:hover {
          background: var(--bg-hover);
        }
        .d360-tabs {
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .d360-tab-count {
          margin-left: 6px;
          font-size: 11px;
          color: var(--text-muted);
        }
        .d360-questao {
          padding: 18px 0;
          border-top: 1px solid var(--border);
        }
        .d360-questao-head {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 12px;
        }
        .d360-num {
          flex: 0 0 auto;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .d360-enunciado {
          font-weight: 600;
          font-size: 15px;
          padding-top: 4px;
        }
        .d360-opcoes {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-left: 40px;
        }
        .d360-opcao {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          width: 100%;
          text-align: left;
          padding: 10px 14px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          background: var(--bg-card2);
          color: var(--text-secondary);
          font-family: inherit;
          font-size: 13px;
          line-height: 1.45;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .d360-opcao:hover {
          background: var(--bg-hover);
        }
        .d360-opcao.ativa {
          color: var(--text-primary);
          font-weight: 500;
        }
        .d360-letra {
          flex: 0 0 auto;
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: var(--bg-hover);
          color: var(--text-secondary);
          font-weight: 700;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .d360-opcao-texto {
          flex: 1;
        }
        .d360-opcao-pct {
          flex: 0 0 auto;
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .d360-acao {
          display: grid;
          grid-template-columns: 54px 1fr;
          gap: 14px;
          padding: 14px 0;
          border-top: 1px solid var(--border);
        }
        .d360-acao-num {
          border-radius: var(--radius-sm);
          color: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8px 0;
        }
        .d360-acao-num strong {
          font-size: 16px;
        }
        .d360-acao-num span {
          font-size: 10px;
          opacity: 0.85;
        }
        .d360-acao-area {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          margin-bottom: 2px;
        }
        @media (max-width: 900px) {
          .d360-resumo {
            grid-template-columns: 1fr;
          }
          .d360-resumo-score {
            border-right: none;
            border-bottom: 1px solid var(--border);
            padding: 0 0 16px;
          }
          .d360-opcoes {
            padding-left: 0;
          }
        }
      `}</style>
        </>
    );
}

// ------------------------------------------------------------
// Radar em SVG (mesma geometria usada no PDF)
// ------------------------------------------------------------

function RadarAreas({ resultado }: { resultado: ReturnType<typeof calcularResultado> }) {
    const size = 300;
    const cx = size / 2;
    const cy = size / 2 + 4;
    const raio = 92;

    const grade = [25, 50, 75, 100].map(escala =>
        radarPontos(resultado.areas.map(() => escala), cx, cy, raio)
            .map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
            .join(' '),
    );

    const eixos = radarPontos(resultado.areas.map(() => 100), cx, cy, raio);
    const rotulos = radarPontos(resultado.areas.map(() => 100), cx, cy, raio + 22);
    const dados = radarPontos(resultado.areas.map(a => a.pontuacao), cx, cy, raio);

    return (
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxHeight: 340 }} role="img" aria-label="Radar de maturidade por área">
            {grade.map((pontos, i) => (
                <polygon key={i} points={pontos} fill="none" stroke="var(--border)" strokeWidth={1} />
            ))}
            {eixos.map((p, i) => (
                <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth={1} />
            ))}
            <polygon
                points={dados.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
                fill="var(--accent)"
                fillOpacity={0.18}
                stroke="var(--accent)"
                strokeWidth={2}
            />
            {dados.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="var(--accent)" />
            ))}
            {rotulos.map((p, i) => {
                const area = resultado.areas[i];
                const anchor = Math.abs(p.x - cx) < 6 ? 'middle' : p.x > cx ? 'start' : 'end';
                return (
                    <g key={area.area.key}>
                        <text x={p.x} y={p.y} textAnchor={anchor} fontSize={11} fontWeight={600} fill="var(--text-primary)">
                            {area.area.nome}
                        </text>
                        <text x={p.x} y={p.y + 13} textAnchor={anchor} fontSize={11} fontWeight={700} fill={area.nivel.cor}>
                            {area.pontuacao.toFixed(0)}%
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
