# Game 034 — Masquerade bishop / Bog

Pre-action hypothesis: a bishop using Masquerade to travel orthogonally from c2 to g2 remains a bishop and permits immediate opponent Bog, which shortens its move to d2. The official FAQ p40 supplied by the parent permits Bog on a bishop moving as Queen (not on a Knight).

Parent-validated scaffold executed: SCAFFOLD_OK probes=4 findings=0. One normal beforeMove game will follow, with public target enumeration and no resets.

## Executed game

Exact options: `{"fen":"7k/8/8/8/8/8/2B5/K7 w - - 0 1","hands":{"white":["masquerade"],"black":["bog"]},"decks":{"white":[],"black":[]}}`. No timing overrides. Initial checkState passed; neither king in check. All resulting states passed checkState.

Initial legalDests: a1 → b1,a2,b2; c2 → b1,d1,b3,d3,a4,e4,f5,g6,h7. Masquerade targets enumerated and selected actual returned `[{"from":"c2","to":"g2"}]`. Full returned destination sets (each target is a one-element from/to array): a1 → b1,c1,d1,e1,f1,g1,h1,a2,b2,a3,c3,a4,d4,a5,e5,a6,f6,a7,a8; c2 → b1,c1,d1,a2,b2,d2,e2,f2,g2,h2,b3,c3,d3,a4,c4,e4,c5,f5,c6,g6,c7,h7,c8.

Predictions were printed before each applyAction. Exact action sequence and results:

1. `{"type":"playCard","cardId":"masquerade","target":[{"from":"c2","to":"g2"}]}` — expected accepted bishop move; accepted. FEN `7k/8/8/8/8/8/6B1/K7 b - - 1 1`. White afterMove, moveMade true, white cardPlays 1, black 0. History contains cardPlayed masquerade with movement c2-g2, preservePreviousMove false.
2. cardPlayTargets(bog) returned `[undefined]` (JSON `[null]`). `{"type":"playCard","cardId":"bog"}` — expected accepted bishop shortened to d2; **rejected INVALID_TIMING: “Bog must immediately follow your opponent's move.”** Board, turn and history unchanged.
3. `{"type":"endTurn"}` — expected/actual accepted; black beforeMove.
4. `{"type":"move","from":"h8","to":"g7"}` — expected/actual accepted. Enumerated black h8 destinations g7,h7,g8. FEN `8/6k1/8/8/8/8/6B1/K7 w - - 2 2`.
5. `{"type":"endTurn"}` — expected/actual accepted; white beforeMove.
6. `{"type":"move","from":"a1","to":"b1"}` — expected/actual accepted. Enumerated white a1 destinations b1,a2,b2; g2 destinations f1,h1,f3,h3,e4,d5,c6,b7,a8. FEN `8/6k1/8/8/8/8/6B1/1K6 b - - 3 2`.
7. `{"type":"endTurn"}` — expected/actual accepted; black beforeMove.

Seeded continuation used seed 34 and recurrence `(seed*1664525+1013904223)>>>0`, selecting enumeration index seed modulo move count. Exactly one game, no replay/reset. Counts: 7 actions, 6 accepted, 1 rejected. Game measured wall time: 23.986 ms. Scaffold: 4 probes, 0 findings.

## Finding

Bog incorrectly rejects an immediate Masquerade bishop movement. Bog text permits bishop moves of at least two squares; Masquerade text moves a non-pawn as Queen. Parent-supplied official FAQ p40 expressly permits Bog on a bishop moving as Queen. The public state is in the proper afterMove reaction window, but reaction history is a cardPlayed movement, so playBog's move-event requirement rejects it. The subsequent bishop-direction restriction also appears incompatible with this orthogonal case, but that path was not reached and is not a second executed finding.

Prior `audit/2026-09-08/README.md` searched for Masquerade/Bog/bishop with no matches; no duplicate identified there. Limitations: FAQ wording was provided by parent, not independently opened in this bounded game; one finite path does not establish broader correctness. No tests read or run. No code or harness edits.

GAME_034_DONE
