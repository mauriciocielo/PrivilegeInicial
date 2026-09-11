'use client';
import { useEffect, useMemo, useState } from 'react';
import { store, AgendaTask } from '../../../lib/store';
import { CalendarDays } from 'lucide-react';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const toIsoLocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const hojeIso = () => toIsoLocal(new Date());

function rotuloDoDia(iso: string): string {
  const hoje = hojeIso();
  const amanha = toIsoLocal(new Date(Date.now() + 86400000));
  if (iso === hoje) return 'Hoje';
  if (iso === amanha) return 'Amanhã';
  const [ano, mes, dia] = iso.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  return `${DIAS_SEMANA[d.getDay()]}, ${dia} de ${MESES[mes - 1]}`;
}

/**
 * Janela de leitura da agenda do consultor — só os compromissos vinculados
 * explicitamente à empresa do cliente (task.empresaId), nunca a agenda
 * interna completa da equipe. Não é editável por aqui de propósito: quem
 * organiza a agenda é o consultor, o cliente só acompanha.
 */
export default function ClienteAgendaPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const user = store.getCurrentUser();
    const defaultEmpresaId = user?.empresaIds?.[0] || store.getEmpresas()[0]?.id || '';
    const saved = sessionStorage.getItem('cf_empresa_sel') || defaultEmpresaId;
    setEmpresaId(saved);
    const handler = (e: Event) => setEmpresaId((e as CustomEvent).detail || defaultEmpresaId);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, []);

  useEffect(() => {
    const load = () => setTasks(store.getAgendaTasks());
    load();
    window.addEventListener('cfDataChange', load);
    return () => window.removeEventListener('cfDataChange', load);
  }, []);

  const gruposPorDia = useMemo(() => {
    if (!empresaId) return [];
    const limiteInicio = toIsoLocal(new Date(Date.now() - 7 * 86400000));
    const limiteFim = toIsoLocal(new Date(Date.now() + 120 * 86400000));

    const relevantes = tasks.filter(t => t.empresaId === empresaId && t.dateStr >= limiteInicio && t.dateStr <= limiteFim);

    const porDia = new Map<string, AgendaTask[]>();
    for (const t of relevantes) {
      const arr = porDia.get(t.dateStr) || [];
      arr.push(t);
      porDia.set(t.dateStr, arr);
    }
    for (const arr of porDia.values()) arr.sort((a, b) => String(a.horario || '').localeCompare(String(b.horario || '')));

    return Array.from(porDia.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tasks, empresaId]);

  const hoje = hojeIso();

  if (!mounted) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando agenda...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Agenda</div>
          <div className="page-subtitle">Compromissos e visitas agendados com a sua consultoria.</div>
        </div>
      </div>

      <div className="page-body">
        {gruposPorDia.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><CalendarDays size={40} /></div>
            <h3>Nenhum compromisso agendado</h3>
            <p>Assim que seu consultor agendar uma reunião ou visita, ela aparece aqui.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {gruposPorDia.map(([iso, tarefas]) => {
              const isHoje = iso === hoje;
              const isPassado = iso < hoje;
              return (
                <div key={iso}>
                  <div style={{
                    fontSize: 12.5, fontWeight: 800, textTransform: 'capitalize', marginBottom: 8,
                    color: isHoje ? 'var(--accent)' : isPassado ? 'var(--text-muted)' : 'var(--text-primary)',
                  }}>
                    {rotuloDoDia(iso)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tarefas.map(t => (
                      <div key={t.id} className="card" style={{
                        padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start',
                        opacity: isPassado || t.completed ? 0.6 : 1,
                        borderLeft: `4px solid ${isHoje ? 'var(--accent)' : 'var(--border-light)'}`,
                      }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)', minWidth: 48 }}>{t.horario}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, textDecoration: t.completed ? 'line-through' : 'none' }}>
                            {t.title}
                          </div>
                          {t.location && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>📍 {t.location}</div>}
                        </div>
                        {t.completed && <span className="badge badge-green" style={{ fontSize: 10 }}>Concluído</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
