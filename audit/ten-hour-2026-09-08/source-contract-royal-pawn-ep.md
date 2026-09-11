# Royal Pawn and en passant: source-only review

First source-grounded conclusion: publisher FAQ pages 20–21 and 43–44 explicitly allow a Pawn carrying Coup to promote and explicitly prohibit capturing a King without first putting it into check (page 44). These pages contain no explicit ruling about a royal Pawn making a two-square move through a square where an opposing Pawn could capture en passant. Applying King safety to that special capture therefore requires an inference, to be distinguished from an express Coup ruling.

Explicit evidence:

- `cards.md`, Coup: the marked replacement keeps its standard movement and becomes the King; checkmating it wins. `rules.md` §15.3 expressly transfers all King protection and check/checkmate rules to that piece.
- `rules.md` §13.1 permits a Pawn on its owner's first or second rank to move two squares through an empty path, regardless of earlier movement, and preserves ordinary en-passant vulnerability. The one permitted FAQ keyword search found the same general ruling in the publisher's Specific Pieces section (page 7): a Pawn threatening the square behind the double-step destination may capture en passant. It contains no royal-Pawn exception.
- FAQ pages 20–21 and 43–44 preserve Pawn promotion under Coup, with Coup suspended on Rook/Queen promotion. Thus Coup does not generally erase Pawn-specific powers.
- FAQ page 44 expressly forbids capturing a King without first putting it into check. It does not authorize an otherwise dangerous King move merely because executing the capture is forbidden.

Derived interpretation: a royal Pawn retains the two-square move in principle. When the resulting position gives an opposing Pawn an en-passant threat against that royal Pawn, the royal Pawn is unsafe even though its destination square is not attacked by ordinary diagonal Pawn geometry. Under the combined local rules, that position cannot be accepted as a completed safe turn without removing the threat through an otherwise lawful escape. Actual execution must never capture the royal Pawn. Treating royal immunity as eliminating the threat would also erase the purpose of ordinary King attack detection.

This is a strong composition of general rules, **not an explicit publisher ruling on royal en passant**. The relevant threat is the possible removal of the royal Pawn from its final square, not merely crossing an attacked intermediate square. The inspected sources do not explicitly resolve royal-Pawn en-passant check representation, pinned capturers, or the exact timing of any card rescue; no firm claim about those details is made.

No production or test sources inspected; no engine behavior claimed.

SOURCE_ROYAL_PAWN_EP_DONE
