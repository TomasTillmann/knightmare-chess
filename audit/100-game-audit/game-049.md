# Game 049 — Passing in the Night

Pre-action hypothesis: a neutral pawn remains neutral and retains its identity when Passing in the Night exchanges it with an opponent pawn; a positional pawn exchange invalidates a currently available en-passant capture. I will establish neutrality and en-passant through ordinary public actions, enumerate targets, and inspect the exchange.

Parent scaffold executed: SCAFFOLD_OK probes=4 findings=0.

## Setup and grounds

Exactly one createGameState call, no phase/move/card-count overrides:
```json
{"fen":"7k/3p4/1p6/4P3/8/8/8/K7 w - - 0 1","hands":{"white":["neutrality","passing-in-the-night"]}}
```
Initial structural check passed; neither king checked. Initial legal destinations: a1→b1,a2,b2; e5→e6. Cards.md says Passing swaps friendly and opposing pawn positions, and Neutrality permits either side to move/target a neutral piece. Catalog timing: Neutrality afterMove; Passing beforeMove. Identity and ownership should survive a positional swap; the moved double-step victim no longer supports the old EP target.

## Exact actions and results

| # | Action | Result |
|---|---|---|
|1|move a1→a2|Accepted; white afterMove.|
|2|playCard neutrality, target "b6"|Accepted; black-pawn-b6 owner black, neutral true. Enumerated targets were ["b6","d7"].|
|3|endTurn|Accepted; black beforeMove.|
|4|move d7→d5|Accepted; EP [{"target":"d6","pawnId":"black-pawn-d7"}].|
|5|endTurn|Accepted; white beforeMove; EP retained.|
|6|playCard passing-in-the-night, target [{"from":"b6","to":"d5"}]|Accepted; black-pawn-b6 now d5, owner black, neutral true; black-pawn-d7 now b6, owner black, neutral false. EP []; white afterMove, moveMade true.|
|7|move e5→d6|Rejected ILLEGAL_MOVE: "The regular move has already been made." State unchanged.|
|8|endTurn|Accepted; black beforeMove.|
|9|move h8→h7|Accepted.|
|10|endTurn|Accepted; white beforeMove.|
|11|move a2→b2|Accepted.|

Before action 6, cardPlayTargets returned exactly [[{"from":"e5","to":"b6"}],[{"from":"e5","to":"d5"}],[{"from":"b6","to":"d5"}]]. Legal destinations were a2→a1,b1,b2,a3,b3; e5→d6,e6; b6→b5. Thus EP really was available before swapping. Before action 6 the printed prediction was: neutral b6 identity moves d5; black d7 pawn moves b6; EP clears; e5-d6 rejected. Identity/ownership/EP predictions matched. Rejection was timing-based, so action 7 does not independently establish EP move legality. Direct state evidence establishes EP invalidation.

Actions 8–11 used the same game and a bounded seeded continuation: seed=49, seed=(seed*1664525+1013904223)>>>0, choose seed modulo flattened legalDests length; endTurn when moveMade. checkState passed initially and after all 11 actions; both kings remained unchecked throughout.

Findings: 0. Accepted 10, rejected 1. Game execution wall time measured with Date.now(): 32 ms. Scaffold: 4 probes, 0 findings. No temporary harness created. Limits: one pawn-pair exchange; no two-pair exchange, capture, or neutral movement after exchange; rejected EP action also blocked by turn timing. A finite clean path is not proof of correctness.

Authoritative rules.md:652 explicitly confirms that neutral Pawns fill either selection, ownership/powers/markers are preserved, the swap replaces the Regular Move, and en-passant availability clears. This also confirms the timing-based rejection at action 7 is expected.

GAME_049_DONE
