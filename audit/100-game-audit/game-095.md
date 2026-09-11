# Game 095 — seed 908095

## Pre-run hypotheses and invariants

- Each accepted action must preserve a valid board and engine state.
- Turn changes, card timing, king safety, and game termination must follow the authoritative rules.
- The bounded seeded run is evidence for one trajectory only; a timeout is not a defect.

## Single-run result

Exactly one `generateTrace(908095, 20, progress)` invocation; no replay or second game. The helper completed 20 ordinary moves and 51 accepted actions, with no failure in its retained FINAL record. Both saved-fixture scaffold executions passed: 4 probes each, zero findings (8 total, including 6 rejected-action immutability checks).

The callback enforced 80 accepted actions / 15,000 ms. The complete generated output was consumed in a tool call whose combined display was truncated before it was stored. Exact elapsed milliseconds, complete accepted trace, sampled-card counts, and early transition evidence are therefore unavailable. This is an audit evidence failure and incomplete coverage, not an engine defect. Rejected candidate count is not exposed by generateTrace. The 45-second report target was exceeded while diagnosing evidence loss; initial scaffold was run promptly after protocol read, but assignment-relative exact timing was not captured.

## Exact initial options

Recovered solely by the helper's deterministic catalog shuffle, without constructing or replaying any game. Standard starting board and normal beforeMove defaults apply.

```json
{"hands":{"white":["revenge","tournament","doppelganger","haunting-memories","passing-in-the-night"],"black":["riposte","betrayal","panic","peace-talks","confabulation"]},"decks":{"white":["madman","annexation","squaring-the-circle","pacifism","ghostwalk","doomsayer","chaos","holy-quest","split-knight","riposte","panic","man-trap","anathema","holy-war","hidden-passage","disintegration","plots-within-plots","merciless","treason","coup","resurrection","neutrality","crusade","breakthrough","crab","heresy","betrayal","fortification","lost-castle","forbidden-city","think-again","assassin","confabulation","fireball","challenge","rebirth","toll","charge","onslaught","under-elf-hill","guardian","irresistible-force","bombard","winged-victory","sanctuary","vendetta","figure-dance","fatal-attraction","evangelists","hostage","earthquake","long-jump","mystic-shield","dark-mirror","curse","fanatic","cathedral","vulture","peace-talks","truce","forced-march","siege","bog","masquerade","dungeon","fog-of-war","dubbing","evil-eye","man-of-straw","blessing","cowardice","no-quarter","abduction","knightmare","legacy"],"black":["sanctuary","doomsayer","holy-war","vendetta","mystic-shield","forbidden-city","resurrection","bog","forced-march","challenge","blessing","guardian","madman","assassin","man-of-straw","heresy","anathema","under-elf-hill","neutrality","merciless","lost-castle","squaring-the-circle","plots-within-plots","dark-mirror","fanatic","dubbing","truce","earthquake","breakthrough","cowardice","ghostwalk","treason","passing-in-the-night","coup","pacifism","tournament","legacy","doppelganger","hidden-passage","revenge","figure-dance","bombard","winged-victory","long-jump","fog-of-war","charge","toll","chaos","vulture","disintegration","crusade","crab","knightmare","annexation","dungeon","no-quarter","think-again","fireball","onslaught","cathedral","evil-eye","rebirth","holy-quest","abduction","split-knight","curse","fortification","evangelists","haunting-memories","hostage","man-trap","siege","fatal-attraction","irresistible-force","masquerade"]}}
```

## Retained accepted action trace

Steps 1–43 were lost from displayed output. No invented reconstruction is substituted. Surviving sequential actions:

| Step | Ordinary move count | Accepted action |
| --- | --- | --- |
| 44 | 17 | move a3 → a6 |
| 45 | 17 | endTurn |
| 46 | 18 | move g8 → e7 |
| 47 | 18 | endTurn |
| 48 | 19 | move e8 → d8 |
| 49 | 19 | endTurn |
| 50 | 20 | move c1 → d2 |
| 51 | 20 | endTurn |

Observed card coverage in retained state: White discard contains Passing in the Night, Madman, Tournament, Annexation; White Pacifism remains active on white-pawn-f2 (at f4); Black Confabulation remains active for black-pawn-b7 / black-pawn-a7. These are evidence of six played card names; exact earlier play actions and sampled counts were lost.

Final FEN: `1nbk1q1r/3qNp1p/rppPp3/8/5P1R/2P4N/P1pBP3/R2QKB2 b Q - 4 13`.

## Three independent post-run critical transition reviews

These are post-run semantic reviews, separate from the pre-run invariant predictions and from automated digests.

1. **Step 44, rook movement with persistent effects.** Before: `1nb1kqNr/3q1p1p/1ppPp3/8/5P1R/r1P4N/P1p1P3/R1BQKB2 b Qk - 0 11`. After: `1nb1kqNr/3q1p1p/rppPp3/8/5P1R/2P4N/P1p1P3/R1BQKB2 w Qk - 1 12`. Rules §1 preserves ordinary chess; §16.1 / cards.md Pacifism restricts only its marked piece's captures. The a3 rook's a4/a5 path and a6 destination are empty; neither persistent effect forbids this rook relocation. Observed physical delta moves only black-rook-a8 from a3 to a6; no capture, one halfmove increment and Black fullmove increment. Matches these rules.

2. **Steps 46–47, knight move and handoff.** Before step 46 is the preceding after-FEN. After: `1nb1kq1r/3qNp1p/rppPp3/8/5P1R/2P4N/P1p1P3/R1BQKB2 b Qk - 2 12`. The white Knight g8→e7 is a normal (2,1) jump to an empty square; physical identity white-knight-b1 and the unrelated Confabulation/Pacifism markers persist, consistent with §1 and §10. Step 46 leaves White in afterMove; step 47 changes to Black beforeMove, resets card allowances, and leaves the board unchanged, consistent with §8's response window and following turn. No mismatch observed.

3. **Steps 48–49, King safety and castling loss.** Before step 48 is the preceding after-FEN. After: `1nbk1q1r/3qNp1p/rppPp3/8/5P1R/2P4N/P1p1P3/R1BQKB2 w Q - 3 13`. The King takes one empty adjacent square e8→d8. White Knight e7 attacks c8/g8 rather than d8; White's d-file Queen is blocked by its d6 Pawn; neither White Bishop nor other Knight/Rooks attacks d8. Pacifism on f4 cannot add an attack (§16.1). The royal identity remains on board, consistent with §2 and §11, while Black's remaining castling right disappears as ordinary chess requires. Step 49 hands off without changing this board. No mismatch observed.

## Conclusion and limitations

No defect established in surviving evidence. The complete-game semantic audit cannot be certified because most action evidence and measured elapsed time were lost. Structural checks ran inside the single helper; they are not a full card-semantics oracle. No tests, production files, temporary harnesses, or external logs were read or changed. Only this Markdown report was written.

GAME_095_DONE
