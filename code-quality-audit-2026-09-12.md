# Code-quality and SOLID audit

**Date:** 12 September 2026

**Reviewed revision:** `bee68ba6c9a85bbf646e99487dbd7e39aabc1c6d`

**Result:** Two substantial structural findings. No performance finding met the clarified requirement that an operation take several seconds.

## Scope and standard

This review covers the non-UI engine: `src/game/reducer.ts`, `types.ts`, `state.ts`, `cards/catalog.ts`, and the engine-only campaign harness. Selected engine tests and saved fixtures were used to understand call patterns and measure current execution costs.

UI behavior, UI tests, chess rules, move correctness, and card-rule correctness were outside the assessment. Implementation and test files were not changed during the audit. Temporary profiling and benchmark scripts ran from `/tmp`. Findings and source line references below describe the reviewed revision; the subsequent implementation is recorded at the end.

Findings must represent an existing maintenance burden or substantial wasted execution. File size, naming preferences, missing class hierarchies, and speculative future flexibility are not findings. Performance ratios alone do not qualify: following the clarified scope, sub-second work and the measured one-to-two-second calls are excluded from optimization findings.

## 1. Card handlers repeatedly own the same lifecycle policy

**Priority:** Highest structural value.

**Principles:** Single Responsibility and DRY; concrete duplication rather than a general objection to a large file.

Many handlers combine their particular card transformation with independently maintained copies of shared execution policy. The duplication occurs on both sides of the card-specific work.

At entry, handlers repeat physical-card instance validation, hand lookup, allowance rejection, and, within matching card families, the same turn-window check. Representative copies are visible in [Forced March](/Users/tomastillmann/Random/knightmare-chess/src/game/reducer.ts:2654), [Onslaught](/Users/tomastillmann/Random/knightmare-chess/src/game/reducer.ts:2933), and [Long Jump](/Users/tomastillmann/Random/knightmare-chess/src/game/reducer.ts:2997). Only the card identity and messages change across much of this entry code.

At completion, ordinary replacement handlers repeat another ordered sequence: expire movement-sensitive effects, evaluate the direct-mate restriction, evaluate the acting royal's safety, spend the card, append history, and return the result. Examples include [Forced March](/Users/tomastillmann/Random/knightmare-chess/src/game/reducer.ts:2705), [Onslaught](/Users/tomastillmann/Random/knightmare-chess/src/game/reducer.ts:2984), [Long Jump](/Users/tomastillmann/Random/knightmare-chess/src/game/reducer.ts:3037), and [sliding moves](/Users/tomastillmann/Random/knightmare-chess/src/game/reducer.ts:3372).

**What is wrong:** A handler has several independent reasons to change. A change to shared card-selection or finalization policy requires edits inside unrelated card implementations, even when their transformations have not changed. Reviewers must compare repeated blocks and ordering manually. Existing common functions such as [`cardAllowanceUsed` and `spendCard`](/Users/tomastillmann/Random/knightmare-chess/src/game/reducer.ts:1412) centralize parts of the policy, but each handler still assembles and owns the surrounding procedure.

The 8,355-line reducer makes this repeated ownership harder to inspect, but its length alone is not the finding. The actionable problem is the repeated common procedure within already identifiable card families.

**Boundary of this finding:** Different cards legitimately have different actors, timing, target validation, and finalization exceptions. This finding concerns the matching portions of existing families; it does not justify treating all cards as interchangeable or redesigning the entire engine. The improvement opportunity is less duplicated policy ownership and a smaller review surface for shared changes.

## 2. The internal effect model discards its own type contracts

**Priority:** Substantial code-quality improvement.

**Category:** Internal contract clarity and separation of validation from domain logic; not an inheritance-related SOLID defect.

[`types.ts`](/Users/tomastillmann/Random/knightmare-chess/src/game/types.ts:126) declares 13 concrete effect interfaces, including Curse, Challenge, Man-Trap, and Confabulation. However, [`GameState.effects`](/Users/tomastillmann/Random/knightmare-chess/src/game/types.ts:316) stores `unknown[]`. The state contract therefore does not connect effect creation with later effect consumption.

The reducer maintains a second, much looser description: [`RetainedEffect`](/Users/tomastillmann/Random/knightmare-chess/src/game/reducer.ts:4346) is a `Record<string, unknown>` with only `type`, `owner`, and `card` guaranteed. Card-specific fields remain outside that contract.

Concrete examples:

- [Coup creates an effect](/Users/tomastillmann/Random/knightmare-chess/src/game/reducer.ts:5504) containing `princeId`, `kingId`, and `princeRole` without a declared Coup effect shape. [Restoration later reads and updates those fields](/Users/tomastillmann/Random/knightmare-chess/src/game/reducer.ts:4422) through the loose retained-effect record, including a cast of `princeRole` to `Role`.
- [Earthquake creates another untyped effect shape](/Users/tomastillmann/Random/knightmare-chess/src/game/reducer.ts:4341), while cancellation interprets its extra fields elsewhere.
- Some producers already use explicit checks such as [`satisfies ChallengeEffect`](/Users/tomastillmann/Random/knightmare-chess/src/game/reducer.ts:5539). This makes the contract protection inconsistent across internally created effects.

**What is wrong:** A field rename, omission, or incompatible value can compile at an untyped producer without being connected to its consumers. Developers must reconstruct the contract by searching producers, predicates, cancellation code, and restoration code. The advertised interfaces provide less protection than their presence suggests, and effect-specific knowledge is repeated in runtime decoding and casts.

This is a current maintenance cost, not a claim that an effect is implemented incorrectly. The improvement opportunity is an enforceable internal agreement about effect shapes, particularly where concrete interfaces already exist.

**Boundary of this finding:** Validating unknown or historical input is legitimate. The [`effectRecord` / `effectKind` helpers](/Users/tomastillmann/Random/knightmare-chess/src/game/reducer.ts:101) must not be classified as redundant merely because TypeScript is present. The concern is that internally produced state continues to rely on the same loose representation, so domain logic repeatedly reconstructs information that its producers already know.

## Performance assessment under the clarified cutoff

No performance issue is included as a finding. Current single-operation timings were screened on six existing saved cases: `challenge-target-slow`, `passing-target-slow`, `rescue-search-slow`, `vendetta-slow`, `rescue-search-9091013`, and `rescue-search-9092081` in [`campaign/fixtures`](/Users/tomastillmann/Random/knightmare-chess/campaign/fixtures).

The slowest screened call was `legalDests` on `rescue-search-9092081`, at approximately **1.59 seconds**. The other rescue-query case had a three-run median of approximately **1.27 seconds**. Neither meets the requested several-second cutoff. Historical timeout limits and earlier benchmark comments were not treated as current measurements.

Measurements used Node **v26.8.1** on macOS arm64 / Apple M4 Max, serial execution, and timers around the public engine operation rather than process startup. Node's precise function-call coverage and temporary clone instrumentation helped attribute candidate costs. Large relative differences on shorter operations were deliberately excluded. No optimized implementation was built, and no whole-engine speedup is claimed. These bounded measurements do not establish a worst-case runtime limit for every possible game state.

## Items deliberately not promoted into findings

- Repeated small card-family membership lists: real duplication, but a smaller cleanup than the lifecycle issue above.
- Large test or fixture counts: sampled engine tests include independent semantic checks, so volume alone did not establish redundant work.
- Fields without an observed engine consumer: UI consumers were outside scope, so these were not labeled dead code.
- Separate Open/Closed, Liskov Substitution, Interface Segregation, or Dependency Inversion violations: no concrete quick win met the review threshold. Adding abstractions simply to exercise these principles would not address a demonstrated problem.

## Implementation follow-up — 12 September 2026

Both structural findings have been addressed:

- Shared card-entry validation now serves 61 matching handlers, and shared movement finalization serves 21 matching paths. Distinct actors, timing rules, error messages, and exceptional finalization paths retain their existing behavior. The reducer is 515 lines shorter overall.
- `GameState.effects` now uses a closed union of all 18 engine-produced effect kinds. Coup, Earthquake, Neutrality, Truce, and Mystic Shield have explicit contracts, and retained-effect consumers use the concrete union. Existing runtime checks for historical or malformed input remain in place.

Compile-time regression checks reject missing Coup fields, invalid roles/directions, and unknown effect tags. Existing test inputs and assertions are unchanged: all 48 edited runtime test files emit identical JavaScript. A separate comparison against the audited revision passed 960 public card-entry probes, including complete results, error messages, and input immutability. Independent review checked all 61 entry replacements and 21 finalization paths without finding a regression.

Final validation passed: `npm run typecheck` and all **6,301 engine tests**, with zero failures or skips. The full engine suite ran with two workers in approximately 114 seconds. Targeted lifecycle and effect suites also passed before the full run.

No UI or performance changes were made.
