# A pinned ordinary piece falsely attacks a neutral royal

- Severity: High
- Area: Neutrality, Coup royal identity, check authority, replacement-card safety
- Audited state: current uncommitted post-round-6 checkout; `src/` and tests remained read-only

## Rule basis

`rules.md` §6 defines a threat as a capture the piece could make under the current rules, and §11.7 says threat is evaluated from legal capture capability rather than raw geometry. Section 15.1 makes a neutral piece capturable by either color and requires royal safety after neutral moves. A pinned piece cannot legally capture a neutral royal if moving would expose its own King.

This is distinct from the fixed earlier roots: neutral attackers are already checked for pin legality, and same-origin ordinary pieces are already recognized as possible attackers of a neutral royal. The remaining combination is a **non-neutral, pinned attacker** against a neutral royal.

## Expected

White may control the Black-origin neutral royal Knight on `b1` and play Long Jump to `h2`. The White Rook on `e2` has raw horizontal geometry to `h2`, but is absolutely pinned to the White King on `e1` by the Black Rook on `e8`. Because `e2-h2` would expose White's King, the White Rook cannot legally capture the neutral royal. Long Jump should therefore resolve successfully and leave the marked royal on `h2`.

## Actual

Long Jump returns success only as a spent-card fizzle: history records `SELF_CHECK` and the neutral royal is restored to `b1`. A direct check probe likewise reports that the neutral royal on `h2` is in check, while moving the Rook off the pin is rejected as illegal.

## Minimal reproduction

```ts
import assert from 'node:assert/strict';
import { applyAction, isKingInCheck } from '../../../src/game/reducer.js';
import { createGameState } from '../../../src/game/state.js';

const state = createGameState({
  fen: '4r2k/8/8/8/8/8/4R3/1n2K3 w - - 0 1',
  hands: { white: ['long-jump'], black: [] },
  decks: { white: [], black: [] },
});
state.pieces.find(piece => piece.square === 'h8')!.royal = false;
const royal = state.pieces.find(piece => piece.square === 'b1')!;
royal.neutral = true;
royal.royal = true;

const result = applyAction(state, {
  type: 'playCard',
  cardId: 'long-jump',
  target: [{ from: 'b1', to: 'h2' }],
});

assert(result.ok);
assert.deepEqual(result.state.history.at(-1), {
  type: 'cardFizzled', cardId: 'long-jump', reason: 'SELF_CHECK',
}); // expected cardPlayed
assert.equal(result.state.pieces.find(piece => piece.id === royal.id)?.square, 'b1'); // expected h2

const onH2 = structuredClone(state);
onH2.pieces.find(piece => piece.id === royal.id)!.square = 'h2';
assert.equal(isKingInCheck(onH2, 'black'), true); // expected false
assert.equal(applyAction(state, { type: 'move', from: 'e2', to: 'f2' }).ok, false);
```

The existing round-5 unpinned same-origin Rook regression still passes, so the failure is pin legality rather than owner matching.

## Root hint

`isRoyalInCheck` treats every geometrical non-neutral attack on a neutral royal as check. Unlike `neutralLegallyAttacksRoyal`, it never verifies that the ordinary attacker can make the capture without exposing its controller's royal. The clean shared fix is to apply legal-capture authority to this unusual same-owner-neutral target path while leaving ordinary chess attack semantics unchanged.
