# Game 047

Pre-action hypothesis: Fog of War immediately answering Man-Trap cancels the trap; a later arrival on that square survives. Both card instances leave their hands exactly once and occur exactly once in discard, with no retained trap.

Parent scaffold: executed four probes, zero findings.

## Exact setup and evidence

Options: `{"fen":"7k/8/8/8/8/8/r6P/4K3 w - - 0 1","hands":{"white":["man-trap"],"black":["fog-of-war"]},"decks":{"white":[],"black":[]}}`. Normal beforeMove; initial checkState passes; neither king checked.

Grounds: cards.md Man-Trap captures the next opposing non-king arriving at its selected occupied square. Fog of War cancels the opposing card and discards both. Catalog: Man-Trap afterMove; Fog afterOpponentCard.

Initial legalDests: e1→d1,f1; h2→h3,h4. Before actions predicted Ke1-f1, trap h2, immediate Fog, later Ra2xh2 survival.

| # | Exact action | Result |
|---|---|---|
|1|`{"type":"move","from":"e1","to":"f1"}`|Accepted; white afterMove.|
|2|`{"type":"playCard","cardId":"man-trap","target":"h2"}`|Accepted; targets enumerated immediately beforehand were f1,h2. Trap retains white-hand-0-man-trap; white hand empty, discard empty.|
|3|`{"type":"playCard","cardId":"fog-of-war"}`|Accepted; targets enumerated immediately beforehand were [undefined] (JSON [null]). Effects empty; each card moved to its owner's discard once; cardPlays white=1, black=1.|
|4|`{"type":"playCard","cardId":"fog-of-war"}`|Predicted rejection; rejected CARD_NOT_IN_HAND, digest unchanged.|
|5|`{"type":"endTurn"}`|Accepted; black beforeMove.|
|6|`{"type":"move","from":"a2","to":"h2"}`|Accepted; legalDests enumerated and included h2. black-rook-a2 is on board at h2, alive; no effects.|
|7|`{"type":"endTurn"}`|Accepted.|
|8|`{"type":"move","from":"f1","to":"e1"}`|Accepted.|
|9|`{"type":"endTurn"}`|Accepted.|
|10|`{"type":"move","from":"h2","to":"h4"}`|Accepted.|

Black pre-capture legal destinations: a2→a1,b2,c2,d2,e2,f2,g2,h2,a3,a4,a5,a6,a7,a8; h8→g7,h7,g8. Continuation selected legal moves with seed 47, LCG `(1664525*seed+1013904223)>>>0`, index modulo enumerated moves. All accepted states passed checkState; rejected input digest checked unchanged.

Final hands/decks empty; white discard exactly white-hand-0-man-trap, black discard exactly black-hand-0-fog-of-war. Card counts exactly one each, effects empty. Nine accepted actions, one rejected; one independently designed game; scaffold four probes zero findings. Measured game wall time 24.23625 ms. Zero findings. Limitations: finite immediate-counter path; no whole-move cancellation or nested counter coverage.

GAME_047_DONE
