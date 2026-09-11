import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, rejectPendingCancellation, type RandomTrace } from './random-campaign.js'
import { Chess } from 'chessops/chess'
import { makeBoardFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { GameState } from '../types.js'

// Independently reviewed in order; kings remain safe except explicitly pending moves.
const rationales = [
  '1 Nf3 jumps from g1; no capture, e1 protected, halfmove 1.',
  '2 White ends; Black starts, board and clocks unchanged.',
  '3 a7-a6 advances into empty a6; pawn clock resets, fullmove 2.',
  '4 Black ends; White starts without drawing.',
  '5 g2-g4 crosses empty g3; g3 en-passant opportunity, clock zero.',
  '6 Rebirth after White move sends enemy f7 Pawn to empty starting-rank a7; identity and g3 right retained, replacement drawn.',
  '7 Vulture immediately takes that physical Rebirth; Black discards top Anathema and draws Assassin, growing hand to six.',
  '8 Both allowances reset; g4 Pawn remains vulnerable for Black move.',
  '9 Nc6 jumps from b8; g3 opportunity expires, Black king safe.',
  '10 Black spends stolen Rebirth on g4-g2; empty enemy starting square, no capture and no clock increment.',
  '11 Black ends with six cards; no additional draw.',
  '12 c2-c4 crosses empty c3; en-passant c3 and pawn clock reset.',
  '13 White ends; c3 opportunity retained.',
  '14 Nc6-a5 is empty knight destination; c3 opportunity expires.',
  '15 Neutrality marks opposing b1 Knight, retaining White identity; neither King is in its reach, physical card retained and one drawn.',
  '16 Black ends; neutral b1 still cannot reach either King.',
  '17 e2-e3 empty pawn push; b1 neutrality does not attack e1 or e8.',
  '18 White ends; marker persists and both Kings safe.',
  '19 g7-g6 empty pawn push; Black king remains e8.',
  '20 Black ends; no card or board changes.',
  '21 Returned g2 Pawn may again move two squares through empty g3 under 13.1; g3 right established.',
  '22 White ends retaining g3 opportunity and b1 marker.',
  '23 Na5-b3 jumps to empty square; attacks a1,c1,d2,d4,a5,c5, not e1; g3 expires.',
  '24 Black ends with White king safe despite attacked minor pieces.',
  '25 Bf1-g2 moves diagonally one square; e1 remains shielded.',
  '26 White ends; b1 remains neutral without a King threat.',
  '27 Ke8-f7 enters square cleared by Rebirth, beyond White knight attacks; removes Black castling rights.',
  '28 Black ends safely on f7, clocks unchanged.',
  '29 d2-d4 crosses empty d3; b1 Knight attacks d2 rather than e1, so legal; d3 right.',
  '30 Peace Talks cancels Neutrality, returns b1 Knight to exclusive White control and discards both cards to their owners.',
  '31 White ends; d3 opportunity retained, no effects.',
  '32 c7-c5 crosses empty c6; Black f7 remains safe and c6 replaces d3 opportunity.',
  '33 Black ends; no legal en-passant capture available from White c4 or d4.',
  '34 d4-d5 is quiet, forgoing c6 opportunity; clock stays zero.',
  '35 White ends; board and hands unchanged.',
  '36 Ng8-h6 is an empty knight jump; halfmove 1.',
  '37 Black ends; no effects or draws.',
  '38 Nf3-e5 jumps and checks f7; White e1 remains safe.',
  '39 White plays Doomsayer after move, retains effect and draws Crusade; check is still answerable by Black.',
  '40 Black immediately names Knight and loses own b3 Knight; effect resolves to White discard, Black may answer existing check on upcoming move.',
  '41 White ends with Black f7 checked by e5 Knight.',
  '42 Kf7-g8 escapes e5 Knight attack; g8 not attacked, halfmove 1.',
  '43 Black ends safely on g8.',
  '44 Rh1-f1 slides through empty g1; removes White kingside castling right.',
  '45 White ends, queenside castling right remains.',
  '46 Ra8-b8 slides into vacated knight square; Black already lacks castling rights.',
  '47 Black ends; b8 rook and clocks retained.',
  '48 Nb1-a3 moves owned Knight after cancellation of Neutrality; empty destination.',
  '49 White ends; no neutral pieces remain.',
  '50 e7-e6 empty pawn push, Black clock reset.',
  '51 Black ends with e6 Pawn blocking diagonal.',
  '52 Qd1-d3 passes empty d2; own d5 Pawn still blocks queen file beyond d4.',
  '53 White ends; both Kings safe.',
  '54 Nh6xg4 captures original white g2 Pawn, not a royal; clock zero.',
  '55 Black ends after knight capture; no automatic No Quarter.',
  '56 Ke1-d1 enters empty safe square; d3 Queen blocks enemy d8 Queen, White rights vanish.',
  '57 White ends safely on d1.',
  '58 Kg8-f7 enters e5 Knight check only provisionally; pending rescue prevents ending turn.',
  '59 Holy War swap g4 Knight/f8 Bishop cannot cure e5-f7 check; card spent and underlying illegal King move restored with clocks, no swap retained.',
  '60 Bf8-h6 follows clear g7 diagonal as replacement regular move; g8 safe, Black card allowance remains spent.',
  '61 Black ends after legal bishop move, no second card permitted.',
  '62 Forced March replaces White move: c4-d4 and e3-f3 are distinct initially empty sideways squares; no capture or en-passant.',
  '63 White ends after replacement move; pawn clock zero.',
  '64 Qd8-h4 travels e7,f6,g5 all empty; does not expose g8 King.',
  '65 Black ends; h4 Queen does not attack d1.',
  '66 Bc1-f4 travels empty d2,e3 to empty f4; d1 remains safe.',
  '67 White ends after quiet bishop move without using Crusade.',
  '68 Qh4xh2 passes empty h3 and captures white h2 Pawn; g2 Bishop blocks rank attack.',
  '69 White Revenge after enemy move captures black e6 Pawn, keeps other pieces and move clocks; no direct mate.',
  '70 Black ends; Revenge spends only White response allowance.',
  '71 f3xg4 captures Black Knight with original e2 Pawn relocated by Forced March; clock zero.',
  '72 White ends; no extra draw.',
  '73 Kg8-f7 again enters e5 Knight attack provisionally; rescue required.',
  '74 Vendetta does not remove that Knight check, so fizzles and restores g8 and pre-move clocks while spending card.',
  '75 a6-a5 quiet legal replacement move; failed Vendetta imposes no capture restriction.',
  '76 Black ends with a5 Pawn and g8 King safe.',
  '77 Qd3-g3 passes empty e3,f3; own g4 Pawn blocks upward file.',
  '78 White ends after Queen move, enabling Black Doppelganger geometry.',
  '79 Doppelganger replaces Black move: h6 Bishop copies just-moved Queen to empty h5, retaining bishop type and advancing clocks once.',
  '80 Black ends after replacement move; no continuing copied power.',
  '81 Bf4-c1 travels empty e3,d2; quiet Bishop move qualifies for Crusade.',
  '82 Crusade moves same c1 Bishop through empty d2,e3,f4,g5 to h6; g7-f8 diagonal does not reach g8 King, clock not incremented again.',
  '83 White ends; bishop remains h6 and card spent.',
  '84 Reborn original f7 Pawn advances a7-a6 into empty square; distinct a5 Pawn unaffected.',
  '85 Black ends with two original Pawn identities on a-file.',
  '86 Bh6-f4 crosses empty g5; both Kings remain safe.',
  '87 White ends after quiet Bishop return.',
  '88 a5-a4 advances original a7 Pawn into empty a4; a3 Knight blocks further advance.',
  '89 Black ends with pawn clock zero.',
  '90 Bf4-c1 through e3,d2 remains unobstructed; no Crusade remains in hand.',
  '91 White ends; knight e5 still controls f7.',
  '92 Kg8-f7 enters e5 Knight check provisionally again.',
  '93 White Knightmare cancels that move, restores g8 and clocks, spends response allowance, demands a different Black move.',
  '94 Assassin replaces Black move: Qh2-h5 crosses empty h3,h4 and captures own Bishop h5; different from canceled King move, both Kings safe.',
  '95 Black ends; each side spent one card this turn.',
  '96 Na3-c4 jumps to empty square, no capture; a3 now vacant.',
  '97 White ends, clock 1.',
  '98 Kg8-f8 is empty and safe: e5 Knight reaches f7, not f8; c1 Bishop blocked diagonally by g4 Pawn.',
  '99 Black ends safely on f8.',
  '100 a2-a3 enters square vacated by Knight; a4 enemy Pawn blocks further push.',
  '101 White ends; no en-passant on single push.',
  '102 Qh5-h6 is quiet one-square file movement.',
  '103 Black Doomsayer is retained after move; draws Fatal Attraction and offers White immediate naming.',
  '104 White declines naming; effect remains without loss or clock change.',
  '105 Black names Pawn and loses own a4 Pawn, resolving own Doomsayer and resetting capture clock; no King line exposed.',
  '106 Black ends after own Pawn loss; no extra draw for effect resolution.',
  '107 d4xc5 uses original c2 Pawn to capture black c7 Pawn; diagonal legal, own d5 Pawn unaffected.',
  '108 White ends; c5 capture complete.',
  '109 Qh6-g5 quiet diagonal; g4 Pawn still blocks g-file toward White Queen.',
  '110 Black ends, halfmove 1.',
  '111 Bc1-e3 passes empty d2; own g4 Pawn prevents black g5 Queen line, d1 safe.',
  '112 White ends after bishop development.',
  '113 Qg5-h6 returns diagonally, no captures or check.',
  '114 Black ends, clock 3.',
  '115 Nc4-b6 jumps to empty b6; attacks a8,c8,d7,d5,a4,c4 rather than f8 King.',
  '116 White ends with no en-passant or effects.',
  '117 Madman replaces Black move: h7-f5 jumps own g6 Pawn then f5-h3 jumps White g4 Pawn; empty landings and both jumped Pawns survive.',
  '118 Black ends after two-jump Pawn card; fullmove 26, clock zero, no en-passant.',
  '119 f2-f3 single empty Pawn push; h3 enemy Pawn attacks g2 rather than d1, King safe.',
  '120 White ends; Black starts move 26 with no pending rescue, effects, or en-passant.',
]

const cardChanges: Record<number, Record<string, string | null>> = {
  6: { 'black-pawn-f7': 'a7' }, 10: { 'white-pawn-g2': 'g2' },
  40: { 'black-knight-b8': null }, 59: { 'black-king-e8': 'g8' },
  62: { 'white-pawn-c2': 'd4', 'white-pawn-e2': 'f3' }, 69: { 'black-pawn-e7': null },
  74: { 'black-king-e8': 'g8' }, 79: { 'black-bishop-f8': 'h5' },
  82: { 'white-bishop-c1': 'h6' }, 93: { 'black-king-e8': 'g8' },
  94: { 'black-queen-d8': 'h5', 'black-bishop-f8': null },
  105: { 'black-pawn-a7': null }, 117: { 'black-pawn-h7': 'h3' },
}

// F4 / FAQ p.16: only actions 1–92 are a legal prefix. Later artifact actions
// depend on the rejected cancellation at action 93; original artifact hashes remain unchanged.
test('random campaign iteration 068 independently reviewed semantics', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/068.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860068)
  assert.equal(rationales.length, trace.steps.length)
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 16)
  let state = createGameState(trace.initial)
  const states: GameState[] = [state]
  for (const [index, { action }] of trace.steps.slice(0, 92).entries()) {
    const n = index + 1
    assert.ok(rationales[index]!.startsWith(`${n} `))
    const before = state
    const result = applyAction(before, action)
    assert.ok(result.ok, rationales[index])
    state = result.state
    states.push(state)
    const oldFen = parseFen(before.fen).unwrap()
    const newFen = parseFen(state.fen).unwrap()
    assert.equal(Boolean(state.pendingRescue), [58, 73, 92].includes(n))
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const chess = Chess.fromSetup(oldFen).unwrap()
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! }
      assert.equal(chess.isLegal(move), ![58, 73, 92].includes(n), rationales[index])
      chess.play(move)
      assert.equal(makeBoardFen(chess.board), makeBoardFen(newFen.board))
      assert.equal(chess.halfmoves, newFen.halfmoves)
      assert.equal(chess.fullmoves, newFen.fullmoves)
      assert.deepEqual(state.players, before.players)
      const moved = before.pieces.find(p => p.square === action.from)!
      const doublePawn = moved.role === 'pawn' && Math.abs(Number(action.to[1]) - Number(action.from[1])) === 2
      assert.deepEqual(state.enPassant, doublePawn ? [{ target: `${action.from[0]}${(Number(action.to[1]) + Number(action.from[1])) / 2}`, pawnId: moved.id }] : [])
    } else {
      const changes = cardChanges[n] ?? {}
      for (const piece of before.pieces) {
        const after = state.pieces.find(p => p.id === piece.id)!
        const square = piece.id in changes ? changes[piece.id] : piece.square
        assert.equal(after.square, square, `${n}: ${piece.id}`)
        assert.equal(after.zone, square === null ? (piece.id in changes ? 'captured' : piece.zone) : 'board')
        assert.equal(after.owner, piece.owner)
        assert.equal(after.role, piece.role)
        assert.equal(after.originalRole, piece.originalRole)
        assert.equal(after.royal, piece.royal)
        assert.equal(after.promoted, piece.promoted)
      }
      if (action.type === 'endTurn') {
        assert.equal(state.fen, before.fen)
        assert.deepEqual(state.players, before.players)
        assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } })
      }
      if ([59, 74, 93].includes(n)) {
        assert.equal(state.fen, states[n - 2]!.fen)
        assert.equal(state.turn.moveMade, false)
        assert.deepEqual(state.enPassant, states[n - 2]!.enPassant)
      } else if ([62, 79, 94, 117].includes(n)) {
        assert.equal(newFen.fullmoves, oldFen.fullmoves + (before.turn.color === 'black' ? 1 : 0))
        assert.equal(newFen.halfmoves, n === 79 ? oldFen.halfmoves + 1 : 0)
        assert.equal(state.turn.moveMade, true)
        assert.deepEqual(state.enPassant, [])
      } else {
        assert.equal(newFen.fullmoves, oldFen.fullmoves)
        assert.equal(newFen.halfmoves, [40, 69, 105].includes(n) ? 0 : oldFen.halfmoves)
        assert.deepEqual(state.enPassant, before.enPassant)
      }
    }
    if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black'
      const player = before.players[owner]
      assert.equal(state.players[owner].deck.length, player.deck.length - (n === 7 ? 2 : 1))
      assert.equal(state.players[owner].hand.length, player.hand.length + (n === 7 ? 1 : 0))
      assert.equal(state.turn.cardPlays[owner], 1)
      assert.ok(!state.players[owner].hand.some(c => c.id === action.cardInstanceId))
      assert.ok(state.players[owner].hand.some(c => c.id === player.deck[n === 7 ? 1 : 0]!.id))
      if (![15, 39, 103].includes(n)) assert.ok(state.players[owner].discard.some(c => c.id === action.cardInstanceId))
      if (n === 7) {
        assert.ok(state.players.black.hand.some(c => c.id === 'white-hand-4-rebirth'))
        assert.ok(!state.players.white.discard.some(c => c.id === 'white-hand-4-rebirth'))
        assert.ok(state.players.black.discard.some(c => c.id === player.deck[0]!.id))
      }
    }
    const neutral = n >= 15 && n < 30
    assert.equal(state.pieces.find(p => p.id === 'white-knight-b1')!.neutral, neutral)
    const expectedEffects = neutral ? [{ type: 'neutrality', owner: 'black', card: { id: 'black-deck-2-neutrality', cardId: 'neutrality' }, pieceId: 'white-knight-b1' }]
      : n === 39 ? [{ type: 'doomsayer', owner: 'white', card: { id: 'white-hand-1-doomsayer', cardId: 'doomsayer' } }]
      : n >= 103 && n <= 104 ? [{ type: 'doomsayer', owner: 'black', card: { id: 'black-deck-6-doomsayer', cardId: 'doomsayer' } }] : []
    assert.deepEqual(state.effects, expectedEffects)
  }
  assert.deepEqual(replayTrace(trace, 93), state);
  rejectPendingCancellation(state, trace.steps[92]!.action, [{"type":"playCard","cardId":"rebirth","cardInstanceId":"black-hand-2-rebirth","target":[{"from":"e5","to":"b1"}]}]);
})
