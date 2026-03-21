# Fixed Layout Plan

## Goal
Keep the desktop dashboard in a stable layout:
- machine board: `4 x 2`
- leaderboard rail: `1 x 3` stacked on the right

This should not collapse into:
- `1 x 3` machine columns with a side rail
- full-width leaderboard below the cards

## Root Cause
- The page shell currently keeps the leaderboard on the right only at `min-[1800px]`.
- Below that width, the leaderboard falls under the machine cards.
- The machine cards also have enough minimum width and text size that the board + rail combination becomes too wide too early.

## Layout Contract
- On dashboard/wide-screen mode, the page must render:
  - left area: 8 machine cards in `4 columns x 2 rows`
  - right area: 3 leaderboard sections stacked vertically
- The right rail should not push below the grid on the target desktop view.
- Card text should shrink slightly before the layout collapses.

## Tasks
- [ ] Lock the desktop shell to a 2-column page grid: left machine board + fixed-width right rail. → Verify: the leaderboard no longer drops below the cards on the target screen.
- [ ] Set the machine board itself to a strict 4-column desktop grid. → Verify: 8 machines render as `4 x 2`.
- [ ] Reduce machine card minimum width and responsive typography slightly so 4 columns fit with the rail. → Verify: cards still read cleanly and do not overflow.
- [ ] Set a fixed desktop width for the leaderboard rail and keep its 3 sections vertically stacked. → Verify: the rail reads as `1 x 3`, not as a horizontal or wrapped block.
- [ ] Add one explicit fallback rule for smaller screens instead of multiple accidental breakpoints. → Verify: below the desktop threshold, the layout changes intentionally rather than unpredictably.
- [ ] Check header spacing so the title and controls do not steal too much horizontal space from the board. → Verify: header stays on one line at the target desktop width.

## Proposed Desktop Sizing
- Page max width: expand beyond the current container so the board has more usable width.
- Right rail width: fixed narrow rail, around `320px` to `360px`.
- Left board width: remaining space, reserved for 4 equal card columns.
- Card grid gap: keep small and consistent.
- Card typography: use `clamp()` so labels and large WO text compress slightly on tighter desktop widths.

## Proposed Breakpoint Strategy
- `desktop locked mode`: wide enough for `4 x 2 + 1 x 3`
- `fallback mode`: leaderboard can move below only when the screen is genuinely too small to hold the locked mode

Important:
- “Always” can only mean “always on the target desktop width”.
- It is not physically possible to guarantee `4 x 2 + right rail` on every smaller screen without unreadable cards.
- So the implementation should define one clear minimum width for the locked layout and keep it stable above that width.

## Acceptance Checks
- [ ] At the target desktop width, machine cards are `4 x 2`.
- [ ] At the target desktop width, the right leaderboard stays as a vertical `1 x 3` rail.
- [ ] No empty dead zone appears between the cards and the rail.
- [ ] Card text remains readable without line-break chaos.
- [ ] The layout change below the desktop threshold is intentional and consistent.

## Done When
- [ ] Desktop dashboard no longer flips between side-rail and below-grid behavior unexpectedly.
- [ ] The visual result matches the requested structure: `4 x 2` cards + `1 x 3` right rail.
