import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { Chess } from 'chessops/chess'
import { makeBoardFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import { CARD_CATALOG } from './catalog.js'
import { replayTrace, type RandomTrace } from './random-campaign.js'

// Sequential manual review against rules §§8–11,13.8,14.2,15.1,15.5,17.2,
// 18.1–18.3,19.1,21.1 and the printed timing recorded in CARD_CATALOG.
const rationales = [
  '1 Bombard Rh1-h3 jumps exactly the h2 pawn; pawn unchanged, king sheltered; consumes move and kingside rights.',
  '2 White ends its Bombard turn; Black starts, without another draw.',
  '3 Ng8-f6 is an empty L jump; Black king remains safe.',
  '4 Black ends; White starts with both allowances clear.',
  '5 Pe2-e3 advances one to empty e3, resetting the pawn clock.',
  '6 Challenge selects movable enemy Pc7 after the move, obliging its next use.',
  '7 Black starts with the c7 obligation intact.',
  '8 Pc7-c6 advances down one and satisfies Challenge; no en passant.',
  '9 Black ends after satisfying the obligation.',
  '10 Bf1-e2 enters the square vacated by the pawn; diagonal is clear.',
  '11 White ends, preserving board and hands.',
  '12 Nf6-e4 is an empty L jump without attacking White K e1.',
  '13 Black ends; White receives its move.',
  '14 Ke1-f1 enters a safe adjacent square; remaining White castling rights end.',
  '15 White ends with Kf1 safe.',
  '16 Pd7-d5 crosses empty d6 from its second rank; d6 en passant right created.',
  '17 End retains that en passant opportunity for White.',
  '18 Be2-g4 traverses empty f3 and expires the unused d6 opportunity.',
  '19 White ends; Black bishop has a capture available.',
  '20 Bc8xg4 traverses d7,e6,f5, capturing the physical white f1 bishop.',
  '21 Black ends after capture; captured bishop remains off board.',
  '22 Rh3-h5 traverses empty h4, without exposure of Kf1.',
  '23 White ends its quiet rook move.',
  '24 Bg4-f3 is a clear one-square diagonal; Kf1 is not on this bishop line.',
  '25 Black ends with hands unchanged.',
  '26 Pg2-g3 advances to empty g3; Black bishop f3 does not bar it.',
  '27 White ends after the pawn clock reset.',
  '28 Ne4-c5 is an empty L jump.',
  '29 Black ends its knight move.',
  '30 Kf1-e1 is safe: Bf3-e2-d1 does not attack e1.',
  '31 Vendetta is retained after White move; Black has Bf3xh5 available.',
  '32 Black starts with capture compulsory under Vendetta.',
  '33 Bf3xh5 crosses empty g4, capturing the h1 rook and satisfying Vendetta.',
  '34 White starts with Qd1xh5 available, so Vendetta persists.',
  '35 Qd1xh5 crosses e2,f3,g4 and captures that bishop, satisfying Vendetta.',
  '36 Black has no legal capture; Vendetta ends and its retained card is discarded.',
  '37 Pb7-b5 crosses b6; temporary b6 en passant right created.',
  '38 Black ends with b6 opportunity preserved.',
  '39 Nb1-a3 is an empty L jump; unused b6 opportunity expires.',
  '40 White ends, board and card zones retained.',
  '41 Pa7-a5 crosses a6 from second rank; a6 opportunity created.',
  '42 Black ends, preserving a6 opportunity.',
  '43 Ke1-d1 is adjacent and safe; a6 opportunity expires.',
  '44 White ends its safe king move.',
  '45 Ke8-d7 is safe: Qh5 is blocked toward d7; Black castling rights end.',
  '46 Black ends, with all castling rights gone.',
  '47 Qh5-h6 moves vertically one into an empty square.',
  '48 White ends its queen move.',
  '49 Pf7-f6 advances into empty f6 and resets the clock.',
  '50 Black ends after its pawn move.',
  '51 Na3-b1 returns by L jump without restoring any castling rights.',
  '52 White ends its knight move.',
  '53 Qd8-c8 moves horizontally one to the vacated bishop square.',
  '54 Figure Dance rotates a1 to h1, a8 to a1, h8 to a8 simultaneously; Nb1 blocks Ra1 from Kd1.',
  '55 Black ends after safe simultaneous corner rotation.',
  '56 Pd2-d3 moves forward one; Nb1 still blocks the foreign rook.',
  '57 Man-Trap marks occupied friendly Qh6 after the move; no current occupant is removed.',
  '58 Black starts; the h6 trap remains armed.',
  '59 Tournament b8/g1 would put a white knight on b8 attacking Black Kd7; board fizzles, card and move spent.',
  '60 Black ends its safe failed replacement, with original knights restored.',
  '61 Qh6-h5 leaves its own trap square; leaving does not trigger Man-Trap.',
  '62 White ends; trap remains at fixed h6.',
  '63 Qc8-e8 traverses empty d8 and avoids h6.',
  '64 Black ends with the trap untouched.',
  '65 Passing in the Night simultaneously swaps Pb2/Pe7 and Pf2/Pg7; four identities retained, no promotion/capture.',
  '66 White ends the replacement move; neither king is attacked by the swapped pawns.',
  '67 Nc5-e6 is an empty L jump; none of the trapped or swapped squares is entered.',
  '68 Black ends, retaining swapped pawn locations.',
  '69 Qh5xh7 passes over h6 without stopping, capturing the h7 pawn; trap does not trigger.',
  '70 White ends; own g7 pawn blocks Qh7 along the seventh rank.',
  '71 Kd7-c7 enters a safe adjacent square, behind the g7 blocker.',
  '72 Black ends its safe king move.',
  '73 Qh7-e4 traverses g6,f5; no h6 trap arrival.',
  '74 White ends its clear diagonal move.',
  '75 Bf8xe7 captures the white original b2 pawn in its swapped location.',
  '76 Black ends; that captured pawn remains eligible for later Resurrection.',
  '77 Qe4-f4 gives check along e5,d6,c7; ordinary checking move is permitted.',
  '78 Holy Quest swaps opposing Be7 and Ne6, preserving identities; check on Black continues but is not mate.',
  '79 Black receives the checked turn; its Charge card can enable an escape.',
  '80 Nb8-d7 temporarily leaves Qf4 check unresolved; pending rescue requires the same-turn Charge.',
  '81 Charge Nd7-e5 is the same knight second noncapture and blocks f4-e5-d6-c7, curing Black check.',
  '82 Black may end only after Charge clears the pending rescue.',
  '83 Bc1-d2 enters empty d2; Nb1 still shields White Kd1 from Ra1.',
  '84 White ends with its rook-line blocker intact.',
  '85 Be6-d7 is an empty adjacent diagonal; Ne5 still blocks Qf4.',
  '86 Black ends while Ne5 continues sheltering Kc7.',
  '87 Pd3-d4 advances one into empty d4, attacking Ne5.',
  '88 White ends after its pawn move.',
  '89 Ne7-c8 is an empty L jump; it does not disturb the e5 blocker.',
  '90 Black ends with no card expenditure.',
  '91 Resurrection returns captured original Pb2 to vacant starting pawn square e2; same identity, no restored rights.',
  '92 White ends its Resurrection replacement move.',
  '93 Pb5-b4 advances down one into empty b4.',
  '94 Black ends after a pawn-clock reset.',
  '95 Long Jump moves Nb1 to empty opposite-color c1; Nc1 still blocks Ra1 from Kd1.',
  '96 White ends the Long Jump replacement move.',
  '97 Nc8-e7 is an empty L jump preserving the e5 shield.',
  '98 Neutrality marks opposing Nc1 after the move; it attacks neither Kd1 nor Kc7 and retains White ownership.',
  '99 Immediate White Fog cancels Neutrality only; Nc1 restored, Ne7 preceding move preserved, both cards discarded.',
  '100 Black ends; both used allowances reset for White turn.',
  '101 Nc1-b3 uncovers Ra1-b1-c1-d1 against White king; only staged pending rescue is allowed.',
  '102 Dungeon moves the checking enemy Ra1 to empty h8; no path requirement, Kd1 rescued, rook barred next Black turn.',
  '103 White safely ends while the h8 rook ban persists.',
  '104 Other black rook a8-a7 is free to move; the banned physical a8-origin rook remains at h8.',
  '105 Black ends, expiring its one-turn Dungeon ban.',
  '106 Pd4xe5 captures the b8-origin knight; the capturing pawn now blocks Qf4 toward Kc7.',
  '107 White ends with the pawn on e5 retaining that line block.',
  '108 Bd7-f5 crosses empty e6; e5 pawn still blocks the queen check.',
  '109 Black ends its bishop move.',
  '110 Ng1-f3 is an empty L jump; Kd1 remains sheltered.',
  '111 White ends its knight move.',
  '112 Pd5-d4 advances to the square vacated on step106.',
  '113 Black ends its pawn move.',
  '114 Qf4-e4 moves horizontally one; friendly Pe5 blocks its northward file.',
  '115 White ends its queen move.',
  '116 Pd4-d3 advances into empty d3, threatening d2-adjacent capture squares but not Kd1.',
  '117 Black ends; White king remains safe.',
  '118 Nb3-c5 is an empty L jump; this knight does not attack Kc7.',
  '119 White ends the fiftieth ordinary move command; Black starts with only the h6 Man-Trap active.',
]

test('deterministic iteration 025 independently reviewed semantics', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/025.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860025)
  assert.equal(trace.steps.length, 119)
  assert.equal(rationales.length, trace.steps.length)
  assert.equal(trace.steps.filter(({ action }) => action.type === 'playCard').length, 14)
  const trap = { type: 'man-trap', owner: 'white', card: { id: 'white-deck-1-man-trap', cardId: 'man-trap' }, square: 'h6' }
  const relocations: Record<number, Record<string, string>> = {
    1: { 'white-rook-h1': 'h3' },
    54: { 'white-rook-a1': 'h1', 'black-rook-a8': 'a1', 'black-rook-h8': 'a8' },
    65: { 'white-pawn-b2': 'e7', 'white-pawn-f2': 'g7', 'black-pawn-e7': 'b2', 'black-pawn-g7': 'f2' },
    78: { 'black-bishop-f8': 'e6', 'black-knight-g8': 'e7' },
    81: { 'black-knight-b8': 'e5' }, 91: { 'white-pawn-b2': 'e2' },
    95: { 'white-knight-b1': 'c1' }, 102: { 'black-rook-a8': 'h8' },
  }
  let state = createGameState(trace.initial)
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1
    assert.ok(rationales[index]!.startsWith(`${n} `))
    const before = state
    const result = applyAction(before, action)
    assert.ok(result.ok, rationales[index])
    state = result.state
    const expectedEffects: unknown[] = []
    if (n === 6 || n === 7) expectedEffects.push({ type: 'challenge', owner: 'white', player: 'black', pieceId: 'black-pawn-c7' })
    if (n >= 31 && n <= 35) expectedEffects.push({ type: 'vendetta', owner: 'white', card: { id: 'white-hand-3-vendetta', cardId: 'vendetta' } })
    if (n >= 57) expectedEffects.push(trap)
    if (n === 98) expectedEffects.push({ type: 'neutrality', owner: 'black', card: { id: 'black-hand-1-neutrality', cardId: 'neutrality' }, pieceId: 'white-knight-b1' })
    if (n >= 102 && n <= 104) expectedEffects.push({ type: 'dungeon', owner: 'white', player: 'black', pieceId: 'black-rook-a8' })
    assert.deepEqual(state.effects, expectedEffects, rationales[index])
    assert.equal(Boolean(state.pendingRescue), n === 80 || n === 101, rationales[index])
    assert.ok(!state.outcome)
    assert.equal(state.orientation, 0)

    if (action.type === 'move') {
      // All sampled regular moves have ordinary geometry. Man-Trap is never
      // entered by an enemy; Challenge/Vendetta obligations are checked below.
      const position = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap()
      assert.equal(typeof action.from, 'string')
      assert.equal(typeof action.to, 'string')
      const move = { from: parseSquare(action.from as string)!, to: parseSquare(action.to as string)! }
      assert.equal(position.isLegal(move), n !== 80 && n !== 101, rationales[index])
      if (n === 80 || n === 101) {
        assert.deepEqual([Math.abs(move.from % 8 - move.to % 8), Math.abs(Math.floor(move.from / 8) - Math.floor(move.to / 8))].sort(), [1, 2])
        assert.equal(position.board.get(move.to), undefined)
      }
      position.play(move)
      assert.equal(makeBoardFen(position.board), state.fen.split(' ')[0], rationales[index])
      assert.equal(state.fen.split(' ')[4], String(position.halfmoves))
      assert.equal(state.fen.split(' ')[5], String(position.fullmoves))
      const source = before.pieces.find(p => p.square === action.from)!
      const victim = before.pieces.find(p => p.square === action.to)
      for (const piece of state.pieces) {
        const prior = before.pieces.find(p => p.id === piece.id)!
        assert.equal(piece.square, piece.id === source.id ? action.to : piece.id === victim?.id ? null : prior.square)
        assert.equal(piece.zone, piece.id === victim?.id ? 'captured' : prior.zone)
        assert.equal(piece.owner, prior.owner)
        assert.equal(piece.role, prior.role)
        assert.equal(piece.originalRole, prior.originalRole)
        assert.equal(piece.royal, prior.royal)
        assert.equal(piece.neutral, prior.neutral)
        assert.equal(piece.promoted, prior.promoted)
      }
      if (n === 8) assert.equal(source.id, 'black-pawn-c7')
      if (n === 33 || n === 35) assert.ok(victim, 'Vendetta requires these available captures')
      assert.equal(state.turn.color, before.turn.color)
      assert.equal(state.turn.moveMade, true)
      assert.equal(state.turn.phase, 'afterMove')
      assert.deepEqual(state.players, before.players)
    } else if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(card => card.id === action.cardInstanceId) ? 'white' : 'black'
      const opponent = owner === 'white' ? 'black' : 'white'
      assert.ok(CARD_CATALOG[action.cardId]!.timing.includes(owner === before.turn.color ? before.turn.phase : 'afterOpponentCard'))
      assert.equal(before.turn.cardPlays[owner], 0)
      assert.equal(state.turn.cardPlays[owner], 1)
      assert.deepEqual(state.players[owner].hand, [...before.players[owner].hand.filter(card => card.id !== action.cardInstanceId), before.players[owner].deck[0]!])
      assert.deepEqual(state.players[owner].deck, before.players[owner].deck.slice(1))
      assert.deepEqual(state.players[opponent].hand, before.players[opponent].hand)
      assert.deepEqual(state.players[opponent].deck, before.players[opponent].deck)
      const played = before.players[owner].hand.find(card => card.id === action.cardInstanceId)!
      assert.deepEqual(state.players[owner].discard, [...before.players[owner].discard, ...CARD_CATALOG[action.cardId]!.continuing ? [] : [played]])
      assert.deepEqual(state.players[opponent].discard, [...before.players[opponent].discard, ...n === 99 ? [{ id: 'black-hand-1-neutrality', cardId: 'neutrality' }] : []])
      const expected = before.pieces.map(piece => {
        if (relocations[n]?.[piece.id]) return { ...piece, square: relocations[n]![piece.id], zone: 'board' }
        if (n === 98 && piece.id === 'white-knight-b1') return { ...piece, neutral: true, neutralBeforeEffects: false }
        if (n === 99 && piece.id === 'white-knight-b1') {
          const { neutralBeforeEffects: _prior, ...rest } = piece
          return { ...rest, neutral: false }
        }
        return piece
      })
      assert.deepEqual(state.pieces, expected, rationales[index])
      assert.equal(Chess.fromSetup(parseFen(state.fen).unwrap()).unwrap().isCheckmate(), false, 'No regular card directly mates')
      const replacement = [1, 59, 65, 91, 95].includes(n)
      const fields = before.fen.split(' ')
      assert.equal(state.fen.split(' ')[4], String(replacement ? [65, 91].includes(n) ? 0 : Number(fields[4]) + 1 : Number(fields[4])))
      assert.equal(state.fen.split(' ')[5], String(Number(fields[5]) + (replacement && owner === 'black' ? 1 : 0)))
      assert.equal(state.turn.moveMade, true)
      assert.equal(state.turn.color, before.turn.color)
      if (n === 59) assert.ok(state.history.some(event => event.type === 'cardFizzled' && event.cardId === 'tournament' && event.reason === 'SELF_CHECK'))
      if (n === 99) assert.deepEqual(state.turn.cardPlays, { white: 1, black: 1 })
    } else {
      assert.equal(action.type, 'endTurn')
      assert.equal(state.fen, before.fen)
      assert.deepEqual(state.pieces, before.pieces)
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } })
      if (n !== 36) assert.deepEqual(state.players, before.players)
    }
    const ep: Record<number, { target: string; pawnId: string }> = {
      16: { target: 'd6', pawnId: 'black-pawn-d7' }, 17: { target: 'd6', pawnId: 'black-pawn-d7' },
      37: { target: 'b6', pawnId: 'black-pawn-b7' }, 38: { target: 'b6', pawnId: 'black-pawn-b7' },
      41: { target: 'a6', pawnId: 'black-pawn-a7' }, 42: { target: 'a6', pawnId: 'black-pawn-a7' },
    }
    assert.deepEqual(state.enPassant, ep[n] ? [ep[n]] : [])
  }
  assert.equal(state.fen, '4q2r/r1k1n1P1/2p2p2/p1N1Pb2/1p2Q3/3pPNP1/PpPBPp1P/3K3R b - - 1 28')
  assert.deepEqual(state.players.white.discard.map(c => c.cardId), ['bombard', 'challenge', 'vendetta', 'passing-in-the-night', 'holy-quest', 'resurrection', 'long-jump', 'fog-of-war', 'dungeon'])
  assert.deepEqual(state.players.black.discard.map(c => c.cardId), ['figure-dance', 'tournament', 'charge', 'neutrality'])
  assert.deepEqual([state.players.white.deck.length, state.players.black.deck.length], [65, 71])
  assert.deepEqual(replayTrace(trace), state)
})
