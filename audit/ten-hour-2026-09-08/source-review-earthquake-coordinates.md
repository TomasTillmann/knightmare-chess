# Earthquake coordinate-source review

Sources: `cards.md`, Earthquake; `rules.md` §14.1 and §25.9; publisher `official-faq.pdf`, printed page 25, extracted with `pdftotext -layout`. No engine, UI, or test sources were inspected.

Assume White stays seated south of the table, files initially increase east, ranks initially increase north, and clockwise is viewed from above.

- **Coordinates attached to the board:** pieces retain their square coordinates during rotation. After a clockwise quarter-turn, the board's increasing-file direction points south. White therefore advances toward **decreasing files**, since forward remains away from the seated owner. Black advances toward increasing files. Counterclockwise reverses these directions.
- **Coordinates fixed to the table:** White still advances toward increasing ranks and Black toward decreasing ranks. The pieces' coordinates must rotate instead: with zero-based `(file, rank)`, clockwise maps `(x, y)` to `(y, 7-x)`. For example, `a2` becomes `b8`. Physical board-attached features require the same coordinate transformation.

The card specifies physical rotation and owner-relative pawn movement, not an API coordinate system. The publisher's printed page 25 says Earthquake does not consume castling rights, castling can consequently occur along a file, and the frontier changes. Its Rebirth wording identifies the two ranks now in front of the player. These describe physical outcomes without defining an engine representation; the castling file/rank language is consistent with table-relative notation.

The repository recommends table-fixed coordinates and separate orientation state (§14.1, §25.9), while §14.1 also says pawn forward direction changes. With stationary players, that change must be expressed in board-relative coordinates; it does not describe a change in table-relative forward. This leaves a representation distinction that an API contract must make explicit.

**Conditional conclusion:** clockwise plus unchanged piece coordinates requires White's forward direction to become decreasing files under the board-attached convention. Clockwise under the table-fixed convention requires rotating piece coordinates and retaining White's increasing-rank forward direction. These sources alone do not establish which convention the public engine API actually uses, so this review makes no engine bug claim.
