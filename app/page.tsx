'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Instrument_Serif, Inter } from 'next/font/google';
import {
  Building2, FileText, Users, TrendingUp, CircleDollarSign, ShieldCheck,
  BarChart2, PieChart, Scale, Landmark, type LucideIcon,
} from 'lucide-react';
import { store } from '../lib/store';
import { services, cnds, integrations, faqs, legalDocs } from './pageData';

// Mapa string→componente: pageData guarda só o nome (serializável, sem JSX),
// o mapeamento pro ícone real fica aqui, perto de quem renderiza.
const SERVICE_ICONS: Record<string, LucideIcon> = {
  Building: Building2, FileText, Users, TrendingUp, DollarSign: CircleDollarSign,
  Shield: ShieldCheck, BarChart2, PieChart, Scale, Landmark,
};

// Serifada de alto contraste no display — o registro editorial/institucional que
// distingue escritório estabelecido de template de startup.
const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'] });
const sans = Inter({ subsets: ['latin'], weight: ['400', '500', '600'] });

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Observa a entrada em tela e marca `.in` — dispara toda a coreografia via CSS. */
function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced()) { el.classList.add('in'); return; }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('in'); obs.unobserve(el); } },
      { threshold, rootMargin: '0px 0px -60px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return ref;
}

function Reveal({
  children, id, className = '', style = {},
}: { children: React.ReactNode; id?: string; className?: string; style?: React.CSSProperties }) {
  const ref = useInView<HTMLElement>();
  return (
    <section ref={ref} id={id} className={`rv ${className}`} style={style}>{children}</section>
  );
}

/**
 * Título com revelação por linha: cada linha vive dentro de uma máscara e sobe
 * do próprio recorte, em cascata. É o gesto que carrega a página inteira.
 */
function Lines({ children, className = '' }: { children: React.ReactNode[]; className?: string }) {
  return (
    <span className={`lines ${className}`}>
      {children.map((l, i) => (
        <span className="line" key={i}><span style={{ transitionDelay: `${60 + i * 90}ms` }}>{l}</span></span>
      ))}
    </span>
  );
}

/** Deslocamento suave ligado ao scroll — sutil, apenas o suficiente para dar profundidade. */
function useParallax<T extends HTMLElement>(strength = 46) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (reduced()) return;
    let raf = 0;
    const run = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.bottom < -200 || r.top > vh + 200) return;
      const p = (r.top + r.height / 2 - vh / 2) / vh;
      el.style.setProperty('--py', `${(-p * strength).toFixed(1)}px`);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(run); };
    run();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [strength]);
  return ref;
}

function SectionMark({ n, label }: { n: string; label: string }) {
  return (
    <div className="mark">
      <span className="mark-n">{n}</span>
      <span className="mark-rule" />
      <span className="mark-l">{label}</span>
    </div>
  );
}

const CONTATO = {
  endereco: 'Rua Pará, 127 — Sala 103, Centro',
  cidade: 'Francisco Beltrão, PR — CEP 85601-290',
  telefone: '(46) 3035-1018',
  // 55 (Brasil) + 46 (DDD) + 30351061 — sem espaços ou pontuação, como a wa.me exige.
  whatsapp: '554630351061',
  whatsappLabel: '(46) 3035-1061',
  email: 'contato@privilegecontabilidade.com.br',
  horario: 'Segunda a sexta, das 8h às 18h',
};

const METODO = [
  { n: '01', t: 'Diagnóstico', d: 'Uma conversa de 30 minutos para entender regime, volume e onde a informação hoje se perde. Sem compromisso.' },
  { n: '02', t: 'Organização', d: 'Nosso time recebe e organiza toda a documentação anterior. Você não precisa preparar nada antes de começar.' },
  { n: '03', t: 'Transição', d: 'Acompanhamento dedicado por 90 dias. A migração ocorre sem interromper nenhuma obrigação fiscal em curso.' },
];

export default function Home() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeLegal, setActiveLegal] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState({ nome: '', email: '', whatsapp: '', faturamento: '', objetivo: '' });
  const [sent, setSent] = useState(false);

  const heroRef = useInView<HTMLElement>(0.01);
  const bandRef = useParallax<HTMLDivElement>(64);

  useEffect(() => {
    let raf = 0;
    const run = () => {
      raf = 0;
      setScrolled(window.scrollY > 24);
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? Math.min(1, window.scrollY / h) : 0);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(run); };
    run();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // Usuário logado vai ao portal — sem bloquear a renderização. Retornar null
  // enquanto verificava fazia o site institucional chegar vazio ao Google e às
  // prévias de link (o HTML do servidor não continha conteúdo algum).
  useEffect(() => {
    const user = store.getCurrentUser();
    if (user) router.replace(user.role === 'cliente' ? '/cliente/dashboard' : '/consultor/dashboard');
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.email) return;
    setSent(true);
  };

  const navLinks = [
    { href: '#atuacao', label: 'Atuação' },
    { href: '#metodo', label: 'Método' },
    { href: '#escritorio', label: 'Escritório' },
    { href: '#utilidades', label: 'Utilidades' },
    { href: '#faq', label: 'Perguntas' },
  ];

  return (
    <div className={`lp ${sans.className}`}>
      <style>{`
        .lp{
          --ink:#14110F; --ink-soft:#4A443E; --muted:#7C746B;
          --bone:#F6F3EE; --bone-deep:#EDE8E0; --paper:#FFFFFF;
          --wine:#600000; --wine-deep:#3B0000; --gold:#A98B5D;
          --rule:rgba(20,17,15,.14); --rule-soft:rgba(20,17,15,.08);
          --ease:cubic-bezier(.16,1,.3,1);
          color:var(--ink-soft); background:var(--bone);
          overflow-x:hidden; -webkit-font-smoothing:antialiased;
        }
        .lp *{box-sizing:border-box;margin:0;padding:0;}
        .lp ::selection{background:var(--wine);color:#fff;}
        .lp .serif{font-family:${display.style.fontFamily};font-weight:400;}
        .lp h1,.lp h2,.lp h3{font-family:${display.style.fontFamily};font-weight:400;color:var(--ink);line-height:1.04;letter-spacing:-.015em;}
        .lp .c{width:100%;max-width:1180px;margin:0 auto;padding:0 32px;}
        .lp .c-narrow{max-width:820px;}

        /* ── Grão de papel: textura analógica muito sutil sobre tudo ── */
        .lp .grain{position:fixed;inset:0;z-index:1000;pointer-events:none;opacity:.032;mix-blend-mode:multiply;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");}

        /* ── Barra de progresso de leitura ── */
        .lp .prog{position:fixed;top:0;left:0;height:2px;background:var(--wine);z-index:1001;transition:width .1s linear;}

        /* ── Coreografia base ── */
        .lp .rv .anim{opacity:0;transform:translateY(20px);transition:opacity .9s var(--ease),transform .9s var(--ease);}
        .lp .rv.in .anim{opacity:1;transform:none;}
        .lp .rv .anim:nth-child(2){transition-delay:.08s}
        .lp .rv .anim:nth-child(3){transition-delay:.16s}

        /* Revelação por linha — a máscara é o que dá o ar caro */
        .lp .lines{display:block;}
        .lp .line{display:block;overflow:hidden;padding-bottom:.06em;margin-bottom:-.06em;}
        .lp .line>span{display:block;transform:translateY(112%);transition:transform 1.05s var(--ease);}
        .lp .in .line>span,.lp.ready .hero.in .line>span{transform:none;}

        /* Filete que se desenha */
        .lp .draw{transform:scaleX(0);transform-origin:left;transition:transform 1.1s var(--ease);}
        .lp .in .draw{transform:scaleX(1);}

        /* ── Marcador de seção ── */
        .lp .mark{display:flex;align-items:center;gap:14px;margin-bottom:36px;}
        .lp .mark-n{font-size:11px;font-weight:500;letter-spacing:.18em;color:var(--wine);font-variant-numeric:tabular-nums;}
        .lp .mark-rule{width:34px;height:1px;background:var(--rule);transform:scaleX(0);transform-origin:left;transition:transform .9s var(--ease) .1s;}
        .lp .in .mark-rule{transform:scaleX(1);}
        .lp .mark-l{font-size:11px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);}

        /* ── Faixa institucional ── */
        .lp .strip{background:var(--ink);color:rgba(255,255,255,.62);font-size:11.5px;letter-spacing:.03em;}
        .lp .strip .c{height:38px;display:flex;align-items:center;justify-content:space-between;gap:16px;}
        .lp .strip a{color:rgba(255,255,255,.62);text-decoration:none;transition:color .25s;}
        .lp .strip a:hover{color:#fff;}
        .lp .strip-sep{color:rgba(255,255,255,.24);margin:0 10px;}

        /* ── Navegação ── */
        .lp .nb{position:sticky;top:0;z-index:900;background:rgba(246,243,238,.86);backdrop-filter:saturate(1.4) blur(8px);border-bottom:1px solid transparent;transition:border-color .4s,box-shadow .4s;}
        .lp .nb.s{border-bottom-color:var(--rule-soft);box-shadow:0 1px 30px rgba(20,17,15,.05);}
        .lp .nb .c{height:78px;display:flex;align-items:center;justify-content:space-between;gap:24px;}
        .lp .nav-links{display:flex;align-items:center;gap:34px;}
        /* Hover com troca mascarada: o rótulo sobe e o clone entra por baixo */
        .lp .nav-a{position:relative;display:inline-block;overflow:hidden;height:1.35em;font-size:13.5px;font-weight:500;color:var(--ink-soft);text-decoration:none;}
        .lp .nav-a i{display:block;font-style:normal;transition:transform .55s var(--ease);}
        .lp .nav-a i:last-child{position:absolute;top:0;left:0;transform:translateY(100%);color:var(--wine);}
        .lp .nav-a:hover i{transform:translateY(-100%);}
        .lp .nav-right{display:flex;align-items:center;gap:22px;}

        /* ── Botões ── */
        .lp .btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:13px 26px;font-size:13.5px;font-weight:500;border-radius:2px;cursor:pointer;text-decoration:none;border:1px solid transparent;overflow:hidden;transition:color .4s,border-color .4s;}
        /* Preenchimento que sobe a partir da base, em vez de troca seca de cor */
        .lp .btn::before{content:'';position:absolute;inset:0;background:var(--wine-deep);transform:translateY(101%);transition:transform .55s var(--ease);z-index:0;}
        .lp .btn:hover::before{transform:none;}
        .lp .btn>*{position:relative;z-index:1;}
        .lp .btn-p{background:var(--wine);color:#fff;}
        .lp .btn-o{background:transparent;color:var(--ink);border-color:var(--rule);}
        .lp .btn-o:hover{color:#fff;border-color:var(--wine-deep);}
        .lp .btn-lg{padding:17px 34px;font-size:14px;}
        .lp .btn .arw{display:inline-block;transition:transform .5s var(--ease);}
        .lp .btn:hover .arw{transform:translateX(5px);}
        .lp .lk{position:relative;font-size:13.5px;font-weight:500;color:var(--ink);text-decoration:none;padding-bottom:4px;}
        .lp .lk::after{content:'';position:absolute;left:0;bottom:0;width:100%;height:1px;background:var(--rule);}
        .lp .lk::before{content:'';position:absolute;left:0;bottom:0;width:100%;height:1px;background:var(--wine);transform:scaleX(0);transform-origin:right;transition:transform .55s var(--ease);z-index:1;}
        .lp .lk:hover::before{transform:scaleX(1);transform-origin:left;}

        /* ── Abertura ── */
        .lp .hero{padding:96px 0 84px;position:relative;}
        .lp .hero-grid{display:grid;grid-template-columns:1.35fr .85fr;gap:72px;align-items:start;}
        .lp .eyebrow{font-size:11px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:30px;display:block;}
        .lp .hero h1{font-size:clamp(52px,8.4vw,118px);margin-bottom:34px;letter-spacing:-.025em;}
        .lp .hero h1 em{font-style:italic;color:var(--wine);}
        .lp .hero-lead{font-size:17px;line-height:1.72;color:var(--ink-soft);max-width:50ch;margin-bottom:44px;}
        .lp .hero-ctas{display:flex;align-items:center;gap:28px;flex-wrap:wrap;}

        /* Ficha técnica com entrada em cascata */
        .lp .ficha{border-top:1px solid var(--ink);padding-top:20px;}
        .lp .ficha-row{display:flex;justify-content:space-between;align-items:baseline;gap:20px;padding:15px 0;border-bottom:1px solid var(--rule-soft);
          opacity:0;transform:translateY(16px);transition:opacity .8s var(--ease),transform .8s var(--ease);}
        .lp .in .ficha-row{opacity:1;transform:none;}
        .lp .in .ficha-row:nth-child(1){transition-delay:.30s}
        .lp .in .ficha-row:nth-child(2){transition-delay:.38s}
        .lp .in .ficha-row:nth-child(3){transition-delay:.46s}
        .lp .in .ficha-row:nth-child(4){transition-delay:.54s}
        .lp .in .ficha-row:nth-child(5){transition-delay:.62s}
        .lp .ficha-k{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);}
        .lp .ficha-v{font-size:14.5px;color:var(--ink);text-align:right;font-weight:500;}
        .lp .ficha-v .serif{font-size:21px;}

        /* Convite a rolar */
        .lp .cue{display:flex;align-items:center;gap:12px;margin-top:76px;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);}
        .lp .cue-line{width:54px;height:1px;background:var(--rule);position:relative;overflow:hidden;}
        .lp .cue-line::after{content:'';position:absolute;inset:0;background:var(--wine);transform:translateX(-100%);animation:cue 2.6s var(--ease) infinite;}
        @keyframes cue{0%{transform:translateX(-100%)}55%{transform:translateX(100%)}100%{transform:translateX(100%)}}

        /* ── Seções ── */
        .lp .sec{padding:112px 0;}
        .lp .sec-bone{background:var(--bone-deep);}
        .lp .sec-paper{background:var(--paper);}
        .lp .sec-head{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:end;margin-bottom:64px;}
        .lp .sec-head h2{font-size:clamp(36px,5.4vw,72px);letter-spacing:-.022em;}
        .lp .sec-head p{font-size:16px;line-height:1.72;color:var(--ink-soft);}

        /* ── Áreas de atuação ── */
        .lp .pract{border-top:1px solid var(--rule);}
        .lp .pract-row{display:grid;grid-template-columns:40px 42px 1fr 1.15fr;gap:22px;align-items:center;padding:24px 4px;border-bottom:1px solid var(--rule-soft);position:relative;
          opacity:0;transform:translateY(18px);transition:opacity .75s var(--ease),transform .75s var(--ease),background .4s,padding-left .5s var(--ease);}
        .lp .in .pract-row{opacity:1;transform:none;}
        /* Faixa bordô que varre a linha da esquerda para a direita no hover */
        .lp .pract-row::before{content:'';position:absolute;inset:0;background:rgba(96,0,0,.04);transform:scaleX(0);transform-origin:left;transition:transform .6s var(--ease);z-index:0;}
        .lp .pract-row:hover::before{transform:scaleX(1);}
        .lp .pract-row:hover{padding-left:18px;}
        .lp .pract-row>*{position:relative;z-index:1;}
        .lp .pract-ic{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:var(--bone-deep);color:var(--wine);flex-shrink:0;transition:background .4s,color .4s,transform .4s var(--ease);align-self:center;}
        .lp .pract-row:hover .pract-ic{background:var(--wine);color:#fff;transform:scale(1.06);}
        .lp .pract-n{font-size:11px;letter-spacing:.14em;color:var(--muted);font-variant-numeric:tabular-nums;transition:color .4s;align-self:baseline;}
        .lp .pract-row:hover .pract-n{color:var(--wine);}
        .lp .pract-t{font-size:19px;color:var(--ink);font-family:${display.style.fontFamily};line-height:1.2;align-self:baseline;}
        .lp .pract-d{font-size:14.5px;line-height:1.68;color:var(--ink-soft);align-self:baseline;}

        /* ── Método: seção invertida, dá respiro e contraste ao percurso ──
           Vem logo depois da faixa de foto (também escura) — usar um bordô
           bem profundo em vez do mesmo preto evita o efeito de "dois pretos
           empilhados" e mantém a seção ligada à cor da marca. */
        .lp .sec-dark{background:linear-gradient(165deg,var(--wine-deep) 0%,var(--ink) 62%);color:rgba(255,255,255,.62);border-top:1px solid rgba(169,139,93,.28);}
        .lp .sec-dark h2,.lp .sec-dark h3{color:#fff;}
        .lp .sec-dark .sec-head p{color:rgba(255,255,255,.62);}
        .lp .sec-dark .mark-l{color:rgba(255,255,255,.44);}
        .lp .sec-dark .mark-n{color:var(--gold);}
        .lp .sec-dark .mark-rule{background:rgba(255,255,255,.2);}
        .lp .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:52px;}
        .lp .step{border-top:1px solid rgba(255,255,255,.22);padding-top:24px;
          opacity:0;transform:translateY(22px);transition:opacity .85s var(--ease),transform .85s var(--ease);}
        .lp .in .step{opacity:1;transform:none;}
        .lp .in .step:nth-child(2){transition-delay:.13s}
        .lp .in .step:nth-child(3){transition-delay:.26s}
        .lp .step-n{font-family:${display.style.fontFamily};font-size:44px;color:var(--gold);line-height:1;margin-bottom:18px;}
        .lp .step h3{font-size:22px;margin-bottom:13px;}
        .lp .step p{font-size:14.5px;line-height:1.72;color:rgba(255,255,255,.6);}

        /* ── Escritório ── */
        .lp .about-grid{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center;}
        .lp .quote{font-family:${display.style.fontFamily};font-size:clamp(25px,2.8vw,34px);line-height:1.32;color:var(--ink);}
        .lp .princ{border-left:2px solid var(--wine);padding-left:26px;margin-bottom:36px;}
        .lp .princ-k{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--wine);margin-bottom:10px;}
        .lp .princ p{font-size:15.5px;line-height:1.74;color:var(--ink-soft);}
        .lp .photo-cap{margin-top:14px;font-size:12px;color:var(--muted);letter-spacing:.02em;display:flex;gap:10px;align-items:center;}
        .lp .photo-cap span{width:20px;height:1px;background:var(--rule);}

        /* ── Mapa: dessaturado para conversar com a paleta, ganha cor no hover ── */
        .lp .map-frame{position:relative;overflow:hidden;border:1px solid var(--rule);height:clamp(330px,44vw,470px);background:var(--bone-deep);
          clip-path:inset(0 0 100% 0);transition:clip-path 1.3s var(--ease);}
        .lp .in .map-frame{clip-path:inset(0 0 0 0);}
        .lp .map-frame iframe{width:100%;height:100%;border:0;display:block;filter:grayscale(1) contrast(1.06) opacity(.92);transition:filter 1s var(--ease);}
        .lp .map-frame:hover iframe{filter:none;}
        .lp .map-foot{display:flex;justify-content:space-between;align-items:baseline;gap:18px;flex-wrap:wrap;margin-top:14px;}

        /* ── Faixa de imagem em largura total: a foto real ganha escala de capa ── */
        .lp .band{position:relative;height:clamp(340px,50vw,560px);overflow:hidden;background:var(--ink);}
        .lp .band-img{position:absolute;inset:-8% 0;}
        .lp .band-img img{width:100%;height:100%;object-fit:cover;object-position:center 38%;
          filter:grayscale(1) contrast(1.2) brightness(.62);transform:translateY(var(--py,0px)) scale(1.06);will-change:transform;}
        /* Duotone bordô — tinge a foto na cor da marca em vez de deixá-la crua */
        .lp .band::after{content:'';position:absolute;inset:0;background:linear-gradient(175deg,rgba(96,0,0,.72) 0%,rgba(20,17,15,.86) 100%);mix-blend-mode:multiply;}
        .lp .band-txt{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;justify-content:flex-end;padding:clamp(28px,5vw,64px) 0;}
        .lp .band-txt .c{width:100%;}
        .lp .band-k{font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:18px;}
        .lp .band-h{font-family:${display.style.fontFamily};font-size:clamp(30px,5.6vw,74px);line-height:1.02;color:#fff;letter-spacing:-.02em;}
        .lp .band-h em{font-style:italic;color:var(--gold);}
        .lp .band-meta{display:flex;gap:clamp(20px,4vw,56px);flex-wrap:wrap;margin-top:30px;padding-top:24px;border-top:1px solid rgba(255,255,255,.2);}
        .lp .band-meta div{color:rgba(255,255,255,.72);font-size:13px;letter-spacing:.04em;}
        .lp .band-meta b{display:block;font-family:${display.style.fontFamily};font-size:26px;color:#fff;font-weight:400;margin-bottom:3px;}

        /* ── CTA intermediário: bordô sólido, terceiro ponto de contraste
           sem repetir o preto do band/método ── */
        .lp .cta-mid{background:var(--wine);padding:56px 0;}
        .lp .cta-mid-box{display:flex;align-items:center;justify-content:space-between;gap:28px;flex-wrap:wrap;}
        .lp .cta-mid-box p{font-size:clamp(21px,2.6vw,30px);color:#fff;line-height:1.28;max-width:44ch;}
        .lp .cta-mid .btn-p{background:#fff;color:var(--wine);flex-shrink:0;}
        .lp .cta-mid .btn-p::before{background:var(--ink);}
        .lp .cta-mid .btn-p:hover{color:#fff;}
        @media (max-width:760px){ .lp .cta-mid-box{gap:22px;} }

        /* ── Declaração tipográfica: o respiro grande entre blocos densos ── */
        .lp .statement{padding:clamp(90px,13vw,170px) 0;background:var(--bone-deep);}
        .lp .statement p{font-family:${display.style.fontFamily};font-size:clamp(30px,6vw,86px);line-height:1.06;color:var(--ink);letter-spacing:-.025em;}
        .lp .statement em{font-style:italic;color:var(--wine);}
        .lp .statement .sig{margin-top:44px;display:flex;align-items:center;gap:16px;font-family:${sans.style.fontFamily};font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);}
        .lp .statement .sig span{width:46px;height:1px;background:var(--rule);}

        /* ── Integrações: letreiro contínuo ── */
        .lp .marquee{overflow:hidden;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:36px 0;
          -webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);}
        .lp .marquee-track{display:flex;width:max-content;animation:slide 26s linear infinite;}
        .lp .marquee-i{display:flex;align-items:center;gap:54px;padding-right:54px;font-family:${display.style.fontFamily};font-size:clamp(30px,3.6vw,44px);color:var(--ink);white-space:nowrap;}
        .lp .marquee-i>span{display:inline-flex;align-items:flex-start;gap:12px;}
        .lp .marquee-i b{font-family:${sans.style.fontFamily};font-size:9.5px;font-weight:500;letter-spacing:.2em;color:var(--wine);margin-top:9px;}
        /* Ponto na cor real de cada marca — dá identidade sem depender de logos oficiais */
        .lp .marquee-dot{width:8px;height:8px;border-radius:50%;align-self:center;flex-shrink:0;box-shadow:0 0 0 3px rgba(20,17,15,.05);}
        /* Losango separador entre os nomes */
        .lp .marquee-i>span::after{content:'';width:5px;height:5px;background:var(--gold);transform:rotate(45deg);align-self:center;margin-left:42px;}
        @keyframes slide{to{transform:translateX(-50%)}}

        /* ── Utilidades ── */
        .lp .cnd-list{border-top:1px solid var(--rule);}
        .lp .cnd-row{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:22px 4px;border-bottom:1px solid var(--rule-soft);text-decoration:none;color:var(--ink);font-size:15.5px;position:relative;
          opacity:0;transform:translateY(14px);transition:opacity .7s var(--ease),transform .7s var(--ease),padding-left .5s var(--ease),color .35s;}
        .lp .in .cnd-row{opacity:1;transform:none;}
        .lp .in .cnd-row:nth-child(2){transition-delay:.06s}
        .lp .in .cnd-row:nth-child(3){transition-delay:.12s}
        .lp .in .cnd-row:nth-child(4){transition-delay:.18s}
        .lp .in .cnd-row:nth-child(5){transition-delay:.24s}
        .lp .in .cnd-row:nth-child(6){transition-delay:.30s}
        .lp .cnd-row:hover{padding-left:18px;color:var(--wine);}
        .lp .cnd-arrow{font-size:15px;color:var(--muted);transition:transform .5s var(--ease),color .35s;}
        .lp .cnd-row:hover .cnd-arrow{transform:translate(6px,-6px);color:var(--wine);}

        /* ── Perguntas ── */
        .lp .faq-item{border-bottom:1px solid var(--rule-soft);}
        .lp .faq-item:first-of-type{border-top:1px solid var(--rule);}
        .lp .faq-q{display:flex;justify-content:space-between;align-items:baseline;gap:28px;padding:26px 4px;cursor:pointer;font-size:17.5px;color:var(--ink);font-family:${display.style.fontFamily};line-height:1.3;transition:color .35s,padding-left .5s var(--ease);}
        .lp .faq-q:hover{color:var(--wine);padding-left:10px;}
        .lp .faq-sign{position:relative;width:13px;height:13px;flex-shrink:0;align-self:center;}
        .lp .faq-sign::before,.lp .faq-sign::after{content:'';position:absolute;background:var(--muted);transition:transform .5s var(--ease),background .35s;}
        .lp .faq-sign::before{left:0;top:6px;width:13px;height:1px;}
        .lp .faq-sign::after{left:6px;top:0;width:1px;height:13px;}
        .lp .faq-sign.on::after{transform:rotate(90deg);}
        .lp .faq-sign.on::before,.lp .faq-sign.on::after{background:var(--wine);}
        .lp .faq-a{display:grid;grid-template-rows:0fr;transition:grid-template-rows .55s var(--ease);}
        .lp .faq-a.on{grid-template-rows:1fr;}
        .lp .faq-a>div{overflow:hidden;}
        .lp .faq-a p{font-size:15px;line-height:1.78;color:var(--ink-soft);padding:0 60px 28px 4px;max-width:78ch;opacity:0;transition:opacity .5s var(--ease) .12s;}
        .lp .faq-a.on p{opacity:1;}

        /* ── Contato ── */
        .lp .contact-grid{display:grid;grid-template-columns:.85fr 1.15fr;gap:72px;align-items:start;}
        .lp .ci{padding:18px 0;border-bottom:1px solid var(--rule-soft);}
        .lp .ci:first-of-type{border-top:1px solid var(--rule);}
        .lp .ci-k{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:7px;}
        .lp .ci-v{font-size:15.5px;color:var(--ink);line-height:1.6;white-space:pre-line;}
        .lp .ci-v a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--rule);transition:border-color .35s;}
        .lp .ci-v a:hover{border-bottom-color:var(--wine);}
        .lp .form-panel{background:var(--paper);border:1px solid var(--rule-soft);padding:48px;}
        .lp .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;}
        .lp .fg{display:flex;flex-direction:column;gap:9px;margin-bottom:22px;position:relative;}
        .lp .fl{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);transition:color .35s;}
        .lp .fg:focus-within .fl{color:var(--wine);}
        .lp .fi{width:100%;padding:11px 0;font-family:inherit;font-size:15px;color:var(--ink);background:transparent;border:none;border-bottom:1px solid var(--rule);border-radius:0;outline:none;}
        .lp .fi::placeholder{color:#B7AFA5;}
        /* Sublinhado que cresce do centro no foco */
        .lp .fg::after{content:'';position:absolute;left:0;bottom:0;width:100%;height:1px;background:var(--wine);transform:scaleX(0);transition:transform .5s var(--ease);}
        .lp .fg:focus-within::after{transform:scaleX(1);}
        .lp select.fi{cursor:pointer;}
        .lp .form-note{font-size:12px;color:var(--muted);margin-top:18px;line-height:1.6;}

        /* ── Rodapé ── */
        .lp .footer{background:var(--ink);color:rgba(255,255,255,.56);padding:82px 0 32px;}
        .lp .footer h4{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.42);margin-bottom:20px;font-family:inherit;font-weight:500;}
        .lp .footer-grid{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:56px;padding-bottom:56px;}
        .lp .fl-link{display:block;font-size:13.5px;color:rgba(255,255,255,.56);text-decoration:none;margin-bottom:12px;transition:color .3s,transform .4s var(--ease);text-align:left;}
        .lp .fl-link:hover{color:#fff;transform:translateX(4px);}
        .lp .footer-rule{height:1px;background:rgba(255,255,255,.1);margin-bottom:28px;}
        .lp .footer-base{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:12.5px;color:rgba(255,255,255,.4);}

        /* ── Modal ── */
        .lp .modal-bg{position:fixed;inset:0;background:rgba(20,17,15,.62);display:flex;align-items:center;justify-content:center;padding:24px;z-index:1200;opacity:0;pointer-events:none;transition:opacity .4s;}
        .lp .modal-bg.on{opacity:1;pointer-events:auto;}
        .lp .modal-box{background:var(--paper);max-width:660px;width:100%;padding:52px;max-height:84vh;overflow-y:auto;transform:translateY(16px) scale(.98);transition:transform .5s var(--ease);}
        .lp .modal-bg.on .modal-box{transform:none;}

        /* ── Menu móvel ── */
        .lp .ham{display:none;background:none;border:none;cursor:pointer;padding:6px;}
        .lp .mob{display:none;flex-direction:column;background:var(--bone);border-bottom:1px solid var(--rule-soft);padding:0 32px;max-height:0;overflow:hidden;transition:max-height .55s var(--ease);position:sticky;top:78px;z-index:899;}
        .lp .mob.on{max-height:440px;padding:12px 32px 28px;}
        .lp .mob a{padding:15px 0;border-bottom:1px solid var(--rule-soft);font-size:15px;color:var(--ink);text-decoration:none;}

        @media (max-width:1000px){
          .lp .hero-grid,.lp .sec-head,.lp .about-grid,.lp .contact-grid{grid-template-columns:1fr;gap:44px;}
          .lp .sec-head{align-items:start;}
          .lp .steps{grid-template-columns:1fr;gap:38px;}
          .lp .pract-row{grid-template-columns:34px 28px 1fr;gap:14px;row-gap:8px;}
          .lp .pract-d{grid-column:3;}
          .lp .pract-ic{width:34px;height:34px;}
        }
        @media (max-width:760px){
          .lp .c{padding:0 22px;}
          .lp .nav-links,.lp .nav-right .lk{display:none;}
          .lp .ham,.lp .mob{display:flex;}
          .lp .hero{padding:60px 0 56px;}
          .lp .sec{padding:76px 0;}
          .lp .cue{margin-top:48px;}
          .lp .form-panel{padding:30px 24px;}
          .lp .form-grid{grid-template-columns:1fr;gap:0;}
          .lp .footer-grid{grid-template-columns:1fr 1fr;gap:36px;}
          .lp .modal-box{padding:32px 24px;}
          .lp .strip .c{justify-content:center;}
          .lp .strip-hide{display:none;}
          .lp .faq-a p{padding-right:4px;}
          .lp .marquee-i{font-size:22px;gap:32px;padding-right:32px;}
          .lp .band{height:clamp(300px,72vw,420px);}
          .lp .band-meta{gap:22px;margin-top:22px;padding-top:18px;}
          .lp .band-meta b{font-size:21px;}
        }
        @media (prefers-reduced-motion:reduce){
          .lp *{animation-duration:.01ms !important;transition-duration:.01ms !important;}
          .lp .map-frame{clip-path:none;}
          .lp .band-img img{transform:none;}
          /* Exceção deliberada: o letreiro de parceiros roda sempre, por decisão
             do cliente. Sem isto, a regra acima zeraria a duração e ele ficaria
             congelado em quem usa o Windows com efeitos de animação desligados. */
          .lp .marquee-track{animation-duration:26s !important;}
        }
      `}</style>

      <div className="grain" aria-hidden="true" />
      <div className="prog" style={{ width: `${progress * 100}%` }} aria-hidden="true" />

      {/* ── FAIXA INSTITUCIONAL ── */}
      <div className="strip">
        <div className="c">
          <span>Francisco Beltrão, Paraná <span className="strip-sep">·</span> Contabilidade consultiva desde 2018</span>
          <span className="strip-hide">
            <a href={`tel:+55${CONTATO.telefone.replace(/\D/g, '')}`}>{CONTATO.telefone}</a>
            <span className="strip-sep">·</span>
            <a href={`mailto:${CONTATO.email}`}>{CONTATO.email}</a>
          </span>
        </div>
      </div>

      {/* ── NAVEGAÇÃO ── */}
      <nav className={`nb${scrolled ? ' s' : ''}`}>
        <div className="c">
          <Link href="/" aria-label="Privilege Contabilidade e Consultoria" style={{ display: 'flex', alignItems: 'center' }}>
            <Image src="/logo.png" alt="Privilege Contabilidade e Consultoria" width={168} height={46} style={{ objectFit: 'contain' }} priority />
          </Link>
          <div className="nav-links">
            {navLinks.map(n => (
              <a key={n.href} href={n.href} className="nav-a"><i>{n.label}</i><i aria-hidden="true">{n.label}</i></a>
            ))}
          </div>
          <div className="nav-right">
            <Link href="/login" className="lk">Portal do cliente</Link>
            <a href="#contato" className="btn btn-p"><span>Agendar diagnóstico</span></a>
            <button className="ham" onClick={() => setMobileOpen(o => !o)} aria-label="Abrir menu" aria-expanded={mobileOpen}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#14110F" strokeWidth={1.5} strokeLinecap="round">
                {mobileOpen
                  ? <><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></>
                  : <><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="17" x2="21" y2="17" /></>}
              </svg>
            </button>
          </div>
        </div>
      </nav>
      <div className={`mob${mobileOpen ? ' on' : ''}`}>
        {navLinks.map(n => <a key={n.href} href={n.href} onClick={() => setMobileOpen(false)}>{n.label}</a>)}
        <a href="#contato" onClick={() => setMobileOpen(false)}>Contato</a>
        <Link href="/login" onClick={() => setMobileOpen(false)}>Portal do cliente</Link>
      </div>

      {/* ── ABERTURA ── */}
      <section className="hero rv" ref={heroRef}>
        <div className="c">
          <div className="hero-grid">
            <div>
              <span className="eyebrow anim">Contabilidade consultiva &amp; BPO financeiro</span>
              <h1>
                <Lines>{[
                  <>Números que sustentam</>,
                  <>uma <em>decisão</em>, não apenas</>,
                  <>uma obrigação.</>,
                ]}</Lines>
              </h1>
              <p className="hero-lead anim" style={{ transitionDelay: '.42s' }}>
                Há oito anos em Francisco Beltrão, conduzimos a rotina fiscal, a folha e o financeiro
                de empresas que precisam enxergar o próprio resultado antes de decidir — com a
                escrituração em dia como consequência, não como entrega final.
              </p>
              <div className="hero-ctas anim" style={{ transitionDelay: '.52s' }}>
                <a href="#contato" className="btn btn-p btn-lg"><span>Agendar diagnóstico</span><span className="arw">&rarr;</span></a>
                <a href="#atuacao" className="lk">Ver áreas de atuação</a>
              </div>
              <div className="cue anim" style={{ transitionDelay: '.66s' }}>
                <span className="cue-line" />Role para conhecer
              </div>
            </div>

            <div>
              <div className="ficha">
                <div className="ficha-row">
                  <span className="ficha-k">Sede</span>
                  <span className="ficha-v">Francisco Beltrão<br />Paraná</span>
                </div>
                <div className="ficha-row">
                  <span className="ficha-k">Atuação desde</span>
                  <span className="ficha-v"><span className="serif">2018</span></span>
                </div>
                <div className="ficha-row">
                  <span className="ficha-k">Regimes</span>
                  <span className="ficha-v">Simples Nacional<br />Presumido e Real</span>
                </div>
                <div className="ficha-row">
                  <span className="ficha-k">Frentes</span>
                  <span className="ficha-v"><span className="serif">{services.length}</span> áreas de atuação</span>
                </div>
                <div className="ficha-row" style={{ borderBottom: 'none' }}>
                  <span className="ficha-k">Portal próprio</span>
                  <span className="ficha-v">Lançamentos, OFX<br />e relatórios</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ÁREAS DE ATUAÇÃO ── */}
      <Reveal id="atuacao" className="sec sec-paper">
        <div className="c">
          <SectionMark n="01" label="Áreas de atuação" />
          <div className="sec-head">
            <h2><Lines>{[<>Da obrigação acessória</>, <>à decisão de gestão.</>]}</Lines></h2>
            <p className="anim" style={{ transitionDelay: '.24s' }}>
              Um escritório só, respondendo por toda a cadeia: o que a lei exige, o que o banco
              cobra e o que o sócio precisa saber para decidir. Abaixo, as frentes que conduzimos hoje.
            </p>
          </div>
          <div className="pract">
            {services.map((s, i) => {
              const Icon = SERVICE_ICONS[s.icon] ?? Building2;
              return (
                <div key={s.title} className="pract-row" style={{ transitionDelay: `${0.06 * i}s` }}>
                  <span className="pract-ic" aria-hidden="true"><Icon size={18} strokeWidth={1.5} /></span>
                  <span className="pract-n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="pract-t">{s.title}</span>
                  <span className="pract-d">{s.desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* ── FAIXA DE IMAGEM ── */}
      <Reveal className="band">
        <div className="band-img" ref={bandRef}>
          <Image
            src="/edificio_privilege.jpg"
            alt="Edifício onde funciona o escritório da Privilege, no Centro de Francisco Beltrão"
            fill sizes="100vw" style={{ objectFit: 'cover' }}
          />
        </div>
        <div className="band-txt">
          <div className="c">
            <div className="band-k anim">Rua Pará, 127 — Centro</div>
            <div className="band-h">
              <Lines>{[<>Um endereço fixo,</>, <>uma equipe com <em>nome</em>.</>]}</Lines>
            </div>
            <div className="band-meta anim" style={{ transitionDelay: '.5s' }}>
              <div><b>2018</b>Início da operação</div>
              <div><b>{services.length}</b>Áreas de atuação</div>
              <div><b>PR</b>Sudoeste do Paraná</div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ── MÉTODO (invertido) ── */}
      <Reveal id="metodo" className="sec sec-dark">
        <div className="c">
          <SectionMark n="02" label="Como conduzimos a troca" />
          <div className="sec-head">
            <h2><Lines>{[<>Trocar de contador</>, <>sem parar a empresa.</>]}</Lines></h2>
            <p className="anim" style={{ transitionDelay: '.24s' }}>
              A preocupação legítima de quem migra é a descontinuidade. O processo abaixo existe
              para que nenhuma obrigação em curso seja interrompida durante a transição.
            </p>
          </div>
          <div className="steps">
            {METODO.map(s => (
              <div key={s.n} className="step">
                <div className="step-n">{s.n}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── ESCRITÓRIO ── */}
      <Reveal id="escritorio" className="sec sec-bone">
        <div className="c">
          <SectionMark n="03" label="O escritório" />
          <div className="about-grid">
            <div>
              <p className="quote">
                <Lines>{[
                  <>Contabilidade é um ofício</>,
                  <>de confiança: alguém precisa</>,
                  <>responder pelo número.</>,
                ]}</Lines>
              </p>
              <div className="princ anim" style={{ marginTop: 44, transitionDelay: '.34s' }}>
                <div className="princ-k">Missão</div>
                <p>
                  Oferecer serviços com qualidade, responsabilidade e excelência, superando as
                  necessidades e expectativas dos clientes, colaboradores e da sociedade.
                </p>
              </div>
              <div className="princ anim" style={{ marginBottom: 0, transitionDelay: '.44s' }}>
                <div className="princ-k">Visão</div>
                <p>
                  Ser reconhecido como escritório de referência em contabilidade consultiva e gestão
                  financeira, integrando tecnologia e expertise humana.
                </p>
              </div>
            </div>
            <div>
              <div className="map-frame">
                <iframe
                  title="Localização da Privilege Contabilidade — Rua Pará, 127, Centro, Francisco Beltrão, PR"
                  src={`https://www.google.com/maps?q=${encodeURIComponent('Rua Pará, 127, Centro, Francisco Beltrão - PR, 85601-290')}&z=17&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
              <div className="map-foot anim" style={{ transitionDelay: '.6s' }}>
                <div className="photo-cap" style={{ marginTop: 0 }}>
                  <span />{CONTATO.endereco}
                </div>
                <a
                  className="lk"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Rua Pará, 127, Centro, Francisco Beltrão - PR, 85601-290')}`}
                  target="_blank" rel="noopener noreferrer"
                >
                  Abrir no Google Maps
                </a>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ── INTEGRAÇÕES ── */}
      <Reveal className="sec sec-paper">
        <div className="c">
          <SectionMark n="04" label="Sistemas integrados" />
          <div className="sec-head" style={{ marginBottom: 48 }}>
            <h2><Lines>{[<>Conectados ao sistema</>, <>que a sua empresa já usa.</>]}</Lines></h2>
            <p className="anim" style={{ transitionDelay: '.24s' }}>
              Conciliação bancária por OFX e integração com os ERPs mais usados pelos nossos
              clientes — para que o dado entre uma vez só, na origem.
            </p>
          </div>
        </div>
        <div className="marquee">
          <div className="marquee-track">
            {[0, 1].map(dup => (
              <div className="marquee-i" key={dup} aria-hidden={dup === 1}>
                {integrations.map(({ name, color }, i) => (
                  <span key={name} style={{ display: 'inline-flex', gap: 10, alignItems: 'baseline' }}>
                    <b>{String(i + 1).padStart(2, '0')}</b>
                    <span className="marquee-dot" style={{ background: color }} aria-hidden="true" />
                    {name}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── UTILIDADES ── */}
      <Reveal id="utilidades" className="sec">
        <div className="c">
          <SectionMark n="05" label="Central de utilidades" />
          <div className="sec-head">
            <h2><Lines>{[<>Certidões e consultas,</>, <>direto na fonte oficial.</>]}</Lines></h2>
            <p className="anim" style={{ transitionDelay: '.24s' }}>
              Links diretos para os portais dos próprios órgãos. Sem intermediário e sem cadastro —
              você emite quando precisar.
            </p>
          </div>
          <div className="cnd-list">
            {cnds.map(({ label, url }) => (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="cnd-row">
                <span>{label}</span>
                <span className="cnd-arrow">&#8599;</span>
              </a>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── CTA INTERMEDIÁRIO ──
          Entre o header/hero e o formulário final vão 5 seções longas sem
          nenhum convite direto — este reforço fica logo após "Utilidades",
          quando quem leu até aqui já entendeu a oferta. */}
      <Reveal className="cta-mid">
        <div className="c">
          <div className="cta-mid-box">
            <p className="serif">Pronto para ver isso funcionando na sua empresa?</p>
            <a href="#contato" className="btn btn-p btn-lg"><span>Agendar diagnóstico</span><span className="arw">&rarr;</span></a>
          </div>
        </div>
      </Reveal>

      {/* ── DECLARAÇÃO ── */}
      <Reveal className="statement">
        <div className="c">
          <p>
            <Lines>{[
              <>Não entregamos guia.</>,
              <>Entregamos a <em>leitura</em></>,
              <>do seu negócio.</>,
            ]}</Lines>
          </p>
          <div className="sig anim" style={{ transitionDelay: '.55s' }}>
            <span />Privilege Contabilidade e Consultoria
          </div>
        </div>
      </Reveal>

      {/* ── PERGUNTAS ── */}
      <Reveal id="faq" className="sec sec-paper">
        <div className="c c-narrow">
          <SectionMark n="06" label="Perguntas frequentes" />
          <h2 style={{ fontSize: 'clamp(30px,3.8vw,48px)', marginBottom: 54 }}>
            <Lines>{[<>O que costumam</>, <>nos perguntar antes.</>]}</Lines>
          </h2>
          {faqs.map((f, i) => (
            <div key={i} className="faq-item">
              <div
                className="faq-q"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                role="button"
                tabIndex={0}
                aria-expanded={openFaq === i}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenFaq(openFaq === i ? null : i); } }}
              >
                <span>{f.q}</span>
                <span className={`faq-sign${openFaq === i ? ' on' : ''}`} aria-hidden="true" />
              </div>
              <div className={`faq-a${openFaq === i ? ' on' : ''}`}><div><p>{f.a}</p></div></div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ── CONTATO ── */}
      <Reveal id="contato" className="sec">
        <div className="c">
          <SectionMark n="07" label="Diagnóstico" />
          <div className="sec-head">
            <h2><Lines>{[<>Trinta minutos</>, <>para entender o caso.</>]}</Lines></h2>
            <p className="anim" style={{ transitionDelay: '.24s' }}>
              Sem custo e sem compromisso de contratação. Preencha ao lado ou fale direto no
              WhatsApp — respondemos em até 24 horas úteis.
            </p>
          </div>

          <div className="contact-grid">
            <div>
              <div className="ci">
                <div className="ci-k">Endereço</div>
                <div className="ci-v">{CONTATO.endereco}{'\n'}{CONTATO.cidade}</div>
              </div>
              <div className="ci">
                <div className="ci-k">Telefone</div>
                <div className="ci-v"><a href={`tel:+55${CONTATO.telefone.replace(/\D/g, '')}`}>{CONTATO.telefone}</a></div>
              </div>
              <div className="ci">
                <div className="ci-k">WhatsApp</div>
                <div className="ci-v">
                  <a href={`https://wa.me/${CONTATO.whatsapp}?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20um%20diagn%C3%B3stico.`} target="_blank" rel="noopener noreferrer">
                    {CONTATO.whatsappLabel}
                  </a>
                </div>
              </div>
              <div className="ci">
                <div className="ci-k">E-mail</div>
                <div className="ci-v"><a href={`mailto:${CONTATO.email}`}>{CONTATO.email}</a></div>
              </div>
              <div className="ci">
                <div className="ci-k">Atendimento</div>
                <div className="ci-v">{CONTATO.horario}</div>
              </div>
            </div>

            <div className="form-panel">
              {sent ? (
                <div style={{ padding: '32px 0' }}>
                  <div className="serif" style={{ fontSize: 34, color: '#14110F', lineHeight: 1.2, marginBottom: 16 }}>
                    Recebemos a sua solicitação.
                  </div>
                  <p style={{ fontSize: 15.5, lineHeight: 1.72, color: '#4A443E', marginBottom: 28 }}>
                    Um consultor entra em contato em até 24 horas úteis pelo e-mail ou WhatsApp
                    informado. Se preferir adiantar, fale com a gente agora mesmo.
                  </p>
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                    <a href={`https://wa.me/${CONTATO.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn btn-p"><span>Falar no WhatsApp</span></a>
                    <button className="lk" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setSent(false)}>
                      Enviar outra solicitação
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="form-grid">
                    <div className="fg">
                      <label className="fl" htmlFor="f-nome">Nome completo *</label>
                      <input id="f-nome" className="fi" type="text" placeholder="Seu nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
                    </div>
                    <div className="fg">
                      <label className="fl" htmlFor="f-email">E-mail corporativo *</label>
                      <input id="f-email" className="fi" type="email" placeholder="nome@empresa.com.br" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="fg">
                      <label className="fl" htmlFor="f-zap">WhatsApp</label>
                      <input id="f-zap" className="fi" type="tel" placeholder="(46) 99999-9999" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
                    </div>
                    <div className="fg">
                      <label className="fl" htmlFor="f-fat">Faixa de faturamento</label>
                      <select id="f-fat" className="fi" value={form.faturamento} onChange={e => setForm(f => ({ ...f, faturamento: e.target.value }))}>
                        <option value="">Selecione</option>
                        <option>Até R$ 50 mil por mês</option>
                        <option>R$ 50 mil a R$ 200 mil</option>
                        <option>R$ 200 mil a R$ 1 milhão</option>
                        <option>Acima de R$ 1 milhão</option>
                      </select>
                    </div>
                  </div>
                  <div className="fg" style={{ marginBottom: 32 }}>
                    <label className="fl" htmlFor="f-obj">Objetivo principal</label>
                    <select id="f-obj" className="fi" value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}>
                      <option value="">Selecione</option>
                      <option>Revisar a carga tributária</option>
                      <option>Terceirizar o financeiro (BPO)</option>
                      <option>Trocar de contador</option>
                      <option>Abrir uma empresa</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-p btn-lg" style={{ width: '100%' }}>
                    <span>Solicitar diagnóstico</span><span className="arw">&rarr;</span>
                  </button>
                  <p className="form-note">
                    Seus dados são tratados conforme a LGPD e usados apenas para este contato.
                    Você pode solicitar a exclusão a qualquer momento.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ── RODAPÉ ── */}
      <footer className="footer">
        <div className="c">
          <div className="footer-grid">
            <div>
              <div style={{ background: '#fff', display: 'inline-flex', padding: '10px 16px', marginBottom: 22 }}>
                <Image src="/logo.png" alt="Privilege Contabilidade e Consultoria" width={148} height={40} style={{ objectFit: 'contain' }} />
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.75, maxWidth: 300, marginBottom: 22 }}>
                Contabilidade consultiva, escrituração fiscal e BPO financeiro para empresas do
                sudoeste do Paraná.
              </p>
              <a href={`https://wa.me/${CONTATO.whatsapp}`} target="_blank" rel="noopener noreferrer" className="fl-link" style={{ color: '#fff' }}>
                {CONTATO.whatsappLabel}
              </a>
            </div>
            <div>
              <h4>Atuação</h4>
              {services.slice(0, 5).map(s => <a key={s.title} href="#atuacao" className="fl-link">{s.title}</a>)}
            </div>
            <div>
              <h4>Utilidades</h4>
              {cnds.slice(0, 4).map(({ label, url }) => (
                <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="fl-link">{label}</a>
              ))}
            </div>
            <div>
              <h4>Escritório</h4>
              <a href="#escritorio" className="fl-link">Sobre a Privilege</a>
              <a href="#metodo" className="fl-link">Como conduzimos</a>
              <a href="#faq" className="fl-link">Perguntas frequentes</a>
              <a href="#contato" className="fl-link">Contato</a>
              <Link href="/login" className="fl-link">Portal do cliente</Link>
              <button className="fl-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setActiveLegal('termos')}>Termos de uso</button>
              <button className="fl-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setActiveLegal('privacidade')}>Privacidade e LGPD</button>
            </div>
          </div>
          <div className="footer-rule" />
          <div className="footer-base">
            <span>© {new Date().getFullYear()} Privilege Contabilidade e Consultoria</span>
            <span>{CONTATO.endereco} — {CONTATO.cidade}</span>
          </div>
        </div>
      </footer>

      {/* ── MODAL LEGAL ── */}
      <div className={`modal-bg${activeLegal ? ' on' : ''}`} onClick={() => setActiveLegal(null)}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
          {activeLegal && legalDocs[activeLegal] && (
            <>
              <div style={{ fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: '#600000', marginBottom: 14 }}>
                {legalDocs[activeLegal].subtitle}
              </div>
              <h3 style={{ fontSize: 32, marginBottom: 22 }}>{legalDocs[activeLegal].title}</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.78, color: '#4A443E' }}>{legalDocs[activeLegal].content}</p>
              <div style={{ marginTop: 36 }}>
                <button className="btn btn-o" onClick={() => setActiveLegal(null)}><span>Fechar</span></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
