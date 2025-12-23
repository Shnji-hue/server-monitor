"use client";
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { BacaanServer } from '../services/pemantauServer';

type Props = {
  data: BacaanServer[];
};

export default function ChartsClient({ data }: Props) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      waktu: new Date(d.waktu).toLocaleTimeString(),
      cpu: +d.cpu.toFixed(1),
      mem: +d.mem.toFixed(1),
      disk: +d.disk.toFixed(1),
      suhu: +d.suhu.toFixed(1),
    }));
  }, [data]);

  return (
    <div className="bg-white shadow-sm rounded-lg p-4">
      <h3 className="text-sm font-medium text-slate-600 mb-4">Tren (CPU, RAM, Disk, Temp)</h3>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <XAxis dataKey="waktu" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="cpu" stroke="#4f46e5" dot={false} />
            <Line type="monotone" dataKey="mem" stroke="#0f766e" dot={false} />
            <Line type="monotone" dataKey="disk" stroke="#64748b" dot={false} />
            <Line type="monotone" dataKey="suhu" stroke="#ef4444" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
