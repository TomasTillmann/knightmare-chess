import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Board } from 'chessops/board'
import { Chess } from 'chessops/chess'
import { attacks } from 'chessops/attacks'
import { makeBoardFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameState, PieceState, SquareName } from '../types.js'
import { replayTrace, type RandomTrace } from './random-campaign.js'

// Individually reviewed against cards.md and rules §§9–11,13.7–8,14.3,17,19.2,20,21.1.
// Each numbered entry describes this action, including non-move transitions.
const rationale = `
1. Ng1-f3 jumps to an empty square; no capture or Pawn clock reset.
2. White ends its completed turn; only turn ownership and allowances reset.
3. Black f7-f6 advances one unobstructed square and resets the clock.
4. Black ends; White receives its before-move opportunity.
5. White c2-c3 advances one empty square.
6. White ends with no cards spent this turn.
7. Black e7-e6 advances one empty square.
8. Black ends; White can use a replacement move card.
9. Blessing relocates original b2 Pawn diagonally to empty a3; consumes move, resets clock, draws Knightmare.
10. White ends after Blessing; the replacement counted as its move.
11. Bf8-c5 traverses empty e7,d6 diagonally.
12. Black ends after its Bishop move.
13. Qd1-c2 moves diagonally to the Pawn-vacated square.
14. White ends; Black receives fresh allowance.
15. Onslaught advances b7,c7,d7,e6,f6,g7 Pawns simultaneously to initially empty b6,c6,d6,e5,f5,g6; no EP rights.
16. Black ends after the Pawn replacement move, fullmove already advanced.
17. Nf3xe5 captures physical black e7 Pawn by White.
18. White ends; that Pawn remains captured.
19. Bc8-d7 enters an empty diagonal neighbor.
20. Black ends with the Bishop at d7.
21. Qc2-b2 moves horizontally to the square vacated by Blessing.
22. White ends without changing the board.
23. a7-a5 passes empty a6; physical EP target a6 exists, but no adjacent White Pawn can use it so FEN EP is absent.
24. Black ends; physical a6 EP opportunity survives until White moves.
25. Bombard Rh1-h5 jumps exactly the h2 Pawn, traverses empty h3,h4; loses K right, clears EP, consumes move.
26. White ends after Bombard; the jumped Pawn stays h2.
27. Long Jump moves Ng8-g7 to an empty square of opposite color, without capture.
28. Black ends after Long Jump.
29. Ne5-c4 is an ordinary Knight jump.
30. White ends; the Rook remains on h5.
31. Bc5xa3 traverses empty b4 and captures White original b2 Pawn by Black.
32. Black ends; the captured Pawn stays off-board.
33. Qb2xa3 captures Black original f8 Bishop by White.
34. Forbidden City marks empty a4 after White moves; retain the physical card, draw Doppelganger, preserve clocks.
35. White ends; a4 remains forbidden.
36. f5-f4 moves Black original f7 Pawn forward one square.
37. Black plays Plots after moving; only existing Curse is eligible for extra plays, draw Peace Talks is not retroactively eligible.
38. Black declines both additional plays by ending; allowance closes.
39. Rh5xh7 crosses empty h6 and captures Black h7 Pawn by White.
40. White ends; Forbidden City is untouched.
41. Qd8-f6 passes empty e7 diagonally.
42. Black ends with Queen f6.
43. Nc4xd6 captures Black original d7 Pawn and checks Ke8.
44. Black reacts with Revenge, capturing White g2 Pawn; Black may remain in existing check before its coming move.
45. White immediately counters Revenge with Fog; restore g2 and clear capturedBy; both cards stay spent, d6 capture remains.
46. White ends; Black must answer the Knight check.
47. Ke8-f8 escapes Nd6 check; removes both Black castling rights.
48. Black ends safely on f8.
49. Ke1-d1 enters a safe adjacent square and removes White remaining castling right.
50. White ends; no castling rights remain.
51. Qf6-h4 crosses empty g5; ordinary noncapture advances Black clocks.
52. White Knightmare cancels that Queen move; restores f6 and pre-move clocks, spends only reaction, requires different replacement.
53. b6-b5 is a different Black move, using original b7 Pawn; Queen stays f6.
54. Black ends; canceled Queen transition prohibition expires.
55. Bc1-b2 enters an empty diagonal neighbor.
56. White ends; no effect changes.
57. Bd7-f5 passes empty e6 diagonally.
58. Black Peace Talks cancels retained White Forbidden City; its card goes to White discard, Peace Talks to Black discard.
59. Black ends; a4 is no longer blocked.
60. Rh7-h4 traverses empty h6,h5.
61. White ends with Rook h4.
62. Qf6-f7 moves to an empty orthogonal neighbor.
63. Black ends before White Betrayal.
64. Betrayal replaces enemy f4 Pawn on White half with captured White b2 Pawn; enemy becomes dead, returned Pawn loses capturedBy.
65. Qa3-c5 crosses empty b4; this ordinary move alone advances clocks after Betrayal.
66. White ends with returned Pawn still f4.
67. Bf5-c8 crosses empty e6,d7.
68. Black ends with Bishop c8.
69. c3-c4 advances White original c2 Pawn one square.
70. Heresy moves opponent Bishop c8-d8 first, then both White Bishops b2-b3 and f1-e1; all empty orthogonal neighbors change color.
71. White ends; Heresy did not consume an additional move or clock tick.
72. Qf7-e8 is an ordinary diagonal step.
73. Black ends safely behind White Nd6 blocking Qc5-f8 ray.
74. Nd6-f7 opens Qc5-d6-e7-f8 check against Black King.
75. White ends with Black checked by the Queen.
76. Nb8-d7 does not block c5-d6-e7-f8: temporarily illegal move opens rescue; Curse on Qc5 could suppress its three-square check.
77. Disintegration c6 cannot remove that check; spends and fizzles, then undoes Nb8-d7 and restores pre-move clocks, leaving Black to answer check.
78. Kf8xf7 captures White original g1 Knight and escapes the Queen diagonal.
79. Black ends safely, with its Disintegration allowance spent.
80. Qc5-f5 traverses empty d5,e5 and gives file check to Kf7 through f6.
81. White ends with Black in check.
82. Kf7-e7 steps off the checking Queen file to a safe square.
83. Black ends after escaping check.
84. Qf5-d7 traverses empty e6 and checks adjacent Ke7.
85. White ends; Black has a legal capture of the checking Queen.
86. Ke7xd7 captures undefended White Queen by Black and escapes check.
87. Black ends; physical Queen remains captured.
88. d2-d3 advances one empty square.
89. White Abduction selects opposing nonroyal Nb8 after moving; temporarily away, no captor yet, concealment pending, one draw only.
90. Reveal closes concealment and opens recall; no physical, card, clock or turn change.
91. Recall timeout captures Black Nb8 by White, clears the choice and resets halfmove without another fullmove or draw.
92. White ends after completed Abduction challenge.
93. Rh8-h7 enters an empty adjacent square.
94. Black ends with Rook h7.
95. Nb1-d2 jumps to the square vacated by White Pawn.
96. White ends with Knight d2.
97. Ra8-b8 moves into the square vacated by Abduction.
98. Black ends after the Rook move.
99. f2-f3 advances White Pawn one empty square.
100. White ends without additional effects.
101. Rb8-a8 returns along one empty rank step.
102. Black ends; castling rights remain absent.
103. Rh4xh7 passes empty h5,h6 and captures Black original h8 Rook by White.
104. White ends; Black g7 Knight blocks the h7 Rook ray toward Kd7.
105. Kd7-c8 steps diagonally to an unattacked square.
106. Black ends safely at c8.
107. Nd2-f1 jumps to a vacant square, Bishop having moved e1 by Heresy.
108. White ends with Knight f1.
109. Ra8-b8 is an empty horizontal step beside own King c8.
110. Black ends safely.
111. c4xb5 captures Black original b7 Pawn diagonally by White, resetting halfmove.
112. White ends; original c2 Pawn now b5.
113. Qe8-f8 enters an empty rank neighbor.
114. Black ends; board identities remain unchanged.
115. Rh7-h5 passes empty h6.
116. White ends with Rook h5.
117. Qf8-f6 passes empty f7; no capture, Black fullmove becomes 27.
118. Black ends; White begins with no pending choices and final halfmove 3.
`.trim().split('\n')

test('random iteration 119: independent physical, card, timing and royal oracle for every action', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/119.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.steps.length, 118)
  assert.equal(rationale.length, trace.steps.length)
  rationale.forEach((line, i) => assert.ok(line.startsWith(`${i + 1}. `)))
  let state = createGameState(trace.initial)
  let pieces = structuredClone(state.pieces)
  const players = structuredClone(state.players)
  let turn = structuredClone(state.turn)
  let halfmove = 0, fullmove = 1
  let active: Color = 'white'
  let rights = 'KQkq'
  let ep: GameState['enPassant'] = []
  let effects: GameState['effects'] = []
  const snapshots = new Map<number, { pieces: PieceState[]; halfmove: number; fullmove: number; active: Color; state: GameState }>()
  const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white'
  const at = (square: string) => pieces.find(piece => piece.zone === 'board' && piece.square === square)
  const physical = (id: string) => { const piece = pieces.find(piece => piece.id === id); assert.ok(piece); return piece }
  const relocate = (from: string, to: string) => {
    assert.match(to, /^[a-h][1-8]$/)
    const piece = at(from); assert.ok(piece, from); assert.equal(at(to), undefined, to)
    piece.square = to as SquareName
  }
  const capture = (piece: PieceState, owner: Color) => {
    piece.square = null; piece.zone = 'captured'; piece.capturedBy = owner
  }
  const board = () => {
    const result = Board.empty()
    for (const piece of pieces) if (piece.square) result.set(parseSquare(piece.square)!, { color: piece.owner, role: piece.role })
    return result
  }
  const fen = () => `${makeBoardFen(board())} ${active[0]} ${rights || '-'} - ${halfmove} ${fullmove}`
  const checked = (color: Color) => {
    const position = board()
    const king = pieces.find(piece => piece.royal && piece.owner === color)!
    assert.ok(king.square)
    const occupancy = effects.length ? position.occupied.with(parseSquare('a4')!) : position.occupied
    return pieces.some(piece => piece.square && piece.owner !== color
      && attacks({ color: piece.owner, role: piece.role }, parseSquare(piece.square)!, occupancy).has(parseSquare(king.square!)!))
  }
  const completeMove = (reset: boolean) => {
    halfmove = reset ? 0 : halfmove + 1
    fullmove += turn.color === 'black' ? 1 : 0
    active = opposite(turn.color)
    turn.phase = 'afterMove'; turn.moveMade = true; ep = []
  }
  let moves = 0, cards = 0
  for (const [i, { action }] of trace.steps.entries()) {
    const n = i + 1, label = rationale[i]!
    snapshots.set(n, { pieces: structuredClone(pieces), halfmove, fullmove, active, state: structuredClone(state) })
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      assert.equal(turn.phase, 'beforeMove', label)
      const mover = at(action.from); assert.ok(mover, label); assert.equal(mover.owner, turn.color, label)
      const position = Chess.fromSetup(parseFen(fen()).unwrap()).unwrap()
      const ordinary = { from: parseSquare(action.from)!, to: parseSquare(action.to)! }
      assert.equal(position.isLegal(ordinary), n !== 76, label)
      if (n === 76) {
        assert.equal(mover.role, 'knight'); assert.equal(action.from, 'b8'); assert.equal(action.to, 'd7'); assert.ok(checked('black'))
      }
      if (effects.length) {
        assert.notEqual(action.to, 'a4', label)
        if (['bishop', 'rook', 'queen'].includes(mover.role)) {
          const from = parseSquare(action.from)!, to = parseSquare(action.to)!
          const dx = Math.sign((to % 8) - (from % 8)), dy = Math.sign((to >> 3) - (from >> 3))
          for (let f = from % 8 + dx, r = (from >> 3) + dy; f !== to % 8 || r !== to >> 3; f += dx, r += dy) assert.notEqual(r * 8 + f, parseSquare('a4'), label)
        }
      }
      const victim = at(action.to)
      if (victim) capture(victim, turn.color)
      relocate(action.from, action.to)
      if (mover.royal) rights = rights.replace(mover.owner === 'white' ? /[KQ]/g : /[kq]/g, '')
      completeMove(mover.role === 'pawn' || !!victim)
      if (n === 23) ep = [{ target: 'a6', pawnId: 'black-pawn-a7' }]
      moves++
    } else if (action.type === 'endTurn') {
      assert.ok(turn.moveMade, label); assert.ok(!checked(turn.color), label)
      turn = { color: opposite(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
    } else if (action.type === 'playCard') {
      assert.ok(typeof action.cardInstanceId === 'string', label)
      const owner: Color = action.cardInstanceId.startsWith('white-') ? 'white' : 'black'
      const player = players[owner]
      const index = player.hand.findIndex(card => card.id === action.cardInstanceId)
      assert.ok(index >= 0, label); assert.equal(turn.cardPlays[owner], 0, label)
      const [card] = player.hand.splice(index, 1); assert.ok(card); assert.equal(card.cardId, action.cardId)
      if (n !== 34) player.discard.push(card)
      const replacement = player.deck.shift(); assert.ok(replacement); player.hand.push(replacement)
      turn.cardPlays[owner]++; cards++
      switch (n) {
        case 9: relocate('b2', 'a3'); completeMove(true); break
        case 15:
          for (const [from, to] of [['b7', 'b6'], ['c7', 'c6'], ['d7', 'd6'], ['e6', 'e5'], ['f6', 'f5'], ['g7', 'g6']]) relocate(from!, to!)
          completeMove(true); break
        case 25: relocate('h1', 'h5'); rights = rights.replace('K', ''); completeMove(false); break
        case 27: relocate('g8', 'g7'); completeMove(false); break
        case 34: assert.equal(at('a4'), undefined); effects = [{ type: 'forbidden-city', owner: 'white', card, square: 'a4' }]; break
        case 37: break
        case 44: capture(physical('white-pawn-g2'), 'black'); halfmove = 0; break
        case 45: {
          const pawn = physical('white-pawn-g2'); pawn.square = 'g2'; pawn.zone = 'board'; delete pawn.capturedBy; break
        }
        case 52:
        case 77: {
          const saved = snapshots.get(n === 52 ? 51 : 76)!
          pieces = structuredClone(saved.pieces); halfmove = saved.halfmove; fullmove = saved.fullmove; active = saved.active
          turn.phase = 'beforeMove'; turn.moveMade = false; ep = []; break
        }
        case 58:
          effects = []
          players.white.discard.push({ id: 'white-deck-1-forbidden-city', cardId: 'forbidden-city' }); break
        case 64: {
          const dead = physical('black-pawn-f7'); dead.zone = 'dead'; dead.square = null; delete dead.capturedBy
          const returned = physical('white-pawn-b2'); returned.zone = 'board'; returned.square = 'f4'; delete returned.capturedBy; break
        }
        case 70: relocate('c8', 'd8'); relocate('b2', 'b3'); relocate('f1', 'e1'); break
        case 89: { const removed = physical('black-knight-b8'); removed.zone = 'away'; removed.square = null; break }
        default: assert.fail(`unreviewed card ${n}`)
      }
    } else if (action.type === 'revealAbduction') {
      assert.equal(n, 90)
    } else if (action.type === 'abductionTimeout') {
      assert.equal(n, 91); capture(physical('black-knight-b8'), 'white'); halfmove = 0
    } else assert.fail(`unreviewed action ${n}`)

    const original = structuredClone(state)
    const result = applyAction(state, action)
    assert.deepEqual(state, original, `${label}: complete input immutability`)
    assert.ok(result.ok, label); state = result.state
    assert.deepEqual(state.pieces, pieces, `${label}: complete physical identity and capturedBy`)
    assert.deepEqual(state.players, players, `${label}: complete hand/deck/discard instances and order`)
    assert.deepEqual(state.effects, effects, `${label}: complete retained effects`)
    assert.deepEqual(state.turn, turn, `${label}: turn and allowance`)
    assert.deepEqual(state.enPassant, ep, `${label}: physical en-passant rights`)
    assert.equal(state.fen, fen(), `${label}: board, active color, castling, EP and clocks`)
    assert.equal(state.orientation, 0, label)
    assert.equal(!!state.pendingRescue, n === 76, `${label}: rescue iff temporarily illegal move`)
    if (n === 76) {
      assert.deepEqual(state.pendingRescue!.pieces, snapshots.get(76)!.pieces)
      assert.equal(state.pendingRescue!.fen, snapshots.get(76)!.state.fen)
      assert.deepEqual(state.pendingRescue!.movedPieceIds, ['black-knight-b8'])
      assert.ok(checked('black'))
    } else if (turn.moveMade) assert.ok(!checked(turn.color), `${label}: completed acting King safe`)
    assert.equal(!!state.pendingAbduction, n === 89 || n === 90, label)
    if (state.pendingAbduction) {
      const { before, ...choice } = state.pendingAbduction
      assert.deepEqual(choice, { phase: n === 89 ? 'concealment' : 'recall', player: 'black', durationMs: 10000, pieceId: 'black-knight-b8', requiresPieceId: false })
      assert.deepEqual(before, snapshots.get(89)!.state, `${label}: challenge restores exact pre-card state`)
    }
    assert.equal(!!state.pendingDoomsayer, false, label)
    assert.equal(state.underElfHill?.length ?? 0, 0, label)
    assert.equal(state.outcome ?? null, null, label)
    assert.deepEqual(state.plotsAllowances?.map(({ player, remaining, eligibleCards }) => ({ player, remaining, eligibleCards })) ?? [],
      n === 37 ? [{ player: 'black', remaining: 2, eligibleCards: ['black-hand-1-curse'] }] : [], label)
    if (action.type === 'playCard' && n !== 34 && n !== 89) {
      const resultPosition = Chess.fromSetup(parseFen(fen()).unwrap())
      if (resultPosition.isOk) assert.equal(resultPosition.value.isCheckmate(), false, `${label}: regular card does not directly mate`)
    }
  }
  assert.equal(moves, 50); assert.equal(cards, 14)
  assert.equal(state.fen, '1rkb4/6n1/2p2qp1/pP5R/5P2/1B1P1P2/P3P1PP/R2KBN2 w - - 3 27')
  assert.deepEqual(replayTrace(trace), state)
})
