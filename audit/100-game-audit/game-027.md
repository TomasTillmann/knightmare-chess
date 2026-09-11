# Game 027 — Crab and Hostage

Pre-action hypothesis: a Crab pawn captured by the opponent and returned immediately with Hostage retains its permanent Crab movement: a forward diagonal empty-square move succeeds while a straight pawn advance is rejected. Scaffold executed: four probes, zero findings. Initial protocol read preceded scaffold (procedural deviation).

## Finding

Crab is lost on capture and not restored by immediate Hostage. Rules §10 (line 224) retains transformations rescued during that move or immediately following move; Hostage §17 (line 782) preserves recent transformations. Crab card grants forward one-square diagonal movement for the rest of the game. Previous audit README contains no matching finding (its Crab mention reports no defect).

Initial options: `{"fen":"7k/8/8/8/1p6/2P5/5P2/K7 w - - 0 1","hands":{"white":["crab","hostage"]}}`. Normal beforeMove; initial checkState passed, neither king checked. Initial legalDests: `a1:[b1,a2,b2], f2:[f3,f4], c3:[b4,c4]`.

Exact sequential actions (all accepted except 8):

1. `{"type":"move","from":"a1","to":"a2"}` → white afterMove.
2. `{"type":"playCard","cardId":"crab","target":"c3"}` → Crab attached to `white-pawn-c3`. Targets enumerated `["f2","c3"]`; printed/catalog timing afterMove.
3. `{"type":"endTurn"}` → black beforeMove.
4. `{"type":"move","from":"b4","to":"c3"}` → Crab pawn captured; effects now empty.
5. `{"type":"playCard","cardId":"hostage","target":{"pieceId":"white-pawn-c3","pawn":"f2"}}` → returned same physical pawn at f2, substitute `white-pawn-f2` captured, effects remain empty. Enumerated Hostage targets exactly `[{"pieceId":"white-pawn-c3","pawn":"f2"}]`; played in black afterMove immediately after capture, matching afterOpponentMove timing.
6. `{"type":"endTurn"}` → white beforeMove. Returned legalDests `a2:[a1,b1,a3,b3], f2:[f3,f4]`; expected f2 diagonal empty squares e3/g3.
7. `{"type":"move","from":"f2","to":"f3"}` → unexpectedly accepted; confirms returned Crab behaves as normal pawn.
8. `{"type":"move","from":"f2","to":"e3"}` → rejected `ILLEGAL_MOVE: The regular move has already been made.` This rejection cannot independently establish diagonal behavior because action 7 unexpectedly succeeded.
9. `{"type":"endTurn"}` → black beforeMove.
10. `{"type":"move","from":"h8","to":"h7"}` → accepted.
11. `{"type":"endTurn"}` → white beforeMove.
12. `{"type":"move","from":"a2","to":"a1"}` → accepted.
13. `{"type":"endTurn"}` → black beforeMove.

Actions 10–13 are same-game seeded continuation: seed 27, update `(seed*1664525+1013904223)>>>0`, choose `seed % moves.length` from flattened legalDests on each move; endTurn after moveMade. checkState passed after every accepted action. No reset/replay. 12 accepted, 1 rejected, 13 total. Game measured wall time 26.394 ms. Scaffold four probes, zero findings; adversarial group one game, one finding. Limits: no promotion or later-return case; diagonal direct attempt confounded by successful straight move; target enumeration and accepted straight move suffice for finding. Report hypothesis was written before game actions.

GAME_027_DONE
