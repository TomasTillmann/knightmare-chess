# Game 081 — Legacy after an own-neutral capture

Preaction hypothesis: During White's normal turn, a White rook can capture a White bishop made neutral by Black's Neutrality. White may immediately play Legacy because rule 22.12 does not require an opponent captor, retrieve an earlier discarded Fanatic, and retain its normal post-move turn state. The capture record should name White as capturedBy.

Result: zero findings in one game, 10 accepted actions, zero rejected actions. Parent scaffold executed successfully first: four probes, zero findings. Game execution took 29.565 ms. No reset, replay, test inspection, or harness files.

## Initial setup and rule grounds

Exact createGameState options:

```json
{"fen":"7k/6p1/8/8/8/8/P2B4/K2R4 w - - 0 1","hands":{"white":["fanatic","legacy"],"black":["neutrality"]},"decks":{"white":["panic","peace-talks"],"black":["panic"]}}
```

Normal beforeMove setup; checkState passed and isKingInCheck was false for both colors. Rules §13.4 permits Fanatic a2–a5 with an empty path; §15.1 permits Black's afterMove Neutrality on White's bishop and ends its marker on capture. §22.12 explicitly permits any captor, uses original ownership of neutral victims, retrieves a physical discarded card, and preserves the current turn and board. The relevant catalog and cards.md text were read. Legacy catalog timing labels are opponent-oriented, but the public API correctly accepts the own-turn trigger tested here. Prior audit findings were read; this run produced no duplicate or new finding.

## Exact action sequence

Every action below returned ok:true; checkState passed after each.

| # | Action | Observed result |
|---|---|---|
| 1 | playCard fanatic, target a2 | Pawn a2→a5; White afterMove, moveMade true, allowance 1; Fanatic discarded; drew white-deck-0-panic. |
| 2 | endTurn | Black beforeMove, both allowances 0. |
| 3 | move g7→g6 | Black afterMove, moveMade true. |
| 4 | playCard neutrality, target d2 | White bishop d2 became neutral; Black allowance 1; drew black-deck-0-panic. |
| 5 | endTurn | White beforeMove, both allowances 0. |
| 6 | move d1→d2 | White rook captured its own neutral bishop; White afterMove, allowance 0. |
| 7 | playCard legacy, target white-hand-0-fanatic | Retrieved that exact Fanatic, discarded white-hand-1-legacy, drew white-deck-1-peace-talks; White remained afterMove with moveMade true, allowance became 1. |
| 8 | endTurn | Black beforeMove, both allowances 0. |
| 9 | move g6→g5 | Seeded continuation: Black afterMove. |
| 10 | endTurn | White beforeMove, moveMade false, both allowances 0. |

Target enumeration before play: Fanatic returned `["a1","d1","a2","d2","g7","h8"]`, from which the legal Pawn a2 was selected; Neutrality returned `["d1","a5","d2"]`; Legacy returned exactly `["white-hand-0-fanatic"]`. Black legal destinations before action 3 were g7→g5/g6 and h8→h7/g8. White legalDests explicitly included d1→d2 before action 6. Continuation used seed 81, updated once by `(Math.imul(seed,1664525)+1013904223)>>>0`, selecting modulo the flattened public legal move list.

## Critical expected versus actual evidence

The hypothesis predicted an owned non-Pawn capture by White itself would qualify. Actual victim after action 6 was `{"id":"white-bishop-d2","owner":"white","role":"bishop","originalRole":"bishop","square":null,"zone":"captured","promoted":false,"royal":false,"neutral":false,"capturedBy":"white"}`. Capture attribution therefore names the actual actor, and capture expired Neutrality. Its physical card entered Black's discard. The Legacy capture window was `{"historyLength":4,"pieceIds":["white-bishop-d2"]}`.

Before/after Legacy, a serialized comparison of FEN, pieces, effects, orientation, en-passant and `[turn.color,turn.phase,turn.moveMade]` was identical. FEN stayed `7k/8/6p1/P7/8/8/3R4/K7 b - - 0 2`. White hand became `[white-deck-0-panic, white-hand-0-fanatic, white-deck-1-peace-talks]`; White discard became `[white-hand-1-legacy]`; White deck became empty. Black retained its Panic and discarded Neutrality. The next White turn had allowance 0.

Final FEN: `7k/8/8/P5p1/8/8/3R4/K7 w - - 0 3`.

Limits: one directed game plus one seeded move; no multi-victim composites, transformed Pawns, Plots windows, or invalid Legacy selection tested. Finite clean coverage does not establish universal correctness.

GAME_081_DONE
