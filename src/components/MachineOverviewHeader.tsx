import { RefreshCcw } from "lucide-react";

interface MachineOverviewHeaderProps {
  boardSummary: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function MachineOverviewHeader({
  boardSummary,
  isRefreshing,
  onRefresh,
}: MachineOverviewHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
          Shop Floor View
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.045em] text-slate-800 sm:text-4xl">
          Machine Overview
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
        <span className="inline-flex min-h-11 items-center rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-500 shadow-[0_12px_35px_-24px_rgba(15,23,42,0.55)] backdrop-blur">
          {boardSummary}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-2 text-base font-semibold text-slate-700 shadow-[0_16px_35px_-24px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-wait disabled:opacity-80"
        >
          <RefreshCcw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>
    </div>
  );
}
