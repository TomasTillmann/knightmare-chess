# Game 01 — reaction rollback

Scope: one public-API game exercising move cancellation and reaction rollback. No implementation or test changes.

Predictions: a canceled move restores the preceding board; cancellation consumes the reaction card according to its published timing; invalid actions leave their input state unchanged. Exact setup/actions and observed discrepancies will be recorded below.

## Result

**No confirmed engine bug.** One game, 10 accepted actions, 7 rejected probes; all 17 input-immutability and resulting-state invariant checks passed. Parent-provided scaffold passed before the game. Game execution measured 60 ms (Node process 244 ms). The last five attempts were an auditor payload mistake, not an implementation defect; the game was not recreated to correct it.

Authoritative expectations: `rules.md` §§17.1–17.3; matching printed descriptions in `cards.md`.

Exact initial options:

```json
{"fen":"r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1","hands":{"white":["fog-of-war","chaos","plots-within-plots","hidden-passage"],"black":["plots-within-plots","think-again","chaos","fog-of-war"]},"decks":{"white":["peace-talks","think-again"],"black":["peace-talks","knightmare"]}}
```

Exact sequential actions and results:

```json
[
 {"action":{"type":"move","from":"e2","to":"e4"},"ok":true},
 {"action":{"type":"playCard","cardId":"plots-within-plots","target":{"player":"black"}},"ok":true},
 {"action":{"type":"playCard","cardId":"think-again"},"ok":true},
 {"action":{"type":"move","from":"e2","to":"e4"},"ok":false,"error":"ILLEGAL_MOVE"},
 {"action":{"type":"playCard","cardId":"fog-of-war"},"ok":true},
 {"action":{"type":"playCard","cardId":"chaos"},"ok":false,"error":"CARD_ALREADY_PLAYED"},
 {"action":{"type":"endTurn"},"ok":true},
 {"action":{"type":"move","from":"e7","to":"e5"},"ok":true},
 {"action":{"type":"playCard","cardId":"chaos"},"ok":true},
 {"action":{"type":"playCard","cardId":"fog-of-war"},"ok":true},
 {"action":{"type":"endTurn"},"ok":true},
 {"action":{"type":"playCard","cardId":"plots-within-plots"},"ok":true},
 {"action":{"type":"playCard","cardId":"hidden-passage","target":"d3"},"ok":false,"error":"INVALID_TARGET"},
 {"action":{"type":"playCard","cardId":"chaos"},"ok":false,"error":"INVALID_TIMING"},
 {"action":{"type":"playCard","cardId":"hidden-passage","target":"d3"},"ok":false,"error":"INVALID_TARGET"},
 {"action":{"type":"playCard","cardId":"hidden-passage","target":"c3"},"ok":false,"error":"INVALID_TARGET"},
 {"action":{"type":"endTurn"},"ok":false,"error":"INVALID_TIMING"}
]
```

## Predictions versus observations

- Think Again following opponent-owned Plots should restore the initial pawn position, castling rights, clocks, and active White move opportunity while preserving Plots expenditure. Observed exact initial FEN; Black discard `[plots-within-plots, think-again]`; Black play count 2.
- Repeating e2–e4 should be rejected. Observed `Chaos requires a different move.` Input digest and resulting invariants unchanged.
- White Fog countering Black Think Again during White's own turn should restore the independent e2–e4 move and spend both physical reaction cards once. Observed original post-move FEN, White discard `[fog-of-war]`, Black discard unchanged, both relevant play counts retained.
- Black's remaining Plots allowance must not bypass Fog's prohibition against another card. Observed `CARD_ALREADY_PLAYED` for Chaos.
- New Black turn should reset both players' reaction allowances. White Chaos canceled e7–e5; Black Fog restored the exact pre-cancellation FEN including fullmove number 2. Each card appeared once in its owner's discard.
- White's next-turn Plots was accepted, proving prior-turn Fog restrictions did not leak.
- Hidden Passage targets were mistakenly sent as strings even though `cardPlayTargets` returned arrays such as `[{"from":"e1","to":"d3"}]`. The resulting invalid-target errors and dependent stale-window/end-turn errors are correct. They are explicitly excluded from findings.

Coverage limits: directed reactions only; no randomized extension, no actual en-passant capture, promotion, or completed responsible-card return probe in this game. The serializer omitted uncapturable en-passant from FEN, so equality checks here do not establish en-passant capture correctness.

GAME_01_DONE — accepted=10; rejected=7; confirmed_findings=0; invariant_failures=0; game_wall_ms=60.
