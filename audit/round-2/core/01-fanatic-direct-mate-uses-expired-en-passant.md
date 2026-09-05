# Fanatic can create a forbidden direct mate by testing a stale en-passant right

- Severity: High
- Area: Checkmate Rule, Fanatic, en passant, Neutrality
- Frozen checkout: `29ae7f671f1ce6e636b2112dd4f19ec19198677c` plus the authoritative uncommitted changes

## Rule citation

`rules.md` §11.5 says a regular card fails when it directly creates board-state checkmate. Section 13.4 says Fanatic expires every pre-existing en-passant opportunity because it constitutes the move for the turn, and that a mating Fanatic must restore the Pawn and spend the card. Section 15.1 permits either player to move a neutral piece and lets that piece capture either color.

## Expected

In the position below, `Fanatic d4-d7` opens `Ba1-h8`. Once Fanatic expires the old `f6` en-passant opportunity, Black has no legal response, so Fanatic itself creates checkmate. The card must fizzle with `DIRECT_MATE`, restoring the Pawn to `d4`.

The neutral White Pawn on `g5` explains the trap: while the old right exists, Black can control it and play `g5xf6 e.p.`, interposing on the Bishop line. That response ceases to exist when Fanatic consumes the move.

## Actual

The reducer records `cardPlayed`, clears `state.enPassant`, and then `endTurn` awards White checkmate. The direct-mate test therefore relied on a defense that the committed Fanatic state itself removes.

## Minimal reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e "import {createGameState} from './src/game/state.ts'; import {applyAction} from './src/game/reducer.ts'; let s=createGameState({fen:'7k/8/6Q1/5pP1/3P4/8/8/B3K3 w - f6 0 1',hands:{white:['fanatic'],black:[]}}); s={...s,pieces:s.pieces.map(p=>p.square==='g5'?{...p,neutral:true}:p)}; const card=applyAction(s,{type:'playCard',cardId:'fanatic',target:'d4'}); if(!card.ok) throw new Error(card.error.code); const end=applyAction(card.state,{type:'endTurn'}); console.log(card.state.history.at(-1),card.state.enPassant,end.ok&&end.state.outcome)"
```

Observed output:

```text
{ type: 'cardPlayed', cardId: 'fanatic', target: 'd4' } [] { winner: 'white', reason: 'checkmate' }
```

## Evidence

Directly after Fanatic, `enPassant` is empty and `legalDests` for Black is empty. With the pre-card right still present, the neutral `g5-f6` en-passant response is legal and blocks the check. The full 808-test suite passes, so this expiration/direct-mate interaction is not covered there.

## Likely root

`playFanatic` calls `isOrdinaryCheckmate(resolved, ...)` at `src/game/reducer.ts:668` before `completeReplacementMove` clears en passant at line 675. The same ordering exists in several other replace-move cards; Annexation avoids it by testing the completed state.
