# Pacifism ordinary-move oracle source scope

The proposed model is supported for ordinary moves with one nonroyal Pacifism target per player, no castling, and no other cards. Pacifist pieces remain occupied board squares, cannot capture or be captured, and produce no checking attacks. Preserve their marker through ordinary movement and promotion.

## Explicit support

- `cards.md:41–43`: the player's selected piece other than their King is marked for the rest of the game; it cannot capture or be captured.
- `rules.md:283–285` (§11.7), `rules.md:499–503` (§16.1): forbidden captures do not produce check; Pacifists neither capture nor can be captured, and do not threaten pieces.
- Official FAQ, page 46, text lines 1966–1969: a Pacifist Pawn may promote and the promoted piece remains Pacifist. This is direct support for retaining the marker on every ordinary promotion choice, not merely an identity inference.
- Official FAQ, page 47, text lines 2030–2033: Pacifism prevents check because the piece cannot threaten capture.

## Derived ordinary-chess consequences

- En passant is a capture. Therefore a Pacifist Pawn cannot make an en-passant capture, and a Pawn protected by Pacifism cannot be its victim. No explicit en-passant/Pacifism FAQ pairing was found in the narrowly relevant passages; this follows from the unconditional capture prohibition. Ordinary timing and geometry still apply to other Pawns (`rules.md:303–307`).
- Pacifism changes capture permission, not occupancy or noncapturing movement geometry. A marked piece still blocks sliding paths and Pawn advances; friendly and enemy sliders cannot pass through it. This is the ordinary rule retained by the card's limited effect, rather than a separately quoted Pacifism exception.
- Ordinary movement keeps the same marked physical piece (`rules.md:230`); no expiry condition for moving is stated. Promotion retention is separately explicit above.

## Exclusions and exceptions

- Non-capture death is possible: FAQ page 47, lines 2003–2010, permits Betrayal/Disintegration while prohibiting the listed capture effects. An oracle must not generalize capture immunity to every removal mechanism.
- Coup suspends Pacifism while the target is royal: FAQ page 47, lines 2037–2042. Page 48, lines 2057–2063, restores Pacifism when a royal Pawn's Queen/Rook promotion suspends Coup. These combinations are outside the proposed ordinary-move-only domain.
- Confabulation/cancellation has marker scope rules: FAQ page 47, lines 2014–2026. A simple square marker model must not be reused for that domain.
- FAQ page 46, lines 1988–1995: Pacifists do not trigger Man-Trap. This confirms immunity but lies outside the oracle's ordinary moves with no other cards.
- This source check establishes expected behavior only. It executes no engine probes and makes no claim about engine conformance.
