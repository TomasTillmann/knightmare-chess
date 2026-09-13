// Ten obvious card paths in the open Chrome preview: npm run test:ui
async page => {
  const started = Date.now();
  page.setDefaultTimeout(3000);
  page.setDefaultNavigationTimeout(5000);
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  await page.bringToFront();
  const button = name => page.getByRole('button', { name, exact: true });
  const hand = (color = 'white') => page.getByRole('region', { name: `${color} cards` });
  const select = (name, color = 'white') => hand(color).getByRole('button', { name: new RegExp(`^${name}:`) }).click({ position: { x: 18, y: 50 } });
  const setup = id => page.goto(`http://127.0.0.1:5174/${id ? `?practice=${id}` : ''}`);
  const pick = async (...squares) => { for (const square of squares) await button(`Choose ${square}`).click(); };
  const play = () => button('Play card').click();
  const end = () => button('End turn').click();
  const position = () => page.locator('#board-position').textContent();
  const effect = id => page.locator(`.piece-effect[data-effect="${id}"]`);
  const move = async (from, to) => {
    const board = await page.locator('cg-board').boundingBox();
    const before = await position();
    for (const square of [from, to]) await page.mouse.click(
      board.x + (square.charCodeAt(0) - 97 + .5) * board.width / 8,
      board.y + (8.5 - Number(square[1])) * board.height / 8);
    await page.waitForFunction(previous => document.querySelector('#board-position').textContent !== previous, before);
  };

  await setup('hidden-passage');
  await select('Hidden Passage'); await button('Cancel').click();
  check((await position()).includes('white king on e1'), 'Cancel moved the King.');
  await select('Hidden Passage'); await pick('e4'); await play();
  check((await position()).includes('white king on e4'), 'Hidden Passage did not move the King.');
  check(await hand().getByRole('button', { name: /^Hidden Passage:/ }).count() === 0 && await hand().getByRole('button').count() === 5, 'The card was not spent and replaced.');

  await setup('disintegration');
  await select('Disintegration'); await pick('e2'); await play();
  check((await page.locator('#off-board-position').textContent()).includes('white pawn dead'), 'Disintegration did not remove the Pawn.');
  await move('g1', 'f3');
  check((await position()).includes('white knight on f3'), 'A before-move card blocked the normal move.');

  await setup('forced-march');
  await select('Forced March'); await pick('e3', 'f3', 'd2', 'e2'); await play();
  check((await position()).includes('white pawn on f3') && (await position()).includes('white pawn on e2') && !(await position()).includes('white pawn on d2'), 'Forced March did not move both Pawns.');

  await setup('resurrection');
  await select('Resurrection'); await button('Pawn').click(); await pick('e2'); await play();
  check((await position()).includes('white pawn on e2') && !(await page.locator('#off-board-position').textContent()).includes('white pawn captured'), 'Resurrection did not return the captured Pawn.');

  await setup('fireball');
  await select('Fireball'); await pick('e4'); await play();
  const boardAfterFireball = await position();
  check(['e4', 'f3', 'd5'].every(square => !boardAfterFireball.includes(`on ${square}`)), 'Fireball left a piece in the blast.');

  await setup('mystic-shield');
  await select('Mystic Shield'); await pick('e4'); await play();
  check(await effect('mystic-shield').count() === 1, 'Shield marker missing.');
  await end(); await move('d7', 'd5'); await end();
  check(await effect('mystic-shield').count() === 0, 'Shield did not expire after the opponent turn.');

  await setup('curse');
  await select('Curse'); await pick('d8'); await play(); await end();
  check(await effect('curse').count() === 1, 'Curse did not persist across turns.');

  await setup('fortification');
  await select('Fortification'); await pick('e4', 'e5'); await play();
  check(await page.locator('.effect-wall').count() === 1, 'Fortification wall missing.');

  await setup('peace-talks');
  await select('Peace Talks', 'black'); await button('Curse').click(); await play();
  check(await effect('curse').count() === 0 && await page.locator('.effects-tray').count() === 0, 'Peace Talks did not remove Curse.');

  await setup('fog-of-war');
  await select('Fog of War', 'black'); await play();
  check((await position()).includes('white king on e1'), 'Fog of War did not undo Hidden Passage.');

  await setup('');
  await select('Hidden Passage'); await pick('e4'); await play(); await page.reload();
  check((await position()).includes('white king on e1'), 'Refresh did not reset the game.');
  return { passed: 10, durationMs: Date.now() - started };
}
