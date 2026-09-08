import assert from 'node:assert/strict'
import test from 'node:test'

import { applyAction, boardFen, isKingInCheck, isPromotionSquare, legalDests } from '../reducer.js'
import { createGameState } from '../state.js'
import type { GameState, PieceState, Role, SquareName } from '../types.js'
import { CARD_CATALOG } from './catalog.js'

const kings = '4k3/8/8/8/8/8/8/4K3 w - - 7 12'
const target = (direction: 'clockwise' | 'counterclockwise', promotions: Array<{ square: SquareName; role: Exclude<Role, 'pawn' | 'king'> }> = []) => ({ direction, promotions })

function ready(fen = kings, orientation: GameState['orientation'] = 0): GameState {
  const state = createGameState({ fen, turn: 'white', phase: 'afterMove', moveMade: true, hands: { white: ['earthquake'] }, decks: { white: ['assassin'] } })
  state.orientation = orientation
  return state
}

function play(state: GameState, earthquakeTarget: unknown, cardInstanceId?: string) {
  return applyAction(state, { type: 'playCard', cardId: 'earthquake', cardInstanceId, target: earthquakeTarget })
}

function piece(state: GameState, square: SquareName): PieceState {
  const found = state.pieces.find(candidate => candidate.square === square)
  assert.ok(found, `expected a piece on ${square}`)
  return found
}

test('catalog exposes the artwork contract exactly', () => {
  assert.deepEqual(CARD_CATALOG.earthquake, {
    id: 'earthquake',
    name: 'Earthquake',
    points: 4,
    unique: false,
    image: '/KC5_card2.png',
    description: 'Turn the chessboard 90 degrees in any direction. Pawns move away from their owner, any in the new last rank is promoted, your opponent promoting first. Pawns in the first rank can move one or two squares forward. If undone, the rotation is reversed with the same rules.',
    timing: ['afterMove'],
    continuing: true,
  })
})

test('rotates clockwise and counterclockwise, including wraparound', () => {
  for (const [orientation, direction, expected] of [[0, 'clockwise', 90], [0, 'counterclockwise', 270], [270, 'clockwise', 0], [90, 'counterclockwise', 0]] as const) {
    const result = play(ready(kings, orientation), target(direction))
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.state.orientation, expected)
  }
})

test('rotation changes orientation without physically relocating any piece', () => {
  const state = ready('4k3/8/2r5/8/4P3/8/8/4K3 w - - 7 12')
  const before = state.pieces.map(({ id, square }) => ({ id, square }))
  const result = play(state, target('clockwise'))
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.state.pieces.map(({ id, square }) => ({ id, square })), before)
})

test('owner-relative first and last lines rotate with the orientation', () => {
  const clockwise = play(ready(), target('clockwise'))
  const counterclockwise = play(ready(), target('counterclockwise'))
  assert.equal(clockwise.ok, true)
  assert.equal(counterclockwise.ok, true)
  if (!clockwise.ok || !counterclockwise.ok) return
  for (const [state, whiteLast, blackLast] of [[clockwise.state, 'h4', 'a4'], [counterclockwise.state, 'a4', 'h4']] as const) {
    assert.equal(isPromotionSquare(state, 'white', whiteLast), true)
    assert.equal(isPromotionSquare(state, 'black', blackLast), true)
  }
})

test('pawns move away from their owners and may double-step from the new first line', () => {
  const result = play(ready('4k3/8/8/8/P6p/8/8/4K3 w - - 7 12'), target('clockwise'))
  assert.equal(result.ok, true)
  if (!result.ok) return
  const whiteTurn = structuredClone(result.state)
  whiteTurn.turn.phase = 'beforeMove'
  whiteTurn.turn.moveMade = false
  assert.deepEqual(new Set(legalDests(whiteTurn).get('a4')), new Set<SquareName>(['b4', 'c4']))
  const blackTurn = structuredClone(whiteTurn)
  blackTurn.turn.color = 'black'
  assert.deepEqual(new Set(legalDests(blackTurn).get('h4')), new Set<SquareName>(['g4', 'f4']))
})

test('promotes all qualifying original Pawns opponent-first and in fixed square order', () => {
  const state = ready('4k3/8/8/p6P/p6P/8/4K3/8 w - - 7 12')
  const promotions = target('clockwise', [
    { square: 'a4', role: 'rook' }, { square: 'a5', role: 'bishop' },
    { square: 'h4', role: 'queen' }, { square: 'h5', role: 'knight' },
  ])
  const result = play(state, promotions)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(['a4', 'a5', 'h4', 'h5'].map(square => piece(result.state, square as SquareName).role), ['rook', 'bishop', 'queen', 'knight'])
  assert.deepEqual(result.state.history.at(-1)?.target, promotions)
})

test('promotion preserves transformed Pawn identity, neutral and royal markers', () => {
  const state = ready('4k3/8/8/8/7P/8/8/4K3 w - - 7 12')
  Object.assign(piece(state, 'h4'), { role: 'bishop', originalRole: 'pawn', neutral: true, royal: true })
  const id = piece(state, 'h4').id
  const result = play(state, target('clockwise', [{ square: 'h4', role: 'queen' }]))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(piece(result.state, 'h4'), { ...piece(state, 'h4'), id, role: 'queen', promoted: true })
})

test('requires an empty promotions list when no Pawn qualifies', () => {
  const result = play(ready(), target('clockwise'))
  assert.equal(result.ok, true)
})

test('rejects malformed directions and promotion payloads without mutation', () => {
  const base = ready('4k3/8/8/8/7P/8/8/4K3 w - - 7 12')
  const invalid: unknown[] = [
    undefined, {}, { direction: 'left', promotions: [] }, { direction: 'clockwise' },
    target('clockwise'),
    target('clockwise', [{ square: 'h4', role: 'king' as never }]),
    target('clockwise', [{ square: 'h4', role: 'queen' }, { square: 'h4', role: 'rook' }]),
    target('clockwise', [{ square: 'h4', role: 'queen' }, { square: 'a1', role: 'rook' }]),
  ]
  for (const value of invalid) {
    const snapshot = structuredClone(base)
    const result = play(base, value)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET')
    assert.deepEqual(base, snapshot)
  }
})

test('enforces opponent-first, fixed-square promotion declaration order', () => {
  const state = ready('4k3/8/8/p6P/p6P/8/8/4K3 w - - 7 12')
  for (const promotions of [
    [{ square: 'h4', role: 'queen' }, { square: 'h5', role: 'queen' }, { square: 'a4', role: 'queen' }, { square: 'a5', role: 'queen' }],
    [{ square: 'a5', role: 'queen' }, { square: 'a4', role: 'queen' }, { square: 'h4', role: 'queen' }, { square: 'h5', role: 'queen' }],
  ] as Array<Array<{ square: SquareName; role: 'queen' }>>) assert.equal(play(state, target('clockwise', promotions)).ok, false)
})

test('obeys after-move timing, allowance, and exact card-instance selection', () => {
  const beforeMove = createGameState({ fen: kings, hands: { white: ['earthquake'] } })
  const timing = play(beforeMove, target('clockwise'))
  assert.equal(timing.ok, false)
  if (!timing.ok) assert.equal(timing.error.code, 'INVALID_TIMING')

  const state = ready()
  state.players.white.hand.push({ id: 'chosen-earthquake', cardId: 'earthquake' })
  const first = state.players.white.hand.find(card => card.cardId === 'earthquake')!
  const result = play(state, target('clockwise'), 'chosen-earthquake')
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.ok(result.state.players.white.hand.some(card => card.id === first.id))
    assert.ok(result.state.players.white.discard.every(card => card.id !== 'chosen-earthquake'))
    assert.ok(result.state.effects.some(effect => (effect as { card?: { id?: string } }).card?.id === 'chosen-earthquake'))
  }

  const exhausted = ready()
  exhausted.turn.cardPlays.white = 1
  assert.equal(play(exhausted, target('clockwise')).ok, false)
})

test('continuing lifecycle replaces the card and records direction once', () => {
  const state = ready()
  const handId = state.players.white.hand[0]!.id
  const deckId = state.players.white.deck[0]!.id
  const result = play(state, target('counterclockwise'))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.ok(result.state.players.white.hand.some(card => card.id === deckId))
  assert.ok(result.state.players.white.hand.every(card => card.id !== handId))
  assert.ok(result.state.players.white.discard.every(card => card.id !== handId))
  assert.equal(result.state.effects.filter(effect => (effect as { card?: { id?: string } }).card?.id === handId).length, 1)
  assert.equal((result.state.effects.at(-1) as { direction?: unknown }).direction, 'counterclockwise')
  assert.equal(result.state.history.filter(event => event.cardId === 'earthquake').length, 1)
})

test('syncs FEN while preserving clocks and does not mutate input', () => {
  const state = ready('4k3/8/8/8/8/8/8/4K3 w - - 7 12')
  const snapshot = structuredClone(state)
  const result = play(state, target('clockwise'))
  assert.equal(result.ok, true)
  assert.deepEqual(state, snapshot)
  if (!result.ok) return
  assert.equal(result.state.fen.split(' ')[0], boardFen(result.state))
  assert.deepEqual(result.state.fen.split(' ').slice(4), ['7', '12'])
  assert.equal(result.state.turn.color, 'white')
  assert.equal(result.state.turn.phase, 'afterMove')
})

test('fizzles when rotation newly exposes the acting royal to check', () => {
  const state = ready('4k3/8/8/8/4K3/5p2/8/8 w - - 7 12')
  assert.equal(isKingInCheck(state, 'white'), false)
  const rotated = structuredClone(state)
  rotated.orientation = 90
  assert.equal(isKingInCheck(rotated, 'white'), true)
  const result = play(state, target('clockwise'))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.state.orientation, 0)
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled')
  assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK')
})

test('retains a Continuing Effect rotation that causes immediate mate', () => {
  const state = ready('6P1/5KPk/8/8/8/8/8/8 w - - 7 12')
  const defender = structuredClone(state)
  defender.turn.color = 'black'
  defender.turn.phase = 'beforeMove'
  defender.turn.moveMade = false
  assert.equal(isKingInCheck(defender, 'black'), false)
  assert.deepEqual([...legalDests(defender).get('h7')!], ['h6'])
  defender.orientation = 90
  assert.equal(isKingInCheck(defender, 'black'), true)
  assert.equal([...legalDests(defender).values()].every(destinations => destinations.length === 0), true)
  const result = play(state, target('clockwise'))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.state.orientation, 90)
  assert.equal(isKingInCheck(result.state, 'black'), true)
  assert.equal(isKingInCheck(result.state, 'white'), false)
  assert.notEqual(result.state.history.at(-1)?.type, 'cardFizzled')
  const cardId = state.players.white.hand[0]!.id
  assert.equal(result.state.effects.filter(effect => (effect as { card?: { id?: string } }).card?.id === cardId).length, 1)
  assert.ok(result.state.players.white.discard.every(card => card.id !== cardId))
})

for (const [blackRole, whiteRole, mates] of [
  ['rook', 'queen', true],
  ['rook', 'rook', true],
  ['knight', 'queen', false],
  ['bishop', 'queen', false],
  ['queen', 'queen', false],
] as const) {
  test(`retains clockwise promotion to Black ${blackRole} and White ${whiteRole}, mate=${mates}`, () => {
    const initial = createGameState({ fen: '2R5/k6P/pp6/8/8/8/8/4K1N1 w - - 0 1', hands: { white: ['earthquake'] } })
    const moved = applyAction(initial, { type: 'move', from: 'g1', to: 'f3' })
    assert.equal(moved.ok, true)
    if (!moved.ok) return
    const state = moved.state
    const snapshot = structuredClone(state)
    const cardId = state.players.white.hand[0]!.id
    assert.equal(isKingInCheck(state, 'white'), false)
    assert.equal(isKingInCheck(state, 'black'), false)

    // Verify mate geometry independently of whether the card resolves.
    const geometry = structuredClone(state)
    geometry.orientation = 90
    Object.assign(piece(geometry, 'a6'), { role: blackRole, promoted: true })
    Object.assign(piece(geometry, 'h7'), { role: whiteRole, promoted: true })
    geometry.turn.color = 'black'
    geometry.turn.phase = 'beforeMove'
    geometry.turn.moveMade = false
    assert.equal(isKingInCheck(geometry, 'white'), false)
    assert.equal(isKingInCheck(geometry, 'black'), true)
    assert.equal([...legalDests(geometry).values()].every(destinations => destinations.length === 0), mates)
    if (!mates) assert.ok((legalDests(geometry).get('a6')?.length ?? 0) > 0, 'promoted defender can interpose')

    const promotions = target('clockwise', [{ square: 'a6', role: blackRole }, { square: 'h7', role: whiteRole }])
    const result = play(state, promotions)
    assert.deepEqual(state, snapshot)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.state.orientation, 90)
    for (const [square, role] of [['a6', blackRole], ['h7', whiteRole]] as const) {
      assert.deepEqual(piece(result.state, square), { ...piece(state, square), role, promoted: true })
    }
    assert.equal(isKingInCheck(result.state, 'white'), false)
    assert.equal(isKingInCheck(result.state, 'black'), true)
    assert.equal(result.state.effects.filter(effect => (effect as { card?: { id?: string } }).card?.id === cardId).length, 1)
    assert.ok(result.state.players.white.hand.every(card => card.id !== cardId))
    assert.ok(result.state.players.white.discard.every(card => card.id !== cardId))
    assert.notEqual(result.state.history.at(-1)?.type, 'cardFizzled')
    assert.deepEqual(result.state.history.at(-1)?.target, promotions)
  })
}
