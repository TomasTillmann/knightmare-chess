import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameState, PieceState, SquareName } from '../types.js'

// Reviewed in order against rules §§8–11, 14.1, 16.2, 17.2, 19.2–3, 20;
// cards.md and artwork KC15/4, KC9/2, KC2/1, KC5/2, KC3/1, KC7/1,
// KC15/3, KC19/2, KC1/3. No expectations below are read from trace hashes.
const rationales = [
  '1 White Nb1-c3 is an empty L jump; no capture or pawn clock reset.',
  '2 End White turn after Nc3; Black receives both fresh card allowances.',
  '3 Black d7-d5 crosses empty d6; two-square starting Pawn move creates d6 opportunity.',
  '4 End Black turn; preserve d6 opportunity until White acts.',
  '5 White b2-b4 crosses empty b3; replace the old opportunity with b3.',
  '6 End White turn after b4; no extra move or draw.',
  '7 Black c7-c5 crosses empty c6 and creates c6 opportunity.',
  '8 End Black turn after c5; preserve the physical board.',
  '9 White Nc3-e4 is an empty L jump; clear c6 opportunity.',
  '10 End White turn after Ne4; no card was spent.',
  '11 Black b7-b6 advances one square into empty b6.',
  '12 End Black turn after b6; no capture or replacement draw.',
  '13 White d2-d4 crosses vacant d3 and creates d3 opportunity.',
  '14 End White turn after d4; preserve d3 opportunity.',
  '15 Black Bc8-d7 is an empty one-square diagonal; clear the old opportunity.',
  '16 End Black turn after Bd7; reset allowances.',
  '17 White Bc1-d2 is an empty diagonal, with the original bishop identity.',
  '18 White Abduction after Bd2 conceals opposing nonroyal Rh8; away is not captured; draw Resurrection.',
  '19 Reveal ends the concealment timer and opens Black recall without changing the board.',
  '20 Recall timeout captures Rh8 for White, removes Black kingside rights and resets halfmoves only.',
  '21 End White turn after resolved Abduction; no second draw.',
  '22 Black g7-g6 advances one into an empty square.',
  '23 End Black turn after g6; keep Rh8 captured by White.',
  '24 White f2-f4 crosses empty f3; creates f3 opportunity.',
  '25 White Truce after f4 forbids captures; retain its physical card and draw Annexation.',
  '26 End White turn; Truce persists because neither King is checked.',
  '27 Black f7-f5 is a quiet double step over f6, permitted by Truce.',
  '28 End Black turn after f5; preserve f6 opportunity.',
  '29 White Ne4-c3 jumps to an empty square, making no forbidden capture.',
  '30 End White turn after Nc3; Truce and card zones remain.',
  '31 Black Bd7-c6 is an empty diagonal under Truce.',
  '32 End Black turn after Bc6; no clocks advance on endTurn.',
  '33 White e2-e3 is an empty forward Pawn step and resets halfmoves.',
  '34 End White turn after e3; no card draw.',
  '35 Black Bc6-b5 is a vacant adjacent diagonal.',
  '36 End Black turn after Bb5; Truce still has no check trigger.',
  '37 White Qd1-e2 is a vacant adjacent diagonal.',
  '38 End White turn after Qe2; preserve all identities.',
  '39 Black Bf8-g7 is a vacant adjacent diagonal.',
  '40 End Black turn after Bg7; no extra move.',
  '41 White h2-h3 is an empty forward step and resets halfmoves.',
  '42 End White turn after h3; retain Truce.',
  '43 Black Bb5-a4 is a vacant adjacent diagonal.',
  '44 End Black turn after Ba4; no new card effects.',
  '45 White Ke1-d1 moves one square safely and loses both White castling rights.',
  '46 End White turn after Kd1; no King check is introduced.',
  '47 Black Nb8-a6 jumps to an empty square.',
  '48 End Black turn after Na6; only Black queenside rights remain.',
  '49 White Annexation replaces the move: g2-g4 over g3 and h3-h5 over h4, both empty; only g Pawn eligible for EP; draw Doomsayer.',
  '50 End the Annexation turn; no Regular Move is also granted.',
  '51 Black Ng8-f6 jumps to empty f6 and expires Annexation EP.',
  '52 End Black turn after Nf6; Truce persists.',
  '53 White Qe2-g2 slides through empty f2 without capture.',
  '54 White Earthquake after Qg2 rotates forward to east/west; Black a7 then White h5 promote to Queens; retain card and draw Fog.',
  '55 End White turn after rotation; keep fixed square coordinates and both promoted identities.',
  '56 Black Qd8-c8 makes a quiet one-file slide.',
  '57 End Black turn after Qc8; rotated Pawn direction persists.',
  '58 White a2-b2 moves east into empty b2 from the rotated first rank.',
  '59 End White turn after b2; no EP from a single step.',
  '60 Black Ke8-f8 moves to a safe adjacent square and loses remaining queenside rights.',
  '61 End Black turn after Kf8; neither side may castle.',
  '62 White Ra1-a2 moves one rank into the square vacated by the rotated Pawn.',
  '63 End White turn after Ra2; no captures or effects expire.',
  '64 Black Nf6-g8 is an empty L jump.',
  '65 End Black turn after Ng8; Truce remains active.',
  '66 White promoted h-Pawn Qh5-h4 uses its current Queen movement.',
  '67 End White turn after Qh4; promotion is permanent.',
  '68 Black g6-e6 moves west two through empty f6 from rotated second rank; f6 EP opportunity.',
  '69 End Black turn after e6; preserve rotated f6 opportunity.',
  '70 White Nc3-e4 jumps into empty e4 and expires rotated EP.',
  '71 End White turn after Ne4; no capture.',
  '72 Black Qc8-b7 is an empty diagonal.',
  '73 End Black turn after Qb7; physical a7 promoted Queen remains separate.',
  '74 White promoted Queen h4-h3 moves one square on its file.',
  '75 End White turn after Qh3; all captures remain forbidden.',
  '76 Black Qb7-d7 crosses empty c7 and ends empty.',
  '77 End Black turn after Qd7; no check ends Truce.',
  '78 White Ne4-d6 is an empty L jump; it does not check Kf8.',
  '79 End White turn after Nd6; no card allowance carried forward.',
  '80 Black Ng8-h6 is an empty L jump.',
  '81 Black Holy War after Nh6 swaps its Na6 and Ba4 simultaneously without capture; draw Crab.',
  '82 End Black turn after the swap; Knight and Bishop preserve identities and roles.',
  '83 White promoted Queen h3-h4 slides to empty h4.',
  '84 End White turn after Qh4; Truce persists.',
  '85 Black Ba6-c8 travels diagonally through empty b7 to empty c8.',
  '86 End Black turn after Bc8; no capture.',
  '87 White Qg2-g3 moves one file-aligned square.',
  '88 End White turn after Qg3; both Queens retain their own IDs.',
  '89 Black Qd7-c6 moves one empty diagonal square.',
  '90 Black Crab after Qc6 marks its unpromoted original g-Pawn on e6; retain card and draw Doomsayer.',
  '91 End Black turn with Crab and Earthquake both active; Crab keeps Pawn role.',
  '92 White Qg3-g2 makes a quiet one-square file move.',
  '93 End White turn after Qg2; no speech has triggered Doomsayer.',
  '94 Black Under Elf Hill replaces the move: Kf8 goes away; Black return due next Black turn; draw Fog.',
  '95 White Fog immediately cancels Elf Hill: restore Kf8 and clocks, discard both cards, restore Black move but keep both allowances spent; draw Cowardice.',
  '96 Black Bc8-b7 makes its restored Regular Move to an empty diagonal square.',
  '97 End Black turn after Bb7; canceled Elf Hill cannot schedule a return.',
  '98 White d4-e4 is a rotated eastward Pawn step into empty e4.',
  '99 White Doomsayer after e4 opens immediate Black naming choice; retain card and draw Man-Trap.',
  '100 Black Fog immediately cancels Doomsayer before speech; discard both cards, clear choice and retain completed e4 move; draw Onslaught.',
  '101 End White turn after cancellation; both allowances reset for Black.',
  '102 Black Bg7-d4 slides through empty f6,e5 to empty d4; Crab e6 is off that ray.',
  '103 End Black turn after Bd4; no direct check or capture.',
  '104 White Qg2-h3 moves to a vacant adjacent diagonal square.',
  '105 End White turn after Qh3; preserve all active continuing effects.',
  '106 Black Ra8-d8 crosses vacant b8,c8 and ends on empty d8.',
  '107 End Black turn after Rd8; no castling rights can be regained.',
  '108 White Bd2-e1 moves diagonally into empty e1.',
  '109 End White turn after Be1; King remains on d1.',
  '110 Black Bd4-c3 makes a quiet adjacent diagonal move.',
  '111 End Black turn after Bc3; no Truce termination.',
  '112 White promoted Queen h4-g3 moves diagonally into empty g3, distinct from Queen h3.',
  '113 End White turn after the fiftieth Regular Move; no pending choices or return obligations remain.',
]

const xy = (square: string): [number, number] => [square.charCodeAt(0) - 97, Number(square[1]) - 1]
const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white'

// Independent geometry from physical records, including rotated Pawn/Crab attacks.
function reaches(piece: PieceState, to: string, pieces: PieceState[], rotated: boolean, attack: boolean, crab: boolean): boolean {
  assert.ok(piece.square)
  const [x, y] = xy(piece.square), [tx, ty] = xy(to)
  const dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy)
  const occupied = (fx: number, fy: number) => pieces.some(p => p.zone === 'board' && p.square === `${String.fromCharCode(97 + fx)}${fy + 1}`)
  if (piece.role === 'knight') return ax * ay === 2
  if (piece.role === 'king') return Math.max(ax, ay) === 1
  if (piece.role === 'pawn') {
    const sign = piece.owner === 'white' ? 1 : -1
    const forward = (rotated ? dx : dy) * sign, side = rotated ? ay : ax
    if (attack || crab) return forward === 1 && side === 1
    if (side || forward < 1 || forward > 2) return false
    const rank = rotated ? x : y
    if (forward === 2 && !(piece.owner === 'white' ? rank === 1 || rotated && rank === 0 : rank === 6 || rotated && rank === 7)) return false
    return forward === 1 || !occupied(x + (rotated ? sign : 0), y + (rotated ? 0 : sign))
  }
  const diagonal = ax === ay && ax > 0, straight = (dx === 0) !== (dy === 0)
  if (!(piece.role === 'queen' && (diagonal || straight) || piece.role === 'bishop' && diagonal || piece.role === 'rook' && straight)) return false
  for (let i = 1; i < Math.max(ax, ay); i++) if (occupied(x + Math.sign(dx) * i, y + Math.sign(dy) * i)) return false
  return true
}

test('iteration 123 independently reviewed physical, card, timing, and royal oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/123.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(rationales.length, trace.steps.length)
  assert.equal(trace.steps.length, 113)
  let state = createGameState(trace.initial)
  const pieces = structuredClone(state.pieces), players = structuredClone(state.players)
  let turn = structuredClone(state.turn)
  let effects: unknown[] = [], ep: GameState['enPassant'] = []
  let rotated = false, half = 0, full = 1, fenTurn: Color = 'white', rights = 'KQkq'
  let abductionBefore: GameState | undefined
  const piece = (id: string) => { const p = pieces.find(p => p.id === id); assert.ok(p); return p }
  const at = (square: string) => pieces.find(p => p.zone === 'board' && p.square === square)
  const finishMove = (pawn: boolean) => {
    half = pawn ? 0 : half + 1
    if (turn.color === 'black') full++
    fenTurn = opposite(turn.color)
    turn.phase = 'afterMove'; turn.moveMade = true
  }
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, action = step.action, why = rationales[index]
    assert.ok(why.startsWith(`${n} `))
    const before = structuredClone(state)
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      assert.match(action.to, /^[a-h][1-8]$/)
      assert.equal(turn.moveMade, false, why)
      const mover = at(action.from); assert.ok(mover, why)
      assert.equal(mover.owner, turn.color, why)
      assert.equal(at(action.to), undefined, 'all 50 reviewed Regular Moves are quiet')
      assert.ok(reaches(mover, action.to, pieces, rotated, false, false), why)
      const [x, y] = xy(action.from), [tx, ty] = xy(action.to)
      ep = []
      if (mover.role === 'pawn' && Math.max(Math.abs(tx - x), Math.abs(ty - y)) === 2) {
        ep = [{ target: `${String.fromCharCode(97 + (x + tx) / 2)}${1 + (y + ty) / 2}` as SquareName, pawnId: mover.id }]
      }
      if (mover.royal) rights = rights.replace(mover.owner === 'white' ? /[KQ]/g : /[kq]/g, '')
      mover.square = action.to as SquareName
      finishMove(mover.role === 'pawn')
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true, why)
      turn = { color: opposite(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
    } else if (action.type === 'playCard') {
      const owner: Color = [81, 90, 94, 100].includes(n) ? 'black' : 'white'
      const player = players[owner]
      const card = player.hand.find(c => c.id === action.cardInstanceId)
      assert.ok(card, why); assert.equal(card.cardId, action.cardId, why)
      assert.equal(turn.cardPlays[owner], 0, why)
      const continuing = ['truce', 'earthquake', 'crab', 'doomsayer'].includes(card.cardId)
      player.hand = player.hand.filter(c => c.id !== card.id)
      if (!continuing) player.discard.push(card)
      const draw = player.deck.shift(); assert.ok(draw); player.hand.push(draw)
      turn.cardPlays[owner]++
      if (n === 18) {
        assert.equal(action.target, 'h8'); abductionBefore = before
        Object.assign(piece('black-rook-h8'), { square: null, zone: 'away' })
      } else if (n === 25) {
        effects.push({ type: 'truce', owner, card })
      } else if (n === 49) {
        assert.deepEqual(action.target, [{ from: 'g2', to: 'g4' }, { from: 'h3', to: 'h5' }])
        for (const square of ['g3', 'g4', 'h4', 'h5']) assert.equal(at(square), undefined, why)
        piece('white-pawn-g2').square = 'g4'; piece('white-pawn-h2').square = 'h5'
        ep = [{ target: 'g3', pawnId: 'white-pawn-g2' }]; finishMove(true)
      } else if (n === 54) {
        const target = { direction: 'clockwise', promotions: [{ square: 'a7', role: 'queen' }, { square: 'h5', role: 'queen' }] }
        assert.deepEqual(action.target, target); rotated = true
        for (const id of ['black-pawn-a7', 'white-pawn-h2']) Object.assign(piece(id), { role: 'queen', promoted: true })
        effects.push({ type: 'earthquake', owner, card, direction: 'clockwise', target })
      } else if (n === 81) {
        assert.deepEqual(action.target, { knight: 'a6', bishop: 'a4' })
        assert.equal(piece('black-knight-b8').square, 'a6'); assert.equal(piece('black-bishop-c8').square, 'a4')
        piece('black-knight-b8').square = 'a4'; piece('black-bishop-c8').square = 'a6'
      } else if (n === 90) {
        assert.equal(action.target, 'e6')
        effects.push({ type: 'crab', owner, card, pieceId: 'black-pawn-g7' })
      } else if (n === 94) {
        Object.assign(piece('black-king-e8'), { square: null, zone: 'away' }); ep = []; finishMove(false)
      } else if (n === 95) {
        Object.assign(piece('black-king-e8'), { square: 'f8', zone: 'board' })
        half--; full--; fenTurn = 'black'; turn.phase = 'beforeMove'; turn.moveMade = false
      } else if (n === 99) {
        effects.push({ type: 'doomsayer', owner, card })
      } else if (n === 100) {
        const removed = effects.pop() as { type: string; card: { id: string; cardId: string } }
        assert.equal(removed.type, 'doomsayer'); players.white.discard.push(removed.card)
      } else assert.fail(`unreviewed card at ${n}`)
    } else if (action.type === 'abductionTimeout') {
      assert.equal(n, 20)
      Object.assign(piece('black-rook-h8'), { zone: 'captured', capturedBy: 'white' })
      half = 0; rights = rights.replace('k', '')
    } else { assert.equal(action.type, 'revealAbduction'); assert.equal(n, 19) }

    const result = applyAction(state, action)
    assert.deepEqual(state, before, `${why}: complete input immutability, including capturedBy`)
    assert.ok(result.ok, why); state = result.state
    assert.deepEqual(state.pieces, pieces, `${why}: every physical record, including unchanged identities`)
    assert.deepEqual(state.players, players, `${why}: complete hands, ordered decks and discards`)
    assert.deepEqual(state.effects, effects, `${why}: complete active card records`)
    assert.deepEqual(state.turn, turn, why)
    assert.deepEqual(state.enPassant, ep, why)
    assert.equal(state.orientation, rotated ? 90 : 0, why)
    assert.equal(state.pendingRescue ?? null, null, why)
    assert.equal(state.outcome, null, why)
    assert.deepEqual(state.pendingDoomsayer ?? null, n === 99 ? { player: 'black', cardInstanceId: 'white-deck-2-doomsayer' } : null, why)
    assert.deepEqual(state.underElfHill ?? [], n === 94 ? [{ pieceId: 'black-king-e8', player: 'black', returning: false }] : [], why)
    if (n === 18 || n === 19) {
      assert.deepEqual(state.pendingAbduction, { phase: n === 18 ? 'concealment' : 'recall', player: 'black', durationMs: 10000,
        pieceId: 'black-rook-h8', requiresPieceId: false, before: abductionBefore }, why)
    } else assert.equal(state.pendingAbduction ?? null, null, why)
    for (const king of pieces.filter(p => p.royal && p.zone === 'board')) {
      const attackers = pieces.filter(p => p.zone === 'board' && p.owner !== king.owner && reaches(p, king.square!, pieces, rotated, true, n >= 90 && p.id === 'black-pawn-g7'))
      assert.deepEqual(attackers.map(p => p.id), [], `${why}: independent King safety, also verifies Truce has no check expiry`)
    }
    const symbols = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }
    const board = Array.from({ length: 8 }, (_, r) => {
      let row = '', empty = 0
      for (let f = 0; f < 8; f++) {
        const p = at(`${String.fromCharCode(97 + f)}${8 - r}`)
        if (!p) { empty++; continue }
        if (empty) row += empty; empty = 0
        row += p.owner === 'white' ? symbols[p.role].toUpperCase() : symbols[p.role]
      }
      return row + (empty || '')
    }).join('/')
    // Ordinary FEN omits uncapturable EP targets; Annexation records its explicit target.
    const fenEp = n === 49 || n === 50 ? 'g3' : '-'
    assert.equal(state.fen, `${board} ${fenTurn[0]} ${rights || '-'} ${fenEp} ${half} ${full}`, why)
  }
  assert.equal(trace.moves, 50)
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 10)
  assert.equal(state.fen, '3r1k2/qb2p2p/1pqNp2n/2pp1p2/nP2PPP1/2b1P1QQ/RPP5/3KBBNR b - - 6 26')
})

test('iteration 123 deterministic trace replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/123.json', import.meta.url), 'utf8')) as RandomTrace
  assert.ok(trace.steps.length > 0)
  replayTrace(trace)
})
