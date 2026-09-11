# Neutrality and a pre-existing Knight check

Scope: whether neutralizing an existing checking Knight removes that check merely because the Knight's original owner's King is independently checked. No engine or test source inspected or executed. Sources are the current local rules/cards and the saved publisher FAQ; no external text is quoted verbatim here.

## Controlling text

- `/Users/tomastillmann/Random/knightmare-chess/cards.md:285–287` and `rules.md:437`: a neutral piece remains capable of checking either King. Neutrality alone grants control to both players; it does not expressly prohibit the former attack.
- `rules.md:443`: applying Neutrality neither moves nor captures the target and preserves its position, movement powers, and original ownership. Eligibility excludes royal and Queen components of a composite. A Knight-containing composite therefore needs the other component checked independently for eligibility.
- `rules.md:273,277,445`: an illegal ordinary move needs a same-turn cure; the final after-move Neutrality result must satisfy the acting King's safety. Continuing Effect status permits mate, but does not expressly waive this safety requirement.
- `rules.md:124,285`: threats depend on capture capability under current restrictions, rather than geometry alone. These broad clauses create an interpretive question about whether ordinary King-safety illegality belongs inside the threat calculation.
- `rules.md:441`: moving a neutral piece cannot leave the acting player's King in check; both Kings must be evaluated after a neutral move. This cannot simply mean that both Kings must always be safe, because the adjacent explicit rule allows a neutral piece to give check.
- `/Users/tomastillmann/Random/knightmare-chess/audit/ten-hour-2026-09-08/official-faq.txt:1806–1822`, publisher pages 42–43: the Neutrality/Dungeon ruling distinguishes the two players' control. The piece can check the King of the player who is forbidden to move it, but cannot check the other King when the required opposing controller is forbidden to move it. This explicitly establishes controller-specific threat suppression for Dungeon.
- The immediately following Neutrality questions, FAQ lines 1826–1887, pages 43–44, concern Pawn direction, Doomsayer, Bribery, Peace Talks, Coup, and moving a neutral piece back. None addresses a pre-existing independent check or a pinned neutral attacker. A focused search found no pinned-piece wording in this FAQ extract.

## Narrow conclusion and uncertainty

**The supplied clauses do not explicitly decide this exact checking-Knight rescue. Do not classify its acceptance or rejection as a publisher-confirmed bug from these sources alone.**

The direct reading of the card is that the Knight still attacks the acting King: neither its square nor attack powers changed, and it may check either King. An independent check against the other King does not expressly erase that attack. Under this reading, Neutrality is not a valid cure, and the turn cannot finish in the original check.

A competing inference follows the broad capture-capability wording and the Dungeon example: if every hypothetical capture by the neutral piece must be a legal move for the opposing controller, an independent check against that controller's King could prevent the capture and suppress the threat. Extending a card-imposed movement ban to ordinary self-check or pins is an inference; the publisher's Dungeon answer does not state that extension.

Pinned neutral pieces raise the same unresolved distinction: a real neutral move exposing its mover's King is expressly illegal, but the sources above do not expressly say whether that illegality suppresses attacks used to determine King safety. Treating every such attack as a fully legal move can also make check evaluation depend on the other King's existing check; that consequence is not itself ruled on here.

Recommended audit classification: **qualified rules ambiguity**, with the exact position retained and the engine behavior reported separately. A definitive correctness oracle requires an explicit local decision about ordinary pins/pre-existing checks in neutral threat evaluation, or a more specific authoritative ruling.

Source review started 2026-09-10 08:42:57 UTC; final content verified at 08:44:01 UTC (64 seconds). SOURCE_NEUTRAL_CHECK_RESCUE_COMPLETE.
