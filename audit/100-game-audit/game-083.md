# Game 083 — Think Again restores a captured Confabulation composite

Hypothesis: cancelling an ordinary long rook capture of a Confabulation composite restores both physical components, the active composite effect, and its movement abilities; Think Again then prohibits repeating that capture.

Result: no finding on this path. Think Again restored the full composite and forbade repeating the capture. Its knight and bishop movement both worked afterward.

## Setup and grounds

Exactly one `createGameState` call, options: `{"fen":"k1r5/8/8/8/8/2B5/8/1N5K w - - 0 1","hands":{"white":["confabulation","think-again"],"black":[]}}`. No phase, moveMade, cardPlays, effects or history overrides. Both initial kings were independently reported not in check; `checkState` passed initially and after every action.

`cards.md` Confabulation requires moving both merged components together, using either movement type. Think Again cancels the opponent's move and requires a different move. Catalog timing is beforeMove for Confabulation and afterOpponentMove for Think Again; the latter was played while Black remained the mover in afterMove.

Before acting, `cardPlayTargets(confabulation)` returned exactly `[[{"from":"b1","to":"c3"}]]`, selected verbatim. After the capture, Think Again returned one undefined target (serialized `[null]`); selected that returned value, so the public action has no target property when serialized.

## Sequential evidence

Predictions were printed before each action. All actions below were accepted except action 5.

| # | Action | Prediction and actual result |
|---|---|---|
| 1 | White Confabulation b1-c3 | Merge knight into bishop. Actual bishop c3 on board; knight away/null; active effect references both original IDs. |
| 2 | endTurn | Black beforeMove. |
| 3 | Black rook c8-c3 | Long ordinary capture captures both components and removes effect. Actual both captured/null with capturedBy black; effects empty. |
| 4 | White Think Again | Restore both components/effect and rook, prohibit repeat. Actual bishop board/c3, knight away/null, neither captured; identical effect restored, rook c8; Black beforeMove. |
| 5 | Black rook c8-c3 | Expected rejection. Actual ILLEGAL_MOVE: `Chaos requires a different move.` Restored composite and rook unchanged. |
| 6 | Black rook c8-d8 | Different move accepted. |
| 7 | endTurn | White beforeMove; full composite still present. |
| 8 | White composite c3-d5 | Knight movement accepted; bishop carrier d5 with knight still attached through active effect. |
| 9 | endTurn | Black beforeMove. |
| 10 | Black king a8-b8 | Seeded legal continuation, accepted. |
| 11 | endTurn | White beforeMove. |
| 12 | White composite d5-g2 | Seeded bishop movement accepted; both component IDs remain in effect. |
| 13 | endTurn | Black beforeMove. |
| 14 | Black rook d8-c8 | Seeded legal continuation, accepted. |

Before capture, c8 legal destinations were c3,c4,c5,c6,c7,b8,d8,e8,f8,g8,h8. After cancellation, the same list excluded c3. The prohibition signature explicitly included both capture reversals: `black-rook-c8:c8:c3|white-bishop-c3:c3:captured|white-knight-b1:away:captured`.

After action 7, composite c3 destinations were a1,e1,b2,d2,b4,d4,a5,e5,f6,g7,h8,b1,d1,a2,e2,a4,e4,b5,d5, covering both bishop and knight movement. Actions 8 and 12 independently exercised each mode. The off-board knight is the normal composite representation, not an orphan: the active effect continuously references it and its movement worked.

Continuation used seed 83083, updated once per move with `(Math.imul(seed,1664525)+1013904223)>>>0`, indexing flattened public legalDests. Final FEN: `1kr5/8/8/8/8/8/6B1/7K w - - 6 4`; Black remains afterMove pending endTurn. Bishop g2/board, knight null/away, active Confabulation referencing `white-bishop-c3` and `white-knight-b1`.

## Counts, time, limitations

14 attempted actions: 13 accepted, 1 expected rejection. One directed multi-card group plus three seeded moves in that same game. Measured game wall time 35.886 ms. Saved-fixture scaffold ran before and after: 4 probes, zero findings each. No game resets/replays, temporary harnesses, code edits, test edits, or test reads.

Assignment-to-report work exceeded the 45-second target; the measured execution itself stayed bounded. Finite coverage does not prove all cancellation cases correct. This clean path is independent of the related Bog lost-component case and does not reproduce the earlier cancellation-of-Confabulation orphan finding recorded in the prior audit.

GAME_083_DONE
