# Game 028: Confabulation capture reversed by Bog

Pre-action hypothesis: merge black bishop c7 onto knight a5, then white rook a1 captures a5. Black Bog in that reaction window must stop rook at a2 and restore both merged components on a5, retaining their combined moves. Rules: cards.md Confabulation and Bog; timings beforeMove and afterOpponentMove. Options: FEN `7k/2b5/8/n7/8/8/8/R6K b - - 0 1`, black hand confabulation,bog. Select actual enumerated targets. Scaffold executed: 4 probes, zero findings. One game only, maximum 20 actions.

Exact creation options: `{fen:"7k/2b5/8/n7/8/8/8/R6K b - - 0 1",hands:{black:["confabulation","bog"]}}`. Initial checkState passed; neither king was checked. No overrides/effects injected.

Enumerated Confabulation targets: `[[{"from":"c7","to":"a5"}]]`. Rook destinations before capture: b1,c1,d1,e1,f1,g1,a2,a3,a4,a5. Bog returned one undefined target (JSON prints `[null]`), selected as supplied.

| Action | Exact action | Result |
|---|---|---|
| 1 | `{type:"playCard",cardId:"confabulation",target:[{from:"c7",to:"a5"}]}` | Accepted. Knight carrier a5; bishop away; effect links both IDs. |
| 2 | `{type:"endTurn"}` | Accepted; White beforeMove. |
| 3 | `{type:"move",from:"a1",to:"a5"}` | Accepted; both components captured, Confabulation effect removed. |
| 4 | `{type:"playCard",cardId:"bog",target:undefined}` | Accepted; rook correctly stops a2, knight restored a5, bishop remains captured, effect absent. |
| 5 | `{type:"endTurn"}` | Accepted; Black beforeMove. a5 legal destinations only b3,c4,c6,b7, confirming lost bishop movement. |

**Finding P1:** Bog reverses the carrier capture but permanently loses the second Confabulation component and its continuing effect. Expected restored merged object (knight board a5, bishop away, linking effect present). Actual bishop stays captured with capturedBy white; knight alone returns. This contradicts Bog stopping the move at a2 before any capture occurs. Distinct from prior README findings concerning effect cancellation and mates; no matching prior finding there.

Counts: one independent adversarial group, one game, five accepted actions, zero rejected actions; scaffold four probes, zero findings. All structural checkState calls passed. Measured game execution 17.65 ms (shell 0.5 s); whole assignment approximately 45 seconds. Seeded continuation omitted after decisive reproduction; no replay/reset. Limitation: one finite path, no general correctness claim; protocol scaffold was the third tool call rather than first, though executed promptly after reading its location.

GAME_028_DONE
