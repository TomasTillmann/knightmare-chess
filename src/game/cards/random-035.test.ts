import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { Chess } from 'chessops/chess'
import { makeFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { createGameState } from '../state.js'
import { applyAction } from '../reducer.js'

// Sequential review against rules §§8–13, 15.2, 20–21 and printed catalog timing.
const rationales = [
  '1. Ng1-f3 jumps to an empty square; both Kings remain screened.',
  '2. White ends its completed move; only turn allowances reset.',
  '3. f7-f5 crosses empty f6; Pawn clock resets and f6 en passant opens.',
  '4. Black ends; the f6 opportunity survives for White.',
  '5. Lost Castle replaces the move: a1/h8 Rooks swap identities, remove Q/k castling rights, expire en passant; b1/g8 block attacks on Kings.',
  '6. White ends the replacement move; Black receives fresh allowances.',
  '7. d7-d6 is one empty forward square; Black King stays shielded.',
  '8. Black ends without further board or hand changes.',
  '9. d2-d3 is one empty forward square; c1 still screens the enemy Rook.',
  '10. White ends; Black acts next.',
  '11. Onslaught moves a7-a6, e7-e6, f5-f4 simultaneously into initially empty squares; no capture, promotion or en passant, one replacement move.',
  '12. Black ends Onslaught; White gets its ordinary move.',
  '13. d3-d4 advances into empty d4 without exposing the King.',
  '14. White ends with the new d4 Pawn retained.',
  '15. Ra1xb1 captures White original b1 Knight; c1 Bishop blocks the Rook from the King.',
  '16. Black ends after the capture; the Knight remains captured.',
  '17. Qd1-d2 moves one square into the vacated Pawn square; c1 screens the King.',
  '18. White ends after Qd2; no card spent.',
  '19. d6-d5 advances one square and stops before White d4 Pawn.',
  '20. Black ends with both d-file Pawns retained.',
  '21. e2-e4 crosses empty e3; f4 Pawn can capture en passant on e3.',
  '22. White ends; e3 en passant is available to Black.',
  '23. Bf8-c5 crosses empty e7/d6; choosing this move expires e3 en passant.',
  '24. Black ends with Bishop c5; no check on White King.',
  '25. Qd2-a5 crosses empty c3/b4; c7 blocks its diagonal toward e8.',
  '26. White ends without altering Qa5.',
  '27. Ke8-f8 moves one square; g8 Knight blocks Rh8, and all Black castling rights expire.',
  '28. Black ends after safe Kf8.',
  '29. Qa5-d2 retraces empty b4/c3; White King remains safe.',
  '30. White ends with Qd2.',
  '31. Kf8-f7 enters an unattacked square; Queen d2 does not attack f7.',
  '32. Black ends after Kf7.',
  '33. Ke1-d1 enters an empty square screened from Rb1 by Bc1; final White castling right expires.',
  '34. White ends after Kd1.',
  '35. Bc5-b4 is one diagonal step; Qd2 blocks the diagonal beyond c3.',
  '36. Black ends with Bb4.',
  '37. h2-h4 crosses empty h3; opens h3 opportunity without adjacent enemy Pawn.',
  '38. White ends retaining the h3 opportunity.',
  '39. Rb1-a1 moves one empty orthogonal square and expires h3 en passant.',
  '40. Black ends; Bc1 still screens White King.',
  '41. Rh8xh7 captures the original h7 Pawn; g7 Pawn blocks the line to Kf7.',
  '42. White ends with h7 Pawn captured.',
  '43. c7-c5 crosses now-empty c6 and c5; creates c6 en passant opportunity.',
  '44. Black ends preserving c6 opportunity.',
  '45. Rh7-h6 is one empty step; this consumes the c6 opportunity.',
  '46. White ends with Rh6.',
  '47. Qd8-d7 enters the square vacated by d7 Pawn; no King line opens.',
  '48. Black ends with Qd7.',
  '49. Qd2xf4 crosses empty e3, captures original f7 Pawn, and checks Kf7 along empty f5/f6.',
  '50. White ends with legal check; Black gets its response turn.',
  '51. Ng8-f6 jumps into the Queen check line and screens Kf7.',
  '52. Black ends after curing check.',
  '53. b2-b3 advances one empty square; White King remains screened by Bc1.',
  '54. White ends after b3.',
  '55. Qd7-d6 is one empty orthogonal step; Nf6 still blocks Qf4 check.',
  '56. Black ends with Qd6.',
  '57. Qf4xd6 crosses empty e5 and captures the Black Queen; e6 Pawn blocks the rank toward f6.',
  '58. White ends after capturing the Queen.',
  '59. Doppelganger copies the just-moved Queen: Black Bishop b4-b5 moves orthogonally without capture, retains Bishop identity, and consumes the move.',
  '60. Black ends the replacement move; copied powers do not persist.',
  '61. Bf1-c4 crosses empty e2/d3; d5 Pawn blocks its diagonal toward Kf7.',
  '62. White ends after Bc4.',
  '63. Kf7-g8 enters an unattacked square; Qd6 is blocked by e6 and Rh6 attacks another rank.',
  '64. Black ends with Kg8.',
  '65. Qd6xc5 captures original c7 Pawn by a one-square diagonal.',
  '66. White ends with c7 Pawn captured.',
  '67. Nf6xe4 jumps onto White e2 Pawn and captures it; neither King is exposed.',
  '68. Black ends with Ne4.',
  '69. Rh6-f6 crosses empty g6; Black e6 Pawn blocks further travel.',
  '70. White ends after Rf6.',
  '71. b7-b6 advances into an empty square; no new en passant right.',
  '72. Black ends after b6.',
  '73. Rh1-h3 crosses empty h2; h4 Pawn prevents further travel.',
  '74. Cathedral after the move swaps own Rf6/Bc4 with identity preserved; g7 Pawn blocks Bishop f6 from Kg8; clocks do not advance again.',
  '75. White ends after one regular move and one Cathedral.',
  '76. Passing in the Night simultaneously swaps e6/f2 and g7/d4 Pawns; ownership unchanged, no capture or promotion, one replacement move and Pawn clock reset.',
  '77. Black ends the simultaneous swap; no en passant is created.',
  '78. Qc5xd5 captures original d7 Pawn; Black g8 King is not on the Queen line.',
  '79. White ends with d7 Pawn captured and available for later return.',
  '80. Bb5-e8 uses restored Bishop geometry through empty c6/d7.',
  '81. Black ends with Be8.',
  '82. Nf3-g5 jumps to empty g5; d1 King remains safe.',
  '83. White ends with Ng5.',
  '84. Be8-h5 crosses empty f7/g6; arrival does not check d1 because its diagonal meets g4/f3/e2.',
  '85. Black ends with Bh5.',
  '86. g2-g4 crosses empty g3; creates g3 opportunity, with no enemy Pawn on f4/h4.',
  '87. White ends preserving g3 opportunity.',
  '88. Ra8-a7 moves into empty a7 and expires g3 opportunity.',
  '89. Black ends with Ra7.',
  '90. Qd5xe4 captures original g8 Knight by one diagonal square.',
  '91. White ends after the Knight capture.',
  '92. Bh5-e8 retraces empty g6/f7 and retains Bishop identity.',
  '93. Black ends with Be8.',
  '94. Rc4xd4 captures original g7 Pawn, displaced there by Passing in the Night.',
  '95. White ends after d4 capture.',
  '96. Betrayal before the move replaces White original f2 Pawn on Black half e6 with captured Black original d7 Pawn; victim becomes dead, clocks and move availability unchanged.',
  '97. Original e7 Pawn f2-f1 promotes to Rook on a regular move, checking Kd1 through empty e1; no capture.',
  '98. Black ends with legal Rook check and the promoted physical Pawn retained.',
  '99. Kd1-d2 escapes the rank-one Rook check; d2 is unattacked by both Bishops and remaining Pawns.',
  '100. White ends after curing check on d2.',
  '101. Ra7-f7 crosses empty b7/c7/d7/e7; White g7 Pawn stops the line toward Kg8.',
  '102. Black ends after Rf7.',
  '103. Qe4-g2 crosses empty f3 without capture; White Kd2 stays safe.',
  '104. Black Bog reacts to the two-square Queen move: stop on first square f3, vacate g2, preserve original move clocks; neither King becomes checked.',
  '105. White ends; Black reaction allowance resets for the next turn.',
  '106. Ra1-b1 moves into empty b1; Bc1 stops the Rook, and Kd2 remains safe.',
  '107. Black ends with Rb1.',
  '108. Qf3-f5 crosses empty f4; own Bishop f6 blocks its file before Rf7.',
  '109. White ends with Qf5.',
  '110. Rf7-f8 moves one empty square; neither King is attacked.',
  '111. Black ends move 50; White begins with no pending obligation or effect.',
]

test('iteration 035 deterministic trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/035.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860035)
  assert.equal(rationales.length, trace.steps.length)
  assert.equal(trace.steps.length, 111)
  const final = replayTrace(trace)
  let state = createGameState(trace.initial)
  let cards = 0
  for (const [index, { action }] of trace.steps.entries()) {
    const label = rationales[index]!
    assert.ok(label.startsWith(`${index + 1}. `))
    const before = state
    const result = applyAction(before, action)
    assert.ok(result.ok, label)
    state = result.state
    assert.deepEqual(state.effects, [], label)
    assert.ok(!state.pendingRescue && !state.pendingAbduction && !state.pendingDoomsayer, label)
    const ep = [
      { steps: [3, 4], target: 'f6', pawnId: 'black-pawn-f7' },
      { steps: [21, 22], target: 'e3', pawnId: 'white-pawn-e2' },
      { steps: [37, 38], target: 'h3', pawnId: 'white-pawn-h2' },
      { steps: [43, 44], target: 'c6', pawnId: 'black-pawn-c7' },
      { steps: [86, 87], target: 'g3', pawnId: 'white-pawn-g2' },
    ].find(item => item.steps.includes(index + 1))
    assert.deepEqual(state.enPassant, ep ? [{ target: ep.target, pawnId: ep.pawnId }] : [], label)
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const position = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap()
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)!,
        ...(action.promotion ? { promotion: 'rook' as const } : {}) }
      assert.ok(position.isLegal(move), label)
      position.play(move)
      assert.equal(state.fen, makeFen(position.toSetup()), label)
      const mover = before.pieces.find(p => p.square === action.from)!
      assert.equal(state.pieces.find(p => p.id === mover.id)!.square, action.to, label)
      const victim = before.pieces.find(p => p.square === action.to)
      if (victim) assert.equal(state.pieces.find(p => p.id === victim.id)!.zone, 'captured', label)
      assert.deepEqual(state.players, before.players, label)
    } else if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen, label)
      assert.deepEqual(state.pieces, before.pieces, label)
      assert.deepEqual(state.players, before.players, label)
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white', label)
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 }, label)
      assert.equal(state.turn.moveMade, false, label)
    } else if (action.type === 'playCard') {
      cards++
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black'
      const opponent = owner === 'white' ? 'black' : 'white'
      const player = before.players[owner]
      assert.equal(before.turn.cardPlays[owner], 0, label)
      assert.deepEqual(state.players[owner].hand, [...player.hand.filter(c => c.id !== action.cardInstanceId), player.deck[0]], label)
      assert.deepEqual(state.players[owner].deck, player.deck.slice(1), label)
      assert.deepEqual(state.players[owner].discard, [...player.discard, player.hand.find(c => c.id === action.cardInstanceId)], label)
      assert.deepEqual(state.players[opponent], before.players[opponent], label)
      assert.equal(state.turn.cardPlays[owner], 1, label)
      const changed = state.pieces.filter((p, i) => JSON.stringify(p) !== JSON.stringify(before.pieces[i]))
        .map(p => [p.id, p.square, p.zone, p.role])
      const expected: Record<number, unknown[]> = {
        5: [['white-rook-a1', 'h8', 'board', 'rook'], ['black-rook-h8', 'a1', 'board', 'rook']],
        11: [['black-pawn-a7', 'a6', 'board', 'pawn'], ['black-pawn-e7', 'e6', 'board', 'pawn'], ['black-pawn-f7', 'f4', 'board', 'pawn']],
        59: [['black-bishop-f8', 'b5', 'board', 'bishop']],
        74: [['white-rook-a1', 'c4', 'board', 'rook'], ['white-bishop-f1', 'f6', 'board', 'bishop']],
        76: [['white-pawn-d2', 'g7', 'board', 'pawn'], ['white-pawn-f2', 'e6', 'board', 'pawn'], ['black-pawn-e7', 'f2', 'board', 'pawn'], ['black-pawn-g7', 'd4', 'board', 'pawn']],
        96: [['white-pawn-f2', null, 'dead', 'pawn'], ['black-pawn-d7', 'e6', 'board', 'pawn']],
        104: [['white-queen-d1', 'f3', 'board', 'queen']],
      }
      assert.deepEqual(changed, expected[index + 1], label)
      for (const piece of state.pieces) {
        const previous = before.pieces.find(p => p.id === piece.id)!
        assert.deepEqual([piece.owner, piece.originalRole, piece.royal, piece.neutral, piece.promoted],
          [previous.owner, previous.originalRole, previous.royal, previous.neutral, previous.promoted], label)
      }
      assert.equal(state.turn.moveMade, index + 1 !== 96, label)
      if ([74, 96, 104].includes(index + 1)) assert.deepEqual(state.fen.split(' ').slice(1), before.fen.split(' ').slice(1), label)
      const replacementClocks: Record<number, string> = { 5: 'b Kq - 1 2', 11: 'w Kq - 0 4', 59: 'w - - 1 16', 76: 'w - - 0 20' }
      if (replacementClocks[index + 1]) assert.equal(state.fen.split(' ').slice(1).join(' '), replacementClocks[index + 1], label)
      const position = Chess.fromSetup(parseFen(state.fen).unwrap()).unwrap()
      position.turn = before.turn.color
      assert.equal(position.isCheck(), false, label)
      position.turn = opponent
      assert.equal(position.isCheckmate(), false, label)
    } else assert.fail(`Unreviewed action: ${label}`)
  }
  assert.equal(cards, 7)
  assert.equal(final.fen, '1nb1brk1/6P1/pp2pB2/5QN1/3R2PP/1P5R/P1PK4/1rB2r2 w - - 6 28')
  assert.deepEqual(final.pieces.filter(p => p.promoted).map(p => [p.id, p.role, p.square]), [['black-pawn-e7', 'rook', 'f1']])
  assert.deepEqual(final.pieces.filter(p => p.zone === 'dead').map(p => p.id), ['white-pawn-f2'])
})
