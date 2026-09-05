# Castling follows the old King role instead of Coup royal identity

- Severity: High
- Area: Coup, ordinary castling, FEN castling state
- Frozen checkout: `29ae7f671f1ce6e636b2112dd4f19ec19198677c` plus the authoritative uncommitted changes

## Rule citation

`rules.md` §15.3 says the original King becomes a capturable Prince and the marked replacement becomes the new King while retaining its ordinary movement. All King protection and checkmate rules transfer to the marked piece. Section 21's anti-exploit principle says King-like movement geometry does not grant unrelated castling rights. Ordinary chess also permanently removes castling availability once the King moves.

## Expected

After Coup, the non-royal Prince on `e1` may make one-square King-geometry moves but may not castle `e1-g1`. Any residual castling availability must be tied to the marked royal identity; if the marked King moves, it cannot remain in the FEN/repetition state.

## Actual

With `e1.royal = false` and `b2.royal = true`, the reducer:

1. lists and accepts `e1-g1`, moving the Rook to `f1` as a castle by the Prince; and
2. accepts the marked royal Pawn's `b2-b3` move while preserving `KQ` in the resulting FEN.

The two results expose the same identity error: castling is derived from `role === 'king'`, not from the `royal` marker that Coup makes authoritative.

## Minimal reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e "import {createGameState} from './src/game/state.ts'; import {applyAction,legalDests} from './src/game/reducer.ts'; const mark=s=>({...s,pieces:s.pieces.map(p=>p.square==='e1'?{...p,royal:false}:p.square==='b2'?{...p,royal:true}:p)}); let a=mark(createGameState({fen:'4k3/8/8/8/8/8/1P6/4K2R w K - 0 1'})); let b=mark(createGameState({fen:'4k3/8/8/8/8/8/1P6/R3K2R w KQ - 0 1'})); const castle=applyAction(a,{type:'move',from:'e1',to:'g1'}); const moved=applyAction(b,{type:'move',from:'b2',to:'b3'}); console.log(legalDests(a).get('e1'),castle.ok,castle.state.fen,moved.ok&&moved.state.fen)"
```

Observed essentials:

```text
... 'g1' ...
true 4k3/8/8/8/8/8/1P6/5RK1 b - - 1 1
4k3/8/8/8/8/1P6/8/R3K2R b KQ - 0 1
```

## Evidence

The first result is a two-piece castle performed by a capturable Prince. The second result retains both castling bits after the marked King moved. This also leaves legally relevant repetition state wrong under `rules.md` §23, which explicitly includes King/Prince identity and castling availability.

## Likely root

`positionFor` builds `Castles` from chessops' role/color board at `src/game/reducer.ts:80-89`, which cannot see `PieceState.royal`. The ordinary move path uses chessops' castling result, and line 1624 invokes the identity-aware `revokeCastlingRights` only when the mover is neutral, not whenever it is royal.
