# Game 071 — Hostage and captured-rook castling rights

Pre-action hypothesis: capturing White's original h1 rook removes kingside castling rights permanently. Returning that rook to h1 through Hostage must not permit White to castle, even with clear and unattacked transit squares. This concerns an actual capture, independently of ambiguous swap-rights interpretations.

Assigned report was absent. Parent-validated scaffold executed: 4 probes, 0 findings. One sparse normal-beforeMove game will establish the capture and use the enumerated Hostage target at its actual timing, then probe castling.

Concrete pre-action prediction: Black's bishop g2 can capture White's original h1 rook using Evil Eye beforeMove. Hostage immediately places that rook on h2 by sacrificing the original pawn there. White then returns the rook h2–h1 by a regular move; Black clears the bishop g2–b7, leaving e1/f1/g1 unattacked. Both e1–g1 and e1–h1 castling encodings must reject. Capture, Hostage placement, and subsequent movement must all retain absent kingside rights. No swaps are involved. Hostage itself returns to h2, so the final return to h1 exercises ordinary movement as well.

## Executed game

Baseline: `33e03989fab9449d87b857fc5673f67d05841928`. Exact initial options:

```json
{"fen":"k7/8/8/8/8/8/6bP/4K2R b K - 0 1","hands":{"white":["hostage"],"black":["evil-eye"]},"decks":{"white":[],"black":[]}}
```

Normal beforeMove initialization; checkState passed; both Kings initially not in check. No override of phase, moveMade, or card allowance. Exactly one createGameState call. Relevant rule grounds: cards.md Hostage and Evil Eye; catalog Evil Eye beforeMove and Hostage afterOpponentCard/afterOpponentMove; rules.md §22.11 requires an immediate capture response, substitute Pawn capture, preserved physical identity, and explicitly says never to restore castling rights lost in the original capture. No prior finding in audit/2026-09-08/README.md matches this clean path.

Target enumeration before the cards returned exactly:

```json
{"evilTargets":[{"attacker":"g2","victim":"h1"}]}
{"hostageTargets":[{"pieceId":"white-rook-h1","pawn":"h2"}]}
```

The initial pre-action predictions above were also supplied to the action logger. Sequential public actions and actual results:

| # | Exact action | Result and resulting FEN |
|---|---|---|
| 1 | `{"type":"playCard","cardId":"evil-eye","target":{"attacker":"g2","victim":"h1"}}` | Accepted; original rook id `white-rook-h1` captured, square null; bishop stays g2; `k7/8/8/8/8/8/6bP/4K3 w - - 0 2` |
| 2 | `{"type":"playCard","cardId":"hostage","target":{"pieceId":"white-rook-h1","pawn":"h2"}}` | Accepted immediately while Black remains afterMove/moveMade; same rook id returned h2; pawn `white-pawn-h2` captured; `k7/8/8/8/8/8/6bR/4K3 w - - 0 2` |
| 3 | `{"type":"endTurn"}` | Accepted; White beforeMove; FEN unchanged |
| 4 | `{"type":"move","from":"h2","to":"h1"}` | Accepted; original rook home; `k7/8/8/8/8/8/6b1/4K2R b - - 1 2` |
| 5 | `{"type":"endTurn"}` | Accepted; Black beforeMove; FEN unchanged |
| 6 | `{"type":"move","from":"g2","to":"b7"}` | Accepted; `k7/1b6/8/8/8/8/8/4K2R w - - 2 3` |
| 7 | `{"type":"endTurn"}` | Accepted; White beforeMove; FEN unchanged |
| 8 | `{"type":"move","from":"e1","to":"g1"}` | Rejected `ILLEGAL_MOVE`: `That is not a legal chess move.`; digest unchanged |
| 9 | `{"type":"move","from":"e1","to":"h1"}` | Rejected same error; digest unchanged |
| 10 | `{"type":"move","from":"h1","to":"h8"}` | Accepted seeded continuation; `k6R/1b6/8/8/8/8/8/4K3 b - - 3 3` |
| 11 | `{"type":"endTurn"}` | Accepted; Black beforeMove; FEN unchanged |
| 12 | `{"type":"move","from":"b7","to":"c8"}` | Accepted seeded continuation, interposing against rook check; `k1b4R/8/8/8/8/8/8/4K3 w - - 4 4` |
| 13 | `{"type":"endTurn"}` | Accepted; White beforeMove; FEN unchanged |

Before action 4, legalDests was `[["e1",["d1","d2","e2","f2"]],["h2",["h1","g2","h3","h4","h5","h6","h7","h8"]]]`. Before action 6 it was `[["g2",["f1","h1","f3","h3","e4","d5","c6","b7"]],["a8",["a7","b7","b8"]]]`.

Before the castle probes, White was not checked and legalDests was `[["e1",["d1","f1","d2","e2","f2"]],["h1",["f1","g1","h2","h3","h4","h5","h6","h7","h8"]]]`. With Black King a8 and Bishop b7, e1/f1/g1 were unattacked and f1/g1 empty. White King remained e1 throughout. The FEN castling field was `K` initially and `-` immediately after original capture, immediately after Hostage, and throughout subsequent actions. Thus capture/Hostage retention was observed independently before the ordinary return move.

Seeded continuation used seed `710908`, `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, selected `moves[seed % moves.length]` from flattened public legalDests, and predicted acceptance before each action. checkState passed at initialization and after every accepted action. Counts: **13 actions: 11 accepted, 2 rejected; 4 scaffold probes; 0 findings**. Measured game execution: **32.379583 ms** (shell command wall time 0.021378542 s reported separately; differing measurement scope). Setup/report preparation exceeded the requested 45-second turnaround; the bounded game itself did not. No temporary harness created, no test sources read, no tests run, no production edits or commits.

Limitations: Hostage returned the rook to h2, and a subsequent regular move returned it to original h1. The final castling rejection alone cannot isolate loss on capture because that regular rook move independently matters; the immediate FEN observations establish that rights were already absent after capture and after Hostage. Direct Hostage placement on original h1 was not exercised. No swap-rights interpretation is assumed. A finite clean path is not proof of general correctness.

GAME_071_DONE
