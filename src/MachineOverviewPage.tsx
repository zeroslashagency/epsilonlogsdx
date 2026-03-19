import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  compareDashboardMachineOrder,
  DEFAULT_DASHBOARD_MACHINE_IDS,
} from "./data/machineConfig";

import { MachineGrid } from "./components/MachineGrid";
import { MachineOverviewHeader } from "./components/MachineOverviewHeader";
import { MachineSummaryDialog } from "./components/MachineSummaryDialog";
import {
  mockMachines,
  type MachineCardRecord,
} from "./data/mockMachines";
import "./machine-overview-shop.css";

export default function MachineOverviewPage() {
  const refreshTimeoutRef = useRef<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMachine, setSelectedMachine] =
    useState<MachineCardRecord | null>(null);

  const machines = useMemo(
    () =>
      [...mockMachines].sort((left, right) =>
        compareDashboardMachineOrder(
          left.machineId,
          right.machineId,
          DEFAULT_DASHBOARD_MACHINE_IDS,
        ),
      ),
    [],
  );

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  function handleRefresh() {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
    }

    setIsRefreshing(true);
    refreshTimeoutRef.current = window.setTimeout(() => {
      setIsRefreshing(false);
      refreshTimeoutRef.current = null;
    }, 900);
  }

  const boardSummary = `Today live board · Showing ${machines.length} machines · ${
    isRefreshing ? "Refreshing board..." : "Updated Just now"
  }`;

  return (
    <div className="machine-overview-shop-page">
      <main className="machine-overview-shop-board min-h-screen">
        <section className="mx-auto w-full max-w-[1680px] px-3 py-5 sm:px-4 sm:py-7 lg:px-6">
          <MachineOverviewHeader
            boardSummary={boardSummary}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
          <MachineGrid
            machines={machines}
            selectedMachineId={selectedMachine?.machineId ?? null}
            onSelect={setSelectedMachine}
          />
        </section>
      </main>

      <MachineSummaryDialog
        machine={selectedMachine}
        onClose={() => setSelectedMachine(null)}
      />
    </div>
  );
}
