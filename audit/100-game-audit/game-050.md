# Game 050: Tournament after Coup

Pre-action hypothesis: after Coup crowns a physical knight, Tournament can swap that knight with an opposing knight while royal identity remains attached to the crowned physical piece. The swap must respect king safety and preserve the expected turn timing. One beforeMove game, at most 20 actions; no replay.

Scaffold executed successfully: `SCAFFOLD_OK probes=4 findings=0`. Baseline `33e03989fab9449d87b857fc5673f67d05841928`. Rule grounds: cards.md Coup preserves the crowned piece's standard move and makes it the new King; Tournament exchanges opposing Knights. Catalog timing is Coup afterMove and Tournament beforeMove. The swap handler marks Tournament as replacing the move.

Exact initial options: `{"fen":"7k/7p/5n2/8/8/2N5/P7/K7 w - - 0 1","hands":{"white":["coup","tournament"]}}`. All unspecified options default. Initial structural check passed, both kings unchecked, white beforeMove, no outcome.

Initial legalDests: a1→b1,b2; a2→a3,a4; c3→b1,d1,e2,a4,e4,b5,d5. After Coup, Black legalDests: f6→e4,g4,d5,h5,d7,e8,g8; h7→h5,h6; h8→g7,g8.

| # | Exact public action | Actual result |
|---|---|---|
|1|`{"type":"move","from":"a2","to":"a3"}`|Accepted; white afterMove.|
|2|`{"type":"playCard","cardId":"coup","target":"c3"}`|Accepted; white-knight-c3 becomes royal, original king a1 loses royalty. Enumerated Coup targets were `["a3","c3"]`.|
|3|`{"type":"endTurn"}`|Accepted; black beforeMove.|
|4|`{"type":"move","from":"h7","to":"h6"}`|Accepted; black afterMove.|
|5|`{"type":"endTurn"}`|Accepted; white beforeMove.|
|6|`{"type":"playCard","cardId":"tournament","target":{"own":"c3","opponent":"f6"}}`|Accepted; white afterMove, moveMade true, cardPlays white 1.|
|7|`{"type":"move","from":"f6","to":"d5"}`|Rejected ILLEGAL_MOVE: The regular move has already been made. Input digest unchanged.|
|8|`{"type":"endTurn"}`|Accepted; black beforeMove.|
|9|`{"type":"move","from":"c3","to":"e2"}`|Accepted; black afterMove.|
|10|`{"type":"endTurn"}`|Accepted; white beforeMove.|
|11|`{"type":"move","from":"f6","to":"d7"}`|Accepted; crowned knight retains standard knight movement and physical ID.|
|12|`{"type":"endTurn"}`|Accepted; black beforeMove.|
|13|`{"type":"move","from":"h8","to":"g7"}`|Accepted; black afterMove.|
|14|`{"type":"endTurn"}`|Accepted; white beforeMove.|

Before action 6, actual Tournament targets were `[{"own":"c3","opponent":"f6"}]`; selected that returned target. Explicit prediction before applying it: white-knight-c3 remains royal at f6, black-knight-f6 moves to c3 without royalty, neither king checked, and the swap consumes the regular move. All predictions matched. Before action 7, predicted rejection because the replacement move was consumed; matched.

Seeded continuation actions 8–14 used seed 50, `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, selecting from the current legalDests flattened in returned order. Structural checks passed after every action. Both checks remained false throughout. At completion white-knight-c3 was royal at d7, black-king-h8 royal at g7; outcome null, white beforeMove, card allowances reset to zero.

Executed: one independent adversarial game, 14 actions (13 accepted, 1 rejected), plus four scaffold probes. Findings: zero; no duplicates. Measured game wall time 35.638 ms. No temporary harness was created. Limitations: quiet safe swap only; no attempted swap into check or mate. This finite clean path does not prove general correctness. An initial directory filename listing exceeded the named-file-only search restriction; it displayed audit Markdown paths only, with no test sources accessed. No tests, production, harness, or configuration files were read or written beyond the specified production/API reads.

GAME_050_DONE
