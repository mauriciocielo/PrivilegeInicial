'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Número que anima ao aparecer na tela. Depois da primeira animação, cada novo `target`
 * (dados que terminaram de carregar, troca de mês ou de empresa) anima do valor atual
 * até o novo — antes o componente ficava preso no primeiro valor recebido.
 */
export default function AnimatedCounter({
  target,
  prefix = '',
  suffix = '',
  duration = 1800,
  decimals = 0,
}: {
  target?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
}) {
  const alvo = typeof target === 'number' && !isNaN(target) ? target : 0;
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const valorAtual = useRef(0);
  const jaAnimou = useRef(false);
  const quadro = useRef<number | null>(null);

  useEffect(() => {
    const animar = (de: number, para: number, ms: number) => {
      if (quadro.current !== null) cancelAnimationFrame(quadro.current);
      const inicio = performance.now();
      const fator = Math.pow(10, decimals);
      const passo = (agora: number) => {
        const progresso = Math.min((agora - inicio) / ms, 1);
        const suave = 1 - Math.pow(1 - progresso, 3);
        const v = progresso < 1 ? Math.round((de + (para - de) * suave) * fator) / fator : para;
        valorAtual.current = v;
        setValue(v);
        quadro.current = progresso < 1 ? requestAnimationFrame(passo) : null;
      };
      quadro.current = requestAnimationFrame(passo);
    };

    // Já apareceu na tela: só acompanha a mudança de valor, com animação curta.
    if (jaAnimou.current) {
      if (alvo !== valorAtual.current) animar(valorAtual.current, alvo, Math.min(duration, 700));
      return;
    }

    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        jaAnimou.current = true;
        observer.disconnect();
        animar(0, alvo, duration);
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [alvo, duration, decimals]);

  useEffect(() => () => { if (quadro.current !== null) cancelAnimationFrame(quadro.current); }, []);

  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exibido = prefersReducedMotion ? alvo : (value || 0);

  return (
    <span ref={ref}>
      {prefix}
      {exibido.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}
