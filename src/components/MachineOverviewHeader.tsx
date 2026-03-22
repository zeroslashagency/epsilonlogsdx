import { Maximize2, Minimize2, RefreshCcw } from "lucide-react";

interface MachineOverviewHeaderProps {
  isRefreshing: boolean;
  isFullscreen: boolean;
  lastRefreshLabel: string;
  onRefresh: () => void;
  onToggleFullscreen: () => void;
}

export function MachineOverviewHeader({
  isRefreshing,
  isFullscreen,
  lastRefreshLabel,
  onRefresh,
  onToggleFullscreen,
}: MachineOverviewHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
      <div className="hidden lg:block" />

      <div className="lg:justify-self-center">
        <div className="flex items-center gap-3 lg:justify-center">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-white/80 bg-white/90 p-1 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.45)]">
            <img
              src="/brand-logo.png"
              alt="Shop floor logo"
              className="h-full w-full object-contain"
            />
          </span>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] text-slate-800 sm:text-4xl lg:text-center">
            SHOP FLOOR DASHBOARD
          </h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 lg:justify-self-end">
        <span className="inline-flex min-h-11 items-center rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-500 shadow-[0_12px_35px_-24px_rgba(15,23,42,0.55)] backdrop-blur">
          Auto refresh 30s
        </span>
        <span className="inline-flex min-h-11 items-center rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-500 shadow-[0_12px_35px_-24px_rgba(15,23,42,0.55)] backdrop-blur">
          {lastRefreshLabel}
        </span>
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/90 bg-white/90 text-slate-700 shadow-[0_16px_35px_-24px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:bg-white"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
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
