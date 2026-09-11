# Plots → Vulture → Fog source review

Source-only review; no engine or test sources inspected.

The current local contract requires preserving the countering player's independent earlier card consequences. In the stated sequence Fog cancels White's Curse, not Black's Vulture; the extra Vulture deck expenditure therefore remains consumed. The local instruction not to retain Vulture's extra cost applies when Vulture itself is the canceled card.

## Controlling local contract

- `rules.md:548`: cancellation reaches the targeted card and dependent consequences; independent earlier actions survive unless illegal.
- `rules.md:550`: Plots can preserve the original opposing-card response window. The stated sequence targets White's original physical Curse despite Black's first extra Vulture.
- `rules.md:552`: restore reversible effects, retain only ordinary expenditure of the *canceled* physical card, spend/replace Fog once, and preserve the countering player's independent earlier cards. The sentence naming removal of Vulture's extra cost concerns canceled Vulture; it does not authorize refunding an uncanceled Vulture.
- `rules.md:554–556`: individual cancellation within Plots preserves valid independent card consequences and does not automatically cancel unrelated cards.
- `rules.md:562–566`: Plots itself is spent/replaced once; both extras must have been eligible originally, but each still pays its costs when executed. This scenario supplies original eligibility for both responses.
- `cards.md:137–139`: Vulture retrieves the last opponent card and requires discarding the next undrawn card with separate decks. `cards.md:249–251` permits two originally legal extra plays. `cards.md:293–295` cancels one card's effect and discards the two canceled/canceling cards.

Thus, with Black's next deck cards labeled A/B/C/D/E, the specified successful sequence consumes A as Plots's replacement, B as Vulture's extra discard, C as Vulture's replacement, and D as Fog's replacement, leaving E next. Fog must not put B into Black's hand or leave D undrawn merely by reconstructing earlier ordinary expenditures. Curse's ordinary expenditure/replacement remains consumed; its continuing effect is removed.

## Publisher evidence and limits

Source: `/Users/tomastillmann/Random/knightmare-chess/audit/ten-hour-2026-09-08/official-faq.txt`.

- FAQ p. 50, lines 2168–2171: Vulture may retrieve an active Continuing Effect; a proxy continues separately and may later be canceled.
- FAQ p. 51, lines 2231–2244: Plots permits two responses to the opponent's card play, subject to eligibility when Plots was played.
- FAQ p. 52, lines 2264–2289: Fog may cancel individual cards in a Plots trio; cancellation of the second card commits the same third card, and opposing Plots with two Fogs can cancel both opposing extras.

The examined publisher material contains no explicit Plots → Vulture → Fog accounting example. Preservation of the uncanceled Vulture cost follows the current local rollback contract plus its printed mandatory cost, not an exact publisher card-pair ruling. Fog's treatment of the already-transferred physical Curse is less cleanly resolved by the publisher passages: Vulture's proxy rule separates the physical card from its effect, while printed Fog discards both cards. The local `rules.md:552` explicitly puts the canceled physical card in its respective player's discard, but an issue should focus on the unambiguous loss/refund of Black's uncanceled Vulture cost and shifted draw sequence, not assert a publisher-settled ownership outcome for Curse.

No conflicting edition text was identified in the permitted excerpts. No engine or test sources were inspected, and no engine probes were executed in this source-only phase.

**Conclusion:** source support is sufficient to require preserving Vulture's extra expenditure and ordinary replacement when Fog cancels the earlier Curse. A demonstrated refund of that expenditure is a current-local-contract correctness finding. Publisher support for the exact composition is inferential rather than explicit.

SOURCE_PLOTS_VULTURE_FOG_COMPLETE
