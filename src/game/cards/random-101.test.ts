import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { GameState, PieceState, Role, SquareName } from '../types.js'
import { parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { CARD_CATALOG } from './catalog.js'

// Each numbered entry was reviewed in order against rules §§8–15, 17, 22,
// cards.md and the printed timing/duration metadata in CARD_CATALOG.
const rationale = [
  '1 g2-g3 is an empty one-step white Pawn advance.',
  '2 White completes its move; only the turn changes.',
  '3 h7-h6 is an empty one-step black Pawn advance.',
  '4 Black hands the unchanged board to White.',
  '5 g3-g4 advances the same Pawn one empty square.',
  '6 White ends without playing or discarding a card.',
  '7 Blessing moves e7-h4 along clear f6,g5 without capture; consumes the move.',
  '8 Black ends the Blessing replacement turn.',
  '9 Nb1-c3 is a vacant Knight jump.',
  '10 White ends its Knight move.',
  '11 Rh8-h7 uses the emptied adjacent square and loses kingside rights.',
  '12 Black ends with kingside rights still lost.',
  '13 f2-f3 advances one empty square.',
  '14 White ends the Pawn move.',
  '15 f7-f5 traverses empty f6 and grants the f6 en-passant opportunity.',
  '16 Black preserves the f6 opportunity for White.',
  '17 Nc3-b5 is a vacant Knight jump and expires the f6 opportunity.',
  '18 Rebirth returns enemy e7 identity from h4 to its empty original Pawn rank.',
  '19 White ends after its move and Rebirth; the card remains spent.',
  '20 Rh7-h8 returns without recovering castling rights.',
  '21 Black ends the Rook move.',
  '22 Ng1-h3 is a vacant Knight jump.',
  '23 White ends the Knight move.',
  '24 h6-h5 advances the black h-Pawn one square.',
  '25 Black ends the Pawn move.',
  '26 Nh3-g1 returns by Knight geometry.',
  '27 Curse marks enemy Qd8 after the move; its physical card remains active.',
  '28 White ends with Curse still attached to Qd8.',
  '29 Rh8-h6 passes through empty h7; Curse affects only Qd8.',
  '30 Black ends the Rook move.',
  '31 Dubbing permits the white b2 Pawn to jump to empty c4 as a Knight.',
  '32 White ends its Dubbing replacement move.',
  '33 Rh6-a6 crosses empty g6,f6,e6,d6,c6,b6.',
  '34 Black ends the horizontal Rook move.',
  '35 Ra1-b1 uses the vacated Knight square and loses queenside rights.',
  '36 White ends with only kingside castling rights remaining.',
  '37 g7-g5 traverses empty g6 and creates the g6 en-passant opportunity.',
  '38 Black preserves g6 for the next turn.',
  '39 Bf1-g2 is a clear one-step diagonal and expires g6.',
  '40 White ends the Bishop move.',
  '41 d7-d5 passes empty d6 and creates d6 en passant.',
  '42 Black preserves d6 for White.',
  '43 Ke1-f1 enters an unattacked vacant square and loses all white castling rights.',
  '44 White ends with its King safe on f1.',
  '45 Madman jumps f5-h3 over the white g4 Pawn without capturing it.',
  '46 Black ends its Madman replacement move.',
  '47 Fanatic advances f3-f6 through empty f4,f5,f6, creating no en passant.',
  '48 White ends its Fanatic replacement move.',
  '49 h5-h4 advances the black h-Pawn to an empty square.',
  '50 Black ends the Pawn move.',
  '51 d2-d4 traverses empty d3 and creates d3 en passant.',
  '52 White preserves d3 for Black.',
  '53 d5xc4 captures the white b2 physical Pawn for Black and expires d3.',
  '54 Black ends after capturing the b2 identity.',
  '55 d4-d5 is an empty white Pawn advance.',
  '56 Think Again cancels only step 55, restores d4 and its clocks, and forbids repeating it.',
  '57 Qd1-e1 is a distinct replacement move; Black retains its reaction allowance expenditure.',
  '58 White ends; the reaction allowance resets for the next turn.',
  '59 e7-e6 advances the Pawn returned by Rebirth.',
  '60 Black ends the returned Pawn move.',
  '61 Bc1-f4 passes through empty d2,e3.',
  '62 White ends the Bishop move.',
  '63 Ra6-a4 passes empty a5.',
  '64 Black ends the Rook move.',
  '65 Nb5-a3 is a vacant Knight jump.',
  '66 Haunting Memories copies non-unique Think Again, restores Nb5 and the preceding clocks.',
  '67 Qe1-d2 is a different replacement move; the copied cancellation stays spent.',
  '68 White ends after the replacement Queen move.',
  '69 Qd8-e7 moves one diagonal square, within Curse’s two-square limit.',
  '70 Black ends with Curse following its Queen.',
  '71 f6xe7 captures Black’s Queen for White; Curse expires on capture by printed duration.',
  '72 White ends with Curse discarded and the Queen captured.',
  '73 a7-a6 is an empty one-square Pawn advance.',
  '74 Black ends the Pawn move.',
  '75 a2-a3 is an empty one-square Pawn advance.',
  '76 White ends the Pawn move.',
  '77 Ng8-f6 is a vacant Knight jump.',
  '78 Earthquake rotates forward directions clockwise; opponent h2 promotes Queen, then a6 Knight.',
  '79 Black ends with orientation 90 and both promoted identities retained.',
  '80 Kf1-f2 enters an empty unattacked square under the rotated Pawn attacks.',
  '81 White ends with its King safe on f2.',
  '82 Ra8-a7 uses the empty adjacent square and loses Black’s final castling right.',
  '83 Black ends without castling rights.',
  '84 Breakthrough g4xh4 captures forward to the right under Earthquake; no authorized promotion.',
  '85 White ends the replacement capture with the h-Pawn still a Pawn.',
  '86 Nf6-d5 is a vacant Knight jump.',
  '87 Black ends the Knight move.',
  '88 Bg2-e4 crosses empty f3.',
  '89 White ends the Bishop move.',
  '90 Nd5xe7 captures White’s original f2 Pawn for Black.',
  '91 Black ends after the Knight capture.',
  '92 Qd2-e3 uses an empty adjacent diagonal.',
  '93 White ends the Queen move.',
  '94 The promoted a7 Pawn uses Knight geometry a6-b4.',
  '95 Black ends with promotion preserved.',
  '96 Rb1-d1 crosses empty c1.',
  '97 White ends the Rook move.',
  '98 g5xf4 is a rotated black Pawn capture, taking White’s c1 Bishop for Black.',
  '99 Rebirth places the enemy Rook on empty a1, a fixed original setup square despite rotation.',
  '100 Black ends after its capture and Rebirth.',
  '101 Confabulation Be4-c2 crosses empty d3 and merges with the friendly Pawn, retaining both identities.',
  '102 White ends with the Bishop component away and its powers attached to c2.',
  '103 Ra7-a5 crosses empty a6.',
  '104 Black ends the Rook move.',
  '105 Kf2-f1 returns to an unattacked empty square.',
  '106 White ends with its royal identity on f1.',
  '107 Ra4xa3 captures White’s a2 Pawn for Black.',
  '108 Black ends after the Rook capture.',
  '109 The c2 composite moves to empty d3 using its Bishop component; its Pawn identity stays carrier.',
  '110 White ends with the composite intact at d3.',
  '111 c4xb5 captures left/up under rotated black Pawn geometry, taking White’s b1 Knight.',
  '112 Black ends after the rotated Pawn capture.',
  '113 Qe3xe6 traverses empty e4,e5 and captures Black’s original e7 Pawn.',
  '114 White ends; Ne7 still separates Qe6 from the black King on e8.',
  '115 Guardian b7-a7 advances left to empty a7; the optional c7 follower remains stationary.',
  '116 Black ends the Guardian replacement move without promotion or en passant.',
  '117 The promoted h2 Queen captures f4 diagonally through empty g3, taking Black’s g7 Pawn.',
  '118 White ends move 50 with both Kings safe and the composite and Earthquake retained.',
]

const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const
function geometry(state: GameState, piece: PieceState, to: string, capture: boolean, role: Role = piece.role): boolean {
  const [x, y] = xy(piece.square!); const [tx, ty] = xy(to)
  const dx = tx - x; const dy = ty - y; const ax = Math.abs(dx); const ay = Math.abs(dy)
  const occupied = (x: number, y: number) => state.pieces.some(p => p.zone === 'board' && p.square === String.fromCharCode(97 + x) + (y + 1))
  if (!ax && !ay) return false
  if (role === 'knight') return ax * ay === 2
  if (role === 'king') return Math.max(ax, ay) === 1
  if (role === 'pawn') {
    const sign = piece.owner === 'white' ? 1 : -1
    const forward = state.orientation === 90 ? dx * sign : dy * sign
    const sideways = state.orientation === 90 ? ay : ax
    if (capture) return forward === 1 && sideways === 1
    const rank = state.orientation === 90 ? (sign === 1 ? x : 7-x) : (sign === 1 ? y : 7-y)
    return sideways === 0 && (forward === 1 || forward === 2 && rank < 2 && !occupied(x + Math.sign(dx), y + Math.sign(dy)))
  }
  if (role === 'bishop' && ax !== ay || role === 'rook' && ax && ay || role === 'queen' && ax !== ay && ax && ay) return false
  if (state.effects.some(e => (e as {type?: string; pieceId?: string}).type === 'curse' && (e as {pieceId?: string}).pieceId === piece.id) && Math.max(ax, ay) > 2) return false
  for (let n = 1; n < Math.max(ax, ay); n++) if (occupied(x + n * Math.sign(dx), y + n * Math.sign(dy))) return false
  return true
}

function safe(state: GameState, color: 'white' | 'black') {
  const king = state.pieces.find(p => p.owner === color && p.royal)!
  for (const p of state.pieces.filter(p => p.zone === 'board' && p.owner !== color)) {
    const roles: Role[] = [p.role]
    for (const e of state.effects) {
      const effect = e as {type?: string; pieceIds?: string[]}
      if (effect.type === 'confabulation' && effect.pieceIds?.includes(p.id)) {
        roles.push(...state.pieces.filter(q => effect.pieceIds!.includes(q.id)).map(q => q.role))
      }
    }
    assert.ok(!roles.some(role => geometry(state, p, king.square!, true, role)), `${p.id} attacks ${color} King`)
  }
}

test('iteration 101 preserves its generated replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/101.json', import.meta.url), 'utf8')) as RandomTrace
  assert.ok(replayTrace(trace))
})

test('iteration 101 independently verifies every physical transition and complete input immutability', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/101.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(rationale.length, trace.steps.length)
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50)
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 13)
  let state = createGameState(trace.initial)
  const states: GameState[] = []
  for (const [index, {action}] of trace.steps.entries()) {
    const step = index + 1; const reason = rationale[index]!
    assert.ok(reason.startsWith(`${step} `))
    const before = structuredClone(state); states.push(before)
    const expected = structuredClone(before)
    const actor = before.turn.color
    let clocks = before.fen.split(' ').slice(1)
    const at = (s: string) => expected.pieces.find(p => p.zone === 'board' && p.square === s)!
    const relocate = (from: string, to: string, capture: boolean) => {
      const mover = at(from); assert.ok(mover, reason)
      const victim = at(to)
      assert.equal(!!victim, capture, reason)
      if (victim) { assert.notEqual(victim.owner, mover.owner); assert.equal(victim.royal, false); victim.zone = 'captured'; victim.square = null; victim.capturedBy = actor }
      mover.square = to as SquareName
      return mover
    }
    const spend = (owner: 'white' | 'black', continuing: boolean) => {
      assert.equal(action.type, 'playCard'); if (action.type !== 'playCard') return
      const player = expected.players[owner]
      const i = player.hand.findIndex(c => c.id === action.cardInstanceId)
      assert.ok(i >= 0, reason)
      const [card] = player.hand.splice(i, 1)
      assert.equal(card!.cardId, action.cardId)
      if (!continuing) player.discard.push(card!)
      player.hand.push(player.deck.shift()!)
      expected.turn.cardPlays[owner]++
    }
    const completeMove = (pawnOrCapture: boolean) => {
      clocks[0] = actor === 'white' ? 'b' : 'w'
      clocks[2] = '-'
      clocks[3] = pawnOrCapture ? '0' : String(Number(clocks[3]) + 1)
      clocks[4] = String(Number(clocks[4]) + (actor === 'black' ? 1 : 0))
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true
      expected.enPassant = []
    }
    if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true)
      expected.turn = {color: actor === 'white' ? 'black' : 'white', phase:'beforeMove', moveMade:false, cardPlays:{white:0,black:0}}
    } else if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const mover = at(action.from); const capture = !!at(action.to)
      const role = step === 109 ? 'bishop' : mover.role
      assert.equal(mover.owner, actor)
      assert.ok(geometry(before, mover, action.to, capture, role), reason)
      const pawn = mover.role === 'pawn'
      relocate(action.from, action.to, capture); completeMove(pawn || capture)
      if (mover.royal) clocks[1] = clocks[1]!.replace(actor === 'white' ? /[KQ]/g : /[kq]/g, '') || '-'
      if (mover.originalRole === 'rook') {
        const right = ({a1:'Q',h1:'K',a8:'q',h8:'k'} as Record<string,string>)[action.from]
        if (right) clocks[1] = clocks[1]!.replace(right, '') || '-'
      }
      if (pawn && before.orientation === 0 && Math.abs(xy(action.to)[1]-xy(action.from)[1]) === 2) {
        expected.enPassant = [{target: (action.from[0]! + (Number(action.from[1])+Number(action.to[1]))/2) as SquareName, pawnId:mover.id}]
      }
      if (step === 71) {
        expected.effects = []
        expected.players.white.discard.push({id:'white-deck-0-curse',cardId:'curse'})
      }
    } else if (action.type === 'playCard') {
      const reactor = step === 56 || step === 66
      const owner = reactor ? 'black' : actor
      assert.equal(before.turn.cardPlays[owner], 0)
      const meta = CARD_CATALOG[action.cardId]!
      assert.ok(meta.timing.includes(reactor ? 'afterOpponentMove' : before.turn.phase))
      if (reactor) {
        const checkpoint = states[index-1]!
        expected.pieces = structuredClone(checkpoint.pieces)
        expected.enPassant = structuredClone(checkpoint.enPassant)
        clocks = checkpoint.fen.split(' ').slice(1)
        expected.turn.phase = 'beforeMove'; expected.turn.moveMade = false
      } else if (step === 27) {
        expected.effects.push({type:'curse',owner,card:{id:action.cardInstanceId,cardId:'curse'},pieceId:'black-queen-d8'})
      } else if (step === 78) {
        expected.orientation = 90
        for (const [square, role] of [['h2','queen'],['a6','knight']] as const) { at(square).role=role; at(square).promoted=true }
        expected.effects.push({type:'earthquake',owner,card:{id:action.cardInstanceId,cardId:'earthquake'},direction:'clockwise',target:{direction:'clockwise',promotions:[{square:'h2',role:'queen'},{square:'a6',role:'knight'}]}})
      } else if (step === 101) {
        assert.ok(geometry(before, at('e4'), 'c2', false))
        assert.equal(at('c2').owner, owner)
        const bishop = at('e4'); bishop.zone='away'; bishop.square=null
        expected.effects.push({type:'confabulation',owner,card:{id:action.cardInstanceId,cardId:'confabulation'},pieceIds:['white-pawn-c2','white-bishop-f1']})
        completeMove(false)
      } else {
        const movement: Record<number,[string,string,boolean]> = {7:['e7','h4',false],18:['h4','e7',false],31:['b2','c4',false],45:['f5','h3',false],47:['f3','f6',false],84:['g4','h4',true],99:['d1','a1',false],115:['b7','a7',false]}
        const [from,to,capture] = movement[step]!
        if (step === 7) assert.ok(geometry(before, at(from), to, false, 'bishop'))
        if (step === 31) assert.ok(geometry(before, at(from), to, false, 'knight'))
        if (step === 45) assert.equal(at('g4').id, 'white-pawn-g2')
        if (step === 47) for (const sq of ['f4','f5','f6']) assert.equal(at(sq), undefined)
        if (step === 84 || step === 115) assert.equal(xy(to)[0]-xy(from)[0], actor === 'white' ? 1 : -1)
        const mover = relocate(from,to,capture)
        if (step !== 18 && step !== 99) completeMove(mover.role === 'pawn' || capture)
      }
      spend(owner, meta.continuing)
    } else assert.fail(`Unexpected action ${action.type}`)
    const result = applyAction(state, action)
    assert.deepEqual(state, before, `${reason}: complete reducer input, including capturedBy, stays immutable`)
    assert.ok(result.ok, reason)
    const after = result.state
    assert.deepEqual(after.pieces, expected.pieces, `${reason}: every physical identity including unaffected pieces`)
    assert.deepEqual(after.players, expected.players, `${reason}: exact physical hands/decks/discards`)
    assert.deepEqual(after.effects, expected.effects, `${reason}: complete effect identities and lifecycle`)
    assert.deepEqual(after.turn, expected.turn, `${reason}: turn and card allowances`)
    assert.deepEqual(after.enPassant, expected.enPassant, `${reason}: en-passant lifecycle`)
    assert.equal(after.orientation, expected.orientation)
    assert.deepEqual(after.fen.split(' ').slice(1), clocks, `${reason}: turn, rights and clocks`)
    const board = parseFen(after.fen).unwrap().board
    assert.equal(board.occupied.size(), expected.pieces.filter(p=>p.zone==='board').length)
    for (const piece of expected.pieces.filter(p=>p.zone==='board')) {
      const encoded = board.get(parseSquare(piece.square!)!)!
      assert.deepEqual({role:encoded.role,color:encoded.color}, {role:piece.role,color:piece.owner})
    }
    safe(after, actor)
    // This trace never gives check, so no regular card can directly create mate.
    safe(after, actor === 'white' ? 'black' : 'white')
    assert.ok(!after.pendingRescue && !after.pendingAbduction && !after.pendingDoomsayer)
    assert.equal(after.outcome, null)
    state = after
  }
  assert.equal(state.fen, '1nb1kb2/p1p1n3/4Q3/rp6/1n1P1Q1P/r2P3p/4P3/R4KNR b - - 0 28')
})
