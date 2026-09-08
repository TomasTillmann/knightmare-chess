import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { createGameState } from '../state.js'
import { applyAction, isKingInCheck, legalDests } from '../reducer.js'
import type { Color, PieceState, SquareName, GameAction, GameState } from '../types.js'

// Authored in action order from the physical board and printed rules. All moves
// are quiet; Heresy is the only card that changes piece placement.
const rationales = `
1. a2-a3: white Pawn advances one to empty a3.
2. End White's completed a3 turn; preserve board and clocks.
3. b8-c6: black Knight jumps two ranks and one file.
4. End Black's completed Nc6 turn.
5. g1-h3: white Knight jumps to empty h3.
6. End White's completed Nh3 turn.
7. e7-e6: black Pawn advances one to empty e6.
8. End Black's completed e6 turn.
9. b2-b3: white Pawn advances one to empty b3.
10. End White's completed b3 turn.
11. g7-g6: black Pawn advances one to empty g6.
12. End Black's completed g6 turn.
13. h3-g5: white Knight jumps to empty g5.
14. End White's completed Ng5 turn.
15. f7-f6: black Pawn advances one to empty f6.
16. End Black's completed f6 turn.
17. e2-e4: home Pawn crosses empty e3; record e3 but no black Pawn can capture there.
18. End White's turn; retain the uncapturable physical e3 opportunity.
19. b7-b5: home Pawn crosses empty b6; replace e3 by uncapturable b6 opportunity.
20. End Black's turn; retain the physical b6 opportunity.
21. c2-c3: white Pawn advances one; expire b6 opportunity.
22. Heresy after White's move: all four Bishops move orthogonally one empty square, Black first c8-b8/f8-f7 then White c1-c2/f1-g1; spend and draw Forbidden City.
23. End White's turn after Heresy; reset both card allowances.
24. d8-e7: black Queen takes a single empty diagonal step.
25. End Black's completed Qe7 turn.
26. h2-h3: white Pawn advances one to empty h3.
27. Truce after White's move retains its card as an effect and draws Evangelists; both raw royal attack sets are empty.
28. End White's turn; Truce persists with neither check nor stalemate.
29. e7-f8: black Queen takes one empty diagonal step under Truce.
30. End Black's completed Qf8 turn; no raw royal attack ends Truce.
31. d1-h5: white Queen crosses empty e2/f3/g4 to empty h5.
32. End White's completed Qh5 turn; both Kings remain safe.
33. a7-a6: black Pawn advances one without capture.
34. End Black's completed a6 turn.
35. g1-h2: the Heresy-relocated white Bishop moves diagonally to vacant h2.
36. End White's completed Bh2 turn.
37. f8-b4: black Queen crosses empty e7/d6/c5; c3 Pawn blocks its b4-e1 diagonal.
38. End Black's completed Qb4 turn; Truce persists.
39. h3-h4: white Pawn advances one without capture.
40. End White's completed h4 turn.
41. a6-a5: black Pawn advances one without capture.
42. End Black's completed a5 turn.
43. a3-a4: white Pawn advances one, stopping before opposing a5 Pawn.
44. End White's completed a4 turn.
45. e8-d8: black King steps to safe empty d8; remove both black castling rights.
46. End Black's completed Kd8 turn.
47. h1-g1: white Rook slides one empty square; remove white kingside castling right.
48. End White's completed Rg1 turn.
49. c6-e7: black Knight jumps to empty e7.
50. End Black's completed Ne7 turn.
51. c3-c4: white Pawn advances one; d2 Pawn still blocks the black Queen's b4-e1 diagonal.
52. End White's completed c4 turn.
53. h7-h6: black Pawn advances one without capture.
54. End Black's completed h6 turn.
55. a1-a2: white Rook moves one empty square; remove final white castling right.
56. End White's completed Ra2 turn.
57. e7-f5: black Knight jumps to empty f5.
58. End Black's completed Nf5 turn.
59. h5-e2: white Queen crosses empty g4/f3 to empty e2.
60. End White's completed Qe2 turn.
61. a8-a6: black Rook crosses empty a7 to empty a6.
62. End Black's completed Ra6 turn.
63. e1-d1: white King takes one safe empty step; castling rights already absent.
64. End White's completed Kd1 turn.
65. a6-b6: black Rook slides one empty square.
66. End Black's completed Rb6 turn.
67. d1-c1: white King takes one safe empty step.
68. End White's completed Kc1 turn.
69. e6-e5: black Pawn advances one, stopping before white e4 Pawn.
70. End Black's completed e5 turn.
71. e2-h5: white Queen crosses empty f3/g4 to empty h5.
72. End White's completed Qh5 turn.
73. b4-f8: black Queen crosses empty c5/d6/e7 to empty f8.
74. End Black's completed Qf8 turn.
75. h5-f3: white Queen crosses empty g4 to empty f3.
76. End White's completed Qf3 turn.
77. f8-d6: black Queen crosses empty e7 to empty d6.
78. End Black's completed Qd6 turn.
79. a2-a3: white Rook slides one empty square.
80. End White's completed Ra3 turn.
81. f5-g3: black Knight jumps to empty g3, attacking neither King.
82. End Black's completed Ng3 turn.
83. c1-b2: white King steps diagonally to safe empty b2; b3 Pawn blocks b6 Rook's file.
84. End White's completed Kb2 turn.
85. d6-c5: black Queen takes one empty diagonal step.
86. End Black's completed Qc5 turn.
87. g1-h1: white Rook returns to its original square without restoring castling rights.
88. End White's completed Rh1 turn.
89. c7-c6: black Pawn advances one without capture.
90. End Black's completed c6 turn.
91. h4-h5: white Pawn advances one, stopping before black h6 Pawn.
92. End White's completed h5 turn.
93. b6-a6: black Rook slides one empty square.
94. End Black's completed Ra6 turn.
95. d2-d3: white Pawn advances one without capture.
96. Forbidden City after White's move marks empty d4; preserve board/clocks, retain physical card and draw Split Knight.
97. End White's turn after marking d4; both effects persist.
98. f7-e8: black Bishop takes one diagonal step, nowhere near forbidden d4.
99. Doomsayer after Black's move retains its physical card, draws Winged Victory and opens White's immediate naming choice.
100. White immediately names Queen; Truce prevents capture, so no loss and Doomsayer persists while its choice closes.
101. End Black's turn after resolving White's naming option.
102. f3-f4: white Queen slides one empty square, never crossing d4.
103. White names Bishop; Truce protects both white Bishops, leaving Doomsayer active.
104. White names Knight; Truce protects both white Knights, leaving Doomsayer active.
105. End White's turn after two harmless naming events.
106. d8-c7: black King steps diagonally onto safe empty c7, outside Forbidden City.
107. End Black's fiftieth move; both Kings safe and three effects remain.
`.trim().split('\n')

const moves = 'a2a3 b8c6 g1h3 e7e6 b2b3 g7g6 h3g5 f7f6 e2e4 b7b5 c2c3 d8e7 h2h3 e7f8 d1h5 a7a6 g1h2 f8b4 h3h4 a6a5 a3a4 e8d8 h1g1 c6e7 c3c4 h7h6 a1a2 e7f5 h5e2 a8a6 e1d1 a6b6 d1c1 e6e5 e2h5 b4f8 h5f3 f8d6 a2a3 f5g3 c1b2 d6c5 g1h1 c7c6 h4h5 b6a6 d2d3 f7e8 f3f4 d8c7'.split(' ')
const cards: Record<number, GameAction> = {
  22: { type: 'playCard', cardId: 'heresy', cardInstanceId: 'white-hand-1-heresy', target: [{ from: 'c8', to: 'b8' }, { from: 'f8', to: 'f7' }, { from: 'c1', to: 'c2' }, { from: 'f1', to: 'g1' }] },
  27: { type: 'playCard', cardId: 'truce', cardInstanceId: 'white-hand-3-truce' },
  96: { type: 'playCard', cardId: 'forbidden-city', cardInstanceId: 'white-deck-0-forbidden-city', target: 'd4' },
  99: { type: 'playCard', cardId: 'doomsayer', cardInstanceId: 'black-hand-2-doomsayer' },
}
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const

// Independent physical geometry, including the only square obstruction in this trace.
function reaches(piece: PieceState, to: string, pieces: PieceState[], forbidden: boolean, attack: boolean): boolean {
  const [x, y] = xy(piece.square!), [u, v] = xy(to), dx = u - x, dy = v - y
  if ((!dx && !dy) || forbidden && to === 'd4') return false
  const occupied = (a: number, b: number) => pieces.some(p => p.square === `${String.fromCharCode(97 + a)}${b + 1}`)
  if (piece.role === 'knight') return Math.abs(dx * dy) === 2
  if (piece.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1
    if (attack) return Math.abs(dx) === 1 && dy === forward
    return dx === 0 && (dy === forward || dy === 2 * forward && y === (forward === 1 ? 1 : 6) && !occupied(x, y + forward))
  }
  const diagonal = Math.abs(dx) === Math.abs(dy), straight = dx === 0 || dy === 0
  if (!(piece.role === 'bishop' ? diagonal : piece.role === 'rook' ? straight : diagonal || straight)) return false
  for (let k = 1; k < Math.max(Math.abs(dx), Math.abs(dy)); k++) {
    const a = x + Math.sign(dx) * k, b = y + Math.sign(dy) * k
    if (occupied(a, b) || forbidden && a === 3 && b === 3) return false
  }
  return true
}

function boardFen(pieces: PieceState[]): string {
  const roles = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }
  return Array.from({ length: 8 }, (_, i) => {
    let rank = '', empty = 0
    for (let file = 0; file < 8; file++) {
      const piece = pieces.find(p => p.square === `${String.fromCharCode(97 + file)}${8 - i}`)
      if (!piece) { empty++; continue }
      if (empty) { rank += empty; empty = 0 }
      rank += piece.owner === 'white' ? roles[piece.role].toUpperCase() : roles[piece.role]
    }
    return rank + (empty || '')
  }).join('/')
}

test('iteration 155 independently reviewed campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/155.json', import.meta.url), 'utf8')) as RandomTrace
  assert.ok(trace)
  assert.equal(trace.seed, 860155)
  assert.equal(trace.steps.length, 107)
  assert.equal(rationales.length, trace.steps.length)
  let state = createGameState(trace.initial)
  const pieces = structuredClone(state.pieces), players = structuredClone(state.players)
  let turn = structuredClone(state.turn), rights = 'KQkq', half = 0, full = 1, fenColor = 'w', moveCount = 0
  let ep: GameState['enPassant'] = []
  let shieldMove: GameState['shieldMove']
  const effects: unknown[] = []
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, action = step.action, context = rationales[index]!
    assert.ok(context.startsWith(`${n}. `))
    const input = structuredClone(state)
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from = action.from, to = action.to
      assert.equal(from + to, moves[moveCount], context)
      assert.equal(turn.phase, 'beforeMove', context)
      assert.equal(turn.moveMade, false, context)
      assert.match(to, /^[a-h][1-8]$/)
      const piece = pieces.find(p => p.square === from)!
      assert.ok(piece, context)
      assert.equal(piece.owner, turn.color, context)
      assert.equal(pieces.some(p => p.square === to), false, `${context}: quiet destination`)
      assert.ok(reaches(piece, to, pieces, n >= 96, false), `${context}: independent geometry`)
      ep = piece.role === 'pawn' && Math.abs(Number(from[1]) - Number(to[1])) === 2
        ? [{ target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName, pawnId: piece.id }] : []
      if (piece.royal) rights = rights.replace(piece.owner === 'white' ? /[KQ]/g : /[kq]/g, '')
      const rookRight: Record<string, string> = { a1: 'Q', h1: 'K', a8: 'q', h8: 'k' }
      if (piece.role === 'rook') rights = rights.replace(rookRight[from] ?? '~', '')
      piece.square = to as SquareName
      shieldMove = { player: turn.color, pieceIds: [piece.id], capturedOpponent: false }
      half = piece.role === 'pawn' ? 0 : half + 1
      full += turn.color === 'black' ? 1 : 0
      fenColor = turn.color === 'white' ? 'b' : 'w'
      turn.phase = 'afterMove'; turn.moveMade = true; moveCount++
    } else if (action.type === 'playCard') {
      assert.deepEqual(action, cards[n], `${context}: exact declared target`)
      assert.equal(turn.phase, 'afterMove', context)
      assert.equal(turn.moveMade, true, context)
      assert.equal(turn.cardPlays[turn.color], 0, context)
      const player = players[turn.color], cardIndex = player.hand.findIndex(c => c.id === action.cardInstanceId)
      assert.ok(cardIndex >= 0, context)
      const card = player.hand.splice(cardIndex, 1)[0]!
      const draw = player.deck.shift()!
      assert.equal(draw.cardId, ({ 22: 'forbidden-city', 27: 'evangelists', 96: 'split-knight', 99: 'winged-victory' } as Record<number, string>)[n])
      player.hand.push(draw); turn.cardPlays[turn.color]++
      if (n === 22) {
        assert.equal(pieces.filter(p => p.role === 'bishop').length, 4)
        for (const [from, to, owner] of [['c8', 'b8', 'black'], ['f8', 'f7', 'black'], ['c1', 'c2', 'white'], ['f1', 'g1', 'white']] as const) {
          const bishop = pieces.find(p => p.square === from)!
          assert.equal(bishop.role, 'bishop'); assert.equal(bishop.owner, owner)
          assert.equal(pieces.some(p => p.square === to), false)
          const [x, y] = xy(from), [u, v] = xy(to)
          assert.equal(Math.abs(x - u) + Math.abs(y - v), 1, 'Heresy changes square color')
          bishop.square = to
        }
        player.discard.push(card)
      } else effects.push({ type: action.cardId, owner: turn.color, card, ...(n === 96 ? { square: 'd4' } : {}) })
    } else if (action.type === 'namePiece') {
      assert.deepEqual(action, { type: 'namePiece', speaker: 'white', name: ({ 100: 'queen', 103: 'bishop', 104: 'knight' } as Record<number, string>)[n], losses: [] }, context)
      assert.ok(n >= 99, 'Doomsayer is active')
      assert.ok(effects.some(e => (e as { type: string }).type === 'truce'), 'Truce prevents all naming captures')
    } else {
      assert.deepEqual(action, { type: 'endTurn' }, context)
      assert.equal(turn.moveMade, true, context)
      turn = { color: turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      shieldMove = undefined
    }
    const result = applyAction(state, action)
    assert.deepEqual(state, input, `${context}: full input immutability including capturedBy`)
    assert.ok(result.ok, context)
    state = result.state
    assert.deepEqual(state.pieces, pieces, `${context}: every physical identity, role, owner, zone and absent capture actor`)
    assert.deepEqual(state.players, players, `${context}: exact physical card accounting`)
    assert.deepEqual(state.turn, turn, `${context}: timing and both allowances`)
    assert.deepEqual(state.effects, effects, `${context}: complete retained effect records`)
    assert.deepEqual(state.enPassant, ep, `${context}: physical en-passant opportunities`)
    // Both double steps have no adjacent prospective captor. Evaluate that player
    // before its move, even during the original mover's after-move reaction window.
    for (const opportunity of ep) {
      const victim = pieces.find(p => p.id === opportunity.pawnId)!
      const captor: Color = victim.owner === 'white' ? 'black' : 'white'
      assert.equal(pieces.some(p => p.owner === captor && p.role === 'pawn' && reaches(p, opportunity.target, pieces, false, true)), false)
      const prospective = { ...state, turn: { color: captor, phase: 'beforeMove' as const, moveMade: false, cardPlays: { white: 0, black: 0 } } }
      const destinations = legalDests(prospective)
      for (const pawn of pieces.filter(p => p.owner === captor && p.role === 'pawn')) assert.equal(destinations.get(pawn.square!)?.includes(opportunity.target) ?? false, false)
    }
    assert.equal(state.fen, `${boardFen(pieces)} ${fenColor} ${rights || '-'} - ${half} ${full}`, `${context}: all six FEN fields`)
    for (const color of ['white', 'black'] as const) {
      const king = pieces.find(p => p.owner === color && p.royal)!
      const rawAttackers = pieces.filter(p => p.owner !== color && reaches(p, king.square!, pieces, n >= 96, true))
      assert.deepEqual(rawAttackers.map(p => p.id), [], `${context}: independent raw royal attacks, including under Truce`)
      assert.equal(isKingInCheck(state, color), false, `${context}: engine agrees with physical safety`)
    }
    assert.equal(state.orientation, 0)
    assert.equal(state.pendingRescue ?? null, null)
    assert.equal(state.pendingAbduction ?? null, null)
    assert.deepEqual(state.pendingDoomsayer ?? null, n === 99 ? { player: 'white', cardInstanceId: 'black-hand-2-doomsayer' } : null)
    assert.deepEqual(state.underElfHill ?? [], [])
    assert.equal(state.chaosForbidden, undefined)
    assert.equal(state.plotsExecution, undefined)
    assert.deepEqual(state.plotsAllowances ?? [], [])
    assert.deepEqual(state.fogLocked ?? [], [])
    assert.deepEqual(state.riposteLostMoves ?? [], [])
    assert.equal(state.riposteSkipped, undefined)
    assert.equal(state.riposteCheckDeferred, undefined)
    assert.deepEqual(state.shieldMove, shieldMove)
    assert.equal(state.outcome, null)
  }
  assert.equal(moveCount, 50)
  assert.equal(state.fen, '1b2b1nr/2kp4/r1p2ppp/ppq1p1NP/P1P1PQ2/RP1P2n1/1KB2PPB/1N5R w - - 3 26')
  assert.equal(replayTrace(trace).fen, state.fen)
})
