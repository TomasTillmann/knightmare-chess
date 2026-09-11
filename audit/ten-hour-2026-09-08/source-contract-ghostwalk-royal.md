# Ghostwalk and Coup royalty: source contract

Scope: sources only; no engine or test inspection. Question: does Ghostwalk categorically exclude a royal Bishop or royal Pawn created by Coup?

**Conclusion:** The examined sources do not impose a categorical royal-piece exclusion on Ghostwalk. A Coup royal Bishop, or a royal Pawn with an otherwise available two-square forward move, is eligible to pass through friendly pieces to a safe empty destination. This is the combined application of the two card texts and local rules, not an explicitly published Ghostwalk/Coup example.

## Source evidence

- `cards.md:113–115`, Ghostwalk: selection is one of the player's pieces, with no King exclusion. It permits passage through friendly pieces, forbids passage through enemy pieces, prohibits capture, requires an empty destination, and preserves other movement legality.
- Preserved `artwork-ocr.json`, entry `ghostwalk`, artwork `/KC8_card1.png`: the OCR matches those restrictions and prints **Play instead of your move.** The entry's separate `timing` metadata says `beforeMove`; that metadata is not the printed instruction and is not evidence for the card's timing. Nothing in the OCR excludes royalty.
- `cards.md:157–159`, Coup, and artwork `/KC10_card4.png` OCR: the marked replacement keeps its standard move while becoming King. Coup excludes a Rook or Queen as its replacement target, not a Bishop or Pawn.
- `rules.md:445–449`, §15.3: the marked replacement retains ordinary movement; King protections and check/checkmate rules apply to it.
- `rules.md:670`, §21: Ghostwalk modifies obstruction rules while retaining other move legality and requiring an empty destination.
- `rules.md:421–423`: passage through pieces does not grant passage through a Fortification wall. This is an independent limitation, not a royal exclusion.
- `rules.md:269–273`, §11.6: final acting-King safety and the atomic replacement-move fizzle rule still apply.

The complete preserved official FAQ was searched for Ghostwalk and Coup. The only Ghostwalk answers are on PDF pages **13 and 33**: when Bog responds to Ghostwalk, the first empty square is the first square of its move. Neither answer excludes royalty. Coup-related answers on pages **20, 48 and 64** expressly permit a later Warlord movement effect on a Coup King. Page 64 also allows Warlord to pass through attacked squares provided its destination is safe. These answers reject the idea that royal status by itself bans movement cards, but they are supporting analogies rather than a direct Ghostwalk ruling.

Official FAQ source: [Steve Jackson Games, Knightmare Chess Official Rulings](https://www.sjgames.com/knightmare/KnightmareChess_FAQ.pdf), preserved locally as `official-faq.pdf` (66 pages). No external content was fetched for this review.

## Concrete source-derived cases and limits

- A Coup royal Bishop on c1, friendly piece on d2, and empty e3 may Ghostwalk c1–e3 if the final position is safe and no other restriction applies. Its retained Bishop geometry supplies the move; Ghostwalk supplies passage through d2.
- A Coup royal Pawn on its second rank may use an otherwise legal two-square forward move through a friendly piece on the intermediate square to an empty destination. The Pawn's forward direction and eligibility for that two-square move remain requirements. A one-square forward move cannot end on the occupied blocker.
- An ordinary King generally gains no useful passage from Ghostwalk because its ordinary one-square move has no intermediate square. That geometrical fact cannot justify rejecting every royal piece, because Coup retains Bishop/Pawn movement. This review makes no claim about Ghostwalk enabling an ordinary King's castling through occupied squares.
- Capture, enemy blockers, unsafe final royal positions, and independently forbidden paths remain prohibited. No direct published Ghostwalk/Coup example was found; the conclusion is strong textual inference from consistent local rules and printed effects.

Review inspected only the specified source materials and this report. No engine behavior or test sources were inspected.

GHOSTWALK_ROYAL_SOURCE_DONE
