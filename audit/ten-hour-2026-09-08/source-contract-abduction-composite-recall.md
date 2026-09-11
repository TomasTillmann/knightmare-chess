# Abduction composite recall source contract

Scope: source-only review of local rules and card text; no engine or test inspection.

The authoritative local recall sentence is explicit: a guess uses the **displayed current role** and **original owner**, and it additionally requires the exact physical `pieceId` when the removed piece is composite or has a piece-bound marker (`rules.md:616`). Omitting the ID in those cases is an incorrect answer. A correctly shaped wrong guess resolves as failure; malformed, mistimed, repeated, or wrong-player input leaves the pending challenge unchanged.

A composite is selected as one board piece and all physical components are handled together (`rules.md:614`). A correct answer restores that same piece and every component with transformations and markers preserved; a wrong answer or timeout captures them together (`rules.md:618`). These clauses do not expressly say that naming either component's role or ID is an acceptable alternative to the displayed piece's identity.

## Eligibility and accepted recall fields

| Removed object or guess | Contract supported by the local text | Strength / limit |
| --- | --- | --- |
| Ordinary unmarked, nonroyal opposing piece | Recall its displayed current role, original owner, and former square; `pieceId` is optional. | Explicit at `rules.md:614,616`. |
| Temporarily transformed piece | Recall its displayed current role, rather than substituting its original role; use its original owner. | Explicit role/owner instruction at `rules.md:616`; transformations are preserved on restoration at `rules.md:618`. |
| Neutral piece | It may qualify for selection; recall still uses original owner. | Explicit at `rules.md:614,616`; control alone does not replace the required owner field. |
| Marked physical piece | Correct role, owner, and square are insufficient without its exact physical ID. | Explicit at `rules.md:616`; omission is incorrect, not malformed. |
| Composite with different component roles | One selected board piece is concealed; all its components move together; exact physical ID is mandatory along with displayed current role, original owner, and former square. | Explicit aggregate handling and field requirements at `rules.md:614,616,618`. |
| Composite guess omits `pieceId` | Incorrect answer, even if the remaining fields match. | Explicit at `rules.md:616`. |
| Composite guess supplies only the away component's role | No explicit alternate-role acceptance rule is given. | `rules.md:616` says displayed current role; the relationship between that singular display and Confabulation's two identities is unspecified. |
| Composite guess supplies the away component's physical ID | The text does not expressly define whether that ID counts as the selected board piece's exact ID. | The requirement is explicit; mapping the composite's carrier/other constituent to the required ID is not. |
| Guess supplies either constituent's matching role/ID pair | No express rule guarantees that both pairs are valid memory guesses. | Confabulation's general dual-type card eligibility is insufficient by itself to settle the recall-answer schema. |
| Any composite with a royal component | Ineligible for Abduction. | Explicit at `rules.md:614`. |

## Reconciliation and unresolved detail

`cards.md:237–239` asks the opponent to state what piece was removed and which square it occupied. It does not mention machine IDs, original ownership fields, transformations, or composites. These are elaborated by the local Abduction rule.

`cards.md:109–111` and `rules.md:451–453` say the merged piece can move, capture, and be affected by cards as either component. This clearly supports dual component eligibility for a card targeting a piece type. It does **not expressly state** that a memory answer naming either constituent is correct. `rules.md:455–465` labels its further composite occupancy/capture/return provisions recommended rulings that need confirmation against the full official ruling.

The local Abduction requirement is therefore strongest for **displayed current role + original owner + exact identity when required**. It does not name a “carrier” or “away component,” specify which physical ID represents a composite in this answer, or define a two-component display convention. If a display presents a single carrier role and physical ID, matching those fields follows the literal singular wording, but making that display convention authoritative is an interpretation. Conversely, accepting both constituent identities would also require an explicit composite recall clarification. Source text alone cannot establish that accepting or rejecting the alternate constituent is an implementation defect.

No engine behavior, tests, or implementation were inspected. Source review only; no bug conclusion.

ABDUCTION_COMPOSITE_SOURCE_DONE
