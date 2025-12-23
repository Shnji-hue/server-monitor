"use client";
import React from "react";
import { ArrowUp, Thermometer, Cpu, HardDrive } from "lucide-react";

type Props = {
  title: string;
  value: string | number;
  percent?: number; // 0-100
  color?: 'indigo' | 'red' | 'yellow' | 'emerald' | 'slate' | string;
};

function progressColorClass(p?: number) {
  if (p === undefined) return "bg-slate-300";
  if (p > 90) return "bg-red-500";
  if (p >= 70) return "bg-yellow-500";
  return "bg-emerald-500";
}

export default function StatCard({ title, value, percent, color = "indigo" }: Props) {
  const mainDisplay = percent !== undefined ? `${percent.toFixed(1)}%` : value;

  const colorToClass: Record<string, string> = {
    indigo: 'text-indigo-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    emerald: 'text-emerald-400',
    slate: 'text-slate-400',
  };
  const iconColorClass = colorToClass[String(color)] ?? 'text-indigo-400';

  return (
    <div className="bg-slate-900/40 border border-white/10 shadow-lg rounded-xl p-5 h-32 flex flex-col justify-between">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-slate-800/50 border border-white/5">
          {title === "CPU" && <Cpu className={`w-5 h-5 ${iconColorClass}`} />}
          {title === "RAM" && <ArrowUp className={`w-5 h-5 ${iconColorClass}`} />}
          {title === "Disk" && <HardDrive className={`w-5 h-5 ${iconColorClass}`} />}
          {title === "Temp" && <Thermometer className={`w-5 h-5 ${iconColorClass}`} />}
        </div>
        <h3 className="text-sm font-medium text-slate-400 mt-0.5">{title}</h3>
      </div>

      <div className="flex items-center justify-between">
        <div className="mt-1">
          <div className="text-3xl font-bold text-white">{mainDisplay}</div>
        </div>
      </div>

      {/* Progress bar: only when percent is provided; color changes by thresholds */}
      {percent !== undefined && (
        <div className="w-full mt-2">
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`${progressColorClass(percent)} h-2 rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${Math.min(100, Math.max(0, percent))}%`, willChange: 'width' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
