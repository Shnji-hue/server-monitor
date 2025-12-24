"use client";
import React from "react";
import { Bell, Cpu, Thermometer, Zap } from "lucide-react";

export type AlertItem = {
  pesan: string;
  waktu: string; // ISO
};

type AlertSegment = {
  key: string;
  label: string;
  short: string;
  severity: "info" | "warning" | "critical";
};

type Props = {
  alerts: AlertItem[];
};

function ParseSegments(pesan: string): AlertSegment[] {
  // pesan may contain multiple segments separated by ';'
  return pesan.split(";").map((seg) => {
    const s = seg.trim();
    // Detect CPU
    if (/cpu/i.test(s)) {
      const m = s.match(/([0-9]+\.?[0-9]*)%/);
      const val = m ? `${m[1]}%` : "";
      return { key: s, label: "CPU", short: `Tinggi (${val})`, severity: "warning" as const };
    }
    // Detect suhu / temperature
    if (/suhu|temperature|temp/i.test(s)) {
      const m = s.match(/([0-9]+\.?[0-9]*)(°?C)?/i);
      const val = m ? `${m[1]}°C` : "";
      return { key: s, label: "Temp", short: `Tinggi (${val})`, severity: "critical" as const };
    }
    // Fallback generic
    return { key: s, label: "Alert", short: s, severity: "info" as const };
  });
}

export default function AlertPanel({ alerts }: Props) {
  // Expand grouped messages into flattened list with timestamps
  const items = alerts.flatMap((a) => {
    const segments = ParseSegments(a.pesan);
    const time = a.waktu;
    return segments.map((seg) => ({ ...seg, waktu: time }));
  });

  const FormatTime = (iso?: string) => {
    try {
      const d = new Date(iso ?? "");
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (err) {
      return "";
    }
  };

  const IconFor = (severity: AlertSegment["severity"], label: string) => {
    const classes = "w-4 h-4 text-white";
    if (label === "CPU") return <Cpu className={classes} />;
    if (label === "Temp") return <Thermometer className={classes} />;
    return <Zap className={classes} />;
  };

  const BgFor = (severity: AlertSegment["severity"]) => {
    if (severity === "critical") return "bg-red-500";
    if (severity === "warning") return "bg-orange-500";
    return "bg-slate-400";
  };

  return (
    <div className="bg-slate-900/40 border border-white/10 shadow-lg rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
          <Bell className="w-4 h-4 text-amber-400" />
        </div>
        <h3 className="text-sm font-medium text-slate-300">Peringatan Terbaru</h3>
      </div>

      <div className="mt-3 h-56 overflow-y-auto divide-y divide-white/5 pr-2 dark-scrollbar">
        {items.length === 0 && (
          <div className="text-sm text-slate-400 py-4">No alerts</div>
        )}

        {items.map((it, idx) => (
          <div key={`${it.key}-${idx}`} className="flex items-center gap-3 py-2 text-sm">
<div className={`inline-flex items-center justify-center w-7 h-7 rounded-md ${BgFor(it.severity)}`}>
              {IconFor(it.severity, it.label)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-medium text-white truncate">
                {it.label}: <span className="font-normal text-slate-300">{it.short}</span>
              </div>
            </div>

            <div className="text-xs text-slate-500">{FormatTime(it.waktu)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
