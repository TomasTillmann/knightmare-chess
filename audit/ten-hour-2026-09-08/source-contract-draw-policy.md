# Draw policy source contract

Verified local source: `rules.md:24` says ordinary draw conditions apply unless a card says otherwise, but players should agree whether FIDE rules, casual chess conventions, or only stalemate and mutual agreement apply. Section 23 (`rules.md:798–819`) uses full relevant game state for repetition and recommends not claiming **repetition** while either player can still play cards. The supplied initial observation had also attributed a move-count recommendation to this section; the actual section does not say that. It says Truce restarts move counting, without specifying a draw threshold or automatic adjudication.

## Conclusion

The preserved contract does **not unambiguously mandate automatic repetition, fifty-move, or insufficient-material adjudication**. The opening explicitly leaves selection among materially different draw policies to pregame agreement. Section 23 defines stalemate and repetition identity but does not select repetition counts, claim procedures, automatic thresholds, or insufficient-material treatment. Therefore, absence of any particular automatic draw cannot be classified as a confirmed violation from these sources alone. Selecting the applicable draw policy is a missing specification decision.

## Publisher evidence and conflict

- Official rulebook, PDF page 1, “Moving Without a Card” and “Turn Sequence”: normal chess rules apply subject to Continuing Effects, including after decks and hands run out. This supports a general chess baseline; it does not explicitly prescribe repetition thresholds, move-count thresholds, claims versus automatic draws, or insufficient-material evaluation. Both rulebook pages were read in full.
- Official FAQ, PDF pages 5–6, “How is stalemate defined?”: repeated-position adjudication depends on the board and is unaffected by changes in players’ hands. The same answer says a player may escape lack of legal moves by playing a card. This is explicit publisher guidance about relevant state and card escape, but still does not specify occurrence count or whether a claim is necessary.
- **Explicit source conflict:** FAQ page 6 disregards hand changes, whereas local §23 recommends including the entire relevant game state, including hands/decks/hidden commitments, for software repetition. The local recommendation must not be represented as the publisher’s repetition rule.
- FAQ page 5: Under Elf Hill with no possible King return square is stalemate. FAQ page 62 distinguishes that case from King-only or blocked-Pawn turns where the King can return: those are a turn without a move, not stalemate. These address legal continuation, not a general insufficient-material draw.
- Narrow text search of the official FAQ found no passages for fifty-move, 50-move, or insufficient-material adjudication. That negative search is limited to these terms and is not proof that every possible synonym is absent.

## Required policy choices before a definite conformance judgment

Choose the draw convention; distinguish claimable and automatic conditions; specify repetition identity in light of the local/publisher conflict; define counters and reset behavior for card actions; and decide whether insufficient material means ordinary board material or impossibility of mate given cards and Continuing Effects. These are source gaps, not conclusions about the implementation. No engine or test source was read or edited.
