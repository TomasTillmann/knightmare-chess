# Game 079: Fireball and Confabulation

Pre-action hypothesis: a Fireball centered on a piece that just moved quietly captures both physical components of an adjacent Confabulation composite, expires the composite effect, and leaves an adjacent protected king unharmed. I will create the composite using the actual card before attempting the explosion.

Scaffold: executed, four probes, zero findings.
Replacement audit hypothesis: a Fireball explosion adjacent to a real Confabulation composite captures both component pieces, expires the composite effect, and leaves adjacent royal pieces unaffected. The predecessor was aborted before executing any game; this attempt will use one saved-fixture game with explicit preaction predictions.

## Executed replacement game

Rule grounds: `cards.md` Confabulation allows a legal move merging two non-Kings; the merged piece is affected as either component. Fireball follows a move without opposing capture, captures the center and all adjacent pieces, and excludes Kings. Catalog timings verified: Confabulation beforeMove; Fireball afterMove.

Saved-fixture scaffold executed first: `SCAFFOLD_OK probes=4 findings=0`. One independent game, created exactly once with these options:

```json
{"fen":"7k/8/8/4p3/3R4/4K3/2N5/8 w - - 0 1","hands":{"white":["confabulation"],"black":["fireball"]},"decks":{"white":[],"black":[]}}
```

Initial `checkState` passed, both Kings unchecked, White beforeMove with moveMade false and both cardPlays zero. `checkState` also passed after every action. Predictions below were printed before each action.

| # | Exact action | Preaction prediction | Actual |
|---|---|---|---|
| 1 | `{"type":"playCard","cardId":"confabulation","target":[{"from":"c2","to":"d4"}]}` | Knight merges into rook d4, creates one effect, consumes White move | Accepted; White afterMove; effect pieceIds `["white-rook-d4","white-knight-c2"]` |
| 2 | `{"type":"endTurn"}` | Black beforeMove | Accepted; Black beforeMove, cardPlays reset |
| 3 | `{"type":"move","from":"e5","to":"e4"}` | Quiet pawn move centers blast beside composite d4 and King e3 | Accepted; Black afterMove; history `{type:"move",from:"e5",to:"e4"}` without capture |
| 4 | `{"type":"playCard","cardId":"fireball","target":"e4"}` | Both composite components and pawn captured, composite expires, King e3 survives | Accepted; capturedIds `["white-rook-d4","white-knight-c2","black-pawn-e5"]`; effects `[]` |

Actual target enumeration before action 1: `[[{"from":"c2","to":"d4"}]]`; selected the returned target. Actual Black legal destinations before action 3: `[["e5",["d4","e4"]],["h8",["g7","h7","g8"]]]`; selected quiet e4. Actual Fireball targets after that move: `["e4"]`; selected returned e4.

Final state: white knight c2, white rook d4, and black pawn e5 each have square null, zone captured, capturedBy black. White royal King remains on e3; Black royal King remains on h8. No continuing effects, outcome null. Explicit semantic check found zero mismatches.

Counts: one game, four accepted actions, zero rejected actions, zero findings; measured game wall time 16.624416 ms. Scaffold separately executed four probes with zero findings. No reset or replay. Seeded continuation omitted to keep this assigned composite/explosion path narrow; other colors, blast shapes, and composite-center explosions were not explored. This finite clean path is not proof of general correctness.

GAME_079_DONE
