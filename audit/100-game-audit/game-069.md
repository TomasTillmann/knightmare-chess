# Game 069 — Crusade followed by Bog

Pre-action hypothesis: a white bishop moving c1-e3 normally and e3-g5 with Crusade, followed immediately by black Bog, should finish on d2: Bog shortens the combined displacement to one step from the turn's starting square. Both cards should be spent. This is a single normal-beforeMove game, with no resets.

Parent-validated scaffold executed successfully: SCAFFOLD_OK probes=4 findings=0.

## Result

One discrepancy: immediately after Crusade, Bog is advertised with its no-target choice but rejected `INVALID_TIMING: Bog must immediately follow your opponent's move.` The bishop remains g5 and Bog remains in black's hand, rather than reaching d2 with both cards spent. This matches the parent's supplied official FAQ interpretation that Crusade's total displacement is shortened to one step from the turn's initial square. The local Crusade text and §21.2 require an immediate extra bishop move; Bog text accepts an opponent bishop displacement of two or more squares. Catalog timing inspected: Crusade `afterMove`, Bog `afterOpponentMove`. No duplicate appears in the prior 2026-09-08 findings; this is related to the current audit's Bog/card-move reaction family (019), now reproduced with Crusade and unambiguous four-square total displacement. Official FAQ text was supplied by the parent, not independently fetched during this bounded game.

## Exact setup and actions

Baseline: `33e03989fab9449d87b857fc5673f67d05841928`.

```json
{"fen":"k7/p7/8/8/8/8/P7/2B4K w - - 0 1","hands":{"white":["crusade"],"black":["bog"]},"decks":{"white":[],"black":[]}}
```

Normal initial turn: white/beforeMove, moveMade false, both card allowances 0. `checkState` passed and neither King was checked. Initial legal destinations: c1→b2,d2,a3,e3,f4,g5,h6; h1→g1,g2,h2; a2→a3,a4.

Each prediction was printed before the action, and `checkState` ran after each. A rejected-action digest check passed.

| # | Exact action | Prediction | Actual |
|---|---|---|---|
|1|`{"type":"move","from":"c1","to":"e3"}`|Accepted quiet bishop move; e3, afterMove.|Accepted. FEN `k7/p7/8/8/8/4B3/P7/7K b - - 1 1`; white remains turn owner, afterMove.|
|2|`{"type":"playCard","cardId":"crusade","target":[{"from":"e3","to":"g5"}]}`|Accepted; bishop g5, Crusade discarded; Bog available.|Accepted. FEN `k7/p7/8/6B1/8/8/P7/7K b - - 1 1`; white allowance 1, black 0.|
|3|`{"type":"playCard","cardId":"bog"}`|Accepted; bishop d2 and both cards discarded.|Rejected INVALID_TIMING with message above; input digest unchanged; bishop g5, Bog in hand.|
|4|`{"type":"endTurn"}`|Accepted turn completion.|Accepted; black/beforeMove; allowances reset to 0. Same FEN.|
|5|`{"type":"move","from":"a7","to":"a5"}`|Enumerated legal ordinary move accepted; invariants retained.|Accepted. FEN `k7/8/8/p5B1/8/8/P7/7K w - - 0 2`; black/afterMove.|
|6|`{"type":"endTurn"}`|Accepted turn completion.|Accepted; white/beforeMove. Same FEN.|
|7|`{"type":"move","from":"h1","to":"g2"}`|Enumerated legal ordinary move accepted; invariants retained.|Accepted. FEN `k7/8/8/p5B1/8/8/P5K1/8 b - - 1 2`; white/afterMove.|

Immediately before action 2, `cardPlayTargets(s,"crusade")` returned arrays `[{from:"e3",to:DEST}]` for DEST, in order: c1,g1,d2,f2,d4,f4,c5,g5,b6,h6,a7. The chosen g5 target came from this list. Immediately before action 3, `cardPlayTargets(s,"bog")` returned `[undefined]` (JSON `[null]`; explicit undefined count 1). The action correctly omitted the target.

Seeded continuation uses `seed=69`, then unsigned `seed = imul(seed,1664525)+1013904223`, selecting `seed % moves.length` from flattened `legalDests`. Before action 5, ordered options: a7-a5,a7-a6,a8-b7,a8-b8; seed 1128756448 selects a7-a5. Before action 7: h1-g1,h1-g2,h1-h2,a2-a3,a2-a4,g5-c1,g5-d2,g5-e3,g5-f4,g5-h4,g5-f6,g5-h6,g5-e7,g5-d8; seed 2306941631 selects h1-g2.

The white bishop preserves ID `white-bishop-c1`, bishop role/originalRole, board zone, and remains unpromoted/nonroyal/nonneutral throughout. White's final discard is `[{"id":"white-hand-0-crusade","cardId":"crusade"}]` and hand empty. Black's final hand is `[{"id":"black-hand-0-bog","cardId":"bog"}]`, discard empty. Decks remain empty throughout.

## Counts and limitations

Scaffold: 4 probes, zero findings. Independent adversarial group: exactly one game, 7 actions (6 accepted, 1 rejected), 1 reported discrepancy. Measured game wall time: 30.009458 ms; shell process wall time 0.052146 seconds. No replay/reset, no code/tests/harness edits or test reads. Agent reporting and rule review exceeded the 45-second target; the bounded game itself completed in 30 ms. No full suite or UI tests ran. Finite path coverage does not prove general correctness; no captures or changes of direction were exercised.

GAME_069_DONE
