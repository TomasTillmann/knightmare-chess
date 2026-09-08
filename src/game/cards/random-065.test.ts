import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independently read every row, rules §§8–13, 17–18, 20, 22, and all eleven
// played cards' catalog metadata and final_cards artwork. No hash is a rule oracle.
const rationales = [
  '1. c2-c4 crosses empty c3 to empty c4; pawn clock resets, c3 en-passant identity created, both Kings safe.',
  '2. White closes its completed safe move; Black starts, hands and c3 opportunity stay unchanged.',
  '3. Black Annexation moves c7-c5 and e7-e5 through empty c6/e6 simultaneously; replaces move, two en-passant victims, draw Holy War.',
  '4. Black closes Annexation; White receives the move and both c6/e6 opportunities with fresh allowances.',
  '5. Qd1-b3 passes vacant c2; quiet diagonal clears Annexation opportunities, clock becomes 1.',
  '6. White closes Qb3; unchanged position and hands, Black starts.',
  '7. a7-a5 crosses vacant a6; no King exposure, pawn clock resets and a6 becomes available.',
  '8. Black closes a5, retaining its reply en-passant window and advancing only turn phase.',
  '9. Qb3-g3 crosses empty c3,d3,e3,f3; no capture or check exposure, a6 expires.',
  '10. White closes Qg3; Black receives fresh allowances without a draw.',
  '11. b7-b5 crosses empty b6; pawn clock resets, b6 tracks the physical b7 Pawn.',
  '12. Black closes b5; White starts and may use the b6 opportunity.',
  '13. b2-b3 is a quiet forward Pawn move; old en-passant expires and neither King is exposed.',
  '14. White closes b3; unchanged cards and board, Black starts.',
  '15. Bc8-a6 crosses vacated b7 to empty a6; b5 Pawn blocks its southeast diagonal, both Kings safe.',
  '16. Black closes Ba6; White starts with no pending choice.',
  '17. Nb1-c3 is a normal empty-destination Knight jump; no capture, clock 2.',
  '18. White closes Nc3; Black starts without changing pieces or decks.',
  '19. Ra8-a7 enters its vacated pawn square; black queenside castling right is permanently revoked.',
  '20. Black closes Ra7; White starts, KQk rights and clocks preserved.',
  '21. Nc3xb5 is an L-jump capturing black-pawn-b7; identity goes captured, clock resets, not dead.',
  '22. White closes Nxb5; Black starts with the b7 Pawn still captured.',
  '23. f7-f6 is an unobstructed Pawn push; Black ends the move safe and fullmove advances to 7.',
  '24. White Think Again immediately undoes f7-f6, restores clock/fullmove and Black move; spends reaction, draws Siege, forbids repeating f7-f6.',
  '25. Ra7-a8 is a different legal replacement; queenside castling stays revoked and White reaction allowance remains spent.',
  '26. Black closes replacement Ra8; both allowances reset for White next turn.',
  '27. Qg3-f3 is one quiet orthogonal step; neither King is exposed.',
  '28. White closes Qf3; unchanged board and cards, Black starts.',
  '29. g7-g5 crosses empty g6, resets pawn clock, and creates g6 en-passant opportunity.',
  '30. Black closes g5; White starts with g6 availability intact.',
  '31. d2-d4 crosses empty d3; Ba6 is blocked by Nb5, so White King remains safe; d3 replaces g6 opportunity.',
  '32. White closes d4; Black starts with d3 availability and unchanged cards.',
  '33. Qd8-b6 crosses vacated c7; quiet diagonal does not expose Ke8, d3 opportunity expires.',
  '34. Black closes Qb6; White starts, clock stays 1 and fullmove 9.',
  '35. Bc1-b2 enters an empty diagonal square and leaves White King safe.',
  '36. Black Knightmare immediately restores Bc1 and clock 1; White must choose a different move, Black spends reaction and draws Ghostwalk.',
  '37. Qf3-f5 crosses vacant f4 and differs from canceled bishop move; Black Ke8 is not checked through its blockers.',
  '38. White Fatal Attraction marks its Rh1 after moving; retains card, draws Merciless, freezes Ng1/Pg2/Ph2, preserves board/clocks.',
  '39. White closes its move and marker; Black starts with allowances reset and permanent magnet retained.',
  '40. Ng8-f6 is a legal jump far from the h1 magnet; neither King is exposed.',
  '41. Black Rebirth returns enemy white-pawn-d2 from d4 to empty starting square d2; no capture, keeps clocks, draws Heresy.',
  '42. Black closes Rebirth; White starts while h1 magnet and all physical identities persist.',
  '43. Qf5-f3 crosses empty f4; neither endpoint is frozen, quiet clock becomes 4.',
  '44. White closes Qf3; Black starts without drawing or changing the magnet.',
  '45. Qb6-c7 is a quiet diagonal step; black King remains screened and White King safe.',
  '46. Black closes Qc7; White starts with clock 5 unchanged.',
  '47. Qf3-g3 is a quiet step; g3 is outside the h1 magnet neighborhood.',
  '48. White Holy Quest swaps opposing Bf8/Nf6 identities, no capture or move consumption; no direct mate or own check, draws Hidden Passage.',
  '49. White closes Holy Quest; Black starts with exchanged identities and retained magnet.',
  '50. The original g8 Knight now jumps f8-e6; ordinary empty-destination L-move, clock 7.',
  '51. Black closes Ne6; White starts with unchanged physical identities and cards.',
  '52. Qg3xg5 crosses empty g4, captures physical g7 Pawn, and resets clock; g3 was not frozen.',
  '53. White closes Qxg5; Black starts, captured g7 Pawn stays off board.',
  '54. h7-h5 crosses empty h6; pawn push creates h6 opportunity, clock 0/fullmove 13.',
  '55. Black closes h5; White starts with h6 availability, no card changes.',
  '56. Qg5-h6 is a quiet diagonal, not en passant: only a Pawn can use that capture; h5 Pawn stays put.',
  '57. White closes Qh6; Black starts, old en-passant opportunity is gone.',
  '58. h5-h4 is a quiet downward Pawn step, outside h1 magnet range; clock resets.',
  '59. Black Holy War swaps own Nb8/Ba6, preserving identity and clocks; no new King check, draws Challenge.',
  '60. Black closes the swap; White begins with only h1 magnet active.',
  '61. Hidden Passage moves White Ke1 to vacant f5; Ne6 does not attack f5 and bishop/queen lines are blocked; consumes move, revokes KQ, draws Man of Straw.',
  '62. White closes safe Kf5 relocation; Black starts, clock 1 and only k castling right remains.',
  '63. Ne6-f4 is a legal quiet jump; does not attack Kf5 or expose Ke8.',
  '64. Black closes Nf4; White starts, no pending obligation.',
  '65. Nb5xc7 captures black Queen by L-jump and checks Ke8; White Kf5 stays safe, Queen identity captured.',
  '66. White may close a checking move; Black gets its escape turn with Nc7 checking Ke8.',
  '67. Bb8-a7 leaves Black checked by Nc7, so only a provisional move is allowed pending an after-move rescue under §11.6.',
  '68. Black Challenge names movable enemy Pd2; §11.7 suppresses Nc7 capture/check on White next move, curing pending rescue; card spent, Tournament drawn.',
  '69. Black closes with Challenge suppressing Nc7; White must move Pd2 or forfeit, fresh allowances.',
  '70. Returned Pd2 may again move two squares (§13.1); d3/d4 empty, fulfills Challenge and restores Nc7 check for Black next turn; d3 en-passant created.',
  '71. White closes d4 and its fulfilled Challenge; Black receives the checked escape turn.',
  '72. c5xd4 captures the d2 Pawn but leaves Nc7 checking Ke8; provisional capture requires a same-turn rescue.',
  '73. Peace Talks cannot cure Nc7 check by removing the distant h1 magnet: fizzle spends/draws Merciless and rolls back the unsaved capture, restoring c5/d4 and d3 opportunity.',
  '74. Na6xc7 is the legal replacement that captures the checking white Knight; capture resets clock and expires d3 availability.',
  '75. Black closes its safe capture; White starts, Black Peace Talks expenditure persists.',
  '76. Bc1xf4 travels through empty d2/e3 to capture black original g8 Knight; Kf5 remains safe.',
  '77. White closes Bxf4; Black starts, captured Knight stays captured and magnet persists.',
  '78. d7-d6 advances a Pawn into empty d6, with no King exposure; fullmove becomes 18.',
  '79. Black closes d6; White starts, unchanged cards and clock.',
  '80. e2-e3 enters empty e3; h1 magnet does not reach e2, no capture or King exposure.',
  '81. White closes e3; Black starts, unchanged effects and cards.',
  '82. e5-e4 is an empty Pawn push; vacating e5 does not expose Ke8 or check Kf5.',
  '83. Black closes e4; White starts safely with clocks unchanged.',
  '84. d4-d5 is a quiet Pawn push to empty d5, no promotion; White King remains safe.',
  '85. White closes d5; Black starts with no en-passant right.',
  '86. Nc7xd5 captures white-pawn-d2 by L-jump; preserves Knight identity, clock resets.',
  '87. Black closes Nxd5; White may use a before-move return card for the captured Pawn.',
  '88. Winged Victory places captured white-pawn-d2 on vacant central d4, same identity, consumes White move, clock 0, draws Charge.',
  '89. White closes the return; Black starts without another draw or move.',
  '90. Ba7-b8 is an empty diagonal step; Ke8 stays safe and d6 blocks the bishop diagonal toward Kf5.',
  '91. Black closes Bb8; White starts with unchanged marker and hands.',
  '92. Ra1-b1 is a quiet orthogonal step outside the magnet; White castling already revoked, clock 2.',
  '93. White closes Rb1; Black starts, no card expenditure or extra clock advance.',
  '94. Bb8-a7 reverses the earlier quiet bishop move legally; no active repeat prohibition remains.',
  '95. Black closes Ba7; White starts with no pending choice.',
  '96. Bf1-d3 crosses empty e2; f1 is two files from Rh1 and therefore not frozen.',
  '97. White closes Bd3; Black starts with clock 4 and magnet unchanged.',
  '98. Rh8-h7 enters empty h7 and revokes the last black castling right; no King exposure.',
  '99. Black closes Rh7; White starts, all castling rights remain absent.',
  '100. Qh6-g7 is an empty diagonal step; f7 Pawn blocks its rank toward the black King area.',
  '101. White closes Qg7; Black starts with its Rook able to capture that Queen.',
  '102. Nd5-c7 is a quiet Knight jump; moving it leaves Ke8 safe, clock 7.',
  '103. Black closes Nc7; White starts without changing any cards.',
  '104. Bd3xe4 captures physical black-pawn-e7 in one diagonal step; no magnet restriction, clock resets.',
  '105. White closes Bxe4; Black starts, e7 Pawn remains captured.',
  '106. Rh7xg7 captures white Queen in one orthogonal step; Black King safe, no capture immunity, clock 0/fullmove 25.',
  '107. Black closes Rxg7; White starts, Queen remains captured and cards unchanged.',
  '108. Bf4-g5 is a quiet diagonal step, outside h1 magnet; white King at f5 remains safe.',
  '109. White closes Bg5; Black starts with clock 1 unchanged.',
  '110. Nc7-d5 is a quiet L-jump, legal again after earlier turns; Black King remains safe, clock 2/fullmove 26.',
  '111. Black closes regular move 50; White begins with no pending choices, Rh1 magnet retained and final board verified.',
];

test('iteration 065 independently reviewed deterministic campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/065.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860065);
  assert.equal(rationales.length, 111);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 11);
  const states: GameState[] = [createGameState(trace.initial)];
  const magnet = { type: 'fatal-attraction', owner: 'white', card: { id: 'white-hand-2-fatal-attraction', cardId: 'fatal-attraction' }, pieceId: 'white-rook-h1' };
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1;
    const why = rationales[index]!;
    assert.ok(why.startsWith(`${n}. `));
    const before = states[index]!;
    const result = applyAction(before, action);
    assert.ok(result.ok, why);
    const after = result.state;
    states.push(after);
    assert.equal(!!after.pendingRescue, n === 67 || n === 72, why);
    assert.equal(!!after.outcome, false, why);
    assert.equal(after.orientation, 0, why);
    assert.deepEqual(after.effects, n < 38 ? [] : n === 68 || n === 69
      ? [magnet, { type: 'challenge', owner: 'black', player: 'white', pieceId: 'white-pawn-d2' }]
      : [magnet], why);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const mover = before.pieces.find(piece => piece.square === action.from)!;
      const victim = before.pieces.find(piece => piece.square === action.to);
      assert.ok(mover && mover.owner === before.turn.color, why);
      assert.ok(!victim || victim.owner !== mover.owner && !victim.royal, why);
      assert.equal(action.promotion, undefined, why);
      if (n !== 67 && n !== 70 && n !== 72) {
        const chess = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
        assert.ok(chess.isLegal({ from: parseSquare(action.from)!, to: parseSquare(action.to)! }), why);
      } else if (n === 70) {
        assert.deepEqual([action.from, action.to], ['d2', 'd4'], why);
        assert.ok(!before.pieces.some(piece => piece.square === 'd3' || piece.square === 'd4'), why);
      } else {
        assert.equal(before.pieces.find(piece => piece.id === 'white-knight-b1')?.square, 'c7', why);
      }
      if (n > 38) assert.ok(!['g1', 'g2', 'h2'].includes(action.from), why);
      assert.deepEqual(after.pieces, before.pieces.map(piece => piece.id === mover.id
        ? { ...piece, square: action.to as SquareName }
        : piece.id === victim?.id ? { ...piece, square: null, zone: 'captured' } : piece), why);
      const oldFen = before.fen.split(' ');
      const newFen = after.fen.split(' ');
      assert.equal(Number(newFen[4]), mover.role === 'pawn' || victim ? 0 : Number(oldFen[4]) + 1, why);
      assert.equal(Number(newFen[5]), Number(oldFen[5]) + Number(mover.owner === 'black'), why);
      const doublePawn = mover.role === 'pawn' && Math.abs(Number(action.from[1]) - Number(action.to[1])) === 2;
      assert.deepEqual(after.enPassant, doublePawn
        ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`, pawnId: mover.id }] : [], why);
      assert.deepEqual(after.players, before.players, why);
      assert.deepEqual(after.turn, { ...before.turn, phase: 'afterMove', moveMade: true }, why);
    } else if (action.type === 'endTurn') {
      assert.deepEqual(after.pieces, before.pieces, why);
      assert.deepEqual(after.players, before.players, why);
      assert.equal(after.fen, before.fen, why);
      assert.deepEqual(after.enPassant, before.enPassant, why);
      assert.deepEqual(after.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }, why);
    } else {
      assert.equal(action.type, 'playCard', why);
      if (action.type !== 'playCard') continue;
      const owner = n === 24 ? 'white' : n === 36 ? 'black' : before.turn.color;
      const opponent = owner === 'white' ? 'black' : 'white';
      const player = before.players[owner];
      const card = player.hand.find(item => item.id === action.cardInstanceId)!;
      assert.ok(card, why);
      assert.deepEqual(after.players[owner].hand, [...player.hand.filter(item => item.id !== card.id), player.deck[0]], why);
      assert.deepEqual(after.players[owner].deck, player.deck.slice(1), why);
      assert.deepEqual(after.players[owner].discard, n === 38 ? player.discard : [...player.discard, card], why);
      assert.deepEqual(after.players[opponent], before.players[opponent], why);
      assert.equal(after.turn.cardPlays[owner], before.turn.cardPlays[owner] + 1, why);
      const relocations: Record<number, Record<string, SquareName>> = {
        3: { 'black-pawn-c7': 'c5', 'black-pawn-e7': 'e5' },
        41: { 'white-pawn-d2': 'd2' },
        48: { 'black-bishop-f8': 'f6', 'black-knight-g8': 'f8' },
        59: { 'black-knight-b8': 'a6', 'black-bishop-c8': 'b8' },
        61: { 'white-king-e1': 'f5' },
        88: { 'white-pawn-d2': 'd4' },
      };
      const rollback = n === 24 ? states[22] : n === 36 ? states[34] : n === 73 ? states[71] : undefined;
      if (rollback) {
        assert.deepEqual(after.pieces, rollback.pieces, why);
        assert.equal(after.fen, rollback.fen, why);
        assert.deepEqual(after.enPassant, rollback.enPassant, why);
        assert.equal(after.turn.moveMade, false, why);
        assert.equal(after.turn.phase, 'beforeMove', why);
      } else {
        assert.deepEqual(after.pieces, before.pieces.map(piece => relocations[n]?.[piece.id]
          ? { ...piece, square: relocations[n]![piece.id], zone: 'board' } : piece), why);
        if ([3, 61, 88].includes(n)) {
          assert.equal(after.turn.moveMade, true, why);
          assert.equal(after.turn.phase, 'afterMove', why);
          assert.equal(after.fen.split(' ')[1], opponent === 'white' ? 'w' : 'b', why);
          assert.equal(Number(after.fen.split(' ')[4]), n === 61 ? 1 : 0, why);
          assert.equal(Number(after.fen.split(' ')[5]), Number(before.fen.split(' ')[5]) + Number(owner === 'black'), why);
          assert.deepEqual(after.enPassant, n === 3 ? [{ target: 'c6', pawnId: 'black-pawn-c7' }, { target: 'e6', pawnId: 'black-pawn-e7' }] : [], why);
        } else {
          assert.deepEqual(after.fen.split(' ').slice(1), before.fen.split(' ').slice(1), why);
          assert.deepEqual(after.enPassant, before.enPassant, why);
        }
      }
    }
  }
  const final = states.at(-1)!;
  assert.equal(final.fen, 'r3k3/b4pr1/3p1b2/p1pn1KB1/2PPB2p/1P2P3/P4PPP/1R4NR w - - 2 26');
  assert.equal(final.pieces.filter(piece => piece.zone === 'captured').length, 7);
  assert.deepEqual(replayTrace(trace), final);
});
