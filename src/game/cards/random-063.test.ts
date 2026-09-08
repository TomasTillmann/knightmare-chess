import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { PieceState, SquareName } from '../types.js'

// Independently reviewed in order against rules.md §§8–18 and cards.md.
const rationales = [
  '1. c2-c3 is an empty forward pawn step; e1 stays sheltered.',
  '2. White closes the completed move; Black receives a fresh allowance.',
  '3. b8-c6 is a clear-destination knight jump; Black advances the fullmove clock.',
  '4. After-move Coup marks the c7 pawn royal and demotes e8 to Prince without changing powers or board; retain the card and draw Masquerade.',
  '5. Black ends; c7 is the safe royal identity, despite the FEN king symbol at e8.',
  '6. b2-b4 crosses empty b3; record b3 en passant and reset the pawn clock.',
  '7. End turn preserves the immediately available b3 opportunity.',
  '8. c6-b8 is a knight jump, declining and expiring en passant.',
  '9. After-move Cowardice returns the opposing c3 pawn one step backward to empty c2; clocks stay fixed and Disintegration replaces the spent card.',
  '10. Black closes Cowardice without another move or draw.',
  '11. The returned c2 pawn can advance to empty c3 again.',
  '12. White ends with both royals safe.',
  '13. a7-a5 crosses empty a6; a6 becomes the en-passant target.',
  '14. End turn preserves that immediate opportunity.',
  '15. g2-g4 crosses empty g3; replace the expired a6 opportunity with g3.',
  '16. White ends without spending a card.',
  '17. a5xb4 captures the physical white b2 pawn by an ordinary forward diagonal.',
  '18. Black ends the capture; the victim remains captured, not dead.',
  '19. d2-d3 advances one empty square and retains the e2 shield of e1.',
  '20. White ends the pawn move without changing cards.',
  '21. b7-b6 is one empty forward step.',
  '22. Black ends; c7 remains sheltered.',
  '23. g1-h3 is a knight jump to an empty square.',
  '24. White ends; no capture, promotion, or card accounting occurs.',
  '25. g8-f6 is an empty knight jump.',
  '26. Black closes its completed move.',
  '27. a2-a4 crosses empty a3; adjacent black b4 can capture en passant at a3.',
  '28. After-move Crab attaches to the a2 physical pawn now on a4, preserving its pawn identity and existing en passant; retain Crab and draw Dubbing.',
  '29. White ends with both continuing cards retained.',
  '30. e7-e5 crosses empty e6 and declines the a3 capture; replace the opportunity with e6.',
  '31. Black closes the pawn move.',
  '32. c1-f4 follows empty d2 and e3; no obstruction or capture.',
  '33. White ends its bishop move.',
  '34. Masquerade gives the a8 rook a queen diagonal through empty b7,c6,d5,e4,f3 to g2; no capture, c7 remains safe, revoke q and consume Black move.',
  '35. Black closes the replacement move and keeps the rook on g2.',
  '36. Onslaught moves the original a2 pawn from a4 to empty a5; §13.7 permits its Crab transformation to remain, without promotion or en passant.',
  '37. White closes the replacement pawn move.',
  '38. h7-h5 crosses empty h6 and creates only h6 en passant.',
  '39. Black ends without further movement.',
  '40. f2-f3 is empty; e2 still blocks the g2 rook from e1.',
  '41. White ends safely and h6 en passant is expired.',
  '42. g2-g3 is one rook step to an empty square.',
  '43. Black ends its rook move.',
  '44. Exactly a1,h1,h8 are occupied corners; Squaring the Circle relocates the g4 pawn to sole empty a8, with no promotion under §13.10.',
  '45. White ends with the unpromoted pawn on a8.',
  '46. b4xc3 captures the physical white c2 pawn diagonally forward.',
  '47. Black ends with that pawn captured.',
  '48. a1-a3 passes empty a2; revoke white Q castling and increment the quiet clock.',
  '49. White closes its rook move.',
  '50. The royal c7 pawn advances to empty c6 under its retained pawn power; c6 is safe and moving the royal revokes remaining black castling.',
  '51. Black ends with c6 royal and e8 still a capturable Prince.',
  '52. b1xc3 is a knight capture of the physical black a7 pawn.',
  '53. White ends the capture without a card.',
  '54. c8-b7 is an empty bishop step.',
  '55. Black ends its bishop move.',
  '56. d1-a4 passes empty c2,b3 and checks royal c6 along empty b5; ordinary check is legal.',
  '57. White ends while Black must answer the queen line.',
  '58. b6-b5 interposes the pawn on the a4-c6 diagonal and cures the royal check.',
  '59. Black may now close the safe turn.',
  '60. d3-d4 is an empty pawn step.',
  '61. White closes the move.',
  '62. Dubbing moves g7-f5 with knight geometry to an empty square, retaining pawn identity and consuming Black move; draw Challenge.',
  '63. Black closes the replacement move.',
  '64. h2xg3 is a forward diagonal capture of the visiting black a8 rook.',
  '65. White ends with the rook captured and lost castling rights unrestored.',
  '66. e8-e7 is a one-step move of the nonroyal Prince; c6 remains the protected royal.',
  '67. Black closes the Prince move.',
  '68. h1-h2 is empty and revokes the last white castling right.',
  '69. White closes the rook move; neither side can castle normally.',
  '70. e7-e6 is another empty Prince step, not a royal relocation.',
  '71. Black ends with royal c6 safe.',
  '72. h2-f2 passes empty g2; f2 is empty after f2-f3.',
  '73. White ends its rook move.',
  '74. b7-a6 is one empty bishop step.',
  '75. Disintegration makes Black own nonroyal e5 pawn dead without capture or clock change; draw Figure Dance.',
  '76. Black closes after its pawn death; Coup remains on c6.',
  '77. f4-c1 crosses empty e3,d2.',
  '78. Siege swaps own knight c3 and rook a3 atomically; rook c3 checks c6 through c4,c5, but Black can interpose its f8 bishop on c5, so this is not direct mate.',
  '79. White ends after the legal checking swap.',
  '80. f8-d6 traverses empty e7 but leaves rook c3 checking royal c6; only a provisional move is allowed, with pending rescue under §11.6.',
  '81. Challenge selects movable opposing bishop c1; §11.7 suppresses the unselected c3 rook capture, curing the provisional check without relocating anything.',
  '82. Black closes the rescued turn; White must next use the challenged bishop.',
  '83. c1-d2 moves that physical bishop legally and consumes Challenge; the c3 rook check against c6 resumes.',
  '84. White may close while Black is in check.',
  '85. d6-c5 interposes the black bishop on the c3-c6 rook line and answers check.',
  '86. Black closes the safe turn.',
  '87. f1-g2 is an empty bishop step.',
  '88. White closes the bishop move.',
  '89. f6-e4 is an empty knight jump; the c5 bishop still shields c6.',
  '90. Black ends its knight move.',
  '91. c3-c1 passes empty c2 and makes no capture.',
  '92. White ends its rook move.',
  '93. Forced March simultaneously shifts own f7-g7 and h5-g5 sideways to distinct initially empty squares; consume one replacement move and reset pawn clock.',
  '94. Black closes the two-pawn replacement.',
  '95. c1-d1 is one empty rook step.',
  '96. White closes the move.',
  '97. f5-f4 is an empty ordinary pawn step after Dubbing; no knight power persists.',
  '98. Black closes the pawn move.',
  '99. a3-b1 is an empty knight jump.',
  '100. Immediate opposing Chaos restores knight a3, White move opportunity and clock 0/24; Black spends its reaction, draws Holy Quest, and bans a3-b1 only.',
  '101. a3xb5 is a genuinely different knight move and captures the original black b7 pawn; the knight now blocks its own queen diagonal.',
  '102. White ends; Black receives a fresh allowance despite its preceding Chaos reaction.',
  '103. d8-c7 is one empty queen diagonal.',
  '104. Black closes its queen move.',
  '105. d4xc5 captures the bishop previously interposing on c5; the pawn keeps its identity and does not promote.',
  '106. White ends with the f8 bishop captured.',
  '107. a6-c8 follows empty b7 to empty c8.',
  '108. Black closes its bishop move.',
  '109. a4-d4 crosses empty b4,c4; the pawn has vacated d4.',
  '110. Holy War swaps own knight b5 and bishop g2, giving bishop check on adjacent royal c6; c6xb5 is a safe escape, so no direct mate.',
  '111. White ends the checking swap; Black must escape.',
  '112. c7-b6 is a queen step which leaves the c6 royal checked by b5; a provisional move is possible because an after-move Holy Quest swap can remove the attacker.',
  '113. Forbidden City h7 does not cure adjacent b5-c6 check; spend and draw Fortification, retain no city, and undo the now-unsavable provisional queen move to c7 with clock 2/26.',
  '114. Royal pawn c6xb5 captures the checking bishop by retained pawn geometry; b5 is safe because c5 blocks queen d4 and no other white piece attacks b5.',
  '115. Black ends the now-legal capture with its card allowance spent.',
  '116. d4xg7 follows empty e5,f6 to capture the physical black f7 pawn; no promotion, and e1 remains safe.',
  '117. White ends the fiftieth regular move command; Black receives the next turn with no pending choices.',
]

const coordinates = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const
const stablePiece = ({ capturedAtPly: _, ...piece }: PieceState) => piece

test('iteration 063 deterministic replay', () => {
  const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/063.json', import.meta.url), 'utf8'))
  assert.equal(trace.seed, 860063)
  assert.equal(trace.steps.length, 117)
  assert.equal(rationales.length, trace.steps.length)
  rationales.forEach((text, i) => assert.ok(text.startsWith(`${i + 1}. `)))
  let state = createGameState(trace.initial)
  const retained: unknown[] = []
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1
    const why = rationales[index]
    const before = state
    const pieces = before.pieces.map(stablePiece)
    const at = (square: string) => pieces.find(p => p.square === square && p.zone === 'board')!
    const relocate = (from: string, to: string) => { assert.ok(at(from), why); at(from).square = to as SquareName }
    const swap = (a: string, b: string) => { const first = at(a); const second = at(b); first.square = b as SquareName; second.square = a as SquareName }
    const players = structuredClone(before.players)
    const turn = structuredClone(before.turn)
    let clocks = before.fen.split(' ').slice(4).map(Number)
    let enPassant = structuredClone(before.enPassant)
    let rights = before.fen.split(' ')[2]!
    let fenColor = before.fen.split(' ')[1]!
    const consumeMove = (pawnOrCapture: boolean) => {
      clocks = [pawnOrCapture ? 0 : clocks[0]! + 1, clocks[1]! + (before.turn.color === 'black' ? 1 : 0)]
      turn.phase = 'afterMove'; turn.moveMade = true
      enPassant = []; fenColor = before.turn.color === 'white' ? 'b' : 'w'
    }
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const piece = at(action.from); assert.ok(piece, why)
      assert.equal(piece.owner, before.turn.color, why)
      const target = at(action.to)
      const [x, y] = coordinates(action.from); const [tx, ty] = coordinates(action.to)
      const dx = tx - x; const dy = ty - y
      const diagonal = Math.abs(dx) === Math.abs(dy)
      if (piece.role === 'knight') assert.equal(Math.abs(dx * dy), 2, why)
      else if (piece.role === 'king') assert.equal(Math.max(Math.abs(dx), Math.abs(dy)), 1, why)
      else if (piece.role === 'pawn') {
        const forward = piece.owner === 'white' ? 1 : -1
        assert.equal(dx, target ? Math.sign(dx) : 0, why)
        assert.ok(target ? Math.abs(dx) === 1 && dy === forward : dy === forward || dy === 2 * forward && [1, 6].includes(y), why)
      } else assert.ok(piece.role === 'bishop' ? diagonal : piece.role === 'rook' ? dx === 0 || dy === 0 : diagonal || dx === 0 || dy === 0, why)
      if (piece.role !== 'knight') for (let s = 1; s < Math.max(Math.abs(dx), Math.abs(dy)); s++) {
        assert.equal(at(`${String.fromCharCode(97 + x + s * Math.sign(dx))}${y + 1 + s * Math.sign(dy)}`), undefined, why)
      }
      if (target) { assert.notEqual(target.owner, piece.owner, why); assert.equal(target.royal, false, why); target.square = null; target.zone = 'captured' }
      relocate(action.from, action.to)
      consumeMove(piece.role === 'pawn' || !!target)
      if (piece.role === 'pawn' && Math.abs(dy) === 2) enPassant = [{ target: `${action.from[0]}${(y + ty) / 2 + 1}` as SquareName, pawnId: piece.id }]
      if (n === 48) rights = 'Kk'
      if (n === 50) rights = 'K'
      if (n === 68) rights = '-'
      if (n === 83) retained.pop()
    } else if (action.type === 'playCard') {
      const owner = n === 100 ? 'black' : before.turn.color
      const player = players[owner]
      const selected = player.hand.find(card => card.id === action.cardInstanceId)!
      assert.ok(selected, why); assert.equal(turn.cardPlays[owner], 0, why)
      player.hand = player.hand.filter(card => card.id !== selected.id)
      player.hand.push(player.deck.shift()!)
      turn.cardPlays[owner]++
      if (![4, 28].includes(n)) player.discard.push(selected)
      switch (n) {
        case 4:
          at('c7').royal = true; at('e8').royal = false
          retained.push({ type: 'coup', owner: 'black', card: selected, princeId: 'black-king-e8', kingId: 'black-pawn-c7', princeRole: 'king' }); break
        case 9: relocate('c3', 'c2'); break
        case 28: retained.push({ type: 'crab', owner: 'white', card: selected, pieceId: 'white-pawn-a2' }); break
        case 34: relocate('a8', 'g2'); consumeMove(false); rights = 'KQk'; break
        case 36: relocate('a4', 'a5'); consumeMove(true); break
        case 44:
          assert.deepEqual(['a1', 'a8', 'h1', 'h8'].filter(square => !!at(square)), ['a1', 'h1', 'h8'], why)
          relocate('g4', 'a8'); consumeMove(true); break
        case 62: relocate('g7', 'f5'); consumeMove(true); break
        case 75: { const pawn = at('e5'); pawn.zone = 'dead'; pawn.square = null; break }
        case 78: swap('c3', 'a3'); break
        case 81: retained.push({ type: 'challenge', owner: 'black', player: 'white', pieceId: 'white-bishop-c1' }); break
        case 93: relocate('f7', 'g7'); relocate('h5', 'g5'); consumeMove(true); break
        case 100: relocate('b1', 'a3'); clocks = [0, 24]; fenColor = 'w'; turn.phase = 'beforeMove'; turn.moveMade = false; break
        case 110: swap('b5', 'g2'); break
        case 113: relocate('b6', 'c7'); clocks = [2, 26]; fenColor = 'b'; turn.phase = 'beforeMove'; turn.moveMade = false; break
        default: assert.fail(`Unreviewed card at ${n}`)
      }
    } else {
      assert.equal(action.type, 'endTurn', why)
      assert.equal(before.turn.moveMade, true, why)
      turn.color = before.turn.color === 'white' ? 'black' : 'white'
      turn.phase = 'beforeMove'; turn.moveMade = false; turn.cardPlays = { white: 0, black: 0 }
    }
    const result = applyAction(before, action)
    assert.ok(result.ok, why); state = result.state
    assert.deepEqual(state.pieces.map(stablePiece), pieces, why)
    assert.deepEqual(state.players, players, why)
    assert.deepEqual(state.turn, turn, why)
    assert.deepEqual(state.effects, retained, why)
    assert.deepEqual(state.enPassant, enPassant, why)
    assert.deepEqual(state.fen.split(' ').slice(4).map(Number), clocks, why)
    assert.equal(state.fen.split(' ')[1], fenColor, why)
    assert.equal(state.fen.split(' ')[2], rights, why)
    assert.equal(!!state.pendingRescue, [80, 112].includes(n), why)
    assert.equal(state.orientation, 0, why)
    assert.equal(state.pieces.find(p => p.owner === 'black' && p.royal)?.id, n < 4 ? 'black-king-e8' : 'black-pawn-c7', why)
    assert.ok(!state.pieces.some(p => p.promoted || p.neutral), why)
    assert.ok(!state.outcome, why)
  }
  assert.equal(trace.steps.filter(step => step.action.type === 'move').length, 50)
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 14)
  assert.equal(state.fen, 'Pnb4r/2qp2Q1/4k3/PpP3p1/4np2/5PPN/3BPRN1/3RK3 b - - 0 27')
  assert.equal(replayTrace(trace).fen, state.fen)
})
