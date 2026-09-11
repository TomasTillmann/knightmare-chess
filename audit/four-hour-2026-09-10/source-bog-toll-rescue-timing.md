# Bog and Toll during a pending King-safety rescue

Source-only review completed. No engine or test sources inspected. Line numbers below count newline-delimited lines, preserving PDF form feeds on their lines.

The publisher's completed-entire-turn ruling explicitly names Chaos, Knightmare!, and Think Again!; it does not name Bog or Toll. Generic after-opponent-move wording alone does not establish that the same boundary applies to these two cards. Exact pending-rescue timing requires checking their own passages and the local King-safety contract.

| Card | Conclusion and evidence |
| --- | --- |
| Bog | **No explicit pending-rescue permission or prohibition located.** FAQ page 4, lines 110–116, directly discusses Bog and requires a regular reaction to fail if it produces an illegal final King position. FAQ page 12, lines 459–463, explicitly allows Bog after the mover has played Fireball, recomputing the shortened move and explosion; page 13, lines 505–515, treats the displacement from a double-move card together. These establish reactions to completed compound results, but do not settle whether Bog may interrupt a required, still-unplayed rescue card. Local `rules.md` lines 273–277 permit same-turn rescue and require a post-move reaction leaving the mover checked to have no board effect; line 736 specifically resolves Bog after Fireball as a complete combined result. **Inference only:** requiring rescue completion before Bog would make these examples consistent, but the cited passages do not expressly mandate that timing gate. |
| Toll | **No explicit pending-rescue permission or prohibition located.** FAQ pages 17–18, lines 720–732, and page 61, lines 2651–2657, allow Toll after an outward crossing followed by a return via Charge, Merciless, or Crusade. This preserves an earlier crossing within a compound turn; it does not decide when a still-required rescue may be interrupted. Local `rules.md` line 82 adopts that crossing rule and the declined-payment whole-turn cancellation, while lines 273–277 provide the general rescue and post-move reaction fizzle contract. **Inference only:** Toll can use a completed multi-move turn's crossing history; neither this nor the generic after-move wording transfers FAQ16's explicit cancellation-card timing rule to Toll. |

The explicit completed-entire-turn ruling is in FAQ page 16, lines 654–657 (Chaos, Knightmare!, Think Again!). Local `rules.md` lines 534–542 adopts it for those named cancellation cards. Do not label Bog/Toll acceptance before rescue a confirmed timing defect solely by analogy to that ruling. Independently evaluate any resulting failure to preserve a legal rescue or to apply the explicit final King-safety rule; this source note makes no engine-behavior claim.

Sources: `/tmp/knightmare-engine-audit-20260910/rules.md`; `/Users/tomastillmann/Random/knightmare-chess/audit/ten-hour-2026-09-08/official-faq.txt` (publisher's Official Rulings, 28 February 2003). External text is paraphrased; no verbatim external quotation.

SOURCE_BOG_TOLL_RESCUE_TIMING_COMPLETE
