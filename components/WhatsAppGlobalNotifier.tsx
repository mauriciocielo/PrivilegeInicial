'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { MessageSquare, X } from 'lucide-react';
import { store } from '@/lib/store';

interface ToastNotification {
  id: string;
  chatId: string;
  senderName: string;
  phone: string;
  preview: string;
  mediaType?: string;
  profilePic?: string;
  createdAt: number;
}

export default function WhatsAppGlobalNotifier({
  whatsappHref,
}: {
  whatsappHref: '/consultor/whatsapp' | '/cliente/whatsapp';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const ownerIdRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSoundRef = useRef<number>(0);
  const lastEventKeyRef = useRef<string>('');

  function playBeep() {
    if (typeof window === 'undefined') return;
    const savedSound = localStorage.getItem('cf_whatsapp_sound');
    if (savedSound === 'false') return;
    const now = Date.now();
    if (now - lastSoundRef.current < 1200) return;
    lastSoundRef.current = now;

    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      const playTone = (freq: number, startOffset: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
        gain.gain.setValueAtTime(0.001, ctx.currentTime + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + startOffset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startOffset);
        osc.stop(ctx.currentTime + startOffset + duration + 0.02);
      };

      playTone(659.25, 0, 0.15);
      playTone(880.0, 0.13, 0.22);
    } catch {}
  }

  useEffect(() => {
    const user = store.getCurrentUser();
    if (user) {
      ownerIdRef.current = user.role === 'administrador' ? 'default' : `user_${user.id}`;
    }

    fetch('/api/whatsapp/config', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ownerId) ownerIdRef.current = d.ownerId;
      })
      .catch(() => {});

    // Em produção os eventos vêm do servidor contínuo do WhatsApp (NEXT_PUBLIC_WHATSAPP_SOCKET_URL).
    const socketUrl = process.env.NEXT_PUBLIC_WHATSAPP_SOCKET_URL;
    const socketOpts = { path: '/socket.io', transports: ['websocket', 'polling'] };
    const socket: Socket = socketUrl ? io(socketUrl, socketOpts) : io(socketOpts);

    socket.on(
      'whatsapp_update',
      (payload?: {
        chatId?: string;
        ownerId?: string;
        timestamp?: number;
        isNewMessage?: boolean;
        fromMe?: boolean;
        senderName?: string;
        phone?: string;
        preview?: string;
        mediaType?: string;
        profilePic?: string;
      }) => {
        if (!payload?.isNewMessage || payload.fromMe) return;
        if (
          payload.ownerId &&
          ownerIdRef.current &&
          payload.ownerId !== ownerIdRef.current
        ) {
          return;
        }

        const dedupeKey = `${payload.chatId || ''}_${payload.timestamp || 0}`;
        if (lastEventKeyRef.current === dedupeKey) return;
        lastEventKeyRef.current = dedupeKey;

        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const senderName = payload.senderName || payload.phone || 'Nova mensagem';
        const preview = payload.preview || 'Nova mensagem recebida no WhatsApp';

        const item: ToastNotification = {
          id,
          chatId: payload.chatId || '',
          senderName,
          phone: payload.phone || '',
          preview,
          mediaType: payload.mediaType,
          profilePic: payload.profilePic,
          createdAt: Date.now(),
        };

        setNotifications((prev) => [item, ...prev].slice(0, 4));

        const onWhatsAppPage = pathnameRef.current?.includes('/whatsapp');
        if (!onWhatsAppPage) {
          playBeep();
        }

        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted' &&
          document.hidden
        ) {
          try {
            const n = new Notification(`WhatsApp • ${senderName}`, {
              body: preview,
              tag: payload.chatId || 'whatsapp-msg',
            });
            n.onclick = () => {
              window.focus();
              openChat(item);
              n.close();
            };
          } catch {}
        }

        setTimeout(() => {
          setNotifications((prev) => prev.filter((x) => x.id !== id));
        }, 8000);
      }
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  function openChat(item: ToastNotification) {
    setNotifications((prev) => prev.filter((x) => x.id !== item.id));
    if (item.chatId && typeof window !== 'undefined') {
      sessionStorage.setItem('wa_open_chat_id', item.chatId);
      window.dispatchEvent(new CustomEvent('waOpenChat', { detail: item.chatId }));
    }
    if (!pathnameRef.current?.startsWith(whatsappHref)) {
      router.push(whatsappHref);
    }
  }

  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 360,
        width: 'calc(100vw - 32px)',
        pointerEvents: 'none',
      }}
    >
      {notifications.map((item) => (
        <div
          key={item.id}
          onClick={() => openChat(item)}
          style={{
            pointerEvents: 'auto',
            cursor: 'pointer',
            background: 'var(--bg-card, #ffffff)',
            color: 'var(--text-primary, #111827)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderLeft: '4px solid #10b981',
            borderRadius: 12,
            padding: '12px 14px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.16)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          {item.profilePic ? (
            <img
              src={item.profilePic}
              alt={item.senderName}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.14)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MessageSquare size={20} />
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 2,
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.senderName}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#10b981',
                  flexShrink: 0,
                }}
              >
                WhatsApp
              </span>
            </div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--text-secondary, #4b5563)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.35,
              }}
            >
              {item.preview}
            </div>
          </div>

          <button
            type="button"
            aria-label="Fechar notificação"
            onClick={(e) => {
              e.stopPropagation();
              setNotifications((prev) => prev.filter((x) => x.id !== item.id));
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #9ca3af)',
              cursor: 'pointer',
              padding: 2,
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
