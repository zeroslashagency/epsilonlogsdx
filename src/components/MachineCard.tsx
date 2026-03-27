import {
  PauseCircle,
  Factory,
  Gauge,
  Key,
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
  key: Key,
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
  key:
    "border-rose-300/85 bg-[linear-gradient(145deg,rgba(255,247,247,0.98),rgba(255,239,241,0.88))] shadow-[0_24px_55px_-36px_rgba(239,68,68,0.42)]",
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
  key: "border-rose-300/90 bg-rose-50/95 text-rose-700",
  maintenance: "border-rose-300/90 bg-rose-50/95 text-rose-700",
  offline: "border-slate-300/80 bg-slate-100/95 text-slate-600",
};

const statusClassMap: Record<MachineCardRecord["statusLabel"], string> = {
  LIVE: "border-emerald-300/90 bg-emerald-50/95 text-emerald-700",
  PROCESSING: "border-amber-300 bg-amber-50/95 text-amber-700",
  COMPLETE: "border-sky-300/90 bg-sky-50/95 text-sky-700",
  PAUSED: "border-amber-300 bg-white/95 text-amber-700",
  "KEY ACTIVE": "border-rose-300/90 bg-rose-50/95 text-rose-700",
  OFFLINE: "border-rose-300/90 bg-rose-50/95 text-rose-600",
  ERROR: "border-fuchsia-300/90 bg-fuchsia-50/95 text-fuchsia-700",
};

const contextBadgeClassMap: Record<string, string> = {
  Production: "border-emerald-300/90 bg-emerald-50/95 text-emerald-700",
  Setting: "border-violet-300/90 bg-violet-50/95 text-violet-700",
  Calibration: "border-sky-300/90 bg-sky-50/95 text-sky-700",
  Maintenance: "border-rose-300/90 bg-rose-50/95 text-rose-700",
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
  const isPaused = machine.alertKind === "pause";
  const isKeyAlert = machine.alertKind === "key";
  const isAlertCard = isPaused || isKeyAlert;
  const alertTimerLabel = formatElapsedDurationFromTimestamp(
    machine.alertStartedAt,
    currentTimeMs,
  );
  const alertTitle = isKeyAlert ? "Key Active For" : "Paused For";
  const alertChipLabel = isKeyAlert ? "Key Active" : "Single-machine alert";
  const alertTimerClassName = isKeyAlert
    ? "text-rose-950"
    : "machine-overview-shop-pause-timer text-amber-950";
  const reasonLabel = machine.pauseReason ?? "No pause reason from API";
  const pauseCountLabel = String(Math.max(0, machine.pauseCount));
  const contextBadgeClassName = machine.contextBadgeLabel
    ? contextBadgeClassMap[machine.contextBadgeLabel] ??
      "border-slate-300/80 bg-slate-50/95 text-slate-600"
    : null;

  return (
    <article
      className={cn(
        "machine-overview-shop-card relative flex h-full min-h-[clamp(260px,27vh,350px)] w-full flex-col overflow-hidden rounded-[26px] border p-[clamp(14px,0.92vw,18px)] text-left",
        surfaceClassMap[machine.variant],
        isPaused && "machine-overview-shop-card--pause",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/60 bg-white/85 text-slate-500 shadow-[0_12px_25px_-18px_rgba(15,23,42,0.6)]">
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div className="flex flex-wrap items-start gap-3">
            <span
              className={cn(
                "inline-flex min-h-9 items-center rounded-full border px-3.5 py-1.5 text-[14px] font-semibold",
                badgeClassMap[machine.variant],
              )}
            >
              {machine.badgeLabel}
            </span>
            {machine.contextBadgeLabel && contextBadgeClassName ? (
              <span
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full border px-3.5 py-1.5 text-[14px] font-semibold",
                  contextBadgeClassName,
                )}
              >
                {machine.contextBadgeLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-[13px] font-semibold uppercase tracking-[0.04em]",
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

      <div className="space-y-1.5">
        <p className="text-[clamp(1.25rem,1.02vw,1.55rem)] font-semibold tracking-[-0.04em] text-slate-900">
          {getMachineLabel(machine.machineId)}
        </p>
        <p className="text-[clamp(0.88rem,0.68vw,0.98rem)] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {machine.operatorName}
        </p>
      </div>

      {machine.partNumber ? (
        <div className="mt-3 space-y-1">
          <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Part No
          </p>
          <p className="text-[clamp(1.45rem,1.45vw,1.9rem)] font-semibold tracking-[-0.05em] text-slate-800">
            {machine.partNumber}
          </p>
        </div>
      ) : null}

      <p
        className={cn(
          machine.partNumber ? "mt-3" : "mt-3.5",
          "text-[clamp(1.2rem,1.18vw,1.65rem)] font-semibold tracking-[-0.05em] text-slate-700",
        )}
      >
        {machine.workOrderLabel}
      </p>

      {isAlertCard ? (
        <div
          className={cn(
            "mt-4 rounded-[24px] bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
            isKeyAlert
              ? "border border-rose-200/80"
              : "border border-amber-200/80",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.28em]",
                  isKeyAlert ? "text-rose-700" : "text-amber-600",
                )}
              >
                {alertTitle}
              </p>
              <p
                className={cn(
                  "mt-2 text-[clamp(2rem,2.3vw,2.4rem)] font-semibold tracking-[-0.06em]",
                  alertTimerClassName,
                )}
              >
                {alertTimerLabel}
              </p>
            </div>
            {isKeyAlert ? (
              <span className="machine-overview-shop-key-button inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-[0_14px_26px_-20px_rgba(225,29,72,0.85)]">
                <Key className="h-3.5 w-3.5" />
                {alertChipLabel}
              </span>
            ) : (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                {alertChipLabel}
              </span>
            )}
          </div>

          {isPaused ? (
            <div className="mt-3 flex min-w-0 items-center gap-3 text-[14px]">
              <span className="inline-flex min-w-11 items-center justify-center rounded-full border border-emerald-300/90 bg-emerald-50/95 px-3 py-1 text-sm font-semibold text-emerald-700 shadow-[0_10px_20px_-18px_rgba(16,185,129,0.8)]">
                {pauseCountLabel}
              </span>
              <p className="min-w-0 text-slate-600">
                <span className="font-medium text-slate-500">Pause Reason</span>{" "}
                <span className="font-medium text-slate-700">{reasonLabel}</span>
              </p>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[14px]">
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
          )}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[14px]">
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
        <div className="mt-4 border-t border-white/70 pt-3 text-[13px] text-slate-500">
          {machine.footerLabel}
        </div>
      ) : (
        <div className="mt-2" />
      )}
    </article>
  );
}
