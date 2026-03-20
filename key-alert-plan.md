# Key Alert Plan

## Goal
Add a `Key Alert` state to `machine-overview-shop` that behaves like the current pause alert, but is driven by real `KEY_ON` / `KEY_OFF` events from the live machine log pipeline.

## Assumption
- `Key Alert` means the latest relevant machine event is `KEY_ON` and there is no newer matching `KEY_OFF`.
- The card stays fixed on the grid like the pause alert card. It does not open a detail panel.
- The timer starts at the `KEY_ON` timestamp and stops when `KEY_OFF` arrives.

## Tasks
- [ ] Extend the card model with a `key` variant and `KEY ACTIVE` / `KEY COMPLETE` status labels. → Verify: `dashboard-types.ts` supports key state without reusing pause-only names.
- [ ] Detect active key windows from live machine logs by reusing the existing `KEY_ON` / `KEY_OFF` logic in `src/report-core/key-actions.ts`. → Verify: a machine with `KEY_ON` and no later `KEY_OFF` resolves to an active key snapshot.
- [ ] Add a key timer field parallel to `pauseStartedAt`, driven by the `KEY_ON` timestamp. → Verify: the timer renders as `HH:MM:SS` and increases once per second on the active key card.
- [ ] Add a key-card UI branch in `MachineCard.tsx` with a separate badge, icon, and color treatment. → Verify: the card is visually distinct from `Pause Alert` and uses the fixed summary layout.
- [ ] Show key-specific metrics only from real data. → Verify: the card can show `Key Started`, `Last Key Action`, and `WO / Operator` without any mock placeholders.
- [ ] Keep pause and key rules separate, with explicit priority if both signals appear in the same recent log set. → Verify: resolution order is deterministic and documented in code.
- [ ] Keep the refresh model simple: same fixed `30s` fetch cadence, same in-card live timer behavior as pause. → Verify: header still shows only the single `30s` refresh mode.

## Proposed Resolution Rule
1. `WO_PAUSE` without newer `WO_RESUME` or `WO_STOP` wins as `Pause Alert`.
2. Otherwise, `KEY_ON` without newer `KEY_OFF` wins as `Key Alert`.
3. Otherwise, the machine falls back to the normal production / setting / calibration / maintenance / offline pipeline.

## Text Mockup

```text
SHOP FLOOR DASHBOARD

┌──────────────────────────────────────────────────────────────┐
│ [key icon]  Key Alert                        KEY ACTIVE      │
│                                               14s ago        │
│                                                              │
│ VMC 2                                                        │
│ PALANISAMY                                                   │
│                                                              │
│ WO-3038                                                      │
│                                                              │
│  KEY ACTIVE FOR                                              │
│  00:12:44                                                    │
│                                                              │
│  SINGLE-MACHINE KEY ALERT                                    │
│                                                              │
│  Key Started        08:42:11 AM                              │
│  Last Key Action    KEY_ON                                   │
│  Current Job Type   Setting                                  │
│  Operator           PALANISAMY                               │
│                                                              │
│  Manual key mode is active on this machine.                  │
└──────────────────────────────────────────────────────────────┘
```

## UI Direction
- Badge label: `Key Alert`
- Status label:
  - `KEY ACTIVE` when `KEY_ON` is open
  - `KEY COMPLETE` when the last related event is `KEY_OFF`
- Suggested color direction:
  - key alert card: cyan / blue family
  - keep pause alert card: amber / yellow family
- Icon:
  - use a key icon instead of the pause icon
- Timing:
  - same live `HH:MM:SS` behavior as pause alert
  - timer is based on the `KEY_ON` time, not WO time

## Done When
- [ ] A live `KEY_ON` machine renders as a fixed key-alert card with a running timer.
- [ ] A later `KEY_OFF` clears or completes the key alert without mock data.
- [ ] Pause alert and key alert do not conflict or overwrite each other unpredictably.
- [ ] The board still uses real API data only.
