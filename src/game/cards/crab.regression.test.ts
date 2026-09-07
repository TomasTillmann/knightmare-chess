import assert from 'node:assert/strict'
import test from 'node:test'

import { applyAction, boardFen, cardPlayTargets, legalDests } from '../reducer.js'
import { createGameState } from '../state.js'
import type { BoardOrientation, Color, GameAction, GameState, Role, SquareName } from '../types.js'

const orientations: readonly BoardOrientation[] = [0, 90, 180, 270]
const forward: Record<BoardOrientation, readonly [number, number]> = {
  0: [0, 1], 90: [1, 0], 180: [0, -1], 270: [-1, 0],
}
const square = (file: number, rank: number) => `${'abcdefgh'[file]}${rank + 1}` as SquareName
const lcg = (seed: number) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0)

function placementFen(entries: ReadonlyArray<readonly [SquareName, string]>): string {
  const board = Array.from({ length: 8 }, () => Array(8).fill(''))
  for (const [name, piece] of entries) board[Number(name[1]) - 1]['abcdefgh'.indexOf(name[0])] = piece
  return board.reverse().map(rank => {
    let empty = 0
    return `${rank.map(piece => {
      if (!piece) { empty += 1; return '' }
      const prefix = empty ? String(empty) : ''
      empty = 0
      return prefix + piece
    }).join('')}${empty || ''}`
  }).join('/')
}

function validate(state: GameState): void {
  const fields = state.fen.split(' ')
  assert.equal(fields.length, 6)
  assert.equal(fields[0], boardFen(state))
  assert.equal(state.turn.phase === 'afterMove', state.turn.moveMade)
  for (const value of Object.values(state.turn.cardPlays)) assert.ok(Number.isInteger(value) && value >= 0 && value <= 1)

  assert.equal(new Set(state.pieces.map(piece => piece.id)).size, state.pieces.length)
  const boardPieces = state.pieces.filter(piece => piece.zone === 'board')
  assert.equal(new Set(boardPieces.map(piece => piece.square)).size, boardPieces.length)
  for (const piece of state.pieces) assert.equal(piece.zone === 'board', piece.square !== null)
  for (const color of ['white', 'black'] as const) assert.equal(state.pieces.filter(piece => piece.owner === color && piece.royal).length, 1)

  const cardIds: string[] = []
  for (const color of ['white', 'black'] as const) {
    for (const zone of ['hand', 'deck', 'discard'] as const) {
      for (const card of state.players[color][zone]) {
        assert.ok(card.id && card.cardId)
        cardIds.push(card.id)
      }
    }
  }
  for (const effect of state.effects) {
    assert.ok(effect && typeof effect === 'object')
    const record = effect as Record<string, unknown>
    assert.equal(typeof record.type, 'string')
    assert.ok(record.owner === 'white' || record.owner === 'black')
    const card = record.card as { id?: unknown; cardId?: unknown }
    assert.equal(typeof card?.id, 'string')
    assert.equal(typeof card?.cardId, 'string')
    cardIds.push(card.id as string)
    if (record.pieceId !== undefined) assert.ok(state.pieces.some(piece => piece.id === record.pieceId))
  }
  assert.equal(new Set(cardIds).size, cardIds.length)

  if (state.outcome) {
    assert.ok(state.outcome.reason === 'checkmate' || state.outcome.reason === 'stalemate')
    if (state.outcome.reason === 'checkmate') assert.ok(state.outcome.winner === 'white' || state.outcome.winner === 'black')
    else assert.equal(state.outcome.winner, undefined)
  }
}

function succeed(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state)
  const result = applyAction(state, action)
  assert.deepEqual(state, before)
  validate(state)
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`)
  validate(result.state)
  return result.state
}

function reject(state: GameState, action: GameAction): void {
  const before = structuredClone(state)
  const result = applyAction(state, action)
  assert.deepEqual(state, before)
  validate(state)
  assert.equal(result.ok, false)
  assert.deepEqual(result.state, before)
  validate(result.state)
}

test('seeded central Crab moves and captures follow every orientation', () => {
  const random = lcg(0xc12ab)
  const order = [...orientations]
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = random() % (index + 1)
    ;[order[index], order[swap]] = [order[swap], order[index]]
  }
  const seen = new Set<BoardOrientation>()
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const orientation = order[iteration % order.length]
    seen.add(orientation)
    const [forwardFile, forwardRank] = forward[orientation]
    const side = random() % 2 ? 1 : -1
    const to = square(3 + forwardFile + side * forwardRank, 3 + forwardRank - side * forwardFile)
    const capture = iteration % 2 === 1
    const entries: Array<readonly [SquareName, string]> = [['a1', 'K'], ['h8', 'k'], ['d4', 'P']]
    if (capture) entries.push([to, 'p'])
    let state = createGameState({
      fen: `${placementFen(entries)} w - - 0 1`, phase: 'afterMove', moveMade: true,
      hands: { white: ['crab'] },
    })
    state.orientation = orientation
    validate(state)
    assert.deepEqual(cardPlayTargets(state, 'crab'), ['d4'])
    const pawnId = state.pieces.find(piece => piece.square === 'd4')?.id
    const victimId = state.pieces.find(piece => piece.square === to)?.id
    assert.ok(pawnId)
    state = succeed(state, { type: 'playCard', cardId: 'crab', target: 'd4' })
    assert.ok(state.effects.some(effect => {
      const record = effect as { type?: unknown; pieceId?: unknown }
      return record.type === 'crab' && record.pieceId === pawnId
    }))
    state = succeed(state, { type: 'endTurn' })
    state = succeed(state, { type: 'move', from: 'h8', to: 'g8' })
    state = succeed(state, { type: 'endTurn' })
    assert.ok(legalDests(state).get('d4')?.includes(to))
    state = succeed(state, { type: 'move', from: 'd4', to })
    assert.equal(boardFen(state), placementFen([['a1', 'K'], ['g8', 'k'], [to, 'P']]))
    if (victimId) assert.equal(state.pieces.find(piece => piece.id === victimId)?.zone, 'captured')
  }
  assert.deepEqual(seen, new Set(orientations))
})

test('the selected duplicate Crab stays attached while replacement draw and seeded turns proceed', () => {
  const random = lcg(0x5ec0dd)
  let state = createGameState({
    fen: '7k/8/8/8/8/8/3P4/K7 w - - 0 1', phase: 'afterMove', moveMade: true,
    hands: { white: ['crab', 'crab'] }, decks: { white: ['pacifism'] },
  })
  const pawnId = state.pieces.find(piece => piece.square === 'd2')?.id
  const [firstCrab, selectedCrab] = state.players.white.hand
  assert.ok(pawnId && firstCrab && selectedCrab)
  state = succeed(state, {
    type: 'playCard', cardId: 'crab', cardInstanceId: selectedCrab.id, target: 'd2',
  })
  assert.deepEqual(state.players.white.hand.map(card => card.id), [firstCrab.id, 'white-deck-0-pacifism'])
  assert.equal(state.players.white.deck.length, 0)
  assert.ok(state.effects.some(effect => {
    const record = effect as { type?: unknown; pieceId?: unknown; card?: { id?: unknown } }
    return record.type === 'crab' && record.pieceId === pawnId && record.card?.id === selectedCrab.id
  }))

  state = succeed(state, { type: 'endTurn' })
  for (let turn = 0; turn < 3; turn += 1) {
    const replies = [...legalDests(state)].flatMap(([from, dests]) => dests.map(to => ({ from, to })))
    assert.ok(replies.length)
    state = succeed(state, { type: 'move', ...replies[random() % replies.length] })
    state = succeed(state, { type: 'endTurn' })

    const crabSquare: SquareName | null | undefined = state.pieces.find(piece => piece.id === pawnId)?.square
    assert.ok(crabSquare)
    const destinations = legalDests(state).get(crabSquare) ?? []
    assert.ok(destinations.length)
    const destination = destinations[random() % destinations.length]
    state = succeed(state, { type: 'move', from: crabSquare, to: destination })
    assert.equal(state.pieces.find(piece => piece.id === pawnId)?.square, destination)
    if (turn < 2) state = succeed(state, { type: 'endTurn' })
  }
  assert.ok(state.effects.some(effect => (effect as { pieceId?: unknown }).pieceId === pawnId))
})

test('seeded last-rank Crab promotions expire their physical effect card before the opponent reply', () => {
  const random = lcg(0x1a57cafe)
  const order = [...orientations]
  const promotions: Role[] = ['queen', 'rook', 'bishop', 'knight']
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = random() % (index + 1)
    ;[order[index], order[swap]] = [order[swap], order[index]]
    ;[promotions[index], promotions[swap]] = [promotions[swap], promotions[index]]
  }
  const kings: Record<BoardOrientation, readonly [SquareName, SquareName]> = {
    0: ['a1', 'h5'], 90: ['a1', 'd8'], 180: ['a8', 'h6'], 270: ['h1', 'e8'],
  }
  const symbol: Record<Role, string> = {
    pawn: 'P', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K',
  }

  for (const [index, orientation] of order.entries()) {
    const [forwardFile, forwardRank] = forward[orientation]
    const sourceFile = forwardFile ? (forwardFile > 0 ? 6 : 1) : 3
    const sourceRank = forwardRank ? (forwardRank > 0 ? 6 : 1) : 3
    const side = random() % 2 ? 1 : -1
    const from = square(sourceFile, sourceRank)
    const to = square(
      sourceFile + forwardFile + side * forwardRank,
      sourceRank + forwardRank - side * forwardFile,
    )
    const [whiteKing, blackKing] = kings[orientation]
    let state = createGameState({
      fen: `${placementFen([[whiteKing, 'K'], [blackKing, 'k'], [from, 'P']])} w - - 0 1`,
      phase: 'afterMove', moveMade: true, hands: { white: ['crab'] },
    })
    state.orientation = orientation
    validate(state)
    const pawnId = state.pieces.find(piece => piece.square === from)?.id
    const cardId = state.players.white.hand[0]?.id
    assert.ok(pawnId && cardId)
    state = succeed(state, { type: 'playCard', cardId: 'crab', target: from })
    state = succeed(state, { type: 'endTurn' })
    const firstReplies = [...legalDests(state)].flatMap(([replyFrom, dests]) =>
      dests.map(replyTo => ({ from: replyFrom, to: replyTo })),
    )
    assert.ok(firstReplies.length)
    state = succeed(state, { type: 'move', ...firstReplies[random() % firstReplies.length] })
    state = succeed(state, { type: 'endTurn' })

    assert.ok(legalDests(state).get(from)?.includes(to))
    state = succeed(state, { type: 'move', from, to, promotion: promotions[index] })
    const promoted = state.pieces.find(piece => piece.id === pawnId)
    assert.equal(promoted?.square, to)
    assert.equal(promoted?.role, promotions[index])
    assert.equal(promoted?.promoted, true)
    assert.ok(!state.effects.some(effect => (effect as { pieceId?: unknown }).pieceId === pawnId))
    assert.ok(state.players.white.discard.some(card => card.id === cardId && card.cardId === 'crab'))
    const liveBlackKing = state.pieces.find(piece => piece.owner === 'black' && piece.royal)?.square
    assert.ok(liveBlackKing)
    assert.equal(boardFen(state), placementFen([[whiteKing, 'K'], [liveBlackKing, 'k'], [to, symbol[promotions[index]]]]))

    state = succeed(state, { type: 'endTurn' })
    const replies = [...legalDests(state)].flatMap(([replyFrom, dests]) =>
      dests.map(replyTo => ({ from: replyFrom, to: replyTo })),
    )
    assert.ok(replies.length)
    state = succeed(state, { type: 'move', ...replies[random() % replies.length] })
    assert.equal(state.pieces.find(piece => piece.id === pawnId)?.role, promotions[index])
  }
})

test('Crab, Earthquake, and Pacifism compose across real turns', () => {
  const random = lcg(0xea27c1c)
  let state = createGameState({
    fen: '7k/8/8/4p3/3P4/8/8/K7 w - - 0 1', phase: 'afterMove', moveMade: true,
    hands: { white: ['crab', 'pacifism'], black: ['earthquake'] },
  })
  const pawnId = state.pieces.find(piece => piece.square === 'd4')?.id
  assert.ok(pawnId)
  state = succeed(state, { type: 'playCard', cardId: 'crab', target: 'd4' })
  state = succeed(state, { type: 'endTurn' })
  state = succeed(state, { type: 'move', from: 'h8', to: 'g8' })
  assert.ok(cardPlayTargets(state, 'earthquake').some(target =>
    (target as { direction?: unknown; promotions?: unknown[] }).direction === 'clockwise'
      && (target as { promotions?: unknown[] }).promotions?.length === 0,
  ))
  state = succeed(state, {
    type: 'playCard', cardId: 'earthquake', target: { direction: 'clockwise', promotions: [] },
  })
  assert.equal(state.orientation, 90)
  state = succeed(state, { type: 'endTurn' })

  assert.ok(cardPlayTargets(state, 'pacifism').includes('d4'))
  state = succeed(state, { type: 'playCard', cardId: 'pacifism', target: 'd4' })
  assert.ok(state.effects.some(effect => {
    const record = effect as { type?: unknown; pieceId?: unknown }
    return record.type === 'pacifism' && record.pieceId === pawnId
  }))
  assert.deepEqual(legalDests(state).get('d4'), ['e3'])
  reject(state, { type: 'move', from: 'd4', to: 'e5' })
  state = succeed(state, { type: 'move', from: 'd4', to: 'e3' })
  state = succeed(state, { type: 'endTurn' })

  const replies = [...legalDests(state)].flatMap(([from, dests]) => dests.map(to => ({ from, to })))
  assert.ok(replies.length)
  state = succeed(state, { type: 'move', ...replies[random() % replies.length] })
  state = succeed(state, { type: 'endTurn' })
  const crabDests = legalDests(state).get('e3') ?? []
  assert.ok(crabDests.length)
  state = succeed(state, { type: 'move', from: 'e3', to: crabDests[random() % crabDests.length] })
  assert.equal(state.orientation, 90)
  assert.equal(state.effects.filter(effect => (effect as { pieceId?: unknown }).pieceId === pawnId).length, 2)
})

test('malformed and illegal attempts recover on neutral and previously transformed original Pawns', () => {
  const random = lcg(0xa70f1c)
  const variants: ReadonlyArray<{ owner: Color; piece: string; neutral: boolean; role: Role }> = [
    { owner: 'black', piece: 'p', neutral: true, role: 'pawn' },
    { owner: 'white', piece: 'R', neutral: false, role: 'rook' },
  ]
  for (const variant of variants) {
    const orientation = orientations[random() % orientations.length]
    let state = createGameState({
      fen: `${placementFen([['a1', 'K'], ['h8', 'k'], ['d4', variant.piece]])} w - - 0 1`,
      phase: 'afterMove', moveMade: true, hands: { white: ['crab'] },
    })
    state.orientation = orientation
    const pawn = state.pieces.find(piece => piece.square === 'd4')
    assert.ok(pawn)
    pawn.originalRole = 'pawn'
    pawn.neutral = variant.neutral
    validate(state)

    for (const target of [undefined, null, 7, {}, 'z9', 'e4']) {
      reject(state, { type: 'playCard', cardId: 'crab', target })
    }
    assert.deepEqual(cardPlayTargets(state, 'crab'), ['d4'])
    const pawnId = pawn.id
    state = succeed(state, { type: 'playCard', cardId: 'crab', target: 'd4' })
    state = succeed(state, { type: 'endTurn' })
    const kingReplies = legalDests(state).get('h8') ?? []
    assert.ok(kingReplies.length)
    state = succeed(state, { type: 'move', from: 'h8', to: kingReplies[random() % kingReplies.length] })
    state = succeed(state, { type: 'endTurn' })

    const ownerDirection = variant.owner === 'white' ? 1 : -1
    const [baseFile, baseRank] = forward[orientation]
    const forwardFile = baseFile * ownerDirection
    const forwardRank = baseRank * ownerDirection
    const expected = [-1, 1].map(side => square(
      3 + forwardFile + side * forwardRank,
      3 + forwardRank - side * forwardFile,
    ))
    assert.deepEqual(new Set(legalDests(state).get('d4')), new Set(expected))

    const illegal = [
      square(3 + forwardFile, 3 + forwardRank),
      square(3 - forwardFile + forwardRank, 3 - forwardRank - forwardFile),
      square(3 + 2 * forwardFile + 2 * forwardRank, 3 + 2 * forwardRank - 2 * forwardFile),
      'd7' as SquareName,
    ]
    for (const to of illegal) reject(state, { type: 'move', from: 'd4', to })
    if (variant.neutral) {
      const [actingFile, actingRank] = forward[orientation]
      const wrongDirection = square(3 + actingFile + actingRank, 3 + actingRank - actingFile)
      assert.ok(!expected.includes(wrongDirection))
      reject(state, { type: 'move', from: 'd4', to: wrongDirection })
    } else {
      assert.equal(state.pieces.find(piece => piece.id === pawnId)?.role, 'rook')
      assert.ok(!legalDests(state).get('d4')?.includes('d7'))
    }

    const destination = expected[random() % expected.length]
    state = succeed(state, { type: 'move', from: 'd4', to: destination })
    const recovered = state.pieces.find(piece => piece.id === pawnId)
    assert.equal(recovered?.square, destination)
    assert.equal(recovered?.owner, variant.owner)
    assert.equal(recovered?.role, variant.role)
    assert.equal(recovered?.originalRole, 'pawn')
    assert.equal(recovered?.neutral, variant.neutral)
  }
})
