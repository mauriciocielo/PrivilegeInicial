'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ResetDadosPage() {
  const [status, setStatus] = useState<string>('Limpando dados...');
  const [done, setDone] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Limpar todos os dados do localStorage
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('cf_')) {
        localStorage.removeItem(key);
        console.log(`✅ Removido: ${key}`);
      }
    });

    // Limpar sessionStorage
    sessionStorage.clear();

    setStatus('✅ Dados limpos com sucesso! Redirecionando para login...');
    setDone(true);

    // Redirecionar para login após 2 segundos
    setTimeout(() => {
      router.push('/login');
    }, 2000);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">🔄 Reset de Dados</h1>
        <p className="text-gray-600 mb-6">{status}</p>

        {done && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-700 font-semibold mb-2">Próximas ações:</p>
            <ol className="text-left text-green-600 text-sm space-y-2">
              <li>1. Você será redirecionado para o login</li>
              <li>2. Faça login com as credenciais de teste:
                <ul className="ml-4 mt-1">
                  <li>📧 cliente@empresa.com / 123456</li>
                  <li>👨‍💼 consultor@sistema.com / 123456</li>
                </ul>
              </li>
              <li>3. Os dados de teste serão carregados automaticamente</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
