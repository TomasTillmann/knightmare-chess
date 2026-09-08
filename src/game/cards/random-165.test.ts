import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction, legalDests, isKingInCheck } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js'

// Each sentence is a separately reviewed action, in trace order. The oracle below
// models physical identities, movement, cards and clocks without reducer helpers.
const rationales = [
  '1. g2-g3 is an empty one-step pawn advance.',
  '2. White ends the completed pawn turn; Black receives fresh allowances.',
  '3. b7-b6 is an empty one-step black pawn advance.',
  '4. Black ends; White receives the move.',
  '5. Bf1-h3 crosses empty g2.',
  '6. White ends the bishop turn.',
  '7. h7-h6 advances one square toward White.',
  '8. Black ends the pawn turn.',
  '9. Ng1-f3 has knight geometry and an empty destination.',
  '10. White ends the knight turn.',
  '11. e7-e5 crosses empty e6; no white pawn can capture e6 en passant.',
  '12. Black ends while the uncapturable e6 opportunity remains recorded.',
  '13. d2-d3 is clear and expires the previous en-passant opportunity.',
  '14. White ends the pawn turn.',
  '15. Qd8-e7 is a one-square diagonal into the vacated pawn square.',
  '16. Black ends the queen turn.',
  '17. Madman h2-f4-d6 jumps occupied g3 and e5 into empty landings; neither jumped pawn is captured.',
  '18. Madman already consumed the move, so White ends without a regular move.',
  '19. f7-f5 crosses empty f6; White has no pawn on e5 or g5 for en passant.',
  '20. Black ends with the uncapturable f6 opportunity recorded.',
  '21. Bh3-f1 crosses empty g2 and expires en passant.',
  '22. White ends the bishop turn.',
  '23. Rh8-h7 is clear and permanently loses black kingside castling.',
  '24. Black ends the rook turn.',
  '25. Long Jump moves Nb1 to empty opposite-colored f6; it checks Ke8, but Qe7xf6 is a legal escape, so not direct mate.',
  '26. White ends; Black receives the check-escape turn.',
  '27. Qe7xf6 captures white-knight-b1 and removes its attack on Ke8.',
  '28. Black ends safely after capturing the checking knight.',
  '29. Bf1-h3 again crosses empty g2.',
  '30. White ends the bishop turn.',
  '31. Qf6-e6 is an empty horizontal one-square move.',
  '32. Black ends the queen turn.',
  '33. e2-e4 crosses empty e3; no black pawn on d4 or f4 can take en passant.',
  '34. White ends retaining only the uncapturable e3 record.',
  '35. h6-h5 advances one empty square and expires e3.',
  '36. Black ends the pawn turn.',
  '37. Ke1-d2 reaches a safe adjacent square and loses both white castling rights.',
  '38. White ends the king turn.',
  '39. Bf8-e7 reaches the now-empty diagonal square.',
  '40. Black ends the bishop turn.',
  '41. Bh3-f1 crosses empty g2.',
  '42. White ends the bishop turn.',
  '43. Qe6-b3 crosses empty d5 and c4.',
  '44. Think Again restores Qe6, pre-move clocks and history; Black must choose a different physical movement.',
  '45. Dark Mirror lets black-pawn-e7 capture backward e5-d6, capturing white-pawn-h2; this differs from canceled Qe6-b3.',
  '46. Black ends its replacement move; both players regain card allowances.',
  '47. Rh1-g1 is an empty adjacent horizontal move.',
  '48. White ends the rook turn.',
  '49. b6-b5 is an empty forward pawn step.',
  '50. Black ends the pawn turn.',
  '51. c2-c4 crosses c3; black b5 is on the wrong rank to capture c3 en passant.',
  '52. White ends retaining the uncapturable c3 record.',
  '53. c7-c6 is empty and expires c3.',
  '54. Black ends the pawn turn.',
  '55. e4-e5 is an empty forward step.',
  '56. After moving, White plays Truce; neither king has a raw attack, so capture prohibition persists.',
  '57. White ends; Truce remains beside the board.',
  '58. Confabulation Ra8-a7 merges two owned non-Kings using clear rook movement; pawn-a7 carries rook powers and rook-a8 is away, not captured.',
  '59. Black ends the merge move; queenside castling is gone.',
  '60. a2-a4 crosses a3, with no correctly ranked black en-passant captor; Truce also forbids capture.',
  '61. White ends while Truce and the a3 record persist.',
  '62. Qe6-d5 moves diagonally into an empty square; d3 blocks its file toward Kd2.',
  '63. Black ends the queen turn.',
  '64. Qd1-b3 crosses empty c2.',
  '65. White ends the queen turn.',
  '66. Under Elf Hill removes black-king-e8 until Black next starts; the card replaces the move.',
  '67. Black ends; its king remains away throughout White turn.',
  '68. Qb3-c3 moves horizontally into an empty square.',
  '69. Knightmare restores Qb3 and pre-move clock/history, forbidding precisely Qb3-c3.',
  '70. d3-d4 is a different, empty pawn move; d4 still blocks Qd5 from Kd2.',
  '71. White ends and Black must first return its absent king.',
  '72. The king returns to empty safe edge a6; Qb3 is not aligned with a6, and returning does not consume the regular move.',
  '73. Ng8-f6 is legal; the returned King is required to remain stationary this turn.',
  '74. Black ends, expiring its returned-King movement prohibition.',
  '75. e5-e6 advances one empty square; no raw king attack ends Truce.',
  '76. White ends the pawn turn.',
  '77. Nf6-e8 has ordinary knight geometry.',
  '78. Black ends the knight turn.',
  '79. Kd2-c2 reaches a safe adjacent square.',
  '80. White ends the king turn.',
  '81. Fanatic sends g7-g4 through empty g6 and g5 to empty g4; no capture or en-passant right is created.',
  '82. Black ends the Fanatic replacement turn.',
  '83. Rg1-h1 is an empty horizontal step; castling rights do not return.',
  '84. White ends the rook turn.',
  '85. Ka6-b6 is safe; the b5 pawn blocks Qb3 along the b-file.',
  '86. Black ends the king turn.',
  '87. Bc1-e3 crosses empty d2.',
  '88. White ends the bishop turn.',
  '89. The a7 pawn-rook composite travels as a Rook across empty b7 to c7; neither component promotes or captures.',
  '90. Black ends the composite move.',
  '91. Rh1-h2 is a clear vertical step.',
  '92. White ends the rook turn.',
  '93. f5-f4 is a clear forward pawn step.',
  '94. Black ends the pawn turn.',
  '95. Qb3-a3 is a clear horizontal step.',
  '96. White ends the queen turn.',
  '97. Be7-g5 crosses empty f6.',
  '98. Black ends the bishop turn.',
  '99. Kc2-d3 is safe: d4 blocks Qd5 on the king file.',
  '100. White ends the king turn.',
  '101. Nb8-a6 has knight geometry and an empty destination.',
  '102. Black ends the knight turn.',
  '103. b2-b3 advances onto a square vacated by the queen.',
  '104. White plays Curse after moving, marking opposing rook-h8 currently on h7; it remains a rook limited to one or two squares per move.',
  '105. White ends with Truce, Confabulation and Curse still active.',
  '106. Kb6-b7 reaches an empty adjacent square with no raw royal attack.',
  '107. Black ends the king turn.',
  '108. Kd3-e2 reaches an empty adjacent square with no raw royal attack.',
  '109. White ends the king turn.',
  '110. Ne8-f6 is an ordinary knight jump.',
  '111. Black ends the knight turn.',
  '112. Ra1-c1 crosses empty b1.',
  '113. White ends the rook turn.',
  '114. Nf6-e4 is an ordinary knight jump; e4 does not attack Ke2, so Truce remains.',
  '115. Black ends the fiftieth regular move command with no unresolved choices.',
]

const cards: Record<number, GameAction> = {
  17: { type: 'playCard', cardId: 'madman', cardInstanceId: 'white-hand-2-madman', target: [{ from: 'h2', to: 'f4' }, { from: 'f4', to: 'd6' }] },
  25: { type: 'playCard', cardId: 'long-jump', cardInstanceId: 'white-hand-3-long-jump', target: [{ from: 'b1', to: 'f6' }] },
  44: { type: 'playCard', cardId: 'think-again', cardInstanceId: 'white-hand-4-think-again' },
  45: { type: 'playCard', cardId: 'dark-mirror', cardInstanceId: 'black-hand-0-dark-mirror', target: [{ from: 'e5', to: 'd6' }] },
  56: { type: 'playCard', cardId: 'truce', cardInstanceId: 'white-deck-2-truce' },
  58: { type: 'playCard', cardId: 'confabulation', cardInstanceId: 'black-hand-3-confabulation', target: [{ from: 'a8', to: 'a7' }] },
  66: { type: 'playCard', cardId: 'under-elf-hill', cardInstanceId: 'black-deck-1-under-elf-hill' },
  69: { type: 'playCard', cardId: 'knightmare', cardInstanceId: 'black-deck-2-knightmare' },
  81: { type: 'playCard', cardId: 'fanatic', cardInstanceId: 'black-deck-3-fanatic', target: 'g7' },
  104: { type: 'playCard', cardId: 'curse', cardInstanceId: 'white-deck-1-curse', target: 'h7' },
}
const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white'
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const
const at = (ps: PieceState[], s: string) => ps.find(p => p.zone === 'board' && p.square === s)
function geometry(ps: PieceState[], p: PieceState, to: string, capture: boolean, composite: boolean): boolean {
  const [x, y] = xy(p.square!), [tx, ty] = xy(to), dx = tx - x, dy = ty - y
  const ax = Math.abs(dx), ay = Math.abs(dy)
  const clear = () => {
    for (let n = 1; n < Math.max(ax, ay); n++) {
      if (at(ps, String.fromCharCode(97 + x + Math.sign(dx) * n) + (y + Math.sign(dy) * n + 1))) return false
    }
    return true
  }
  const rook = () => (dx === 0 || dy === 0) && ax + ay > 0 && clear()
  if (composite && p.id === 'black-pawn-a7' && rook()) return true
  switch (p.role) {
    case 'pawn': {
      const dir = p.owner === 'white' ? 1 : -1
      return capture ? ax === 1 && dy === dir : dx === 0 && (dy === dir || dy === 2 * dir && (p.owner === 'white' ? y <= 1 : y >= 6) && clear())
    }
    case 'knight': return ax * ay === 2
    case 'king': return Math.max(ax, ay) === 1
    case 'rook': return rook()
    case 'bishop': return ax === ay && ax > 0 && clear()
    case 'queen': return rook() || ax === ay && ax > 0 && clear()
  }
}
function rawCheck(ps: PieceState[], color: Color, composite: boolean, cursed: boolean): boolean {
  const king = ps.find(p => p.royal && p.owner === color && p.zone === 'board')
  if (!king) return false
  return ps.some(p => p.zone === 'board' && p.owner !== color
    && (!cursed || p.id !== 'black-rook-h8' || Math.max(...xy(p.square!).map((v, i) => Math.abs(v - xy(king.square!)[i]!))) <= 2)
    && geometry(ps, p, king.square!, true, composite))
}
function boardFen(ps: PieceState[]): string {
  const roles = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }
  return Array.from({ length: 8 }, (_, i) => {
    let rank = '', empty = 0
    for (let f = 0; f < 8; f++) {
      const p = at(ps, String.fromCharCode(97 + f) + (8 - i))
      if (!p) { empty++; continue }
      if (empty) { rank += empty; empty = 0 }
      rank += p.owner === 'white' ? roles[p.role].toUpperCase() : roles[p.role]
    }
    return rank + (empty || '')
  }).join('/')
}

test('iteration 165 independently reviewed trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/165.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860165)
  assert.equal(trace.steps.length, rationales.length)
  assert.equal(trace.moves, 50)
  let state = createGameState(trace.initial)
  let expected = structuredClone(state)
  let rights = 'KQkq', half = 0, full = 1, fenTurn: Color = 'white'
  let saved: { state: GameState; rights: string; half: number; full: number; fenTurn: Color } | undefined
  const snapshots = new Map<number, GameState>()
  const checkedEpContexts = new Set<string>()
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, reason = rationales[index]!
    assert.ok(reason.startsWith(`${n}. `))
    const before = structuredClone(expected), actor = expected.turn.color
    if (action.type === 'move') saved = { state: structuredClone(expected), rights, half, full, fenTurn }
    const move = (from: string, to: string, regular = false) => {
      assert.match(to, /^[a-h][1-8]$/)
      const p = at(expected.pieces, from)!, victim = at(expected.pieces, to)
      assert.ok(p, reason)
      assert.equal(p.owner, actor, reason)
      if (regular) assert.ok(geometry(expected.pieces, p, to, !!victim, n >= 58), reason)
      if (victim) {
        assert.notEqual(victim.owner, actor, reason)
        assert.equal(victim.royal, false, reason)
        assert.ok(n < 56, 'Truce forbids all captures')
        victim.square = null; victim.zone = 'captured'; victim.capturedBy = actor
      }
      const fromSquare = p.square!
      p.square = to as SquareName
      if (p.role === 'king') rights = rights.replace(actor === 'white' ? /[KQ]/g : /[kq]/g, '')
      if (p.id === 'black-rook-h8') rights = rights.replace('k', '')
      if (p.id === 'black-rook-a8') rights = rights.replace('q', '')
      if (p.id === 'white-rook-h1') rights = rights.replace('K', '')
      if (p.id === 'white-rook-a1') rights = rights.replace('Q', '')
      half = p.role === 'pawn' || victim ? 0 : half + 1
      full += actor === 'black' ? 1 : 0; fenTurn = opposite(actor)
      expected.enPassant = regular && p.role === 'pawn' && from[0] === to[0] && Math.abs(Number(from[1]) - Number(to[1])) === 2
        ? [{ target: (from[0]! + (Number(from[1]) + Number(to[1])) / 2) as SquareName, pawnId: p.id }] : []
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true
      expected.shieldMove = { player: actor, pieceIds: n >= 58 && p.id === 'black-pawn-a7' ? [p.id, 'black-rook-a8'] : [p.id], capturedOpponent: !!victim }
      delete expected.chaosForbidden
      if (regular) expected.history.push({ type: 'move', from: fromSquare, to: to as SquareName, ...(victim ? { capturedId: victim.id } : {}) })
      return { p, victim }
    }
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      assert.equal(expected.turn.moveMade, false)
      move(action.from, action.to, true)
    } else if (action.type === 'endTurn') {
      assert.equal(expected.turn.moveMade, true)
      expected.turn = { color: opposite(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      delete expected.shieldMove; delete expected.cardResponse; delete expected.legacyCapture
      if (n === 71) expected.underElfHill = [{ pieceId: 'black-king-e8', player: 'black', returning: true }]
      if (n === 74) expected.underElfHill = []
    } else if (action.type === 'returnKing') {
      assert.equal(n, 72); assert.equal(action.to, 'a6')
      assert.equal(at(expected.pieces, 'a6'), undefined)
      const king = expected.pieces.find(p => p.id === 'black-king-e8')!
      king.square = 'a6'; king.zone = 'board'
      expected.underElfHill = [{ pieceId: king.id, player: 'black', returning: true, returned: true }]
    } else {
      assert.equal(action.type, 'playCard'); if (action.type !== 'playCard') assert.fail(reason)
      assert.deepEqual(action, cards[n], 'exact reviewed card instance and target')
      const owner: Color = [44, 17, 25, 56, 104].includes(n) ? 'white' : 'black'
      const player = expected.players[owner], card = player.hand.find(c => c.id === action.cardInstanceId)!
      assert.ok(card); assert.equal(card.cardId, action.cardId)
      assert.equal(expected.turn.cardPlays[owner], 0)
      assert.equal(expected.turn.phase, [44, 56, 69, 104].includes(n) ? 'afterMove' : 'beforeMove')
      player.hand.splice(player.hand.indexOf(card), 1)
      player.hand.push(player.deck.shift()!)
      if (![56, 58, 104].includes(n)) player.discard.push(card)
      expected.turn.cardPlays[owner]++
      expected.playedCards ??= []; expected.playedCards.push({ player: owner, cardInstanceId: card.id })
      const event: GameEvent = { type: 'cardPlayed', cardId: card.cardId, ...(action.target === undefined ? {} : { target: action.target as GameEvent['target'] }), movement: [], preservePreviousMove: [44, 56, 69, 104].includes(n) }
      if (n === 17) {
        assert.ok(at(expected.pieces, 'g3')); assert.ok(at(expected.pieces, 'e5')); assert.equal(at(expected.pieces, 'f4'), undefined)
        move('h2', 'd6'); event.movement = [{ from: 'h2', to: 'd6' }]
      } else if (n === 25) {
        assert.notEqual(xy('b1').reduce((a,b)=>a+b) % 2, xy('f6').reduce((a,b)=>a+b) % 2)
        assert.equal(at(expected.pieces, 'f6'), undefined)
        move('b1', 'f6'); event.movement = [{ from: 'b1', to: 'f6' }]
      } else if (n === 44 || n === 69) {
        assert.ok(saved)
        expected.pieces = structuredClone(saved.state.pieces); expected.enPassant = structuredClone(saved.state.enPassant)
        expected.history = structuredClone(saved.state.history)
        rights = saved.rights; half = saved.half; full = saved.full; fenTurn = saved.fenTurn
        expected.turn.phase = 'beforeMove'; expected.turn.moveMade = false; delete expected.shieldMove
        expected.chaosForbidden = { player: actor, movement: n === 44 ? 'black-queen-d8:e6:b3' : 'white-queen-d1:b3:c3' }
        event.player = owner; event.movement = n === 44 ? [{ from: 'b3', to: 'e6' }] : [{ from: 'c3', to: 'b3' }]
      } else if (n === 45) {
        const { victim } = move('e5', 'd6'); assert.equal(victim!.id, 'white-pawn-h2')
        event.capturedId = victim!.id; event.movement = [{ from: 'e5', to: 'd6' }]
        expected.legacyCapture = { historyLength: expected.history.length + 1, pieceIds: [victim!.id] }
      } else if (n === 56) {
        expected.effects.push({ type: 'truce', owner, card })
      } else if (n === 58) {
        const rook = at(expected.pieces, 'a8')!, pawn = at(expected.pieces, 'a7')!
        assert.equal(rook.role, 'rook'); assert.equal(pawn.owner, owner); assert.equal(pawn.royal, false)
        assert.ok(geometry(expected.pieces, rook, 'a7', false, false))
        rook.square = null; rook.zone = 'away'; rights = rights.replace('q', '')
        expected.effects.push({ type: 'confabulation', owner, card, pieceIds: [pawn.id, rook.id] })
        expected.shieldMove = { player: owner, pieceIds: [rook.id], capturedOpponent: false }
        expected.turn.phase = 'afterMove'; expected.turn.moveMade = true
        half++; full++; fenTurn = 'white'; expected.enPassant = []
        event.movement = [{ from: 'a8', to: 'a7' }]
      } else if (n === 66) {
        const king = expected.pieces.find(p => p.id === 'black-king-e8')!
        king.square = null; king.zone = 'away'
        expected.underElfHill = [{ pieceId: king.id, player: owner, returning: false }]
        expected.shieldMove = { player: owner, pieceIds: [], capturedOpponent: false }
        expected.turn.phase = 'afterMove'; expected.turn.moveMade = true
        half++; full++; fenTurn = 'white'; expected.enPassant = []
      } else if (n === 81) {
        for (const square of ['g6', 'g5', 'g4']) assert.equal(at(expected.pieces, square), undefined)
        move('g7', 'g4'); event.movement = [{ from: 'g7', to: 'g4' }]
      } else if (n === 104) {
        assert.equal(at(expected.pieces, 'h7')!.id, 'black-rook-h8')
        expected.effects.push({ type: 'curse', owner, card, pieceId: 'black-rook-h8' })
      } else assert.fail('unreviewed card')
      expected.history.push(event)
      expected.cardResponse = { player: owner, historyLength: expected.history.length }
    }
    expected.fen = `${boardFen(expected.pieces)} ${fenTurn[0]} ${rights || '-'} - ${half} ${full}`
    // Every recorded double-step is uncapturable: establish it for the prospective
    // capturing player, separately from the FEN serializer's '-' representation.
    for (const ep of expected.enPassant) {
      const victim = expected.pieces.find(p => p.id === ep.pawnId)!
      assert.equal(expected.pieces.some(p => p.zone === 'board' && p.owner !== victim.owner && p.role === 'pawn' && geometry(expected.pieces, p, ep.target, true, false)), false)
    }
    const input: GameState = structuredClone(state)
    const result = applyAction(state, action)
    assert.deepEqual(state, input, `${reason}: input immutability includes capture metadata`)
    assert.ok(result.ok, reason); state = result.state
    for (const key of ['pieces', 'players', 'fen', 'turn', 'effects', 'history', 'enPassant', 'orientation', 'outcome'] as const) assert.deepEqual(state[key], expected[key], `${reason}: ${key}`)
    assert.deepEqual(state.playedCards ?? [], expected.playedCards ?? [], reason)
    assert.deepEqual(state.shieldMove, expected.shieldMove, reason)
    assert.deepEqual(state.chaosForbidden, expected.chaosForbidden, reason)
    assert.deepEqual(state.underElfHill ?? [], expected.underElfHill ?? [], reason)
    assert.deepEqual(state.cardResponse, expected.cardResponse, reason)
    for (const ep of expected.enPassant) {
      const context = `${expected.fen}:${ep.pawnId}:${ep.target}`
      if (checkedEpContexts.has(context)) continue
      checkedEpContexts.add(context)
      const victim = expected.pieces.find(p => p.id === ep.pawnId)!
      const prospective = structuredClone(state)
      prospective.turn = { color: opposite(victim.owner), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      delete prospective.shieldMove
      const immutable = structuredClone(prospective), destinations = legalDests(prospective)
      const captors = prospective.pieces.filter(p => p.zone === 'board' && p.owner === prospective.turn.color && p.role === 'pawn'
        && destinations.get(p.square!)?.includes(ep.target))
      assert.deepEqual(captors, [], `${reason}: prospective legal EP captors`)
      assert.deepEqual(prospective, immutable, 'en-passant probe immutability')
    }
    // No rescue, choice, or extra-card obligation occurred in this reviewed trace.
    for (const key of ['pendingRescue', 'pendingDoomsayer', 'pendingAbduction', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(state[key] ?? null, null, `${reason}: ${key}`)
    for (const key of ['plotsAllowances', 'fogLocked', 'riposteLostMoves'] as const) assert.deepEqual(state[key] ?? [], [], `${reason}: ${key}`)
    for (const color of ['white', 'black'] as const) {
      const raw = rawCheck(expected.pieces, color, n >= 58, n >= 104)
      assert.equal(raw, color === 'black' && (n === 25 || n === 26), `${reason}: independent raw royal threat`)
      const checkedInput = structuredClone(state)
      assert.equal(isKingInCheck(state, color), raw, `${reason}: variant royal threat`)
      assert.deepEqual(state, checkedInput, 'royal probe immutability')
    }
    if ([25, 44, 69, 72, 104].includes(n)) snapshots.set(n, structuredClone(state))
    assert.ok(before.pieces.length === expected.pieces.length, 'no physical identity is silently deleted')
  }
  const probe = (s: GameState, a: GameAction, ok: boolean) => {
    const before = structuredClone(s), result = applyAction(s, a)
    assert.equal(result.ok, ok, JSON.stringify(a)); assert.deepEqual(s, before, 'probe input immutable')
    return result
  }
  const checked = probe(snapshots.get(25)!, { type: 'endTurn' }, true)
  assert.ok(checked.ok)
  const escape = probe(checked.state, { type: 'move', from: 'e7', to: 'f6' }, true)
  assert.ok(escape.ok); assert.equal(rawCheck(escape.state.pieces, 'black', false, false), false)
  probe(snapshots.get(44)!, { type: 'move', from: 'e6', to: 'b3' }, false)
  probe(snapshots.get(69)!, { type: 'move', from: 'b3', to: 'c3' }, false)
  probe(snapshots.get(72)!, { type: 'move', from: 'a6', to: 'a5' }, false)
  const cursed = probe(snapshots.get(104)!, { type: 'endTurn' }, true)
  assert.ok(cursed.ok)
  probe(cursed.state, { type: 'move', from: 'h7', to: 'h6' }, true)
  probe(cursed.state, { type: 'move', from: 'h7', to: 'h8' }, true)
  probe(cursed.state, { type: 'move', from: 'h7', to: 'f7' }, true)
  probe(cursed.state, { type: 'move', from: 'h7', to: 'e7' }, false)
  const curseInput = structuredClone(cursed.state)
  assert.deepEqual(legalDests(cursed.state).get('h7')?.sort(), ['f7', 'g7', 'h6', 'h8'])
  assert.deepEqual(cursed.state, curseInput, 'destination probe input immutable')
  assert.equal(state.fen, '2b5/1kpp3r/n1ppP3/1p1q2bp/P1PPnpp1/QP2BNP1/4KP1R/2R2B2 w - - 5 28')
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 10)
  assert.equal(checkedEpContexts.size, 5)
  assert.deepEqual(replayTrace(trace), state)
})
