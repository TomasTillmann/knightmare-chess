import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Chess } from 'chessops/chess'
import { makeBoardFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { GameState, SquareName } from '../types.js'
import { replayTrace, type RandomTrace } from './random-campaign.js'

// Independently reviewed against rules §§8–11 and the seven played card artworks.
const rationales = `
1. White Knight b1-c3 jumps to an empty square.
2. White completes its move; Black starts with renewed card allowances.
3. Black Pawn c7-c6 advances one empty square.
4. Black completes its move; White starts.
5. White Pawn a2-a3 advances one empty square.
6. White completes its move; Black starts.
7. Black Pawn e7-e5 crosses empty e6; e6 en-passant opportunity is recorded.
8. Black completes its move; e6 opportunity survives for White.
9. White Pawn e2-e3 advances; previous en-passant opportunity expires.
10. White completes its move; Black starts.
11. Black Queen d8-b6 follows the clear c7 diagonal.
12. Black completes its move; White starts.
13. White Queen d1-f3 follows the vacated e2 diagonal.
14. White completes its move; Black starts.
15. Black Queen b6-a5 makes a quiet diagonal step.
16. Black completes its move; White starts.
17. White Knight c3-a4 jumps to an empty square.
18. White completes its move; Black starts.
19. Black Bishop f8-e7 makes a quiet diagonal step.
20. Black completes its move; White starts.
21. White Knight g1-e2 jumps to an empty square.
22. White completes its move; Black starts.
23. Black Pawn e5-e4 advances one empty square.
24. Black completes its move; White starts.
25. White Pawn c2-c4 crosses empty c3; c3 en-passant opportunity is recorded.
26. White completes its move; c3 opportunity survives for Black.
27. Black Pawn f7-f5 crosses empty f6; replaces c3 opportunity with f6.
28. Black completes its move; f6 opportunity survives for White.
29. White Queen f3-g3 makes a quiet rank step; f6 opportunity expires.
30. White completes its move; Black starts.
31. Black Queen a5-b5 makes a quiet rank step.
32. Black completes its move; White starts.
33. White Queen g3-b8 crosses f4,e5,d6,c7 and captures Black Knight b8.
34. White completes its move; Black starts.
35. Guardian replaces Black move: a7-a6 Pawn, then a8-a7 following Rook; no capture or en passant; queenside castling lost, draw Holy War.
36. Black completes its replacement move; White starts.
37. White Pawn h2-h3 advances one empty square.
38. White completes its move; Black starts.
39. Black Knight g8-f6 jumps to an empty square.
40. Figure Dance after Black move would place White h1 Rook on h8, attacking e8 through g8,f8; self-check fizzles, board/clocks stay, draw Fanatic.
41. Black completes its move; White starts.
42. White Queen b8-a8 makes a quiet rank step.
43. White completes its move; Black starts.
44. Black Queen b5-a4 captures White original b1 Knight.
45. Black completes its move; White starts.
46. White Pawn c4-c5 advances one empty square.
47. White completes its move; Black starts.
48. Black Bishop e7-f8 makes a quiet diagonal step.
49. Black completes its move; White starts.
50. White Knight e2-c3 jumps to an empty square.
51. White completes its move; Black starts.
52. Black Queen a4-b3 makes a quiet diagonal step.
53. Black completes its move; White starts.
54. Hidden Passage replaces White move, King e1-e2 to empty safe square; both castling rights lost, draw Merciless.
55. Immediate Black Fog of War cancels Hidden Passage: King, clocks, castling restored; both cards stay discarded, White may move but not play another card; draw Chaos.
56. White replacement Knight c3-d5 jumps to empty square with both card allowances already spent.
57. White completes its replacement move; Black starts with allowances reset.
58. Black Queen b3-e3 crosses c3,d3, captures White original e2 Pawn, and checks e1 through e2.
59. Black completes its move; White must answer the Queen check.
60. White Rook h1-g1 leaves Queen e3 checking King e1; provisionally allowed only with same-turn rescue, no turn may end.
61. Heresy proposes opponent Bishops c8-b8,f8-f7 then White c1-d1; f1 Bishop has no vacant orthogonal neighbor. Queen e3 still checks e1, so card fizzles and pending Rook move is taken back; draw Fireball, card remains spent.
62. White Pawn d2-e3 captures the checking Black Queen and cures check.
63. White completes its move; Black starts.
64. Black Bishop f8-d6 crosses empty e7.
65. Black completes its move; White starts.
66. White Bishop f1-b5 crosses empty e2,d3,c4.
67. White completes its move; Black starts.
68. Black King e8-d8 steps to a safe empty square; last Black castling right lost.
69. Black completes its move; White starts.
70. White Knight d5-e7 jumps to an empty square.
71. White completes its move; Black starts.
72. Black Pawn g7-g6 advances one empty square.
73. Black completes its move; White starts.
74. White Bishop b5-d3 crosses empty c4.
75. White completes its move; Black starts.
76. Black Rook a7-a8 captures White Queen.
77. Black completes its move; White starts.
78. White Knight e7-g6 captures Black original g7 Pawn.
79. White completes its move; Black starts.
80. Black Knight f6-g4 jumps to an empty square.
81. Black completes its move; White starts.
82. White Knight g6-f8 jumps to an empty square.
83. White completes its move; Black starts.
84. Black Rook h8-f8 crosses empty g8 and captures White original g1 Knight.
85. Black completes its move; White starts.
86. White Bishop d3-e2 makes a quiet diagonal step.
87. Forbidden City after White move marks vacant b1 permanently; no board/clock change, card enters effects rather than discard, draw Irresistible Force.
88. White completes its move; Black starts; b1 remains forbidden.
89. Black Rook a8-b8 makes a quiet rank step clear of b1.
90. Black completes its move; White starts; b1 remains forbidden.
91. White Pawn b2-b3 advances one empty square.
92. White completes its move; Black starts.
93. Black Knight g4-h6 jumps to an empty square.
94. Black completes its move; White starts.
95. White King e1-d1 steps safely; both White castling rights are lost.
96. White completes its move; Black starts.
97. Breakthrough replaces Black move: Pawn e4-e3 captures White original d2 Pawn directly forward; reset halfmove clock, draw Hidden Passage.
98. Black completes its replacement move; White starts.
99. White Pawn f2-f3 advances one empty square.
100. White completes its move; Black starts.
101. Black King d8-c7 steps to a safe empty square.
102. Black completes its move; White starts.
103. White Bishop c1-b2 makes a quiet diagonal step, avoiding forbidden b1.
104. White completes its move; Black starts.
105. Black Knight h6-f7 jumps to an empty square.
106. Black completes its move; White starts.
107. White Rook h1-h2 makes a quiet file step.
108. White completes its move; Black starts with no pending rescue and b1 still forbidden.
`.trim().split('\n')

const other = (color: 'white' | 'black') => color === 'white' ? 'black' : 'white'
const pieces = (state: GameState) => state.pieces.map(({ capturedAtPly: _, capturedBy: _actor, ...piece }) => piece)
function attackers(state: GameState, color: 'white' | 'black') {
  const position = Chess.default()
  position.board = parseFen(state.fen).unwrap().board
  const king = position.board.kingOf(color)!
  return [...position.kingAttackers(king, other(color), position.board.occupied)]
}

test('iteration 089: independently reviewed random campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/089.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(rationales.length, 108)
  assert.equal(trace.steps.length, rationales.length)
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 7)
  let state = createGameState(trace.initial)
  const states = [state]
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1
    assert.ok(rationales[index]!.startsWith(`${n}. `))
    const before = state
    const result = applyAction(before, action)
    assert.ok(result.ok, rationales[index])
    state = result.state
    const expectedPieces = pieces(before)
    const relocate = (from: string, to: SquareName, capture = false) => {
      const mover = expectedPieces.find(piece => piece.square === from)!
      assert.ok(mover, `${n}: mover identity`)
      const victim = expectedPieces.find(piece => piece.square === to)
      assert.equal(!!victim, capture, `${n}: capture status`)
      if (victim) {
        assert.notEqual(victim.owner, mover.owner)
        assert.equal(victim.royal, false)
        victim.square = null
        victim.zone = 'captured'
      }
      mover.square = to
    }
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      assert.match(action.to, /^[a-h][1-8]$/)
      const moving = before.pieces.find(piece => piece.square === action.from)!
      const captured = before.pieces.find(piece => piece.square === action.to)
      assert.equal(moving.owner, before.turn.color)
      // The one temporary self-check is reviewed separately under §11.6.
      if (n !== 60) {
        const chess = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap()
        const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! }
        assert.ok(chess.isLegal(move), rationales[index])
        chess.play(move)
        assert.equal(makeBoardFen(chess.board), state.fen.split(' ')[0])
      }
      relocate(action.from, action.to as SquareName, !!captured)
      const oldFen = before.fen.split(' '), newFen = state.fen.split(' ')
      assert.equal(+newFen[4]!, moving.role === 'pawn' || captured ? 0 : +oldFen[4]! + 1)
      assert.equal(+newFen[5]!, +oldFen[5]! + Number(moving.owner === 'black'))
      const doublePawn = moving.role === 'pawn' && Math.abs(+action.to[1]! - +action.from[1]!) === 2
      assert.deepEqual(state.enPassant, doublePawn
        ? [{ target: `${action.from[0]}${(+action.to[1]! + +action.from[1]!) / 2}`, pawnId: moving.id }] : [])
      assert.deepEqual(state.turn, { ...before.turn, phase: 'afterMove', moveMade: true })
      assert.deepEqual(state.players, before.players)
      assert.deepEqual(state.effects, before.effects)
      if (n >= 87) assert.notEqual(action.to, 'b1')
    } else if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true)
      assert.equal(attackers(before, before.turn.color).length, 0)
      assert.equal(state.fen, before.fen)
      assert.deepEqual(state.enPassant, before.enPassant)
      assert.deepEqual(state.players, before.players)
      assert.deepEqual(state.effects, before.effects)
      assert.deepEqual(state.turn, { color: other(before.turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } })
    } else if (action.type === 'playCard') {
      const owner = n === 55 ? 'black' : before.turn.color
      const player = before.players[owner]
      const card = player.hand.find(card => card.id === action.cardInstanceId)!
      assert.equal(card.cardId, action.cardId)
      assert.equal(before.turn.cardPlays[owner], 0)
      assert.equal(before.turn.phase, [35,54,97].includes(n) ? 'beforeMove' : 'afterMove')
      assert.deepEqual(state.players[owner], {
        hand: [...player.hand.filter(item => item.id !== card.id), player.deck[0]],
        deck: player.deck.slice(1),
        discard: n === 87 ? player.discard : [...player.discard, card],
      })
      assert.deepEqual(state.players[other(owner)], before.players[other(owner)])
      assert.equal(state.turn.cardPlays[owner], 1)
      if (![55,61].includes(n)) {
        assert.equal(state.turn.phase, 'afterMove')
        assert.equal(state.turn.moveMade, true)
        assert.equal(state.turn.color, before.turn.color)
      }
      if ([35,54,97].includes(n)) assert.equal(attackers(state, other(owner)).length, 0, `${n}: replacement card does not directly checkmate`)
      if (n === 35) {
        relocate('a7', 'a6'); relocate('a8', 'a7')
        assert.equal(state.fen, '1Qb1k1nr/rp1pb1pp/p1p5/1q3p2/N1P1p3/P3P3/1P1PNPPP/R1B1KB1R w KQk - 0 10')
        assert.deepEqual(state.enPassant, [])
      } else if (n === 40) {
        // Counterclockwise rotation places the h1 White Rook on h8.
        const proposed = Chess.default()
        proposed.board = parseFen(before.fen).unwrap().board.clone()
        const rook = proposed.board.get(parseSquare('h1')!)!
        proposed.board.take(parseSquare('h1')!)
        proposed.board.set(parseSquare('h8')!, rook)
        assert.ok(proposed.kingAttackers(parseSquare('e8')!, 'white', proposed.board.occupied).has(parseSquare('h8')!))
        assert.equal(state.fen, before.fen)
        assert.equal(state.history.at(-1)?.reason, 'SELF_CHECK')
      } else if (n === 54) {
        relocate('e1', 'e2')
        assert.equal(state.fen, 'Q1b1kb1r/rp1p2pp/p1p2n2/2P2p2/4p3/PqN1P2P/1P1PKPP1/R1B2B1R b k - 4 14')
      } else if (n === 55 || n === 61) {
        const restored = states[n === 55 ? 53 : 59]!
        expectedPieces.splice(0, expectedPieces.length, ...pieces(restored))
        assert.equal(state.fen, restored.fen)
        assert.deepEqual(state.enPassant, restored.enPassant)
        assert.deepEqual(state.effects, restored.effects)
        assert.equal(state.turn.phase, 'beforeMove')
        assert.equal(state.turn.moveMade, false)
        if (n === 55) assert.deepEqual(state.turn.cardPlays, { white: 1, black: 1 })
        else {
          assert.equal(state.history.at(-1)?.reason, 'SELF_CHECK')
          assert.deepEqual(attackers(state, 'white'), [parseSquare('e3')!])
        }
      } else if (n === 87) {
        assert.ok(!before.pieces.some(piece => piece.square === 'b1'))
        assert.deepEqual(state.effects, [{ type: 'forbidden-city', owner: 'white', card, square: 'b1' }])
        assert.equal(state.fen, before.fen)
      } else if (n === 97) {
        relocate('e4', 'e3', true)
        assert.equal(state.fen, '1rbk1r2/1p1p3p/p1pb3n/2P2p2/8/PP2p2P/4BPP1/R1BK3R w - - 0 24')
      } else assert.fail(`Unreviewed card at ${n}`)
      if (n !== 87) assert.deepEqual(state.effects, before.effects)
      assert.deepEqual(state.enPassant, [])
    } else assert.fail(`Unreviewed action at ${n}`)
    assert.deepEqual(pieces(state), expectedPieces, `${n}: complete independent piece identity transition`)
    // No transformed pieces or neutral controllers occur. Ordinary attack geometry is
    // a stronger safety check here; the sole obstruction is b1, away from both Kings.
    const checked = attackers(state, before.turn.color)
    if ([60,61].includes(n)) assert.deepEqual(checked, [parseSquare('e3')!])
    else assert.equal(checked.length, 0, `${n}: acting royal safety`)
    assert.equal(!!state.pendingRescue, n === 60)
    assert.equal(state.orientation, 0)
    assert.equal(state.outcome, null)
    states.push(state)
  }
  assert.ok(replayTrace(trace))
  assert.equal(state.fen, '1rb2r2/1pkp1n1p/p1pb4/2P2p2/8/PP2pP1P/1B2B1PR/R2K4 b - - 4 26')
})
