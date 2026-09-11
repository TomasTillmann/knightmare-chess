# Cancellation restoration — source-only review

Canceling an ordinary capture should restore the captured transformed piece with its special powers. The rulebook expressly preserves special powers when a captured transformed piece is immediately rescued by a card; restoring its marker and associated active effect is a practical inference needed to represent that expressly preserved state. The cited cancellation FAQ does not separately enumerate rollback of markers or effect-card locations.

If the canceled turn was the player's only legal escape from check, and no different legal replacement turn exists, cancellation cannot validly force a checkmate: the Checkmate Rule makes a regular card that directly causes checkmate ineffective. Applying that general rule to cancellation is an inference, not an explicit cancellation-specific ruling in the supplied FAQ passages.

Sources: `cards.md`, Chaos / Knightmare! / Think Again!; `official-faq.pdf`, printed pp. 16–17 and 37–38; `official-rulebook.pdf`, Transformed Pieces and The Checkmate Rule. This review reads no engine implementation or test sources.

## Express text and derived conclusions

- **Cards:** All three named cards cancel the opponent's move, require a different move with the same or another piece, and permit retrieving a played card (`cards.md:289`, `:305`, `:317`). An ordinary capture is a move and has no stated exception.
- **Timing and replacement:** The FAQ says these cards act after the entire turn, including optional card play (pp. 16, 37). A replacement may use the same card or a different card (p. 37). It must differ in board state, disregarding off-board captured/dead assignments; changing only an unrelated card or the route is insufficient (pp. 17, 38).
- **Transformation preservation:** The rulebook, PDF p. 1, Transformed Pieces, expressly says a transformed piece rescued by a card on the capture move or following move retains its special powers. It also describes a marker under the piece and an optional matching marker on the transformation card. Ordinary-capture cancellation occurs within that immediate-rescue window. Returning the victim to its prior square follows from canceling that capture; retaining transformed powers has direct textual support. Restoring the representation of those powers, including markers and any associated continuing-effect attachment, is justified but is not a separately spelled-out rollback procedure.
- **Check restrictions:** The rulebook, PDF p. 2, The Checkmate Rule, gives its prohibition precedence over card text. A regular card that directly causes checkmate has no effect but is still played, discarded, and replaced by drawing a card. The FAQ, p. 37, independently says a king may not end its turn in check.
- **Only escape:** If no different legal replacement turn exists, making the escape unavailable would directly produce the prohibited checkmate situation. Therefore the cancellation should have no effect, with its card handled as above. This applies the general Checkmate Rule; none of the selected FAQ passages expressly names this scenario.

## Limits and ambiguity

“Only escape” must mean the only legal complete turn, taking applicable card play into account. The only ordinary chess move out of check does not by itself establish that cancellation has no effect: a different replacement turn might use a card to escape. The supplied passages do not define an algorithm for establishing that absence, nor explicitly classify denial of the sole escape as direct checkmate. The ineffective-card conclusion is the strongest harmonized reading, with that classification remaining an inference.

The sources support preserving the transformed identity and powers; they do not specify every historical or bookkeeping field to restore. The immediate-rescue rule should not be generalized into retaining powers after a later return, which the same paragraph expressly distinguishes.
