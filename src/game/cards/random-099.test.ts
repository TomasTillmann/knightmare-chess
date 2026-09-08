import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { Board } from 'chessops/board'
import { makeBoardFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, PieceState, SquareName } from '../types.js'
import { CARD_CATALOG } from './catalog.js'

// Explicit review in generated order; each sentence is paired with independent assertions below.
const rationale = `
1. White Ng1-h3 is a knight jump to an empty square.
2. White ends its completed move; Black receives fresh allowances.
3. Black c7-c5 crosses empty c6 from its starting rank; c6 is the en-passant target.
4. Crab attaches to Black c5 after its move without changing the pawn or its en-passant liability.
5. Black ends its move; Crab persists for White's turn.
6. White g2-g4 crosses empty g3; its double step replaces c6 en-passant availability.
7. White ends its move with g3 availability intact.
8. Black Nb8-c6 jumps to the empty square and expires g3 availability.
9. Black ends its completed knight move.
10. White Nh3-f4 jumps to the empty square.
11. Holy War exchanges the own f4 knight and c1 bishop after moving; neither is captured.
12. White ends its move with the swapped identities intact.
13. Black Nc6-b4 jumps to the empty square.
14. Black ends its completed knight move.
15. Dubbing moves the f2 pawn as a knight to empty h3 and consumes White's move without promoting.
16. White ends the Dubbing replacement move.
17. Black b7-b5 crosses empty b6 and creates b6 en-passant availability.
18. Black ends its double-step move.
19. White Bf4-h6 crosses empty g5 diagonally.
20. White ends its bishop move.
21. Black g7xh6 captures the physical c1 bishop; Black is its captor.
22. Black ends its pawn capture.
23. White g4-g5 advances one square into empty g5.
24. White ends its pawn move.
25. Black Qd8-c7 moves one diagonal square into the space vacated by the Crab.
26. Mystic Shield protects that just-moved physical queen during White's coming turn; it is discarded immediately.
27. Black ends its move; the queen's shield remains through White's turn.
28. White d2-d4 crosses empty d3 and creates d3 en-passant availability.
29. White ends its turn, expiring Black's temporary queen shield.
30. Black Qc7-c6 moves one empty file square, clearing d3 availability.
31. Black ends its queen move.
32. White Qd1-d3 crosses empty d2 on its file.
33. White ends its queen move.
34. Black Qc6-g2 crosses empty d5, e4, and f3 diagonally.
35. Plots Within Plots is legal after Black's queen move; Heresy is eligible (White Bf1-f2 then Black Bc8-d8 is safe), while Legacy, Betrayal, and Merciless lack their triggers.
36. Black declines the extra card opportunities by ending its turn; the allowance closes.
37. White a2-a4 crosses empty a3, creating a3 en-passant availability.
38. Coup makes the b2 pawn royal while e1 becomes a capturable Prince; neither piece moves or changes movement role.
39. White ends its turn with b2 as its safe King.
40. Black Qg2-g4 crosses empty g3; a3 en-passant availability expires.
41. Black ends its queen move.
42. White Qd3-e3 moves one file horizontally; the royal pawn stays at b2.
43. White ends its queen move.
44. Black a7-a6 advances one empty square.
45. Black ends its pawn move.
46. White a4-a5 advances one empty square.
47. White ends its pawn move.
48. Black d7-d5 crosses empty d6 and creates d6 en-passant availability.
49. Black ends its double-step move.
50. White c2-c4 crosses empty c3 and replaces d6 availability with c3.
51. White ends its double-step move.
52. Bombard moves Black Ra8-b8 into empty b8 without using its optional jump; the replacement move revokes queenside castling.
53. Black ends the Bombard replacement move.
54. White Bf1-g2 moves one diagonal square into empty g2.
55. Forbidden City marks empty b6 after White's move; it blocks subsequent paths and destinations.
56. White ends its move with b6 remaining forbidden.
57. Black f7-f6 advances one empty square.
58. Black ends its pawn move.
59. White Qe3-g3 crosses empty f3 horizontally.
60. White ends its queen move.
61. Black Bc8-e6 crosses empty d7 diagonally.
62. Black ends its bishop move.
63. White Nc1-a2 jumps into empty a2.
64. White ends its knight move.
65. Black Rb8-c8 moves one horizontal square into empty c8.
66. Black ends its rook move.
67. Irresistible Force moves h2-h3 while pushing the other White pawn h3-h4; h4 is empty and no King is pushed.
68. White ends the pawn-push replacement move.
69. Black Qg4xh3 captures the original h2 pawn; the pushed original f2 pawn remains on h4.
70. Black ends its queen capture.
71. White's Prince e1-f1 steps to empty f1 and loses the original King's castling rights; b2 remains royal.
72. White ends its Prince move.
73. Black Qh3xh4 captures the original f2 pawn; Black is the captor of both h-file losses.
74. Black ends its queen capture.
75. White Qg3-h2 moves one empty diagonal square.
76. White ends its queen move.
77. Tournament exchanges Black Nb4 and White Nb1 atomically, consuming Black's replacement move without capture.
78. Black ends its Tournament move.
79. Guardian moves White e2-e3; e1 is empty, so there is no follower and no en-passant opportunity.
80. White ends the Guardian replacement move.
81. Black's original g7 pawn advances h6-h5 into empty h5.
82. Black ends its pawn move.
83. White Bg2-h3 moves one empty diagonal square.
84. White ends its bishop move.
85. Black Rc8-d8 moves one empty horizontal square.
86. Black ends its rook move.
87. White's Prince f1-g1 moves one empty square; only b2 requires White royal safety.
88. White ends its Prince move.
89. Black Rd8-c8 moves one empty horizontal square.
90. Black ends its rook move.
91. Passing in the Night swaps White c4 with Black d5 and White d4 with Black e7 simultaneously; all four pawn identities persist.
92. White ends its pawn-swap replacement move.
93. Black Be6-f5 moves one empty diagonal square.
94. Black ends its bishop move.
95. White e3xd4 captures the original Black e7 pawn, which was placed there by the swap.
96. White ends its pawn capture.
97. Black Ke8xe7 captures the original White d2 pawn on an unattacked square; all Black castling rights end.
98. Black ends its royal capture.
99. White's Prince g1-f2 moves one empty diagonal square while b2 remains royal.
100. White ends its Prince move.
101. Black Ke7-d7 moves one square into an unattacked empty square.
102. Black ends its King move.
103. White Na2-c1 jumps to empty c1.
104. White ends its knight move.
105. Resurrection returns the captured Black e7 pawn to vacant starting-rank g7 with the same identity and clears its White captor.
106. Black ends its Resurrection replacement move.
107. White Bh3-f1 crosses empty g2 diagonally.
108. White ends its bishop move.
109. Black h7-h6 advances into empty h6.
110. Black ends its pawn move.
111. White Nc1-e2 jumps to empty e2.
112. Siege exchanges White Nb4 and Rh1 after the knight move; it preserves their identities and the completed move clocks.
113. White ends its turn after Siege.
114. Black's Crab c5xd4 makes its permitted one-square forward diagonal capture of the original White e2 pawn.
115. Black ends its Crab capture.
116. White Qh2-b8 crosses empty g3, f4, e5, d6, and c7; it neither enters nor crosses forbidden b6.
117. White ends its long queen move.
118. Black Bf5-h7 crosses empty g6 diagonally, leaving the physical bishop on h7 for the reaction window.
119. White's immediate Bog response truncates that two-square bishop move to g6; h7 becomes empty and no extra move clock advances.
120. Black ends its shortened bishop move; White's reaction allowance does not consume its next allowance.
121. White Ne2xd4 captures Black's Crab; White is its captor and the attached Crab card remains suspended for immediate return.
122. White ends its fiftieth Regular Move; Black receives a fresh turn and the captured Crab remains within its following-move return window alongside the other continuing effects.
`.trim().split('\n')

const cardMoves: Record<number, string[]> = {
  11: ['f4c1', 'c1f4'], 15: ['f2h3'], 52: ['a8b8'], 67: ['h3h4', 'h2h3'],
  77: ['b4b1', 'b1b4'], 79: ['e2e3'], 91: ['c4d5', 'd5c4', 'd4e7', 'e7d4'],
  112: ['b4h1', 'h1b4'], 119: ['h7g6'],
}

function square(value: string): SquareName {
  assert.match(value, /^[a-h][1-8]$/)
  return value as SquareName
}

function reaches(piece: PieceState, to: string, pieces: PieceState[], forbidden: boolean, capture: boolean): boolean {
  assert.ok(piece.square)
  const from = piece.square
  const dx = to.charCodeAt(0) - from.charCodeAt(0), dy = Number(to[1]) - Number(from[1])
  const ax = Math.abs(dx), ay = Math.abs(dy)
  const occupied = (at: string) => pieces.some(p => p.zone === 'board' && p.square === at)
  if ((!ax && !ay) || (forbidden && to === 'b6')) return false
  if (piece.role === 'knight') return ax * ay === 2
  if (piece.role === 'king') return Math.max(ax, ay) === 1
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1
    if (capture) return ax === 1 && dy === forward
    if (ax) return false
    if (dy === forward) return true
    const middle = `${from[0]}${Number(from[1]) + forward}`
    return from[1] === (piece.owner === 'white' ? '2' : '7') && dy === 2 * forward
      && !occupied(middle) && !(forbidden && middle === 'b6')
  }
  if (piece.role === 'bishop' && ax !== ay) return false
  if (piece.role === 'rook' && ax && ay) return false
  if (piece.role === 'queen' && ax && ay && ax !== ay) return false
  for (let n = 1; n < Math.max(ax, ay); n++) {
    const at = `${String.fromCharCode(from.charCodeAt(0) + Math.sign(dx) * n)}${Number(from[1]) + Math.sign(dy) * n}`
    if (occupied(at) || (forbidden && at === 'b6')) return false
  }
  return true
}

test('iteration 099 independently verifies every physical transition and full input immutability', () => {
  const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/099.json', import.meta.url), 'utf8'))
  assert.equal(trace.steps.length, 122)
  assert.equal(rationale.length, trace.steps.length)
  let actual = createGameState(trace.initial)
  const expected = structuredClone(actual)
  let half = 0, full = 1, fenTurn: Color = 'white'
  let rights = 'KQkq'
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, why = rationale[index]!
    assert.ok(why.startsWith(`${n}. `))
    const input = structuredClone(actual)
    const actor = expected.turn.color
    const opposite = actor === 'white' ? 'black' : 'white'
    let consumesMove = false, reset = false
    const at = (s: string) => expected.pieces.find(p => p.zone === 'board' && p.square === s)
    const byId = (id: string) => { const p = expected.pieces.find(p => p.id === id); assert.ok(p, why); return p }
    const forbidden = n > 55
    const revoke = (p: PieceState, from: string) => {
      if (p.role === 'king' || p.royal) rights = rights.replace(p.owner === 'white' ? /[KQ]/g : /[kq]/g, '')
      if (p.role === 'rook') {
        const right = ({ a1: 'Q', h1: 'K', a8: 'q', h8: 'k' } as Record<string, string>)[from]
        if (right) rights = rights.replace(right, '')
      }
    }
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      assert.equal(expected.turn.moveMade, false, why)
      const mover = at(action.from), victim = at(action.to)
      assert.ok(mover, why)
      assert.equal(mover.owner, actor, why)
      assert.ok(reaches(mover, action.to, expected.pieces, forbidden, !!victim), why)
      if (mover.id === 'black-pawn-c7' && n > 4) {
        assert.equal(Math.abs(action.from.charCodeAt(0) - action.to.charCodeAt(0)), 1, why)
        assert.equal(Number(action.to[1]) - Number(action.from[1]), -1, why)
      }
      expected.enPassant = []
      if (mover.role === 'pawn' && Math.abs(Number(action.to[1]) - Number(action.from[1])) === 2) {
        expected.enPassant = [{ pawnId: mover.id, target: square(`${action.from[0]}${(Number(action.to[1]) + Number(action.from[1])) / 2}`) }]
      }
      if (victim) {
        assert.notEqual(victim.owner, actor, why)
        assert.equal(victim.royal, false, why)
        revoke(victim, action.to)
        victim.square = null; victim.zone = 'captured'; victim.capturedBy = actor
        if (victim.id === 'black-pawn-c7') {
          // Independent pre-action move clocks place this capture at ply 56.
          victim.capturedAtPly = (full - 1) * 2 + (fenTurn === 'black' ? 1 : 0)
          assert.equal(victim.capturedAtPly, 56, why)
        }
      }
      reset = mover.role === 'pawn' || !!victim
      revoke(mover, action.from)
      mover.square = square(action.to)
      consumesMove = true
    } else if (action.type === 'endTurn') {
      assert.equal(expected.turn.moveMade, true, why)
      expected.turn = { color: opposite, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      if (n === 29) expected.effects = expected.effects.filter(e => (e as { type: string }).type !== 'mystic-shield')
    } else if (action.type === 'playCard') {
      const owner: Color = n === 119 ? 'white' : actor
      const player = expected.players[owner]
      const card = player.hand.find(c => c.id === action.cardInstanceId)
      assert.ok(card, why)
      assert.equal(card.cardId, action.cardId, why)
      const metadata = CARD_CATALOG[card.cardId]!
      assert.ok(metadata.timing.includes(n === 119 ? 'afterOpponentMove' : expected.turn.phase), why)
      assert.equal(expected.turn.cardPlays[owner], 0, why)
      expected.turn.cardPlays[owner]++
      player.hand = player.hand.filter(c => c.id !== card.id)
      if (!metadata.continuing) player.discard.push(card)
      const drawn = player.deck.shift(); assert.ok(drawn, why); player.hand.push(drawn)
      const relocations = (cardMoves[n] ?? []).map(move => {
        const p = at(move.slice(0, 2)); assert.ok(p, why)
        return { p, from: move.slice(0, 2), to: square(move.slice(2)) }
      })
      for (const { p, from, to } of relocations) {
        if ([15, 52, 67, 79].includes(n)) assert.equal(p.owner, actor, why)
        if (n === 15) { assert.equal(p.role, 'pawn'); assert.ok(!at(to)); assert.equal(Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) * Math.abs(Number(from[1]) - Number(to[1])), 2) }
        if (n === 52) { assert.equal(p.role, 'rook'); assert.ok(reaches(p, to, expected.pieces, forbidden, false)) }
        if (n === 67 || n === 79) assert.equal(p.role, 'pawn', why)
        if (n === 91) assert.equal(p.role, 'pawn', why)
        if (n === 77) assert.equal(p.role, 'knight', why)
        if (n === 119) { assert.equal(p.id, 'black-bishop-c8'); assert.equal(at('g6'), undefined); assert.equal(input.history.at(-1)?.from, 'f5'); assert.equal(input.history.at(-1)?.to, 'h7') }
        if ([15, 52, 67, 77, 79, 91].includes(n)) revoke(p, from)
        p.square = to
      }
      if (n === 4) expected.effects.push({ type: 'crab', owner, card, pieceId: 'black-pawn-c7' })
      if (n === 26) expected.effects.push({ type: 'mystic-shield', owner, player: owner, pieceId: 'black-queen-d8' })
      if (n === 38) {
        byId('white-king-e1').royal = false; byId('white-pawn-b2').royal = true
        expected.effects.push({ type: 'coup', owner, card, princeId: 'white-king-e1', kingId: 'white-pawn-b2', princeRole: 'king' })
      }
      if (n === 55) { assert.equal(at('b6'), undefined); expected.effects.push({ type: 'forbidden-city', owner, card, square: 'b6' }) }
      if (n === 105) {
        const p = byId('black-pawn-e7')
        assert.equal(p.zone, 'captured'); assert.equal(p.capturedBy, 'white'); assert.equal(at('g7'), undefined)
        p.zone = 'board'; p.square = 'g7'; delete p.capturedBy
      }
      consumesMove = [15, 52, 67, 77, 79, 91, 105].includes(n)
      reset = [15, 67, 79, 91, 105].includes(n)
      if (consumesMove) expected.enPassant = []
    } else assert.fail(`unexpected action at ${why}`)
    if (consumesMove) {
      half = reset ? 0 : half + 1
      if (actor === 'black') full++
      fenTurn = opposite
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true
    }
    // The independent oracle carries every unaffected physical record, including captors.
    const result = applyAction(actual, action)
    assert.deepEqual(actual, input, `full structuredClone immutability: ${why}`)
    assert.ok(result.ok, why)
    actual = result.state
    assert.deepEqual(actual.pieces, expected.pieces, `complete physical state: ${why}`)
    assert.deepEqual(actual.players, expected.players, `physical card accounting: ${why}`)
    assert.deepEqual(actual.effects, expected.effects, `complete effects: ${why}`)
    assert.deepEqual(actual.turn, expected.turn, `turn and allowances: ${why}`)
    assert.deepEqual(actual.enPassant, expected.enPassant, `en passant: ${why}`)
    assert.equal(actual.orientation, 0, why)
    assert.equal(actual.outcome, null, why)
    assert.ok(!actual.pendingRescue && !actual.pendingAbduction && !actual.pendingDoomsayer && !actual.underElfHill?.length, why)
    for (const king of expected.pieces.filter(p => p.royal)) {
      assert.ok(king.square, why)
      // All reviewed cards leave both Kings safe, so none directly checkmates.
      // A Prince remains a normal adjacent attacker but is never the safety target.
      const attackers = expected.pieces.filter(p => p.zone === 'board' && p.owner !== king.owner)
      assert.equal(attackers.some(p => reaches(p, king.square!, expected.pieces, n >= 55, true)), false, `independent royal safety ${king.id}: ${why}`)
    }
    const board = Board.empty()
    for (const p of expected.pieces) if (p.zone === 'board') board.set(parseSquare(p.square!)!, { role: p.role, color: p.owner })
    // No reviewed double-step has an adjacent legal opposing en-passant captor; FEN uses '-'.
    assert.equal(actual.fen, `${makeBoardFen(board)} ${fenTurn === 'white' ? 'w' : 'b'} ${rights || '-'} - ${half} ${full}`, why)
    if (n === 35) {
      assert.equal(actual.plotsAllowances?.length, 1)
      assert.equal(actual.plotsAllowances[0]!.player, 'black')
      assert.equal(actual.plotsAllowances[0]!.remaining, 2)
      assert.deepEqual(actual.plotsAllowances[0]!.eligibleCards, ['black-deck-1-heresy'])
    } else assert.ok(!actual.plotsAllowances?.length, why)
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50)
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 15)
  assert.equal(actual.fen, trace.finalFen)
})

test('iteration 099 deterministic replay', () => {
  const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/099.json', import.meta.url), 'utf8'))
  assert.ok(replayTrace(trace))
})
