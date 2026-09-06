# Last-move highlighting is not synchronized with game history

- Severity: Medium
- Area: Chessground state synchronization, board/keyboard parity, Reset
- Audited commit: `2f0e4082eb991d8efbffe374100439ba4ad675e2`

## Expected

The board is a view of `GameState`. A successful Regular Move records one canonical `move` event in `state.history`, regardless of whether it was submitted by the board or by Keyboard controls. Both input paths must therefore highlight the same source and destination. Reset replaces the game with a fresh state whose history is empty, so no old last-move highlight may remain.

## Actual

ChessBoard never supplies a state-derived `lastMove` to Chessground. Chessground consequently shows its own optimistic highlight only for a pointer move:

- initial board: `0` highlighted last-move squares;
- keyboard `e2-e4`: `0` highlighted last-move squares despite a successful reducer move;
- pointer `e2-e4`: `2` highlighted squares;
- Reset after that pointer move: the fresh initial board still has the same `2` stale highlighted squares.

The state/history is correct in all cases; only the rendered board disagrees with it.

## Headless Chrome reproduction

With the local Vite app open, run this from the repository root:

```js
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4177/');

const highlights = () => page.locator('square.last-move').count();
assert.equal(await highlights(), 0);

await page.getByText('Keyboard controls').click();
await page.getByLabel('Move from').selectOption('e2');
await page.getByLabel('Move to').selectOption('e4');
await page.getByRole('button', { name: 'Make move' }).click();
assert.equal(await highlights(), 0); // expected 2

await page.getByRole('button', { name: 'Reset' }).click();
// Make e2-e4 by dragging on the board.
assert.equal(await highlights(), 2);
await page.getByRole('button', { name: 'Reset' }).click();
assert.equal(await highlights(), 2); // expected 0

await browser.close();
```

The exact automated probes were run in Google Chrome and produced:

```text
initial 0
keyboard 0
pointer 2
after reset 2
```

## Root hint

`src/ChessBoard.tsx` sends `fen`, `turnColor`, and destinations on every state update but omits `lastMove`. It also explicitly sets `lastMove: undefined` only in its optimistic-rejection rollback. Thus highlight state belongs to Chessground's prior UI interaction rather than to `GameState.history`. Deriving the last Regular Move once from history and passing it on every `ground.set` (including an empty value after Reset) would give every input and rollback path one source of truth.
