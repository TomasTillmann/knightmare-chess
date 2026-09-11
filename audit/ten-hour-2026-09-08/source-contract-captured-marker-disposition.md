# Captured marker disposition: source contract

Local `rules.md` §10 explicitly retains an active Continuing Effect card beside the board and suspends it when its initial condition fails; removal requires Peace Talks or explicit cancellation. The same section explicitly preserves a captured transformation if rescued during that move or the immediately following move, and returns a later rescue as its original type. These are distinct rules: transformation persistence does not by itself prescribe the physical card's discard timing.

No engine behavior or bug is asserted here.

## Publisher findings

The official rulebook, PDF page 1, separately states the general Continuing Effect suspension rule and the transformed-piece rescue exception. The latter explicitly preserves special powers for rescue on the capture move or the following move; a later return uses the original type. Page 2 defines a move as a piece displacement, potentially a Regular Move or a card-specified move. However, it does not map that rescue sentence to turn counters, endTurn, multi-move card sequences, or a rescue card played after the following displacement. Those exact implementation boundaries remain underspecified.

The Paladin/Revelation answer appears on FAQ PDF pages **16, 49, and 55** (printed page labels agree). It explicitly says the suspended Paladin remains in play until the piece is captured or removed, when Paladin is discarded, or the piece becomes a Knight again. This is a concrete capture-discard exception for that card interaction. It does **not** independently state that every Continuing Effect must be discarded upon any target capture. Generalizing it beyond cards with matching expiry text would be inference.

The preserved artwork OCR supplies crucial duration lines omitted from several bodies in `cards.md`:

| Card / artwork | Explicit duration | Consequence supported by sources |
|---|---|---|
| Crab / KC7_card1.png | Until captured or promoted | Capture is an explicit printed expiry; rulebook's immediate transformation-rescue exception must also be honored. |
| Curse / KC11_card1.png | Until affected piece captured | Capture ends this effect; ordinary temporary absence is different. |
| Neutrality / KC18_card4.png | Until neutral piece lost | Capture/loss ends it; local §15.1 expressly discards the marker and prevents rescue reviving it. |
| Fatal Attraction / KC16_card2.png | Until magnet moves or is captured | Either stated event ends it. |
| Confabulation / KC7_card4.png | Until combined piece lost | Composite capture/loss ends this effect. Local §15.4 separately recommends returning original components independently. |

These conclusions use the stored card-art OCR, not a new visual reread of those five images. FAQ page 49 also expressly distinguishes named Crab transformation from other Continuing Effects on a composite: Crab applies only to its component; ordinary effects apply to the composite, and Peace Talks restores their prior applicability. That answer concerns merger/cancellation, not physical-card disposition on capture.

## Exact limits of the contract

Crab **powers** surviving immediate rescue are explicit through the named-transformation rule and Crab's definition. Keeping the physical Crab card outside the discard pile for the entire rescue interval is **not** explicit. The sources do not choose between deferred discard, discard followed by restoration, or another bookkeeping representation that preserves the required rescued powers. After that interval, later return loses the temporary transformation, but the exact physical-card discard checkpoint is likewise not specified independently of the printed capture expiry.

Accordingly, do not classify mere Crab-card retention during the immediate rescue window as a demonstrated bug. Nor infer all effects must survive capture from the general suspension sentence: the five printed duration lines establish explicit expiry exceptions, and Crab additionally has a rescue-powers exception. Whether an immediately discarded Crab can be retrieved while its transformation is still eligible for rescue, and how that interacts with physical-card uniqueness, are unresolved by the reviewed passages.

Reviewed: local §§10, 15.1, 15.4–15.5 and the five card bodies; official rulebook both pages; targeted full-PDF FAQ searches and pages 16, 20, 48–49, 55; five artwork OCR entries. No engine or test source inspected. CAPTURED_MARKER_SOURCE_DONE.
