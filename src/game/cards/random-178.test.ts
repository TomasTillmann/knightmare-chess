import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction, isKingInCheck, legalDests } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js'

// Explicit review ledger: rules §§8–13, cards.md and printed catalog timing.
const rationale = [
  '1. Ng1-f3 is a knight jump to an empty square.',
  '2. White closes its completed quiet move.',
  '3. h7-h5 crosses empty h6; no white pawn can take en passant.',
  '4. Black closes its pawn move; h6 opportunity persists.',
  '5. h2-h4 crosses empty h3; the h5 pawn cannot capture straight.',
  '6. White closes its move; h3 opportunity persists.',
  '7. Rh8-h6 crosses vacated h7 and loses black kingside castling.',
  '8. Black Holy Quest swaps opposing Bc1/Nb1 after its move.',
  '9. Close Holy Quest turn and reset both card allowances.',
  '10. White Dubbing moves Bf1-e3 as a noncapturing knight, replacing the move.',
  '11. Close the replacement move.',
  '12. Rh6-g6 is an unobstructed rank move.',
  '13. Close black rook move.',
  '14. White castles across safe empty f1/g1; original h1 rook follows to f1.',
  '15. Close castling turn.',
  '16. a7-a6 is one forward pawn step.',
  '17. Close black pawn move.',
  '18. b2-b3 is one forward pawn step.',
  '19. White Treason swaps opposing Rg6/Nb8 without capture.',
  '20. Close Treason turn.',
  '21. f7-f6 is one forward pawn step.',
  '22. Close f-pawn move.',
  '23. b3-b4 is one forward pawn step.',
  '24. Close b-pawn move.',
  '25. Ng6xh4 captures the original white h2 pawn for black.',
  '26. Close the knight capture.',
  '27. Be3-b6 follows clear d4/c5 diagonal.',
  '28. White Curse marks opposing Bf8; the physical card stays active.',
  '29. Close Curse turn.',
  '30. a6-a5 is one forward pawn step.',
  '31. Close a-pawn move.',
  '32. e2-e3 advances into the vacated bishop square.',
  '33. Close e-pawn move.',
  '34. Nh4-f5 is a noncapturing knight jump.',
  '35. Close knight move.',
  '36. White Ghostwalk Bb6-a7 is an empty diagonal move; no intervening blocker is required.',
  '37. Close Ghostwalk replacement move.',
  '38. c7-c5 crosses empty c6; white has no adjacent fifth-rank pawn.',
  '39. Black Siege swaps its original a8 rook and g8 knight; raw c6 EP survives the card.',
  '40. Close Siege turn; castling entitlement is serialized a with no rook on a8.',
  '41. d2-d3 is a forward pawn step and expires c6 EP.',
  '42. Close d-pawn move.',
  '43. g7-g6 is a forward pawn step.',
  '44. Close g-pawn move.',
  '45. Ba7xc5 crosses empty b6 and captures the black c7 pawn for white.',
  '46. Close bishop capture.',
  '47. b7-b5 crosses empty b6; white b4 cannot capture straight en passant.',
  '48. Close b-pawn double step.',
  '49. Bc5xe7 crosses empty d6 and captures the black e7 pawn for white.',
  '50. Close bishop capture.',
  '51. Black Pacifism marks its cursed Bf8 before moving; no capture permission remains.',
  '52. Qd8xe7 captures the white f1 bishop for black.',
  '53. Close queen capture and reset allowances.',
  '54. Nf3-d2 jumps to the vacated pawn square.',
  '55. Close knight move.',
  '56. Nf5xe3 captures the white e2 pawn for black.',
  '57. Close knight capture.',
  '58. Passing in the Night simultaneously swaps a2/d7 and d3/g6 pawn pairs; Pd7 checks Ke8.',
  '59. Close swap turn; black must answer pawn check.',
  '60. Na8-c7 provisionally leaves Pd7 checking Ke8; held Cowardice d7-d6 is a concrete cure.',
  '61. Truce cannot survive existing raw pawn check; spend it and rewind the provisional knight move.',
  '62. Ke8-d8 escapes the d7 pawn and replaces the inert failed-move shield token.',
  '63. Close legal king move.',
  '64. c2-c3 is a forward pawn step.',
  '65. Close c-pawn move.',
  '66. Rg8-h8 is one unobstructed rank step.',
  '67. Close rook move.',
  '68. Rf1-e1 is one unobstructed rank step.',
  '69. Close white rook move.',
  '70. Qe7-d6 is one diagonal step.',
  '71. Close queen move.',
  '72. Original white a2 pawn d7xc8 captures Bc8 and promotes to a rook, checking Kd8.',
  '73. Fatal Attraction marks own Pg6; f6/h5 become frozen and the promoted rook still checks.',
  '74. Close promotion and magnet turn.',
  '75. Qd6-b6 crosses c6 but leaves Rc8 checking Kd8; held Abduction c8 plus timeout cures it.',
  '76. Man-Trap h5 cannot cure Rc8 check; spend it and rewind the queen move.',
  '77. Kd8xc8 captures the promoted original a2 pawn for black and escapes check.',
  '78. Close king capture.',
  '79. Nc1xa2 captures the original black d7 pawn for white.',
  '80. Close knight capture.',
  '81. Na8-b6 is a knight jump.',
  '82. Close knight move.',
  '83. Qd1xh5 crosses e2/f3/g4, captures black h7 pawn, then freezes beside Pg6.',
  '84. Close queen capture; frozen queen does not give check.',
  '85. a5-a4 is a forward pawn step.',
  '86. Close a-pawn move.',
  '87. g2-g3 is a forward pawn step.',
  '88. Close g-pawn move.',
  '89. Rh8-h7 moves into Pg6 adjacency and becomes frozen.',
  '90. Close rook move.',
  '91. g3-g4 is one forward pawn step.',
  '92. Close g-pawn move.',
  '93. Qd6-e6 is a clear rank step outside magnet adjacency.',
  '94. Black Cowardice sends opposing Pg4-g2 across empty g3; no move clock advance.',
  '95. Close Cowardice turn.',
  '96. White Under Elf Hill removes Kg1 as its replacement move, without capture.',
  '97. Black Vulture takes the exact white Under Elf Hill card, discards its top Fog of War and draws Haunting Memories.',
  '98. Close white turn; its king remains away throughout black turn.',
  '99. Qe6-e8 crosses empty e7.',
  '100. Close black move; white King return becomes mandatory.',
  '101. White King returns on empty edge a7; Rh7 has a clear raw ray but is magnet-frozen, so return is safe.',
  '102. Re1-h1 crosses f1/g1; returned King stays immobile for this turn.',
  '103. Close rook move and clear the King return restriction.',
  '104. Qe8-e6 crosses empty e7.',
  '105. Close queen move.',
  '106. Nd2-f1 is a knight jump.',
  '107. White Cowardice moves opposing Pa4-a6 backward across empty a5.',
  '108. Close Cowardice turn.',
  '109. Ne3-d1 is a knight jump to the vacated queen square.',
  '110. Black Peace Talks discards the exact white Curse effect; Pacifism still suppresses Bf8 capture.',
  '111. Close Peace Talks turn.',
  '112. Rh1-g1 is a clear rank step.',
  '113. Close rook move.',
  '114. Nb6-d7 is a knight jump.',
  '115. Close knight move.',
  '116. Pg2-g4 crosses g3; returning to second rank restored its two-step option under §13.1.',
  '117. Close g-pawn move; no black pawn can capture g3 en passant.',
  '118. Kc8-d8 is a safe adjacent move.',
  '119. Close the fiftieth regular move; no unresolved choice remains.',
]

const coordinates = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square)
function geometry(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  assert.ok(piece.square)
  const [x, y] = coordinates(piece.square), [u, v] = coordinates(to)
  const dx = Math.abs(u - x), dy = Math.abs(v - y)
  if (!dx && !dy) return false
  if (piece.role === 'knight') return dx * dy === 2
  if (piece.role === 'king') return Math.max(dx, dy) === 1
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1
    if (capture) return dx === 1 && v - y === forward
    if (dx || at(pieces, to)) return false
    return v - y === forward || v - y === 2 * forward && (piece.owner === 'white' ? y <= 1 : y >= 6)
      && !at(pieces, `${piece.square[0]}${y + forward + 1}`)
  }
  if (!(piece.role === 'queen' && (dx === dy || dx === 0 || dy === 0)
    || piece.role === 'bishop' && dx === dy || piece.role === 'rook' && (dx === 0 || dy === 0))) return false
  for (let k = 1; k < Math.max(dx, dy); k++) {
    if (at(pieces, `${String.fromCharCode(97 + x + Math.sign(u - x) * k)}${y + Math.sign(v - y) * k + 1}`)) return false
  }
  return true
}
function frozen(p: PieceState, pieces: PieceState[], step: number): boolean {
  if (step < 73 || p.royal || !p.square || p.id === 'white-pawn-d2') return false
  const magnet = pieces.find(q => q.id === 'white-pawn-d2' && q.zone === 'board')
  if (!magnet?.square) return false
  const [x, y] = coordinates(p.square), [u, v] = coordinates(magnet.square)
  return Math.max(Math.abs(x - u), Math.abs(y - v)) === 1
}
function threatened(pieces: PieceState[], color: Color, step: number, raw = false): boolean {
  const king = pieces.find(p => p.royal && p.owner === color && p.zone === 'board')
  if (!king?.square) return false
  return pieces.some(p => {
    if (p.zone !== 'board' || p.owner === color || !p.square) return false
    if (!raw && (frozen(p, pieces, step) || step >= 51 && p.id === 'black-bishop-f8')) return false
    if (!raw && step >= 28 && step < 110 && p.id === 'black-bishop-f8') {
      const [x, y] = coordinates(p.square), [u, v] = coordinates(king.square!)
      if (Math.max(Math.abs(x - u), Math.abs(y - v)) > 2) return false
    }
    return geometry(pieces, p, king.square!, true)
  })
}
function boardFen(pieces: PieceState[]): string {
  const letters = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }
  return Array.from({ length: 8 }, (_, rank) => {
    let text = '', empty = 0
    for (let file = 0; file < 8; file++) {
      const p = at(pieces, `${String.fromCharCode(97 + file)}${8 - rank}`)
      if (!p) empty++
      else { if (empty) text += empty; empty = 0; text += p.owner === 'white' ? letters[p.role].toUpperCase() : letters[p.role] }
    }
    return text + (empty || '')
  }).join('/')
}
function immutableApply(state: GameState, action: GameAction) {
  const before = structuredClone(state), originalAction = structuredClone(action)
  const result = applyAction(state, action)
  assert.deepEqual(state, before, 'complete action input is immutable, including capture attribution')
  assert.deepEqual(action, originalAction)
  assert.ok(result.ok, JSON.stringify(action))
  return result.state
}

test('iteration 178 deterministic replay core', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/178.json', import.meta.url), 'utf8')) as RandomTrace
  assert.ok(trace)
  replayTrace(trace)
})

test('iteration 178 independently reviewed physical, timing, history and royal oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/178.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(rationale.length, 119)
  assert.equal(trace.steps.length, rationale.length)
  let state = createGameState(trace.initial)
  let pieces = structuredClone(state.pieces), players = structuredClone(state.players)
  let history: GameEvent[] = [], effects: unknown[] = []
  let half = 0, full = 1, side = 'w', rights = 'KQkq'
  let turn: GameState['turn'] = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
  let ep: GameState['enPassant'] = [], shield: GameState['shieldMove']
  let pendingBefore: GameState | undefined
  let hill: NonNullable<GameState['underElfHill']> = []
  const cards: Record<number, [Color, string, string, unknown]> = {
    8: ['black', 'holy-quest', 'black-hand-0-holy-quest', { bishop: 'c1', knight: 'b1' }],
    10: ['white', 'dubbing', 'white-hand-4-dubbing', [{ from: 'f1', to: 'e3' }]],
    19: ['white', 'treason', 'white-deck-0-treason', { rook: 'g6', knight: 'b8' }],
    28: ['white', 'curse', 'white-hand-3-curse', 'f8'],
    36: ['white', 'ghostwalk', 'white-hand-2-ghostwalk', [{ from: 'b6', to: 'a7' }]],
    39: ['black', 'siege', 'black-deck-0-siege', { knight: 'g8', rook: 'a8' }],
    51: ['black', 'pacifism', 'black-hand-1-pacifism', 'f8'],
    58: ['white', 'passing-in-the-night', 'white-hand-1-passing-in-the-night', [{ from: 'a2', to: 'd7' }, { from: 'd3', to: 'g6' }]],
    61: ['black', 'truce', 'black-hand-3-truce', undefined],
    73: ['white', 'fatal-attraction', 'white-deck-1-fatal-attraction', 'g6'],
    76: ['black', 'man-trap', 'black-deck-1-man-trap', 'h5'],
    94: ['black', 'cowardice', 'black-hand-2-cowardice', [{ from: 'g4', to: 'g2' }]],
    96: ['white', 'under-elf-hill', 'white-deck-3-under-elf-hill', undefined],
    97: ['black', 'vulture', 'black-deck-4-vulture', undefined],
    107: ['white', 'cowardice', 'white-deck-6-cowardice', [{ from: 'a4', to: 'a6' }]],
    110: ['black', 'peace-talks', 'black-deck-3-peace-talks', 'white-hand-3-curse'],
  }
  const move = (from: string, to: string) => {
    const p = at(pieces, from); assert.ok(p); assert.match(to, /^[a-h][1-8]$/)
    p.square = to as SquareName
  }
  const swap = (a: string, b: string) => {
    const p = at(pieces, a), q = at(pieces, b); assert.ok(p && q)
    const old = p.square; p.square = q.square; q.square = old
  }
  for (const [index, entry] of trace.steps.entries()) {
    const step = index + 1, action = entry.action, before = state
    assert.ok(rationale[index]!.startsWith(`${step}. `))
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from = action.from, to = action.to
      const p = at(pieces, from), victim = at(pieces, to)
      assert.ok(p); assert.equal(p.owner, turn.color); assert.equal(turn.moveMade, false)
      assert.equal(frozen(p, pieces, step - 1), false)
      assert.equal(hill.some(h => h.returned && h.pieceId === p.id), false)
      if (victim) { assert.notEqual(victim.owner, p.owner); assert.equal(victim.royal, false); assert.notEqual(victim.id, 'black-bishop-f8') }
      const castling = step === 14
      if (castling) {
        assert.equal(from, 'e1'); assert.equal(to, 'g1'); assert.ok(rights.includes('K'))
        assert.equal(at(pieces, 'f1'), undefined); assert.equal(at(pieces, 'g1'), undefined)
        for (const square of ['e1', 'f1', 'g1']) {
          const probe = structuredClone(pieces); probe.find(q => q.id === p.id)!.square = square as SquareName
          assert.equal(threatened(probe, 'white', step), false)
        }
      } else assert.ok(geometry(pieces, p, to, !!victim), rationale[index])
      const movedIds = [p.id]
      ep = []
      if (p.role === 'pawn' && Math.abs(Number(from[1]) - Number(to[1])) === 2) ep = [{ target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName, pawnId: p.id }]
      half = p.role === 'pawn' || victim ? 0 : half + 1
      if (victim) { victim.square = null; victim.zone = 'captured'; victim.capturedBy = turn.color }
      move(from, to)
      if (action.promotion) {
        assert.equal(step, 72); assert.equal(action.promotion, 'rook'); assert.equal(p.id, 'white-pawn-a2')
        p.role = 'rook'; p.promoted = true
      }
      if (castling) { move('h1', 'f1'); movedIds.push('white-rook-h1') }
      if (step === 7) rights = 'KQq'
      if (step === 14) rights = 'q'
      if (step === 62) rights = '-'
      if (turn.color === 'black') full++
      side = turn.color === 'white' ? 'b' : 'w'
      turn.phase = 'afterMove'; turn.moveMade = true
      shield = { player: turn.color, pieceIds: movedIds, capturedOpponent: !!victim }
      history.push({ type: 'move', from: from as SquareName, to: to as SquareName,
        ...(action.promotion ? { promotion: 'rook' as const } : {}), ...(victim ? { capturedId: victim.id } : {}) })
      if (step === 60 || step === 75) pendingBefore = structuredClone(before)
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true); assert.equal(threatened(pieces, turn.color, step), false)
      turn = { color: turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      shield = undefined
      if (step === 100) hill[0]!.returning = true
      if (step === 103) hill = []
    } else if (action.type === 'returnKing') {
      assert.equal(step, 101); assert.equal(action.to, 'a7')
      assert.deepEqual(hill, [{ pieceId: 'white-king-e1', player: 'white', returning: true }])
      assert.equal(at(pieces, 'a7'), undefined)
      const king = pieces.find(p => p.id === 'white-king-e1')!; king.zone = 'board'; king.square = 'a7'
      assert.equal(threatened(pieces, 'white', step), false)
      assert.equal(threatened(pieces, 'white', step, true), true, 'raw h7 rook ray is suppressed by magnet')
      hill[0]!.returned = true
    } else if (action.type === 'playCard') {
      const [owner, id, instance, target] = cards[step]!
      assert.deepEqual(action, { type: 'playCard', cardId: id, cardInstanceId: instance, ...(target === undefined ? {} : { target }) })
      assert.equal(turn.cardPlays[owner], 0)
      const beforeMove = [10, 36, 51, 58, 96].includes(step)
      if (step === 97) { assert.equal(turn.color, 'white'); assert.equal(history.at(-1)?.cardId, 'under-elf-hill') }
      else { assert.equal(turn.color, owner); assert.equal(turn.phase, beforeMove ? 'beforeMove' : 'afterMove') }
      const player = players[owner], card = player.hand.find(c => c.id === instance)
      assert.deepEqual(card, { id: instance, cardId: id })
      player.hand = player.hand.filter(c => c.id !== instance)
      const continuing = [28, 51, 73].includes(step)
      if (step === 97) player.discard.push(player.deck.shift()!)
      if (!continuing) player.discard.push(card!)
      player.hand.push(player.deck.shift()!)
      let movement: NonNullable<GameEvent['movement']> = []
      if (step === 8) { swap('b1', 'c1'); movement = [{ from: 'b1', to: 'c1' }, { from: 'c1', to: 'b1' }] }
      if (step === 19) { swap('b8', 'g6'); movement = [{ from: 'b8', to: 'g6' }, { from: 'g6', to: 'b8' }] }
      if (step === 39) { swap('a8', 'g8'); rights = 'a'; movement = [{ from: 'a8', to: 'g8' }, { from: 'g8', to: 'a8' }] }
      if (step === 10 || step === 36) {
        const from = step === 10 ? 'f1' : 'b6', to = step === 10 ? 'e3' : 'a7'
        assert.equal(at(pieces, to), undefined)
        if (step === 10) assert.equal(Math.abs(coordinates(from)[0] - coordinates(to)[0]) * Math.abs(coordinates(from)[1] - coordinates(to)[1]), 2)
        else assert.ok(geometry(pieces, at(pieces, from)!, to, false))
        move(from, to); movement = [{ from, to }]; half++; side = 'b'
        turn.phase = 'afterMove'; turn.moveMade = true
        shield = { player: owner, capturedOpponent: false, pieceIds: ['white-bishop-f1'] }
      }
      if (step === 58) {
        swap('a2', 'd7'); swap('d3', 'g6'); half = 0; side = 'b'
        movement = [{ from: 'a2', to: 'd7' }, { from: 'd3', to: 'g6' }, { from: 'd7', to: 'a2' }, { from: 'g6', to: 'd3' }]
        turn.phase = 'afterMove'; turn.moveMade = true
        shield = { player: owner, capturedOpponent: false, pieceIds: [] } // §16.3 swaps supply no moved identities.
      }
      if (continuing) effects.push({ type: id, owner, card, pieceId: step === 73 ? 'white-pawn-d2' : 'black-bishop-f8' })
      if (step === 61 || step === 76) {
        assert.ok(pendingBefore); assert.equal(threatened(pieces, 'black', step), true)
        pieces = structuredClone(pendingBefore.pieces); history = structuredClone(pendingBefore.history); ep = structuredClone(pendingBefore.enPassant)
        const fields = pendingBefore.fen.split(' '); half = Number(fields[4]); full = Number(fields[5]); side = fields[1]!; rights = fields[2]!
        turn = structuredClone(pendingBefore.turn); pendingBefore = undefined
      }
      if (step === 94 || step === 107) {
        const from = step === 94 ? 'g4' : 'a4', to = step === 94 ? 'g2' : 'a6'
        const pawn = at(pieces, from)!; assert.equal(pawn.role, 'pawn'); assert.notEqual(pawn.owner, owner)
        assert.equal(at(pieces, step === 94 ? 'g3' : 'a5'), undefined); assert.equal(at(pieces, to), undefined)
        move(from, to); movement = [{ from, to }]
      }
      if (step === 96) {
        const king = at(pieces, 'g1')!; assert.equal(king.id, 'white-king-e1'); king.square = null; king.zone = 'away'
        hill = [{ pieceId: king.id, player: 'white', returning: false }]
        half++; side = 'b'; turn.phase = 'afterMove'; turn.moveMade = true
        shield = { player: owner, capturedOpponent: false, pieceIds: [] }
      }
      if (step === 97) {
        const stolen = players.white.discard.find(c => c.id === 'white-deck-3-under-elf-hill')!
        assert.ok(stolen); players.white.discard = players.white.discard.filter(c => c !== stolen); player.hand.push(stolen)
      }
      if (step === 110) {
        const curse = { id: 'white-hand-3-curse', cardId: 'curse' }
        assert.deepEqual(effects[0], { type: 'curse', owner: 'white', card: curse, pieceId: 'black-bishop-f8' })
        effects.shift(); players.white.discard.push(curse)
      }
      const fizzled = step === 61 || step === 76
      history.push({ type: fizzled ? 'cardFizzled' : 'cardPlayed', cardId: id,
        ...(fizzled ? { reason: 'SELF_CHECK' as const } : {}),
        ...(!fizzled && target !== undefined && step !== 110 ? { target: target as GameEvent['target'] } : {}),
        ...(step === 97 ? { player: 'black' as const } : {}), movement,
        preservePreviousMove: !beforeMove && !fizzled })
      turn.cardPlays[owner]++
    } else assert.fail(`Unexpected action ${action.type}`)

    state = immutableApply(before, action)
    const message = rationale[index]
    assert.deepEqual(state.pieces, pieces, message)
    assert.deepEqual(state.players, players, message)
    assert.deepEqual(state.history, history, message)
    assert.deepEqual(state.effects, effects, message)
    assert.deepEqual(state.turn, turn, message)
    assert.deepEqual(state.enPassant, ep, message)
    assert.equal(state.fen, `${boardFen(pieces)} ${side} ${rights} ${step === 39 || step === 40 ? 'c6' : '-'} ${half} ${full}`, message)
    assert.deepEqual(state.shieldMove, shield, message)
    assert.deepEqual(state.underElfHill ?? [], hill, message)
    for (const key of ['chaosForbidden', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(state[key], undefined, `${step} ${key}`)
    for (const key of ['plotsAllowances', 'fogLocked', 'riposteLostMoves'] as const) assert.deepEqual(state[key] ?? [], [], `${step} ${key}`)
    assert.equal(state.pendingAbduction ?? null, null); assert.equal(state.pendingDoomsayer ?? null, null)
    assert.equal(state.outcome, null); assert.equal(state.orientation, 0)
    if (step === 61 || step === 76) {
      // The failed move's inert token is not an after-move permission (§16.3).
      const probe = structuredClone(state), player = probe.players.black
      const held = player.deck.find(c => c.cardId === 'mystic-shield')!
      assert.ok(held); player.deck = player.deck.filter(c => c.id !== held.id); player.hand.push(held)
      probe.turn.cardPlays.black = 0
      const saved = structuredClone(probe)
      const result = applyAction(probe, { type: 'playCard', cardId: held.cardId, cardInstanceId: held.id, target: step === 61 ? 'a8' : 'd6' })
      assert.equal(result.ok, false, 'inert shield token cannot reopen card timing')
      assert.deepEqual(probe, saved)
    }
    if (step === 100 || step === 101) {
      const saved = structuredClone(state)
      const blocked: GameAction = step === 100 ? { type: 'move', from: 'e1', to: 'h1' } : { type: 'move', from: 'a7', to: 'a8' }
      const result = applyAction(state, blocked)
      assert.equal(result.ok, false, 'mandatory return precedes movement; returned King cannot move')
      assert.deepEqual(state, saved)
    }
    if (pendingBefore) {
      assert.ok(state.pendingRescue)
      assert.deepEqual(state.pendingRescue.before, pendingBefore)
      assert.equal(state.pendingRescue.fen, pendingBefore.fen)
      assert.deepEqual(state.pendingRescue.pieces, pendingBefore.pieces)
      assert.deepEqual(state.pendingRescue.enPassant, pendingBefore.enPassant)
      assert.equal(state.pendingRescue.historyLength, pendingBefore.history.length)
      assert.deepEqual(state.pendingRescue.history ?? state.pendingRescue.before?.history, pendingBefore.history)
      assert.deepEqual(state.pendingRescue.movedPieceIds, shield!.pieceIds)
      const rescuePlayers = structuredClone(players)
      const rescueCard = step === 60
        ? { id: 'black-hand-2-cowardice', cardId: 'cowardice' }
        : { id: 'black-hand-4-abduction', cardId: 'abduction' }
      assert.deepEqual(rescuePlayers.black.hand.find(c => c.id === rescueCard.id), rescueCard)
      rescuePlayers.black.hand = rescuePlayers.black.hand.filter(c => c.id !== rescueCard.id)
      rescuePlayers.black.discard.push(rescueCard)
      const drawn = rescuePlayers.black.deck.shift()!
      assert.deepEqual(drawn, step === 60
        ? { id: 'black-deck-3-peace-talks', cardId: 'peace-talks' }
        : { id: 'black-deck-4-vulture', cardId: 'vulture' })
      rescuePlayers.black.hand.push(drawn)
      const rescueAccounting = (result: GameState, event: GameEvent, fen: string) => {
        assert.deepEqual(result.players, rescuePlayers, 'rescue spends and replaces its exact card once')
        assert.deepEqual(result.effects, effects, 'rescue preserves every active marker')
        assert.deepEqual(result.history, [...history, event], 'rescue preserves the move and appends one card event')
        assert.deepEqual(result.turn, { color: 'black', phase: 'afterMove', moveMade: true, cardPlays: { white: 0, black: 1 } })
        assert.equal(result.fen, fen)
        assert.deepEqual(result.enPassant, [])
        assert.deepEqual(result.shieldMove, shield, 'rescue preserves the original move trigger')
      }
      let cured: GameState
      if (step === 60) {
        cured = immutableApply(state, { type: 'playCard', cardId: 'cowardice', cardInstanceId: 'black-hand-2-cowardice', target: [{ from: 'd7', to: 'd6' }] })
        const expected = structuredClone(pieces); expected.find(p => p.id === 'white-pawn-a2')!.square = 'd6'
        assert.deepEqual(cured.pieces, expected)
        rescueAccounting(cured, { type: 'cardPlayed', cardId: 'cowardice', target: [{ from: 'd7', to: 'd6' }],
          movement: [{ from: 'd7', to: 'd6' }], preservePreviousMove: true },
        `${boardFen(expected)} w a - 1 15`)
      } else {
        assert.equal(step, 75)
        const expected = structuredClone(pieces), victim = expected.find(p => p.id === 'white-pawn-a2')!
        victim.square = null; victim.zone = 'captured'; victim.capturedBy = 'black'
        const concealmentEvent: GameEvent = { type: 'cardPlayed', cardId: 'abduction', movement: [], preservePreviousMove: true }
        const concealedFen = `${boardFen(expected)} w - - 1 18`
        cured = immutableApply(state, { type: 'playCard', cardId: 'abduction', cardInstanceId: 'black-hand-4-abduction', target: 'c8' })
        rescueAccounting(cured, concealmentEvent, concealedFen)
        assert.equal(cured.pendingAbduction?.phase, 'concealment')
        assert.equal(cured.pendingAbduction?.player, 'white')
        assert.equal(cured.pendingAbduction?.pieceId, 'white-pawn-a2')
        cured = immutableApply(cured, { type: 'revealAbduction' })
        rescueAccounting(cured, concealmentEvent, concealedFen)
        assert.equal(cured.pendingAbduction?.phase, 'recall')
        cured = immutableApply(cured, { type: 'abductionTimeout' })
        assert.deepEqual(cured.pieces, expected)
        rescueAccounting(cured, { ...concealmentEvent, target: 'c8', capturedIds: ['white-pawn-a2'], capturedId: 'white-pawn-a2' },
          `${boardFen(expected)} w - - 0 18`)
        assert.equal(cured.pendingAbduction ?? null, null)
      }
      assert.equal(cured.pendingRescue ?? null, null)
      assert.equal(threatened(cured.pieces, 'black', step), false)
      const closed = immutableApply(cured, { type: 'endTurn' })
      assert.deepEqual(closed.players, rescuePlayers)
      assert.deepEqual(closed.effects, effects)
      assert.deepEqual(closed.history, cured.history)
      assert.equal(closed.fen, cured.fen)
      assert.deepEqual(closed.enPassant, [])
      assert.deepEqual(closed.turn, { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } })
      assert.equal(closed.shieldMove, undefined)
    } else assert.equal(state.pendingRescue ?? null, null)
    const snapshot = structuredClone(state)
    for (const color of ['white', 'black'] as const) assert.equal(isKingInCheck(state, color), threatened(pieces, color, step), `${step} ${color} royal geometry`)
    assert.deepEqual(state, snapshot, 'royal queries preserve full state')
    for (const opportunity of ep) {
      const passed = pieces.find(p => p.id === opportunity.pawnId)!
      const captor: Color = passed.owner === 'white' ? 'black' : 'white'
      const candidates = pieces.filter(p => p.zone === 'board' && p.owner === captor && p.role === 'pawn' && geometry(pieces, p, opportunity.target, true))
      assert.deepEqual(candidates, [], `${step}: no physical pawn can attempt EP`)
      const probe = structuredClone(state); probe.turn = { color: captor, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      const fields = probe.fen.split(' '); fields[1] = captor === 'white' ? 'w' : 'b'; probe.fen = fields.join(' ')
      const saved = structuredClone(probe), dests = legalDests(probe)
      for (const p of pieces.filter(p => p.owner === captor && p.role === 'pawn' && p.square)) assert.equal(dests.get(p.square!)?.includes(opportunity.target) ?? false, false)
      assert.deepEqual(probe, saved)
    }
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50)
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 16)
  assert.equal(state.fen, '1r1k1b2/K2n3r/p3qpP1/1p5Q/1P4P1/2Pp4/N4P2/RB1n1NR1 w - - 1 27')
})
