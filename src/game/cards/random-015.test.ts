import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { applyAction, isKingInCheck } from '../reducer.js'
import { createGameState } from '../state.js'
import { checkState, digest, type RandomTrace } from './random-campaign.js'

// Rules §§8–11, 17.1 and cards.md; catalog supplies printed timing.
// Review stops at the first invalid history event, action 65. Artifact actions 66–107
// are retained for reproducibility but are not approved or counted as reviewed.
const review = [
  '1. h2-h4 crosses empty h3 to empty h4; original pawn double-step creates h3 en-passant, resets clock, and keeps e1 safe.',
  '2. End White turn; h3 opportunity survives, board/cards unchanged, Black starts with fresh allowances.',
  '3. d7-d6 is one empty forward pawn step; clears h3 opportunity, resets clock and increments Black fullmove.',
  '4. End Black turn without card or discard; White starts, no other changes.',
  '5. c2-c4 crosses empty c3, creates c3 en-passant, and leaves both kings safe.',
  '6. End White turn preserves c3 opportunity for Black; neither hand changes.',
  '7. Black Ghostwalk bishop c8-h3 uses diagonal d7,e6,f5,g4 to empty h3; no enemy obstruction or capture, f2 blocks its line toward e1. Replacement move clears en-passant, advances clocks; discard Ghostwalk and draw Cowardice once.',
  '8. End Black replacement turn; White starts and card allowance resets without another draw.',
  '9. c4-c5 is empty forward pawn step; no promotion or capture and e1 stays safe.',
  '10. End White turn preserves position and hands; Black starts.',
  '11. e7-e6 is an empty forward pawn step; Black clock advances, no king exposure.',
  '12. End Black turn; White starts with unchanged pieces/cards.',
  '13. Ng1-f3 is a legal knight jump to an empty square; e1 remains shielded by f2.',
  '14. End White turn; no card expenditure or board changes.',
  '15. Qd8-e7 is one empty diagonal step; Black king e8 remains safe.',
  '16. End Black turn; White starts, hands and board unchanged.',
  '17. e2-e3 is a clear pawn step, not exposing e1 to the bishop h3 because f2 blocks.',
  '18. End White turn; Black starts without changes to pieces or cards.',
  '19. g7-g6 is one empty forward pawn step; resets halfmove, increments fullmove.',
  '20. End Black turn; both kings safe and no reaction pending.',
  '21. Bf1-d3 passes empty e2 to empty d3; normal noncapture, e1 safe.',
  '22. End White turn; Black starts, neither hand changes.',
  '23. f7-f5 crosses empty f6 to empty f5; creates f6 en-passant, no adjacent White pawn can use it.',
  '24. End Black turn preserves f6 opportunity; clocks and hands unchanged.',
  '25. Qd1-c2 is one diagonal to the vacated pawn square; clears f6 opportunity, e1 safe.',
  '26. End White turn; Black starts with no outstanding obligations.',
  '27. Ke8-d7 is adjacent and unattacked: Bd3 ray ends at Black f5 and White c5 pawn attacks d6. Black castling rights are revoked.',
  '28. End Black turn preserves White castling rights and both hands.',
  '29. Qc2-d1 returns diagonally to empty d1; ordinary noncapture clock advances.',
  '30. End White turn; Black starts with unchanged board and cards.',
  '31. Nb8-a6 is a knight jump to an empty square; d7 remains safe.',
  '32. End Black turn; White starts without another draw.',
  '33. Ke1-f1 moves to an unattacked adjacent square; h3 bishop is blocked by g2 toward f1. White castling rights end.',
  '34. End White turn preserves absent castling rights and unchanged hands.',
  '35. h7-h5 crosses empty h6, creates h6 en-passant and resets pawn clock.',
  '36. After-move Cathedral swaps owned Ra8 and Bh3 without capture or extra move. Identities persist, neither king is checked, h6 opportunity survives; discard Cathedral and draw Crusade once.',
  '37. End Black turn after Cathedral; White starts, allowance resets, no second draw.',
  '38. c5xd6 captures physical black-pawn-d7 diagonally; White pawn identity reaches d6, victim is captured, h6 opportunity clears.',
  '39. End White turn closes optional Hostage response without spending it; Black starts.',
  '40. Rh3-g3 is one empty horizontal step; f1 shielded by g2 and f2, Black d7 stays safe.',
  '41. End Black turn; no card, draw, or additional movement.',
  '42. Nf3-g5 is an empty knight jump; moving it does not expose White king f1.',
  '43. End White turn; both card allowances reset for Black turn.',
  '44. Kd7-c6 is adjacent and not attacked by d6 pawn (c7/e7), Ng5, or Bd3; Black king identity persists.',
  '45. End Black turn; White starts with no pending obligations.',
  '46. d6-d7 is an empty forward pawn step, not yet promotion; Black king c6 remains legal.',
  '47. End White turn; cards unchanged, no en-passant created.',
  '48. Qe7-a3 traverses empty d6,c5,b4; no capture and neither king is exposed.',
  '49. End Black turn; White starts, board and card zones unchanged.',
  '50. Lost Castle would swap Rh1 with enemy Rg3, exposing Kf1 along h1-g1-f1. §11.6 restores board and spends replacement move because White began safe; discard card and draw Earthquake once.',
  '51. End White failed replacement turn; clocks retain consumed move, Black starts.',
  '52. Kc6-c5 is adjacent and unattacked by Bd3, Ng5, or d7 pawn; noncapture clock advances.',
  '53. End Black turn; White starts, no card-state changes.',
  '54. Bd3-b5 crosses empty c4; bishop is next to c5 king but does not attack horizontally. White f1 remains safe.',
  '55. End White turn; Black starts with unchanged hands.',
  '56. b7-b6 is one forward pawn step to empty b6; Black c5 remains safe.',
  '57. End Black turn; White starts without a draw.',
  '58. Qd1-a4 crosses empty c2,b3; b5 bishop blocks queen toward c6, so Black c5 is not checked.',
  '59. End White turn; Black starts, no other state changes.',
  '60. Kc5-d6 is adjacent and unattacked: Qa4 diagonal toward d7 is blocked by own Bb5, and Ng5 does not attack d6.',
  '61. End Black turn; White starts with original king identities intact.',
  '62. Ng5-f7 is a normal empty knight jump that checks Kd6; White f1 remains safe.',
  '63. End White checking turn; Black may answer check with a move or eligible card.',
  '64. Kd6-e5 remains attacked by Nf7, so §11.6 requires same-turn rescue. Rebirth can legally relocate that enemy knight to vacant starting square g1; the move is provisional, clocks advance and pendingRescue is present.',
  '65. White Chaos is an immediate opponent-move reaction with unused allowance. It restores Black king d6, clocks 3/16, and a replacement opportunity banning d6-e5. White f1 stays safe and Kd5 is a different escape, so Chaos succeeds, spends/draws once and must record cardPlayed rather than cardFizzled SELF_CHECK.',
]

test('iteration 015: Chaos cancellation of a provisional check escape is successful, not a self-check fizzle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/015.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(review.length, 65)
  assert.ok(review.every((rationale, index) => rationale.startsWith(`${index + 1}. `)))
  assert.equal(trace.steps.slice(0, 65).filter(step => step.action.type === 'move').length, 30)
  assert.equal(trace.steps.slice(0, 65).filter(step => step.action.type === 'playCard').length, 4)
  let state = createGameState(trace.initial)
  for (const [index, step] of trace.steps.slice(0, 64).entries()) {
    const before = digest(state)
    const result = applyAction(state, step.action)
    assert.equal(digest(state), before, `action ${index + 1} must be immutable`)
    assert.ok(result.ok, review[index])
    checkState(result.state)
    assert.equal(digest(result.state), step.expected, review[index])
    state = result.state
  }
  assert.ok(state.pendingRescue)
  assert.equal(isKingInCheck(state, 'white'), false)
  const rescue = applyAction(state, { type: 'playCard', cardId: 'rebirth', target: [{ from: 'f7', to: 'g1' }] })
  assert.ok(rescue.ok, 'action 64 has a real same-turn card rescue')
  assert.equal(isKingInCheck(rescue.state, 'black'), false)
  assert.ok(!rescue.state.pendingRescue)
  const result = applyAction(state, trace.steps[64]!.action)
  assert.ok(result.ok)
  const final = result.state
  checkState(final)
  assert.equal(final.fen, 'b4bnr/p1pP1N2/np1kp1p1/1B3p1p/Q6P/q3P1r1/PP1P1PP1/RNB2K1R b - - 3 16')
  assert.equal(final.pieces.find(piece => piece.id === 'black-king-e8')?.square, 'd6')
  assert.equal(final.pieces.find(piece => piece.id === 'white-knight-g1')?.square, 'f7')
  assert.equal(final.pieces.find(piece => piece.id === 'black-pawn-d7')?.zone, 'captured')
  assert.equal(isKingInCheck(final, 'white'), false)
  assert.deepEqual(final.chaosForbidden, { player: 'black', movement: 'black-king-e8:d6:e5' })
  assert.equal(final.turn.color, 'black')
  assert.equal(final.turn.phase, 'beforeMove')
  assert.equal(final.turn.moveMade, false)
  assert.deepEqual(final.turn.cardPlays, { white: 1, black: 0 })
  assert.ok(!final.pendingRescue)
  assert.equal(final.players.white.deck.length, 73)
  assert.deepEqual(final.players.white.discard.map(card => card.cardId), ['lost-castle', 'chaos'])
  assert.equal(final.players.white.hand.length, 5)
  assert.equal(final.players.white.hand.at(-1)?.cardId, 'forbidden-city')
  const escape = applyAction(final, { type: 'move', from: 'd6', to: 'd5' })
  assert.ok(escape.ok, 'Chaos does not create board mate: Kd5 escapes the knight')
  assert.equal(isKingInCheck(escape.state, 'black'), false)
  assert.equal(final.history.at(-1)?.type, 'cardPlayed', review[64])
})
