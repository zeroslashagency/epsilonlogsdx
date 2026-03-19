export interface MachineInfo {
  label: string;
}

export const MACHINE_CONFIG: Record<number, MachineInfo> = {
  11: { label: "VMC 1" },
  12: { label: "VMC 2" },
  13: { label: "VMC 3" },
  14: { label: "VMC 4" },
  15: { label: "VMC 5" },
  16: { label: "VMC 6" },
  19: { label: "VMC 7" },
  18: { label: "CNC 1" },
};

export const DEFAULT_DASHBOARD_MACHINE_IDS = [
  11,
  12,
  13,
  14,
  15,
  16,
  19,
  18,
] as const;

export function getMachineLabel(machineId: number): string {
  return MACHINE_CONFIG[machineId]?.label ?? `Machine ${machineId}`;
}

function resolveDashboardMachineRank(
  machineId: number | null | undefined,
  orderedMachineIds: readonly number[],
): number {
  if (!machineId) {
    return Number.MAX_SAFE_INTEGER;
  }

  const orderedIndex = orderedMachineIds.indexOf(machineId);
  if (orderedIndex >= 0) {
    return orderedIndex;
  }

  return orderedMachineIds.length + machineId;
}

export function compareDashboardMachineOrder(
  leftMachineId: number | null | undefined,
  rightMachineId: number | null | undefined,
  orderedMachineIds: readonly number[],
): number {
  const leftRank = resolveDashboardMachineRank(
    leftMachineId,
    orderedMachineIds,
  );
  const rightRank = resolveDashboardMachineRank(
    rightMachineId,
    orderedMachineIds,
  );

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  if (leftMachineId == null && rightMachineId == null) {
    return 0;
  }

  if (leftMachineId == null) {
    return 1;
  }

  if (rightMachineId == null) {
    return -1;
  }

  return leftMachineId - rightMachineId;
}
