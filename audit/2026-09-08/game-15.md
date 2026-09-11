# Game 15 audit

Prediction before play: ordinary legal moves preserve royal pieces and agree with the chessops oracle; every resulting state has unique piece/card zones and a FEN matching its board, and candidate evaluation does not mutate its input. Seed 9081501; at most 60 regular moves; one game only. Card transitions will be compared with their written rules after execution.

## Result

GAME_15_DONE. One game, seed `9081501`, requested limit 60 regular moves, completed 60 regular moves and 139 total actions, including 12 card attempts. Runtime reported by the game: 3599.354 ms. No generator failure and no confirmed rules discrepancy found in the six independently reviewed transitions below. This bounded sample does not establish correctness of all combinations.

The separate pre-game scaffold printed `SCAFFOLD_OK`: the existing Plots rescue fixture passed `checkState`, invalid `z9 -> a1` was rejected, and its input digest remained unchanged. No fixture game was played. The only random-game call was `generateTrace(9081501, 60, callback)`; the callback imposed a 25-second budget. No production, test, or harness file was read or edited by this agent; it read `cards.md` and relevant `rules.md` sections only.

Initial hands: White `toll, curse, pacifism, bog, assassin`; Black `winged-victory, man-of-straw, toll, ghostwalk, siege`. The seed reproduces generated deck order. Final FEN: `nrb1b2R/p2p3P/2p5/2P1p3/2r5/Qp6/PP2K2k/RNB4N b - - 1 34`.

## Independent card review

1. Step 36, Ghostwalk, Black `e7 -> e6`. Expected a noncapturing pawn move to the empty square, preserving identity and the existing Pacifism effect; consume Black's replacement move. Observed exactly that, a pawn halfmove reset, fullmove 9 to 10, one discard and one draw. No intervening piece is required by the printed Ghostwalk text, so using it for this ordinary displacement is valid.
2. Step 40, Winged Victory, captured `black-pawn-f7` returned to `e4`. Expected the opponent-captured pawn to return on an empty central square. The pawn was captured by White, `e4` was empty, and the same physical ID returned to the board. No other piece or continuing effect changed; the card was spent and replaced once. Matches the printed rule.
3. Step 79, Assassin, White King `e2 -> f1`, capturing its own Bishop. Expected the King to survive on `f1` and the friendly Bishop to enter captured, not dead, status. Observed `white-king-e1` preserved as royal and `white-bishop-f1` captured by White; no other piece changed. The printed restriction concerns whose piece is captured and does not prohibit the King from being the attacker. `f1` is not attacked in the resulting shown position. Replacement move consumed, card spent and replaced once.
4. Step 102, Dungeon, White Rook `h1 -> h8` during Black's after-move phase. Expected arbitrary relocation to an empty corner despite intervening pieces, preservation of identity and clocks, and a temporary White movement ban. Observed precisely that: the h-file path containing White's `h4` pawn is irrelevant under rule §18.3; the rook retained its ID and `dungeon` named that ID and White. FEN clocks stayed `2 26`, Black remained afterMove, and the card was discarded. The trace's later card snapshots show the temporary restriction eventually absent, though this compact review did not independently inspect its exact expiration action.
5. Step 115, Toll, White targeting Black pawn `e6`. Expected fizzle: removing that pawn opens Black Rook `e8` against White King `e1` down the otherwise empty e-file. Observed `SELF_CHECK`, unchanged board and effects, White's reaction allowance consumed, and Toll discarded and replaced once. This initially suspicious no-op is correct under §11.6; it is not an ignored legal capture.
6. Step 120, Hidden Passage, Black King `d8 -> h2`. Expected long-range relocation to a different empty safe square, same royal identity, no capture, consumed replacement move, halfmove 1 to 2 and fullmove 29 to 30. Observed all of these. White King `f1`, Knight `g3`, Queen `a3`, and Rooks `a1/h8` do not attack `h2` in the shown position (Black Rook `h4` blocks the h-file); White Bishop `c1` retains Pacifism. The unusual King placement is legal under §22.5.

## Findings

No confirmed engine bug in this game. Coverage was bounded: the oracle/state checks ran inside the supplied generator, while the independent semantic review covered the six actual transitions above. Neither every card transition nor every possible alternative was exhaustively evaluated.
