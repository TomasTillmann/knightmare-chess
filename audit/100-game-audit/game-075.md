# Game 075 — Neutrality and en passant

Pre-action hypothesis: after Black plays d7–d5, White can neutralize its e5 pawn and capture en passant e5–d6. Neutralization should preserve its White owner-relative forward direction; the capture actor should remain White, and the en-passant opportunity should expire after the intervening turn if unused. A neutral pawn should not gain backwards movement.

Parent scaffold executed: SCAFFOLD_OK probes=4 findings=0.

## Setup and rule grounds

One normal beforeMove game, created once with exact options:

```json
{"fen":"7k/3pp3/8/4P3/1p6/8/P7/7K b - - 0 1","hands":{"black":["neutrality"]}}
```

Initial `checkState` passed; both `isKingInCheck` results false. Rules §15.1 and catalog require afterMove timing and an opposing occupied target; therefore Black, after d7–d5, neutralizes White's e5 pawn (clarifying the hypothesis wording). Card targets were actually enumerated as `["a2","e5"]`, and e5 was selected. Neutrality preserves owner, forward direction, and valid EP. Either actor can subsequently move the neutral piece and capture either color.

## Sequential action evidence

Every prediction below was emitted before its action. `legalDests` was enumerated before every action; structural invariants passed after all accepted actions and rejected-action digests stayed unchanged.

| # | Actor/action | Prediction | Actual |
|---|---|---|---|
| 1 | Black move d7→d5 | Accept, create d6 EP | Accepted; EP target d6, pawnId black-pawn-d7 |
| 2 | Black playCard neutrality target e5 | Accept, preserve d6 EP | Accepted; White-owned white-pawn-e5 neutral=true, still e5; FEN unchanged |
| 3 | endTurn | Accept, White acts; preserve EP | Accepted |
| 4 | White move e5→e4 | Reject backwards | ILLEGAL_MOVE; EP unchanged |
| 5 | White move e5→d6 | Accept actual EP | Accepted; neutral pawn arrives d6, black-pawn-d7 captured off d5, EP=[] |
| 6 | endTurn | Accept, Black acts | Accepted |
| 7 | Black move d6→d5 | Reject backwards despite Black actor | ILLEGAL_MOVE |
| 8 | Black move d6→e7 | Accept capture of Black's pawn by White-owned neutral pawn | Accepted; black-pawn-e7 captured, neutral white-pawn-e5 at e7, owner white |
| 9 | endTurn | Accept, White acts | Accepted |
| 10 | White move a2→a4 | Accept, a3 EP | Accepted; EP target a3, pawnId white-pawn-a2 |
| 11 | endTurn | Accept, Black acts | Accepted; a3 EP remains |
| 12 | Black move h8→h7 | Accept; unused a3 EP expires | Accepted; EP=[] |
| 13 | endTurn | Accept, White acts | Accepted |
| 14 | White move h1→h2 | Accept | Accepted |
| 15 | endTurn | Accept, Black acts | Accepted |
| 16 | Black move b4→a3 | Reject expired EP | ILLEGAL_MOVE |

Critical legal destinations: White neutral e5 had `[d6,e6]` before actual EP. On Black's turn the same White-owned neutral pawn at d6 had `[d7,e7]`, excluding d5. Before action 12 Black b4 had `[a3,b3]`; before action 16 it had only `[b3]`. Thus expiry was tested at a later valid Black beforeMove window, not through a timing rejection.

Capture events were `{type:"move",from:"e5",to:"d6",capturedId:"black-pawn-d7"}` and `{type:"move",from:"d6",to:"e7",capturedId:"black-pawn-e7"}`. The events do not expose an actor field; actor was established by the public turn sequence. This proves accepted actor-relative control/capture behavior, not downstream reaction attribution. This differs from an Evil Eye stationary capture: action 5 actually moved the neutral pawn to the empty EP landing square and removed the victim from d5.

Final FEN: `8/4P2k/8/8/Pp6/8/7K/8 b - - 2 4`. Neutral white-pawn-e5 remained White-owned at e7; both captured Black pawns retained owner black and zone captured.

## Result and limits

16 actions executed: 13 accepted, 3 expected rejections; zero findings. Measured game wall time 56.418 ms. Scaffold: four probes, zero findings. No source/test/harness edits, reset, replay, or second game. Exact directed continuation filled the 16-action assignment budget, so no additional seeded random continuation was attempted. Finite clean path does not prove overall correctness; promotion, marker capture expiry, and reaction-card actor attribution were not exercised.

GAME_075_DONE
