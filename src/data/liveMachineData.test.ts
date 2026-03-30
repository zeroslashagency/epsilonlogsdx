import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeviceLogEntry } from "./liveMachineApi";

const fetchLatestDeviceLogsMock = vi.hoisted(() => vi.fn());

vi.mock("./liveMachineApi", async () => {
  const actual =
    await vi.importActual<typeof import("./liveMachineApi")>("./liveMachineApi");

  return {
    ...actual,
    fetchLatestDeviceLogs: fetchLatestDeviceLogsMock,
  };
});

function createDeviceLogEntry(
  overrides: Partial<DeviceLogEntry>,
): DeviceLogEntry {
  return {
    log_id: 1,
    log_time: "2026-03-27T10:00:00.000Z",
    action: "WO_START",
    device_id: 11,
    ...overrides,
  };
}

describe("fetchLiveMachineCards idle-vs-live state", () => {
  beforeEach(() => {
    fetchLatestDeviceLogsMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps connectivity-only logs neutral when there is no active work order", async () => {
    fetchLatestDeviceLogsMock.mockResolvedValue({
      logs: [
        createDeviceLogEntry({
          action: "WIFI_OFF",
          wo_id: null,
          wo_name: null,
          part_no: null,
        }),
      ],
      totalPages: 1,
    });

    const { fetchLiveMachineCards } = await import("./liveMachineData");
    const result = await fetchLiveMachineCards({
      token: "test-token",
      machineIds: [11],
      now: new Date("2026-03-27T10:15:00.000Z"),
    });

    expect(result.machines[0]).toMatchObject({
      machineId: 11,
      variant: "idle",
      badgeLabel: "No Active WO",
      statusLabel: "IDLE",
      workOrderLabel: "No Active WO",
    });
    expect(result.machines[0]?.metrics).toEqual([
      { label: "Status", value: "Idle" },
      { label: "Last Seen", value: "15m ago" },
      { label: "Last Event", value: "WIFI_OFF" },
    ]);
  });

  it("shows green live state when a work order has actually started", async () => {
    fetchLatestDeviceLogsMock.mockResolvedValue({
      logs: [
        createDeviceLogEntry({
          action: "WO_START",
          wo_id: 3038,
          wo_name: "3038",
          part_no: "PART-1",
          start_name: "Palanisamy",
          job_type: 1,
        }),
      ],
      totalPages: 1,
    });

    const { fetchLiveMachineCards } = await import("./liveMachineData");
    const result = await fetchLiveMachineCards({
      token: "test-token",
      machineIds: [11],
      now: new Date("2026-03-27T10:15:00.000Z"),
    });

    expect(result.machines[0]).toMatchObject({
      machineId: 11,
      variant: "production",
      badgeLabel: "Production",
      statusLabel: "LIVE",
      workOrderLabel: "WO-3038",
      partNumber: "PART-1",
    });
  });
});
