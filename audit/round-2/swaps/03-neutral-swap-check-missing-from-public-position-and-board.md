# A neutral check delivered by a swap is missing from the public position and board indicator

- Severity: Medium
- Cards: Holy War (shared neutral/check presentation affects all swap cards)
- Authoritative checkout HEAD: `29ae7f671f1ce6e636b2112dd4f19ec19198677c` plus the pre-existing working-tree changes

## Rule citation

`rules.md` §15.1 says a neutral piece may check either King. Section 20 permits Holy War to select a neutral Bishop and carry that physical piece to its exchanged square.

## Expected

After Holy War moves the neutral Black Bishop from `a1` to `g7`, the Bishop checks the Black King on `h8`. The exported position/check view used by the board should report Black in check, consistently with reducer legality.

## Actual

The swap resolves as `cardPlayed`, and the reducer rejects an unrelated Black Rook move because Black remains in check. However, exported `positionFor(state, 'black').isCheck()` returns `false`. `ChessBoard` uses exactly that method to set its `check` indicator, so the board omits the check highlight.

## Minimal reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module <<'TS'
import assert from 'node:assert/strict';
import { applyAction, positionFor } from './src/game/reducer.ts';
import { createGameState } from './src/game/state.ts';

let state = createGameState({
  fen: 'r6k/6N1/8/8/8/8/7P/b3K3 w - - 0 1',
  hands: { white: ['holy-war'], black: [] },
});
state.pieces.find(piece => piece.square === 'a1').neutral = true;

for (const action of [
  { type: 'move', from: 'h2', to: 'h3' },
  { type: 'playCard', cardId: 'holy-war', target: { knight: 'g7', bishop: 'a1' } },
  { type: 'endTurn' },
]) {
  const result = applyAction(state, action);
  assert(result.ok, result.ok ? undefined : result.error.message);
  state = result.state;
}

assert.equal(positionFor(state, 'black').isCheck(), false);
const unrelated = applyAction(state, { type: 'move', from: 'a8', to: 'a7' });
assert.equal(unrelated.ok, false);
assert.equal(unrelated.error.code, 'ILLEGAL_MOVE');
console.log(positionFor(state, 'black').isCheck(), unrelated.error.code);
TS
```

## Evidence

Observed output:

```text
false ILLEGAL_MOVE
```

The neutral Bishop on `g7` geometrically attacks `h8`; the legal reducer path recognizes that the unrelated Rook move does not cure the check, while the exported check view denies the same check.

## Likely root

`src/game/reducer.ts:50-89` stores every piece in the chessops position under its original `owner`; chessops therefore sees the Black-owned neutral Bishop as friendly to the Black King. Internal royal safety adds neutral attacks separately at lines 447-471, but that result is not exported. `src/ChessBoard.tsx:30-41` instead calls `positionFor(...).isCheck()` for both colors.
