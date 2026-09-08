Public repro 090 accepts Winged Victory returning white-pawn-f2 to e5 after White captured that Pawn with Assassin. Rule §654 requires an acting player's captured original Pawn; the card's additional wording, "which your opponent has captured", excludes this self-capture. The captured zone alone does not establish opponent capture provenance. This is a verified eligibility defect.

Implemented optional physical-piece capture provenance at the shared loss function, explicit reaction/effect actors, clearing on restoration, and Winged Victory eligibility. Existing snapshots without provenance retain support; an unambiguous recorded card actor recovers the public reproduction's legacy Assassin capture.

Validation: typecheck passes. Four public eligibility probes pass (legacy self-capture and explicit self-capture rejected without mutation/spending and omitted from targets; opponent capture and unknown historical capture accepted, returned provenance cleared). Five public capture/cancellation probes pass (own and neutral opposing Assassin targets with Fog rollback, regular capture followed by opponent Riposte, Man-Trap owner attribution, and latest recapture replacing stale provenance).

The supplied black-box suite currently reports 0 pass / 1 fail at action 19 because its complete physical-identity expectation rejects the additive capturedBy field. This precedes the original action-81 eligibility failure and requires a separate test-only compatibility phase; no test source was inspected or changed. No full engine or UI tests or commits were run in this phase.

Two additional Doomsayer probes pass: effect owner White and effect owner Black each receive capture attribution when White speaks during Black's turn. Total directed public probes: 11. Production diff whitespace validation passes.

Parent follow-up: fresh test-only compatibility review retained existing identity
assertions and added capture actors. It exposed the same self-capture eligibility
defect in iteration 017, now corrected at action 26 with original artifacts kept.
The new provenance lifecycle also required No Quarter to clear the field on death;
three public capture/No Quarter/Fog rollback probes passed. A separate fresh
test-blind review corrected Hostage to preserve the original attacker, including
legacy history recovery (see verify-hostage-provenance.md).

Parent final gate: 4994 engine tests passed, zero failures, 29.511 seconds;
typecheck passed. Scope includes numbered iterations through 090 plus accepted
092 and 093; the separately committed 091 finding remains pending. Production-only
commit: b5f0ab1. The iteration 090 targeted regression rejects action 81 without
changing state or spending the card; the original suffix remains unapproved.
