# Game 001 — Assassin and Pacifism

Hypothesis before play, corrected after reading cards.md: Assassin captures one's own piece, and must not capture a Pacifism-protected piece or a royal piece; an unprotected own piece remains eligible. Parent scaffold executed successfully (three invalid-action rejection and immutability checks).

## Executed one game

Initial options: `{"fen":"r6k/8/8/8/8/8/1BP5/1R1N3K w - - 0 1","hands":{"white":["pacifism","assassin"]}}`.

Predictions were printed before each result. Actions 1–5 accepted as expected:

1. `{"type":"playCard","cardId":"pacifism","target":"b2"}` — bishop cannot capture or be captured.
2. `{"type":"move","from":"c2","to":"c3"}` — ordinary pawn move.
3. `{"type":"endTurn"}`.
4. `{"type":"move","from":"h8","to":"g8"}` — safe king move.
5. `{"type":"endTurn"}`.

`cardPlayTargets(state,"assassin")` returned `[[{"from":"b1","to":"d1"}],[{"from":"d1","to":"c3"}]]`. This independently supports exclusion of the protected bishop both as attacker and victim.

Actions 6–9 attempted Assassin with object targets `{from,to}`: b1→b2 (predicted protected-victim rejection), b2→c3 (predicted protected-attacker rejection), d1→h1 (predicted royal-victim rejection), and b1→d1 (predicted acceptance). All rejected with `INVALID_TARGET: Choose one piece to capture another piece you control.` These were malformed targets: the API requires the array shape shown by cardPlayTargets. Therefore none establishes an engine bug or validates the intended rejection reason. The royal example additionally used non-knight geometry.

All nine actions preserved their input digest; `checkState` passed after every action. Pacifism persisted on the bishop, all seven physical pieces remained on board, and White retained its move/card allowance after the malformed actions. Rules: cards.md Assassin and Pacifism; rules.md §16.1.

Attempted seeded continuation (seed 1001) failed before another action because the probe treated `legalDests` as an array (`.map is not a function`). This is an audit-script error, not an engine finding. No replay or new game was started.

## Result

Zero confirmed findings; incomplete capture-combination coverage. Nine game actions (five accepted, four malformed rejected), plus three scaffold probes. Runtime of game command: 0.074 seconds; total phase approximately 45 seconds. No temporary harness files or code/test changes. No existing finding duplicated.

GAME_001_DONE
