# Unknown action discriminators execute a card play

- Severity: High
- Area: public reducer boundary, malformed actions, atomicity
- Audited state: frozen shared checkout; `src/` and `tests/` remained read-only

## Rule basis and expected behavior

`rules.md` §24 requires every proposed action to pass timing, allowance, target, state, and geometry validation before it resolves. The exported `GameAction` contract defines only `move`, `playCard`, and `endTurn`. A runtime action with any other discriminator is malformed and must be rejected atomically; it must not be reinterpreted as a valid card play.

## Actual behavior

Any truthy action whose `type` is neither `move` nor `endTurn` falls through to the card dispatcher. If the remaining fields happen to describe a legal card play, the reducer executes it.

The reproduction below sends `type: 'bogus'`, yet Disintegration is spent and the White Pawn on `a2` becomes dead. The input state itself remains immutable, but the returned transition is an unauthorized successful action.

## Minimal reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e "import assert from 'node:assert/strict'; import {createGameState} from './src/game/state.ts'; import {applyAction} from './src/game/reducer.ts'; const state=createGameState({hands:{white:['disintegration'],black:[]}}); const before=structuredClone(state); const result=applyAction(state,{type:'bogus',cardId:'disintegration',target:'a2'}); assert(result.ok); assert.deepEqual(result.state.history.at(-1),{type:'cardPlayed',cardId:'disintegration',target:'a2'}); assert.equal(result.state.pieces.find(p=>p.id==='white-pawn-a2').zone,'dead'); assert.equal(result.state.players.white.discard.length,1); assert.deepEqual(state,before);"
```

Observed result:

```text
ok: true
history: { type: 'cardPlayed', cardId: 'disintegration', target: 'a2' }
white-pawn-a2: dead
discarded cards: 1
```

## Root hint

`applyAction` in `src/game/reducer.ts` explicitly handles `move` and `endTurn`, then treats every other discriminator as `playCard`. Dispatch must positively require `action.type === 'playCard'` before calling `playCard`; the remaining branch should return a structured atomic rejection.
