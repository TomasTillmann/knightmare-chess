# Royal immunity source contract

Source-only review; supplied engine observations are not independently verified. Sources inspected: `rules.md` §§15.3, 16.3, 22.1; `cards.md` Mystic Shield and Fireball entries; `official-faq.pdf` complete printed pages 5, 20, and 29. No engine or test source was read.

## Mystic Shield rejects a moved King

- **Local requirement:** `rules.md:494` requires a nonroyal physical piece. This explicitly prohibits selecting the actual King, including the King relocated by castling. The supplied rejection is required by that local target restriction.
- **Card wording:** `cards.md:283` protects the piece just moved, requiring selection of one if multiple pieces moved. It contains no King or royal exclusion.
- **Publisher ruling:** FAQ p.5 explicitly permits moving a King into check and playing Mystic Shield. FAQ p.29 explicitly permits shielding either the King or Rook after castling. Both directly contradict the local nonroyal exclusion.
- **Implementation versus local spec:** No discrepancy in the supplied observation.
- **Local spec versus publisher:** Confirmed discrepancy. Correcting publisher fidelity requires revising the local eligibility contract before changing implementation; treating the King rejection alone as an implementation defect would misclassify the finding.

## Fireball captures a Prince and permits a Prince center

- **Local requirement:** `rules.md:702` permits one actually moved nonroyal piece as center and expressly excludes a capturable Prince *that did not move*. `rules.md:704` captures the center and adjacent pieces, except Kings, royal-containing composites, and other capture-protected pieces. Under §15.3 (`rules.md:447`), Coup makes the original King a capturable Prince and transfers King protection to the replacement King. Together these clauses require capturing an otherwise unprotected adjacent Prince and permit an otherwise eligible moved Prince as center. This behavior is covered by the general eligibility/capture rules, not left unspecified. Neither permission is unconditional: movement, timing, capture protection, and final-position requirements still apply.
- **Card wording:** `cards.md:303` exempts Kings, but says nothing expressly about Princes. The card alone leaves the Prince interpretation unresolved; ordinary capturability does not settle a card-specific exemption.
- **Publisher ruling:** FAQ pp.20 and 29 explicitly say that a Prince is immune to Fireball and cannot trigger it. This is an exception for Fireball even though Coup makes the Prince ordinarily capturable.
- **Implementation versus local spec:** No discrepancy in either supplied behavior, assuming the Prince has ceased to be the royal King and the other eligibility conditions hold.
- **Local spec versus publisher:** Confirmed discrepancy for both Prince blast immunity and center eligibility. Correcting publisher fidelity requires adding the Prince exception to the local Fireball contract and then aligning implementation.

## Evidence scope

The two `cards.md` entries are the inspected card-text evidence. Per the bounded textual-comparison assignment, original artwork was not independently inspected. The publisher FAQ independently resolves both disputed royal-immunity cases.
