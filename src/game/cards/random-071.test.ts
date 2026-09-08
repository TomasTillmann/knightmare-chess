import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState, SquareName } from '../types.js';

// Independent review of seed 860071 against rules.md §§8–11, 13, 15–17, 19–22
// and cards.md / printed catalog metadata. No row is approved merely by its hash.
const rationale = [
  '1 Guardian advances a2-a4 through empty a3; a1 rook follows to a3; pawn remains protected from en passant, e1 safe, Q-side right lost.',
  '2 White ends its consumed Guardian move; Black gets a fresh allowance, board and clocks fixed.',
  '3 Black e7-e5 crosses empty e6, sets e6 en passant, resets halfmove and advances fullmove.',
  '4 Black ends; White begins with the e6 opportunity intact and safe e1.',
  '5 White g2-g3 enters empty square; no discovered e1 attack, pawn clock zero, old en passant expires.',
  '6 White ends; Black begins, no draw without a card or optional discard.',
  '7 Black Ng8-h6 is a quiet L jump; e8 remains screened; halfmove becomes one.',
  '8 Black ends, retains h6 knight and unchanged material.',
  '9 White Ng1-f3 is an L jump to empty f3, with e1 safe.',
  '10 White ends; Black receives its move with clocks unchanged.',
  '11 Black Qd8-f6 crosses the vacated e7 square; no capture or royal exposure.',
  '12 Black ends the queen move, resets turn allowances only.',
  '13 White Nf3-g5 is a quiet L jump; no e1 exposure.',
  '14 White ends; Black still has safe e8 behind pawns.',
  '15 Black Qf6-g6 moves one orthogonal square; no capture, fullmove advances.',
  '16 Holy War swaps owned Nb8/Bc8 identities after move; no capture, clocks unchanged, one Black replacement draw.',
  '17 Black ends with Bishop b8 and Knight c8; neither King checked.',
  '18 White Ra3-a2 moves one clear file square, with a1 castling right already lost.',
  '19 White ends and preserves the a2 rook and halfmove six.',
  '20 Black a7-a6 is an ordinary forward pawn step, e8 safe.',
  '21 White Chaos immediately cancels a7-a6: restore a7, fullmove five and halfmove six; Black must choose a different move.',
  '22 Black Qg6-f6 differs from canceled pawn move; clears repeat restriction and completes replacement.',
  '23 Black ends; White reaction allowance resets for its own turn.',
  '24 White b2-b3 is a quiet forward pawn step with safe e1.',
  '25 White ends without card expenditure or any extra draw.',
  '26 Black Nh6-g4 jumps legally to empty g4; no King exposure.',
  '27 Black ends; Knight g4 does not attack e1.',
  '28 White Bf1-g2 follows one diagonal to the emptied g2 square; e1 stays safe.',
  '29 White Abduction after move conceals nonroyal Black Qf6 in away zone; no capture or clock change yet.',
  '30 Reveal switches concealment to recall only; queen remains away, no second draw.',
  '31 Black correctly names queen, original owner, f6 and physical ID; restore exact queen with no clock change.',
  '32 White ends after completed recall; no pending challenge remains.',
  '33 Black Nc8-b6 makes a quiet L jump, retaining its original b8 identity.',
  '34 Black ends; White King remains safe behind e2/d2/f2.',
  '35 White e2-e4 crosses empty e3; Black e5 remains ahead, e3 opportunity created.',
  '36 White ends with e3 opportunity retained for Black.',
  '37 Black Nb6-d5 is an L jump; expires e3 opportunity without capture.',
  '38 Black ends with the d5 knight, no card changes.',
  '39 White Ra2-a3 is a quiet file step; b3 pawn is beside it, not in its path.',
  '40 White ends and gives Black a fresh before-move window.',
  '41 Black Under Elf Hill replaces move: e8 King away, Black castling rights lost, halfmove three/fullmove ten.',
  '42 Black ends while its King remains away; White may move normally.',
  '43 White a4-a5 enters empty a5, no attack on White King; no absent King threat.',
  '44 White ends, making Black King return mandatory before Black can move.',
  '45 Black King returns to vacant edge d8, safe from Ng5 and blocked Bg2/Qd1; clocks unchanged, King immobile this turn.',
  '46 Black Qf6-f3 passes empty f5/f4; King d8 stays put and safe; no capture.',
  '47 Black ends; returned King immobility now expires.',
  '48 White Ghostwalk Qd1-d4 passes own d2 pawn and empty d3; destination empty, e1 safe, consumes move and card.',
  '49 White ends its Ghostwalk; queen retains queen identity on d4.',
  '50 Black Qf3-f5 passes empty f4; quiet move with safe d8.',
  '51 Black ends; White before-move allowance available.',
  '52 Assassin f2xg3 makes ordinary pawn diagonal geometry but captures own g2-pawn identity; White King remains safe.',
  '53 White ends; victim stays captured, never dead or replaced by a new identity.',
  '54 Black Kd8-e8 is safe: Qd4 diagonal is blocked by e5 pawn; no castling rights return.',
  '55 Black ends with e8 King and clocks unchanged.',
  '56 White Nb1-c3 is an L jump to empty c3; King e1 safe.',
  '57 White ends; no persistent movement powers from Ghostwalk/Assassin.',
  '58 Black Nd5-f6 is a quiet L jump, e8 safe.',
  '59 Black ends, opening White before-move card window.',
  '60 White Under Elf Hill removes e1 King instead of moving; remaining K-side right lost, halfmove four.',
  '61 White ends with its King away; Black gets normal move.',
  '62 Black Qf5xg5 captures White g1-knight identity; no White King on board to check; Black King safe.',
  '63 Black ends and mandatory White return begins.',
  '64 White King returns to empty edge e1; Qg5 and Ng4 do not attack e1; zero halfmove preserved.',
  '65 White Nc3-a2 jumps to empty a2 while returned King stays immobile on e1.',
  '66 White Doomsayer after move adds continuing physical card and draws once; immediate naming option belongs to Black.',
  '67 Black declines immediate naming; no piece lost and Doomsayer remains active.',
  '68 White names rook and chooses its h1 rook: capture that identity, reset halfmove, discard resolved Doomsayer.',
  '69 White ends; return-turn King restriction expires, no extra draw for resolved Doomsayer.',
  '70 Black Qg5-f5 is a quiet horizontal step; e8 safe.',
  '71 Black ends; all Doomsayer effects have resolved.',
  '72 White Qd4-a4 crosses clear c4/b4; no capture, e1 remains safe.',
  '73 Haunting Memories copies last played nonunique Doomsayer in after-move window; retain Memories as continuing effect and draw once.',
  '74 Black declines copied Doomsayer immediate option, preserving effect.',
  '75 White names bishop and loses Bg2 physical f1 bishop; copied effect discards Memories, halfmove resets.',
  '76 White ends with Bishop c1 surviving and no active Doomsayer.',
  '77 Black Doppelganger Ng4-d1 copies last moved White Queen; diagonal f3/e2 clear, empty d1, retains Knight powers afterward.',
  '78 Black ends; d1 Knight attacks b2/c3/e3/f2, not e1.',
  '79 White b3-b4 enters empty b4, no King exposure.',
  '80 White ends without changing card zones.',
  '81 Black h7-h6 enters empty h6; ordinary pawn direction and zero halfmove.',
  '82 Black ends with White e1 still safe.',
  '83 White Ra3-d3 crosses empty b3/c3; no capture or exposed e1.',
  '84 White ends, no reaction selected and no extra draw.',
  '85 Black b7-b6 steps forward to empty b6.',
  '86 Black ends; White may act with b6 pawn retained.',
  '87 White h2-h4 crosses empty h3; creates h3 en passant and resets clock.',
  '88 Cowardice after move pushes Black e5 pawn backward through empty e6 to e7; preserves h3 opportunity and clocks.',
  '89 White ends; e7 pawn may double again under §13.1.',
  '90 Black e7-e5 crosses empty e6 despite prior movement; replaces h3 with e6 en passant.',
  '91 Black ends with e6 opportunity intact.',
  '92 White Rd3-f3 crosses empty e3; old e6 expires and King e1 remains safe.',
  '93 White ends; Black begins at fullmove twenty.',
  '94 Black Nf6-h7 jumps to emptied h7 without capture.',
  '95 Black ends; White gets replacement-card window.',
  '96 Dubbing moves White c2 pawn by L jump to empty a3; retains pawn type, no capture or promotion, halfmove reset.',
  '97 White ends the Dubbing replacement move; no ordinary move follows.',
  '98 Black Ke8-e7 enters empty e7; Queen a4 line is blocked by d7, Rf3 by Qf5.',
  '99 Black ends with King e7 safe.',
  '100 White b4-b5 steps to empty b5 while e1 remains safe.',
  '101 White ends, preserves pawn identity and clocks.',
  '102 Black Qf5-h5 passes empty g5; King e7 remains protected, no capture.',
  '103 Black ends; Queen h5 does not check e1 because White Rf3 blocks its diagonal.',
  '104 White Ke1xd1 captures Black original g8 Knight; d1 is safe from Qh5 (Rf3 blocks), Black bishops and pawns.',
  '105 Neutrality marks opposing Ra8, not King/Queen; original Black ownership stays, continuing card retained, clocks unchanged.',
  '106 White ends; neutral a8 rook can be controlled by either player but no clear ray reaches either King.',
  '107 Black d7-d5 crosses empty d6; sets d6 opportunity, King e7 safe behind e5 and f7.',
  '108 Black ends; Neutrality persists without moving its marked rook.',
  '109 White Qa4-d4 crosses empty b4/c4; e5 pawn blocks diagonal to Black King area; White d1 safe.',
  '110 White ends; no capture or card expenditure.',
  '111 Black Rh8-g8 moves one clear square, preserving unrelated neutral rook a8.',
  '112 Black ends; White Queen d4 remains unshielded until its next move.',
  '113 White Qd4xb6 crosses empty c5 and captures Black b7-pawn identity; d1 safe.',
  '114 Mystic Shield legally selects just-moved nonroyal Qb6; protects its identity during next Black turn, spends/draws once.',
  '115 White ends; Shield remains for beginning of Black turn.',
  '116 Black a7-a6 moves into empty a6 without capturing shielded Qb6; both Kings safe.',
  '117 Black ends; Shield expires now, Neutrality persists.',
  '118 White e4xd5 captures Black d7-pawn identity diagonally; no en passant, halfmove zero.',
  '119 White ends, d5 pawn continues to block no illegal King line.',
  '120 Black controls neutral Ra8xb8: own-color Bishop b8 may be captured; rook remains neutral, neither King lies on its rays.',
  '121 Black ends; captured Bishop stays captured and Neutrality stays attached to surviving rook.',
  '122 White controls same Black-owned neutral Rb8-a8; empty destination and neither King attacked, quiet halfmove increments.',
  '123 White ends; original rook ownership and permanent marker remain.',
  '124 Black f7-f5 crosses empty f6; f6 en passant set, King e7 remains safe.',
  '125 Black ends with f6 opportunity, no automatic draw.',
  '126 White Qb6-d4 crosses empty c5; old f6 expires, no capture.',
  '127 White ends; Black can choose a safe King move.',
  '128 Black Ke7-f6 is safe: Qd4 ray blocked by e5, Rf3 file by f5; neutral a8 rook has no King ray.',
  '129 Black ends the fiftieth ordinary move: White beforeMove, no pending choice/rescue, only Neutrality active.',
];

// This trace has only original chess movement; the sole neutral carrier never
// has a geometric ray to a King. Requiring no geometric attack is sufficient
// here (and stronger than the legal-capture test for any pinned attacker).
function attacks(piece: PieceState, to: string, pieces: PieceState[]): boolean {
  if (!piece.square || piece.square === to) return false;
  const dx = to.charCodeAt(0) - piece.square.charCodeAt(0);
  const dy = Number(to[1]) - Number(piece.square[1]);
  if (piece.role === 'pawn') return Math.abs(dx) === 1 && dy === (piece.owner === 'white' ? 1 : -1);
  if (piece.role === 'knight') return Math.abs(dx) * Math.abs(dy) === 2;
  if (piece.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  if (!(piece.role === 'rook' && (dx === 0 || dy === 0)
    || piece.role === 'bishop' && Math.abs(dx) === Math.abs(dy)
    || piece.role === 'queen' && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)))) return false;
  for (let n = 1; n < Math.max(Math.abs(dx), Math.abs(dy)); n++) {
    const square = String.fromCharCode(piece.square.charCodeAt(0) + Math.sign(dx) * n)
      + (Number(piece.square[1]) + Math.sign(dy) * n);
    if (pieces.some(p => p.zone === 'board' && p.square === square)) return false;
  }
  return true;
}

test('iteration 071 deterministic review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/071.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860071);
  assert.equal(trace.steps.length, 129);
  assert.equal(rationale.length, trace.steps.length);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 15);
  let state = createGameState(trace.initial);
  const states: GameState[] = [state];
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1;
    assert.ok(rationale[index]!.startsWith(`${n} `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationale[index]);
    state = result.state;
    const expectedPieces = structuredClone(before.pieces);
    const at = (square: string) => expectedPieces.find(p => p.zone === 'board' && p.square === square)!;
    const relocate = (from: string, to: string, capture = false) => {
      const mover = at(from);
      assert.ok(mover, `${n}: occupied origin ${from}`);
      const victim = at(to);
      assert.equal(!!victim, capture, `${n}: expected destination occupancy`);
      if (victim) { assert.equal(victim.royal, false); victim.square = null; victim.zone = 'captured'; victim.capturedBy = before.turn.color; }
      assert.match(to, /^[a-h][1-8]$/);
      mover.square = to as SquareName;
    };
    let halfmove = Number(before.fen.split(' ')[4]);
    let fullmove = Number(before.fen.split(' ')[5]);
    let nextColor = before.fen.split(' ')[1];
    let ep = structuredClone(before.enPassant);
    const finishMove = (reset: boolean) => {
      halfmove = reset ? 0 : halfmove + 1;
      fullmove += before.turn.color === 'black' ? 1 : 0;
      nextColor = before.turn.color === 'white' ? 'b' : 'w';
      ep = [];
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const mover = at(action.from);
      const victim = at(action.to);
      assert.ok(mover.owner === before.turn.color || mover.neutral, `${n}: mover control`);
      assert.ok(!victim || victim.owner !== before.turn.color || victim.neutral || mover.neutral);
      if (mover.role === 'pawn' && !victim) {
        assert.equal(action.from[0], action.to[0]);
        const dy = (Number(action.to[1]) - Number(action.from[1])) * (mover.owner === 'white' ? 1 : -1);
        assert.ok(dy === 1 || dy === 2 && action.from[1] === (mover.owner === 'white' ? '2' : '7'));
        if (dy === 2) assert.equal(at(`${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`), undefined);
      } else assert.ok(attacks(mover, action.to, expectedPieces), `${n}: independent geometry/path`);
      finishMove(mover.role === 'pawn' || !!victim);
      if (mover.role === 'pawn' && Math.abs(Number(action.to[1]) - Number(action.from[1])) === 2)
        ep = [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}` as SquareName, pawnId: mover.id }];
      relocate(action.from, action.to, !!victim);
      assert.equal(state.turn.moveMade, true);
    }
    if (n === 1) { relocate('a2', 'a4'); relocate('a1', 'a3'); finishMove(true); }
    if (n === 16) { at('b8').square = 'c8'; expectedPieces.find(p => p.id === 'black-bishop-c8')!.square = 'b8'; }
    if (n === 21) {
      expectedPieces.splice(0, expectedPieces.length, ...structuredClone(states[19]!.pieces));
      halfmove = 6; fullmove = 5; nextColor = 'b'; ep = [];
      assert.equal(state.turn.moveMade, false);
      assert.ok(state.chaosForbidden);
    }
    if (n === 29 || n === 41 || n === 60) {
      const piece = at(n === 29 ? 'f6' : n === 41 ? 'e8' : 'e1');
      piece.square = null; piece.zone = 'away';
      if (n !== 29) finishMove(false);
    }
    if (n === 31 || n === 45 || n === 64) {
      const piece = expectedPieces.find(p => p.id === (n === 31 ? 'black-queen-d8' : n === 45 ? 'black-king-e8' : 'white-king-e1'))!;
      assert.equal(piece.zone, 'away');
      piece.zone = 'board'; piece.square = n === 31 ? 'f6' : n === 45 ? 'd8' : 'e1';
    }
    if (n === 48) { relocate('d1', 'd4'); finishMove(false); }
    if (n === 52) { relocate('f2', 'g3', true); finishMove(true); }
    if (n === 68 || n === 75) {
      const piece = at(n === 68 ? 'h1' : 'g2'); piece.square = null; piece.zone = 'captured'; piece.capturedBy = before.turn.color; halfmove = 0;
      assert.ok(state.players.white.discard.some(c => c.cardId === (n === 68 ? 'doomsayer' : 'haunting-memories')));
    }
    if (n === 77) { relocate('g4', 'd1'); finishMove(false); }
    if (n === 88) { assert.equal(at('e6'), undefined); relocate('e5', 'e7'); }
    if (n === 96) { relocate('c2', 'a3'); finishMove(true); }
    if (n === 105) { at('a8').neutralBeforeEffects = false; at('a8').neutral = true; }
    assert.deepEqual(state.pieces, expectedPieces, `${n}: complete identity/board/zone oracle`);
    assert.equal(Number(state.fen.split(' ')[4]), halfmove, `${n}: halfmove clock`);
    assert.equal(Number(state.fen.split(' ')[5]), fullmove, `${n}: fullmove clock`);
    assert.equal(state.fen.split(' ')[1], nextColor, `${n}: FEN active color`);
    assert.deepEqual(state.enPassant, ep, `${n}: en passant rights`);
    assert.equal(state.fen.split(' ')[2], n < 41 ? 'Kkq' : n < 60 ? 'K' : '-');
    assert.equal(!!state.pendingRescue, false, `${n}: no unresolved self-check`);
    if (action.type === 'endTurn') {
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white');
      assert.equal(state.turn.phase, 'beforeMove');
      assert.equal(state.turn.moveMade, false);
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 });
    }
    for (const king of state.pieces.filter(p => p.zone === 'board' && p.royal)) {
      const enemies = state.pieces.filter(p => p.zone === 'board' && (p.owner !== king.owner || p.neutral));
      assert.ok(enemies.every(p => !attacks(p, king.square!, state.pieces)), `${n}: independent safe ${king.owner} King`);
    }
    const expectedEffects: unknown[] = [];
    if (n >= 66 && n <= 67) expectedEffects.push({ type: 'doomsayer', owner: 'white', card: { id: 'white-deck-2-doomsayer', cardId: 'doomsayer' } });
    if (n >= 73 && n <= 74) expectedEffects.push({ type: 'doomsayer', owner: 'white', card: { id: 'white-deck-4-haunting-memories', cardId: 'haunting-memories' } });
    if (n >= 105) expectedEffects.push({ type: 'neutrality', owner: 'white', card: { id: 'white-deck-6-neutrality', cardId: 'neutrality' }, pieceId: 'black-rook-a8' });
    if (n >= 114 && n <= 116) expectedEffects.push({ type: 'mystic-shield', owner: 'white', player: 'white', pieceId: 'white-queen-d1' });
    assert.deepEqual(state.effects, expectedEffects, `${n}: exact ongoing effects and expiry`);
    if (n === 29 || n === 30) assert.equal(state.pendingAbduction?.phase, n === 29 ? 'concealment' : 'recall');
    else assert.equal(!!state.pendingAbduction, false);
    assert.equal(!!state.pendingDoomsayer, n === 66 || n === 73);
    const elf = n >= 41 && n <= 46 ? { pieceId: 'black-king-e8', player: 'black', returning: n >= 44, ...(n >= 45 ? { returned: true } : {}) }
      : n >= 60 && n <= 68 ? { pieceId: 'white-king-e1', player: 'white', returning: n >= 63, ...(n >= 64 ? { returned: true } : {}) } : null;
    assert.deepEqual(state.underElfHill ?? [], elf ? [elf] : [], `${n}: King absence/mandatory return/immobility`);
    for (const color of ['white', 'black'] as const) {
      const old = before.players[color];
      const current = state.players[color];
      const played = action.type === 'playCard' ? old.hand.find(c => c.id === action.cardInstanceId) : undefined;
      assert.deepEqual(current.hand, played ? [...old.hand.filter(c => c.id !== played.id), old.deck[0]!] : old.hand, `${n}: ${color} hand`);
      assert.deepEqual(current.deck, played ? old.deck.slice(1) : old.deck, `${n}: ${color} deck`);
      if (played && !['doomsayer', 'haunting-memories', 'neutrality'].includes(played.cardId))
        assert.deepEqual(current.discard, [...old.discard, played], `${n}: regular card discarded once`);
      if (played) assert.equal(state.turn.cardPlays[color], 1);
    }
    states.push(state);
  }
  assert.equal(state.fen, 'r4br1/2p3pn/p4k1p/PP1Ppp1q/3Q3P/P4RP1/N2P4/2BK4 w - - 2 29');
  assert.deepEqual(state.underElfHill, []);
  assert.equal(state.outcome, null);
  assert.deepEqual(replayTrace(trace), state);
});
