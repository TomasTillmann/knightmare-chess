# Coup independent movement oracle: source scope

Source-only review; no engine or test sources inspected or executed.

- Local `rules.md:455` explicitly makes the original King a capturable Prince and gives the marked replacement ordinary movement plus every King protection/check/checkmate rule. Thus a marked Knight or Bishop keeps its own movement geometry and must finish a completed turn safe as the actual royal piece.
- Local `rules.md:463` and the official FAQ p. 5, lines 184–188 (lost-Prince/Peace Talks answer) explicitly contemplate the Prince being captured. Royal safety therefore belongs to the elected piece, not the original King.
- Prince movement into an attacked square while the actual royal piece remains safe is derived from that capturable/nonroyal distinction; this is not yet an identified explicit publisher example.
- A stored FEN castling-rights bit is an implementation representation. Neither of these sources has yet been found to specify its storage or immediate deletion when Coup is played. Do not turn a retained bit alone into a rules violation.

## Publisher corroboration and limitations

- FAQ p. 20, lines 851–861: the Paladin/Coup/Warlord example explicitly restores a Knight's standard movement when Coup supersedes Paladin. Bishop movement follows the general standard-movement rule in local line 455; this reviewed FAQ passage does not supply a separate Bishop example.
- FAQ p. 8, lines 278–295: Princes remain affected by cards naming Kings and are distinct names for Doomsayer; a Prince can be removed by naming Prince. Consequently an oracle must not generalize nonroyalty into immunity from King-targeting cards. Those cards are outside a pure movement oracle.
- FAQ p. 8, lines 299–304: castling may leave, cross, or enter check provided the King is safe at the end of the turn, regardless of whether a card is played. This is an explicit difference from ordinary chess castling checks.
- FAQ p. 24, lines 1075–1080: Earthquake does not count as moving the King/Rooks for castling; the King still moves two squares toward the Rook. This addresses history and geometry, not the Prince's eligibility.
- **Unknown from reviewed sources:** no explicit answer was found saying that a Prince can or cannot castle, or that a Knight/Bishop elected King can castle. Ordinary Knight/Bishop geometry excludes a two-square castle as a derived interpretation of retained standard movement; excluding the Prince's castle is also an interpretation of castling as a King privilege, not an independently verified publisher example. An oracle that filters either case must report that scope qualification and must not call a discrepancy a confirmed bug without additional authority.
- **Representation distinction:** the FAQ describes legal chess actions and movement history, not FEN serialization. It supplies no rule about deleting stored castling-rights bits immediately on Coup. Actual castling eligibility and stored rights must be checked separately.

Scope for a strong movement comparison: use only ordinary Knight/Bishop/Prince moves, reject captures of the actual royal piece, and evaluate completed-turn attack safety on that actual royal piece. Prince capture and entry into attack may be compared under the local capturable-Prince rule. Exclude cancellation, transformed movement, neutral control, Pacifism, royal Pawn promotions, and all castling from claims of complete publisher-verified oracle coverage.

FAQ line references count newline characters (as `rg -n` does); form-feed PDF page boundaries are not extra lines. Pages are the printed 1–66 PDF pages. Source-only inspection was limited to Coup/Prince and relevant castling passages; no code or tests were inspected.
