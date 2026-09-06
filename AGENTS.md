# Knightmare card-development protocol

These rules apply to every card implementation in this repository.

## Scope

- Engine correctness is the priority. Never run or repair UI tests.
- Implement one card at a time in deck order.
- Keep test, production, and audit work in separate fresh-agent phases.

## Required TDD sequence

1. Spawn one fresh focused-test agent and one fresh interaction-test agent.
2. Test agents derive behavior from `rules.md`, `cards.md`, card artwork, and public engine APIs only. They edit tests only.
3. Review and run the new engine tests red, then commit tests alone.
4. Stop the test agents. Spawn a fresh implementation agent that is forbidden from reading, listing, searching, or diffing test sources or test commits. It may run the supplied black-box engine-test command.
5. Review and run targeted and full engine tests plus typecheck, then commit production alone.
6. Stop the implementation agent. Spawn a fresh engine-only audit agent that cannot read tests. It must execute bounded directed, randomized, and multi-card probes.
7. For each audit finding, repeat with a fresh regression-test agent, a fresh test-blind implementation agent, and a fresh audit agent. Advance only after a clean audit.

## Agent execution limits

- Give each agent one file or one narrowly bounded responsibility and concrete acceptance checks. Never assign a broad open-ended investigation.
- Never allow two agents to edit the same file concurrently.
- Before spawning, record the target file hash or absence. Require a real `apply_patch` update within 30 seconds.
- At the 30-second checkpoint, verify the target hash. If unchanged, interrupt the agent immediately and replace it with a smaller assignment. A commentary message or plan is not progress.
- Three-strike rule: if the same failure mode occurs three times, stop retrying the same prompt or task shape. Diagnose the shared cause, change the mechanism (for example split the patch, change model/effort, provide exact fixtures, or remove conflicting writers), and continue autonomously. Do not wait for the user to notice or prescribe the correction.
- Test agents write a compact core first: 10-25 focused tests or 15-30 interaction tests. Prefer table-driven coverage over repetitive padding. Expansion happens only after the first runnable patch.
- Test agents may inspect at most the target test, the authoritative rule section, and narrowly relevant engine APIs before their first patch.
- Test agents use `*** Update File`; never delete and re-add an existing path. They run only their targeted engine test and typecheck.
- Implementation agents get the rule text, production entry points, exact black-box command, and baseline pass/fail counts. They never receive test source or test-derived implementation hints.
- Audit agents get a fixed probe budget and a hard completion sentinel. They must report executed probe counts, findings, and measured wall time, then delete temporary harnesses.
- Parent verification—not agent narration—decides whether a phase is complete.

## Speed gates

- Targeted card suites should stay below one second where practical.
- Never run the full engine suite until the targeted suite is ready for the phase gate.
- Never run UI tests.
- Stop expanding once the requested behavior is covered and the phase gate passes.

## Commit hygiene

- Commit test-only changes after the verified red gate.
- Commit production-only changes after the verified green gate.
- Commit each audit regression test before its corresponding production fix.
- Do not mix unrelated files into these commits.
