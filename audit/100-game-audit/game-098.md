# Game 098

Seed: 908098. Audit complete.

Pre-run invariants: exactly one generated game; no replay, reset, or second game; at most 80 actions and 15 seconds through the callback; only Markdown writes; no test sources read.

Pre-action hypothesis: ordinary moves preserve independent chess legality and physical-board/FEN agreement; card actions preserve unique pieces/cards and royal identities. Specific card semantics will be assessed independently after observing the single generated path, not inferred from state hashes. Saved-fixture scaffold passed: 4 probes, 0 findings.

## Executed game

Exactly one `generateTrace(908098, 20, progress)` call. Callback bounded at 80 actions/15 seconds. Completed in 807.735 ms: 49 accepted actions, 20 ordinary moves, no reported failure. Rejected candidate count is not exposed by this helper and was not instrumented. Both pre/post saved-fixture scaffolds passed with 4 probes and zero findings each. No replay or reset, test reads, code writes, or temporary harnesses.

Initial options (standard starting board; rules §4.3 shuffled-catalog house variant):

```json
{"hands":{"white":["legacy","cathedral","dubbing","breakthrough","disintegration"],"black":["hidden-passage","no-quarter","curse","siege","betrayal"]},"decks":{"white":["blessing","bombard","toll","long-jump","crusade","siege","neutrality","cowardice","curse","plots-within-plots","no-quarter","bog","anathema","revenge","forced-march","haunting-memories","dark-mirror","sanctuary","tournament","forbidden-city","figure-dance","chaos","betrayal","split-knight","assassin","fog-of-war","ghostwalk","madman","fortification","charge","merciless","abduction","treason","hostage","mystic-shield","doppelganger","holy-war","dungeon","annexation","evangelists","guardian","riposte","hidden-passage","fireball","holy-quest","evil-eye","peace-talks","winged-victory","onslaught","passing-in-the-night","coup","rebirth","vendetta","earthquake","fatal-attraction","panic","think-again","confabulation","fanatic","heresy","resurrection","masquerade","vulture","under-elf-hill","pacifism","man-of-straw","knightmare","crab","irresistible-force","man-trap","squaring-the-circle","lost-castle","truce","doomsayer","challenge"],"black":["forbidden-city","man-trap","truce","challenge","winged-victory","evil-eye","doppelganger","breakthrough","neutrality","confabulation","mystic-shield","masquerade","evangelists","fireball","forced-march","crusade","knightmare","bombard","guardian","figure-dance","chaos","peace-talks","holy-war","crab","under-elf-hill","plots-within-plots","revenge","dark-mirror","pacifism","bog","anathema","legacy","coup","long-jump","treason","lost-castle","madman","merciless","fog-of-war","fanatic","heresy","vulture","tournament","cowardice","vendetta","assassin","resurrection","fatal-attraction","ghostwalk","riposte","haunting-memories","squaring-the-circle","dubbing","cathedral","onslaught","doomsayer","man-of-straw","abduction","annexation","hostage","panic","irresistible-force","earthquake","fortification","sanctuary","dungeon","toll","think-again","passing-in-the-night","rebirth","blessing","split-knight","holy-quest","charge","disintegration"]}}
```

Sequential accepted actions (each numbered row succeeded; `end` means `{type:"endTurn"}`):

```text
01 move a2 a4
02 end
03 move g7 g6
04 end
05 move a4 a5
06 end
07 move c7 c5
08 playCard curse black-hand-2-curse target="f1"
09 end
10 move c2 c4
11 end
12 move b7 b5
13 end
14 playCard dubbing white-hand-2-dubbing target=[{"from":"a5","to":"b3"}]
15 end
16 move d8 b6
17 end
18 move d2 d4
19 end
20 move b5 b4
21 playCard siege black-hand-3-siege target={"knight":"b8","rook":"a8"}
22 end
23 playCard blessing white-deck-0-blessing target=[{"from":"d1","to":"c2"}]
24 end
25 move f7 f6
26 end
27 move g2 g4
28 end
29 move b8 b7
30 end
31 move d4 c5
32 end
33 move h7 h6
34 end
35 move c5 b6
36 playCard cathedral white-hand-1-cathedral target={"rook":"a1","bishop":"c1"}
37 end
38 move d7 d5
39 end
40 move c2 g6
41 end
42 playCard betrayal black-hand-4-betrayal target={"pieceId":"black-pawn-c7","to":"b6"}
43 move e8 d7
44 end
45 playCard disintegration white-hand-4-disintegration target="b2"
46 move g6 g7
47 end
48 move b6 b5
49 end
```

Sampled-card counts: no-quarter 8, cathedral 4, curse 1, hidden-passage 3, dubbing 1, blessing 2, betrayal 2, disintegration 3, siege 1, man-trap 1, legacy 1, bombard 1, toll 1. Played cards: Curse, Dubbing, Siege, Blessing, Cathedral, Betrayal, Disintegration.

Final FEN: `n1b2bnr/pr1kp1Q1/5p1p/1p1p4/1pP3P1/1P6/4PP1P/BNR1KBNR w KA - 0 12`.

## Independent review of three observed transitions

These are post-run semantic reviews, separate from the pre-run structural predictions. The helper enumerated public `cardPlayTargets` before each card and selected a returned target.

1. Step 8, Curse: cards.md “Curse” permits an opposing Queen/Bishop/Rook; catalog timing is afterMove and continuing. Before: Black afterMove after c7-c5, white Bishop physically at f1. Expected: mark that bishop without moving it, preserve the completed move, consume Black's allowance and draw replacement. Actual: identical FEN `rnbqkbnr/pp1ppp1p/6p1/P1p5/8/8/1PPPPPPP/RNBQKBNR w KQkq - 0 3`; zero piece deltas; effect `{type:"curse",owner:"black",card:{id:"black-hand-2-curse",cardId:"curse"},pieceId:"white-bishop-f1"}`; Black allowance 0→1, deck 75→74, forbidden-city drawn, no Curse discard. Pass for installation/accounting; this path did not exercise that bishop's range restriction or expiry.

2. Step 14, Dubbing: cards.md “Dubbing” and rules §13.9 permit a non-capturing Knight-geometry replacement move, retaining identity. Expected: a5→b3 is (1,2), b3 empty, white original Pawn remains Pawn; consume Regular Move, clear en passant and keep its halfmove clock zero. Actual: only white-pawn-a2 moved a5→b3 with role/originalRole pawn and all flags unchanged. FEN `rnbqkbnr/p2ppp1p/6p1/Ppp5/2P5/8/1P1PPPPP/RNBQKBNR w KQkq b6 0 4` → `rnbqkbnr/p2ppp1p/6p1/1pp5/2P5/1P6/1P1PPPPP/RNBQKBNR b KQkq - 0 4`. beforeMove/false→afterMove/true, white allowance 0→1, deck 75→74, Blessing drawn and Dubbing discarded. Existing Curse unchanged. Pass.

3. Step 21, Siege: cards.md “Siege” and rules §20 swap procedure permit Black's Knight/Rook exchange after the move, with identities preserved. Expected: b8 Knight and a8 Rook exchange simultaneously without capture, role change, extra turn, or clock advance. Actual: black-rook-a8 a8→b8 and black-knight-b8 b8→a8, all other fields unchanged; Black remained afterMove/true, allowance 0→1, deck 74→73, Man-Trap drawn, Siege discarded. FEN `rnb1kbnr/p2ppp1p/1q4p1/2p5/1pPP4/1P6/1P2PPPP/RNBQKBNR w KQkq - 0 6` → `nrb1kbnr/p2ppp1p/1q4p1/2p5/1pPP4/1P6/1P2PPPP/RNBQKBNR w KQka - 0 6`. Board exchange, accounting, and clocks pass; the FEN castling token changed q→a while its original rook moved to b8, so no conclusion on subsequent castling legality is claimed from this path.

Findings: zero confirmed engine defects in the reviewed transitions or executed structural/ordinary-chess checks. Limitations: one finite path, three independently reviewed card rows, no independent oracle for every sampled card; rejection counts unavailable; no universal correctness claim. Broad rule-search output was truncated, then relevant sections were read with narrower searches; game evidence was not truncated. Agent reporting completed beyond the protocol's 45-second target; the game itself stayed within its bounds.

GAME_098_DONE
