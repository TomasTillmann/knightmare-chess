import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';

// Independently reviewed against rules §§11,14,17,18,19,20,22 and the seven
// physical cards KC5/3, KC12/3, KC17/3, KC16/3, KC8/4, KC15/4, KC3/3.
const rationales = [
  '1. Nb1-c3: ordinary two-by-one jump to a vacant square.',
  '2. End White turn after Nc3; no obligation remains.',
  '3. g7-g6: Black Pawn advances one vacant square.',
  '4. End Black turn after g6.',
  '5. b2-b3: White Pawn advances one vacant square.',
  '6. Figure Dance after b3: all four Rooks rotate a1-h1-h8-a8-a1 simultaneously; no capture, all castling rights expire.',
  '7. End White turn; the corner rotation retains the completed b3 move.',
  '8. d7-d6: Black Pawn advances one square.',
  '9. End Black turn after d6.',
  '10. e2-e3: White Pawn advances one square.',
  '11. End White turn after e3.',
  '12. Bc8-f5: diagonal through vacant d7 and e6.',
  '13. End Black turn after Bf5.',
  '14. Qd1-h5: diagonal through vacant e2, f3 and g4.',
  '15. End White turn after Qh5.',
  '16. d6-d5: Black Pawn advances one square.',
  '17. End Black turn after d5.',
  '18. Qh5-h3: file slide through vacant h4.',
  '19. End White turn after Qh3.',
  '20. Qd8-d6: file slide through vacant d7.',
  '21. End Black turn after Qd6.',
  '22. g2-g3: White Pawn advances one square.',
  '23. End White turn after g3.',
  '24. Ra1xa2: the rotated Black a8 Rook captures White a2 Pawn.',
  '25. End Black turn after Rxa2.',
  '26. d2-d4: two-square initial Pawn advance through vacant d3; d3 is tracked but no Black Pawn can capture en passant.',
  '27. End White turn preserving the d3 opportunity.',
  '28. Qd6-f4: diagonal through vacant e5; old en passant expires.',
  '29. End Black turn after Qf4.',
  '30. Bf1-a6: diagonal through vacant e2,d3,c4,b5.',
  '31. End White turn after Ba6.',
  '32. Qf4-f3: one-square file slide.',
  '33. End Black turn after Qf3.',
  '34. Rh8xg8: rotated White h1 Rook captures the original Black g8 Knight.',
  '35. End White turn after Rxg8.',
  '36. Tournament replaces Black move: Black b8 Knight and White c3 Knight exchange; non-move swap, no capture.',
  '37. End Black turn after the replacement; the non-move exchange supplies no moved identities.',
  '38. Rg8-g7: one-square file slide to the vacated Pawn square.',
  '39. End White turn after Rg7.',
  '40. Ke8-d8: adjacent vacant royal-safe square.',
  '41. End Black turn after Kd8.',
  '42. Bc1-d2: one-square diagonal.',
  '43. End White turn after Bd2.',
  '44. Bf5-d3: diagonal through vacant e4.',
  '45. End Black turn after Bd3.',
  '46. g3-g4: White Pawn advances one square.',
  '47. End White turn after g4.',
  '48. Kd8-c8: adjacent vacant royal-safe square.',
  '49. End Black turn after Kc8.',
  '50. Bd2xc3: White original c1 Bishop captures the exchanged Black b8 Knight.',
  '51. End White turn after Bxc3.',
  '52. h7-h6: Black Pawn advances one square.',
  '53. End Black turn after h6.',
  '54. Qh3-h4: adjacent vacant file square.',
  '55. End White turn after Qh4.',
  '56. Evil Eye replaces Black move: Qf3 legally threatens Rh1 through vacant g2; capture only the original White a1 Rook, Queen remains f3.',
  '57. End Black turn after stationary capture; no piece acquired a movement trigger.',
  '58. b3-b4: White Pawn advances one square.',
  '59. End White turn after b4.',
  '60. Qf3-f5: file slide through vacant f4.',
  '61. End Black turn after Qf5.',
  '62. c2xd3: White Pawn captures original Black c8 Bishop one forward diagonal.',
  '63. Black Plots Within Plots reacts after cxd3; two optional plays, but none of its four other held cards is legal in this move-only response window; drawn Pacifism is ineligible.',
  '64. End White turn declines the two optional Plots plays and expires their window.',
  '65. Ra2xf2: rank slide through b2,c2,d2,e2 captures White f2 Pawn.',
  '66. End Black turn after Rxf2.',
  '67. Bc3-b2: adjacent vacant diagonal.',
  '68. End White turn after Bb2.',
  '69. Qf5-e4: adjacent vacant diagonal.',
  '70. End Black turn after Qe4.',
  '71. Ke1-d1: adjacent vacant royal-safe square.',
  '72. End White turn after Kd1.',
  '73. f7-f6: Black Pawn advances one square.',
  '74. End Black turn after f6.',
  '75. Ng1-f3: ordinary two-by-one jump.',
  '76. End White turn after Nf3.',
  '77. Qe4xg4: rank slide through vacant f4 captures White g2 Pawn.',
  '78. End Black turn after Qxg4.',
  '79. Bb2-a1: adjacent vacant diagonal.',
  '80. End White turn after Ba1.',
  '81. Qg4-e6: diagonal through vacant f5.',
  '82. End Black turn after Qe6.',
  '83. Rg7-f7: adjacent vacant rank square.',
  '84. Panic after White Rf7: discard and draw Abduction, arm Black next-move 15000ms deadline.',
  '85. End White turn retains the pending Black deadline.',
  '86. Black Panic timeout forfeits turn without physical movement; increment halfmove and Black fullmove clocks, remove timer.',
  '87. e3-e4: White Pawn advances one vacant square after Black forfeiture.',
  '88. End White turn after e4.',
  '89. Rf2xf3: Black original a8 Rook captures White original g1 Knight.',
  '90. End Black turn after Rxf3.',
  '91. Ba6-b5: adjacent vacant diagonal.',
  '92. End White turn after Bb5.',
  '93. Rf3-f5: file slide through vacant f4.',
  '94. End Black turn after Rf5.',
  '95. Rf7xf6: White original h1 Rook captures Black f7 Pawn.',
  '96. End White turn after Rxf6.',
  '97. h6-h5: Black Pawn advances one vacant square.',
  '98. End Black turn after h5.',
  '99. Rf6xf8: file slide through f7 captures original Black f8 Bishop and checks Kc8 along e8,d8.',
  '100. Abduction after Rxf8: hide opposing nonroyal b7 Pawn in away zone, spend once, draw Merciless, conceal exact target from history; Black can later escape check to b7.',
  '101. Reveal Abduction transitions concealment to recall without capture, expenditure or clocks.',
  '102. Recall timeout captures exact Black b7 Pawn for White, publishes b7 and identity; no second draw or fullmove increment.',
  '103. End White turn after resolved Abduction; Black retains legal Kb7 escape.',
  '104. Kc8-b7: adjacent vacant square escapes the Rf8 rank check.',
  '105. End Black turn after Kb7.',
  '106. Rf8xf5: file slide through f7,f6 captures original Black a8 Rook; held Merciless records exact moved identity.',
  '107. End White turn after Rxf5.',
  '108. Pacifism before Black move binds exact original d7 Pawn on d5; retain physical card as effect, draw Lost Castle, no movement.',
  '109. c7-c5: initial two-square advance through vacant c6; c6 opportunity exists but no White Pawn on b5/d5 can capture en passant.',
  '110. End Black turn retaining c6 opportunity and Pacifism.',
  '111. b4xc5: ordinary Pawn capture of Black c7 Pawn, not en passant; d5 pacifist remains unaffected.',
  '112. End White turn; all 50 regular commands and seven cards accounted for.',
];

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const boardAt = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);

// Independent physical geometry; this iteration has no transformed/neutral pieces.
function reaches(pieces: PieceState[], piece: PieceState, target: string, capture: boolean): boolean {
  assert.ok(piece.square);
  const [x,y] = xy(piece.square), [tx,ty] = xy(target), dx = tx-x, dy = ty-y;
  if (!dx && !dy) return false;
  if (piece.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2;
  if (piece.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1;
  if (piece.role === 'pawn') {
    const direction = piece.owner === 'white' ? 1 : -1;
    if (capture) return Math.abs(dx) === 1 && dy === direction;
    if (dx || boardAt(pieces,target)) return false;
    return dy === direction || y === (piece.owner === 'white' ? 1 : 6) && dy === 2*direction
      && !boardAt(pieces,`${String.fromCharCode(97+x)}${y+direction+1}`);
  }
  const diagonal = Math.abs(dx) === Math.abs(dy), straight = dx === 0 || dy === 0;
  if (!(piece.role === 'queen' && (diagonal || straight) || piece.role === 'bishop' && diagonal || piece.role === 'rook' && straight)) return false;
  for (let i=1; i<Math.max(Math.abs(dx),Math.abs(dy)); i++) {
    if (boardAt(pieces,`${String.fromCharCode(97+x+i*Math.sign(dx))}${y+i*Math.sign(dy)+1}`)) return false;
  }
  return true;
}

function checked(pieces: PieceState[], color: Color, pacifist: string | undefined): boolean {
  const king = pieces.find(p => p.owner === color && p.royal && p.zone === 'board');
  assert.ok(king?.square);
  return pieces.some(p => p.zone === 'board' && p.owner !== color && p.id !== pacifist && reaches(pieces,p,king.square!,true));
}

function placement(pieces: PieceState[]): string {
  const letters = { pawn:'p', knight:'n', bishop:'b', rook:'r', queen:'q', king:'k' };
  return Array.from({length:8},(_,row) => {
    let text = '', empty = 0;
    for (let col=0;col<8;col++) {
      const p = boardAt(pieces,`${String.fromCharCode(97+col)}${8-row}`);
      if (!p) { empty++; continue; }
      if (empty) { text += empty; empty = 0; }
      text += p.owner === 'white' ? letters[p.role].toUpperCase() : letters[p.role];
    }
    return text + (empty || '');
  }).join('/');
}

function immutableApply(state: GameState, action: GameAction) {
  const original = structuredClone(state), payload = structuredClone(action);
  const result = applyAction(state,action);
  assert.deepEqual(state,original,'complete input GameState immutable');
  assert.deepEqual(action,payload,'complete command payload immutable');
  return result;
}

test('random campaign iteration 200', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/200.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed,860200);
  assert.equal(rationales.length,112);
  assert.equal(trace.steps.length,rationales.length);
  let state = createGameState(trace.initial);
  const pieces = structuredClone(state.pieces), players = structuredClone(state.players);
  let turn = structuredClone(state.turn), effects: unknown[] = [], history: GameEvent[] = [];
  let enPassant: GameState['enPassant'] = [], shield: GameState['shieldMove'];
  let allowances: GameState['plotsAllowances'] = [], pending: GameState['pendingAbduction'];
  const played: NonNullable<GameState['playedCards']> = [];
  let active: Color = 'white', half = 0, full = 1, castling = 'KQkq';
  let moves = 0, cards = 0, pacifist: string | undefined;
  const reviewedMoves = ('b1c3 g7g6 b2b3 d7d6 e2e3 c8f5 d1h5 d6d5 h5h3 d8d6 '
    + 'g2g3 a1a2 d2d4 d6f4 f1a6 f4f3 h8g8 g8g7 e8d8 c1d2 '
    + 'f5d3 g3g4 d8c8 d2c3 h7h6 h3h4 b3b4 f3f5 c2d3 a2f2 '
    + 'c3b2 f5e4 e1d1 f7f6 g1f3 e4g4 b2a1 g4e6 g7f7 e3e4 '
    + 'f2f3 a6b5 f3f5 f7f6 h6h5 f6f8 c8b7 f8f5 c7c5 b4c5').split(' ');
  const exactCards: Record<number, GameAction> = {
    6:{type:'playCard',cardId:'figure-dance',cardInstanceId:'white-hand-1-figure-dance',target:[]},
    36:{type:'playCard',cardId:'tournament',cardInstanceId:'black-hand-3-tournament',target:{own:'b8',opponent:'c3'}},
    56:{type:'playCard',cardId:'evil-eye',cardInstanceId:'black-hand-1-evil-eye',target:{attacker:'f3',victim:'h1'}},
    63:{type:'playCard',cardId:'plots-within-plots',cardInstanceId:'black-deck-1-plots-within-plots',target:{player:'black'}},
    84:{type:'playCard',cardId:'panic',cardInstanceId:'white-hand-0-panic'},
    100:{type:'playCard',cardId:'abduction',cardInstanceId:'white-deck-1-abduction',target:'b7'},
    108:{type:'playCard',cardId:'pacifism',cardInstanceId:'black-deck-2-pacifism',target:'d5'},
  };
  for (const [index,{action}] of trace.steps.entries()) {
    const step = index+1, label = rationales[index]!;
    assert.ok(label.startsWith(`${step}. `));
    const actor = turn.color;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.equal(from+to,reviewedMoves[moves],label);
      assert.match(from,/^[a-h][1-8]$/); assert.match(to,/^[a-h][1-8]$/);
      assert.equal(action.promotion,undefined);
      assert.equal(turn.moveMade,false,label);
      const mover = boardAt(pieces,from), victim = boardAt(pieces,to);
      assert.ok(mover); assert.equal(mover.owner,actor);
      assert.ok(reaches(pieces,mover,to,!!victim),label);
      if (victim) { assert.equal(victim.owner,opposite(actor)); assert.equal(victim.royal,false); assert.notEqual(victim.id,pacifist); }
      if (mover.id === pacifist) assert.equal(victim,undefined);
      const movedId = mover.id;
      if (victim) Object.assign(victim,{zone:'captured',square:null,capturedBy:actor});
      mover.square = to as SquareName;
      half = mover.role === 'pawn' || victim ? 0 : half+1;
      if (actor === 'black') full++;
      active = opposite(actor);
      turn.phase = 'afterMove'; turn.moveMade = true;
      shield = {player:actor,pieceIds:[movedId],capturedOpponent:!!victim};
      enPassant = mover.role === 'pawn' && Math.abs(Number(to[1])-Number(from[1])) === 2
        ? [{target:`${from[0]}${(Number(from[1])+Number(to[1]))/2}` as SquareName,pawnId:movedId}] : [];
      history.push({type:'move',from:from as SquareName,to:to as SquareName,...(victim ? {capturedId:victim.id} : {}),
        ...([106,111].includes(step) ? {movedPieceId:movedId,movedRoles:[mover.role]} : {})});
      allowances = []; moves++;
    } else if (action.type === 'playCard') {
      assert.deepEqual(action,exactCards[step],label);
      const owner: Color = [36,56,63,108].includes(step) ? 'black' : 'white';
      assert.equal(turn.cardPlays[owner],0);
      assert.equal(turn.phase,[36,56,108].includes(step) ? 'beforeMove' : 'afterMove');
      const player = players[owner], cardIndex = player.hand.findIndex(c => c.id === action.cardInstanceId);
      assert.notEqual(cardIndex,-1);
      const [card] = player.hand.splice(cardIndex,1); assert.ok(card); assert.equal(card.cardId,action.cardId);
      const replacement = player.deck.shift(); assert.ok(replacement); player.hand.push(replacement);
      if (step !== 108) player.discard.push(card);
      played.push({player:owner,cardInstanceId:card.id}); turn.cardPlays[owner]++; cards++;
      if (step === 6) {
        const destinations: Record<string,SquareName> = {a1:'h1',h1:'h8',a8:'a1',h8:'a8'};
        const movement = pieces.filter(p => p.square && destinations[p.square]).map(p => ({from:p.square!,to:destinations[p.square!]!}));
        assert.equal(movement.length,4);
        for (const p of pieces) if (p.square && destinations[p.square]) { assert.equal(p.role,'rook'); p.square = destinations[p.square]!; }
        castling = '-';
        history.push({type:'cardPlayed',cardId:action.cardId,target:[],movement,preservePreviousMove:true});
      } else if (step === 36) {
        const white = boardAt(pieces,'c3')!, black = boardAt(pieces,'b8')!;
        assert.equal(white.id,'white-knight-b1'); assert.equal(black.id,'black-knight-b8');
        white.square = 'b8'; black.square = 'c3';
        shield = {player:'black',pieceIds:[],capturedOpponent:false};
        turn.phase = 'afterMove'; turn.moveMade = true; active = 'white'; half++; full++; enPassant = [];
        history.push({type:'cardPlayed',cardId:action.cardId,target:{own:'b8',opponent:'c3'},movement:[{from:'c3',to:'b8'},{from:'b8',to:'c3'}],preservePreviousMove:false});
      } else if (step === 56) {
        const attacker = boardAt(pieces,'f3')!, victim = boardAt(pieces,'h1')!;
        assert.equal(attacker.id,'black-queen-d8'); assert.equal(victim.id,'white-rook-a1');
        assert.ok(reaches(pieces,attacker,'h1',true));
        const hypothetical = structuredClone(pieces);
        hypothetical.find(p => p.id === victim.id)!.zone = 'captured';
        hypothetical.find(p => p.id === attacker.id)!.square = 'h1';
        assert.equal(checked(hypothetical,'black',undefined),false,'Evil Eye capture capability preserves Black King');
        Object.assign(victim,{zone:'captured',square:null,capturedBy:'black'});
        shield = {player:'black',pieceIds:[],capturedOpponent:true};
        turn.phase = 'afterMove'; turn.moveMade = true; active = 'white'; half = 0; full++; enPassant = [];
        history.push({type:'cardPlayed',cardId:action.cardId,target:{attacker:'f3',victim:'h1'},capturedId:victim.id,capturedIds:[victim.id],movement:[],preservePreviousMove:false});
      } else if (step === 63) {
        const capture = history[history.length-1]!;
        allowances = [{player:'black',remaining:2,eligibleCards:[],window:{phase:'afterMove',moveMade:true,shieldMove:structuredClone(shield),reaction:structuredClone(capture),capture:structuredClone(capture),legacyCapture:{historyLength:history.length,pieceIds:['black-bishop-c8']}}}];
        history.push({type:'cardPlayed',cardId:action.cardId,player:'black',preservePreviousMove:true,movement:[]});
      } else if (step === 84) {
        effects = [{type:'panic',owner:'white',player:'black',durationMs:15000}];
        history.push({type:'cardPlayed',cardId:action.cardId,movement:[],preservePreviousMove:true});
      } else if (step === 100) {
        const victim = boardAt(pieces,'b7')!; assert.equal(victim.id,'black-pawn-b7');
        pending = {phase:'concealment',player:'black',durationMs:10000,pieceId:victim.id,requiresPieceId:false,before:structuredClone(state)};
        Object.assign(victim,{zone:'away',square:null});
        history.push({type:'cardPlayed',cardId:action.cardId,movement:[],preservePreviousMove:true});
      } else if (step === 108) {
        assert.equal(boardAt(pieces,'d5')!.id,'black-pawn-d7');
        pacifist = 'black-pawn-d7';
        effects = [{type:'pacifism',owner:'black',card,pieceId:pacifist}];
        history.push({type:'cardPlayed',cardId:action.cardId,target:'d5',movement:[],preservePreviousMove:false});
      } else assert.fail(label);
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade,true,label); assert.equal(pending ?? null,null);
      assert.equal(checked(pieces,actor,pacifist),false,label);
      turn = {color:opposite(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      shield = undefined; allowances = [];
    } else if (action.type === 'panicTimeout') {
      assert.equal(step,86); assert.equal(actor,'black'); assert.equal(turn.moveMade,false);
      assert.deepEqual(effects,[{type:'panic',owner:'white',player:'black',durationMs:15000}]);
      effects = []; half++; full++; active = 'white';
      turn = {color:'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}; shield = undefined; allowances = []; enPassant = [];
    } else if (action.type === 'revealAbduction') {
      assert.equal(step,101); assert.equal(pending?.phase,'concealment'); pending!.phase = 'recall';
    } else if (action.type === 'abductionTimeout') {
      assert.equal(step,102); assert.equal(pending?.phase,'recall');
      Object.assign(pieces.find(p => p.id === 'black-pawn-b7')!,{zone:'captured',square:null,capturedBy:'white'});
      Object.assign(history[history.length-1]!,{target:'b7',capturedIds:['black-pawn-b7'],capturedId:'black-pawn-b7'});
      half = 0; pending = null;
    } else assert.fail(label);

    const result = immutableApply(state,action);
    assert.ok(result.ok,label); state = result.state;
    assert.deepEqual(state.pieces,pieces,`${label}: every physical identity/status/capture actor`);
    assert.deepEqual(state.players,players,`${label}: exact hands/decks/discards`);
    assert.deepEqual(state.turn,turn,label);
    assert.deepEqual(state.effects,effects,label);
    assert.deepEqual(state.history,history,label);
    assert.deepEqual(state.playedCards ?? [],played,label);
    assert.deepEqual(state.enPassant,enPassant,label);
    assert.equal(state.fen,`${placement(pieces)} ${active === 'white' ? 'w' : 'b'} ${castling} - ${half} ${full}`,`${label}: all six FEN fields`);
    assert.deepEqual(state.shieldMove,shield,label);
    assert.deepEqual(clean(state.plotsAllowances ?? []),clean(allowances ?? []),label);
    assert.deepEqual(state.pendingAbduction ?? null,pending ?? null,label);
    assert.equal(state.pendingRescue ?? null,null,label);
    assert.equal(state.pendingDoomsayer ?? null,null,label);
    assert.deepEqual(state.underElfHill ?? [],[],label);
    assert.equal(state.chaosForbidden,undefined,label);
    assert.equal(state.plotsExecution,undefined,label);
    assert.deepEqual(state.fogLocked ?? [],[],label);
    assert.deepEqual(state.riposteLostMoves ?? [],[],label);
    assert.equal(state.riposteSkipped,undefined,label);
    assert.equal(state.riposteCheckDeferred,undefined,label);
    assert.equal(state.orientation,0,label); assert.equal(state.outcome,null,label);
    assert.equal(checked(pieces,actor,pacifist),false,`${label}: actor never needs an after-move rescue`);
    if (step >= 99 && step <= 103) {
      assert.equal(checked(pieces,'black',pacifist),true,'Rf8 checks Kc8 along vacant e8,d8');
      if (step >= 100) {
        // Abduction does not create mate: independently simulate the concrete Kb7 escape.
        const escape = structuredClone(pieces), king = escape.find(p => p.id === 'black-king-e8')!;
        assert.equal(boardAt(escape,'b7'),undefined);
        assert.ok(reaches(escape,king,'b7',false)); king.square = 'b7';
        assert.equal(checked(escape,'black',pacifist),false,'Abduction leaves the legal Kb7 escape');
      }
    }
    const beforeQueries = structuredClone(state);
    for (const color of ['white','black'] as const) assert.equal(isKingInCheck(state,color),checked(pieces,color,pacifist),`${label}: independent ${color} royal threat`);
    assert.deepEqual(state,beforeQueries,'royal queries immutable');
    // None of the two double pushes has an adjacent prospective capturing Pawn.
    for (const ep of enPassant) {
      const victim = pieces.find(p => p.id === ep.pawnId)!;
      const prospective = structuredClone(state);
      prospective.turn = {color:opposite(victim.owner),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      const snapshot = structuredClone(prospective), destinations = legalDests(prospective);
      for (const p of pieces.filter(p => p.zone === 'board' && p.role === 'pawn' && p.owner === prospective.turn.color)) {
        assert.equal(reaches(pieces,p,ep.target,true),false,'no physical Pawn reaches the EP target');
        assert.equal(destinations.get(p.square!)?.includes(ep.target) ?? false,false);
      }
      assert.deepEqual(prospective,snapshot,'EP query immutable');
    }
    if (pending) {
      const denied = immutableApply(state,{type:'endTurn'});
      assert.equal(denied.ok,false,'Abduction mandatory choice prevents ending turn');
      assert.deepEqual(denied.state,state);
    }
  }
  assert.equal(moves,50); assert.equal(cards,7);
  assert.equal(state.fen,'rN6/pk2p3/4q1p1/1BPp1R1p/3PP2Q/3P4/7P/B2K4 b - - 0 27');
  assert.equal(replayTrace(trace).fen,state.fen);
});
