import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/135.json', import.meta.url), 'utf8')) as RandomTrace;

test('iteration 135 deterministic replay core', () => {
  assert.ok(replayTrace(trace));
});

// Independently reviewed against rules §§8–11, 13, 15.5, 16.3, 18.1, 20,
// cards.md, and artwork KC14/1, KC2/3, KC12/2, KC18/3, KC4/1, KC12/4, KC16/4.
// Every entry is an action, including the reaction-window-closing endTurn commands.
const rationale = [
  '1. a2-a3: White Pawn advances one empty square; no capture or promotion.',
  '2. White completed a3; close reactions and give Black its unused allowances.',
  '3. h7-h5: Black Pawn double step through empty h6; h6 opportunity has no adjacent White captor.',
  '4. Black completed h5; White starts, retaining the one-move h6 opportunity.',
  '5. g1-h3: White Knight jumps (1,2); the old h6 opportunity expires.',
  '6. Holy Quest after Nh3 swaps opposing Bishop c8 and Knight b8 without capture; draw Fireball.',
  '7. Close White card turn; the swapped identities persist and allowances reset.',
  '8. b7-b6: Black Pawn advances into empty b6.',
  '9. Close Black b6 turn; no optional discard was requested.',
  '10. d2-d4: White Pawn crosses empty d3; no Black Pawn can use d3 en passant.',
  '11. Close White d4 turn, retaining d3 opportunity for Black.',
  '12. c7-c6: Black Pawn advances to empty c6; d3 opportunity expires.',
  '13. Close Black c6 turn; White may move.',
  '14. g2-g4: White Pawn crosses empty g3; no Black Pawn is adjacent on rank four.',
  '15. Close White g4 turn, retaining g3 opportunity for Black.',
  '16. h8-h6: Black Rook traverses empty h7; permanently lose kingside castling.',
  '17. Close Black Rh6 turn; g3 en-passant opportunity is gone.',
  '18. e1-d2: White King takes one safe diagonal step; both White castling rights are lost.',
  '19. Close White Kd2 turn with both Kings safe.',
  '20. g8-f6: Black Knight jumps (1,2) into empty f6.',
  '21. Close Black Nf6 turn.',
  '22. f2-f3: White Pawn advances one empty square.',
  '23. Close White f3 turn.',
  '24. f6-e4: Black Knight jumps (1,2), landing without capture and checking White King d2.',
  '25. Close Black Ne4 turn; White receives its checked turn with Kd3 available.',
  '26. d2-d3: White King moves one safe square forward; Ne4 does not attack d3.',
  '27. Close White Kd3 turn.',
  '28. e4-c3: Black Knight jumps (2,1); it does not attack the adjacent d3 King.',
  '29. Close Black Nc3 turn.',
  '30. d1-e1: White Queen slides one empty horizontal square.',
  '31. Close White Qe1 turn.',
  '32. Guardian replaces Black move: a7-a6 then a8-a7 follows behind; no capture; lose q; draw Forbidden City.',
  '33. Close Black Guardian turn; no extra ordinary move is granted.',
  '34. e1-d1: White Queen returns one empty horizontal square.',
  '35. Close White Qd1 turn.',
  '36. Passing in the Night replaces Black move: swap b6/a3 and c6/g4 simultaneously; preserve all four Pawn owners; draw Resurrection.',
  '37. Close Black swap turn; no Pawn promotes and no en-passant right is created.',
  '38. d3-d2: White King retreats one safe square.',
  '39. Close White Kd2 turn.',
  '40. d8-b6: Black Queen crosses empty c7 and captures original White a2 Pawn on b6; captor Black.',
  '41. Close Black Qxb6 turn; captured identity stays off board.',
  '42. h3-f4: White Knight jumps (2,1) into empty f4.',
  '43. Close White Nf4 turn.',
  '44. b6-c5: Black Queen takes one empty diagonal step.',
  '45. Close Black Qc5 turn.',
  '46. f4-h3: White Knight jumps (2,1) back to empty h3.',
  '47. Close White Nh3 turn.',
  '48. h6-e6: Black Rook crosses empty g6 and f6.',
  '49. Close Black Re6 turn.',
  '50. d2-e1: White King takes a safe diagonal step; lost castling rights do not return.',
  '51. Close White Ke1 turn.',
  '52. c3-b5: Black Knight jumps (1,2) into empty b5.',
  '53. Close Black Nb5 turn.',
  '54. c6-c7: original White g2 Pawn advances north one empty square; no promotion yet.',
  '55. Close White c7 turn.',
  '56. c5-c7: Black Queen crosses empty c6 and captures original White g2 Pawn; captor Black.',
  '57. Close Black Qxc7 turn.',
  '58. d1-d2: White Queen moves one empty vertical square.',
  '59. Close White Qd2 turn.',
  '60. e6-b6: Black Rook crosses empty d6 and c6.',
  '61. Close Black Rb6 turn.',
  '62. Guardian replaces White move: c2-c3 then Bishop c1-c2 follows despite its ordinary diagonal geometry; draw Tournament.',
  '63. Close White Guardian turn with both Kings safe.',
  '64. a7-b7: Black Rook slides one empty horizontal square.',
  '65. Close Black Rb7 turn.',
  '66. e2-e4: White Pawn double step through empty e3; neither d4 nor f4 holds a Black Pawn captor.',
  '67. Mystic Shield after e4 protects that moved physical Pawn through Black next turn; draw Vendetta; clocks and e3 opportunity unchanged.',
  '68. White ends; Black starts its shield-restricted turn.',
  '69. b6-h6: Black Rook crosses clear c6,d6,e6,f6,g6; no capture of protected e4; e3 opportunity expires.',
  '70. Black ends; Mystic Shield expires without another discard or draw.',
  '71. c2-d3: White Bishop moves one empty diagonal square.',
  '72. Vendetta after Bd3 becomes Continuing Effect; Black has legal captures including Nb5xd4; keep card active and draw Vulture.',
  '73. White ends; Black has a legal capture, so Vendetta remains mandatory.',
  '74. b5-d4: Black Knight captures original White d2 Pawn, satisfying Vendetta.',
  '75. Black ends; White can capture g4 or d4, so Vendetta remains.',
  '76. f3-g4: White Pawn captures original Black c7 Pawn diagonally north, satisfying Vendetta.',
  '77. White ends; Black still has captures, including Rb7xb2.',
  '78. b7-b2: Black Rook crosses clear b6,b5,b4,b3 and captures White b2 Pawn.',
  '79. Black ends; White retains c3xd4, so Vendetta remains.',
  '80. c3-d4: original White c2 Pawn captures original Black g8 Knight diagonally.',
  '81. White ends; Black has the Queen diagonal capture c7-h2.',
  '82. c7-h2: Black Queen crosses clear d6,e5,f4,g3 and captures White h2 Pawn.',
  '83. Black ends; White can capture h5, so Vendetta persists.',
  '84. g4-h5: original White f2 Pawn captures original Black h7 Pawn diagonally.',
  '85. White ends; Black still can capture the Knight on h3.',
  '86. h2-h3: Black Queen captures original White g1 Knight one square vertically.',
  '87. Black ends; White has Bf1xh3 through empty g2.',
  '88. f1-h3: White Bishop crosses empty g2 and captures Black Queen.',
  '89. White ends; Black Rb2xb1 is a legal mandatory capture.',
  '90. b2-b1: Black Rook captures White b1 Knight and checks Ke1 along clear c1,d1.',
  '91. Black ends; White receives its checked turn, with legal Raxb1 escape.',
  '92. a1-b1: White Rook captures checking Black a8 Rook, curing check and satisfying Vendetta.',
  '93. White ends; Black Rh6xh5 remains legal.',
  '94. h6-h5: Black Rook captures original White f2 Pawn.',
  '95. Black ends; White Bh3xd7 remains legal.',
  '96. h3-d7: White Bishop crosses clear g4,f5,e6, captures Black d7 Pawn and checks Ke8.',
  '97. White ends; Black receives a checked turn with legal Kxd7 escape.',
  '98. e8-d7: Black King captures checking White f1 Bishop; d7 is safe, with Qd2 blocked on its file by White d4 Pawn.',
  '99. Black ends; White Rh1xh5 is a legal capture.',
  '100. h1-h5: White Rook crosses empty h2,h3,h4 and captures Black h8 Rook.',
  '101. White ends; Black has no legal capture anywhere, so Vendetta expires to White discard with no replacement draw.',
  '102. Winged Victory replaces Black move: return its captured h7 Pawn to empty central d5; clear capturedBy; draw Curse.',
  '103. Close Black Pawn-return turn; placement grants no extra move.',
  '104. d3-c2: White Bishop takes one empty diagonal step.',
  '105. Close White Bc2 turn.',
  '106. Resurrection replaces Black move: return captured d7 Pawn to vacant Black starting-rank b7; clear capturedBy; draw Under Elf Hill.',
  '107. Close Black Resurrection turn; no extra ordinary move.',
  '108. d2-e3: White Queen takes one empty diagonal step.',
  '109. Close White Qe3 turn.',
  '110. d5-e4: returned Black h7 Pawn captures White e2 Pawn diagonally south; its old shield expired at action 70.',
  '111. Close Black dxe4 turn.',
  '112. d4-d5: original White c2 Pawn advances north into newly vacated d5.',
  '113. Close White d5 turn; Black starts move 28 with both Kings safe.',
];

const other = (c: Color): Color => c === 'white' ? 'black' : 'white';
const square = (s: string): SquareName => {
  assert.match(s, /^[a-h][1-8]$/);
  return s as SquareName;
};
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const at = (pieces: PieceState[], s: string) => pieces.find(p => p.zone === 'board' && p.square === s);

// No reducer destinations, FEN-derived board, or state digest participates here.
function geometry(pieces: PieceState[], p: PieceState, to: string, capture: boolean): boolean {
  if (!p.square || p.square === to) return false;
  const [x, y] = xy(p.square), [u, v] = xy(to), dx = u - x, dy = v - y;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (p.role === 'knight') return ax * ay === 2;
  if (p.role === 'king') return Math.max(ax, ay) === 1;
  if (p.role === 'pawn') {
    const forward = p.owner === 'white' ? 1 : -1;
    if (capture) return ax === 1 && dy === forward;
    if (dx !== 0) return false;
    if (dy === forward) return true;
    return dy === 2 * forward && (p.owner === 'white' ? y <= 1 : y >= 6)
      && !at(pieces, `${p.square[0]}${y + forward + 1}`);
  }
  const aligned = p.role === 'bishop' ? ax === ay : p.role === 'rook' ? dx === 0 || dy === 0
    : ax === ay || dx === 0 || dy === 0;
  if (!aligned) return false;
  for (let k = 1; k < Math.max(ax, ay); k++) {
    const intermediate: string = `${String.fromCharCode(97 + x + k * Math.sign(dx))}${y + k * Math.sign(dy) + 1}`;
    if (at(pieces, intermediate)) return false;
  }
  return true;
}

function threatened(pieces: PieceState[], color: Color): boolean {
  const king = pieces.find(p => p.royal && p.owner === color)!;
  assert.ok(king.square);
  // This trace has only ordinary, nonneutral pieces. Shield cannot target a King;
  // Vendetta requires captures but does not suppress the legal royal capture geometry.
  return pieces.some(p => p.zone === 'board' && p.owner !== color && geometry(pieces, p, king.square!, true));
}

function captures(pieces: PieceState[], color: Color, shielded?: string): string[] {
  return pieces.filter(p => p.zone === 'board' && p.owner === color).flatMap(p =>
    pieces.filter(v => v.zone === 'board' && v.owner !== color && !v.royal && v.id !== shielded
      && geometry(pieces, p, v.square!, true)).flatMap(v => {
      const candidate = pieces.map(q => q.id === p.id ? { ...q, square: v.square }
        : q.id === v.id ? { ...q, square: null, zone: 'captured' as const } : q);
      return threatened(candidate, color) ? [] : [`${p.square}-${v.square}`];
    }));
}

function placement(pieces: PieceState[]): string {
  const symbols = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, r) => {
    let row = '', empty = 0;
    for (const file of 'abcdefgh') {
      const p = at(pieces, `${file}${8 - r}`);
      if (!p) { empty++; continue; }
      if (empty) row += empty;
      empty = 0;
      row += p.owner === 'white' ? symbols[p.role].toUpperCase() : symbols[p.role];
    }
    return row + (empty || '');
  }).join('/');
}

test('iteration 135 independent physical, card, turn, royal and cancellation oracle', () => {
  assert.equal(rationale.length, 113);
  assert.equal(trace.steps.length, rationale.length);
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 8);
  let actual = createGameState(trace.initial);
  const expected = structuredClone(actual);
  const backRank = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'] as const;
  expected.pieces = [1, 2, 7, 8].flatMap(rank => [...'abcdefgh'].map((file, index): PieceState => {
    const owner = rank < 3 ? 'white' : 'black';
    const role = rank === 2 || rank === 7 ? 'pawn' : backRank[index]!;
    return { id: `${owner}-${role}-${file}${rank}`, owner, role, originalRole: role,
      square: square(`${file}${rank}`), zone: 'board', promoted: false, royal: role === 'king', neutral: false };
  }));
  for (const color of ['white', 'black'] as const) {
    expected.players[color] = {
      hand: trace.initial.hands![color]!.map((cardId, i) => ({ id: `${color}-hand-${i}-${cardId}`, cardId })),
      deck: trace.initial.decks![color]!.map((cardId, i) => ({ id: `${color}-deck-${i}-${cardId}`, cardId })),
      discard: [],
    };
  }
  assert.deepEqual(actual.pieces, expected.pieces);
  assert.deepEqual(actual.players, expected.players);
  assert.equal(expected.fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  let rights = 'KQkq', half = 0, full = 1, fenSide: Color = 'white', historyLength = 0;
  let vendetta = false, shield = false;
  const played: NonNullable<GameState['playedCards']> = [];
  let shieldMove: GameState['shieldMove'];

  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, why = rationale[index]!;
    assert.ok(why.startsWith(`${n}. `));
    const input = structuredClone(actual), inputAction = structuredClone(action);
    const old = structuredClone(expected), actor = expected.turn.color;
    let card: { id: string; cardId: string } | undefined;
    const movesBefore = expected.pieces.map(p => ({ id: p.id, square: p.square, zone: p.zone }));
    const advance = (reset: boolean) => {
      half = reset ? 0 : half + 1;
      if (actor === 'black') full++;
      fenSide = other(actor);
      expected.turn.moveMade = true;
      expected.turn.phase = 'afterMove';
      expected.enPassant = [];
    };
    const relocate = (from: string, to: string) => {
      const p = at(expected.pieces, from);
      assert.ok(p, why);
      p.square = square(to);
      if (p.royal) rights = rights.replace(p.owner === 'white' ? /[KQ]/g : /[kq]/g, '');
      for (const [origin, flag] of [['a1', 'Q'], ['h1', 'K'], ['a8', 'q'], ['h8', 'k']]) {
        if (p.role === 'rook' && from === origin) rights = rights.replace(flag!, '');
      }
      return p;
    };

    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const destination = action.to;
      square(action.from); square(action.to);
      assert.equal(action.promotion, undefined, why);
      assert.equal(expected.turn.moveMade, false, why);
      const p = at(expected.pieces, action.from), victim = at(expected.pieces, action.to);
      assert.ok(p, why);
      assert.equal(p.owner, actor, why);
      assert.ok(geometry(expected.pieces, p, action.to, !!victim), why);
      if (vendetta) assert.ok(captures(expected.pieces, actor).includes(`${action.from}-${action.to}`), why);
      if (victim) {
        assert.equal(victim.owner, other(actor), why);
        assert.equal(victim.royal, false, why);
        assert.ok(!(shield && actor === 'black' && victim.id === 'white-pawn-e2'), why);
        victim.square = null; victim.zone = 'captured'; victim.capturedBy = actor;
      }
      relocate(action.from, action.to);
      advance(p.role === 'pawn' || !!victim);
      if (p.role === 'pawn' && Math.abs(Number(action.from[1]) - Number(action.to[1])) === 2) {
        const target = square(`${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`);
        expected.enPassant = [{ target, pawnId: p.id }];
        // All four doubles in this trace have no adjacent opposing Pawn.
        assert.ok(!expected.pieces.some(q => q.zone === 'board' && q.role === 'pawn' && q.owner !== actor
          && q.square![1] === destination[1] && Math.abs(xy(q.square!)[0] - xy(destination)[0]) === 1));
      }
      shieldMove = { player: actor, pieceIds: [p.id], capturedOpponent: !!victim };
      historyLength++;
    } else if (action.type === 'playCard') {
      assert.equal(expected.turn.cardPlays[actor], 0, why);
      const player = expected.players[actor];
      const i = player.hand.findIndex(c => c.id === action.cardInstanceId && c.cardId === action.cardId);
      assert.ok(i >= 0, why);
      card = player.hand.splice(i, 1)[0]!;
      player.hand.push(player.deck.shift()!);
      played.push({ player: actor, cardInstanceId: card.id });
      expected.turn.cardPlays[actor]++;
      historyLength++;
      if (action.cardId !== 'vendetta') player.discard.push(card);
      if (['holy-quest', 'mystic-shield', 'vendetta'].includes(action.cardId)) {
        assert.equal(expected.turn.phase, 'afterMove', why);
        if (action.cardId === 'holy-quest') {
          assert.equal(n, 6); assert.deepEqual(action.target, { bishop: 'c8', knight: 'b8' });
          const bishop = at(expected.pieces, 'c8')!, knight = at(expected.pieces, 'b8')!;
          assert.equal(bishop.owner, 'black'); assert.equal(bishop.role, 'bishop');
          assert.equal(knight.owner, 'black'); assert.equal(knight.role, 'knight');
          bishop.square = 'b8'; knight.square = 'c8';
        } else if (action.cardId === 'mystic-shield') {
          assert.equal(n, 67); assert.equal(action.target, 'e4');
          assert.deepEqual(shieldMove?.pieceIds, ['white-pawn-e2']);
          shield = true;
        } else {
          assert.equal(n, 72); assert.equal(action.target, undefined);
          assert.ok(captures(expected.pieces, 'black').includes('b5-d4'));
          vendetta = true;
        }
      } else {
        assert.equal(expected.turn.phase, 'beforeMove', why);
        assert.equal(vendetta, false, why);
        if (action.cardId === 'guardian') {
          const [from, to, rear] = n === 32 ? ['a7', 'a6', 'a8'] : ['c2', 'c3', 'c1'];
          assert.ok(n === 32 || n === 62);
          assert.deepEqual(action.target, [{ from, to }, { from: rear, to: from }]);
          assert.equal(at(expected.pieces, from!)!.role, 'pawn');
          assert.equal(at(expected.pieces, from!)!.owner, actor);
          assert.equal(at(expected.pieces, rear!)!.owner, actor);
          assert.equal(at(expected.pieces, to!), undefined);
          const pawn = relocate(from!, to!), follower = relocate(rear!, from!);
          shieldMove = { player: actor, capturedOpponent: false, pieceIds: [pawn.id, follower.id].sort() };
        } else if (action.cardId === 'passing-in-the-night') {
          assert.equal(n, 36);
          assert.deepEqual(action.target, [{ from: 'b6', to: 'a3' }, { from: 'c6', to: 'g4' }]);
          for (const [a, b] of [['b6', 'a3'], ['c6', 'g4']]) {
            const own = at(expected.pieces, a!)!, opponent = at(expected.pieces, b!)!;
            assert.equal(own.owner, actor); assert.equal(opponent.owner, other(actor));
            assert.equal(own.role, 'pawn'); assert.equal(opponent.role, 'pawn');
            own.square = square(b!); opponent.square = square(a!);
          }
          shieldMove = { player: actor, capturedOpponent: false, pieceIds: [] };
        } else {
          assert.ok(action.cardId === 'winged-victory' || action.cardId === 'resurrection');
          const id = action.cardId === 'winged-victory' ? 'black-pawn-h7' : 'black-pawn-d7';
          const to = action.cardId === 'winged-victory' ? 'd5' : 'b7';
          assert.equal(n, action.cardId === 'winged-victory' ? 102 : 106);
          assert.deepEqual(action.target, { pieceId: id, to });
          const p = expected.pieces.find(p => p.id === id)!;
          assert.equal(p.zone, 'captured'); assert.equal(p.capturedBy, 'white');
          assert.equal(p.owner, actor); assert.equal(p.role, 'pawn');
          assert.equal(at(expected.pieces, to), undefined);
          p.square = to; p.zone = 'board'; delete p.capturedBy;
          shieldMove = { player: actor, capturedOpponent: false, pieceIds: [] };
        }
        advance(true);
      }
      // None of these card results gives check; hence no direct mate or self-check fizzle.
      assert.equal(threatened(expected.pieces, 'white'), false, why);
      assert.equal(threatened(expected.pieces, 'black'), false, why);
    } else {
      assert.equal(action.type, 'endTurn', why);
      assert.equal(expected.turn.moveMade, true, why);
      assert.equal(threatened(expected.pieces, actor), false, why);
      expected.turn = { color: other(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      shieldMove = undefined;
      if (shield && actor === 'black') shield = false;
      if (vendetta && captures(expected.pieces, other(actor)).length === 0) {
        assert.equal(n, 101, why);
        vendetta = false;
        expected.players.white.discard.push({ id: 'white-deck-2-vendetta', cardId: 'vendetta' });
      }
    }
    expected.effects = [
      ...(shield ? [{ type: 'mystic-shield', owner: 'white', player: 'white', pieceId: 'white-pawn-e2' }] : []),
      ...(vendetta ? [{ type: 'vendetta', owner: 'white', card: { id: 'white-deck-2-vendetta', cardId: 'vendetta' } }] : []),
    ];
    expected.fen = `${placement(expected.pieces)} ${fenSide[0]} ${rights || '-'} - ${half} ${full}`;
    const result = applyAction(actual, action);
    assert.deepEqual(actual, input, `${why} Complete input immutability, including capturedBy and snapshots.`);
    assert.deepEqual(action, inputAction, `${why} Action input immutability.`);
    assert.ok(result.ok, why);
    actual = result.state;
    for (const key of ['pieces', 'players', 'turn', 'effects', 'fen', 'enPassant', 'orientation', 'outcome'] as const) {
      assert.deepEqual(actual[key], expected[key], `${why} Independent ${key}`);
    }
    assert.equal(actual.history.length, historyLength, why);
    assert.deepEqual(actual.playedCards ?? [], played, why);
    assert.deepEqual(actual.shieldMove, shieldMove, why);
    for (const key of ['pendingRescue', 'pendingDoomsayer', 'pendingAbduction', 'underElfHill', 'riposteLostMoves',
      'riposteSkipped', 'riposteCheckDeferred', 'fogLocked', 'chaosForbidden', 'plotsAllowances', 'plotsExecution', 'turnCheckpoint'] as const) {
      assert.ok(actual[key] == null, `${why} No unearned pending/mandatory/cancellation restriction: ${key}`);
    }
    for (const color of ['white', 'black'] as const) {
      const check = threatened(expected.pieces, color);
      assert.equal(check, color === 'white' ? [24, 25, 90, 91].includes(n) : n === 96 || n === 97, `${why} Reviewed royal threat`);
      assert.equal(isKingInCheck(actual, color), check, `${why} Public royal threat agrees with independent board`);
    }
    if (action.type === 'playCard') {
      assert.deepEqual(actual.cardResponse, { player: actor, historyLength }, why);
      assert.ok(actual.fogCheckpoint, why);
      assert.deepEqual(actual.fogCheckpoint.card, card, why);
      assert.equal(actual.fogCheckpoint.player, actor, why);
      assert.equal(actual.fogCheckpoint.historyLength, historyLength, why);
      assert.deepEqual(actual.fogCheckpoint.before, input, `${why} Complete reversible pre-card snapshot`);
    } else {
      assert.equal(actual.cardResponse, undefined, why);
      assert.equal(actual.fogCheckpoint, undefined, why);
    }
    if (action.type === 'move' || action.type === 'playCard' && !old.turn.moveMade) {
      assert.ok(actual.chaosCheckpoint, why);
      const movement = movesBefore.flatMap(p => {
        const after = expected.pieces.find(q => q.id === p.id)!;
        return p.square === after.square && p.zone === after.zone ? []
          : [`${p.id}:${p.square ?? p.zone}:${after.square ?? after.zone}`];
      }).sort().join('|');
      assert.equal(actual.chaosCheckpoint.movement, movement, why);
      assert.equal(actual.chaosCheckpoint.historyLength, historyLength, why);
      assert.deepEqual(actual.chaosCheckpoint.card, card, why);
      assert.deepEqual(actual.chaosCheckpoint.before, input, `${why} Complete reversible pre-move snapshot`);
    } else assert.equal(actual.chaosCheckpoint, undefined, why);
    const lost = expected.pieces.filter(p => p.zone === 'captured' && old.pieces.find(q => q.id === p.id)!.zone === 'board');
    assert.deepEqual(actual.legacyCapture, lost.length ? { historyLength, pieceIds: lost.map(p => p.id) } : undefined, why);
  }
  assert.equal(actual.fen, '1bn2b2/1p1kppp1/p7/3P3R/4p3/p3Q3/2B5/1R2K3 b - - 0 28');
});
