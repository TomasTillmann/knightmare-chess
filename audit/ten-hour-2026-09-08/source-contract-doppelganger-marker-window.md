# Doppelganger copy window after a nonmoving marker

## Direct source evidence

- [cards.md:63](/Users/tomastillmann/Random/knightmare-chess/cards.md:63) permits a non-Pawn to move as the same kind of piece that the opponent has just moved and prohibits capture. [rules.md:668](/Users/tomastillmann/Random/knightmare-chess/rules.md:668) repeats this eligibility and recommends copying the named/base movement type rather than temporary powers, except for a permanent transformation. Neither passage says that a subsequent nonmoving card invalidates the preceding physical move.
- [cards.md:107](/Users/tomastillmann/Random/knightmare-chess/cards.md:107) directs Forbidden City to place a marker on an empty square; it does not direct any piece to move. [rules.md:409](/Users/tomastillmann/Random/knightmare-chess/rules.md:409) describes the resulting entry/transit restriction. [rules.md:141](/Users/tomastillmann/Random/knightmare-chess/rules.md:141) classifies Forbidden City as a direct state change.
- [cards.md:207](/Users/tomastillmann/Random/knightmare-chess/cards.md:207) directs Fortification to create a wall. [rules.md:415](/Users/tomastillmann/Random/knightmare-chess/rules.md:415) explicitly places it after the Regular Move, calls the selected boundary "not a piece move," and preserves the board, move counters, and en-passant opportunities.
- [rules.md:158](/Users/tomastillmann/Random/knightmare-chess/rules.md:158) distinguishes the Regular Move from an additional card play; lines 164–168 distinguish cards occurring before/after a move and effects without a piece move. [rules.md:134](/Users/tomastillmann/Random/knightmare-chess/rules.md:134) nevertheless requires printed timing and says an expired trigger cannot be used. That general rule does not identify a nonmoving marker as the event that expires Doppelganger's opportunity.
- The publisher's *Knightmare Chess: Official Rulings*, printed/PDF pp. 23–24 and 34–35, repeats a question about a King moving through check using Doppelganger or Hero Worship. Its answer allows transit through check if the turn does not finish in check. These pages establish no rule about a marker card closing Doppelganger's opportunity. They do not directly adjudicate either marker pairing.

FAQ inspected locally with `pdftotext -layout` for only those four pages: `/tmp/knightmare-engine-audit-20260909/audit/ten-hour-2026-09-08/official-faq.pdf`.

## Defensible expectation and uncertainty

After an opponent's ordinary Knight move followed by a legal Forbidden City or Fortification marker placement, the defensible source-based expectation is that the Knight remains the opponent's just-moved piece. On the next appropriately timed Doppelganger play, an eligible non-Pawn should therefore receive Knight movement without capture, subject to the resulting board restrictions and ordinary safety requirements. Marker placement supplies no replacement physical mover.

This expectation is an inference from the direct eligibility text plus the explicit distinction between piece movement and a nonmoving effect. The inspected sources do **not** explicitly require an engine to retain a particular last-mover field, define "just moved" as a formal history cursor, or directly rule on these exact pairings. Absence of an explicit closure rule is not itself an express publisher ruling that the window survives. Nevertheless, clearing the copy opportunity solely because either marker was played lacks support in these passages and conflicts with their natural piece-movement reading. The general expired-trigger rule supplies no stated basis to choose that closure event.

Scope completed: source-only review; no tests inspected, no engine or UI execution, no production edits, and no other files changed.
