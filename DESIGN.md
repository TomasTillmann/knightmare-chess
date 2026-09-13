---
name: Knightmare Chess
description: Minimal DEBUG chess table with two card hands.
colors:
  table: "#292a2c"
  board-dark: "#b58863"
  board-light: "#f0d9b5"
---

## Layout

Keep a fixed white-bottom board between two centered card fans, normally five cards each. Coordinates sit outside the squares. A large card preview sits to the right, slightly shorter than the board, showing a plain card back when idle and the hovered card face. Keep gameplay controls minimal: status, card selections, end turn, and practice selection sit beside the board on desktop and below it on mobile. Game outcomes remain visible alongside card and response messages. State lives in memory; refreshing resets the game.

Active effects appear in a scrollable tray beside the board on desktop and above it on mobile. At widths up to 800px, a Read card dialog provides the full artwork and text; choosing card targets hides the floating preview. Short viewports give the board's height-derived size a 240px floor and let the page scroll vertically so the squares remain usable.

## Components

Reuse the hand behavior from `../blafovaci-prsi/web/app.js`, `web/app.css`, and `design-system/components.css`: positions from −1 to 1, angle ×7°, drop squared ×12px, card step 42% of width. Keep each hit area still; lift only the artwork 14px over 260ms with cubic-bezier(.16,1,.3,1). Active hand opacity is 1; inactive is .5. Focus raises the artwork and adds a dashed outline.

Keep Knightmare artwork at its original aspect ratio. Existing assets in `final_cards/` retain the provenance in `ASSET_RIGHTS.md`. Reduced motion disables transitions.
