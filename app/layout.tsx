import '../styles/globals.css';
import React from 'react';
import { cookies } from 'next/headers';
import { ambilUserDariToken } from '../lib/auth';
import LogoutButton from '../components/LogoutButton';

export const metadata = {
  title: 'Dashboard - Monitoring Server',
  description: 'Dashboard monitoring server',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // server-side: check cookie session and resolve user
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get?.('session')?.value;
  const user = sessionToken ? await ambilUserDariToken(sessionToken) : null;

  return (
    <html lang="id">
      <body>
        <div className="min-h-screen">
          <header className="flex items-center justify-between max-w-7xl mx-auto p-6">
            <div className="text-lg font-semibold">Monitoring Server</div>
            <nav className="flex items-center gap-4">
              {user ? (
                // When logged in, show only Logout
                <LogoutButton />
              ) : (
                <>
                  <a href="/login" className="hover:underline">Masuk</a>
                  <a href="/register" className="hover:underline">Daftar</a>
                </>
              )}
            </nav>
          </header>
          <main className="max-w-7xl mx-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
