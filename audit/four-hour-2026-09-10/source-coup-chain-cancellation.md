# Coup chain cancellation: source-only review

Scope: Coup 1 names Pawn P, Coup 2 names Knight N, the original King K is captured, P and N survive, and Peace Talks cancels only Coup 2. No engine or test sources were consulted.

Conclusion: assuming Coup 1 remains active on surviving, eligible P and restoring P does not independently violate King safety, canceling Coup 2 must restore P as King. The prior loss of K alone does not justify rejecting this cancellation. P was the King displaced by Coup 2 and is still available; Coup 1 continues to supply P's royal status. This exact two-Coup sequence is a derivation from local rules and the publisher's single-Coup examples, not an expressly published chain ruling.

Local basis, in the frozen snapshot:

- `cards.md:157–159`: Coup acts on the current King and names a replacement. Applied twice, the first displaced King is K and the second is P; the card does not identify a permanently privileged original chess King for every subsequent Coup.
- `rules.md:217–219`: Continuing Effects remain retained while suspended and can resume.
- `rules.md:289–299`: later Continuing Effects win their conflicts; override is narrow and does not erase unrelated portions of retained earlier effects.
- `rules.md:455–457`: the replacement receives King protection; the promotion example expressly restores the previous King through remaining active Coups. Extending that retained-chain evaluation to removal of Coup 2 is an inference consistent with this explicit local instruction.
- `rules.md:463`: the prohibition is conditional on cancellation leaving the player with no King. Here P survives under Coup 1, so loss of K is insufficient to trigger it.
- `cards.md:129–131` and `rules.md:774–778`: Peace Talks removes one effect; it cannot directly cause illegal King loss. Its next-move correction provision does not permit a player to continue without a King.

Publisher evidence, from the supplied official FAQ text:

- Lines 184–188, PDF page 5: Peace Talks cannot remove a lone Coup after its Prince has been lost, because of the Checkmate Rule. This establishes the no-restorable-King exception; it does not discuss a surviving intermediate Prince under another retained Coup.
- Lines 837–840, PDF page 20: a Coup Pawn's promotion to Queen or Rook suspends Coup. The passage itself does not spell out the two-Coup restoration algorithm.
- Lines 2158–2164, PDF page 50: ending Confabulation also ends a dependent Coup and restores its Prince as King; if that Prince was captured, Peace Talks cannot remove either effect. This supports restoring the King displaced by the effect being removed, but remains a different scenario.

No direct publisher statement about the exact two-Coup chain was located in these bounded passages. No external verbatim quotation is reproduced here.

Zero White Kings with no outcome is not valid for the specified cancellation: either a legal cancellation restores P, or an independently illegal cancellation is rejected atomically. The local enemy-neutral Coup surrender exception (`rules.md:461`) explicitly has an immediate opponent victory and therefore does not support a zero-King ongoing state.

SOURCE_COUP_CHAIN_CANCELLATION_COMPLETE. Substantive source result was written before 08:47:30 UTC; final metadata clock verification was 08:47:48 UTC, 92 seconds after the recorded 08:46:16 checkpoint. Source-only review; engine probes executed: 0. The 90-second completion gate was missed; do not credit this as an on-time phase completion.
