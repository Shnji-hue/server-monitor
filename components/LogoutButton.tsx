"use client";
import React, { useState } from "react";
import { usePathname } from 'next/navigation';

export default function LogoutButton() {
  const pathname = usePathname();
  // hide logout button on login and register pages
  if (pathname === '/login' || pathname === '/register') return null;

  const [loading, setLoading] = useState(false);
  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Logout failed", err);
    } finally {
      setLoading(false);
    }
  }
  return (
    <button 
      onClick={logout} 
      disabled={loading} 
      className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 border border-white/10 text-white text-sm font-medium transition-colors disabled:opacity-50"
    >
      {loading ? "Keluar..." : "Keluar"}
    </button>
  );
}
