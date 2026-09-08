import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Read in order against rules §§8–13, 16.2, 17.1 and 20; printed catalog
// timing and Curse's capture expiry control over the abbreviated cards.md.
const rationales = [
  '1. e2-e4: clear e3/e4 initial double step; e3 en passant opens.',
  '2. White ends; Black receives the e3 opportunity and fresh allowances.',
  '3. g7-g6: empty forward square; e3 opportunity expires.',
  '4. Heresy after Black move: all four bishops have occupied orthogonal neighbors; diagonal g7 has the same color, so none can move. Spend and replace.',
  '5. Black ends after Heresy; board and clocks remain.',
  '6. Long Jump: g1 and empty d3 have opposite colors; the same Knight relocates instead of moving normally.',
  '7. White ends its replacement move.',
  '8. Assassin: h8 Rook captures its own g8 Knight over one clear orthogonal step; Black is captor and loses kingside castling.',
  '9. Black ends its replacement capture.',
  '10. Queen d1-h5 uses empty e2/f3/g4 diagonal.',
  '11. White ends the Queen move.',
  '12. b7-b5 traverses empty b6; b6 en passant opens.',
  '13. Black hands over the b6 opportunity.',
  '14. a2-a4 traverses empty a3; replaces b6 with a3 opportunity.',
  '15. White hands over the a3 opportunity.',
  '16. h7-h6 advances into empty h6 and expires en passant.',
  '17. Curse after Black move marks the opposing Queen on h5; card remains active and Black draws Winged Victory.',
  '18. Black ends; Queen identity retains Curse.',
  '19. f2-f4 traverses empty f3 and opens f3 en passant.',
  '20. White ends; f3 opportunity persists.',
  '21. Knight b8-c6 is a clear L jump and expires en passant.',
  '22. Black ends its Knight move.',
  '23. Rook a1-a3 passes empty a2; White loses queenside castling.',
  '24. White ends its Rook move.',
  '25. Bishop c8-a6 passes empty b7 on a diagonal.',
  '26. Black ends its Bishop move.',
  '27. c2-c4 traverses empty c3; opens c3 en passant.',
  '28. White hands over c3 en passant.',
  '29. Bishop f8-g7 moves one diagonal step to empty g7.',
  '30. Black ends its Bishop move.',
  '31. a4xb5 is a forward-diagonal Pawn capture; White captures the original b7 Pawn.',
  '32. White ends its capture.',
  '33. Bishop g7-f6 moves one diagonal step to empty f6.',
  '34. Black ends its Bishop move.',
  '35. g2-g4 traverses empty g3; opens g3 en passant.',
  '36. Panic after White move gives Black 15 seconds without moving pieces or expiring g3.',
  '37. White ends; Black starts under Panic.',
  '38. Timeout consumes Black turn, expires g3 and Panic, increments clocks and returns play to White.',
  '39. Rook a3-c3 passes empty b3.',
  '40. White ends its Rook move.',
  '41. Knight c6-b4 is an L jump to empty b4.',
  '42. Black ends its Knight move.',
  '43. Cursed Queen h5-f5 passes empty g5 and moves exactly two squares.',
  '44. White ends its restricted Queen move.',
  '45. Rook g8-f8 moves one orthogonal step to empty f8.',
  '46. Black ends its Rook move.',
  '47. Madman g4-e6-c8 jumps the f5 Queen then d7 Pawn; both remain. Pawn on c8 does not promote under §13.2.',
  '48. White ends its Madman replacement move.',
  '49. Bishop f6-g7 moves to its empty diagonal neighbor.',
  '50. Black ends its Bishop move.',
  '51. Knight d3-e5 jumps to empty e5.',
  '52. White ends its Knight move.',
  '53. c7-c6 is a single forward Pawn step.',
  '54. Truce is legal after Black move with neither King checked; it remains active and draws Passing in the Night.',
  '55. Black ends under Truce.',
  '56. Bishop f1-e2 is a noncapture diagonal step permitted by Truce.',
  '57. White ends with Truce active.',
  '58. Knight b4-c2 is a noncapture jump checking e1; Truce ends and enters Black discard.',
  '59. Black ends; White receives the Knight check.',
  '60. King e1-d1 escapes c2 Knight check and loses remaining White castling right.',
  '61. White ends with its King safe on d1.',
  '62. Queen d8-c7 moves one diagonal step to empty c7.',
  '63. Black ends its Queen move.',
  '64. Hidden Passage moves White King d1-g1 to an empty safe square instead of the move.',
  '65. White ends its King relocation.',
  '66. c6xb5 is a forward-diagonal capture of original White a2 Pawn by Black.',
  '67. Black ends its capture.',
  '68. b2-b4 traverses empty b3; opens b3 en passant.',
  '69. Cathedral after White move swaps its c3 Rook and c1 Bishop simultaneously; identity and b3 opportunity persist.',
  '70. White ends after Cathedral.',
  '71. Queen c7-d8 takes an empty diagonal step; b3 opportunity expires.',
  '72. Black ends its Queen move.',
  '73. Cursed Queen f5xd7 passes empty e6, captures d7 Pawn at distance two, and checks e8.',
  '74. White ends the checking capture.',
  '75. Queen d8xd7 captures the checking White Queen; Black is captor and Curse expires into Black discard.',
  '76. Black ends with the check removed.',
  '77. Rook c1-f1 traverses empty d1/e1.',
  '78. White ends its Rook move.',
  '79. f7-f6 advances one square into empty f6.',
  '80. Black ends its Pawn move.',
  '81. Bishop e2-d1 takes an empty diagonal step.',
  '82. White ends its Bishop move.',
  '83. Rook f8-h8 passes empty g8; Black kingside castling remains lost.',
  '84. Think Again immediately cancels f8-h8, restores prior clocks/board and Black move, spends White card, and forbids repeating that physical move.',
  '85. f6-f5 is a different legal Pawn move; ends the replacement prohibition.',
  '86. Black ends; White receives fresh allowance despite its prior reaction.',
  '87. Rook f1-f2 steps to empty f2.',
  '88. White ends its Rook move.',
  '89. Knight c2-e3 jumps to empty e3.',
  '90. Black ends its Knight move.',
  '91. Bishop d1-g4 traverses empty e2/f3.',
  '92. White ends its Bishop move.',
  '93. g6-g5 is an empty forward Pawn step.',
  '94. Black ends its Pawn move.',
  '95. e4xf5 captures original Black f7 Pawn by forward diagonal.',
  '96. White ends its capture.',
  '97. Rook f8-g8 steps to empty g8.',
  '98. Black ends its Rook move.',
  '99. Bishop c3-d4 steps diagonally into empty d4.',
  '100. White ends its Bishop move.',
  '101. Queen d7xf5 traverses empty e6 and captures original White e2 Pawn.',
  '102. Black ends its Queen capture.',
  '103. Knight e5-f3 jumps into empty f3.',
  '104. White ends its Knight move.',
  '105. Queen f5-d7 traverses empty e6.',
  '106. Black ends its Queen move.',
  '107. f4xg5 captures original Black g7 Pawn by forward diagonal.',
  '108. White ends its Pawn capture.',
  '109. Queen d7-d8 steps to empty d8.',
  '110. Black ends its Queen move.',
  '111. d2xe3 captures original Black b8 Knight by forward diagonal.',
  '112. White ends its Pawn capture.',
  '113. Passing in the Night swaps a7/c8 and b5/g5 Pawn pairs simultaneously, retaining identities and owners; no capture or promotion, consumes Black move.',
  '114. Black ends its two-pair swap.',
  '115. Assassin Rook f2xh2 passes empty g2 and captures its own h2 Pawn; White is captor.',
  '116. White ends its replacement capture.',
  '117. Winged Victory returns Black d7 Pawn captured by White at 73 to empty central e5, clearing capturedBy; consumes Black move.',
  '118. Black ends its Pawn return.',
  '119. Rook h2-h3 moves one step into empty h3.',
  '120. White ends; Black starts with 50 regular move commands reviewed, including canceled command 83.',
];

const other = (color: Color): Color => color === 'white' ? 'black' : 'white';
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const square = (x: number, y: number): SquareName => {
  const value = `${String.fromCharCode(97 + x)}${y + 1}`;
  assert.match(value, /^[a-h][1-8]$/);
  return value as SquareName;
};
const at = (pieces: PieceState[], s: string) => pieces.find(p => p.zone === 'board' && p.square === s);
function geometry(pieces: PieceState[], p: PieceState, to: string, capture: boolean): boolean {
  const [x, y] = xy(p.square!); const [tx, ty] = xy(to);
  const dx = tx - x; const dy = ty - y;
  if (!dx && !dy) return false;
  if (p.role === 'pawn') {
    const forward = p.owner === 'white' ? 1 : -1;
    return capture ? Math.abs(dx) === 1 && dy === forward
      : dx === 0 && (dy === forward || dy === 2 * forward && (p.owner === 'white' ? y <= 1 : y >= 6)
        && !at(pieces, square(x, y + forward)));
  }
  if (p.role === 'knight') return Math.abs(dx * dy) === 2;
  if (p.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  const diagonal = Math.abs(dx) === Math.abs(dy);
  const straight = !dx || !dy;
  if (!(p.role === 'bishop' ? diagonal : p.role === 'rook' ? straight : diagonal || straight)) return false;
  for (let n = 1; n < Math.max(Math.abs(dx), Math.abs(dy)); n++) {
    if (at(pieces, square(x + n * Math.sign(dx), y + n * Math.sign(dy)))) return false;
  }
  return true;
}
function checked(pieces: PieceState[], color: Color, curse: boolean): boolean {
  const king = pieces.find(p => p.royal && p.owner === color)!;
  return pieces.some(p => {
    if (p.zone !== 'board' || p.owner === color) return false;
    if (curse && p.id === 'white-queen-d1') {
      const [x, y] = xy(p.square!); const [kx, ky] = xy(king.square!);
      if (Math.max(Math.abs(kx - x), Math.abs(ky - y)) > 2) return false;
    }
    return geometry(pieces, p, king.square!, true);
  });
}
function placement(pieces: PieceState[]): string {
  return Array.from({ length: 8 }, (_, row) => {
    let line = ''; let empty = 0;
    for (let x = 0; x < 8; x++) {
      const p = at(pieces, square(x, 7 - row));
      if (!p) { empty++; continue; }
      if (empty) { line += empty; empty = 0; }
      const letter = ({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' })[p.role];
      line += p.owner === 'white' ? letter.toUpperCase() : letter;
    }
    return line + (empty || '');
  }).join('/');
}

test('iteration 097 independently models every physical transition and card transaction', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/097.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.steps.length, rationales.length);
  let state = createGameState(trace.initial);
  const snapshots: GameState[] = [];
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1;
    assert.ok(rationales[index]!.startsWith(`${step}. `));
    snapshots.push(structuredClone(state));
    const before = structuredClone(state);
    const expected = structuredClone(state);
    let parts = before.fen.split(' ');
    let half = Number(parts[4]); let full = Number(parts[5]);
    let active = parts[1]; let rights = parts[2]!;
    let consumesMove = false; let pawnAction = false; let capture = false;
    const actor = before.turn.color;
    const removeRight = (id: string) => {
      for (const letter of ({ 'white-king-e1': 'KQ', 'black-king-e8': 'kq', 'white-rook-a1': 'Q', 'white-rook-h1': 'K', 'black-rook-a8': 'q', 'black-rook-h8': 'k' } as Record<string, string>)[id] ?? '') rights = rights.replace(letter, '');
    };
    const relocate = (from: string, to: string, friendlyCapture = false) => {
      const p = at(expected.pieces, from); assert.ok(p);
      const victim = at(expected.pieces, to);
      if (victim) {
        assert.equal(victim.owner, friendlyCapture ? p.owner : other(p.owner));
        assert.equal(victim.royal, false);
        victim.zone = 'captured'; victim.square = null; victim.capturedBy = actor;
        capture = true; removeRight(victim.id);
      }
      pawnAction ||= p.role === 'pawn';
      assert.match(to, /^[a-h][1-8]$/); p.square = to as SquareName; removeRight(p.id);
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const p = at(before.pieces, action.from); assert.ok(p);
      assert.equal(p.owner, actor);
      assert.ok(geometry(before.pieces, p, action.to, !!at(before.pieces, action.to)), rationales[index]);
      if (p.id === 'white-queen-d1' && before.effects.length) {
        const [x, y] = xy(action.from); const [tx, ty] = xy(action.to);
        assert.ok(Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= 2, 'Curse range');
      }
      if (step === 56 || step === 58) assert.equal(at(before.pieces, action.to), undefined, 'Truce noncapture');
      relocate(action.from, action.to); consumesMove = true;
      expected.enPassant = [];
      if (p.role === 'pawn' && Math.abs(Number(action.to[1]) - Number(action.from[1])) === 2) {
        expected.enPassant = [{ target: square(xy(action.from)[0], (xy(action.from)[1] + xy(action.to)[1]) / 2), pawnId: p.id }];
      }
      if (step === 58 || step === 75) {
        const type = step === 58 ? 'truce' : 'curse';
        const effect = expected.effects.find(e => (e as { type: string }).type === type) as { owner: Color; card: { id: string; cardId: string } };
        assert.ok(effect);
        if (step === 58) assert.equal(checked(expected.pieces, 'white', true), true, 'Knight c2 ends Truce with check');
        expected.effects = expected.effects.filter(e => e !== effect);
        expected.players[effect.owner].discard.push(effect.card);
      }
    } else if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true);
      expected.turn = { color: other(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    } else if (action.type === 'panicTimeout') {
      assert.equal(step, 38);
      assert.deepEqual(expected.effects.pop(), { type: 'panic', owner: 'white', player: 'black', durationMs: 15000 });
      expected.turn = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      expected.enPassant = []; active = 'w'; half++; full++;
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') throw new Error('unexpected action');
      const owner = action.cardId === 'think-again' ? other(actor) : actor;
      const card = expected.players[owner].hand.find(c => c.id === action.cardInstanceId);
      assert.ok(card); assert.equal(card.cardId, action.cardId);
      const meta = CARD_CATALOG[card.cardId]!;
      assert.equal(before.turn.cardPlays[owner], 0);
      assert.ok(meta.timing.includes(owner === actor ? before.turn.phase : 'afterOpponentMove'));
      expected.players[owner].hand = expected.players[owner].hand.filter(c => c.id !== card.id);
      expected.players[owner].hand.push(expected.players[owner].deck.shift()!);
      expected.turn.cardPlays[owner]++;
      if (!meta.continuing) expected.players[owner].discard.push(card);
      switch (card.cardId) {
        case 'heresy':
          assert.deepEqual(action.target, []);
          for (const p of before.pieces.filter(p => p.role === 'bishop')) {
            const [x, y] = xy(p.square!);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              if (x + dx! >= 0 && x + dx! < 8 && y + dy! >= 0 && y + dy! < 8) assert.ok(at(before.pieces, square(x + dx!, y + dy!)), 'Heresy has no opposite-color adjacent vacancy');
            }
          }
          break;
        case 'long-jump': {
          assert.deepEqual(action.target, [{ from: 'g1', to: 'd3' }]);
          assert.equal(at(before.pieces, 'g1')!.role, 'knight'); assert.equal(at(before.pieces, 'd3'), undefined);
          assert.notEqual((6 + 0) % 2, (3 + 2) % 2);
          relocate('g1', 'd3'); consumesMove = true; break;
        }
        case 'assassin': {
          const from = step === 8 ? 'h8' : 'f2'; const to = step === 8 ? 'g8' : 'h2';
          assert.deepEqual(action.target, [{ from, to }]);
          assert.ok(geometry(before.pieces, at(before.pieces, from)!, to, true));
          relocate(from, to, true); consumesMove = true; break;
        }
        case 'curse':
          assert.equal(action.target, 'h5'); assert.equal(at(before.pieces, 'h5')!.id, 'white-queen-d1');
          expected.effects.push({ type: 'curse', owner, card, pieceId: 'white-queen-d1' }); break;
        case 'panic': expected.effects.push({ type: 'panic', owner, player: other(owner), durationMs: 15000 }); break;
        case 'madman':
          assert.deepEqual(action.target, [{ from: 'g4', to: 'e6' }, { from: 'e6', to: 'c8' }]);
          assert.ok(at(before.pieces, 'f5')); assert.ok(at(before.pieces, 'd7'));
          assert.equal(at(before.pieces, 'e6'), undefined); assert.equal(at(before.pieces, 'c8'), undefined);
          relocate('g4', 'c8'); consumesMove = true; break;
        case 'truce': expected.effects.push({ type: 'truce', owner, card }); break;
        case 'hidden-passage':
          assert.deepEqual(action.target, [{ from: 'd1', to: 'g1' }]);
          assert.equal(at(before.pieces, 'd1')!.royal, true); assert.equal(at(before.pieces, 'g1'), undefined);
          relocate('d1', 'g1'); consumesMove = true; break;
        case 'cathedral': {
          assert.deepEqual(action.target, { rook: 'c3', bishop: 'c1' });
          const rook = at(expected.pieces, 'c3')!; const bishop = at(expected.pieces, 'c1')!;
          assert.equal(rook.role, 'rook'); assert.equal(bishop.role, 'bishop');
          assert.equal(rook.owner, owner); assert.equal(bishop.owner, owner);
          rook.square = 'c1'; bishop.square = 'c3'; break;
        }
        case 'think-again': {
          const prior = snapshots[82]!;
          expected.pieces = structuredClone(prior.pieces); expected.effects = structuredClone(prior.effects);
          expected.enPassant = structuredClone(prior.enPassant);
          expected.turn.phase = 'beforeMove'; expected.turn.moveMade = false;
          parts = prior.fen.split(' '); active = parts[1]; rights = parts[2]!; half = Number(parts[4]); full = Number(parts[5]);
          break;
        }
        case 'passing-in-the-night': {
          assert.deepEqual(action.target, [{ from: 'a7', to: 'c8' }, { from: 'b5', to: 'g5' }]);
          for (const [from, to] of [['a7', 'c8'], ['b5', 'g5']] as const) {
            const a = at(expected.pieces, from)!; const b = at(expected.pieces, to)!;
            assert.equal(a.owner, 'black'); assert.equal(b.owner, 'white');
            assert.equal(a.role, 'pawn'); assert.equal(b.role, 'pawn');
            a.square = to; b.square = from;
          }
          consumesMove = true; pawnAction = true; break;
        }
        case 'winged-victory': {
          assert.deepEqual(action.target, { pieceId: 'black-pawn-d7', to: 'e5' });
          const p = expected.pieces.find(p => p.id === 'black-pawn-d7')!;
          assert.equal(p.zone, 'captured'); assert.equal(p.capturedBy, 'white'); assert.equal(p.owner, owner); assert.equal(p.originalRole, 'pawn'); assert.equal(p.promoted, false);
          assert.equal(at(before.pieces, 'e5'), undefined);
          p.square = 'e5'; p.zone = 'board'; delete p.capturedBy;
          consumesMove = true; pawnAction = true; break;
        }
        default: throw new Error(`unreviewed card ${card.cardId}`);
      }
      if (consumesMove) expected.enPassant = [];
    }
    if (consumesMove) {
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true;
      active = actor === 'white' ? 'b' : 'w'; full += actor === 'black' ? 1 : 0;
      half = pawnAction || capture ? 0 : half + 1;
    }
    const result = applyAction(state, action);
    assert.deepEqual(state, before, `${step}: complete input immutability, including capture metadata`);
    assert.ok(result.ok, rationales[index]);
    const after = result.state;
    assert.deepEqual(after.pieces, expected.pieces, `${step}: all physical pieces, captors and unaffected identities`);
    assert.deepEqual(after.players, expected.players, `${step}: exact ordered card accounting`);
    assert.deepEqual(after.turn, expected.turn, `${step}: timing and allowances`);
    assert.deepEqual(after.effects, expected.effects, `${step}: complete effect lifecycle`);
    assert.deepEqual(after.enPassant, expected.enPassant, `${step}: en passant lifecycle`);
    const actualFen = after.fen.split(' ');
    assert.deepEqual([actualFen[0], actualFen[1], actualFen[2], actualFen[4], actualFen[5]], [placement(expected.pieces), active, rights || '-', String(half), String(full)], `${step}: independently constructed FEN and clocks`);
    assert.ok(actualFen[3] === '-' || expected.enPassant.some(ep => ep.target === actualFen[3]), 'FEN compatibility field may omit an unavailable capture');
    assert.equal(after.orientation, 0);
    assert.equal(after.outcome, null);
    assert.ok(!after.pendingRescue && !after.pendingAbduction && !after.pendingDoomsayer && !after.underElfHill?.length);
    const curse = expected.effects.some(e => (e as { type: string }).type === 'curse');
    const truce = expected.effects.some(e => (e as { type: string }).type === 'truce');
    if (!truce) assert.equal(checked(expected.pieces, actor, curse), false, `${step}: acting King independently safe`);
    if (action.type === 'playCard') {
      assert.equal(checked(expected.pieces, other(actor), curse), false, `${step}: regular card does not directly checkmate`);
    }
    assert.deepEqual(after.chaosForbidden, step === 84 ? { player: 'black', movement: 'black-rook-h8:f8:h8' } : undefined);
    state = after;
  }
  assert.equal(trace.moves, 50);
  assert.equal(state.fen, trace.finalFen);
});

test('iteration 097 deterministic engine trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/097.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});
