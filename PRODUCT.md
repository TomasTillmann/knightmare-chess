# Knightmare Chess

## Current phase

A minimal local DEBUG table: chessboard in the center, five visible Knightmare cards above and below. White starts at the bottom; the board never flips and one person can move both sides. State lives only in React memory; refreshing starts over.

All 80 cards are playable through engine-backed choices. Select a card, choose its targets and confirm with Play card. Back revises a choice; Cancel or Escape restores any required choice without changing the game. The engine validates the physical card and its timing. Doomsayer naming, Abduction recall, required Elf returns, promotion choices, and Panic and Abduction countdowns are part of the turn flow. End turn remains a separate action.

Hands and replacement draws come from deterministic engine deals. The native practice dropdown starts a real-engine setup for any of the 80 cards; refreshing resets to that setup. Optional promotion variants are defined in `src/debugGame.ts` and selected with the `variant` query parameter. There is no deck builder or persistence.

Coordinates sit outside the board. Hover previews a card on the right; selecting a card pins its preview while collecting choices. Piece badges, wall marks and an active-effects tray show continuing effects and their duration. On narrow screens the preview hides during selection; Read card opens a native dialog with artwork and rules. The table scrolls when controls or effects need more room.

## Quick browser check

Run `npm run test:ui`. The native `@playwright/test` runner uses installed Chrome, starts or reuses Vite on `http://127.0.0.1:5174/`, and checks desktop (1440 × 1080) and mobile (375 × 667). Persistent coverage includes every card's primary path, literal interaction flows and browserless target-path checks. See `tests/` and `playwright.config.ts`; the former CLI scenario has been removed. For a focused iteration, run a single file, for example `npm run test:ui -- tests/flows.spec.ts`.
