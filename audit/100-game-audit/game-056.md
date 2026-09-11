# Game 056 — Holy Quest restriction identity

Pre-action hypothesis: Holy Quest can exchange an enemy bishop and knight despite Dungeon's movement prohibition because an exchange is not a move; the restriction should follow the affected piece identity to its new square for its stated duration. One normal beforeMove game will exercise actual card timing and inspect the moved piece's legal destinations.

Chosen feasible branch: persistent Fatal Attraction magnet at d4 initially traps black Bishop e4. After black creates it and White moves, Holy Quest swaps Bishop e4 with Knight a6. Prediction before execution: swap accepted; Bishop a6 can move on Black's next turn, Knight e4 cannot, because adjacency is evaluated at current squares while the magnet identity stays d4. Dungeon duration cannot naturally span two White afterMove card plays under the one-card allowance, so this game uses the authorized magnet alternative.

## Executed evidence

Parent fixture scaffold rerun: `SCAFFOLD_OK probes=4 findings=0`. Initial options exactly `{"fen":"7k/8/n7/8/3pb3/8/1P6/K7 b - - 0 1","hands":{"black":["fatal-attraction"],"white":["holy-quest"]}}`. No phase/moveMade/cardPlays overrides. Structural check passed; both Kings initially not in check.

Grounds: cards.md Holy Quest and Fatal Attraction; catalog gives both afterMove timing; rules.md §18.6 expressly allows non-move swaps of trapped pieces, and Holy Quest procedure preserves identities/markers.

| Action | Result |
|---|---|
| 1. Black h8–g8 | Accepted |
| 2. Fatal Attraction d4 | Accepted; enumerated targets `["d4","e4","a6","g8"]`; marker `black-pawn-d4` |
| 3. endTurn | Accepted; White beforeMove |
| 4. White b2–b3 | Accepted |
| 5. Holy Quest `{bishop:"e4",knight:"a6"}` | Accepted; exact sole enumerated target; identities exchanged, magnet retained |
| 6. endTurn | Accepted; Black beforeMove |
| 7. Black e4–f6 | Rejected ILLEGAL_MOVE as predicted; message misleadingly says Dungeon, a diagnostic wording issue only |
| 8. Black a6–b5 | Accepted as predicted |
| 9. endTurn | Accepted |
| 10. White b3–b4 | Accepted; seeded continuation |
| 11. endTurn | Accepted |
| 12. Black b5–c4 | Accepted; permitted arrival adjacent to magnet |
| 13. endTurn | Accepted |

After action 6, legalDests exactly: d4→d3; a6→f1,e2,d3,c4,b5,b7,c8; g8→f7,g7,h7,f8,h8. Knight e4 absent. The magnet effect retained its same card and pieceId after every accepted action. Final identities: white-king-a1 at a1, white-pawn-b2 at b4, black-pawn-d4 at d4, black-bishop-e4 at c4, black-knight-a6 at e4, black-king-h8 at g8. checkState passed after every accepted action.

Continuation selection used seed 56 and `seed=(seed*1664525+1013904223)>>>0`, selecting modulo the flattened legalDests count before each action (including endTurn iterations). One game, 13 attempted actions: 12 accepted, 1 deliberately rejected. Measured game engine wall time 26.10 ms; scaffold/tool phase approximately 45 seconds (completion target approximate, not a precise stopwatch).

No semantic finding on this bounded path. Limitation: Dungeon expiry and swapping the magnet itself were not exercised; neighbor immobilization is square-adjacency derived, not a marker carried by the trapped piece. This is finite coverage, not proof of correctness. No tests read or run, no reset/replay, no production changes.

GAME_056_DONE
