# Dark Mirror / Breakthrough source contract

Source-only review; no engine execution, production inspection, or test-source reading. Repository citations refer to `/Users/tomastillmann/Random/knightmare-chess/{cards,rules}.md`; `artwork-ocr.json` and `official-faq.pdf` are beside this report. PDF citations use printed page numbers, matching `pdftotext -f/-l`. **Direct** means stated by a source; **inference** means a combined interpretation; **unresolved** is not a confirmed engine defect.

## Printed card requirements

| Card | Direct contract | Source |
| --- | --- | --- |
| Dark Mirror | One of your Pawns captures diagonally backward instead of forward, on this move. | `cards.md:101–103`; `artwork-ocr.json:862` |
| Breakthrough | One of your Pawns captures forward; it cannot move forward without capturing. If that Pawn already could capture forward for any reason, the card instead permits a diagonal capture. | `cards.md:145–147`; `artwork-ocr.json:877` |
| Both | Play instead of your move. | Raw artwork OCR at `artwork-ocr.json:862,877` |

**Metadata conflict:** both records label their timing `beforeMove` (`artwork-ocr.json:858–860,873–875`), contradicting their own raw printed OCR. Use the printed replacement-move instruction as the source contract; do not treat that metadata as independent authority.

## Identity and orientation

- **Direct:** a transformed piece retains its original type for applicable cards; a Crab can be affected by Pawn cards (`rules.md:216–224`; FAQ p.8). A composite moves, captures, and is affected as either component (`cards.md:111`; `rules.md:453`). These are target-eligibility statements, not blanket permission to override continuing restrictions.
- **Direct:** forward and backward follow the current board orientation and the Pawn's owner; Earthquake rotates the relevant ranks (`rules.md:313–315`). A neutral Pawn still moves away from its owner's home row (FAQ p.43; `rules.md:435`). Control does not reverse its direction.
- **Direct:** copying another piece's movement does not change physical type or unrelated powers (`rules.md:672`; FAQ p.40, Masquerade/Bog ruling). **Inference:** movement copying alone neither creates Pawn eligibility nor erases an original Pawn's eligibility. The Crab FAQ does not explicitly adjudicate whether an already promoted Pawn remains eligible for either capture card; that extension is **unresolved** here.

## Capture geometry and compulsory capture

- **Direct:** Dark Mirror remains diagonally backward under New Tactics and Phalanx; neither converts it to straight backward (FAQ p.22).
- **Direct:** Breakthrough permits a two-square forward capture by a Pawn on its home rank (FAQ p.14). A blanket one-square limit contradicts this ruling. General Pawn rules permit initial-style movement on the owner's first or second rank regardless of earlier movement and retain path clearance (`rules.md:299`; FAQ p.7). **Inference:** combining those rules admits the corresponding two-square Breakthrough capture with an empty intervening square; the destination must contain a capturable victim. The FAQ's explicit example says “home rank”; applying it to both eligible ranks is the combined inference.
- **Inference:** Dark Mirror grants a one-step diagonal-backward capture, preserving ordinary Pawn capture distance; neither card grants arbitrary distance or permission to jump an intervening obstruction (`rules.md:291–293`). The printed directions do not grant quiet substitute moves. Breakthrough explicitly requires capture for forward movement; applying a capture requirement to its alternate diagonal branch and to Dark Mirror follows their capture-only grant and replacement-move timing.
- **Direct:** Vendetta requires a legal capture if available, including a capture that escapes check; a player need not play a card solely to enable a capture (`cards.md:51`; `rules.md:556–558`; FAQ p.63). **Inference:** merely holding either card does not create a mandatory ordinary capture. Neither card authorizes ignoring capture immunity or King safety; Truce defeats Vendetta by removing legal captures (FAQ p.63).

## Crab and composite limits

- **Direct:** a Crab moves and captures one square diagonally forward, explicitly promotes on the last rank, and cannot take a two-square opening move or capture en passant (`cards.md:99`; artwork OCR `:847`; FAQ p.21). Pawn-card targetability alone does not restore those lost abilities.
- **Direct:** a named transformation such as Crab affects only its own component of a composite; other continuing effects generally affect the whole composite (FAQ p.49). A two-Pawn composite is still one board piece, moved once by a Pawn card (FAQ pp.9,18–19).
- **Inference:** a Pawn/Rook or Pawn/Queen composite has forward-capture capability through that component, so Breakthrough's “for any reason” conditional is relevant; checking only a bare Pawn's normal attack pattern would omit this source interaction. **Unresolved:** whether “could already capture” means inherent currently permitted geometry or an actually available legal capture in the current position is not directly specified.
- **Unresolved:** Crab's “only forward” conflicts with Dark Mirror's backward permission under the continuing-effect priority rule (`rules.md:283–293`). Likewise, Breakthrough's use of “forward” does not expressly classify a Crab's diagonally-forward capture as the conditional's forward capture. No directly applicable FAQ ruling was found. Targetability is established, but these conflict resolutions must be labeled interpretations rather than alleged explicit rulings.

## Promotion boundary

- **Direct:** Confabulated Pawns cannot promote (`cards.md:111`; FAQ p.7). Pawn movement borrowed from another piece does not promote unless the responsible card explicitly allows it (FAQ p.8). Ordinary Pawn moves promote; movement by another means requires explicit permission (`rules.md:305–309`). Neither capture card expressly mentions promotion.
- **Inference from the local general rule:** treating either special capture as movement by another means disallows promotion, including Breakthrough arrival on the last rank. **Unresolved in the official FAQ:** no card-specific promotion ruling was found; the “as another piece” FAQ alone cannot establish this because neither card says the Pawn becomes or moves as another named piece. Breakthrough's treatment as an altered normal Pawn capture versus another means needs an explicit project interpretation. Crab's separate promotion permission and the composite's explicit prohibition must also be considered rather than erased by a blanket card-move rule.

Review complete. This contract identifies source obligations and interpretive gaps only; it makes no claim about current engine compliance.
