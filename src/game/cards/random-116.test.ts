import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Board } from 'chessops/board'
import { makeFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { type RandomTrace } from './random-campaign.js'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameState, PieceState, SquareName } from '../types.js'

// Rules §§8–11, 13.1, 14.4, 17.3, 19.3, 20 and 21.1; catalog printed timing.
// Stop at first suspected defect, action 79. Generated actions 80–111 are unreviewed.
const rationale = [
  '1. e2-e4: initial Pawn double step through empty e3; e3 opportunity, Pawn clock reset.',
  '2. End White turn, retaining e3 opportunity for Black and resetting card allowances.',
  '3. a7-a6: empty forward square; previous e3 opportunity expires.',
  '4. Black Anathema after move swaps White Bf1/Rh1 without capture or clock advance; spend and draw Treason.',
  '5. End Black turn; swapped identities stay f1/h1.',
  '6. b2-b4: empty b3/b4, new b3 en-passant opportunity.',
  '7. End White turn; retain b3 opportunity.',
  '8. a6-a5: forward Pawn move to empty a5, clears b3 opportunity.',
  '9. End Black turn; board and cards unchanged.',
  '10. Ng1-h3 is a legal jump to an empty square, increment quiet clock.',
  '11. White Fortification after move marks adjacent a1/a2; keep physical card active and draw Merciless.',
  '12. End White turn; wall persists independently of its occupied endpoints.',
  '13. f7-f5: clear f6/f5; Pawn clock zero and f6 opportunity.',
  '14. End Black turn retaining f6 opportunity.',
  '15. Qd1-g4 crosses empty e2/f3; no wall on this diagonal.',
  '16. End White turn; no draw without a card/discard.',
  '17. e7-e5 crosses empty e6; e6 opportunity and Pawn clock reset.',
  '18. End Black turn retaining e6 opportunity.',
  '19. a2-a3 advances forward; does not cross the a1/a2 wall.',
  '20. End White turn; old en-passant opportunity has expired.',
  '21. Ng8-h6 jumps legally to an empty square.',
  '22. White reacts with Plots after opposing move; spend/draw Ghostwalk, without moving or granting a new ordinary move.',
  '23. Black Treason after its move swaps opposing Rf1/Nh3, preserving identities; spend/draw Fireball.',
  '24. End Black turn closes unused Plots allowance; both players reset card counts.',
  '25. White Bombard replaces move: Rh3-h7 jumps only Nh6 and captures black h7 Pawn; h4/h5 clear; draw Riposte.',
  '26. End White turn after replacement move, with capture attributed to White.',
  '27. Rh8-g8 slides one empty square; revoke Black kingside castling right.',
  '28. End Black turn without further effects.',
  '29. b4xa5: White b-Pawn diagonally captures physical Black a-Pawn, capturedBy White.',
  '30. End White turn after Pawn capture.',
  '31. d7-d6 advances one empty square.',
  '32. End Black turn, no card-zone changes.',
  '33. d2-d4 through empty d3; preserve d3 opportunity for reply.',
  '34. End White turn retaining d3 opportunity.',
  '35. Bc8-e6 passes empty d7; quiet diagonal clears prior en-passant.',
  '36. End Black turn; royal safety verified independently.',
  '37. Ke1-d1 is adjacent and safe; revoke White remaining castling rights.',
  '38. End White turn after King displacement.',
  '39. Qd8-f6 passes empty e7; safe ordinary diagonal.',
  '40. End Black turn with no capture or card.',
  '41. Ghostwalk Ra1-e1 passes own Nb1/Bc1/Kd1, ends empty; horizontal path does not cross a1/a2; replaces move and draws Anathema.',
  '42. End White turn after Ghostwalk; no extra ordinary move.',
  '43. Be6-d7 retreats one diagonal square.',
  '44. End Black turn with wall unchanged.',
  '45. h2-h4 crosses empty h3; Pawn clock zero and h3 opportunity.',
  '46. End White turn retaining h3 opportunity.',
  '47. f5-f4 advances to empty f4, ending h3 opportunity.',
  '48. End Black turn; no card zone changes.',
  '49. Qg4-h3 moves one diagonal square to empty h3.',
  '50. White Anathema swaps Black Bd7/Rg8 after move, without capture; draw Assassin.',
  '51. End White turn with physical Bishop now g8 and Rook d7.',
  '52. b7-b6 advances one square to empty b6.',
  '53. End Black turn with all retained identities intact.',
  '54. Qh3-d3 slides through empty g3/f3/e3.',
  '55. End White turn after quiet Queen move.',
  '56. d6-d5 advances one empty square, zeroing Pawn clock.',
  '57. End Black turn after Pawn move.',
  '58. Qd3-a6 passes empty c4/b5; ordinary diagonal.',
  '59. End White turn after Queen relocation.',
  '60. Bf8-c5 passes empty e7/d6; ordinary diagonal.',
  '61. End Black turn without card play.',
  '62. Kd1-d2 is adjacent and safe; d4 Pawn blocks the d7 Rook ray.',
  '63. End White turn; both royals remain on board.',
  '64. Bc5-d6 retreats one diagonal square.',
  '65. End Black turn; royal safety unchanged.',
  '66. Qa6-c8 passes empty b7 and checks Ke8 across empty d8; ordinary move may check.',
  '67. End White turn; Black receives its checked turn.',
  '68. Nh6-g4 is a geometric jump but does not cure Qc8-e8 check: provisional rescue required under §11.6.',
  '69. Holy War Ng4/Bg8 cannot block Qc8-e8; spend/draw Riposte and roll back provisional Knight move, clocks and history.',
  '70. Ke8-e7 cures the rank-eight check; Rook h7 ray is blocked by own Black g7 Pawn; revoke Black castling rights.',
  '71. End Black turn after legal replacement of provisional move.',
  '72. Kd2-d1 is adjacent and safe.',
  '73. End White turn without new effects.',
  '74. Rd7-d8 advances along its file to empty d8.',
  '75. End Black turn after Rook move.',
  '76. Qc8-e6 crosses empty d7 and checks adjacent Ke7.',
  '77. End White turn; checked Black may capture the Queen or otherwise escape.',
  '78. Rd8-d7 is geometrically legal but leaves Ke7 checked by Qe6; hold provisional move for a saving card.',
  '79. Doomsayer must first offer White its immediate naming option (§19.3): naming queen can capture White Qe6 and cure check (§11.6); retain provisional Rd7 and defer final safety until choice.',
]

test('iteration 116: Doomsayer must expose its immediate rescue choice at action 79', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/116.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860116)
  assert.equal(rationale.length, 79)
  const prefix = trace.steps.slice(0, rationale.length)
  assert.equal(prefix.filter(step => step.action.type === 'move').length, 35)
  assert.equal(prefix.filter(step => step.action.type === 'playCard').length, 9)
  let actual = createGameState(trace.initial)
  const pieces = structuredClone(actual.pieces)
  const players = structuredClone(actual.players)
  let turn = structuredClone(actual.turn)
  let ep: GameState['enPassant'] = []
  let half = 0, full = 1
  let fenColor: Color = 'white'
  let rights = parseFen(actual.fen).unwrap().castlingRights
  const effects: unknown[] = []
  let checkpoint: { pieces: PieceState[]; half: number; full: number; fenColor: Color; rights: typeof rights; ep: typeof ep } | undefined
  const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white'
  const at = (square: string) => pieces.find(piece => piece.zone === 'board' && piece.square === square)
  const threatened = (color: Color): boolean => {
    const king = pieces.find(piece => piece.royal && piece.owner === color)!
    const target = parseSquare(king.square!)!
    return pieces.some(piece => {
      if (piece.zone !== 'board' || piece.owner === color) return false
      const from = parseSquare(piece.square!)!
      const dx = (target % 8) - (from % 8), dy = (target >> 3) - (from >> 3)
      if (piece.role === 'pawn') return Math.abs(dx) === 1 && dy === (piece.owner === 'white' ? 1 : -1)
      if (piece.role === 'knight') return Math.abs(dx) * Math.abs(dy) === 2
      if (piece.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1
      if (!(piece.role !== 'bishop' && (!dx || !dy) || piece.role !== 'rook' && Math.abs(dx) === Math.abs(dy))) return false
      const stride = Math.sign(dx) + 8 * Math.sign(dy)
      for (let square = from, next = from + stride; ; square = next, next += stride) {
        if (effects.length && ((square === 0 && next === 8) || (square === 8 && next === 0))) return false
        if (next === target) return true
        if (pieces.some(item => item.zone === 'board' && parseSquare(item.square!) === next)) return false
      }
    })
  }
  const move = (from: string, to: string, mode = 'ordinary') => {
    assert.match(from, /^[a-h][1-8]$/)
    assert.match(to, /^[a-h][1-8]$/)
    const mover = at(from)!
    assert.ok(mover)
    assert.equal(mover.owner, turn.color)
    const victim = at(to)
    const dx = to.charCodeAt(0) - from.charCodeAt(0), dy = Number(to[1]) - Number(from[1])
    const fromIndex = parseSquare(from)!, toIndex = parseSquare(to)!
    if (mover.role === 'knight') assert.equal(Math.abs(dx) * Math.abs(dy), 2)
    else if (mover.role === 'king') assert.equal(Math.max(Math.abs(dx), Math.abs(dy)), 1)
    else {
      if (mover.role === 'pawn') {
        const forward = mover.owner === 'white' ? 1 : -1
        assert.equal(dx, victim ? (dx < 0 ? -1 : 1) : 0)
        assert.ok(dy === forward || (!victim && dy === 2 * forward && ['2', '7'].includes(from[1]!)))
      } else assert.ok((mover.role !== 'bishop' && (!dx || !dy)) || (mover.role !== 'rook' && Math.abs(dx) === Math.abs(dy)))
      const stride = Math.sign(dx) + 8 * Math.sign(dy)
      let blockers = 0
      for (let square = fromIndex, next = fromIndex + stride; ; square = next, next += stride) {
        assert.ok(!(effects.length && ((square === 0 && next === 8) || (square === 8 && next === 0))), 'wall crossing')
        if (next === toIndex) break
        const blocker = pieces.find(item => item.zone === 'board' && parseSquare(item.square!) === next)
        if (blocker) {
          blockers++
          if (mode === 'ghostwalk') assert.equal(blocker.owner, mover.owner)
        }
      }
      if (mode !== 'ghostwalk') assert.ok(blockers <= (mode === 'bombard' ? 1 : 0))
    }
    if (victim) {
      assert.equal(victim.owner, opposite(mover.owner))
      assert.equal(victim.royal, false)
      victim.square = null; victim.zone = 'captured'; victim.capturedBy = turn.color
    }
    ep = []
    if (mover.role === 'pawn' && Math.abs(dy) === 2) ep = [{ target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName, pawnId: mover.id }]
    half = mover.role === 'pawn' || victim ? 0 : half + 1
    if (turn.color === 'black') full++
    fenColor = opposite(turn.color)
    if (mover.royal) for (const square of mover.owner === 'white' ? [0, 7] : [56, 63]) rights = rights.without(square)
    if (mover.originalRole === 'rook') rights = rights.without(parseSquare(mover.id.slice(-2))!)
    mover.square = to as SquareName
    turn.phase = 'afterMove'; turn.moveMade = true
  }
  for (const [index, { action }] of prefix.entries()) {
    const step = index + 1
    const label = rationale[index]!
    assert.ok(label.startsWith(`${step}. `))
    const input = structuredClone(actual)
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      if (step === 68 || step === 78) checkpoint = { pieces: structuredClone(pieces), half, full, fenColor, rights, ep: structuredClone(ep) }
      move(action.from, action.to)
    } else if (action.type === 'endTurn') {
      assert.equal(threatened(turn.color), false, label)
      turn = { color: opposite(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
    } else if (action.type === 'playCard') {
      const owner: Color = step === 22 ? 'white' : turn.color
      const player = players[owner]
      const cardIndex = player.hand.findIndex(card => card.id === action.cardInstanceId)
      assert.ok(cardIndex >= 0, label)
      const [card] = player.hand.splice(cardIndex, 1)
      assert.equal(card!.cardId, action.cardId)
      turn.cardPlays[owner]++
      if (action.cardId === 'fortification') effects.push({ type: 'fortification', owner, card, from: 'a1', to: 'a2' })
      else if (step === 79) effects.push({ type: 'doomsayer', owner, card })
      else player.discard.push(card!)
      const replacement = player.deck.shift()
      assert.ok(replacement)
      player.hand.push(replacement)
      if (step === 4 || step === 23 || step === 50) {
        const [from, to] = step === 4 ? ['f1', 'h1'] : step === 23 ? ['f1', 'h3'] : ['d7', 'g8']
        const first = at(from!)!, second = at(to!)!
        assert.equal(first.owner, opposite(owner)); assert.equal(second.owner, opposite(owner))
        first.square = to as SquareName; second.square = from as SquareName
      } else if (step === 25) move('h3', 'h7', 'bombard')
      else if (step === 41) move('a1', 'e1', 'ghostwalk')
      else if (step === 69) {
        assert.ok(checkpoint)
        pieces.splice(0, pieces.length, ...structuredClone(checkpoint.pieces))
        ;({ half, full, fenColor, rights, ep } = checkpoint)
        turn.phase = 'beforeMove'; turn.moveMade = false
      }
    } else assert.fail(`Unexpected action: ${action.type}`)
    const result = applyAction(actual, action)
    assert.deepEqual(actual, input, `${label}: complete input immutability`)
    assert.ok(result.ok, label)
    actual = result.state
    // Build expected FEN from independently moved physical identities and counters.
    const setup = parseFen(createGameState().fen).unwrap()
    setup.board = Board.empty()
    for (const piece of pieces) if (piece.zone === 'board') setup.board.set(parseSquare(piece.square!)!, { color: piece.owner, role: piece.role })
    setup.turn = fenColor; setup.castlingRights = rights; setup.epSquare = undefined
    setup.halfmoves = half; setup.fullmoves = full
    assert.deepEqual(actual.pieces, pieces, `${label}: all physical fields, zones and captors`)
    assert.equal(actual.fen, makeFen(setup), `${label}: full FEN, castling and clocks`)
    assert.deepEqual(actual.players, players, `${label}: every physical card in hand/deck/discard`)
    assert.deepEqual(actual.turn, turn, `${label}: complete turn`)
    assert.deepEqual(actual.enPassant, ep, `${label}: independent en-passant opportunities`)
    assert.equal(actual.orientation, 0, label)
    assert.equal(actual.outcome, null, label)
    assert.equal(threatened('white'), false, `${label}: White royal safety`)
    assert.equal(threatened('black'), [66, 67, 68, 69, 76, 77, 78, 79].includes(step), `${label}: Black royal safety`)
    assert.equal(!!actual.pendingRescue, [68, 78, 79].includes(step), `${label}: rescue iff expected`)
    assert.deepEqual(actual.pendingDoomsayer ?? null, step === 79 ? { player: 'white', cardInstanceId: 'black-hand-0-doomsayer' } : null, `${label}: immediate choice`)
    assert.equal(actual.pendingAbduction ?? null, null, label)
    assert.deepEqual(actual.underElfHill ?? [], [], label)
    assert.deepEqual(actual.effects, effects, `${label}: complete retained effect records`)
  }
})
