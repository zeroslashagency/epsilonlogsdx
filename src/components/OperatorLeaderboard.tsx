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
  machineReportStartLabel: string;
  machineReportAgeLabel: string;
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.04em] text-slate-800">
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
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: "45%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "15%" }} />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,244,235,0.95),rgba(255,239,229,0.9))] text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <th className="px-3 py-2.5 text-left align-top">Operator Name</th>
            <th className="px-2 py-2.5 text-center align-top">Man Hrs</th>
            <th className="px-2 py-2.5 text-center align-top">Machine Hrs</th>
            <th className="px-2 py-2.5 text-center align-top">Pause</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.operatorName}
              className="border-t border-slate-200/75 text-[13px] text-slate-700"
            >
              <td className="px-3 py-3 align-middle">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-semibold text-slate-800">
                    {entry.operatorName}
                  </span>
                  {entry.machineCount > 1 ? (
                    <span className="inline-flex min-w-9 items-center justify-center rounded-full border border-emerald-300/90 bg-emerald-50/95 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 shadow-[0_10px_18px_-16px_rgba(16,185,129,0.78)]">
                      X{entry.machineCount}
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-2 py-3 text-center font-medium tabular-nums text-slate-700">
                {formatHoursMinutesFromSeconds(entry.manHoursSeconds)}
              </td>
              <td className="px-2 py-3 text-center font-medium tabular-nums text-slate-700">
                {formatHoursMinutesFromSeconds(entry.machineHoursSeconds)}
              </td>
              <td className="px-2 py-3 text-center font-semibold tabular-nums text-slate-800">
                {entry.pauseCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: "45%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "15%" }} />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,244,235,0.95),rgba(255,239,229,0.9))] text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <th className="px-3 py-2.5 text-left align-top">Name</th>
            <th className="px-2 py-2.5 text-center align-top">Man Hrs</th>
            <th className="px-2 py-2.5 text-center align-top">Machine Hrs</th>
            <th className="px-2 py-2.5 text-center align-top">Pause</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-sm text-slate-500">
                No QC operator data available.
              </td>
            </tr>
          ) : (
            entries.map((entry) => (
              <tr
                key={entry.name}
                className="border-t border-slate-200/75 text-[13px] text-slate-700"
              >
                <td className="truncate px-3 py-3 font-semibold text-slate-800">
                  {entry.name}
                </td>
                <td className="px-2 py-3 text-center font-medium tabular-nums text-slate-700">
                  {entry.manHoursLabel}
                </td>
                <td className="px-2 py-3 text-center font-medium tabular-nums text-slate-700">
                  {entry.machineHoursLabel}
                </td>
                <td className="px-2 py-3 text-center font-semibold tabular-nums text-slate-800">
                  {entry.pauseCount}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
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
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: "42%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,244,235,0.95),rgba(255,239,229,0.9))] text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <th className="px-3 py-2.5 text-left align-top">Machine</th>
            <th className="px-2 py-2.5 text-center align-top">Prod</th>
            <th className="px-2 py-2.5 text-center align-top">Maint</th>
            <th className="px-2 py-2.5 text-center align-top">Set</th>
            <th className="px-2 py-2.5 text-center align-top">Cal</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-sm text-slate-500">
                No machine report data available.
              </td>
            </tr>
          ) : (
            entries.map((entry) => (
              <tr
                key={entry.machineId}
                className="border-t border-slate-200/75 text-[13px] text-slate-700"
              >
                <td className="truncate px-3 py-3 font-semibold text-slate-800">
                  {getMachineLabel(entry.machineId)}
                </td>
                <td className="px-2 py-3 text-center font-medium tabular-nums text-slate-700">
                  {entry.productionCount}
                </td>
                <td className="px-2 py-3 text-center font-medium tabular-nums text-slate-700">
                  {entry.maintenanceCount}
                </td>
                <td className="px-2 py-3 text-center font-medium tabular-nums text-slate-700">
                  {entry.settingCount}
                </td>
                <td className="px-2 py-3 text-center font-medium tabular-nums text-slate-700">
                  {entry.calibrationCount}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function MachineReportHeader({
  startLabel,
  ageLabel,
}: {
  startLabel: string;
  ageLabel: string;
}) {
  return (
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2">
      <h2 className="truncate text-[17px] font-semibold tracking-[-0.04em] text-slate-800">
        Machine Report
      </h2>
      <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
        24H
      </span>
      <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
        Start {startLabel}
      </span>
      <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
        {ageLabel}
      </span>
    </div>
  );
}

export function OperatorLeaderboard({
  machines,
  machineReport,
  machineReportStartLabel,
  machineReportAgeLabel,
}: OperatorLeaderboardProps) {
  const productionEntries = buildProductionLeaderboardEntries(machines);
  const qcEntries = buildQcLeaderboardEntries();

  return (
    <aside className="rounded-[26px] border border-white/80 bg-white/88 p-3 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.42)] backdrop-blur min-[1500px]:sticky min-[1500px]:top-5">
      <div className="space-y-5">
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
          <MachineReportHeader
            startLabel={machineReportStartLabel}
            ageLabel={machineReportAgeLabel}
          />
          <MachineReportTable entries={machineReport} />
        </section>
      </div>
    </aside>
  );
}
