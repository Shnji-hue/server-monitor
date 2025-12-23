"use client";
import React from 'react';

type Props = {
  from: 'user' | 'ai' | 'system';
  text: string;
  time?: string;
};

export default function ChatBubble({ from, text, time }: Props) {
  const isUser = from === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${isUser ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-800'}`}
      >
        <div>{text}</div>
        {time ? <div className="text-[10px] text-slate-400 mt-1 text-right">{time}</div> : null}
      </div>
    </div>
  );
}
