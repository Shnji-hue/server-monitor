import '../styles/globals.css';
import React from 'react';

export const metadata = {
  title: 'Dashboard - Monitoring Server',
  description: 'Dashboard monitoring server',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <div className="min-h-screen">
          <main className="max-w-7xl mx-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
