import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { Chess } from 'chessops/chess'
import { makeFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'

// Each numbered entry is an independent review of the corresponding action.
// Quiet moves increment the halfmove clock; Pawn moves/captures reset it;
// Black completed moves increment fullmove. End-turn does not advance clocks.
// No move below promotes, changes identity, or lands on an opposing trap.
const rationale = [
  '1. Nb1-c3 jumps to an empty square; both Kings remain screened.',
  '2. White ends the completed quiet move; Black receives its allowance.',
  '3. a7-a5 crosses empty a6 to empty a5; creates the a6 en-passant opportunity.',
  '4. Black ends; a6 opportunity survives for the next White move.',
  '5. b2-b4 crosses empty b3; replaces the old opportunity with b3.',
  '6. White ends with Black to act and b3 available.',
  '7. d7-d5 crosses empty d6; expires b3 and creates d6.',
  '8. Black ends; no board or card change.',
  '9. Bombard Rh1-h4 jumps only the h2 Pawn; h3/h4 empty, King safe, K right lost; replacement move spent and Resurrection drawn.',
  '10. White ends Bombard turn, with no additional Regular Move.',
  '11. a5-a4 advances one to an empty square; no King line opened.',
  '12. Black ends; White starts with fresh allowances.',
  '13. Rh4xh7 traverses empty h5/h6 and captures the h7 Pawn; no check.',
  '14. White ends the capture; captured Pawn remains captured.',
  '15. c7-c6 advances into empty c6; King still screened.',
  '16. Black ends; no extra draw without a card or discard.',
  '17. Rh7-h3 traverses h6/h5/h4, all empty; no capture.',
  '18. White ends; rook identity and lost K right persist.',
  '19. f7-f5 crosses empty f6; creates f6 en-passant opportunity.',
  '20. Black ends, preserving the opportunity.',
  '21. Evangelists swaps White Bf1 with Black Bc8 atomically; e2/g2 block the relocated enemy Bishop, no check; expires en-passant and draws Think Again.',
  '22. White ends the replacement move; swapped Bishops retain owners.',
  '23. Rh8xh3 crosses empty h7/h6/h5/h4; captures White rook and loses Black k right.',
  '24. Black ends capture with White to act.',
  '25. g2xh3 is a forward diagonal Pawn capture of the Black rook; no promotion.',
  '26. White ends; both h-file rooks remain captured.',
  '27. Qd8-b6 diagonal crosses vacated c7; destination empty and King safe.',
  '28. Black ends; White receives turn.',
  '29. Bc1-b2 uses the Pawn-vacated diagonal square; no King exposure.',
  '30. White ends; Bishop identity remains c1 original.',
  '31. c6-c5 advances one to empty c5; no en-passant.',
  '32. Black ends with no board change.',
  '33. Bc8xb7 captures the Black b7 Pawn one diagonal step; no royal target.',
  '34. White ends; the original f1 Bishop now occupies b7.',
  '35. Qb6-d6 crosses now-empty c6; d6 empty.',
  '36. Black ends; no card spending.',
  '37. Qd1-b1 crosses vacated c1; b1 empty after Knight development.',
  '38. White ends the quiet Queen move.',
  '39. d5-d4 advances into empty d4; attacks c3/e3, not the King.',
  '40. Black ends; no unresolved obligation.',
  '41. Nc3-e4 jumps away from the Pawn attack to an empty square; own King safe.',
  '42. White ends; e4 Knight threatens d6 Queen but not King.',
  '43. Qd6-b6 crosses clear c6, leaving the Knight attack.',
  '44. Black ends; no board change.',
  '45. Qb1-d1 crosses empty c1; King remains screened.',
  '46. White ends; both card allowances reset.',
  '47. Ng8-f6 jumps to empty f6; neither King checked.',
  '48. After-move Man-Trap marks occupied friendly d4; retained physical card, Fatal Attraction drawn, no clock or piece change.',
  '49. Black ends; secret d4 trap persists.',
  '50. a2-a3 advances into empty a3, without entering d4 trap.',
  '51. Haunting Memories copies latest Man-Trap at its after-move timing; friendly c2 is occupied; retains the copied effect and draws Pacifism.',
  '52. White ends; both coordinate traps persist.',
  '53. Black Bf1-g2 uses a diagonal square vacated by g2xh3; no trap or check.',
  '54. Black ends the Bishop move.',
  '55. Long Jump Ng1-e6 changes square color to empty e6; ignores distance, makes no capture/check, consumes move and draws Peace Talks.',
  '56. Toll responds to that frontier-crossing move; b4 Pawn is paid, captured once, clocks reset; Long Jump remains spent and Doppelganger drawn.',
  '57. White ends with both players having spent their distinct turn allowances.',
  '58. Qb6-b4 crosses empty b5 into the Toll-vacated square; no capture.',
  '59. Black ends; the d4 trap remains despite no incoming enemy.',
  '60. c2-c4 crosses empty c3; departure does not spring own trap; creates c3 en-passant for the adjacent Black d4 Pawn.',
  '61. White ends preserving the immediate en-passant opportunity.',
  '62. d4xc3 en passant captures White c4 Pawn off the destination; leaves both traps intact and clears en-passant.',
  '63. Fatal Attraction marks controlled Bf8 after the move; freezes e7/g7 Pawns while exempting royal e8; draws Fireball without changing board.',
  '64. Black ends with the magnet and both traps retained.',
  '65. Ne6-c7 jumps outside magnet adjacency and checks e8; White King remains safe.',
  '66. White may end while checking Black; Black receives a rescue turn.',
  '67. Nf6-d7 is geometrically valid but leaves Nc7 checking e8; only provisionally allowed with pending Fireball rescue under rule 11.6.',
  '68. Fireball explodes the just-moved d7 Knight after a noncapture; captures center, c7 Knight and e7 Pawn; adjacent e8 King immune. Check removed, halfmove reset, Evil Eye drawn.',
  '69. Black now ends safely; pending rescue cleared.',
  '70. e2-e3 advances into empty e3; Black Bishop g2 does not attack e1.',
  '71. White ends; no capture or new en-passant.',
  '72. Ra8-a5 crosses empty a7/a6; a5 empty; last Black castling right lost.',
  '73. Black ends the quiet rook move.',
  '74. Qd1-c2 enters its own trap, which triggers only on opposing arrivals; remains on board.',
  '75. White ends with its c2 trap still active.',
  '76. Qb4-b6 crosses empty b5; path and destination clear.',
  '77. Black ends; no magnet adjacency touched.',
  '78. Ra1-a2 enters the Pawn-vacated square and loses White final castling right.',
  '79. White ends with no castling rights remaining.',
  '80. Qb6-e6 crosses clear c6/d6, staying outside magnet neighborhood.',
  '81. Black ends; Queen e6 line to e1 blocked by White e4 Knight and e3 Pawn.',
  '82. f2-f3 moves into empty f3, retaining King safety and resetting clock.',
  '83. White ends; no extra draw.',
  '84. Qe6-h6 crosses empty f6/g6; no capture or own check.',
  '85. White Think Again immediately cancels Qe6-h6, restores e6 and prior clocks/Black turn, prohibits repetition, draws No Quarter and spends only reacting allowance.',
  '86. Black instead plays Ra5-b5 into empty b5, a different physical move satisfying the cancellation.',
  '87. Black ends; next White allowance resets despite its previous reaction.',
  '88. Resurrection returns the captured original b2 Pawn to vacant own starting-rank e2; no capture/check, resets clock, consumes Regular Move and draws Dungeon.',
  '89. White ends the Resurrection replacement turn.',
  '90. Bg2xh3 captures White original g2 Pawn diagonally; not the f8 magnet, which remains.',
  '91. Black ends; captured g2 Pawn stays off board.',
  '92. d2xc3 captures Black original d7 Pawn diagonally; neither trap coordinate entered.',
  '93. White ends; d4 trap can persist after its original occupant is captured elsewhere.',
  '94. Qe6-e5 moves one rank to empty e5; e4 Knight blocks the file toward White King.',
  '95. Black Peace Talks cancels White copied Man-Trap by physical card ID; discards Haunting Memories to White and itself to Black, draws Revenge; c2 Queen remains legal.',
  '96. Black ends with only d4 trap and f8 magnet retained.',
  '97. Bb7-c6 moves diagonally to empty c6 and checks e8 through empty d7.',
  '98. White ends the checking move; Black must answer it.',
  '99. Nb8xc6 captures the checking Bishop and safely answers check.',
  '100. Black Neutrality marks opposing nonroyal Ne4 after its move; e4 attacks neither King; retains original White owner and draws Ghostwalk.',
  '101. Black ends; neutral Knight remains on e4.',
  '102. White Pacifism marks its restored e2 Pawn before moving; grants mutual capture immunity, preserves move allowance and draws Dubbing.',
  '103. Neutral Ne4-d2 is a normal Knight move under White control; d2 attacks neither e1 nor e8; markers follow identity.',
  '104. White ends with neutral Knight d2 and Pacifist e2 Pawn unchanged.',
  '105. Qe5-d6 is one diagonal step to empty d6; no King exposure.',
  '106. Black ends; no effect expiration.',
  '107. f3-f4 advances into empty f4, facing Black f5 Pawn without capture.',
  '108. White ends; no en-passant from a one-square advance.',
  '109. Qd6-e5 returns diagonally to empty e5; White e3/e2 Pawns screen e1.',
  '110. Black ends the quiet move.',
  '111. e3-e4 advances into the neutral Knight-vacated square; Pacifism is on different physical b2 Pawn at e2.',
  '112. White ends with no promotion or capture.',
  '113. Rb5-b6 advances along the empty file square; no trap or magnet touched.',
  '114. Black ends; White receives its final sampled move.',
  '115. Neutral Nd2-f1 jumps into empty f1; attacks d2/e3/g3/h2, neither King; no promotion.',
  '116. White ends safely; Black before-move, no pending rescue, four continuing effects remain.',
]

test('random iteration 023 preserves its deterministic reviewed trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/023.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860023)
  assert.equal(rationale.length, 116)
  assert.equal(rationale.length, trace.steps.length)
  rationale.forEach((entry, i) => assert.ok(entry.startsWith(`${i + 1}. `)))
  const final = replayTrace(trace)
  const cardFens: Record<number, string> = {
    9: 'rnbqkbnr/1pp1pppp/8/p2p4/1P5R/2N5/P1PPPPPP/R1BQKBN1 b Qkq - 1 3',
    21: 'rnBqkbnr/1p2p1p1/2p5/3p1p2/pP6/2N4R/P1PPPPPP/R1BQKbN1 b Qkq - 1 6',
    55: 'rn2kb2/1B2p1p1/1q2Nn2/2p2p2/pP1pN3/P6P/1BPPPPbP/R2QK3 b Qq - 2 14',
    56: 'rn2kb2/1B2p1p1/1q2Nn2/2p2p2/p2pN3/P6P/1BPPPPbP/R2QK3 b Qq - 0 14',
    68: 'rn2kb2/1B4p1/8/2p2p2/pq2N3/P1p4P/1B1PPPbP/R2QK3 w Qq - 0 17',
    85: '1n2kb2/1B4p1/4q3/r1p2p2/p3N3/P1p1PP1P/RBQP2bP/4K3 b - - 0 20',
    88: '1n2kb2/1B4p1/4q3/1rp2p2/p3N3/P1p1PP1P/RBQPP1bP/4K3 b - - 0 21',
  }
  let state = createGameState(trace.initial)
  for (const [i, { action }] of trace.steps.entries()) {
    const step = i + 1
    const result = applyAction(state, action)
    assert.ok(result.ok, rationale[i])
    const next = result.state
    if (action.type === 'move') {
      const position = Chess.fromSetup(parseFen(state.fen).unwrap()).unwrap()
      const move = { from: parseSquare(action.from as string)!, to: parseSquare(action.to as string)! }
      // All sampled moves use ordinary geometry. The sole temporary self-check
      // is explicitly reviewed at 67 and cured at 68, as allowed by rule 11.6.
      assert.equal(position.isLegal(move), step !== 67, rationale[i])
      position.play(move)
      assert.equal(next.fen, makeFen(position.toSetup()), rationale[i])
      assert.deepEqual(next.effects, state.effects, rationale[i])
      assert.deepEqual(next.players, state.players, rationale[i])
      assert.equal(Boolean(next.pendingRescue), step === 67)
      const mover = state.pieces.find(p => p.square === action.from)!
      assert.deepEqual(next.pieces.find(p => p.id === mover.id), { ...mover, square: action.to })
    } else if (action.type === 'endTurn') {
      assert.equal(next.fen, state.fen)
      assert.deepEqual(next.pieces, state.pieces)
      assert.deepEqual(next.effects, state.effects)
      assert.deepEqual(next.players, state.players)
      assert.equal(next.turn.color, state.turn.color === 'white' ? 'black' : 'white')
      assert.equal(next.turn.phase, 'beforeMove')
      assert.equal(next.turn.moveMade, false)
      assert.deepEqual(next.turn.cardPlays, { white: 0, black: 0 })
    } else if (action.type === 'playCard') {
      assert.equal(next.fen, cardFens[step] ?? state.fen, rationale[i])
      const owner = state.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black'
      const player = state.players[owner]
      const card = player.hand.find(c => c.id === action.cardInstanceId)!
      assert.deepEqual(next.players[owner].hand, [...player.hand.filter(c => c.id !== card.id), player.deck[0]])
      assert.deepEqual(next.players[owner].deck, player.deck.slice(1))
      const retained = [48, 51, 63, 100, 102].includes(step)
      assert.deepEqual(next.players[owner].discard, retained ? player.discard : [...player.discard, card])
      assert.equal(next.turn.cardPlays[owner], 1)
      if ([48, 51, 63, 95, 102].includes(step)) assert.deepEqual(next.pieces, state.pieces)
    }
    if (step === 62) {
      assert.equal(next.pieces.find(p => p.id === 'white-pawn-c2')?.zone, 'captured')
      assert.equal(next.pieces.find(p => p.id === 'black-pawn-d7')?.square, 'c3')
      assert.deepEqual(next.enPassant, [])
    }
    if (step === 68) {
      for (const id of ['white-knight-g1', 'black-pawn-e7', 'black-knight-g8']) {
        assert.equal(next.pieces.find(p => p.id === id)?.zone, 'captured')
      }
      assert.equal(next.pieces.find(p => p.royal && p.owner === 'black')?.square, 'e8')
      assert.ok(!next.pendingRescue)
    }
    if (step === 85) {
      assert.equal(next.turn.color, 'black')
      assert.equal(next.turn.phase, 'beforeMove')
      assert.ok(next.chaosForbidden)
      assert.equal(applyAction(next, { type: 'move', from: 'e6', to: 'h6' }).ok, false)
    }
    if (step === 95) assert.deepEqual(next.players.white.discard.at(-1), { id: 'white-hand-2-haunting-memories', cardId: 'haunting-memories' })
    state = next
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 13)
  assert.equal(final.fen, '4kb2/6p1/1rn5/2p1qp2/p3PP2/P1P4b/RBQ1P2P/4KN2 b - - 2 27')
  assert.deepEqual(final.effects, [
    { type: 'man-trap', owner: 'black', card: { id: 'black-hand-2-man-trap', cardId: 'man-trap' }, square: 'd4' },
    { type: 'fatal-attraction', owner: 'black', card: { id: 'black-deck-0-fatal-attraction', cardId: 'fatal-attraction' }, pieceId: 'black-bishop-f8' },
    { type: 'neutrality', owner: 'black', card: { id: 'black-hand-1-neutrality', cardId: 'neutrality' }, pieceId: 'white-knight-b1' },
    { type: 'pacifism', owner: 'white', card: { id: 'white-deck-2-pacifism', cardId: 'pacifism' }, pieceId: 'white-pawn-b2' },
  ])
  assert.equal(final.pieces.find(p => p.id === 'white-knight-b1')?.neutral, true)
  assert.equal(final.pieces.find(p => p.id === 'white-knight-b1')?.square, 'f1')
  assert.equal(final.pieces.find(p => p.id === 'white-pawn-b2')?.square, 'e2')
  assert.ok(!final.pendingRescue && !final.outcome && !final.chaosForbidden)
})
