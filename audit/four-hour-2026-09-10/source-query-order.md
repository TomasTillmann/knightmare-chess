# Move-list ordering scope

Source-only review of frozen `rules.md` §§13.5–13.7, §20, §22.7, and §25.7, plus `cards.md` Heresy and Haunting Memories text. No engine, test, or harness sources inspected.

Annexation, Forced March, and Onslaught explicitly choose every destination before movement, validate against the initial position, and resolve the complete selection simultaneously. Reordering the same valid physical-piece-to-destination assignments therefore must preserve acceptance, resulting board, King safety, expenditure, and turn consumption. This is a semantic comparison, not a requirement that serialized arrays use identical ordering. Annexation's independent en-passant opportunities may likewise be compared as a set while preserving every opportunity's contents.

Passing in the Night explicitly exchanges all selected distinct Pawn pairs simultaneously (§20, line 680). Pair-list order is immaterial for the same complete assignment; each pair's acting-player/opposing-player selection contract and all identities must remain intact. It is a non-move swap, so arrival-trigger ordering should not be invented here.

Heresy is different: §20, line 670 explicitly orders the opponent's Bishops before the acting player's Bishops, with the latter options computed on the updated board. Never commute those two phases. Within a phase, §25.7 supplies a recommended plural-movement default, but the cited Heresy paragraph alone does not explicitly promise that individual Bishop choices commute. The preserved card text (`cards.md`, lines 29–31) requires each Bishop that can move to an adjacent empty square to do so and expressly orders the opponent first; it does not settle whether one Bishop may use another's vacated square within a side's phase. A within-phase permutation check is supported when choices do not depend on earlier results and the complete assignment remains legal under the applicable phase's starting position; treat broader invariance as a local interpretation, not a publisher-guaranteed rule.

Haunting Memories copies the previous card's text and classification (§22.7, lines 782–784), so a legal copy inherits that card's simultaneous or sequential ordering. Preserve the copying card's physical identity and expenditures; copying is not permission to flatten Heresy's phases or normalize unrelated history, discard, promotion, or response-order arrays.

No source defect is asserted. The four explicitly simultaneous cards provide strong semantic permutation probes; unrestricted array commutativity does not follow.
