import { expect, test, type Page } from '@playwright/test';

const extended = process.env.UI_STRESS ? test : test.skip;
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const position = (page: Page) => page.locator('#board-position');
const hand = (page: Page, color = 'white') => page.getByRole('region', { name: `${color} cards` });
const card = (page: Page, name: string, color = 'white') => hand(page, color).getByRole('button', { name: new RegExp(`^${name}:`) });
const play = (page: Page) => button(page, 'Play card').click();
const end = (page: Page) => button(page, 'End turn').click();
test.setTimeout(45_000);

test('A fizzled rescue keeps checkmate visible alongside the spent-card message', async ({ page }) => {
  await page.goto('/?practice=forbidden-city&variant=fizzled-rescue');
  await move(page, 'f4', 'e4', 'black king');
  await select(page, 'Forbidden City', 'black');
  await button(page, 'Choose h1').click();
  await play(page);
  await expect(page.getByRole('status')).toContainText('White wins · checkmate');
  await expect(page.getByRole('status')).toContainText('Card spent without effect');
  await expect(position(page)).toContainText('black king on f4');
  await expect(position(page)).not.toContainText('black king on e4');
  await expect(card(page, 'Forbidden City', 'black')).toHaveCount(0);
  await expect(button(page, 'End turn')).toHaveCount(0);
});

extended('Doomsayer allows a later chosen speaker to name and sacrifice only their own piece', async ({ page }) => {
  await page.goto('/?practice=doomsayer');
  await select(page, 'Doomsayer');
  await play(page);
  await button(page, 'Decline').click();
  await end(page);
  await move(page, 'e7', 'e5', 'black pawn');
  await end(page);
  await move(page, 'g1', 'f3', 'white knight');
  await button(page, 'Name a piece').click();
  await button(page, 'Black').click();
  await button(page, 'Pawn').click();
  await button(page, 'Choose a7').click();
  await button(page, 'Name piece').click();
  await expect(position(page)).not.toContainText('black pawn on a7');
  await expect(position(page)).toContainText('white pawn on a2');
  await expect(page.locator('#off-board-position')).toContainText('black pawn captured');
  await expect(page.locator('#off-board-position')).not.toContainText('white pawn captured');
  await expect(page.locator('.effect-entry[data-effect="doomsayer"]')).toHaveCount(0);
  await expect(button(page, 'Name a piece')).toHaveCount(0);
  await end(page);
  await move(page, 'g8', 'f6', 'black knight');
  await expect(button(page, 'End turn')).toBeEnabled();
});

async function select(page: Page, name: string, color = 'white') {
  await card(page, name, color).click({ position: { x: 18, y: 50 } });
}
async function move(page: Page, from: string, to: string, piece: string) {
  const board = await page.locator('cg-board').boundingBox();
  if (!board) throw new Error('Missing board');
  for (const square of [from, to]) await page.mouse.click(board.x + (square.charCodeAt(0) - 96.5) * board.width / 8,
    board.y + (8.5 - Number(square[1])) * board.height / 8);
  await expect(position(page)).toContainText(`${piece} on ${to}`);
}

test('Fog rollback remains consistent after both players complete replacement turns', async ({ page }) => {
  await page.goto('/?practice=fog-of-war');
  await select(page, 'Fog of War', 'black');
  await button(page, 'Play card').click();
  await expect(position(page)).toContainText('white king on e1');
  await move(page, 'e2', 'e4', 'white pawn');
  await button(page, 'End turn').click();
  await move(page, 'e7', 'e5', 'black pawn');
  await button(page, 'End turn').click();
  await move(page, 'g1', 'f3', 'white knight');
  await expect(position(page)).toContainText('white king on e1');
  await expect(position(page)).toContainText('white pawn on e4');
  await expect(position(page)).toContainText('black pawn on e5');
  await expect(page.getByRole('region', { name: 'black cards' }).getByRole('button', { name: /^Fog of War:/ })).toHaveCount(0);
  await expect(button(page, 'End turn')).toBeEnabled();
});

for (const canceled of ['Disintegration', 'Plots Within Plots']) {
  extended(`Fog can cancel ${canceled} in a completed Plots trio`, async ({ page }) => {
    await page.goto('/?practice=plots-within-plots');
    await select(page, 'Plots Within Plots');
    await play(page);
    await expect(page.locator('.selection-summary')).toHaveText('White · 2 extra cards available');
    await select(page, 'Disintegration');
    await button(page, 'Choose a2').click();
    await play(page);
    await expect(page.locator('.selection-summary')).toHaveText('White · 1 extra cards available');
    await select(page, 'Fanatic');
    await button(page, 'Choose b2').click();
    await play(page);
    await expect(position(page)).toContainText('white pawn on b5');
    await expect(position(page)).not.toContainText('white pawn on a2');
    await select(page, 'Fog of War', 'black');
    await button(page, canceled).click();
    await play(page);
    await expect(position(page)).toContainText('white pawn on a2');
    await expect(position(page)).toContainText(`white pawn on ${canceled === 'Disintegration' ? 'b5' : 'b2'}`);
    await expect(hand(page).getByRole('button')).toHaveCount(5);
    await expect(hand(page, 'black').getByRole('button')).toHaveCount(5);
    await expect(card(page, 'Plots Within Plots')).toHaveCount(0);
    await expect(card(page, 'Fog of War', 'black')).toHaveCount(0);
    if (canceled === 'Plots Within Plots') {
      await expect(card(page, 'Disintegration')).toHaveCount(1);
      await expect(card(page, 'Fanatic')).toHaveCount(1);
      await expect(card(page, 'Fanatic')).toHaveAttribute('data-playable', 'false');
      await move(page, 'g1', 'f3', 'white knight');
    }
    await end(page);
    await move(page, 'g8', 'f6', 'black knight');
    await end(page);
    await expect(position(page)).toContainText('white pawn on a2');
    await expect(position(page)).toContainText(`white pawn on ${canceled === 'Disintegration' ? 'b5' : 'b2'}`);
    await expect(page.locator('.selection-summary')).toHaveCount(0);
  });
}

for (const [number, removed, retained] of [[1, 'd8', 'h8'], [2, 'h8', 'd8']] as const) {
  test(`Fog distinguishes duplicate Curse ${number} and cancels only the chosen effect`, async ({ page }) => {
    await page.goto('/?practice=fog-of-war&variant=plots-duplicates');
    await select(page, 'Fog of War', 'black');
    await expect(button(page, 'Curse 1')).toBeVisible();
    await expect(button(page, 'Curse 2')).toBeVisible();
    await button(page, `Curse ${number}`).click();
    await play(page);
    await expect(page.locator(`.piece-effect[data-square="${removed}"][data-effects~="curse"]`)).toHaveCount(0);
    await expect(page.locator(`.piece-effect[data-square="${retained}"][data-effects~="curse"]`)).toHaveCount(1);
    await expect(page.locator('.effect-entry[data-effect="curse"]')).toHaveCount(1);
    await expect(position(page)).toContainText('white pawn on e4');
  });
}

for (const takeBack of [true, false]) {
  extended(`Chaos ${takeBack ? 'returns' : 'leaves'} an optional card and keeps the replacement turn playable`, async ({ page }) => {
    await page.goto('/?practice=chaos');
    await select(page, 'Disintegration');
    await button(page, 'Choose a2').click();
    await play(page);
    await expect(position(page)).not.toContainText('white pawn on a2');
    await select(page, 'Chaos', 'black');
    await button(page, takeBack ? 'Take the card back' : 'Leave the card played').click();
    await play(page);
    await expect(position(page)).toContainText('white pawn on e2');
    await expect(position(page)).not.toContainText('white pawn on e4');
    await expect(card(page, 'Disintegration')).toHaveCount(takeBack ? 1 : 0);
    if (takeBack) await expect(position(page)).toContainText('white pawn on a2');
    else await expect(position(page)).not.toContainText('white pawn on a2');
    await expect(hand(page).getByRole('button')).toHaveCount(5);
    await move(page, 'g1', 'f3', 'white knight');
    await end(page);
    await move(page, 'e7', 'e5', 'black pawn');
    await end(page);
    // The canceled move is allowed again on a later turn.
    await move(page, 'e2', 'e4', 'white pawn');
    await expect(card(page, 'Chaos', 'black')).toHaveCount(0);
  });
}

extended('Vulture transfers a sixth physical card which can be replayed next turn', async ({ page }) => {
  await page.goto('/?practice=vulture');
  await select(page, 'Vulture', 'black');
  await play(page);
  await expect(hand(page, 'black').getByRole('button')).toHaveCount(6);
  await expect(card(page, 'Hidden Passage', 'black')).toHaveCount(1);
  await expect(card(page, 'Hidden Passage', 'black')).toHaveAttribute('data-playable', 'false');
  await expect(position(page)).toContainText('white king on e4');
  await end(page);
  await expect(card(page, 'Hidden Passage', 'black')).toHaveAttribute('data-playable', 'true');
  await select(page, 'Hidden Passage', 'black');
  await button(page, 'Choose a5').click();
  await play(page);
  await expect(position(page)).toContainText('black king on a5');
  await expect(position(page)).toContainText('white king on e4');
  await expect(card(page, 'Hidden Passage', 'black')).toHaveCount(0);
  await expect(hand(page, 'black').getByRole('button')).toHaveCount(6);
  await end(page);
  await move(page, 'g1', 'f3', 'white knight');
  await expect(position(page)).toContainText('black king on a5');
});

extended('Haunting Memories uses the copied input and keeps both removals after later moves', async ({ page }) => {
  await page.goto('/?practice=haunting-memories');
  await expect(position(page)).not.toContainText('black pawn on a7');
  await select(page, 'Haunting Memories');
  await expect(page.getByRole('status')).toHaveText('Choose a Pawn to remove');
  await button(page, 'Choose a2').click();
  await play(page);
  await expect(page.locator('#off-board-position')).toContainText('white pawn dead');
  await expect(page.locator('#off-board-position')).toContainText('black pawn dead');
  await move(page, 'e3', 'e4', 'white pawn');
  await end(page);
  await move(page, 'g8', 'f6', 'black knight');
  await end(page);
  await expect(position(page)).not.toContainText('white pawn on a2');
  await expect(position(page)).not.toContainText('black pawn on a7');
  await expect(card(page, 'Haunting Memories')).toHaveCount(0);
  await expect(hand(page).getByRole('button')).toHaveCount(5);
});

extended('Vulture leaves a continuing proxy which Peace Talks cancels without losing the stolen card', async ({ page }) => {
  await page.goto('/?practice=curse&variant=vulture-curse');
  await select(page, 'Curse');
  await button(page, 'Choose d8').click();
  await play(page);
  const marker = page.locator('.piece-effect[data-square="d8"][data-effects~="curse"]');
  const effect = page.locator('.effect-entry[data-effect="curse"]');
  await expect(marker).toHaveCount(1);
  await select(page, 'Vulture', 'black');
  await play(page);
  await expect(effect).toHaveAttribute('aria-label', /Card taken by Vulture; effect remains/);
  await expect(marker).toHaveCount(1);
  await expect(card(page, 'Curse', 'black')).toHaveCount(1);
  await expect(hand(page, 'black').getByRole('button')).toHaveCount(6);
  await expect(card(page, 'Curse')).toHaveCount(0);
  await end(page);
  await move(page, 'd7', 'd5', 'black pawn');
  await expect(marker).toHaveCount(1);
  await select(page, 'Peace Talks', 'black');
  await button(page, 'Curse').click();
  await play(page);
  await expect(marker).toHaveCount(0);
  await expect(effect).toHaveCount(0);
  await expect(card(page, 'Curse', 'black')).toHaveCount(1);
  await expect(hand(page, 'black').getByRole('button')).toHaveCount(6);
  await expect(position(page)).toContainText('black queen on d8');
  await expect(position(page)).toContainText('black pawn on d5');
  await end(page);
  await move(page, 'g1', 'f3', 'white knight');
  await expect(card(page, 'Curse', 'black')).toHaveCount(1);
  await expect(effect).toHaveCount(0);
});

test('Coup surrender shows the result and response window before Fog restores the King', async ({ page }) => {
  await page.goto('/?practice=coup&variant=coup-surrender');
  await select(page, 'Coup');
  await button(page, 'Choose b8').click();
  await play(page);
  await expect(page.getByRole('status')).toContainText('Black wins');
  await expect(page.getByRole('status')).toContainText('Black can respond');
  await expect(page.locator('.effect-entry[data-effect="neutrality"]')).toHaveAttribute('data-suspended', 'true');
  await expect(page.locator('.piece-effect[data-square="e1"]')).toContainText('Prince');
  await expect(page.locator('.piece-effect[data-square="b8"]')).toContainText('King');
  await select(page, 'Fog of War', 'black');
  await play(page);
  await expect(page.getByRole('status')).not.toContainText('wins');
  await expect(page.locator('.effect-entry[data-effect="coup"]')).toHaveCount(0);
  await expect(page.locator('.effect-entry[data-effect="neutrality"]')).toHaveAttribute('data-suspended', 'false');
  await expect(page.locator('.piece-effect[data-square="e1"]')).toHaveCount(0);
  await expect(page.locator('.piece-effect[data-square="b8"]')).toContainText('Neutral');
  await expect(card(page, 'Coup')).toHaveCount(0);
  await expect(card(page, 'Fog of War', 'black')).toHaveCount(0);
  await end(page);
  await move(page, 'c7', 'c6', 'black pawn');
  await expect(position(page)).toContainText('white king on e1');
});

extended('Haunting copies a continuing Curse and Peace Talks cancels only that physical copy', async ({ page }) => {
  await page.goto('/?practice=haunting-memories&variant=haunting-curse');
  await select(page, 'Haunting Memories');
  await button(page, 'Choose d8').click();
  await play(page);
  const effects = page.locator('.effect-entry[data-effect="curse"]');
  await expect(effects).toHaveCount(2);
  await expect(effects.filter({ hasText: 'Haunting Memories: Curse' })).toHaveCount(1);
  await expect(page.locator('.piece-effect[data-square="d1"][data-effects~="curse"]')).toHaveCount(1);
  await expect(page.locator('.piece-effect[data-square="d8"][data-effects~="curse"]')).toHaveCount(1);
  await end(page);
  await move(page, 'g8', 'f6', 'black knight');
  await end(page);
  await move(page, 'g2', 'g3', 'white pawn');
  await select(page, 'Peace Talks');
  await button(page, 'Haunting Memories').click();
  await play(page);
  await expect(effects).toHaveCount(1);
  await expect(effects).not.toContainText('Haunting Memories');
  await expect(page.locator('.piece-effect[data-square="d1"][data-effects~="curse"]')).toHaveCount(1);
  await expect(page.locator('.piece-effect[data-square="d8"]')).toHaveCount(0);
  await expect(card(page, 'Haunting Memories')).toHaveCount(0);
  await expect(card(page, 'Peace Talks')).toHaveCount(0);
  await expect(position(page)).toContainText('white queen on d1');
  await expect(position(page)).toContainText('black queen on d8');
});

extended('Confabulation carries Neutrality and Curse markers through both movement powers', async ({ page }) => {
  await page.goto('/?practice=confabulation&variant=confabulated-effects');
  await select(page, 'Confabulation');
  await button(page, 'Choose c1').click();
  await button(page, 'Choose e3').click();
  await play(page);
  await expect(position(page)).toContainText('white knight on e3');
  await expect(page.locator('#off-board-position')).toContainText('white bishop away');
  await expect(page.locator('.piece-effect[data-square="e3"]')).toContainText('N+B');
  await end(page);
  await move(page, 'h7', 'h6', 'black pawn');
  await select(page, 'Neutrality', 'black');
  await button(page, 'Choose e3').click();
  await play(page);
  await end(page);
  await move(page, 'e3', 'g4', 'white knight');
  await expect(page.locator('.piece-effect[data-square="e3"]')).toHaveCount(0);
  await expect(page.locator('.piece-effect[data-square="g4"]')).toHaveAttribute('data-effects', /neutrality/);
  await end(page);
  await move(page, 'h6', 'h5', 'black pawn');
  await select(page, 'Curse', 'black');
  await button(page, 'Choose g4').click();
  await play(page);
  await end(page);
  await move(page, 'g4', 'f5', 'white knight');
  const marker = page.locator('.piece-effect[data-square="f5"]');
  for (const effect of ['confabulation', 'neutrality', 'curse']) {
    await expect(marker).toHaveAttribute('data-effects', new RegExp(effect));
    await expect(page.locator(`.effect-entry[data-effect="${effect}"]`)).toHaveAttribute('aria-label', /f5/);
  }
  await expect(marker).toContainText('N+B');
  await expect(page.locator('.piece-effect[data-square="g4"]')).toHaveCount(0);
  await expect(page.locator('#off-board-position')).toContainText('white bishop away');
  await expect(position(page)).not.toContainText('white bishop on');
  await expect(page.locator('cg-board piece.bishop')).toHaveCount(0);
});
