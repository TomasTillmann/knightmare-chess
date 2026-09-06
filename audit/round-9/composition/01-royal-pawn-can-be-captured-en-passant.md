# A royal Pawn can be captured en passant through the orthodox move path

- Severity: Critical
- Area: Coup/royal identity, Annexation, en passant, King safety
- Audited state: current post-round-8 uncommitted checkout; production and tests remained read-only

## Rule basis

`rules.md` §11 says that a King is never captured. Sections 11.6 and 13.5 require a replacement move to leave every acting royal safe, and §15.3 applies all King-protection rules to Coup's marked replacement while it retains its normal movement. Section 13.5 also makes a starting-square Pawn moved by Annexation vulnerable to en passant.

Therefore, when the marked royal is a Pawn and Annexation would leave it en-passant-capturable, the card result cannot be committed as a safe position. At absolute minimum, the following en-passant action must never capture the royal.

## Reproduction

Create White to move from:

```text
4k3/8/8/8/p7/8/1P6/4K3 w - - 0 1
```

Give White Annexation, clear both decks, mark `e1` non-royal, and mark the Pawn on `b2` royal. Then apply:

```ts
playCard annexation [{ from: 'b2', to: 'b4' }]
endTurn
move a4-b3
```

Direct-engine output:

```text
Annexation: cardPlayed
enPassant: [{ target: "b3", pawnId: "white-pawn-b2" }]
isKingInCheck(white): false
a4-b3: ok
capturedId: "white-pawn-b2"
```

The last state has the only White royal in `zone: "captured"`.

## Expected

Annexation should not commit a final position in which its moved royal can be taken en passant. Under the replacement-move safety ruling it should fizzle with `SELF_CHECK`; regardless of that adjudication detail, `a4-b3` must not capture a King.

## Actual and impact

Annexation succeeds, the royal is reported safe, the turn ends normally, and Black then captures that royal en passant. This violates the highest-priority King rule and leaves the engine with no on-board White royal.

The same defect is reachable through an ordinary first- or second-owner-rank double-step by a current-role royal Pawn; Annexation is only the shortest card composition.

## Likely root

`enPassantCapture()` explicitly rejects `victim.royal`, but that helper returning `undefined` does not reject the action. With one orthodox, orientation-zero opportunity, `positionFor()` exposes the en-passant square to chessops; `position.isLegal()` accepts the move, and the later orthodox `capturedSquare` branch removes the hidden victim without checking `captured.royal`.

Royal-safety detection also considers only ordinary attacks on the royal's occupied square, so it does not recognize en-passant capture of a royal Pawn as a threat before the turn is committed.
