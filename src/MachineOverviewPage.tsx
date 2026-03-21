import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  compareDashboardMachineOrder,
  DEFAULT_DASHBOARD_MACHINE_IDS,
} from "./data/machineConfig";
import type {
  MachineCardRecord,
  MachineReportEntry,
} from "./data/dashboard-types";

import { MachineGrid } from "./components/MachineGrid";
import { MachineOverviewHeader } from "./components/MachineOverviewHeader";
import { OperatorLeaderboard } from "./components/OperatorLeaderboard";
import { fetchLiveMachineCards } from "./data/liveMachineData";
import { formatRefreshTime } from "./lib/time";
import "./machine-overview-shop.css";

const AUTO_REFRESH_RATE_MS = 30_000;
const API_TOKEN = import.meta.env.VITE_API_TOKEN as string | undefined;
const MACHINE_CACHE_KEY = "machine-overview-shop.live-cache";
const MACHINE_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedDashboardState {
  cachedAt: number;
  lastRefreshedAt: string;
  machines: MachineCardRecord[];
  machineReport: MachineReportEntry[];
}

function readCachedDashboardState(): {
  machines: MachineCardRecord[];
  machineReport: MachineReportEntry[];
  lastRefreshedAt: Date | null;
} {
  if (typeof window === "undefined") {
    return {
      machines: [],
      machineReport: [],
      lastRefreshedAt: null,
    };
  }

  try {
    const rawValue = window.sessionStorage.getItem(MACHINE_CACHE_KEY);
    if (!rawValue) {
      return {
        machines: [],
        machineReport: [],
        lastRefreshedAt: null,
      };
    }

    const parsed = JSON.parse(rawValue) as CachedDashboardState;
    if (
      !parsed ||
      !Array.isArray(parsed.machines) ||
      !Array.isArray(parsed.machineReport) ||
      typeof parsed.cachedAt !== "number" ||
      typeof parsed.lastRefreshedAt !== "string"
    ) {
      return {
        machines: [],
        machineReport: [],
        lastRefreshedAt: null,
      };
    }

    if (Date.now() - parsed.cachedAt > MACHINE_CACHE_TTL_MS) {
      return {
        machines: [],
        machineReport: [],
        lastRefreshedAt: null,
      };
    }

    const lastRefreshedAt = new Date(parsed.lastRefreshedAt);
    return {
      machines: parsed.machines,
      machineReport: parsed.machineReport,
      lastRefreshedAt: Number.isFinite(lastRefreshedAt.getTime())
        ? lastRefreshedAt
        : null,
    };
  } catch {
    return {
      machines: [],
      machineReport: [],
      lastRefreshedAt: null,
    };
  }
}

export default function MachineOverviewPage() {
  const cachedDashboardState = useMemo(() => readCachedDashboardState(), []);
  const autoRefreshIntervalRef = useRef<number | null>(null);
  const liveClockIntervalRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [machines, setMachines] = useState<MachineCardRecord[]>(
    cachedDashboardState.machines,
  );
  const [machineReport, setMachineReport] = useState<MachineReportEntry[]>(
    cachedDashboardState.machineReport,
  );
  const [isRefreshing, setIsRefreshing] = useState(
    cachedDashboardState.machines.length === 0,
  );
  const [isFullscreen, setIsFullscreen] = useState(() =>
    typeof document !== "undefined" ? document.fullscreenElement !== null : false,
  );
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(
    cachedDashboardState.lastRefreshedAt,
  );
  const [error, setError] = useState<string | null>(null);

  const sortedMachines = useMemo(
    () =>
      [...machines].sort((left, right) =>
        compareDashboardMachineOrder(
          left.machineId,
          right.machineId,
          DEFAULT_DASHBOARD_MACHINE_IDS,
        ),
      ),
    [machines],
  );

  const loadMachines = useCallback(async () => {
    if (!API_TOKEN) {
      setMachines([]);
      setMachineReport([]);
      setIsRefreshing(false);
      setError(
        "Missing VITE_API_TOKEN. Add it to /Users/xoxo/Desktop/machine-overview-shop/.env.local to enable live machine data.",
      );
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsRefreshing(true);

    try {
      const result = await fetchLiveMachineCards({
        token: API_TOKEN,
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        return;
      }

      setMachines(result.machines);
      setMachineReport(result.machineReport);
      setError(
        result.errors.length > 0
          ? `Partial data loaded. ${result.errors.join(" · ")}`
          : null,
      );
      const refreshedAt = new Date();
      setLastRefreshedAt(refreshedAt);
      window.sessionStorage.setItem(
        MACHINE_CACHE_KEY,
        JSON.stringify({
          cachedAt: Date.now(),
          lastRefreshedAt: refreshedAt.toISOString(),
          machines: result.machines,
          machineReport: result.machineReport,
        } satisfies CachedDashboardState),
      );
    } catch (nextError) {
      if (controller.signal.aborted) {
        return;
      }

      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to refresh live machine data.",
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    liveClockIntervalRef.current = window.setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);

    return () => {
      if (liveClockIntervalRef.current !== null) {
        window.clearInterval(liveClockIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void loadMachines();
  }, [loadMachines]);

  useEffect(() => {
    autoRefreshIntervalRef.current = window.setInterval(() => {
      void loadMachines();
    }, AUTO_REFRESH_RATE_MS);

    return () => {
      if (autoRefreshIntervalRef.current !== null) {
        window.clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, [loadMachines]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement !== null);
    }

    handleFullscreenChange();
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  function handleRefresh() {
    void loadMachines();
  }

  async function handleToggleFullscreen() {
    if (typeof document === "undefined") {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await document.documentElement.requestFullscreen();
  }

  const isInitialLoad = sortedMachines.length === 0 && !error;
  const lastRefreshLabel = lastRefreshedAt
    ? isRefreshing
      ? "Refreshing..."
      : `Last refresh: ${formatRefreshTime(lastRefreshedAt)}`
    : "Waiting for first refresh...";

  return (
    <div className="machine-overview-shop-page">
      <main className="machine-overview-shop-board min-h-screen">
        <section className="mx-auto w-full max-w-[2240px] px-3 py-5 sm:px-4 sm:py-6 lg:px-4 xl:px-5 2xl:px-6">
          <MachineOverviewHeader
            isRefreshing={isRefreshing}
            isFullscreen={isFullscreen}
            lastRefreshLabel={lastRefreshLabel}
            onRefresh={handleRefresh}
            onToggleFullscreen={handleToggleFullscreen}
          />
          {error ? (
            <div className="mb-4 rounded-[22px] border border-rose-200/90 bg-white/90 px-4 py-3 text-sm text-rose-700 shadow-[0_18px_40px_-30px_rgba(244,63,94,0.5)]">
              {error}
            </div>
          ) : null}
          {isInitialLoad ? (
            <div className="rounded-[28px] border border-slate-200/90 bg-white/85 px-5 py-10 text-center text-sm text-slate-500 shadow-[0_20px_44px_-32px_rgba(15,23,42,0.35)]">
              Loading live machine data...
            </div>
          ) : (
            <div className="grid gap-4 min-[1500px]:grid-cols-[minmax(0,1fr)_360px] min-[1500px]:items-start">
              <MachineGrid
                machines={sortedMachines}
                currentTimeMs={currentTimeMs}
              />
              <OperatorLeaderboard
                machines={sortedMachines}
                machineReport={machineReport}
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
