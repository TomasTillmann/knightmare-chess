# Round 6 multi-turn sequence audit: no new breakage found

## Result

No new rule or public-engine contract breakage was confirmed in this bounded pass against commit `2f0e408`.

## Coverage

- Read the complete implemented-card rulings in `rules.md`, all prior audit summaries and reports, and the current state/reducer/type flow before probing, so previously reported roots were not duplicated.
- Ran the complete existing engine suite: `848` tests passed, `0` failed.
- Ran five generated multi-turn games for up to twelve state transitions each. At every reached state, the probe enumerated ordinary destinations and candidate plays from the current hand, including replacement and after-move cards.
- Made `7,820` direct calls through exported reducer APIs: `2,232` successful transitions plus structured rejections. No uncaught exception or input mutation occurred.
- Every successful transition was checked for parseable six-field FEN, FEN/PieceState board agreement, unique occupied squares, zone/square agreement, logical-turn/FEN-turn agreement, phase/moveMade agreement, card-allowance bounds, live en-passant identities, pending-rescue/check agreement, committed after-move royal safety, and valid outcome phase.
- Successful generated plays covered 17 card types: Disintegration, Fanatic, Annexation, Forced March, Cowardice, Holy War, Anathema, Evangelists, Tournament, Cathedral, Lost Castle, Siege, Holy Quest, Treason, Onslaught, Long Jump, and Dubbing. The passing full suite supplied the multi-turn No Quarter and Squaring the Circle coverage that was not reached by the five random lines.
- Rechecked the existing focused coverage for neutral control and royal status, Coup Prince/replacement-royal behavior, all four orientations, promotion and en passant, pending-rescue success/rollback, direct-mate and self-check fizzles, card draw/discard/allowance, physical castling identity, `legalDests`/`applyAction`, and `positionFor` construction.

Production and test files were kept read-only. The generated probe lived only in `/tmp`; no branch, worktree, source change, test change, or commit was made.
