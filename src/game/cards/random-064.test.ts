import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Chess } from 'chessops/chess'
import { makeBoardFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import { checkState, digest, type RandomTrace } from './random-campaign.js'

// §§1–2 preserve ordinary chess and its capture counter unless overridden.
// Cards checked against cards.md, catalog timing and Rebirth artwork KC6_card1.
// Stop at the FIRST invalid state; generated actions 60–111 remain unreviewed.
const rationales = [
  '1. Nb1-a3 is an unobstructed knight jump to an empty square; e1 stays safe.',
  '2. White ends its completed move; Black receives a fresh before-move allowance.',
  '3. Ng8-h6 is an empty knight destination; the black back rank remains protected.',
  '4. Black ends its completed move; White receives a fresh allowance.',
  '5. c2-c4 crosses empty c3 and lands empty; the pawn creates c3 en passant and resets the counter.',
  '6. After moving, Disintegration kills the owned g2 Pawn permanently; no capture or extra move, one draw.',
  '7. End turn preserves the c3 opportunity and dead Pawn; Black receives its move.',
  '8. Nb8-a6 is a legal knight jump; it expires the preceding en-passant opportunity.',
  '9. Black ends its knight move without a card; no automatic discard or draw.',
  '10. Qd1-b3 passes empty c2; no capture and no exposure of the White King.',
  '11. Crab legally marks owned unpromoted h2 after the move; its physical card stays active and is replaced.',
  '12. End turn retains the h2 Crab marker and resets card allowances.',
  '13. b7-b6 is an empty forward pawn step; no Crab affects this Black Pawn.',
  '14. Black closes the completed pawn move; board and hands remain unchanged.',
  '15. Bf1-g2 uses the square vacated by Disintegration; no capture and e1 is safe.',
  '16. Haunting Memories copies the last nonunique Crab after the move, marking c4 with its own physical card.',
  '17. White closes its move with both Crab markers retained; no extra draw.',
  '18. f7-f5 passes empty f6 to empty f5 and creates the f6 en-passant opportunity.',
  '19. End turn retains f6 for White while resetting the move and card allowance.',
  '20. e2-e3 is a normal empty forward step, clears f6 and resets the counter.',
  '21. White ends its pawn move; neither Crab marker nor card zones change.',
  '22. b6-b5 is a normal forward pawn step to empty b5; fullmove advances after Black.',
  '23. Black ends its move; White starts with an unchanged board.',
  '24. Qb3-c2 is a one-square empty diagonal; no King line is exposed.',
  '25. White ends its queen move with no optional discard requested.',
  '26. e7-e5 crosses empty e6 and creates e6 en passant; it is the Pawn first move.',
  '27. End turn retains the e6 opportunity and both Crab effects.',
  '28. Qc2-a4 passes empty b3; no capture, and e6 en passant expires.',
  '29. White closes the queen move; board, pieces and cards are unchanged.',
  '30. Qd8-f6 passes vacated e7; no capture and the Black King remains safe.',
  '31. Black closes its queen move; White receives its next move.',
  '32. Bg2-c6 crosses empty f3/e4/d5; neither King is in check after this noncapture.',
  '33. White closes its bishop move without activating Crusade.',
  '34. Bf8-c5 crosses vacated e7 and empty d6; Black King remains safe.',
  '35. Black closes its bishop move with both Crab markers unchanged.',
  '36. Ke1-f1 enters an unattacked empty square and permanently removes White castling rights.',
  '37. Figure Dance simultaneously rotates all four Rooks a1→h1→h8→a8→a1; no capture, all castling rights gone. Rh8 checks e8 but Qf8 can block, so not mate.',
  '38. White ends safely; Black starts in escapable rook check, retaining its available move.',
  '39. Qf6-f8 crosses empty f7 and blocks the h8 Rook check along the eighth rank.',
  '40. Black safely closes the resolved checking turn; no card or effect changes.',
  '41. e3-e4 advances to an empty square; f1 is protected and the pawn counter resets.',
  '42. White ends its pawn move; Black receives an unchanged position.',
  '43. Na6-b4 is a legal empty knight jump without uncovering attack on e8.',
  '44. Black ends its knight move; no card expenditure occurs.',
  '45. Bc6xd7 captures the original d7 Pawn and checks e8 diagonally; halfmove resets.',
  '46. White closes safely; Black may answer the Bishop check on its own turn.',
  '47. Ke8-e7 escapes d7 Bishop check to an unattacked empty square; the h8 Rook is blocked by f8 Queen.',
  '48. Black ends with its King safe on e7; White has a fresh before-move window.',
  '49. Breakthrough replaces the move: owned e4 Pawn captures opposing e5 Pawn straight forward, resets clocks and spends/draws once.',
  '50. White closes the consumed replacement move; no additional ordinary move is available.',
  '51. b5xa4 captures the White Queen diagonally, leaves e7 safe, and advances Black fullmove.',
  '52. Black closes the capture window; the Queen remains captured, not dead.',
  '53. Na3-c2 jumps to an empty square without exposing the White King on f1.',
  '54. White closes its knight move; Black receives a before-move card window.',
  '55. Betrayal kills White e5 Pawn on Black half and returns captured Black d7 Pawn there; death/replacement preserves clocks and ordinary move.',
  '56. f5-f4 is a normal Black Pawn step after its before-move card; counter resets and fullmove advances.',
  '57. Black ends; its spent card allowance resets and the e5 replacement stays on board.',
  '58. Kf1-g2 enters an unattacked empty square; f4 Pawn attacks e3/g3, not g2.',
  '59. FINDING: Rebirth legally moves opposing a7 Pawn to starting-rank d7, capturing the owned Bishop. The capture must reset halfmove to 0 under ordinary draw rules (§§1–2); actual counter incorrectly stays 1. Fullmove remains 14, Black remains FEN active, and White remains afterMove.',
]

test('iteration 064: Rebirth capture resets the halfmove clock at first invalid action 59', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/064.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860064)
  assert.equal(rationales.length, 59)
  assert.equal(trace.steps.slice(0, 59).filter(step => step.action.type === 'move').length, 26)
  assert.equal(trace.steps.slice(0, 59).filter(step => step.action.type === 'playCard').length, 7)
  let state = createGameState(trace.initial)
  for (const [index, step] of trace.steps.slice(0, 59).entries()) {
    const before = state
    const result = applyAction(before, step.action)
    assert.ok(result.ok, rationales[index])
    state = result.state
    checkState(state)
    const action = step.action
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      // Neither Crab moves in this reviewed prefix. Crab attacks have normal
      // forward-diagonal pawn geometry, so ordinary chess independently applies.
      assert.ok(!['white-pawn-h2', 'white-pawn-c2'].includes(before.pieces.find(p => p.square === action.from)!.id) || index < 10)
      const position = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap()
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! }
      assert.ok(position.isLegal(move), rationales[index])
      position.play(move)
      assert.equal(makeBoardFen(position.board), state.fen.split(' ')[0], rationales[index])
      assert.equal(state.turn.color, before.turn.color)
      assert.equal(state.turn.phase, 'afterMove')
      assert.equal(state.turn.moveMade, true)
      assert.deepEqual(state.players, before.players)
    } else if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen)
      assert.deepEqual(state.pieces, before.pieces)
      assert.deepEqual(state.effects, before.effects)
      assert.deepEqual(state.players, before.players)
      assert.deepEqual(state.enPassant, before.enPassant)
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } })
    } else if (action.type === 'playCard') {
      const owner = index === 54 ? 'black' : 'white'
      const previous = before.players[owner]
      const card = previous.hand.find(c => c.id === action.cardInstanceId)!
      assert.ok(card)
      assert.deepEqual(state.players[owner].hand, [...previous.hand.filter(c => c.id !== card.id), previous.deck[0]])
      assert.deepEqual(state.players[owner].deck, previous.deck.slice(1))
      assert.equal(state.turn.cardPlays[owner], 1)
      const continuing = ['crab', 'haunting-memories'].includes(action.cardId)
      assert.deepEqual(state.players[owner].discard, continuing ? previous.discard : [...previous.discard, card])
      assert.deepEqual(state.players[owner === 'white' ? 'black' : 'white'], before.players[owner === 'white' ? 'black' : 'white'])
    }
    const piece = (id: string) => state.pieces.find(p => p.id === id)!
    if (index === 4) assert.deepEqual(state.enPassant, [{ target: 'c3', pawnId: 'white-pawn-c2' }])
    if (index === 5) {
      assert.deepEqual(piece('white-pawn-g2'), { ...before.pieces.find(p => p.id === 'white-pawn-g2'), square: null, zone: 'dead' })
      assert.deepEqual(state.enPassant, before.enPassant)
    }
    if (index === 10 || index === 15) {
      assert.deepEqual(state.pieces, before.pieces)
      assert.equal(state.fen, before.fen)
      assert.deepEqual(state.effects, [...before.effects, { type: 'crab', owner: 'white', card: { id: index === 10 ? 'white-hand-0-crab' : 'white-hand-4-haunting-memories', cardId: index === 10 ? 'crab' : 'haunting-memories' }, pieceId: index === 10 ? 'white-pawn-h2' : 'white-pawn-c2' }])
    }
    if (index === 36) {
      for (const [id, square] of [['white-rook-a1', 'h1'], ['white-rook-h1', 'h8'], ['black-rook-a8', 'a1'], ['black-rook-h8', 'a8']]) assert.equal(piece(id!).square, square)
      assert.equal(state.fen, 'r1b1k2R/p1pp2pp/n1B2q1n/1pb1pp2/Q1P5/N3P3/PP1P1P1P/r1B2KNR b - - 5 9')
    }
    if (index === 48) {
      assert.equal(piece('white-pawn-e2').square, 'e5')
      assert.equal(piece('black-pawn-e7').zone, 'captured')
      assert.equal(state.fen, 'r1b2q1R/p1pBk1pp/7n/1pb1Pp2/QnP5/N7/PP1P1P1P/r1B2KNR b - - 0 12')
      assert.equal(state.turn.moveMade, true)
    }
    if (index === 54) {
      assert.equal(piece('white-pawn-e2').zone, 'dead')
      assert.equal(piece('black-pawn-d7').square, 'e5')
      assert.equal(state.turn.moveMade, false)
      assert.deepEqual(state.fen.split(' ').slice(1), before.fen.split(' ').slice(1))
    }
    if (index === 58) {
      assert.equal(piece('black-pawn-a7').square, 'd7')
      assert.equal(piece('white-bishop-f1').zone, 'captured')
      assert.deepEqual(state.turn, { ...before.turn, cardPlays: { white: 1, black: 0 } })
      assert.deepEqual(state.effects, before.effects)
      assert.deepEqual(state.enPassant, [])
      assert.equal(state.fen, 'r1b2q1R/2ppk1pp/7n/2b1p3/pnP2p2/8/PPNP1PKP/r1B3NR b - - 0 14', rationales[index])
    } else {
      assert.equal(digest(state, 1), step.expected, rationales[index])
    }
  }
})
