# Game 038 — Vulture retrieves an active continuing card

Pre-action hypothesis: Vulture should permit retrieval of a continuing-effect card while the existing effect persists; the retrieved card changes ownership without deleting the original effect. The parent identifies prior official FAQ p50 evidence and an existing duplicate finding. This game will vary the continuing card and inspect the public returned targets before acting.

Result: P2 duplicate of [prior game 11](../2026-09-08/game-11.md), using Truce instead of Pacifism. Vulture rejects retrieval of the active Truce. The prior report supplies [official FAQ page 50](https://www.sjgames.com/knightmare/KnightmareChess_FAQ.pdf) authority for retrieval with a proxy retaining the effect; local rules.md §22.8 explicitly defers its provisional restriction to such official exceptions. No new finding.

Scaffold: executed successfully, four probes and zero findings. One independent game, no replay/reset. Initial options exactly `{"fen":"7k/6p1/8/8/8/8/1P6/K7 w - - 0 1","hands":{"white":["truce"],"black":["vulture"]},"decks":{"black":["fanatic","dubbing"]}}`. Normal beforeMove initialization; checkState passed, both kings independently not in check. Catalog timing inspected: Truce afterMove, Vulture afterOpponentCard; Vulture public target is undefined (no payload).

Pre-action expectation: after White's legal move and Truce, Black should retrieve physical `white-hand-0-truce` into hand, retain the White-owned capture prohibition through a proxy, discard top Fanatic, and spend/replace Vulture. The recorded prediction was repeated immediately before Vulture execution.

Exact action/result sequence:

1. `move b2 b3` accepted. Initial legalDests: a1→b1,a2; b2→b3,b4. FEN `7k/6p1/8/8/8/1P6/8/K7 b - - 0 1`; White remains active in afterMove.
2. `playCard truce` accepted; cardPlayTargets returned `[undefined]`, selected that target. Effect exactly `{"type":"truce","owner":"white","card":{"id":"white-hand-0-truce","cardId":"truce"}}`; White hand/deck/discard empty.
3. `playCard vulture` rejected, after cardPlayTargets returned `[]`. Intentional omitted-payload probe after verifying public schema. Error `INVALID_TARGET: There is no eligible played card to take.` No state change; Black hand remains Vulture, deck remains Fanatic then Dubbing, discard empty. This is the duplicate discrepancy.
4. `endTurn` accepted.
5. `move g7 g6` accepted. Enumerated options: g7→g5,g6; h8→h7,g8.
6. `endTurn` accepted.
7. `move a1 b1` accepted. Options: a1→b1,a2,b2; b3→b4.
8. `endTurn` accepted.
9. `move h8 g8` accepted. Options: g6→g5; h8→g7,h7,g8.
10. `endTurn` accepted.
11. `move b1 a1` accepted. Options: b1→a1,c1,a2,b2,c2; b3→b4.
12. `endTurn` accepted.

Actions 4–12 are continuation of the same game; seed 38038, LCG `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, select `moves[seed % moves.length]`, endTurn when moveMade. Final FEN `6k1/8/6p1/8/8/1P6/8/K7 b - - 3 3`. Truce remains active with original owner/card; player zones remain as after action 3. All input digests were unchanged by applyAction, and checkState passed after every action.

Executed counts: scaffold 4 probes; game 12 actions, 11 accepted, 1 rejected; 4 seeded moves. Measured game wall time 29.918 ms. Limitations: rejection prevents testing successful transfer ownership, proxy creation, or later cancellation; these remain unverified. Finite continuation does not prove general correctness. No production, test, or harness files changed.

GAME_038_DONE
