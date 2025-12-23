"use client";
import React from 'react';
import dynamic from 'next/dynamic';
// @ts-ignore - socket.io-client types may not be present in this workspace
import { io, Socket } from 'socket.io-client';
import ChatBubble from './ChatBubble';

const ICON = ({ className = '' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 20c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8c0 1.657.507 3.185 1.378 4.462L4 20l3.538-1.263C9.017 19.59 10.486 20 12 20z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type Msg = { id: string; from: 'user' | 'ai' | 'system'; text: string; time?: string };

export default function ChatWidget() {
  const [open, setOpen] = React.useState(false);
  const [socket, setSocket] = React.useState<Socket | null>(null);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState('');
  const [aiTyping, setAiTyping] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    // ensure the Socket.IO server is attached (for next dev server) before connecting
    let mounted = true;

    async function ensureSocketAttached(retries = 3, timeoutMs = 2000) {
      for (let i = 0; i < retries; i++) {
        try {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), timeoutMs);
          await fetch('/api/socketio', { signal: controller.signal, cache: 'no-store' });
          clearTimeout(id);
          return true;
        } catch (err) {
          // backoff
          await new Promise((r) => setTimeout(r, 300 * (i + 1)));
        }
      }
      return false;
    }

    (async () => {
      try {
        const attached = await ensureSocketAttached(4, 2000);
        if (!mounted) return;
        if (!attached) {
          setMessages((m) => m.concat([{ id: String(Date.now()), from: 'system', text: 'Socket server not ready yet; attempting connection (may fallback to polling)...', time: new Date().toLocaleTimeString() }]));
        }

        const tokenRes = await fetch('/api/socket-token');
        const json = await tokenRes.json();
        if (!mounted) return;
        const token = json?.token;
        if (!token) throw new Error('No token returned');
        console.info('[chat] fetched socket token:', token?.slice(0, 8), '...');

        // connect with auth token; prefer websocket but allow polling fallback
        const s = io({ auth: { token }, query: { token }, transports: ['websocket', 'polling'], path: '/socket.io', reconnectionAttempts: 5, timeout: 5000 });
        setSocket(s);

        s.on('connect', () => {
          console.info('[chat] socket connected', s.id);
        });

        s.on('ai_typing', (p: { typing: boolean }) => {
          setAiTyping(Boolean(p?.typing));
        });

        s.on('ai_response', (payload: { text?: string; error?: string }) => {
          setAiTyping(false);
          if (payload?.error) {
            setMessages((m) => m.concat([{ id: String(Date.now()), from: 'system', text: payload.error ?? 'Unknown error', time: new Date().toLocaleTimeString() }]));
          } else if (payload?.text) {
            setMessages((m) => m.concat([{ id: String(Date.now()), from: 'ai', text: payload.text ?? '', time: new Date().toLocaleTimeString() }]));
          }
        });

        s.on('connect_error', (err: any) => {
          console.error('[chat] connect_error', err?.message ?? err);
          setMessages((m) => m.concat([{ id: String(Date.now()), from: 'system', text: `Connection error: ${String(err?.message ?? err)}.`, time: new Date().toLocaleTimeString() }]));
        });

      } catch (err: any) {
        setMessages((m) => m.concat([{ id: String(Date.now()), from: 'system', text: `Socket init failed: ${String(err?.message ?? err)}`, time: new Date().toLocaleTimeString() }]));
      }
    })();

    return () => {
      mounted = false;
      if (socket) socket.disconnect();
    };
  }, []);

  React.useEffect(() => {
    // auto scroll
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, aiTyping, open]);

  const send = () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    setMessages((m) => m.concat([{ id: String(Date.now()), from: 'user', text, time: new Date().toLocaleTimeString() }]));
    socket?.emit('user_message', { text });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Popup */}
      <div className={`${open ? 'block' : 'hidden'} mb-3`}>
        <div className="w-80 md:w-96 bg-white shadow-xl rounded-lg overflow-hidden pointer-events-auto">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <div className="text-sm font-medium">AI Chat</div>
            <div>
              <button className="text-xs text-slate-500" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>

          <div className="p-3 h-56 overflow-y-auto" ref={listRef}>
            {messages.map((m) => (
              <ChatBubble key={m.id} from={m.from} text={m.text} time={m.time} />
            ))}

            {aiTyping ? (
              <div className="mb-2">
                <div className="max-w-[60%] px-3 py-2 rounded-lg text-sm bg-slate-100 text-slate-800">
                  <div className="animate-pulse text-slate-400">AI is thinking...</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="px-3 py-2 border-t">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') send();
                }}
                className="flex-1 px-3 py-2 border rounded-md text-sm"
                placeholder="Tanya tentang server..."
              />
              <button className="px-3 py-2 bg-sky-600 text-white rounded-md text-sm" onClick={send}>
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FAB button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open chat"
        className="w-12 h-12 rounded-full bg-sky-600 text-white shadow-lg flex items-center justify-center"
      >
        <ICON className="w-6 h-6" />
      </button>
    </div>
  );
}
