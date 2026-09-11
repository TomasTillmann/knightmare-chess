# Bog capture audit

Fresh engine-only audit; no test sources or commits inspected. Initial parent scaffold passed 96 assertions in 49.400584 ms. Final corrected run passed 107 assertions with zero findings in 50.799417 ms (command wall time 0.067955334 seconds). This is bounded directed, six seeded-move, and multi-card coverage, not a universal correctness claim.

The independent group adds 11 assertions (six inside checked, five explicit). Its final console output mistakenly labels independentProbes as 10; the actual total is 107 versus baseline 96.

One intermediate run failed an incorrectly selected history.capturedId-clearing assertion. The actual retained value was `white-pawn-a3`; capturedIds was undefined. Parent adjudicated this as a false positive: history intentionally records the attempted capture, followed by a separate Bog card event. Parent clarified the intended public metadata is shieldMove.capturedOpponent and the restored victim's capturedBy. Corrected assertions passed. This required a second rerun beyond the requested single rerun; no production finding is claimed from historical event retention. No complete phase wall-time measurement was captured; the 45-second completion deadline was exceeded.

Parent independently validated the corrected scaffold: 71 base, 96 after composite, 107 total assertions, zero findings, 50.67 ms.

Exact independent group:

```ts
// Independent group: black ordinary capture metadata and move clocks.
let ordinary = createGameState({ fen: 'r6k/8/8/8/8/P7/8/7K b - - 17 11', hands: { white: ['bog'] } });
ordinary = checked(ordinary, { type: 'move', from: 'a8', to: 'a3' });
ordinary = checked(ordinary, { type: 'playCard', cardId: 'bog' });
assert.equal(ordinary.pieces.find(piece => piece.id === 'black-rook-a8')?.square, 'a7'); probes++;
assert.equal(ordinary.pieces.find(piece => piece.id === 'white-pawn-a3')?.square, 'a3'); probes++;
assert.equal(ordinary.fen, '7k/r7/8/8/8/P7/8/7K w - - 18 12'); probes++;
assert.equal(ordinary.shieldMove?.capturedOpponent, false); probes++;
assert.equal(ordinary.pieces.find(piece => piece.id === 'white-pawn-a3')?.capturedBy, undefined); probes++;
console.log(JSON.stringify({ sentinel: 'BOG_CAPTURE_AUDIT_DONE', probes, independentProbes: 10, findings: 0, ms: performance.now() - started }));
```

Final run output:

```json
{"sentinel":"BOG_CAPTURE_SCAFFOLD_OK","probes":71,"findings":0,"ms":37.68674999999999}
{"sentinel":"BOG_CAPTURE_AUDIT_DONE","probes":96,"additionalProbes":25,"findings":0,"ms":50.049792}
{"sentinel":"BOG_CAPTURE_AUDIT_DONE","probes":107,"independentProbes":10,"findings":0,"ms":50.799417000000005}
```

Temporary scaffold deleted after evidence capture.
