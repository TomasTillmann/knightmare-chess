# Game 057

Pre-action hypothesis: a pawn explicitly promoted to Knight retains its original physical Pawn identity and promoted marker. Long Jump permits that Knight to reach an empty opposite-color square but cannot capture an occupied enemy square.

Parent scaffold executed: four probes, zero findings. Independent group: exactly one game, nine actions, seven accepted and two rejected, zero findings. Engine execution wall time 18.659292 ms. No replay/reset or temporary harness.

Rules: cards.md Long Jump; rules.md §13.8 explicitly permits a promoted Pawn currently acting as Knight, preserves identity fields and markers, prohibits occupied destinations, and consumes the Regular Move and card allowance. Catalog timing: beforeMove.

Exact initial options:
```json
{"fen":"7k/P7/8/8/3p4/8/8/7K w - - 0 1","hands":{"white":["long-jump"]},"decks":{"white":[],"black":[]}}
```
Initial checkState passed; neither King checked. Initial legalDests: h1→g1,g2,h2; a7→a8. Predictions were printed before each action.

| # | Exact action | Prediction and observed result |
|---|---|---|
|1|`{"type":"move","from":"a7","to":"a8","promotion":"knight"}`|Accept explicit Knight promotion; accepted. Physical id white-pawn-a7 retained; role knight, originalRole pawn, promoted true.|
|2|`{"type":"endTurn"}`|Accept; black beforeMove.|
|3|`{"type":"move","from":"h8","to":"g8"}`|Accept safe King move; accepted.|
|4|`{"type":"endTurn"}`|Accept; white beforeMove.|
|5|`{"type":"playCard","cardId":"long-jump","target":[{"from":"a8","to":"d4"}]}`|Reject enemy-occupied opposite-color destination; rejected ILLEGAL_MOVE: Choose an empty square of the opposite color. Input digest unchanged.|
|6|`{"type":"playCard","cardId":"long-jump","target":[{"from":"a8","to":"h8"}]}`|Accept enumerated opposite-color distant empty destination; accepted. Same white-pawn-a7 at h8, originalRole pawn, role knight, promoted true, owner white, royal false, neutral false, zone board. d4 enemy Pawn remains. afterMove, moveMade true, white cardPlays 1.|
|7|`{"type":"move","from":"h8","to":"f7"}`|Reject extra Regular Move; rejected ILLEGAL_MOVE: The regular move has already been made. Input digest unchanged.|
|8|`{"type":"endTurn"}`|Accept black turn; accepted.|
|9|`{"type":"move","from":"g8","to":"f8"}`|Accept seeded legal continuation; accepted.|

Before action 5 cardPlayTargets on this same game returned 31 arrays of one `{from:"a8",to}` relocation, with destinations: a1,c1,e1,g1,b2,d2,f2,h2,a3,c3,e3,g3,b4,f4,h4,a5,c5,e5,g5,b6,d6,f6,h6,a7,c7,e7,g7,b8,d8,f8,h8. Selected the returned h8 target for action 6. Occupied d4 was absent.

FEN after promotion: `N6k/8/8/8/3p4/8/8/7K b - - 0 1`. Before Long Jump: `N5k1/8/8/8/3p4/8/8/7K w - - 1 2`. After Long Jump: `6kN/8/8/8/3p4/8/8/7K b - - 2 2`, correctly advancing non-Pawn clock. Final: `5k1N/8/8/8/3p4/8/8/7K w - - 3 3`.

Continuation used one LCG step from seed 57, `(Math.imul(seed,1664525)+1013904223)>>>0`, indexing the flattened current legalDests. checkState passed after every accepted action. Limitations: finite sparse path; no extra effect markers or orientation changes exercised; not a proof of general correctness.

GAME_057_DONE
