# Madman source contract

Inspected `cards.md` Madman, `final_cards/KC3_card2.png` visually, all Madman mentions in `rules.md`, and one case-insensitive keyword search of the publisher FAQ PDF. The FAQ search returned no matches. No engine or tests were inspected.

The artwork agrees with the card text and adds the timing footer: play instead of the move. Explicit behavior: one owned pawn jumps diagonally over either side's pieces; multiple jumps and changes of diagonal direction are allowed; jumped pieces remain uncaptured.

| Question | Source result |
| --- | --- |
| Must a sequence continue while another jump exists? | No explicit requirement. The permissive wording allows multiple jumps; a mandatory maximal sequence would require importing a checkers convention. |
| May the same piece be jumped twice? | Unspecified. Unlike a checkers capture, the jumped piece remains present. The card gives no once-per-piece restriction. Allowing repetition is a plausible literal reading, but not expressly ruled. |
| May a landing square be revisited? | Unspecified. The card states no visited-square restriction. Inferring such a restriction from a particular checkers ruleset is unsupported by the inspected sources. |
| Does final-rank landing promote? | No promotion instruction appears on the card or the inspected Madman-specific rules. Applying the separate general rule for promotion by replacement movement requires that source; the Madman text alone does not settle it. |

The sole local `rules.md` mention recommends checking a wall for every segment (line 421); it adds no continuation, repetition, or promotion rule. “King in a game of checkers” leaves the checkers variant unidentified, so jump distance and any imported repetition/capture obligation need an explicit project convention. No variant-specific restriction should be treated as a confirmed defect solely from these sources.

SOURCE_MADMAN_DONE
