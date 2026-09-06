# Annexation serializes a transformed Pawn's right as orthodox FEN

- Severity: Medium
- Area: Annexation, transformed Pawn identity, FEN/state coherence
- Audited state: current post-Round-10 uncommitted checkout; production and tests remained read-only

## Rule basis

`rules.md` §13.5 makes a non-promoted transformed original Pawn eligible for Annexation and en passant. The explicit `state.enPassant` record is therefore correct. However, the six-field FEN can encode only orthodox board roles. Existing engine policy leaves the FEN en-passant field empty for other unrepresentable Knightmare rights (rotated rights, multiple simultaneous rights, and a neutral Pawn moved by the non-owner) while keeping the authoritative right in `state.enPassant`.

## Minimal reproduction

Start from:

```text
7k/8/8/8/1p6/8/R7/7K w - - 0 1
```

Change only the `a2` Rook's `originalRole` to `pawn` and leave it unpromoted, give White Annexation, then apply:

```ts
playCard annexation [{ from: 'a2', to: 'a4' }]
```

The direct result is:

```text
fen:             7k/8/8/8/Rp6/8/8/7K b - a3 0 1
state.enPassant: [{ target: "a3", pawnId: "white-rook-a2" }]
positionFor(...).epSquare: undefined
```

The live state correctly lets `b4-a3` capture the transformed original Pawn. The inconsistency is specifically the FEN field: it advertises an orthodox en-passant right whose board victim is a Rook, while the engine's own orthodox projection immediately discards it.

## Unconfounded control

The same physical transformed original Pawn making the same `a2-a4` displacement as an ordinary Rook move produces the same authoritative explicit right but correctly leaves the FEN en-passant field `-`. A normal current Pawn annexed `a2-a4` correctly uses `a3` in both FEN and explicit state.

## Expected

Keep the explicit `{ target: 'a3', pawnId }` right, but serialize `-` in FEN whenever the vulnerable piece's current board role is not Pawn. `state.enPassant`, `legalDests`, and exact captured identity should remain unchanged.

## Root hint

`completeReplacementMove()` checks one right, orientation `0`, and victim ownership before assigning `setup.epSquare`, but unlike `setupFor()` it does not require the on-board victim to have current Pawn role. This affects Annexation's manual replacement-move FEN path; the ordinary transformed-Pawn path already leaves the unsupported field empty.
