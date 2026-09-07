# 300-iteration engine regression campaign

Requested scope: 300 fresh iteration agents, each checking 50 deterministic random
regular moves plus all intervening card/reaction/turn actions. Every successful
action is checked immediately for structural consistency; fresh agents then review
each recorded transition in order against `rules.md`, `cards.md`, and printed card
metadata. State hashes preserve reviewed outcomes; they are not independent rules
oracles. Ordinary unaffected moves additionally use a chessops board comparison.

Seeds are `860001` through `860300`. Each iteration has a fixed action trace, full
per-action review data, and its own engine regression test. Existing regression
tests are retained. Previous audit reports and temporary goal artifacts were removed.

Run generation: `node --import tsx campaign/run.ts generate N`.
Run replay: `node --import tsx campaign/run.ts replay N`.
Run one test: `node --import tsx --test src/game/cards/random-NNN.test.ts`.
Only engine tests and typecheck are permitted.

Sampling: independently shuffled full catalog decks, five-card hands, using the
explicit temporary deck-building variant in rules §4.3. Randomized candidate order
samples one card in hand uniformly before checking its timing and one random target.
Mandatory self-check rescues search shuffled cards and targets for a legal cure.
Legal availability depends on timing,
targets, and the board; this is not a uniform distribution over reachable positions.
Terminal candidates are avoided to pursue 50 actual regular moves. Such conditioning
must be disclosed in coverage reports. A coverage audit is required after each 10
completed iterations; retain tests and improve subsequent sampling for gaps.

Completion requires parent-verified traces, tests, per-action reviews, 30 coverage
audits, resolved confirmed findings, a full engine test pass, and typecheck.

## Progress

Runner validated independently on seed 859999: 50 moves, 110 actions, replay passed.
The durable acceptance ledger is `progress.json`. Each accepted entry records its
reviewed prefix, final position, and regression commit. Confirmed bug prefixes
exclude their offending generated state and unreviewed suffix from valid card coverage.
