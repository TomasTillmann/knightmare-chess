# Game 008 — Heresy ordering

Pre-action hypothesis: Heresy must relocate opponent bishops before friendly bishops, preserve destination occupancy, and respect active movement restrictions. I will enumerate its public targets, predict resulting bishop squares, then compare the accepted state. Scaffold: four probes executed, zero findings.

## Executed game (inconclusive setup)

Exact initial options: `{"fen":"8/7k/8/8/3Bb3/8/8/K7 w - - 0 1","phase":"afterMove","moveMade":true,"hands":{"white":["forbidden-city","heresy"],"black":["pacifism"]}}`.

Catalog timing verified: Heresy and Forbidden City are afterMove; Pacifism is beforeMove. Authoritative text requires opponent bishops first, adjacency to an empty square, and changing square color. Forbidden City prohibits entry or passage. Pacifism prohibits captures both ways.

1. Enumerated `cardPlayTargets(state,"forbidden-city")`; `"d5"` was a returned target. Predicted the empty d5 square would be blocked permanently. Applied `{"type":"playCard","cardId":"forbidden-city","target":"d5"}`. Accepted; bishop squares remained d4/e4 and Forbidden City effect was placed on d5. Structural check passed.
2. Predicted endTurn would switch to black beforeMove with unchanged board. Applied `{"type":"endTurn"}`. Accepted; turn became black/beforeMove and bishops remained d4/e4. `checkState` then threw `before-move FEN must identify the next actor`, comparing FEN white to state black.

This is **not a confirmed engine bug**: the supplied afterMove fixture incorrectly retained white as FEN next actor. The process exited before Pacifism or Heresy target enumeration. No second game, replay, reset, or continuation was attempted. Heresy ordering and seeded continuation therefore remain untested by this agent.

Counts: baseline 4 probes/0 findings; game 2 accepted actions, 0 rejected actions, 1 invariant exception attributable to fixture mismatch; 0 confirmed bugs. Game command measured wall time: 0.5 seconds (tool duration; process terminated before internal elapsed-time output). No code, tests, or harness files edited.

GAME_008_DONE
