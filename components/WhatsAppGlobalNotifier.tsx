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
  const seenChatsRef = useRef<Map<string, string>>(new Map());
  const pollInitializedRef = useRef<boolean>(false);

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
    // Clientes não recebem notificações do painel WhatsApp
    if (user?.role === 'cliente' || whatsappHref === '/cliente/whatsapp') {
      return;
    }

    if (user) {
      ownerIdRef.current =
        user.role === 'administrador' || (user.role === 'consultor' && (user as any).whatsappScope !== 'individual')
          ? 'default'
          : `user_${user.id}`;
    }

    fetch('/api/whatsapp/config', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ownerId) ownerIdRef.current = d.ownerId;
      })
      .catch(() => {});

    const dispararToast = (dados: {
      chatId: string;
      senderName: string;
      phone: string;
      preview: string;
      mediaType?: string;
      profilePic?: string;
      dedupeKey: string;
    }) => {
      if (lastEventKeyRef.current === dados.dedupeKey) return;
      lastEventKeyRef.current = dados.dedupeKey;

      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastNotification = {
        id,
        chatId: dados.chatId,
        senderName: dados.senderName,
        phone: dados.phone,
        preview: dados.preview,
        mediaType: dados.mediaType,
        profilePic: dados.profilePic,
        createdAt: Date.now(),
      };

      setNotifications((prev) => [item, ...prev].slice(0, 4));

      const onWhatsAppPage = pathnameRef.current?.includes('/whatsapp');
      if (!onWhatsAppPage) {
        playBeep();
      }

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && (document.hidden || !onWhatsAppPage)) {
        try {
          const n = new Notification(`WhatsApp • ${dados.senderName}`, {
            body: dados.preview,
            tag: dados.chatId || 'whatsapp-msg',
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
    };

    // 1. Escuta em tempo real via Socket.IO
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
        const myOwner = ownerIdRef.current;
        if (
          payload.ownerId &&
          myOwner &&
          payload.ownerId !== myOwner &&
          payload.ownerId !== `${myOwner}_linha2`
        ) {
          return;
        }

        const dedupeKey = `${payload.chatId || ''}_${payload.timestamp || 0}`;
        if (payload.chatId) {
          seenChatsRef.current.set(payload.chatId, String(payload.timestamp || Date.now()));
        }

        dispararToast({
          chatId: payload.chatId || '',
          senderName: payload.senderName || payload.phone || 'Nova mensagem',
          phone: payload.phone || '',
          preview: payload.preview || 'Nova mensagem recebida no WhatsApp',
          mediaType: payload.mediaType,
          profilePic: payload.profilePic,
          dedupeKey,
        });
      }
    );

    // 2. Fallback em 2º plano (polling leve a cada 10s) — garante que a notificação chegue
    // em qualquer página do sistema mesmo se o WebSocket oscilar ou o usuário ainda não abriu a tela do WhatsApp.
    const checarNovasMensagens = async () => {
      if (pathnameRef.current?.includes('/whatsapp')) return;
      try {
        const res = await fetch('/api/whatsapp/chats?limit=15', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const chats = Array.isArray(data?.chats) ? data.chats : [];

        if (!pollInitializedRef.current) {
          for (const c of chats) {
            if (c?.id) {
              seenChatsRef.current.set(c.id, `${c.unread_count || 0}_${c.last_message_time || ''}`);
            }
          }
          pollInitializedRef.current = true;
          return;
        }

        for (const c of chats) {
          if (!c?.id || Number(c.unread_count || 0) <= 0) continue;
          const assinatura = `${c.unread_count || 0}_${c.last_message_time || ''}`;
          const anterior = seenChatsRef.current.get(c.id);
          if (anterior !== assinatura) {
            seenChatsRef.current.set(c.id, assinatura);
            dispararToast({
              chatId: c.id,
              senderName: c.name || c.phone || 'Nova mensagem',
              phone: c.phone || '',
              preview: c.last_message || 'Nova mensagem recebida no WhatsApp',
              profilePic: c.profile_pic || undefined,
              dedupeKey: `poll_${c.id}_${assinatura}`,
            });
          }
        }
      } catch {
        // ignora erro pontual de rede
      }
    };

    checarNovasMensagens();
    const pollInterval = setInterval(checarNovasMensagens, 10000);

    return () => {
      clearInterval(pollInterval);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatsappHref]);

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
