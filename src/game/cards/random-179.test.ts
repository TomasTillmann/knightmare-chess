import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';

// Independently reviewed against rules §§8–11, 13–14, 17, 20, 22,
// cards.md and the thirteen played physical cards in final_cards.
const rationales = `
1. d2-d4 is an unobstructed initial Pawn double step.
2. White closes its safe completed turn; d3 opportunity persists.
3. a7-a6 is one empty forward square.
4. Black closes the safe turn.
5. b1-a3 is a Knight jump onto an empty square.
6. Fortification retains its physical card at adjacent b1/c1 after White moves.
7. Close turn retaining the wall.
8. g7-g5 traverses empty g6 and g5.
9. Close turn retaining the g6 opportunity.
10. a3-b5 is a Knight jump, without capture.
11. Fireball captures its b5 center and adjacent a6 Pawn; d4 is outside the blast.
12. Close turn after spending Fireball and drawing once.
13. f7-f5 traverses empty f6 and f5.
14. Close turn retaining the f6 opportunity.
15. b2-b4 traverses empty b3 and b4.
16. Peace Talks removes the b1/c1 wall into its White owner discard.
17. Close turn with no wall and unchanged b3 opportunity.
18. d7-d5 traverses empty d6 and d5.
19. Holy Quest swaps opposing f1 Bishop and g1 Knight without capture; raw d6 FEN survives.
20. Close turn; no White Pawn can capture on d6.
21. c1-d2 is an empty adjacent Bishop diagonal.
22. Close White turn.
23. d8-d7 is an empty Queen file step.
24. Crab marks Black h7 Pawn after the Queen move and remains in play.
25. Close turn preserving Crab identity.
26. a1-b1 is an empty Rook step and revokes White queenside castling.
27. Treason swaps Black a8 Rook and g8 Knight, preserving physical identities and latent rights.
28. Close turn preserving the swapped board.
29. b8-c6 is an empty Knight jump.
30. Close Black turn.
31. e2-e4 traverses empty e3 and e4.
32. Close turn retaining e3 opportunity.
33. g5-g4 is an empty forward Pawn step.
34. Man-Trap secretly marks c7 occupied by Black own Pawn and retains the card.
35. Close turn without springing the trap.
36. c2-c4 traverses empty c3 and c4.
37. Close turn retaining c3 opportunity.
38. e7-e6 is an empty forward Pawn step.
39. Close Black turn.
40. b1-b3 crosses empty b2 and lands empty.
41. Close White turn.
42. d7-g7 crosses empty e7 and f7 along the Queen rank.
43. Close Black turn.
44. b3-d3 crosses empty c3 along the Rook rank.
45. Close White turn.
46. c6-a7 is an empty Knight jump.
47. Close Black turn.
48. d2-c3 is an empty Bishop diagonal step.
49. Close White turn.
50. Crab h7-g6 moves diagonally forward onto empty g6.
51. Close turn preserving Crab marker.
52. c4xd5 is a Pawn diagonal capture of Black d7 identity.
53. Think Again restores both Pawns and clocks, spends only Black card, forbids the full canceled transition.
54. d1-b3 crosses empty c2; Queen move is different from canceled Pawn capture.
55. Close replacement turn and reset both card allowances.
56. g7-d7 crosses empty f7 and e7.
57. Cowardice sends enemy e4 Pawn backward through empty e3 to empty e2.
58. Close turn; Cowardice did not consume another move or clock tick.
59. Assassin lets e2 Pawn capture its own d3 Rook as its replacement move.
60. Close turn after the own-piece capture.
61. Crab g6-h5 moves diagonally forward to an empty square.
62. Close Black turn.
63. e1-d2 is an adjacent safe King move and revokes remaining White castling.
64. Close White turn.
65. f8-c5 crosses empty e7 and d6 along the Bishop diagonal.
66. Close Black turn.
67. d4xc5 is a Pawn diagonal capture of the Black f8 Bishop.
68. Close White turn.
69. Tournament exchanges Black a7 Knight and White f1 Knight as Black replacement move; f1 checks d2.
70. Close Black turn; White must answer the Knight check.
71. Dubbing g2-e1 is a valid Knight-shaped empty landing but cannot cure f1 Knight checking d2; card fizzles and move remains.
72. d2-c1 is a safe adjacent King escape from f1 Knight.
73. Close White turn after its successful escape.
74. e8-f8 is safe and revokes remaining Black castling.
75. Close Black turn.
76. c1-b2 is a safe adjacent King move.
77. Close White turn.
78. d5xc4 is Black Pawn diagonal capture of White c2 identity.
79. Close Black turn.
80. c3-f6 crosses empty d4 and e5 on the Bishop diagonal.
81. Close White turn.
82. g8-g5 crosses empty g7 and g6 along the Rook file.
83. Close Black turn.
84. f6-c3 retraces the empty e5/d4 Bishop diagonal.
85. Close White turn.
86. f1xh2 is a Knight jump capturing White h2 Pawn.
87. Close Black turn.
88. b2-a1 is a safe adjacent King move.
89. Close White turn.
90. c4xb3 is Black Pawn diagonal capture of White Queen.
91. Close Black turn.
92. f2-f4 traverses empty f3; Black g4 Pawn can legally capture en passant.
93. Close White turn retaining legal g4xf3 en passant.
94. b3xa2 captures White a2 Pawn and expires en passant.
95. Close Black turn.
96. g2-g3 is an empty forward Pawn step.
97. Close White turn.
98. Irresistible Force pushes White g3 Pawn to empty g2, then Black g4 Pawn to g3, as one replacement move.
99. Close Black turn; only its initiating Pawn is a moved identity for triggers.
100. c3xh8 crosses empty d4/e5/f6/g7 and captures Black h8 Rook.
101. Close White turn.
102. d7-g7 crosses empty e7/f7 along the Queen rank.
103. Close Black turn.
104. a1xa2 safely captures Black d7 Pawn with the King.
105. Close White turn.
106. Crab h5-g4 moves diagonally forward onto empty g4.
107. Close Black turn.
108. g1-d4 crosses empty f2/e3 along the Bishop diagonal.
109. Close White turn.
110. f8-g8 is a safe King step; h8 Bishop attacks diagonally, not adjacent horizontally.
111. Close Black turn.
112. d4xg7 crosses empty e5/f6 and captures Black Queen.
113. Close White turn.
114. g5-h5 is an empty Rook rank step.
115. Close Black turn, completing all fifty move commands.
`.trim().split('\n');

const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
function geometry(pieces: PieceState[], piece: PieceState, to: string, capture: boolean, step: number): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [u, v] = xy(to), dx = Math.abs(u-x), dy = Math.abs(v-y);
  if (!dx && !dy) return false;
  if (piece.role === 'knight') return dx * dy === 2;
  let shape = piece.role === 'king' && Math.max(dx, dy) === 1;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    shape = capture || step >= 24 && piece.id === 'black-pawn-h7' ? dx === 1 && v-y === forward
      : dx === 0 && (v-y === forward || v-y === forward*2 && y === (piece.owner === 'white' ? 1 : 6));
  } else if (piece.role !== 'king') shape = (piece.role === 'queen' || piece.role === 'bishop') && dx === dy
    || (piece.role === 'queen' || piece.role === 'rook') && (dx === 0 || dy === 0);
  if (!shape) return false;
  let previous: string = piece.square;
  for (let n = 1; n <= Math.max(dx, dy); n++) {
    const next: string = `${String.fromCharCode(97+x+Math.sign(u-x)*n)}${y+Math.sign(v-y)*n+1}`;
    if (step >= 6 && step < 16 && [previous, next].sort().join(',') === 'b1,c1') return false;
    if (n < Math.max(dx, dy) && at(pieces, next)) return false;
    previous = next;
  }
  return true;
}
function threatened(pieces: PieceState[], color: Color, step: number): boolean {
  const king = pieces.find(p => p.owner === color && p.royal)!;
  assert.ok(king.square);
  return pieces.some(p => p.zone === 'board' && p.owner !== color && geometry(pieces, p, king.square!, true, step));
}
function boardFen(pieces: PieceState[]): string {
  const roles = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({length:8}, (_, r) => {
    let text = '', empty = 0;
    for (let f=0; f<8; f++) {
      const p = at(pieces, `${String.fromCharCode(97+f)}${8-r}`);
      if (!p) empty++; else { if (empty) text += empty; empty=0; text += p.owner === 'white' ? roles[p.role].toUpperCase() : roles[p.role]; }
    }
    return text + (empty || '');
  }).join('/');
}
function immutable(state: GameState, action: GameAction): GameState {
  const saved = structuredClone(state), input = structuredClone(action), result = applyAction(state, action);
  assert.deepEqual(state, saved); assert.deepEqual(action, input); assert.ok(result.ok, JSON.stringify(action));
  return result.state;
}

test('iteration 179 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/179.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});

test('iteration 179 independent per-action semantic oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/179.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationales.length, 115); assert.equal(trace.steps.length, rationales.length);
  let state = createGameState(trace.initial), pieces = structuredClone(state.pieces), players = structuredClone(state.players);
  let effects: unknown[] = [], history: GameEvent[] = [], ep: GameState['enPassant'] = [];
  let turn = structuredClone(state.turn), shield: GameState['shieldMove'], forbidden: GameState['chaosForbidden'];
  let half = 0, full = 1, side = 'w', rights = 'KQkq', rawEp = '-';
  let canceled: GameState | undefined;
  const cards: Record<number, [Color, string, string, unknown]> = {
    6: ['white','fortification','white-hand-4-fortification',{from:'b1',to:'c1'}],
    11: ['white','fireball','white-hand-0-fireball','b5'],
    16: ['white','peace-talks','white-deck-0-peace-talks','white-hand-4-fortification'],
    19: ['black','holy-quest','black-hand-4-holy-quest',{bishop:'f1',knight:'g1'}],
    24: ['black','crab','black-hand-3-crab','h7'],
    27: ['white','treason','white-hand-3-treason',{rook:'a8',knight:'g8'}],
    34: ['black','man-trap','black-deck-1-man-trap','c7'],
    53: ['black','think-again','black-hand-1-think-again',undefined],
    57: ['black','cowardice','black-deck-0-cowardice',[{from:'e4',to:'e2'}]],
    59: ['white','assassin','white-hand-1-assassin',[{from:'e2',to:'d3'}]],
    69: ['black','tournament','black-hand-2-tournament',{own:'a7',opponent:'f1'}],
    71: ['white','dubbing','white-deck-4-dubbing',[{from:'g2',to:'e1'}]],
    98: ['black','irresistible-force','black-deck-5-irresistible-force',[{from:'g4',to:'g3'}]],
  };
  const relocate = (from: string, to: string) => { const p = at(pieces, from); assert.ok(p); assert.match(to,/^[a-h][1-8]$/); p.square = to as SquareName; };
  const swap = (a: string, b: string) => { const p = at(pieces,a), q = at(pieces,b); assert.ok(p&&q); const old=p.square; p.square=q.square; q.square=old; };
  const capture = (p: PieceState, color: Color) => { assert.equal(p.royal,false); p.square=null; p.zone='captured'; p.capturedBy=color; };
  for (const [index, entry] of trace.steps.entries()) {
    const step=index+1, action=entry.action, before=state, reason=rationales[index]!;
    assert.ok(reason.startsWith(`${step}. `));
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from=action.from, to=action.to, p=at(pieces,from), victim=at(pieces,to);
      assert.ok(p); assert.equal(turn.moveMade,false); assert.equal(p.owner,turn.color); assert.equal(action.promotion,undefined);
      if (victim) { assert.notEqual(victim.owner,p.owner); assert.equal(victim.royal,false); }
      assert.ok(geometry(pieces,p,to,!!victim,step),reason);
      assert.notEqual(to,'c7','Man-Trap never springs in this trace');
      if (step===52) canceled=structuredClone(before);
      ep=[]; rawEp='-';
      if (p.role==='pawn' && Math.abs(Number(from[1])-Number(to[1]))===2) ep=[{target:`${from[0]}${(Number(from[1])+Number(to[1]))/2}` as SquareName,pawnId:p.id}];
      if (step===92) rawEp='f3';
      half=p.role==='pawn'||victim?0:half+1; if(turn.color==='black')full++;
      side=turn.color==='white'?'b':'w';
      if(victim)capture(victim,turn.color);
      relocate(from,to);
      if(step===26)rights='Kkq'; if(step===63)rights='ka'; if(step===74)rights='-';
      history.push({type:'move',from:from as SquareName,to:to as SquareName,
        ...(victim?{capturedId:victim.id}:{}),
        ...(step>=38&&turn.color==='black'?{movedPieceId:p.id,movedRoles:[p.role]}:{}),
        ...([42,56,65,82,102].includes(step)?{previousFen:before.fen}:{})});
      shield={player:turn.color,pieceIds:[p.id],capturedOpponent:!!victim};
      turn.phase='afterMove';turn.moveMade=true; forbidden=undefined;
      assert.equal(threatened(pieces,turn.color,step),false,reason);
    } else if(action.type==='endTurn') {
      assert.equal(turn.moveMade,true);assert.equal(threatened(pieces,turn.color,step),false,reason);
      turn={color:turn.color==='white'?'black':'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      shield=undefined;forbidden=undefined;
    } else if(action.type==='playCard') {
      const [owner,id,instance,target]=cards[step]!;
      assert.deepEqual(action,{type:'playCard',cardId:id,cardInstanceId:instance,...(target===undefined?{}:{target})});
      assert.equal(turn.cardPlays[owner],0);
      const replacement=[59,69,71,98].includes(step);
      if(step===53){assert.equal(turn.color,'white');assert.equal(turn.moveMade,true);}
      else {assert.equal(turn.color,owner);assert.equal(turn.phase,replacement?'beforeMove':'afterMove');}
      const player=players[owner], card=player.hand.find(c=>c.id===instance);
      assert.deepEqual(card,{id:instance,cardId:id});
      player.hand=player.hand.filter(c=>c.id!==instance);
      if(![6,24,34].includes(step))player.discard.push(card!);
      player.hand.push(player.deck.shift()!);
      let movement: NonNullable<GameEvent['movement']>=[];
      if(step===6)effects.push({type:'fortification',owner,card,from:'b1',to:'c1'});
      if(step===11){
        assert.deepEqual(shield,{player:'white',pieceIds:['white-knight-b1'],capturedOpponent:false});
        const victims=pieces.filter(p=>p.square&&!p.royal&&Math.max(Math.abs(xy(p.square)[0]-1),Math.abs(xy(p.square)[1]-4))<=1);
        assert.deepEqual(victims.map(p=>p.id),['white-knight-b1','black-pawn-a7']);
        victims.forEach(p=>capture(p,owner));half=0;
      }
      if(step===16){assert.equal(effects.length,1);effects=[];player.discard.push({id:'white-hand-4-fortification',cardId:'fortification'});}
      if(step===19){assert.equal(at(pieces,'f1')?.role,'bishop');assert.equal(at(pieces,'g1')?.role,'knight');swap('f1','g1');movement=[{from:'f1',to:'g1'},{from:'g1',to:'f1'}];rawEp='d6';}
      if(step===24){assert.equal(at(pieces,'h7')?.owner,owner);assert.equal(at(pieces,'h7')?.role,'pawn');effects.push({type:'crab',owner,card,pieceId:'black-pawn-h7'});}
      if(step===27){assert.equal(at(pieces,'a8')?.role,'rook');assert.equal(at(pieces,'g8')?.role,'knight');swap('a8','g8');movement=[{from:'a8',to:'g8'},{from:'g8',to:'a8'}];rights='Kka';}
      if(step===34){assert.equal(at(pieces,'c7')?.owner,owner);effects.push({type:'man-trap',owner,card,square:'c7'});}
      if(step===53){
        assert.ok(canceled); pieces=structuredClone(canceled.pieces);history=structuredClone(canceled.history);
        ep=structuredClone(canceled.enPassant);turn=structuredClone(canceled.turn);shield=undefined;
        half=0;full=12;side='w';rawEp='-';rights='Kka';
        forbidden={player:'white',movement:'black-pawn-d7:d5:captured|white-pawn-c2:c4:d5'};
        movement=[{from:'d5',to:'c4'}];
      }
      if(step===57){assert.equal(at(pieces,'e4')?.owner,'white');assert.equal(at(pieces,'e3'),undefined);assert.equal(at(pieces,'e2'),undefined);relocate('e4','e2');movement=[{from:'e4',to:'e2'}];}
      if(step===59){assert.ok(geometry(pieces,at(pieces,'e2')!,'d3',true,step));assert.equal(at(pieces,'d3')?.owner,owner);capture(at(pieces,'d3')!,owner);relocate('e2','d3');movement=[{from:'e2',to:'d3'}];half=0;shield={player:owner,capturedOpponent:false,pieceIds:['white-pawn-e2']};}
      if(step===69){
        assert.equal(at(pieces,'a7')?.role,'knight');assert.equal(at(pieces,'a7')?.owner,'black');
        assert.equal(at(pieces,'f1')?.role,'knight');assert.equal(at(pieces,'f1')?.owner,'white');
        swap('a7','f1');movement=[{from:'f1',to:'a7'},{from:'a7',to:'f1'}];half++;full++;shield={player:owner,capturedOpponent:false,pieceIds:[]};
        assert.equal(threatened(pieces,'white',step),true);
        const escape=structuredClone(pieces), king=escape.find(p=>p.royal&&p.owner==='white')!;
        assert.equal(at(escape,'c1'),undefined);assert.ok(geometry(escape,king,'c1',false,step));king.square='c1';
        assert.equal(threatened(escape,'white',step),false,'Tournament gives check, not forbidden direct mate: Kc1 escapes');
      }
      if(step===71){
        assert.equal(threatened(pieces,'white',step),true);
        const proposed=structuredClone(pieces);proposed.find(p=>p.square==='g2')!.square='e1';
        assert.equal(at(pieces,'e1'),undefined);assert.equal(threatened(proposed,'white',step),true);
        assert.equal(geometry(pieces,at(pieces,'f1')!,'d2',true,step),true,'f1 Knight still checks d2 after Dubbing');
      }
      if(step===98){
        assert.equal(at(pieces,'g4')?.id,'black-pawn-g7');assert.equal(at(pieces,'g3')?.id,'white-pawn-g2');assert.equal(at(pieces,'g2'),undefined);
        relocate('g3','g2');relocate('g4','g3');movement=[{from:'g3',to:'g2'},{from:'g4',to:'g3'}];half=0;full++;
        shield={player:owner,capturedOpponent:false,pieceIds:['black-pawn-g7']};
      }
      if(replacement&&step!==71){turn.moveMade=true;turn.phase='afterMove';side=owner==='white'?'b':'w';ep=[];rawEp='-';}
      if(step===6)history.push({type:'cardPlayed',cardId:id,target:target as GameEvent['target']});
      else history.push({type:step===71?'cardFizzled':'cardPlayed',cardId:id,
        ...(step===71?{reason:'SELF_CHECK' as const}:{}),
        ...(target!==undefined&&![16,34,71].includes(step)?{target:target as GameEvent['target']}:{}),
        ...(step===11?{capturedIds:['white-knight-b1','black-pawn-a7'],player:owner}:{}),
        ...(step===53?{player:owner}:{}),...(step===59?{capturedId:'white-rook-a1'}:{}),
        movement,preservePreviousMove:!replacement});
      turn.cardPlays[owner]++;
      if(step!==71)assert.equal(threatened(pieces,owner,step),false,reason);
    } else assert.fail(`Unexpected action ${action.type}`);

    state=immutable(before,action);
    assert.deepEqual(state.pieces,pieces,reason);assert.deepEqual(state.players,players,reason);
    assert.deepEqual(state.history,history,reason);assert.deepEqual(state.effects,effects,reason);
    assert.deepEqual(state.turn,turn,reason);assert.deepEqual(state.enPassant,ep,reason);
    assert.equal(state.fen,`${boardFen(pieces)} ${side} ${rights} ${rawEp} ${half} ${full}`,reason);
    assert.deepEqual(state.shieldMove,shield,reason);assert.deepEqual(state.chaosForbidden,forbidden,reason);
    for(const key of ['plotsExecution','riposteSkipped','riposteCheckDeferred'] as const)assert.equal(state[key],undefined,`${step} ${key}`);
    for(const key of ['plotsAllowances','fogLocked','riposteLostMoves','underElfHill'] as const)assert.deepEqual(state[key]??[],[],`${step} ${key}`);
    for(const key of ['pendingRescue','pendingAbduction','pendingDoomsayer','outcome'] as const)assert.equal(state[key]??null,null,`${step} ${key}`);
    assert.equal(state.orientation,0);
    const saved=structuredClone(state);
    for(const color of ['white','black'] as const)assert.equal(isKingInCheck(state,color),threatened(pieces,color,step),`${step} ${color}`);
    legalDests(state);assert.deepEqual(state,saved,'public check and destination queries preserve all state');
    if(step===53){const blocked=applyAction(state,{type:'move',from:'c4',to:'d5'});assert.equal(blocked.ok,false);assert.deepEqual(state,saved);}
    for(const opportunity of ep){
      const passed=pieces.find(p=>p.id===opportunity.pawnId)!, color:Color=passed.owner==='white'?'black':'white';
      const prospect=structuredClone(state);prospect.turn={color,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      const fields=prospect.fen.split(' ');fields[1]=color==='white'?'w':'b';prospect.fen=fields.join(' ');
      const original=structuredClone(prospect),dests=legalDests(prospect);
      const candidates=pieces.filter(p=>p.square&&p.role==='pawn'&&p.owner===color&&geometry(pieces,p,opportunity.target,true,step));
      assert.deepEqual(candidates.map(p=>p.id),step===92||step===93?['black-pawn-g7']:[],`${step} physical EP candidates`);
      for(const pawn of pieces.filter(p=>p.square&&p.role==='pawn'&&p.owner===color)){
        const expected=candidates.some(p=>p.id===pawn.id);
        if(expected){
          const simulated=structuredClone(pieces), victim=simulated.find(p=>p.id===passed.id)!;
          simulated.find(p=>p.id===pawn.id)!.square=opportunity.target;capture(victim,color);
          assert.equal(threatened(simulated,color,step),false,'EP removes f4 Pawn and moves g4 captor safely');
          const taken=immutable(prospect,{type:'move',from:pawn.square,to:opportunity.target});
          assert.deepEqual(taken.pieces,simulated);assert.deepEqual(taken.players,players);assert.deepEqual(taken.effects,effects);
          assert.equal(taken.fen,`${boardFen(simulated)} w - - 0 22`);assert.deepEqual(taken.enPassant,[]);
          assert.deepEqual(taken.history,[...history,{type:'move',from:'g4',to:'f3',capturedId:'white-pawn-f2',movedPieceId:'black-pawn-g7',movedRoles:['pawn']}]);
          assert.deepEqual(taken.shieldMove,{player:'black',pieceIds:['black-pawn-g7'],capturedOpponent:true});
          immutable(taken,{type:'endTurn'});
        }
        assert.equal(dests.get(pawn.square!)?.includes(opportunity.target)??false,expected);
      }
      assert.deepEqual(prospect,original,'prospective EP queries and probes immutable');
    }
  }
  assert.equal(trace.steps.filter(s=>s.action.type==='move').length,50);
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,13);
  assert.equal(state.fen,'n1b3kB/Npp3B1/4p3/2P2p1r/1P3Pp1/3P2p1/K5Pn/7R w - - 1 27');
});
