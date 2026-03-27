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
   - repeat refreshes reuse cached `total_pages` and skip the metadata-only `page=1` request
   - when `total_pages` grows, only the missing newest page is fetched

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

Phase 1 did not change the initial cold-start request budget.

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

### D2. Repeat Refresh API Budget With Cached Pagination

For machines that were already fetched once on the same day, the client now reuses the last known `total_pages` and skips the extra metadata discovery call when the page count is unchanged.

Per machine on a stable repeat refresh:

- `total_pages <= 1` => `1` request
- `total_pages === 2` => `1` request
- `total_pages >= 3` => `2` requests with current `pagesBack = 2`

What changed:

- before: multi-page machines always paid one extra `page=1` request just to learn `total_pages`
- after: repeat refreshes jump straight to the last known latest pages and only fall back if pagination drifted

Verified by:

- `fetchLatestDeviceLogs request budget > reuses cached total pages to skip the metadata page on repeat refreshes`
- `fetchLatestDeviceLogs request budget > fetches only the missing newest page when cached total pages increases`

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

### G. Production Trace Breakdown

Captured production trace:

- host: `https://epsilonlogsdx.vercel.app`
- window: `start_date=28-03-2026 00:00`
- captured minute: `end_date=28-03-2026 02:22`

One full refresh cycle from the trace was:

| Machine | Requests | Calls |
| --- | ---: | --- |
| `11` | `3` | `page=1,2,3` |
| `12` | `3` | `page=1,19,20` |
| `13` | `1` | `page=1` |
| `14` | `3` | `page=1,3,4` |
| `15` | `2` | `page=1,2` |
| `16` | `2` | `page=1,2` |
| `18` | `1` | `page=1` |
| `19` | `3` | `page=1,3,4` |

Total for one refresh cycle:

- `18` requests for `8` machines

Why the same URLs appeared again:

- the dashboard refreshed again in the same minute
- `formatDateForApi()` uses minute precision, not seconds
- two refreshes inside `02:22` therefore produced the same URLs

What the trace proves:

- no machine was missing
- the repeated request set was not random API misuse
- the frontend matched the current code path exactly
- the main waste was metadata-only `page=1` discovery on multi-page machines

Expected repeat-refresh impact for that exact production pattern:

| Pattern | Before | After cached pagination |
| --- | ---: | ---: |
| One refresh cycle | `18` requests | `12` requests |
| Two cycles in same minute | `36` requests | `24` requests |
| Reduction | `33.3%` | |

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

- a true first-ever cold refresh still fans out to the same `device-log` request count
- stable repeat refreshes are cheaper, but the dashboard still needs multiple `device-log` calls per machine
- the dashboard still depends on paginated raw log aggregation

The next real reduction step is still the aggregate API path described in:

- `dashboard-api-request-audit.md`
