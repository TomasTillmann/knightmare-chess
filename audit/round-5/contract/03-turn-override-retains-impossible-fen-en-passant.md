# `createGameState` turn override retains an impossible FEN en-passant field

- Severity: Low
- Area: public state factory, FEN/en-passant synchronization
- Audited state: frozen shared checkout; `src/` and `tests/` remained read-only

## Rule basis and expected behavior

`rules.md` §13.1 gives en passant ordinary one-reply timing, while §23 requires side to move and en-passant availability to agree in serialized state. `CreateGameOptions` publicly permits a caller to override the FEN turn. When that changes the side to move, the old FEN en-passant opportunity belongs to the replaced turn and must be cleared unless it can be represented consistently.

## Actual behavior

Overriding Black-to-move FEN to White preserves `e3` in `state.fen`, even though `state.enPassant` is empty and `positionFor(state).epSquare` is `undefined`. The factory therefore immediately returns three disagreeing public representations.

## Minimal reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e "import assert from 'node:assert/strict'; import {createGameState} from './src/game/state.ts'; import {positionFor} from './src/game/reducer.ts'; const state=createGameState({fen:'7k/8/8/8/4P3/8/8/K7 b - e3 0 1',turn:'white'}); assert.equal(state.turn.color,'white'); assert.equal(state.fen.split(' ')[1],'w'); assert.equal(state.fen.split(' ')[3],'e3'); assert.deepEqual(state.enPassant,[]); assert.equal(positionFor(state).epSquare,undefined);"
```

Observed state:

```text
fen:       7k/8/8/8/4P3/8/8/K7 w - e3 0 1
turn:      white
enPassant: []
position:  epSquare undefined
```

Without the `turn: 'white'` override, the same valid input correctly returns Black to move with the `e3` opportunity bound to `white-pawn-e4`.

## Root hint

`createGameState` in `src/game/state.ts` overwrites `setup.turn` before serializing it with `makeFen`, but never clears `setup.epSquare` when the requested turn differs from the parsed FEN turn. Its later victim lookup uses the new turn and correctly finds no victim, causing the contradiction. Clear the stale FEN EP field at the same turn-override boundary.
