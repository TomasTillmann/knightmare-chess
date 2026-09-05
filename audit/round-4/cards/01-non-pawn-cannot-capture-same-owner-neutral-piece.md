# Non-Pawn pieces cannot capture a same-owner neutral piece

- Severity: High
- Area: Neutrality, ordinary captures, No Quarter, direct-mate adjudication
- Audited state: current shared checkout, with `src/` and `tests/` left read-only

## Rule basis

`rules.md` §15.1 says a neutral piece may be moved by either player, may capture either color, and is valid for either friendly- or enemy-piece effects. The engine already applies that same dual-sided status when a Pawn captures a neutral piece and when No Quarter classifies the captured identity. The neutral target's stored original color therefore must not make it immune to a same-color Rook, Bishop, Knight, Queen, or King.

This also matters to `rules.md` §11: a regular card must fizzle only when it truly creates board-state checkmate, after all legal neutral captures are considered.

## Reproduction

Run from the repository root:

```sh
npx tsx --eval "import {createGameState} from './src/game/state.ts'; import {applyAction,legalDests} from './src/game/reducer.ts'; const s=createGameState({fen:'7k/8/8/4N3/3B4/8/8/K7 w - - 0 1',hands:{white:['no-quarter']}}); s.pieces.find(p=>p.square==='e5').neutral=true; console.log(legalDests(s).get('d4')); console.log(applyAction(s,{type:'move',from:'d4',to:'e5'}));"
```

The position contains a White Bishop on `d4` and a White-origin neutral Knight on `e5`. White controls the Bishop and must be able to capture the neutral Knight with `Bd4xe5`.

## Expected

- `legalDests(state).get('d4')` includes `e5`.
- `applyAction({ type: 'move', from: 'd4', to: 'e5' })` succeeds.
- Move history records `white-knight-e5` as the exact captured identity, making an immediately held No Quarter playable against it.

## Actual

- `legalDests` omits `e5`.
- The same direct move returns `ILLEGAL_MOVE`.
- No capture event exists, so No Quarter cannot follow.

A same-position Pawn control (`Pd4xe5`) is both listed and accepted, and No Quarter then succeeds. An opposite-origin neutral target is also capturable. The breakage is specific to a non-Pawn attacker and a neutral target whose stored owner equals the attacker.

## Likely root

The normal non-Pawn path delegates occupancy and pseudo-destination generation to chessops with the original piece colors. Chessops correctly treats the same-color occupant as friendly, but Knightmare neutrality overrides that classification. The reducer has custom exhaustive handling for neutral movers and Pawns, while the non-neutral non-Pawn path has no corresponding neutral-target capture route. Consequently `applyAction`, `legalDests`, direct-mate probes, and No Quarter eligibility all lose the same legal capture.
