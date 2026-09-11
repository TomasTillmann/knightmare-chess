# Game 046 — Haunting Memories continuing effect

Pre-action hypothesis: copying a continuing effect with Haunting Memories creates a distinct physical effect card owned by the copier; removing one continuing effect must leave the other effect in play and discard only the selected physical card to its owner.

Scaffold executed: SCAFFOLD_OK probes=4 findings=0.

Initial options (exact): `{"fen":"r6k/8/8/8/8/8/8/R6K w - - 0 1","hands":{"white":["curse","peace-talks"],"black":["haunting-memories"]}}`. Normal beforeMove, no overrides. Initial checkState passed; isKingInCheck white=false, black=false.

Rule grounds: cards.md Curse restricts an opposing queen/bishop/rook to one or two squares; Haunting Memories duplicates the last card; Peace Talks removes any one continuing card to its owner's discard. Catalog timing: Curse and Peace Talks afterMove; Haunting Memories follows copied timing.

Independent prediction printed before actions: both kings safe; original curse restricts black rook; copied curse restricts white rook with separate identity and black owner; removing the copied curse leaves black rook cursed.

Initial legalDests: a1→b1,c1,d1,e1,f1,g1,a2,a3,a4,a5,a6,a7,a8; h1→g1,g2,h2.

Exact sequential actions and results (all accepted except #10):

1. `{"type":"move","from":"h1","to":"g1"}` → white afterMove.
2. Targets curse=`["a8"]`; `{"type":"playCard","cardId":"curse","target":"a8"}` → effect `{type:"curse",owner:"white",card:{id:"white-hand-0-curse",cardId:"curse"},pieceId:"black-rook-a8"}`.
3. `{"type":"endTurn"}` → black beforeMove.
4. `{"type":"move","from":"h8","to":"g8"}` → black afterMove.
5. Targets haunting-memories=`["a1"]`; `{"type":"playCard","cardId":"haunting-memories","target":"a1"}` → adds `{type:"curse",owner:"black",card:{id:"black-hand-0-haunting-memories",cardId:"haunting-memories"},pieceId:"white-rook-a1"}`; original effect unchanged, both discards empty. legalDests empty at afterMove as expected.
6. `{"type":"endTurn"}` → white beforeMove.
7. `{"type":"move","from":"g1","to":"h1"}` → white afterMove.
8. Targets peace-talks=`["white-hand-0-curse","black-hand-0-haunting-memories"]`; `{"type":"playCard","cardId":"peace-talks","target":"black-hand-0-haunting-memories"}` → only original white-owned curse remains. White discard contains white-hand-1-peace-talks; black discard contains black-hand-0-haunting-memories, retaining cardId haunting-memories.
9. `{"type":"endTurn"}` → black beforeMove. Black a8 destinations exactly `["a6","a7","b8","c8"]`.
10. `{"type":"move","from":"a8","to":"a4"}` → rejected ILLEGAL_MOVE, "Curse limits movement to one or two squares." Input digest unchanged.
11. `{"type":"move","from":"a8","to":"a6"}` → black afterMove, original effect persists.
12. `{"type":"endTurn"}` → white beforeMove.
13. `{"type":"move","from":"a1","to":"d1"}` → accepted three-square rook move, confirming copied curse was removed.

Actions 11–13 are seeded continuation: seed=46, LCG `(seed*1664525+1013904223)>>>0`, choice modulo flattened legalDests length, endTurn when moveMade. checkState passed after every accepted action.

Findings: zero. Hypothesis matched ownership, distinct physical identities, selective cancellation, retained restriction, and restored movement. One game; 13 actions, 12 accepted / 1 rejected; measured game wall time 23.665666 ms. Scaffold separately executed four probes with zero findings. No tests read/run and no production or harness changes.

Limitations: finite path only; no unique-card copying or second removal examined. Initial copied-curse movement restriction was inspected as effect identity but not independently attempted before cancellation; post-cancellation legal movement was executed.

GAME_046_DONE
