# Forged explicit opportunity bypasses the victim's double-step geometry

- Severity: Medium
- Area: explicit state hardening, orientation, neutral control, en-passant execution
- Audited state: current shared checkout after Round 11; production and tests remained read-only

## Rule basis

`rules.md` §13.1 allows en passant only after a Pawn on its owner's first or second rank makes a qualifying two-square forward move. Section 13.3 makes both the home rank and forward vector orientation-relative. Neutrality changes who controls or may capture a piece; it does not change either Pawn's original-owner forward direction.

An explicit opportunity must therefore prove both sides of the relationship: the target is one owner-relative step behind a Pawn now two or three steps from its home edge, and the capture uses a Pawn whose own forward diagonal reaches that target.

## Minimal reproduction: impossible victim rank

Create Black to move with a Black Pawn on `d6` and a White Pawn on `e6`, then directly provide:

```ts
state.enPassant = [{ target: 'e5', pawnId: 'white-pawn-e6' }];
```

The White Pawn is far beyond either possible final square of a first- or second-rank two-step. Nevertheless:

```text
positionFor(state).epSquare: undefined
legalDests(state).get("d6"): ["d5", "e5"]
applyAction(d6-e5): success
capturedId: white-pawn-e6
```

The stricter orthodox projection rejects the opportunity, while the custom destination/execution path honors it and captures the physical Pawn.

## Second manifestation: impossible owner-relative direction

With neutral Black Pawn `d4`, Black Pawn `e4`, and forged `{ target: 'e3', pawnId: 'black-pawn-e4' }`, `d4-e3` also succeeds and captures the same-owner Pawn. Both Pawns move south, so `e3` cannot be the square crossed by a Black Pawn ending on `e4`. The identical non-neutral control is rejected only by the ownership gate; neutrality exposes the missing victim-side geometry check.

## Controls and bounded matrix

- A valid Black `d4` capture of a White `e4` victim through `e3` succeeds and captures the named victim.
- Pawn-ID mismatch, non-Pawn, promoted Pawn, and royal-Pawn victims are all rejected.
- Current-role Pawn/original non-Pawn and unpromoted transformed original Pawn victims remain accepted, matching the identity rules.
- Eight valid orientation/owner/controller fixtures (both owners at 0°, 90°, 180°, and 270°) all appeared in `legalDests`, executed, and captured the exact named victim.
- A classic discovered-pin negative rejected en passant while the same position without the pin accepted it.
- Two simultaneous mixed-owner Annexation rights were independently advertised; claiming either captured its exact victim and expired both.
- The focused 51-test en-passant regression set passed.

## Expected

The custom path must ignore an opportunity unless its named victim is on the orientation-adjusted final square of a legal first- or second-owner-rank double-step and the target is exactly the crossed square in that victim's owner-relative direction. Rejection must remain atomic and must not suppress valid rotated, transformed, neutral, multiple, or Annexation rights.

## Root hint

`enPassantCapture()` validates the attacker's diagonal and finds the named victim behind the target relative to the attacker. It never validates the target relative to the victim's own `pawnForward(...)` vector or verifies that the victim occupies a qualifying post-double-step home distance. `syncFen()` checks only the former relationship, not the qualifying rank; internally generated opportunities are valid, but a forged explicit record bypasses both properties.
