# Bog card movement audit

BOG_CARDMOVES_AUDIT_DONE

Baseline scaffold executed 127 checks with zero findings in 37.42 ms; intermediate directed/randomized/multi-card checkpoints: 65 checks at 27.29 ms and 104 at 35.33 ms.

Added exactly one adversarial group: a Masquerade bishop moving a1–a2 cannot be Bogged because its move is only one square. Six checks cover successful immutable Masquerade execution and valid resulting state, Bog rejection, unchanged input digest, and retained Bog hand card.

Final run executed 133 checks with zero findings in 31.93 ms; intermediate checkpoints: 65 checks at 24.15 ms and 104 at 30.21 ms. Command wall time was 0.053 seconds.

The first added-group run failed because the audit used an unsupported action name; corrected to the scaffold's public playCard shape and reran successfully. This was a harness error, not an engine finding. No tests or commits were read; no production files were edited. Temporary harness deleted.

Parent independently verified the added group with these public actions: createGameState({fen:'8/8/7k/8/8/8/8/B6K w - - 0 1',hands:{white:['masquerade'],black:['bog']}}); playCard masquerade with target [{from:'a1',to:'a2'}]; then targetless playCard bog. Masquerade succeeded and passed checkState; Bog rejected without input mutation and remained in Black's hand. Final parent reducer hash: 14179e69b7e6fc6f7986531b22110041bb9469d1d91cfa49e7ce5716e1eba6d8.
