# Game 018 — Earthquake stacking

Pre-action hypothesis: two clockwise Earthquakes should produce orientation 180; promotion choices must be explicit where a rotation puts a pawn on its last rank, and canceling one continuing effect must reverse only its own rotation. Prior reversal-promotion defect will be labeled duplicate if reproduced. Scaffold executed: four probes, zero findings.

## Setup and authority

Exactly one `createGameState` call with `{fen:"8/5k2/8/p7/7P/8/1P1K4/8 w - - 0 1",hands:{white:["earthquake","peace-talks"],black:["earthquake"]}}`. No phase overrides, decks, state injection, reset, or replay. Initial `checkState` passed and `isKingInCheck` returned false for both colors.

Read `cards.md` Earthquake, `rules.md` §14.1, public state/types and catalog entries. Both focal cards have `afterMove` timing. Earthquake reversals use the same orientation rules; the card requires opposing promotions first. Current coordinates remain fixed. Prior audit README documents a reversal-promotion bug; this path does not reproduce it because all pawns were already promoted before cancellation.

## Sequential evidence

`legalDests` was called before every attempted move; `cardPlayTargets` was called on this same game immediately before each card. All critical predictions were printed before `applyAction`: listed moves should succeed with required promotion choice, each clockwise rotation adds 90 and preserves fixed squares, and cancellation removes one rotation while preserving prior promotions.

| # | Action | Expected and observed |
|---|---|---|
| 1 | White d2→c2 | Accepted, afterMove. Enumerated king destinations c1,d1,e1,c2,e2,c3,d3,e3. |
| 2 | Earthquake clockwise, promotions a5 knight then h4 knight | Selected returned target whose declarations were all knight. Accepted, orientation90; both physical pawns promoted in place. Opposing pawn declared first. |
| 3 | endTurn | Accepted, black beforeMove. |
| 4 | Black f7→e7 | Enumerated before move; accepted, afterMove. |
| 5 | Earthquake clockwise, promotions [] | Selected returned clockwise target. Accepted, orientation180; two separate continuing effects. |
| 6 | endTurn | Accepted, white beforeMove. |
| 7 | White b2→b1 without promotion | Destination enumerated; rejected as expected because destination alone does not complete a promotion. |
| 8 | White b2→b1, promotion knight | Accepted; original b2 pawn now a promoted knight on b1. |
| 9 | Peace Talks targeting first returned `cardPlayTargets(state,"peace-talks")[0]` | Accepted; removed white-hand-0-earthquake, leaving black-hand-0-earthquake. Orientation90. |

Final fixed board: white king c2, white promoted knights b1 and h4, black king e7, black promoted knight a5. `checkState` executed successfully after every accepted action. Final effect is black's clockwise Earthquake with empty promotions. No outcome was produced.

## Result and limits

Game probes: **9 actions, 8 accepted, 1 rejected; 0 findings**. Separate mandatory fixture scaffold: **4 probes, 0 findings**. Measured game wall time **30ms** (including target generation and invariant checks); total agent phase approximately one minute. No seeded continuation was added because the bounded directed path completed the assigned behavior. No UI, tests, production edits, or temporary harness files.

Limitations: knight choices exercised for simultaneous and ordinary promotions; other roles were enumerated through card targets but not independently played. Cancellation did not newly place an unpromoted pawn on a last rank, so this does not clear the known reversal-promotion issue. Verbose intermediate state output was truncated; the exact action sequence, final state, and counts above remain available. This finite clean path does not establish general correctness.

GAME_018_DONE
