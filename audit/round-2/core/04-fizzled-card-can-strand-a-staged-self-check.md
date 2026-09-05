# A fizzled non-rescue card can strand a conditionally staged move forever

- Severity: High
- Area: same-turn rescue staging, card allowance, end-turn legality
- Frozen checkout: `29ae7f671f1ce6e636b2112dd4f19ec19198677c` plus the authoritative uncommitted changes

## Rule citation

`rules.md` §11.6 permits a Regular Move to place or leave the acting King in check **only if** a card played on that same turn removes the check before the turn ends. It also says an after-move card that leaves the acting King in check has no board effect but is spent. Section 8.5 allows only one own-turn card.

## Expected

The reducer must not enter a state in which the conditional move remains committed, the only card allowance is spent, the King remains checked, and no action can finish or repair the turn. It can enforce this by rejecting the non-rescue continuation or by rolling back the conditional move while applying the required card lifecycle, but the sequence cannot be accepted into an unrecoverable active state.

## Actual

The presence of Cowardice lets White stage `Be2-f3`, temporarily exposing `Ke1` to `Re8`. White can then play an unrelated, valid Disintegration on `a2`; it fizzles with `SELF_CHECK` and consumes the card allowance. The resulting state has:

- `moveMade: true` and `cardPlays.white: 1`;
- White still in check;
- `outcome: null`;
- `endTurn` rejected as `KING_IN_CHECK`;
- Cowardice rejected as `CARD_ALREADY_PLAYED`; and
- every further move rejected because the Regular Move was already made.

## Minimal reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e "import {createGameState} from './src/game/state.ts'; import {applyAction,legalDests} from './src/game/reducer.ts'; const ok=(s,a)=>{const r=applyAction(s,a);if(!r.ok)throw new Error(r.error.code);return r.state}; let s=createGameState({fen:'4r2k/8/8/8/3p4/8/P3B3/4K3 w - - 0 1',hands:{white:['cowardice','disintegration'],black:[]}}); s={...s,orientation:90}; s=ok(s,{type:'move',from:'e2',to:'f3'}); s=ok(s,{type:'playCard',cardId:'disintegration',target:'a2'}); const end=applyAction(s,{type:'endTurn'}), rescue=applyAction(s,{type:'playCard',cardId:'cowardice',target:[{from:'d4',to:'e4'}]}), move=applyAction(s,{type:'move',from:'f3',to:'e2'}); console.log(s.history.at(-1),s.turn,s.outcome,[...legalDests(s)],end.ok?null:end.error.code,rescue.ok?null:rescue.error.code,move.ok?null:move.error.code)"
```

Observed essentials:

```text
{ type: 'cardFizzled', cardId: 'disintegration', reason: 'SELF_CHECK' }
... moveMade: true ... cardPlays: { white: 1, black: 0 } ...
null [] KING_IN_CHECK CARD_ALREADY_PLAYED ILLEGAL_MOVE
```

## Evidence

The state is not merely awaiting a valid choice: all three public action families fail, and no outcome is recorded. The accepted sequence therefore violates the condition under which the first move was admitted and leaves the game permanently non-progressable.

## Likely root

`hasAfterMoveRescue` at `src/game/reducer.ts:1385-1395` is only an existential check performed when the move is accepted. No pending-rescue obligation or rollback snapshot is stored. `fizzleCard` preserves the already-made move, while `endTurn` at lines 1648-1652 blocks completion and the card allowance blocks the rescue that originally justified staging.
