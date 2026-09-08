import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { GameState, PieceState } from '../types.js'

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/051.json', import.meta.url), 'utf8')) as RandomTrace

// Independently reviewed in order against rules §§11–17 and the printed catalog.
// Every endTurn below also preserves pieces, effects, cards, clocks and en passant.
const rationales = [
  '1. g2-g4 crosses empty g3; original Pawn double step creates g3 en passant; e1 remains screened.',
  '2. White completes the move; Black receives its before-move window.',
  '3. g7-g6 advances Black one square; old g3 en passant expires.',
  '4. Black completes its move and White receives the turn.',
  '5. f1-h3 follows empty g2; bishop does not expose e1.',
  '6. White ends after its bishop move.',
  '7. a7-a6 is an empty single Pawn advance.',
  '8. Black ends after a6.',
  '9. c2-c4 crosses empty c3 and creates c3 en passant.',
  '10. White ends; c3 en passant survives into the reply.',
  '11. e7-e5 crosses empty e6 and replaces c3 availability with e6.',
  '12. Black ends; e6 remains available for the reply.',
  '13. b1-c3 is a Knight jump into an empty square and expires e6 availability.',
  '14. White ends after Nc3.',
  '15. b7-b6 is an empty one-square Pawn move.',
  '16. Coup marks the owned a6 Pawn royal and demotes e8 to a capturable Prince; a6 is safe, powers remain unchanged and card stays with effect.',
  '17. Black ends, resetting the spent Coup allowance.',
  '18. c3-d5 is an empty Knight jump; White king remains screened.',
  '19. White ends after Nd5.',
  '20. f8-b4 follows empty e7,d6,c5; d2 blocks the bishop line toward e1.',
  '21. Black ends after Bb4.',
  '22. d5-f4 is an empty Knight jump.',
  '23. Cowardice moves the opposing original Pawn a6-a7 backward, retaining royal identity; no clocks or move change.',
  '24. White ends after Cowardice.',
  '25. The capturable Prince e8-f8 moves one square; Black castling rights are lost.',
  '26. Heresy moves opponent bishops c1-c2 and h3-g3 first, then b4-b3; c8 has all four orthogonal exits occupied and stays. All destinations are empty.',
  '27. Black ends after Heresy.',
  '28. f2-f3 is an empty Pawn advance; b3 bishop is blocked by c2.',
  '29. White ends after f3.',
  '30. d8-g5 follows empty e7,f6; Black royal a7 stays safe.',
  '31. Black ends after Qg5.',
  '32. f4-h3 is an empty Knight jump.',
  '33. White ends after Nh3.',
  '34. g8-h6 is an empty Knight jump.',
  '35. Black ends after Nh6.',
  '36. h3-f4 is an empty Knight jump.',
  '37. White ends after Nf4.',
  '38. d7-d6 is an empty single Pawn advance.',
  '39. Black ends after d6.',
  '40. Evangelists would put the black c8 Bishop on g3, attacking e1 through empty f2. It fizzles, spends/draws once and consumes the replacement move because White began safe.',
  '41. White ends its consumed replacement move.',
  '42. Prince f8-e7 moves diagonally one square; a7 remains royal.',
  '43. Black ends after its Prince move.',
  '44. g1-h3 is an empty Knight jump.',
  '45. White ends after Nh3.',
  '46. c8-f5 follows empty d7,e6; a7 remains safe.',
  '47. Black ends after Bf5.',
  '48. h3-g1 is an empty Knight jump.',
  '49. White ends after Ng1.',
  '50. f5-c2 follows empty e4,d3 and captures the physical white c1 Bishop.',
  '51. Black ends after Bxc2.',
  '52. f4-h5 is an empty Knight jump; c2 bishop does not attack e1.',
  '53. White ends after Nh5.',
  '54. b6-b5 is an empty Pawn advance; a7 remains safe.',
  '55. Black ends after b5.',
  '56. d1-b1 follows empty c1; moving the Queen does not expose e1.',
  '57. White ends after Qb1.',
  '58. Prince e7-f6 may enter the h5 Knight attack because Coup made it nonroyal.',
  '59. Black ends after the capturable Prince move.',
  '60. h5-f6 captures that Prince by a Knight jump; the royal a7 Pawn and Coup persist.',
  '61. White ends after capturing the Prince; no King loss occurs.',
  '62. b3-a2 captures the white a2 Pawn diagonally.',
  '63. Black ends after Bxa2.',
  '64. b1-c2 captures the black c8 Bishop diagonally.',
  '65. White ends after Qxc2.',
  '66. g5-f4 is an empty Queen diagonal step.',
  '67. Black ends after Qf4.',
  '68. a1-b1 is an empty Rook step; White queenside rights are revoked.',
  '69. White ends after Rb1.',
  '70. Breakthrough replaces the move with f7-f6 forward capture of the white Knight; reset halfmove and advance Black fullmove.',
  '71. Black ends after Breakthrough.',
  '72. e1-d1 is a safe King step: a2 Bishop aims at b1, f4 Queen is screened; all White castling rights are lost.',
  '73. White ends after Kd1.',
  '74. h8-c8 follows empty g8,f8,e8,d8; original royal remains a7.',
  '75. Black ends after Rc8.',
  '76. Resurrection returns the captured white a2 Pawn to vacant starting-rank g2, retaining its physical ID and consuming one replacement move.',
  '77. White ends after Resurrection.',
  '78. Royal Pawn a7-a6 makes an ordinary safe Pawn advance; c2 Queen is not aligned with a6.',
  '79. Black ends after a6.',
  '80. c2-a4 follows empty b3 and checks royal a6 through a5; regular moves may give check.',
  '81. White ends; Black begins checked on a6.',
  '82. Tournament b8/g1 fails to answer Qa4-a6, so fizzles; Black began checked, therefore retains its Regular Move despite spending the card.',
  '83. b5-a4 captures the checking Queen with the black b7 Pawn and saves a6.',
  '84. Black ends after answering check.',
  '85. Annexation simultaneously advances d2-d4 and h2-h4 through empty d3/h3; both starting Pawns create en-passant opportunities; d1 stays safe.',
  '86. White ends; both en-passant opportunities remain for Black.',
  '87. g6-g5 is a single Pawn advance and passes up both en-passant opportunities.',
  '88. Black ends after g5.',
  '89. g3-h2 is an empty bishop step.',
  '90. White ends after Bh2.',
  '91. a2-b3 is an empty bishop step and checks d1 through vacant c2.',
  '92. Black ends; White begins checked by Bb3.',
  '93. h2-f4 crosses g3 and captures the Queen but leaves Bb3-c2-d1 check; provisional move is permitted because a Fortification rescue exists.',
  '94. Wall b6/c7 does not block Bb3-c2-d1. Failed rescue spends Fortification, discards the wall and rolls back the provisional capture and clocks; White must replace its move.',
  '95. d1-e1 leaves the b3 diagonal and answers check, with Fortification still spent.',
  '96. White ends its safe replacement move.',
  '97. c7-c5 crosses empty c6 and creates c6 en passant.',
  '98. Black ends; c6 en passant survives into the reply.',
  '99. h4-h5 advances into an empty square and expires c6 availability.',
  '100. White ends after h5.',
  '101. Sanctuary selects royal Pawn a6 and Rook a8: Rook slides to a7, King jumps to a8. Destinations are safe, Pawn identity stays unpromoted, replacement clocks advance.',
  '102. Black ends after Sanctuary.',
  '103. Plots Within Plots spends/draws once and offers two immediate additional plays without moving pieces or clocks.',
  '104. e2-e3 advances into an empty square; ordinary move closes unused Plots plays.',
  '105. White ends after e3.',
  '106. a7-d7 follows empty b7,c7; royal a8 remains protected.',
  '107. White reacts with Bog to that three-square Rook move; it stops at b7, one square from a7, without another clock tick.',
  '108. Black ends its shortened move; White reaction allowance resets.',
  '109. d4-d5 is an empty single Pawn advance.',
  '110. White ends after d5.',
  '111. a4-a3 advances Black Pawn into an empty square.',
  '112. Black ends after a3.',
  '113. b1-d1 slides through empty c1; e1 remains screened by e3/f3.',
  '114. White ends after Rd1.',
  '115. Irresistible Force replaces Black move: c5 Pawn pushes opposing c4 Pawn to empty c3, then occupies c4; neither is captured, royal a8 remains safe.',
  '116. Black ends after the Pawn push.',
  '117. The resurrected physical a2 Pawn moves g2-g3; no promotion or capture and e1 remains safe.',
  '118. White ends; Black begins the final position with 50 reviewed regular move commands.',
]

const at = (state: GameState, square: string) => state.pieces.find(p => p.square === square && p.zone === 'board')
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const
function reaches(state: GameState, piece: PieceState, to: string, capture: boolean): boolean {
  const [x, y] = xy(piece.square!)
  const [tx, ty] = xy(to)
  const dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy)
  if (piece.role === 'knight') return ax * ay === 2
  if (piece.role === 'king') return Math.max(ax, ay) === 1
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1
    return capture ? ax === 1 && dy === forward : dx === 0 && (dy === forward ||
      dy === 2 * forward && y === (piece.owner === 'white' ? 1 : 6) && !at(state, `${to[0]}${y + forward + 1}`))
  }
  if (!((piece.role === 'bishop' || piece.role === 'queen') && ax === ay ||
    (piece.role === 'rook' || piece.role === 'queen') && (dx === 0 || dy === 0))) return false
  for (let i = 1; i < Math.max(ax, ay); i++) {
    if (at(state, `${String.fromCharCode(97 + x + Math.sign(dx) * i)}${y + Math.sign(dy) * i + 1}`)) return false
  }
  return true
}

test('iteration 051: each reviewed action preserves independent movement and card semantics', () => {
  assert.equal(rationales.length, 118)
  assert.equal(rationales.length, trace.steps.length)
  let state = createGameState(trace.initial)
  let beforeRescue: GameState | undefined
  const cardSquares: Record<number, Record<string, string | null>> = {
    23: { 'black-pawn-a7': 'a7' },
    26: { 'white-bishop-c1': 'c2', 'white-bishop-f1': 'g3', 'black-bishop-f8': 'b3' },
    70: { 'black-pawn-f7': 'f6', 'white-knight-b1': null },
    76: { 'white-pawn-a2': 'g2' },
    85: { 'white-pawn-d2': 'd4', 'white-pawn-h2': 'h4' },
    101: { 'black-pawn-a7': 'a8', 'black-rook-a8': 'a7' },
    107: { 'black-rook-a8': 'b7' },
    115: { 'black-pawn-c7': 'c4', 'white-pawn-c2': 'c3' },
  }
  const cardClocks: Record<number, string> = {
    16: 'w KQkq - 0 5', 23: 'b KQkq - 3 6', 26: 'w KQ - 4 7', 40: 'b KQ - 1 10',
    70: 'w K - 0 18', 76: 'b - - 0 19', 82: 'b - - 1 20', 85: 'b - - 0 21',
    94: 'w - - 2 23', 101: 'w - - 0 25', 103: 'w - - 0 25', 107: 'w - - 1 26', 115: 'w - - 0 28',
  }
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, reason = rationales[index]!
    assert.ok(reason.startsWith(`${n}. `))
    const result = applyAction(state, action)
    assert.ok(result.ok, reason)
    const after = result.state
    if (n === 93) beforeRescue = state
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const mover = at(state, action.from)!, victim = at(state, action.to)
      assert.ok(mover && mover.owner === state.turn.color, reason)
      assert.ok(!victim || victim.owner !== mover.owner && !victim.royal, reason)
      assert.ok(reaches(state, mover, action.to, !!victim), reason)
      assert.deepEqual(after.pieces, state.pieces.map(p => p.id === mover.id ? { ...p, square: action.to } :
        p.id === victim?.id ? { ...p, square: null, zone: 'captured', capturedBy: state.turn.color } : p), reason)
      assert.deepEqual(after.players, state.players, reason)
      const old = state.fen.split(' '), next = after.fen.split(' ')
      assert.equal(next[1], mover.owner === 'white' ? 'b' : 'w', reason)
      assert.equal(next[2], n === 25 ? 'KQ' : n === 68 ? 'K' : n === 72 ? '-' : old[2], reason)
      assert.equal(Number(next[4]), mover.role === 'pawn' || victim ? 0 : Number(old[4]) + 1, reason)
      assert.equal(Number(next[5]), Number(old[5]) + (mover.owner === 'black' ? 1 : 0), reason)
      const double = mover.role === 'pawn' && Math.abs(Number(action.from[1]) - Number(action.to[1])) === 2
      assert.deepEqual(after.enPassant, double ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`, pawnId: mover.id }] : [], reason)
      assert.equal(after.turn.phase, 'afterMove', reason)
      assert.equal(after.turn.moveMade, true, reason)
    } else if (action.type === 'endTurn') {
      assert.deepEqual(after.pieces, state.pieces, reason)
      assert.deepEqual(after.players, state.players, reason)
      assert.equal(after.fen, state.fen, reason)
      assert.deepEqual(after.enPassant, state.enPassant, reason)
      assert.equal(after.turn.color, state.turn.color === 'white' ? 'black' : 'white', reason)
      assert.equal(after.turn.phase, 'beforeMove', reason)
      assert.deepEqual(after.turn.cardPlays, { white: 0, black: 0 }, reason)
    } else if (action.type === 'playCard') {
      assert.ok(n in cardClocks, reason)
      assert.equal(after.fen.split(' ').slice(1).join(' '), cardClocks[n], reason)
      const owner = n === 107 ? 'white' : state.turn.color
      const other = owner === 'white' ? 'black' : 'white'
      const physical = state.players[owner].hand.find(c => c.id === action.cardInstanceId)!
      assert.ok(physical, reason)
      assert.deepEqual(after.players[owner].hand, [...state.players[owner].hand.filter(c => c.id !== physical.id), state.players[owner].deck[0]], reason)
      assert.deepEqual(after.players[owner].deck, state.players[owner].deck.slice(1), reason)
      assert.deepEqual(after.players[owner].discard, [...state.players[owner].discard, ...(n === 16 ? [] : [physical])], reason)
      assert.deepEqual(after.players[other], state.players[other], reason)
      assert.equal(after.turn.cardPlays[owner], state.turn.cardPlays[owner] + 1, reason)
      const changes = cardSquares[n] ?? {}
      const expected = n === 94 ? beforeRescue!.pieces : state.pieces.map(p => {
        if (n === 16 && p.id === 'black-pawn-a7') return { ...p, royal: true }
        if (n === 16 && p.id === 'black-king-e8') return { ...p, royal: false }
        if (!(p.id in changes)) return p
        const { capturedBy: _actor, ...physicalPiece } = p
        return { ...physicalPiece, square: changes[p.id], zone: changes[p.id] === null ? 'captured' : 'board', ...(changes[p.id] === null ? { capturedBy: owner } : {}) }
      })
      assert.deepEqual(after.pieces, expected, reason)
      if (n === 16) assert.deepEqual(after.effects, [{ type: 'coup', owner: 'black', card: physical,
        princeId: 'black-king-e8', kingId: 'black-pawn-a7', princeRole: 'king' }], reason)
      if ([40, 82, 94].includes(n)) assert.equal(after.history.at(-1)?.type, 'cardFizzled', reason)
      assert.equal(after.turn.moveMade, ![82, 94, 103].includes(n), reason)
      assert.equal(after.turn.phase, [82, 94, 103].includes(n) ? 'beforeMove' : 'afterMove', reason)
      if (n !== 85) assert.deepEqual(after.enPassant, [], reason)
      if (n === 85) assert.deepEqual(after.enPassant, [{ target: 'd3', pawnId: 'white-pawn-d2' }, { target: 'h3', pawnId: 'white-pawn-h2' }], reason)
      if (n === 103) assert.equal(after.plotsAllowances?.[0]?.remaining, 2, reason)
    }
    if (n !== 16) assert.deepEqual(after.effects, state.effects, reason)
    assert.equal(!!after.pendingRescue, n === 93, reason)
    if (n === 104) assert.equal(after.plotsAllowances?.length ?? 0, 0, reason)
    // No neutral or movement-restricting effects occur in this trace: raw enemy
    // reach is a conservative independent safety check for the moving royalty.
    if (action.type !== 'endTurn') {
      const royal = after.pieces.find(p => p.owner === state.turn.color && p.royal)!
      const threatened = after.pieces.some(p => p.zone === 'board' && p.owner !== royal.owner && reaches(after, p, royal.square!, true))
      assert.equal(threatened, [82, 93, 94].includes(n), reason)
    }
    state = after
  }
  assert.equal(trace.moves, 50)
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 13)
  assert.equal(state.fen, 'pnr5/1r5p/3p1p1n/3Pp1pP/2p2qP1/pbP1PPP1/1P5B/3RK1NR b - - 0 28')
})

test('iteration 051 has a reproducible trace', () => {
  assert.ok(trace)
  replayTrace(trace)
})
