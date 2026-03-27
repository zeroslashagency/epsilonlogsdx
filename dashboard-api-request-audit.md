# Dashboard API Request Audit

Date: 2026-03-27

## Scope

This audit reviewed the dashboard request flow in:

- `src/MachineOverviewPage.tsx`
- `src/data/liveMachineApi.ts`
- `src/data/liveMachineData.ts`
- `src/components/*`
- `api/v2/[...path].js`
- `vite.config.ts`

The review was split across five parallel tracks:

1. React lifecycle and polling behavior
2. API fan-out and pagination cost
3. Proxy/backend surface area
4. UI data dependency analysis
5. Verification and testability

`npm run typecheck` and `npm run build` both passed during this audit.

## Executive Summary

The current dashboard is doing client-side fan-out plus client-side aggregation.

One refresh of the dashboard can trigger:

- Best case: `8` upstream requests
- Worst realistic case: `24` upstream requests

That cost comes from 8 machines and this pattern:

- 1 `device-log` chain per machine
- page 1 fetched first to read `total_pages`
- then the newest 1 to 2 pages fetched again for actual data

At the current 30-second auto-refresh interval, one open tab can generate:

- `960` requests/hour in the best case
- `2,880` requests/hour in the worst realistic case

There is a more serious issue than request volume alone:

- the dashboard uses only the latest paginated log tail
- but it derives day-level counts, key timers, pause timers, cycle totals, and total duration from that truncated history

So today the dashboard is not only expensive, it is also at risk of being wrong.

## Current Request Model

### Frontend Flow

1. `MachineOverviewPage` calls `fetchLiveMachineCards()` on mount, manual refresh, and every 30 seconds.
2. `fetchLiveMachineCards()` loops all 8 dashboard machines with `Promise.all`.
3. For each machine, `fetchLatestDeviceLogs()` calls `/api/v2/device-log`.
4. The browser-side code then computes:
   - machine card state
   - pause/key state
   - current WO summary
   - operator totals
   - machine report counts

### Request Math

Per machine:

- `1` request if `total_pages <= 1`
- `2` requests if `total_pages === 2`
- `3` requests if `total_pages >= 3`

For 8 machines:

- `8` requests if all machines have one page
- `16` requests if all machines have two pages
- `24` requests if all machines have three or more pages

### Important Clarification

The repo does not show any existing aggregate dashboard endpoint being used.

The proxy layer is already generic enough to support one:

- dev: `vite.config.ts`
- prod: `api/v2/[...path].js`

So if the backend already has an all-data dashboard API, this frontend is simply not wired to it yet.

## Critical Findings

### 1. High: Per-refresh fan-out is the main request problem

References:

- `src/MachineOverviewPage.tsx:152`
- `src/MachineOverviewPage.tsx:230`
- `src/data/liveMachineData.ts:1062`
- `src/data/liveMachineApi.ts:155`
- `src/data/machineConfig.ts:16`

`fetchLiveMachineCards()` fans out into one paginated `device-log` flow per machine. That means the dashboard is paying an N-way request cost every 30 seconds for a UI that only renders a compact summary.

Impact:

- unnecessary request amplification
- backend load scales linearly with machine count
- request volume repeats even when nothing changed

### 2. High: Page 1 is used as pagination metadata overhead

References:

- `src/data/liveMachineApi.ts:161`
- `src/data/liveMachineApi.ts:170`
- `src/data/liveMachineApi.ts:181`

For machines with multiple pages, page 1 is fetched only to learn `total_pages`, then the newest page numbers are fetched afterward. In the `3+` page case, page 1 is pure overhead. If all 8 machines hit that path, 8 of 24 requests are just pagination discovery.

Impact:

- wasted network traffic
- wasted backend work
- slower refresh completion

### 3. High: The dashboard derives day-level and timer metrics from truncated history

References:

- `src/data/liveMachineApi.ts:155`
- `src/data/liveMachineData.ts:817`
- `src/data/liveMachineData.ts:936`
- `src/data/liveMachineData.ts:1115`
- `src/components/OperatorLeaderboard.tsx:323`

The UI labels the report as `24H`, but the code actually fetches from local midnight to now, then truncates each machine to only the latest page tail. That means these outputs can be incomplete:

- machine report counts
- operator hours
- pause counts
- key duration
- current WO cycles
- current WO total duration

Impact:

- request reduction work can easily hide correctness regressions
- the current dashboard may already undercount active and same-day work

### 4. High: Polling continues in cases where it should stop or wait

References:

- `src/MachineOverviewPage.tsx:152`
- `src/MachineOverviewPage.tsx:226`
- `src/MachineOverviewPage.tsx:230`
- `src/main.tsx:7`

Observed issues:

- 30-second polling does not wait for the previous cycle to finish
- a new cycle aborts the old one, but the old requests may already have hit the backend
- fresh session cache still triggers a full network reload on mount
- hidden tabs keep polling
- React Strict Mode doubles the mount fetch in development

Impact:

- extra requests without user benefit
- misleading network measurements in local development
- multiple open dashboard tabs multiply backend load

### 5. High: No automated way exists to prove the optimization safely

References:

- `package.json:6`
- `src/main.tsx:7`
- `api/v2/[...path].js:29`

There is no test runner, no fixtures, no proxy contract coverage, and no request-count instrumentation. So any optimization today would be hard to validate and easy to ship incorrectly.

Impact:

- optimization work is high-risk without a guardrail
- regressions will likely show up in production, not in CI

## Secondary Findings

### 6. Medium: `fetchCurrentWorkOrderLogs()` is safer for long WO correctness but worse for request count

References:

- `src/data/liveMachineApi.ts:189`
- `src/data/liveMachineApi.ts:215`

There is already a helper that walks backward until the current WO disappears. It is not used by the dashboard today. That is good for request volume, because if this path is used blindly, one machine can reach up to 13 requests in one refresh.

Conclusion:

- do not switch the dashboard to this helper as a request optimization
- it solves correctness for long-running WOs at the cost of even more requests

### 7. Medium: `fetchWoDetails()` is an unused latent N+1 risk

References:

- `src/data/liveMachineApi.ts:253`
- `src/data/liveMachineData.ts:1123`

The current refresh path does not call `/wo/:id`, but if future enrichment starts calling it per machine or per WO, request count will increase immediately.

### 8. Medium: Operator totals are derived by parsing display strings

References:

- `src/components/OperatorLeaderboard.tsx:55`
- `src/data/liveMachineData.ts:882`

The leaderboard recovers machine hours by parsing the formatted `Total` string from card metrics. That is fragile and will break or drift if the display format changes.

## What The UI Actually Needs

The UI does not render raw event history.

It mainly needs:

- latest machine state
- last event timestamp and action
- current WO identity
- operator name
- part number
- pause state, pause reason, pause count
- key state and key start time
- current WO summary:
  - PCL
  - cycles
  - total duration
- per-machine activity counts for the report table

This is summary data, not raw paginated log data.

## Root Cause

The current contract is backward:

- backend exposes raw paginated logs
- frontend reverse-engineers dashboard state from those logs

That forces the browser to own:

- pagination traversal
- time-window interpretation
- pause/key inference
- WO rollups
- operator aggregation

This is the main architectural reason request count is high.

## Recommended Plan

### Phase 1: Immediate low-risk request reduction

Goal: reduce obvious waste without changing the dashboard contract yet.

1. Serialize polling.
   - Replace the fixed `setInterval` pattern with a completion-driven refresh loop.
   - Do not start a new refresh while one is active.

2. Pause refresh while hidden.
   - Stop polling when `document.hidden === true`.
   - Trigger one catch-up refresh when the tab becomes visible again.

3. Respect fresh cache.
   - If session cache is newer than the poll interval, skip the immediate mount refresh.
   - Use stale-while-revalidate only after the freshness window expires.

4. Measure request count before and after.
   - Add temporary request-count logging around the dashboard fetch layer or proxy.

Expected result:

- fewer useless refresh bursts
- lower backend pressure from hidden tabs and remounts
- better visibility into real request volume

### Phase 2: Main fix for request count

Goal: collapse the dashboard from `8-24` requests per refresh to `1`.

Add one aggregate endpoint, for example:

`GET /api/v2/dashboard/overview?device_ids=11,12,13,14,15,16,19,18&window=today`

Recommended response shape:

```json
{
  "success": true,
  "result": {
    "generated_at": "2026-03-27T10:15:00+05:30",
    "window": {
      "start": "2026-03-27T00:00:00+05:30",
      "end": "2026-03-27T10:15:00+05:30",
      "timezone": "Asia/Kolkata"
    },
    "machines": [
      {
        "device_id": 11,
        "last_event": {
          "id": 123,
          "time": "2026-03-27T10:11:00+05:30",
          "action": "WO_PAUSE"
        },
        "state": {
          "code": "PAUSED",
          "since": "2026-03-27T09:58:00+05:30",
          "message": "Work order is paused."
        },
        "current_wo": {
          "internal_id": 987,
          "display_id": "3038",
          "part_no": "PART-1",
          "operator_name": "PALANISAMY",
          "job_type": "Setting",
          "execution_status": "PROCESSING",
          "pcl_sec": 480,
          "total_cycles": 14,
          "total_duration_sec": 8120
        },
        "pause": {
          "active": true,
          "started_at": "2026-03-27T09:58:00+05:30",
          "reason": "Tool change",
          "count_for_current_wo": 2
        },
        "key": {
          "active": false,
          "started_at": null,
          "last_action": "KEY_OFF"
        },
        "activity_counts": {
          "production": 3,
          "maintenance": 0,
          "setting": 1,
          "calibration": 0
        },
        "warnings": []
      }
    ],
    "warnings": []
  }
}
```

Key rules:

- backend owns pagination traversal
- backend owns today/24h window semantics
- backend returns exact timestamps for timers
- backend returns numeric duration fields, not only formatted strings

Expected result:

- one request per refresh
- lower backend and browser work
- simpler frontend logic

### Phase 3: Remove fragile client-side aggregation

Goal: simplify and harden the dashboard after aggregate API exists.

1. Replace `fetchLiveMachineCards()` raw-log pipeline with one overview fetch.
2. Stop building report rows in the browser for the dashboard path.
3. Stop parsing formatted strings for operator-hour calculations.
4. Keep raw log processing only in views that truly need event history.

Expected result:

- smaller frontend surface area
- clearer ownership of business logic
- lower chance of correctness drift

## Do Not Do

Avoid these changes as a first optimization:

- do not switch the dashboard to `fetchCurrentWorkOrderLogs()` globally
- do not add per-WO `fetchWoDetails()` calls for enrichment
- do not optimize request count first and ignore data correctness
- do not measure request count only in `vite` dev mode without accounting for Strict Mode

## Verification Plan

### Baseline Checks Already Run

- `npm run typecheck`
- `npm run build`

Both passed.

### Required Automated Coverage

1. Unit tests for `fetchLatestDeviceLogs()`
   - `totalPages = 1`
   - `totalPages = 2`
   - `totalPages = 6`
   - assert exact requested pages
   - assert dedupe and sort behavior

2. Unit tests for `fetchCurrentWorkOrderLogs()`
   - WO spans multiple pages
   - stops when WO disappears

3. Unit tests for dashboard derivation
   - LIVE
   - PAUSED
   - KEY
   - OFFLINE
   - API partial failure
   - duplicate logs across pages

4. Proxy contract tests
   - blocked headers stripped
   - content type preserved
   - backend status/body preserved
   - error shape preserved

5. Integration tests for `MachineOverviewPage`
   - mount request count
   - one 30-second refresh cycle
   - aborted refresh behavior
   - rendered card output
   - rendered report output

6. Golden dataset comparison
   - compare current dashboard output vs optimized dashboard output
   - fail on changes to:
     - status
     - WO label
     - operator
     - part number
     - pause reason/count
     - PCL
     - cycles
     - total
     - machine report counts

### Manual Test Cases

1. Machine with only one log page
2. Machine with two log pages
3. Machine with three or more pages
4. Current WO fully inside latest pages
5. Current WO spanning older pages
6. Paused WO
7. Key-active machine
8. Offline machine
9. Duplicate log IDs across pages
10. One machine API failure
11. Cross-midnight transition
12. Hidden-tab polling pause/resume

## Tooling Gaps

Current repo gaps:

- no `test` script in `package.json`
- no unit test framework
- no integration test framework
- no API fixtures
- no request-count instrumentation

Recommended minimum additions:

- `vitest`
- `@testing-library/react`
- `msw`

Add `playwright` only if end-to-end browser verification is needed after the API contract is stabilized.

## Final Prioritized Plan

1. Confirm whether the backend already exposes a dashboard aggregate endpoint.
   - If yes: wire the frontend to it immediately.
   - If no: add one behind the existing `/api/v2/*` proxy path.

2. In parallel, harden refresh behavior.
   - serialize polling
   - pause hidden-tab refresh
   - skip redundant mount refresh when cache is still fresh

3. Move dashboard summary logic to the backend.
   - latest state
   - pause/key timing
   - current WO summary
   - per-machine counts

4. Add tests before replacing the raw-log pipeline.
   - otherwise request reduction may silently change dashboard numbers

5. Remove client-side log aggregation from the dashboard path.
   - keep it only where raw history is truly needed

## Bottom Line

The main problem is not just that the dashboard refreshes often.

The main problem is that one summary dashboard is built from repeated, per-machine, paginated raw-log requests in the browser. That architecture creates both:

- too many API requests
- incorrect or incomplete dashboard numbers

The clean fix is:

- one aggregate dashboard endpoint
- one refresh request
- backend-owned summary logic
- test coverage around request count and visible dashboard output
