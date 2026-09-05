# The UI blocks No Quarter after a reducer-legal neutral capture

- Severity: Medium
- Cards: No Quarter; interaction with Neutrality and Annexation en passant

## Rule and expected result

`rules.md` §15.1 permits either player to move a neutral piece and lets it capture either color. Section 22.9 makes the exact enemy piece captured by the immediately preceding Regular Move eligible for No Quarter, including an en-passant victim, while preserving its neutral and ownership fields.

After Black controls a neutral White Pawn on `d5` and captures the neutral Black Annexation victim on `e5` via `d5xe6 e.p.`, Black must be able to play No Quarter on that exact victim.

## Actual result

The keyboard UI executes `d5xe6`, enters the after-move phase, and records the capture. The Black No Quarter card nevertheless remains `aria-disabled="true"`, cannot be selected, and no **Play No Quarter** button is rendered.

Calling the exported reducer on the same state accepts No Quarter and changes `black-pawn-e5` from `captured` to `dead`. The UI is therefore denying a currently legal action that the authoritative reducer correctly supports.

## Reproduction and control

Seed the mounted app with:

```ts
const state = createGameState({
  fen: '7k/8/8/3Pp3/8/8/8/K7 b - - 0 1',
  hands: { white: [], black: ['no-quarter'] },
});
for (const square of ['d5', 'e5']) {
  state.pieces.find(piece => piece.square === square)!.neutral = true;
}
state.enPassant = [{
  target: 'e6',
  pawnId: state.pieces.find(piece => piece.square === 'e5')!.id,
}];
```

Then use Keyboard controls to make `d5-e6`. Playwright observed:

```text
Move-to options: Choose square, e6, d6
phase: after move
No Quarter aria-disabled: true
Play No Quarter button count: 0
```

Reducer control:

```ts
const capture = applyAction(state, { type: 'move', from: 'd5', to: 'e6' });
assert(capture.ok);
const noQuarter = applyAction(capture.state, { type: 'playCard', cardId: 'no-quarter' });
assert(noQuarter.ok);
assert.equal(noQuarter.state.pieces.find(p => p.id === 'black-pawn-e5')?.zone, 'dead');
```

## Production location

`src/App.tsx:107-113` computes `canPlayNoQuarter` from stored-owner equality only. It omits the reducer's neutral exceptions for both the mover and captured victim.
