# Forbidden City independent-oracle scope

Source-only review, 2026-09-10. No engine or test sources inspected.

The proposed two-marker oracle is supported for ordinary movement with no later cards or castling. `cards.md:105–107` explicitly places a marker in an unoccupied square, prohibits entry and traversal for the rest of the game, and permits Knights and other jumping pieces to pass over it. `rules.md:417–419` explicitly repeats entry/traversal blocking, the Knight-style jump exception, and sliding-path blocking even when the destination lies beyond the marker.

- Reject every move whose destination is marked, including a Knight landing there. Jump permission concerns passing over, not landing.
- Reject sliders with a marked intermediate square. Reject a Pawn double step over a marked intermediate square; this is a direct application of the universal traversal prohibition, rather than a separately printed Pawn example.
- Ordinary Knight jumps remain available when their landing square is clear. Do not invent a straight intermediate path for a Knight.
- Suppress sliding attacks through marked squares. This follows from the traversal prohibition plus `rules.md:283–285`, which defines check through legal capture capability rather than unrestricted geometry.
- Keep markers on their original squares during ordinary movement and promotion. The card marks an empty square, not a physical piece, and says the restriction persists. This persistence under unrelated ordinary moves/promotions is an inference from that explicit square attachment.

Publisher FAQ pp. 30–31 (`official-faq.txt:1329–1351`) explicitly says placing Forbidden City on an adjacent square does not close clear diagonal vertices. Therefore do not make the square's corners or neighboring diagonal crossings into extra barriers. Page 31 (`:1355–1371`) explicitly blocks Irresistible Force entry and distinguishes a Forbidden City square from an adjacent Fortification boundary as two obstructions for Bombard. These support square-level occupancy/traversal semantics; those cards are outside the proposed oracle.

The same obstruction check applies to first-rank and second-rank Pawn double steps. Publisher FAQ p. 7 (`official-faq.txt:221–227`) explicitly permits both regardless of prior movement and gives en-passant eligibility. An orthodox oracle must preserve those variant rights independently; Forbidden City adds no exception to the ban on traversing its square. In en passant, the capturing Pawn's destination cannot be marked, even though the removed victim occupies another square.

The supplied text does **not establish Forbidden City's printed Continuing Effect classification or timing**. `rules.md:90–96,145–147` expressly bases that classification on the printed label and warns against inferring metadata from persistence prose. `cards.md:105–107` and `rules.md:417–419` omit the label/timing. Consequently this review cannot certify that the initial Forbidden City play may directly cause mate. General rules are explicit: regular cards may check but not directly mate (`rules.md:234–250`); Continuing Effects may participate in mate (`:258–260`); publisher FAQ p. 3 (`official-faq.txt:70–83`) confirms both distinctions. Establish the actual card label/timing from artwork in a separate allowed review before making an initial-play mate assertion. Avoid check or mate during oracle setup, so this metadata gap does not undermine the later ordinary-movement comparison.

After the two markers are validly installed, ordinary moves may deliver check or mate under the blocked geometry. End-state adjudication must still consider actual playable cards (`rules.md:262–269,834`), so the proposed no-later-cards phase should actually have no eligible hand resources if it compares game outcomes, rather than merely choosing never to play them.

No later cancellation, Earthquake, transformation, card-granted jump, Fortification, castling, or duplicate-marker interpretation is certified by this restricted oracle. Square corners do not become independent blocked boundaries. No engine probes were executed in this source review.
