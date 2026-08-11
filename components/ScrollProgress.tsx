'use client';
import { useEffect, useState } from 'react';

export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const docHeight = document.body.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        setProgress((scrollY / docHeight) * 100);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        backgroundColor: 'transparent',
        zIndex: 10000,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          backgroundColor: '#600000',
          width: `${progress}%`,
        }}
      />
    </div>
  );
}
