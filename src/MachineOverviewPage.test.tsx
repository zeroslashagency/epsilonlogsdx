import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  sampleDashboardResponse,
  MACHINE_CACHE_KEY,
  writeCachedDashboardState,
} from "./test/dashboardFixtures";

const fetchLiveMachineCardsMock = vi.hoisted(() => vi.fn());

vi.mock("./data/liveMachineData", () => ({
  fetchLiveMachineCards: fetchLiveMachineCardsMock,
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

async function renderMachineOverviewPage() {
  const module = await import("./MachineOverviewPage");
  return render(<module.default />);
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("MachineOverviewPage request scheduling", () => {
  let hiddenState = false;
  let onlineState = true;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-27T10:15:00.000Z"));
    vi.stubEnv("VITE_API_TOKEN", "test-token");
    vi.resetModules();
    hiddenState = false;
    onlineState = true;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hiddenState,
    });
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => onlineState,
    });
    window.sessionStorage.clear();
    window.localStorage.clear();
    fetchLiveMachineCardsMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    window.sessionStorage.clear();
    window.localStorage.clear();
    Reflect.deleteProperty(document, "hidden");
    Reflect.deleteProperty(window.navigator, "onLine");
  });

  it("keeps the same visible dashboard content after the request-lifecycle change", async () => {
    fetchLiveMachineCardsMock.mockResolvedValue(sampleDashboardResponse);

    await renderMachineOverviewPage();
    await flushPromises();

    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("PALANISAMY")).toBeInTheDocument();
    expect(screen.getByText("WO-3038")).toBeInTheDocument();
    expect(screen.getByText("PART-1")).toBeInTheDocument();
    expect(screen.getByText("Pause Alert")).toBeInTheDocument();
    expect(screen.getByText("Tool change")).toBeInTheDocument();
    expect(screen.getByText("Production Operator")).toBeInTheDocument();
    expect(screen.getByText("Machine Report")).toBeInTheDocument();
  });

  it("skips the immediate mount refresh when the cache is still fresh", async () => {
    writeCachedDashboardState(Date.now() - 5_000);
    fetchLiveMachineCardsMock.mockResolvedValue(sampleDashboardResponse);

    await renderMachineOverviewPage();
    await flushPromises();

    expect(fetchLiveMachineCardsMock).not.toHaveBeenCalled();
    expect(screen.getByText("WO-3038")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(24_999);
    });
    await flushPromises();
    expect(fetchLiveMachineCardsMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(1);
  });

  it("hydrates from persistent cache immediately and revalidates in the background when that cache is stale", async () => {
    const deferredRefresh = createDeferred<typeof sampleDashboardResponse>();
    writeCachedDashboardState(Date.now() - 10 * 60_000, window.localStorage);
    fetchLiveMachineCardsMock.mockImplementationOnce(() => deferredRefresh.promise);

    await renderMachineOverviewPage();
    expect(screen.getByText("WO-3038")).toBeInTheDocument();

    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferredRefresh.resolve(sampleDashboardResponse);
    });
    await flushPromises();
    expect(screen.getByText("WO-3038")).toBeInTheDocument();
  });

  it("writes the last successful dashboard snapshot to persistent cache", async () => {
    fetchLiveMachineCardsMock.mockResolvedValue(sampleDashboardResponse);

    await renderMachineOverviewPage();
    await flushPromises();

    const persistedCache = window.localStorage.getItem(MACHINE_CACHE_KEY);
    expect(persistedCache).not.toBeNull();
    expect(JSON.parse(persistedCache ?? "{}")).toMatchObject({
      machines: sampleDashboardResponse.machines,
      machineReport: sampleDashboardResponse.machineReport,
    });
  });

  it("renders partial machine cards before the full cold-start refresh completes", async () => {
    const fullLoad = createDeferred<typeof sampleDashboardResponse>();
    fetchLiveMachineCardsMock.mockImplementationOnce((options?: {
      onProgress?: (result: typeof sampleDashboardResponse) => void;
    }) => {
      options?.onProgress?.({
        machines: [sampleDashboardResponse.machines[0]!],
        machineReport: [],
        errors: [],
      });

      return fullLoad.promise;
    });

    await renderMachineOverviewPage();
    await flushPromises();

    expect(screen.getByText("VMC 1")).toBeInTheDocument();
    expect(screen.getByText("PALANISAMY")).toBeInTheDocument();
    expect(screen.queryByText("VMC 2")).not.toBeInTheDocument();

    await act(async () => {
      fullLoad.resolve(sampleDashboardResponse);
    });
    await flushPromises();

    expect(screen.getByText("SURESH")).toBeInTheDocument();
  });

  it("pauses auto refresh while the tab is hidden and refreshes once on visibility restore", async () => {
    fetchLiveMachineCardsMock.mockResolvedValue(sampleDashboardResponse);

    await renderMachineOverviewPage();
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(1);

    hiddenState = true;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(1);

    hiddenState = false;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(2);
  });

  it("does not start overlapping auto refreshes while a request is still in flight", async () => {
    const firstLoad = createDeferred<typeof sampleDashboardResponse>();
    fetchLiveMachineCardsMock
      .mockImplementationOnce(() => firstLoad.promise)
      .mockResolvedValue(sampleDashboardResponse);

    await renderMachineOverviewPage();
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstLoad.resolve(sampleDashboardResponse);
    });
    await flushPromises();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_999);
    });
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(2);
  });

  it("backs off repeated refresh failures instead of retrying every 30 seconds", async () => {
    fetchLiveMachineCardsMock.mockRejectedValue(new Error("Failed to fetch"));

    await renderMachineOverviewPage();
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Failed to fetch")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_999);
    });
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(119_999);
    });
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(3);
  });

  it("pauses auto refresh while the browser is offline and refreshes once when it returns online", async () => {
    fetchLiveMachineCardsMock.mockResolvedValue(sampleDashboardResponse);

    await renderMachineOverviewPage();
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(1);

    onlineState = false;
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    await flushPromises();
    expect(
      screen.getByText("Offline. Auto refresh is paused until the connection returns."),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(1);

    onlineState = true;
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await flushPromises();
    expect(fetchLiveMachineCardsMock).toHaveBeenCalledTimes(2);
  });
});
