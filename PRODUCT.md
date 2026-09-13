# Knightmare Chess

## Current phase

A minimal local DEBUG table: chessboard in the center, five visible Knightmare cards above and below. White starts at the bottom; the board never flips and one person can move both sides. State lives only in React memory; refreshing starts over.

Ten cards are playable: Hidden Passage, Disintegration, Forced March, Resurrection, Fireball, Mystic Shield, Curse, Fortification, Peace Talks, and Fog of War. Select a card and follow its engine-provided choices, then confirm with Play card. Back revises a choice; Cancel or Escape leaves the game unchanged. The engine validates the physical card and its timing. End turn remains a separate action.

Hands and replacement draws come from deterministic engine deals. The native practice dropdown starts a real-engine setup for any of the ten cards; refreshing resets to the initial setup. There is no deck builder or persistence.

Coordinates sit outside the board. Hover previews a card on the right; selecting a card pins its preview while collecting choices. Curse and Shield badges, wall marks, and an active-effects tray show continuing effects and their duration. On narrow screens the preview hides during target selection so the board stays visible.

## Quick browser check

Keep the Vite preview running at `http://127.0.0.1:5174/`, open Chrome with `playwright-cli -s=knightmare-ui open http://127.0.0.1:5174/ --browser=chrome --headed`, then run `npm run test:ui`. The single `checks/hidden-passage.js` scenario checks all ten primary card paths using the real UI. Desktop and mobile runs passed in about 2.3 seconds each. It uses the installed Playwright CLI with no additional test framework.
