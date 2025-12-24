"use client";
import React, { useState } from "react";

export default function RegisterPage() {
  const [Email, SetEmail] = useState("");
  const [Password, SetPassword] = useState("");
  const [Error, SetError] = useState<string | null>(null);
  const [Success, SetSuccess] = useState<string | null>(null);
  const [Loading, SetLoading] = useState(false);

  async function KirimPendaftaran(e: React.FormEvent) {
    e.preventDefault();
    SetError(null);
    SetSuccess(null);
    SetLoading(true);
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: Email, password: Password }),
      });
      const j = await r.json();
      if (!r.ok) {
        SetError(j.pesan || "Gagal mendaftar");
      } else {
        SetSuccess("Pendaftaran berhasil. Silakan masuk.");
        setTimeout(() => (window.location.href = "/login"), 1200);
      }
    } catch (err) {
      SetError("Gagal menghubungi server");
    } finally {
      SetLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-md px-8 py-10 bg-gradient-to-b from-slate-900/40 to-slate-950/40 border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center">
          <div className="bg-slate-800/30 rounded-full p-3 mb-4">
            {/* Server/Shield icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 2l7 4v5c0 5-3.5 9-7 11-3.5-2-7-6-7-11V6l7-4z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.5 11.5v-2a2.5 2.5 0 015 0v2" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white">Daftar</h1>
          <p className="text-sm text-slate-400 mt-2 text-center max-w-[22rem]">Buat akun untuk mulai memantau server Anda secara real-time.</p>
        </div>

        <form onSubmit={KirimPendaftaran} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">Email</label>
            <input
              value={Email}
              onChange={(e) => SetEmail(e.target.value)}
              type="email"
              required
              className="mt-2 block w-full px-4 py-3 rounded-lg bg-slate-900 text-white border border-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">Password</label>
            <input
              value={Password}
              onChange={(e) => SetPassword(e.target.value)}
              type="password"
              required
              className="mt-2 block w-full px-4 py-3 rounded-lg bg-slate-900 text-white border border-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {Error && <div className="text-red-400 text-sm mt-1">{Error}</div>}
          {Success && <div className="text-green-400 text-sm mt-1">{Success}</div>}

          <div>
            <button
              disabled={Loading}
              className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors text-white font-semibold shadow-md"
            >
              {Loading ? "Memproses..." : "Daftar"}
            </button>
          </div>

          <p className="text-center text-sm text-slate-400 mt-3">
            Sudah punya akun? <a href="/login" className="text-indigo-300 hover:underline">Masuk</a>
          </p>
        </form>
      </div>
    </div>
  );
}
