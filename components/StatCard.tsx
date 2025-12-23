"use client";
import React from "react";
import { ArrowUp, Thermometer, Cpu, HardDrive } from "lucide-react";

type Props = {
  title: string;
  value: string | number;
  percent?: number;
  color?: string; // tailwind color classes
};

export default function StatCard({ title, value, percent, color = 'indigo' }: Props) {
  return (
    <div className="bg-white shadow-sm rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-500">{title}</h3>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-slate-900">{value}</span>
            {percent !== undefined && (
              <span className="text-sm text-slate-500">{percent.toFixed(1)}%</span>
            )}
          </div>
        </div>
        <div className="p-2 rounded-md bg-slate-100">
          {title === 'CPU' && <Cpu className="w-6 h-6 text-slate-700" />}
          {title === 'RAM' && <ArrowUp className="w-6 h-6 text-slate-700" />}
          {title === 'Disk' && <HardDrive className="w-6 h-6 text-slate-700" />}
          {title === 'Temp' && <Thermometer className="w-6 h-6 text-slate-700" />}
        </div>
      </div>

      {percent !== undefined && (
        <div className="mt-4">
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full bg-gradient-to-r from-${color}-500 to-${color}-700`}
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
