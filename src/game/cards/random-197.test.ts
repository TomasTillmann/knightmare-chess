import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyAction, isKingInCheck, legalDests, underElfHillReturnSquares } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardMove, Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Each numbered row was reviewed in order against rules.md, cards.md and the
// seven physical card images. Commands and explanations are hand-authored;
// generated hashes and generated piece deltas are not the semantic oracle.
const rationales = `
1 c2c3 | White Pawn advances one empty square.
2 end | Close White's quiet move; reset allowances for Black.
3 e7e6 | Black Pawn advances one empty square.
4 end | Close Black's quiet move; White starts.
5 a2a3 | White Pawn advances one empty square.
6 end | Close White's quiet move; Black starts.
7 d8g5 | Queen traverses empty e7 and f6 diagonally.
8 end | Close Black's Queen move; White starts.
9 e2e3 | White Pawn advances one empty square.
10 end | Close White's Pawn move; Black starts.
11 g5f5 | Queen moves one horizontal square.
12 end | Close Black's Queen move; White starts.
13 g1e2 | Knight jumps to the vacated e2 square.
14 end | Close White's Knight move; Black starts.
15 f7f6 | Black Pawn advances one empty square.
16 end | Close Black's Pawn move; White starts.
17 d1a4 | Queen traverses empty c2 and b3 diagonally.
18 end | Close White's Queen move; Black starts.
19 f5d3 | Queen traverses empty e4 diagonally.
20 end | Close Black's Queen move; White starts.
21 e2g3 | Knight makes its ordinary two-by-one jump.
22 end | Close White's Knight move; Black starts.
23 d3g6 | Queen traverses empty e4 and f5 diagonally.
24 end | Close Black's Queen move; White starts.
25 a1a2 | Rook moves to vacant a2; White loses queenside castling.
26 end | Close White's Rook move; Black starts.
27 g6h5 | Queen moves one diagonal square.
28 end | Close Black's Queen move; White starts.
29 a4g4 | Queen crosses vacant b4 through f4 horizontally.
30 end | Close White's Queen move; Black starts.
31 e8f7 | King steps to safe f7; Black loses both castling rights.
32 end | Close Black's King move; White starts.
33 d2d4 | Pawn crosses vacant d3; d3 EP opportunity has no Black captor.
34 end | Black receives the EP opportunity; FEN omits uncapturable d3.
35 h5h3 | Queen crosses vacant h4; unused EP opportunity expires.
36 end | Close Black's Queen move; White starts.
37 a3a4 | White Pawn advances one empty square.
38 end | Close White's Pawn move; Black starts.
39 e6e5 | Black Pawn advances one empty square.
40 end | Close Black's Pawn move; White starts.
41 c1d2 | Bishop moves one diagonal square to vacated d2.
42 end | Close White's Bishop move; Black starts.
43 f8b4 | Bishop crosses empty e7,d6,c5 diagonally.
44 end | Close Black's Bishop move, making Bishop the copied kind.
45 doppelganger | White hand-2 copies the just-moved Bishop: f1-e2-d3-c4 is clear, noncapturing; check on f7 has e8 escape. Spend and draw Breakthrough.
46 end | Replacement move completed; reset allowances for Black's check response.
47 f7e8 | King leaves c4 Bishop's diagonal for safe e8.
48 end | Close Black's check escape; White starts.
49 e1e2 | King steps to safe e2; White loses remaining castling right.
50 end | Close White's King move; Black starts.
51 h3h6 | Queen crosses vacant h4,h5 vertically.
52 end | Close Black's Queen move; White starts.
53 under-elf-hill | White hand-1 removes its e2 King to away, without capture, instead of moving. Spend and draw Bombard; schedule next-turn return.
54 end | Black starts while White's King remains away.
55 h6g5 | Queen moves diagonally; absent White King cannot be checked.
56 end | White starts with mandatory safe edge return before other actions.
57 return | Return the same White King at empty safe edge d1, free of cost; it cannot move or capture this turn.
58 c4f1 | Bishop traverses empty d3,e2; returned King stays d1.
59 end | End White's turn and expire its returned King's movement restriction.
60 long-jump | Black hand-2 moves original g8 Knight to empty b6 of opposite color. Spend and draw Annexation; one replacement move.
61 end | Close Black's Long Jump; White starts.
62 g4d7 | Queen crosses vacant f5,e6 and captures Black d7 Pawn, checking e8 King; c8 Bishop can capture it.
63 end | Black receives the checked position and may answer normally.
64 c8d7 | Bishop captures checking White Queen on d7, curing check.
65 end | Close Black's check escape; White starts.
66 a2a1 | Rook returns one square without restoring castling.
67 end | Close White's Rook move; Black starts.
68 g5f4 | Queen moves one diagonal square.
69 end | Close Black's Queen move; White starts.
70 g3e2 | Knight makes its ordinary two-by-one jump.
71 end | Close White's Knight move; Black starts.
72 h7h6 | Black Pawn advances to empty h6.
73 end | Close Black's Pawn move; White starts.
74 bombard | White deck-1 moves h1 Rook over exactly h2 Pawn through h3,h4,h5 to capture h6 Pawn. Spend and draw Fortification.
75 end | Close White's replacement capture; Black starts.
76 g7h6 | Black Pawn captures White Rook one forward diagonal square.
77 end | Close Black's capture; White starts.
78 f2f3 | White Pawn advances one empty square.
79 end | Close White's Pawn move; Black starts.
80 b4e7 | Bishop traverses vacant c5,d6 diagonally.
81 end | Close Black's Bishop move; White starts.
82 a1a2 | Rook moves to empty a2.
83 end | Close White's Rook move; Black starts.
84 b8c6 | Knight makes its ordinary two-by-one jump.
85 end | Close Black's Knight move; White starts.
86 breakthrough | White deck-0 makes f3 Pawn capture Black Queen directly forward on f4. Spend and draw Chaos; replacement move resets halfmove clock.
87 end | Close White's replacement capture; Black starts.
88 e7b4 | Bishop traverses vacant d6,c5 diagonally.
89 end | Close Black's Bishop move; White starts.
90 d4d5 | White Pawn advances one empty square.
91 end | Close White's Pawn move; Black starts.
92 e8f7 | King steps diagonally onto safe f7.
93 end | Close Black's King move; White starts.
94 annexation | White hand-3 moves g2-g4 and h2-h4 simultaneously over vacant g3,h3. Both original starting Pawns grant EP, neither has an opposing captor. Spend and draw Forced March.
95 end | Black receives both EP opportunities; FEN has no legal EP target.
96 a8g8 | Rook crosses empty b8,c8,d8,e8,f8; both unused EP rights expire.
97 end | Close Black's Rook move; White starts.
98 d1c2 | King steps diagonally to safe empty c2.
99 end | Close White's King move; Black starts.
100 g8a8 | Rook crosses empty f8,e8,d8,c8,b8.
101 end | Close Black's Rook move; White starts.
102 e2g1 | Knight makes its ordinary two-by-one jump.
103 end | Close White's Knight move; Black starts.
104 b6a4 | Knight captures White a-Pawn with its ordinary jump.
105 truce | Black hand-1 is played after its capture, retained beside board, draws Tournament; prior moved identity and capture flag stay. Neither raw King is checked.
106 end | White starts with Truce active and fresh allowances.
107 g1e2 | Quiet Knight jump; neither raw King is checked, so Truce persists.
108 end | Black starts; Truce remains active.
109 h6h5 | Quiet Black Pawn step; neither raw King is checked.
110 end | White starts; Truce remains active.
111 b2b3 | Quiet White Pawn step; neither raw King is checked.
112 end | Black starts; Truce remains active.
113 f7g7 | Quiet King step to safe g7; neither raw King is checked.
114 end | White starts with Truce active; fifty Regular Move commands and all seven cards are resolved.
`.trim().split('\n');

const cardActions: Record<number, GameAction> = {
  45: { type: 'playCard', cardId: 'doppelganger', cardInstanceId: 'white-hand-2-doppelganger', target: [{ from: 'f1', to: 'c4' }] },
  53: { type: 'playCard', cardId: 'under-elf-hill', cardInstanceId: 'white-hand-1-under-elf-hill' },
  60: { type: 'playCard', cardId: 'long-jump', cardInstanceId: 'black-hand-2-long-jump', target: [{ from: 'g8', to: 'b6' }] },
  74: { type: 'playCard', cardId: 'bombard', cardInstanceId: 'white-deck-1-bombard', target: [{ from: 'h1', to: 'h6' }] },
  86: { type: 'playCard', cardId: 'breakthrough', cardInstanceId: 'white-deck-0-breakthrough', target: [{ from: 'f3', to: 'f4' }] },
  94: { type: 'playCard', cardId: 'annexation', cardInstanceId: 'white-hand-3-annexation', target: [{ from: 'g2', to: 'g4' }, { from: 'h2', to: 'h4' }] },
  105: { type: 'playCard', cardId: 'truce', cardInstanceId: 'black-hand-1-truce' },
};
const other = (color: Color): Color => color === 'white' ? 'black' : 'white';
const square = (value: string): SquareName => { assert.match(value, /^[a-h][1-8]$/); return value as SquareName; };
const xy = (value: string): [number, number] => [value.charCodeAt(0) - 97, Number(value[1]) - 1];
const at = (pieces: PieceState[], value: string) => pieces.find(piece => piece.zone === 'board' && piece.square === value);

function path(from: string, to: string): string[] {
  const [x, y] = xy(from), [u, v] = xy(to);
  assert.ok(x === u || y === v || Math.abs(x - u) === Math.abs(y - v));
  const count = Math.max(Math.abs(x - u), Math.abs(y - v));
  return Array.from({ length: count - 1 }, (_, i) => `${String.fromCharCode(97 + x + Math.sign(u - x) * (i + 1))}${y + 1 + Math.sign(v - y) * (i + 1)}`);
}

function attacks(pieces: PieceState[], piece: PieceState, to: string): boolean {
  if (!piece.square || piece.zone !== 'board') return false;
  const [x, y] = xy(piece.square), [u, v] = xy(to), dx = Math.abs(u - x), dy = Math.abs(v - y);
  if (!dx && !dy) return false;
  if (piece.role === 'pawn') return dx === 1 && v - y === (piece.owner === 'white' ? 1 : -1);
  if (piece.role === 'knight') return dx * dy === 2;
  if (piece.role === 'king') return Math.max(dx, dy) === 1;
  const aligned = piece.role === 'bishop' ? dx === dy : piece.role === 'rook' ? !dx || !dy : !dx || !dy || dx === dy;
  return aligned && path(piece.square, to).every(item => !at(pieces, item));
}

function rawCheck(pieces: PieceState[], color: Color, lockedKing = false): boolean {
  const king = pieces.find(piece => piece.royal && piece.owner === color && piece.zone === 'board');
  return !!king?.square && pieces.some(piece => piece.owner !== color
    && !(lockedKing && piece.id === 'white-king-e1') && attacks(pieces, piece, king.square!));
}

function boardField(pieces: PieceState[]): string {
  const letters = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => {
    const piece = at(pieces, `${String.fromCharCode(97 + j)}${8 - i}`);
    return piece ? piece.owner === 'white' ? letters[piece.role].toUpperCase() : letters[piece.role] : '1';
  }).join('').replace(/1+/g, run => String(run.length))).join('/');
}

function immutableApply(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state), payload = structuredClone(action);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'complete GameState input is immutable');
  assert.deepEqual(action, payload, 'GameAction payload is immutable');
  assert.ok(result.ok, JSON.stringify(action));
  return result.state;
}

test('iteration 197: independently reviewed physical, card, history, FEN, royal and obligation oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/197.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.steps.length, 114);
  assert.equal(rationales.length, trace.steps.length);
  let state = createGameState(trace.initial);
  // Initial public constructor is checked against the ordinary starting layout;
  // all subsequent expected values evolve without reading reducer results.
  const pieces = structuredClone(state.pieces);
  assert.equal(boardField(pieces), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
  for (const piece of pieces) assert.deepEqual(piece, {
    id: `${piece.owner}-${piece.role}-${piece.square}`, owner: piece.owner, role: piece.role,
    originalRole: piece.role, square: piece.square, zone: 'board', promoted: false,
    royal: piece.role === 'king', neutral: false,
  });
  const players = structuredClone(state.players);
  const history: GameEvent[] = [];
  let turn: GameState['turn'] = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
  let effects: unknown[] = [], ep: GameState['enPassant'] = [], elf: NonNullable<GameState['underElfHill']> = [];
  let shield: GameState['shieldMove'];
  let rights = 'KQkq', fenTurn = 'w', half = 0, full = 1;
  let moves = 0, cards = 0;

  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, [number, command] = rationales[index]!.split(' ');
    assert.equal(Number(number), n);
    const expectedAction: GameAction = cardActions[n] ?? (command === 'end' ? { type: 'endTurn' }
      : command === 'return' ? { type: 'returnKing', to: 'd1' }
      : { type: 'move', from: command!.slice(0, 2), to: command!.slice(2) });
    assert.deepEqual(step.action, expectedAction, rationales[index]);
    const action = step.action, actor = turn.color;
    const prePieces = structuredClone(pieces);
    let movement: CardMove[] = [], captured: string[] = [], moved: string[] = [];
    let moveConsumesTurn = false, pawnMoved = false;
    const relocate = (from: string, to: string, geometry: 'normal' | 'long-jump' | 'bombard' | 'breakthrough' | 'annexation') => {
      const mover = at(pieces, from), victim = at(pieces, to);
      assert.ok(mover, `${n}: physical mover exists`);
      assert.equal(mover.owner, actor);
      assert.ok(!victim || victim.owner !== actor && !victim.royal);
      const [x, y] = xy(from), [u, v] = xy(to), direction = actor === 'white' ? 1 : -1;
      if (geometry === 'long-jump') {
        assert.equal(mover.originalRole, 'knight'); assert.ok(!victim); assert.notEqual((x + y) % 2, (u + v) % 2);
      } else if (geometry === 'bombard') {
        assert.equal(mover.role, 'rook'); assert.ok(x === u || y === v);
        assert.deepEqual(path(from, to).filter(item => at(prePieces, item)), ['h2']);
      } else if (geometry === 'breakthrough') {
        assert.equal(mover.role, 'pawn'); assert.ok(victim); assert.equal(x, u); assert.equal(v - y, direction);
      } else if (geometry === 'annexation') {
        assert.equal(mover.role, 'pawn'); assert.equal(x, u); assert.equal(v - y, 2 * direction);
        assert.ok(!at(prePieces, to)); assert.ok(path(from, to).every(item => !at(prePieces, item)));
      } else if (mover.role === 'pawn') {
        if (victim) assert.ok(attacks(pieces, mover, to));
        else { assert.equal(x, u); assert.ok(v - y === direction || v - y === 2 * direction && (actor === 'white' ? y <= 1 : y >= 6)); assert.ok(path(from, to).every(item => !at(pieces, item))); }
      } else assert.ok(attacks(pieces, mover, to), `${n}: ordinary piece geometry and path`);
      if (effects.length) assert.ok(!victim, 'Truce forbids every capture');
      if (elf.some(entry => entry.returned)) assert.notEqual(mover.id, 'white-king-e1');
      if (victim) { captured.push(victim.id); victim.square = null; victim.zone = 'captured'; victim.capturedBy = actor; }
      moved.push(mover.id); pawnMoved ||= mover.role === 'pawn';
      mover.square = square(to);
      if (mover.royal) rights = rights.replace(actor === 'white' ? /[KQ]/g : /[kq]/g, '');
      if (mover.id === 'white-rook-a1') rights = rights.replace('Q', '');
      if (mover.id === 'white-rook-h1') rights = rights.replace('K', '');
      if (mover.id === 'black-rook-a8') rights = rights.replace('q', '');
      if (mover.id === 'black-rook-h8') rights = rights.replace('k', '');
    };

    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.equal(turn.moveMade, false); assert.equal(turn.phase, 'beforeMove');
      assert.equal(action.promotion, undefined);
      ep = [];
      const mover = at(pieces, from)!;
      if (mover.role === 'pawn' && Math.abs(Number(from[1]) - Number(to[1])) === 2) {
        ep.push({ target: square(`${from[0]}${(Number(from[1]) + Number(to[1])) / 2}`), pawnId: mover.id });
      }
      relocate(from, to, 'normal');
      history.push({ type: 'move', from: square(from), to: square(to), ...(captured[0] ? { capturedId: captured[0] } : {}) });
      moveConsumesTurn = true; moves++;
    } else if (action.type === 'playCard') {
      cards++;
      assert.equal(turn.cardPlays[actor], 0);
      const player = players[actor], found = player.hand.findIndex(card => card.id === action.cardInstanceId);
      assert.ok(found >= 0, `${n}: exact physical card is held by actor`);
      const card = player.hand[found]!; assert.equal(card.cardId, action.cardId);
      assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(turn.phase));
      assert.equal(turn.moveMade, action.cardId === 'truce');
      player.hand.splice(found, 1);
      if (card.cardId === 'truce') effects = [{ type: 'truce', owner: actor, card: structuredClone(card) }];
      else player.discard.push(card);
      const drawn = player.deck.shift(); assert.ok(drawn); player.hand.push(drawn);
      assert.equal(drawn.cardId, ({ 45: 'breakthrough', 53: 'bombard', 60: 'annexation', 74: 'fortification', 86: 'chaos', 94: 'forced-march', 105: 'tournament' } as Record<number, string>)[n]);
      turn.cardPlays[actor]++;
      if (card.cardId === 'under-elf-hill') {
        const king = at(pieces, 'e2')!; assert.equal(king.id, 'white-king-e1');
        king.square = null; king.zone = 'away';
        elf = [{ pieceId: king.id, player: actor, returning: false }];
        rights = rights.replace(/[KQ]/g, ''); ep = []; moveConsumesTurn = true;
      } else if (card.cardId !== 'truce') {
        movement = structuredClone(action.target as CardMove[]);
        ep = [];
        if (card.cardId === 'doppelganger') {
          assert.deepEqual(history[history.length - 1], { type: 'move', from: 'f8', to: 'b4' });
          assert.equal(at(pieces, 'b4')!.role, 'bishop');
          assert.ok(!at(pieces, 'c4'));
        }
        for (const { from, to } of movement) {
          if (card.cardId === 'annexation') ep.push({ target: square(`${from[0]}3`), pawnId: at(prePieces, from)!.id });
          relocate(from, to, card.cardId === 'doppelganger' ? 'normal' : card.cardId as 'long-jump' | 'bombard' | 'breakthrough' | 'annexation');
        }
        moveConsumesTurn = true;
      }
      history.push({ type: 'cardPlayed', cardId: card.cardId,
        ...(action.target !== undefined ? { target: structuredClone(action.target) as CardMove[] } : {}),
        movement, preservePreviousMove: card.cardId === 'truce',
        ...(captured[0] ? { capturedId: captured[0] } : {}),
        ...(card.cardId === 'bombard' ? { capturedIds: captured } : {}),
      });
    } else if (action.type === 'returnKing') {
      assert.equal(n, 57); assert.deepEqual(elf, [{ pieceId: 'white-king-e1', player: 'white', returning: true }]);
      assert.ok(!at(pieces, 'd1')); const king = pieces.find(piece => piece.id === 'white-king-e1')!;
      king.square = 'd1'; king.zone = 'board'; elf[0]!.returned = true;
      assert.equal(rawCheck(pieces, 'white'), false);
      const saved = structuredClone(state);
      assert.ok(underElfHillReturnSquares(state).includes('d1')); assert.deepEqual(state, saved);
    } else {
      assert.equal(action.type, 'endTurn'); assert.equal(turn.moveMade, true);
      assert.equal(rawCheck(pieces, actor, !!elf.some(entry => entry.returned)), false);
      turn = { color: other(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      shield = undefined;
      elf = elf.filter(entry => !entry.returned).map(entry => ({ ...entry, returning: entry.player === turn.color }));
    }

    if (moveConsumesTurn) {
      turn.moveMade = true; turn.phase = 'afterMove'; fenTurn = actor === 'white' ? 'b' : 'w';
      half = pawnMoved || captured.length ? 0 : half + 1; if (actor === 'black') full++;
      shield = { player: actor, pieceIds: moved, capturedOpponent: captured.length > 0 };
      assert.equal(rawCheck(pieces, actor, !!elf.some(entry => entry.returned)), false, `${n}: acting royal safety`);
    }
    // Only Doppelganger gives check directly. Independently stage a legal King
    // reply to prove the regular card does not directly mate (§11.1).
    if (action.type === 'playCard' && rawCheck(pieces, other(actor))) {
      assert.equal(n, 45); const reply = structuredClone(pieces), king = at(reply, 'f7')!;
      assert.ok(!at(reply, 'e8')); assert.ok(attacks(reply, king, 'e8')); king.square = 'e8';
      assert.equal(rawCheck(reply, 'black'), false);
    }
    const expectedFen = `${boardField(pieces)} ${fenTurn} ${rights || '-'} - ${half} ${full}`;
    state = immutableApply(state, action);
    assert.deepEqual(state.pieces, pieces, `${n}: all physical identities, zones and capture actors`);
    assert.deepEqual(state.players, players, `${n}: exact hands/decks/discards`);
    assert.deepEqual(state.history, history, `${n}: complete ordered history`);
    assert.deepEqual(state.turn, turn, `${n}: turn and both allowances`);
    assert.equal(state.fen, expectedFen, `${n}: all six FEN fields`);
    assert.equal(state.orientation, 0);
    assert.deepEqual(state.effects, effects);
    assert.deepEqual(state.enPassant, ep);
    assert.deepEqual(state.underElfHill ?? [], elf);
    assert.equal(state.pendingRescue ?? null, null);
    assert.equal(state.pendingAbduction ?? null, null);
    assert.equal(state.pendingDoomsayer ?? null, null);
    assert.equal(state.outcome, null);
    assert.equal(state.chaosForbidden, undefined);
    assert.equal(state.plotsExecution, undefined);
    assert.deepEqual(state.plotsAllowances ?? [], []);
    assert.deepEqual(state.fogLocked ?? [], []);
    assert.deepEqual(state.riposteLostMoves ?? [], []);
    assert.equal(state.riposteSkipped, undefined);
    assert.equal(state.riposteCheckDeferred, undefined);
    assert.deepEqual(state.shieldMove, shield, `${n}: complete moved identities and capture flag`);
    const saved = structuredClone(state);
    for (const color of ['white', 'black'] as const) {
      const checked = rawCheck(pieces, color, !!elf.some(entry => entry.returned));
      if (effects.length) assert.equal(checked, false, `${n}: raw check would terminate Truce`);
      assert.equal(isKingInCheck(state, color), checked, `${n}: independent ${color} royal threat`);
    }
    assert.deepEqual(state, saved, `${n}: royal queries are immutable`);
    // The only EP rights here are d3, g3 and h3. Inspect prospective captors,
    // independently from the serialized target and current reaction-window actor.
    if (ep.length) {
      const captor = fenTurn === 'w' ? 'white' : 'black';
      const prospective = structuredClone(state);
      prospective.turn = { color: captor, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      const original = structuredClone(prospective), dests = legalDests(prospective, false);
      for (const opportunity of ep) {
        const candidates = pieces.filter(piece => piece.owner === captor && piece.role === 'pawn' && attacks(pieces, piece, opportunity.target));
        assert.deepEqual(candidates, [], `${n}: no Pawn has EP geometry`);
        for (const piece of pieces.filter(item => item.owner === captor && item.role === 'pawn' && item.square)) {
          assert.equal(dests.get(piece.square!)?.includes(opportunity.target) ?? false, false);
        }
      }
      assert.deepEqual(prospective, original, 'EP query is immutable');
    }
    if (n === 56) {
      const blocked = { type: 'move', from: 'c4', to: 'f1' } as const;
      const before = structuredClone(state), payload = structuredClone(blocked), result = applyAction(state, blocked);
      assert.equal(result.ok, false, 'mandatory return precedes optional movement');
      assert.deepEqual(state, before); assert.deepEqual(blocked, payload);
    }
    if (n === 57) {
      const blocked = { type: 'move', from: 'd1', to: 'e1' } as const;
      const before = structuredClone(state), payload = structuredClone(blocked), result = applyAction(state, blocked);
      assert.equal(result.ok, false, 'returned King cannot move on its return turn');
      assert.deepEqual(state, before); assert.deepEqual(blocked, payload);
    }
  }
  assert.equal(moves, 50); assert.equal(cards, 7);
  assert.equal(state.fen, 'r6r/pppb2k1/2n2p2/3Pp2p/nb3PPP/1PP1P3/R1KBN3/1N3B2 w - - 1 29');
  assert.equal(replayTrace(trace).fen, state.fen);
});
