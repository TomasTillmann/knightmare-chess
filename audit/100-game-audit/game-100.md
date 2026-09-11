# Game 100 audit

Seed: 908100. Status: complete.

Pre-run invariants: one generated game only; no replay or reset; at most 80 actions and 15 seconds; markdown-only writes; independent review of three critical card transitions; no test sources read.

Pre-action hypothesis: every accepted action preserves unique piece/card identities, FEN agreement, one uncaptured royal per color, and input immutability; ordinary moves without variant state agree with chessops. Card-specific semantics will be assessed after generation and explicitly labeled retrospective. First saved-fixture scaffold passed: 4 probes, 0 findings.

Baseline: `33e03989fab9449d87b857fc5673f67d05841928`. Exactly one `generateTrace(908100, 20, progress)` call; no replay, reset, or second game. Callback rejected further work at 80 actions or 15 seconds. Completed 42 accepted actions / 20 Regular Moves in 725.043 ms. No helper failure or structural/ordinary-chess invariant finding. Candidate rejection count is unavailable from this helper (not zero). Both pre/post saved-fixture scaffolds passed, 4 probes each / 0 findings.

Exact initial options (standard board and normal beforeMove defaults; catalog-wide shuffled house-variant decks under rules §4.3):

```json
{"hands":{"white":["think-again","coup","split-knight","evangelists","haunting-memories"],"black":["breakthrough","fatal-attraction","holy-war","resurrection","hidden-passage"]},"decks":{"white":["peace-talks","dubbing","holy-war","plots-within-plots","long-jump","confabulation","doppelganger","no-quarter","resurrection","curse","crab","dungeon","vulture","crusade","bombard","siege","betrayal","challenge","figure-dance","cowardice","breakthrough","fatal-attraction","pacifism","masquerade","sanctuary","ghostwalk","annexation","evil-eye","fireball","tournament","merciless","charge","disintegration","toll","bog","chaos","fortification","vendetta","blessing","irresistible-force","earthquake","panic","hostage","riposte","revenge","truce","neutrality","man-of-straw","squaring-the-circle","forced-march","winged-victory","madman","fanatic","assassin","legacy","knightmare","rebirth","hidden-passage","forbidden-city","dark-mirror","doomsayer","passing-in-the-night","holy-quest","onslaught","man-trap","lost-castle","abduction","fog-of-war","mystic-shield","guardian","under-elf-hill","treason","cathedral","heresy","anathema"],"black":["curse","forced-march","dubbing","irresistible-force","revenge","toll","split-knight","doppelganger","crusade","fanatic","under-elf-hill","chaos","fortification","fog-of-war","long-jump","man-of-straw","bombard","merciless","tournament","betrayal","no-quarter","cathedral","masquerade","confabulation","hostage","dungeon","peace-talks","heresy","fireball","forbidden-city","siege","vendetta","neutrality","charge","earthquake","passing-in-the-night","madman","winged-victory","man-trap","knightmare","anathema","legacy","disintegration","truce","evil-eye","coup","panic","crab","guardian","treason","holy-quest","evangelists","onslaught","lost-castle","figure-dance","abduction","pacifism","bog","haunting-memories","rebirth","assassin","squaring-the-circle","ghostwalk","vulture","sanctuary","think-again","challenge","doomsayer","annexation","cowardice","dark-mirror","plots-within-plots","mystic-shield","blessing","riposte"]}}
```

Exact sequential accepted actions below. `move a–b` means `{type:"move",from:"a",to:"b"}`; `endTurn` means `{type:"endTurn"}`. No action included a promotion choice.

| Step | Action | Result |
| --- | --- | --- |
| 1 | move e2–e4 | accepted |
| 2 | playCard coup, cardInstanceId white-hand-1-coup, target "f2" | accepted |
| 3 | endTurn | accepted |
| 4 | move e7–e6 | accepted |
| 5 | endTurn | accepted |
| 6 | move f2–f3 | accepted |
| 7 | playCard peace-talks, cardInstanceId white-deck-0-peace-talks, target "white-hand-1-coup" | accepted |
| 8 | endTurn | accepted |
| 9 | move g8–e7 | accepted |
| 10 | endTurn | accepted |
| 11 | move f1–d3 | accepted |
| 12 | endTurn | accepted |
| 13 | move f7–f5 | accepted |
| 14 | endTurn | accepted |
| 15 | move d3–c4 | accepted |
| 16 | endTurn | accepted |
| 17 | move g7–g5 | accepted |
| 18 | endTurn | accepted |
| 19 | move g2–g4 | accepted |
| 20 | endTurn | accepted |
| 21 | move b8–c6 | accepted |
| 22 | endTurn | accepted |
| 23 | move c4–b3 | accepted |
| 24 | endTurn | accepted |
| 25 | move c6–b4 | accepted |
| 26 | endTurn | accepted |
| 27 | move f3–f4 | accepted |
| 28 | endTurn | accepted |
| 29 | move b4–c6 | accepted |
| 30 | endTurn | accepted |
| 31 | move e1–f1 | accepted |
| 32 | endTurn | accepted |
| 33 | move c6–a5 | accepted |
| 34 | endTurn | accepted |
| 35 | move b3–d5 | accepted |
| 36 | endTurn | accepted |
| 37 | move b7–b6 | accepted |
| 38 | endTurn | accepted |
| 39 | move f1–g2 | accepted |
| 40 | endTurn | accepted |
| 41 | move e7–c6 | accepted |
| 42 | endTurn | accepted |

Final FEN: `r1bqkb1r/p1pp3p/1pn1p3/n2B1pp1/4PPP1/8/PPPP2KP/RNBQ2NR w kq - 2 11`. Final digest: `1e46a0074f62058da28b5d2be859b43f1bbfc18e6a5df7b9d5562ec900ab776e`.

Sampled cards/counts: coup 1, holy-war 4, breakthrough 1, peace-talks 1, fatal-attraction 1, split-knight 2, resurrection 5, hidden-passage 6, haunting-memories 3, dubbing 1, think-again 1, evangelists 1. Only Coup and Peace Talks were played; sampling alone is not semantic coverage.

Independent retrospective review (three critical transitions, only two card-play rows existed):

1. **Step 2, Coup — cards.md “Coup”, rules §15.3, catalog afterMove/continuing.** Expected: original e1 King becomes capturable Prince; eligible f2 Pawn keeps pawn movement and becomes royal; no piece movement. Actual selected row: `white-king-e1.royal true→false`, `white-pawn-f2.royal false→true`, both roles/squares unchanged. Coup effect records princeId/kingId accordingly. Before/after FEN both `rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1`. Turn remains white/afterMove/moveMade true, white card allowance 0→1. Coup is retained, not discarded; Peace Talks drawn, deck 75→74. Matches reviewed rule and accounting (§9).
2. **Step 6, royal pawn f2–f3 — cards.md “Coup”, rules §15.3.** Expected: replacement King retains standard pawn move; f3 is vacant and unattacked by Black after only e7–e6. Actual accepted move f2–f3; step 7 before-state explicitly has `white-pawn-f2` at f3, role pawn, royal true, and original e1 King royal false. This verifies normal forward pawn motion while royal. Evidence is reconstructed from the accepted action and adjacent retained card row; the full step 6 review row was not retained. No capture or threatened royal square occurred; no claim about diagonal capture, promotion, or check escape.
3. **Step 7, Peace Talks cancels Coup — cards.md “Peace Talks”, rules §§15.3 and 22.6, catalog afterMove.** Expected: eligible Continuing Effect discarded, original King restored because Prince remains on board; replacement Pawn loses royalty at its current square. Actual: Coup effect removed; e1 King royal false→true, f3 Pawn true→false; neither moved. Before/after FEN both `rnbqkbnr/pppp1ppp/4p3/8/4P3/5P2/PPPP2PP/RNBQKBNR b kq - 0 2`. White afterMove preserved, allowance 0→1; discard `[peace-talks,coup]`, replacement Dubbing, deck 74→73. No newly exposed check apparent. This does not exercise the prior Prince-lost/Confabulation cancellation defect and is not new evidence for that finding.

Limitations: bounded finite path, no universal correctness claim; two card plays means three independent card-play rows were unavailable. No artwork images or tests inspected. Generator validates structure after accepted transitions, not initial checkState explicitly before its first action; standard initial setup used. All critical card reasoning is retrospective, only general invariants were predicted. Game execution met its 15-second budget; report completion exceeded the 45-second turnaround target. No temporary harnesses created, no production/tests edited, no second game or replay.

GAME_100_DONE
