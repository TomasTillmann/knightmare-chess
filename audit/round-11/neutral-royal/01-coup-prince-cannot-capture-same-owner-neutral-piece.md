# A Coup Prince cannot capture a same-owner neutral piece

- Severity: High
- Area: Coup, Neutrality, legal check escapes
- Audited state: current shared checkout; `src/` and tests remained read-only

## Rule basis

`rules.md` §15.1 says that a neutral piece may be moved by either player and may capture either color. Section 15.3 says that Coup's original King becomes a capturable Prince which still moves like a King. Therefore a Prince may make a one-square King move that captures a neutral piece even when that piece has the same stored owner.

## Expected

In the position below, the White `e2` Prince may capture the White-origin neutral Rook on `d2`. This is also a check-rescue case: the neutral Rook attacks White's marked royal Pawn on `a2`, so `e2xd2` must be present in White's legal destinations.

## Actual

Both `legalDests()` and `applyAction()` reject `e2xd2` as `ILLEGAL_MOVE`. The reducer accepts the same King-step capture if either:

- the neutral Rook's stored owner is changed to Black; or
- the moving King-role piece is changed from the non-royal Prince back to the royal King.

A vertical same-owner neutral capture is rejected too, so the defect is not direction-specific.

## Minimal reproduction

```ts
import assert from 'node:assert/strict';
import { applyAction, isKingInCheck, legalDests } from '../../../src/game/reducer.js';
import { createGameState } from '../../../src/game/state.js';

function coupState() {
  const seeded = createGameState({
    fen: '4k3/8/8/8/8/8/P2RK3/8 w - - 0 1',
  });
  return {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'e2'
      ? { ...piece, royal: false } // Coup Prince
      : piece.square === 'a2'
        ? { ...piece, royal: true } // marked replacement King
        : piece.square === 'd2'
          ? { ...piece, neutral: true }
          : piece),
  };
}

const before = coupState();
assert.equal(isKingInCheck(before, 'white'), true);
assert.equal(legalDests(before).get('e2')?.includes('d2') ?? false, false);

const result = applyAction(before, { type: 'move', from: 'e2', to: 'd2' });
assert.equal(result.ok, false);
if (!result.ok) assert.equal(result.error.code, 'ILLEGAL_MOVE');

const oppositeOwner = coupState();
oppositeOwner.pieces.find(piece => piece.square === 'd2')!.owner = 'black';
assert.equal(applyAction(oppositeOwner, { type: 'move', from: 'e2', to: 'd2' }).ok, true);

const ordinaryKing = coupState();
ordinaryKing.pieces.find(piece => piece.square === 'e2')!.royal = true;
ordinaryKing.pieces.find(piece => piece.square === 'a2')!.royal = false;
assert.equal(applyAction(ordinaryKing, { type: 'move', from: 'e2', to: 'd2' }).ok, true);
```

## Evidence and likely root

The input position is otherwise stable and the rejected action does not mutate it. The failure occurs before the reducer's supported same-owner-neutral capture path. `castlingSide(position, move)` treats a King-role move onto a same-color occupied square as a Chess960 castling alias; `movePiece()` then rejects that alias solely because the Prince is not royal. The neutral occupant's stored White color therefore causes a legal neutral capture to be mistaken for castling.

Because `legalDests()` uses the same path, this can suppress a real check escape and contaminate checkmate/card-fizzle adjudication.

## Bounded matrix summary

- 160,000 randomized `isKingInCheck()` calls across 2–8-piece states: 0 exceptions or hangs.
- 40 isolated ordinary-capture combinations across target neutrality, attacker neutrality/owner, and Queen/Rook/Bishop/Knight/King geometry: 39 matched legal-capture controls; the Prince/same-owner-neutral case above exposed this root.
- 5 isolated pin/controller differentials, including one-controller-pinned and both-controllers-pinned neutral attackers: all matched.
- 16 en-passant royal-threat combinations across target neutrality, attacker neutrality/royal status, and pinned/unpinned control: all matched.
- 25 focused existing neutral-royal, Long Jump, and royal-en-passant regressions: 25 passed.
