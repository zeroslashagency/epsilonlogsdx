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
import { MachineCard } from "./components/MachineCard";
import { MachineOverviewHeader } from "./components/MachineOverviewHeader";
import { OperatorLeaderboard } from "./components/OperatorLeaderboard";
import { fetchLiveMachineCards } from "./data/liveMachineData";
import {
  formatElapsedHoursAgo,
  formatRefreshTime,
  formatTime24Hours,
} from "./lib/time";
import "./machine-overview-shop.css";

const AUTO_REFRESH_RATE_MS = 30_000;
const MAX_FAILURE_BACKOFF_MS = 5 * 60 * 1000;
const PAGE_TWO_SLIDES = ["2.1", "2.2", "2.3"] as const;
const PAGE_TWO_SLIDESHOW_RATE_MS = 15_000;
const API_TOKEN = import.meta.env.VITE_API_TOKEN as string | undefined;
const MACHINE_CACHE_KEY = "machine-overview-shop.live-cache";
const MACHINE_CACHE_TTL_MS = 5 * 60 * 1000;
const PERSISTED_MACHINE_CACHE_MAX_AGE_MS = 60 * 60 * 1000;
const OFFLINE_PAUSED_MESSAGE =
  "Offline. Auto refresh is paused until the connection returns.";

type DashboardPage = "page-1" | "page-2";
type PageTwoSlide = (typeof PAGE_TWO_SLIDES)[number];

interface CachedDashboardState {
  cachedAt: number;
  lastRefreshedAt: string;
  machines: MachineCardRecord[];
  machineReport: MachineReportEntry[];
}

function emptyCachedDashboardState(): {
  cachedAt: number | null;
  machines: MachineCardRecord[];
  machineReport: MachineReportEntry[];
  lastRefreshedAt: Date | null;
} {
  return {
    cachedAt: null,
    machines: [],
    machineReport: [],
    lastRefreshedAt: null,
  };
}

function readCachedDashboardStateFromStorage(
  storage: Storage,
): {
  cachedAt: number | null;
  machines: MachineCardRecord[];
  machineReport: MachineReportEntry[];
  lastRefreshedAt: Date | null;
} {
  try {
    const rawValue = storage.getItem(MACHINE_CACHE_KEY);
    if (!rawValue) {
      return emptyCachedDashboardState();
    }

    const parsed = JSON.parse(rawValue) as CachedDashboardState;
    if (
      !parsed ||
      !Array.isArray(parsed.machines) ||
      !Array.isArray(parsed.machineReport) ||
      typeof parsed.cachedAt !== "number" ||
      typeof parsed.lastRefreshedAt !== "string"
    ) {
      return emptyCachedDashboardState();
    }

    if (Date.now() - parsed.cachedAt > PERSISTED_MACHINE_CACHE_MAX_AGE_MS) {
      return emptyCachedDashboardState();
    }

    const lastRefreshedAt = new Date(parsed.lastRefreshedAt);
    return {
      cachedAt: parsed.cachedAt,
      machines: parsed.machines,
      machineReport: parsed.machineReport,
      lastRefreshedAt: Number.isFinite(lastRefreshedAt.getTime())
        ? lastRefreshedAt
        : null,
    };
  } catch {
    return emptyCachedDashboardState();
  }
}

function readCachedDashboardState(): {
  cachedAt: number | null;
  machines: MachineCardRecord[];
  machineReport: MachineReportEntry[];
  lastRefreshedAt: Date | null;
} {
  if (typeof window === "undefined") {
    return emptyCachedDashboardState();
  }

  const cachedStates = [
    readCachedDashboardStateFromStorage(window.sessionStorage),
    readCachedDashboardStateFromStorage(window.localStorage),
  ].filter((cachedState) => cachedState.cachedAt !== null);

  if (cachedStates.length === 0) {
    return emptyCachedDashboardState();
  }

  cachedStates.sort(
    (left, right) => (right.cachedAt ?? 0) - (left.cachedAt ?? 0),
  );
  return cachedStates[0] ?? emptyCachedDashboardState();
}

function writeCachedDashboardState(nextState: CachedDashboardState) {
  if (typeof window === "undefined") {
    return;
  }

  const serializedState = JSON.stringify(nextState);

  try {
    window.sessionStorage.setItem(MACHINE_CACHE_KEY, serializedState);
  } catch {
    // Ignore storage quota and privacy-mode errors.
  }

  try {
    window.localStorage.setItem(MACHINE_CACHE_KEY, serializedState);
  } catch {
    // Ignore storage quota and privacy-mode errors.
  }
}

export default function MachineOverviewPage() {
  const cachedDashboardState = useMemo(() => readCachedDashboardState(), []);
  const cachedRefreshAgeMs = useMemo(() => {
    if (cachedDashboardState.cachedAt === null) {
      return null;
    }

    return Math.max(0, Date.now() - cachedDashboardState.cachedAt);
  }, [cachedDashboardState.cachedAt]);
  const autoRefreshTimeoutRef = useRef<number | null>(null);
  const liveClockIntervalRef = useRef<number | null>(null);
  const pageTwoSlideshowIntervalRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const consecutiveFailureCountRef = useRef(0);
  const hasVisibleDashboardDataRef = useRef(
    cachedDashboardState.machines.length > 0,
  );
  const isDocumentHiddenRef = useRef(
    typeof document !== "undefined" ? document.hidden : false,
  );
  const isBrowserOnlineRef = useRef(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const isRefreshingRef = useRef(false);
  const scheduleNextRefreshRef = useRef<(delayMs?: number) => void>(() => {});
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [activePage, setActivePage] = useState<DashboardPage>("page-1");
  const [activePageTwoSlide, setActivePageTwoSlide] = useState<PageTwoSlide>("2.1");
  const [isPageTwoSlideshowPlaying, setIsPageTwoSlideshowPlaying] =
    useState(false);
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
  const pageTwoMachinesTop = useMemo(
    () => sortedMachines.slice(0, 4),
    [sortedMachines],
  );
  const pageTwoMachinesBottom = useMemo(
    () => sortedMachines.slice(4, 8),
    [sortedMachines],
  );

  const clearAutoRefreshTimeout = useCallback(() => {
    if (autoRefreshTimeoutRef.current !== null) {
      window.clearTimeout(autoRefreshTimeoutRef.current);
      autoRefreshTimeoutRef.current = null;
    }
  }, []);

  const pauseAutoRefreshForOffline = useCallback(() => {
    isBrowserOnlineRef.current = false;
    consecutiveFailureCountRef.current = 0;
    clearAutoRefreshTimeout();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isRefreshingRef.current = false;
    setIsRefreshing(false);
    setError(OFFLINE_PAUSED_MESSAGE);
  }, [clearAutoRefreshTimeout]);

  const getFailureBackoffDelayMs = useCallback((failureCount: number) => {
    return Math.min(
      AUTO_REFRESH_RATE_MS * 2 ** failureCount,
      MAX_FAILURE_BACKOFF_MS,
    );
  }, []);

  const loadMachines = useCallback(
    async (reason: "auto" | "initial" | "manual" | "online" | "visibility") => {
      if (isRefreshingRef.current) {
        return;
      }

      if (!API_TOKEN) {
        clearAutoRefreshTimeout();
        setMachines([]);
        setMachineReport([]);
        hasVisibleDashboardDataRef.current = false;
        isRefreshingRef.current = false;
        setIsRefreshing(false);
        setError(
          "Missing VITE_API_TOKEN. Add it to /Users/xoxo/Desktop/machine-overview-shop/.env.local to enable live machine data.",
        );
        return;
      }

      if (reason !== "manual" && isDocumentHiddenRef.current) {
        return;
      }

      if (!isBrowserOnlineRef.current) {
        clearAutoRefreshTimeout();
        setIsRefreshing(false);
        setError(OFFLINE_PAUSED_MESSAGE);
        return;
      }

      clearAutoRefreshTimeout();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      const shouldStreamInitialProgress =
        reason === "initial" && !hasVisibleDashboardDataRef.current;
      let nextRefreshDelayMs: number | null = null;

      try {
        const result = await fetchLiveMachineCards({
          token: API_TOKEN,
          signal: controller.signal,
          ...(shouldStreamInitialProgress
            ? {
                onProgress: (partialResult: {
                  machines: MachineCardRecord[];
                  machineReport: MachineReportEntry[];
                  errors: string[];
                }) => {
                  if (
                    controller.signal.aborted ||
                    partialResult.machines.length === 0
                  ) {
                    return;
                  }

                  hasVisibleDashboardDataRef.current = true;
                  setMachines(partialResult.machines);
                  setMachineReport(partialResult.machineReport);
                  setError(
                    partialResult.errors.length > 0
                      ? `Partial data loaded. ${partialResult.errors.join(" · ")}`
                      : null,
                  );
                },
              }
            : {}),
        });

        if (controller.signal.aborted) {
          return;
        }

        hasVisibleDashboardDataRef.current = result.machines.length > 0;
        setMachines(result.machines);
        setMachineReport(result.machineReport);
        consecutiveFailureCountRef.current = 0;
        setError(
          result.errors.length > 0
            ? `Partial data loaded. ${result.errors.join(" · ")}`
            : null,
        );
        const refreshedAt = new Date();
        setLastRefreshedAt(refreshedAt);
        writeCachedDashboardState({
          cachedAt: Date.now(),
          lastRefreshedAt: refreshedAt.toISOString(),
          machines: result.machines,
          machineReport: result.machineReport,
        });
        nextRefreshDelayMs = AUTO_REFRESH_RATE_MS;
      } catch (nextError) {
        if (controller.signal.aborted) {
          return;
        }

        const browserIsOnline =
          typeof navigator === "undefined" ? true : navigator.onLine;
        if (!browserIsOnline) {
          isBrowserOnlineRef.current = false;
          consecutiveFailureCountRef.current = 0;
          setError(OFFLINE_PAUSED_MESSAGE);
          return;
        }

        consecutiveFailureCountRef.current += 1;
        nextRefreshDelayMs = getFailureBackoffDelayMs(
          consecutiveFailureCountRef.current,
        );
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to refresh live machine data.",
        );
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        isRefreshingRef.current = false;
        setIsRefreshing(false);

        if (
          !controller.signal.aborted &&
          nextRefreshDelayMs !== null &&
          isBrowserOnlineRef.current
        ) {
          scheduleNextRefreshRef.current(nextRefreshDelayMs);
        }
      }
    },
    [clearAutoRefreshTimeout, getFailureBackoffDelayMs],
  );

  const scheduleNextRefresh = useCallback((delayMs = AUTO_REFRESH_RATE_MS) => {
    clearAutoRefreshTimeout();

    if (
      typeof window === "undefined" ||
      isDocumentHiddenRef.current ||
      !API_TOKEN ||
      !isBrowserOnlineRef.current
    ) {
      return;
    }

    autoRefreshTimeoutRef.current = window.setTimeout(() => {
      void loadMachines("auto");
    }, Math.max(0, delayMs));
  }, [clearAutoRefreshTimeout, loadMachines]);
  scheduleNextRefreshRef.current = scheduleNextRefresh;

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
    if (!API_TOKEN) {
      void loadMachines("initial");
      return;
    }

    if (
      cachedRefreshAgeMs !== null &&
      cachedRefreshAgeMs < AUTO_REFRESH_RATE_MS &&
      cachedDashboardState.machines.length > 0
    ) {
      scheduleNextRefresh(AUTO_REFRESH_RATE_MS - cachedRefreshAgeMs);
      return;
    }

    void loadMachines("initial");
  }, [
    cachedDashboardState.machines.length,
    cachedRefreshAgeMs,
    loadMachines,
    scheduleNextRefresh,
  ]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    function handleVisibilityChange() {
      isDocumentHiddenRef.current = document.hidden;

      if (document.hidden) {
        clearAutoRefreshTimeout();
        return;
      }

      if (isRefreshingRef.current) {
        return;
      }

      void loadMachines("visibility");
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearAutoRefreshTimeout, loadMachines]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleOffline() {
      pauseAutoRefreshForOffline();
    }

    function handleOnline() {
      isBrowserOnlineRef.current = true;
      consecutiveFailureCountRef.current = 0;

      if (isDocumentHiddenRef.current || isRefreshingRef.current) {
        return;
      }

      void loadMachines("online");
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [loadMachines, pauseAutoRefreshForOffline]);

  useEffect(() => {
    return () => {
      clearAutoRefreshTimeout();
      abortControllerRef.current?.abort();
    };
  }, [clearAutoRefreshTimeout]);

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

  useEffect(() => {
    if (pageTwoSlideshowIntervalRef.current !== null) {
      window.clearInterval(pageTwoSlideshowIntervalRef.current);
      pageTwoSlideshowIntervalRef.current = null;
    }

    if (activePage !== "page-2" || !isPageTwoSlideshowPlaying) {
      return;
    }

    pageTwoSlideshowIntervalRef.current = window.setInterval(() => {
      setActivePageTwoSlide((currentSlide) => {
        const currentIndex = PAGE_TWO_SLIDES.indexOf(currentSlide);
        const nextIndex = (currentIndex + 1) % PAGE_TWO_SLIDES.length;
        return PAGE_TWO_SLIDES[nextIndex] ?? PAGE_TWO_SLIDES[0];
      });
    }, PAGE_TWO_SLIDESHOW_RATE_MS);

    return () => {
      if (pageTwoSlideshowIntervalRef.current !== null) {
        window.clearInterval(pageTwoSlideshowIntervalRef.current);
        pageTwoSlideshowIntervalRef.current = null;
      }
    };
  }, [activePage, activePageTwoSlide, isPageTwoSlideshowPlaying]);

  function handleRefresh() {
    void loadMachines("manual");
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

  function handleSelectPage(page: DashboardPage) {
    setActivePage(page);

    if (page === "page-1") {
      setIsPageTwoSlideshowPlaying(false);
      return;
    }

    setActivePageTwoSlide("2.1");
  }

  function handleSelectPageTwoSlide(slide: PageTwoSlide) {
    setActivePage("page-2");
    setActivePageTwoSlide(slide);
  }

  async function handleTogglePageTwoSlideshow() {
    if (activePage !== "page-2") {
      setActivePage("page-2");
      setActivePageTwoSlide("2.1");
    }

    const nextPlaying = !isPageTwoSlideshowPlaying;
    setIsPageTwoSlideshowPlaying(nextPlaying);

    if (
      nextPlaying &&
      typeof document !== "undefined" &&
      !document.fullscreenElement
    ) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Ignore fullscreen errors and continue the slideshow.
      }
    }
  }

  const isInitialLoad = sortedMachines.length === 0 && !error;
  const lastRefreshLabel = lastRefreshedAt
    ? isRefreshing
      ? "Refreshing..."
      : `Last refresh: ${formatRefreshTime(lastRefreshedAt)}`
    : isRefreshing
      ? "Refreshing..."
      : "Waiting for first refresh...";
  const machineReportReferenceDate = lastRefreshedAt ?? new Date(currentTimeMs);
  const machineReportStartDate = new Date(machineReportReferenceDate);
  machineReportStartDate.setHours(0, 0, 0, 0);
  const machineReportStartLabel = formatTime24Hours(machineReportStartDate);
  const machineReportAgeLabel = formatElapsedHoursAgo(
    machineReportStartDate,
    currentTimeMs,
  );

  const pageTwoSlidePosition = PAGE_TWO_SLIDES.indexOf(activePageTwoSlide) + 1;

  function renderPageTwoMachineSlide(
    slide: PageTwoSlide,
    title: string,
    subtitle: string,
    slideMachines: MachineCardRecord[],
  ) {
    return (
      <section
        key={slide}
        className="machine-overview-shop-slide-panel space-y-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-[24px] border border-white/80 bg-white/82 px-4 py-3 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.34)] backdrop-blur">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
              PAGE 2 · SLIDE {slide}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.045em] text-slate-800">
              {title}
            </h2>
          </div>
          <p className="text-sm font-medium text-slate-500">{subtitle}</p>
        </div>

        <div className="grid auto-rows-fr gap-4 xl:grid-cols-2">
          {slideMachines.map((machine, index) => (
            <div
              key={machine.machineId}
              className="machine-overview-shop-card-enter h-full"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <MachineCard machine={machine} currentTimeMs={currentTimeMs} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="machine-overview-shop-page">
      <main className="machine-overview-shop-board min-h-screen">
        <section className="mx-auto w-full max-w-[2240px] px-3 py-5 sm:px-4 sm:py-6 lg:px-4 xl:px-5 2xl:px-6">
          <MachineOverviewHeader
            activePage={activePage}
            activePageTwoSlide={activePageTwoSlide}
            isRefreshing={isRefreshing}
            isFullscreen={isFullscreen}
            isPageTwoSlideshowPlaying={isPageTwoSlideshowPlaying}
            lastRefreshLabel={lastRefreshLabel}
            onSelectPage={handleSelectPage}
            onSelectPageTwoSlide={handleSelectPageTwoSlide}
            onRefresh={handleRefresh}
            onTogglePageTwoSlideshow={handleTogglePageTwoSlideshow}
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
            <>
              {activePage === "page-1" ? (
                <div className="grid gap-4 min-[1500px]:grid-cols-[minmax(0,1fr)_360px] min-[1500px]:items-start">
                  <MachineGrid
                    machines={sortedMachines}
                    currentTimeMs={currentTimeMs}
                  />
                  <OperatorLeaderboard
                    machines={sortedMachines}
                    machineReport={machineReport}
                    machineReportStartLabel={machineReportStartLabel}
                    machineReportAgeLabel={machineReportAgeLabel}
                  />
                </div>
              ) : (
                <div key={activePageTwoSlide}>
                  {activePageTwoSlide === "2.1"
                    ? renderPageTwoMachineSlide(
                        "2.1",
                        "Machines 1 to 4",
                        `Slide ${pageTwoSlidePosition} of ${PAGE_TWO_SLIDES.length} · ${isPageTwoSlideshowPlaying ? "Slideshow playing every 15s" : "Manual slide mode"}`,
                        pageTwoMachinesTop,
                      )
                    : null}

                  {activePageTwoSlide === "2.2"
                    ? renderPageTwoMachineSlide(
                        "2.2",
                        "Machines 5 to CNC 1",
                        `Slide ${pageTwoSlidePosition} of ${PAGE_TWO_SLIDES.length} · ${isPageTwoSlideshowPlaying ? "Slideshow playing every 15s" : "Manual slide mode"}`,
                        pageTwoMachinesBottom,
                      )
                    : null}

                  {activePageTwoSlide === "2.3" ? (
                    <section
                      key="2.3"
                      className="machine-overview-shop-slide-panel space-y-4"
                    >
                      <div className="flex flex-wrap items-end justify-between gap-3 rounded-[24px] border border-white/80 bg-white/82 px-4 py-3 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.34)] backdrop-blur">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
                            PAGE 2 · SLIDE 2.3
                          </p>
                          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.045em] text-slate-800">
                            Right Side Leaderboard
                          </h2>
                        </div>
                        <p className="text-sm font-medium text-slate-500">
                          Slide {pageTwoSlidePosition} of {PAGE_TWO_SLIDES.length} ·{" "}
                          {isPageTwoSlideshowPlaying
                            ? "Slideshow playing every 15s"
                            : "Manual slide mode"}
                        </p>
                      </div>

                      <OperatorLeaderboard
                        machines={sortedMachines}
                        machineReport={machineReport}
                        machineReportStartLabel={machineReportStartLabel}
                        machineReportAgeLabel={machineReportAgeLabel}
                        variant="slide"
                      />
                    </section>
                  ) : null}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
