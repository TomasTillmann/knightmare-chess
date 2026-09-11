# Plots / Legacy / Fog: source-only scope review

The local contract requires an uncanceled Legacy retrieval to survive Fog cancellation of an independent optional Curse, provided Legacy was eligible when Plots was played. The uncertain premise is whether the intervening optional Curse preserves Legacy's immediate capture window: the permitted source sections do not expressly settle that composition.

## Explicit local statements

- `/tmp/knightmare-engine-audit-20260910/rules.md:548` cancels only the targeted card and dependent consequences, preserving independent earlier actions unless illegal. Lines 552 and 556 preserve the countering player's independent earlier cards and an independent underlying move.
- `rules.md:566` preserves Plots' original timing window and requires each extra card to have been eligible then; it does not manufacture missing timing permission.
- `rules.md:826` requires a real qualifying non-Pawn capture, the victim still captured, and an immediate Legacy window; Plots may preserve that original window. Lines 828–830 allow retrieval of an existing owned discard and require its physical identity and the remaining discard order to survive. An unrelated intervening action closes the immediate window.
- `/tmp/knightmare-engine-audit-20260910/cards.md:251` requires Plots extras to be legal at the original moment; lines 295 and 311 respectively cancel another card's effect and return a chosen discard to hand.

## Local-contract inference

Once Legacy is legally played using the retained original capture, retrieving a discard that predates Curse is independent of Curse. Fog should retain the capture, retrieved card, Legacy expenditure and ordinary replacement draw, and Plots expenditure. Canceling Curse cannot by itself justify undoing Legacy. This does not establish that Legacy was initially eligible after Curse; that timing premise needs separate authority.

## Publisher passages

All FAQ references below mean `/Users/tomastillmann/Random/knightmare-chess/audit/ten-hour-2026-09-08/official-faq.txt`.

- Page 51, lines 2231–2244: Plots permits pairs of after-opponent-move cards or after-opponent-card cards. Its express mixed pair example is conditional on an opposing **replace-move** card. This is material: an ordinary capture followed by Curse is not that published mixed-pair example. The passage does not affirm the proposed Legacy/Fog timing, and may suggest rejecting it.
- Page 52, lines 2258–2260: Fireball uses the move preceding Plots as its qualifying move. This supports retaining an existing trigger through Plots, but does not establish that an optional opposing card left Legacy's capture trigger open before Plots.
- Page 52, lines 2264–2289: Fog may cancel Plots or either extra; a surviving third card is committed, and opposing Plots with two Fogs may cancel both extras. This supports selective cancellation, without directly deciding Legacy's eligibility in the proposed sequence.
- Page 39, lines 1672–1674: Legacy can retrieve a unique card. No additional Legacy timing or cancellation ruling appears in that Legacy section.

## Decision for audit use

Treat preservation of an **already legal** independent Legacy as the local-contract expectation. Do not present the ordinary capture → Curse → opposing Plots → Legacy → Fog composition as an unqualified publisher-confirmed legal sequence. Its critical unresolved assumption is the continued immediate capture window after optional Curse. A capture supplied by an opposing replace-move card would fit the FAQ's explicit mixed timing example more closely, provided both cards are legal and already in hand when Plots resolves.

Source-only review; no engine or test source inspected, no engine execution, and no behavioral finding established.
