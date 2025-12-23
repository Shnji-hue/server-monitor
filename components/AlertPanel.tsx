"use client";
import React from "react";
import { Bell } from "lucide-react";

export type AlertItem = {
  pesan: string;
  waktu: string; // ISO
};

type Props = {
  alerts: AlertItem[];
};

export default function AlertPanel({ alerts }: Props) {
  return (
    <div className="bg-white shadow-sm rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-amber-100 text-amber-700">
          <Bell className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-600">Alert Recent</h3>
          <p className="text-xs text-slate-400">Monitoring alerts (terbaru di atas)</p>
        </div>
      </div>

      <div className="mt-4 divide-y">
        {alerts.length === 0 && (
          <div className="text-sm text-slate-500 py-4">Tidak ada alert</div>
        )}
        {alerts.map((a, i) => (
          <div key={i} className="py-3">
            <div className="text-sm font-medium text-slate-800">{a.pesan}</div>
            <div className="text-xs text-slate-400">{new Date(a.waktu).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
