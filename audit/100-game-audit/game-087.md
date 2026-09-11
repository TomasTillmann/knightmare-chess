# Game 087 — seed 908087

## Pre-run review

Hypothesis: a seeded legal-action game preserves turn ownership, piece occupancy, and card timing while resolving generated card actions.

Invariants to inspect independently after execution: no overlapping live pieces; side/ply progression agrees with the selected action; capture and card effects agree with the authoritative rule sections at three critical transitions.

The execution is limited to one `generateTrace(908087, 20, progress)` call, 80 actions, and a 15-second callback deadline. Partial output is retained if stopped; a timeout alone is not a bug.

## Execution result

Baseline: `33e03989fab9449d87b857fc5673f67d05841928`. Exactly one `generateTrace(908087,20,progress)` invocation, no replay/reset. Engine wall time: 678.892 ms. Completed 20 regular moves / 44 accepted actions, no helper failure or budget stop. Internal rejected candidate counts are not exposed by this helper and were not measured. Scaffold before and after each passed four probes, zero findings (six invalid-action rejections total). No tests read, run, or changed; no temporary harness created.

Exact initial options (standard starting FEN, normal beforeMove; shuffled whole-catalog decks are the rules §4.3 house variant):
```json
{"hands":{"white":["pacifism","treason","split-knight","passing-in-the-night","mystic-shield"],"black":["under-elf-hill","dubbing","vendetta","breakthrough","cowardice"]},"decks":{"white":["man-trap","sanctuary","fanatic","forbidden-city","bombard","holy-quest","earthquake","think-again","dubbing","confabulation","anathema","chaos","madman","fog-of-war","charge","challenge","guardian","toll","fortification","peace-talks","winged-victory","plots-within-plots","breakthrough","cowardice","crab","doomsayer","assassin","fireball","lost-castle","heresy","long-jump","riposte","under-elf-hill","doppelganger","vulture","crusade","curse","dark-mirror","cathedral","squaring-the-circle","merciless","blessing","legacy","tournament","annexation","evangelists","rebirth","coup","dungeon","hidden-passage","truce","haunting-memories","vendetta","evil-eye","resurrection","revenge","disintegration","forced-march","knightmare","siege","bog","fatal-attraction","man-of-straw","ghostwalk","no-quarter","betrayal","neutrality","onslaught","masquerade","panic","holy-war","abduction","hostage","figure-dance","irresistible-force"],"black":["siege","fanatic","confabulation","toll","man-trap","crab","rebirth","forbidden-city","betrayal","no-quarter","long-jump","sanctuary","panic","assassin","fog-of-war","heresy","treason","challenge","legacy","figure-dance","holy-war","mystic-shield","revenge","onslaught","split-knight","abduction","annexation","ghostwalk","irresistible-force","chaos","earthquake","peace-talks","vulture","riposte","bog","guardian","dungeon","bombard","squaring-the-circle","knightmare","doppelganger","neutrality","disintegration","think-again","man-of-straw","passing-in-the-night","evil-eye","hostage","plots-within-plots","dark-mirror","evangelists","resurrection","crusade","anathema","fireball","truce","doomsayer","forced-march","winged-victory","madman","cathedral","hidden-passage","fortification","merciless","tournament","coup","curse","lost-castle","fatal-attraction","masquerade","charge","holy-quest","haunting-memories","blessing","pacifism"]}}
```

Sampled card counts: `{"vendetta":2,"mystic-shield":3,"pacifism":2,"breakthrough":3,"siege":4,"passing-in-the-night":7,"dubbing":4,"under-elf-hill":2,"treason":2,"cowardice":1,"split-knight":2,"sanctuary":1}`.
Played cards: Vendetta, Pacifism, Treason, Siege, once each. Final FEN: `2bqk1nn/pp1pp2p/2p1rbp1/8/1P1B1p2/2NP3P/r1PKPPP1/RQ3BNR w h - 0 11`.
Final state: White beforeMove, moveMade=false; Pacifism remains on white-pawn-b2 at b4; no pending rescue. Callback checks and helper transition checks passed. The helper independently compares ordinary moves with chessops only while its ordinary-position guard permits.

## Independent post-run semantic review

These are retrospective checks, distinct from the structural hypothesis written before execution.

1. **Vendetta, steps 4–6:** cards.md “Vendetta” and rules §18.1 require capture only if a legal ordinary capture exists and end the effect otherwise. Before White's next turn the only advanced pieces are white b3 and black f5; no White piece can capture an opponent: b3 attacks empty a4/c4, undeveloped pieces are blocked or have empty destinations, and neither knight reaches Black. Expected: expire Vendetta and permit quiet h2–h3. Actual: step 5 removes the effect, discards Vendetta, resets White's allowance; step 6 accepts h2–h3. Consistent.
2. **Pacifism, steps 10–11:** cards.md “Pacifism” and rules §16.1 prohibit capture/capturability, without forbidding quiet movement. White owns the nonroyal pawn at b3 and acts beforeMove (catalog timing). Expected: attach to that physical identity and preserve the marker on quiet b3–b4. Actual: effect references white-pawn-b2 before and after; the same pawn moves b3→b4, no capture, White remains afterMove with one card used. Capture immunity itself was not exercised.
3. **Treason, steps 20 and 26:** cards.md “Treason” names an opponent Rook and Knight; rules §25.8 preserves identity across swaps. Expected: Black rook a8 exchanges with Black knight a6 after White's move; ownership/roles remain intact. Actual: black-rook-a8→a6, black-knight-b8→a8, no other piece changes; White remains afterMove and draws Sanctuary once. Step 26 subsequently moves that same knight a8→c7, a valid knight displacement.
4. **Siege, step 39:** cards.md “Siege” exchanges one's own Knight and Rook; catalog allows afterMove. Black has just moved f5–f4. Expected: Black knight e6 and rook h8 exchange with identities intact, consuming one card and no extra Regular Move. Actual: black-knight-b8→h8, black-rook-h8→e6; Black remains afterMove, cardPlays.black 0→1; Fanatic is drawn once, Siege discarded, clocks unchanged. Castling-right retention after non-move swaps was not exercised as castling; existing report 065 already identifies that ambiguity, and this run does not establish a new defect.
5. **Ordinary capture, step 43:** the rook on a6 has an unobstructed a5/a4/a3 path to opposing pawn a2. White's Pacifist pawn is separately on b4. Expected: a6×a2 captures only white-pawn-a2; halfmove resets, fullmove advances after Black. Actual: victim changes to captured/null with capturedBy=black, rook goes to a2; clock 1→0, fullmove 10→11. Black king e8 remains screened and White king d2 is shielded from the rook by its pawn c2. Consistent.

## Full accepted action trace

Every row below was accepted; FEN is after the action. No game was replayed to obtain these rows.

| Step | Action | Result FEN |
| --- | --- | --- |
| 1 | `{"type":"move","from":"b2","to":"b3"}` | `rnbqkbnr/pppppppp/8/8/8/1P6/P1PPPPPP/RNBQKBNR b KQkq - 0 1` |
| 2 | `{"type":"endTurn"}` | `rnbqkbnr/pppppppp/8/8/8/1P6/P1PPPPPP/RNBQKBNR b KQkq - 0 1` |
| 3 | `{"type":"move","from":"f7","to":"f5"}` | `rnbqkbnr/ppppp1pp/8/5p2/8/1P6/P1PPPPPP/RNBQKBNR w KQkq - 0 2` |
| 4 | `{"type":"playCard","cardId":"vendetta","cardInstanceId":"black-hand-2-vendetta"}` | `rnbqkbnr/ppppp1pp/8/5p2/8/1P6/P1PPPPPP/RNBQKBNR w KQkq - 0 2` |
| 5 | `{"type":"endTurn"}` | `rnbqkbnr/ppppp1pp/8/5p2/8/1P6/P1PPPPPP/RNBQKBNR w KQkq - 0 2` |
| 6 | `{"type":"move","from":"h2","to":"h3"}` | `rnbqkbnr/ppppp1pp/8/5p2/8/1P5P/P1PPPPP1/RNBQKBNR b KQkq - 0 2` |
| 7 | `{"type":"endTurn"}` | `rnbqkbnr/ppppp1pp/8/5p2/8/1P5P/P1PPPPP1/RNBQKBNR b KQkq - 0 2` |
| 8 | `{"type":"move","from":"g7","to":"g6"}` | `rnbqkbnr/ppppp2p/6p1/5p2/8/1P5P/P1PPPPP1/RNBQKBNR w KQkq - 0 3` |
| 9 | `{"type":"endTurn"}` | `rnbqkbnr/ppppp2p/6p1/5p2/8/1P5P/P1PPPPP1/RNBQKBNR w KQkq - 0 3` |
| 10 | `{"type":"playCard","cardId":"pacifism","cardInstanceId":"white-hand-0-pacifism","target":"b3"}` | `rnbqkbnr/ppppp2p/6p1/5p2/8/1P5P/P1PPPPP1/RNBQKBNR w KQkq - 0 3` |
| 11 | `{"type":"move","from":"b3","to":"b4"}` | `rnbqkbnr/ppppp2p/6p1/5p2/1P6/7P/P1PPPPP1/RNBQKBNR b KQkq - 0 3` |
| 12 | `{"type":"endTurn"}` | `rnbqkbnr/ppppp2p/6p1/5p2/1P6/7P/P1PPPPP1/RNBQKBNR b KQkq - 0 3` |
| 13 | `{"type":"move","from":"c7","to":"c6"}` | `rnbqkbnr/pp1pp2p/2p3p1/5p2/1P6/7P/P1PPPPP1/RNBQKBNR w KQkq - 0 4` |
| 14 | `{"type":"endTurn"}` | `rnbqkbnr/pp1pp2p/2p3p1/5p2/1P6/7P/P1PPPPP1/RNBQKBNR w KQkq - 0 4` |
| 15 | `{"type":"move","from":"d2","to":"d3"}` | `rnbqkbnr/pp1pp2p/2p3p1/5p2/1P6/3P3P/P1P1PPP1/RNBQKBNR b KQkq - 0 4` |
| 16 | `{"type":"endTurn"}` | `rnbqkbnr/pp1pp2p/2p3p1/5p2/1P6/3P3P/P1P1PPP1/RNBQKBNR b KQkq - 0 4` |
| 17 | `{"type":"move","from":"b8","to":"a6"}` | `r1bqkbnr/pp1pp2p/n1p3p1/5p2/1P6/3P3P/P1P1PPP1/RNBQKBNR w KQkq - 1 5` |
| 18 | `{"type":"endTurn"}` | `r1bqkbnr/pp1pp2p/n1p3p1/5p2/1P6/3P3P/P1P1PPP1/RNBQKBNR w KQkq - 1 5` |
| 19 | `{"type":"move","from":"b1","to":"c3"}` | `r1bqkbnr/pp1pp2p/n1p3p1/5p2/1P6/2NP3P/P1P1PPP1/R1BQKBNR b KQkq - 2 5` |
| 20 | `{"type":"playCard","cardId":"treason","cardInstanceId":"white-hand-1-treason","target":{"rook":"a8","knight":"a6"}}` | `n1bqkbnr/pp1pp2p/r1p3p1/5p2/1P6/2NP3P/P1P1PPP1/R1BQKBNR b KQka - 2 5` |
| 21 | `{"type":"endTurn"}` | `n1bqkbnr/pp1pp2p/r1p3p1/5p2/1P6/2NP3P/P1P1PPP1/R1BQKBNR b KQka - 2 5` |
| 22 | `{"type":"move","from":"f8","to":"g7"}` | `n1bqk1nr/pp1pp1bp/r1p3p1/5p2/1P6/2NP3P/P1P1PPP1/R1BQKBNR w KQka - 3 6` |
| 23 | `{"type":"endTurn"}` | `n1bqk1nr/pp1pp1bp/r1p3p1/5p2/1P6/2NP3P/P1P1PPP1/R1BQKBNR w KQka - 3 6` |
| 24 | `{"type":"move","from":"c1","to":"e3"}` | `n1bqk1nr/pp1pp1bp/r1p3p1/5p2/1P6/2NPB2P/P1P1PPP1/R2QKBNR b KQka - 4 6` |
| 25 | `{"type":"endTurn"}` | `n1bqk1nr/pp1pp1bp/r1p3p1/5p2/1P6/2NPB2P/P1P1PPP1/R2QKBNR b KQka - 4 6` |
| 26 | `{"type":"move","from":"a8","to":"c7"}` | `2bqk1nr/ppnpp1bp/r1p3p1/5p2/1P6/2NPB2P/P1P1PPP1/R2QKBNR w KQka - 5 7` |
| 27 | `{"type":"endTurn"}` | `2bqk1nr/ppnpp1bp/r1p3p1/5p2/1P6/2NPB2P/P1P1PPP1/R2QKBNR w KQka - 5 7` |
| 28 | `{"type":"move","from":"e3","to":"b6"}` | `2bqk1nr/ppnpp1bp/rBp3p1/5p2/1P6/2NP3P/P1P1PPP1/R2QKBNR b KQka - 6 7` |
| 29 | `{"type":"endTurn"}` | `2bqk1nr/ppnpp1bp/rBp3p1/5p2/1P6/2NP3P/P1P1PPP1/R2QKBNR b KQka - 6 7` |
| 30 | `{"type":"move","from":"c7","to":"e6"}` | `2bqk1nr/pp1pp1bp/rBp1n1p1/5p2/1P6/2NP3P/P1P1PPP1/R2QKBNR w KQka - 7 8` |
| 31 | `{"type":"endTurn"}` | `2bqk1nr/pp1pp1bp/rBp1n1p1/5p2/1P6/2NP3P/P1P1PPP1/R2QKBNR w KQka - 7 8` |
| 32 | `{"type":"move","from":"b6","to":"d4"}` | `2bqk1nr/pp1pp1bp/r1p1n1p1/5p2/1P1B4/2NP3P/P1P1PPP1/R2QKBNR b KQka - 8 8` |
| 33 | `{"type":"endTurn"}` | `2bqk1nr/pp1pp1bp/r1p1n1p1/5p2/1P1B4/2NP3P/P1P1PPP1/R2QKBNR b KQka - 8 8` |
| 34 | `{"type":"move","from":"g7","to":"f6"}` | `2bqk1nr/pp1pp2p/r1p1nbp1/5p2/1P1B4/2NP3P/P1P1PPP1/R2QKBNR w KQka - 9 9` |
| 35 | `{"type":"endTurn"}` | `2bqk1nr/pp1pp2p/r1p1nbp1/5p2/1P1B4/2NP3P/P1P1PPP1/R2QKBNR w KQka - 9 9` |
| 36 | `{"type":"move","from":"d1","to":"b1"}` | `2bqk1nr/pp1pp2p/r1p1nbp1/5p2/1P1B4/2NP3P/P1P1PPP1/RQ2KBNR b KQka - 10 9` |
| 37 | `{"type":"endTurn"}` | `2bqk1nr/pp1pp2p/r1p1nbp1/5p2/1P1B4/2NP3P/P1P1PPP1/RQ2KBNR b KQka - 10 9` |
| 38 | `{"type":"move","from":"f5","to":"f4"}` | `2bqk1nr/pp1pp2p/r1p1nbp1/8/1P1B1p2/2NP3P/P1P1PPP1/RQ2KBNR w KQka - 0 10` |
| 39 | `{"type":"playCard","cardId":"siege","cardInstanceId":"black-deck-0-siege","target":{"knight":"e6","rook":"h8"}}` | `2bqk1nn/pp1pp2p/r1p1rbp1/8/1P1B1p2/2NP3P/P1P1PPP1/RQ2KBNR w KQha - 0 10` |
| 40 | `{"type":"endTurn"}` | `2bqk1nn/pp1pp2p/r1p1rbp1/8/1P1B1p2/2NP3P/P1P1PPP1/RQ2KBNR w KQha - 0 10` |
| 41 | `{"type":"move","from":"e1","to":"d2"}` | `2bqk1nn/pp1pp2p/r1p1rbp1/8/1P1B1p2/2NP3P/P1PKPPP1/RQ3BNR b ha - 1 10` |
| 42 | `{"type":"endTurn"}` | `2bqk1nn/pp1pp2p/r1p1rbp1/8/1P1B1p2/2NP3P/P1PKPPP1/RQ3BNR b ha - 1 10` |
| 43 | `{"type":"move","from":"a6","to":"a2"}` | `2bqk1nn/pp1pp2p/2p1rbp1/8/1P1B1p2/2NP3P/r1PKPPP1/RQ3BNR w h - 0 11` |
| 44 | `{"type":"endTurn"}` | `2bqk1nn/pp1pp2p/2p1rbp1/8/1P1B1p2/2NP3P/r1PKPPP1/RQ3BNR w h - 0 11` |

## Limits and conclusion

No confirmed defect on this finite path. Four played cards / twelve sampled card types do not establish unplayed-card semantics or all interactions. Whole-agent review exceeded the 45-second turnaround target; the single game remained well inside its 15-second/80-action execution bound. Parent can measure total phase time from dispatch; engine duration is measured above. Both scaffold executions passed. No novel or duplicate prior defect was reproduced.

GAME_087_DONE
