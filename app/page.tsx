'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Inter } from 'next/font/google';

const sans = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export default function Home() {
  return (
    <div className={`min-h-screen bg-white flex flex-col items-center justify-center p-6 ${sans.className}`}>
      <div className="text-center max-w-2xl w-full">
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="Privilege Contabilidade" width={220} height={60} style={{ objectFit: 'contain' }} priority />
        </div>
        <h1 className="text-4xl font-semibold text-gray-900 mb-6">Contabilidade & Consultoria Estratégica</h1>
        <p className="text-gray-600 text-lg mb-10 leading-relaxed">
          Transformamos dados contábeis em decisões estratégicas. Conheça nossa nova proposta de valor e serviços especializados.
        </p>

        <div className="space-y-4">
          <Link
            href="/novo-layout"
            className="w-full flex items-center justify-center py-4 px-6 bg-[#600000] hover:bg-[#3b0000] text-white font-semibold rounded-xl transition-all text-lg shadow-md"
          >
            Conheça a Privilege
          </Link>
          <Link
            href="/login"
            className="w-full flex items-center justify-center py-3 px-4 text-[#600000] hover:text-[#3b0000] font-medium transition-colors"
          >
            Já sou cliente (Acessar Portal)
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 text-sm text-gray-400">
          Privilege Contabilidade e Consultoria · Francisco Beltrão - PR
        </div>
      </div>
    </div>
  );
}
