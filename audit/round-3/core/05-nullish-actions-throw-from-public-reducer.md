# Nullish actions throw from the public reducer

- Severity: Low
- Area: public API, malformed actions, atomic rejection
- Frozen checkout: `7c7b7ccac35046b9b9eed5fa26ed89d7c75fe4d9` plus the authoritative uncommitted changes

## Rule citation

`rules.md` §24 requires timing, target, geometry, and other validation before resolution and says an invalid early step must not partially resolve the action. The exported reducer represents all other malformed action shapes as an `ApplyResult` rejection without throwing.

## Expected

A malformed action at the public runtime boundary should produce an atomic rejection, as malformed move records, card targets, card instances, unknown action types, and finished-game actions do. It must not escape as an uncaught exception.

## Actual

Both `null` and `undefined` throw `TypeError` before the reducer can return an `ApplyResult`. The input state remains unchanged, but a caller that relies on the public result union is terminated unless it adds an out-of-band exception guard.

## Minimal public reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e "import {createGameState} from './src/game/state.ts'; import {applyAction} from './src/game/reducer.ts'; const s=createGameState(); for(const action of [null,undefined])try{console.log(applyAction(s,action))}catch(e){console.log(String(action),e.name,e.message)} for(const action of [{},{type:'bogus'},{type:'move'}]){const r=applyAction(s,action);console.log(JSON.stringify(action),r.ok?null:r.error.code)}"
```

Observed:

```text
null TypeError Cannot read properties of null (reading 'type')
undefined TypeError Cannot read properties of undefined (reading 'type')
{} CARD_NOT_IN_HAND
{"type":"bogus"} CARD_NOT_IN_HAND
{"type":"move"} ILLEGAL_MOVE
```

## Likely root

`applyAction` dereferences `action.type` without first checking that `action` is a non-null object (`src/game/reducer.ts:1731-1738`).
