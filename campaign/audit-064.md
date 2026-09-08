# Audit 064

AUDIT_064_CLEAN

- Baseline: 15 probes, 1 group, 38 ms, zero findings.
- Independent adversarial group: Black Rebirth capture resets the clock; empty relocation preserves it. Both verify pawn placement, card accounting, and input immutability.
- Final: 17 probes, 2 groups, 37 ms, zero engine findings.
- One intermediate attempt failed because the audit asserted `PieceState.color`; corrected the assertion to the public `owner` property and reran successfully.
- Baseline scaffold SHA-256: `c096ac1b534ecbfe9daa7d902e534759c321953e20098ac88f7efd0fa146855b`.
- Final scaffold SHA-256: `f1c6c2dadbda6c34ebba3543ba5b96f53da8cc41dff2f28fc3b781712c94406e`.
- Temporary scaffold deleted after successful execution; measured runs retained in `audit-064-runs.jsonl`.
