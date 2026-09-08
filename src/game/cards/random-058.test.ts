import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Chess } from 'chessops/chess'
import { makeBoardFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import { replayTrace, type RandomTrace } from './random-campaign.js'

// Individually reviewed in trace order against rules.md §§8–15, 18, 20–22 and catalog timing.
const rationales = [
  '1. Ng1-h3 jumps to an empty square; both Kings remain screened.',
  '2. White ends the completed knight turn; no optional discard or draw.',
  '3. Bombard Rh8-h5 crosses only h7; h6/h5 are empty, h7 survives, and Black loses h-rook castling rights.',
  '4. Bombard consumed Black’s move; hand refilled with Treason and White starts.',
  '5. c2-c4 traverses empty c3; reset pawn clock and record c3 en passant.',
  '6. End White turn while preserving the c3 opportunity for Black.',
  '7. d7-d5 traverses d6; previous c3 opportunity expires and d6 replaces it.',
  '8. After-move Treason swaps opposing Ra1/Nh3 identities without capture; neither King is exposed and d6 remains.',
  '9. End Black turn after one card; do not advance move clocks again.',
  '10. e2-e4 traverses e3, leaves Ke1 safe, replaces d6 en passant with e3.',
  '11. White passes with the pawn move complete; unchanged board and hands.',
  '12. Rh5-h6 is a quiet one-square file move; e3 en passant expires.',
  '13. End Black rook turn; no extra move or card draw.',
  '14. c4-c5 is a quiet forward pawn move; no en passant or promotion.',
  '15. End White pawn turn; Black begins with fresh card allowances.',
  '16. Rh6xh3 crosses empty h5/h4, captures physical white Ra1 and clears its castling eligibility.',
  '17. End Black capture; captured rook stays off board and no card is drawn.',
  '18. f2-f4 traverses f3; Rh3 is blocked from Ke1 by other pieces, so White remains safe.',
  '19. White ends turn retaining f3 en passant for Black.',
  '20. b7-b5 traverses b6, replacing f3 with b6 en passant; White c5 can capture it.',
  '21. Black ends turn with b6 en passant still available.',
  '22. d2-d3 declines en passant; quiet forward pawn move expires b6.',
  '23. White ends completed d-pawn turn; no stateful card changes.',
  '24. c7-c6 is one empty forward square; no King line opens.',
  '25. Black ends turn; no promotion, draw, or effect is due.',
  '26. Qd1-e2 moves one diagonal to the vacated pawn square; Ke1 stays safe.',
  '27. White ends queen turn without drawing or changing clocks.',
  '28. Qd8-a5 crosses empty c7/b6 and gives ordinary check along clear b4/c3/d2 to Ke1.',
  '29. Black passes with White in check from Qa5; White must answer it.',
  '30. Nb1-d2 is a legal jump that answers check by blocking Qa5-b4-c3-d2-e1.',
  '31. Panic is legal after White’s move; spend/refill it and impose Black’s next-move 15000ms obligation.',
  '32. White ends; Panic persists into Black’s before-move phase.',
  '33. Rh3-e3 crosses empty g3/f3 before timeout; legal move satisfies Panic, Qe2 shields Ke1.',
  '34. End Black turn after Panic was satisfied; no pending timer remains.',
  '35. d3-d4 is legal because Nd2 still screens Qa5-e1 and Qe2 screens Re3-e1.',
  '36. White ends the completed pawn move; unchanged hand.',
  '37. Breakthrough allows c6xc5 forward, capturing white Pc2; replacement move resets clock and draws Revenge.',
  '38. Black ends the replacement move; captured pawn remains captured.',
  '39. Long Jump d2-e6 has opposite colors and empty destination, but exposes Qa5-b4-c3-d2-e1; fizzle, keep Nd2, spend card and consume safe-start move.',
  '40. White ends the fizzled replacement turn; unchanged board with Nd2 shielding King.',
  '41. Nb8-c6 jumps legally; no own-King exposure.',
  '42. Black ends knight turn; neither side draws.',
  '43. Qe2xe3 captures the blocking black rook directly; Ke1 remains screened by Nd2.',
  '44. White ends capture; physical Rh8 remains in Black captured zone.',
  '45. Qa5-b6 is a quiet diagonal; removes the pin against Nd2.',
  '46. Black ends queen turn with no response effect.',
  '47. d4xc5 captures black Pc7 diagonally; preserves physical Pd2 identity.',
  '48. After-move Neutrality marks opposing Ra8, a nonroyal nonqueen; board unchanged, card retained and replacement Betrayal drawn.',
  '49. White ends; Neutrality persists and both Kings are screened from the neutral rook.',
  '50. Neutral Ra8-b8 is controlled by Black; c8 bishop and b6 queen block its rays to both Kings; a-rook castling right ends.',
  '51. Black ends neutral-rook move; marker follows physical Ra8 to b8.',
  '52. g2-g4 traverses g3; neutral rook remains blocked from Kings; record g3 en passant.',
  '53. White ends; g3 opportunity remains for Black.',
  '54. Qb6xb8 traverses empty b7 and may capture same-color neutral rook; capture ends its Neutrality and discards the physical marker.',
  '55. Black ends with Ra8 captured under original Black ownership and no active Neutrality.',
  '56. Masquerade lets nonpawn Bf1-f3 move as Queen across empty f2 without capture; remains a Bishop and consumes White move.',
  '57. White ends replacement move; no persistent Queen power remains.',
  '58. Ng8-f6 jumps to empty square; Black King remains safe.',
  '59. Black ends knight turn; no ongoing effect applies.',
  '60. Qe3-e2 is a quiet file step; does not expose Ke1.',
  '61. White ends queen turn, preserving board and hands.',
  '62. g7-g5 crosses empty g6; pawn clock resets and g6 en passant is recorded.',
  '63. Black ends pawn turn retaining g6 opportunity.',
  '64. b2-b3 is a quiet pawn step and declines g6 en passant.',
  '65. White ends with no en passant remaining.',
  '66. Annexation simultaneously moves d5-d3 via d4 and e7-e5 via e6, all initially empty; only starting e7 pawn earns en passant.',
  '67. Black ends replacement move; e6 opportunity persists, no d4 opportunity is created.',
  '68. Ke1-f2 is safe from Qb8, both Knights and bishops; King move clears remaining White castling rights and e6 en passant.',
  '69. White ends King turn; all castling rights remain absent.',
  '70. Qb8-b7 is a quiet file step with no exposure of Ke8.',
  '71. Black ends queen turn; no card consumed.',
  '72. Rh1-d1 crosses empty g1/f1/e1 after King vacated; no capture or check.',
  '73. White ends rook turn with no card or clock change.',
  '74. Bc8-f5 crosses empty d7/e6, noncapturing and Ke8 safe.',
  '75. Black ends, declining eligible Crusade; bishop stays f5.',
  '76. g4xf5 captures Black Bc8 diagonally and resets capture clock.',
  '77. White ends pawn capture; bishop remains captured.',
  '78. h7-h5 traverses h6; new h6 en passant right and zero pawn clock.',
  '79. Black ends preserving h6 for the immediate reply.',
  '80. Kf2-g2 steps to unattacked square, beyond Nf6 reach and behind Bf3; clears h6.',
  '81. White ends King move safely with rights still absent.',
  '82. Bf8-e7 is an empty diagonal; no capture or King exposure.',
  '83. Black ends and declines Crusade again.',
  '84. f4xe5 captures Black Pe7 diagonally; White Pf2 now occupies e5.',
  '85. White ends capture; no promotion or new en passant.',
  '86. Nc6-a5 is legal knight geometry to empty square.',
  '87. Black ends knight turn; no effect or draw.',
  '88. Qe2-e3 is a quiet file step with Kg2 safe.',
  '89. White ends queen move; unchanged clocks on handoff.',
  '90. Nf6-d7 is a legal knight jump; Ke8 remains safe.',
  '91. Black ends knight move without spending a card.',
  '92. a2-a3 is one empty forward square; pawn clock resets.',
  '93. White ends a-pawn move; no en passant created.',
  '94. Qb7-b8 is a quiet file step with no own-King exposure.',
  '95. Black ends queen move; allowances reset.',
  '96. Na1-c2 jumps legally with the original Ng1 identity from Treason.',
  '97. White ends knight turn; identity and hand unchanged.',
  '98. Qb8-c7 moves one empty diagonal, safe for Ke8.',
  '99. Black ends; latest played card is still Annexation.',
  '100. Haunting Memories copies Black’s last card Annexation: h2-h4 via empty h3, no capture; original starting pawn earns h3 en passant.',
  '101. White ends copied replacement move; only Haunting Memories was spent, Annexation stays discarded.',
  '102. b5-b4 moves forward into empty square; expires h3 en passant.',
  '103. After-move Vendetta is retained beside board and refilled with Fortification; no board or clock change.',
  '104. Black ends; White has legal a3xb4 so Vendetta remains active.',
  '105. a3xb4 captures Black Pb7 and satisfies Vendetta; White Pa2 identity travels.',
  '106. White ends; Black has Qc7xc5 and d3xc2 captures so Vendetta persists.',
  '107. Qc7xc5 crosses empty c6, capturing White Pd2 and satisfying Vendetta.',
  '108. Black ends; White has b4xc5, keeping Vendetta active.',
  '109. b4xc5 captures Black Queen legally and satisfies Vendetta without checking Ke8.',
  '110. White ends; Black still has d3xc2, so obligation remains.',
  '111. d3xc2 captures original White Ng1; no promotion on rank two, and Vendetta satisfied.',
  '112. Black ends; White has Qe3xg5 along empty f4, maintaining Vendetta.',
  '113. Qe3xg5 crosses empty f4 and captures Black Pg7; capture satisfies Vendetta and leaves Kg2 safe.',
  '114. White ends; Black has Be7xc5 via d6 so Vendetta continues.',
  '115. Be7xc5 traverses empty d6, captures White Pa2 and satisfies Vendetta; Ke8 remains safe.',
  '116. Black ends move 50; White still has Qg5xh5 as a legal capture, so Vendetta remains with White to act.',
]

test('random campaign iteration 058 independent semantic review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/058.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860058)
  assert.equal(rationales.length, trace.steps.length)
  assert.equal(trace.steps.length, 116)
  assert.equal(trace.steps.filter(({action}) => action.type === 'playCard').length, 10)
  let state = createGameState(trace.initial)
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1
    assert.ok(rationales[index]!.startsWith(`${step}. `))
    const result = applyAction(state, action)
    assert.ok(result.ok, rationales[index])
    const after = result.state
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const mover = state.pieces.find(piece => piece.square === action.from)!
      const victim = state.pieces.find(piece => piece.square === action.to)
      if (step === 54) {
        assert.equal(mover.id, 'black-queen-d8')
        assert.equal(victim?.id, 'black-rook-a8')
        assert.equal(victim?.neutral, true)
        assert.ok(!state.pieces.some(piece => piece.square === 'b7'))
      } else {
        const chess = Chess.fromSetup(parseFen(state.fen).unwrap()).unwrap()
        const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! }
        assert.ok(chess.isLegal(move), rationales[index])
        chess.play(move)
        assert.equal(makeBoardFen(chess.board), after.fen.split(' ')[0])
      }
      assert.deepEqual(after.pieces.find(piece => piece.id === mover.id), { ...mover, square: action.to })
      if (victim) assert.equal(after.pieces.find(piece => piece.id === victim.id)?.zone, 'captured')
      const priorClock = state.fen.split(' ')
      const clock = after.fen.split(' ')
      assert.equal(Number(clock[4]), victim || mover.role === 'pawn' ? 0 : Number(priorClock[4]) + 1)
      assert.equal(Number(clock[5]), Number(priorClock[5]) + (state.turn.color === 'black' ? 1 : 0))
      if (step >= 105) assert.ok(victim, 'Vendetta requires these available captures')
      if (step === 33) assert.deepEqual(after.effects, [])
      if (step === 54) {
        assert.deepEqual(after.effects, [])
        assert.equal(after.pieces.find(piece => piece.id === victim!.id)?.neutral, false)
        assert.equal(after.players.white.discard.at(-1)?.cardId, 'neutrality')
      }
    } else if (action.type === 'endTurn') {
      assert.equal(state.turn.moveMade, true)
      assert.deepEqual(after.pieces, state.pieces)
      assert.deepEqual(after.players, state.players)
      assert.equal(after.fen, state.fen)
      assert.equal(after.turn.color, state.turn.color === 'white' ? 'black' : 'white')
      assert.equal(after.turn.phase, 'beforeMove')
      assert.equal(after.turn.moveMade, false)
      assert.deepEqual(after.turn.cardPlays, { white: 0, black: 0 })
    } else if (action.type === 'playCard') {
      const owner = state.turn.color
      const played = state.players[owner].hand.find(card => card.id === action.cardInstanceId)!
      assert.ok(played)
      assert.deepEqual(after.players[owner].hand, [...state.players[owner].hand.filter(card => card.id !== played.id), state.players[owner].deck[0]])
      assert.deepEqual(after.players[owner].deck, state.players[owner].deck.slice(1))
      assert.equal(after.turn.cardPlays[owner], 1)
      assert.equal(after.turn.moveMade, true)
      const changes: Record<number, Record<string, string | null>> = {
        3: { 'black-rook-h8': 'h5' },
        8: { 'white-rook-a1': 'h3', 'white-knight-g1': 'a1' },
        37: { 'black-pawn-c7': 'c5', 'white-pawn-c2': null },
        56: { 'white-bishop-f1': 'f3' },
        66: { 'black-pawn-d7': 'd3', 'black-pawn-e7': 'e5' },
        100: { 'white-pawn-h2': 'h4' },
      }
      const expectedPieces = state.pieces.map(piece => {
        if (step === 48 && piece.id === 'black-rook-a8') return { ...piece, neutral: true, neutralBeforeEffects: false }
        const change = changes[step]
        if (!change || !(piece.id in change)) return piece
        const square = change[piece.id]!
        return { ...piece, square, zone: square === null ? 'captured' : 'board' }
      })
      assert.deepEqual(after.pieces, expectedPieces, rationales[index])
      if (step === 48 || step === 103) {
        assert.deepEqual(after.players[owner].discard, state.players[owner].discard)
        assert.deepEqual(after.effects, [{ type: action.cardId, owner, card: played, ...(step === 48 ? { pieceId: 'black-rook-a8' } : {}) }])
      } else {
        assert.deepEqual(after.players[owner].discard, [...state.players[owner].discard, played])
        assert.deepEqual(after.effects, step === 31 ? [{ type: 'panic', owner: 'white', player: 'black', durationMs: 15000 }] : [])
      }
      if ([8,31,48,103].includes(step)) assert.deepEqual(after.fen.split(' ').slice(4), state.fen.split(' ').slice(4))
      if (step === 39) {
        assert.equal(after.fen, 'rnb1kbn1/p3pppp/8/qppp4/3PPP2/4r3/PP1NQ1PP/N1B1KB1R b Kq - 1 10')
        assert.equal(after.history.at(-1)?.type, 'cardFizzled')
      }
      if (step === 66) assert.deepEqual(after.enPassant, [{ target: 'e6', pawnId: 'black-pawn-e7' }])
      if (step === 100) assert.deepEqual(after.enPassant, [{ target: 'h3', pawnId: 'white-pawn-h2' }])
    }
    state = after
  }
  assert.equal(state.fen, '4k3/p2n1p2/8/n1b1PPQp/4P2P/1P3B2/2pN2K1/2BR4 w - - 0 29')
  assert.deepEqual(state.effects, [{ type: 'vendetta', owner: 'black', card: { id: 'black-hand-3-vendetta', cardId: 'vendetta' } }])
  assert.equal(state.players.white.deck.length, 70)
  assert.equal(state.players.black.deck.length, 70)
  assert.equal(replayTrace(trace).fen, state.fen)
})
