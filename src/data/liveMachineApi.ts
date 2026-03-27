export interface DeviceLogEntry {
  log_id?: number;
  id?: number;
  log_time: string;
  action: string;
  wo_id?: number | null;
  wo_name?: string | null;
  part_no?: string | null;
  device_id: number;
  pcl?: string | number | null;
  start_name?: string | null;
  start_comment?: string | null;
  stop_comment?: string | null;
  job_type?: string | number | null;
}

interface DeviceLogApiResponse {
  success: boolean;
  result?: {
    logs?: DeviceLogEntry[];
    pagination?: {
      total_pages?: number;
    };
  };
  error?: {
    message?: string;
  };
}

export interface WoDetails {
  id: number;
  wo_id_str: string;
  start_name: string;
  start_uid: number | null;
  start_comment: string;
  stop_comment: string;
  job_type: number | null;
  pcl: number | null;
  target_duration: number | null;
  duration: number | null;
  ok_qty: number | null;
  reject_qty: number | null;
  status: string | null;
}

interface WoApiResponse {
  success: boolean;
  result?: {
    wo?: {
      id?: number;
      wo_id?: string | number | null;
      start_name?: string | null;
      start_uid?: number | null;
      start_comment?: string | null;
      start_remarks?: string | null;
      start_reason?: string | null;
      stop_comment?: string | null;
      stop_remarks?: string | null;
      stop_reason?: string | null;
      job_type?: number | null;
      pcl?: number | null;
      target_duration?: number | null;
      duration?: number | null;
      ok_qty?: number | null;
      reject_qty?: number | null;
      status?: string | null;
    };
  };
  error?: {
    message?: string;
  };
}

const API_BASE_URL = "/api/v2";
const MAX_CURRENT_WO_PAGES = 12;
const PAGE_BATCH_SIZE = 3;
const DEFAULT_LATEST_PAGES_BACK = 2;
const DEVICE_LOG_TOTAL_PAGES_STORAGE_KEY = "machine-overview-device-log-total-pages";

const deviceLogTotalPagesMemoryCache = new Map<string, number>();

export interface DeviceLogsConfig {
  deviceId: number;
  startDate: string;
  endDate: string;
}

export function resetDeviceLogTotalPagesCache() {
  deviceLogTotalPagesMemoryCache.clear();

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(DEVICE_LOG_TOTAL_PAGES_STORAGE_KEY);
  } catch {
    return;
  }
}

function getDeviceLogTotalPagesCacheKey(config: DeviceLogsConfig) {
  return `${config.deviceId}:${config.startDate}`;
}

function readPersistedDeviceLogTotalPages(): Record<string, number> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(
      DEVICE_LOG_TOTAL_PAGES_STORAGE_KEY,
    );
    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== "object") {
      return {};
    }

    return Object.entries(parsedValue).reduce<Record<string, number>>(
      (accumulator, [key, value]) => {
        if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
          accumulator[key] = Math.max(1, Math.trunc(value));
        }
        return accumulator;
      },
      {},
    );
  } catch {
    return {};
  }
}

function readCachedDeviceLogTotalPages(config: DeviceLogsConfig): number | null {
  const cacheKey = getDeviceLogTotalPagesCacheKey(config);
  const memoryValue = deviceLogTotalPagesMemoryCache.get(cacheKey);
  if (typeof memoryValue === "number" && Number.isFinite(memoryValue)) {
    return memoryValue;
  }

  const persistedValue = readPersistedDeviceLogTotalPages()[cacheKey];
  if (typeof persistedValue === "number" && Number.isFinite(persistedValue)) {
    deviceLogTotalPagesMemoryCache.set(cacheKey, persistedValue);
    return persistedValue;
  }

  return null;
}

function writeCachedDeviceLogTotalPages(
  config: DeviceLogsConfig,
  totalPages: number,
) {
  const normalizedTotalPages = Math.max(1, Math.trunc(totalPages));
  const cacheKey = getDeviceLogTotalPagesCacheKey(config);
  deviceLogTotalPagesMemoryCache.set(cacheKey, normalizedTotalPages);

  if (typeof window === "undefined") {
    return;
  }

  const nextPersistedValue = {
    ...readPersistedDeviceLogTotalPages(),
    [cacheKey]: normalizedTotalPages,
  };

  try {
    window.localStorage.setItem(
      DEVICE_LOG_TOTAL_PAGES_STORAGE_KEY,
      JSON.stringify(nextPersistedValue),
    );
  } catch {
    return;
  }
}

function buildAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function sortLogsDescending(logs: DeviceLogEntry[]): DeviceLogEntry[] {
  return [...logs].sort((left, right) => {
    return (
      new Date(right.log_time).getTime() - new Date(left.log_time).getTime()
    );
  });
}

function dedupeLogs(logs: DeviceLogEntry[]): DeviceLogEntry[] {
  const seen = new Set<string>();
  const uniqueLogs: DeviceLogEntry[] = [];

  for (const log of logs) {
    const key = String(
      log.log_id ?? log.id ?? `${log.device_id}:${log.log_time}:${log.action}`,
    );
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueLogs.push(log);
  }

  return uniqueLogs;
}

async function fetchDeviceLogPage(
  page: number,
  config: DeviceLogsConfig,
  token: string,
  signal?: AbortSignal,
): Promise<{ logs: DeviceLogEntry[]; totalPages: number }> {
  const params = new URLSearchParams({
    start_date: config.startDate,
    end_date: config.endDate,
    device_id: String(config.deviceId),
    page: String(page),
  });

  const response = await fetch(`${API_BASE_URL}/device-log?${params.toString()}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
    signal: signal ?? null,
  });

  if (!response.ok) {
    throw new Error(
      `Device Log API Error: ${response.status} ${response.statusText}`,
    );
  }

  const json: DeviceLogApiResponse = await response.json();
  if (!json.success || !json.result?.logs) {
    throw new Error(json.error?.message ?? "Failed to fetch device logs");
  }

  return {
    logs: json.result.logs,
    totalPages: Math.max(1, json.result.pagination?.total_pages ?? 1),
  };
}

async function fetchLatestDeviceLogsFromCachedTotalPages(
  config: DeviceLogsConfig,
  token: string,
  signal: AbortSignal | undefined,
  cachedTotalPages: number,
  pagesBack: number,
): Promise<{ logs: DeviceLogEntry[]; totalPages: number }> {
  const requestedStartPage = Math.max(2, cachedTotalPages - pagesBack + 1);
  const requestedPageNumbers = Array.from(
    { length: cachedTotalPages - requestedStartPage + 1 },
    (_, index) => requestedStartPage + index,
  );
  const requestedPageResults = await Promise.all(
    requestedPageNumbers.map(async (pageNumber) => ({
      pageNumber,
      result: await fetchDeviceLogPage(pageNumber, config, token, signal),
    })),
  );
  const actualTotalPages = Math.max(
    1,
    ...requestedPageResults.map(({ result }) => result.totalPages),
  );
  writeCachedDeviceLogTotalPages(config, actualTotalPages);

  if (actualTotalPages === cachedTotalPages) {
    return {
      logs: sortLogsDescending(
        dedupeLogs(
          requestedPageResults.flatMap(({ result }) => result.logs),
        ),
      ),
      totalPages: actualTotalPages,
    };
  }

  if (actualTotalPages <= 1) {
    const newestPageResult = requestedPageResults.at(-1)?.result;
    return {
      logs: sortLogsDescending(dedupeLogs(newestPageResult?.logs ?? [])),
      totalPages: actualTotalPages,
    };
  }

  const actualStartPage = Math.max(2, actualTotalPages - pagesBack + 1);
  const actualLatestPageNumbers = Array.from(
    { length: actualTotalPages - actualStartPage + 1 },
    (_, index) => actualStartPage + index,
  );
  const pageResultsByNumber = new Map(
    requestedPageResults.map(({ pageNumber, result }) => [pageNumber, result]),
  );
  const missingPageNumbers = actualLatestPageNumbers.filter(
    (pageNumber) => !pageResultsByNumber.has(pageNumber),
  );

  if (missingPageNumbers.length > 0) {
    const missingPageResults = await Promise.all(
      missingPageNumbers.map(async (pageNumber) => ({
        pageNumber,
        result: await fetchDeviceLogPage(pageNumber, config, token, signal),
      })),
    );
    for (const { pageNumber, result } of missingPageResults) {
      pageResultsByNumber.set(pageNumber, result);
    }
  }

  return {
    logs: sortLogsDescending(
      dedupeLogs(
        actualLatestPageNumbers.flatMap(
          (pageNumber) => pageResultsByNumber.get(pageNumber)?.logs ?? [],
        ),
      ),
    ),
    totalPages: actualTotalPages,
  };
}

export async function fetchLatestDeviceLogs(
  config: DeviceLogsConfig,
  token: string,
  signal?: AbortSignal,
  pagesBack = DEFAULT_LATEST_PAGES_BACK,
): Promise<{ logs: DeviceLogEntry[]; totalPages: number }> {
  const cachedTotalPages = readCachedDeviceLogTotalPages(config);
  if (
    typeof cachedTotalPages === "number" &&
    Number.isFinite(cachedTotalPages) &&
    cachedTotalPages > 1
  ) {
    try {
      return await fetchLatestDeviceLogsFromCachedTotalPages(
        config,
        token,
        signal,
        cachedTotalPages,
        pagesBack,
      );
    } catch {
      // Fall back to the legacy pagination discovery path when cached totals drift.
    }
  }

  const firstPage = await fetchDeviceLogPage(1, config, token, signal);
  writeCachedDeviceLogTotalPages(config, firstPage.totalPages);

  if (firstPage.totalPages <= 1) {
    return {
      logs: sortLogsDescending(dedupeLogs(firstPage.logs)),
      totalPages: firstPage.totalPages,
    };
  }

  const startPage = Math.max(2, firstPage.totalPages - pagesBack + 1);
  const latestPageNumbers = Array.from(
    { length: firstPage.totalPages - startPage + 1 },
    (_, index) => startPage + index,
  );
  const latestPageResults = await Promise.all(
    latestPageNumbers.map((pageNumber) =>
      fetchDeviceLogPage(pageNumber, config, token, signal),
    ),
  );

  return {
    logs: sortLogsDescending(
      dedupeLogs(latestPageResults.flatMap((result) => result.logs)),
    ),
    totalPages: firstPage.totalPages,
  };
}

export async function fetchCurrentWorkOrderLogs(
  config: DeviceLogsConfig,
  token: string,
  signal?: AbortSignal,
): Promise<DeviceLogEntry[]> {
  const latestPages = await fetchLatestDeviceLogs(
    config,
    token,
    signal,
    DEFAULT_LATEST_PAGES_BACK,
  );
  const aggregatedLogs = [...latestPages.logs];
  const currentWoInternalId =
    typeof latestPages.logs[0]?.wo_id === "number" && latestPages.logs[0].wo_id > 0
      ? latestPages.logs[0].wo_id
      : null;

  if (currentWoInternalId === null || latestPages.totalPages <= 1) {
    return sortLogsDescending(dedupeLogs(aggregatedLogs));
  }

  const initialStartPage = Math.max(
    2,
    latestPages.totalPages - DEFAULT_LATEST_PAGES_BACK + 1,
  );
  let nextPageNumber = Math.min(initialStartPage - 1, latestPages.totalPages);
  let remainingPages = Math.max(
    0,
    MAX_CURRENT_WO_PAGES - DEFAULT_LATEST_PAGES_BACK,
  );
  let shouldStop = false;

  while (nextPageNumber >= 1 && remainingPages > 0 && !shouldStop) {
    const batchPages = Array.from(
      {
        length: Math.min(PAGE_BATCH_SIZE, nextPageNumber, remainingPages),
      },
      (_, index) => nextPageNumber - index,
    );
    const batchResults = await Promise.all(
      batchPages.map((pageNumber) =>
        fetchDeviceLogPage(pageNumber, config, token, signal),
      ),
    );

    for (const batchResult of batchResults) {
      aggregatedLogs.push(...batchResult.logs);

      const pageHasCurrentWorkOrder = batchResult.logs.some(
        (log) => log.wo_id === currentWoInternalId,
      );
      if (!pageHasCurrentWorkOrder) {
        shouldStop = true;
        break;
      }
    }

    nextPageNumber -= batchPages.length;
    remainingPages -= batchPages.length;
  }

  return sortLogsDescending(dedupeLogs(aggregatedLogs));
}

export async function fetchWoDetails(
  woInternalId: number,
  token: string,
  signal?: AbortSignal,
): Promise<WoDetails | null> {
  const response = await fetch(`${API_BASE_URL}/wo/${woInternalId}`, {
    headers: buildAuthHeaders(token),
    signal: signal ?? null,
  });

  if (!response.ok) {
    return null;
  }

  const json: WoApiResponse = await response.json();
  const wo = json.result?.wo;
  if (!json.success || !wo) {
    return null;
  }

  return {
    id: typeof wo.id === "number" ? wo.id : woInternalId,
    wo_id_str: String(wo.wo_id ?? woInternalId),
    start_name: typeof wo.start_name === "string" ? wo.start_name : "",
    start_uid: typeof wo.start_uid === "number" ? wo.start_uid : null,
    start_comment:
      wo.start_comment || wo.start_remarks || wo.start_reason || "",
    stop_comment: wo.stop_comment || wo.stop_remarks || wo.stop_reason || "",
    job_type: typeof wo.job_type === "number" ? wo.job_type : null,
    pcl: typeof wo.pcl === "number" ? wo.pcl : null,
    target_duration:
      typeof wo.target_duration === "number" ? wo.target_duration : null,
    duration: typeof wo.duration === "number" ? wo.duration : null,
    ok_qty: typeof wo.ok_qty === "number" ? wo.ok_qty : null,
    reject_qty: typeof wo.reject_qty === "number" ? wo.reject_qty : null,
    status: typeof wo.status === "string" ? wo.status : null,
  };
}

export function formatDateForApi(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}
