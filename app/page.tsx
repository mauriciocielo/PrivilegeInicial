'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { store } from '../lib/store';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const user = store.getCurrentUser();
    if (user) {
      router.replace(user.role === 'consultor' ? '/consultor/dashboard' : '/cliente/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0b0f1a', color:'#94a3b8' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:16 }}>💰</div>
        <div>Carregando...</div>
      </div>
    </div>
  );
}
