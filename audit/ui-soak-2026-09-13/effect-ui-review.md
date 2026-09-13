# Effect UI review

Scope: `src/BoardEffects.tsx`, retained/copied/composite effect presentation only.

Source observations:
- Composite targets resolve through the active Confabulation group's board carrier, so a retained child's effect can remain attached to the visible combined piece.
- Retained effects with a physical `card` use that card's ID for the preview and display a separate Vulture proxy note.
- Effects without a physical `card` infer their source from the latest matching history entry; this deserves a concrete copied-effect check before treating the title as reliable.

Result: no reproducible incorrect presentation found in this bounded review. No production or test changes.

Executed checks:
- Four existing scenarios, desktop and mobile: **8 passed in 7.6 seconds** against the frozen app at port 5175. Checked Vulture's retained proxy and selective cancellation; Coup's suspended Neutrality and restored royal markers; Haunting Memories' original/copied Curse labels and cancellation; and Confabulation's marker carrier after movement using both component powers.
- Source review covered the effect union, retained-card source selection, temporary-effect duration text, carrier lookup, suspension flags, and composite marker role labels.
- Three bounded public-engine probes investigated simultaneous original/copied temporary effects. The attempted Plots/Shield/Haunting sequences were rejected before creating the proposed coexistence. These do **not** establish a UI defect or prove that history-based attribution is always correct; no fabricated state was used to claim a finding.

Command:
```sh
UI_BASE_URL=http://127.0.0.1:5175 npx playwright test tests/long-flows.spec.ts --grep 'Vulture leaves|Haunting copies|Confabulation carries|Coup surrender' --workers=2 --reporter=line --output=/tmp/knightmare-effect-ui-review
```

Limits: this was a source/DOM assertion review, not a fresh screenshot-based visual audit or exhaustive enumeration of simultaneous temporary effects. Browser contexts were isolated from the parent's session and campaign. `src/BoardEffects.tsx` remained unchanged, SHA-256 `7a347815a53d4e510e63b50213e66196f66c70675cc2ce27ad563f4a88313eb9`.
