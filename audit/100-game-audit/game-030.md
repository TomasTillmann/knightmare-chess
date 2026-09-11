# Game 030

Pre-action hypothesis: Forbidden City placed on f1 prevents white kingside castling through f1, while a knight can jump over the forbidden square. Cancelling Forbidden City restores the castling path if ordinary castling conditions remain satisfied.

Parent scaffold executed: four probes, zero findings.

Rules: cards.md Forbidden City prohibits entering/passing through its marker except jumping pieces; Peace Talks removes a continuing effect immediately. Catalog timing for both cards is afterMove.

Exact initial options: `{"fen":"4k3/p7/8/8/8/8/4N3/4K2R b K - 0 1","hands":{"black":["forbidden-city","peace-talks"]}}`. Normal beforeMove initialization; checkState passed, both kings independently reported not in check. No state injection, resets or replay.

Sequential actions (predictions were printed before applying; actual matched each):

1. `{"type":"move","from":"a7","to":"a6"}` — accepted, black afterMove.
2. `{"type":"playCard","cardId":"forbidden-city","target":"f1"}` — accepted. cardPlayTargets enumerated every empty square, including selected f1.
3. `{"type":"endTurn"}` — accepted, white beforeMove.
4. `{"type":"move","from":"e1","to":"g1"}` — predicted rejection; rejected ILLEGAL_MOVE: “That route is blocked by Forbidden City.”
5. `{"type":"move","from":"e2","to":"c3"}` — predicted knight jump acceptance; accepted.
6. `{"type":"endTurn"}` — accepted, black beforeMove.
7. `{"type":"move","from":"a6","to":"a5"}` — accepted, black afterMove.
8. `{"type":"playCard","cardId":"peace-talks","target":"black-hand-0-forbidden-city"}` — accepted; target selected from exact returned list `["black-hand-0-forbidden-city"]`.
9. `{"type":"endTurn"}` — accepted, white beforeMove.
10. `{"type":"move","from":"e1","to":"g1"}` — predicted restored castling acceptance; accepted, king g1 and rook f1.

With marker, exact legalDests: `[["e1",["d1","d2","f2"]],["h1",["g1","h2","h3","h4","h5","h6","h7","h8"]],["e2",["c1","g1","c3","g3","d4","f4"]]]`. In particular knight e2→g1 remained enumerated despite f1; the actual jump chosen e2→c3 kept the castling destination free.

After cancellation, exact legalDests: `[["e1",["d1","f1","h1","d2","e2","f2","g1"]],["h1",["f1","g1","h2","h3","h4","h5","h6","h7","h8"]],["c3",["b1","d1","a2","e2","a4","e4","b5","d5"]]]`.

Executed one game, ten actions: nine accepted, one rejected; checkState passed after every accepted action. Measured game execution wall time 20.84 ms. Findings: zero. Limitation: the knight jump near f1 was enumerated but not executed, and no seeded continuation was added. Finite clean path does not prove general correctness. Protocol scaffold was the third tool call, rather than the required first, because instructions had to be discovered.

GAME_030_DONE
