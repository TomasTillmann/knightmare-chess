# No Quarter rejects a legal neutral en-passant capture

- Severity: Medium
- Cards: Annexation, No Quarter

## Rule citation

`rules.md` §15.1 permits either player to move a neutral piece, permits that piece to capture either color, and makes a neutral piece valid for both friendly- and enemy-piece effects. Section 22.9 says No Quarter binds to the exact enemy piece captured by the immediately preceding Regular Move, expressly including an en-passant victim while preserving the victim's neutral and ownership fields.

## Expected

White may Annex the neutral Black Pawn `e7-e5`. On Black's reply, Black may control the neutral White Pawn on `d5` and capture the neutral Pawn `d5xe6 e.p.`. This is an ordinary Regular Move capture, so Black may immediately play No Quarter on the exact `black-pawn-e7` victim.

## Actual

The en-passant move succeeds and history records its exact `capturedId`, but No Quarter rejects the immediately following play as `INVALID_TIMING`. Neither the mover's stored White owner nor the neutral victim's stored Black owner describes control or enemy eligibility in this sequence.

## Minimal reproduction

```ts
import assert from 'node:assert/strict';
import { applyAction } from './src/game/reducer.ts';
import { createGameState } from './src/game/state.ts';

const applied = (state, action) => {
  const result = applyAction(state, action);
  assert(result.ok, result.ok ? undefined : result.error.message);
  return result.state;
};

let state = createGameState({
  fen: '7k/4p3/8/3P4/8/8/8/K7 w - - 0 1',
  hands: { white: ['annexation'], black: ['no-quarter'] },
});
for (const square of ['e7', 'd5']) {
  state.pieces.find(piece => piece.square === square).neutral = true;
}

state = applied(state, {
  type: 'playCard', cardId: 'annexation',
  target: [{ from: 'e7', to: 'e5' }],
});
state = applied(state, { type: 'endTurn' });
state = applied(state, { type: 'move', from: 'd5', to: 'e6' });
assert.deepEqual(state.history.at(-1), {
  type: 'move', from: 'd5', to: 'e6', capturedId: 'black-pawn-e7',
});

const result = applyAction(state, { type: 'playCard', cardId: 'no-quarter' });
assert.equal(result.ok, false);
assert.equal(result.error.code, 'INVALID_TIMING');
```

Observed identities at rejection:

```text
mover:  owner=white, neutral=true, square=e6
victim: owner=black, neutral=true, zone=captured
error:  INVALID_TIMING
```

## Likely root

`src/game/reducer.ts:1283–1285` requires `captured.owner !== color` and `mover.owner === color`. Those stored-owner checks omit the `neutral` control and enemy-target exceptions already honored by the preceding regular en-passant move.
