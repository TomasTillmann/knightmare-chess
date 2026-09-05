# Exported `positionFor().isCheck()` disagrees with reducer check legality

- Severity: Medium
- Area: public engine API, Neutrality, check reporting
- Frozen checkout: `29ae7f671f1ce6e636b2112dd4f19ec19198677c` plus the authoritative uncommitted changes

## Rule citation

`rules.md` §15.1 says a neutral piece can be moved by either player, can check either King, and must be evaluated using legal capture capability. Section 15.3 similarly makes the `royal` marker, not the ordinary King role, authoritative after Coup.

## Expected

Public check reporting must agree with reducer legality. In the position below the White-owned neutral Bishop on `a8` can be controlled by Black and legally capture `Kh1`; Black's King on `g7` remains safe. White is therefore in check.

## Actual

`positionFor(state, 'white').isCheck()` returns `false`, while `applyAction(state, { type: 'endTurn' })` rejects with `KING_IN_CHECK` on the same state. Production `ChessBoard.tsx:31-34` uses the exported projection to decide which color is in check, so this disagreement is externally visible rather than a private diagnostic distinction.

## Minimal reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e "import {createGameState} from './src/game/state.ts'; import {applyAction,positionFor} from './src/game/reducer.ts'; let s=createGameState({fen:'B7/6k1/8/8/8/8/8/7K w - - 0 1',phase:'afterMove',moveMade:true}); s={...s,pieces:s.pieces.map(p=>p.square==='a8'?{...p,neutral:true}:p)}; const end=applyAction(s,{type:'endTurn'}); console.log(positionFor(s,'white').isCheck(),end.ok?null:end.error.code)"
```

Observed output:

```text
false KING_IN_CHECK
```

## Evidence

The reducer's identity-aware check logic correctly recognizes this neutral attack, so the discrepancy is isolated to the exported chessops projection. Equivalent disagreements occur after Coup because chessops follows `role === 'king'` rather than `PieceState.royal`.

## Likely root

`positionFor` at `src/game/reducer.ts:80-89` projects only piece role and original owner into chessops. Neutral control and royal identity are intentionally handled later by private `isRoyalInCheck`/`isKingInCheck` at lines 447-471, but that authoritative result is neither exported nor used by the board's check display.
