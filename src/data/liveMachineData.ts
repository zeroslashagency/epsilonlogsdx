import {
  compareDashboardMachineOrder,
  DEFAULT_DASHBOARD_MACHINE_IDS,
  getMachineLabel,
} from "./machineConfig";
import type {
  MachineCardRecord,
  MachineCardVariant,
  MachineMetric,
} from "./dashboard-types";
import {
  fetchLatestDeviceLogs,
  formatDateForApi,
  type DeviceLogEntry,
} from "./liveMachineApi";
import { formatDuration } from "../report-core/format-utils";
import { buildReport } from "../report-core/report-builder";
import type {
  DeviceLogEntry as ReportDeviceLogEntry,
  ReportConfig,
  ReportRow,
} from "../report-core/report-types";

type MachineStatus =
  | "LIVE"
  | "SETTING"
  | "MAINTENANCE"
  | "CALIBRATION"
  | "PAUSED"
  | "OFFLINE"
  | "ERROR";

type JobTypeLabel =
  | "Production"
  | "Setting"
  | "Calibration"
  | "Maintenance"
  | "Unknown";

type WoExecutionStatus = "LIVE" | "PROCESSING" | "COMPLETE";
type ReportJobType = ReportRow["jobType"];

interface MachineSnapshot {
  machineId: number;
  status: MachineStatus;
  statusMessage: string;
  currentWoDisplayId: string | null;
  currentWoInternalId: number | null;
  operatorName: string | null;
  latestAction: string | null;
  latestTimestamp: number | null;
  jobTypeLabel: JobTypeLabel;
  pauseStartedAt: string | null;
  pauseReason: string | null;
  logs: DeviceLogEntry[];
  errorMessage: string | null;
}

interface MachineFetchResult {
  snapshot: MachineSnapshot;
  latestLogs: DeviceLogEntry[];
}

interface MachineWoAccumulator {
  woId: string;
  woDisplayId: string;
  machineId: number | null;
  operatorName: string;
  jobType: ReportJobType;
  pclText: string;
  totalCycles: number;
  totalDurationSec: number;
  latestTimestamp: number;
  latestAction: string;
  hasWoStart: boolean;
  hasWoStop: boolean;
}

interface MachineWoSummary {
  woId: string;
  woDisplayId: string;
  machineId: number | null;
  operatorName: string;
  jobType: ReportJobType;
  pclText: string;
  totalCycles: number;
  totalDurationSec: number;
  latestTimestamp: number;
  executionStatus: WoExecutionStatus;
}

const ACTIVE_ACTIONS = new Set(["SPINDLE_ON", "WO_START", "WO_RESUME"]);
const STOPPED_ACTIONS = new Set(["SPINDLE_OFF", "WO_STOP"]);
const LIVE_WINDOW_MS = 15 * 60 * 1000;
const OFFLINE_WINDOW_MS = 2 * 60 * 60 * 1000;
const WO_OVERVIEW_STATUS_PRIORITY: Record<WoExecutionStatus, number> = {
  LIVE: 0,
  PROCESSING: 1,
  COMPLETE: 2,
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatRelativeAge(timestamp: number | null, nowMs: number): string {
  if (timestamp === null) {
    return "No recent log";
  }

  const ageMs = Math.max(0, nowMs - timestamp);
  if (ageMs < 60_000) {
    return `${Math.max(1, Math.floor(ageMs / 1000))}s ago`;
  }

  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function mapRawJobTypeToLabel(rawJobType: unknown): JobTypeLabel {
  const numericType = Number(rawJobType);
  if (!Number.isFinite(numericType)) {
    return "Unknown";
  }

  switch (numericType) {
    case 1:
    case 51:
      return "Production";
    case 2:
    case 52:
      return "Setting";
    case 3:
      return "Calibration";
    case 4:
      return "Maintenance";
    default:
      return "Unknown";
  }
}

function resolveDisplayWorkOrder(log: DeviceLogEntry | null): string | null {
  const woName = normalizeText(log?.wo_name);
  if (woName) {
    return woName;
  }

  if (typeof log?.wo_id === "number" && log.wo_id > 0) {
    return String(log.wo_id);
  }

  return null;
}

function resolvePauseReason(log: DeviceLogEntry | null): string | null {
  return (
    normalizeText(log?.stop_comment) ??
    normalizeText(log?.start_comment) ??
    null
  );
}

function createBaseSnapshot(machineId: number): MachineSnapshot {
  return {
    machineId,
    status: "OFFLINE",
    statusMessage: "No recent machine events.",
    currentWoDisplayId: null,
    currentWoInternalId: null,
    operatorName: null,
    latestAction: null,
    latestTimestamp: null,
    jobTypeLabel: "Unknown",
    pauseStartedAt: null,
    pauseReason: null,
    logs: [],
    errorMessage: null,
  };
}

function buildMachineSnapshot(
  machineId: number,
  logs: DeviceLogEntry[],
  nowMs: number,
): MachineSnapshot {
  const base = createBaseSnapshot(machineId);
  const latestLog = logs[0] ?? null;

  if (!latestLog) {
    return base;
  }

  const latestTimestamp = toTimestamp(latestLog.log_time);
  if (latestTimestamp === null) {
    return {
      ...base,
      statusMessage: "Latest event timestamp is invalid.",
      logs,
    };
  }

  const ageMs = Math.max(0, nowMs - latestTimestamp);
  const latestAction = normalizeText(latestLog.action);
  const jobTypeLabel = mapRawJobTypeToLabel(latestLog.job_type);
  const operatorName = normalizeText(latestLog.start_name);

  const snapshot: MachineSnapshot = {
    ...base,
    currentWoDisplayId: resolveDisplayWorkOrder(latestLog),
    currentWoInternalId:
      typeof latestLog.wo_id === "number" && latestLog.wo_id > 0
        ? latestLog.wo_id
        : null,
    operatorName,
    latestAction,
    latestTimestamp,
    jobTypeLabel,
    pauseStartedAt: latestAction === "WO_PAUSE" ? latestLog.log_time : null,
    pauseReason:
      latestAction === "WO_PAUSE" ? resolvePauseReason(latestLog) : null,
    logs,
    errorMessage: null,
  };

  if (ageMs > OFFLINE_WINDOW_MS) {
    return {
      ...snapshot,
      status: "OFFLINE",
      statusMessage: "No recent machine event in the live window.",
    };
  }

  if (jobTypeLabel === "Maintenance") {
    return {
      ...snapshot,
      status: "MAINTENANCE",
      statusMessage: "Maintenance activity is in progress.",
    };
  }

  if (jobTypeLabel === "Setting") {
    return {
      ...snapshot,
      status: "SETTING",
      statusMessage: "Setup or setting activity is in progress.",
    };
  }

  if (jobTypeLabel === "Calibration") {
    return {
      ...snapshot,
      status: "CALIBRATION",
      statusMessage: "Calibration activity is in progress.",
    };
  }

  if (latestAction === "WO_PAUSE") {
    return {
      ...snapshot,
      status: "PAUSED",
      statusMessage: "Work order is paused.",
    };
  }

  if (latestAction && (ACTIVE_ACTIONS.has(latestAction) || ageMs <= LIVE_WINDOW_MS)) {
    return {
      ...snapshot,
      status: "LIVE",
      statusMessage:
        latestAction === "SPINDLE_ON"
          ? "Spindle is running now."
          : "Recent work order activity detected.",
    };
  }

  if (latestAction && STOPPED_ACTIONS.has(latestAction)) {
    return {
      ...snapshot,
      status: "LIVE",
      statusMessage: "Machine is reachable and the current WO is completed.",
    };
  }

  return {
    ...snapshot,
    status: "LIVE",
    statusMessage: "Machine is waiting for the next event.",
  };
}

function buildMachineErrorSnapshot(
  machineId: number,
  errorMessage: string,
): MachineSnapshot {
  return {
    ...createBaseSnapshot(machineId),
    status: "ERROR",
    statusMessage: "Live data request failed for this machine.",
    errorMessage,
  };
}

function resolveCardVariant(snapshot: MachineSnapshot): MachineCardVariant {
  if (snapshot.status === "PAUSED") {
    return "pause";
  }
  if (snapshot.status === "SETTING") {
    return "setting";
  }
  if (snapshot.status === "CALIBRATION") {
    return "calibration";
  }
  if (snapshot.status === "MAINTENANCE") {
    return "maintenance";
  }
  if (snapshot.status === "OFFLINE" || snapshot.status === "ERROR") {
    return "offline";
  }
  return "production";
}

function resolveCardBadgeLabel(snapshot: MachineSnapshot): string {
  if (snapshot.status === "PAUSED") {
    return "Pause Alert";
  }
  if (snapshot.status === "SETTING") {
    return "Setting";
  }
  if (snapshot.status === "CALIBRATION") {
    return "Calibration";
  }
  if (snapshot.status === "MAINTENANCE") {
    return "Maintenance";
  }
  if (!snapshot.currentWoDisplayId) {
    return "No Active WO";
  }
  return "Production";
}

function resolveStatusLabel(snapshot: MachineSnapshot): MachineCardRecord["statusLabel"] {
  if (snapshot.status === "PAUSED") {
    return "PAUSED";
  }
  if (snapshot.status === "ERROR") {
    return "ERROR";
  }
  if (snapshot.status === "OFFLINE") {
    return "OFFLINE";
  }
  return "LIVE";
}

function resolveSummaryStatusLabel(
  snapshot: MachineSnapshot,
  summary: MachineWoSummary | null,
): MachineCardRecord["statusLabel"] {
  if (snapshot.status === "PAUSED") {
    return "PAUSED";
  }

  if (snapshot.status === "ERROR") {
    return "ERROR";
  }

  if (summary) {
    return summary.executionStatus;
  }

  return resolveStatusLabel(snapshot);
}

function resolveSummaryStatusMessage(
  snapshot: MachineSnapshot,
  summary: MachineWoSummary | null,
): string {
  if (snapshot.status === "PAUSED") {
    return "";
  }

  if (summary?.executionStatus === "COMPLETE") {
    return "Work order completed in the recent live window.";
  }

  if (summary?.executionStatus === "PROCESSING") {
    return "Work order is paused or waiting for the next cycle.";
  }

  return snapshot.statusMessage;
}

function formatFallbackStatus(snapshot: MachineSnapshot): string {
  if (snapshot.status === "ERROR") {
    return "Request failed";
  }

  if (snapshot.status === "OFFLINE") {
    return "Offline";
  }

  if (snapshot.status === "PAUSED") {
    return "Paused";
  }

  return "Live";
}

function resolveStatusMetrics(snapshot: MachineSnapshot, nowMs: number): MachineMetric[] {
  return [
    {
      label: "Status",
      value: formatFallbackStatus(snapshot),
    },
    {
      label: "Last Seen",
      value: formatRelativeAge(snapshot.latestTimestamp, nowMs),
    },
    { label: "Last Event", value: snapshot.latestAction ?? "-" },
  ];
}

function resolveWoId(row: ReportRow): string | null {
  const rawValue = row.originalLog?.wo_id ?? row.woSpecs?.woId;
  return rawValue === undefined || rawValue === null ? null : String(rawValue);
}

function toPclText(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    if (numericValue <= 0) {
      return "-";
    }
    return formatDuration(numericValue);
  }

  return String(value);
}

function hasMeaningfulPclText(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    normalized !== "-" && normalized !== "0 min 0 sec" && normalized !== "0 sec"
  );
}

function resolveRowPclText(row: ReportRow): string {
  const fromLog = toPclText(row.originalLog?.pcl);
  if (hasMeaningfulPclText(fromLog)) {
    return fromLog;
  }

  if (hasMeaningfulPclText(row.woSpecs?.pclText)) {
    return row.woSpecs.pclText;
  }

  return row.woSpecs?.pclText || "-";
}

function resolveDisplayWoId(row: ReportRow, internalWoId: string): string {
  const fromLog = String(row.originalLog?.wo_name || "").trim();
  if (fromLog.length > 0) {
    return fromLog;
  }

  const fromSpecs = String(row.woSpecs?.woId || "").trim();
  if (fromSpecs.length > 0 && fromSpecs !== "0") {
    return fromSpecs;
  }

  return internalWoId;
}

function buildDefaultAccumulator(woId: string, row: ReportRow): MachineWoAccumulator {
  const timestamp = row.timestamp;
  const operatorName =
    row.operatorName ||
    String(row.originalLog?.start_name || "").trim() ||
    "Unknown";

  return {
    woId,
    woDisplayId: resolveDisplayWoId(row, woId),
    machineId: row.originalLog?.device_id ?? null,
    operatorName,
    jobType: row.jobType,
    pclText: resolveRowPclText(row),
    totalCycles: 0,
    totalDurationSec: 0,
    latestTimestamp: timestamp,
    latestAction: row.action || "",
    hasWoStart: row.action === "WO_START",
    hasWoStop: row.action === "WO_STOP",
  };
}

function resolveExecutionStatus(entry: MachineWoAccumulator): WoExecutionStatus {
  if (entry.hasWoStop || entry.latestAction === "WO_STOP") {
    return "COMPLETE";
  }

  if (entry.latestAction === "WO_PAUSE") {
    return "PROCESSING";
  }

  if (
    entry.latestAction === "WO_START" ||
    entry.latestAction === "WO_RESUME" ||
    entry.latestAction === "SPINDLE_ON"
  ) {
    return "LIVE";
  }

  if (Date.now() - entry.latestTimestamp <= LIVE_WINDOW_MS) {
    return "LIVE";
  }

  return entry.hasWoStart ? "PROCESSING" : "LIVE";
}

function selectPreferredSummariesPerMachine(
  summaries: readonly MachineWoSummary[],
): MachineWoSummary[] {
  const selectedByMachine = new Map<string, MachineWoSummary>();

  for (const summary of summaries) {
    const key =
      summary.machineId == null
        ? `wo:${summary.woId}`
        : `machine:${summary.machineId}`;
    const existing = selectedByMachine.get(key);

    if (!existing) {
      selectedByMachine.set(key, summary);
      continue;
    }

    const nextRank =
      WO_OVERVIEW_STATUS_PRIORITY[summary.executionStatus] ??
      Number.MAX_SAFE_INTEGER;
    const existingRank =
      WO_OVERVIEW_STATUS_PRIORITY[existing.executionStatus] ??
      Number.MAX_SAFE_INTEGER;

    if (nextRank < existingRank) {
      selectedByMachine.set(key, summary);
      continue;
    }

    if (
      nextRank === existingRank &&
      summary.latestTimestamp > existing.latestTimestamp
    ) {
      selectedByMachine.set(key, summary);
    }
  }

  return [...selectedByMachine.values()];
}

function buildWoSummaryByMachine(
  rows: ReportRow[],
  machineIds: readonly number[],
): Map<number, MachineWoSummary> {
  const grouped = new Map<string, MachineWoAccumulator>();

  for (const row of rows) {
    const woId = resolveWoId(row);
    if (!woId) {
      continue;
    }

    const timestamp = row.timestamp;
    const entry = grouped.get(woId) || buildDefaultAccumulator(woId, row);
    const operatorFromRow =
      row.operatorName || String(row.originalLog?.start_name || "").trim();
    const displayWoId = resolveDisplayWoId(row, woId);

    entry.totalDurationSec += row.durationSec || 0;

    if (!hasMeaningfulPclText(entry.pclText)) {
      const candidatePcl = resolveRowPclText(row);
      if (hasMeaningfulPclText(candidatePcl)) {
        entry.pclText = candidatePcl;
      }
    }

    if (entry.jobType === "Unknown" && row.jobType !== "Unknown") {
      entry.jobType = row.jobType;
    }

    if (entry.operatorName === "Unknown" && operatorFromRow) {
      entry.operatorName = operatorFromRow;
    }

    if (entry.machineId === null && typeof row.originalLog?.device_id === "number") {
      entry.machineId = row.originalLog.device_id;
    }

    if (entry.woDisplayId === entry.woId && displayWoId !== woId) {
      entry.woDisplayId = displayWoId;
    }

    if (row.action === "WO_START") {
      entry.hasWoStart = true;
    }

    if (row.action === "WO_STOP") {
      entry.hasWoStop = true;
    }

    if (timestamp >= entry.latestTimestamp) {
      entry.latestTimestamp = timestamp;
      entry.latestAction = row.action || "";
      entry.machineId = row.originalLog?.device_id ?? entry.machineId;
      entry.operatorName = operatorFromRow || entry.operatorName;
      entry.woDisplayId = displayWoId || entry.woDisplayId;
    }

    if (row.action === "SPINDLE_OFF") {
      entry.totalCycles += 1;
    }

    grouped.set(woId, entry);
  }

  const preferredSummaries = selectPreferredSummariesPerMachine(
    [...grouped.values()].map((entry) => ({
      woId: entry.woId,
      woDisplayId: entry.woDisplayId,
      machineId: entry.machineId,
      operatorName: entry.operatorName,
      jobType: entry.jobType,
      executionStatus: resolveExecutionStatus(entry),
      pclText: entry.pclText,
      totalCycles: entry.totalCycles,
      totalDurationSec: entry.totalDurationSec,
      latestTimestamp: entry.latestTimestamp,
    })),
  ).sort((left, right) =>
    compareDashboardMachineOrder(left.machineId, right.machineId, machineIds),
  );

  return new Map(
    preferredSummaries.flatMap((summary) =>
      summary.machineId == null ? [] : [[summary.machineId, summary] as const],
    ),
  );
}

function buildMachineCardRecord(
  snapshot: MachineSnapshot,
  summary: MachineWoSummary | null,
  nowMs: number,
): MachineCardRecord {
  const updatedLabel = formatRelativeAge(snapshot.latestTimestamp, nowMs);
  const matchingSummary =
    summary &&
    snapshot.currentWoInternalId !== null &&
    summary.woId === String(snapshot.currentWoInternalId)
      ? summary
      : null;
  const operatorName = (
    matchingSummary?.operatorName ||
    snapshot.operatorName ||
    "No active operator"
  ).toUpperCase();
  const workOrderLabel = matchingSummary
    ? `WO-${matchingSummary.woDisplayId}`
    : snapshot.currentWoDisplayId
      ? `WO-${snapshot.currentWoDisplayId}`
      : "No Active WO";

  let metrics: MachineMetric[];
  if (snapshot.status === "PAUSED") {
    metrics = [
      {
        label: "Pause Reason",
        value: snapshot.pauseReason ?? "No pause reason from API",
      },
    ];
  } else if (matchingSummary) {
    metrics = [
      { label: "PCL Time", value: matchingSummary.pclText },
      { label: "Cycles", value: String(matchingSummary.totalCycles) },
      {
        label: "Total",
        value: formatDuration(matchingSummary.totalDurationSec || 0),
      },
    ];
  } else {
    metrics = resolveStatusMetrics(snapshot, nowMs);
  }

  return {
    machineId: snapshot.machineId,
    variant: resolveCardVariant(snapshot),
    badgeLabel: resolveCardBadgeLabel(snapshot),
    statusLabel: resolveSummaryStatusLabel(snapshot, matchingSummary),
    updatedLabel,
    operatorName,
    workOrderLabel,
    metrics,
    footerLabel: resolveSummaryStatusMessage(snapshot, matchingSummary),
    pauseStartedAt: snapshot.pauseStartedAt,
  };
}

function toReportLogEntries(logs: DeviceLogEntry[]): ReportDeviceLogEntry[] {
  return logs.map((log) => {
    const reportLog: ReportDeviceLogEntry = {
      log_id: log.log_id ?? log.id ?? 0,
      log_time: log.log_time,
      action: log.action,
      wo_id:
        typeof log.wo_id === "number" && Number.isFinite(log.wo_id)
          ? log.wo_id
          : 0,
      device_id: log.device_id,
    };

    if (typeof log.id === "number") {
      reportLog.id = log.id;
    }

    if (typeof log.wo_name === "string") {
      reportLog.wo_name = log.wo_name;
    }

    if (log.pcl !== null && log.pcl !== undefined) {
      reportLog.pcl = String(log.pcl);
    }

    if (typeof log.start_name === "string") {
      reportLog.start_name = log.start_name;
    }

    if (typeof log.start_comment === "string") {
      reportLog.start_comment = log.start_comment;
    }

    if (typeof log.stop_comment === "string") {
      reportLog.stop_comment = log.stop_comment;
    }

    if (typeof log.job_type === "string" || typeof log.job_type === "number") {
      reportLog.job_type = log.job_type;
    }

    return reportLog;
  });
}

export async function fetchLiveMachineCards(options: {
  token: string;
  signal?: AbortSignal;
  machineIds?: readonly number[];
  now?: Date;
}): Promise<{ machines: MachineCardRecord[]; errors: string[] }> {
  const machineIds = options.machineIds ?? DEFAULT_DASHBOARD_MACHINE_IDS;
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const machineResults = await Promise.all(
    machineIds.map(async (machineId): Promise<MachineFetchResult> => {
      try {
        const config = {
          deviceId: machineId,
          startDate: formatDateForApi(startOfDay),
          endDate: formatDateForApi(now),
        };
        const latestLogs = (
          await fetchLatestDeviceLogs(
            config,
            options.token,
            options.signal,
          )
        ).logs;
        const snapshot = buildMachineSnapshot(machineId, latestLogs, nowMs);

        return { snapshot, latestLogs };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Machine request failed.";
        return {
          snapshot: buildMachineErrorSnapshot(machineId, message),
          latestLogs: [],
        };
      }
    }),
  );

  const errors = machineResults.flatMap(({ snapshot }) => {
    if (snapshot.status !== "ERROR" || !snapshot.errorMessage) {
      return [];
    }

    return [`${getMachineLabel(snapshot.machineId)}: ${snapshot.errorMessage}`];
  });

  const combinedLogs = machineResults.flatMap(({ latestLogs }) => latestLogs);
  const reportLogs = toReportLogEntries(combinedLogs);
  const reportConfig: ReportConfig = {
    deviceId: machineIds[0] ?? DEFAULT_DASHBOARD_MACHINE_IDS[0],
    startDate: formatDateForApi(startOfDay),
    endDate: formatDateForApi(now),
    toleranceSec: 10,
  };
  const reportRows =
    reportLogs.length > 0
      ? buildReport(reportLogs, new Map(), reportConfig).rows
      : [];
  const summaryByMachine = buildWoSummaryByMachine(reportRows, machineIds);

  const machines = machineResults
    .map(({ snapshot }) =>
      buildMachineCardRecord(
        snapshot,
        summaryByMachine.get(snapshot.machineId) ?? null,
        nowMs,
      ),
    )
    .sort((left, right) =>
      compareDashboardMachineOrder(
        left.machineId,
        right.machineId,
        machineIds,
      ),
    );

  return { machines, errors };
}
