import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { checkState, replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { GameState, PieceState } from '../types.js'
import type { SquareName } from 'chessops/types'
import { CARD_CATALOG } from './catalog.js'

// Each entry records the actual action reviewed, including every turn boundary.
const rationale = [
  '1 Long Jump: g1 and e4 have opposite colors; e4 is empty; the Knight jumps and consumes the move.',
  '2 White ends its completed replacement move; Black receives fresh allowances.',
  '3 Black g7-g6 is one forward Pawn step into an empty square.',
  '4 Disintegration kills the owned f7 Pawn permanently after the move.',
  '5 Black ends its turn with f7 dead and no capture return available.',
  '6 White Knight e4-g5 is a clear jumping L move.',
  '7 Black reacts with Plots; it may save only currently legal cards, not newly drawn Anathema.',
  '8 White ends its move; unused Black Plots permissions expire.',
  '9 Black b7-b5 crosses vacant b6 and creates b6 en passant.',
  '10 Black ends its move preserving the immediate b6 en-passant opportunity.',
  '11 Blessing moves h2 Pawn diagonally through empty g3/f4 to e5 without capture; b6 rights expire.',
  '12 White ends the Blessing replacement move.',
  '13 Black d7-d6 is one empty forward step.',
  '14 Black ends the quiet Pawn move.',
  '15 White g2-g4 crosses vacant g3 and creates g3 en passant.',
  '16 White ends its move preserving g3 en passant.',
  '17 Black Bishop c8-d7 uses the newly vacated square and expires g3 rights.',
  '18 Black ends the Bishop move.',
  '19 White Bishop f1-g2 moves diagonally to the vacated Pawn square.',
  '20 White ends the Bishop move.',
  '21 Black Knight g8-h6 is a noncapturing L jump.',
  '22 Black ends the Knight move.',
  '23 White Rook h1-g1 moves horizontally and loses its kingside castling right.',
  '24 Merciless grants the same noncapturing Rook a second move g1-f1; no extra clock increment.',
  '25 White ends the completed Rook turn after Merciless.',
  '26 Black Bishop d7-c6 moves one diagonal step.',
  '27 Black ends the Bishop move.',
  '28 White Bishop g2-f3 moves one diagonal step.',
  '29 White ends the Bishop move.',
  '30 Black Queen d8-d7 moves one vertical step.',
  '31 Panic starts a 15000ms obligation for White after Black has moved.',
  '32 Black ends its turn; White inherits the Panic obligation.',
  '33 Panic timeout skips White without moving any piece; the temporary obligation expires.',
  '34 Black King e8-d8 moves to an unattacked adjacent square and loses both castling rights.',
  '35 Black ends the safe King move.',
  '36 White Bishop f3-d5 crosses empty e4.',
  '37 Rebirth returns the opposing h6 Knight to its vacant original-type g8 starting square.',
  '38 White ends its move after Rebirth; no capture occurred.',
  '39 Black a7-a6 advances one empty step.',
  '40 Fortification places an adjacent c2-d1 boundary and retains its Continuing Effect card.',
  '41 Black ends the Pawn move with the wall active.',
  '42 White b2-b4 crosses empty b3, never crossing the c2-d1 wall.',
  '43 White ends its move preserving b3 en passant.',
  '44 Black Bishop f8-g7 uses an empty diagonal square; b3 rights expire.',
  '45 Anathema swaps White c1 Bishop/a1 Rook without a path or capture.',
  '46 Black ends the completed turn after the enemy-piece swap.',
  '47 White Knight g5-f7 lands on the empty square of the disintegrated Pawn.',
  '48 White ends the Knight move.',
  '49 Black King d8-e8 is adjacent and unattacked by the Knight on f7.',
  '50 Black ends the King move without restoring castling rights.',
  '51 White Bishop a1-c3 crosses empty b2; its diagonal does not cross c2-d1.',
  '52 White ends the Bishop move.',
  '53 Black h7-h6 advances into an empty square.',
  '54 Black ends the Pawn move.',
  '55 White Rook f1-h1 crosses vacant g1; old castling rights stay lost.',
  '56 Peace Talks cancels the Black c2-d1 wall and discards its physical card to Black.',
  '57 White ends the Rook turn after wall cancellation.',
  '58 Black a6-a5 advances one empty square.',
  '59 Black ends the Pawn move.',
  '60 Confabulation moves c3 Bishop through d4 onto friendly e5 Pawn, merging both identities.',
  '61 White ends the merge replacement move; Bishop remains a component of the Pawn carrier.',
  '62 Under Elf Hill removes Black royal identity e8 to away, consumes its move, and schedules return.',
  '63 Black ends its absence turn; return is not due on White turn.',
  '64 White composite e5-e6 uses its Pawn component forward step; no promotion or split.',
  '65 White ends its move; Black royal return becomes due now.',
  '66 Black returns its King to vacant safe edge a6, retains its move, and cannot move that King this turn.',
  '67 Evil Eye captures White b4 Pawn threatened by Black a5 Pawn without moving the attacker.',
  '68 Black ends the stationary capture turn; the returned King movement restriction expires.',
  '69 Passing in the Night simultaneously swaps e2/c7 and g4/d6 enemy Pawn pairs without captures.',
  '70 White ends the double-swap replacement move.',
  '71 Black Bishop g7-a1 traverses empty f6/e5/d4/c3/b2.',
  '72 Black ends the long diagonal move.',
  '73 White Rook h1-h6 crosses h2/h3/h4/h5 and captures the Black h7 Pawn on h6.',
  '74 White ends the capture; Black Pawn stays captured by White.',
  '75 Black e7-d6 captures White g2 Pawn diagonally forward.',
  '76 Black ends its capture; White Pawn stays captured by Black.',
  '77 White c2-c3 advances into the empty former Bishop square.',
  '78 White ends the Pawn move.',
  '79 Black Knight g8-e7 is an ordinary L jump.',
  '80 Black ends the Knight move.',
  '81 White d2-d4 crosses empty d3 and creates d3 en passant.',
  '82 White ends its move preserving d3 en passant.',
  '83 Black King a6-a7 is adjacent and safe; its earlier return restriction has expired.',
  '84 Black ends the King move and the unclaimed en-passant window is gone.',
  '85 White composite e6-f5 uses its Bishop component for a backward empty diagonal move.',
  '86 White ends the composite move without separating its identities.',
  '87 Black Bishop c6-d5 captures White f1 Bishop, not the separate merged c1 Bishop.',
  '88 Black ends its capture; the Confabulation effect remains active.',
  '89 White Knight f7-e5 jumps into an empty square.',
  '90 White ends the Knight move.',
  '91 Black Bishop d5-g8 crosses empty e6/f7.',
  '92 Black ends the diagonal move.',
  '93 White Queen d1-d2 moves vertically into a vacant square.',
  '94 White ends the Queen move.',
  '95 Black g6-g5 advances into an empty square.',
  '96 Black ends the Pawn move.',
  '97 White composite f5-d3 crosses empty e4 using Bishop movement; Pawn identity resets the clock.',
  '98 White ends the composite move.',
  '99 Resurrection returns the captured Black h7 Pawn to vacant b7, clears captor, and consumes the move.',
  '100 Black ends Resurrection with the dead f7 Pawn still dead.',
  '101 White Knight e5-g4 captures the Black d7 Pawn previously relocated by Passing in the Night.',
  '102 White ends the Knight capture.',
  '103 Black Knight b8-c6 jumps to an empty square.',
  '104 Siege swaps owned Knight e7 and Rook h8 without changing identities or clocks.',
  '105 Black ends its turn after Siege.',
  '106 White Rook h6-g6 moves one empty horizontal square.',
  '107 White ends the Rook move.',
  '108 Black Rook e7-e8 moves one vertical square.',
  '109 Black ends the Rook move.',
  '110 Masquerade gives White g6 Rook a Queen diagonal step to empty h5, without capture.',
  '111 White ends Masquerade replacement move.',
  '112 Black Bishop g8-h7 moves one diagonal step.',
  '113 Black ends the Bishop move.',
  '114 Under Elf Hill removes White King e1 to away and revokes its remaining castling right.',
  '115 White ends its absence turn; its return is not due during Black turn.',
  '116 Black Rook e8-d8 moves one horizontal square.',
  '117 Black ends its move; White King return is now due.',
  '118 White King returns to empty safe edge a3, retaining its Regular Move with the King immobilized.',
  '119 White composite d3-f5 crosses empty e4 using Bishop powers while the returned King remains a3.',
  '120 White ends its move and the King return restriction expires.',
  '121 Doppelganger moves Black h8 Knight to empty g7 using the Bishop kind of the just-moved composite.',
  '122 Black ends Doppelganger replacement move.',
  '123 White Rook h5-h3 crosses empty h4.',
  '124 White ends the Rook move.',
  '125 Black d6-d5 advances one square into an empty destination.',
  '126 Black ends the Pawn move.',
  '127 White Rook h3-h6 crosses empty h4/h5.',
  '128 White ends the Rook move.',
  '129 Black Bishop h7-g6 moves one diagonal step.',
  '130 Black ends the Bishop move.',
  '131 White Queen d2-b2 crosses vacant c2 and leaves King a3 safe.',
  '132 White ends regular move fifty; Black has fresh allowances and no pending return or rescue.',
]

const xy = (square: string) => {
  assert.match(square, /^[a-h][1-8]$/)
  return [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const
}
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square)
function path(pieces: PieceState[], from: string, to: string): void {
  const [x, y] = xy(from), [u, v] = xy(to)
  assert.ok(x === u || y === v || Math.abs(x - u) === Math.abs(y - v))
  for (let a = x + Math.sign(u - x), b = y + Math.sign(v - y); a !== u || b !== v; a += Math.sign(u - x), b += Math.sign(v - y)) {
    assert.equal(at(pieces, `${String.fromCharCode(97 + a)}${b + 1}`), undefined, 'independent clear path')
  }
}
function canAttack(pieces: PieceState[], from: string, to: string, role: PieceState['role'], owner: PieceState['owner']): boolean {
  const [x, y] = xy(from), [u, v] = xy(to), dx = Math.abs(u - x), dy = Math.abs(v - y)
  if (role === 'pawn') return dx === 1 && v - y === (owner === 'white' ? 1 : -1)
  if (role === 'knight') return dx * dy === 2
  if (role === 'king') return Math.max(dx, dy) === 1
  if (!(role === 'bishop' ? dx === dy : role === 'rook' ? dx === 0 || dy === 0 : dx === dy || dx === 0 || dy === 0)) return false
  try { path(pieces, from, to); return true } catch { return false }
}
function safe(state: GameState, color: 'white' | 'black'): void {
  const king = state.pieces.find(p => p.royal && p.owner === color)!
  if (king.zone === 'away') return
  assert.ok(king.square)
  for (const enemy of state.pieces.filter(p => p.zone === 'board' && p.owner !== color)) {
    if (state.underElfHill?.some(e => e.pieceId === enemy.id && e.returned)) continue
    const roles = [enemy.role]
    if (enemy.id === 'white-pawn-h2' && state.effects.some(e => (e as { type?: string }).type === 'confabulation')) roles.push('bishop')
    for (const role of roles) assert.equal(canAttack(state.pieces, enemy.square!, king.square, role, enemy.owner), false, `${color} King safe from ${enemy.id}/${role}`)
  }
}

test('iteration 094 generated trace replays', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/094.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(rationale.length, trace.steps.length)
  assert.equal(trace.steps.length, 132)
  assert.equal(trace.moves, 50)
  let state = createGameState(trace.initial)
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1
    assert.ok(rationale[index]!.startsWith(`${n} `))
    const untouched = structuredClone(state)
    const result = applyAction(state, action)
    assert.deepEqual(state, untouched, `${n}: complete input immutability, including capturedBy`)
    assert.ok(result.ok, rationale[index])
    const next = result.state
    checkState(next)
    const expected = structuredClone(state.pieces)
    const relocate = (from: string, to: string) => {
      xy(to)
      const piece = at(expected, from)
      assert.ok(piece, `${n}: expected mover at ${from}`)
      piece.square = to as SquareName
    }
    let reset = false, clockMove = false
    const parts = state.fen.split(' '), afterParts = next.fen.split(' ')
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const mover = at(state.pieces, action.from)!
      assert.ok(mover)
      assert.equal(mover.owner, state.turn.color)
      const victim = at(state.pieces, action.to)
      const [x, y] = xy(action.from), [u, v] = xy(action.to)
      const compositeBishop = mover.id === 'white-pawn-h2' && n > 60 && x !== u
      if (mover.role === 'pawn' && !compositeBishop) {
        const forward = mover.owner === 'white' ? 1 : -1
        if (victim) assert.ok(Math.abs(x - u) === 1 && v - y === forward)
        else {
          assert.equal(x, u)
          assert.ok(v - y === forward || v - y === 2 * forward && y === (mover.owner === 'white' ? 1 : 6))
          path(state.pieces, action.from, action.to)
        }
      } else assert.ok(canAttack(state.pieces, action.from, action.to, compositeBishop ? 'bishop' : mover.role, mover.owner), rationale[index])
      if (n >= 40 && n < 56) assert.ok(!([action.from, action.to].includes('c2') && [action.from, action.to].includes('d1')), 'move does not cross wall')
      if (victim) {
        assert.notEqual(victim.owner, mover.owner)
        assert.equal(victim.royal, false)
        Object.assign(expected.find(p => p.id === victim.id)!, { square: null, zone: 'captured', capturedBy: state.turn.color })
      }
      relocate(action.from, action.to)
      reset = mover.originalRole === 'pawn' || !!victim
      clockMove = true
      const ep = mover.role === 'pawn' && x === u && Math.abs(y - v) === 2
        ? [{ target: `${action.from[0]}${(y + v) / 2 + 1}`, pawnId: mover.id }] : []
      assert.deepEqual(next.enPassant, ep, `${n}: independently calculated en passant`)
      assert.deepEqual(next.turn, { ...state.turn, phase: 'afterMove', moveMade: true })
      assert.deepEqual(next.players, state.players)
      assert.deepEqual(next.effects, state.effects)
    } else if (action.type === 'playCard') {
      const owner = (['white', 'black'] as const).find(c => state.players[c].hand.some(card => card.id === action.cardInstanceId))!
      assert.ok(owner)
      const card = state.players[owner].hand.find(c => c.id === action.cardInstanceId)!
      const meta = CARD_CATALOG[action.cardId]!
      assert.equal(state.turn.cardPlays[owner], 0)
      assert.ok(meta.timing.includes(owner === state.turn.color ? state.turn.phase : 'afterOpponentMove'))
      const players = structuredClone(state.players)
      players[owner].hand = players[owner].hand.filter(c => c.id !== card.id)
      players[owner].hand.push(players[owner].deck.shift()!)
      if (!meta.continuing) players[owner].discard.push(card)
      let effects = structuredClone(state.effects)
      switch (n) {
        case 1: {
          const [x, y] = xy('g1'), [u, v] = xy('e4')
          assert.notEqual((x + y) % 2, (u + v) % 2)
          assert.equal(at(expected, 'e4'), undefined)
          relocate('g1', 'e4'); clockMove = true; break
        }
        case 4: Object.assign(at(expected, 'f7')!, { square: null, zone: 'dead' }); break
        case 7:
          assert.equal(next.plotsAllowances?.[0]?.remaining, 2)
          assert.equal(next.plotsAllowances?.[0]?.player, 'black')
          assert.ok(!next.plotsAllowances?.[0]?.eligibleCards.includes(players.black.hand.at(-1)!.id))
          break
        case 11: path(expected, 'h2', 'e5'); relocate('h2', 'e5'); reset = clockMove = true; break
        case 24: path(expected, 'g1', 'f1'); relocate('g1', 'f1'); break
        case 31: effects.push({ type: 'panic', owner: 'black', player: 'white', durationMs: 15000 }); break
        case 37: assert.equal(at(expected, 'g8'), undefined); relocate('h6', 'g8'); break
        case 40: effects.push({ type: 'fortification', owner: 'black', card, from: 'c2', to: 'd1' }); break
        case 45: {
          const bishop = at(expected, 'c1')!, rook = at(expected, 'a1')!
          assert.equal(bishop.role, 'bishop'); assert.equal(rook.role, 'rook')
          bishop.square = 'a1'; rook.square = 'c1'; break
        }
        case 56:
          effects = []
          players.black.discard.push({ id: 'black-hand-1-fortification', cardId: 'fortification' })
          break
        case 60:
          path(expected, 'c3', 'e5')
          Object.assign(at(expected, 'c3')!, { square: null, zone: 'away' })
          effects.push({ type: 'confabulation', owner: 'white', card, pieceIds: ['white-pawn-h2', 'white-bishop-c1'] })
          clockMove = true
          break
        case 62: case 114: {
          const king = expected.find(p => p.royal && p.owner === owner)!
          king.zone = 'away'; king.square = null
          assert.deepEqual(next.underElfHill, [{ pieceId: king.id, player: owner, returning: false }])
          clockMove = true; break
        }
        case 67:
          assert.ok(canAttack(expected, 'a5', 'b4', 'pawn', 'black'))
          Object.assign(at(expected, 'b4')!, { square: null, zone: 'captured', capturedBy: 'black' })
          reset = clockMove = true; break
        case 69: {
          const e2 = at(expected, 'e2')!, c7 = at(expected, 'c7')!, g4 = at(expected, 'g4')!, d6 = at(expected, 'd6')!
          assert.ok([e2, c7, g4, d6].every(p => p.role === 'pawn'))
          e2.square = 'c7'; c7.square = 'e2'; g4.square = 'd6'; d6.square = 'g4'
          reset = clockMove = true; break
        }
        case 99: {
          const pawn = expected.find(p => p.id === 'black-pawn-h7')!
          assert.equal(pawn.zone, 'captured'); assert.equal(at(expected, 'b7'), undefined)
          pawn.zone = 'board'; pawn.square = 'b7'; delete pawn.capturedBy
          reset = clockMove = true; break
        }
        case 104: {
          const knight = at(expected, 'e7')!, rook = at(expected, 'h8')!
          assert.equal(knight.role, 'knight'); assert.equal(rook.role, 'rook')
          knight.square = 'h8'; rook.square = 'e7'; break
        }
        case 110: path(expected, 'g6', 'h5'); relocate('g6', 'h5'); clockMove = true; break
        case 121:
          assert.equal(state.history.filter(e => e.type === 'move').at(-1)?.from, 'd3')
          assert.ok(state.effects.some(e => (e as { type?: string }).type === 'confabulation'))
          path(expected, 'h8', 'g7'); relocate('h8', 'g7'); clockMove = true; break
        default: assert.fail(`unreviewed card action ${n}`)
      }
      assert.deepEqual(next.players, players, `${n}: exact spend, draw, discard and continuing-card accounting`)
      assert.deepEqual(next.effects, effects)
      assert.deepEqual(next.turn, { ...state.turn, ...(clockMove ? { phase: 'afterMove', moveMade: true } : {}), cardPlays: { ...state.turn.cardPlays, [owner]: 1 } })
      assert.deepEqual(next.enPassant, clockMove ? [] : state.enPassant)
      safe(next, 'white'); safe(next, 'black')
    } else if (action.type === 'endTurn') {
      assert.equal(state.turn.moveMade, true)
      assert.deepEqual(next.turn, { color: state.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } })
      assert.deepEqual(next.players, state.players)
      assert.deepEqual(next.effects, state.effects)
      assert.deepEqual(next.enPassant, state.enPassant)
      assert.equal(next.plotsAllowances?.length ?? 0, 0)
      const elf = state.underElfHill?.filter(e => !e.returned).map(e => ({ ...e, returning: e.player === next.turn.color || e.returning }))
      assert.deepEqual(next.underElfHill, elf)
    } else if (action.type === 'panicTimeout') {
      assert.equal(n, 33)
      assert.deepEqual(next.effects, [])
      assert.deepEqual(next.players, state.players)
      assert.deepEqual(next.turn, { color: 'black', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } })
      clockMove = true
    } else if (action.type === 'returnKing') {
      assert.ok(n === 66 || n === 118)
      const square = n === 66 ? 'a6' : 'a3'
      const king = expected.find(p => p.royal && p.owner === state.turn.color)!
      assert.equal(king.zone, 'away'); assert.equal(at(expected, square), undefined)
      king.zone = 'board'; king.square = square
      assert.deepEqual(next.underElfHill, [{ pieceId: king.id, player: king.owner, returning: true, returned: true }])
      assert.deepEqual(next.turn, state.turn)
      assert.deepEqual(next.players, state.players)
      assert.deepEqual(next.effects, state.effects)
    } else assert.fail(`unreviewed action ${n}`)
    assert.deepEqual(next.pieces, expected, `${n}: independent complete physical identity/capture oracle`)
    assert.equal(afterParts[4], String(reset ? 0 : Number(parts[4]) + (clockMove ? 1 : 0)), `${n}: halfmove clock`)
    assert.equal(afterParts[5], String(Number(parts[5]) + (clockMove && state.turn.color === 'black' ? 1 : 0)), `${n}: fullmove clock`)
    assert.equal(afterParts[1], clockMove ? state.turn.color === 'white' ? 'b' : 'w' : parts[1])
    assert.equal(afterParts[2], n < 23 ? 'KQkq' : n < 34 ? 'Qkq' : n < 45 ? 'Q' : n < 114 ? 'A' : '-', `${n}: castling history remains lost after movement`)
    assert.equal(next.pendingRescue ?? null, null)
    safe(next, state.turn.color)
    state = next
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 19)
  assert.equal(state.fen, 'r2r4/kpPq2n1/2n3bR/pp1p1Pp1/3P2N1/K1P5/PQ2pP2/bNR5 b - - 3 31')
  assert.deepEqual(state.underElfHill, [])
  assert.equal(replayTrace(trace).fen, state.fen)
})
