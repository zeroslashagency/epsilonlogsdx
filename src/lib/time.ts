export function formatRefreshTime(refreshDate: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(refreshDate);
}

export function formatRefreshRateLabel(refreshRateMs: number) {
  return `${Math.round(refreshRateMs / 1000)} sec`;
}

export function formatElapsedDurationFromTimestamp(
  timestamp: string | null,
  nowMs: number,
) {
  if (!timestamp) {
    return "--:--:--";
  }

  const startedAt = new Date(timestamp).getTime();
  if (!Number.isFinite(startedAt)) {
    return "--:--:--";
  }

  const elapsedMs = Math.max(0, nowMs - startedAt);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function formatTimeOfDayFromTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return "-";
  }

  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatDurationCompactFromSeconds(
  totalSeconds: number | null | undefined,
) {
  if (!Number.isFinite(totalSeconds) || totalSeconds == null || totalSeconds <= 0) {
    return "-";
  }

  const roundedSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const seconds = roundedSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
}
