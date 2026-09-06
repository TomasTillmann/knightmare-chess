# Cowardice can silently expire the live en-passant victim

- Severity: High
- Area: Cowardice, neutral Pawn control, en-passant lifetime
- Audited state: current post-Round-9 uncommitted checkout; production and tests remained read-only

## Rule basis

`rules.md` §13.11 explicitly says that Cowardice does not create or expire an en-passant opportunity. Section 15.1 also makes a neutral piece a valid target for both friendly- and enemy-piece effects. Therefore, a neutral Pawn which the acting player just double-stepped is a valid opponent-Pawn target for Cowardice, but resolving Cowardice must not silently erase the live en-passant right.

The printed Cowardice card adds only that the backward path and destination must be empty. It does not cancel en passant.

## Minimal reproduction

Create White to move with Cowardice in hand:

```text
7k/8/8/8/3p4/8/4P3/K7 w - - 0 1
```

Mark the White Pawn on `e2` neutral, then apply:

```ts
move e2-e4
playCard cowardice [{ from: 'e4', to: 'e2' }]
endTurn
```

After `e2-e4`, the engine correctly records:

```text
fen: 7k/8/8/8/3pP3/8/8/K7 b - e3 0 1
enPassant: [{ target: "e3", pawnId: "white-pawn-e2" }]
```

Cowardice nevertheless succeeds, spends the card, returns that same physical Pawn to `e2`, and produces:

```text
fen: 7k/8/8/8/3p4/8/4P3/K7 b - - 0 1
enPassant: []
legalDests(d4): [d3]
```

Black has lost the immediately available `d4xe3 e.p.` reply solely because Cowardice erased its right.

## Expected

The engine must preserve the explicit Cowardice en-passant guarantee. Under the invariant policy already used for Cowardice landing on a live en-passant target, the coherent minimal resolution is to reject moving the live victim itself without spending the card.

## Actual and impact

The card is accepted and committed, then the right is silently deleted. This changes a legal reply and can change check escape, checkmate, and stalemate adjudication.

## Likely root area

`cowardiceDests()` excludes a destination equal to a live en-passant target, but does not exclude a source whose piece ID is the live `pawnId`. `playCowardice()` then calls `syncFen()`, whose consistency filter removes the right after the victim is relocated. The filter correctly prevents stale state, but Cowardice should have rejected the incompatible target before resolution.
