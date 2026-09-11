# Game 094 — seed 908094

## Pre-run invariants and hypothesis

- Every recorded action must be legal in its pre-action state.
- Card effects must respect ownership, movement restrictions, and turn boundaries.
- Piece identities and locations must remain consistent after moves, captures, and card effects.
- Hypothesis: one seeded random game will preserve these invariants; an action or time bound is a partial run, not a defect.

## Execution and limitations

Exactly one `generateTrace(908094, 20, progress)` call; no reset or replay. Every callback ran `checkState`, with stops at 80 accepted actions or 15,000 ms. The helper returned normally after 20 regular moves. Last callback: 50 accepted actions, 20 moves, 7,497 ms; final action was turn closure (51 accepted actions total). No invariant failure was printed. Candidate rejection counts are not exposed by the helper and were not measured. Saved-fixture scaffold ran before and after: four probes, zero findings each (eight total).

**Evidence limitation:** the completed command emitted more output than the orchestration response retained. All callback summaries survived, but part of the final trace/review, sampled-card counts, and final elapsed-time line were truncated. This report does not claim a complete exact trace: action 41's payload is unavailable. No game was rerun to repair logging. The exact last measured game time is 7,497 ms, not an asserted total wall time. Report preparation exceeded the 45-second target. First scaffold was executed immediately after protocol reading; its assignment-relative 15-second timing was not separately measured.

## Exact initial options

Default standard board and normal beforeMove phase; no setup overrides. Initial state passed callback `checkState` before any action. Options:

```json
{"hands":{"white":["siege","plots-within-plots","merciless","riposte","passing-in-the-night"],"black":["lost-castle","siege","confabulation","ghostwalk","toll"]},"decks":{"white":["disintegration","legacy","man-trap","tournament","truce","curse","fortification","fireball","revenge","no-quarter","irresistible-force","blessing","bog","forced-march","confabulation","holy-war","breakthrough","betrayal","bombard","masquerade","ghostwalk","fog-of-war","evil-eye","doppelganger","fatal-attraction","winged-victory","chaos","charge","neutrality","fanatic","toll","challenge","think-again","onslaught","forbidden-city","dungeon","long-jump","abduction","haunting-memories","holy-quest","guardian","heresy","assassin","rebirth","earthquake","sanctuary","cathedral","squaring-the-circle","doomsayer","vulture","resurrection","split-knight","under-elf-hill","crusade","treason","anathema","peace-talks","hostage","dark-mirror","knightmare","lost-castle","pacifism","madman","mystic-shield","crab","dubbing","evangelists","coup","figure-dance","man-of-straw","panic","annexation","vendetta","cowardice","hidden-passage"],"black":["legacy","fog-of-war","doomsayer","madman","chaos","no-quarter","cathedral","neutrality","man-trap","think-again","fireball","heresy","onslaught","forbidden-city","disintegration","winged-victory","forced-march","masquerade","sanctuary","evangelists","abduction","merciless","riposte","squaring-the-circle","bog","dubbing","pacifism","breakthrough","coup","truce","earthquake","split-knight","man-of-straw","curse","fatal-attraction","resurrection","passing-in-the-night","hidden-passage","fortification","vendetta","evil-eye","rebirth","long-jump","irresistible-force","anathema","cowardice","dark-mirror","vulture","crusade","blessing","holy-war","knightmare","tournament","betrayal","plots-within-plots","revenge","mystic-shield","figure-dance","haunting-memories","fanatic","holy-quest","bombard","doppelganger","under-elf-hill","assassin","panic","charge","annexation","peace-talks","treason","crab","guardian","challenge","hostage","dungeon"]}}
```

## Sequential accepted-action evidence

Each listed action was accepted. `endTurn` rows preserve the immediately preceding board. Card instance IDs follow the exact initial hand/deck position indicated below. All moves are unpromoted unless explicitly indicated.

| Step | Action / target | Observed result |
|---:|---|---|
| 1 | move g2–g4 | White Pawn g4 |
| 2 | endTurn | Black turn |
| 3 | move b8–a6 | Black Knight a6 |
| 4 | endTurn | White turn |
| 5 | playCard passing-in-the-night, white-hand-4-passing-in-the-night, `[{"from":"b2","to":"g7"},{"from":"g4","to":"a7"}]` | Four Pawns swap; move consumed |
| 6 | endTurn | Black turn |
| 7 | move b7–b6 | Black Pawn b6 |
| 8 | playCard plots-within-plots, white-hand-1-plots-within-plots, `{"player":"white"}` | White reaction, board unchanged |
| 9 | endTurn | White turn |
| 10 | move b1–c3 | White Knight c3 |
| 11 | endTurn | Black turn |
| 12 | playCard confabulation, black-hand-2-confabulation, `[{"from":"h8","to":"g8"}]` | Rook joins Knight; h8 empty; Black kingside right removed |
| 13 | endTurn | White turn |
| 14 | move a1–b1 | White Rook b1; queenside right removed |
| 15 | endTurn | Black turn |
| 16 | move e7–e5 | Black Pawn e5 |
| 17 | endTurn | White turn |
| 18 | move d2–d3 | White Pawn d3 |
| 19 | endTurn | Black turn |
| 20 | move a8–a7 | Captures white-pawn-g2 |
| 21 | endTurn | White turn |
| 22 | move c3–b5 | White Knight b5 |
| 23 | endTurn | Black turn |
| 24 | move f8–e7 | Black Bishop e7 |
| 25 | endTurn | White turn |
| 26 | playCard disintegration, white-deck-0-disintegration, `"c2"` | c2 Pawn disappears; regular move remains |
| 27 | move b5–a7 | Captures black-rook-a8 |
| 28 | endTurn | Black turn |
| 29 | move b2–c1, promotion queen | Captures white-bishop-c1; Black Queen c1 |
| 30 | endTurn | White turn |
| 31 | move h2–h3 | White Pawn h3 |
| 32 | endTurn | Black turn |
| 33 | playCard lost-castle, black-hand-0-lost-castle, `{"own":"g8","opponent":"h1"}` | SELF_CHECK fizzle; board restored; move consumed |
| 34 | endTurn | White turn |
| 35 | move b1–a1 | White Rook a1 |
| 36 | playCard man-trap, white-deck-2-man-trap, `"e2"` | Board unchanged |
| 37 | playCard fog-of-war, black-deck-1-fog-of-war, no target | Cancels immediately preceding Man-Trap; board unchanged |
| 38 | endTurn | Black turn |
| 39 | move e8–f8 | Black King f8 |
| 40 | playCard doomsayer | Immediate choice opened; board unchanged |
| 41 | Doomsayer choice, exact action payload lost to output truncation | Doomsayer SELF_CHECK fizzle; King move undone to e8; Black gets replacement move |
| 42 | move e7–g5 | Black Bishop g5 |
| 43 | endTurn | White turn |
| 44 | move h3–g4 | Captures black-pawn-a7 |
| 45 | endTurn | Black turn |
| 46 | move g8–f6 | Confabulated Rook/Knight uses Knight movement |
| 47 | endTurn | White turn |
| 48 | move f2–f3 | White Pawn f3 |
| 49 | endTurn | Black turn |
| 50 | move f6–f4 | Confabulated Rook/Knight uses Rook movement |
| 51 | endTurn | Helper completes at move bound |

Final observed FEN (step 50, unchanged by closing turn): `2bqk3/N1pp1pPp/np6/4p1b1/5nP1/3P1P2/P3P3/R1qQKBNR w K - 1 12`.

Played cards: Passing in the Night, Plots Within Plots, Confabulation, Disintegration, Lost Castle (fizzled), Man-Trap (countered), Fog of War, Doomsayer (fizzled): eight plays/eight distinct names. Sampled-but-unplayed names and sample counts were emitted but lost in output truncation; coverage is unmeasured for those candidates.

## Independent post-run critical reviews

These are post-run semantic reviews, separate from the pre-run structural predictions and automatic digest checks.

1. **Passing in the Night — cards.md “Passing in the Night”; rules §20 Pawn-swap paragraph and §6 Swap.** Before step 5: White Pawns b2/g4; Black Pawns g7/a7. Expected simultaneous exchange with ownership unchanged, no captures, and replacement of the Regular Move. Observed FEN changed from `r1bqkbnr/pppppppp/n7/8/6P1/8/PPPPPP1P/RNBQKBNR w KQkq - 1 2` to `r1bqkbnr/PpppppPp/n7/8/6p1/8/PpPPPP1P/RNBQKBNR b KQkq - 0 2`. The later a8–a7 capture identifies the relocated white-pawn-g2, and b2–c1 promotes the relocated Black Pawn. Positions, retained ownership, identity continuity, and consumed move agree.

2. **Confabulation — cards.md “Confabulation”; rules §15.4.** At step 12 Black Rook h8 can move horizontally onto its own Knight g8; neither is royal. Expected one occupied square whose piece has both movement types. Observed h8 becomes empty while g8 remains occupied; later g8–f6 uses the Knight vector, and f6–f4 uses the Rook vector through empty f5. The latter would be illegal for an ordinary Knight. These independent geometry checks support the union-of-movement behavior. Capturing/rescuing the composite was not covered.

3. **Lost Castle fizzle — cards.md “Lost Castle”; rules §20 Lost Castle and §11.6.** Before step 33 Black King e8, own Rook/Knight g8, White Rook h1, and f8 empty. Swapping g8 and h1 would place a White Rook on g8 with an unobstructed g8–f8–e8 attack on Black's King. Expected SELF_CHECK fizzle with board restored and replacement move consumed because the initial King was safe. Observed board stayed `2bqk1n1/N1ppbpPp/np6/4p3/6p1/3P3P/P3PP2/1RqQKBNR`, history reports SELF_CHECK, FEN advances from Black `... b K - 0 8` to White `... w K - 1 9`, followed by accepted endTurn. Matches.

No confirmed engine finding from retained evidence. Doomsayer's step 41 is not independently adjudicated because its exact choice payload was lost; the rollback is an explicit coverage gap. This finite path and structural checks do not prove card correctness. Audit evidence completeness failed despite completion of the single bounded game.

GAME_094_DONE
