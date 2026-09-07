import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import { checkState, digest, type RandomTrace } from './random-campaign.js'

// Independent sequential review: rules §§8–11, 13.12, 15.4, 18.5 and
// cards.md Cathedral/Ghostwalk/Sanctuary/Anathema/Confabulation/Madman/Panic.
// Card timing and persistence were checked against the printed catalog metadata.
// Every quiet move increments the halfmove clock; every pawn move/capture resets
// it. Black completed moves advance fullmove. endTurn preserves both clocks.
// Unless stated otherwise, no cards, identities, rights, or effects change, and
// both Kings remain safe. Each endTurn starts a fresh allowance for both players.
const rationale = [
  '1. White c2-c3 advances one into an empty square; e1 remains shielded.',
  '2. End White turn: Black beforeMove, board and five-card hands unchanged.',
  '3. Black c7-c5 crosses empty c6; record c6 en-passant for the c7 identity.',
  '4. End Black turn: White beforeMove, retain the new c6 opportunity.',
  '5. White a2-a4 crosses empty a3; expire c6 and record a3 for a2 pawn.',
  '6. End White turn: Black beforeMove, retain a3 opportunity.',
  '7. Black Qd8-b6 traverses vacated c7; quiet diagonal expires a3.',
  '8. End Black turn: White beforeMove, queen remains b6.',
  '9. White Ra1-a2 enters the vacated pawn square; revoke White queenside castling.',
  '10. End White turn: Black beforeMove; White kingside and both Black rights remain.',
  '11. Black h7-h5 crosses empty h6; create h6 opportunity.',
  '12. End Black turn: White beforeMove, retain h6 opportunity.',
  '13. White h2-h3 enters empty h3; expire h6 opportunity.',
  '14. End White turn: Black beforeMove, no draw without a discard or played card.',
  '15. Black d7-d6 advances into empty d6; e8 is not exposed to a white slider.',
  '16. End Black turn: White beforeMove; all hands still five.',
  '17. White Qd1-c2 uses the vacated c2 square; quiet one-square diagonal.',
  '18. End White turn: Black beforeMove; no extra piece displacement.',
  '19. Black Nb8-d7 jumps to the vacated d7 square; legal knight geometry.',
  '20. End Black turn: White beforeMove; no capture or effect.',
  '21. White h3-h4 advances into empty h4; opposing h5 pawn blocks further advance only.',
  '22. End White turn: Black beforeMove, pawn remains h4.',
  '23. Black f7-f5 crosses empty f6; create f6 opportunity.',
  '24. End Black turn: White beforeMove, retain f6 opportunity.',
  '25. White c3-c4 advances into empty c4; c5 enemy pawn is not captured; expire f6.',
  '26. Cathedral afterMove swaps owned Ra2/Bc1 atomically, no path/capture; neither King checked. Spend Cathedral, draw Panic, White deck 74.',
  '27. End White turn: Black beforeMove; Cathedral grants no extra move.',
  '28. Black Qb6xb2 follows empty b5,b4,b3 and captures White b2 pawn; queen c2 blocks its rank toward e1.',
  '29. End Black turn: White beforeMove, b2 pawn remains captured.',
  '30. White a4-a5 advances into empty a5 without exposing e1.',
  '31. End White turn: Black beforeMove, no card disposition changes.',
  '32. Black e7-e6 advances one; white queen c2 cannot attack e8.',
  '33. End Black turn: White beforeMove with the existing 74-card deck.',
  '34. Ghostwalk Qc2-d3 is otherwise legal, empty destination and no capture; no passage is required. Spend it, draw Heresy, consume White move, deck 73.',
  '35. End White replacement-move turn: Black beforeMove; e1 remains safe behind its pieces.',
  '36. Black Qb2-a1 takes an empty adjacent diagonal; White Nb1 blocks the first rank.',
  '37. End Black turn: White beforeMove; Black queen a1 retained.',
  '38. Sanctuary uses Ke1/Rc1 with d1 clear: rook d1 and King c1, safely screened by Nb1 from Qa1. Revoke White rights, consume move, draw Madman, deck 72.',
  '39. End White replacement turn: Black beforeMove, no additional move allowed.',
  '40. Black Qa1-f6 traverses empty b2,c3,d4,e5; c1 remains safe.',
  '41. End Black turn: White beforeMove; no en-passant opportunity remains.',
  '42. White Ng1-f3 jumps to empty f3 without affecting the shield on c1.',
  '43. End White turn: Black beforeMove; hands unchanged.',
  '44. Black b7-b5 crosses empty b6; adjacent White a5 pawn can use b6 en-passant.',
  '45. End Black turn: White beforeMove; preserve b6 opportunity.',
  '46. White a5-a6 advances instead of capturing en-passant, so b6 expires.',
  '47. End White turn: Black beforeMove; pawn stays a6.',
  '48. Black Qf6-b2 follows empty e5,d4,c3, checking White Kc1 diagonally; giving check is legal.',
  '49. Anathema afterMove swaps opposing Bf1/Rh1; c1 was already checked, no new mate is produced, and Black e8 stays safe. Spend card, draw Confabulation, Black deck 74.',
  '50. End Black turn: White gets its check-escape turn; swap did not resolve or worsen the b2 queen check.',
  '51. White Kc1xb2 captures the checking queen on an undefended square; Black b5/c5 pawns do not attack b2.',
  '52. End White turn: Black beforeMove; Black queen is captured, never a royal capture.',
  '53. Black b5-b4 advances into empty b4; it attacks a3/c3, not White Kb2.',
  '54. End Black turn: White beforeMove; captured queen remains captured.',
  '55. White Qd3-e4 takes empty adjacent diagonal; e6 pawn shields Black King along e-file.',
  '56. End White turn: Black beforeMove; no hand or effect changes.',
  '57. Confabulation moves Black d6 pawn diagonally onto owned c5 pawn as a friendly capture-shaped merge; one c5 board object, d7 component away, no captured component. Retain effect card, draw Heresy, deck 73, consume Black move.',
  '58. End Black turn: White beforeMove; composite retains both physical pawn identities.',
  '59. White Qe4-d5 takes empty adjacent diagonal; c5 composite attacks b4/d4, not Kb2.',
  '60. End White turn: Black beforeMove; composite persists.',
  '61. Black g7-g5 crosses empty g6; create g6 en-passant opportunity; d5 queen does not check e8.',
  '62. End Black turn: White beforeMove, retain g6 opportunity.',
  '63. White Rf1-e1 enters empty e1; e2 pawn blocks its own rook, expire g6.',
  '64. End White turn: Black beforeMove; existing composite unchanged.',
  '65. Black Ng8-h6 jumps to empty h6, no pin or self-check.',
  '66. End Black turn: White beforeMove; e8 remains safe.',
  '67. White Qd5xf5 traverses empty e5 and captures Black f5 pawn; no royal attack through f8 bishop.',
  '68. End White turn: Black beforeMove; f7 identity is captured.',
  '69. Black e6-e5 advances one; Qf5 attacks e6 rather than e8, so no self-check.',
  '70. End Black turn: White beforeMove; composite and hands preserved.',
  '71. Madman g2-e4-g6 jumps over occupied f3 knight then occupied f5 queen into empty landings; neither jumped piece captured, pawn identity retained. Spend/draw Peace Talks, deck 71, consume move, no promotion.',
  '72. End White replacement turn: Black beforeMove; g6 pawn threatens f7/h7 only.',
  '73. Black Nh6-g8 jumps back to empty g8; legal and safe.',
  '74. End Black turn: White beforeMove; no persistent Madman power.',
  '75. White Qf5-d3 traverses empty e4; quiet diagonal preserves composite.',
  '76. End White turn: Black beforeMove; no cards played.',
  '77. Black Bc8xa6 traverses empty b7 and captures White a6 pawn; Kb2 is not on its diagonal.',
  '78. End Black turn: White beforeMove; a2 pawn identity is captured.',
  '79. White Kb2-c1 takes an empty adjacent square; Ba6 ray b5,c4 stops at c4 pawn, so c1 safe.',
  '80. Panic afterMove assigns Black a 15000ms next-move deadline without moving pieces; spend/draw Merciless, White deck 70, no continuing card retained.',
  '81. End White turn starts Black beforeMove with Panic active; clocks remain 1 20 and both hands have five.',
  '82. FINDING: Panic timeout loses Black turn under rule 18.5. New actor is White beforeMove, so FEN active color must also become w. Engine leaves b; later actions 83–119 remain unreviewed.',
]

test('iteration 019: Panic timeout must publish the new side to move', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/019.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860019)
  assert.equal(rationale.length, 82)
  rationale.forEach((reason, index) => assert.ok(reason.startsWith(`${index + 1}. `)))
  const prefix = trace.steps.slice(0, 81)
  assert.equal(prefix.filter(step => step.action.type === 'move').length, 35)
  assert.equal(prefix.filter(step => step.action.type === 'playCard').length, 7)
  let state = createGameState(trace.initial)
  for (const [index, step] of prefix.entries()) {
    const result = applyAction(state, step.action)
    assert.ok(result.ok, rationale[index])
    state = result.state
    checkState(state)
    assert.equal(digest(state), step.expected, rationale[index])
  }
  assert.equal(state.fen, 'r3kbnr/p2n4/b5P1/2p1p1pp/1pP4P/3Q1N2/B2PPP2/1NKRR2B b kq - 1 20')
  assert.equal(state.turn.color, 'black')
  assert.equal(state.turn.phase, 'beforeMove')
  assert.deepEqual(state.enPassant, [])
  assert.deepEqual([state.players.white.deck.length, state.players.black.deck.length], [70, 73])
  assert.deepEqual([state.players.white.hand.length, state.players.black.hand.length], [5, 5])
  assert.deepEqual(state.pieces.filter(piece => piece.zone === 'captured').map(piece => piece.id).sort(),
    ['black-pawn-f7', 'black-queen-d8', 'white-pawn-a2', 'white-pawn-b2'])
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-d7')?.zone, 'away')
  assert.deepEqual(state.effects.map(effect => (effect as { type: string }).type), ['confabulation', 'panic'])
  const timeout = trace.steps[81]!
  assert.deepEqual(timeout.action, { type: 'panicTimeout' })
  const result = applyAction(state, timeout.action)
  assert.ok(result.ok)
  assert.equal(result.state.turn.color, 'white')
  assert.equal(result.state.turn.phase, 'beforeMove')
  assert.equal(result.state.turn.moveMade, false)
  assert.deepEqual(result.state.pieces, state.pieces, 'timeout cannot move or capture pieces')
  assert.equal(result.state.fen.split(' ')[1], 'w', rationale[81])
})
