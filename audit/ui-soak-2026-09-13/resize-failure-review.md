# Mobile resize failure review

Scope: independently inspect the reported seed 9135000 step 104 Qd7–d1 input mismatch, without changing production or test code.

Initial evidence: the move driver measures the board once after `scrollIntoViewIfNeeded`, then reuses that rectangle for both source and destination taps. `ChessBoard` clears Chessground's cached bounds after React state updates. This leaves two distinct hypotheses to inspect: the input driver reuses a rectangle after layout moves, or Chessground translates a correct physical tap using stale cached bounds. Neither is confirmed yet.

## Trace evidence

Trace: `/tmp/knightmare-ordinary-9135000/self-play-Seeded-UI-self-play-ordinary-game-seed-9135000-mobile/trace.zip`, `1-trace.trace`.

| Event | Trace time (ms) | Observation |
| --- | ---: | --- |
| `setViewportSize` completes | 689040.026 | Requested 375 × 667. |
| Board bounding-box snapshot | 689132.722–689138.569 | Snapshot viewport is **392 × 698**, not the requested viewport. |
| Source tap | 689152.129 | `(172.5, 279.218731880188)`; viewport remains 392 × 698. |
| Source tap after snapshot | 689165.277 | Black queen is dragging at `translate(90px, 30px)`, consistent with d7; container is 240 × 240 CSS px. |
| Destination tap | 689167.548 | `(172.5, 459.2187204360962)`; action snapshot at 689174.922 still reports 392 × 698. |
| Destination tap after snapshot | 689182.242 | Viewport becomes **375 × 667**; last-move square is `translate(90px, 180px)` (d2). |

The tap coordinates imply the driver measured approximately x=67.5, y=234.219, width=height=240. Source and destination were only 15.4 ms apart. Three screencast frames around the taps show the same board placement, visibly scaled to roughly 230 image pixels despite its 240 CSS-pixel container. This is consistent with the recorded transient viewport ratio 375/392. The trace does not expose `visualViewport.scale` or Chessground's cached rectangle, so this is supporting evidence, not a complete causal measurement.

## Source evidence and conclusion

- `tests/support/selfPlay.ts` measures one rectangle for the two taps, and does not assert viewport/board geometry has settled after `setViewportSize`.
- `ChessBoard.tsx` clears cached bounds after React state updates. Chessground also clears them on captured document scroll, window resize, and `updateBounds` called by its `ResizeObserver`.
- Chessground's `drag.start` translates each touch against its cached bounds; selecting d7 and then moving to d2 shows that ordinary move handling works, but does not alone prove those bounds were fresh.
- No React game-state change is expected merely from selecting a source square; therefore the app's state-update cache clear is not evidence of a refresh between the two taps.

**Most strongly supported hypothesis:** the driver issues coordinate taps while the mobile viewport is still changing its effective layout/scale. The explicit 392 × 698 → 375 × 667 transition is stronger evidence than a conjectured persistent stale Chessground cache. Reusing an earlier rectangle may compound this. A stale cached rectangle remains possible because it was not recorded.

Recommended bounded discriminator: replay this exact seed with read-only capture of `innerWidth/innerHeight`, `visualViewport` dimensions/scale/offsets, and board DOM rectangle immediately before each tap. Require settled requested viewport geometry before calculating coordinates; recalculate for the second tap. If physical tap and live rectangle agree but the chosen square differs, instrument Chessground cached bounds in a temporary reproduction to distinguish that remaining case. Do not classify this as a production defect or weaken the model-consistency assertion without that evidence.

Review used the specified source files, narrowly relevant installed Chessground code, trace events/snapshots, and three extracted trace frames. No production/test changes and no browser tests were run by this reviewer.

## Subsequent parent verification and repair

The timing hypothesis was insufficient: waiting four seconds for the requested viewport still failed, already at action 52. Read-only measurements showed client width 375 but scroll width 404 immediately after resize, with old Chessground container/board/piece dimensions extending beyond the viewport. Chrome then retained inner width 392 and scale 0.95663267 even after layout settled. A separate minimal probe reproduced scaling on the default game twice; identical resize cycles on plain HTML stayed at scale 1.

The parent added a permanent default-position `390×844 → 375×667` regression in `tests/presentation.spec.ts`; it failed with the same 392×698 viewport. Constraining only the container was insufficient because pieces briefly retained their old translations. The final CSS constrains the container to its wrapper and clips piece overflow inside `cg-board`; exterior coordinates are siblings and remain visible. The regression passed in 3.2s, including a real touch move to h4. The exact 106-action failing sequence passed in 56.4s. A broader pointer/presentation/responsive gate passed 35 checks with five platform skips in 46.5s, including dragging and exterior coordinate alignment.

This is a confirmed application resize defect, not merely a slow test. The self-play oracle now compares scroll width against client width (inner width can already be enlarged by autoscaling), and checks requested viewport geometry before coordinate input. Final repaired production assets: `index-vMY-Cf2f.js`, `index-DevZjOYb.css`. The full 1,500-action mobile replay passed in 400.6s and matched the earlier passing desktop action sequence exactly; see `ordinary-repaired-9135000.json`. Its final screenshot was inspected.
