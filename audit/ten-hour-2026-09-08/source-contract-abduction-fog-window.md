# Abduction / Fog of War response window

**Conclusion: the local engine contract requires the normal Fog of War opportunity after each of the three completed challenge outcomes, subject to ordinary card allowance and game-state eligibility.** The sources inspected do not establish an exact published Abduction/Fog ruling for waiting until the memory answer or timeout.

## Local contract

- `rules.md:616` expressly models a valid answer and recall timeout as resolution; malformed, mistimed, repeated, and wrong-player responses do not resolve the challenge.
- `rules.md:618` expressly distinguishes correct restoration from incorrect-answer or timeout capture. All three are completed outcomes.
- `rules.md:620` then states, without an outcome exception: “A resolved challenge leaves the normal after-move card-response window available.” Resolving the challenge is part of Abduction itself, not an unrelated intervening action.
- `rules.md:528` makes Fog an immediate opposing-card response and explicitly permits it before Abduction's mandatory choice is answered. Its unrelated-action exclusion does not identify required reveal, answer, or timeout as unrelated actions. Read together with §19.2, the pre-answer permission is an additional opportunity, not an explicit restriction to pre-answer cancellation.
- `rules.md:530–534` defines restoration and expenditure on cancellation; even an already-fizzled card may be countered. Thus a correct answer with no lasting board change is not by itself a reason to refuse Fog. Card allowances, other independently consumed response opportunities, and a genuinely ended game still require their usual eligibility checks.

| Completed outcome | Local Fog opportunity | Consequence if cancellation is otherwise legal |
| --- | --- | --- |
| Correct answer | Required by the unqualified resolved-window provision | Cancel Abduction while retaining both ordinary card expenditures; ordinarily no captured piece needs restoration. |
| Incorrect answer | Required by the same provision | Undo the capture and dependent effects, preserving the independent earlier Regular Move where legal. |
| Recall timeout | Required by the same provision | Same cancellation treatment as an incorrect answer. |

## Printed cards and publisher FAQ

Printed-art OCR reviewed: `final_cards/KC15_card4.png` (Abduction), `final_cards/KC19_card2.png` (Fog of War), via the existing `artwork-ocr.json`. Abduction is played after the mover's move and sets out the timed memory challenge, restoration for correct recollection, and capture otherwise. Fog is printed for immediate use after an opponent plays a card and cancels the opposing card's effect. Neither printed card explicitly discusses whether the responder may learn the challenge result before choosing Fog.

The preserved publisher FAQ's Abduction entry (page 9, repeated Doomsayer interaction on page 23) covers immediate looking away and the ordering of naming a piece with Doomsayer. It contains no Abduction/Fog ruling in those entries. Generic Fog/Plots timing on pages 29–30 permits backing up rushed card play and identifies Fog as the card-canceling response; it does not settle post-answer Abduction timing. Therefore classify any blanket post-resolution rejection as a **local-contract discrepancy**, not as an explicitly adjudicated published pairing.

Scope: source-only review; no production or test source was read, and no engine behavior was inferred from tests. Reviewed two local rule sections, two card effect bodies, two printed-card OCR entries, and the FAQ's Abduction entries plus generic Fog timing.

ABDUCTION_FOG_SOURCE_DONE
