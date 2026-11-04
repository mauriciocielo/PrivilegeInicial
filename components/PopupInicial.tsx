'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { X } from 'lucide-react';

const fonte = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['500', '700', '800'] });

const WHATSAPP = 'https://wa.me/554630351018';

const ESTILOS = `
  .popup-fundo {
    position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center;
    padding: 16px; background: rgba(0, 0, 0, 0.6); animation: popup-surgir 0.2s ease-out;
  }
  .popup-caixa {
    position: relative; width: 100%; max-width: 640px; max-height: calc(100dvh - 32px); overflow-y: auto;
    background: #fff; border-radius: 20px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35); outline: none;
  }
  .popup-foto { position: relative; line-height: 0; }
  .popup-foto img { display: block; width: 100%; height: auto; }
  /* Fica sobre o X que já vem desenhado na foto, com área de toque de 44px em qualquer tela. */
  .popup-fechar {
    position: absolute; right: max(3.125%, 8px); top: max(6.67%, 8px);
    width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; padding: 0;
    color: #fff; background: #2a1414; border: 1px solid rgba(255, 255, 255, 0.55); border-radius: 50%; cursor: pointer;
  }
  .popup-corpo { padding: 32px 40px 28px; }
  .popup-antes { margin: 0; font-size: 18px; font-weight: 700; line-height: 1.3; color: #600000; }
  .popup-titulo {
    margin: 4px 0 12px; font-family: inherit; font-size: clamp(36px, 8.4vw, 54px); font-weight: 800;
    line-height: 1.02; letter-spacing: -0.04em; color: #600000;
  }
  .popup-texto { margin: 0 0 28px; font-size: clamp(16px, 2.9vw, 20px); font-weight: 500; line-height: 1.45; color: #4d4044; }
  .popup-acoes { display: flex; align-items: center; gap: 12px 24px; flex-wrap: wrap; }
  .popup-cta {
    flex: 1 1 260px; min-height: 56px; display: flex; align-items: center; justify-content: center; padding: 12px 24px;
    box-sizing: border-box; text-align: center; font-size: 17px; font-weight: 700; color: #fff; text-decoration: none;
    background: #600000; border-radius: 99px; transition: background 0.2s;
  }
  .popup-cta:hover { background: #3b0000; }
  .popup-agora-nao {
    flex: 0 0 auto; margin: 0 auto; min-height: 44px; padding: 0 8px; font-family: inherit; font-size: 15px; font-weight: 700;
    color: #5f5256; background: none; border: none; cursor: pointer;
  }
  .popup-contato { margin: 14px 0 0; text-align: center; font-size: 13px; font-weight: 500; color: #5f5256; }
  .popup-contato a { color: inherit; text-decoration: none; }
  .popup-fechar:focus-visible, .popup-cta:focus-visible, .popup-agora-nao:focus-visible { outline: 3px solid #a88948; outline-offset: 2px; }
  @media (max-width: 480px) { .popup-corpo { padding: 22px 22px 20px; } }
  @keyframes popup-surgir { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .popup-fundo { animation: none; } }
`;

/**
 * Aparece sempre que a página inicial é carregada. O logout leva para "/", então
 * abrir o site, atualizar a página e sair do sistema passam todos por aqui.
 */
export default function PopupInicial() {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => { setAberto(true); }, []);

  useEffect(() => {
    if (!aberto) return;
    caixa.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    const rolagemAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.body.style.overflow = rolagemAnterior;
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  if (!aberto) return null;

  return (
    <div className={`popup-fundo ${fonte.className}`} onClick={e => e.target === e.currentTarget && setAberto(false)}>
      <style>{ESTILOS}</style>
      <div ref={caixa} tabIndex={-1} className="popup-caixa" role="dialog" aria-modal="true" aria-labelledby="popup-inicial-titulo">
        <div className="popup-foto">
          <Image
            src="/popup-credito.jpg"
            alt="Empresário sorrindo em reunião. Privilege Contabilidade e Consultoria: resultado que se comprova."
            width={1280}
            height={600}
            sizes="(max-width: 672px) 100vw, 640px"
            priority
          />
          <button type="button" className="popup-fechar" aria-label="Fechar" onClick={() => setAberto(false)}>
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="popup-corpo">
          <p className="popup-antes">Mais de</p>
          <h2 id="popup-inicial-titulo" className="popup-titulo">R$ 10 milhões em crédito</h2>
          <p className="popup-texto">conquistados para os nossos clientes. Sua empresa pode ser a próxima.</p>
          <div className="popup-acoes">
            <a className="popup-cta" href={WHATSAPP} target="_blank" rel="noopener noreferrer" onClick={() => setAberto(false)}>
              Quero falar com a consultoria
            </a>
            <button type="button" className="popup-agora-nao" onClick={() => setAberto(false)}>Agora não</button>
          </div>
          <p className="popup-contato">
            <a href="tel:+554630351018">(46) 3035-1018</a> · @privilegeconsultoria.fb
          </p>
        </div>
      </div>
    </div>
  );
}
