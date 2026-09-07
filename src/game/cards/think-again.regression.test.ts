import assert from 'node:assert/strict'
import test from 'node:test'
import { createGameState } from '../state.js'
import { applyAction } from '../reducer.js'
import type { GameAction, GameState } from '../types.js'

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action)
  assert.equal(result.ok, true, 'error' in result ? result.error.message : '')
  return result.state
}

function reversedCapture(): GameState {
  let state = createGameState({
    fen: '7k/8/8/8/n7/8/8/R6K w - - 0 1',
    hands: { white: ['think-again'], black: ['riposte'] },
  })
  state = act(state, { type: 'move', from: 'a1', to: 'a4' })
  state = act(state, { type: 'playCard', cardId: 'riposte' })
  assert.equal(state.history.at(-1)?.type, 'cardPlayed')
  assert.equal(state.history.at(-1)?.cardId, 'riposte')
  return state
}

test('Think Again cannot react to a Riposte reversal as an actual move', () => {
  const state = reversedCapture()
  const before = structuredClone(state)
  const result = applyAction(state, { type: 'playCard', cardId: 'think-again' })
  assert.equal(result.ok, false)
  assert.deepEqual(result.state, before)
  assert.deepEqual(state, before)
})

test('Think Again cannot react to the automatic turn forfeiture after Riposte', () => {
  let state = reversedCapture()
  state = act(state, { type: 'endTurn' })
  assert.equal(state.turn.color, 'black')
  assert.equal(state.turn.phase, 'afterMove')
  assert.equal(state.turn.moveMade, true)
  const before = structuredClone(state)
  const result = applyAction(state, { type: 'playCard', cardId: 'think-again' })
  assert.equal(result.ok, false)
  assert.deepEqual(result.state, before)
  assert.deepEqual(state, before)
})

for (const reactor of ['white', 'black'] as const) {
  const mover = reactor === 'white' ? 'black' : 'white'
  const rank = mover === 'white' ? '2' : '7'
  const destination = mover === 'white' ? '4' : '5'
  test(`${reactor} spends exactly the selected Think Again copy beside both sibling cards`, () => {
    let state = createGameState({
      turn: mover,
      hands: { [reactor]: ['chaos', 'think-again', 'knightmare', 'think-again'] },
      decks: { [reactor]: ['legacy', 'riposte'] },
    })
    const selected = state.players[reactor].hand[3]!
    const untouched = state.players[reactor].hand.slice(0, 3)
    const replacement = state.players[reactor].deck[0]!
    state = act(state, { type: 'move', from: `e${rank}`, to: `e${destination}` })
    state = act(state, { type: 'playCard', cardId: 'think-again', cardInstanceId: selected.id })
    assert.deepEqual(state.players[reactor].discard, [selected])
    assert.deepEqual(state.players[reactor].hand, [...untouched, replacement])
    assert.equal(state.history.at(-1)?.type, 'cardPlayed')
    assert.equal(state.history.at(-1)?.cardId, 'think-again')
    assert.equal(state.turn.color, mover)
    assert.equal(state.turn.moveMade, false)
    assert.equal(applyAction(state, { type: 'move', from: `e${rank}`, to: `e${destination}` }).ok, false)
  })

  test(`${reactor} copies Think Again through the selected Haunting Memories without sharing physical identity`, () => {
    let state = createGameState({
      turn: reactor,
      hands: { [reactor]: ['haunting-memories', 'haunting-memories'], [mover]: ['think-again'] },
      decks: { [reactor]: ['legacy'], [mover]: ['riposte'] },
    })
    const selected = state.players[reactor].hand[1]!
    const unselected = state.players[reactor].hand[0]!
    const original = state.players[mover].hand[0]!
    const reactorRank = reactor === 'white' ? '2' : '7'
    const reactorDestination = reactor === 'white' ? '4' : '5'
    state = act(state, { type: 'move', from: `e${reactorRank}`, to: `e${reactorDestination}` })
    state = act(state, { type: 'playCard', cardId: 'think-again' })
    state = act(state, { type: 'move', from: `d${reactorRank}`, to: `d${reactorDestination}` })
    state = act(state, { type: 'endTurn' })
    state = act(state, { type: 'move', from: `e${rank}`, to: `e${destination}` })
    state = act(state, { type: 'playCard', cardId: 'haunting-memories', cardInstanceId: selected.id })
    assert.equal(state.history.at(-1)?.type, 'cardPlayed')
    assert.equal(state.history.at(-1)?.cardId, 'haunting-memories')
    assert.equal(state.history.at(-1)?.copiedCardId, 'think-again')
    assert.deepEqual(state.players[mover].discard, [original])
    assert.deepEqual(state.players[reactor].discard, [selected])
    assert.ok(state.players[reactor].hand.some(card => card.id === unselected.id))
    assert.equal(state.pieces.find(piece => piece.id === `${reactor}-pawn-d${reactorRank}`)?.square, `d${reactorDestination}`)
    assert.equal(applyAction(state, { type: 'move', from: `e${rank}`, to: `e${destination}` }).ok, false)
  })
}

for (const sibling of ['chaos', 'knightmare']) {
  test(`later ${sibling} cancellation preserves independent Think Again expenditure and draw`, () => {
    let state = createGameState({
      hands: { white: [sibling], black: ['think-again'] },
      decks: { white: ['legacy'], black: ['riposte', 'legacy'] },
    })
    const original = state.players.black.hand[0]!
    const replacement = state.players.black.deck[0]!
    state = act(state, { type: 'move', from: 'e2', to: 'e4' })
    state = act(state, { type: 'playCard', cardId: 'think-again' })
    state = act(state, { type: 'move', from: 'd2', to: 'd4' })
    state = act(state, { type: 'endTurn' })
    state = act(state, { type: 'move', from: 'e7', to: 'e5' })
    state = act(state, { type: 'playCard', cardId: sibling })
    assert.deepEqual(state.players.black.discard, [original])
    assert.deepEqual(state.players.black.hand, [replacement])
    assert.equal(state.players.black.deck.length, 1)
    assert.equal(state.history.at(-1)?.type, 'cardPlayed')
    assert.equal(state.history.at(-1)?.cardId, sibling)
    state = act(state, { type: 'move', from: 'd7', to: 'd5' })
    state = act(state, { type: 'endTurn' })
    state = act(state, { type: 'move', from: 'e2', to: 'e4' })
    assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-e2')?.square, 'e4')
    assert.deepEqual(state.players.black.discard, [original])
  })
}
