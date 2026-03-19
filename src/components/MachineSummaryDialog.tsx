import { AnimatePresence, motion } from "motion/react";
import { Factory, Gauge, Settings, ShieldAlert, X } from "lucide-react";

import { cn } from "../lib/utils";
import { getMachineLabel } from "../data/machineConfig";

import type {
  MachineCardRecord,
  MachineCardVariant,
} from "../data/mockMachines";

const iconMap: Record<MachineCardVariant, typeof Factory> = {
  production: Factory,
  setting: Settings,
  calibration: Gauge,
  offline: ShieldAlert,
};

const accentClassMap: Record<MachineCardVariant, string> = {
  production: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
  setting: "border-violet-200 bg-violet-50/80 text-violet-700",
  calibration: "border-sky-200 bg-sky-50/80 text-sky-700",
  offline: "border-rose-200 bg-rose-50/80 text-rose-700",
};

interface MachineSummaryDialogProps {
  machine: MachineCardRecord | null;
  onClose: () => void;
}

export function MachineSummaryDialog({
  machine,
  onClose,
}: MachineSummaryDialogProps) {
  return (
    <AnimatePresence>
      {machine ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/32 p-4 backdrop-blur-[3px] sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-3xl rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_30px_80px_-28px_rgba(15,23,42,0.55)] backdrop-blur"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-[20px] border bg-white text-slate-600 shadow-[0_14px_30px_-20px_rgba(15,23,42,0.45)]",
                    accentClassMap[machine.variant],
                  )}
                >
                  {(() => {
                    const Icon = iconMap[machine.variant];
                    return <Icon className="h-6 w-6" />;
                  })()}
                </span>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {machine.badgeLabel}
                  </p>
                  <h2 className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-slate-900">
                    {getMachineLabel(machine.machineId)}
                  </h2>
                  <p className="mt-2 text-base text-slate-500">
                    {machine.operatorName} · {machine.workOrderLabel}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[26px] border border-slate-200/80 bg-slate-50/80 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Summary
                </p>
                <p className="mt-3 text-lg leading-8 text-slate-700">
                  {machine.detailSummary}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {machine.detailMetrics.map((metric) => (
                    <div
                      key={`${machine.machineId}-${metric.label}`}
                      className="rounded-2xl border border-white bg-white/90 p-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {metric.label}
                      </p>
                      <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-800">
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] border border-slate-200/80 bg-white/80 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Recent Notes
                </p>
                <div className="mt-4 space-y-3">
                  {machine.recentNotes.map((note) => (
                    <div
                      key={note}
                      className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 text-sm leading-7 text-slate-600"
                    >
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
