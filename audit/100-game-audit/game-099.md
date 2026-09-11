# Game 099 audit

Seed: 908099. Status: completed one bounded seeded game; no confirmed finding in the reviewed transitions.

Pre-run invariants: one `generateTrace(seed, 20, progress)` invocation only; no replay or reset; stop within 80 actions or 15 seconds; inspect engine behavior only; write Markdown evidence only.

Pre-action hypothesis: every accepted action preserves unique piece IDs, occupied-square uniqueness, and both kings; ordinary moves obey legal destination enumeration. Card effects require separate semantic review because structural checks do not establish card correctness. Initial saved-fixture scaffold executed: 4 probes, 0 findings.

Baseline: `33e03989fab9449d87b857fc5673f67d05841928`. One `generateTrace(908099,20,progress)` invocation; 44 accepted actions, 20 regular moves, 4710.34 ms, no reported failure. Rejected candidate count is not exposed by the helper. All generated transitions passed the helper's structural checks, input immutability checks, and its conditional ordinary-chess oracle. No replay, second game, test inspection, or code changes. Post-game saved-fixture scaffold: 4 probes, 0 findings (8 total across two runs).

## Exact initial options

Standard starting board and default setup; only these options supplied:

```json
{"hands":{"white":["challenge","peace-talks","vulture","man-trap","crab"],"black":["fortification","breakthrough","challenge","abduction","plots-within-plots"]},"decks":{"white":["bombard","legacy","panic","assassin","dungeon","haunting-memories","dubbing","fog-of-war","under-elf-hill","doppelganger","crusade","evil-eye","onslaught","betrayal","truce","guardian","heresy","sanctuary","disintegration","doomsayer","dark-mirror","bog","figure-dance","hidden-passage","curse","split-knight","forbidden-city","vendetta","no-quarter","think-again","merciless","siege","coup","riposte","madman","blessing","cowardice","charge","revenge","evangelists","winged-victory","chaos","holy-quest","annexation","lost-castle","neutrality","forced-march","cathedral","squaring-the-circle","anathema","toll","fatal-attraction","fortification","knightmare","resurrection","ghostwalk","earthquake","fanatic","hostage","breakthrough","treason","pacifism","confabulation","plots-within-plots","man-of-straw","mystic-shield","passing-in-the-night","rebirth","fireball","long-jump","tournament","holy-war","abduction","irresistible-force","masquerade"],"black":["man-trap","no-quarter","vulture","heresy","holy-war","guardian","onslaught","toll","cathedral","fatal-attraction","revenge","doppelganger","betrayal","winged-victory","blessing","man-of-straw","vendetta","siege","pacifism","evil-eye","evangelists","forced-march","legacy","resurrection","truce","assassin","riposte","dubbing","fanatic","crab","tournament","hostage","haunting-memories","chaos","split-knight","dark-mirror","forbidden-city","mystic-shield","masquerade","fog-of-war","think-again","neutrality","squaring-the-circle","irresistible-force","anathema","bombard","long-jump","lost-castle","bog","madman","hidden-passage","annexation","under-elf-hill","earthquake","charge","coup","rebirth","crusade","knightmare","sanctuary","passing-in-the-night","treason","cowardice","ghostwalk","doomsayer","disintegration","confabulation","panic","holy-quest","merciless","fireball","figure-dance","peace-talks","dungeon","curse"]}}
```

## Accepted action sequence

Every listed action returned success. `end` means `{type:"endTurn"}`; coordinate pairs mean `{type:"move",from,to}`. Card rows provide exact card instance and target; omitted target means no target property.

```text
01 d2-d3
02 end
03 d7-d5
04 playCard challenge black-hand-2-challenge target="g1"
05 end
06 g1-f3
07 end
08 d8-d6
09 end
10 c1-g5
11 end
12 h7-h5
13 end
14 f3-d4
15 end
16 d6-c6
17 end
18 d4-b5
19 end
20 g7-g6
21 end
22 b5-d6
23 playCard man-trap white-hand-3-man-trap target="e2"
24 end
25 e7-e5
26 playCard fortification black-hand-0-fortification target={"from":"c8","to":"d8"}
27 playCard vulture white-hand-2-vulture
28 e8-d8
29 end
30 d6-f7
31 end
32 b8-a6
33 playCard man-trap black-deck-0-man-trap target="c8"
34 d8-e8
35 end
36 h2-h3
37 end
38 playCard plots-within-plots black-hand-4-plots-within-plots target={"player":"black"}
39 c6-d7
40 end
41 b2-b4
42 end
43 d7-g4
44 end
```

Sampled cards/counts: fortification 3, peace-talks 4, challenge 1, breakthrough 4, crab 3, man-trap 6, vulture 3, panic 1, plots-within-plots 1, abduction 1. Played cards: Challenge, Man-Trap twice, Fortification, Vulture, Plots Within Plots.

Final FEN: `rnb1kbnr/ppp1pN2/6p1/3p2Bp/1P4q1/3P3P/P1P1PPP1/RN1QKB1R w KQ - 1 10`.

## Independent post-run semantic review (exactly three selected card rows)

These expectations were derived after execution; the earlier predictions were structural only.

1. **Challenge, step 4 — consistent.** `cards.md` Challenge and rules §18.2 require a movable enemy non-King/non-Queen and force its use next turn. Before/after FEN was `rnbqkbnr/ppp1pppp/8/3p4/8/3P4/PPP1PPPP/RNBQKBNR w KQkq - 0 2`. White's g1 Knight can legally move to f3 or h3. The action preserved board and Black afterMove status, set Black card allowance to 1, and added `{type:"challenge",owner:"black",player:"white",pieceId:"white-knight-g1"}`. Challenge entered Black discard; the hand drew Man-Trap, deck 75→74. Step 6 actually moved that Knight g1-f3, satisfying the obligation. Refusal/lost-turn behavior was not exercised.

2. **Man-Trap, step 23 — consistent placement; trigger untested.** `cards.md` Man-Trap and rules §19.1 require a currently friendly occupied square and delayed capture of an opposing non-King ending there. White pawn e2 occupies the target in unchanged before/after FEN `rnb1kbnr/ppp1pp2/2qN2p1/3p2Bp/8/3P4/PPP1PPPP/RN1QKB1R b KQkq - 1 6`. No pieces changed. The retained effect was `{type:"man-trap",owner:"white",card:{id:"white-hand-3-man-trap",cardId:"man-trap"},square:"e2"}`. White afterMove card allowance became 1, Man-Trap left hand without entering discard, Bombard replaced it, deck 75→74. No enemy subsequently landed e2, so capture and King immunity were not verified.

3. **Fortification, step 26 — failed rescue, no confirmed defect.** `cards.md` Fortification and rules §14.4 expressly allow Knight jumps through walls; §11.6 forbids ending the turn in self-check. Before FEN `rnb1kbnr/ppp2p2/2qN2p1/3pp1Bp/8/3P4/PPP1PPPP/RN1QKB1R w KQkq e6 0 7` has White Knight d6 attacking Black King e8. The previous e7-e5 move did not answer that attack. A c8/d8 boundary cannot stop d6-e8 Knight geometry. Actual event was `cardFizzled` with reason `SELF_CHECK`, no wall, Fortification spent/discarded and No Quarter drawn (deck 74→73). The pawn reverted e5→e7 and turn reverted Black afterMove→beforeMove with card allowance 1; after FEN `rnb1kbnr/ppp1pp2/2qN2p1/3p2Bp/8/3P4/PPP1PPPP/RN1QKB1R b KQkq - 1 6`. Step 28 then answered check with King e8-d8. The local rule explicitly discusses move rollback for a canceled saving card, but does not spell out this ineffective Continuing Effect rescue path equally precisely. The observed rollback permits a legal replacement and was not classified as a confirmed mismatch; no successful wall-crossing behavior was tested.

## Limitations

One finite 20-move house-variant game is not universal correctness evidence. Only the three selected card transitions received independent semantic review; helper digests are not a card oracle. Rejected attempts were not counted or independently reviewed. No reproduction or rerun was performed. The 15-second game budget and 80-action bound were met; the whole agent phase exceeded the 45-second completion target during source review and report writing. Two broad-term searches within the explicitly named rules/audit files produced truncated auxiliary output; the complete game output and the three selected card rows were not truncated, and relevant rule sections were read in bounded follow-up excerpts.

GAME_099_DONE
