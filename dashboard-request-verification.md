# Dashboard Request Verification

Date: 2026-03-27

## Purpose

This file verifies the Phase 1 dashboard request reduction work without changing visible UI content.

Important limitation:

- Phase 1 reduces how often refreshes start.
- Phase 1 does not change the per-refresh backend fan-out yet.

So the comparison is:

- fewer refresh-triggered requests
- same dashboard UI
- same per-refresh `device-log` cost for now

## Automated Checks Added

Run:

```bash
npm run test:run
```

The test suite covers:

1. `src/MachineOverviewPage.test.tsx`
    - UI still renders the same dashboard content
    - fresh cache skips the immediate mount refresh
    - persistent cache hydrates the dashboard immediately on startup
    - successful refreshes are persisted for the next startup
    - cold start can render partial machine cards before the full dashboard refresh completes
    - hidden tab pauses polling
    - slow in-flight refresh does not overlap with another auto refresh
    - fast failures in a visible tab use retry backoff
    - browser offline state pauses auto refresh until the connection returns

2. `src/data/liveMachineApi.test.ts`
   - one-page machine uses 1 request
   - two-page machine uses 2 requests
   - six-page machine with `pagesBack = 2` uses 3 requests

## Before vs After

### A. Fresh Cache on Mount

Scenario:

- cached dashboard state is only 5 seconds old

Before:

- page mounted
- immediate refresh started anyway

After:

- page mounts from cache
- no immediate refresh starts
- refresh waits for the remaining 25 seconds

Verified by:

- `MachineOverviewPage request scheduling > skips the immediate mount refresh when the cache is still fresh`

### A2. Persistent Cache on Reopen

Scenario:

- session cache is empty
- browser still has a previously successful dashboard snapshot in persistent storage
- that snapshot is older than the 30 second refresh window but still recent enough to reuse

Before:

- dashboard waited for the live API path before cards could render

After:

- dashboard renders cached cards immediately from persistent storage
- background refresh starts right away to revalidate the snapshot

Verified by:

- `MachineOverviewPage request scheduling > hydrates from persistent cache immediately and revalidates in the background when that cache is stale`
- `MachineOverviewPage request scheduling > writes the last successful dashboard snapshot to persistent cache`

### A3. Cold Start Progressive Rendering

Scenario:

- no usable cache exists yet
- dashboard must call the live API path
- some machine requests finish earlier than others

Before:

- dashboard showed the loading state until all machine requests completed
- one slow machine held back the first visible machine cards

After:

- dashboard can render the first completed machine cards while the full refresh is still running
- remaining machines and the leaderboard continue filling in as the full result completes

Verified by:

- `MachineOverviewPage request scheduling > renders partial machine cards before the full cold-start refresh completes`

### B. Hidden Tab for 60 Seconds

Scenario:

- dashboard has already loaded once
- tab becomes hidden for 60 seconds

Before:

- 2 additional refresh cycles would start during that hidden period

After:

- 0 additional refresh cycles start while hidden
- 1 refresh starts when the tab becomes visible again

Verified by:

- `MachineOverviewPage request scheduling > pauses auto refresh while the tab is hidden and refreshes once on visibility restore`

### C. Slow Request Still In Flight at 60 Seconds

Scenario:

- initial refresh is still unresolved after 60 seconds

Before:

- fixed interval would start new refresh cycles at 30s and 60s
- total refresh starts by 60s: 3

After:

- no new auto refresh starts while the first request is still in flight
- total refresh starts by 60s: 1
- next auto refresh starts only 30 seconds after completion

Verified by:

- `MachineOverviewPage request scheduling > does not start overlapping auto refreshes while a request is still in flight`

### D. Per-Refresh API Budget

This part is unchanged by Phase 1.

Per machine:

- `total_pages <= 1` => `1` request
- `total_pages === 2` => `2` requests
- `total_pages >= 3` => `3` requests with current `pagesBack = 2`

For 8 machines:

- best case: `8` requests per refresh
- worst realistic case: `24` requests per refresh

Verified by:

- `fetchLatestDeviceLogs request budget > uses one request when the machine has one page`
- `fetchLatestDeviceLogs request budget > uses two requests when the machine has two pages`
- `fetchLatestDeviceLogs request budget > uses three requests when the machine has six pages and pagesBack is two`

### E. Fast Failures in a Visible Tab

Scenario:

- dashboard is open and visible
- every refresh fails quickly, for example browser offline mode or a hard API outage

Before:

- initial load starts immediately
- fixed interval starts another refresh every 30 seconds
- by 60 seconds there are 3 refresh starts total

After:

- initial load still starts immediately
- first retry waits 60 seconds
- second retry waits 120 seconds
- repeated failures back off instead of retrying every 30 seconds

Verified by:

- `MachineOverviewPage request scheduling > backs off repeated refresh failures instead of retrying every 30 seconds`

This reduces repeated `page=1` burst traffic during outages, but it does not change the per-refresh API fan-out.

### F. Browser Offline State

Scenario:

- dashboard is already open
- browser transitions to offline mode

Before:

- refreshes kept being attempted on the normal schedule

After:

- auto refresh is paused while offline
- no retry timer runs during the offline window
- one refresh starts when the browser comes back online

Verified by:

- `MachineOverviewPage request scheduling > pauses auto refresh while the browser is offline and refreshes once when it returns online`

## UI Equivalence Claim

What is actually verified for UI equivalence:

- machine label still renders
- operator name still renders
- WO label still renders
- part number still renders
- pause card content still renders
- right-side leaderboard headings still render
- Machine Report section still renders

This is intentionally scoped:

- the request-lifecycle change should not alter visible content
- the tests prove the render contract is intact for representative dashboard data

## Honest Conclusion

What has been proven now:

- the page starts fewer refresh cycles in the tested scenarios
- the page can render from persistent cache on reopen instead of waiting for a cold API path
- the page can show partial machine cards during a cold start instead of blocking on the slowest machine
- hidden tabs stop polling
- fresh cache avoids one immediate refresh
- slow requests do not trigger overlapping auto refreshes
- visible dashboard content still renders the same in the tested fixture

What has not been changed yet:

- one refresh still fans out to the same `device-log` request count
- the dashboard still depends on paginated raw log aggregation

The next real reduction step is still the aggregate API path described in:

- `dashboard-api-request-audit.md`
