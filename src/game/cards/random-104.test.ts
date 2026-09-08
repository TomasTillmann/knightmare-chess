import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameState, PieceState, SquareName, CardInstance } from '../types.js'
import { CARD_CATALOG } from './catalog.js'

// Ordered manual review of every .txt row, rules §§6–12, 13.9, 14.4, 15.3,
// 18.3/18.6, 20, 22.1/22.7/22.10 and the eleven corresponding card images.
const rationale = [
  '1 a2-a4: initial Pawn double step through empty a3; a3 opportunity.',
  '2 White ends completed move; a3 opportunity survives the boundary.',
  '3 a7-a6: Black Pawn advances one; previous opportunity expires.',
  '4 Fortification: after Black move, retain d4/e4 boundary and draw once.',
  '5 Black ends; wall persists, allowances reset.',
  '6 a1-a2: Rook enters vacated square; White queenside rights lost.',
  '7 White ends; no physical change or draw.',
  '8 h7-h6: Black Pawn advances one into empty square.',
  '9 Black ends; wall persists.',
  '10 e2-e4: clear e3 double step; wall d4/e4 is not crossed.',
  '11 White ends; e3 opportunity survives.',
  '12 h8-h7: Rook enters vacated square; Black kingside rights lost.',
  '13 Black ends; no restored rights.',
  '14 h2-h3: White Pawn advances one.',
  '15 White ends without card expenditure.',
  '16 f7-f6: Black Pawn advances one.',
  '17 Black ends with unchanged pieces.',
  '18 g2-g3: White Pawn advances one.',
  '19 White ends with unchanged pieces.',
  '20 e7-e5: clear e6 double step; e6 opportunity.',
  '21 Black ends; e6 opportunity survives.',
  '22 h1-h2: Rook enters vacated square; final White castling right lost.',
  '23 White ends; no castling rights restored.',
  '24 g7-g5: clear g6 double step; g6 opportunity.',
  '25 Black ends; g6 opportunity survives.',
  '26 b2-b3: White Pawn advances one; old opportunity expires.',
  '27 White ends with unchanged pieces.',
  '28 f8-a3: Bishop diagonal through e7,d6,c5,b4; no wall crossing.',
  '29 Black ends with unchanged pieces.',
  '30 Dubbing: e4-c3 Knight jump to empty c3; same Pawn; replacement resets clock.',
  '31 White ends replacement move; Dubbing stays discarded.',
  '32 a6-a5: Black Pawn advances one to empty a5.',
  '33 Black ends with unchanged pieces.',
  '34 a2-a1: Rook retreats one; castling remains revoked.',
  '35 White ends with unchanged pieces.',
  '36 a3-b2: Bishop diagonal into vacated b2.',
  '37 Black ends with unchanged pieces.',
  '38 d1-g4: Queen diagonal through e2,f3 to empty g4.',
  '39 White ends with unchanged pieces.',
  '40 b8-a6: Knight jump into empty a6.',
  '41 Black ends with unchanged pieces.',
  '42 Evangelists: exchange opposite Bishops c1/c8, identities intact; replace move.',
  '43 White ends replacement; no second clock advance.',
  '44 e5-e4: Black Pawn advances to square vacated by Dubbing.',
  '45 Black ends with unchanged pieces.',
  '46 g1-f3: Knight jump into empty f3.',
  '47 White ends with unchanged pieces.',
  '48 h7-e7: Rook slides through g7,f7; destination empty.',
  '49 Black ends with unchanged pieces.',
  '50 c8xb7: exchanged White Bishop captures physical Black b7 Pawn; captor White.',
  '51 White ends; captured Pawn remains off-board.',
  '52 a6-c5: Knight jump into empty c5.',
  '53 Black ends with unchanged pieces.',
  '54 f3-d4: Knight jump; wall does not prevent landing on d4.',
  '55 White ends with unchanged pieces.',
  '56 a8-a6: Rook passes empty a7; final Black castling right lost.',
  '57 Black ends with all castling revoked.',
  '58 a1-a2: Rook advances one to empty a2.',
  '59 White ends with unchanged pieces.',
  '60 e8-f7: King diagonal to safe empty f7.',
  '61 Black ends with unchanged pieces.',
  '62 f2-f4: clear f3 double step; Black e4 Pawn has f3 en-passant threat.',
  '63 White ends; f3 opportunity survives.',
  '64 f7-g7: King steps to safe g7; g5 Pawn blocks Queen g4 ray.',
  '65 Black ends; en-passant has expired.',
  '66 h2-e2: Rook slides through g2,f2 to empty e2.',
  '67 White ends with unchanged pieces.',
  '68 c1xd2: Black Bishop captures White d2 Pawn and checks e1 diagonally.',
  '69 Black ends; White receives its check-response turn.',
  '70 b7xe4: Bishop passes c6,d5; capture leaves e1 checked, pending Coup rescue only.',
  '71 Coup: e1 becomes Prince, safe f1 Bishop becomes royal; no relocation; rescue resolves.',
  '72 White ends safely with royal f1 Bishop.',
  '73 c5-d3: Knight jump; e1 Prince is capturable but f1 royal is safe.',
  '74 Black ends with unchanged pieces.',
  '75 e4-b7: Bishop diagonal via d5,c6; no d4/e4 wall crossing.',
  '76 Fatal Attraction: mark owned e2 Rook; adjacent nonroyals freeze, royal f1 exempt.',
  '77 White ends; magnet remains retained.',
  '78 a6-d6: Rook path b6,c6 clear and outside e2 magnet.',
  '79 Black ends with unchanged pieces.',
  '80 b1xd2: Knight starts outside magnet, captures Bishop then becomes frozen at d2.',
  '81 White ends; captured Bishop stays captured by White.',
  '82 d8-f8: Queen slides through e8 before Black magnet exists.',
  '83 Haunting Memories: copies latest Fatal Attraction onto g7 King; retain copied card.',
  '84 Black ends with both magnets active.',
  '85 a2-a3: unmarked Rook outside e2 magnet advances one.',
  '86 White ends with unchanged pieces.',
  '87 d6xd4: Rook passes d5 and captures White Knight; does not cross d4/e4.',
  '88 Black ends with unchanged pieces.',
  '89 e2-e3: magnet Rook moves, discarding its marker and freeing adjacent pieces.',
  '90 White ends; only Black magnet persists.',
  '91 d4-c4: Rook crosses left boundary, not wall on right.',
  '92 Dungeon: opposing h3 Pawn relocates to empty h8 without promotion; one-turn ban.',
  '93 Black ends; White Pawn ban remains for next turn.',
  '94 b7-a6: unrestricted Bishop diagonal; h8 Pawn remains unpromoted.',
  '95 White ends; Dungeon ban expires, no board or clock change.',
  '96 c4-b4: Rook one square left, outside Black magnet.',
  '97 Black ends with unchanged pieces.',
  '98 c3-c4: original e2 Pawn resumes normal forward geometry after Dubbing.',
  '99 Anathema: swap opposing b2 Bishop/b4 Rook; no capture, movement, or clock advance.',
  '100 White ends; Anathema discarded and replaced once.',
  '101 c7-c6: Black Pawn advances one.',
  '102 Black ends with unchanged pieces.',
  '103 Evil Eye: e3 Rook threatens e7 via e4,e5,e6; victim captured, attacker stationary.',
  '104 White ends replacement capture; no second clock advance.',
  '105 d3-c5: Knight jump outside remaining g7 magnet.',
  '106 Black ends with unchanged pieces.',
  '107 Lost Castle: swap White a3 and Black b2 Rooks; replacement noncapture.',
  '108 White ends replacement; identities and existing castling loss persist.',
  '109 c5xb3: Black Knight captures original White b2 Pawn; captor Black.',
  '110 Black ends with unchanged pieces.',
  '111 e3-e2: Rook retreats one; old magnet does not return.',
  '112 Fireball: latest quiet e2 Rook explodes; d2 Knight/e1 Prince captured by White, royal f1 spared.',
  '113 White ends with royal Bishop intact and Coup still retained.',
  '114 b4-c3: Black Bishop diagonal to square vacated by original White e2 Pawn.',
  '115 Black ends fiftieth Regular Move; new White turn and no unresolved obligation.',
]

type Effect = { type: string; owner: Color; card?: CardInstance; pieceId?: string; player?: Color; from?: string; to?: string }
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const
const distance = (a: string, b: string) => Math.max(...xy(a).map((v, i) => Math.abs(v - xy(b)[i]!)))
const square = (value: string): SquareName => { assert.match(value, /^[a-h][1-8]$/); return value as SquareName }
const at = (pieces: PieceState[], s: string) => pieces.find(p => p.zone === 'board' && p.square === s)
const effectsOf = (state: GameState) => state.effects as Effect[]

function canReach(state: GameState, piece: PieceState, to: string, capture: boolean): boolean {
  if (!piece.square) return false
  if (effectsOf(state).some(e => e.type === 'dungeon' && e.pieceId === piece.id && e.player === piece.owner)) return false
  if (!piece.royal && effectsOf(state).some(e => e.type === 'fatal-attraction' && e.pieceId !== piece.id
    && state.pieces.some(m => m.id === e.pieceId && m.square && distance(m.square, piece.square!) === 1))) return false
  const [x, y] = xy(piece.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y
  const ax = Math.abs(dx), ay = Math.abs(dy), forward = piece.owner === 'white' ? 1 : -1
  if (!ax && !ay) return false
  if (piece.role === 'knight') return ax * ay === 2
  if (piece.role === 'pawn') {
    if (capture ? ax !== 1 || dy !== forward : dx !== 0 || !(dy === forward || dy === 2 * forward && y === (piece.owner === 'white' ? 1 : 6))) return false
  } else if (piece.role === 'king') { if (Math.max(ax, ay) !== 1) return false }
  else if (piece.role === 'bishop' ? ax !== ay : piece.role === 'rook' ? ax !== 0 && ay !== 0 : ax !== ay && ax !== 0 && ay !== 0) return false
  let previous: string = piece.square
  for (let i = 1; i <= Math.max(ax, ay); i++) {
    const next: string = String.fromCharCode(97 + x + Math.sign(dx) * i) + (1 + y + Math.sign(dy) * i)
    if (effectsOf(state).some(e => e.type === 'fortification' && (e.from === previous && e.to === next || e.to === previous && e.from === next))) return false
    if (i < Math.max(ax, ay) && at(state.pieces, next)) return false
    previous = next
  }
  return true
}

function checked(state: GameState, color: Color): boolean {
  const king = state.pieces.find(p => p.owner === color && p.royal)!
  assert.ok(king?.square)
  return state.pieces.some(p => p.zone === 'board' && p.owner !== color && canReach(state, p, king.square!, true))
}

test('iteration 104 independently verifies every physical transition and full input immutability', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/104.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(rationale.length, trace.steps.length)
  let state = createGameState(trace.initial)
  let moves = 0, cards = 0
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, label = rationale[index]!
    assert.ok(label.startsWith(`${n} `))
    const before = structuredClone(state), expected = structuredClone(state)
    const actor = before.turn.color, opponent = actor === 'white' ? 'black' : 'white'
    let replacement = false, pawnMove = false, capture = false
    const relocated: string[] = []
    const movePiece = (from: string, to: string) => {
      const p = at(expected.pieces, from); assert.ok(p, label)
      p.square = square(to); relocated.push(p.id)
    }
    const take = (p: PieceState) => { assert.equal(p.royal, false, label); p.square = null; p.zone = 'captured'; p.capturedBy = actor; capture = true }
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      moves++
      assert.equal(before.turn.phase, 'beforeMove', label)
      const p = at(before.pieces, action.from)!; assert.ok(p, label); assert.equal(p.owner, actor, label)
      const victim = at(expected.pieces, action.to)
      assert.ok(canReach(before, p, action.to, !!victim), label)
      if (victim) { assert.equal(victim.owner, opponent, label); take(victim) }
      pawnMove = p.originalRole === 'pawn' && !p.promoted
      movePiece(action.from, action.to)
      expected.enPassant = p.role === 'pawn' && Math.abs(Number(action.to[1]) - Number(action.from[1])) === 2
        ? [{ target: square(action.from[0]! + ((Number(action.from[1]) + Number(action.to[1])) / 2)), pawnId: p.id }] : []
      replacement = true
    } else if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true, label)
      expected.turn = { color: opponent, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      expected.effects = effectsOf(expected).filter(e => !(e.type === 'dungeon' && e.player === actor))
    } else {
      assert.equal(action.type, 'playCard', label)
      if (action.type !== 'playCard') throw new Error(label)
      cards++
      const physical = expected.players[actor].hand.find(c => c.id === action.cardInstanceId)!
      assert.ok(physical, label); assert.equal(physical.cardId, action.cardId, label)
      assert.equal(before.turn.cardPlays[actor], 0, label)
      assert.ok(CARD_CATALOG[action.cardId]!.timing.includes(before.turn.phase), label)
      expected.players[actor].hand = expected.players[actor].hand.filter(c => c.id !== physical.id)
      expected.players[actor].hand.push(expected.players[actor].deck.shift()!)
      expected.turn.cardPlays[actor] = 1
      const retained = ['fortification', 'coup', 'fatal-attraction', 'haunting-memories'].includes(action.cardId)
      if (!retained) expected.players[actor].discard.push(physical)
      switch (action.cardId) {
        case 'fortification':
          assert.deepEqual(action.target, { from: 'd4', to: 'e4' })
          expected.effects.push({ type: 'fortification', owner: actor, card: physical, from: 'd4', to: 'e4' }); break
        case 'dubbing':
          assert.deepEqual(action.target, [{ from: 'e4', to: 'c3' }]); assert.equal(at(before.pieces, 'c3'), undefined)
          movePiece('e4', 'c3'); replacement = true; pawnMove = true; break
        case 'evangelists':
          assert.deepEqual(action.target, { own: 'c1', opponent: 'c8' })
          assert.equal(at(before.pieces, 'c1')!.role, 'bishop'); assert.equal(at(before.pieces, 'c8')!.role, 'bishop')
          expected.pieces.find(p => p.id === 'white-bishop-c1')!.square = 'c8'
          expected.pieces.find(p => p.id === 'black-bishop-c8')!.square = 'c1'
          replacement = true; break
        case 'coup':
          assert.equal(action.target, 'f1'); assert.ok(checked(before, 'white'))
          expected.pieces.find(p => p.id === 'white-king-e1')!.royal = false
          expected.pieces.find(p => p.id === 'white-bishop-f1')!.royal = true
          expected.effects.push({ type: 'coup', owner: actor, card: physical, princeId: 'white-king-e1', kingId: 'white-bishop-f1', princeRole: 'king' }); break
        case 'fatal-attraction':
          assert.equal(action.target, 'e2')
          expected.effects.push({ type: 'fatal-attraction', owner: actor, card: physical, pieceId: 'white-rook-h1' }); break
        case 'haunting-memories':
          assert.equal(action.target, 'g7')
          assert.equal([...before.history].reverse().find(e => e.type === 'cardPlayed')!.cardId, 'fatal-attraction')
          expected.effects.push({ type: 'fatal-attraction', owner: actor, card: physical, pieceId: 'black-king-e8' }); break
        case 'dungeon':
          assert.deepEqual(action.target, [{ from: 'h3', to: 'h8' }]); assert.equal(at(before.pieces, 'h8'), undefined)
          movePiece('h3', 'h8')
          expected.effects.push({ type: 'dungeon', owner: actor, player: opponent, pieceId: 'white-pawn-h2' }); break
        case 'anathema':
          assert.deepEqual(action.target, { bishop: 'b2', rook: 'b4' })
          expected.pieces.find(p => p.id === 'black-bishop-f8')!.square = 'b4'
          expected.pieces.find(p => p.id === 'black-rook-a8')!.square = 'b2'; break
        case 'evil-eye': {
          assert.deepEqual(action.target, { attacker: 'e3', victim: 'e7' })
          const attacker = at(before.pieces, 'e3')!, victim = at(expected.pieces, 'e7')!
          assert.equal(attacker.owner, actor); assert.equal(victim.owner, opponent)
          assert.ok(canReach(before, attacker, 'e7', true))
          const hypothetical = structuredClone(before)
          hypothetical.pieces.find(p => p.id === victim.id)!.square = null
          hypothetical.pieces.find(p => p.id === victim.id)!.zone = 'captured'
          hypothetical.pieces.find(p => p.id === attacker.id)!.square = 'e7'
          assert.equal(checked(hypothetical, actor), false, 'Evil Eye requires a legal, unpinned capture')
          take(victim); replacement = true; break
        }
        case 'lost-castle':
          assert.deepEqual(action.target, { own: 'a3', opponent: 'b2' })
          expected.pieces.find(p => p.id === 'white-rook-a1')!.square = 'b2'
          expected.pieces.find(p => p.id === 'black-rook-a8')!.square = 'a3'
          replacement = true; break
        case 'fireball':
          assert.equal(action.target, 'e2'); assert.deepEqual(before.history.at(-1), { type: 'move', from: 'e3', to: 'e2' })
          for (const p of expected.pieces.filter(p => p.square && distance(p.square, 'e2') <= 1 && !p.royal)) take(p)
          break
        default: throw new Error(`unreviewed card ${action.cardId}`)
      }
      if (replacement) expected.enPassant = []
    }
    for (const e of effectsOf(expected)) if (e.type === 'fatal-attraction' && relocated.includes(e.pieceId!)) {
      expected.players[e.owner].discard.push(e.card!)
      expected.effects = expected.effects.filter(item => item !== e)
    }
    if (replacement) expected.turn = { ...expected.turn, phase: 'afterMove', moveMade: true }
    const fen = before.fen.split(' ')
    if (replacement) {
      fen[1] = actor === 'white' ? 'b' : 'w'
      fen[4] = String(capture || pawnMove ? 0 : Number(fen[4]) + 1)
      fen[5] = String(Number(fen[5]) + (actor === 'black' ? 1 : 0))
      // Only f2-f4 offers an actual en-passant capture in this reviewed trace.
      fen[3] = n === 62 ? 'f3' : '-'
    } else if (capture) fen[4] = '0'
    for (const id of relocated) {
      const p = before.pieces.find(p => p.id === id)!
      if (p.royal) fen[2] = fen[2]!.replace(p.owner === 'white' ? /[KQ]/g : /[kq]/g, '')
      const right: Record<string, string> = { 'white-rook-a1': 'Q', 'white-rook-h1': 'K', 'black-rook-a8': 'q', 'black-rook-h8': 'k' }
      if (right[id]) fen[2] = fen[2]!.replace(right[id]!, '')
    }
    fen[2] ||= '-'
    const result = applyAction(state, action)
    assert.deepEqual(state, before, `${label}: full structuredClone input including capturedBy`)
    assert.ok(result.ok, label)
    assert.deepEqual(result.state.pieces, expected.pieces, `${label}: all physical records, including unaffected identities`)
    assert.deepEqual(result.state.players, expected.players, `${label}: exact physical cards in all zones`)
    assert.deepEqual(result.state.effects, expected.effects, `${label}: complete effects`)
    assert.deepEqual(result.state.turn, expected.turn, `${label}: turn and allowances`)
    assert.deepEqual(result.state.enPassant, expected.enPassant, `${label}: physical en-passant eligibility`)
    assert.deepEqual(result.state.fen.split(' ').slice(1), fen.slice(1), `${label}: color, castling, en-passant and clocks`)
    assert.equal(result.state.orientation, 0, label)
    assert.equal(!!result.state.pendingRescue, n === 70, label)
    assert.equal(checked(result.state, actor), n === 70, `${label}: independent royal safety with wall/magnet restrictions`)
    if (action.type === 'playCard' && !['fortification', 'coup', 'fatal-attraction', 'haunting-memories'].includes(action.cardId)) {
      assert.equal(checked(result.state, opponent), false, `${label}: regular card gives no check, hence no direct mate`)
    }
    assert.equal(result.state.outcome, null, label)
    state = result.state
  }
  assert.equal(moves, 50); assert.equal(cards, 11)
  assert.equal(state.fen, trace.finalFen)
})

test('iteration 104 generated trace replays', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/104.json', import.meta.url), 'utf8')) as RandomTrace
  assert.ok(trace)
  replayTrace(trace)
})
