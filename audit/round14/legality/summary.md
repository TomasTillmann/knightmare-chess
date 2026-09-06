# Round 14 legality audit — no confirmed bugs

## Result

Zero concrete rule breakages, inconsistent outcomes, or unexpected exceptions were confirmed in this audit.

## Scope

Read-only, direct-programmatic review covered:

- ordinary movement legality and reducer acceptance;
- royal safety, neutral attackers/movers, and neutral royal pieces;
- Chess960/castling aliases, transit safety, and physical-rook rights;
- en-passant identity, victim geometry, occupied targets, royal victims, and rotated Pawns;
- normal promotion/underpromotion and orientation-adjusted promotion lines;
- transformed/current/original piece identity and Pawn orientation;
- check, direct-card-mate rejection, apparent-mate escape adjudication, and rollback; and
- Assassin geometry, ownership/neutrality, self-capture lifecycle, no-promotion semantics, castling-right consequences, FEN/clocks, input purity, malformed targets, direct mate, and checked-player escape discovery.

`rules.md` and Assassin's printed artwork/text were treated as authoritative. In particular, an Assassin Pawn reaching its last rank remained a Pawn because Assassin does not authorize promotion.

## Probes

- 6,320 randomly walked orthodox positions and 195,747 chessops-legal moves checked for reducer acceptance.
- 55,908 randomized Assassin source/target action probes over 10,000 arbitrary piece/identity/orientation records.
- 274,400 independent-oracle Assassin mover/victim geometry comparisons across all four board orientations, including transformed, promoted, neutral, and royal identities.
- 11,382 enumerated legal Assassin executions checked for exact mover/victim identity preservation, captured-zone lifecycle, card spend/draw, move consumption, zero halfmove clock after capture, cleared en passant, synchronized FEN/board state, actor royal safety, rollback, and input immutability.
- 19 malformed Assassin target shapes checked for clean rejection without mutation or exception.
- 811,008 exhaustive square-pair Assassin action attempts over 99 valid randomized mate/escape states, with 99 end-turn adjudication comparisons and 473 successful Assassin results independently checked against the direct-mate prohibition.
- 144 focused regression entries passed for Assassin, Chess960 castling/transit/aliases, forged and occupied en-passant state, royal/transformed Pawn en passant, neutral royal safety, direct-mate neutral replies, position contracts, and rotated ordinary Pawn movement/promotion.

One temporary harness failure was traced to the audit script omitting a mandatory promotion choice for an orthodox Pawn move. It was corrected and was not an engine defect.
