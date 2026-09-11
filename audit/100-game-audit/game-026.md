# Game 026 — Anathema with identity-bound Curse

Pre-action hypothesis: Curse remains attached to the enemy rook identity when Anathema exchanges it with an enemy bishop; the exchange captures neither piece and removes the exchanged home rook's castling eligibility. After the exchange, Curse still limits that rook to two squares. A normal beforeMove position and public actions will establish timing.

Parent scaffold executed: SCAFFOLD_OK probes=4 findings=0.

## Exact setup and evidence

Options: `{"fen":"2b1k2r/p7/8/8/8/8/P7/4K3 w k - 0 1","hands":{"white":["curse","anathema"]}}`. No overrides to phase, moveMade, effects, history or pieces. Initial checkState passed; both kings independently not in check. Initial legalDests: e1→d1,f1,d2,e2,f2; a2→a3,a4.

Rules grounds: cards.md Anathema swaps an opposing Bishop and Rook; Curse limits the selected opposing Queen/Bishop/Rook to one or two squares for the rest of the game. Catalog Anathema timing is afterMove. rules.md:646 explicitly states the swap is not a move or capture, and every marker travels with its physical piece. Thus the initial acceptance prediction is supported: a movement-distance restriction should not block this non-move swap.

| # | Exact action | Actual result |
|---|---|---|
| 1 | move a2 a3 | Accepted |
| 2 | playCard curse target="h8" | Accepted; targets immediately before play were ["c8","h8"]; effect pieceId=black-rook-h8 |
| 3 | endTurn | Accepted |
| 4 | move a7 a6 | Accepted |
| 5 | endTurn | Accepted |
| 6 | move a3 a4 | Accepted |
| 7 | playCard anathema target={"bishop":"c8","rook":"h8"} | Rejected ILLEGAL_MOVE, "Curse limits movement to one or two squares." Exact target was the sole cardPlayTargets result. |
| 8 | endTurn | Accepted |
| 9 | move c8 c5 | Rejected ILLEGAL_MOVE, "That is not a legal chess move." Driver continued the planned post-swap rook probe although c8 remained a bishop. |
| 10 | move c8 c6 | Rejected ILLEGAL_MOVE, same reason; inconclusive driver probe |
| 11 | endTurn | Rejected INVALID_TIMING, "Make the regular move before ending the turn." |
| 12 | move c8 b7 | Accepted; seeded continuation |
| 13 | endTurn | Accepted |
| 14 | move e1 d2 | Accepted; seeded continuation |
| 15 | endTurn | Accepted |
| 16 | move e8 f7 | Accepted; seeded continuation |
| 17 | endTurn | Accepted |

Seeded continuation uses seed 26 and `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, choosing `seed % moves.length` from flattened legalDests each turn. No game reset or replay.

Immediately after rejected Anathema, FEN remained `2b1k2r/8/p7/8/P7/8/8/4K3 b k - 0 2`; all six identities remained on board; bishop c8 and rook h8 unchanged, castling k preserved, Curse still bound to black-rook-h8. After endTurn, legalDests included c8→h3,g4,f5,e6,b7,d7; e8→d7,e7,f7,d8,f8,h8,g8; h8→h6,h7,f8,g8; a6→a5. Thus Curse limited the unmoved rook and kingside castling remained available before the King moved. Final FEN `7r/1b3k2/p7/8/P7/8/3K4/8 w - - 3 4`, six board pieces, same Curse identity; castling rights correctly removed after King e8→f7. checkState passed after every accepted action.

## Finding and limits

Confirmed finding: Anathema incorrectly applies Curse's movement-distance restriction to its non-move swap (rules.md:646). cardPlayTargets returned the sole Anathema swap target although applyAction rejected it because the cursed rook displacement exceeded two squares. The planned accepted-swap identity and castling-right probes were not reached; the two c8 rook-style moves and premature endTurn are audit-driver errors, not engine findings. No capture occurred anywhere in this finite path. Dungeon was not exercised. A targeted search of audit/2026-09-08/README.md found no prior Anathema/Curse finding, so this is not identified as a duplicate there.

Executed: four parent scaffold probes; one independent game, 17 public actions, 13 accepted, 4 rejected, three seeded continuation moves. Measured game execution wall time: 37.117875 ms. No temporary harness was created. A finite path is not proof of correctness.

GAME_026_DONE
