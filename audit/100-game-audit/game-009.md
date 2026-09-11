# Game 009 — Holy War, pinned bishop and Pacifism

Pre-action hypothesis: swapping a bishop that shields its king from a rook must be rejected if the exchanged piece does not preserve that shield; Pacifism must suppress a bishop attack without incorrectly disabling its blocking occupancy. One sparse game will inspect real target shapes before choosing the swap and continue through legal actions.

Scaffold executed: four probes, zero findings.

## Execution

Exact initial options: `{"fen":"k3r3/7p/8/8/8/8/P3B3/4K1N1 w - - 0 1","hands":{"white":["pacifism","holy-war"],"black":[]}}`.

Authoritative text: Holy War swaps positions of one's Knight and Bishop; catalog timing afterMove. Pacifism prevents a non-King piece capturing or being captured for the remainder of the game; timing beforeMove.

Refined pre-action prediction: swapping occupied squares e2/g1 keeps a Knight on the e-file shielding Ke1 from Re8. The Bishop's Pacifism should follow its identity to g1. Actual Pacifism targets were `["g1","a2","e2"]`; actual Holy War targets after action 6 were `[{"knight":"g1","bishop":"e2"}]`.

Accepted sequential actions (type move except as specified):
1. `{"type":"playCard","cardId":"pacifism","target":"e2"}` — Bishop gained effect, unchanged board.
2. a2-a3.
3. `{"type":"endTurn"}`.
4. h7-h6.
5. `{"type":"endTurn"}`.
6. a3-a4.
7. `{"type":"playCard","cardId":"holy-war","target":{"knight":"g1","bishop":"e2"}}` — Bishop g1, Knight e2; effect remained `pieceId: white-bishop-e2`.
8. `{"type":"endTurn"}`.

Final accepted FEN: `k3r3/8/7p/8/P7/8/4N3/4K1B1 b - - 0 2`. White and Black check flags false after every accepted action; structural `checkState` passed after each.

The seeded continuation had an auditor API-shape mistake: `legalDests` returns a Map of origins to destinations, rather than a destination list for the second argument. No engine bug is claimed from these malformed probes. Seed 9 with LCG `(1664525*seed+1013904223)>>>0` produced actions 9–20 below; all were `{type:"move",from,to}`, rejected with `ILLEGAL_MOVE / Move coordinates must be board squares.`, and digest remained unchanged:

| # | from | exact malformed to |
|---|---|---|
|9|e8|`["a8",["b7","b8","a7"]]`|
|10|a8|`["a8",["b7","b8","a7"]]`|
|11|a8|`["a8",["b7","b8","a7"]]`|
|12|e8|`["a8",["b7","b8","a7"]]`|
|13|h6|`["a8",["b7","b8","a7"]]`|
|14|h6|`["e8",["e2","e3","e4","e5","e6","e7","b8","c8","d8","f8","g8","h8"]]`|
|15|a8|`["a8",["b7","b8","a7"]]`|
|16|h6|`["e8",["e2","e3","e4","e5","e6","e7","b8","c8","d8","f8","g8","h8"]]`|
|17|h6|`["h6",["h5"]]`|
|18|a8|`["h6",["h5"]]`|
|19|a8|`["a8",["b7","b8","a7"]]`|
|20|h6|`["a8",["b7","b8","a7"]]`|

Counts: one game, 20 actions, 8 accepted, 12 rejected; four baseline scaffold probes. Game measured wall time 119 ms. No code or tests changed. Findings: zero confirmed. Limitations: seeded continuation did not advance the game; finite successful Holy War/Pacifism interaction is not proof of correctness, and illegal pinned-piece movement was not independently exercised.

GAME_009_DONE
