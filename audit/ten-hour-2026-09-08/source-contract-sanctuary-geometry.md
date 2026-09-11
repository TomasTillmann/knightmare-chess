# Sanctuary geometry source contract

Sources: `cards.md` Sanctuary; `rules.md` §13.12 only.

K = starting King square; d = unit direction toward Rook. Final Rook = K+d; King = K+2d.

| Case | Required result | Basis |
| --- | --- | --- |
| Rook adjacent | Rook stays; King jumps beyond it. | Explicit |
| Rook two squares away | King occupies vacated Rook square; Rook occupies intervening square. | Derived from explicit destinations/vacancy rule |
| Horizontal or vertical, either direction | Same formula applies. | Explicit rank/file eligibility; directional inference |
| Diagonal alignment | Ineligible. | Explicit |
| End of board | Ineligible if either destination falls outside board. | Explicit |
| Piece between starting pieces | Ineligible. | Explicit |
| Occupied destination after selected starts vacate | Ineligible; no capture. | Explicit |
| King initially checked / crossed square attacked | Permitted provided final King is safe. | Explicit |
| Final King checked | Replacement-move fizzle applies. | Explicit |
| Forbidden King destination | Still forbidden despite jumping. | Explicit |
| King/Rook moved; castling rights absent | Eligible regardless of history/rights. | Explicit |

Rook straight-path restrictions apply. Atomic relocation preserves identities/markers; movement limits/arrival effects concern pieces actually moving. Success revokes King's castling rights.

SOURCE_SANCTUARY_GEOMETRY_DONE
