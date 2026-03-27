# Key Alert Verification Plan

## Goal
Prove whether the `KEY` alert should trigger in `machine-overview-shop`, identify whether the problem is backend data or frontend logic, and verify the redesigned UI behavior with a repeatable checklist.

## Current Facts
- `KEY` alert is triggered only from `/api/v2/device-log` actions `KEY_ON` and `KEY_OFF`.
- `/api/v2/wo/:id` does not expose key status fields.
- Today, for dashboard machines `11, 12, 13, 14, 15, 16, 19, 18`, no `KEY_ON` or `KEY_OFF` rows were returned.
- Current UI redesign changed the full-card glow to a small red blinking key button only.

## Tasks
- [ ] Task 1: Verify API source of truth for key events in `/api/v2/device-log` only. -> Verify: direct API calls return `KEY_ON`/`KEY_OFF` rows or confirm none exist.
- [ ] Task 2: Verify `/api/v2/wo/:id` has no key-specific fields. -> Verify: sample WO payloads contain no `key_*` fields.
- [ ] Task 3: Verify frontend key-state detection from `resolveKeyState()` and `buildMachineSnapshot()`. -> Verify: open `KEY_ON` window sets `status: "KEY"`.
- [ ] Task 4: Verify priority rules against `PAUSE`, `OFFLINE`, and normal WO states. -> Verify: expected state wins for each mixed-event sequence.
- [ ] Task 5: Verify the redesigned UI shows only a small blinking key button, not a glowing full card. -> Verify: CSS classes no longer animate the outer key card.
- [ ] Task 6: Verify timer and labels on a real or simulated open key window. -> Verify: `KEY ACTIVE`, timer, and metrics render correctly.
- [ ] Task 7: Verify no regressions on non-key cards. -> Verify: pause, production, maintenance, and offline cards still render correctly.
- [ ] Task 8: Run build/typecheck and browser validation after each key change. -> Verify: `npm run typecheck`, `npm run build`, and manual browser check all pass.

## Test Matrix

### API truth tests
1. `device-log` returns `200` with valid token for one dashboard machine.
2. `device-log` returns paginated logs for today window `00:00 -> now`.
3. `device-log` newest page includes key rows when present.
4. `device-log` older pages include key rows when not on newest page.
5. `device-log` returns zero key rows for a machine with other logs today.
6. `device-log` returns zero logs for a machine with no activity today.
7. `device-log` `KEY_ON` row includes `device_id`.
8. `device-log` `KEY_ON` row includes `log_time`.
9. `device-log` `KEY_ON` row includes `wo_id` when WO exists.
10. `device-log` `KEY_OFF` row includes `device_id`.
11. `device-log` handles mixed-case or spaced action strings after normalization.
12. `device-log` rows sort correctly by time across pages.
13. `device-log` duplicate log rows are deduped safely.
14. `device-log` cross-midnight window respects requested start/end range.
15. `device-log` today window resets at `00:00` next day.
16. `wo/:id` returns `200` for sample WO IDs.
17. `wo/:id` has no `key_on` field.
18. `wo/:id` has no `key_off` field.
19. `wo/:id` has no alternate key state field.
20. Confirm backend key source is `device-log` only, not `wo`.

### Key detection logic tests
21. No logs -> key state is not active.
22. Logs without `KEY_ON` or `KEY_OFF` -> key state is not active.
23. One `KEY_ON` only -> key state becomes active.
24. One `KEY_ON` followed by `KEY_OFF` -> key state clears.
25. Multiple `KEY_ON` without `KEY_OFF` -> latest open key window stays active.
26. `KEY_OFF` without previous `KEY_ON` -> key state remains inactive.
27. `KEY_ON`, `KEY_OFF`, `KEY_ON` -> second key window becomes active.
28. `KEY_ON`, `KEY_OFF`, `KEY_OFF` -> key stays inactive.
29. `KEY_ON` older than newest non-key event -> key still active until `KEY_OFF`.
30. `KEY_ON` with invalid timestamp is ignored safely.
31. Key detection works when logs are initially descending from API.
32. Key detection works after internal ascending sort.
33. Key detection matches main repo helper behavior exactly.
34. `keyLastAction` becomes `KEY_ON` on open window.
35. `keyLastAction` becomes `KEY_OFF` after close window.
36. `alertStartedAt` uses `KEY_ON` timestamp.
37. `updatedLabel` uses latest machine event, not key start time.
38. `statusLabel` becomes `KEY ACTIVE` for open key window.
39. `variant` becomes `key` for open key window.
40. `alertKind` becomes `key` for open key window.

### Priority and mixed-state tests
41. `WO_PAUSE` newer than `KEY_ON` -> pause wins over key.
42. `KEY_ON` newer than `WO_PAUSE` but current code still gives pause if latest action is pause.
43. Offline age greater than 2h with older `KEY_ON` -> offline wins.
44. Maintenance latest log plus open key window -> key wins if not offline or paused.
45. Production latest log plus open key window -> key wins.
46. Calibration latest log plus open key window -> key wins.
47. Setting latest log plus open key window -> key wins.
48. Error snapshot -> error wins over key.
49. No active WO with open key window -> key still shows if `KEY_ON` exists.
50. `KEY_OFF` after offline threshold -> card should not stay in key state.

### Card content tests
51. Key card shows machine label.
52. Key card shows operator name.
53. Key card shows part number when available.
54. Key card shows WO label when available.
55. Key card shows `Key Active For` timer.
56. Key card shows `KEY ACTIVE` status pill.
57. Key card shows `Key Active` button text.
58. Key card shows key icon inside red button.
59. Key card shows `Last Key Action`.
60. Key card shows `Current Job Type`.
61. Key card footer shows manual key status message.
62. Key card does not show pause count row.
63. Key card does not show pause reason row.
64. Key card handles missing operator as fallback text.
65. Key card handles missing WO as `No Active WO`.
66. Key card handles missing part number without layout break.
67. Key card handles missing key start time safely.
68. Key card handles missing latest key action safely.
69. Key card uses consistent uppercase/lowercase labels.
70. Key card content remains readable on narrow width.

### Animation and styling tests
71. Outer card no longer uses full-card key animation.
72. Red key button blinks.
73. Key timer does not blink unless intentionally styled.
74. Background remains stable on key alert.
75. Key button border stays red during animation.
76. Key button shadow pulses but does not overflow badly.
77. Key button remains readable in high zoom.
78. `prefers-reduced-motion` disables key button animation.
79. Live status pulse still works for non-key live cards.
80. Pause card still uses full-card pause animation.

### Page behavior tests
81. Key card appears correctly on `PAGE 1`.
82. Key card appears correctly on `PAGE 2.1` if machine is 1-4.
83. Key card appears correctly on `PAGE 2.2` if machine is 5-8.
84. Slide show does not break key card rendering.
85. Fullscreen slideshow does not hide key button animation.
86. Manual slide switching preserves current key state.
87. Refresh during key alert preserves card state after re-fetch.
88. Session cache does not falsely keep a stale key alert.
89. First load without key data does not show fake key alert.
90. Hard refresh does not create phantom key state.

### Regression and performance tests
91. Production cards still render unchanged.
92. Maintenance cards still render unchanged.
93. Setting cards still render unchanged.
94. Calibration cards still render unchanged.
95. Pause alert still renders unchanged except key-specific changes.
96. Offline cards still render unchanged.
97. `npm run typecheck` passes.
98. `npm run build` passes.
99. Browser console shows no new runtime errors on load.
100. Final live verification on a real `KEY_ON` day matches backend truth exactly.

## Done When
- [ ] We can prove from API data whether a key alert should exist for a machine.
- [ ] We can prove the frontend enters `KEY ACTIVE` only for an open `KEY_ON` window.
- [ ] We can prove the UI shows only a small red blinking key button and no full-card glow.
- [ ] We have at least one real or controlled test case that shows the key alert end to end.

## Notes
- Today, March 23, 2026, there are no `KEY_ON` or `KEY_OFF` rows for the dashboard machines, so the absence of a key alert is currently expected from live data.
- The highest-value next step is to capture one real machine/day where `KEY_ON` occurs, or temporarily inject a controlled test fixture for one dashboard machine to validate the UI end to end.
