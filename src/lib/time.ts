export function formatRefreshTime(refreshDate: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(refreshDate);
}

export function formatTime24Hours(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatElapsedHoursAgo(startDate: Date, nowMs: number) {
  const startMs = startDate.getTime();
  if (!Number.isFinite(startMs)) {
    return "--:--h ago";
  }

  const elapsedMs = Math.max(0, nowMs - startMs);
  const totalMinutes = Math.floor(elapsedMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}h ago`;
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

export function formatHoursMinutesFromSeconds(
  totalSeconds: number | null | undefined,
) {
  if (!Number.isFinite(totalSeconds) || totalSeconds == null || totalSeconds <= 0) {
    return "00:00";
  }

  const roundedSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function parseDurationLabelToSeconds(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "-") {
    return 0;
  }

  const matches = Array.from(
    normalized.matchAll(/(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)/g),
  );

  if (matches.length === 0) {
    return 0;
  }

  let totalSeconds = 0;
  for (const [, rawAmount, unit] of matches) {
    if (!unit) {
      continue;
    }

    const amount = Number(rawAmount);
    if (!Number.isFinite(amount)) {
      continue;
    }

    if (unit.startsWith("h")) {
      totalSeconds += amount * 3600;
      continue;
    }

    if (unit.startsWith("m")) {
      totalSeconds += amount * 60;
      continue;
    }

    totalSeconds += amount;
  }

  return totalSeconds;
}
