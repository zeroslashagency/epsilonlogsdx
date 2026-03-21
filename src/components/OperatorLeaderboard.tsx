import {
  getMachineLabel,
} from "../data/machineConfig";
import type {
  MachineCardRecord,
  MachineReportEntry,
} from "../data/dashboard-types";
import {
  buildQcLeaderboardEntries,
  type QcLeaderboardEntry,
} from "../data/qcLeaderboard";
import {
  formatHoursMinutesFromSeconds,
  parseDurationLabelToSeconds,
} from "../lib/time";

interface ProductionLeaderboardEntry {
  operatorName: string;
  machineCount: number;
  manHoursSeconds: number;
  machineHoursSeconds: number;
  pauseCount: number;
}

interface OperatorLeaderboardProps {
  machines: MachineCardRecord[];
  machineReport: MachineReportEntry[];
}

function normalizeOperatorName(value: string) {
  return value.trim().toUpperCase();
}

function formatOperatorDisplayName(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isTrackableOperator(machine: MachineCardRecord) {
  const normalizedName = normalizeOperatorName(machine.operatorName);
  return (
    normalizedName.length > 0 &&
    normalizedName !== "NO ACTIVE OPERATOR" &&
    normalizedName !== "UNKNOWN"
  );
}

function getMachineTotalSeconds(machine: MachineCardRecord) {
  const totalMetric = machine.metrics.find((metric) => metric.label === "Total");
  return parseDurationLabelToSeconds(totalMetric?.value);
}

function buildProductionLeaderboardEntries(
  machines: MachineCardRecord[],
): ProductionLeaderboardEntry[] {
  const grouped = new Map<
    string,
    {
      displayName: string;
      machineCount: number;
      machineHoursSeconds: number;
      pauseCount: number;
    }
  >();

  for (const machine of machines) {
    if (!isTrackableOperator(machine)) {
      continue;
    }

    const key = normalizeOperatorName(machine.operatorName);
    const current = grouped.get(key) ?? {
      displayName: formatOperatorDisplayName(machine.operatorName),
      machineCount: 0,
      machineHoursSeconds: 0,
      pauseCount: 0,
    };

    current.machineCount += 1;
    current.machineHoursSeconds += getMachineTotalSeconds(machine);
    current.pauseCount += machine.pauseCount;
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((entry) => ({
      operatorName: entry.displayName,
      machineCount: entry.machineCount,
      machineHoursSeconds: entry.machineHoursSeconds,
      manHoursSeconds:
        entry.machineCount > 0
          ? Math.floor(entry.machineHoursSeconds / entry.machineCount)
          : 0,
      pauseCount: entry.pauseCount,
    }))
    .sort((left, right) => {
      if (right.machineCount !== left.machineCount) {
        return right.machineCount - left.machineCount;
      }

      if (right.machineHoursSeconds !== left.machineHoursSeconds) {
        return right.machineHoursSeconds - left.machineHoursSeconds;
      }

      if (right.pauseCount !== left.pauseCount) {
        return right.pauseCount - left.pauseCount;
      }

      return left.operatorName.localeCompare(right.operatorName);
    });
}

function SectionTitle({
  eyebrow,
  title,
}: {
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="mb-3">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.045em] text-slate-800">
        {title}
      </h2>
    </div>
  );
}

function ProductionTable({
  entries,
}: {
  entries: ProductionLeaderboardEntry[];
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-[22px] border border-slate-200/90 bg-slate-50/90 px-4 py-6 text-sm text-slate-500">
        Waiting for live operator data.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white/90">
      <div className="grid grid-cols-[minmax(0,1.8fr)_88px_96px_80px] gap-x-3 border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,244,235,0.95),rgba(255,239,229,0.9))] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        <span>Operator Name</span>
        <span>Man Hrs</span>
        <span>Machine Hrs</span>
        <span>Pause</span>
      </div>

      <div className="divide-y divide-slate-200/75">
        {entries.map((entry) => (
          <div
            key={entry.operatorName}
            className="grid grid-cols-[minmax(0,1.8fr)_88px_96px_80px] items-center gap-x-3 px-4 py-3 text-[15px] text-slate-700"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-semibold text-slate-800">
                  {entry.operatorName}
                </span>
                {entry.machineCount > 1 ? (
                  <span className="inline-flex min-w-11 items-center justify-center rounded-full border border-emerald-300/90 bg-emerald-50/95 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-[0_10px_18px_-16px_rgba(16,185,129,0.78)]">
                    X{entry.machineCount}
                  </span>
                ) : null}
              </div>
            </div>

            <span className="font-medium text-slate-700">
              {formatHoursMinutesFromSeconds(entry.manHoursSeconds)}
            </span>
            <span className="font-medium text-slate-700">
              {formatHoursMinutesFromSeconds(entry.machineHoursSeconds)}
            </span>
            <span className="font-semibold text-slate-800">
              {entry.pauseCount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QcTable({
  entries,
}: {
  entries: QcLeaderboardEntry[];
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white/90">
      <div className="grid grid-cols-[minmax(0,1.8fr)_88px_96px_80px] gap-x-3 border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,244,235,0.95),rgba(255,239,229,0.9))] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        <span>Name</span>
        <span>Man Hrs</span>
        <span>Machine Hrs</span>
        <span>Pause</span>
      </div>

      {entries.length === 0 ? (
        <div className="px-4 py-6 text-sm text-slate-500">
          No QC operator data available.
        </div>
      ) : (
        <div className="divide-y divide-slate-200/75">
          {entries.map((entry) => (
            <div
              key={entry.name}
              className="grid grid-cols-[minmax(0,1.8fr)_88px_96px_80px] items-center gap-x-3 px-4 py-3 text-[15px] text-slate-700"
            >
              <span className="truncate font-semibold text-slate-800">
                {entry.name}
              </span>
              <span className="font-medium text-slate-700">
                {entry.manHoursLabel}
              </span>
              <span className="font-medium text-slate-700">
                {entry.machineHoursLabel}
              </span>
              <span className="font-semibold text-slate-800">
                {entry.pauseCount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MachineReportTable({
  entries,
}: {
  entries: MachineReportEntry[];
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white/90">
      <div className="grid grid-cols-[minmax(0,1.2fr)_64px_72px_64px_72px] gap-x-3 border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,244,235,0.95),rgba(255,239,229,0.9))] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        <span>Machine</span>
        <span>Prod</span>
        <span>Maint</span>
        <span>Set</span>
        <span>Cal</span>
      </div>

      {entries.length === 0 ? (
        <div className="px-4 py-6 text-sm text-slate-500">
          No machine report data available.
        </div>
      ) : (
        <div className="divide-y divide-slate-200/75">
          {entries.map((entry) => (
            <div
              key={entry.machineId}
              className="grid grid-cols-[minmax(0,1.2fr)_64px_72px_64px_72px] items-center gap-x-3 px-4 py-3 text-[15px] text-slate-700"
            >
              <span className="truncate font-semibold text-slate-800">
                {getMachineLabel(entry.machineId)}
              </span>
              <span className="font-medium text-slate-700">
                {entry.productionCount}
              </span>
              <span className="font-medium text-slate-700">
                {entry.maintenanceCount}
              </span>
              <span className="font-medium text-slate-700">
                {entry.settingCount}
              </span>
              <span className="font-medium text-slate-700">
                {entry.calibrationCount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OperatorLeaderboard({
  machines,
  machineReport,
}: OperatorLeaderboardProps) {
  const productionEntries = buildProductionLeaderboardEntries(machines);
  const qcEntries = buildQcLeaderboardEntries();

  return (
    <aside className="rounded-[28px] border border-white/80 bg-white/88 p-4 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.42)] backdrop-blur xl:sticky xl:top-6">
      <div className="space-y-6">
        <section>
          <SectionTitle
            eyebrow="Right Side Leaderboard"
            title="Production Operator"
          />
          <ProductionTable entries={productionEntries} />
        </section>

        <section>
          <SectionTitle title="QC Operator Incharge" />
          <QcTable entries={qcEntries} />
        </section>

        <section>
          <SectionTitle title="Machine Report" />
          <MachineReportTable entries={machineReport} />
        </section>
      </div>
    </aside>
  );
}
