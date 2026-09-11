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

// Reviewed in order against rules §§8–15, 18.1, 22.4, cards.md and artwork
// KC20_card1, KC4_card1, KC5_card2, KC18_card4, KC15_card3.
const rationales = [
  '1 e2-e4: initial pawn double through empty e3; e3 en-passant opportunity.',
  '2 White ends its completed move; Black receives a fresh allowance.',
  '3 d7-d5: initial pawn double through d6; replaces e3 opportunity with d6.',
  '4 Black ends its move; White receives the turn.',
  '5 Ng1-e2: knight jump to the square vacated by the e-pawn; EP expires.',
  '6 White ends the quiet knight move.',
  '7 Ng8-f6: ordinary knight jump into an empty square.',
  '8 Black ends the quiet knight move.',
  '9 f2-f4: both f3 and f4 empty; f3 EP opportunity.',
  '10 White ends the pawn move, retaining its response window EP record.',
  '11 g7-g5: both g6 and g5 empty; replace f3 EP with g6.',
  '12 Black ends the pawn move.',
  '13 c2-c4: clear c3 and c4 permit a double; c3 EP replaces g6.',
  '14 White ends the pawn move.',
  '15 Nf6xe4: knight captures the physical e2-pawn for Black; reset clock.',
  '16 Black ends the capture.',
  '17 f4xg5: White pawn captures the physical g7-pawn diagonally.',
  '18 White ends the capture.',
  '19 Bf8-g7: one diagonal step into the square vacated by the g-pawn.',
  '20 Black ends the bishop move.',
  '21 Ne2-f4: knight jump to the vacated pawn square.',
  '22 White ends the knight move.',
  '23 Nb8-a6: ordinary knight jump into an empty square.',
  '24 Black ends the knight move.',
  '25 a2-a4: double through empty a3; a3 EP opportunity.',
  '26 White ends the pawn move.',
  '27 c7-c5: double through c6; c6 replaces a3 EP opportunity.',
  '28 Black ends the pawn move.',
  '29 Ra1-a2: vacant a2; permanently remove White queenside castling.',
  '30 White ends the rook move.',
  '31 e7-e6: one forward step to an empty square.',
  '32 Black ends the pawn move.',
  '33 Nf4xe6: knight captures Black e7-pawn, provisionally.',
  '34 Knightmare reacts immediately: restore Nf4 and pawn e6, clear capturedBy, restore clocks and White move; spend Black card and draw Under Elf Hill; exact repetition is forbidden.',
  '35 c4xd5: a different physical move legally replaces the canceled capture; Black d7-pawn is captured by White.',
  '36 White ends the replacement move; reset both allowances and cancellation restriction.',
  '37 Ra8-b8: clear neighboring square; remove Black queenside castling.',
  '38 Black ends the rook move.',
  '39 Qd1-h5: clear e2,f3,g4 diagonal; f7 blocks its diagonal to Black King e8.',
  '40 Vendetta after White move: retain continuing card and draw Annexation; subsequent legal captures become mandatory.',
  '41 White ends; Black has legal captures, so Vendetta remains.',
  '42 Bg7xb2: clear f6,e5,d4,c3 diagonal; capture White b2-pawn, satisfying Vendetta.',
  '43 Black ends; White can capture e6.',
  '44 d5xe6: White c2-pawn captures restored Black e7-pawn; Vendetta satisfied.',
  '45 White ends; Black has a legal queen capture.',
  '46 Qd8xd2: clear d7,d6,d5,d4,d3 file; capture White d2-pawn and check King e1 diagonally.',
  '47 Black ends with White in check; White can capture the checking Queen.',
  '48 Bc1xd2: capture Black Queen and remove the check; satisfies Vendetta.',
  '49 White ends; Black knight can capture d2.',
  '50 Ne4xd2: knight captures White c1-bishop.',
  '51 Black ends; White knight can recapture.',
  '52 Nb1xd2: knight captures Black g8-knight.',
  '53 White ends; Black bishop can capture e6.',
  '54 Bc8xe6: clear d7 diagonal; capture White c2-pawn.',
  '55 Black ends; White Queen can capture h7.',
  '56 Qh5xh7: clear h6; capture Black h7-pawn.',
  '57 White ends; Black rook can capture h7.',
  '58 Rh8xh7: capture White Queen and revoke Black remaining castling right.',
  '59 Black ends; White bishop can capture a6.',
  '60 Bf1xa6: clear e2,d3,c4,b5 diagonal; capture Black b8-knight.',
  '61 White ends; Black b-pawn can capture a6.',
  '62 b7xa6: capture White f1-bishop diagonally.',
  '63 Black ends; White rook can capture b2.',
  '64 Ra2xb2: capture Black f8-bishop across one square.',
  '65 Earthquake after White capture: orientation 90; fixed squares stay; opponent promotes a6 to Knight and a7 to Queen, then White h2 to Queen; retain effect and draw Mystic Shield.',
  '66 White ends; Black rook has h2 capture under Vendetta.',
  '67 Rh7xh2: clear h6,h5,h4,h3 file; capture the promoted White h-pawn as a Queen.',
  '68 Black ends; White rook can recapture h2.',
  '69 Rh1xh2: capture Black rook and remove White last castling right.',
  '70 White ends; Black rook can capture b2.',
  '71 Rb8xb2: clear b7,b6,b5,b4,b3; capture White a1-rook.',
  '72 Black ends; White knight can capture e6.',
  '73 Nf4xe6: capture Black c8-bishop with the original g1-knight.',
  '74 White ends; Black rook can capture d2.',
  '75 Rb2xd2: clear c2; capture White b1-knight.',
  '76 Black ends; White knight can capture c5.',
  '77 Ne6xc5: capture Black c7-pawn with a knight jump.',
  '78 White ends; promoted Black Queen can capture c5.',
  '79 Qa7xc5: clear b6 diagonal; capture White g1-knight.',
  '80 Neutrality after Black capture: opposing nonroyal g2-pawn becomes neutral without moving or changing owner; retain marker and draw Truce.',
  '81 Black ends; White King has legal capture d2, so Vendetta remains.',
  '82 Ke1xd2: diagonal King step captures Black a8-rook; destination is safe.',
  '83 White ends; Black promoted Queen can capture g5.',
  '84 Qc5xg5: clear d5,e5,f5; capture White f2-pawn and check d2 along f4,e3.',
  '85 Black ends: White has no legal capture (Rh2xg2 is a friendly-origin neutral, not an opponent); Vendetta ends and is discarded; White remains checked.',
  '86 Kd2-c2: adjacent empty square escapes the g5-d2 diagonal.',
  '87 White ends safely after quiet move.',
  '88 Ke8-e7: adjacent empty safe square; no castling rights remain.',
  '89 Black ends the King move.',
  '90 a4-b4: Earthquake makes White pawn forward point east; quiet single step resets clock.',
  '91 White ends the rotated pawn move.',
  '92 Qg5-c5: clear f5,e5,d5; checks White c2 along c4,c3.',
  '93 Black ends with White checked on the c-file.',
  '94 Kc2-d3: adjacent empty square escapes the Queen file.',
  '95 White ends safely.',
  '96 Under Elf Hill replaces Black move: King e7 goes away, never captured; discard and draw Fireball; advance clocks once and preserve attached markers.',
  '97 Black ends; return is not due until Black next turn.',
  '98 Rh2-h8: clear h3,h4,h5,h6,h7; absent Black King cannot be checked.',
  '99 White ends: mandatory Black King return becomes due before any optional action.',
  '100 Return King a3: vacant safe edge; same royal identity returns without advancing clocks; its movement and captures are forbidden this turn.',
  '101 Qc5-b5: neighboring clear square; checks White King d3 along clear c4; returned Black King remains immobile.',
  '102 Black ends with White in diagonal check; returned King movement restriction expires.',
  '103 Kd3-e4: adjacent safe square escapes the b5-c4-d3 Queen diagonal.',
  '104 White ends the King move.',
  '105 Qb5-e8: clear c6,d7 diagonal; checks White e4 down clear e7,e6,e5.',
  '106 Black ends; White receives the turn in check, with legal escapes available.',
];

// Independent capture geometry for this trace's ordinary roles and 0/90 orientation.
function canReach(board: PieceState[], piece: PieceState, target: SquareName, orientation: 0 | 90, immobile?: string): boolean {
  if (piece.zone !== 'board' || !piece.square || piece.id === immobile || piece.square === target) return false;
  const dx = target.charCodeAt(0) - piece.square.charCodeAt(0);
  const dy = Number(target[1]) - Number(piece.square[1]);
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    return orientation === 0 ? dy === forward && ax === 1 : dx === forward && ay === 1;
  }
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (!(piece.role === 'rook' ? dx === 0 || dy === 0 : piece.role === 'bishop' ? ax === ay : dx === 0 || dy === 0 || ax === ay)) return false;
  for (let i = 1; i < Math.max(ax, ay); i++) {
    const square = String.fromCharCode(piece.square.charCodeAt(0) + Math.sign(dx) * i) + (Number(piece.square[1]) + Math.sign(dy) * i);
    if (board.some(p => p.zone === 'board' && p.square === square)) return false;
  }
  return true;
}

function afterCapture(board: PieceState[], mover: PieceState, victim: PieceState): PieceState[] {
  return board.filter(p => p.id !== victim.id).map(p => p.id === mover.id ? { ...p, square: victim.square } : p);
}

function royalCheck(board: PieceState[], color: Color, orientation: 0 | 90, immobile?: string): boolean {
  const king = board.find(p => p.royal && p.owner === color && p.zone === 'board');
  if (!king?.square) return false; // The away King is neither a target nor an attacker.
  return board.some(p => (p.owner !== color || p.neutral) && canReach(board, p, king.square!, orientation, immobile)
    // A neutral capture is controlled by the opponent of the threatened King.
    // Each recursive hypothetical removes one royal target, so this terminates.
    && (!p.neutral || !royalCheck(afterCapture(board, p, king), color === 'white' ? 'black' : 'white', orientation, immobile)));
}

test('iteration 130: every action independently preserves physical and rule state', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/130.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 5);
  let state = createGameState(trace.initial);
  let pieces = structuredClone(state.pieces);
  const players = structuredClone(state.players);
  let turn = structuredClone(state.turn);
  let effects: unknown[] = [];
  let ep: GameState['enPassant'] = [];
  let rights = 'KQkq';
  let half = 0, full = 1, fenColor: Color = 'white';
  let orientation: 0 | 90 = 0;
  let rewind: { pieces: PieceState[]; ep: GameState['enPassant']; half: number; full: number; rights: string } | undefined;
  const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
  const checkedWhite = new Set([46, 47, 84, 85, 92, 93, 101, 102, 105, 106]);
  const reject = (action: GameAction) => {
    const input = structuredClone(state);
    const result = applyAction(state, action);
    assert.equal(result.ok, false, `restriction: ${JSON.stringify(action)}`);
    assert.deepEqual(result.state, input);
    assert.deepEqual(state, input, 'rejected action input immutability');
  };
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, action = step.action;
    assert.ok(rationales[index]!.startsWith(`${n} `));
    const message = rationales[index];
    const at = (square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
    if (n === 33) rewind = { pieces: structuredClone(pieces), ep: structuredClone(ep), half, full, rights };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.from, /^[a-h][1-8]$/); assert.match(action.to, /^[a-h][1-8]$/);
      const mover = at(action.from)!;
      assert.ok(mover, message);
      assert.equal(mover.owner, turn.color, message);
      const victim = at(action.to);
      const dx = action.to.charCodeAt(0) - action.from.charCodeAt(0);
      const dy = Number(action.to[1]) - Number(action.from[1]);
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (mover.role === 'knight') assert.equal(ax * ay, 2, message);
      else if (mover.role === 'king') assert.equal(Math.max(ax, ay), 1, message);
      else if (mover.role === 'pawn') {
        const forward = mover.owner === 'white' ? 1 : -1;
        const distance: number = orientation === 0 ? dy * forward : dx * forward;
        const lateral: number = orientation === 0 ? ax : ay;
        assert.ok(victim ? distance === 1 && lateral === 1 : lateral === 0 && (distance === 1 || distance === 2), message);
        if (distance === 2) assert.ok(orientation === 0 && [2, 7].includes(Number(action.from[1])), message);
      } else {
        assert.ok(mover.role === 'rook' ? dx === 0 || dy === 0 : mover.role === 'bishop' ? ax === ay : dx === 0 || dy === 0 || ax === ay, message);
      }
      if (mover.role !== 'knight') for (let i = 1; i < Math.max(ax, ay); i++) {
        const square: string = String.fromCharCode(action.from.charCodeAt(0) + Math.sign(dx) * i) + (Number(action.from[1]) + Math.sign(dy) * i);
        assert.equal(at(square), undefined, `${message}: clear ${square}`);
      }
      if (n >= 42 && n <= 84) assert.ok(victim, `${message}: Vendetta capture`);
      if (victim) {
        assert.notEqual(victim.owner, turn.color); assert.equal(victim.royal, false);
        victim.zone = 'captured'; victim.square = null; victim.capturedBy = turn.color;
      }
      ep = mover.role === 'pawn' && Math.max(ax, ay) === 2
        ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}` as SquareName, pawnId: mover.id }] : [];
      half = victim || mover.role === 'pawn' ? 0 : half + 1;
      if (turn.color === 'black') full++;
      if (mover.royal) rights = rights.replace(mover.owner === 'white' ? /[KQ]/g : /[kq]/g, '');
      const rookRight: Record<string, string> = { 'white-rook-a1': 'Q', 'white-rook-h1': 'K', 'black-rook-a8': 'q', 'black-rook-h8': 'k' };
      for (const p of [mover, victim]) if (p && rookRight[p.id]) rights = rights.replace(rookRight[p.id]!, '');
      mover.square = action.to as SquareName;
      turn.phase = 'afterMove'; turn.moveMade = true; fenColor = opposite(turn.color);
    } else if (action.type === 'playCard') {
      const owner: Color = action.cardId === 'knightmare' ? 'black' : turn.color;
      assert.equal(turn.cardPlays[owner], 0);
      const player = players[owner];
      const cardIndex = player.hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(cardIndex >= 0); const card = player.hand.splice(cardIndex, 1)[0]!;
      const draw = player.deck.shift(); if (draw) player.hand.push(draw);
      turn.cardPlays[owner]++;
      if (action.cardId === 'knightmare') {
        assert.equal(n, 34); assert.ok(rewind);
        pieces = structuredClone(rewind.pieces); ep = structuredClone(rewind.ep);
        half = rewind.half; full = rewind.full; rights = rewind.rights;
        fenColor = turn.color; turn.phase = 'beforeMove'; turn.moveMade = false;
        player.discard.push(card);
      } else if (action.cardId === 'vendetta') effects.push({ type: 'vendetta', owner, card });
      else if (action.cardId === 'earthquake') {
        orientation = 90;
        for (const [square, role] of [['a6', 'knight'], ['a7', 'queen'], ['h2', 'queen']] as const) {
          const pawn = at(square)!; assert.equal(pawn.role, 'pawn'); pawn.role = role; pawn.promoted = true;
        }
        effects.push({ type: 'earthquake', owner, card, direction: 'counterclockwise', target: { direction: 'counterclockwise', promotions: [{ square: 'a6', role: 'knight' }, { square: 'a7', role: 'queen' }, { square: 'h2', role: 'queen' }] } });
      } else if (action.cardId === 'neutrality') {
        const pawn = at('g2')!; assert.equal(pawn.owner, 'white');
        pawn.neutralBeforeEffects = false; pawn.neutral = true;
        effects.push({ type: 'neutrality', owner, card, pieceId: 'white-pawn-g2' });
      } else {
        assert.equal(action.cardId, 'under-elf-hill');
        const king = pieces.find(p => p.id === 'black-king-e8')!;
        king.zone = 'away'; king.square = null; player.discard.push(card);
        ep = []; half++; full++; fenColor = 'white'; turn.phase = 'afterMove'; turn.moveMade = true;
      }
    } else if (action.type === 'returnKing') {
      assert.equal(n, 100); assert.equal(action.to, 'a3');
      const king = pieces.find(p => p.id === 'black-king-e8')!;
      king.zone = 'board'; king.square = 'a3';
    } else {
      assert.equal(action.type, 'endTurn');
      assert.equal(turn.moveMade, true);
      turn = { color: opposite(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      if (n === 85) {
        assert.deepEqual(ep, [], 'no en-passant alternative to an occupied-square capture');
        const captures = pieces.flatMap(mover => mover.zone !== 'board' || mover.owner !== 'white' && !mover.neutral ? []
          : pieces.filter(victim => victim.zone === 'board' && victim.owner === 'black' && !victim.royal
            && canReach(pieces, mover, victim.square!, orientation)
            && !royalCheck(afterCapture(pieces, mover, victim), 'white', orientation))
            .map(victim => `${mover.id}:${victim.id}`));
        assert.deepEqual(captures, [], 'independent exhaustive White opponent-piece capture search ends Vendetta');
        const neutral = at('g2')!;
        assert.equal(neutral.neutral, true);
        assert.equal(neutral.owner, 'white', 'Rh2xg2 cannot satisfy opponent-piece capture requirement');
        effects = effects.filter(e => (e as { type: string }).type !== 'vendetta');
        players.white.discard.push({ id: 'white-hand-4-vendetta', cardId: 'vendetta' });
      }
    }
    const input = structuredClone(state);
    const result = applyAction(state, action);
    assert.deepEqual(state, input, `${message}: complete input immutability`);
    assert.ok(result.ok, message); state = result.state;
    assert.deepEqual(state.pieces, pieces, `${message}: every physical identity and capturedBy`);
    assert.deepEqual(state.players, players, `${message}: all ordered card zones`);
    assert.deepEqual(state.turn, turn, `${message}: phase and allowances`);
    assert.deepEqual(state.effects, effects, `${message}: complete effects`);
    assert.equal(state.orientation, orientation, message);
    assert.deepEqual(state.enPassant, ep, `${message}: physical EP record`);
    const board = Board.empty();
    for (const p of pieces) if (p.zone === 'board') board.set(parseSquare(p.square!)!, { color: p.owner, role: p.role });
    assert.equal(state.fen, `${makeBoardFen(board)} ${fenColor[0]} ${rights || '-'} - ${half} ${full}`, `${message}: board and clocks`);
    for (const field of ['pendingRescue', 'pendingAbduction', 'pendingDoomsayer'] as const) assert.equal(state[field] ?? null, null, `${message}: ${field}`);
    const elf = n < 96 || n >= 102 ? [] : [{ pieceId: 'black-king-e8', player: 'black', returning: n >= 99, ...(n >= 100 ? { returned: true } : {}) }];
    assert.deepEqual(state.underElfHill ?? [], elf, `${message}: return phase`);
    assert.equal(state.outcome, null, message);
    const immobile = n === 100 || n === 101 ? 'black-king-e8' : undefined;
    assert.equal(royalCheck(pieces, 'white', orientation, immobile), checkedWhite.has(n), `${message}: independent White attack calculation`);
    assert.equal(royalCheck(pieces, 'black', orientation, immobile), false, `${message}: independent Black attack calculation`);
    assert.equal(isKingInCheck(state, 'white'), checkedWhite.has(n), `${message}: White royal check`);
    assert.equal(isKingInCheck(state, 'black'), false, `${message}: Black royal check`);
    assert.deepEqual(state.chaosForbidden, n === 34 ? { player: 'white', movement: 'black-pawn-e7:e6:captured|white-knight-g1:f4:e6' } : undefined, `${message}: cancellation restriction`);
    assert.deepEqual(state.plotsAllowances ?? [], [], `${message}: no Plots allowance`);
    assert.equal(state.plotsExecution, undefined, `${message}: no Plots execution`);
    if (n === 34) {
      reject({ type: 'move', from: 'f4', to: 'e6' });
      reject({ type: 'endTurn' });
    }
    if (n === 96) reject({ type: 'move', from: 'c5', to: 'b5' });
    if (n === 99) {
      reject({ type: 'move', from: 'c5', to: 'b5' });
      reject({ type: 'endTurn' });
      reject({ type: 'returnKing', to: 'b3' });
      reject({ type: 'returnKing', to: 'h7' });
    }
    if (n === 100) reject({ type: 'move', from: 'a3', to: 'a2' });
  }
  assert.equal(state.fen, '4q2R/5p2/n7/8/1P2K3/k7/6P1/8 w - - 7 26');
  assert.equal(replayTrace(trace).fen, state.fen);
});
