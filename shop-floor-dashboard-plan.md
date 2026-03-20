# Shop Floor Dashboard Plan

## Goal
Upgrade the standalone `machine-overview-shop` app into a `SHOP FLOOR DASHBOARD` that highlights paused machines on the affected single machine card, shows a live pause timer, displays the operator's last resume reason, and exposes pause-reason counts for that operator in the current shift behind login.

## Tasks
- [ ] Rename the product copy from "Machine Overview" to "SHOP FLOOR DASHBOARD" in `src/components/MachineOverviewHeader.tsx`, `src/MachineOverviewPage.tsx`, and `index.html`. Verify: the page title, browser tab, and header all show `SHOP FLOOR DASHBOARD`.
- [ ] Extend the machine data model in `src/data/mockMachines.ts` with pause-specific fields: `status`, `pauseStartedAt`, `lastResumeReason`, `pauseReasonCountThisShift`, `operatorId`, `shiftId`, and `requiresLogin`. Verify: one paused mock machine and one resumed mock machine can be rendered with no placeholder hacks.
- [ ] Add local session/auth state in `src/MachineOverviewPage.tsx` for a basic login gate around operator-only data. Verify: pause count and operator-only details stay hidden until login is active.
- [ ] Add a new single-machine paused-card visual state in `src/components/MachineCard.tsx` with yellow/white blinking treatment, a strong timer highlight, and a clear paused label. Verify: paused cards are visually distinct from production, setting, calibration, and offline cards at a glance without taking over the full dashboard.
- [ ] Build a live pause timer in `src/MachineOverviewPage.tsx` or a small timer hook that updates every second and formats time as `HH:MM:SS`. Verify: the paused-machine timer increments correctly in the UI without page reload.
- [ ] Add auto-refresh behavior with a default 30-second interval and a configurable ceiling of 60 seconds. Verify: data refresh runs automatically, the last-updated label changes, and manual refresh still works.
- [ ] Expand `src/components/MachineSummaryDialog.tsx` to show `Last Resume Reason`, `Pause Reason Count This Shift`, current pause state, and refresh timing details. Verify: clicking a paused card reveals all required operator context in one place.
- [ ] Add a login-only panel or lightweight sign-in control in the header so operator analytics are explicitly protected. Verify: logged-out users can still see machine status, but not shift-level pause counts.
- [ ] Add mock scenarios for edge cases: paused machine over 1 hour, paused machine under 30 seconds, missing resume reason, and no active operator. Verify: the UI stays readable and does not break when one field is unavailable.
- [ ] Run `npm run typecheck`, `npm run build`, and a manual dev check in `/Users/xoxo/Desktop/machine-overview-shop`. Verify: the standalone app compiles and the pause-state dashboard behaves as planned.

## Done When
- [ ] The standalone app is branded as `SHOP FLOOR DASHBOARD`.
- [ ] Paused machines visibly blink in yellow/white and show a live `HH:MM:SS` timer.
- [ ] The operator's last resume reason is displayed wherever the paused-machine summary is opened.
- [ ] Pause reason count is shown for the current operator and current shift only after login.
- [ ] Auto-refresh runs in the 30 to 60 second window without breaking the live timer.

## Notes
- Confirmed requirement: "Pause screen" means only the affected single machine card should blink, not a full-screen takeover for the entire app.
- Default refresh choice: 30 seconds, with a simple config option to move to 60 seconds later.
- Default login scope: local front-end login gate first, because login was not further specified.
- Default shift logic: use a mock current-shift identifier from the data layer first, then replace it with backend shift data when available.
- Likely file touch list: `src/MachineOverviewPage.tsx`, `src/components/MachineOverviewHeader.tsx`, `src/components/MachineCard.tsx`, `src/components/MachineSummaryDialog.tsx`, `src/data/mockMachines.ts`, `src/machine-overview-shop.css`, and `index.html`.
