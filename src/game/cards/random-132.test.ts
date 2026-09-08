import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Board } from 'chessops/board';
import { makeBoardFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameState, PieceState, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/132.json', import.meta.url), 'utf8')) as RandomTrace;
// Independently reviewed rules §§8–15, 16.2, 18.3, 19.3, 22.1, 22.4 and
// artwork KC7_card4, KC2_card3, KC19_card4, KC2_card4, KC15_card3,
// KC1_card3, KC9_card2, KC13_card3. No trace hash supplies semantic expectations.
const rationales = [
  '1 Confabulation replaces White move: Qd1-d2 joins its pawn by one vertical step; retain both identities and the Queen movement power, spend and draw Dark Mirror.',
  '2 End White replacement move; Black receives fresh card allowances.',
  '3 h7-h6: Black pawn advances one empty square.',
  '4 End Black pawn move.',
  '5 Composite d2-b4: Queen diagonal via empty c3, with Pawn identity retained; reset pawn clock.',
  '6 End White composite move.',
  '7 g7-g6: Black pawn advances one empty square.',
  '8 End Black pawn move.',
  '9 a2-a3: White pawn advances one empty square.',
  '10 End White pawn move.',
  '11 Guardian replaces Black move: b7-b6 is one forward step, follower Nb8 is optional and stays; no EP, discard and draw Lost Castle.',
  '12 End Black Guardian replacement move.',
  '13 f2-f3: White pawn advances one empty square.',
  '14 End White pawn move.',
  '15 h6-h5: Black pawn advances one empty square.',
  '16 End Black pawn move.',
  '17 Nb1-d2: knight jump to the vacated composite origin.',
  '18 End White knight move.',
  '19 Bc8-b7: one clear diagonal step.',
  '20 End Black bishop move.',
  '21 c2-c3: White pawn advances one empty square.',
  '22 End White pawn move.',
  '23 Bf8-g7: one clear diagonal step.',
  '24 End Black bishop move.',
  '25 Composite b4-b3: Queen backward file step is legal although physical board representative is a Pawn.',
  '26 Fireball after quiet composite move: b3 center captures both components plus a3,b2,c3; all five capturedBy White, discard expired Confabulation before Fireball, draw Neutrality.',
  '27 End White move after explosion; no additional move.',
  '28 a7-a6: Black pawn advances one empty square.',
  '29 End Black pawn move.',
  '30 Nd2-b1: knight jump to empty starting square.',
  '31 End White knight move.',
  '32 Nb8-c6: knight jump to an empty square.',
  '33 End Black knight move.',
  '34 Ng1-h3: knight jump to an empty square.',
  '35 End White knight move.',
  '36 Ra8-b8: clear adjacent file; revoke Black queenside castling.',
  '37 Heresy after Black move: opponent bishops c1-d1 and f1-g1 first, then b7-a7 and g7-h7; every bishop changes square color into vacancy; discard and draw Betrayal.',
  '38 End Black turn after all four bishop relocations.',
  '39 Bg1-d4: clear f2,e3 diagonal.',
  '40 End White bishop move.',
  '41 Nc6-e5: knight jump to an empty square.',
  '42 End Black knight move.',
  '43 Under Elf Hill replaces White move: King e1 goes away, retaining royal identity; revoke KQ, increment quiet clock, discard and draw Charge.',
  '44 End White replacement move; return is not due until next White turn.',
  '45 c7-c6: Black pawn advances one square while White King is absent.',
  '46 End Black move: White King return becomes mandatory.',
  '47 Return King f1: vacant safe edge square; no clock or allowance change, same King cannot move this turn.',
  '48 Ra1-a4: clear a2,a3 file; returned King stays on f1.',
  '49 End White move; returned King movement restriction expires.',
  '50 Qd8-c7: one clear diagonal step.',
  '51 End Black queen move.',
  '52 Bd4-g1: clear e3,f2 diagonal.',
  '53 End White bishop move.',
  '54 Qc7-c8: one empty file step.',
  '55 End Black queen move.',
  '56 Ra4-a5: one clear file step.',
  '57 End White rook move.',
  '58 f7-f6: Black pawn advances one empty square.',
  '59 Doomsayer after Black move: retain effect, draw Truce; White must answer immediate naming option before normal play.',
  '60 White names Rook immediately and chooses Rh1: capture by Black effect owner; discard resolved Doomsayer, preserve turn and allowances.',
  '61 End Black move after naming choice resolves.',
  '62 Nb1-d2: knight jump to empty square.',
  '63 End White knight move.',
  '64 Qc8-d8: one clear rank step.',
  '65 End Black queen move.',
  '66 g2-g3: White pawn advances one empty square.',
  '67 End White pawn move.',
  '68 d7-d5: Black initial double through empty d6; physical d6 EP exists but no White pawn can capture it, so serialized EP is dash.',
  '69 End Black double; preserve physical EP for White response.',
  '70 Nd2-b1: knight jump; prior EP expires.',
  '71 End White knight move.',
  '72 Ne5-d7: knight jump to empty square.',
  '73 End Black knight move.',
  '74 Bd1-b3: clear c2 diagonal.',
  '75 End White bishop move.',
  '76 d5-d4: Black pawn advances one empty square.',
  '77 End Black pawn move.',
  '78 Ra5-a3: clear a4 file.',
  '79 End White rook move.',
  '80 Ng8-h6: knight jump to empty square.',
  '81 Truce after Black move: neither royal geometrically threatened, retain continuing effect and draw Ghostwalk; prohibit captures.',
  '82 End Black turn; legal quiet alternatives prevent Truce stalemate expiry.',
  '83 Nb1-c3: quiet knight jump allowed under Truce.',
  '84 Dungeon after White move: relocate opposing b6 pawn to vacant h1; no promotion authorized, no capture under Truce; discard, draw Man-Trap and forbid that identity moving next Black turn.',
  '85 End White turn; Black Dungeon obligation becomes active.',
  '86 Nh6-g4: quiet knight jump; dungeon pawn stays put.',
  '87 End Black turn; Dungeon restriction expires, Truce remains.',
  '88 Bb3-d1: quiet diagonal through c2.',
  '89 End White bishop move; no check or stalemate ends Truce.',
  '90 h5-h4: Black pawn advances one empty square under Truce.',
  '91 End Black pawn move.',
  '92 Ra3-a1: quiet file through empty a2; castling rights never return.',
  '93 End White rook move.',
  '94 Nd7-b6: quiet knight jump into vacated Dungeon origin.',
  '95 End Black knight move.',
  '96 Ra1-a2: quiet file step.',
  '97 End White rook move.',
  '98 Nb6-a4: quiet knight jump.',
  '99 End Black knight move.',
  '100 f3-f4: White pawn advances one empty square.',
  '101 End White pawn move.',
  '102 Na4-b6: quiet knight jump back.',
  '103 End Black knight move.',
  '104 Bd1-c2: quiet diagonal step.',
  '105 End White bishop move.',
  '106 Qd8-d6: quiet file through empty d7.',
  '107 End Black queen move.',
  '108 f4-f5: White pawn advances one empty square.',
  '109 End White pawn move.',
  '110 Qd6-d5: quiet file step.',
  '111 End Black queen move.',
  '112 Nh3-g5: quiet knight jump; no royal attack or stalemate, so Truce persists.',
  '113 End White fiftieth regular move; Black has quiet moves and Truce remains.',
];

const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
// Independent geometry, including the composite Queen power and immobilized Kings.
function reaches(board: PieceState[], p: PieceState, to: SquareName, capture: boolean, n: number): boolean {
  if (!p.square || p.zone !== 'board' || p.square === to || p.id === 'white-king-e1' && n >= 47 && n <= 48
    || p.id === 'black-pawn-b7' && n >= 84 && n <= 86) return false;
  const dx = to.charCodeAt(0) - p.square.charCodeAt(0), dy = Number(to[1]) - Number(p.square[1]);
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const role = p.id === 'white-pawn-d2' && n >= 1 && n <= 25 ? 'queen' : p.role;
  if (role === 'knight') return ax * ay === 2;
  if (role === 'king') return Math.max(ax, ay) === 1;
  if (role === 'pawn') {
    const distance = dy * (p.owner === 'white' ? 1 : -1);
    if (capture) return distance === 1 && ax === 1;
    if (ax || !(distance === 1 || distance === 2 && (p.owner === 'white' ? [1, 2] : [7, 8]).includes(Number(p.square[1])))) return false;
  } else if (!(role === 'rook' ? dx === 0 || dy === 0 : role === 'bishop' ? ax === ay : dx === 0 || dy === 0 || ax === ay)) return false;
  for (let i = 1; i < Math.max(ax, ay); i++) {
    const square: string = String.fromCharCode(p.square.charCodeAt(0) + Math.sign(dx) * i) + (Number(p.square[1]) + Math.sign(dy) * i);
    if (board.some(other => other.zone === 'board' && other.square === square)) return false;
  }
  return true;
}
function threatened(board: PieceState[], color: Color, n: number): boolean {
  const king = board.find(p => p.owner === color && p.royal && p.zone === 'board');
  if (!king?.square) return false;
  return board.some(p => (p.owner !== color || p.neutral) && reaches(board, p, king.square!, true, n)
    && (!p.neutral || !threatened(board.filter(q => q.id !== king.id).map(q => q.id === p.id ? { ...q, square: king.square } : q), opposite(color), n)));
}

test('iteration 132: all actions have an independent physical and rules oracle', () => {
  const began = performance.now();
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 8);
  let state = createGameState(trace.initial);
  const pieces = structuredClone(state.pieces), players = structuredClone(state.players);
  let turn = structuredClone(state.turn), effects: unknown[] = [];
  let half = 0, full = 1, rights = 'KQkq', fenColor: Color = 'white';
  let ep: GameState['enPassant'] = [];
  const at = (square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
  const identity = (id: string) => pieces.find(p => p.id === id)!;
  const reject = (action: GameAction) => {
    const copy = structuredClone(state), result = applyAction(state, action);
    assert.equal(result.ok, false); assert.deepEqual(result.state, copy); assert.deepEqual(state, copy);
  };
  for (const [i, { action }] of trace.steps.entries()) {
    const n = i + 1, message = rationales[i]!;
    assert.ok(message.startsWith(`${n} `));
    const finishMove = (pawn = false) => {
      half = pawn ? 0 : half + 1; if (turn.color === 'black') full++;
      fenColor = opposite(turn.color); turn.phase = 'afterMove'; turn.moveMade = true;
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.from, /^[a-h][1-8]$/); assert.match(action.to, /^[a-h][1-8]$/);
      const mover = at(action.from)!;
      assert.ok(mover, message); assert.equal(mover.owner, turn.color, message);
      assert.equal(at(action.to), undefined, `${message}: every sampled regular move is quiet`);
      assert.ok(reaches(pieces, mover, action.to as SquareName, false, n - 1), message);
      ep = n === 68 ? [{ target: 'd6', pawnId: 'black-pawn-d7' }] : [];
      mover.square = action.to as SquareName;
      if (mover.id === 'black-rook-a8') rights = rights.replace('q', '');
      if (mover.id === 'white-rook-a1') rights = rights.replace('Q', '');
      finishMove(mover.role === 'pawn');
    } else if (action.type === 'playCard') {
      const owner = turn.color, player = players[owner];
      assert.equal(turn.phase, ['confabulation', 'guardian', 'under-elf-hill'].includes(action.cardId) ? 'beforeMove' : 'afterMove', `${message}: printed timing`);
      assert.equal(turn.cardPlays[owner], 0);
      const cardIndex = player.hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(cardIndex >= 0); const card = player.hand.splice(cardIndex, 1)[0]!;
      const drawn = player.deck.shift(); if (drawn) player.hand.push(drawn);
      turn.cardPlays[owner]++;
      if (action.cardId === 'confabulation') {
        assert.equal(n, 1); assert.deepEqual(action.target, [{ from: 'd1', to: 'd2' }]);
        assert.ok(reaches(pieces, at('d1')!, 'd2', false, 0));
        identity('white-queen-d1').zone = 'away'; identity('white-queen-d1').square = null;
        effects.push({ type: 'confabulation', owner, card, pieceIds: ['white-pawn-d2', 'white-queen-d1'] });
        finishMove();
      } else if (action.cardId === 'guardian') {
        assert.equal(n, 11); assert.deepEqual(action.target, [{ from: 'b7', to: 'b6' }]);
        assert.equal(at('b6'), undefined); at('b7')!.square = 'b6'; player.discard.push(card); finishMove(true);
      } else if (action.cardId === 'fireball') {
        assert.equal(n, 26); assert.equal(action.target, 'b3');
        const blast = pieces.filter(p => p.square && p.zone === 'board'
          && Math.abs(p.square.charCodeAt(0) - 'b'.charCodeAt(0)) <= 1 && Math.abs(Number(p.square[1]) - 3) <= 1);
        assert.deepEqual(blast.map(p => p.id).sort(), ['white-pawn-a2', 'white-pawn-b2', 'white-pawn-c2', 'white-pawn-d2']);
        for (const p of [...blast, identity('white-queen-d1')]) { p.zone = 'captured'; p.square = null; p.capturedBy = 'white'; }
        effects = []; half = 0;
        player.discard.push({ id: 'white-hand-1-confabulation', cardId: 'confabulation' }, card);
      } else if (action.cardId === 'heresy') {
        assert.equal(n, 37);
        const moves = [{ from: 'c1', to: 'd1' }, { from: 'f1', to: 'g1' }, { from: 'b7', to: 'a7' }, { from: 'g7', to: 'h7' }];
        assert.deepEqual(action.target, moves);
        for (const [j, move] of moves.entries()) {
          const p = at(move.from)!; assert.equal(p.role, 'bishop'); assert.equal(p.owner, j < 2 ? 'white' : 'black');
          assert.equal(at(move.to), undefined); assert.equal(Math.abs(move.from.charCodeAt(0) - move.to.charCodeAt(0)), 1);
          p.square = move.to as SquareName;
        }
        player.discard.push(card);
      } else if (action.cardId === 'under-elf-hill') {
        assert.equal(n, 43); const king = at('e1')!; assert.equal(king.royal, true);
        king.square = null; king.zone = 'away'; rights = rights.replace(/[KQ]/g, '');
        ep = []; player.discard.push(card); finishMove();
      } else if (action.cardId === 'doomsayer' || action.cardId === 'truce') effects.push({ type: action.cardId, owner, card });
      else {
        assert.equal(action.cardId, 'dungeon'); assert.equal(n, 84); assert.deepEqual(action.target, [{ from: 'b6', to: 'h1' }]);
        assert.equal(at('h1'), undefined); assert.equal(at('b6')!.owner, 'black'); at('b6')!.square = 'h1';
        effects.push({ type: 'dungeon', owner, player: 'black', pieceId: 'black-pawn-b7' }); player.discard.push(card);
      }
    } else if (action.type === 'returnKing') {
      assert.equal(n, 47); assert.equal(action.to, 'f1'); assert.equal(at('f1'), undefined);
      const king = identity('white-king-e1'); assert.equal(king.zone, 'away'); king.zone = 'board'; king.square = 'f1';
    } else if (action.type === 'namePiece') {
      assert.equal(n, 60); assert.equal(action.speaker, 'white'); assert.equal(action.name, 'rook');
      assert.deepEqual(action.losses, [{ effectId: 'black-hand-3-doomsayer', pieceId: 'white-rook-h1' }]);
      const rook = at('h1')!; assert.equal(rook.role, 'rook'); assert.equal(rook.owner, 'white');
      rook.zone = 'captured'; rook.square = null; rook.capturedBy = 'black'; half = 0; effects = [];
      players.black.discard.push({ id: 'black-hand-3-doomsayer', cardId: 'doomsayer' });
    } else {
      assert.equal(action.type, 'endTurn'); assert.equal(turn.moveMade, true);
      turn = { color: opposite(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      if (n === 87) effects = effects.filter(e => (e as { type: string }).type !== 'dungeon');
    }
    const original = structuredClone(state), result = applyAction(state, action);
    assert.deepEqual(state, original, `${message}: complete input immutability`);
    assert.ok(result.ok, message); state = result.state;
    assert.deepEqual(state.pieces, pieces, `${message}: all 32 identities, roles, zones and captors`);
    assert.deepEqual(state.players, players, `${message}: all ordered hand/deck/discard zones`);
    assert.deepEqual(state.effects, effects, `${message}: complete effects and expiry`);
    assert.deepEqual(state.turn, turn, `${message}: exact phase and normal card allowances`);
    assert.deepEqual(state.enPassant, ep, `${message}: physical en-passant opportunity`);
    assert.equal(state.orientation, 0); assert.equal(state.outcome, null);
    const board = Board.empty();
    for (const p of pieces) if (p.zone === 'board') board.set(parseSquare(p.square!)!, { color: p.owner, role: p.role });
    // Only double push is d7-d5, with no adjacent White pawn: all serialized EP fields are dash.
    if (ep.length) assert.ok(!pieces.some(p => p.zone === 'board' && p.owner === 'white' && p.role === 'pawn' && (p.square === 'c5' || p.square === 'e5')));
    assert.equal(state.fen, `${makeBoardFen(board)} ${fenColor[0]} ${rights || '-'} - ${half} ${full}`, `${message}: all six FEN fields`);
    assert.deepEqual(state.underElfHill ?? [], n < 43 || n >= 49 ? [] : [{ pieceId: 'white-king-e1', player: 'white', returning: n >= 46, ...(n >= 47 ? { returned: true } : {}) }]);
    assert.deepEqual(state.pendingDoomsayer ?? null, n === 59 ? { player: 'white', cardInstanceId: 'black-hand-3-doomsayer' } : null);
    for (const field of ['pendingRescue', 'pendingAbduction'] as const) assert.equal(state[field] ?? null, null, `${message}: ${field}`);
    for (const field of ['chaosForbidden', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(state[field], undefined, `${message}: ${field}`);
    for (const field of ['plotsAllowances', 'fogLocked', 'riposteLostMoves'] as const) assert.deepEqual(state[field] ?? [], [], `${message}: ${field}`);
    for (const color of ['white', 'black'] as const) {
      assert.equal(threatened(pieces, color, n), false, `${message}: independent royal threat with composite and return restrictions`);
      assert.equal(isKingInCheck(state, color), false, `${message}: engine royal check`);
      if (n >= 81) {
        // Evaluate expiry with Truce removed. A quiet legal move exists for each color,
        // and no royal is threatened, so neither check nor stalemate can end Truce.
        const canMove = pieces.some(p => p.owner === color && p.zone === 'board' && Array.from({ length: 64 }, (_, square) =>
          `${String.fromCharCode(97 + square % 8)}${Math.floor(square / 8) + 1}` as SquareName).some(to =>
          !at(to) && reaches(pieces, p, to, false, n)
          && !threatened(pieces.map(q => q.id === p.id ? { ...q, square: to } : q), color, n)));
        assert.equal(canMove, true, `${message}: independent non-stalemate witness`);
      }
    }
    assert.ok(pieces.every(p => !p.neutral), 'No neutral controller occurs in this trace; all control is original ownership.');
    if (n === 46) { reject({ type: 'endTurn' }); reject({ type: 'move', from: 'a1', to: 'a4' }); reject({ type: 'returnKing', to: 'd4' }); }
    if (n === 47) reject({ type: 'move', from: 'f1', to: 'e1' });
    if (n === 59) reject({ type: 'endTurn' });
    if (n === 82) reject({ type: 'move', from: 'a3', to: 'a6' });
  }
  assert.equal(state.fen, '1r2k2r/b3p2b/pnp2pp1/3q1PN1/3p2np/2N3P1/R1B1P2P/5KBp b k - 2 27');
  assert.equal(replayTrace(trace).fen, state.fen);
  console.log(`ITERATION_132_PASS actions=113 moves=50 cards=8 oracle_ms=${Math.round(performance.now() - began)} fen=${state.fen}`);
});
