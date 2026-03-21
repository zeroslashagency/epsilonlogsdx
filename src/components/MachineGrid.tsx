import type { MachineCardRecord } from "../data/dashboard-types";
import { MachineCard } from "./MachineCard";

interface MachineGridProps {
  machines: MachineCardRecord[];
  currentTimeMs: number;
}

export function MachineGrid({
  machines,
  currentTimeMs,
}: MachineGridProps) {
  return (
    <div className="grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-4">
      {machines.map((machine, index) => (
        <div
          key={machine.machineId}
          className="machine-overview-shop-card-enter h-full"
          style={{
            animationDelay: `${index * 45}ms`,
          }}
        >
          <MachineCard
            machine={machine}
            currentTimeMs={currentTimeMs}
          />
        </div>
      ))}
    </div>
  );
}
