import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { Chess } from 'chessops/chess'
import { makeBoardFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { PieceState } from '../types.js'

// Independently reviewed in order against rules §§8–11, 13.11, 14.2 and
// the printed catalog timing. Each numbered entry describes one actual action.
const rationale = [
  '1. White Nb1-c3 jumps to empty c3; e1 remains screened by its pawns.',
  '2. After-move Treason swaps opposing Ra8/Ng8 identities without capture; both Kings remain screened, clocks unchanged; White discards it and draws Think Again.',
  '3. White finishes its move and card; Black begins with both allowances reset and unchanged board.',
  '4. Black d7-d6 is one empty forward square; pawn clock resets, fullmove becomes 2.',
  '5. Black ends; White receives unchanged d6 position and zero allowances.',
  '6. White Nc3-b1 returns by a knight jump to its vacant origin, leaving e1 safe.',
  '7. White ends; Black receives the unchanged board and clocks.',
  '8. Black h7-h5 crosses empty h6 to empty h5; h6 en-passant opportunity is recorded, no adjacent White capturer.',
  '9. Black ends; the h6 opportunity survives into the White turn.',
  '10. White f2-f3 advances to empty f3, resets clock and expires h6 opportunity; e1 remains safe.',
  '11. White ends; Black receives f3 board with no en-passant target.',
  '12. Black Rh8-h6 crosses vacated h7, ends above its h5 pawn; kingside castling right is lost.',
  '13. After-move Cowardice returns opposing original f-pawn f3-f2 to empty square; no capture or clock advance; Black discards and draws Crab.',
  '14. Black ends after its card; White begins with the returned f-pawn and reset allowances.',
  '15. White e2-e4 crosses empty e3; pawn clock zero, e3 opportunity created, King remains safe.',
  '16. White ends; Black receives the e3 opportunity and unchanged board.',
  '17. Black Nb8-a6 jumps to empty a6; neither royal is exposed and e3 opportunity expires.',
  '18. Black ends; White receives Na6 and unchanged clocks.',
  '19. White c2-c4 crosses clear c3; c3 opportunity created, no promotion or capture.',
  '20. White ends; c3 opportunity survives for Black only.',
  '21. Black Qd8-d7 slides one square vacated by d-pawn; c3 opportunity expires.',
  '22. Black ends; White receives Qd7 and unchanged board.',
  '23. White Nb1-a3 jumps to empty a3; queenside rook remains screened by a2 pawn.',
  '24. White ends; Black starts with both allowances clear.',
  '25. Black b7-b5 crosses empty b6; b6 opportunity created, White c4 can capture b5 normally but cannot capture en passant.',
  '26. Black ends; White receives b6 opportunity and unchanged clock zero.',
  '27. White f2-f4 crosses empty f3 after Cowardice returned it to starting rank; creates f3 opportunity and expires b6.',
  '28. White ends; f3 opportunity survives for Black.',
  '29. Black Qd7-h3 follows empty e6,f5,g4 to empty h3; Qh3 has no ray to Ke1, and g2 pawn blocks its southwest diagonal.',
  '30. Black ends; White receives Qh3, which is not aligned with Ke1, and its King remains safe.',
  '31. White Ng1-f3 jumps to empty f3; f1 bishop and g2 pawn still screen e1.',
  '32. White ends; Black starts with unchanged board and halfmove 2.',
  '33. Black g7-g5 crosses empty g6; g6 opportunity created, no White pawn on adjacent fifth-rank square.',
  '34. Black ends; White receives g6 opportunity.',
  '35. White Qd1-a4 traverses empty c2,b3; b5 black pawn blocks further diagonal and e1 is safe.',
  '36. White ends; Black receives Qa4 with g6 opportunity expired.',
  '37. Black h5-h4 advances to empty h4; does not capture, h3 Queen remains in place.',
  '38. Black ends; White receives the h4 pawn without any check obligation.',
  '39. White Qa4-c2 traverses empty b3 to empty c2; neither King is exposed.',
  '40. White ends; Black receives Qc2 and unchanged clocks.',
  '41. Black Ke8-d8 moves to empty unattacked d8; White Qc2 has no line there; remaining Black castling right is lost.',
  '42. Black ends; White starts against Kd8 with Black castling rights absent.',
  '43. White c4xb5 diagonally captures original Black b7 pawn; victim is captured, not dead; pawn clock resets.',
  '44. White ends; capture remains and Black begins with zero allowances.',
  '45. Black Bf8-g7 moves one diagonal square vacated by the g-pawn; no check reaches d8.',
  '46. Black ends; White receives Bg7 and captured b-pawn unchanged.',
  '47. White Qc2-c6 traverses clear c3,c4,c5; Qc6 does not attack Kd8, and e1 remains safe.',
  '48. White ends; Black may act normally with Queen c6 threatening other pieces.',
  '49. Black Rh6-h5 slides one empty square; h4 friendly pawn blocks farther travel, d8 safe.',
  '50. Black ends; White receives Rh5 and halfmove 3.',
  '51. White g2-g3 advances empty; Qh3 has no ray to Ke1, while White Bf1 now blocks its southwest diagonal through g2.',
  '52. White ends; Black receives g3 pawn and reset clock.',
  '53. Black g5xf4 captures White original f-pawn on forward diagonal; captured zone and clock zero, Kd8 safe.',
  '54. Black ends; White receives f4 Black pawn and its f-pawn captured.',
  '55. White Qc6-c4 crosses empty c5; no capture and no line exposed toward e1.',
  '56. White ends; Black receives Qc4 and halfmove 1.',
  '57. Black Bg7-f6 moves to empty diagonal square; Kd8 remains outside White attacks.',
  '58. Black ends; White receives Bf6 and unchanged clocks.',
  '59. White Nf3-g1 jumps to empty g1; Qh3 has no ray to Ke1, and Bf1 blocks its southwest diagonal through g2.',
  '60. White ends; the last opponent movement available to Doppelganger is this Knight move.',
  '61. Black Doppelganger replaces its move: original Bishop f6-h7 copies that Knight L-jump to empty h7 without transforming or capturing; halfmove 4/fullmove 16; discard and draw Evangelists.',
  '62. Black ends its replacement move, granting White a normal turn with no lingering Knight ability.',
  '63. White g3-g4 moves forward into empty g4 beside opposing h4 pawn; no en-passant opportunity from a single step.',
  '64. White ends; Black receives g4 without an en-passant capture.',
  '65. Black Bh7-f5 resumes Bishop geometry through empty g6, confirming Doppelganger was temporary.',
  '66. Black ends; White receives Bf5, which is capturable by e4 pawn.',
  '67. White d2-d3 advances empty; e1 remains safe and the c1 Bishop diagonal opens.',
  '68. White ends; Black receives d3 and reset halfmove.',
  '69. Black f4-f3 advances empty after the Knight departed; f3 pawn attacks e2/g2, not e1.',
  '70. Black ends; White begins safely with f3 pawn threatening e2.',
  '71. White Bf1-e2 moves to empty e2 even though Black f3 pawn attacks it; the nonroyal Bishop may be en prise, e1 is safe.',
  '72. White ends; Black receives Be2 without automatic capture.',
  '73. Black Bc8-d7 moves to vacant d7; White Qc4 is not aligned with Kd8, and Black remains safe.',
  '74. Black ends; White receives Bd7 and halfmove 2.',
  '75. White e4xf5 captures the original Black f8 Bishop, including the earlier Doppelganger actor; identity goes to captured zone and clock resets.',
  '76. White ends; Black receives the captured Bishop and White pawn f5.',
  '77. Black Rg8-g5 follows clear g7,g6; this is the original a8 Rook moved by Treason, no capture.',
  '78. Black ends; White receives Rg5 adjacent to Rh5.',
  '79. White Qc4-c2 traverses empty c3; no capture and e1 remains safe.',
  '80. White ends; Black receives Qc2 and unchanged halfmove 2.',
  '81. Black c7-c5 crosses clear c6; White pawn b5 can legally capture en passant onto c6, so FEN and opportunity both include c6.',
  '82. Black ends; White retains the c6 en-passant option for its move.',
  '83. White Be2-d1 moves diagonal to empty d1 instead of en passant; c6 opportunity expires.',
  '84. White ends; Black receives Bd1 without a stale en-passant right.',
  '85. Black f7-f6 advances to empty f6 vacated by Doppelganger; King d8 safe and clock resets.',
  '86. Black ends; White receives f6 and no transient effects.',
  '87. White Bd1-e2 returns one diagonal square; being attacked by f3 pawn is legal for this nonroyal Bishop.',
  '88. White ends; Black receives Be2 and halfmove 1.',
  '89. Black Bd7-c8 returns to empty c8; d8 King remains safe.',
  '90. Black ends; White receives Bc8 and unchanged clocks.',
  '91. White Bc1xg5 crosses clear d2,e3,f4 and captures original Black a8 Rook at g5; f6 Black pawn blocks further ray.',
  '92. White ends; Black receives captured a8 Rook, White Bg5, and reset clock.',
  '93. Black Rh5-h6 slides one empty square; White Bg5 attacks h6 but a nonroyal Rook may move en prise.',
  '94. Black ends; White receives Rh6 with both Kings safe.',
  '95. White Qc2-b3 moves one diagonal square to empty b3; its line through c4,d5,e6,f7 does not attack d8.',
  '96. White ends; Black receives Qb3 and halfmove 2.',
  '97. Black Kd8-c7 moves one diagonal to empty c7; b5 pawn attacks a6/c6, Bg5 blocked by f6, and Qb3 has no ray to c7.',
  '98. After-move Figure Dance simultaneously sends White Ra1-h1, White Rh1-h8, Black Na8-a1; h8 was empty; no captures/promotion, White rook rights revoked, clocks unchanged; discard and draw Rebirth.',
  '99. Black ends; White receives all three relocated identities, no corner captures, and zero castling rights.',
  '100. White Qb3-d1 traverses empty c2 to empty d1; e1 safe, no capture.',
  '101. White ends; Black receives Qd1 and halfmove 4.',
  '102. Black e7-e6 advances empty; King c7 remains safe behind its d6 pawn, clock resets/fullmove 26.',
  '103. Black ends; White receives e6 and no en-passant option.',
  '104. White b2-b4 crosses empty b3 to empty b4 below its b5 pawn; b3 opportunity recorded but Black c5 is on wrong rank to capture it.',
  '105. White ends the fiftieth regular move; Black begins with b3 opportunity retained, all cards/effects unchanged, halfmove 0/fullmove 26.',
]

test('iteration 073 independent semantic review', () => {
  const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/073.json', import.meta.url), 'utf8'))
  assert.equal(trace.seed, 860073)
  assert.equal(rationale.length, trace.steps.length)
  assert.equal(trace.steps.length, 105)
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 4)
  let state = createGameState(trace.initial)
  for (const [index, { action }] of trace.steps.entries()) {
    const reason = rationale[index]!
    assert.ok(reason.startsWith(`${index + 1}.`))
    const before = state
    const result = applyAction(before, action)
    assert.ok(result.ok, reason)
    state = result.state
    assert.deepEqual(state.effects, [], reason)
    assert.equal(state.orientation, 0, reason)
    assert.ok(!state.pendingRescue && !state.outcome, reason)
    const expected = before.pieces.map(piece => ({ ...piece }))
    const relocate = (from: string, to: string) => {
      const source = before.pieces.find(piece => piece.square === from && piece.zone === 'board')!
      assert.ok(source, reason)
      expected.find(piece => piece.id === source.id)!.square = to as PieceState['square']
    }
    const oldFen = parseFen(before.fen).unwrap()
    const newFen = parseFen(state.fen).unwrap()
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const source = before.pieces.find(piece => piece.square === action.from && piece.zone === 'board')!
      const victim = expected.find(piece => piece.square === action.to && piece.zone === 'board')
      const chess = Chess.fromSetup(oldFen).unwrap()
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! }
      assert.ok(chess.isLegal(move), reason)
      chess.play(move)
      assert.equal(makeBoardFen(chess.board), makeBoardFen(newFen.board), reason)
      assert.equal(newFen.halfmoves, source.role === 'pawn' || victim ? 0 : oldFen.halfmoves + 1, reason)
      assert.equal(newFen.fullmoves, oldFen.fullmoves + Number(before.turn.color === 'black'), reason)
      assert.equal(state.turn.color, before.turn.color, reason)
      assert.equal(state.turn.phase, 'afterMove', reason)
      assert.equal(state.turn.moveMade, true, reason)
      if (victim) { victim.zone = 'captured'; victim.square = null }
      relocate(action.from, action.to)
      const two = source.role === 'pawn' && Math.abs(Number(action.to[1]) - Number(action.from[1])) === 2
      assert.deepEqual(state.enPassant, two ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`, pawnId: source.id }] : [], reason)
      assert.deepEqual(state.players, before.players, reason)
    } else if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true, reason)
      assert.equal(state.fen, before.fen, reason)
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }, reason)
      assert.deepEqual(state.players, before.players, reason)
      assert.deepEqual(state.enPassant, before.enPassant, reason)
    } else {
      assert.equal(action.type, 'playCard', reason)
      if (action.type !== 'playCard') throw new Error(reason)
      const player = before.turn.color
      const other = player === 'white' ? 'black' : 'white'
      const spent = before.players[player].hand.find(card => card.id === action.cardInstanceId)!
      assert.equal(before.turn.cardPlays[player], 0, reason)
      assert.equal(state.turn.cardPlays[player], 1, reason)
      assert.deepEqual(state.players[other], before.players[other], reason)
      assert.deepEqual(state.players[player].hand, [...before.players[player].hand.filter(card => card.id !== spent.id), before.players[player].deck[0]], reason)
      assert.deepEqual(state.players[player].deck, before.players[player].deck.slice(1), reason)
      assert.deepEqual(state.players[player].discard, [...before.players[player].discard, spent], reason)
      if (action.cardId === 'treason') {
        assert.equal(before.turn.phase, 'afterMove', reason)
        assert.deepEqual(action.target, { rook: 'a8', knight: 'g8' })
        relocate('a8', 'g8'); relocate('g8', 'a8')
      } else if (action.cardId === 'cowardice') {
        assert.equal(before.turn.phase, 'afterMove', reason)
        assert.deepEqual(action.target, [{ from: 'f3', to: 'f2' }])
        assert.ok(!before.pieces.some(piece => piece.square === 'f2'))
        relocate('f3', 'f2')
      } else if (action.cardId === 'doppelganger') {
        assert.equal(before.turn.phase, 'beforeMove', reason)
        assert.deepEqual(trace.steps[index - 2]!.action, { type: 'move', from: 'f3', to: 'g1' })
        assert.deepEqual(action.target, [{ from: 'f6', to: 'h7' }])
        assert.equal(before.pieces.find(piece => piece.square === 'f6')!.role, 'bishop')
        assert.ok(!before.pieces.some(piece => piece.square === 'h7'))
        relocate('f6', 'h7')
        assert.equal(newFen.halfmoves, oldFen.halfmoves + 1)
        assert.equal(newFen.fullmoves, oldFen.fullmoves + 1)
        assert.equal(state.turn.moveMade, true)
        assert.equal(state.turn.phase, 'afterMove')
      } else {
        assert.equal(action.cardId, 'figure-dance', reason)
        assert.deepEqual(action.target, [])
        assert.equal(before.turn.phase, 'afterMove')
        relocate('a1', 'h1'); relocate('h1', 'h8'); relocate('a8', 'a1')
        assert.equal(newFen.castlingRights.size(), 0)
      }
      if (action.cardId !== 'doppelganger') {
        assert.equal(newFen.halfmoves, oldFen.halfmoves, reason)
        assert.equal(newFen.fullmoves, oldFen.fullmoves, reason)
        assert.equal(newFen.turn, oldFen.turn, reason)
      }
      assert.deepEqual(state.enPassant, [], reason)
      const setup = parseFen(state.fen).unwrap()
      setup.turn = player
      assert.equal(Chess.fromSetup(setup).unwrap().isCheck(), false, reason)
      setup.turn = other
      assert.equal(Chess.fromSetup(setup).unwrap().isCheck(), false, reason)
    }
    assert.deepEqual(state.pieces, expected, reason)
  }
  assert.deepEqual(state, replayTrace(trace))
  assert.equal(state.fen, '2b4R/p1k5/n2ppp1r/1Pp2PB1/1P4Pp/N2P1p1q/P3B2P/n2QK1NR b - - 0 26')
})
