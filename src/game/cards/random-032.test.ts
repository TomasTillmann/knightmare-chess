import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Chess } from 'chessops/chess'
import { makeBoardFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { GameState } from '../types.js'
import { replayTrace, type RandomTrace } from './random-campaign.js'

// Each rationale was reviewed in order against rules §§8–13,19–20,22 and catalog timing.
const rationales = [
  '1 Nb1-c3 jumps to empty c3; neither King exposed.',
  '2 White ends its completed move; Black receives fresh allowances.',
  '3 h7-h6 advances one empty square; pawn clock resets.',
  '4 Black ends; White starts move two.',
  '5 g2-g4 crosses empty g3 and creates g3 en-passant opportunity.',
  '6 Heresy: both Black Bishops and White f1 Bishop are orthogonally blocked; c1-b1 is the sole eligible Bishop move. Draw Under Elf Hill.',
  '7 End preserves the g3 opportunity and clears both allowances.',
  '8 e7-e6 is unobstructed and expires g3.',
  '9 Black ends its pawn move.',
  '10 Bf1-g2 occupies the square vacated by g2 Pawn.',
  '11 Haunting Memories copies nonunique Heresy: Black Bishops remain blocked; b1-c1 and g2-g3 change square color without capture. Draw Blessing.',
  '12 White ends after its copied effect.',
  '13 Qd8-g5 crosses empty e7,f6; g4 Pawn blocks its file.',
  '14 Black ends with neither King checked.',
  '15 e2-e4 crosses empty e3; records e3 opportunity.',
  '16 End retains e3 for Black.',
  '17 h6-h5 moves forward and expires e3.',
  '18 Black ends its pawn move.',
  '19 Ke1-e2 enters an unattacked square; White castling rights end.',
  '20 White ends with King safe on e2.',
  '21 Ke8-d8 enters the Queen-vacated square; Black castling rights end.',
  '22 Black ends with no castling rights remaining.',
  '23 Ra1-b1 moves into the Bishop-vacated square.',
  '24 White ends its rook move.',
  '25 Rh8-h6 crosses empty h7 and stops before own h5 Pawn.',
  '26 Black ends its rook move.',
  '27 a2-a3 moves one clear square.',
  '28 White ends its pawn move.',
  '29 a7-a5 crosses a6; a6 en-passant opportunity created.',
  '30 Black ends, preserving a6 for one White move.',
  '31 Nc3-d5 jumps to empty d5, expiring a6.',
  '32 White ends; the Knight is capturable on d5.',
  '33 e6xd5 captures physical white-knight-b1; Black King remains screened.',
  '34 Black ends the capture; captured Knight stays off board.',
  '35 Ke2-e1 returns safely without restoring castling rights.',
  '36 White ends its King move.',
  '37 b7-b5 crosses b6, creates b6 en-passant.',
  '38 After-move Abduction conceals opposing nonroyal g3 Bishop, draws Man-Trap; no capture or clock advance.',
  '39 Reveal changes concealment to recall only.',
  '40 Exact White Bishop identity and g3 answer restores the same piece, retaining b6 and the spent card.',
  '41 Black ends after the resolved recall.',
  '42 Forced March moves e4-f4 and h2-g2 sideways to distinct initially empty squares; replaces move, expires b6 and draws Cathedral.',
  '43 White ends the replacement move.',
  '44 Evangelists exchanges Black c8 and White g3 Bishops without capture; neither King checked; replacement clock advances and Evil Eye drawn.',
  '45 Black ends its Bishop swap.',
  '46 b2-b3 moves forward to empty b3.',
  '47 White ends its pawn move.',
  '48 Bf8-c5 crosses empty e7,d6.',
  '49 Black ends its Bishop move.',
  '50 Bc8-b7 moves the same White Bishop obtained through the swap.',
  '51 White ends with Bishop on b7.',
  '52 Rh6-f6 crosses empty g6.',
  '53 Black ends its rook move.',
  '54 Bb7xd5 crosses empty c6 and captures original e7 Pawn.',
  '55 White ends the Bishop capture.',
  '56 c7-c6 advances one square toward White.',
  '57 Black ends its pawn move.',
  '58 c2-c4 crosses c3 and creates c3 opportunity; Black b5 Pawn is not on the en-passant capture rank.',
  '59 White ends preserving the one-move opportunity.',
  '60 Bc5-b6 moves one diagonal and expires c3.',
  '61 Black ends its Bishop move.',
  '62 f2xg3 captures Black original c8 Bishop; no pin exposes White King.',
  '63 White ends the capture without a Black reaction.',
  '64 Ra8-a6 crosses empty a7 and stops before a5 Pawn.',
  '65 Black ends its rook move.',
  '66 Bd5xc6 captures original c7 Pawn; Black d7 Pawn blocks diagonal check.',
  '67 White ends its Bishop capture.',
  '68 Qg5-f5 shifts one file without capture.',
  '69 Black ends with White King shielded.',
  '70 Ng1-e2 jumps into empty e2.',
  '71 White ends its Knight move.',
  '72 Qf5xf4 captures physical original e2 Pawn.',
  '73 Black plants Man-Trap on its occupied h5 square after moving; effect retains card and draws Masquerade.',
  '74 Black ends; h5 trap persists.',
  '75 a3-a4 advances into empty a4, away from trap.',
  '76 White ends its pawn move.',
  '77 b5xc4 captures original c2 Pawn normally.',
  '78 Black ends its capture.',
  '79 g3xf4 captures Black Queen with original f2 Pawn; White King safe.',
  '80 Immediate Black Legacy retrieves the discarded physical Abduction after Queen capture; also draws Toll, yielding six cards, with no board change.',
  '81 White Cathedral swaps controlled b1 Rook and c1 Bishop after its move; independent White allowance remains; draws Vulture.',
  '82 End resets both spent allowances and gives Black its normal move.',
  '83 Rf6-e6 shifts one file; e2 Knight blocks the e-file to White King.',
  '84 Black ends its rook move.',
  '85 Rc1-c3 crosses c2, now vacated; stops before hostile c4 Pawn.',
  '86 White ends its rook move.',
  '87 f7-f5 crosses empty f6 and creates f6 opportunity.',
  '88 Black ends; f6 remains until White moves.',
  '89 Ke1-f1 is safe: b6 Bishop ray crosses c5,d4,e3,f2 to g1, not f1; expires f6.',
  '90 White ends its King move.',
  '91 Re6-e5 moves one rank, with no capture.',
  '92 Black ends its rook move.',
  '93 Ne2-c1 jumps clear; opening e-file does not expose King now on f1.',
  '94 White ends its Knight move.',
  '95 Re5-e8 crosses empty e6,e7.',
  '96 Black ends its rook move.',
  '97 Nc1-a2 jumps into vacated a2.',
  '98 White ends its Knight move.',
  '99 Re8-e6 crosses empty e7.',
  '100 Black ends its rook move.',
  '101 g4xh5 captures Black h7 Pawn, then h5 Man-Trap captures the arriving White g2 Pawn; both remain captured and trap discards.',
  '102 White ends the double-capture move.',
  '103 Re6-e8 crosses empty e7 after trap expiry.',
  '104 Black ends its rook move.',
  '105 Na2-b4 jumps clear without capturing c4 Pawn.',
  '106 White ends its Knight move.',
  '107 Bb6-e3 crosses empty c5,d4 and does not check f1 King.',
  '108 Black ends its Bishop move.',
  '109 Under Elf Hill removes White royal f1 to away instead of moving, advances noncapture clock, draws Dubbing; no capture or direct mate.',
  '110 White ends; its King remains away through Black turn.',
  '111 Re8-e5 crosses empty e7,e6; Black d8 King stays protected by d7 Pawn, while White King is absent.',
  '112 Black ends and makes White mandatory return due.',
  '113 Return same royal to empty edge h3: neither e5 Rook nor e3 Bishop nor f5 Pawn attacks h3; no clock, move, or draw consumed.',
  '114 d2xe3 captures Black original f8 Bishop while returned King remains stationary on h3.',
  '115 White ends; return restriction expires; Black to act, no pending obligations or effects.',
]

test('iteration 032: independently reviewed 50 moves and every intervening action', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/032.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860032)
  assert.equal(rationales.length, trace.steps.length)
  rationales.forEach((rationale, i) => assert.ok(rationale.startsWith(`${i + 1} `)))
  assert.equal(trace.steps.filter(({ action }) => action.type === 'playCard').length, 9)
  let state = createGameState(trace.initial)
  const piece = (s: GameState, id: string) => { const p = s.pieces.find(p => p.id === id); assert.ok(p); return p }
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1
    const before = state
    const result = applyAction(before, action)
    assert.ok(result.ok, rationales[index])
    state = result.state
    assert.equal(state.orientation, 0)
    assert.equal(state.outcome, null)
    assert.ok(!state.pendingRescue)
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const mover = before.pieces.find(p => p.square === action.from && p.zone === 'board')!
      const victim = before.pieces.find(p => p.square === action.to && p.zone === 'board')
      const expectedPieces = before.pieces.map(p => p.id === mover.id
        ? { ...p, square: n === 101 ? null : action.to, zone: n === 101 ? 'captured' : 'board' }
        : p.id === victim?.id ? { ...p, square: null, zone: 'captured' } : p)
      const physical = (pieces: typeof expectedPieces) => pieces.map(({ capturedAtPly: _at, ...p }) => p)
      assert.deepEqual(physical(state.pieces), physical(expectedPieces), rationales[index])
      if (n !== 111) {
        const chess = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap()
        const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! }
        assert.ok(chess.isLegal(move), rationales[index])
        chess.play(move)
        if (n === 101) chess.board.take(parseSquare('h5')!)
        assert.equal(makeBoardFen(chess.board), state.fen.split(' ')[0], rationales[index])
      } else {
        assert.equal(mover.role, 'rook')
        assert.equal(action.from, 'e8'); assert.equal(action.to, 'e5')
        assert.ok(!before.pieces.some(p => p.zone === 'board' && ['e7', 'e6', 'e5'].includes(p.square!)))
      }
      const [,,, , half, full] = before.fen.split(' ')
      assert.deepEqual(state.fen.split(' ').slice(4), [String(mover.role === 'pawn' || victim ? 0 : Number(half) + 1), String(Number(full) + (before.turn.color === 'black' ? 1 : 0))])
      const double = mover.role === 'pawn' && Math.abs(Number(action.from[1]) - Number(action.to[1])) === 2
      assert.deepEqual(state.enPassant, double ? [{ target: action.from[0]! + ((Number(action.from[1]) + Number(action.to[1])) / 2), pawnId: mover.id }] : [])
      assert.deepEqual(state.turn, { ...before.turn, phase: 'afterMove', moveMade: true })
      assert.deepEqual(state.players.white, before.players.white)
      assert.deepEqual(state.players.black, n === 101 ? { ...before.players.black, discard: [...before.players.black.discard, { id: 'black-deck-0-man-trap', cardId: 'man-trap' }] } : before.players.black)
    } else if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen)
      assert.deepEqual(state.pieces, before.pieces)
      assert.deepEqual(state.players, before.players)
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } })
    } else if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black'
      const other = owner === 'white' ? 'black' : 'white'
      const player = before.players[owner]
      const card = player.hand.find(c => c.id === action.cardInstanceId)!
      const retrieved = n === 80 ? [player.discard.find(c => c.id === action.target)!] : []
      assert.deepEqual(state.players[owner], {
        hand: [...player.hand.filter(c => c.id !== card.id), ...retrieved, player.deck[0]!],
        deck: player.deck.slice(1),
        discard: [...player.discard.filter(c => !retrieved.includes(c)), ...(n === 73 ? [] : [card])],
      })
      assert.deepEqual(state.players[other], before.players[other])
      assert.equal(before.turn.cardPlays[owner], 0)
      assert.equal(state.turn.cardPlays[owner], 1)
      assert.equal(state.turn.cardPlays[other], before.turn.cardPlays[other])
      if (![42, 44, 109].includes(n)) assert.deepEqual(state.turn, { ...before.turn, cardPlays: { ...before.turn.cardPlays, [owner]: 1 } })
    }
    const relocations: Record<number, Record<string, string | null>> = {
      6: { 'white-bishop-c1': 'b1' }, 11: { 'white-bishop-c1': 'c1', 'white-bishop-f1': 'g3' },
      38: { 'white-bishop-f1': null }, 40: { 'white-bishop-f1': 'g3' },
      42: { 'white-pawn-e2': 'f4', 'white-pawn-h2': 'g2' },
      44: { 'white-bishop-f1': 'c8', 'black-bishop-c8': 'g3' },
      81: { 'white-rook-a1': 'c1', 'white-bishop-c1': 'b1' },
      109: { 'white-king-e1': null }, 113: { 'white-king-e1': 'h3' },
    }
    if (action.type !== 'move') {
      assert.deepEqual(state.pieces, before.pieces.map(p => Object.hasOwn(relocations[n] ?? {}, p.id)
        ? { ...p, square: relocations[n]![p.id], zone: relocations[n]![p.id] === null ? 'away' : 'board' } : p), rationales[index])
    }
    assert.deepEqual(state.effects, n >= 73 && n < 101 ? [{ type: 'man-trap', owner: 'black', card: { id: 'black-deck-0-man-trap', cardId: 'man-trap' }, square: 'h5' }] : [])
    if (n === 38 || n === 39) {
      assert.equal(state.pendingAbduction?.phase, n === 38 ? 'concealment' : 'recall')
      assert.equal(state.pendingAbduction?.pieceId, 'white-bishop-f1')
      assert.equal(state.history.at(-1)?.target, undefined)
    } else assert.ok(!state.pendingAbduction)
    if ([6, 11, 38, 39, 40, 73, 80, 81, 113].includes(n)) {
      assert.deepEqual(state.fen.split(' ').slice(4), before.fen.split(' ').slice(4))
      assert.deepEqual(state.enPassant, before.enPassant)
    }
    if ([42, 44, 109].includes(n)) {
      assert.deepEqual(state.enPassant, [])
      assert.equal(state.turn.moveMade, true)
      assert.equal(state.turn.phase, 'afterMove')
      assert.deepEqual(state.fen.split(' ').slice(4), n === 42 ? ['0', '10'] : n === 44 ? ['1', '11'] : ['4', '26'])
    }
    if (!state.pendingAbduction && state.pieces.filter(p => p.royal && p.zone === 'board').length === 2) {
      const setup = parseFen(state.fen).unwrap()
      setup.turn = state.turn.color
      const position = Chess.fromSetup(setup).unwrap()
      assert.equal(position.isCheck(), false, `${rationales[index]} Acting King safety`)
      assert.equal(position.isCheckmate(), false, `${rationales[index]} No direct mate`)
    }
    if (n >= 109 && n < 115) assert.deepEqual(state.underElfHill, [{ pieceId: 'white-king-e1', player: 'white', returning: n >= 112, ...(n >= 113 ? { returned: true } : {}) }])
    if (n === 40) assert.equal(piece(state, 'white-bishop-f1').zone, 'board')
    if (n === 80) assert.equal(state.players.black.hand.length, 6)
    if (n === 113) { assert.equal(state.fen.split(' ')[0], '1n1k2n1/3p2p1/r1B5/p3rp2/PNp2P2/1PR1b2K/3P2P1/1B1Q3R'); assert.deepEqual(state.turn, before.turn) }
  }
  assert.deepEqual(state.underElfHill, [])
  assert.equal(state.fen, '1n1k2n1/3p2p1/r1B5/p3rp2/PNp2P2/1PR1P2K/6P1/1B1Q3R b - - 0 27')
  assert.deepEqual(replayTrace(trace), state)
})
