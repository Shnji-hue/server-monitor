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

export default function WidgetObrolan() {
  const [Open, SetOpen] = React.useState(false);
  const [SocketClient, SetSocketClient] = React.useState<Socket | null>(null);
  const [Messages, SetMessages] = React.useState<Msg[]>([]);
  const [Input, SetInput] = React.useState('');
  const [AiTyping, SetAiTyping] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    // ensure the Socket.IO server is attached (for next dev server) before connecting
    let mounted = true;

    async function PastikanSocketTerpasang(retries = 3, timeoutMs = 2000) {
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
        const attached = await PastikanSocketTerpasang(4, 2000);
        if (!mounted) return;
        if (!attached) {
          SetMessages((m) => m.concat([{ id: String(Date.now()), from: 'system', text: 'Socket server not ready yet; attempting connection (may fallback to polling)...', time: new Date().toLocaleTimeString() }]));
        }

        const TokenRes = await fetch('/api/socket-token');
        const Json = await TokenRes.json();
        if (!mounted) return;
        const Token = Json?.token;
        if (!Token) throw new Error('No token returned');
        console.info('[chat] fetched socket token:', Token?.slice(0, 8), '...');

        // connect with auth token; prefer websocket but allow polling fallback
        const SClient = io({ auth: { token: Token }, query: { token: Token }, transports: ['websocket', 'polling'], path: '/socket.io', reconnectionAttempts: 5, timeout: 5000 });
        SetSocketClient(SClient);

        SClient.on('connect', () => {
          console.info('[chat] socket connected', SClient.id);
        });

        SClient.on('ai_typing', (p: { typing: boolean }) => {
          SetAiTyping(Boolean(p?.typing));
        });

        SClient.on('ai_response', (payload: { text?: string; error?: string }) => {
          SetAiTyping(false);
          if (payload?.error) {
            SetMessages((m) => m.concat([{ id: String(Date.now()), from: 'system', text: payload.error ?? 'Unknown error', time: new Date().toLocaleTimeString() }]));
          } else if (payload?.text) {
            SetMessages((m) => m.concat([{ id: String(Date.now()), from: 'ai', text: payload.text ?? '', time: new Date().toLocaleTimeString() }]));
          }
        });

        SClient.on('connect_error', (err: any) => {
          console.error('[chat] connect_error', err?.message ?? err);
          SetMessages((m) => m.concat([{ id: String(Date.now()), from: 'system', text: `Connection error: ${String(err?.message ?? err)}.`, time: new Date().toLocaleTimeString() }]));
        });

      } catch (err: any) {
        SetMessages((m) => m.concat([{ id: String(Date.now()), from: 'system', text: `Socket init failed: ${String(err?.message ?? err)}`, time: new Date().toLocaleTimeString() }]));
      }
    })();

    return () => {
      mounted = false;
      if (SocketClient) SocketClient.disconnect();
    };
  }, []);

  React.useEffect(() => {
    // auto scroll
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [Messages, AiTyping, Open]);

  const Kirim = () => {
    if (!Input.trim()) return;
    const text = Input.trim();
    SetInput('');
    SetMessages((m) => m.concat([{ id: String(Date.now()), from: 'user', text, time: new Date().toLocaleTimeString() }]));
    SocketClient?.emit('user_message', { text });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Popup */}
      <div className={`${Open ? 'block' : 'hidden'} mb-3`}>
        <div className="w-80 md:w-96 bg-slate-900 border border-white/10 shadow-2xl rounded-xl overflow-hidden pointer-events-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="text-sm font-medium text-white">AI Chat</div>
            <div>
              <button className="text-xs text-slate-400 hover:text-slate-300" onClick={() => SetOpen(false)}>
                Close
              </button>
            </div>
          </div>

          <div className="p-3 h-56 overflow-y-auto bg-slate-950/50" ref={listRef}>
            {Messages.map((m) => (
              <ChatBubble key={m.id} from={m.from} text={m.text} time={m.time} />
            ))}

            {AiTyping ? (
              <div className="mb-2">
                <div className="max-w-[60%] px-3 py-2 rounded-lg text-sm bg-slate-800 text-slate-300 border border-white/10">
                  <div className="animate-pulse text-slate-400">AI is thinking...</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="px-3 py-2 border-t border-white/10 bg-slate-900">
            <div className="flex gap-2">
              <input
                value={Input}
                onChange={(e) => SetInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') Kirim();
                }}
                className="flex-1 px-3 py-2 border border-white/10 bg-slate-800 text-white placeholder:text-slate-500 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Tanya tentang server..."
              />
              <button className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm transition-colors" onClick={Kirim}>
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FAB button */}
      <button
        onClick={() => SetOpen((v) => !v)}
        aria-label="Open chat"
        className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg flex items-center justify-center transition-colors"
      >
        <ICON className="w-6 h-6" />
      </button>
    </div>
  );
}