# Engine random-play audit — round 16

- Frozen commit: `cbe7ef8`
- Seeds: `2026090601`, `2026090602`, `2026090603`
- Executed: 3 reproducible runs × 20 transitions = 60 transitions
- Result: **clean** — 60 PASS, 0 FAIL, 0 confirmed bugs

The reviewers checked every before/action/after transition against `rules.md`,
`cards.md`, relevant card artwork, and public engine behavior. Coverage included
ordinary moves, captures, turn transitions, card draw/discard accounting,
history, clocks, en-passant, castling rights, piece identity, and these played
cards: Annexation, Anathema, Cathedral, Disintegration, Dubbing, Evangelists,
Fanatic, Forced March, Guardian, Holy War, Long Jump, Lost Castle, Onslaught,
and Pacifism.

Reproduce any run with:

```sh
node --import tsx audit/random-play.ts <seed> 20 .audit-scratch/replay.json
```

No regression or production-fix phase was required because the round produced
no finding.
