import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Chess } from 'chessops/chess'
import { makeBoardFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import { replayTrace, type RandomTrace } from './random-campaign.js'

// Reviewed sequentially against rules §§8–11, 15.1, 15.4, 18.1, 22.9, 22.11
// and the printed timing/effect metadata in catalog.ts and cards.md.
const rationales = [
  '1. a2-a3: White pawn advances into an empty square; reset halfmove, both Kings screened.',
  '2. End White turn: preserve a3 and clocks; Black receives its move and fresh allowances.',
  '3. Ng8-h6: legal knight jump into empty h6; Black King remains screened; fullmove becomes 2.',
  '4. End Black turn: White starts, with no board or card changes.',
  '5. f2-f4: f3/f4 empty, starting pawn double step; record f3 opportunity and reset halfmove.',
  '6. End White turn: retain the new f3 opportunity for Black.',
  '7. e7-e5: e6/e5 empty, double step replaces the f3 opportunity with e6; King remains safe.',
  '8. End Black turn: retain e6 opportunity for White.',
  '9. a3-a4: single forward step into empty a4; expire e6 opportunity.',
  '10. End White turn: Black starts with the same position and empty en-passant list.',
  '11. Nh6-g8: reverse knight jump; no capture or opened King line.',
  '12. End Black turn: White starts, unchanged board and hands.',
  '13. f4-f5: empty forward square, nonpromoting pawn move; King remains screened.',
  '14. End White turn: Black starts with pawn on f5.',
  '15. b7-b5: b6/b5 empty, starting double step; create b6 opportunity.',
  '16. End Black turn: preserve b6 opportunity for White.',
  '17. f5-f6: single pawn advance, not en passant; expire b6 opportunity, no promotion.',
  '18. End White turn: Black starts, no available en-passant victim.',
  '19. Bf8-a3: e7,d6,c5,b4 clear and a3 vacated; diagonal move does not expose e8.',
  '20. End Black turn: bishop remains a3; White can capture it.',
  '21. Ng1-h3: legal empty-square knight jump, White King remains screened.',
  '22. End White turn: Black receives its normal move.',
  '23. g7-g6: empty one-step pawn advance; neither King attacked.',
  '24. End Black turn: White starts, no card accounting changes.',
  '25. Nb1xa3: knight captures physical black-bishop-f8; White King remains safe.',
  '26. Neutrality after White move: opposing g8 Knight qualifies; retain owner/identity, mark neutral, retain card and draw Doppelganger.',
  '27. End White turn: reset allowance while preserving g8 neutrality.',
  '28. d7-d6: empty forward move; static neutral g8 Knight attacks neither King.',
  '29. End Black turn: neutrality persists without another draw.',
  '30. g2-g4: g3/g4 empty; double pawn step creates g3 opportunity; neither King threatened by g8.',
  '31. End White turn: retain g3 opportunity for Black.',
  '32. g6-g5: single forward move, g5 empty; expires g3 opportunity.',
  '33. End Black turn: White receives fresh move and allowances.',
  '34. Rh1-g1: adjacent empty file; revoke only White kingside castling right.',
  '35. End White turn: queenside castling survives; Black starts.',
  '36. d6-d5: empty forward pawn move; no capture or King exposure.',
  '37. Rebirth after Black move relocates opposing g4 Pawn to empty a2, a valid White pawn starting square; identity preserved, clocks unchanged, discard and draw No Quarter.',
  '38. End Black turn: White has pawn identities a2 and a4; no en-passant creation.',
  '39. b2-b4: b3/b4 empty; creates b3 opportunity, no unsafe King line.',
  '40. End White turn: preserve b3 opportunity for Black.',
  '41. a7-a5: a6/a5 empty; starting double move replaces b3 with a6 opportunity.',
  '42. End Black turn: a6 opportunity persists for White.',
  '43. d2-d3: empty forward move; clears a6 opportunity and opens d2 to Queen.',
  '44. End White turn: Black starts, Kings remain safe.',
  '45. e5-e4: empty single forward move, White e1 still shielded by e2 pawn.',
  '46. End Black turn: no card or effect changes.',
  '47. Qd1-d2: vacated d2 is reachable and empty; no King exposure.',
  '48. End White turn: Black starts with Queen still d2.',
  '49. c7-c6: one empty forward square; Black King remains safe.',
  '50. End Black turn: White receives its move.',
  '51. Na3xb5: knight captures original black b7 Pawn, no pin or King exposure.',
  '52. Man-Trap after White move marks f6 occupied by White pawn; no immediate capture; retain trap card and draw Figure Dance.',
  '53. End White turn: trap stays at f6 and Neutrality stays on g8 Knight.',
  '54. c6-c5: empty forward move does not enter trap; effects persist.',
  '55. End Black turn: White starts, no new draws.',
  '56. b4xa5: White pawn diagonally captures black a7 Pawn; no promotion or King exposure.',
  '57. End White turn: Black can use the neutral Knight under both-King safety.',
  '58. Ng8xf6: neutral Knight legally captures White f2 pawn, then opposing arrival springs f6 Man-Trap; Knight also captured, Neutrality expires and both effect cards discard. Both Kings safe after removal.',
  '59. No Quarter immediately follows Black regular capture: original white f2 pawn becomes dead; trap-captured Knight stays captured; discard and draw Anathema.',
  '60. End Black turn: trap and neutrality remain expired; White begins.',
  '61. e2-e3: empty forward step; White King e1 is not attacked through e-file because black e4 Pawn blocks.',
  '62. End White turn: Black starts with e3 Pawn on board.',
  '63. Nb8-a6: empty knight destination, no King line exposed.',
  '64. End Black turn: White starts, no effects active.',
  '65. Qd2-c3: empty diagonal square; e1 safe behind e3/e4 material.',
  '66. End White turn: same position, Black starts.',
  '67. f7-f6: single forward move enters old trap square safely because trap already spent.',
  '68. End Black turn: no recurring trap capture; White starts.',
  '69. d3-d4: empty forward square, stops before black d5 pawn; no capture.',
  '70. End White turn: Black starts with both d-file pawns blocked.',
  '71. Rh8-g8: adjacent empty square; revoke Black kingside castling only.',
  '72. End Black turn: only Qq castling rights remain.',
  '73. Rg1xg5: g2,g3,g4 empty after Rebirth; capture black g7 Pawn and reset halfmove.',
  '74. End White turn: Black can capture g5 Rook later; no forced response yet.',
  '75. Bc8-f5: d7,e6 clear and f5 empty; no attack on White King through e4 blocker.',
  '76. End Black turn: latest opponent mover is a Bishop for Doppelganger.',
  '77. Doppelganger before White move uses Bishop powers f1-c4 via empty e2,d3; noncapturing replacement consumes move, increments halfmove, spends card and draws Confabulation.',
  '78. End White turn: replacement has consumed move despite regular-command count remaining 36.',
  '79. f6xg5: Black pawn captures original white h1 Rook; King safe, halfmove reset.',
  '80. End Black turn: White starts after the rook capture.',
  '81. Nh3xg5: knight captures original black f7 Pawn; no King attack at e8.',
  '82. End White turn: Black starts, hands unchanged.',
  '83. Qd8-b6: c7 clear and b6 empty; diagonal Queen move, no self-check.',
  '84. Holy War after Black move swaps own Knight a6 with Bishop f5; no capture, paths irrelevant; no direct mate or self-check; discard and draw Squaring the Circle.',
  '85. End Black turn: Knight f5 and Bishop a6 keep physical identities.',
  '86. Bc4-e2: d3 clear, e2 empty; ordinary backward diagonal move.',
  '87. End White turn: Black starts without effects.',
  '88. Nf5xd4: knight captures white d2 Pawn; White King e1 is not a Knight target.',
  '89. End Black turn: White starts with d4 occupied by Black Knight.',
  '90. Be2-h5: f3,g4 clear; gives check along h5-g6-f7-e8, permitted for a regular move.',
  '91. End White turn: Black must answer Bishop check.',
  '92. Breakthrough e4xe3 cannot answer h5-e8 check, so replacement fizzles; board/clocks restored, card spent and Mystic Shield drawn, regular move remains available because turn began checked.',
  '93. Ke8-d7: adjacent empty d7 is outside Bishop h5 line and all White attacks; revoke remaining Black castling right.',
  '94. End Black turn: check answered; White starts with Q castling right.',
  '95. Confabulation: Qc3-e3 via empty d3 merges with own Pawn e3; Queen becomes away component, Pawn carrier gains Queen powers; consume replacement move and retain card, draw Heresy.',
  '96. End White turn: two components occupy one effective square, no new check against d7.',
  '97. Qb6-h6: c6,d6,e6,f6,g6 clear; h6 empty and both Kings remain safe.',
  '98. End Black turn: Queen h6 stops behind White Bishop h5 on h-file.',
  '99. Composite e3-h3: Queen component supplies horizontal move via f3,g3; Pawn remains carrier, Queen remains away; no promotion; pawn move resets clock.',
  '100. End White turn: merged identities retained at h3; Black starts.',
  '101. Kd7-e7: empty adjacent square outside h5 Bishop and h3 composite Queen lines and both Knights; legal King move.',
  '102. Vendetta after Black move: retain unique effect and draw Hostage; White has legal captures, including Ng5xe4.',
  '103. End Black turn: White starts under mandatory-capture effect.',
  '104. Ng5xe4: legal Knight capture of black e7 Pawn satisfies Vendetta and leaves e1 safe.',
  '105. Black Hostage immediate reaction substitutes original h7 Pawn for captured e7 Pawn; returned identity h7, original h7 captured, White Knight remains e4; same FEN, clocks and turn, Black allowance spent and Treason drawn.',
  '106. End White turn: Black reaction allowance resets; Black has d5xe4 legal capture so Vendetta persists.',
  '107. d5xe4: Black Pawn captures white g1 Knight, satisfies Vendetta; no King exposure.',
  '108. End Black turn: White has Nb5xd4, so Vendetta persists.',
  '109. Nb5xd4: White Knight captures black b8 Knight, satisfies Vendetta, Kings safe.',
  '110. End White turn: Black has c5xd4 capture; effect persists.',
  '111. c5xd4: Black Pawn captures white b1 Knight, satisfies Vendetta; fullmove becomes 27.',
  '112. End Black turn: White still has Bc1xh6 via d2,e3,f4,g5, so Vendetta remains; final White before-move position is safe.',
]

test('iteration 024 deterministic semantic review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/024.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860024)
  assert.equal(rationales.length, trace.steps.length)
  assert.equal(trace.moves, 50)
  assert.equal(trace.steps.filter(({ action }) => action.type === 'playCard').length, 10)
  let state = createGameState(trace.initial)
  const neutrality = { type: 'neutrality', owner: 'white', card: { id: 'white-hand-0-neutrality', cardId: 'neutrality' }, pieceId: 'black-knight-g8' }
  const trap = { type: 'man-trap', owner: 'white', card: { id: 'white-hand-3-man-trap', cardId: 'man-trap' }, square: 'f6' }
  const merge = { type: 'confabulation', owner: 'white', card: { id: 'white-deck-2-confabulation', cardId: 'confabulation' }, pieceIds: ['white-pawn-e2', 'white-queen-d1'] }
  const vendetta = { type: 'vendetta', owner: 'black', card: { id: 'black-hand-2-vendetta', cardId: 'vendetta' } }
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1
    const reason = rationales[index]!
    assert.ok(reason.startsWith(`${step}. `))
    const before = state
    const result = applyAction(before, action)
    assert.ok(result.ok, reason)
    state = result.state
    assert.equal(state.orientation, 0, reason)
    assert.equal(Boolean(state.pendingRescue), false, reason)
    assert.equal(Boolean(state.outcome), false, reason)
    assert.deepEqual(state.effects, step < 26 ? [] : step < 52 ? [neutrality] : step < 58 ? [neutrality, trap] : step < 95 ? [] : step < 102 ? [merge] : [merge, vendetta], reason)
    if (action.type === 'move') {
      const from = parseSquare(action.from as string)!
      const to = parseSquare(action.to as string)!
      const position = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap()
      // The composite's actual Queen mode supplies its sideways move (§15.4).
      if (step === 99) position.board.set(from, { color: 'white', role: 'queen' })
      const move = { from, to }
      assert.ok(position.isLegal(move), reason)
      position.play(move)
      if (step === 58) position.board.take(to) // Man-Trap captures arriving neutral Knight.
      if (step === 99) position.board.set(to, { color: 'white', role: 'pawn' })
      assert.equal(state.fen.split(' ')[0], makeBoardFen(position.board), reason)
      const mover = before.pieces.find(piece => piece.square === action.from)!
      const victim = before.pieces.find(piece => piece.square === action.to)
      const { neutralBeforeEffects: _expiredNeutrality, ...unmarkedMover } = mover
      assert.deepEqual(state.pieces.find(piece => piece.id === mover.id), step === 58
        ? { ...unmarkedMover, square: null, zone: 'captured', neutral: false }
        : { ...mover, square: action.to }, reason)
      if (victim) assert.deepEqual(state.pieces.find(piece => piece.id === victim.id), { ...victim, square: null, zone: 'captured' }, reason)
      const clocks = before.fen.split(' ').slice(4).map(Number)
      assert.deepEqual(state.fen.split(' ').slice(4).map(Number), [mover.role === 'pawn' || victim || step === 58 ? 0 : clocks[0]! + 1, clocks[1]! + (before.turn.color === 'black' ? 1 : 0)], reason)
      assert.equal(state.turn.color, before.turn.color, reason)
      assert.equal(state.turn.moveMade, true, reason)
      const distance = Math.abs(Number((action.from as string)[1]) - Number((action.to as string)[1]))
      assert.deepEqual(state.enPassant, mover.role === 'pawn' && distance === 2 ? [{ target: `${(action.from as string)[0]}${(Number((action.from as string)[1]) + Number((action.to as string)[1])) / 2}`, pawnId: mover.id }] : [], reason)
    } else if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen, reason)
      assert.deepEqual(state.pieces, before.pieces, reason)
      assert.deepEqual(state.players, before.players, reason)
      assert.deepEqual(state.enPassant, before.enPassant, reason)
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }, reason)
    } else if (action.type === 'playCard') {
      assert.equal(typeof action.cardInstanceId, 'string', reason)
      const owner = String(action.cardInstanceId).startsWith('white-') ? 'white' : 'black'
      const prior = before.players[owner]
      assert.deepEqual(state.players[owner].hand, [...prior.hand.filter(card => card.id !== action.cardInstanceId), prior.deck[0]], reason)
      assert.deepEqual(state.players[owner].deck, prior.deck.slice(1), reason)
      assert.deepEqual(state.players[owner === 'white' ? 'black' : 'white'], before.players[owner === 'white' ? 'black' : 'white'], reason)
      const continuing = [26, 52, 95, 102].includes(step)
      assert.deepEqual(state.players[owner].discard, continuing ? prior.discard : [...prior.discard, prior.hand.find(card => card.id === action.cardInstanceId)], reason)
      assert.equal(state.turn.cardPlays[owner], 1, reason)
      assert.equal(state.turn.color, before.turn.color, reason)
      assert.equal(state.turn.moveMade, [77, 95].includes(step) ? true : before.turn.moveMade, reason)
      assert.equal(state.turn.phase, [77, 95].includes(step) ? 'afterMove' : before.turn.phase, reason)
      assert.deepEqual(state.enPassant, before.enPassant, reason)
      if (![37, 77, 84, 95].includes(step)) assert.equal(state.fen, before.fen, reason)
      if (![77, 95].includes(step)) assert.equal(state.fen.split(' ').slice(1).join(' '), before.fen.split(' ').slice(1).join(' '), reason)
      if (step === 26) assert.deepEqual(state.pieces, before.pieces.map(piece => piece.id === 'black-knight-g8' ? { ...piece, neutral: true, neutralBeforeEffects: false } : piece), reason)
      if ([52, 102].includes(step)) assert.deepEqual(state.pieces, before.pieces, reason)
      if (step === 37) assert.deepEqual(state.pieces, before.pieces.map(piece => piece.id === 'white-pawn-g2' ? { ...piece, square: 'a2' } : piece), reason)
      if (step === 59) assert.deepEqual(state.pieces, before.pieces.map(piece => piece.id === 'white-pawn-f2' ? { ...piece, zone: 'dead' } : piece), reason)
      if (step === 77) {
        assert.deepEqual(state.pieces, before.pieces.map(piece => piece.id === 'white-bishop-f1' ? { ...piece, square: 'c4' } : piece), reason)
        assert.equal(state.fen, 'r2qk1r1/7p/n4p2/PNpp1bR1/P1BPp3/2Q1P2N/P1P4P/R1B1K3 b Qq - 2 19')
      }
      if (step === 84) assert.deepEqual(state.pieces, before.pieces.map(piece => piece.id === 'black-knight-b8' ? { ...piece, square: 'f5' } : piece.id === 'black-bishop-c8' ? { ...piece, square: 'a6' } : piece), reason)
      if (step === 92) {
        assert.deepEqual(state.pieces, before.pieces, reason)
        assert.equal(state.turn.moveMade, false, reason)
        assert.equal(state.history.at(-1)?.type, 'cardFizzled', reason)
      }
      if (step === 95) {
        assert.deepEqual(state.pieces, before.pieces.map(piece => piece.id === 'white-queen-d1' ? { ...piece, square: null, zone: 'away' } : piece), reason)
        assert.equal(state.fen, 'r5r1/3k3p/bq6/PNpp2NB/P2np3/4P3/P1P4P/R1B1K3 b Q - 3 23')
      }
      if (step === 105) assert.deepEqual(state.pieces, before.pieces.map(piece => piece.id === 'black-pawn-e7' ? { ...piece, square: 'h7', zone: 'board' } : piece.id === 'black-pawn-h7' ? { ...piece, square: null, zone: 'captured' } : piece), reason)
    }
    if (step === 58) {
      assert.deepEqual(state.players.white.discard.map(card => card.cardId), ['neutrality', 'man-trap'], reason)
      assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-f2')?.zone, 'captured', reason)
    }
  }
  assert.equal(state.fen, 'r5r1/4k2p/b6q/P6B/P2pp3/7P/P1P4P/R1B1K3 w Q - 0 27')
  assert.deepEqual(state, replayTrace(trace))
})
