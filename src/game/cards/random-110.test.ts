import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Chess } from 'chessops/chess'
import { makeFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameState, SquareName } from '../types.js'
import { replayTrace, type RandomTrace } from './random-campaign.js'

// Manually reviewed in order against rules §§8–11, 14.4, 16.3, 17.1,
// 19.2, 22.2, 22.6–7 and the printed catalog timings in cards/catalog.ts.
const review = [
  '1. Ng1-h3 jumps to an empty square; no capture or exposed King.',
  '2. White ends its completed move; Black receives fresh allowances.',
  '3. Pc7-c6 advances one empty square and resets the pawn clock.',
  '4. Black ends; White receives its move.',
  '5. Nb1-c3 jumps to an empty square.',
  '6. After moving, White places the continuing d4/e5 diagonal boundary; retain Fortification and draw Legacy.',
  '7. White ends; the physical wall persists.',
  '8. Pd7-d5 crosses empty d6; d6 en passant opportunity is created.',
  '9. Black ends without expiring the opportunity before White can use it.',
  '10. Nc3-e4 jumps; no wall crossing restriction applies; d6 en passant expires.',
  '11. Mystic Shield protects exactly the just-moved Nb1 identity at e4 for Black next turn; discard and draw Think Again.',
  '12. White ends; shield remains during Black turn.',
  '13. Ph7-h5 crosses empty h6 and creates h6 en passant; no protected capture.',
  '14. Black ends, expiring White shield; h6 en passant remains.',
  '15. Nh3-g1 returns by an empty Knight jump; h6 en passant expires.',
  '16. White ends with the wall alone active.',
  '17. Bc8-e6 slides through empty d7.',
  '18. Black ends its legal Bishop move.',
  '19. Pd2-d3 advances one empty square.',
  '20. After moving, White abducts opposing nonroyal Nb8: away, not captured; spend and draw Bombard.',
  '21. Reveal changes concealment to the ten-second recall window, preserving all pieces and clocks.',
  '22. Timeout captures the abducted Nb8 for White; no royal line is exposed and the pawn clock is already zero.',
  '23. White ends only after the recall challenge resolves.',
  '24. Qd8-d6 slides through empty d7.',
  '25. Black ends its Queen move.',
  '26. Ph2-h4 crosses empty h3 and creates h3 en passant.',
  '27. White ends, preserving h3 opportunity.',
  '28. Be6-f5 moves one empty diagonal step and clears en passant.',
  '29. Black ends its Bishop move.',
  '30. Ne4-g3 jumps to an empty square.',
  '31. White ends its Knight move.',
  '32. Bf5-d7 passes empty e6; this is not the d4/e5 boundary.',
  '33. Black ends its Bishop move.',
  '34. Pa2-a3 advances one empty square.',
  '35. White ends its Pawn move.',
  '36. Bd7-e6 moves one empty diagonal step.',
  '37. Black ends its Bishop move.',
  '38. Bc1-e3 passes empty d2.',
  '39. White ends its Bishop move.',
  '40. Qd6-d8 slides through empty d7.',
  '41. Black ends its Queen move.',
  '42. Be3-c1 returns through empty d2.',
  '43. White ends its Bishop move.',
  '44. Qd8-d6 returns through empty d7.',
  '45. Black ends its Queen move.',
  '46. Rh1-h3 passes empty h2, permanently revoking White kingside castling.',
  '47. White ends; the lost castling right remains lost.',
  '48. Be6-g4 passes empty f5.',
  '49. Black ends its Bishop move.',
  '50. Ra1-b1 enters an empty square, revoking White queenside castling.',
  '51. White ends with neither castling right.',
  '52. Bg4-f5 moves one empty diagonal step.',
  '53. Black ends its Bishop move.',
  '54. Bc1-g5 traverses empty d2/e3/f4; no wall boundary occurs on this ray.',
  '55. White ends its Bishop move.',
  '56. Rh8-h6 passes empty h7 and revokes Black kingside castling.',
  '57. White Think Again immediately restores Rh8, clocks and Black kingside rights; Black must choose a different move, White draws Haunting Memories.',
  '58. Ra8-d8 passes empty b8/c8; a genuinely different replacement loses only Black queenside castling.',
  '59. Black ends, clearing the replacement prohibition and both allowances.',
  '60. Pe2-e3 advances one empty square.',
  '61. White ends its Pawn move.',
  '62. Rh8-h6 is allowed on this later turn through h7; Black kingside rights are lost again.',
  '63. Black Mystic Shield selects the just-moved Rh8 identity at h6; discard and draw Disintegration.',
  '64. Black ends; shield remains throughout White next turn.',
  '65. Pa3-a4 advances one empty square and does not capture the shielded Rook.',
  '66. White ends; Black shield expires.',
  '67. Rh6-f6 passes empty g6.',
  '68. Black ends its Rook move.',
  '69. Qd1-e2 moves one empty diagonal step.',
  '70. White ends its Queen move.',
  '71. Black Irresistible Force moves Pf7-f6, pushing Rf6-f5 and Bf5-f4 into empty f4; no King, capture, or wall crossing; consumes move and draws Riposte.',
  '72. Black ends its replacement move.',
  '73. Bg5-h6 moves one empty diagonal step.',
  '74. White ends its Bishop move.',
  '75. Pa7-a6 advances one empty square.',
  '76. Black ends its Pawn move.',
  '77. Pd3-d4 advances to the wall endpoint without crossing the d4/e5 boundary.',
  '78. White ends its Pawn move.',
  '79. Ke8-f7 moves one diagonal step onto an unattacked square; royal identity is preserved.',
  '80. Black ends with its King safe at f7.',
  '81. Pc2-c4 crosses empty c3 and creates c3 en passant.',
  '82. White ends, preserving the c3 opportunity.',
  '83. Black Breakthrough captures White Ph4 by moving Ph5-h4 straight forward; capture belongs to Black, consumes the move, clears en passant, draws Ghostwalk.',
  '84. Black ends the capture replacement move.',
  '85. Rb1-c1 moves horizontally to an empty square.',
  '86. White ends its Rook move.',
  '87. Ph4xg3 captures White Nb1 identity for Black diagonally; pawn/capture clock resets.',
  '88. Black ends; captured Knight remains off board.',
  '89. Qe2-f3 moves one empty diagonal step.',
  '90. White ends its Queen move.',
  '91. Pd5xc4 captures White Pc2 identity for Black, moving diagonally away from the wall.',
  '92. Black ends; captured Pawn remains off board.',
  '93. Pa4-a5 advances to an empty square.',
  '94. White ends its Pawn move.',
  '95. Pb7-b6 advances one empty square.',
  '96. Black ends its Pawn move.',
  '97. Qf3-d1 passes empty e2.',
  '98. White Peace Talks after moving cancels its physical Fortification; both cards enter White discard and Truce is drawn, with no board or clock change.',
  '99. White ends; no continuing effects remain.',
  '100. Bf4-e5 moves one empty diagonal step.',
  '101. Black ends its Bishop move.',
  '102. Pd4-d5 advances one empty square.',
  '103. White ends its Pawn move.',
  '104. Black Ghostwalk moves Qd6-c7 to an empty adjacent diagonal square; consumes the move without capture, draws Evangelists.',
  '105. Black ends its Ghostwalk move.',
  '106. Rc1-b1 moves horizontally to an empty square.',
  '107. White ends its Rook move.',
  '108. Pg7-g5 passes empty g6 and creates g6 en passant.',
  '109. Black ends, preserving g6 opportunity.',
  '110. Haunting Memories copies last card Ghostwalk: Qd1-b3 passes empty c2, lands empty, consumes White move, clears en passant, draws Cathedral.',
  '111. White ends its copied Ghostwalk move.',
  '112. Rd8-e8 moves horizontally to an empty square.',
  '113. Black ends its Rook move.',
  '114. Bh6-g7 moves one empty diagonal step; both Kings remain safe.',
  '115. White ends after the fiftieth regular move command; Black receives the next turn.',
]

test('iteration 110 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/110.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(review.length, trace.steps.length)
  let state = createGameState(trace.initial)
  let rollback: GameState | undefined
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1
    const label = review[index]!
    assert.ok(label.startsWith(`${n}. `))
    const input = structuredClone(state)
    const expected = structuredClone(state)
    const actor = state.turn.color
    const other: Color = actor === 'white' ? 'black' : 'white'
    const relocate = (id: string, square: SquareName | null, zone: 'board' | 'away' | 'captured' = 'board', captor?: Color) => {
      const piece = expected.pieces.find(p => p.id === id)!
      piece.square = square
      piece.zone = zone
      if (captor) piece.capturedBy = captor
      else delete piece.capturedBy
    }
    const replacementFen = (pawn: boolean) => {
      const setup = parseFen(state.fen).unwrap()
      setup.board.clear()
      for (const piece of expected.pieces) if (piece.square) setup.board.set(parseSquare(piece.square)!, { color: piece.owner, role: piece.role })
      setup.turn = other
      setup.epSquare = undefined
      setup.halfmoves = pawn ? 0 : setup.halfmoves + 1
      setup.fullmoves += actor === 'black' ? 1 : 0
      expected.fen = makeFen(setup)
      expected.enPassant = []
      expected.turn.phase = 'afterMove'
      expected.turn.moveMade = true
    }
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const piece = state.pieces.find(p => p.square === action.from)!
      const victim = state.pieces.find(p => p.square === action.to)
      const chess = Chess.fromSetup(parseFen(state.fen).unwrap()).unwrap()
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! }
      assert.ok(chess.isLegal(move), `${label}: independent ordinary geometry and safety`)
      if (n === 56) rollback = structuredClone(state)
      if (victim) {
        assert.ok(!state.effects.some(e => (e as { type?: string; pieceId?: string }).type === 'mystic-shield' && (e as { pieceId?: string }).pieceId === victim.id))
        relocate(victim.id, null, 'captured', actor)
      }
      relocate(piece.id, action.to as SquareName)
      // Fortification is a boundary between consecutive squares, not a forbidden endpoint.
      if (n >= 6 && n < 98 && piece.role !== 'knight') {
        const dx = Math.sign(action.to.charCodeAt(0) - action.from.charCodeAt(0))
        const dy = Math.sign(Number(action.to[1]) - Number(action.from[1]))
        let previous = action.from
        while (previous !== action.to) {
          const next: string = String.fromCharCode(previous.charCodeAt(0) + dx) + (Number(previous[1]) + dy)
          assert.notEqual([previous, next].sort().join('/'), 'd4/e5', label)
          previous = next
        }
      }
      chess.play(move)
      expected.fen = makeFen(chess.toSetup())
      expected.enPassant = piece.role === 'pawn' && Math.abs(Number(action.to[1]) - Number(action.from[1])) === 2
        ? [{ target: (action.from[0]! + ((Number(action.from[1]) + Number(action.to[1])) / 2)) as SquareName, pawnId: piece.id }] : []
      expected.turn.phase = 'afterMove'
      expected.turn.moveMade = true
    } else if (action.type === 'endTurn') {
      assert.equal(state.turn.moveMade, true, label)
      expected.turn = { color: other, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      if (n === 14 || n === 66) expected.effects = expected.effects.filter(e => (e as { type?: string }).type !== 'mystic-shield')
    } else if (action.type === 'playCard') {
      const owner: Color = n === 57 ? 'white' : actor
      const player = expected.players[owner]
      const cardIndex = player.hand.findIndex(c => c.id === action.cardInstanceId)
      assert.ok(cardIndex >= 0, label)
      assert.equal(expected.turn.cardPlays[owner], 0, label)
      const card = player.hand.splice(cardIndex, 1)[0]!
      assert.equal(card.cardId, action.cardId, label)
      if (n !== 6) player.discard.push(card)
      player.hand.push(player.deck.shift()!)
      expected.turn.cardPlays[owner] = 1
      switch (n) {
        case 6:
          expected.effects.push({ type: 'fortification', owner: 'white', card, from: 'd4', to: 'e5' })
          break
        case 11: case 63:
          expected.effects.push({ type: 'mystic-shield', owner, player: owner, pieceId: n === 11 ? 'white-knight-b1' : 'black-rook-h8' })
          break
        case 20: {
          relocate('black-knight-b8', null, 'away')
          const setup = parseFen(state.fen).unwrap()
          setup.board.take(parseSquare('b8')!)
          expected.fen = makeFen(setup)
          break
        }
        case 57:
          assert.ok(rollback)
          expected.pieces = structuredClone(rollback.pieces)
          expected.fen = rollback.fen
          expected.enPassant = structuredClone(rollback.enPassant)
          expected.effects = structuredClone(rollback.effects)
          expected.turn.phase = 'beforeMove'
          expected.turn.moveMade = false
          break
        case 71:
          relocate('black-pawn-f7', 'f6')
          relocate('black-rook-h8', 'f5')
          relocate('black-bishop-c8', 'f4')
          replacementFen(true)
          break
        case 83:
          relocate('white-pawn-h2', null, 'captured', 'black')
          relocate('black-pawn-h7', 'h4')
          replacementFen(true)
          break
        case 98:
          expected.effects = []
          player.discard.push({ id: 'white-hand-1-fortification', cardId: 'fortification' })
          break
        case 104: case 110:
          relocate(n === 104 ? 'black-queen-d8' : 'white-queen-d1', n === 104 ? 'c7' : 'b3')
          replacementFen(false)
          break
        default: assert.fail(`Unreviewed card at ${n}`)
      }
    } else if (action.type === 'abductionTimeout') {
      relocate('black-knight-b8', null, 'captured', 'white')
    } else assert.equal(action.type, 'revealAbduction', label)

    const result = applyAction(state, action)
    assert.deepEqual(state, input, `${label}: full input structuredClone immutability`)
    assert.ok(result.ok, label)
    const after = result.state
    assert.deepEqual(after.pieces, expected.pieces, `${label}: every physical field including capture actor`)
    assert.deepEqual(after.players, expected.players, `${label}: complete physical card zones and order`)
    assert.deepEqual(after.effects, expected.effects, `${label}: complete effects`)
    assert.deepEqual(after.turn, expected.turn, `${label}: phase, move, allowances`)
    assert.deepEqual(after.enPassant, expected.enPassant, `${label}: en passant`)
    assert.equal(after.fen, expected.fen, `${label}: board, castling, side and both clocks`)
    assert.equal(after.orientation, 0, label)
    assert.equal(after.outcome, null, label)
    assert.ok(!after.pendingRescue && !after.pendingDoomsayer && !after.underElfHill?.length, label)
    if (n === 20 || n === 21) {
      assert.equal(after.pendingAbduction?.phase, n === 20 ? 'concealment' : 'recall', label)
      assert.equal(after.pendingAbduction?.pieceId, 'black-knight-b8', label)
      assert.equal(after.pendingAbduction?.player, 'black', label)
      assert.equal(after.pendingAbduction?.durationMs, 10000, label)
      assert.equal(after.pendingAbduction?.requiresPieceId, false, label)
    } else assert.ok(!after.pendingAbduction, label)
    // In this trace neither wall nor Shield is needed to suppress an ordinary check.
    // Showing both Kings safe under the stronger unrestricted geometry is independent proof.
    const board = Chess.fromSetup(parseFen(after.fen).unwrap()).unwrap()
    for (const color of ['white', 'black'] as const) {
      const king = board.board.kingOf(color)!
      assert.equal(board.kingAttackers(king, color === 'white' ? 'black' : 'white', board.board.occupied).size(), 0, `${label}: ${color} royal safety`)
    }
    if (n === 57) assert.equal(after.chaosForbidden?.player, 'black', label)
    if (n === 58) assert.ok(!after.chaosForbidden, label)
    if (n === 110) assert.equal(after.history.at(-1)?.copiedCardId, 'ghostwalk', label)
    state = after
  }
  assert.equal(trace.moves, 50)
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 10)
  assert.equal(state.fen, '4rbn1/2q1pkB1/ppp2p2/P2Pbrp1/2p5/1Q2P1pR/1P3PP1/1R2KBN1 b - - 3 27')
  assert.doesNotThrow(() => replayTrace(trace))
})
