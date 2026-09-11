# Hostage checking the capturing player

Reviewed only `cards.md` Hostage and `rules.md` lines 170–196, 228–279, 776–789.

**Explicit local text.** Printed Hostage substitutes a Pawn and returns the captured piece to its square. It supplies no check or turn-boundary exception. Section 11.2 permits regular-card check, while §11.6 expressly says that, once the Regular Move has been made, a regular card leaving the acting King in check has no board effect: spend/discard/replace it and restore the pre-card position. Section 8.4 requires the acting King's safety after all effects resolve. Section 22.11 preserves turn owner, phase, and move status, and does not roll back the capture or grant an extra Regular Move. Its named fizzle conditions address newly mating the opponent and newly exposing the reacting King; they do not expressly address nonmating check against the capturing, acting player.

**Application / inference.** In the supplied scenario, Black is the acting player and has completed its Regular Move. Applying §11.6's general post-move wording to White's regular reaction requires Hostage's board effect to fizzle. Section 11.2 permits check generally but does not supply a post-move safety exception. Nothing in the reviewed text authorizes a second Black move or carrying Black's check across the turn boundary. This is a direct application of a general local rule; the Hostage-specific paragraph does not independently settle this exact case or expressly restrict §11.6 to cards played by the acting player.

SOURCE_HOSTAGE_CHECK_DONE
