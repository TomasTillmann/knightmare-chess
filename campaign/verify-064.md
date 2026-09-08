# Iteration 064 independent verification

Verdict: true. Independently executing the supplied public state/action through `applyAction` accepted Rebirth a7→d7 and captured `white-bishop-f1`, but retained halfmove 1. Rebirth expressly calls this a capture; ordinary chess clocks apply.

The production flow is `applyAction` → `applyActionCore` → `playCard` → `playCardCore` → `playCardUnchecked` → `playRebirth`. Its capture calls `losePiece`, then `syncFen`; both preserve the existing halfmove clock. Rebirth now resets that clock when a victim exists, using the existing `setupFor`/`makeFen` pattern. Both fizzle paths clone the original state, so tentative captures cannot reset a fizzled card's clock. Shared board synchronization remains unchanged.

Verified capture FEN: `r1b2q1R/2ppk1pp/7n/2b1p3/pnP2p2/8/PPNP1PKP/r1B3NR b - - 0 14`. Black remains the FEN active side, fullmove stays 14, White remains afterMove; the Pawn occupies d7 and the Bishop is captured. Two public noncapture relocations, a7→b7 and a7→f7, retain halfmove 1.

An independent four-piece public fixture makes the tentative d7 Pawn capture attack the White King on c6. Rebirth fizzles with SELF_CHECK and preserves the entire original FEN and piece list, including halfmove 1 (one probe, measured 4.15 ms). Total independent public cases: four (capture, two noncaptures, capture fizzle).

Black-box gate: red 0 pass / 1 fail (429 ms reported suite wall time), then green 1 pass / 0 fail (506 ms). Typecheck passes. No tests, test commits, campaign iterations, or permanent fixtures were inspected; no full or UI suite was run.
