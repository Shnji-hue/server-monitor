"use client";
import React from "react";
import { ArrowUp, Thermometer, Cpu, HardDrive } from "lucide-react";

type Props = {
  title: string;
  value: string | number;
  percent?: number; // 0-100
};

function progressColorClass(p?: number) {
  if (p === undefined) return "bg-slate-300";
  if (p > 90) return "bg-red-500";
  if (p >= 70) return "bg-yellow-500";
  return "bg-emerald-500";
}

export default function StatCard({ title, value, percent, color = "indigo" }: Props) {
  const mainDisplay = percent !== undefined ? `${percent.toFixed(1)}%` : value;

  return (
    <div className="bg-white shadow-sm rounded-lg p-3 h-20 flex flex-col justify-between">
      <div className="flex items-start gap-3">
        <div className="p-1 rounded-md bg-slate-100">
          {title === "CPU" && <Cpu className="w-4 h-4 text-slate-700" />}
          {title === "RAM" && <ArrowUp className="w-4 h-4 text-slate-700" />}
          {title === "Disk" && <HardDrive className="w-4 h-4 text-slate-700" />}
          {title === "Temp" && <Thermometer className="w-4 h-4 text-slate-700" />}
        </div>
        <h3 className="text-xs font-medium text-slate-500 mt-0.5">{title}</h3>
      </div>

      <div className="flex items-center justify-between">
        <div className="mt-1">
          <div className="text-xl font-semibold text-slate-900">{mainDisplay}</div>
        </div>
      </div>

      {/* Progress bar: only when percent is provided; color changes by thresholds */}
      {percent !== undefined && (
        <div className="w-full mt-2">
          <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
            <div
              className={`${progressColorClass(percent)} h-1 rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${Math.min(100, Math.max(0, percent))}%`, willChange: 'width' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
