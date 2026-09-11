# Game 097

Seed: 908097. Status: complete.

Pre-run invariants: use the existing seeded generator once; stop at 80 actions or 15 seconds; inspect all emitted actions and three critical card transitions; do not reset, replay, or create code/test files.

Status: complete. No finding on the observed path.

Pre-action hypothesis: every accepted transition preserves unique piece/card identities and occupied squares, FEN/physical-board agreement, and both royal identities. Ordinary moves without variant state must match chessops legality and board results. Card transitions will require an independent post-run semantic review; digest equality alone does not establish their correctness.

Initial saved-fixture scaffold executed: 4 probes, zero findings.

## Execution

Baseline `33e03989fab9449d87b857fc5673f67d05841928`. Exactly one `generateTrace(908097,20,progress)` call; no replay/reset. The progress callback checked state and enforced 80 actions / 15 seconds. Completed 43 accepted actions and 20 ordinary-move action records in 1347.990 ms; failure absent. Candidate rejection counts are not exposed by this helper and are unknown. Both saved-fixture scaffold runs passed: 8 total probes, zero findings. The scaffold is not an additional game.

Initial board: standard chess, default beforeMove/White; no injected phase or effects. Exact options follow (ordered hands and decks, shuffled-catalog house variant under rules §4.3):

```json
{"hands":{"white":["holy-war","neutrality","betrayal","hidden-passage","split-knight"],"black":["knightmare","fog-of-war","vulture","irresistible-force","revenge"]},"decks":{"white":["resurrection","confabulation","man-of-straw","crab","revenge","fortification","vendetta","challenge","figure-dance","no-quarter","sanctuary","fatal-attraction","hostage","breakthrough","disintegration","annexation","truce","cowardice","think-again","assassin","ghostwalk","lost-castle","man-trap","long-jump","dark-mirror","legacy","chaos","tournament","winged-victory","coup","masquerade","fireball","fog-of-war","passing-in-the-night","vulture","evil-eye","curse","rebirth","under-elf-hill","forced-march","riposte","treason","dubbing","squaring-the-circle","evangelists","dungeon","blessing","heresy","bombard","doppelganger","peace-talks","holy-quest","haunting-memories","siege","guardian","doomsayer","knightmare","forbidden-city","crusade","plots-within-plots","charge","cathedral","mystic-shield","madman","anathema","pacifism","earthquake","onslaught","fanatic","toll","merciless","panic","bog","abduction","irresistible-force"],"black":["fireball","onslaught","breakthrough","dark-mirror","challenge","man-trap","cathedral","neutrality","merciless","legacy","no-quarter","ghostwalk","siege","blessing","fortification","haunting-memories","plots-within-plots","anathema","charge","rebirth","treason","bombard","doppelganger","confabulation","passing-in-the-night","think-again","split-knight","earthquake","abduction","toll","man-of-straw","assassin","mystic-shield","doomsayer","riposte","evil-eye","forbidden-city","sanctuary","holy-quest","holy-war","long-jump","panic","disintegration","masquerade","truce","figure-dance","betrayal","heresy","under-elf-hill","dubbing","lost-castle","chaos","forced-march","tournament","annexation","crusade","hidden-passage","cowardice","squaring-the-circle","resurrection","crab","madman","winged-victory","vendetta","guardian","peace-talks","evangelists","fatal-attraction","dungeon","coup","pacifism","hostage","curse","bog","fanatic"]}}
```

Exact sequential accepted actions below. `move a-b` means `{type:"move",from:a,to:b}`; `endTurn` has no other fields. Card instances and targets are explicit. All listed actions succeeded and structural/eligible ordinary-chess checks passed.

```text
01 move b1-a3
02 endTurn
03 move g7-g6
04 endTurn
05 move d2-d3
06 endTurn
07 move d7-d6
08 endTurn
09 move c1-g5
10 endTurn
11 move f7-f6
12 endTurn
13 move g5-f4
14 playCard knightmare instance=black-hand-0-knightmare (no target)
15 move g5-e3
16 playCard neutrality instance=white-hand-1-neutrality target="b8"
17 endTurn
18 move e8-f7
19 endTurn
20 move c2-c4
21 endTurn
22 move b8-c6
23 endTurn
24 move e3-c1
25 endTurn
26 playCard irresistible-force instance=black-hand-3-irresistible-force target=[{"from":"c7","to":"c6"}]
27 endTurn
28 move c1-g5
29 endTurn
30 move c5-d3
31 endTurn
32 move d1-b3
33 playCard holy-war instance=white-hand-0-holy-war target={"knight":"g1","bishop":"f1"}
34 move e2-d3
35 endTurn
36 move f8-h6
37 endTurn
38 move g5-h4
39 endTurn
40 move h6-d2
41 endTurn
42 move e1-d2
43 endTurn
```

Sampled counts: irresistible-force 2, split-knight 4, betrayal 4, knightmare 2, vulture 6, hidden-passage 5, revenge 1, fog-of-war 4, neutrality 1, holy-war 3, onslaught 4. Played: Knightmare! (14), Neutrality (16), Irresistible Force (26), Holy War (33).

Final FEN: `r1bq2nr/pp2pk1p/2pp1pp1/8/2P4B/N2P4/PP1K1PPP/R2Q1BNR b - - 0 10`.

## Three independent semantic reviews (post-run)

1. **Knightmare!, step 14 — cards.md “Knightmare!”; rules §17.1; catalog afterOpponentMove.** White had just moved bishop g5-f4. The reaction restored that same bishop f4-g5 and restored White beforeMove with moveMade=false; Black allowance became 1. FEN changed from `rnbqkbnr/ppp1p2p/3p1pp1/8/5B2/N2P4/PPP1PPPP/R2QKBNR b KQkq - 1 4` to `rnbqkbnr/ppp1p2p/3p1pp1/6B1/8/N2P4/PPP1PPPP/R2QKBNR w KQkq - 0 4`. Black discarded the physical Knightmare! and drew Fireball (deck 75→74). White then made a genuinely different bishop move g5-e3. Expected rollback and replacement behavior observed; repeat rejection itself was not probed.

2. **Neutrality, step 16 — cards.md “Neutrality”; rules §15.1; catalog afterMove, continuing.** White selected Black's b8 Knight after its replacement move. The recorded piece kept ID `black-knight-b8`, Black ownership, knight/original-knight roles, square b8, and board zone, gaining only neutrality metadata. An effect linked `white-hand-1-neutrality` to that physical ID; White drew Resurrection (75→74), did not discard the active card, and consumed its allowance. FEN and completed White turn status were unchanged: `rnbqkbnr/ppp1p2p/3p1pp1/8/8/N2PB3/PPP1PPPP/R2QKBNR b KQkq - 1 4`. Expected identity/control and Continuing Effect accounting observed. Later Black's b8-c6 move is permitted for this neutral Knight.

3. **Irresistible Force, step 26 — cards.md “Irresistible Force”; rules §§22.2 and 15.1; catalog beforeMove.** Black's pawn c7 had the marked Knight immediately ahead at c6 and c5 empty. Expected pawn c7-c6 and Knight c6-c5, no capture, preserved neutrality. Both exact deltas occurred with the same piece IDs and unchanged Neutrality effect. FEN changed from `r1bq1bnr/ppp1pk1p/2np1pp1/8/2P5/N2P4/PP2PPPP/R1BQKBNR b KQ - 2 6` to `r1bq1bnr/pp2pk1p/2pp1pp1/2n5/2P5/N2P4/PP2PPPP/R1BQKBNR w KQ - 0 7`. Black entered afterMove, moveMade=true, allowance 1, discarded Irresistible Force, and drew Onslaught (74→73). The neutral piece remains eligible for cards applying to friendly/enemy pieces; neither a King push nor edge capture occurred. Expected push and identity behavior observed.

## Limits

Only the three selected card rows received full before/after semantic review; Holy War's full row was not retained. All actions were inspected, but automated structural/digest checks cannot establish every card interaction. This is one finite path, not universal correctness. Source search output for broad neutral-rule matches truncated; exact relevant rule sections were reread in a bounded command. No game evidence output truncated, no tests read/run, and no code/harness writes occurred. Total agent/report phase exceeded 45 seconds; the game itself completed within its 15-second budget. Prior audit summaries were consulted; no new or duplicate finding arose.

GAME_097_DONE
