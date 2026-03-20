import {
  PauseCircle,
  Factory,
  Gauge,
  Settings,
  ShieldAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { cn } from "../lib/utils";
import { getMachineLabel } from "../data/machineConfig";
import { formatElapsedDurationFromTimestamp } from "../lib/time";

import type {
  MachineCardRecord,
  MachineCardVariant,
} from "../data/dashboard-types";

const iconMap: Record<MachineCardVariant, LucideIcon> = {
  production: Factory,
  setting: Settings,
  calibration: Gauge,
  pause: PauseCircle,
  maintenance: Wrench,
  offline: ShieldAlert,
};

const surfaceClassMap: Record<MachineCardVariant, string> = {
  production:
    "border-emerald-300/80 bg-[linear-gradient(145deg,rgba(239,255,248,0.96),rgba(239,252,246,0.78))] shadow-[0_24px_55px_-36px_rgba(16,185,129,0.6)]",
  setting:
    "border-violet-300/70 bg-[linear-gradient(145deg,rgba(250,247,255,0.96),rgba(244,240,255,0.78))] shadow-[0_24px_55px_-36px_rgba(139,92,246,0.4)]",
  calibration:
    "border-sky-300/80 bg-[linear-gradient(145deg,rgba(239,250,255,0.96),rgba(237,247,255,0.78))] shadow-[0_24px_55px_-36px_rgba(14,165,233,0.4)]",
  pause:
    "border-amber-200/90 bg-white shadow-[0_24px_55px_-36px_rgba(245,158,11,0.5)]",
  maintenance:
    "border-rose-300/85 bg-[linear-gradient(145deg,rgba(255,248,245,0.96),rgba(255,244,241,0.82))] shadow-[0_24px_55px_-36px_rgba(244,63,94,0.36)]",
  offline:
    "border-rose-200/90 bg-[linear-gradient(145deg,rgba(255,246,247,0.98),rgba(255,242,244,0.84))] shadow-[0_24px_55px_-36px_rgba(244,63,94,0.32)]",
};

const badgeClassMap: Record<MachineCardVariant, string> = {
  production: "border-emerald-300/90 bg-emerald-50/95 text-emerald-700",
  setting: "border-violet-300/90 bg-violet-50/95 text-violet-700",
  calibration: "border-sky-300/90 bg-sky-50/95 text-sky-700",
  pause: "border-amber-300 bg-white/95 text-amber-700",
  maintenance: "border-rose-300/90 bg-rose-50/95 text-rose-700",
  offline: "border-slate-300/80 bg-slate-100/95 text-slate-600",
};

const statusClassMap: Record<MachineCardRecord["statusLabel"], string> = {
  LIVE: "border-emerald-300/90 bg-emerald-50/95 text-emerald-700",
  PROCESSING: "border-amber-300 bg-amber-50/95 text-amber-700",
  COMPLETE: "border-sky-300/90 bg-sky-50/95 text-sky-700",
  PAUSED: "border-amber-300 bg-white/95 text-amber-700",
  OFFLINE: "border-rose-300/90 bg-rose-50/95 text-rose-600",
  ERROR: "border-fuchsia-300/90 bg-fuchsia-50/95 text-fuchsia-700",
};

interface MachineCardProps {
  machine: MachineCardRecord;
  currentTimeMs: number;
}

export function MachineCard({
  machine,
  currentTimeMs,
}: MachineCardProps) {
  const Icon = iconMap[machine.variant];
  const isPaused = machine.statusLabel === "PAUSED";
  const pauseTimerLabel = formatElapsedDurationFromTimestamp(
    machine.pauseStartedAt,
    currentTimeMs,
  );

  return (
    <article
      className={cn(
        "machine-overview-shop-card relative min-h-[462px] w-full overflow-hidden rounded-[28px] border p-5 text-left",
        surfaceClassMap[machine.variant],
        isPaused && "machine-overview-shop-card--pause",
      )}
    >
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-slate-200/60 bg-white/85 text-slate-500 shadow-[0_12px_25px_-18px_rgba(15,23,42,0.6)]">
            <Icon className="h-5 w-5" />
          </span>
          <span
            className={cn(
              "inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-[15px] font-semibold",
              badgeClassMap[machine.variant],
            )}
          >
            {machine.badgeLabel}
          </span>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold uppercase tracking-[0.04em]",
              statusClassMap[machine.statusLabel],
              machine.statusLabel === "LIVE" &&
                "machine-overview-shop-status-live",
            )}
          >
            {machine.statusLabel}
          </span>
          <span className="text-sm font-medium text-slate-400">
            {machine.updatedLabel}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[22px] font-semibold tracking-[-0.04em] text-slate-900">
          {getMachineLabel(machine.machineId)}
        </p>
        <p className="text-[17px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {machine.operatorName}
        </p>
      </div>

      <p className="mt-6 text-[30px] font-semibold tracking-[-0.05em] text-slate-800">
        {machine.workOrderLabel}
      </p>

      {isPaused ? (
        <div className="mt-6 rounded-[24px] border border-amber-200/80 bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-600">
                Paused For
              </p>
              <p className="machine-overview-shop-pause-timer mt-2 text-[34px] font-semibold tracking-[-0.06em] text-amber-950">
                {pauseTimerLabel}
              </p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
              Single-machine alert
            </span>
          </div>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2.5 text-[15px]">
            {machine.metrics.map((metric) => (
              <div
                key={`${machine.machineId}-${metric.label}`}
                className="contents"
              >
                <span className="text-slate-500">{metric.label}</span>
                <span className="text-right font-medium text-slate-700">
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2.5 text-[15px]">
          {machine.metrics.map((metric) => (
            <div key={`${machine.machineId}-${metric.label}`} className="contents">
              <span className="text-slate-500">{metric.label}</span>
              <span className="text-right font-medium text-slate-700">
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {machine.footerLabel.trim().length > 0 ? (
        <div className="mt-8 border-t border-white/70 pt-4 text-[14px] text-slate-500">
          {machine.footerLabel}
        </div>
      ) : null}
    </article>
  );
}
