# Destination-only castling check cannot use a legal after-move rescue

- Severity: High
- Area: castling, pending-rescue transaction, Cowardice
- Frozen checkout: `7c7b7ccac35046b9b9eed5fa26ed89d7c75fe4d9` plus the authoritative uncommitted changes

## Rule citation

`rules.md` §11.6 permits a Regular Move to place or leave the acting King in check when a card played on that same turn removes the check before the turn ends. Ordinary castling still forbids starting in check or crossing an attacked transit square; neither condition occurs here.

## Expected

White's `e1-g1` castle starts from a safe `e1` and crosses safe `f1`. The destination `g1` is temporarily attacked by `Rg8`, but the legal after-move Cowardice play `f4-g4` blocks that file. The castle should therefore enter the same pending-rescue transaction used by other Regular Moves, and Cowardice should complete a safe turn.

## Actual

`legalDests` omits `g1` and `applyAction` rejects the castle as `ILLEGAL_MOVE` before pending rescue is considered. If the identical post-castle state is staged through the public state shape, Cowardice resolves and `isKingInCheck(..., 'white')` becomes `false`.

## Minimal public reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e "import {createGameState} from './src/game/state.ts'; import {applyAction,legalDests,isKingInCheck} from './src/game/reducer.ts'; let s=createGameState({fen:'4k1r1/8/8/8/5p2/8/8/4K2R w K - 0 1',hands:{white:['cowardice'],black:[]}}); s.orientation=90; const castle=applyAction(s,{type:'move',from:'e1',to:'g1'}); console.log(legalDests(s).get('e1')?.includes('g1')??false,castle.ok?null:castle.error.code); const staged=structuredClone(s); staged.pieces.find(p=>p.square==='e1').square='g1'; staged.pieces.find(p=>p.square==='h1').square='f1'; staged.fen='4k1r1/8/8/8/5p2/8/8/5RK1 b - - 1 1'; staged.turn.phase='afterMove'; staged.turn.moveMade=true; staged.history.push({type:'move',from:'e1',to:'g1'}); const rescue=applyAction(staged,{type:'playCard',cardId:'cowardice',target:[{from:'f4',to:'g4'}]}); console.log(rescue.ok,rescue.ok&&isKingInCheck(rescue.state,'white'),rescue.ok&&rescue.state.history.at(-1))"
```

Observed essentials:

```text
false ILLEGAL_MOVE
true false { type: 'cardPlayed', cardId: 'cowardice', ... }
```

## Likely root

After the castle is resolved, `src/game/reducer.ts:1659-1660` rejects an attacked destination immediately. That special-case return bypasses `finishRegularMove` and its `hasAfterMoveRescue`/`pendingRescue` path at lines 1411-1425. The earlier origin/transit checks are separate and correctly remain unconditional.
