import assert from 'node:assert/strict';
import { test } from '@playwright/test';
import { cardInteractions, matchingCardOptions, type CardOption } from '../src/cardInteractions.js';
import { createDebugGame, practiceCards } from '../src/debugGame.js';
import { applyAction } from '../src/game/reducer.js';

test('all card targets remain reachable through labeled UI choices', () => {
  assert.equal(practiceCards.length, 80);
  let paths = 0;
  for (const cardId of practiceCards) {
    const state = createDebugGame(cardId);
    const cards = Object.values(state.players).flatMap(player => player.hand).filter(card => card.cardId === cardId);
    assert(cards.length > 0, cardId);
    let available = 0;
    for (const card of cards) {
      const interaction = cardInteractions[cardId](state, card);
      available += interaction.options.length;
      const registered = JSON.stringify(interaction.options);
      const prefixes = new Map<string, CardOption[]>();
      const matching = (picked: string[]) => {
        const key = JSON.stringify(picked);
        if (!prefixes.has(key)) prefixes.set(key, matchingCardOptions(interaction.options, picked));
        return prefixes.get(key)!;
      };
      for (const option of interaction.options) {
        paths++;
        if (option.action.type !== 'playCard') throw new Error(`${cardId}: wrong action type`);
        assert.equal(option.action.cardInstanceId, card.id, cardId);
        assert.equal(option.action.cardId, cardId, cardId);
        const picked: string[] = [];
        for (const pick of option.picks) {
          assert(pick.id.trim() && pick.label.trim(), `${cardId}: unlabeled choice`);
          if (pick.square) assert.match(pick.square, /^[a-h][1-8]$/, cardId);
          const next = matching(picked).flatMap(candidate => candidate.picks[picked.length] ?? []);
          const byId = new Map(next.map(choice => [choice.id, choice]));
          const offered = byId.get(pick.id);
          assert(offered, `${cardId}: unreachable choice ${picked.join(',')} → ${pick.id}`);
          for (const choice of next) {
            const duplicate = byId.get(choice.id)!;
            assert.equal(choice.label, duplicate.label, `${cardId}: ambiguous choice label`);
            assert.equal(choice.square, duplicate.square, `${cardId}: ambiguous square choice`);
          }
          const squares = [...byId.values()].flatMap(choice => choice.square ?? []);
          assert.equal(new Set(squares).size, squares.length, `${cardId}: duplicate board targets`);
          picked.push(pick.id);
        }
        const complete = matching(picked).filter(candidate => candidate.picks.length === picked.length);
        assert(complete.length, `${cardId}: no completed action`);
        const actions = new Set(complete.map(candidate => JSON.stringify(candidate.action)));
        assert.equal(actions.size, 1, `${cardId}: input omitted a choice between different actions`);
        assert.equal(JSON.stringify(complete[0].action), JSON.stringify(option.action), `${cardId}: action changed along its path`);
        assert(applyAction(state, complete[0].action).ok, `${cardId}: completed UI action rejected`);
      }
      assert.equal(JSON.stringify(interaction.options), registered, `${cardId}: choosing mutated registered targets`);
    }
    assert(available > 0, `${cardId} has no playable practice path`);
  }
  assert(paths >= 1139, 'A supported practice target disappeared');

  const march = createDebugGame('forced-march');
  const marchCard = march.players.white.hand.find(card => card.cardId === 'forced-march')!;
  const marchOptions = cardInteractions['forced-march'](march, marchCard).options;
  for (const ids of [['e3', 'f3', 'd2', 'e2'], ['d2', 'e2', 'e3', 'f3']]) {
    const completed = matchingCardOptions(marchOptions, ids).find(option => option.picks.length === 4);
    assert(completed, `Forced March cannot select in order ${ids.join(',')}`);
    assert.deepEqual(new Set(completed.picks.map(pick => pick.id)), new Set(ids));
    const result = applyAction(march, completed.action);
    assert(result.ok);
    assert(result.state.pieces.some(piece => piece.owner === 'white' && piece.role === 'pawn' && piece.square === 'f3'));
    assert(result.state.pieces.some(piece => piece.owner === 'white' && piece.role === 'pawn' && piece.square === 'e2'));
  }

  const onslaught = createDebugGame('onslaught');
  const onslaughtCard = onslaught.players.white.hand.find(card => card.cardId === 'onslaught')!;
  const onslaughtOptions = cardInteractions.onslaught(onslaught, onslaughtCard).options;
  assert.equal(onslaughtOptions.length, 255, 'Register each Pawn subset once, without factorial permutations');
  const ids = ['h2', 'h3', 'a2', 'a3', 'e2', 'e3'];
  for (let length = 0; length <= ids.length; length++) {
    const candidates = matchingCardOptions(onslaughtOptions, ids.slice(0, length));
    assert(candidates.length, `Onslaught lost arbitrary order at step ${length}`);
    assert(candidates.length <= 255 * 8, 'Selection expanded into factorial permutations');
  }
  const completed = matchingCardOptions(onslaughtOptions, ids).find(option => option.picks.length === 6);
  assert(completed);
  assert.deepEqual(completed.picks.map(pick => pick.id), ids);
  const result = applyAction(onslaught, completed.action);
  assert(result.ok);
  for (const square of ['a3', 'e3', 'h3']) assert(result.state.pieces.some(piece =>
    piece.owner === 'white' && piece.role === 'pawn' && piece.square === square));
  console.log(`Verified ${practiceCards.length} cards, ${paths} target paths and arbitrary Pawn selection.`);
});
