# Earthquake oracle source scope

Source-only review; no engine or test files inspected. Sources are frozen `rules.md` and the original audit's `official-faq.txt` (publisher document, 66 printed pages). No implementation finding is asserted here.

## Coordinate transform

The proposed transforms are consistent with the local convention, for zero-based physical file/rank `(x,y)`: orientation 90 maps to `(7-y,x)`, 180 to `(7-x,7-y)`, 270 to `(y,7-x)`. Each maps the corresponding White forward vector—`(+1,0)`, `(0,-1)`, `(-1,0)`—to increasing transformed rank. Black is opposite. Their translations preserve the board bounds. Authority: rules §13.3 line 321, §14.1 line 409, and §25.9 lines 927–929. This numerical representation is the engine's explicit convention; the publisher does not define those labels or angle values.

## Pawn movement and en passant

Use transformed owner-relative first and second ranks to permit a two-square Pawn move, even after previous movement, with both crossed and destination squares empty. This is explicit in rules §13.1 lines 305–307 and FAQ printed p. 7, text lines 221–227. The FAQ also makes a two-square mover vulnerable to an opposing Pawn threatening the square immediately behind its arrival; Crabs cannot make that capture. Thus orthodox libraries' restriction to second-rank double moves is insufficient for this oracle. The local rule retains ordinary en-passant timing and geometry. The cited FAQ passage supplies geometry, not a separate timing extension. Do not turn first-rank eligibility into a permanent en-passant opportunity.

## Promotion boundaries

Rules §14.1 lines 399–407 makes rotation change last ranks and requires eligible promotions; line 407 expressly requires immediate promotion on Peace Talks reversal, the cancelling player's opponent declaring first, followed by each owner's Pawns in fixed-square order, choosing Queen/Rook/Bishop/Knight. Earlier promotions remain intact. This is an explicit local cancellation contract. Line 404 describes forward Earthquake's opponent-first order conditionally, “when the card requires that order”; the permitted source excerpts do not independently establish every forward-play declaration detail. An oracle may safely begin from a completed, fully declared rotation, but should not claim it independently validated the entire forward promotion declaration protocol from these excerpts alone. Fixed-square declaration ordering must not be replaced by transformed-frame square sorting.

## Non-Pawns and castling

Ordinary Knight, Bishop, Rook, Queen and King step/line geometry is invariant under these quarter-turn coordinate maps. Royal safety and all applicable variant conditions still need separate checks. Castling is a special case: Earthquake does not count as moving the King or Rook and does not consume their castling rights. Their original physical cells and King-toward-Rook movement remain authoritative; in the rotated oracle frame the same castling may run vertically. An orthodox library that expects castling exclusively along a rank cannot supply that result unchanged. Authority: rules §25.9 line 929; FAQ printed p. 25, text lines 1075–1080. FAQ p. 25 lines 1065–1071 also makes Rebirth's starting ranks depend on the new orientation, and lines 1084–1087 rotates the frontier.

No disagreement was found with the proposed coordinate transforms. The required oracle adjustments are first-rank double Pawn moves and preserved physical castling geometry; forward promotion-order coverage remains limited to the cited local contract.
