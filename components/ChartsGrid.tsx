"use client";
import React from 'react';
import dynamic from 'next/dynamic';

const GrafikMetrik = dynamic(() => import('./GrafikMetrik'), { ssr: false });

export default function ChartsGrid() {
  return (
    <div className="bg-slate-900/40 border border-white/10 shadow-lg rounded-xl p-5">
      <h3 className="text-sm font-medium text-slate-300 mb-4">Tren Per Metrik</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-1">
          {/* CPU: biru, 0-100% */}
          <GrafikMetrik title="Tren Penggunaan CPU" metric="cpu" color="#4f46e5" yDomain={[0, 100]} unit="%" windowSize={30} fetchLimit={35} />
        </div>

        <div className="col-span-1">
          {/* Memory: hijau, 0-100% */}
          <GrafikMetrik title="Tren Penggunaan Memori" metric="mem" color="#0f766e" yDomain={[0, 100]} unit="%" windowSize={30} fetchLimit={35} />
        </div>

        <div className="col-span-1">
          {/* Disk: abu-abu, 0-100% */}
          <GrafikMetrik title="Tren Penggunaan Disk" metric="disk" color="#64748b" yDomain={[0, 100]} unit="%" windowSize={30} fetchLimit={35} />
        </div>

        <div className="col-span-1">
          {/* Temperature: merah, 0-120°C */}
          <GrafikMetrik title="Tren Suhu" metric="suhu" color="#ef4444" yDomain={[0, 120]} unit="°C" windowSize={30} fetchLimit={35} />
        </div>
      </div>
    </div>
  );
}
