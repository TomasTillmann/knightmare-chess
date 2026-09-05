# An unrelated move erases an off-square physical Rook's retained castling right

- Severity: Medium
- Area: castling identity, Cathedral, FEN state
- Frozen checkout: `7c7b7ccac35046b9b9eed5fa26ed89d7c75fe4d9` plus the authoritative uncommitted changes

## Rule citation

`rules.md` §6 defines a swap as an exchange rather than an ordinary move, §10 attaches state to physical-piece identity, and §20 says Cathedral exchanges the two physical pieces while preserving their identities. Section 23 makes castling availability legally relevant state. The reducer itself consequently preserves White's `A` right when Cathedral swaps the original `a1` Rook to `b2`.

## Expected

Black's later `a7-a6` Regular Move does not move either the White royal or the physical `white-rook-a1`. The retained White `A` right must therefore remain associated with that Rook on `b2`.

## Actual

Cathedral produces castling field `A`, but Black's unrelated pawn move changes it to `-`. The physical Rook remains on `b2`; no identity-relevant event explains the revocation.

## Minimal public reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e "import {createGameState} from './src/game/state.ts'; import {applyAction} from './src/game/reducer.ts'; const go=(s,a)=>{const r=applyAction(s,a);if(!r.ok)throw new Error(r.error.code);return r.state}; let s=createGameState({fen:'4k3/p7/8/8/8/8/1BP1P3/R3K3 w Q - 0 1',hands:{white:['cathedral'],black:[]}}); s=go(s,{type:'move',from:'c2',to:'c3'}); s=go(s,{type:'playCard',cardId:'cathedral',target:{rook:'a1',bishop:'b2'}}); console.log('after Cathedral',s.fen.split(' ')[2],s.pieces.find(p=>p.id==='white-rook-a1')?.square); s=go(s,{type:'endTurn'}); s=go(s,{type:'move',from:'a7',to:'a6'}); console.log('after Black move',s.fen.split(' ')[2],s.pieces.find(p=>p.id==='white-rook-a1')?.square)"
```

Observed:

```text
after Cathedral A b2
after Black move - b2
```

## Likely root

The ordinary move path serializes `position.toSetup()` at `src/game/reducer.ts:1644-1646`. `rawPositionFor` built that chessops position with `Castles.fromSetup`, which can retain rights only when a same-role Rook currently occupies the castling square; it cannot carry the right with the off-square `PieceState.id`.
