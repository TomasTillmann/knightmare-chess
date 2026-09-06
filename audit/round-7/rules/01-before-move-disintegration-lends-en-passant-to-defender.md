# Before-move Disintegration lends the acting player's en-passant right to the defender

- Severity: High
- Cards: Disintegration
- Area: direct-mate probing, en-passant turn ownership, Neutrality
- Audited state: current frozen post-round-6 checkout; production and tests remained read-only

## Rule basis

`rules.md` §11.1–§11.2 requires a regular card that directly creates board-state checkmate to fizzle. En passant belongs only to the opponent's immediately following move (§13.1), and changing the side being hypothetically tested must not transfer that entitlement. Neutrality permits either player to control a neutral Pawn (§15.1), but it does not extend an en-passant window to a later or different side's move.

## Expected

Black has just played `f7-f5`, so the live `f6` en-passant opportunity belongs to White. Before making White's Regular Move, White plays Disintegration on `d4`, opening `Ba1-h8`. Black has no ordinary reply, and Black cannot claim White's `g5xf6 e.p.` entitlement merely because the White Pawn on `g5` is neutral. Disintegration therefore directly creates checkmate and must be spent as `cardFizzled/DIRECT_MATE`, with the Pawn restored on `d4`.

## Actual

Disintegration records `cardPlayed` and removes `d4`. Its mate probe temporarily changes the logical turn to Black but leaves `state.enPassant` intact. Black is then incorrectly allowed to control the neutral White Pawn and play `g5xf6 e.p.`, so the probe decides that the position is not mate. Removing that stale entitlement from the staged position leaves Black in check with zero legal destinations.

## Minimal reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e "import assert from 'node:assert/strict'; import {createGameState} from './src/game/state.ts'; import {applyAction,isKingInCheck,legalDests} from './src/game/reducer.ts'; let s=createGameState({fen:'7k/8/6Q1/5pP1/3P4/8/8/B3K3 w - f6 0 1',hands:{white:['disintegration'],black:[]}}); s.pieces.find(p=>p.square==='g5').neutral=true; const r=applyAction(s,{type:'playCard',cardId:'disintegration',target:'d4'}); assert(r.ok); assert.deepEqual(r.state.history.at(-1),{type:'cardPlayed',cardId:'disintegration',target:'d4'}); const black=structuredClone(r.state); black.turn={color:'black',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}; assert.equal(isKingInCheck(black,'black'),true); assert.deepEqual(legalDests(black,false).get('g5'),['f6']); black.enPassant=[]; assert.equal(legalDests(black,false).size,0);"
```

The assertions reproduce the illegal successful card play and isolate the only supposed defense to the transferred en-passant opportunity.

## Root hint

`isOrdinaryCheckmate` calls `hasLegalMove`, which creates a `turnView` for the defender. `turnView` changes `turn.color` but copies `state.enPassant` unchanged. `positionFor` correctly clears its orthodox FEN projection when the side changes, but the custom `legalDests`/`enPassantCapture` path reads the unchanged explicit array and re-enables it. The turn-view boundary needs to clear en-passant metadata when it changes the side entitled to move; replacement-card probes whose completed state already has the defender to move must retain their newly created rights.
