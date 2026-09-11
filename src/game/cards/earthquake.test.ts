import assert from 'node:assert/strict'
import test from 'node:test'

import { annexationDests, applyAction, boardFen, cardPlayTargets, guardianDests, isKingInCheck, isPromotionSquare, legalDests } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameAction, GameState, PieceState, Role, SquareName } from '../types.js'
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

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action)
  assert.ok(result.ok, JSON.stringify(result.ok ? action : result.error))
  return result.state
}

// Square names stay on the board; players stay at the table when it turns.
for (const owner of ['white', 'black'] as const) for (const direction of ['clockwise', 'counterclockwise'] as const) {
  test(`finding44g: physical ${direction} makes ${owner} advance away from its seated owner`, () => {
    const white = owner === 'white'
    const from = white ? 'e2' : 'e7'
    let state = createGameState({
      fen: white ? '7k/8/8/8/8/8/4P3/7K w - - 0 1' : '7k/4p3/8/8/8/8/8/7K b - - 0 1',
      hands: { [owner]: ['earthquake'] },
    })
    const pawn = structuredClone(piece(state, from))
    state = act(state, { type: 'move', from: white ? 'h1' : 'h8', to: white ? 'g1' : 'g8' })
    const before = structuredClone(state)
    const rotated = act(state, { type: 'playCard', cardId: 'earthquake', target: target(direction) })
    assert.deepEqual(state, before)
    assert.deepEqual(rotated.pieces, before.pieces)
    state = act(rotated, { type: 'endTurn' })
    state = act(state, { type: 'move', from: white ? 'h8' : 'h1', to: white ? 'h7' : 'h2' })
    state = act(state, { type: 'endTurn' })
    assert.deepEqual(piece(state, from), pawn)
    const decreasesFile = white === (direction === 'clockwise')
    const to = `${decreasesFile ? 'd' : 'f'}${white ? '2' : '7'}` as SquareName
    const backwards = `${decreasesFile ? 'f' : 'd'}${white ? '2' : '7'}` as SquareName
    assert.deepEqual(legalDests(state, false).get(from), [to])
    assert.equal(applyAction(state, { type: 'move', from, to: backwards }).ok, false)
    state = act(state, { type: 'move', from, to })
    assert.equal(piece(state, to).id, pawn.id)
    act(state, { type: 'endTurn' })
  })
}

for (const direction of ['clockwise', 'counterclockwise'] as const) {
  test(`finding44g: ${direction} composes with every existing physical orientation`, () => {
    const forward = direction === 'clockwise' ? ['d4', 'e5', 'f4', 'e3'] : ['f4', 'e3', 'd4', 'e5']
    for (const [index, orientation] of ([0, 90, 180, 270] as const).entries()) {
      const state = ready('7k/8/8/8/4P3/8/8/7K w - - 0 1', orientation)
      const next = act(state, { type: 'playCard', cardId: 'earthquake', target: target(direction) })
      next.turn.phase = 'beforeMove'
      next.turn.moveMade = false
      assert.deepEqual(legalDests(next, false).get('e4'), [forward[index]])
      next.turn.phase = 'afterMove'
      next.turn.moveMade = true
      next.turn.cardPlays.white = 0
      next.players.white.hand.push({ id: 'cancel', cardId: 'peace-talks' })
      const restored = act(next, { type: 'playCard', cardId: 'peace-talks', target: state.players.white.hand[0].id })
      assert.equal(restored.orientation, orientation)
      assert.deepEqual(restored.pieces, state.pieces)
    }
  })

  test(`finding44g: ${direction} promotes the physical far edges and retains square markers`, () => {
    const clockwise = direction === 'clockwise'
    const state = ready(clockwise ? '7k/8/8/8/P6p/8/8/7K w - - 0 1' : '7k/8/8/8/p6P/8/8/7K w - - 0 1')
    const whiteLast = clockwise ? 'a4' : 'h4', blackLast = clockwise ? 'h4' : 'a4'
    state.effects.push({ type: 'forbidden-city', owner: 'white', card: { id: 'city', cardId: 'forbidden-city' }, square: 'd4' })
    const promotions = [{ square: blackLast, role: 'knight' }, { square: whiteLast, role: 'bishop' }] as const
    assert.ok(cardPlayTargets(state, 'earthquake').some(value => JSON.stringify(value) === JSON.stringify(target(direction, [...promotions]))))
    const next = act(state, { type: 'playCard', cardId: 'earthquake', target: target(direction, [...promotions]) })
    assert.equal(piece(next, whiteLast).role, 'bishop')
    assert.equal(piece(next, blackLast).role, 'knight')
    for (const square of [whiteLast, blackLast] as const) {
      assert.equal(piece(next, square).id, piece(state, square).id)
      assert.equal(piece(next, square).promoted, true)
    }
    assert.deepEqual(next.effects[0], state.effects[0])
  })

  test(`finding44g: ${direction} gives Crab and Pawn cards the same owner-relative forward`, () => {
    const state = ready('7k/8/8/8/4P3/8/8/7K w - - 0 1')
    const next = act(state, { type: 'playCard', cardId: 'earthquake', target: target(direction) })
    const clockwise = direction === 'clockwise'
    assert.deepEqual(guardianDests(next, 'e4'), clockwise ? ['d4'] : ['f4'])
    assert.deepEqual(annexationDests(next, 'e4'), clockwise ? ['c4'] : ['g4'])
    next.effects.push({ type: 'crab', owner: 'white', card: { id: 'crab', cardId: 'crab' }, pieceId: piece(next, 'e4').id })
    next.turn.phase = 'beforeMove'
    next.turn.moveMade = false
    assert.deepEqual(legalDests(next, false).get('e4')?.sort(), clockwise ? ['d3', 'd5'] : ['f3', 'f5'])
  })
}

function restoredPawn(owner: Color = 'white', direction: 'clockwise' | 'counterclockwise' = 'clockwise') {
  const square = (name: SquareName): SquareName => owner === 'white' ? name : `${name[0]}${9 - Number(name[1])}` as SquareName
  let state = createGameState({
    fen: owner === 'white' ? 'k7/8/6P1/8/8/8/8/7K w - - 0 1' : '7k/8/8/8/8/6p1/8/K7 b - - 0 1',
    hands: { [owner]: ['earthquake', 'dubbing', 'peace-talks'] },
    decks: { [owner]: ['assassin', 'panic', 'truce'] },
  })
  const earthquakeId = state.players[owner].hand[0].id
  const actions: GameAction[] = [
    { type: 'move', from: square('h1'), to: square('g1') },
    { type: 'playCard', cardId: 'earthquake', target: target(direction) },
    { type: 'endTurn' }, { type: 'move', from: square('a8'), to: square('b8') }, { type: 'endTurn' },
    { type: 'playCard', cardId: 'dubbing', target: [{ from: square('g6'), to: square('f8') }] },
    { type: 'endTurn' }, { type: 'move', from: square('b8'), to: square('a8') }, { type: 'endTurn' },
    { type: 'move', from: square('g1'), to: square('f1') },
  ]
  for (const action of actions) state = act(state, action)
  return { state, earthquakeId, square: square('f8') }
}

test('Peace Talks cannot leave a restored-last-rank Pawn unpromoted (finding36)', () => {
  const { state, earthquakeId } = restoredPawn()
  assert.equal(piece(state, 'f8').id, 'white-pawn-g6')
  const result = applyAction(state, { type: 'playCard', cardId: 'peace-talks', target: earthquakeId })
  assert.ok(!result.ok || piece(result.state, 'f8').promoted, 'reversing Earthquake must resolve the restored last-rank promotion')
})

for (const role of ['queen', 'rook', 'bishop', 'knight'] as const) {
  test(`Peace Talks lets either owner choose ${role} after either Earthquake direction`, () => {
    for (const owner of ['white', 'black'] as const) for (const direction of ['clockwise', 'counterclockwise'] as const) {
      const { state, earthquakeId, square } = restoredPawn(owner, direction)
      const before = structuredClone(state)
      const declaration = { effectId: earthquakeId, promotions: [{ square, role }] }
      const next = act(state, { type: 'playCard', cardId: 'peace-talks', target: declaration })
      assert.equal(next.orientation, 0)
      assert.deepEqual(piece(next, square), { ...piece(state, square), role, promoted: true })
      assert.equal(next.fen.split(' ')[0], boardFen(next))
      assert.deepEqual(next.fen.split(' ').slice(4), state.fen.split(' ').slice(4))
      assert.deepEqual(next.turn, { ...state.turn, cardPlays: { ...state.turn.cardPlays, [owner]: 1 } })
      assert.deepEqual(next.history.at(-1)?.target, declaration)
      assert.deepEqual(next.players[owner].discard.slice(-2).map(card => card.id), [state.players[owner].hand.find(card => card.cardId === 'peace-talks')!.id, earthquakeId])
      assert.deepEqual(next.players[owner].deck, [])
      assert.ok(next.players[owner].hand.some(card => card.id === state.players[owner].deck[0].id))
      assert.equal(next.effects.length, 0)
      assert.deepEqual(state, before)
      act(next, { type: 'endTurn' })
    }
  })
}

// Public state fixture for cancellation boundaries; the complete reachable sequence is above.
function reversal(fen = '5P2/8/k7/8/8/7K/8/8 w - - 7 12', owner: Color = 'white'): GameState {
  const state = createGameState({ fen, turn: owner, phase: 'afterMove', moveMade: true, hands: { [owner]: ['peace-talks'] }, decks: { [owner]: ['panic'] } })
  state.orientation = 90
  state.effects.push({ type: 'earthquake', owner, card: { id: 'rotation', cardId: 'earthquake' }, direction: 'counterclockwise' })
  return state
}

const cancel = (state: GameState, promotions: unknown, effectId = 'rotation') => applyAction(state, { type: 'playCard', cardId: 'peace-talks', target: { effectId, promotions } })

for (const owner of ['white', 'black'] as const) test(`reversal declarations are opponent-first then square-ordered for ${owner}`, () => {
  const state = reversal('2P2P2/8/7k/8/8/K7/8/2p2p2 w - - 7 12', owner)
  const squares: SquareName[] = owner === 'white' ? ['c1', 'f1', 'c8', 'f8'] : ['c8', 'f8', 'c1', 'f1']
  const promotions = squares.map(square => ({ square, role: 'knight' }))
  const before = structuredClone(state)
  for (const invalid of [promotions.slice(1), [...promotions].reverse(), [promotions[1], promotions[0], ...promotions.slice(2)], [...promotions, promotions[0]]]) {
    const result = cancel(state, invalid)
    assert.equal(result.ok, false)
    assert.strictEqual(result.state, state)
    assert.deepEqual(state, before)
  }
  const result = cancel(state, promotions)
  assert.ok(result.ok)
  for (const square of squares) assert.equal(piece(result.state, square).role, 'knight')
  assert.equal(cardPlayTargets(state, 'peace-talks').length, 256)
})

test('reversal rejects omitted, extra, malformed and inherited declarations atomically', () => {
  const state = reversal()
  const good = { effectId: 'rotation', promotions: [{ square: 'f8', role: 'rook' }] }
  const sparse = Array(1)
  const invalid: unknown[] = ['rotation', {}, null, { effectId: 'rotation' }, { ...good, extra: true }, Object.create(good),
    ...[undefined, null, [], sparse, [{ square: 'f8', role: 'king' }], [{ square: 'f8', role: 'pawn' }], [{ square: 'f8', role: 'ROOK' }], [{ square: 'g8', role: 'rook' }], [{ square: 'f8', role: 'rook', extra: true }], [Object.create(good.promotions[0])], [...good.promotions, good.promotions[0]]].map(promotions => ({ effectId: 'rotation', promotions })),
    { ...good, effectId: 'missing' }, { ...good, effectId: 1 }]
  for (const target of invalid) {
    const before = structuredClone(state)
    const result = applyAction(state, { type: 'playCard', cardId: 'peace-talks', target })
    assert.equal(result.ok, false, JSON.stringify(target))
    if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET')
    assert.strictEqual(result.state, state)
    assert.deepEqual(state, before)
  }
})

test('reversal promotes transformed original Pawns but excludes promoted and composite pieces', () => {
  const state = reversal('2P2P2/8/k7/8/8/7K/8/8 w - - 7 12')
  Object.assign(piece(state, 'c8'), { role: 'bishop' })
  Object.assign(piece(state, 'f8'), { role: 'rook', promoted: true })
  const result = cancel(state, [{ square: 'c8', role: 'knight' }])
  assert.ok(result.ok)
  assert.deepEqual(piece(result.state, 'c8'), { ...piece(state, 'c8'), role: 'knight', promoted: true })
  assert.deepEqual(piece(result.state, 'f8'), piece(state, 'f8'))
  const composite = reversal('5P2/8/k7/8/8/7K/8/2N5 w - - 7 12')
  const pawn = piece(composite, 'f8'), knight = piece(composite, 'c1')
  Object.assign(knight, { zone: 'away', square: null })
  composite.effects.push({ type: 'confabulation', owner: 'white', card: { id: 'merge', cardId: 'confabulation' }, pieceIds: [pawn.id, knight.id] })
  assert.deepEqual(cardPlayTargets(composite, 'peace-talks').filter(value => value === 'rotation'), ['rotation'])
  const next = act(composite, { type: 'playCard', cardId: 'peace-talks', target: 'rotation' })
  assert.deepEqual(next.pieces, composite.pieces)
})

test('reversal cancels only the selected physical rotation and keeps earlier promotion', () => {
  const state = reversal('8/8/k7/8/1P6/7K/8/5P2 w - - 7 12')
  state.orientation = 270
  Object.assign(piece(state, 'b4'), { role: 'bishop', promoted: true })
  state.effects.push({ type: 'earthquake', owner: 'black', card: { id: 'retained', cardId: 'earthquake' }, direction: 'counterclockwise' }, { type: 'earthquake', owner: 'white', card: { id: 'retained2', cardId: 'earthquake' }, direction: 'counterclockwise' })
  const next = cancel(state, [{ square: 'f1', role: 'knight' }])
  assert.ok(next.ok)
  assert.equal(next.state.orientation, 180)
  assert.deepEqual(next.state.effects, state.effects.slice(1))
  assert.deepEqual(piece(next.state, 'b4'), piece(state, 'b4'))
  assert.equal(piece(next.state, 'f1').role, 'knight')
})

test('string cancellation remains valid only when no reversal promotion is required', () => {
  const state = reversal(kings)
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), ['rotation'])
  assert.equal(act(state, { type: 'playCard', cardId: 'peace-talks', target: 'rotation' }).orientation, 0)
  assert.ok(cancel(state, []).ok)
  assert.equal(cancel(state, [{ square: 'f8', role: 'queen' }]).ok, false)
})

test('reversal promotion refreshes Neutrality eligibility without discarding its marker', () => {
  for (const role of ['queen', 'rook', 'bishop', 'knight'] as const) {
    const state = reversal()
    const pawn = piece(state, 'f8')
    pawn.neutral = true
    state.effects.push({ type: 'neutrality', owner: 'white', card: { id: 'neutral', cardId: 'neutrality' }, pieceId: pawn.id, wasNeutral: false })
    const result = cancel(state, [{ square: 'f8', role }])
    assert.ok(result.ok)
    assert.equal(piece(result.state, 'f8').neutral, role !== 'queen')
    assert.equal(result.state.effects.length, 1)
    assert.equal(result.state.players.white.discard.some(card => card.id === 'neutral'), false)
    assert.equal(result.state.fen.split(' ')[0], boardFen(result.state))
  }
})

test('reversal promotion refreshes Coup before final royal safety', () => {
  for (const role of ['queen', 'rook', 'bishop', 'knight'] as const) {
    const state = reversal()
    const pawn = piece(state, 'f8'), prince = piece(state, 'h3')
    pawn.royal = true
    prince.royal = false
    state.effects.push({ type: 'coup', owner: 'white', card: { id: 'coup', cardId: 'coup' }, kingId: pawn.id, princeId: prince.id, princeRole: 'king' })
    const result = cancel(state, [{ square: 'f8', role }])
    assert.ok(result.ok)
    assert.equal(piece(result.state, 'f8').royal, role === 'bishop' || role === 'knight')
    assert.equal(piece(result.state, 'h3').royal, role === 'queen' || role === 'rook')
    assert.equal(result.state.effects.length, 1)
  }
})

for (const [reason, fen, square, role] of [
  ['SELF_CHECK', '8/8/k7/8/8/5K2/8/5p2 w - - 7 12', 'f1', 'rook'],
  ['DIRECT_MATE', 'k1P5/8/1K6/8/8/8/8/8 w - - 7 12', 'c8', 'rook'],
] as const) test(`Peace Talks evaluates ${reason} after the entire reversal promotion`, () => {
  const state = reversal(fen)
  assert.equal(isKingInCheck(state, 'white'), false)
  assert.equal(isKingInCheck(state, 'black'), false)
  const geometry = structuredClone(state)
  geometry.orientation = 0
  Object.assign(piece(geometry, square), { role, promoted: true })
  if (reason === 'DIRECT_MATE') {
    geometry.turn.color = 'black'
    geometry.turn.phase = 'beforeMove'
    geometry.turn.moveMade = false
    assert.equal(isKingInCheck(geometry, 'black'), true)
    assert.equal([...legalDests(geometry).values()].every(destinations => destinations.length === 0), true)
  } else assert.equal(isKingInCheck(geometry, 'white'), true)
  const result = cancel(state, [{ square, role }])
  assert.ok(result.ok)
  assert.equal(result.state.history.at(-1)?.reason, reason)
  assert.deepEqual(result.state.pieces, state.pieces)
  assert.deepEqual(result.state.effects, state.effects)
  assert.equal(result.state.orientation, state.orientation)
  assert.equal(result.state.players.white.discard.length, 1)
  assert.equal(result.state.players.white.deck.length, 0)
})

test('reversal fizzles when promotion suspends Coup and exposes the restored King', () => {
  const state = reversal('5Pnr/8/k7/8/8/7K/8/8 w - - 7 12')
  const pawn = piece(state, 'f8'), prince = piece(state, 'h3')
  pawn.royal = true
  prince.royal = false
  state.effects.push({ type: 'coup', owner: 'white', card: { id: 'coup', cardId: 'coup' }, kingId: pawn.id, princeId: prince.id, princeRole: 'king' })
  assert.equal(isKingInCheck(state, 'white'), false)
  const result = cancel(state, [{ square: 'f8', role: 'queen' }])
  assert.ok(result.ok)
  assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK')
  assert.deepEqual(result.state.pieces, state.pieces)
  assert.deepEqual(result.state.effects, state.effects)
  assert.equal(result.state.orientation, 90)
})

test('reversal clears the obsolete rotated en-passant opportunity without changing clocks', () => {
  const before = reversal('5P2/8/k7/8/1P6/7K/8/8 w - - 7 12')
  before.turn.phase = 'beforeMove'
  before.turn.moveMade = false
  const state = act(before, { type: 'move', from: 'b4', to: 'd4' })
  assert.deepEqual(state.enPassant, [{ pawnId: 'white-pawn-b4', target: 'c4' }])
  const result = cancel(state, [{ square: 'f8', role: 'knight' }])
  assert.ok(result.ok)
  assert.deepEqual(result.state.enPassant, [])
  assert.deepEqual(result.state.fen.split(' ').slice(3), ['-', '0', '12'])
})

test('string Earthquake cancellation preserves existing metadata when no promotions are needed', () => {
  const before = reversal('8/8/k7/8/1P6/7K/8/8 w - - 7 12')
  before.turn.phase = 'beforeMove'
  before.turn.moveMade = false
  const state = act(before, { type: 'move', from: 'b4', to: 'd4' })
  assert.deepEqual(state.enPassant, [{ pawnId: 'white-pawn-b4', target: 'c4' }])
  const next = act(state, { type: 'playCard', cardId: 'peace-talks', target: 'rotation' })
  assert.equal(next.orientation, 0)
  assert.deepEqual(next.enPassant, state.enPassant)
  assert.equal(next.fen, state.fen)
  assert.deepEqual(next.pieces, state.pieces)
})

test('copied Peace Talks enumerates all reversal choices and spends the copy identity', () => {
  const state = reversal()
  state.players.white.hand = [{ id: 'copy', cardId: 'haunting-memories' }]
  state.history.push({ type: 'cardPlayed', cardId: 'peace-talks', player: 'black' })
  const choices = cardPlayTargets(state, 'haunting-memories')
  assert.equal(choices.length, 4)
  for (const target of choices) {
    const next = act(state, { type: 'playCard', cardId: 'haunting-memories', target })
    assert.equal(piece(next, 'f8').promoted, true)
    assert.equal(next.orientation, 0)
    assert.deepEqual(next.players.white.discard.map(card => card.id), ['copy', 'rotation'])
    assert.equal(next.history.at(-1)?.copiedCardId, 'peace-talks')
  }
})

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
  for (const [orientation, direction, expected] of [[0, 'clockwise', 270], [0, 'counterclockwise', 90], [90, 'clockwise', 0], [270, 'counterclockwise', 0]] as const) {
    const result = play(ready(kings, orientation), target(direction))
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.state.orientation, expected)
  }
})

test('physical rotation retains board-attached cells and piece identities', () => {
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
  for (const [state, whiteLast, blackLast] of [[clockwise.state, 'a4', 'h4'], [counterclockwise.state, 'h4', 'a4']] as const) {
    assert.equal(isPromotionSquare(state, 'white', whiteLast), true)
    assert.equal(isPromotionSquare(state, 'black', blackLast), true)
  }
})

test('pawns move away from their owners and may double-step from the new first line', () => {
  const result = play(ready('4k3/8/8/8/P6p/8/8/4K3 w - - 7 12'), target('counterclockwise'))
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
  const promotions = target('counterclockwise', [
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
  const result = play(state, target('counterclockwise', [{ square: 'h4', role: 'queen' }]))
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
    target('counterclockwise'),
    target('counterclockwise', [{ square: 'h4', role: 'king' as never }]),
    target('counterclockwise', [{ square: 'h4', role: 'queen' }, { square: 'h4', role: 'rook' }]),
    target('counterclockwise', [{ square: 'h4', role: 'queen' }, { square: 'a1', role: 'rook' }]),
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
  ] as Array<Array<{ square: SquareName; role: 'queen' }>>) assert.equal(play(state, target('counterclockwise', promotions)).ok, false)
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
  const result = play(state, target('counterclockwise'))
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
  const result = play(state, target('counterclockwise'))
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
  test(`retains counterclockwise promotion to Black ${blackRole} and White ${whiteRole}, mate=${mates}`, () => {
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

    const promotions = target('counterclockwise', [{ square: 'a6', role: blackRole }, { square: 'h7', role: whiteRole }])
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
