import assert from 'node:assert/strict'
import test from 'node:test'

import { applyAction, boardFen, cardPlayTargets, legalDests } from '../reducer.js'
import { createGameState } from '../state.js'

type State = ReturnType<typeof createGameState>
type Action = Parameters<typeof applyAction>[1]

const assertPublicInvariants = (state: State) => {
  assert.equal(boardFen(state), state.fen.split(' ')[0])
  assert.equal(new Set(state.pieces.map((piece) => piece.id)).size, state.pieces.length)
  const occupied = state.pieces.flatMap((piece) => (piece.square === null ? [] : [piece.square]))
  assert.equal(new Set(occupied).size, occupied.length)
  for (const piece of state.pieces) assert.equal(piece.zone === 'board', piece.square !== null)
  for (const owner of ['white', 'black'] as const) {
    assert.equal(state.pieces.filter((piece) => piece.owner === owner && piece.royal).length, 1)
  }
  const cards = (['white', 'black'] as const).flatMap((owner) => [
    ...state.players[owner].hand,
    ...state.players[owner].deck,
    ...state.players[owner].discard,
  ])
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length)
  assert.equal(state.turn.phase === 'afterMove', state.turn.moveMade)
  for (const plays of Object.values(state.turn.cardPlays)) {
    assert.ok(Number.isInteger(plays) && plays >= 0 && plays <= 1)
  }
}

const step = (state: State, action: Action) => {
  const snapshot = structuredClone(state)
  const result = applyAction(state, action)
  assert.deepEqual(state, snapshot)
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  assertPublicInvariants(result.state)
  return result.state
}

const reject = (state: State, action: Action) => {
  const snapshot = structuredClone(state)
  const result = applyAction(state, action)
  assert.deepEqual(state, snapshot)
  assert.equal(result.ok, false)
  assert.deepEqual(result.state, snapshot)
  assertPublicInvariants(result.state)
  return result.state
}

const lcg = (seed: number) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)

const pick = <T>(values: readonly T[], random: () => number): T => {
  assert.ok(values.length > 0)
  return values[Math.floor(random() * values.length)]!
}

const seededMove = (state: State, random: () => number) => {
  const moves = [...legalDests(state)].flatMap(([from, tos]) => tos.map((to) => ({ from, to })))
  return pick(moves, random)
}

test('Toll plays the selected physical copy when duplicate copies are held', () => {
  const initial = createGameState({
    fen: '4k3/8/8/8/P7/8/8/4K3 w - - 0 1',
    hands: { black: ['toll', 'toll'] },
    decks: { black: ['revenge'] },
  })

  const tollIds = initial.players.black.hand.map((card) => card.id)
  assert.equal(tollIds.length, 2)

  assertPublicInvariants(initial)
  const afterMove = step(initial, { type: 'move', from: 'a4', to: 'a5' })

  const afterToll = step(afterMove, {
    type: 'playCard',
    cardId: 'toll',
    cardInstanceId: tollIds[1],
    target: 'a5',
  })

  assert.ok(afterToll.players.black.hand.some((card) => card.id === tollIds[0]))
  assert.ok(!afterToll.players.black.hand.some((card) => card.id === tollIds[1]))
  assert.ok(afterToll.players.black.discard.some((card) => card.id === tollIds[1]))
  assert.ok(afterToll.players.black.hand.some((card) => card.id === 'black-deck-0-revenge'))
  assert.equal(afterToll.turnCheckpoint, undefined)
})

test('seeded ordinary frontier crossing pays Toll and permits a black reply', () => {
  const random = lcg(17)
  const initial = createGameState({
    fen: '7k/8/8/8/R7/8/1PPP4/7K w - - 0 1',
    hands: { black: ['toll'] },
  })
  assertPublicInvariants(initial)

  const crossed = step(initial, { type: 'move', from: 'a4', to: 'a5' })
  const payment = pick(
    cardPlayTargets(crossed, 'toll').filter((target): target is string => typeof target === 'string'),
    random,
  )
  const paidPiece = crossed.pieces.find((piece) => piece.square === payment)
  assert.ok(paidPiece && paidPiece.role === 'pawn')

  const paid = step(crossed, { type: 'playCard', cardId: 'toll', target: payment })
  assert.equal(paid.pieces.find((piece) => piece.id === paidPiece.id)?.zone, 'captured')
  const blackTurn = step(paid, { type: 'endTurn' })
  step(blackTurn, { type: 'move', ...seededMove(blackTurn, random) })
})

test('seeded rotated frontier crossing can decline Toll and still pass the turn', () => {
  const random = lcg(7)
  const fixture = pick([
    { orientation: 90 as const, fen: '7k/8/8/8/3R4/8/1P6/7K w - - 0 1', from: 'd4', to: 'e4' },
    { orientation: 180 as const, fen: '7k/8/8/R7/8/8/1P6/7K w - - 0 1', from: 'a5', to: 'a4' },
    { orientation: 270 as const, fen: '7k/8/8/8/4R3/8/1P6/7K w - - 0 1', from: 'e4', to: 'd4' },
  ], random)
  const initial = { ...createGameState({ fen: fixture.fen, hands: { black: ['toll'] } }), orientation: fixture.orientation }
  assertPublicInvariants(initial)

  const crossed = step(initial, { type: 'move', from: fixture.from, to: fixture.to })
  const targets = cardPlayTargets(crossed, 'toll')
  assert.ok(targets.includes(undefined))
  const decline = targets.find((target) => target === undefined)
  const declined = step(crossed, { type: 'playCard', cardId: 'toll', target: decline })
  assert.equal(declined.fen, `${boardFen(initial)} b - - 1 1`)
  assert.equal(boardFen(declined), boardFen(initial))
  assert.deepEqual(declined.pieces, initial.pieces)
  assert.deepEqual(declined.enPassant, initial.enPassant)
  assert.deepEqual(declined.effects, initial.effects)
  assert.equal(declined.orientation, initial.orientation)
  assert.equal(declined.turn.color, 'white')
  assert.equal(declined.turn.phase, 'afterMove')
  assert.equal(declined.turn.moveMade, true)

  const blackTurn = step(declined, { type: 'endTurn' })
  step(blackTurn, { type: 'move', ...seededMove(blackTurn, random) })
})

test('declining Toll rolls back an earlier Pacifism play and restores its physical card', () => {
  const random = lcg(29)
  const initial = createGameState({
    fen: '7k/8/8/8/R7/8/1P6/7K w - - 0 1',
    hands: { white: ['pacifism'], black: ['toll'] },
  })
  assertPublicInvariants(initial)
  const pacifism = initial.players.white.hand[0]!
  const toll = initial.players.black.hand[0]!

  const pacified = step(initial, {
    type: 'playCard',
    cardId: 'pacifism',
    cardInstanceId: pacifism.id,
    target: 'b2',
  })
  const crossed = step(pacified, { type: 'move', from: 'a4', to: 'a5' })
  const targets = cardPlayTargets(crossed, 'toll')
  assert.ok(targets.includes(undefined))
  const decline = targets.find((target) => target === undefined)
  const declined = step(crossed, {
    type: 'playCard',
    cardId: 'toll',
    cardInstanceId: toll.id,
    target: decline,
  })

  assert.equal(declined.fen, `${boardFen(initial)} b - - 1 1`)
  assert.deepEqual(declined.pieces, initial.pieces)
  assert.deepEqual(declined.enPassant, initial.enPassant)
  assert.deepEqual(declined.effects, initial.effects)
  assert.deepEqual(declined.players.white.hand, initial.players.white.hand)
  assert.ok(declined.players.white.hand.some((card) => card.id === pacifism.id))
  assert.ok(!declined.players.black.hand.some((card) => card.id === toll.id))
  assert.ok(declined.players.black.discard.some((card) => card.id === toll.id))

  const blackTurn = step(declined, { type: 'endTurn' })
  step(blackTurn, { type: 'move', ...seededMove(blackTurn, random) })
})

test('malformed and Pacifism-protected Toll payments reject atomically before recovery', () => {
  const random = lcg(42)
  const initial = createGameState({
    fen: '7k/8/8/8/R7/8/1PP5/7K w - - 0 1',
    hands: { black: ['toll'] },
  })
  assertPublicInvariants(initial)
  const crossed = step(initial, { type: 'move', from: 'a4', to: 'a5' })

  const malformed = pick([null, {}, [], 'z9'] as const, random)
  reject(crossed, { type: 'playCard', cardId: 'toll', target: malformed })

  const protectedPawn = crossed.pieces.find((piece) => piece.square === 'b2')!
  const protectedCrossed: State = {
    ...crossed,
    effects: [...crossed.effects, {
      type: 'pacifism',
      owner: 'white',
      card: { id: 'white-effect-pacifism', cardId: 'pacifism' },
      pieceId: protectedPawn.id,
    }],
  }
  assertPublicInvariants(protectedCrossed)
  reject(protectedCrossed, { type: 'playCard', cardId: 'toll', target: 'b2' })

  const payment = pick(
    cardPlayTargets(crossed, 'toll').filter((target): target is string => typeof target === 'string'),
    random,
  )
  const paidPiece = crossed.pieces.find((piece) => piece.square === payment)!
  const recovered = step(crossed, { type: 'playCard', cardId: 'toll', target: payment })
  assert.equal(recovered.pieces.find((piece) => piece.id === paidPiece.id)?.zone, 'captured')
})
