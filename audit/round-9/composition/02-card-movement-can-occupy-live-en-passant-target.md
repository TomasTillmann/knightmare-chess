# Card movement can leave a live en-passant target occupied

- Severity: High
- Area: Cowardice, Annexation, en-passant lifetime, FEN/state coherence
- Audited state: current post-round-8 uncommitted checkout; production and tests remained read-only

## Rule basis

`rules.md` §13.11 says Cowardice does not create or expire an en-passant opportunity. Sections 13.5 and 20 make Annexation's selected relocations simultaneous and preserve the en-passant vulnerability of each qualifying starting-square Pawn. Ordinary en passant requires the capture destination to be empty; a state cannot simultaneously describe that empty target and an on-board occupant there.

## Minimal Cowardice reproduction

Give White Cowardice in this position:

```text
7k/8/8/8/3p4/8/4P3/K3p3 w - - 0 1
```

Then apply:

```ts
move e2-e4
playCard cowardice [{ from: 'e1', to: 'e3' }]
endTurn
```

Both actions are individually legal: `e2-e4` creates the `e3` opportunity, then Cowardice moves the Black Pawn across the vacated `e2` onto `e3`.

Direct-engine output after Cowardice:

```text
fen: 7k/8/8/8/3pP3/4p3/8/K7 b - e3 0 1
enPassant: [{ target: "e3", pawnId: "white-pawn-e2" }]
positionFor(...).epSquare: e3
piece on e3: black-pawn-e1
```

After `endTurn`, Black's adjacent Pawn on `d4` cannot play `d4-e3`; it receives `ILLEGAL_MOVE` because its own non-neutral Pawn occupies the advertised target.

## Annexation composition

The same invariant break occurs within one atomic Annexation. White can control a neutral Black Pawn and simultaneously play `e2-e4` and `e5-e3`, because both paths and destinations are empty in the initial position. The result publishes the same occupied `e3` en-passant target. If the Pawn on `e3` is neutral, `d4-e3` succeeds as an ordinary capture of that occupant (`black-pawn-e5`) instead of en passant against the recorded victim (`white-pawn-e2`).

## Expected

The engine must resolve this interaction deterministically without publishing a live en-passant opportunity whose target is occupied. The current rules do not say whether the card destination should be disallowed or whether the en-passant clause needs a special conflict ruling; that missing adjudication is itself observable undefined behavior. Whichever ruling is chosen, FEN, `state.enPassant`, `legalDests`, and the captured identity must agree.

## Actual and impact

The reducer commits a six-field FEN and authoritative opportunity naming one victim while a different piece occupies the target. Depending on that occupant's neutrality, the same coordinates either reject or capture the wrong physical piece. This can change legal replies and therefore checkmate/stalemate adjudication.

## Likely root

En-passant creation/preservation never checks target occupancy after card movement. `setupFor()` validates target rank, victim, color, and the vacated origin square, but not `board.has(epSquare)`. `playAnnexation()` derives opportunities independently from each initial move, while Cowardice's `syncFen()` preserves a still-positioned victim even after another Pawn enters its target.

Cowardice therefore shares this root directly; its separate promise not to expire the opportunity makes it the simplest reachable reproduction.
