# Master integration audit — 2026-09-11

All completed engine fixes from the surviving branches and the working tree are included in this integration.

## Branch coverage

| Branch before integration | Tip | Coverage |
| --- | --- | --- |
| master / origin/master | 33e03989fab9449d87b857fc5673f67d05841928 | Ancestor of the fix branch; fast-forward integration |
| codex/engine-audit-20260909 | 62f59f345b3b3db0e15fe3c343507bf7f7868ab2 | Fully contained in the fix branch |
| codex/fix-engine-audit | c7700a5b59954015c5af5aa9bba78bed1e2c8c68 | Contains all 22 existing commits ahead of master |

A fresh read-only agent independently checked local ancestry and the other registered worktree. That old worktree no longer exists; its retained index exactly matches its branch tip, with no additional staged changes. A successful fetch of every remote branch found only origin/master and no additional commits outside the fix branch.

## Consolidated work

- Regression tests, reviewed campaign corrections, the two saved rescue fixtures and the retained Confabulation probe: signed commit dfd56953148d357665a94e80301d7fe99dba1c70.
- Production reducer, types, catalog and authoritative rule corrections: signed commit 6f1df834cecd5cfabbcb2af3385db8f6154fa443.
- Audit reports, source evidence and this integration record are committed alongside them. Earlier resolution reports describe the fix phase, when commits were temporarily skipped; this integration records those changes in Git.

Before consolidation, the parent recorded a SHA-256 manifest of all 541 changed or newly included files. The staged content is checked against that manifest before committing the final integration record, and master is checked against it after the fast-forward. Existing branch tips must all remain ancestors of master.

The 20 generated checkpoint archives (438,536,158 bytes) remain on disk and are explicitly ignored. All non-archive audit reports and evidence are included.

## Verification

- Full engine command: `node_modules/.bin/tsx --test --test-concurrency=2 src/game/cards/*.test.ts`.
- 6,258 / 6,258 tests passed, 152 suites, zero failures/skips/cancellations, 167.666 seconds.
- `npm run typecheck` passed.
- Working-tree and staged diff checks passed.
- No UI tests were run.

Final reducer SHA-256: `b1ec7a43283ad77607205eb87dfcd2bf39b196d6b617477c83319003f3aa52c5`.

This is an integration coverage audit of the verified fixes. The separate qualified rule questions and performance observation retain the dispositions in four-hour-2026-09-10/resolution-notes.md.
