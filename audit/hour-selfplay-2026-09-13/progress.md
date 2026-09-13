# One-hour Chrome self-play

Requested: play both sides in Google Chrome for about one hour, finish every started game, and investigate bugs and edge cases.

- Started: 2026-09-13 10:02:57 UTC. Base commit: `8764c15`.
- Browser: existing headed Google Chrome session `knightmare-ui`, current development app at `http://127.0.0.1:5174/`.
- Previous toolchain readiness reused; current navigation, board geometry, viewport, and an opened screenshot verified again. Application/test source unchanged at the start; unrelated engine-audit work remains separate.
- A game counts as complete only with a recorded result and resolved or deliberately declined final card reactions. An action limit does not count as a completed game.

## Played games

1. **Normal starting position → White checkmate.** 89 accepted actions, including Doomsayer/Fog cancellation, Assassin capturing Black's own Queen to escape, a fizzled Guardian with an ordinary capturing escape, promotion after resize/Back/Cancel, an unsafe King move restored after Doomsayer is declined, and final Forced March fizzle. Public-engine replay independently verified. Finished board rejects further moves; card reader closes without changing the result. Exact actions: `game-1.json`.
2. **Abduction practice opening → White checkmate.** The preset supplies the opening e2–e4. Abduction's real 10-second concealment and 10-second recall deadline elapsed while the Assassin reader was open; g8 Knight was captured, overlays cleared, and Fog restored it. Continued the same game into checkmate after a failed Forced March rescue. No frozen browser clock was used in live play.
3. **Panic practice opening → White checkmate.** The preset supplies e2–e4. Black's real 15-second deadline expired while reading Fog; Black lost the turn, no piece moved, and White could continue. Measured 15.55 seconds from the initial timer observation through reader closure. Continued to checkmate.
4. **Normal starting position with Under Elf Hill available → Black checkmate.** 19 accepted actions including final Fog. An after-move attempt correctly opened the reader instead of playing the card. Continued until its next legal timing, returned the King to h3 after Escape/reader/landscape checks, verified its temporary movement restriction, and continued to checkmate after Fanatic fizzled. Final Fog preserves checkmate; no playable cards remain.
5. **Coup/Neutrality preset → Black checkmate.** The first attempt was interrupted by a development reload: a later hand contained cards the recorded earlier actions had spent. A public replay rejected the inaccurate combined chronology. That failed trace and a matching reset diagnostic are preserved. Replayed the original 26-action Coup → surrender → Fog → continued game → Fanatic fizzle sequence through headed Chrome on frozen port 5175, checking the final hands and zero playable cards. This uninterrupted replay reached checkmate. The preset's six automatic setup actions are separate from live play.
6. **Chaos practice opening → Black checkmate.** 11 accepted actions after the preset's e2–e4. Played Doomsayer, then Chaos with card return. Back, both return choices, and reading preserved the draft; the confirmed choice restored the Pawn and Doomsayer. Repeating e2–e4 was refused without changing the position. Continued with f2–f3 into checkmate after a Fanatic fizzle. Mobile final screenshot inspected; no final reaction remains.

## Expanded scope

The user subsequently requested every card in several completed games with creative combinations. Working target: each of 80 cards successfully played in three distinct completed games with varied partners. A desktop/mobile replay of the same sequence counts once; fizzles and automatic fixture setup are tracked separately from successful live card plays. Existing capped campaigns do not count as completed games. Recovering exact archived terminal traces is the first step, followed by filling gaps on the current frozen build.

## Runtime and verification

- macOS entered Clamshell Sleep at 10:38:46 UTC and returned to full wake at 19:45:24 UTC. Exclude this entire interval, including maintenance wakes, from active testing time. Local `date -u` and `pmset` are used together; the remote clock tool disagreed by one hour after wake.
- Parent completed-game regression: desktop + mobile **2 passed in 37.2 seconds**.
- Parent timer regressions with reader open: desktop + mobile **4 passed in 6.5 seconds**. The prior Chrome-launch failures spanned system sleep and occurred before game assertions; the unchanged retry passed.
- Six verified live game sequences contain **177 accepted actions**, excluding automatic fixture setup, rejected attempts, draft interactions, and the interrupted/reset Game 5 fragment.
- Frozen build `index-vMY-Cf2f.js` / `index-DevZjOYb.css` is served on port 5175 to avoid Vite development reloads. Engine production remains unchanged. A two-line debug-fixture addition now supports `variant=full-board`, dealing a chosen practice card on the complete starting board without automatic setup moves. Its separate build, `index-Gk15BlrY.js`, is served on port 5176; the original frozen campaign remains on 5175.

## Findings so far

- No confirmed new functional UI bug in the six verified live game sequences. A suspected Guardian deadlock was disproved by continuing with the legal ordinary capture; no state was reset to avoid it.
- Minor clarity observation: when an ordinary mate has card escapes, the status can say only "Black to move". Failed-card messages also omit the current side. Existing controls still allowed the correct continuation; these are observations, not rule failures.
- One 3-second Playwright timeout occurred on End turn after Qh4 in game 4. Live state confirmed the turn had advanced; continued from that authoritative state instead of replaying the click. Public endTurn took 30 ms, so this did not establish an engine performance defect.
- The 89-action completed-game regression passed parent desktop/mobile verification. Additional recorded completed games use the same driver behind `UI_COMPLETE_GAMES`; none are added to the default fast run.
- Recovered 16 distinct archived terminal traces: 4,260 accepted public-engine actions, exact outcomes, and zero remaining legal card responses. These contain 68 successfully played card types, 51 in at least three distinct games. These are engine coverage counts until their current-browser replays pass.
- First headed-browser campaign: Chaos smoke passed; Earthquake, Confabulation, Fatal Attraction and Truce passed. Neutrality and Abduction completed every action and terminal assertion, then hung in screenshot capture (trace ends after fonts loaded). Batch interrupted after timeout: four passes, two capture failures, nine not run. Screenshot capture now resumes the test clock, brings the page forward and has a five-second bound; the two exact games are being rerun serially before continuing. No gameplay assertion was weakened.

## Evidence

- Initial screenshot opened and inspected: `/tmp/knightmare-hour-initial.png` (1440 × 1080).
- Opened and inspected final screenshots: `/tmp/knightmare-hour-game1-completed.png`, `/tmp/knightmare-hour-game2-completed.png`, `/tmp/knightmare-hour-game3-completed.png`, `/tmp/knightmare-hour-game4-after-fog.png`, `/tmp/knightmare-hour-game5-replayed.png`, `/tmp/knightmare-hour-game6-completed.png`. The interrupted Game 5 screenshots were also inspected to diagnose its changed hand.
- Intermediate screenshots inspected: promotion at 801 px, 375 px continuation, real Abduction/Panic timeouts, and 667 × 375 King-return layout. Capture paths are temporary; action records and regression tests are durable.

## Extended campaign checkpoint

- Nine newly directed completed games (Evil Eye, Crusade, Mystic Shield) passed headed mobile Chrome in 1.4 minutes. Each card succeeded in three distinct games; final screenshots inspected for Evil Eye and Split Knight.
- Two Split Knight mobile games passed. The third exposed reversed victim order in the offline plan versus the canonical UI target, including history ordering; no target is missing. Preserved the original failure and corrected the plan for a full replay.
- The two earlier end-of-game screenshot timeouts passed exact serial retries (2/2, 2.1 minutes). The runner resumes its test clock, focuses the page, and bounds capture at five seconds; game assertions remain unchanged.
- Treason and Merciless each have three independent public-engine validated complete plans now running in desktop Chrome. Fireball has three validated plans awaiting Chrome.

## Completed campaign — 2026-09-13 20:39 UTC

- All **79 distinct games passed headed Chrome replay: 6,147 accepted actions, 80/80 cards successfully played in at least three distinct completed games**. Every action checked the visible board, physical hands, effects, turn controls, orientation, overflow, and browser errors against the public engine. Every game ended with the expected outcome and no playable response cards. Repeated browser runs count once: 32 desktop games and 47 mobile games.
- Independent review confirmed 79 unique initialized-state/action traces, 1,439 cardPlayed events, 133 separate fizzles, and exclusion of 25 automatic setup events. 59 games start on the full normal board; 20 use existing practice setups.
- Final 27-game mobile batch: 27 passed in 3.5 minutes. Three long Knightmare games passed in 4.1 minutes. Complete-game timing is intentionally outside the default suite.
- Final default suite: **57 passed, 129 intentionally skipped, 44.7 seconds**. Application typecheck/build and focused Playwright-source typecheck passed. The final production build matches the tested full-board preview (index-Gk15BlrY.js).
- Inspected final desktop and mobile screenshots, including crowded continuing effects and transformed pieces, Evil Eye, Split Knight, and Fatal Attraction. No material new UI defect found. The two capture timeouts and noncanonical Split Knight replay plan are preserved with successful retries in completed-card-games.json.
- Application change: the existing debug URL accepts `variant=full-board` to keep a normal initial position with a chosen practice deal. Engine and visual design are unchanged. Existing timer checks now cover time passing while the card reader is open.
- Coverage limit: cardPlayed includes a card subsequently cancelled by Fog. All three directed Man of Straw games use Fog; continued play after an uncancelled escape remains untested in this campaign. Three games per card is coverage evidence, not exhaustive combinations or proof that known engine defects are fixed.
- Known engine findings remain outside this UI verification change: Vendetta rescue omission, stale Plots allowance after a fizzle, and invalid castling promotion.

Reproduce the optional recorded campaign against a running app:

```sh
UI_STRESS=1 UI_COMPLETE_GAMES=audit/hour-selfplay-2026-09-13/completed-card-games.json npx playwright test tests/complete-games.spec.ts --grep 'completed ' --project=desktop --headed --workers=1
```

Use the mobile project for touch replay. The ledger contains exact actions, per-card successful-game IDs, terminal outcomes, per-game browser evidence, and failed-attempt history. The original six manually completed games and real-time reader/deadline checks remain documented above.
