# Game 040 — Crab priority over Breakthrough, rejected hypothesis

Pre-action hypothesis: after Crab makes the white d5 pawn move diagonally, Breakthrough should still allow its forward capture of a black pawn on d6. Test through normal king moves and real turn transitions from `7k/8/3p4/3P4/8/8/8/K7 w - - 0 1`, with only the Crab and Breakthrough cards in White's hand. No game has yet been created for this replacement audit.

The original assignment was aborted without creating a game. This fresh replacement executed exactly one game. The saved-fixture scaffold completed first: `SCAFFOLD_OK probes=4 findings=0`.

Rules: cards.md Crab permits one-square forward diagonal movement/capture; Breakthrough permits a Pawn to capture forward unless it already captures forward, in which case it permits diagonal capture. Catalog timing is Crab afterMove, Breakthrough beforeMove. The Crab remains a Pawn in the public state. Expected Breakthrough to advertise the occupied d5-to-d6 forward capture.

Exact initial options: `{"fen":"7k/8/3p4/3P4/8/8/8/K7 w - - 0 1","hands":{"white":["crab","breakthrough"]}}`. Initial checkState passed; both isKingInCheck values false. No phase/history/effect overrides.

Sequential actions and results:

1. `{"type":"move","from":"a1","to":"b1"}` accepted. Initial legalDests was `[["a1",["b1","a2","b2"]]]`.
2. Crab targets `['d5']`; `{"type":"playCard","cardId":"crab","target":"d5"}` accepted.
3. `{"type":"endTurn"}` accepted, Black beforeMove.
4. Black legalDests `[["h8",["g7","h7","g8"]]]`; `{"type":"move","from":"h8","to":"g8"}` accepted.
5. `{"type":"endTurn"}` accepted, White beforeMove.
6. White legalDests `[["b1",["a1","c1","a2","b2","c2"]],["d5",["c6","e6"]]]`. Breakthrough targets unexpectedly `[]`. Driver nevertheless attempted `{"type":"playCard","cardId":"breakthrough"}` (undefined target omitted): rejected INVALID_TARGET, `Choose exactly one Pawn capture.` This malformed attempt is a driver limitation, not defect evidence.
7. `{"type":"move","from":"d5","to":"d6"}` rejected ILLEGAL_MOVE, `That is not a legal Crab move.` Expected after the preceding card failed; not defect evidence.

Finding: none. The initial hypothesis overlooked rules.md §12: a Continuing Effect takes priority over a conflicting regular card. Crab is Continuing; Breakthrough is regular. Crab's diagonal-only capture conflicts with Breakthrough's forward capture, so the empty target list is consistent with this local conflict rule. Production breakthroughDests explicitly returns no destinations for a Crab. The hypothesis is rejected. Because the driver failed to supply a valid explicit capture target after the empty enumeration, this report does not independently establish a correctly shaped playCard rejection; the undefined-target rejection is merely a driver limitation. No new or duplicate defect is claimed.

Final FEN `6k1/8/3p4/3P4/8/8/8/1K6 w - - 2 2`; white pawn remains d5, black pawn d6. checkState passed after every accepted action. Accepted 5, rejected 2, total 7. Scaffold probes 4, findings 0. Engine game wall time 21.20 ms. No seeded continuation because the bounded driver ended after the unexpected target omission. No game reset/replay, test reads, or production writes. Finite coverage only; no promotion coverage.

GAME_040_DONE
