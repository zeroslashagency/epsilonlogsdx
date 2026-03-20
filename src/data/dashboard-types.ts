export type MachineCardVariant =
  | "production"
  | "setting"
  | "calibration"
  | "pause"
  | "maintenance"
  | "offline";

export type MachineStatusLabel = "LIVE" | "PAUSED" | "OFFLINE" | "ERROR";

export interface MachineMetric {
  label: string;
  value: string;
}

export interface MachineCardRecord {
  machineId: number;
  variant: MachineCardVariant;
  badgeLabel: string;
  statusLabel: MachineStatusLabel;
  updatedLabel: string;
  operatorName: string;
  workOrderLabel: string;
  metrics: MachineMetric[];
  footerLabel: string;
  pauseStartedAt: string | null;
}
