# Game 09: Confabulation cancellation

Prediction before play: cancelling Confabulation must not strand a component permanently in the away zone with no effect or pending resolution. I will trace the original knight through Peace Talks and subsequent turns, without assuming an undocumented return square.

## Finding: cancellation strands a physical component in `away`

Confidence: high for the orphan state; exact remedy needs clarification because the rules do not specify a splitting square. No claim is made that the knight must return to b1 or that Resurrection must recover a piece explicitly lost by rule.

Rules §15.4 defines a merged object containing both physical components; §22.6 requires correction of an illegal situation on the owner's next move, or loss of the piece. Peace Talks instead removes the only effect linking the knight to the board rook and leaves the knight in `away` indefinitely across the observed turns. There is no continuing effect or pending resolution. The owner receives no correction mechanism and the component is never classified as lost/captured/dead. Resurrection confirms the knight is unavailable because it is not captured.

Initial options:
```json
{"fen":"4k1n1/8/8/8/8/R7/8/1N2K3 w - - 0 1","hands":{"white":["confabulation","resurrection"],"black":["peace-talks"]}}
```

Exact action trace, in order (`applyAction`; rejected actions leave the input digest unchanged):
```json
{"type":"playCard","cardId":"confabulation","target":[{"from":"b1","to":"a3"}]}
{"type":"endTurn"}
{"type":"move","from":"g8","to":"f6"}
{"type":"playCard","cardId":"peace-talks","target":"white-hand-0-confabulation"}
{"type":"endTurn"}
{"type":"move","from":"b1","to":"c3"}
{"type":"move","from":"a3","to":"a4"}
{"type":"endTurn"}
{"type":"move","from":"f6","to":"g8"}
{"type":"endTurn"}
{"type":"playCard","cardId":"resurrection","target":{"pieceId":"white-knight-b1","to":"b1"}}
```

Only b1-c3 and Resurrection were rejected. The first returns `ILLEGAL_MOVE: There is no movable piece on that square.` The second returns `INVALID_TARGET: Choose a captured physical piece.`

Snapshots:

| Stage | FEN | Effects | Original knight |
| --- | --- | --- | --- |
| Before cancellation | `4k3/8/5n2/8/8/R7/8/4K3 w - - 2 2` | Confabulation, `pieceIds:["white-rook-a3","white-knight-b1"]` | `square:null, zone:away` |
| After cancellation | `4k3/8/5n2/8/8/R7/8/4K3 w - - 2 2` | `[]` | `square:null, zone:away` |
| Next White turn | `4k3/8/5n2/8/8/R7/8/4K3 w - - 2 2` | `[]` | `square:null, zone:away` |
| After owner's a3-a4 move | `4k3/8/5n2/8/R7/8/8/4K3 b - - 3 2` | `[]` | `square:null, zone:away` |
| Later White turn | `4k1n1/8/8/8/R7/8/8/4K3 w - - 4 3` | `[]` | `square:null, zone:away` |

At all stages the knight retains `id:white-knight-b1, owner:white, role:knight, originalRole:knight, promoted:false, royal:false, neutral:false`. Both pendingRescue and pendingDoomsayer are null. `cardPlayTargets(state,"resurrection")` returns `[]` at next White and later White turns. All nine accepted transitions pass the existing `checkState`, exposing an invariant-check coverage gap for orphan away pieces. Every action preserved its input digest.

Executed one directed multi-card game: 9 accepted actions, 2 rejected probes, 13.918 ms measured engine wall time. Baseline fixture scaffold passed before the game (and exact parent scaffold passed afterward); scaffold performs invalid z9-a1 rejection, digest preservation, and state validation. No temporary harness files were created, no production or test files were edited, no tests were read or run.

GAME_09_DONE — 1 game, 9 accepted, 2 rejected, 1 finding, 13.918 ms game wall time.
