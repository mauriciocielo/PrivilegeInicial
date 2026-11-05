'use client';

import { useState, useMemo } from 'react';
import { Instrument_Serif } from 'next/font/google';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import {
  FileText, BarChart3, TrendingUp, Calendar, CheckCircle2,
  Clock, ArrowUpRight, ArrowDownLeft, ChevronRight, Layers, Sparkles
} from 'lucide-react';
import { fmt } from '../lib/reports';

const serif = Instrument_Serif({ subsets: ['latin'], weight: ['400'] });

export interface MesMetrica {
  mes: string;
  label: string;
  mesNome: string;
  recebidas: number;
  emitidas: number;
  comXml: number;
  semXml: number;
  nfse: number;
  cte?: number;
  total: number;
  valorTotal: number;
}

export interface GraficoMensalDados {
  empresa: {
    id: string;
    razaoSocial: string;
    nomeFantasia?: string;
    cnpj: string;
  };
  resumo: {
    totalGeral: number;
    totalRecebidas: number;
    totalEmitidas: number;
    totalNfse: number;
    totalCte?: number;
    totalComXml: number;
    taxaXml: number;
    mediaMensal: number;
    mesPico: { mes: string; label: string; total: number };
    valorAcumulado: number;
    quantidadeMeses: number;
  };
  meses: MesMetrica[];
}

interface Props {
  dados: GraficoMensalDados | null;
  carregando: boolean;
  mesSelecionadoFiltro?: string;
  onSelecionarMes?: (mes: string) => void;
}

export default function NfeGraficoMensalArquivos({
  dados,
  carregando,
  mesSelecionadoFiltro,
  onSelecionarMes,
}: Props) {
  const [modoVisualizacao, setModoVisualizacao] = useState<'tipo' | 'xml' | 'area'>('tipo');
  const [periodoFiltro, setPeriodoFiltro] = useState<'todos' | '6m' | '12m'>('todos');

  // Filtra meses de acordo com o período selecionado
  const mesesFiltrados = useMemo(() => {
    if (!dados?.meses) return [];
    const lista = [...dados.meses];
    if (periodoFiltro === '6m') return lista.slice(-6);
    if (periodoFiltro === '12m') return lista.slice(-12);
    return lista;
  }, [dados?.meses, periodoFiltro]);

  if (carregando) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#6b7280', fontSize: 14 }}>
          <div className="spinner" style={{ width: 18, height: 18, border: '2px solid #e5e7eb', borderTopColor: '#600000', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          Carregando histórico e evolução mensal de arquivos fiscais...
        </div>
      </div>
    );
  }

  if (!dados || dados.meses.length === 0) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 20, padding: 36, textAlign: 'center' }}>
        <FileText size={36} color="#9ca3af" style={{ margin: '0 auto 12px' }} />
        <h4 className={serif.className} style={{ fontSize: 22, color: '#111827', margin: '0 0 6px' }}>
          Nenhum arquivo fiscal encontrado para este cliente
        </h4>
        <p style={{ fontSize: 13, color: '#6b7280', maxWidth: 460, margin: '0 auto' }}>
          Assim que a SEFAZ ou SEFIN processar notas destinadas ou emitidas para esta empresa, o gráfico histórico de arquivos mensais será gerado automaticamente.
        </p>
      </div>
    );
  }

  const { resumo, empresa } = dados;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e5e5',
        borderRadius: 20,
        padding: 24,
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
        marginBottom: 20,
      }}
    >
      {/* Topo do Gráfico */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#600000' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#600000' }}>
              Volumetria Mensal de Documentos Fiscais
            </span>
          </div>
          <h3 className={serif.className} style={{ fontSize: 26, fontWeight: 400, color: '#171717', margin: '0 0 4px' }}>
            Evolução de Arquivos por Mês — {empresa.razaoSocial}
          </h3>
          <p style={{ fontSize: 13, color: '#525252', margin: 0 }}>
            Análise temporal da quantidade de arquivos XML de NF-e recebidas, emitidas e notas de serviço registradas.
          </p>
        </div>

        {/* Controles de Modo e Período */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Seletor de Período */}
          <div style={{ display: 'inline-flex', background: '#f3f4f6', padding: 3, borderRadius: 10, gap: 2 }}>
            <button
              type="button"
              onClick={() => setPeriodoFiltro('6m')}
              style={{
                border: 'none',
                background: periodoFiltro === '6m' ? '#fff' : 'transparent',
                color: periodoFiltro === '6m' ? '#111827' : '#6b7280',
                fontWeight: periodoFiltro === '6m' ? 600 : 500,
                fontSize: 12,
                padding: '5px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                boxShadow: periodoFiltro === '6m' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Últimos 6 meses
            </button>
            <button
              type="button"
              onClick={() => setPeriodoFiltro('12m')}
              style={{
                border: 'none',
                background: periodoFiltro === '12m' ? '#fff' : 'transparent',
                color: periodoFiltro === '12m' ? '#111827' : '#6b7280',
                fontWeight: periodoFiltro === '12m' ? 600 : 500,
                fontSize: 12,
                padding: '5px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                boxShadow: periodoFiltro === '12m' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              12 meses
            </button>
            <button
              type="button"
              onClick={() => setPeriodoFiltro('todos')}
              style={{
                border: 'none',
                background: periodoFiltro === 'todos' ? '#fff' : 'transparent',
                color: periodoFiltro === 'todos' ? '#111827' : '#6b7280',
                fontWeight: periodoFiltro === 'todos' ? 600 : 500,
                fontSize: 12,
                padding: '5px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                boxShadow: periodoFiltro === 'todos' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Histórico Completo
            </button>
          </div>

          {/* Seletor de Tipo de Gráfico */}
          <div style={{ display: 'inline-flex', background: '#f3f4f6', padding: 3, borderRadius: 10, gap: 2 }}>
            <button
              type="button"
              onClick={() => setModoVisualizacao('tipo')}
              title="Comparar Arquivos de Compras vs Vendas"
              style={{
                border: 'none',
                background: modoVisualizacao === 'tipo' ? '#600000' : 'transparent',
                color: modoVisualizacao === 'tipo' ? '#fff' : '#4b5563',
                fontWeight: 600,
                fontSize: 12,
                padding: '5px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <BarChart3 size={13} /> Por Tipo
            </button>
            <button
              type="button"
              onClick={() => setModoVisualizacao('xml')}
              title="Verificar se os arquivos XML completos já foram baixados"
              style={{
                border: 'none',
                background: modoVisualizacao === 'xml' ? '#600000' : 'transparent',
                color: modoVisualizacao === 'xml' ? '#fff' : '#4b5563',
                fontWeight: 600,
                fontSize: 12,
                padding: '5px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <CheckCircle2 size={13} /> Por XML
            </button>
            <button
              type="button"
              onClick={() => setModoVisualizacao('area')}
              title="Curva contínua de volume"
              style={{
                border: 'none',
                background: modoVisualizacao === 'area' ? '#600000' : 'transparent',
                color: modoVisualizacao === 'area' ? '#fff' : '#4b5563',
                fontWeight: 600,
                fontSize: 12,
                padding: '5px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <TrendingUp size={13} /> Tendência
            </button>
          </div>
        </div>
      </div>

      {/* 4 Cards de Resumo Analítico */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Total de Arquivos Processados</span>
            <FileText size={15} color="#2563eb" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>
            {resumo.totalGeral}
          </div>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            {resumo.totalRecebidas} compras • {resumo.totalEmitidas} vendas {resumo.totalNfse > 0 ? `• ${resumo.totalNfse} serviços` : ''} {resumo.totalCte ? `• ${resumo.totalCte} fretes (CT-e)` : ''}
          </span>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Média Mensal do Cliente</span>
            <Calendar size={15} color="#059669" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>
            ~{resumo.mediaMensal} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>arquivos/mês</span>
          </div>
          <span style={{ fontSize: 11, color: '#059669' }}>
            Com base em {resumo.quantidadeMeses} {resumo.quantidadeMeses === 1 ? 'mês' : 'meses'} de histórico
          </span>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Mês com Maior Volume (Pico)</span>
            <TrendingUp size={15} color="#d97706" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>
            {resumo.mesPico.total} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>arquivos</span>
          </div>
          <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>
            {resumo.mesPico.label || 'Sem dados'}
          </span>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Disponibilidade de XMLs</span>
            <CheckCircle2 size={15} color="#16a34a" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#16a34a' }}>
            {resumo.taxaXml}%
          </div>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            {resumo.totalComXml} arquivos com XML baixado
          </span>
        </div>
      </div>

      {/* ÁREA DO GRÁFICO (RECHARTS) */}
      <div style={{ height: 290, width: '100%', marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          {modoVisualizacao === 'tipo' ? (
            <BarChart
              data={mesesFiltrados}
              barGap={4}
              onClick={(e: any) => {
                const mes = e?.activePayload?.[0]?.payload?.mes;
                if (mes && onSelecionarMes) onSelecionarMes(mes);
              }}
              style={{ cursor: onSelecionarMes ? 'pointer' : 'default' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255, 255, 255, 0.98)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                  fontSize: 12.5,
                }}
                labelStyle={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}
                formatter={(val: any, name: any) => [
                  `${val} arquivo(s)`,
                  name === 'recebidas' ? '📥 Recebidas (Compras)' :
                  name === 'emitidas' ? '📤 Emitidas (Vendas)' :
                  name === 'nfse' ? '🧾 Serviços (NFS-e)' : name
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                formatter={(value) => {
                  if (value === 'recebidas') return 'Arquivos Recebidos (Compras de Fornecedores)';
                  if (value === 'emitidas') return 'Arquivos Emitidos (Vendas do Cliente)';
                  if (value === 'nfse') return 'Notas de Serviço (NFS-e)';
                  return value;
                }}
              />
              <Bar
                dataKey="recebidas"
                name="recebidas"
                fill="#2563eb"
                radius={[4, 4, 0, 0]}
              >
                {mesesFiltrados.map((m) => (
                  <Cell
                    key={m.mes}
                    fill={mesSelecionadoFiltro === m.mes ? '#1d4ed8' : '#3b82f6'}
                    stroke={mesSelecionadoFiltro === m.mes ? '#1e3a8a' : 'transparent'}
                    strokeWidth={mesSelecionadoFiltro === m.mes ? 2 : 0}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="emitidas"
                name="emitidas"
                fill="#16a34a"
                radius={[4, 4, 0, 0]}
              >
                {mesesFiltrados.map((m) => (
                  <Cell
                    key={m.mes}
                    fill={mesSelecionadoFiltro === m.mes ? '#15803d' : '#22c55e'}
                    stroke={mesSelecionadoFiltro === m.mes ? '#14532d' : 'transparent'}
                    strokeWidth={mesSelecionadoFiltro === m.mes ? 2 : 0}
                  />
                ))}
              </Bar>
              {resumo.totalNfse > 0 && (
                <Bar
                  dataKey="nfse"
                  name="nfse"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          ) : modoVisualizacao === 'xml' ? (
            <BarChart
              data={mesesFiltrados}
              barGap={4}
              onClick={(e: any) => {
                const mes = e?.activePayload?.[0]?.payload?.mes;
                if (mes && onSelecionarMes) onSelecionarMes(mes);
              }}
              style={{ cursor: onSelecionarMes ? 'pointer' : 'default' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255, 255, 255, 0.98)',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                  fontSize: 12.5,
                }}
                labelStyle={{ fontWeight: 700, color: '#0f172a' }}
                formatter={(val: any, name: any) => [
                  `${val} arquivo(s)`,
                  name === 'comXml' ? '✓ Arquivo XML Baixado' : '⚠️ Apenas Resumo SEFAZ'
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                formatter={(value) => (value === 'comXml' ? 'Arquivo XML Completo Disponível' : 'Em Formato de Resumo SEFAZ')}
              />
              <Bar dataKey="comXml" name="comXml" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="semXml" name="semXml" fill="#f59e0b" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart
              data={mesesFiltrados}
              onClick={(e: any) => {
                const mes = e?.activePayload?.[0]?.payload?.mes;
                if (mes && onSelecionarMes) onSelecionarMes(mes);
              }}
              style={{ cursor: onSelecionarMes ? 'pointer' : 'default' }}
            >
              <defs>
                <linearGradient id="colorTotalArquivos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#600000" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#600000" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255, 255, 255, 0.98)',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                  fontSize: 12.5,
                }}
                labelStyle={{ fontWeight: 700, color: '#0f172a' }}
                formatter={(val: any) => [`${val} arquivos fiscais no mês`, 'Total Geral']}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              <Area
                type="monotone"
                dataKey="total"
                name="Total de Arquivos Fiscais"
                stroke="#600000"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorTotalArquivos)"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 12, color: '#64748b', marginBottom: 16 }}>
        <span>💡 Dica: Clique em qualquer barra ou mês no gráfico para filtrar as notas fiscais daquele mês instantaneamente.</span>
        {mesSelecionadoFiltro && (
          <span style={{ color: '#600000', fontWeight: 600 }}>
            Mês ativo no filtro: {mesSelecionadoFiltro}
          </span>
        )}
      </div>

      {/* TABELA DE DETALHAMENTO MENSAL */}
      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: '9px 14px', fontWeight: 600, color: '#475569' }}>Mês / Competência</th>
              <th style={{ padding: '9px 14px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Recebidas (Compras)</th>
              <th style={{ padding: '9px 14px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Emitidas (Vendas)</th>
              {resumo.totalNfse > 0 && (
                <th style={{ padding: '9px 14px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Serviços (NFS-e)</th>
              )}
              <th style={{ padding: '9px 14px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Total de Arquivos</th>
              <th style={{ padding: '9px 14px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>XMLs Baixados</th>
              <th style={{ padding: '9px 14px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Total Movimentado</th>
              {onSelecionarMes && (
                <th style={{ padding: '9px 14px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Ação</th>
              )}
            </tr>
          </thead>
          <tbody>
            {mesesFiltrados.slice().reverse().map((m) => {
              const selecionado = mesSelecionadoFiltro === m.mes;
              return (
                <tr
                  key={m.mes}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: selecionado ? '#fef2f2' : 'transparent',
                    transition: 'background 0.2s',
                  }}
                >
                  <td style={{ padding: '9px 14px', fontWeight: 600, color: selecionado ? '#600000' : '#1e293b' }}>
                    {m.mesNome}
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'center', color: '#2563eb', fontWeight: 600 }}>
                    {m.recebidas}
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>
                    {m.emitidas}
                  </td>
                  {resumo.totalNfse > 0 && (
                    <td style={{ padding: '9px 14px', textAlign: 'center', color: '#8b5cf6', fontWeight: 600 }}>
                      {m.nfse}
                    </td>
                  )}
                  <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                    {m.total}
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 11.5,
                        fontWeight: 600,
                        background: m.semXml === 0 ? '#dcfce7' : '#fef3c7',
                        color: m.semXml === 0 ? '#166534' : '#92400e',
                      }}
                    >
                      {m.comXml} de {m.total} ({m.total > 0 ? Math.round((m.comXml / m.total) * 100) : 0}%)
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                    {fmt.currency(m.valorTotal)}
                  </td>
                  {onSelecionarMes && (
                    <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => onSelecionarMes(m.mes)}
                        className="btn btn-secondary btn-sm"
                        style={{
                          fontSize: 11.5,
                          padding: '3px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          background: selecionado ? '#600000' : '#fff',
                          color: selecionado ? '#fff' : '#374151',
                          borderColor: selecionado ? '#600000' : '#e5e7eb',
                        }}
                      >
                        {selecionado ? 'Filtrado' : 'Ver Notas'} <ChevronRight size={11} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
