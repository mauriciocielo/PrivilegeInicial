'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { store } from '../lib/store';
import { services, cnds, integrations, faqs, legalDocs } from './pageData';

function useReveal() {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('visible'); obs.unobserve(el); } }, { threshold: 0.08 });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, id, className = '', style = {} }: { children: React.ReactNode; id?: string; className?: string; style?: React.CSSProperties }) {
  const ref = useReveal();
  return <section ref={ref as React.RefObject<HTMLElement>} id={id} className={`rv ${className}`} style={style}>{children}</section>;
}

const BRAND = '#600000';
const BRAND_DARK = '#400000';

import ScrollProgress from '../components/ScrollProgress';
import AnimatedCounter from '../components/AnimatedCounter';
import LiveDashboard from '../components/LiveDashboard';

const ICONS: Record<string, React.ReactNode> = {
  Building: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="9" width="18" height="13" /><path d="M8 22V12h8v10" /><path d="M3 9l9-7 9 7" /></svg>,
  FileText: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  Users: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  TrendingUp: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
  DollarSign: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  Shield: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  BarChart2: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  PieChart: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>,
  Scale: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="3" x2="12" y2="21" /><path d="M6 3l6 9 6-9" /><path d="M3 17l3-8 3 8a3 3 0 0 1-6 0z" /><path d="M15 17l3-8 3 8a3 3 0 0 1-6 0z" /></svg>,
  Landmark: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22" /><line x1="6" y1="18" x2="6" y2="11" /><line x1="10" y1="18" x2="10" y2="11" /><line x1="14" y1="18" x2="14" y2="11" /><line x1="18" y1="18" x2="18" y2="11" /><polygon points="12 2 20 7 4 7" /></svg>,
  Phone: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.17-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
  Mail: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
  MapPin: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  Clock: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  ChevronDown: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>,
  ExternalLink: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>,
  WhatsApp: <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>,
};

function Icon({ name, size = 22, color = BRAND }: { name: string; size?: number; color?: string }) {
  return <span style={{ color, display: 'inline-flex', width: size, height: size }}>{ICONS[name]}</span>;
}

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeLegal, setActiveLegal] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState({ nome: '', email: '', whatsapp: '', faturamento: '', objetivo: '' });
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const user = store.getCurrentUser();
    if (user) router.replace(user.role === 'consultor' ? '/consultor/dashboard' : '/cliente/dashboard');
    else setChecking(false);
  }, [router]);

  if (checking) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.email) return;
    setSent(true);
  };

  const navLinks = [
    { href: '#inicio', label: 'Início' },
    { href: '#solucoes', label: 'Soluções' },
    { href: '#utilidades', label: 'Utilidades' },
    { href: '#sobre', label: 'Sobre' },
    { href: '#faq', label: 'FAQ' },
    { href: '#contato', label: 'Contato' },
  ];

  return (
    <div className="lp">
      <ScrollProgress />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .lp{font-family:'Inter',sans-serif;color:#334155;background:#f8fafc;overflow-x:hidden;}
        h1,h2,h3,h4{font-family:'Montserrat',sans-serif;color:#0F172A;line-height:1.15;}
        .c{width:100%;max-width:1200px;margin:0 auto;padding:0 24px;}
        /* Topbar */
        .topbar{background:linear-gradient(90deg, #0F172A 0%, #1e293b 100%);padding:10px 0;font-size:12px;color:#cbd5e1;}
        .topbar .c{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;}
        .topbar a{color:#cbd5e1;text-decoration:none;transition:color .2s;font-weight:600;}
        .topbar a:hover{color:#fff;}
        /* Navbar */
        .nb{position:fixed;top:40px;left:0;right:0;z-index:999;transition:all .4s cubic-bezier(0.4, 0, 0.2, 1);background:rgba(255,255,255,0.7);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.5);}
        .nb.s{top:0;background:rgba(255,255,255,0.9);box-shadow:0 10px 40px rgba(0,0,0,0.05);}
        .nb .c{height:80px;display:flex;align-items:center;justify-content:space-between;gap:16px;}
        .logo{display:flex;flex-direction:column;line-height:1.1;text-decoration:none;transition:transform 0.3s;}
        .logo:hover{transform:scale(1.02);}
        .nav-links{display:flex;align-items:center;gap:32px;}
        .nav-a{font-size:14px;font-weight:600;color:#334155;text-decoration:none;transition:all .2s;position:relative;}
        .nav-a:hover{color:${BRAND};}
        .nav-a::after{content:'';position:absolute;bottom:-4px;left:0;width:0%;height:2px;background:${BRAND};transition:width 0.3s;}
        .nav-a:hover::after{width:100%;}
        .nav-actions{display:flex;gap:12px;}
        /* Buttons */
        .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 24px;font-family:'Inter',sans-serif;font-size:14px;font-weight:700;border-radius:12px;cursor:pointer;text-decoration:none;border:none;transition:all .3s cubic-bezier(0.4, 0, 0.2, 1);white-space:nowrap;box-shadow:0 4px 10px rgba(0,0,0,0.05);}
        .btn-p{background:linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%);color:#fff !important;box-shadow:0 8px 25px rgba(96, 0, 0, 0.25);}
        .btn-p:hover{box-shadow:0 12px 30px rgba(96, 0, 0, 0.35);transform:translateY(-2px);background:linear-gradient(135deg, ${BRAND_DARK} 0%, #2a0000 100%);}
        .btn-o{background:rgba(255,255,255,0.8);backdrop-filter:blur(10px);color:#0F172A !important;border:1px solid rgba(0,0,0,0.1);}
        .btn-o:hover{background:#fff;border-color:rgba(0,0,0,0.2);transform:translateY(-2px);box-shadow:0 10px 25px rgba(0,0,0,0.05);}
        .btn-w{background:linear-gradient(135deg, #25D366 0%, #128C7E 100%);color:#fff !important;box-shadow:0 8px 25px rgba(37, 211, 102, 0.25);}
        .btn-w:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(37, 211, 102, 0.35);}
        .btn-lg{padding:16px 36px;font-size:16px;}
        /* Hero */
        .hero{padding:160px 0 100px;background:radial-gradient(circle at 90% 10%, rgba(96, 0, 0, 0.08) 0%, transparent 40%), radial-gradient(circle at 10% 90%, rgba(59, 130, 246, 0.05) 0%, transparent 40%), linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);position:relative;overflow:hidden;}
        .hero::before{content:'';position:absolute;top:0;left:0;right:0;height:400px;background:linear-gradient(180deg, rgba(255,255,255,0.8) 0%, transparent 100%);z-index:0;}
        .hero-cols{position:relative;z-index:1;}
        .hero h1{font-size:clamp(36px,5vw,60px);font-weight:900;letter-spacing:-.03em;margin-bottom:24px;background:linear-gradient(90deg, #0f172a 0%, #334155 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .hero p{font-size:19px;line-height:1.75;color:#475569;max-width:560px;margin-bottom:40px;font-weight:500;}
        .hero-ctas{display:flex;gap:16px;flex-wrap:wrap;}
        
        /* Stats Banner */
        .stats-bar{background:linear-gradient(135deg, ${BRAND} 0%, #2a0000 100%);padding:64px 0;position:relative;}
        .stats-bar::after{content:'';position:absolute;inset:0;background:url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+') repeat;opacity:0.5;}
        .stats-bar .c{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;position:relative;z-index:1;}
        .stat-item{text-align:center;color:#fff;}
        .stat-val{font-family:'Montserrat',sans-serif;font-size:48px;font-weight:900;line-height:1;text-shadow:0 4px 20px rgba(0,0,0,0.3);}
        .stat-lbl{font-size:15px;margin-top:10px;opacity:.9;font-weight:600;text-transform:uppercase;letter-spacing:1px;}
        /* Tech */
        .tech-grid{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;margin-top:40px;}
        .tech-badge{padding:12px 24px;background:rgba(255,255,255,0.7);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.9);box-shadow:0 10px 30px rgba(0,0,0,0.03);border-radius:12px;font-weight:700;font-size:15px;color:#0F172A;transition:all .3s;}
        .tech-badge:hover{transform:translateY(-4px);box-shadow:0 15px 40px rgba(0,0,0,0.08);background:#fff;}
        /* Services */
        .svc-grid{display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:24px;margin-top:56px;}
        .svc-card{padding:32px 28px;background:rgba(255,255,255,0.6);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.8);border-radius:20px;transition:all .3s cubic-bezier(0.4, 0, 0.2, 1);box-shadow:0 10px 30px rgba(0,0,0,0.03);}
        .svc-card:hover{background:#fff;border-color:rgba(96,0,0,0.1);box-shadow:0 20px 50px rgba(96,0,0,0.08);transform:translateY(-8px);}
        .svc-icon{width:56px;height:56px;background:linear-gradient(135deg, rgba(96,0,0,0.1) 0%, rgba(96,0,0,0.02) 100%);border-radius:14px;border:1px solid rgba(96,0,0,0.05);display:flex;align-items:center;justify-content:center;margin-bottom:24px;}
        .svc-card h3{font-size:16px;font-weight:800;margin-bottom:12px;color:#0F172A;}
        .svc-card p{font-size:14px;color:#64748b;line-height:1.7;margin:0;font-weight:500;}
        /* Principles */
        .principle{background:rgba(255,255,255,0.7);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.9);box-shadow:0 10px 40px rgba(0,0,0,0.04);border-radius:20px;padding:40px;}
        .principle h3{font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:${BRAND};margin-bottom:12px;display:flex;align-items:center;gap:10px;}
        .principle p{font-size:16px;color:#334155;line-height:1.8;margin:0;font-weight:500;}
        /* CND Grid */
        .cnd-grid{display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:16px;margin-top:40px;}
        .cnd-btn{display:flex;align-items:center;gap:14px;padding:18px 22px;background:rgba(255,255,255,0.7);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.9);box-shadow:0 5px 20px rgba(0,0,0,0.03);border-radius:12px;font-size:14px;font-weight:700;color:#0F172A;text-decoration:none;transition:all .3s;}
        .cnd-btn:hover{background:#fff;border-color:${BRAND};color:${BRAND};transform:translateY(-2px);box-shadow:0 12px 30px rgba(96,0,0,0.06);}
        /* FAQ */
        .faq-item{background:rgba(255,255,255,0.6);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.8);border-radius:14px;overflow:hidden;margin-bottom:16px;box-shadow:0 5px 20px rgba(0,0,0,0.02);transition:all .3s;}
        .faq-item:hover{background:#fff;box-shadow:0 10px 30px rgba(0,0,0,0.05);}
        .faq-q{display:flex;justify-content:space-between;align-items:center;padding:22px 28px;cursor:pointer;font-weight:700;font-size:16px;color:#0F172A;}
        .faq-a{padding:0 28px;max-height:0;overflow:hidden;transition:all .4s cubic-bezier(0.4, 0, 0.2, 1);font-size:15px;line-height:1.75;color:#475569;font-weight:500;}
        .faq-a.open{max-height:300px;padding:0 28px 22px;opacity:1;}
        .faq-chevron{transition:transform .4s;}
        .faq-chevron.open{transform:rotate(180deg);}
        /* Contact */
        .contact-info-item{display:flex;align-items:center;gap:16px;margin-bottom:28px;}
        .ci-icon{width:48px;height:48px;background:linear-gradient(135deg, rgba(96,0,0,0.1) 0%, rgba(96,0,0,0.02) 100%);border:1px solid rgba(96,0,0,0.05);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .ci-label{font-size:12px;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;}
        .ci-val{font-size:15px;font-weight:700;color:#0F172A;line-height:1.5;}
        /* Form */
        .form-card{background:rgba(255,255,255,0.75);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.9);border-radius:24px;padding:48px;box-shadow:0 20px 60px rgba(0,0,0,.08);}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
        .fg{display:flex;flex-direction:column;gap:8px;}
        .fl{font-size:13px;font-weight:700;color:#0F172A;}
        .fi{padding:14px 18px;background:rgba(255,255,255,0.9);border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-family:'Inter',sans-serif;font-size:15px;font-weight:500;color:#0F172A;transition:all .3s;outline:none;}
        .fi:focus{border-color:${BRAND};background:#fff;box-shadow:0 0 0 4px rgba(96,0,0,0.05);}
        .fi.err{border-color:#ef4444;}
        /* Footer */
        .footer{background:#0F172A;color:#94A3B8;padding:80px 0 32px;position:relative;overflow:hidden;}
        .footer::before{content:'';position:absolute;top:-100px;right:-100px;width:400px;height:400px;background:radial-gradient(circle, rgba(96,0,0,0.4) 0%, transparent 60%);filter:blur(40px);}
        .footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:56px;position:relative;z-index:1;}
        .footer h4{font-family:'Montserrat',sans-serif;font-size:14px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.08em;margin-bottom:20px;}
        .fl-link{display:block;font-size:14px;font-weight:500;color:#cbd5e1;text-decoration:none;margin-bottom:12px;transition:all .2s;}
        .fl-link:hover{color:#fff;transform:translateX(4px);}
        .footer-divider{border:none;border-top:1px solid rgba(255,255,255,0.1);margin-bottom:24px;position:relative;z-index:1;}
        /* Reveal */
        .rv{opacity:0;transform:translateY(30px);transition:opacity .8s cubic-bezier(0.16, 1, 0.3, 1),transform .8s cubic-bezier(0.16, 1, 0.3, 1);padding:110px 0;}
        .rv.visible{opacity:1;transform:translateY(0);}
        /* Modal */
        .modal-bg{position:fixed;inset:0;background:rgba(15, 23, 42, 0.8);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:2000;opacity:0;pointer-events:none;transition:all .3s;}
        .modal-bg.on{opacity:1;pointer-events:auto;}
        .modal-box{background:#fff;border-radius:20px;padding:48px;max-width:600px;width:calc(100% - 32px);max-height:85vh;overflow-y:auto;box-shadow:0 30px 60px rgba(0,0,0,.3);transform:translateY(20px);transition:all .4s cubic-bezier(0.16, 1, 0.3, 1);}
        .modal-bg.on .modal-box{transform:translateY(0);}
        
        /* Stagger for Grids */
        .reveal-stagger > * { opacity: 0; transform: translateY(30px); transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
        .reveal-stagger.visible > *:nth-child(1) { transition-delay: 0ms; }
        .reveal-stagger.visible > *:nth-child(2) { transition-delay: 100ms; }
        .reveal-stagger.visible > *:nth-child(3) { transition-delay: 200ms; }
        .reveal-stagger.visible > *:nth-child(4) { transition-delay: 300ms; }
        .reveal-stagger.visible > *:nth-child(5) { transition-delay: 400ms; }
        .reveal-stagger.visible > *:nth-child(6) { transition-delay: 500ms; }
        .reveal-stagger.visible > * { opacity: 1; transform: translateY(0); }
        
        @media (prefers-reduced-motion: reduce) {
          .rv, .reveal-stagger > * { transition: none !important; opacity: 1 !important; transform: none !important; }
        }

        /* Mobile */
        .ham{display:none;background:rgba(255,255,255,0.5);border:1px solid rgba(0,0,0,0.1);border-radius:8px;cursor:pointer;padding:10px;backdrop-filter:blur(4px);}
        .mob-menu{display:none;position:fixed;top:120px;left:0;right:0;background:rgba(255,255,255,0.95);backdrop-filter:blur(20px);padding:30px 24px;border-bottom:1px solid rgba(0,0,0,0.1);z-index:998;flex-direction:column;gap:20px;box-shadow:0 20px 40px rgba(0,0,0,0.1);}
        .mob-menu.on{display:flex;}
        @media(max-width:1024px){.svc-grid{grid-template-columns:repeat(3,1fr);} .stats-bar .c{grid-template-columns:repeat(2,1fr);gap:40px;} .footer-grid{grid-template-columns:1fr 1fr;}}
        @media(max-width:768px){.nav-links,.nav-actions{display:none;} .ham{display:block;} .hero{padding:120px 0 60px;} .hero-cols{flex-direction:column !important;} .svc-grid{grid-template-columns:1fr 1fr;} .cnd-grid{grid-template-columns:1fr;} .form-grid{grid-template-columns:1fr;} .footer-grid{grid-template-columns:1fr;} .contact-cols{flex-direction:column !important;} .principle-cols{flex-direction:column !important;} .ci-val { word-break: break-word; }}
        @media(max-width:480px){.svc-grid{grid-template-columns:1fr;} .stat-val{font-size:36px;} .hero h1{font-size:32px;} .form-card{padding:30px 24px;}}
      `}</style>

      {/* ── TOPBAR ── */}
      <div className="topbar">
        <div className="c">
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="Phone" size={13} color="#64748b" /> (46) 3035-1018</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="Mail" size={13} color="#64748b" /> contato@privilegecontabilidade.com.br</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="MapPin" size={13} color="#64748b" /> Francisco Beltrão - PR</span>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <a href="https://solucoes.receita.fazenda.gov.br" target="_blank" rel="noopener" className="topbar-link">Acesso CNDs</a>
            <Link href="/login">Portal do Cliente</Link>
            <a href="https://www.iti.br/certificacao-digital" target="_blank" rel="noopener">Certificação Digital</a>
          </div>
        </div>
      </div>

      {/* ── NAVBAR ── */}
      <nav className={`nb${scrolled ? ' s' : ''}`}>
        <div className="c">
          <Link href="/" className="logo" style={{ display: 'block' }}>
            <Image src="/logo.png" alt="Privilege Contabilidade e Consultoria" width={180} height={50} style={{ objectFit: 'contain' }} priority />
          </Link>
          <div className="nav-links">
            {navLinks.map(n => <a key={n.href} href={n.href} className="nav-a">{n.label}</a>)}
          </div>
          <div className="nav-actions">
            <Link href="/login" className="btn btn-o">Portal do Cliente</Link>
            <a href="https://wa.me/554630351061?text=Olá!%20Gostaria%20de%20um%20diagnóstico%20contábil%20gratuito." target="_blank" rel="noopener" className="btn btn-w">
              <Icon name="WhatsApp" size={16} color="#fff" /> WhatsApp
            </a>
          </div>
          <button className="ham" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth={2} strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
        </div>
      </nav>
      <div className={`mob-menu${mobileOpen ? ' on' : ''}`}>
        {navLinks.map(n => <a key={n.href} href={n.href} className="nav-a" onClick={() => setMobileOpen(false)}>{n.label}</a>)}
        <Link href="/login" className="btn btn-o" style={{ textAlign: 'center' }}>Portal do Cliente</Link>
        <a href="https://wa.me/554630351061" className="btn btn-w" style={{ textAlign: 'center' }}>WhatsApp</a>
      </div>
      <div style={{ height: scrolled ? 72 : 108 }} />

      {/* ── HERO ── */}
      <section id="inicio" className="hero rv visible">
        <div className="c">
          <div className="hero-cols" style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#FFF5F5', border: `1px solid ${BRAND}22`, borderRadius: 20, padding: '6px 14px', marginBottom: 24 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: BRAND, display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: BRAND, textTransform: 'uppercase', letterSpacing: '.08em' }}>Privilege Contabilidade · 8 Anos de Excelência</span>
              </div>
              <h1>Excelência Contábil & Gestão Digital Avançada para a sua Empresa</h1>
              <p>Há 8 anos transformando dados financeiros em decisões estratégicas. Unimos a precisão da contabilidade consultiva ao BPO financeiro de alta performance.</p>
              <div className="hero-ctas">
                <a href="#contato" className="btn btn-p btn-lg">Solicitar Diagnóstico Gratuito</a>
                <a href="#solucoes" className="btn btn-o btn-lg">Simular Economia com BPO</a>
              </div>

            </div>
            <div style={{ flex: 1, maxWidth: 460 }}>
              <LiveDashboard />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BANNER ── */}
      <Reveal id="stats-banner" className="stats-bar">
        <div className="c">
          <div className="stat-item">
            <div className="stat-val"><AnimatedCounter target={500} prefix="+" duration={1800} /></div>
            <div className="stat-lbl">Empresas Atendidas</div>
          </div>
          <div className="stat-item">
            <div className="stat-val"><AnimatedCounter target={2} prefix="R$ " suffix="Bi+" duration={1700} /></div>
            <div className="stat-lbl">Faturamento Gerido</div>
          </div>
          <div className="stat-item">
            <div className="stat-val"><AnimatedCounter target={98} suffix="%" duration={1600} /></div>
            <div className="stat-lbl">Retenção de Clientes</div>
          </div>
          <div className="stat-item">
            <div className="stat-val"><AnimatedCounter target={8} suffix=" Anos" duration={1500} /></div>
            <div className="stat-lbl">Tradição e Inovação</div>
          </div>
        </div>
      </Reveal>

      {/* ── TECH / INTEGRAÇÕES ── */}
      <Reveal id="tech" style={{ padding: '80px 0', background: '#F8FAFC' }}>
        <div className="c" style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: BRAND, textTransform: 'uppercase', letterSpacing: '.1em' }}>Tecnologia & Integrações</span>
          <h2 style={{ fontSize: 'clamp(24px,3vw,36px)', marginTop: 10, marginBottom: 14 }}>Integrado ao Seu ERP e Sistema de Gestão</h2>
          <p style={{ fontSize: 16, color: '#475569', maxWidth: 600, margin: '0 auto' }}>Conectamos nossa operação aos principais ecossistemas financeiros do mercado, garantindo conciliação OFX automatizada e zero retrabalho.</p>
          <div className="tech-grid">
            {integrations.map(({ name, color }) => (
              <div key={name} className="tech-badge" style={{ borderLeft: `3px solid ${color}` }}>
                <span style={{ color }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── SOLUÇÕES ── */}
      <Reveal id="solucoes">
        <div className="c">
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: BRAND, textTransform: 'uppercase', letterSpacing: '.1em' }}>Soluções Corporativas</span>
            <h2 style={{ fontSize: 'clamp(24px,3vw,38px)', marginTop: 10, marginBottom: 14 }}>Nossas Soluções Corporativas</h2>
            <p style={{ color: '#475569', fontSize: 16 }}>Estrutura completa para facilitar sua rotina tributária e impulsionar a gestão do seu negócio.</p>
          </div>
          <div className="svc-grid reveal-stagger">
            {services.map((s) => (
              <div key={s.title} className="svc-card">
                <div className="svc-icon"><Icon name={s.icon} size={22} color={BRAND} /></div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── SOBRE / PRINCÍPIOS ── */}
      <Reveal id="sobre" style={{ padding: '96px 0', background: '#F8FAFC' }}>
        <div className="c">
          <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 60px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: BRAND, textTransform: 'uppercase', letterSpacing: '.1em' }}>Institucional</span>
            <h2 style={{ fontSize: 'clamp(24px,3vw,36px)', marginTop: 10, marginBottom: 14 }}>Missão e Visão</h2>
            <p style={{ color: '#475569', fontSize: 16 }}>Com 8 anos de atuação em Francisco Beltrão, a Privilege opera como parceiro estratégico dos negócios dos nossos clientes.</p>
          </div>
          <div className="principle-cols" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div className="principle" style={{ flex: 1, minWidth: 280 }}>
              <h3>🎯 Missão</h3>
              <p>Oferecer serviços com qualidade, responsabilidade e excelência, superando as necessidades e expectativas dos clientes, colaboradores e da sociedade.</p>
            </div>
            <div className="principle" style={{ flex: 1, minWidth: 280 }}>
              <h3>👁️ Visão</h3>
              <p>Ser reconhecido como escritório de referência em contabilidade consultiva e gestão financeira, integrando tecnologia e expertise humana.</p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ── UTILIDADES / CNDs ── */}
      <Reveal id="utilidades">
        <div className="c" style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: BRAND, textTransform: 'uppercase', letterSpacing: '.1em' }}>Central de Utilidades</span>
          <h2 style={{ fontSize: 'clamp(24px,3vw,36px)', marginTop: 10, marginBottom: 14 }}>Acesso Rápido a Certidões e Consultas Fiscais</h2>
          <p style={{ color: '#475569', fontSize: 16, maxWidth: 520, margin: '0 auto' }}>Consulte e emita suas CNDs e certidões diretamente nos portais oficiais, sem intermediários.</p>
          <div className="cnd-grid">
            {cnds.map(({ label, url }) => (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="cnd-btn">
                <span style={{ color: BRAND, display: 'flex' }}><Icon name="ExternalLink" size={14} color={BRAND} /></span>
                {label}
              </a>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── FAQ ── */}
      <Reveal id="faq" style={{ padding: '96px 0', background: '#F8FAFC' }}>
        <div className="c" style={{ maxWidth: 780 }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: BRAND, textTransform: 'uppercase', letterSpacing: '.1em' }}>FAQ</span>
            <h2 style={{ fontSize: 'clamp(24px,3vw,36px)', marginTop: 10 }}>Dúvidas Frequentes</h2>
          </div>
          {faqs.map((f, i) => (
            <div key={i} className="faq-item">
              <div className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)} role="button" tabIndex={0}>
                <span>{f.q}</span>
                <span className={`faq-chevron${openFaq === i ? ' open' : ''}`}><Icon name="ChevronDown" size={18} color="#64748b" /></span>
              </div>
              <div className={`faq-a${openFaq === i ? ' open' : ''}`}>{f.a}</div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ── CONTATO ── */}
      <Reveal id="contato">
        <div className="c">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: BRAND, textTransform: 'uppercase', letterSpacing: '.1em' }}>Diagnóstico Gratuito</span>
            <h2 style={{ fontSize: 'clamp(24px,3vw,38px)', marginTop: 10, marginBottom: 14 }}>Solicite um Diagnóstico Contábil 360°</h2>
            <p style={{ color: '#475569', fontSize: 16, maxWidth: 540, margin: '0 auto' }}>Preencha os dados e nossos consultores entrarão em contato em até 24 horas úteis.</p>
          </div>
          <div className="contact-cols" style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 260 }}>
              <h3 style={{ fontSize: 22, marginBottom: 32 }}>Fale Conosco</h3>
              {[
                { icon: 'MapPin', label: 'Endereço', val: 'Rua Pará, 127, Sala 103 – Centro\nFrancisco Beltrão, PR – CEP 85601-290' },
                { icon: 'Phone', label: 'Telefone', val: '(46) 3035-1018' },
                { icon: 'Mail', label: 'E-mail', val: 'contato@privilegecontabilidade.com.br' },
                { icon: 'Clock', label: 'Horário', val: 'Segunda a Sexta, das 8h às 18h' },
              ].map(({ icon, label, val }) => (
                <div key={label} className="contact-info-item">
                  <div className="ci-icon"><Icon name={icon} size={18} color={BRAND} /></div>
                  <div><div className="ci-label">{label}</div><div className="ci-val" style={{ whiteSpace: 'pre-line' }}>{val}</div></div>
                </div>
              ))}
              <div style={{ marginTop: 32 }}>
                <a href="https://wa.me/554630351061?text=Olá!%20Gostaria%20de%20um%20diagnóstico%20gratuito." target="_blank" rel="noopener" className="btn btn-w" style={{ width: '100%', justifyContent: 'center' }}>
                  <Icon name="WhatsApp" size={16} color="#fff" /> Falar no WhatsApp Agora
                </a>
              </div>
            </div>

            {/* Form */}
            <div className="form-card" style={{ flex: 1.5, minWidth: 320 }}>
              {sent ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                  <h3 style={{ fontSize: 22, marginBottom: 12 }}>Solicitação Enviada!</h3>
                  <p style={{ color: '#475569' }}>Nosso time entrará em contato em até 24h úteis. Fique atento ao seu e-mail e WhatsApp.</p>
                  <button className="btn btn-p" style={{ marginTop: 24 }} onClick={() => setSent(false)}>Nova Solicitação</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <h3 style={{ fontSize: 20, marginBottom: 24 }}>Diagnóstico Contábil Gratuito</h3>
                  <div className="form-grid" style={{ marginBottom: 14 }}>
                    <div className="fg">
                      <label className="fl">Nome Completo *</label>
                      <input className="fi" type="text" placeholder="Seu nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
                    </div>
                    <div className="fg">
                      <label className="fl">E-mail Corporativo *</label>
                      <input className="fi" type="email" placeholder="email@empresa.com.br" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                    </div>
                  </div>
                  <div className="form-grid" style={{ marginBottom: 14 }}>
                    <div className="fg">
                      <label className="fl">WhatsApp / Celular</label>
                      <input className="fi" type="tel" placeholder="(46) 99999-9999" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
                    </div>
                    <div className="fg">
                      <label className="fl">Faixa de Faturamento</label>
                      <select className="fi" value={form.faturamento} onChange={e => setForm(f => ({ ...f, faturamento: e.target.value }))}>
                        <option value="">Selecione...</option>
                        <option>Até R$ 50 mil/mês</option>
                        <option>R$ 50k a R$ 200k/mês</option>
                        <option>R$ 200k a R$ 1M/mês</option>
                        <option>Acima de R$ 1M/mês</option>
                      </select>
                    </div>
                  </div>
                  <div className="fg" style={{ marginBottom: 24 }}>
                    <label className="fl">Qual o seu objetivo principal?</label>
                    <select className="fi" value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}>
                      <option value="">Selecione...</option>
                      <option>Reduzir impostos legalmente</option>
                      <option>Terceirizar meu financeiro (BPO)</option>
                      <option>Trocar de contador</option>
                      <option>Abrir uma empresa</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-p" style={{ width: '100%', padding: '14px', fontSize: 15 }}>
                    Solicitar Diagnóstico Contábil Gratuito →
                  </button>
                  <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 14, marginBottom: 0 }}>🔒 Seus dados são protegidos pela LGPD. Sem spam.</p>
                </form>
              )}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="c">
          <div className="footer-grid">
            <div>
              <div className="logo" style={{ marginBottom: 16, display: 'inline-flex', background: '#ffffff', padding: '6px 12px', borderRadius: '6px' }}>
                <Image src="/logo.png" alt="Privilege Contabilidade e Consultoria" width={150} height={42} style={{ objectFit: 'contain' }} />
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.75, maxWidth: 280, color: '#94A3B8', margin: '0 0 20px' }}>
                Engenharia tributária e contabilidade consultiva para elevar a performance financeira do seu negócio.
              </p>
              <a href="https://wa.me/554630351061" target="_blank" rel="noopener" className="btn btn-p" style={{ fontSize: 13, padding: '8px 16px' }}>
                <Icon name="WhatsApp" size={14} color="#fff" /> (46) 3035-1061
              </a>
            </div>
            <div>
              <h4>Soluções</h4>
              {['Abertura de Empresas', 'Escrituração Fiscal', 'Folha de Pagamento', 'BPO Financeiro', 'Consultoria Tributária'].map(s => (
                <a key={s} href="#solucoes" className="fl-link">{s}</a>
              ))}
            </div>
            <div>
              <h4>Utilidades</h4>
              {cnds.slice(0, 4).map(({ label, url }) => (
                <a key={label} href={url} target="_blank" rel="noopener" className="fl-link">{label}</a>
              ))}
            </div>
            <div>
              <h4>Empresa</h4>
              <a href="#sobre" className="fl-link">Sobre a Privilege</a>
              <a href="#faq" className="fl-link">FAQ</a>
              <a href="#contato" className="fl-link">Contato</a>
              <Link href="/login" className="fl-link">Portal do Cliente</Link>
              <button className="fl-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Inter,sans-serif' }} onClick={() => setActiveLegal('termos')}>Termos de Uso</button>
              <button className="fl-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Inter,sans-serif' }} onClick={() => setActiveLegal('privacidade')}>Privacidade & LGPD</button>
            </div>
          </div>
          <hr className="footer-divider" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 13 }}>© 2026 Privilege Contabilidade e Consultoria. Todos os direitos reservados.</span>
            <span style={{ fontSize: 13 }}>Rua Pará, 127, Sala 103 – Francisco Beltrão, PR</span>
          </div>
        </div>
      </footer>

      {/* ── LEGAL MODAL ── */}
      <div className={`modal-bg${activeLegal ? ' on' : ''}`} onClick={() => setActiveLegal(null)}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
          {activeLegal && legalDocs[activeLegal] && (
            <>
              <h3 style={{ fontSize: 22, marginBottom: 6 }}>{legalDocs[activeLegal].title}</h3>
              <div style={{ fontSize: 12, color: BRAND, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 20 }}>{legalDocs[activeLegal].subtitle}</div>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: '#334155' }}>{legalDocs[activeLegal].content}</p>
              <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-o" onClick={() => setActiveLegal(null)}>Fechar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
