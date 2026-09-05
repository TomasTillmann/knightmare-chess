# `positionFor().isCheckmate()` still false-mates positions with a neutral defense

- Severity: Medium
- Area: public API, Neutrality, checkmate
- Frozen checkout: `7c7b7ccac35046b9b9eed5fa26ed89d7c75fe4d9` plus the authoritative uncommitted changes

## Rule citation

`rules.md` §15.1 lets either player move a neutral piece and lets that piece capture either color. Sections 11.5 and 23 require mate adjudication to consider every legal board continuation.

## Expected

Black is checked by `Qg7`, but Black controls the neutral White Rook on `a7` and can play `Ra7xg7`. Therefore both public mate reporting and reducer adjudication must report that Black is not checkmated.

## Actual

The round-two fix makes `positionFor(state, 'black').isCheck()` return `true`, but the same returned position reports `isCheckmate() === true`. The authoritative APIs list and accept `a7-g7`, and `endTurn` correctly leaves `outcome` null.

## Minimal public reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e "import {createGameState} from './src/game/state.ts'; import {positionFor,legalDests,applyAction} from './src/game/reducer.ts'; let s=createGameState({fen:'7k/R5Q1/5K2/8/8/8/8/8 b - - 0 1'}); s.pieces.find(p=>p.square==='a7').neutral=true; const p=positionFor(s,'black'); console.log(p.isCheck(),p.isCheckmate(),Object.fromEntries(legalDests(s)),applyAction(s,{type:'move',from:'a7',to:'g7'}).ok); const prior={...s,turn:{color:'white',phase:'afterMove',moveMade:true,cardPlays:{white:0,black:0}}}; const end=applyAction(prior,{type:'endTurn'}); console.log(end.ok&&end.state.outcome)"
```

Observed:

```text
true true { a7: [ 'g7' ] } true
null
```

## Likely root

`positionFor` overrides only the returned chessops object's `isCheck` method at `src/game/reducer.ts:92-95`. Its `hasDests`/mate machinery still uses the owner-colored chessops move generator and cannot see neutral control. This is a current sibling of the round-two `positionFor().isCheck()` disagreement, not that already-fixed check result.
