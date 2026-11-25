'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { store, User } from '../../lib/store';
import Sidebar from '../../components/Sidebar';
import FloatingCopilot from '../../components/FloatingCopilot';
import WhatsAppGlobalNotifier from '../../components/WhatsAppGlobalNotifier';

export default function ConsultorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
  // Último valor conhecido, para comparar sem disparar eventos dentro do setState
  // (o React roda a função de atualização durante a renderização).
  const empresaAtualRef = useRef('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      empresaAtualRef.current = sessionStorage.getItem('cf_empresa_sel') || '';
      setSelectedEmpresaId(empresaAtualRef.current);
    }

    const handleEmpresaChange = (e: any) => {
      empresaAtualRef.current = e.detail || '';
      setSelectedEmpresaId(empresaAtualRef.current);
    };

    const handleDataChange = () => {
      const current = sessionStorage.getItem('cf_empresa_sel') || '';
      if (current === empresaAtualRef.current) return;
      empresaAtualRef.current = current;
      setSelectedEmpresaId(current);
      window.dispatchEvent(new CustomEvent('empresaChange', { detail: current }));
    };

    window.addEventListener('empresaChange', handleEmpresaChange);
    window.addEventListener('cfDataChange', handleDataChange);

    return () => {
      window.removeEventListener('empresaChange', handleEmpresaChange);
      window.removeEventListener('cfDataChange', handleDataChange);
    };
  }, []);

  useEffect(() => {
    const user = store.getCurrentUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'consultor' && user.role !== 'administrador') {
      router.replace('/cliente/dashboard2');
      return;
    }
    setCurrentUser(user);

    // As telas de NFS-e, NF-e Destinadas, CND Federal, Dashboard 2, Comparador SPED, WhatsApp, Agenda, Tarefas e Atividades operam de forma independente da empresa selecionada no menu lateral.
    const isRotaIndependente = pathname === '/consultor/dashboard'
      || pathname.startsWith('/consultor/dashboard2')
      || pathname.startsWith('/consultor/nfse')
      || pathname.startsWith('/consultor/nfe-destinadas')
      || pathname.startsWith('/consultor/cnd-federal')
      || pathname.startsWith('/consultor/comparador-sped')
      || pathname.startsWith('/consultor/whatsapp')
      || pathname.startsWith('/consultor/agenda')
      || pathname.startsWith('/consultor/tarefas')
      || pathname.startsWith('/consultor/atividades');

    // Permissão da rota com base na empresa ativa
    let companyOk = true;
    if (selectedEmpresaId && !isRotaIndependente) {
      const activeEmpresa = store.getEmpresas().find(e => e.id === selectedEmpresaId);
      if (activeEmpresa && activeEmpresa.allowedRoutes && activeEmpresa.allowedRoutes.length > 0) {
        companyOk = activeEmpresa.allowedRoutes.some(route => pathname.startsWith(route));
      }
    }

    // Permissão final
    if (user.role === 'administrador') {
      setAuthorized(true);
    } else if (user.role === 'consultor') {
      const allowed = user.allowedRoutes || ['/consultor/dashboard'];
      if (allowed.includes('somente-whatsapp') && !pathname.startsWith('/consultor/whatsapp')) {
        router.replace('/consultor/whatsapp');
        return;
      }
      const userOk = pathname === '/consultor/dashboard' || pathname.startsWith('/consultor/whatsapp') || allowed.some(route => pathname.startsWith(route));
      
      const isGroup = selectedEmpresaId.startsWith('grupo:');
      let hasCompanyAccess = false;
      if (isRotaIndependente) {
        hasCompanyAccess = true;
      } else if (isGroup) {
        const groupName = selectedEmpresaId.split(':')[1];
        const companiesInGroup = store.getEmpresas().filter(e => e.grupoEconomico === groupName);
        hasCompanyAccess = companiesInGroup.some(e => user.empresaIds && user.empresaIds.includes(e.id));
      } else {
        hasCompanyAccess = !selectedEmpresaId || (user.empresaIds && user.empresaIds.includes(selectedEmpresaId));
      }
      
      setAuthorized(userOk && companyOk && hasCompanyAccess);
    }
  }, [router, pathname, selectedEmpresaId]);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fecha o menu lateral automaticamente ao mudar de rota no mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!currentUser) return null;

  return (
    <div className="app-layout">
      <Sidebar role={currentUser.role as any} />
      <main className="main-content">
        {authorized ? (
          children
        ) : (
          <div className="page-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>🚫</div>
            <h1 className="page-title" style={{ color: 'var(--red)', marginBottom: 12 }}>Acesso Restrito</h1>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto 24px auto', fontSize: 15 }}>
              Desculpe, seu usuário de <strong>Consultor</strong> não possui permissão para acessar esta tela. Entre em contato com o Administrador para solicitar acesso.
            </p>
            <button className="btn btn-primary" onClick={() => router.push('/consultor/dashboard')}>
              Voltar ao Dashboard
            </button>
          </div>
        )}
      </main>
      <FloatingCopilot />
      <WhatsAppGlobalNotifier whatsappHref="/consultor/whatsapp" />
    </div>
  );
}
