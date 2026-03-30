export type MachineCardVariant =
  | "production"
  | "idle"
  | "setting"
  | "calibration"
  | "pause"
  | "key"
  | "maintenance"
  | "offline";

export type MachineStatusLabel =
  | "LIVE"
  | "IDLE"
  | "PROCESSING"
  | "COMPLETE"
  | "PAUSED"
  | "KEY ACTIVE"
  | "OFFLINE"
  | "ERROR";

export interface MachineMetric {
  label: string;
  value: string;
}

export interface MachineReportEntry {
  machineId: number;
  productionCount: number;
  maintenanceCount: number;
  settingCount: number;
  calibrationCount: number;
}

export interface MachineCardRecord {
  machineId: number;
  variant: MachineCardVariant;
  badgeLabel: string;
  contextBadgeLabel: string | null;
  statusLabel: MachineStatusLabel;
  updatedLabel: string;
  operatorName: string;
  workOrderLabel: string;
  partNumber: string | null;
  pauseCount: number;
  pauseReason: string | null;
  metrics: MachineMetric[];
  footerLabel: string;
  alertKind: "pause" | "key" | null;
  alertStartedAt: string | null;
}
