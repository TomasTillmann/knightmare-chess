# Game 022: Figure Dance occupied corners

Pre-action hypothesis: Figure Dance moves occupied corners simultaneously, preserving identities, requires promotion declarations for pawns arriving on their promotion rank, and revokes castling rights for relocated original rooks. A real legal move must reach the catalog timing first. Rejected declarations should preserve state. Same-game continuation will verify the resulting position.

Scaffold executed successfully: 4 probes, zero findings.

## Result

No engine finding on this finite path. One game, 11 actions: 10 accepted, 1 rejected. Game execution measured 102 ms (shell process 0.462 s). No temporary harness created. Catalog timing was inspected and actual targets enumerated before the card.

Exact initialization: `createGameState({fen:"p3k2r/8/8/8/8/8/4P3/R3K2P w Qk - 7 1",hands:{white:["figure-dance"]}})`. Default beforeMove phase; initial checkState passed, both kings independently returned not in check. Pawns occupy their first ranks, which Knightmare permits. No setup phase/history/effect mutation.

Rule grounds: cards.md Figure Dance says all corner pieces move counterclockwise simultaneously without captures and last-rank pawns promote; catalog says afterMove. Predicted corner cycle a1→h1→h8→a8→a1. Both rook castling rights must disappear. White h1 pawn and black a8 pawn must become the declared knights. Other identities remain unchanged. The ordinary e2-e3 move resets halfmove 7→0; Figure Dance preserves fullmove 1.

Actual after card: `r3k2N/8/8/8/8/4P3/8/n3K2R b - - 0 1`.

| Identity | Before card | After card | Role / promotion |
|---|---|---|---|
| white-rook-a1 | a1 | h1 | rook / false |
| white-pawn-h1 | h1 | h8 | knight / true |
| black-rook-h8 | h8 | a8 | rook / false |
| black-pawn-a8 | a8 | a1 | knight / true |
| white-king-e1 | e1 | e1 | king / false |
| black-king-e8 | e8 | e8 | king / false |
| white-pawn-e2 | e3 | e3 | pawn / false |

All seven identities remained on board; no captures; rights Qk→none. Card plays white 0→1; phase stayed afterMove. Enumeration returned all 16 combinations of queen/rook/bishop/knight at h8 and a1. Chosen exact returned target: `[{square:"h8",role:"knight"},{square:"a1",role:"knight"}]`.

## Sequential actions

| # | Action | Result | FEN after action |
|---|---|---|---|
| 1 | move e2 e3 | accepted | p3k2r/8/8/8/8/4P3/8/R3K2P b Qk - 0 1 |
| 2 | playCard figure-dance target [] | rejected INVALID_TARGET: Declare every qualifying destination exactly once. Digest unchanged. | same as 1 |
| 3 | playCard figure-dance target both knights above | accepted | r3k2N/8/8/8/8/4P3/8/n3K2R b - - 0 1 |
| 4 | endTurn | accepted | same as 3 |
| 5 | move a8 a3 | accepted | 4k2N/8/8/8/8/r3P3/8/n3K2R w - - 1 2 |
| 6 | endTurn | accepted | same as 5 |
| 7 | move h8 g6 | accepted | 4k3/8/6N1/8/8/r3P3/8/n3K2R b - - 2 2 |
| 8 | endTurn | accepted | same as 7 |
| 9 | move a1 c2 | accepted | 4k3/8/6N1/8/8/r3P3/2n5/4K2R w - - 3 3 |
| 10 | endTurn | accepted | same as 9 |
| 11 | move e1 d1 | accepted | 4k3/8/6N1/8/8/r3P3/2n5/3K3R b - - 4 3 |

Same-game continuation used seed 220908, recurrence `(imul(seed,1664525)+1013904223)>>>0`, selecting index modulo the flattened public legalDests map. Both promoted knights successfully moved as knights. All accepted states passed checkState. Piece identities matched their moves throughout; every endTurn retained board and clocks, fullmove incremented after each black move, and castling rights remained absent.

Limitations/protocol deviations: scaffold was executed in the second tool call immediately after reading protocol, rather than the first call. An overly broad source grep accidentally displayed short matching lines from existing test files; no test files were opened intentionally, edited, or used to derive this game's fixture. This compromises strict test blindness and is disclosed for parent classification. Only knight promotions were played; other choices were enumerated. No engine correctness claim beyond this path.

GAME_022_DONE
