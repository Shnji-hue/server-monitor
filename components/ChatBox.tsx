"use client";
import React, { useState, useTransition } from 'react';

export default function ChatBox() {
  const [Input, SetInput] = useState('');
  const [Messages, SetMessages] = useState<{ id: string; from: 'user' | 'ai' | 'system'; text: string }[]>([]);
  const [IsPending, startTransition] = useTransition();

  const Kirim = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const txt = Input.trim();
    if (!txt) return;

    const id = String(Date.now());
    SetMessages((m) => m.concat({ id, from: 'user', text: txt }));
    SetInput('');

    startTransition(async () => {
      try {
        const res = await fetch('/api/gemini-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userMessage: txt }),
        });
        const json = await res.json();
        if (json?.success) {
          SetMessages((m) => m.concat({ id: String(Date.now() + 1), from: 'ai', text: json.text }));
        } else {
          SetMessages((m) => m.concat({ id: String(Date.now() + 2), from: 'system', text: `Error: ${json?.error ?? 'Unknown'}` }));
        }
      } catch (err: any) {
        SetMessages((m) => m.concat({ id: String(Date.now() + 3), from: 'system', text: `Exception: ${String(err?.message ?? err)}` }));
      }
    });
  };

  return (
    <div className="max-w-md w-full bg-white shadow rounded-lg p-4">
      <div className="text-sm font-semibold mb-3">AI Chat (Gemini)</div>

      <div className="h-48 overflow-y-auto border rounded-md p-2 mb-3">
        {Messages.length === 0 ? <div className="text-xs text-slate-400">Tanyakan sesuatu tentang server...</div> : null}
        {Messages.map((m) => (
          <div key={m.id} className={`mb-2 ${m.from === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block rounded px-3 py-2 text-sm ${m.from === 'user' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {IsPending ? <div className="animate-pulse text-slate-400 text-xs">AI is thinking...</div> : null}
      </div>

      <form onSubmit={Kirim} className="flex gap-2">
        <input value={Input} onChange={(e) => SetInput(e.target.value)} className="flex-1 px-3 py-2 border rounded-md text-sm" placeholder="Tulis pertanyaan..." />
        <button disabled={IsPending} type="submit" className="px-3 py-2 rounded-md bg-sky-600 text-white text-sm">
          {IsPending ? '...' : 'Kirim'}
        </button>
      </form>
    </div>
  );
}
