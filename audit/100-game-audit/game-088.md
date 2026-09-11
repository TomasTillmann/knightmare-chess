# Game 088 — seed 908088

## Pre-run invariants and hypotheses

- A legal transition should preserve unique occupied squares and valid side-to-move state.
- Card transitions must observe their documented timing and targeting restrictions.
- Terminal positions must not permit ordinary continuation; incomplete time-bounded traces are not bugs.

## Executed result

Exactly one `generateTrace(908088, 20, progress)` call; no replay, reset, or second game. It completed in **1,484 ms**: **46 accepted actions**, comprising 20 Regular Moves, four card plays, and 22 endTurn actions. Failure: none. Callback bounds were 80 actions / 15 seconds; neither was reached. Internal rejected-candidate counts are not exposed by this helper and were not measured; the trace below contains accepted actions only.

Saved-fixture scaffold ran before and after: four probes, zero findings on each execution (eight scaffold probes total). The game supplies one independent seeded adversarial group. Total agent/reporting time exceeded the 45-second target; first-scaffold elapsed time was not instrumented, so 15-second checkpoint compliance is not claimed. Initial position was the standard chess start; the helper checked structural invariants after each accepted action, but this invocation did not separately call checkState in the initial callback.

Final FEN: `1nB1k2r/1p3p2/2n3pn/2b5/QbP5/2N5/rP1PPPPR/R1B1KBN1 w k - 0 12`. Final turn: white beforeMove, moveMade=false, both card allowances zero; no unresolved rescue. This is bounded partial-game coverage, not a terminal game or proof of correctness.

## Exact initial options

Seed: `908088`; maxMoves: `20`. Standard starting FEN and default options; exact configured hands and deck order:

```json
{"hands":{"white":["coup","winged-victory","evangelists","doppelganger","bog"],"black":["pacifism","challenge","forced-march","earthquake","abduction"]},"decks":{"white":["sanctuary","confabulation","heresy","guardian","holy-war","think-again","mystic-shield","doomsayer","forbidden-city","chaos","cowardice","long-jump","resurrection","panic","dubbing","abduction","masquerade","hostage","evil-eye","vulture","holy-quest","dark-mirror","neutrality","anathema","merciless","tournament","earthquake","vendetta","fanatic","irresistible-force","charge","breakthrough","treason","man-trap","siege","blessing","fog-of-war","disintegration","curse","ghostwalk","revenge","crusade","lost-castle","forced-march","man-of-straw","squaring-the-circle","split-knight","peace-talks","plots-within-plots","legacy","betrayal","pacifism","fireball","rebirth","hidden-passage","onslaught","annexation","fortification","assassin","bombard","truce","haunting-memories","riposte","challenge","cathedral","fatal-attraction","madman","toll","no-quarter","passing-in-the-night","figure-dance","dungeon","knightmare","under-elf-hill","crab"],"black":["winged-victory","fireball","bog","peace-talks","guardian","cowardice","crusade","charge","fatal-attraction","figure-dance","man-trap","annexation","squaring-the-circle","heresy","forbidden-city","hidden-passage","truce","riposte","no-quarter","evangelists","holy-quest","madman","fog-of-war","curse","legacy","chaos","masquerade","vendetta","merciless","treason","resurrection","man-of-straw","knightmare","passing-in-the-night","haunting-memories","under-elf-hill","vulture","dubbing","neutrality","doppelganger","tournament","fortification","panic","confabulation","plots-within-plots","blessing","evil-eye","split-knight","sanctuary","toll","coup","onslaught","disintegration","siege","anathema","breakthrough","irresistible-force","mystic-shield","think-again","bombard","cathedral","rebirth","betrayal","hostage","long-jump","crab","lost-castle","doomsayer","holy-war","dungeon","assassin","dark-mirror","fanatic","revenge","ghostwalk"]}}
```

## Card coverage

Sample counts (sampling does not imply play): `{"coup":3,"forced-march":4,"earthquake":1,"abduction":2,"challenge":2,"winged-victory":5,"pacifism":3,"doppelganger":1,"bog":4,"evangelists":2,"fireball":1,"sanctuary":3}`.

Played once each: Earthquake, Forced March, Fireball, Evangelists.

## Independent post-run critical-transition reviews

These are rule-based reviews of observed transitions, **not pre-action predictions**. The pre-run hypotheses above cover structural and ordinary-chess invariants only.

1. **Earthquake — step 4; cards.md “Earthquake”, rules.md §14.1.** Clockwise rotation makes White advance toward file h and Black toward file a. Thus h2 and a7 are their new last ranks: the opposing White Pawn becomes a Bishop first, then Black's a7 Pawn becomes a Knight. Observed identities white-pawn-h2 and black-pawn-a7 remain on their fixed-coordinate squares with promoted=true and chosen roles. Step 6 h2–f4 and step 20 a7–c6 subsequently use those promoted powers. Step 24 e6–d6 and steps 41/45 h7–g7–f7 independently agree with Black's changed forward direction. No discrepancy.

2. **Forced March under Earthquake — step 12; cards.md “Forced March”, rules.md §13.6.** The selected Black Pawns f7 and g7 move one square sideways in rotated coordinates, hence f7–f6 and g7–g6 in fixed coordinates. Both destinations were empty and distinct before the action; no captures occurred. Only these two identities change squares, with roles retained. Black transitions beforeMove/false to afterMove/true and spends its allowance. FEN moves from Black fullmove 3 to White fullmove 4, no extra Regular Move or en-passant right. No discrepancy.

3. **Fireball adjacent to its own King — step 29; cards.md “Fireball”, rules.md §22.1.** Step 28 d8–e7 was a quiet Black Queen move. Its e7 blast should capture center e7 plus occupied neighboring d7, d6, f6; e8 holds the exempt Black King. Actual captured identities are black-queen-d8 and black-pawn-d7/e7/f7, all zone=captured, square=null, capturedBy=black. King e8 and all nonadjacent pieces remain. Black stays afterMove, the halfmove counter resets 2→0, and fullmove stays 8. No discrepancy.

4. **Evangelists with an Earthquake-promoted Pawn — step 31; cards.md “Evangelists”, rules.md §20 (swap rules at line 648).** White's original h2 Pawn currently acts as a Bishop on b6, qualifying by its promoted role. Opponent Bishop c8 also qualifies. Expected simultaneous exchange preserving identity and no capture; actual white-pawn-h2 moves b6→c8, retains promoted Bishop status, while black-bishop-c8 moves c8→b6. The move is consumed, White spends one card, and FEN halfmove advances 0→1 without advancing fullmove 8. No discrepancy.

No new finding or duplicate prior finding identified on this path. Card target enumeration was performed by the existing helper on this same game before attempted plays. Its digest checks are not treated as card-semantics proof.

## Full accepted action trace

Each row reports its exact public action and resulting FEN. All 46 results were accepted; endTurn rows retain the board and hand control to the opponent. No digest-only assertions substitute for the semantic reviews above.

| Step | Action | Resulting FEN |
| --- | --- | --- |
| 1 | `{"type":"move","from":"c2","to":"c4"}` | `rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1` |
| 2 | `{"type":"endTurn"}` | `rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1` |
| 3 | `{"type":"move","from":"e7","to":"e6"}` | `rnbqkbnr/pppp1ppp/4p3/8/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 0 2` |
| 4 | `{"type":"playCard","cardId":"earthquake","cardInstanceId":"black-hand-3-earthquake","target":{"direction":"clockwise","promotions":[{"square":"h2","role":"bishop"},{"square":"a7","role":"knight"}]}}` | `rnbqkbnr/nppp1ppp/4p3/8/2P5/8/PP1PPPPB/RNBQKBNR w KQkq - 0 2` |
| 5 | `{"type":"endTurn"}` | `rnbqkbnr/nppp1ppp/4p3/8/2P5/8/PP1PPPPB/RNBQKBNR w KQkq - 0 2` |
| 6 | `{"type":"move","from":"h2","to":"f4"}` | `rnbqkbnr/nppp1ppp/4p3/8/2P2B2/8/PP1PPPP1/RNBQKBNR b KQkq - 1 2` |
| 7 | `{"type":"endTurn"}` | `rnbqkbnr/nppp1ppp/4p3/8/2P2B2/8/PP1PPPP1/RNBQKBNR b KQkq - 1 2` |
| 8 | `{"type":"move","from":"g8","to":"h6"}` | `rnbqkb1r/nppp1ppp/4p2n/8/2P2B2/8/PP1PPPP1/RNBQKBNR w KQkq - 2 3` |
| 9 | `{"type":"endTurn"}` | `rnbqkb1r/nppp1ppp/4p2n/8/2P2B2/8/PP1PPPP1/RNBQKBNR w KQkq - 2 3` |
| 10 | `{"type":"move","from":"h1","to":"h5"}` | `rnbqkb1r/nppp1ppp/4p2n/7R/2P2B2/8/PP1PPPP1/RNBQKBN1 b Qkq - 3 3` |
| 11 | `{"type":"endTurn"}` | `rnbqkb1r/nppp1ppp/4p2n/7R/2P2B2/8/PP1PPPP1/RNBQKBN1 b Qkq - 3 3` |
| 12 | `{"type":"playCard","cardId":"forced-march","cardInstanceId":"black-hand-2-forced-march","target":[{"from":"f7","to":"f6"},{"from":"g7","to":"g6"}]}` | `rnbqkb1r/nppp3p/4pppn/7R/2P2B2/8/PP1PPPP1/RNBQKBN1 w Qkq - 0 4` |
| 13 | `{"type":"endTurn"}` | `rnbqkb1r/nppp3p/4pppn/7R/2P2B2/8/PP1PPPP1/RNBQKBN1 w Qkq - 0 4` |
| 14 | `{"type":"move","from":"h5","to":"h2"}` | `rnbqkb1r/nppp3p/4pppn/8/2P2B2/8/PP1PPPPR/RNBQKBN1 b Qkq - 1 4` |
| 15 | `{"type":"endTurn"}` | `rnbqkb1r/nppp3p/4pppn/8/2P2B2/8/PP1PPPPR/RNBQKBN1 b Qkq - 1 4` |
| 16 | `{"type":"move","from":"f8","to":"b4"}` | `rnbqk2r/nppp3p/4pppn/8/1bP2B2/8/PP1PPPPR/RNBQKBN1 w Qkq - 2 5` |
| 17 | `{"type":"endTurn"}` | `rnbqk2r/nppp3p/4pppn/8/1bP2B2/8/PP1PPPPR/RNBQKBN1 w Qkq - 2 5` |
| 18 | `{"type":"move","from":"b1","to":"c3"}` | `rnbqk2r/nppp3p/4pppn/8/1bP2B2/2N5/PP1PPPPR/R1BQKBN1 b Qkq - 3 5` |
| 19 | `{"type":"endTurn"}` | `rnbqk2r/nppp3p/4pppn/8/1bP2B2/2N5/PP1PPPPR/R1BQKBN1 b Qkq - 3 5` |
| 20 | `{"type":"move","from":"a7","to":"c6"}` | `rnbqk2r/1ppp3p/2n1pppn/8/1bP2B2/2N5/PP1PPPPR/R1BQKBN1 w Qkq - 4 6` |
| 21 | `{"type":"endTurn"}` | `rnbqk2r/1ppp3p/2n1pppn/8/1bP2B2/2N5/PP1PPPPR/R1BQKBN1 w Qkq - 4 6` |
| 22 | `{"type":"move","from":"f4","to":"c7"}` | `rnbqk2r/1pBp3p/2n1pppn/8/1bP5/2N5/PP1PPPPR/R1BQKBN1 b Qkq - 0 6` |
| 23 | `{"type":"endTurn"}` | `rnbqk2r/1pBp3p/2n1pppn/8/1bP5/2N5/PP1PPPPR/R1BQKBN1 b Qkq - 0 6` |
| 24 | `{"type":"move","from":"e6","to":"d6"}` | `rnbqk2r/1pBp3p/2np1ppn/8/1bP5/2N5/PP1PPPPR/R1BQKBN1 w Qkq - 0 7` |
| 25 | `{"type":"endTurn"}` | `rnbqk2r/1pBp3p/2np1ppn/8/1bP5/2N5/PP1PPPPR/R1BQKBN1 w Qkq - 0 7` |
| 26 | `{"type":"move","from":"c7","to":"b6"}` | `rnbqk2r/1p1p3p/1Bnp1ppn/8/1bP5/2N5/PP1PPPPR/R1BQKBN1 b Qkq - 1 7` |
| 27 | `{"type":"endTurn"}` | `rnbqk2r/1p1p3p/1Bnp1ppn/8/1bP5/2N5/PP1PPPPR/R1BQKBN1 b Qkq - 1 7` |
| 28 | `{"type":"move","from":"d8","to":"e7"}` | `rnb1k2r/1p1pq2p/1Bnp1ppn/8/1bP5/2N5/PP1PPPPR/R1BQKBN1 w Qkq - 2 8` |
| 29 | `{"type":"playCard","cardId":"fireball","cardInstanceId":"black-deck-1-fireball","target":"e7"}` | `rnb1k2r/1p5p/1Bn3pn/8/1bP5/2N5/PP1PPPPR/R1BQKBN1 w Qkq - 0 8` |
| 30 | `{"type":"endTurn"}` | `rnb1k2r/1p5p/1Bn3pn/8/1bP5/2N5/PP1PPPPR/R1BQKBN1 w Qkq - 0 8` |
| 31 | `{"type":"playCard","cardId":"evangelists","cardInstanceId":"white-hand-2-evangelists","target":{"own":"b6","opponent":"c8"}}` | `rnB1k2r/1p5p/1bn3pn/8/1bP5/2N5/PP1PPPPR/R1BQKBN1 b Qkq - 1 8` |
| 32 | `{"type":"endTurn"}` | `rnB1k2r/1p5p/1bn3pn/8/1bP5/2N5/PP1PPPPR/R1BQKBN1 b Qkq - 1 8` |
| 33 | `{"type":"move","from":"a8","to":"a2"}` | `1nB1k2r/1p5p/1bn3pn/8/1bP5/2N5/rP1PPPPR/R1BQKBN1 w Qk - 0 9` |
| 34 | `{"type":"endTurn"}` | `1nB1k2r/1p5p/1bn3pn/8/1bP5/2N5/rP1PPPPR/R1BQKBN1 w Qk - 0 9` |
| 35 | `{"type":"move","from":"a1","to":"b1"}` | `1nB1k2r/1p5p/1bn3pn/8/1bP5/2N5/rP1PPPPR/1RBQKBN1 b k - 1 9` |
| 36 | `{"type":"endTurn"}` | `1nB1k2r/1p5p/1bn3pn/8/1bP5/2N5/rP1PPPPR/1RBQKBN1 b k - 1 9` |
| 37 | `{"type":"move","from":"b6","to":"c5"}` | `1nB1k2r/1p5p/2n3pn/2b5/1bP5/2N5/rP1PPPPR/1RBQKBN1 w k - 2 10` |
| 38 | `{"type":"endTurn"}` | `1nB1k2r/1p5p/2n3pn/2b5/1bP5/2N5/rP1PPPPR/1RBQKBN1 w k - 2 10` |
| 39 | `{"type":"move","from":"b1","to":"a1"}` | `1nB1k2r/1p5p/2n3pn/2b5/1bP5/2N5/rP1PPPPR/R1BQKBN1 b k - 3 10` |
| 40 | `{"type":"endTurn"}` | `1nB1k2r/1p5p/2n3pn/2b5/1bP5/2N5/rP1PPPPR/R1BQKBN1 b k - 3 10` |
| 41 | `{"type":"move","from":"h7","to":"g7"}` | `1nB1k2r/1p4p1/2n3pn/2b5/1bP5/2N5/rP1PPPPR/R1BQKBN1 w k - 0 11` |
| 42 | `{"type":"endTurn"}` | `1nB1k2r/1p4p1/2n3pn/2b5/1bP5/2N5/rP1PPPPR/R1BQKBN1 w k - 0 11` |
| 43 | `{"type":"move","from":"d1","to":"a4"}` | `1nB1k2r/1p4p1/2n3pn/2b5/QbP5/2N5/rP1PPPPR/R1B1KBN1 b k - 1 11` |
| 44 | `{"type":"endTurn"}` | `1nB1k2r/1p4p1/2n3pn/2b5/QbP5/2N5/rP1PPPPR/R1B1KBN1 b k - 1 11` |
| 45 | `{"type":"move","from":"g7","to":"f7"}` | `1nB1k2r/1p3p2/2n3pn/2b5/QbP5/2N5/rP1PPPPR/R1B1KBN1 w k - 0 12` |
| 46 | `{"type":"endTurn"}` | `1nB1k2r/1p3p2/2n3pn/2b5/QbP5/2N5/rP1PPPPR/R1B1KBN1 w k - 0 12` |

GAME_088_DONE
