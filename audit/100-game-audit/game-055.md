# Game 055

Pre-action hypothesis: Fortification blocks a rook using Ghostwalk across its wall even though Ghostwalk may traverse friendly pieces. A knight's ordinary jump across the same wall remains legal. One normal beforeMove game, at most 20 public actions; no resets.

Scaffold: SCAFFOLD_OK probes=4 findings=0.

## Setup and rule grounds

Exact createGameState options: `{"fen":"r6k/p7/1n6/8/8/8/8/7K w - - 0 1","hands":{"white":["fortification"],"black":["ghostwalk"]},"decks":{"white":[],"black":[]}}`.
Initial phase was normal white beforeMove, moveMade false, both card allowances zero. checkState passed; neither king was checked. Structural checkState passed after every action.

cards.md: Ghostwalk passes through friendly pieces, must end empty without capturing, and must otherwise be legal. Fortification prevents wall crossing except knight-style/card jumping. Catalog timing: Fortification afterMove; Ghostwalk beforeMove.

## Sequential evidence

Predictions were printed before each action; each actual result matched.

| # | Public action | Pre-action prediction | Actual |
|---|---|---|---|
|1|move h1–g1|accept normal king move|accepted|
|2|playCard fortification {from:a5,to:a6}|accept wall|accepted|
|3|endTurn|black beforeMove|accepted|
|4|move b6–a4|accept knight jump across wall rank boundary|accepted|
|5|endTurn|white beforeMove|accepted|
|6|move g1–f1|accept|accepted|
|7|endTurn|black beforeMove|accepted|
|8|playCard ghostwalk [{from:a8,to:a5}]|reject wall crossing despite friendly a7 pawn|ILLEGAL_MOVE; input digest unchanged|
|9|playCard ghostwalk [{from:a8,to:a6}]|accept through friendly a7 pawn, stopping before wall|accepted|
|10|endTurn|accept seeded continuation|accepted|
|11|move f1–f2|accept enumerated legal move|accepted|
|12|endTurn|accept|accepted|
|13|move a6–c6|accept enumerated legal move|accepted|
|14|endTurn|accept|accepted|

Before #2, cardPlayTargets returned 210 Fortification targets and the exact selected target `{from:"a5",to:"a6"}`. Before #4, legalDests(b6) was `[a4,c4,d5,d7,c8]`. Before #8, Ghostwalk targets were a7–a6 and a8–a6/b8/c8/d8/e8/f8/g8, each represented as a one-element move array. Thus the forbidden a8–a5 crossing was absent and the successful a8–a6 move used a returned target. Rejection #8 retained the same reaction/timing state and card.

Seeded continuation used seed 55, update `(Math.imul(seed,1664525)+1013904223)>>>0`, and index `seed % moves.length` over public legalDests enumeration; five actions, same game.

Final board: white Kf2; black Kh8, Rc6, Na4, Pa7. Wall a5/a6 remained. White beforeMove. Exactly one game; 14 actions, 13 accepted, 1 intentionally rejected. Game execution wall time measured by Date.now: 31 ms. Scaffold: four probes, zero findings. Independent adversarial group: this single game. Findings: none.

Limitations: finite sparse-position path only; the knight changed sides of the wall's rank boundary, but a knight has no defined intermediate transit squares. No claim about exhaustive wall geometries or other jumping cards. No resets, replay, tests, or production edits.

GAME_055_DONE
