# Iteration 091 independent verification

Verdict: confirmed. `cards.md` Coup says the current King becomes a capturable Prince moving like a King; the new King retains ordinary movement. `rules.md` §15.3 and §22.7 support applying that effect through Haunting Memories. Repeated Coup therefore changes the former royal Pawn's physical movement role to King, which must also be represented in stored FEN.

Root cause: `playCoup` updated the demoted physical role without synchronizing the stored FEN board. Added the existing board-only serialization idiom after the safety gate, preserving every other FEN field. The same handler serves direct Coup, Haunting Memories through `playCard`, and target enumeration. No new helper or special-case copy logic was necessary.

The initial generic `syncFen` fix was too broad: its `setupFor` helper reconstructs the en-passant field from physical opportunities even when the original King already has King movement. Parent full-engine verification exposed two existing FEN-preservation failures. Reusing board-only serialization corrects the root mismatch while retaining clocks, turn, castling, en-passant serialization, and physical opportunities through both original and repeated Coup.

Verified the supplied public fixture: Black Haunting Memories copies Coup onto c7; c5 becomes a nonroyal physical King and stored FEN rank five is `1bk2b2`.

Gates:
- Supplied black-box baseline: one iteration-091 failure; after broad serialization, two additional preservation failures. Final targeted engine gate across the three supplied black-box suites: 4 passed, 0 failed, 668 ms. Test source and source excerpts were not inspected.
- Typecheck passed.
- Bounded public-API probes: 19 actions, including the exact fixture, all four advertised Haunting Memories targets, repeated direct Coup onto Knights/Bishops for both colors with royal-target rejection checks, and original/repeated Black Coup with a physical b6 en-passant opportunity serialized as `-`.
- Checked every on-board physical role against parsed stored FEN after every probed result: 215 role checks; also verified complete board FEN, exactly one royal per owner, identical non-board FEN fields, and unchanged en-passant opportunities.
- Final probe wall time: 30.6 ms. Findings: zero. Sentinel: `VERIFY_091_CLEAN`.

No test sources, test history, campaign iteration files, or campaign fixture directory were read. No full engine suite, UI tests, or commits were run. Probes ran inline; no temporary harness remains.

Parent final gate: 4997 engine tests through iteration 095 passed, zero failures,
30.636 seconds; typecheck passed. Production-only commit: 940be36. Fresh engine
audit passed 292 probes across two groups in 59 ms; see audit-091.md. The root
scaffold's first attempt compared the entire parsed chessops piece object and
failed on its extra promoted field; comparison was corrected to role and owner
before the zero-finding scaffold was supplied to the fresh auditor.
