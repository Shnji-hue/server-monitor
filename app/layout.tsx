import '../styles/globals.css';
import React from 'react';
import { cookies } from 'next/headers';
import { AmbilUserDariToken } from '../lib/auth';
import LogoutButton from '../components/LogoutButton';

export const metadata = {
  title: 'Dashboard - Monitoring Server',
  description: 'Dashboard monitoring server',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // server-side: check cookie session and resolve user
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get?.('session')?.value;
  const user = sessionToken ? await AmbilUserDariToken(sessionToken) : null;

  return (
    <html lang="id" className="font-sans">
      <body>
        <div className="min-h-screen bg-slate-950 text-slate-100">
          <header className="flex items-center justify-between max-w-7xl mx-auto p-6">
            <div className="text-lg font-semibold text-white">Monitoring Server</div>
            {/* show logout only when user is authenticated */}
            <nav className="flex items-center gap-4">
              {user ? <LogoutButton /> : null}
            </nav>
          </header>
          <main className="max-w-7xl mx-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
