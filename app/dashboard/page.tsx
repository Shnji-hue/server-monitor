"use client";
import React from 'react';
import useSWR from 'swr';
import StatCard from '../../components/StatCard';
import AlertPanel from '../../components/AlertPanel';
import dynamic from 'next/dynamic';
import { BacaanServer } from '../../services/pemantauServer';

const ChartsGrid = dynamic(() => import('../../components/ChartsGrid'), { ssr: false });
const WidgetObrolan = dynamic(() => import('../../components/WidgetObrolan'), { ssr: false });

const AmbilData = (url: string) => fetch(url).then((r) => r.json());

export default function DashboardPage() {
  // status tiap 2 detik
  const { data: serverData } = useSWR('/api/server-status', AmbilData, { refreshInterval: 2000, revalidateOnFocus: true });

  // alerts tiap 2 detik
  const { data: alertsData } = useSWR('/api/alerts?limit=20', AmbilData, { refreshInterval: 2000 });

  const terbaru: BacaanServer | null = serverData?.data?.terbaru ?? null;
  const alerts = alertsData?.data ?? [];

  return (
    <div className="min-h-screen space-y-6">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 grid grid-cols-4 gap-4">
          <StatCard title="CPU" value={terbaru ? `${terbaru.cpu.toFixed(1)}%` : '-'} percent={terbaru ? terbaru.cpu : undefined} />
          <StatCard title="RAM" value={terbaru ? `${terbaru.mem.toFixed(1)}%` : '-'} percent={terbaru ? terbaru.mem : undefined} />
          <StatCard title="Disk" value={terbaru ? `${terbaru.disk.toFixed(1)}%` : '-'} percent={terbaru ? terbaru.disk : undefined} />
          <StatCard title="Temp" value={terbaru ? `${terbaru.suhu.toFixed(1)}°C` : '-'} percent={terbaru ? Math.min(100, terbaru.suhu) : undefined} />
        </div>

        <div className="col-span-4">
          <AlertPanel alerts={alerts} />
        </div>
      </div>

      <div>
        <ChartsGrid />
      </div>

      {/* Chat widget (floating) */}
      <WidgetObrolan />


    </div>
  );
}
