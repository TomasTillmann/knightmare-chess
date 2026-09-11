import assert from 'node:assert/strict'
import test from 'node:test'

import { applyAction, isKingInCheck } from '../reducer.js'
import { createGameState } from '../state.js'
import type { CrabEffect, ConfabulationEffect, ForbiddenCityEffect, PacifismEffect, PieceState, VendettaEffect } from '../types.js'

const CARD = 'irresistible-force'

test('Irresistible Force pushes a pacified rook and chained bishop', () => {
  const state = createGameState({
    fen: '7k/8/8/8/4b3/4r3/4P3/7K w - - 0 1',
    hands: { white: [CARD] },
  })
  const rook = state.pieces.find((piece) => piece.role === 'rook' && piece.square === 'e3')!
  const effect = {
    type: 'pacifism',
    owner: 'black',
    card: { id: 'black-effect-pacifism', cardId: 'pacifism' },
    pieceId: rook.id,
  } satisfies PacifismEffect
  state.effects.push(effect)
  const source = structuredClone(state)

  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'e2', to: 'e3' }],
  })

  assert.deepEqual(state, source)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(
    result.state.pieces.find((piece) => piece.id === source.pieces.find((piece) => piece.role === 'pawn' && piece.square === 'e2')!.id)?.square,
    'e3',
  )
  assert.equal(result.state.pieces.find((piece) => piece.id === rook.id)?.square, 'e4')
  assert.equal(
    result.state.pieces.find((piece) => piece.id === source.pieces.find((piece) => piece.role === 'bishop' && piece.square === 'e4')!.id)?.square,
    'e5',
  )
  assert.deepEqual(result.state.effects, [effect])
})

test('Pacifism rejects only a protected off-board loss', () => {
  const state = createGameState({
    fen: '4b2k/4r3/4P3/8/8/8/8/K7 w - - 0 1',
    hands: { white: [CARD] },
  })
  const bishop = state.pieces.find((piece) => piece.role === 'bishop' && piece.square === 'e8')!
  const effect = {
    type: 'pacifism',
    owner: 'black',
    card: { id: 'black-effect-pacifism', cardId: 'pacifism' },
    pieceId: bishop.id,
  } satisfies PacifismEffect
  state.effects.push(effect)
  const before = structuredClone(state)

  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'e6', to: 'e7' }],
  })

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.deepEqual(state, before)
  assert.deepEqual(result.state, before)
})

test('Truce allows on-board displacement and stays active', () => {
  const state = createGameState({
    fen: '7k/8/8/8/4b3/4r3/K3P3/8 w - - 0 1',
    hands: { white: [CARD] },
  })
  const effect = {
    type: 'truce',
    owner: 'black',
    card: { id: 'black-effect-truce', cardId: 'truce' },
  }
  state.effects.push(effect)
  const source = structuredClone(state)

  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'e2', to: 'e3' }],
  })

  assert.deepEqual(state, source)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.state.pieces.find((piece) => piece.square === 'e3')?.role, 'pawn')
  assert.equal(result.state.pieces.find((piece) => piece.square === 'e4')?.role, 'rook')
  assert.equal(result.state.pieces.find((piece) => piece.square === 'e5')?.role, 'bishop')
  assert.deepEqual(result.state.effects, [effect])
})

test('Truce rejects a terminal off-board loss', () => {
  const state = createGameState({
    fen: '4b2k/4r3/4P3/8/8/8/8/K7 w - - 0 1',
    hands: { white: [CARD] },
  })
  const effect = {
    type: 'truce',
    owner: 'black',
    card: { id: 'black-effect-truce', cardId: 'truce' },
  }
  state.effects.push(effect)
  const before = structuredClone(state)

  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'e6', to: 'e7' }],
  })

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.deepEqual(state, before)
  assert.deepEqual(result.state, before)
  assert.deepEqual(result.state.effects, [effect])
})

// Official FAQ 1354–1362: a blocked Force is played without moving any piece.
test('Forbidden City fizzles a later pushed boundary and spends Force', () => {
  const state = createGameState({
    fen: '7k/8/8/8/4b3/4r3/4P3/K7 w - - 0 1',
    hands: { white: [CARD] },
  })
  const effect = {
    type: 'forbidden-city',
    owner: 'black',
    card: { id: 'black-effect-forbidden-city', cardId: 'forbidden-city' },
    square: 'e5',
  } satisfies ForbiddenCityEffect
  state.effects.push(effect)
  const before = structuredClone(state)

  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'e2', to: 'e3' }],
  })

  assert.ok(result.ok)
  assert.deepEqual(state, before)
  assert.deepEqual(result.state.pieces, before.pieces)
  assert.deepEqual(result.state.effects, [effect])
  assert.deepEqual(result.state.players.white.discard, before.players.white.hand)
  assert.equal(result.state.turn.cardPlays.white, 1)
  assert.equal(result.state.turn.moveMade, true)
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled')
})

test('Earthquake rotates the entire push direction', () => {
  const state = createGameState({
    fen: '7k/8/8/8/3Pr3/8/8/K7 w - - 0 1',
    hands: { white: [CARD] },
  })
  state.orientation = 90
  const pawn = state.pieces.find((piece) => piece.role === 'pawn' && piece.square === 'd4')!
  const rook = state.pieces.find((piece) => piece.role === 'rook' && piece.square === 'e4')!
  const effect = {
    type: 'earthquake',
    owner: 'white',
    card: { id: 'white-effect-earthquake', cardId: 'earthquake' },
    direction: 'clockwise',
    target: { direction: 'clockwise', promotions: [] },
  }
  state.effects.push(effect)
  const source = structuredClone(state)

  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'd4', to: 'e4' }],
  })

  assert.deepEqual(state, source)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.state.pieces.find((piece) => piece.id === pawn.id)?.square, 'e4')
  assert.equal(result.state.pieces.find((piece) => piece.id === rook.id)?.square, 'f4')
  assert.equal(result.state.orientation, 90)
  assert.deepEqual(result.state.effects, [effect])
})

test("Crab does not rotate this card's in-front square", () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/4r3/4P3/K7 w - - 0 1',
    hands: { white: [CARD] },
  })
  const pawn = state.pieces.find((piece) => piece.role === 'pawn' && piece.square === 'e2')!
  const rook = state.pieces.find((piece) => piece.role === 'rook' && piece.square === 'e3')!
  const effect = {
    type: 'crab',
    owner: 'white',
    card: { id: 'white-effect-crab', cardId: 'crab' },
    pieceId: pawn.id,
  } satisfies CrabEffect
  state.effects.push(effect)
  const source = structuredClone(state)

  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'e2', to: 'e3' }],
  })

  assert.deepEqual(state, source)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.state.pieces.find((piece) => piece.id === pawn.id)?.square, 'e3')
  assert.equal(result.state.pieces.find((piece) => piece.id === rook.id)?.square, 'e4')
  assert.deepEqual(result.state.effects, [effect])

  const blocked = createGameState({
    fen: '7k/8/8/8/8/3r4/4P3/K7 w - - 0 1',
    hands: { white: [CARD] },
  })
  const blockedPawn = blocked.pieces.find((piece) => piece.role === 'pawn' && piece.square === 'e2')!
  const blockedEffect = {
    type: 'crab',
    owner: 'white',
    card: { id: 'white-effect-crab', cardId: 'crab' },
    pieceId: blockedPawn.id,
  } satisfies CrabEffect
  blocked.effects.push(blockedEffect)
  const before = structuredClone(blocked)
  const blockedResult = applyAction(blocked, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: blocked.players.white.hand[0]!.id,
    target: [{ from: 'e2', to: 'd3' }],
  })

  assert.equal(blockedResult.ok, false)
  if (blockedResult.ok) return
  assert.deepEqual(blocked, before)
  assert.deepEqual(blockedResult.state, before)
})

test('a neutral mover follows its original owner and preserves neutral identities', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/K3p3/4R3/8 w - - 0 1',
    hands: { white: [CARD] },
  })
  const pawn = state.pieces.find((piece) => piece.role === 'pawn' && piece.square === 'e3')!
  const rook = state.pieces.find((piece) => piece.role === 'rook' && piece.square === 'e2')!
  pawn.neutral = true
  rook.neutral = true
  const source = structuredClone(state)

  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'e3', to: 'e2' }],
  })

  assert.deepEqual(state, source)
  assert.equal(result.ok, true)
  if (!result.ok) return
  const sourcePawn = source.pieces.find((piece) => piece.id === pawn.id)!
  const sourceRook = source.pieces.find((piece) => piece.id === rook.id)!
  assert.deepEqual(result.state.pieces.find((piece) => piece.id === pawn.id), { ...sourcePawn, square: 'e2' })
  assert.deepEqual(result.state.pieces.find((piece) => piece.id === rook.id), { ...sourceRook, square: 'e1' })
})

test('Confabulation identities remain bound through the push', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/4r3/4P3/K7 w - - 0 1',
    hands: { white: [CARD] },
  })
  const pawn = state.pieces.find((piece) => piece.role === 'pawn' && piece.square === 'e2')!
  const rook = state.pieces.find((piece) => piece.role === 'rook' && piece.square === 'e3')!
  const away: PieceState = {
    id: 'white-away-bishop-audit',
    owner: 'white',
    role: 'bishop',
    originalRole: 'bishop',
    square: null,
    zone: 'away',
    promoted: false,
    royal: false,
    neutral: false,
  }
  state.pieces.push(away)
  const effect = {
    type: 'confabulation',
    owner: 'white',
    card: { id: 'white-effect-confabulation', cardId: 'confabulation' },
    pieceIds: [pawn.id, away.id],
  } satisfies ConfabulationEffect
  state.effects.push(effect)
  const source = structuredClone(state)

  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'e2', to: 'e3' }],
  })

  assert.deepEqual(state, source)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.state.pieces.find((piece) => piece.id === pawn.id)?.square, 'e3')
  assert.equal(result.state.pieces.find((piece) => piece.id === rook.id)?.square, 'e4')
  assert.deepEqual(result.state.pieces.find((piece) => piece.id === away.id), away)
  assert.deepEqual(result.state.effects, [effect])
})

test('Vendetta blocks this replacement while an ordinary capture exists', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/4r3/b3P3/R6K w - - 0 1',
    hands: { white: [CARD] },
  })
  const effect = {
    type: 'vendetta',
    owner: 'black',
    card: { id: 'black-effect-vendetta', cardId: 'vendetta' },
  } satisfies VendettaEffect
  state.effects.push(effect)
  const before = structuredClone(state)

  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'e2', to: 'e3' }],
  })

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.deepEqual(state, before)
  assert.deepEqual(result.state, before)
  assert.deepEqual(result.state.effects, [effect])
})

test('Toll payment keeps the pushed chain', () => {
  const state = createGameState({
    fen: '7k/8/8/r7/P7/8/1P6/7K w - - 0 1',
    hands: { white: [CARD], black: ['toll'] },
  })
  const pawn = state.pieces.find((piece) => piece.role === 'pawn' && piece.square === 'a4')!
  const rook = state.pieces.find((piece) => piece.role === 'rook' && piece.square === 'a5')!
  const tollPawn = state.pieces.find((piece) => piece.role === 'pawn' && piece.square === 'b2')!
  const toll = state.players.black.hand[0]!
  const before = structuredClone(state)

  const pushed = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'a4', to: 'a5' }],
  })

  assert.deepEqual(state, before)
  assert.equal(pushed.ok, true)
  if (!pushed.ok) return
  const movement = pushed.state.history.at(-1)?.movement ?? []
  assert.ok(movement.some((move) => move.from === 'a4' && move.to === 'a5'))
  assert.ok(movement.some((move) => move.from === 'a5' && move.to === 'a6'))
  const beforeToll = structuredClone(pushed.state)

  const paid = applyAction(pushed.state, {
    type: 'playCard',
    cardId: 'toll',
    cardInstanceId: toll.id,
    target: 'b2',
  })

  assert.deepEqual(pushed.state, beforeToll)
  assert.equal(paid.ok, true)
  if (!paid.ok) return
  assert.equal(paid.state.pieces.find((piece) => piece.id === tollPawn.id)?.square, null)
  assert.equal(paid.state.pieces.find((piece) => piece.id === pawn.id)?.square, 'a5')
  assert.equal(paid.state.pieces.find((piece) => piece.id === rook.id)?.square, 'a6')
  assert.deepEqual(paid.state.players.black.discard, [toll])
  assert.equal(paid.state.turnCheckpoint ?? null, null)
})

test('declining Toll restores every pushed piece and the terminal capture', () => {
  const state = createGameState({
    fen: 'q6k/n7/b7/r7/P7/8/1P6/4K3 w - - 0 1',
    hands: { white: [CARD], black: ['toll'] },
  })
  assert.equal(isKingInCheck(state, 'white'), false)
  const original = structuredClone(state)
  const placements = original.pieces.map(({ id, square, zone }) => ({ id, square, zone }))
  const whiteCard = original.players.white.hand[0]!
  const toll = original.players.black.hand[0]!
  const queen = original.pieces.find((piece) => piece.role === 'queen' && piece.square === 'a8')!

  const pushed = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'a4', to: 'a5' }],
  })

  assert.deepEqual(state, original)
  assert.equal(pushed.ok, true)
  if (!pushed.ok) return
  assert.deepEqual(pushed.state.pieces.find((piece) => piece.id === queen.id), { ...queen, square: null, zone: 'captured', capturedBy: 'white' })
  const beforeToll = structuredClone(pushed.state)

  const declined = applyAction(pushed.state, {
    type: 'playCard',
    cardId: 'toll',
    cardInstanceId: toll.id,
  })

  assert.deepEqual(pushed.state, beforeToll)
  assert.equal(declined.ok, true)
  if (!declined.ok) return
  assert.deepEqual(declined.state.pieces.map(({ id, square, zone }) => ({ id, square, zone })), placements)
  assert.deepEqual(declined.state.players.white.hand, [whiteCard])
  assert.deepEqual(declined.state.players.black.discard, [toll])
  assert.equal(declined.state.history.length, 1)
  assert.equal(declined.state.history[0]?.type, 'cardPlayed')
  assert.equal(declined.state.history[0]?.cardId, 'toll')
  assert.equal(declined.state.history[0]?.player, 'black')
  assert.equal(declined.state.history[0]?.preservePreviousMove, false)
  assert.equal(isKingInCheck(declined.state, 'white'), false)
  assert.equal(applyAction(declined.state, { type: 'endTurn' }).ok, true)
  assert.deepEqual(declined.state.history[0]?.movement, [])
  assert.equal(declined.state.turn.phase, 'afterMove')
  assert.equal(declined.state.turn.moveMade, true)
  assert.deepEqual(declined.state.turn.cardPlays, { white: 1, black: 1 })
  assert.equal(declined.state.turnCheckpoint ?? null, null)
})

test('a card push capture never qualifies for No Quarter', () => {
  const state = createGameState({
    fen: '4r2k/4b3/4P3/8/8/8/8/K7 w - - 0 1',
    hands: { white: [CARD, 'no-quarter'] },
  })
  const rook = state.pieces.find((piece) => piece.role === 'rook' && piece.square === 'e8')!
  const before = structuredClone(state)

  const pushed = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'e6', to: 'e7' }],
  })

  assert.deepEqual(state, before)
  assert.equal(pushed.ok, true)
  if (!pushed.ok) return
  assert.equal(pushed.state.history.at(-1)?.type, 'cardPlayed')
  assert.equal(pushed.state.history.at(-1)?.capturedId, rook.id)
  assert.deepEqual(pushed.state.pieces.find((piece) => piece.id === rook.id), { ...rook, square: null, zone: 'captured', capturedBy: 'white' })
  const probe = structuredClone(pushed.state)
  probe.turn.cardPlays.white = 0
  const beforeProbe = structuredClone(probe)
  const noQuarter = probe.players.white.hand.find((card) => card.cardId === 'no-quarter')!

  const result = applyAction(probe, {
    type: 'playCard',
    cardId: 'no-quarter',
    cardInstanceId: noQuarter.id,
  })

  assert.deepEqual(probe, beforeProbe)
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.error.code, 'INVALID_TIMING')
  assert.deepEqual(result.state, beforeProbe)
  assert.deepEqual(result.state.pieces.find((piece) => piece.id === rook.id), { ...rook, square: null, zone: 'captured', capturedBy: 'white' })
  assert.deepEqual(result.state.players.white.hand.find((card) => card.id === noQuarter.id), noQuarter)
})

test('a card push capture cannot trigger Revenge', () => {
  const state = createGameState({
    fen: '4p2k/4r3/4P3/8/8/8/8/K7 w - - 0 1',
    hands: { white: [CARD], black: ['revenge'] },
  })
  const terminal = state.pieces.find((piece) => piece.role === 'pawn' && piece.square === 'e8')!
  const mover = state.pieces.find((piece) => piece.role === 'pawn' && piece.square === 'e6')!
  const revenge = state.players.black.hand[0]!
  const before = structuredClone(state)

  const pushed = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'e6', to: 'e7' }],
  })

  assert.deepEqual(state, before)
  assert.equal(pushed.ok, true)
  if (!pushed.ok) return
  assert.equal(pushed.state.history.at(-1)?.type, 'cardPlayed')
  assert.equal(pushed.state.history.at(-1)?.cardId, CARD)
  assert.equal(pushed.state.history.at(-1)?.capturedId, terminal.id)
  assert.deepEqual(pushed.state.pieces.find((piece) => piece.id === terminal.id), { ...terminal, square: null, zone: 'captured', capturedBy: 'white' })
  assert.equal(pushed.state.pieces.find((piece) => piece.id === mover.id)?.square, 'e7')
  const beforeRevenge = structuredClone(pushed.state)

  const result = applyAction(pushed.state, {
    type: 'playCard',
    cardId: 'revenge',
    cardInstanceId: revenge.id,
    target: 'e7',
  })

  assert.deepEqual(pushed.state, beforeRevenge)
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.error.code, 'INVALID_TIMING')
  assert.deepEqual(result.state, beforeRevenge)
  assert.deepEqual(result.state.players.black.hand.find((card) => card.id === revenge.id), revenge)
})

test('continuing markers survive an unsafe-push fizzle', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/3rb3/3P4/2K5 w - - 0 1',
    hands: { white: [CARD] },
  })
  const mover = state.pieces.find((piece) => piece.role === 'pawn' && piece.square === 'd2')!
  const rook = state.pieces.find((piece) => piece.role === 'rook' && piece.square === 'd3')!
  const card = state.players.white.hand[0]!
  const crab = {
    type: 'crab',
    owner: 'white',
    card: { id: 'white-effect-crab', cardId: 'crab' },
    pieceId: mover.id,
  } satisfies CrabEffect
  const pacifism = {
    type: 'pacifism',
    owner: 'black',
    card: { id: 'black-effect-pacifism', cardId: 'pacifism' },
    pieceId: rook.id,
  } satisfies PacifismEffect
  state.effects.push(crab, pacifism)
  const source = structuredClone(state)
  const placements = source.pieces.map(({ id, square, zone }) => ({ id, square, zone }))
  const effects = structuredClone(source.effects)

  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: card.id,
    target: [{ from: 'd2', to: 'd3' }],
  })

  assert.deepEqual(state, source)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled')
  assert.equal(result.state.history.at(-1)?.cardId, CARD)
  assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK')
  assert.deepEqual(result.state.pieces.map(({ id, square, zone }) => ({ id, square, zone })), placements)
  assert.deepEqual(result.state.effects, effects)
  assert.equal(result.state.players.white.hand.find((entry) => entry.id === card.id), undefined)
  assert.deepEqual(result.state.players.white.discard.find((entry) => entry.id === card.id), card)
  assert.equal(result.state.turn.moveMade, true)
})
