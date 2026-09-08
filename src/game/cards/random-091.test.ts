import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';
import { digest, type RandomTrace } from './random-campaign.js';

// Reviewed in order; 132 is the first invalid state. No later actions exist.
const rationales = [
  '1 Ghostwalk: c1-f4 diagonal passes own d2, then empty e3; empty destination.',
  '2 White ends the replacement move; no additional draw.',
  '3 Black knight g8-f6 is an empty L destination.',
  '4 Black ends its completed move.',
  '5 Bishop f4-h6 has clear g5 and an empty destination.',
  '6 White ends its completed move.',
  '7 Black pawn g7-g5 crosses empty g6; create g6 en passant.',
  '8 End preserves that en-passant opportunity for White.',
  '9 White pawn d2-d3 is empty; previous en passant expires.',
  '10 White ends its completed move.',
  '11 Knight f6-h5 is an empty L destination.',
  '12 Coup after the move makes c7 pawn royal and e8 a capturable Prince; retain pawn movement.',
  '13 End resets allowances and preserves Coup.',
  '14 Doppelganger copies the last enemy Knight movement: b1-a3, empty and noncapturing.',
  '15 White ends the replacement move.',
  '16 Black pawn a7-a5 crosses empty a6; create a6 en passant.',
  '17 End preserves a6 en passant.',
  '18 Rook a1-b1 moves to empty square, loses queenside castling, expires en passant.',
  '19 White ends its completed move.',
  '20 Black pawn g5-g4 advances into empty square.',
  '21 Black ends its completed move.',
  '22 Rook b1-c1 moves horizontally into empty square.',
  '23 White ends its completed move.',
  '24 Blessing moves f7 pawn one diagonal to empty e6, without capture.',
  '25 Black ends the replacement move.',
  '26 Bishop h6-e3 traverses empty g5,f4.',
  '27 White ends its completed move.',
  '28 Rook a8-a7 enters empty square and loses queenside castling.',
  '29 Black ends its completed move.',
  '30 Bishop e3-f4 is an empty diagonal destination.',
  '31 White ends its completed move.',
  '32 Knight h5-f4 captures the white c1 Bishop; reset capture clock.',
  '33 Black ends its completed capture.',
  '34 White pawn g2-g3 advances to empty square.',
  '35 Holy War after the move swaps own a3 Knight and f1 Bishop without capture.',
  '36 White ends; swap adds no extra move or clock tick.',
  '37 Black pawn a5-a4 advances to empty square.',
  '38 Black ends its completed move.',
  '39 Bishop a3-e7 traverses b4,c5,d6 and captures e7 pawn; e8 is only a Prince.',
  '40 White ends its completed capture.',
  '41 Rook a7-a8 returns to empty square without regaining castling.',
  '42 Black ends its completed move.',
  '43 Assassin uses e2 pawn diagonal capture of own d3 pawn, preserving both identities.',
  '44 White ends the replacement capture.',
  '45 Rook a8-a7 enters empty square.',
  '46 Black ends its completed move.',
  '47 White King e1-d2 is a safe adjacent empty square; revoke castling.',
  '48 Curse marks the enemy d8 Queen after the move, limiting movement to two squares.',
  '49 End preserves both continuing effects.',
  '50 Black pawn a4-a3 advances to empty square.',
  '51 Holy War swaps black b8 Knight and f8 Bishop after the move.',
  '52 Black ends; swap preserves physical roles.',
  '53 White King d2-e1 returns to a safe empty square without restoring castling.',
  '54 White ends its completed move.',
  '55 Passing in the Night simultaneously swaps g4/c2 and h7/h2 Pawns; no captures.',
  '56 Black ends the replacement move.',
  '57 Masquerade moves e7 Bishop along clear d6,c5 to empty b4 with Queen geometry.',
  '58 White ends the replacement move.',
  '59 Royal c7 pawn moves normally to safe c6; its royal identity follows it.',
  '60 Black ends its completed move.',
  '61 Rook c1-b1 moves horizontally into empty square.',
  '62 Figure Dance rotates occupied h1 to h8 and h8 to a8 simultaneously; no captures.',
  '63 White ends; Figure Dance leaves clocks unchanged.',
  '64 Knight f8-g6 is an empty L destination.',
  '65 Black ends its completed move.',
  '66 White pawn b2-b3 advances to empty square.',
  '67 White ends its completed move.',
  '68 Black f7 pawn, relocated to e6 by Blessing, advances to e5.',
  '69 Anathema swaps opposing b4 Bishop and b1 Rook, after the move.',
  '70 Black ends; no capture or extra movement clock.',
  '71 Passing in the Night swaps d3/h2 and h7/b7 Pawns simultaneously, preserving owners.',
  '72 White ends the replacement move.',
  '73 Black original g7 pawn captures d1 Queen from c2 and promotes to Bishop.',
  '74 Black ends the promotion capture.',
  '75 White pawn f2-f3 advances without capture, creating the Fireball trigger.',
  '76 Fireball captures center f3 and adjacent g3,g4,f4; neither King is in the blast.',
  '77 White ends; Fireball adds no extra fullmove.',
  '78 Bishop b8-d6 passes empty c7 to empty destination.',
  '79 Black ends its completed move.',
  '80 White original h2 pawn captures a8 Rook from b7 and promotes to Rook.',
  '81 White ends the promotion capture.',
  '82 Black pawn e5-e4 advances to empty square.',
  '83 Black ends its completed move.',
  '84 Rook b4-c4 is an empty horizontal move.',
  '85 White ends its completed move.',
  '86 Bishop d6-c5 is an empty diagonal move.',
  '87 Black ends its completed move.',
  '88 Rook c4-d4 is an empty horizontal move.',
  '89 White ends its completed move.',
  '90 Black a7 Rook captures the promoted white h2 Pawn on a8; preserve promotion identity.',
  '91 Black ends its completed capture.',
  '92 Onslaught advances selected h2 Pawn one step to empty h3, with no en passant.',
  '93 White ends the replacement move.',
  '94 Black pawn d7-d6 advances to empty square.',
  '95 Black ends its completed move.',
  '96 Rook d4-e4 captures the original black f7 Pawn.',
  '97 White ends its completed capture.',
  '98 Bishop c8-b7 is an empty diagonal move.',
  '99 Black ends its completed move.',
  '100 Bishop b1-d3 crosses empty c2 and captures original black h7 Pawn.',
  '101 White ends its completed capture.',
  '102 Irresistible Force moves royal c6 Pawn to c5 and pushes nonroyal Bishop c5-c4; safe atomic result.',
  '103 Black ends the replacement move.',
  '104 Rook h8-f8 crosses empty g8; e8 is a capturable Prince, not the black King.',
  '105 White ends its completed move.',
  '106 Bishop b7-e4 crosses empty c6,d5 and captures white a1 Rook.',
  '107 Crab marks black original a7 Pawn at a3; retains original identity.',
  '108 Black ends and preserves Crab.',
  '109 Knight f1-d2 is an empty L destination.',
  '110 White ends its completed move.',
  '111 Bishop e4-f5 is an empty diagonal move.',
  '112 Black ends its completed move.',
  '113 Bishop d3-f1 crosses empty e2 to empty destination.',
  '114 White ends its completed move.',
  '115 Doppelganger copies the last white Bishop move for noncapturing f5-e6.',
  '116 Knightmare cancels that move, restores f5 and clocks, returns Doppelganger and undoes its draw.',
  '117 Returned Doppelganger makes different physical move c4-b5; allowed alternate Bishop movement.',
  '118 Black ends; White reaction allowance resets.',
  '119 Knight g1-f3 is an empty L destination.',
  '120 Forbidden City marks empty c6 after the move; later jumping pieces may cross it.',
  '121 White ends and preserves the square marker.',
  '122 Cursed Queen d8-b8 crosses empty c8 and moves exactly two squares.',
  '123 Panic after Black move gives White a 15000ms deadline without a board change.',
  '124 End begins the white turn with Panic active.',
  '125 Timeout loses the white turn, clears Panic, advances halfmove once, and preserves the board.',
  '126 Long Jump sends g6 Knight to empty opposite-color c7; jumping ignores c6 marker.',
  '127 Black ends the replacement move.',
  '128 Knight f3-d4 is an empty L destination.',
  '129 Coup makes safe a2 Pawn the white King and e1 a Prince; retains pawn movement.',
  '130 White ends with the new royal identity.',
  '131 Promoted black Bishop d1-e2 is an empty diagonal move.',
  '132 FINDING: Haunting Memories legally copies latest opposing Coup; c7 Knight becomes King and c5 former King becomes a king-moving Prince. FEN must encode c5 as king, not pawn (§15.3, §22.7).',
];

const coords = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const identity = ({ capturedAtPly: _capturedAtPly, ...piece }: PieceState) => piece;

// Independent geometry, with only this trace's active movement restrictions.
function reaches(state: GameState, piece: PieceState, to: string, capture: boolean): boolean {
  const [x, y] = coords(piece.square!);
  const [tx, ty] = coords(to);
  const dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy);
  const effects = state.effects as Array<{ type: string; pieceId?: string; square?: string }>;
  if (effects.some(e => e.type === 'forbidden-city' && e.square === to)) return false;
  if (effects.some(e => e.type === 'curse' && e.pieceId === piece.id) && Math.max(ax, ay) > 2) return false;
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    if (capture || effects.some(e => e.type === 'crab' && e.pieceId === piece.id)) return ax === 1 && dy === forward;
    if (dx !== 0 || dy !== forward && !(dy === 2 * forward && (piece.owner === 'white' ? y <= 1 : y >= 6))) return false;
  } else if (!(piece.role === 'bishop' && ax === ay || piece.role === 'rook' && (!dx || !dy)
    || piece.role === 'queen' && (ax === ay || !dx || !dy))) return false;
  for (let i = 1; i < Math.max(ax, ay); i++) {
    const square = String.fromCharCode(97 + x + i * Math.sign(dx)) + (y + i * Math.sign(dy) + 1);
    if (state.pieces.some(p => p.square === square) || effects.some(e => e.type === 'forbidden-city' && e.square === square)) return false;
  }
  return ax + ay > 0;
}

test('iteration 091 independent review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/091.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationales.length, 132);
  assert.equal(trace.steps.length, rationales.length);
  let state = createGameState(trace.initial);
  const states: GameState[] = [state];
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, before = state, action = step.action;
    const expected = structuredClone(before);
    const at = (square: string) => expected.pieces.find(p => p.square === square)!;
    const move = (from: string, to: string) => { at(from).square = to as SquareName; };
    const swap = (a: string, b: string) => { const first = at(a), second = at(b); first.square = b as SquareName; second.square = a as SquareName; };
    const capture = (square: string) => { const p = at(square); assert.ok(!p.royal); p.square = null; p.zone = 'captured'; p.capturedBy = before.turn.color; };
    let half = Number(before.fen.split(' ')[4]), full = Number(before.fen.split(' ')[5]);
    let fenTurn = before.fen.split(' ')[1];
    const finishMove = (pawnOrCapture: boolean) => {
      half = pawnOrCapture ? 0 : half + 1;
      if (before.turn.color === 'black') full++;
      fenTurn = before.turn.color === 'white' ? 'b' : 'w';
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true;
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const moving = at(action.from), victim = at(action.to);
      assert.equal(moving.owner, before.turn.color);
      assert.ok(reaches(before, moving, action.to, !!victim), rationales[index]);
      if (victim) { assert.notEqual(victim.owner, moving.owner); capture(action.to); }
      finishMove(moving.role === 'pawn' || !!victim);
      move(action.from, action.to);
      if (action.promotion) {
        assert.equal(moving.originalRole, 'pawn');
        assert.ok(['bishop', 'rook'].includes(String(action.promotion)));
        moving.role = action.promotion as 'bishop' | 'rook'; moving.promoted = true;
      }
    } else if (action.type === 'endTurn') {
      assert.ok(before.turn.moveMade);
      expected.turn = { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    } else if (action.type === 'panicTimeout') {
      assert.equal(n, 125); assert.equal(before.turn.color, 'white');
      expected.effects.pop(); half++; fenTurn = 'b';
      expected.turn.color = 'black';
    } else if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black';
      const card = before.players[owner].hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card); assert.equal(card.cardId, action.cardId);
      assert.equal(before.turn.cardPlays[owner], 0);
      assert.ok(CARD_CATALOG[action.cardId]!.timing.includes(owner === before.turn.color ? before.turn.phase : 'afterOpponentMove'));
      const player = expected.players[owner];
      player.hand = player.hand.filter(c => c.id !== card.id);
      player.hand.push(player.deck.shift()!);
      const continuing = ['coup', 'curse', 'crab', 'forbidden-city', 'haunting-memories'].includes(action.cardId);
      if (!continuing) player.discard.push(card);
      expected.turn.cardPlays[owner]++;
      switch (n) {
        case 1: move('c1', 'f4'); finishMove(false); break;
        case 14: move('b1', 'a3'); finishMove(false); break;
        case 24: move('f7', 'e6'); finishMove(true); break;
        case 35: swap('a3', 'f1'); break;
        case 43: capture('d3'); move('e2', 'd3'); finishMove(true); break;
        case 48: expected.effects.push({ type: 'curse', owner, card, pieceId: 'black-queen-d8' }); break;
        case 51: swap('b8', 'f8'); break;
        case 55: swap('g4', 'c2'); swap('h7', 'h2'); finishMove(true); break;
        case 57: move('e7', 'b4'); finishMove(false); break;
        case 62: { const rook = at('h1'); move('h8', 'a8'); rook.square = 'h8'; break; }
        case 69: swap('b4', 'b1'); break;
        case 71: swap('d3', 'h2'); swap('h7', 'b7'); finishMove(true); break;
        case 76: ['f3', 'g3', 'g4', 'f4'].forEach(capture); half = 0; break;
        case 92: move('h2', 'h3'); finishMove(true); break;
        case 102: move('c5', 'c4'); move('c6', 'c5'); finishMove(true); break;
        case 107: expected.effects.push({ type: 'crab', owner, card, pieceId: 'black-pawn-a7' }); break;
        case 115: move('f5', 'e6'); finishMove(false); break;
        case 116: {
          const checkpoint = states[114]!;
          expected.pieces = structuredClone(checkpoint.pieces);
          expected.players.black = structuredClone(checkpoint.players.black);
          expected.turn = { ...structuredClone(checkpoint.turn), cardPlays: { white: 1, black: 0 } };
          half = 3; full = 27; fenTurn = 'b'; break;
        }
        case 117: move('c4', 'b5'); finishMove(false); break;
        case 120: expected.effects.push({ type: 'forbidden-city', owner, card, square: 'c6' }); break;
        case 123: expected.effects.push({ type: 'panic', owner, player: 'white', durationMs: 15000 }); break;
        case 126: move('g6', 'c7'); finishMove(false); break;
        case 12: case 129: case 132: {
          const prince = expected.pieces.find(p => p.owner === owner && p.royal)!;
          const king = at(n === 12 ? 'c7' : n === 129 ? 'a2' : 'c7');
          const princeRole = prince.role;
          prince.royal = false; prince.role = 'king'; king.royal = true;
          expected.effects.push({ type: 'coup', owner, card, princeId: prince.id, kingId: king.id, princeRole }); break;
        }
        default: assert.fail(`Unreviewed card action ${n}`);
      }
    } else assert.fail(`Unreviewed action ${n}`);
    expected.enPassant = n === 7 || n === 8 ? [{ target: 'g6', pawnId: 'black-pawn-g7' }]
      : n === 16 || n === 17 ? [{ target: 'a6', pawnId: 'black-pawn-a7' }] : [];
    const original = digest(before);
    const result = applyAction(before, action);
    assert.equal(digest(before), original);
    assert.ok(result.ok, rationales[index]); state = result.state;
    assert.deepEqual(state.pieces.map(identity), expected.pieces.map(identity), rationales[index]);
    assert.deepEqual(state.players, expected.players, `${n}: exact card identities, draws, discard, rewind`);
    assert.deepEqual(state.effects, expected.effects, `${n}: continuing effects and Panic lifetime`);
    assert.deepEqual(state.turn, expected.turn, `${n}: turn and allowances`);
    assert.deepEqual(state.enPassant, expected.enPassant, `${n}: en passant`);
    assert.equal(state.pendingRescue ?? null, null);
    assert.equal(state.orientation, 0);
    assert.equal(state.outcome, null);
    assert.deepEqual(state.fen.split(' ').slice(4), [String(half), String(full)], `${n}: move clocks`);
    assert.equal(state.fen.split(' ')[1], fenTurn);
    const royal = state.pieces.find(p => p.owner === before.turn.color && p.royal)!;
    assert.ok(royal.square);
    for (const attacker of state.pieces.filter(p => p.zone === 'board' && p.owner !== royal.owner)) {
      assert.ok(!reaches(state, attacker, royal.square, true), `${n}: independent King safety against ${attacker.id}`);
    }
    if (action.type === 'playCard') {
      const opponentKing = state.pieces.find(p => p.owner !== before.turn.color && p.royal)!;
      for (const attacker of state.pieces.filter(p => p.zone === 'board' && p.owner !== opponentKing.owner)) {
        assert.ok(!reaches(state, attacker, opponentKing.square!, true), `${n}: card creates no check, hence no direct mate`);
      }
    }
    const fen = parseFen(state.fen).unwrap();
    for (const piece of expected.pieces.filter(p => p.square)) {
      const encoded = fen.board.get(parseSquare(piece.square!)!);
      assert.deepEqual(encoded && { color: encoded.color, role: encoded.role }, { color: piece.owner, role: piece.role },
        `${n}: ${piece.square} FEN must encode the physical movement role; Coup Prince moves as a King`);
    }
    assert.equal(fen.board.occupied.size(), expected.pieces.filter(p => p.square).length);
    states.push(state);
  }
});
