AUDIT_091_CLEAN

Engine-only audit of Coup board-FEN synchronization after royal demotion.

- Parent scaffold rerun: 247 probes, 1 group, 0 findings, 52 ms.
- Added exactly one independent adversarial group using createGameState and applyAction: direct successive Coup plays promote a knight then bishop; the former royal knight becomes a physical king. Repeated with halfmove counters 0, 19, and 99, asserting physical board agreement, royal selection, accepted card play, input immutability, and preservation of all nonboard FEN fields.
- Final single rerun: 292 probes, 2 groups, 0 findings, 59 ms.
- The direct group explicitly resets card allowance between Coup calls as an isolated fixture; it is not a legal complete turn sequence.
- Execution timestamps: 2026-09-08T02:36:55.368Z to 2026-09-08T02:37:24.105Z; measured interval 28.737 s.
- Audited scaffold SHA256: 22e6e7f2a20600b120b79d0fbfc953cde9ff1e6f37089f9e02364c6566b95764.

No test sources or test commits inspected. Temporary scaffold removed after parent verification; run journal retained.
