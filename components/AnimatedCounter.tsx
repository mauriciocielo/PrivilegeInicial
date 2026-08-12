'use client';
import { useEffect, useRef, useState } from 'react';

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
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const start = performance.now();
          
          const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const safeTarget = typeof target === 'number' && !isNaN(target) ? target : 0;
            const factor = Math.pow(10, decimals);
            setValue(Math.round(eased * safeTarget * factor) / factor);
            
            if (progress < 1) {
              requestAnimationFrame(tick);
            } else {
              setValue(safeTarget);
            }
          };
          requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration, decimals, hasAnimated]);

  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <span ref={ref}>
      {prefix}
      {prefersReducedMotion
        ? ((typeof target === 'number' && !isNaN(target)) ? target : 0).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : (value || 0).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}
