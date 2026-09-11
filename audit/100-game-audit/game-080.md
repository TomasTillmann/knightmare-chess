# Game 080

Pre-action hypothesis: Knightmare cancels a promotion capture, restores both the original pawn role and captured piece, and bans repeating the same origin/destination even with a different promotion choice. A different legal move should remain available. Will avoid a mating promotion so cancellation cannot legitimately fizzle.

Scaffold: executed four probes, zero findings.

## Executed game

Exact initial options: `{"fen":"r6k/1P6/8/8/8/8/8/7K w - - 0 1","hands":{"black":["knightmare"]}}`. Normal white beforeMove; structural check passed; neither king initially checked. No setup overrides, resets, or replay.

Rule grounds: cards.md Knightmare cancels the opponent's move and requires a different move with the same or another piece. Catalog timing is afterOpponentMove. Initial legalDests: h1→g1,g2,h2; b7→a8,b8. All predictions below were supplied before applying the corresponding action.

| # | Action | Prediction | Actual |
|---|---|---|---|
|1|b7→a8, queen promotion|Promotion capture accepted, nonmating check|Accepted; pawn ID white-pawn-b7 became queen a8, promoted=true; rook a8 captured; outcome null; white afterMove|
|2|playCard knightmare, enumerated undefined target|Cancellation restores pawn b7 and rook a8|Accepted; exact initial FEN restored; pawn role=pawn, promoted=false; rook role=rook at a8; white beforeMove, black cardPlays=1|
|3|b7→a8, rook promotion|Same from/to prohibited despite changed choice|Rejected ILLEGAL_MOVE, “Chaos requires a different move.”; digest unchanged|
|4|b7→b8, knight promotion|Different destination accepted|Accepted; pawn ID now knight b8, promoted=true; rook remains a8|
|5|endTurn|Accepted|Black beforeMove|
|6|a8→a7|Seeded legal continuation accepted|Accepted|
|7|endTurn|Accepted|White beforeMove|
|8|h1→g1|Seeded legal continuation accepted|Accepted|
|9|endTurn|Accepted|Black beforeMove|
|10|a7→e7|Seeded legal continuation accepted|Accepted|
|11|endTurn|Accepted|White beforeMove|
|12|g1→h2|Seeded legal continuation accepted|Accepted|
|13|endTurn|Accepted|Black beforeMove|

Before action 2, cardPlayTargets returned `[undefined]` (JSON output `[null]`), and the returned target was used. After cancellation legalDests explicitly removed a8: h1→g1,g2,h2; b7→b8. The continuation selected from current legalDests with uint32 LCG seed=80, multiplier=1664525, increment=1013904223, index=seed % moves.length. checkState passed after every accepted action. Final FEN: `1N5k/4r3/8/8/8/8/7K/8 b - - 4 3`; no outcome.

Results: 13 actions, 12 accepted, 1 expected rejection; zero semantic findings. One independently designed adversarial game; four seeded continuation moves. Measured game wall time: 26.113 ms. Scaffold probes separate: 4, zero findings. No temporary harness files created. Limitation: this finite single-card path does not establish correctness for every promotion or multi-card combination.

GAME_080_DONE
