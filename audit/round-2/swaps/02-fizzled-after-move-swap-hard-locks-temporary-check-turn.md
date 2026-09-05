# A fizzled after-move swap can hard-lock a temporarily checked turn

- Severity: High
- Cards: Holy War, Anathema, Cathedral, Siege, Holy Quest, Treason
- Authoritative checkout HEAD: `29ae7f671f1ce6e636b2112dd4f19ec19198677c` plus the pre-existing working-tree changes

## Rule citation

`rules.md` §11.6 permits a Regular Move to leave the acting King temporarily in check only when a card played on that same turn removes the check before the turn ends. It also requires a card whose effect leaves the King in check to restore the position from immediately before that card while spending the card.

## Expected

Once the reducer admits `a2-a3` only because Treason can rescue the checked White King, the turn must retain a legal resolution if the player selects a different Treason pair whose effect fizzles. The engine must not commit an illegal still-checked move into a state from which every action is rejected; it must either prevent that non-rescue sequence or provide the required rollback/adjudication.

## Actual

The reducer accepts `a2-a3` because swapping `a8` with `f3` would be a valid Treason rescue. Playing Treason on the different valid pair `h8`/`b8` then fizzles as `SELF_CHECK`, spends the only card allowance, and restores only the pre-card state. The result has `moveMade: true`, White still in check, and `outcome: null`. Ending the turn, moving again, and playing the drawn card are all rejected, so the public reducer has no transition out of the state.

## Minimal reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module <<'TS'
import assert from 'node:assert/strict';
import { applyAction, legalDests } from './src/game/reducer.ts';
import { createGameState } from './src/game/state.ts';

let state = createGameState({
  fen: 'rn4kr/8/8/8/8/5n2/P7/4K3 w - - 0 1',
  hands: { white: ['treason'], black: [] },
  decks: { white: ['holy-war'], black: [] },
});

let result = applyAction(state, { type: 'move', from: 'a2', to: 'a3' });
assert(result.ok);
state = result.state;

result = applyAction(state, {
  type: 'playCard',
  cardId: 'treason',
  target: { rook: 'h8', knight: 'b8' },
});
assert(result.ok);
state = result.state;
assert.deepEqual(state.history.at(-1), {
  type: 'cardFizzled', cardId: 'treason', reason: 'SELF_CHECK',
});
assert.equal(state.outcome, null);
assert.deepEqual([...legalDests(state)], []);

for (const action of [
  { type: 'endTurn' },
  { type: 'move', from: 'e1', to: 'd1' },
  { type: 'playCard', cardId: 'holy-war', target: { knight: 'b8', bishop: 'a1' } },
]) {
  const blocked = applyAction(state, action);
  assert.equal(blocked.ok, false);
  console.log(blocked.error.code);
}
TS
```

## Evidence

Observed terminal codes are:

```text
KING_IN_CHECK
ILLEGAL_MOVE
CARD_ALREADY_PLAYED
```

The rescue pair `{ rook: 'a8', knight: 'f3' }` is legal in the same post-move state and removes the Knight check, which is why the initial otherwise-illegal Pawn move was admitted. The alternate pair is also a structurally valid Treason target, so this is reachable without malformed state or private helpers.

## Likely root

`src/game/reducer.ts:1385-1395` admits a temporarily unsafe move based on the existence of any successful after-move card target. `fizzleCard` at lines 552-564 clones only the already-committed post-move state and spends the card; no pre-move snapshot or pending-rescue obligation exists. `endTurn` then rejects the check at lines 1648-1652, while `movePiece` and the card allowance reject the only other action classes.
