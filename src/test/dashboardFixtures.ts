import type {
  MachineCardRecord,
  MachineReportEntry,
} from "../data/dashboard-types";

export const MACHINE_CACHE_KEY = "machine-overview-shop.live-cache";

export const sampleMachines: MachineCardRecord[] = [
  {
    machineId: 11,
    variant: "production",
    badgeLabel: "Production",
    contextBadgeLabel: null,
    statusLabel: "LIVE",
    updatedLabel: "1m ago",
    operatorName: "PALANISAMY",
    workOrderLabel: "WO-3038",
    partNumber: "PART-1",
    pauseCount: 0,
    pauseReason: null,
    metrics: [
      { label: "PCL Time", value: "8 min 0 sec" },
      { label: "Cycles", value: "14" },
      { label: "Total", value: "2h 15m" },
    ],
    footerLabel: "Recent work order activity detected.",
    alertKind: null,
    alertStartedAt: null,
  },
  {
    machineId: 12,
    variant: "pause",
    badgeLabel: "Pause Alert",
    contextBadgeLabel: "Production",
    statusLabel: "PAUSED",
    updatedLabel: "2m ago",
    operatorName: "SURESH",
    workOrderLabel: "WO-3039",
    partNumber: "PART-2",
    pauseCount: 2,
    pauseReason: "Tool change",
    metrics: [{ label: "Pause Reason", value: "Tool change" }],
    footerLabel: "",
    alertKind: "pause",
    alertStartedAt: "2026-03-27T10:00:00.000Z",
  },
];

export const sampleMachineReport: MachineReportEntry[] = [
  {
    machineId: 11,
    productionCount: 3,
    maintenanceCount: 0,
    settingCount: 0,
    calibrationCount: 0,
  },
  {
    machineId: 12,
    productionCount: 1,
    maintenanceCount: 0,
    settingCount: 0,
    calibrationCount: 0,
  },
];

export const sampleDashboardResponse = {
  machines: sampleMachines,
  machineReport: sampleMachineReport,
  errors: [],
};

export function writeCachedDashboardState(
  cachedAt: number,
  storage: Storage = window.sessionStorage,
) {
  storage.setItem(
    MACHINE_CACHE_KEY,
    JSON.stringify({
      cachedAt,
      lastRefreshedAt: new Date(cachedAt).toISOString(),
      machines: sampleMachines,
      machineReport: sampleMachineReport,
    }),
  );
}
