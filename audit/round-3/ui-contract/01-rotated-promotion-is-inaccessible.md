# Rotated Pawn promotion is inaccessible through both UI move controls

- Severity: High
- Scope: Regular Pawn move UI at orientations `90` and `270`

## Rule and expected result

`rules.md` §13.2 requires a Pawn reaching its last line to promote, and §13.3 makes that last line depend on the current board orientation. At orientation `90`, the White Pawn on `g2` can legally move to `h2` and promote to Queen, Rook, Bishop, or Knight.

The UI must request a promotion role and submit it with that horizontal move, just as it does for an ordinary rank-eight promotion.

## Actual result

`legalDests(state).get('g2')` includes `h2`, so both the board and keyboard controls offer the move. `App.move`, however, requests promotion only when the destination string ends in `1` or `8`. Moving `g2-h2` therefore sends no `promotion`, and the reducer rejects it as `ILLEGAL_MOVE`.

No promotion dialog opens. The keyboard path reports `That is not a legal chess move.`; the board path reports the same error and returns the Pawn to `g2`. There is no other UI control with which to provide the required role, so the legal move is inaccessible.

## Reproduction and control

Seed the mounted app with this public state, using the same React-state dispatch technique as `tests/ui/neutral-swap-check-indicator.round2.spec.ts`:

```ts
const state = createGameState({
  fen: '7k/8/8/8/8/8/6P1/K7 w - - 0 1',
});
state.orientation = 90;
```

In Playwright:

1. Open Keyboard controls and select `g2` as **Move from**.
2. Observe `h2` in **Move to**, select it, and press **Make move**.
3. Observe zero dialogs and the `That is not a legal chess move.` alert.
4. Reset the fixture and drag `g2-h2`; observe the same result and zero dialogs.

The public reducer confirms this is a UI-only failure:

```ts
assert(legalDests(state).get('g2')?.includes('h2'));
assert.equal(applyAction(state, { type: 'move', from: 'g2', to: 'h2' }).ok, false);
assert.equal(applyAction(state, {
  type: 'move', from: 'g2', to: 'h2', promotion: 'knight',
}).ok, true);
```

The mirrored Black `b7-a7` promotion at orientation `90` has the same reducer contract and the same UI detection failure. Non-promoting rotated double steps and rotated en-passant captures were exercised successfully.

## Production location

`src/App.tsx:331-337` determines promotion from `to.endsWith('1') || to.endsWith('8')` instead of the orientation- and owner-aware last line used by the reducer.
