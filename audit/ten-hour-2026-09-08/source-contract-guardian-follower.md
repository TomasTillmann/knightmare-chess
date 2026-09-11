# Guardian source contract

Sources inspected: `cards.md` Guardian paragraph, all Guardian mentions in `rules.md`, visually verified Guardian artwork `final_cards/KC2_card3.png`, and publisher FAQ pages 33 and 7. One FAQ keyword search found only the page-33 Guardian capture ruling. No engine or test sources inspected.

| Question | Source-grounded conclusion |
| --- | --- |
| Is a follower optional? | **Explicit yes.** The card says the piece behind the Pawn “may follow.” No follower is required to play Guardian. |
| May a follower have an arbitrary ordinary movement type? | **Explicitly unrestricted by type, with the movement consequence inferred.** The card identifies the player's piece directly behind the Pawn, without naming a role. Following keeps it immediately behind the Pawn; therefore a Knight may follow by the same forward displacement despite its ordinary move geometry. General constraints such as ownership, check safety, or an overriding continuing effect are separate questions. |
| Is a two-square Guardian move without a follower immune to en passant? | **No explicit unconditional immunity established.** The protection sentence follows the optional follower instruction and says the Pawn is “thus” protected. The natural geometric explanation is that the follower occupies the en-passant destination. With no follower, that protection is absent. FAQ page 7 says a two-square Pawn advance is vulnerable to a Pawn attacking the square behind its new position. This supports allowing en passant when no follower accompanies Guardian, but this exact Guardian case is not expressly adjudicated in the searched FAQ. Treat it as a strong interpretation, not a verbatim ruling. |
| May Guardian advance two squares from the first rank? | **Not settled expressly for Guardian.** The card specifically grants two squares from the second rank. FAQ page 7 generally grants any Pawn a one- or two-square advance from the first or second rank. Applying that general ruling to Guardian would permit the first-rank double; giving the card's stated second-rank condition restrictive force would reject it. The reviewed sources do not directly resolve that interaction. Do not elevate either implementation into an unqualified defect based only on these texts. |

FAQ page 33 explicitly forbids Guardian's Pawn from landing on an occupied square. Local `rules.md` classifies Guardian as a replacement move and includes it among multi-piece cards, but supplies no additional Guardian-specific follower, en-passant, or first-rank rule. The artwork confirms replacement-move timing and matches the local card paragraph.

Publisher source: https://www.sjgames.com/knightmare/KnightmareChess_FAQ.pdf

SOURCE_GUARDIAN_FOLLOWER_DONE
