export type MachineCardVariant =
  | "production"
  | "setting"
  | "calibration"
  | "offline";

export interface MachineMetric {
  label: string;
  value: string;
}

export interface MachineCardRecord {
  machineId: number;
  variant: MachineCardVariant;
  badgeLabel: string;
  statusLabel: "LIVE" | "OFFLINE";
  updatedLabel: string;
  operatorName: string;
  workOrderLabel: string;
  metrics: MachineMetric[];
  footerLabel: string;
  detailSummary: string;
  detailMetrics: MachineMetric[];
  recentNotes: string[];
}

export const mockMachines: MachineCardRecord[] = [
  {
    machineId: 11,
    variant: "production",
    badgeLabel: "Production",
    statusLabel: "LIVE",
    updatedLabel: "11m ago",
    operatorName: "PRADEEP RAJ",
    workOrderLabel: "WO-3008",
    metrics: [
      { label: "PCL Time", value: "13m 50s" },
      { label: "Cycles", value: "16" },
      { label: "Total", value: "1h 3m 30s" },
    ],
    footerLabel: "Click to expand summary",
    detailSummary:
      "Production is stable on VMC 1 with continuous spindle activity across the current work order window.",
    detailMetrics: [
      { label: "Shift Throughput", value: "84 parts" },
      { label: "Cycle Consistency", value: "Within target" },
      { label: "Operator Readiness", value: "Confirmed" },
    ],
    recentNotes: [
      "Cycle time has stayed inside the expected band for the last 4 recorded runs.",
      "No stoppage flags were raised during the active work order window.",
    ],
  },
  {
    machineId: 12,
    variant: "setting",
    badgeLabel: "Setting",
    statusLabel: "LIVE",
    updatedLabel: "Just now",
    operatorName: "PALANISAMY",
    workOrderLabel: "WO-3037",
    metrics: [
      { label: "PCL Time", value: "0 min 0 sec" },
      { label: "Cycles", value: "21" },
      { label: "Total", value: "2m 22s" },
    ],
    footerLabel: "Click to expand summary",
    detailSummary:
      "VMC 2 is in setup mode and appears to be validating fixtures before full production resumes.",
    detailMetrics: [
      { label: "Fixture Status", value: "Under check" },
      { label: "Program State", value: "Loaded" },
      { label: "Expected Start", value: "Soon" },
    ],
    recentNotes: [
      "Machine is online and responsive, but output should remain low until setup clears.",
      "Latest operator touchpoint landed in the current minute.",
    ],
  },
  {
    machineId: 13,
    variant: "production",
    badgeLabel: "Production",
    statusLabel: "LIVE",
    updatedLabel: "4m ago",
    operatorName: "PRADEEP RAJ",
    workOrderLabel: "WO-3000",
    metrics: [
      { label: "PCL Time", value: "34m 57s" },
      { label: "Cycles", value: "13" },
      { label: "Total", value: "10m 20s" },
    ],
    footerLabel: "Click to expand summary",
    detailSummary:
      "VMC 3 remains in active production with longer PCL time, likely tied to the current machining profile.",
    detailMetrics: [
      { label: "Load Pattern", value: "High dwell" },
      { label: "Cut State", value: "Stable" },
      { label: "Monitoring", value: "Normal" },
    ],
    recentNotes: [
      "Longer active cycle blocks are visible, but the machine still reports as healthy.",
      "The board has not captured any pause or stop event in the latest sequence.",
    ],
  },
  {
    machineId: 14,
    variant: "calibration",
    badgeLabel: "Calibration",
    statusLabel: "LIVE",
    updatedLabel: "4h ago",
    operatorName: "PRABHU",
    workOrderLabel: "WO-5555",
    metrics: [
      { label: "PCL Time", value: "10m 0s" },
      { label: "Cycles", value: "1" },
      { label: "Total", value: "4s" },
    ],
    footerLabel: "Click to expand summary",
    detailSummary:
      "Calibration activity is recorded on VMC 4 with a very light cycle count and limited run duration.",
    detailMetrics: [
      { label: "Probe Status", value: "Ready" },
      { label: "Calibration Pass", value: "1 / 3" },
      { label: "Attention Level", value: "Watch" },
    ],
    recentNotes: [
      "Recent board age suggests the cell should be checked before assigning new production work.",
      "The machine remains visible as live because the last event is still inside the broader board context.",
    ],
  },
  {
    machineId: 15,
    variant: "production",
    badgeLabel: "Production",
    statusLabel: "LIVE",
    updatedLabel: "1m ago",
    operatorName: "HARISH",
    workOrderLabel: "WO-2967",
    metrics: [
      { label: "PCL Time", value: "8m 0s" },
      { label: "Cycles", value: "13" },
      { label: "Total", value: "30m 57s" },
    ],
    footerLabel: "Click to expand summary",
    detailSummary:
      "VMC 5 is moving steadily through its active work order with a balanced mix of cycle count and total duration.",
    detailMetrics: [
      { label: "Cell Pace", value: "On track" },
      { label: "Tool State", value: "Ready" },
      { label: "Queue Risk", value: "Low" },
    ],
    recentNotes: [
      "Recent activity indicates the operator just touched the line within the last minute.",
      "No board-level exception has been attached to this machine in the mock state.",
    ],
  },
  {
    machineId: 16,
    variant: "production",
    badgeLabel: "Production",
    statusLabel: "LIVE",
    updatedLabel: "2m ago",
    operatorName: "HARISH",
    workOrderLabel: "WO-2982",
    metrics: [
      { label: "PCL Time", value: "22m 0s" },
      { label: "Cycles", value: "24" },
      { label: "Total", value: "1h 15m 17s" },
    ],
    footerLabel: "Click to expand summary",
    detailSummary:
      "VMC 6 shows the heaviest active load in the mock board with strong cycle count and the longest total runtime.",
    detailMetrics: [
      { label: "Output Density", value: "High" },
      { label: "Board Priority", value: "Focus cell" },
      { label: "Shift Confidence", value: "Strong" },
    ],
    recentNotes: [
      "This machine is the clearest candidate for a hero card if the board later gets KPI emphasis.",
      "The visual layout keeps it consistent with the screenshot for now.",
    ],
  },
  {
    machineId: 19,
    variant: "production",
    badgeLabel: "Production",
    statusLabel: "LIVE",
    updatedLabel: "1m ago",
    operatorName: "PRADEEP RAJ",
    workOrderLabel: "WO-2982",
    metrics: [
      { label: "PCL Time", value: "24m 4s" },
      { label: "Cycles", value: "21" },
      { label: "Total", value: "58m 6s" },
    ],
    footerLabel: "Click to expand summary",
    detailSummary:
      "VMC 7 mirrors a healthy production state with reliable cycle output and no visible interruptions.",
    detailMetrics: [
      { label: "Run Quality", value: "Clean" },
      { label: "Cycle Delta", value: "-2%" },
      { label: "Machine State", value: "Available" },
    ],
    recentNotes: [
      "The same work order appears on multiple cells in the screenshot reference, so the mock keeps that pattern.",
      "Status remains live with a recent operator event.",
    ],
  },
  {
    machineId: 18,
    variant: "offline",
    badgeLabel: "No Active WO",
    statusLabel: "OFFLINE",
    updatedLabel: "No recent log",
    operatorName: "NO ACTIVE OPERATOR",
    workOrderLabel: "No Active WO",
    metrics: [
      { label: "Status", value: "Offline" },
      { label: "Last Seen", value: "No recent log" },
      { label: "Last Event", value: "-" },
    ],
    footerLabel: "Click to expand summary",
    detailSummary:
      "CNC 1 has no active work order and no fresh machine events inside the latest board window.",
    detailMetrics: [
      { label: "Board Slot", value: "Held" },
      { label: "Operator", value: "Unassigned" },
      { label: "Attention Level", value: "Check machine" },
    ],
    recentNotes: [
      "The offline state uses a dedicated pale red treatment so it remains visible without overpowering the board.",
      "This card can later be replaced with live fallback data from the existing machine snapshot logic.",
    ],
  },
];
