import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Chess } from 'chessops/chess'
import { makeBoardFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import { CARD_CATALOG } from './catalog.js'
import { replayTrace, type RandomTrace } from './random-campaign.js'

// Independently reviewed in order using rules §§8–11, 13–14, 19.2 and cards.md.
// Crab artwork KC7_card1 explicitly expires its effect on capture or promotion.
const rationales = [
  '1. f2-f4 crosses empty f3; pawn double-step creates f3 en passant and leaves e1 safe.',
  '2. White ends its completed move; Black receives the f3 reply opportunity.',
  '3. g8-h6 is a free knight jump; e8 remains screened and f3 expires.',
  '4. Fireball after the quiet knight move captures h6, g7 and h7 only; neither King is adjacent.',
  '5. White Vulture immediately takes that physical Fireball; charge is the top-deck cost and cowardice the replacement.',
  '6. Black ends; both card allowances reset and White retains its six-card hand.',
  '7. h2-h3 is an empty forward pawn square, with no exposed King line.',
  '8. White ends without another card; board and clocks stay fixed.',
  '9. Onslaught simultaneously advances a7, b7, c7, f7 to empty sixth-rank squares; no capture, promotion or en passant.',
  '10. Onslaught used Black’s move; handoff preserves its four advances.',
  '11. a2-a4 crosses empty a3; a3 becomes the reply en-passant target.',
  '12. Curse marks the opposing h8 Rook after White’s move, preserving board and en passant.',
  '13. White ends with Curse retained and Black’s reply pending.',
  '14. h8-h7 is one unobstructed rook step, within Curse; Black loses kingside castling.',
  '15. Black ends; Curse follows the h7 physical Rook.',
  '16. e2-e3 is a quiet pawn step that opens the White Queen diagonal without exposing e1.',
  '17. White ends with both Kings safe.',
  '18. b6-b5 advances one square without capture or promotion.',
  '19. Black ends; no en-passant right survives a one-square pawn move.',
  '20. d1-e2 is a one-square diagonal Queen move to the pawn-vacated square.',
  '21. White ends; Queen e2 still screens the e-file.',
  '22. a6-a5 is an empty forward square; White a4 is not captured.',
  '23. Black ends with the a-pawns face to face.',
  '24. c2-c4 crosses empty c3 and creates c3 en passant.',
  '25. The transferred Fireball is White-owned despite its black instance prefix; c4 and enemy b5 explode, c6 survives.',
  '26. White ends; the exploded c-pawn cannot retain en-passant availability.',
  '27. e8-f7 is a safe King diagonal; Black loses its remaining castling rights.',
  '28. Black ends with King f7 and fullmove seven.',
  '29. e2-d3 is a clear Queen diagonal; neither King is exposed.',
  '30. White ends; its Queen now occupies d3.',
  '31. f6-f5 is a quiet pawn step, stopping in front of White f4.',
  '32. Black ends with no capture or en-passant right.',
  '33. h3-h4 advances into empty h4 without promotion.',
  '34. Crab marks White’s b2 Pawn after the move; identity and square remain unchanged.',
  '35. White ends; the Crab’s forward diagonals are a3 and c3.',
  '36. d8-b6 passes empty c7; the Queen does not cross occupied c6.',
  '37. Black ends; White e1 remains screened from the b6 Queen.',
  '38. d3-a6 crosses empty c4 and b5; no capture or King exposure.',
  '39. Cowardice moves the opposing c6 Pawn backward to empty c7, preserving identity and move clocks.',
  '40. White ends after its Queen move and Cowardice.',
  '41. c8-b7 is an empty Bishop diagonal; f7 King remains safe.',
  '42. Black ends with the Bishop available for capture on b7.',
  '43. f1-b5 passes empty e2, d3 and c4; ordinary Bishop movement.',
  '44. White ends; b5 Bishop is not yet cursed.',
  '45. e7-e6 is an empty pawn advance and resets the halfmove clock.',
  '46. Black ends; its King f7 is not attacked along the blocked b7-f7 rank.',
  '47. a6-b7 Queen captures the Black c8 Bishop, preserving Queen identity.',
  '48. White ends after capture; Black’s c7 Pawn screens its King from b7.',
  '49. h7-g7 is one rook step within Curse, without capture.',
  '50. White Plots reacts after Black’s move, spending its opponent-turn card and granting only currently legal extras.',
  '51. Black ends; unused immediate Plots extras expire before White’s next turn.',
  '52. Ghostwalk replaces White’s move with a1-a2 to an empty square; no obstacle needs bypassing and queenside castling ends.',
  '53. White ends after the replacement rook move.',
  '54. b6-e3 Queen passes c5 and d4, captures e3 Pawn and checks e1 along empty e2.',
  '55. Black ends; White must answer the Queen check on its own turn.',
  '56. g1-h3 is geometrically a knight jump but leaves Qe3-e1 check; only a pending same-turn rescue permits this provisional move.',
  '57. Forbidden City f3 cannot block the e-file check; spend and replace it, retain no marker, undo Nh3 and restore the checked pre-move position.',
  '58. d2-e3 Pawn captures the checking Queen diagonally and legally cures e1 check.',
  '59. White ends after its legal replacement capture with its failed card still spent.',
  '60. g7-g8 is one rook step within Curse; f7 King remains safe.',
  '61. Black ends without altering retained effects.',
  '62. g1-h3 now leaves e1 safe because the checking Queen was captured.',
  '63. White ends after the legal knight jump.',
  '64. f7-e7 is a safe adjacent King square; White’s Queen is blocked by d7 on its rank.',
  '65. Black ends with King e7.',
  '66. e1-d1 is safe and removes White’s last castling right.',
  '67. White ends; neither side can castle.',
  '68. c7-c5 is legal despite earlier pawn movement because c7 is the starting rank; c6 is clear and becomes en passant.',
  '69. Black Curse targets White’s Bishop b5 after its pawn move; marker limits future Bishop distance to two.',
  '70. Black ends; c6 en passant remains available for the immediate reply.',
  '71. b5-d3 passes c4, exactly two diagonal squares within Curse; unused c6 en passant expires.',
  '72. Figure Dance simultaneously moves White h1 Rook to h8 and Black a8 Rook to a1; a1/h8 were empty and no pieces are captured.',
  '73. White ends; b1 Knight blocks the new Black a1 Rook from King d1.',
  '74. e7-e8 is safe; the White h8 Rook is blocked by Black g8 Rook.',
  '75. Black ends with King e8.',
  '76. b7-d5 Queen crosses empty c6 and lands on empty d5.',
  '77. White ends without disturbing the cursed Bishop or Rook.',
  '78. f8-h6 Bishop passes empty g7 and stops on h6.',
  '79. Black ends; f4 Pawn blocks the Bishop’s long diagonal toward d2.',
  '80. d3-f5 Bishop passes e4 and captures Black f5 Pawn at its two-square Curse limit.',
  '81. White ends after the capture; the Bishop remains cursed.',
  '82. b8-a6 is a legal knight jump to an empty square.',
  '83. Black ends; Knight a6 does not check d1.',
  '84. e3-e4 advances the original d2 Pawn one square.',
  '85. White ends with its e4 Pawn blocking the e-file.',
  '86. c5-c4 advances Black’s c-pawn to empty c4.',
  '87. Black ends; the c-pawn threatens b3 and d3, not d1.',
  '88. Breakthrough replaces White’s move: a4 captures forward on a5; the enemy a-pawn is captured, not dead.',
  '89. White ends after the forward capture; no second ordinary move is granted.',
  '90. e6-e5 is a one-square pawn advance to empty e5.',
  '91. Black ends with its e5 Pawn opposed by White e4.',
  '92. h3-f2 is a knight jump into empty f2.',
  '93. White ends; neither King is checked.',
  '94. e8-f8 is safe: g8 Rook blocks White h8 Rook and no white diagonal reaches f8.',
  '95. Black ends with King f8.',
  '96. d1-d2 is safe: b2 Crab blocks Black a1/a2 possibilities and f4 blocks Bishop h6’s diagonal.',
  '97. White ends with its King d2.',
  '98. f8-e8 is a safe King return with no castling rights restored.',
  '99. Black ends; quiet King move advances only its normal clock.',
  '100. h4-h5 is an empty pawn advance; h6 Bishop is not captured.',
  '101. White ends; the h-pawn remains unpromoted.',
  '102. a1-a2 Rook captures White’s original a1 Rook; b2 Crab screens King d2 from the capturing Rook.',
  '103. Black ends with Rook a2 and captured White a-rook.',
  '104. d2-d1 King returns to a safe adjacent square.',
  '105. White ends with King d1.',
  '106. h6-f4 Bishop passes g5 and captures White’s original f2 Pawn.',
  '107. Black ends; the Bishop on f4 does not attack d1.',
  '108. d5-b7 Queen crosses c6 and reaches empty b7.',
  '109. Challenge names the opposing a2 Rook, which can legally capture b2; Black must use that physical Rook next.',
  '110. White ends; Challenge carries into Black’s turn.',
  '111. a2-b2 uses the challenged Rook and captures the Crab; Challenge is fulfilled and Crab expires on capture per artwork.',
  '112. Black ends; Rook b2 threatens rank two, not White King d1.',
  '113. f5-g4 Bishop moves one diagonal square within Curse.',
  '114. White ends after its quiet Bishop move.',
  '115. Resurrection returns captured Black original f7 Pawn to empty g7, a legal initial pawn square; move consumed and pawn clock reset.',
  '116. Black ends after Resurrection; White receives its ordinary turn.',
  '117. d1-c2 King move enters Rb2 check; it is provisional pending a same-turn rescue, never a legal completed turn.',
  '118. Abduction temporarily conceals opposing c4 Pawn; it spends once, keeps clocks and defers final safety while rescue remains unresolved.',
  '119. Reveal changes concealment to recall without captures, movement, draws or clock changes.',
  '120. Black correctly identifies its c4 Pawn; restore it, fail the ineffective rescue, undo Kc2 to d1 and keep Abduction spent.',
]

test('iteration 072 independently reviewed deterministic campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/072.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860072)
  assert.equal(rationales.length, trace.steps.length)
  assert.equal(trace.steps.length, 120)
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 16)
  let state = createGameState(trace.initial)
  const states = [state]
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1
    assert.ok(rationales[index]!.startsWith(`${n}. `))
    const before = state
    const result = applyAction(before, action)
    assert.ok(result.ok, rationales[index])
    state = result.state
    states.push(state)
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const piece = before.pieces.find(p => p.square === action.from && p.zone === 'board')!
      const chess = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap()
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! }
      const provisional = n === 56 || n === 117
      assert.equal(chess.isLegal(move), !provisional, rationales[index])
      // No moving Crab or neutral piece occurs; only the two manually identified
      // provisional rescues differ from ordinary chess safety in this trace.
      chess.play(move)
      assert.equal(makeBoardFen(chess.board), state.fen.split(' ')[0], rationales[index])
      assert.equal(!!state.pendingRescue, provisional)
      const cursed = before.effects.some(e => typeof e === 'object' && e !== null && 'type' in e && e.type === 'curse' && 'pieceId' in e && e.pieceId === piece.id)
      if (cursed) assert.ok(Math.max(Math.abs(move.from % 8 - move.to % 8), Math.abs(Math.floor(move.from / 8) - Math.floor(move.to / 8))) <= 2)
      const captured = before.pieces.find(p => p.square === action.to && p.zone === 'board')
      assert.equal(state.fen.split(' ')[4], piece.role === 'pawn' || captured ? '0' : String(Number(before.fen.split(' ')[4]) + 1))
      assert.equal(state.fen.split(' ')[5], String(Number(before.fen.split(' ')[5]) + (before.turn.color === 'black' ? 1 : 0)))
      const double = piece.role === 'pawn' && Math.abs(move.to - move.from) === 16
      assert.deepEqual(state.enPassant, double ? [{ target: action.from[0] + String((Number(action.from[1]) + Number(action.to[1])) / 2), pawnId: piece.id }] : [])
      assert.deepEqual(state.players.white.hand, before.players.white.hand)
      assert.deepEqual(state.players.black.hand, before.players.black.hand)
    } else if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true)
      assert.equal(!!before.pendingRescue, false)
      assert.equal(state.fen, before.fen)
      assert.deepEqual(state.pieces, before.pieces)
      assert.deepEqual(state.players, before.players)
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } })
    } else if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black'
      const card = before.players[owner].hand.find(c => c.id === action.cardInstanceId)!
      assert.ok(card)
      const timing = CARD_CATALOG[card.cardId]!.timing
      assert.ok(timing.includes(owner === before.turn.color ? before.turn.phase : n === 5 ? 'afterOpponentCard' : 'afterOpponentMove'))
      assert.equal(before.turn.cardPlays[owner], 0)
      assert.equal(state.turn.cardPlays[owner], 1)
      assert.deepEqual(state.players[owner].deck, before.players[owner].deck.slice(n === 5 ? 2 : 1))
      assert.ok(state.players[owner].hand.some(c => c.id === before.players[owner].deck[n === 5 ? 1 : 0]!.id))
      assert.equal(state.players[owner].hand.some(c => c.id === card.id), false)
      const retained = [12, 34, 69].includes(n)
      assert.equal(state.players[owner].discard.some(c => c.id === card.id), !retained)
    }
  }
  const at = (n: number, id: string) => states[n]!.pieces.find(p => p.id === id)!
  assert.deepEqual(states[12]!.effects, [{ type: 'curse', owner: 'white', card: { id: 'white-hand-4-curse', cardId: 'curse' }, pieceId: 'black-rook-h8' }])
  assert.deepEqual(states[34]!.effects[1], { type: 'crab', owner: 'white', card: { id: 'white-deck-3-crab', cardId: 'crab' }, pieceId: 'white-pawn-b2' })
  assert.deepEqual(states[69]!.effects[2], { type: 'curse', owner: 'black', card: { id: 'black-hand-2-curse', cardId: 'curse' }, pieceId: 'white-bishop-f1' })
  assert.deepEqual(states[109]!.effects[3], { type: 'challenge', owner: 'white', player: 'black', pieceId: 'black-rook-a8' })
  for (const n of [5, 12, 34, 50, 69, 109]) assert.equal(states[n]!.fen, states[n - 1]!.fen)
  for (const n of [39, 72, 118]) assert.deepEqual(states[n]!.fen.split(' ').slice(1), states[n - 1]!.fen.split(' ').slice(1))
  for (const n of [4, 25]) {
    assert.equal(states[n]!.fen.split(' ')[4], '0')
    assert.equal(states[n]!.fen.split(' ')[5], states[n - 1]!.fen.split(' ')[5])
  }
  for (const n of [9, 52, 88, 115]) {
    assert.equal(states[n]!.turn.moveMade, true)
    assert.deepEqual(states[n]!.enPassant, [])
    assert.equal(states[n]!.fen.split(' ')[4], n === 52 ? '2' : '0')
    assert.equal(states[n]!.fen.split(' ')[5], String(Number(states[n - 1]!.fen.split(' ')[5]) + ([9, 115].includes(n) ? 1 : 0)))
  }
  for (const id of ['black-pawn-g7', 'black-pawn-h7', 'black-knight-g8']) assert.equal(at(4, id).zone, 'captured')
  assert.equal(states[5]!.players.white.hand.length, 6)
  assert.equal(states[5]!.players.white.hand.at(-1)!.id, 'black-hand-4-fireball')
  assert.equal(states[5]!.players.black.discard.length, 0)
  assert.equal(states[5]!.players.white.discard[0]!.cardId, 'charge')
  for (const file of ['a', 'b', 'c', 'f']) assert.equal(at(9, `black-pawn-${file}7`).square, `${file}6`)
  assert.equal(at(25, 'white-pawn-c2').zone, 'captured')
  assert.equal(at(25, 'black-pawn-b7').zone, 'captured')
  assert.equal(at(25, 'black-pawn-c7').square, 'c6')
  assert.equal(at(39, 'black-pawn-c7').square, 'c7')
  assert.equal(at(52, 'white-rook-a1').square, 'a2')
  assert.equal(states[57]!.fen, states[55]!.fen)
  assert.deepEqual(states[57]!.pieces, states[55]!.pieces)
  assert.deepEqual(states[57]!.effects, states[55]!.effects)
  assert.equal(states[57]!.turn.moveMade, false)
  assert.equal(at(58, 'black-queen-d8').zone, 'captured')
  assert.equal(at(72, 'white-rook-h1').square, 'h8')
  assert.equal(at(72, 'black-rook-a8').square, 'a1')
  assert.equal(states[72]!.pieces.filter(p => p.zone === 'captured').length, states[71]!.pieces.filter(p => p.zone === 'captured').length)
  assert.equal(at(88, 'white-pawn-a2').square, 'a5')
  assert.equal(at(88, 'black-pawn-a7').zone, 'captured')
  assert.equal(at(111, 'black-rook-a8').square, 'b2')
  assert.equal(at(111, 'white-pawn-b2').zone, 'captured')
  assert.deepEqual(states[111]!.effects, [states[12]!.effects[0], states[69]!.effects[2]])
  assert.equal(at(115, 'black-pawn-f7').square, 'g7')
  assert.equal(at(115, 'black-pawn-f7').zone, 'board')
  assert.equal(at(118, 'black-pawn-c7').zone, 'away')
  assert.equal(states[118]!.pendingAbduction!.phase, 'concealment')
  assert.equal(states[119]!.pendingAbduction!.phase, 'recall')
  assert.deepEqual(states[119]!.pieces, states[118]!.pieces)
  assert.equal(states[119]!.fen, states[118]!.fen)
  assert.deepEqual(states[119]!.players, states[118]!.players)
  assert.deepEqual(states[120]!.pieces, states[116]!.pieces)
  assert.equal(states[120]!.fen, states[116]!.fen)
  assert.equal(states[120]!.turn.moveMade, false)
  assert.equal(states[120]!.turn.cardPlays.white, 1)
  assert.equal(!!states[120]!.pendingAbduction, false)
  assert.equal(!!states[120]!.pendingRescue, false)
  assert.deepEqual(states[120]!.players, states[119]!.players)
  assert.equal(replayTrace(trace).fen, '4k1rR/1Q1p2p1/n7/P3p2P/2p1PbB1/8/1r3NP1/1NBK4 w - - 0 27')
})
