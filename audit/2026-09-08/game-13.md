# Game 13: Confabulation, Coup, and cancellation after Prince capture

Prediction: after Coup's Prince is captured, Peace Talks must reject cancellation of the underlying Confabulation. Undoing the merged piece would also undo the protected Coup royal arrangement. The official FAQ protects both cards in this dependency.

Source: [official Knightmare Chess FAQ, page 50](https://www.sjgames.com/knightmare/KnightmareChess_FAQ.pdf).

## Confirmed finding: protected Confabulation can be cancelled after Prince capture

Severity: P1. Peace Talks accepts cancellation of Confabulation even though Coup made the merged piece royal and its Prince has since been captured. This is a distinct royal dependency rule violation; the lost merged knight is an additional consequence already covered by the general Confabulation cancellation finding.

### Reproduction

Create one game through `createGameState` with FEN `k2r4/8/8/8/8/8/N7/2B1K3 w - - 0 1`, White hand `['confabulation','coup']`, and Black hand `['peace-talks']`. Apply these public `applyAction` arguments sequentially:

```json
[
  {"type":"playCard","cardId":"confabulation","target":[{"from":"a2","to":"c1"}]},
  {"type":"endTurn"},
  {"type":"move","from":"d8","to":"d7"},
  {"type":"endTurn"},
  {"type":"move","from":"e1","to":"f1"},
  {"type":"playCard","cardId":"coup","target":"c1"},
  {"type":"endTurn"},
  {"type":"move","from":"d7","to":"f7"},
  {"type":"endTurn"},
  {"type":"move","from":"c1","to":"e3"},
  {"type":"endTurn"},
  {"type":"move","from":"f7","to":"f1"},
  {"type":"playCard","cardId":"peace-talks","target":"white-hand-0-confabulation"},
  {"type":"endTurn"}
]
```

All fourteen actions returned `ok: true`.

Expected at action 13: rejection, retaining both Confabulation and Coup effects and Black's Peace Talks card. The Prince was captured by action 12, so the FAQ's prohibition applies to both dependent cards.

Actual at action 13: Confabulation disappears from effects and enters White's discard; Peace Talks enters Black's discard. Coup remains active with `kingId: white-bishop-c1` and `princeId: white-king-e1`. The white bishop at e3 remains royal, the Prince stays captured, and the merged knight remains `zone: away` with no Confabulation effect. Action 14 succeeds, allowing this state to continue.

### Critical state excerpt

Before cancellation: `effects = [confabulation(white-bishop-c1, white-knight-a2), coup(prince=white-king-e1, king=white-bishop-c1)]`; bishop e3 royal; original king captured; knight away; rook f1; Black king a8; Black afterMove with Peace Talks in hand.

After cancellation: `effects = [coup(prince=white-king-e1, king=white-bishop-c1)]`; pieces unchanged; White discard contains Confabulation; Black discard contains Peace Talks; no outcome. `checkState` accepts the resulting state.

### Execution accounting

Parent-supplied scaffold executed successfully first (`SCAFFOLD_OK`): one rejected malformed move, zero invariant or immutability findings. One independent game group executed: fourteen accepted actions, fourteen invariant checks and input-digest immutability checks, one confirmed rule violation. Measured game execution wall time: 17 ms. No temporary harness created. No code or tests read or modified.

GAME_13_DONE
