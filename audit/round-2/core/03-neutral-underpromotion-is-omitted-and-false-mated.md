# Queen-only probing omits legal neutral underpromotions and declares false checkmate

- Severity: High
- Area: promotion, Neutrality, `legalDests`, checkmate adjudication
- Frozen checkout: `29ae7f671f1ce6e636b2112dd4f19ec19198677c` plus the authoritative uncommitted changes

## Rule citation

`rules.md` §13.2 permits promotion to Queen, Rook, Bishop, or Knight. Section 15.1 lets either player move a neutral piece, but rejects a neutral move that leaves the acting player's King in check. Section 11.5 and §23 require mate/stalemate adjudication to consider every legal continuation.

## Expected

White is checked along the first rank by `Rb1`. White controls the neutral Black Pawn on `a2` and can capture the checker with `a2xb1=B` or `a2xb1=N`. Queen and Rook promotion are illegal because the resulting neutral slider on `b1` would still check `Kh1`; Bishop and Knight promotion are safe. Therefore `legalDests` must include `a2-b1`, and ending Black's preceding turn must not declare checkmate.

## Actual

`applyAction(... promotion: 'bishop')` succeeds, proving the move is legal, but `legalDests` omits `a2` entirely. `endTurn` then records `{ winner: 'black', reason: 'checkmate' }`.

## Minimal reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e "import {createGameState} from './src/game/state.ts'; import {applyAction,legalDests} from './src/game/reducer.ts'; let s=createGameState({fen:'8/8/8/8/8/6k1/p7/1r5K w - - 0 1'}); s={...s,pieces:s.pieces.map(p=>p.square==='a2'?{...p,neutral:true}:p)}; const bishop=applyAction(s,{type:'move',from:'a2',to:'b1',promotion:'bishop'}); const queen=applyAction(s,{type:'move',from:'a2',to:'b1',promotion:'queen'}); const afterBlack={...s,turn:{color:'black',phase:'afterMove',moveMade:true,cardPlays:{white:0,black:0}}}; const end=applyAction(afterBlack,{type:'endTurn'}); console.log(Object.fromEntries(legalDests(s)),bishop.ok,queen.ok,end.ok&&end.state.outcome)"
```

Observed output:

```text
{} true false { winner: 'black', reason: 'checkmate' }
```

## Evidence

Both Bishop and Knight promotion succeed through the action API, while Queen and Rook promotion correctly fail royal-safety validation. The destination API and adjudicator therefore disagree with the action API on the same frozen state.

## Likely root

Every promotion probe in `legalDests` hard-codes `promotion: 'queen'` (`src/game/reducer.ts:135-141`, `157-163`, and `169-175`). A destination is discarded when Queen promotion is illegal even if another allowed promotion is legal. `endTurn` relies on that incomplete map at lines 1662 and 1672.
