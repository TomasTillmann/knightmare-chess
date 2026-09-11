# Cancellation of an unfinished rescue-dependent move

Source-only review completed. No production code or test sources inspected. Sources are the repository's rules.md and the publisher FAQ text at audit/ten-hour-2026-09-08/official-faq.txt. Physical engine behavior and the asserted absence of alternative escapes require separate parent verification.

## Primary result: cancellation is premature

The publisher specifically answers the timing question for Knightmare!, Think Again!, and Chaos: the response follows the opponent's entire turn, including the optional card play (FAQ p. 16, text lines 654–657; repeated at lines 1600–1603). This supplies a stronger basis than guessing whether losing a future Haunting Memories copy constitutes direct mate.

Local §17.1, lines 534 and 540, makes Chaos a response to a completed opposing move including the optional after-move card, and gives Knightmare! the same timing contract. Local §11.6, lines 272–281, permits an unsafe intermediate move only when its same-turn rescue makes the final position safe. A move explicitly awaiting that necessary rescue has not reached the completed-turn response point described by the FAQ.

Therefore, for the sequence as posed—Black has not yet played its necessary Haunting Memories rescue—the strongest source-grounded result is that White's Knightmare! is not yet eligible. Rejecting this premature declaration while leaving Black's rescue available is the natural engine implementation. The sources explicitly establish the timing; the reject-versus-spend API treatment is an implementation inference, not a publisher API specification.

## Why the rescue matters

FAQ p. 5, lines 156–162, explicitly allows Challenge to suppress check by requiring a different kind of opponent piece to move. Local §18.2, lines 586–592, requires a movable selected piece; §11.7, line 285, ties check to permitted captures. Local §22.7, lines 782–784, defines Haunting Memories as copying the last played card and recommends counting the latest successfully declared card even if later canceled. Thus an accepted intervening Knightmare! would change what Haunting Memories can copy under that local interpretation. The FAQ's Haunting-copy chain example on p. 19, lines 806–812, supports copying the latest card's effect but does not address this exact unfinished-rescue sequence.

## Fizzle and adjudication qualifications

For an otherwise eligible cancellation, local §17.1 line 538 expressly requires a regular-card fizzle if cancellation plus the replacement prohibition directly creates board checkmate. General regular-card no-mate rules appear in §11.1–11.2, lines 236–250, and FAQ p. 3, lines 78–82. They do not by themselves establish whether removing a still-unplayed, history-dependent rescue is equivalent to newly creating board mate when the board was already checked or geometrically mated.

The Fog exception is explicit but narrower: canceling an already played saving card restores the illegal move and can legally leave the player checkmated because the mating move happened earlier (FAQ p. 3, lines 86–100; local line 281). It should not automatically be extended to premature Knightmare!. A contrasting FAQ Counterspell example prohibits recreating mate after canceling an escape (p. 19, lines 797–802), showing that cancellation cards cannot be assumed interchangeable.

If a cancellation has nevertheless been validly accepted and the restored checked player's own turn truly has no legal move or available card sequence that escapes, an indefinite ongoing state with no legal continuation contradicts local §11.5, lines 264–269, and FAQ p. 3, lines 62–66. Terminal adjudication is required in that conditional case. This does not make checkmate the preferred resolution of the premature declaration described above.

Conclusion: flag the premature response eligibility as the best-supported issue; distinguish the exact Haunting-history effect and direct-mate classification as derived or unresolved. Do not label this exact interaction an explicit publisher ruling.
