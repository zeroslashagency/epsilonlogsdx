export interface QcLeaderboardEntry {
  name: string;
  manHoursLabel: string;
  machineHoursLabel: string;
  pauseCount: number;
}

export function buildQcLeaderboardEntries(): QcLeaderboardEntry[] {
  return [];
}
