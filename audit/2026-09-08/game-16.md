# Game 16: Confabulation continuing-effect mate

Prediction recorded before play: with `k6B/pp6/8/8/8/8/8/4K2R w - - 0 1`, Confabulation moving rook h1 onto friendly bishop h8 produces queen-like rook+bishop movement. The merged piece checks Ka8, whose exits a7 and b7 are occupied. Rule 11.4 permits continuing-effect mate, so the effect should remain rather than fizzle as DIRECT_MATE.

## Confirmed finding: Confabulation incorrectly fizzles a legal continuing-effect mate

Authority: [rules.md §11.4](../../rules.md#114-continuing-effects-may-participate-in-mate), lines 254–256, allows a Continuing Effect to cause mate and forbids discarding it merely because the result is mate. [Confabulation](../../cards.md#confabulation), lines 109–111, grants both components' movement. `src/game/cards/catalog.ts:336–345` explicitly marks this card `continuing: true`; rules §15.4 confirms merged movement.

Reproduction through public APIs:

```js
let s = createGameState({
  fen: 'k6B/pp6/8/8/8/8/8/4K2R w - - 0 1',
  hands: { white: ['confabulation'] },
});
let r = applyAction(s, {
  type: 'playCard', cardId: 'confabulation',
  target: [{ from: 'h1', to: 'h8' }],
});
s = r.state;
r = applyAction(s, { type: 'endTurn' });
```

Expected before play: rook h1 merges with bishop h8; queen-equivalent movement on h8 checks and mates Ka8. This is permitted continuing-effect mate; retain the merged piece and marker. Black has no cards to rescue itself. Independent chessops oracle on `k6Q/pp6/8/8/8/8/8/4K3 b - - 1 1` returned `{mate:true, check:true}`.

Actual: card action returns `ok:true` but history is exactly `[{type:'cardFizzled',cardId:'confabulation',reason:'DIRECT_MATE',movement:[],preservePreviousMove:false}]`; `effects:[]`, rook still h1, bishop still h8, card in White's discard. End turn succeeds and leaves Black to move in the original geometry with `outcome:null`. Valid mate is erased and White loses its card and move.

This is sibling coverage for the continuing-effect direct-mate defect found with Earthquake; no source-root-cause claim or independent root-cause count.

Executed: one scaffold invalid-move rejection and input-immutability check; one game with two directed actions (Confabulation and endTurn), checking input immutability and state invariants after each. No random moves in this bounded directed group. Scaffold printed `SCAFFOLD_OK`; game printed `GAME_16_DONE 14.731165999999988` (14.73 ms game wall time). No temporary harness or code/test edits.
