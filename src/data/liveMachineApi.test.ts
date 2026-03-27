import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchLatestDeviceLogs,
  resetDeviceLogTotalPagesCache,
  type DeviceLogEntry,
} from "./liveMachineApi";

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

function createJsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
  } as Response;
}

describe("fetchLatestDeviceLogs request budget", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    resetDeviceLogTotalPagesCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetDeviceLogTotalPagesCache();
  });

  it("uses one request when the machine has one page", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        success: true,
        result: {
          logs: [
            createDeviceLogEntry({
              log_id: 1,
              log_time: "2026-03-27T09:59:00.000Z",
            }),
            createDeviceLogEntry({
              log_id: 2,
              log_time: "2026-03-27T10:01:00.000Z",
            }),
          ],
          pagination: { total_pages: 1 },
        },
      }),
    );

    const result = await fetchLatestDeviceLogs(
      {
        deviceId: 11,
        startDate: "27-03-2026 00:00",
        endDate: "27-03-2026 10:15",
      },
      "token",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.logs.map((entry) => entry.log_id)).toEqual([2, 1]);
  });

  it("uses two requests when the machine has two pages", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          result: {
            logs: [createDeviceLogEntry({ log_id: 10 })],
            pagination: { total_pages: 2 },
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          result: {
            logs: [createDeviceLogEntry({ log_id: 20 })],
            pagination: { total_pages: 2 },
          },
        }),
      );

    const result = await fetchLatestDeviceLogs(
      {
        deviceId: 11,
        startDate: "27-03-2026 00:00",
        endDate: "27-03-2026 10:15",
      },
      "token",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.map(([url]) =>
        new URL(String(url), "http://localhost").searchParams.get("page"),
      ),
    ).toEqual(["1", "2"]);
    expect(result.logs.map((entry) => entry.log_id)).toEqual([20]);
  });

  it("uses three requests when the machine has six pages and pagesBack is two", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          result: {
            logs: [createDeviceLogEntry({ log_id: 100 })],
            pagination: { total_pages: 6 },
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          result: {
            logs: [
              createDeviceLogEntry({
                log_id: 501,
                log_time: "2026-03-27T10:05:00.000Z",
              }),
            ],
            pagination: { total_pages: 6 },
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          result: {
            logs: [
              createDeviceLogEntry({
                log_id: 601,
                log_time: "2026-03-27T10:06:00.000Z",
              }),
            ],
            pagination: { total_pages: 6 },
          },
        }),
      );

    const result = await fetchLatestDeviceLogs(
      {
        deviceId: 11,
        startDate: "27-03-2026 00:00",
        endDate: "27-03-2026 10:15",
      },
      "token",
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.map(([url]) =>
        new URL(String(url), "http://localhost").searchParams.get("page"),
      ),
    ).toEqual(["1", "5", "6"]);
    expect(result.logs.map((entry) => entry.log_id)).toEqual([601, 501]);
  });

  it("reuses cached total pages to skip the metadata page on repeat refreshes", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          result: {
            logs: [createDeviceLogEntry({ log_id: 100 })],
            pagination: { total_pages: 6 },
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          result: {
            logs: [createDeviceLogEntry({ log_id: 501 })],
            pagination: { total_pages: 6 },
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          result: {
            logs: [createDeviceLogEntry({ log_id: 601 })],
            pagination: { total_pages: 6 },
          },
        }),
      );

    await fetchLatestDeviceLogs(
      {
        deviceId: 11,
        startDate: "27-03-2026 00:00",
        endDate: "27-03-2026 10:15",
      },
      "token",
    );

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          result: {
            logs: [
              createDeviceLogEntry({
                log_id: 502,
                log_time: "2026-03-27T10:05:00.000Z",
              }),
            ],
            pagination: { total_pages: 6 },
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          result: {
            logs: [
              createDeviceLogEntry({
                log_id: 602,
                log_time: "2026-03-27T10:06:00.000Z",
              }),
            ],
            pagination: { total_pages: 6 },
          },
        }),
      );

    const result = await fetchLatestDeviceLogs(
      {
        deviceId: 11,
        startDate: "27-03-2026 00:00",
        endDate: "27-03-2026 10:16",
      },
      "token",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.map(([url]) =>
        new URL(String(url), "http://localhost").searchParams.get("page"),
      ),
    ).toEqual(["5", "6"]);
    expect(result.logs.map((entry) => entry.log_id)).toEqual([602, 502]);
  });

  it("fetches only the missing newest page when cached total pages increases", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          result: {
            logs: [createDeviceLogEntry({ log_id: 10 })],
            pagination: { total_pages: 2 },
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          result: {
            logs: [createDeviceLogEntry({ log_id: 20 })],
            pagination: { total_pages: 2 },
          },
        }),
      );

    await fetchLatestDeviceLogs(
      {
        deviceId: 15,
        startDate: "27-03-2026 00:00",
        endDate: "27-03-2026 10:15",
      },
      "token",
    );

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          result: {
            logs: [
              createDeviceLogEntry({
                log_id: 21,
                log_time: "2026-03-27T10:05:00.000Z",
              }),
            ],
            pagination: { total_pages: 3 },
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          result: {
            logs: [
              createDeviceLogEntry({
                log_id: 31,
                log_time: "2026-03-27T10:06:00.000Z",
              }),
            ],
            pagination: { total_pages: 3 },
          },
        }),
      );

    const result = await fetchLatestDeviceLogs(
      {
        deviceId: 15,
        startDate: "27-03-2026 00:00",
        endDate: "27-03-2026 10:16",
      },
      "token",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.map(([url]) =>
        new URL(String(url), "http://localhost").searchParams.get("page"),
      ),
    ).toEqual(["2", "3"]);
    expect(result.logs.map((entry) => entry.log_id)).toEqual([31, 21]);
  });
});
