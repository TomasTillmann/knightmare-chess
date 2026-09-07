# Coverage audit after iteration 010

AUDIT_COMPLETE: scaffold ran immediately, then exactly one independent valid-prefix accounting group was added and rerun. Executed 1 + 2 groups across two runs; 80 card-count comparisons and 10 prefix reconstructions in the added group. Both runs passed; zero assertion findings. Journal-measured scaffold wall time: 89 ms and 86 ms; total audit approximately 30 seconds.

Generated: 10 distinct seeds, 500 moves, 1,147 actions; 76 card types proposed. Valid reviewed prefixes: 1,031 actions, 54 card types played, 53 applied. There remain 26 never-played types. Generated proposals and deals do not validate card behavior; offending actions and subsequent suffixes were correctly excluded from played counts.

Concrete tooling findings:

- `reviewedActions` reports 1,033 and includes two offending actions, although valid card coverage uses 1,031. Expose `validActions` separately or use the accepted prefix for aggregate validated counts.
- Fisher–Yates preserves each complete 80-card deck, but `random() % n` introduces tiny modulo bias whenever n does not divide 2^32. Use a rejection-sampling bounded integer helper for exact conditional uniformity. Current ordinary proposals select a card instance from both hands and one advertised target; accepted plays are conditioned on timing, target validity, terminal rejection, and rescue fallback, so they are not uniform across legal card plays or reachable states.
- Forced branches always decline pending Doomsayer and resolve Abduction by reveal/timeout. Successful `answerAbduction` and voluntary `namePiece` responses receive no ordinary randomized proposal coverage. Add those public response choices with bounded random selection; retain fallback escape handling.
- Target proposals come only from `cardPlayTargets`; this cannot establish coverage of alternate accepted input encodings, malformed targets, or legal choices absent from that helper. Track action/target-shape and timing coverage separately, and audit target-enumerator omissions against the public action API before claiming all-card coverage.

No engine defect established by this coverage audit. No test or production sources changed. This checkpoint does not claim uniform reachable states, all 80 cards validated, or 500 valid reviewed moves.
