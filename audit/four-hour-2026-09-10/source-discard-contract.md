# Ordinary discard: source contract

Scope: standard separate-deck play; source review only, no engine behavior inferred.

Sources: local `rules.md` §§9–10; publisher extracts `audit/ten-hour-2026-09-08/official-rulebook.txt` (RB) and `official-faq.txt` (FAQ), alongside their PDFs. Line references are to these local files. No engine or test sources inspected.

The governing publisher wording is “After your own turn, if you did not play a card” (RB:85–88, Discarding, p. 1). Local `rules.md:205–207` implements that own-turn condition. Neither possession of a particular physical card nor the location of the last played card replaces that condition.

1. **Reaction during the preceding opponent turn: eligible**, provided no card was played during the current own turn and the turn can legally finish. **Direct local text:** `rules.md:207` expressly preserves this option. **Publisher derivation:** RB:8–18 permits opponent-turn card play separately; RB:85–88 attaches discard eligibility to one's own turn.

2. **Own card canceled by Fog of War: ineligible.** **Direct publisher fact:** FAQ:89–91 says “Both players have already played cards for this turn” even when the move must be taken back. **Derived discard result:** RB:85–88 therefore excludes the ordinary discard. This is cancellation while the cards remain spent, not the optional retrieval exception below.

3. **Own card fizzles: ineligible.** **Direct local text:** `rules.md:207` says an ineffective card still counts as played. **Publisher corroboration:** RB:94–96 says a Checkmate Rule violation is “still considered played”; the discard exclusion follows from RB:85–88. That publisher passage directly covers Checkmate Rule fizzles, while the local rule states the broader ineffective-card contract.

4. **Own optional card followed by opponent Chaos, with the optional card taken back: discard eligibility is not explicitly settled by the inspected publisher text.** **Direct facts:** Chaos resolves after the entire turn including optional card play (FAQ:654–658, p. 16). FAQ:1283–1286 (p. 29) permits retrieving the played card and playing the same or a different card. **Derivation/ambiguity:** retrieval restores permission to play, but the FAQ does not expressly say whether the abandoned play is erased for RB's discard condition. Treating a replacement turn with no replay as eligible is a plausible derivation, not a quoted ruling; retaining the historical-play restriction is another literal reading. Local `rules.md:205–207` does not expressly decide this returned-card exception. Any actual replay during the resolved turn makes ordinary discard ineligible.

5. **Vulture transfer or replay: transfer alone does not erase a play.** **Direct facts:** RB:34–40 treats Vulture as a card that adds a card to hand; FAQ:2743–2746 (p. 63) lets Vulture take an active Continuing Effect while it remains in play through a proxy. Local `rules.md:203` distinguishes adding a card, and `rules.md:217–219` distinguishes continued effect from physical discard. **Derived result:** an actor who already played a card this own turn stays ineligible when that physical card transfers; playing Vulture or replaying a taken card during one's own turn likewise prevents ordinary discard. Merely holding a card taken on an earlier opponent turn does not prevent discard now. No retrieved-card identity may substitute for tracking who played during the current turn.

6. **Elf-permitted turn without a move: eligible if no card is played during that turn.** **Direct local text:** `rules.md:207` explicitly includes a permitted turn without a Regular Move. **Publisher derivation:** FAQ:2687–2697 (p. 62) allows the specified Under Elf Hill positions to yield a turn without a move; RB:85–88 requires an own turn without card play, not a physical move. The turn on which Elf itself was played remains ineligible. FAQ:2695–2697 separately makes absence of a legal King return square stalemate, not permission to finish a discretionary no-move turn.

DISCARD_CONTRACT_SOURCE_DONE
