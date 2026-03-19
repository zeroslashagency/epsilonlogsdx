import { motion } from "motion/react";

import type { MachineCardRecord } from "../data/mockMachines";
import { MachineCard } from "./MachineCard";

interface MachineGridProps {
  machines: MachineCardRecord[];
  selectedMachineId: number | null;
  onSelect: (machine: MachineCardRecord) => void;
}

export function MachineGrid({
  machines,
  selectedMachineId,
  onSelect,
}: MachineGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {machines.map((machine, index) => (
        <motion.div
          key={machine.machineId}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, delay: index * 0.045 }}
        >
          <MachineCard
            machine={machine}
            isSelected={machine.machineId === selectedMachineId}
            onSelect={onSelect}
          />
        </motion.div>
      ))}
    </div>
  );
}
