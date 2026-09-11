# Game 14: Truce followed by Vendetta

Prediction before execution: the later Continuing Effect may supersede the earlier conflicting effect under rules section 12, priority 4. On that reading Vendetta requires White's e4xd5 capture despite Truce. An alternative reading of Vendetta's “if can” condition could mean Truce prevents any available capture and there is no direct conflict; this interpretation must remain qualified until verified against the authoritative wording.

Planned position: `4k1n1/8/8/3p4/4P3/8/8/4K1N1 w - - 0 1`, White hand Truce, Black hand Vendetta. Planned sequence: Nf3, Truce, end turn; ...Nf6, Vendetta, end turn; exd5. Check legal destinations, continuing effects, rejection atomicity, and state invariants throughout.

## Result: interpretation-dependent candidate, not a confirmed bug

The engine accepts Vendetta while Truce is active, then immediately discards Vendetta at the next `endTurn`. It rejects the geometrically available pawn capture and accepts a quiet pawn advance. This differs from the prediction if rule 12 priority 4 makes the newer capture requirement supersede the older capture prohibition. If “if can” is evaluated after Truce's prohibition, the observed behavior may instead be correct. Do not count this as a confirmed bug without resolving that wording.

Exact initialization:

```json
{"fen":"4k1n1/8/8/3p4/4P3/8/8/4K1N1 w - - 0 1","hands":{"white":["truce"],"black":["vendetta"]}}
```

Exact action trace:

| # | Action | Actual result |
|---|---|---|
| 1 | `{"type":"move","from":"g1","to":"f3"}` | Accepted; white afterMove |
| 2 | `{"type":"playCard","cardId":"truce"}` | Accepted; Truce active |
| 3 | `{"type":"endTurn"}` | Accepted; black beforeMove |
| 4 | `{"type":"move","from":"g8","to":"f6"}` | Accepted; black afterMove |
| 5 | `{"type":"playCard","cardId":"vendetta"}` | Accepted; effects ordered Truce, Vendetta |
| 6 | `{"type":"endTurn"}` | Accepted; white beforeMove; Vendetta removed and put in Black's discard |
| 7 | `{"type":"move","from":"e4","to":"d5"}` | Rejected; `{"code":"ILLEGAL_MOVE","message":"That piece cannot capture or be captured."}`; state digest unchanged |
| 8 | `{"type":"move","from":"e4","to":"e5"}` | Accepted; quiet move despite the newer Vendetta |
| 9 | `{"type":"endTurn"}` | Accepted; black beforeMove |

Before action 7 the board FEN was `4k3/8/5n2/3p4/4P3/5N2/8/4K3 w - - 2 2`: White Ke1 Nf3 Pe4, Black Ke8 Nf6 Pd5. Neither king is attacked in ordinary geometry; no king movement or removal occurred. Both hands and decks were empty, White's discard empty, Black's discard contained `black-hand-0-vendetta`. The sole active effect was `{"type":"truce","owner":"white","card":{"id":"white-hand-0-truce","cardId":"truce"}}`. Outcome was null.

Final board: `4k3/8/5n2/3pP3/8/5N2/8/4K3 b - - 0 2`. All six original pieces remained on board; White's pawn moved to e5; Truce remained active and Vendetta remained discarded.

Validation: the supplied parent scaffold ran first and printed `SCAFFOLD_OK`; its invalid z9-a1 action was rejected without digest change. `checkState` passed at initial game state and after every accepted game action; each action produced a digest and the rejected capture left it unchanged. Before and after rejected action 7 the digest was `edfe574e08e833b3ab681bae1cc780b0e21ced8eacd8bfe30d285ccca1c51ae6`. Final digest: `b65865df31e957031d64bc0a9cd5b4d768385f71573d0ed77bbcb4479fba1430`.

Limit: legalDests was queried but JSON serialization returned `{}` (a collection was serialized without conversion); this report makes no claim about the displayed legal-destination list. Capture rejection and quiet-move acceptance were directly executed. No randomized moves were used in this directed single-game probe. No source, test, or harness files were edited or read.

`GAME_14_DONE`: 1 scaffold validation; 1 directed game; 9 game actions (8 accepted, 1 rejected); 0 confirmed findings; 1 rules-interpretation candidate; measured engine/scaffold wall time 23 ms. No temporary harness was created.
