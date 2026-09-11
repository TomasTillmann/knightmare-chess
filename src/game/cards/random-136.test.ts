import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests, underElfHillReturnSquares } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, PieceState, SquareName, GameState } from '../types.js';

// Read rules §§8–14, 17, 22.3–22.4 and all sixteen played-card artworks.
// Every numbered row was reviewed; notes describe independent physical transitions.
const rationale = `
1. d2-d4 passes empty d3; double-step creates d3 opportunity but no black captor.
2. Forbidden City marks vacant e3 after White moves; retain card and draw Charge.
3. End White turn; e3 marker and d3 opportunity persist.
4. c7-c6 advances one; old d3 opportunity expires.
5. End Black turn without card or board change.
6. g2-g3 advances one into vacancy.
7. End White turn with both Kings safe.
8. e7-e5 passes empty e6; no white pawn can capture e6.
9. End Black turn preserving unavailable e6 opportunity.
10. d4-d5 advances one, expiring e6 opportunity.
11. End White turn with e3 forbidden.
12. f7-f5 passes empty f6; no white pawn can capture f6.
13. End Black turn preserving f6 opportunity.
14. h2-h4 passes empty h3; no black pawn can capture h3.
15. End White turn preserving h3 opportunity.
16. Bishop f8-a3 follows e7,d6,c5,b4, all clear; no capture.
17. End Black turn with a3 bishop and safe Kings.
18. Bishop f1-g2 enters its vacated pawn square.
19. Peace Talks removes Forbidden City; discard both cards and draw Fortification.
20. End White turn; e3 is available again.
21. Under Elf Hill removes Black royal e8 to away, consumes move, revokes kq.
22. End Black turn; absent royal neither attacks nor can be checked.
23. Knight b1xa3 captures physical black bishop f8, capturedBy White.
24. End White turn opens mandatory Black King return before optional actions.
25. Return same King to safe empty edge a4; no clock/move charge; immobilize this turn.
26. Queen d8-g5 follows empty e7,f6 while returned King remains a4.
27. Disintegration makes own pawn f5 dead, never captured; draw Betrayal.
28. End Black turn clears returned King's movement restriction.
29. Bishop c1-f4 follows vacant d2,e3.
30. End White turn; Black King a4 is safe.
31. King a4-b5 is attacked by Knight a3; only pending same-turn rescue permits it.
32. Rebirth f4-f1 cannot remove Knight a3 attack; spend card and undo illegal King move.
33. Pawn e5-e4 crosses frontier; replacement ordinary move uses no second card.
34. Toll decline cancels Black's whole turn, restores e5 and returns any used Rebirth/draw.
35. End forfeited Black turn; White's Toll allowance resets with the next turn.
36. Knight a3-c4 makes ordinary empty L jump.
37. End White turn with safe Kings.
38. Knight b8-a6 makes empty L jump.
39. End Black turn with safe Kings.
40. Knight c4-e3 enters former Forbidden City after cancellation.
41. End White turn; no marker remains at e3.
42. Knight g8-f6 makes empty L jump.
43. End Black turn with safe Kings.
44. Rook h1-h3 passes empty h2; lose White kingside castling right.
45. End White turn retaining only Q castling.
46. Knight f6xd5 captures white pawn d2, capturedBy Black.
47. End Black turn after capture.
48. Forced March simultaneously moves g3-f3 and h4-g4 sideways into distinct empty squares.
49. End White replacement-move turn; no ordinary move remains.
50. Pawn d7-d6 advances into vacancy.
51. End Black turn with safe Kings.
52. Rook a1-c1 passes empty b1; remove last castling right.
53. End White turn with castling rights absent.
54. Queen g5xf4 captures White bishop c1 diagonally, capturedBy Black.
55. Rebirth relocates white pawn b2 to empty starting square h2, without capture.
56. End Black turn retaining Rebirth expenditure.
57. White King e1-f1 takes a safe adjacent square.
58. End White turn with safe Kings.
59. Pawn b7-b5 passes empty b6; no white pawn can capture b6.
60. End Black turn retaining unavailable b6 opportunity.
61. Queen d1-d4 follows empty d2,d3 and checks Black King a4 along c4,b4.
62. End White turn gives Black the checked turn.
63. Pawn e5xd4 captures checking Queen, capturedBy Black, curing check.
64. Curse marks enemy physical rook h1 now h3; retain card and draw Hidden Passage.
65. End Black turn with Curse active.
66. Uncursed rook c1-d1 moves one square.
67. End White turn with safe Kings.
68. Bishop c8-e6 traverses vacant d7.
69. End Black turn with safe Kings.
70. Bishop g2-h1 retreats diagonally into vacancy.
71. End White turn with safe Kings.
72. Bishop e6-c8 returns via empty d7.
73. End Black turn with safe Kings.
74. King f1-g2 takes safe diagonal square; Queen f4-g3-h2 does not attack g2.
75. End White turn with safe Kings.
76. Knight a6-c7 makes empty L jump.
77. End Black turn with safe Kings.
78. King g2-f1 returns to safe adjacent square.
79. Fortification creates fixed undirected f7-g7 boundary; retain card and draw Earthquake.
80. End White turn preserving wall and Curse.
81. Bishop c8-e6 traverses empty d7, not the wall.
82. End Black turn with safe Kings.
83. Pawn c2-c3 advances one.
84. Earthquake turns forward directions left/right; Black h7 promotes Rook first, White a2 Bishop second.
85. End White turn preserves fixed piece coordinates, f7-g7 wall, and physical Curse.
86. Black pawn d4-e4 advances right under rotated orientation.
87. End Black turn with safe Kings.
88. Fanatic e2-b2 advances left through empty d2,c2,b2; replacement move, no EP.
89. End White replacement-move turn.
90. Black rook h8-e8 traverses empty g8,f8, avoiding wall.
91. End Black turn with safe Kings.
92. Cursed rook h3-h5 passes empty h4; exactly two squares respects Curse.
93. End White turn with safe Kings.
94. Split Knight d5 legally attacks e3 and c3; capture both victims and own Knight with Black as actor.
95. End Black replacement-move turn after three captures.
96. Uncursed rook d1-b1 passes empty c1.
97. End White turn with safe Kings.
98. Queen f4-d2 follows empty e3.
99. End Black turn with safe Kings.
100. Long Jump takes Knight g1 to empty opposite-color d1; replacement move without capture.
101. End White replacement-move turn.
102. Queen d2-d3 checks White King f1 through empty e2.
103. End Black turn gives White a checked turn.
104. Knight d1-c3 leaves White in check and checks Black a4; pending Charge rescue required.
105. Charge c3-e2 is second L jump after noncapture, blocks Queen d3-f1; both Kings now safe.
106. End White turn after successful rescue; no extra clock advance for Charge.
107. Black pawn a7-b7 advances right from rotated first rank, one square.
108. End Black turn with safe Kings.
109. Uncursed rook b1-e1 passes empty c1,d1.
110. End White turn with safe Kings.
111. Black rook a8-a5 passes vacant a7,a6.
112. End Black turn with safe Kings.
113. White King f1-g1 moves to safe adjacent vacancy.
114. End White turn with safe Kings.
115. Hidden Passage moves Black royal a4-a8 into safe vacancy, consuming move and card.
116. End Black replacement-move turn.
117. Promoted white pawn a2, now Bishop, moves a2-d5 through b3,c4.
118. End White turn with safe Kings.
119. Madman pawn c6-a4 jumps diagonally over own pawn b5 without capturing it.
120. End Black replacement-move turn, all EP expired.
121. White pawn f3-e3 advances left under Earthquake.
122. End White turn with safe Kings.
123. Black Queen d3-c3 moves one square along rank.
124. End Black turn; final board safe, White to act on fullmove 29.
`.trim().split('\n');

const xy = (square: string): [number, number] => [square.charCodeAt(0) - 97, Number(square[1]) - 1];
const square = (x: number, y: number): SquareName => `${String.fromCharCode(97 + x)}${y + 1}` as SquareName;
const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';

test('iteration 136 independent physical, rules and six-field FEN oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/136.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationale.length, trace.steps.length);
  assert.equal(trace.steps.length, 124);
  assert.equal(trace.steps.filter(s=>s.action.type==='move').length,50);
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,17);
  const cardTargets: Record<number, unknown> = {
    2:'e3',19:'white-hand-2-forbidden-city',21:undefined,27:'f5',32:[{from:'f4',to:'f1'}],34:undefined,
    48:[{from:'g3',to:'f3'},{from:'h4',to:'g4'}],55:[{from:'b2',to:'h2'}],64:'h3',79:{from:'f7',to:'g7'},
    84:{direction:'clockwise',promotions:[{square:'h7',role:'rook'},{square:'a2',role:'bishop'}]},88:'e2',
    94:{knight:'d5',targets:['e3','c3']},100:[{from:'g1',to:'d1'}],105:[{from:'c3',to:'e2'}],
    115:[{from:'a4',to:'a8'}],119:[{from:'c6',to:'a4'}],
  };
  let state = createGameState(trace.initial);
  let pieces = structuredClone(state.pieces);
  let players = structuredClone(state.players);
  let effects: unknown[] = [];
  let turn = structuredClone(state.turn);
  let elf: NonNullable<GameState['underElfHill']> = [];
  let ep: GameState['enPassant'] = [];
  let orientation: 0 | 270 = 0;
  let rights = 'KQkq', active = 'w', half = 0, full = 1;
  let turnSeven: { pieces: PieceState[]; players: GameState['players'] } | undefined;
  const at = (s: string) => pieces.find(p => p.zone === 'board' && p.square === s);
  const blocked = (from: string, to: string) => effects.some(e => {
    const item = e as { type: string; square?: string; from?: string; to?: string };
    return item.type === 'forbidden-city' && item.square === to
      || item.type === 'fortification' && ((item.from === from && item.to === to) || (item.to === from && item.from === to));
  });
  const geometry = (p: PieceState, to: string, capture: boolean): boolean => {
    assert.ok(p.square);
    const [x,y] = xy(p.square), [tx,ty] = xy(to), dx = tx-x, dy = ty-y;
    if (!dx && !dy || blocked(p.square, to)) return false;
    const ax=Math.abs(dx), ay=Math.abs(dy), distance=Math.max(ax,ay);
    if (p.role === 'knight') return ax*ay === 2;
    if (p.role === 'king') return distance === 1;
    if (p.role === 'pawn') {
      const sign = p.owner === 'white' ? 1 : -1;
      const forward = orientation === 0 ? dy*sign : -dx*sign;
      const sideways = orientation === 0 ? ax : ay;
      if (capture) return forward === 1 && sideways === 1;
      const rank = orientation === 0 ? (p.owner === 'white' ? y : 7-y) : (p.owner === 'white' ? 7-x : x);
      if (sideways || !(forward === 1 || forward === 2 && rank <= 1)) return false;
    } else if (!(p.role === 'queen' && (ax === ay || !dx || !dy)
      || p.role === 'bishop' && ax === ay || p.role === 'rook' && (!dx || !dy))) return false;
    if (effects.some(e => (e as {type:string;pieceId?:string}).type === 'curse'
      && (e as {pieceId?:string}).pieceId === p.id) && distance > 2) return false;
    let prev: string = p.square;
    for(let i=1;i<=distance;i++) {
      const next = square(x+Math.sign(dx)*i,y+Math.sign(dy)*i);
      if (blocked(prev,next) || i<distance && at(next)) return false;
      prev=next;
    }
    return true;
  };
  const check = (color: Color): boolean => {
    const king = pieces.find(p=>p.royal && p.owner===color && p.zone==='board');
    if (!king?.square) return false;
    return pieces.some(p=>p.zone==='board' && p.owner!==color
      && !elf.some(e=>e.pieceId===p.id && e.returned) && geometry(p,king.square!,true));
  };
  const relocate = (from: string, to: string, actor: Color, ordinary = true) => {
    const p=at(from); assert.ok(p, from);
    const victim=at(to);
    if (ordinary) assert.ok(geometry(p,to,!!victim), `${from}-${to} independent geometry`);
    if (victim) { assert.notEqual(victim.owner,actor); assert.equal(victim.royal,false); victim.square=null;victim.zone='captured';victim.capturedBy=actor; }
    p.square=to as SquareName;
    return {p,capture:!!victim};
  };
  const advance = (pawnOrCapture: boolean) => {half=pawnOrCapture?0:half+1; if(turn.color==='black')full++; active=turn.color==='white'?'b':'w';turn.phase='afterMove';turn.moveMade=true;ep=[];};
  for (const [i, step] of trace.steps.entries()) {
    const n=i+1, action=step.action, message=rationale[i]!;
    assert.ok(message.startsWith(`${n}.`));
    const before=structuredClone(state);
    if(n===31) turnSeven={pieces:structuredClone(pieces),players:structuredClone(players)};
    if(n===25) {
      for(const a of [{type:'move',from:'d8',to:'g5'},{type:'endTurn'},{type:'playCard',cardId:'disintegration',target:'f5'}] as const) {
        assert.equal(applyAction(state,a).ok,false,'return is mandatory before optional actions');
      }
      const savedPieces = structuredClone(pieces);
      const expectedReturns: string[] = [];
      for(let y=0;y<8;y++)for(let x=0;x<8;x++) {
        const destination=square(x,y);
        if(x!==0&&x!==7&&y!==0&&y!==7 || at(destination))continue;
        const king=pieces.find(p=>p.id==='black-king-e8')!;
        king.square=destination;king.zone='board';
        if(!check('black'))expectedReturns.push(destination);
        pieces=structuredClone(savedPieces);
      }
      assert.deepEqual(underElfHillReturnSquares(state).sort(),expectedReturns.sort(),'exact safe empty edge return choices');
    }
    if(n===26)assert.equal(applyAction(state,{type:'move',from:'a4',to:'b4'}).ok,false,'returned King cannot move this turn');
    if(n===32||n===105)assert.equal(applyAction(state,{type:'endTurn'}).ok,false,'unresolved self-check cannot end turn');
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.equal(turn.moveMade,false);
      const p=at(action.from); assert.ok(p); assert.equal(p.owner,turn.color);
      assert.ok(!elf.some(e=>e.returned && e.pieceId===p.id));
      const old=action.from;
      const moved=relocate(old,action.to,turn.color);
      advance(p.role==='pawn'||moved.capture);
      if(p.role==='pawn' && Math.abs(xy(old)[1]-xy(action.to)[1])===2 && orientation===0)
        ep=[{target:square(xy(old)[0],(xy(old)[1]+xy(action.to)[1])/2),pawnId:p.id}];
      if(p.royal) rights=rights.replace(p.owner==='white'?/[KQ]/g:/[kq]/g,'');
      if(p.id==='white-rook-h1')rights=rights.replace('K','');
      if(p.id==='white-rook-a1')rights=rights.replace('Q','');
    } else if(action.type==='endTurn') {
      assert.equal(turn.moveMade,true);
      assert.equal(check(turn.color),false);
      elf=elf.filter(e=>!e.returned);
      turn={color:opposite(turn.color),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      elf=elf.map(e=>e.player===turn.color?{...e,returning:true}:e);
    } else if(action.type==='returnKing') {
      assert.equal(action.to,'a4');assert.equal(at('a4'),undefined);
      const p=pieces.find(p=>p.id==='black-king-e8')!;p.zone='board';p.square='a4';
      elf=[{pieceId:p.id,player:'black',returning:true,returned:true}];
    } else if(action.type==='playCard') {
      assert.deepEqual(action.target,cardTargets[n],`${message}: exact reviewed target`);
      assert.equal(turn.phase,[21,48,88,94,100,115,119].includes(n)?'beforeMove':'afterMove',`${message}: printed timing`);
      const actor: Color=action.cardId==='toll'?'white':turn.color;
      assert.equal(turn.cardPlays[actor],0);
      const card=players[actor].hand.find(c=>c.id===action.cardInstanceId);assert.ok(card);
      assert.equal(card.cardId,action.cardId);
      players[actor].hand=players[actor].hand.filter(c=>c.id!==card.id);
      const drawn=players[actor].deck.shift();assert.ok(drawn);players[actor].hand.push(drawn);
      turn.cardPlays[actor]++;
      const continuing=['forbidden-city','curse','fortification','earthquake'].includes(card.cardId);
      if(!continuing)players[actor].discard.push(card);
      switch(n) {
        case 2: assert.equal(at('e3'),undefined);effects.push({type:'forbidden-city',owner:actor,card,square:'e3'});break;
        case 19: players.white.discard.push({id:'white-hand-2-forbidden-city',cardId:'forbidden-city'});effects=[];break;
        case 21: {const king=at('e8')!;king.square=null;king.zone='away';elf=[{pieceId:king.id,player:'black',returning:false}];rights=rights.replace(/[kq]/g,'');advance(false);break;}
        case 27: {const pawn=at('f5')!;pawn.square=null;pawn.zone='dead';delete pawn.capturedBy;break;}
        case 32: assert.ok(turnSeven);pieces=structuredClone(turnSeven.pieces);half=2;full=7;active='b';turn.phase='beforeMove';turn.moveMade=false;break;
        case 34: assert.ok(turnSeven);pieces=structuredClone(turnSeven.pieces);players.black=structuredClone(turnSeven.players.black);half=3;full=8;active='w';break;
        case 48: assert.equal(at('f3'),undefined);assert.equal(at('g4'),undefined);relocate('g3','f3',actor,false);relocate('h4','g4',actor,false);advance(true);break;
        case 55: assert.equal(at('h2'),undefined);relocate('b2','h2','white',false);break;
        case 64: effects.push({type:'curse',owner:actor,card,pieceId:'white-rook-h1'});break;
        case 79: effects.push({type:'fortification',owner:actor,card,from:'f7',to:'g7'});break;
        case 84: orientation=270;at('h7')!.role='rook';at('h7')!.promoted=true;at('a2')!.role='bishop';at('a2')!.promoted=true;effects.push({type:'earthquake',owner:actor,card,direction:'clockwise',target:{direction:'clockwise',promotions:[{square:'h7',role:'rook'},{square:'a2',role:'bishop'}]}});break;
        case 88: for(const s of ['d2','c2','b2'])assert.equal(at(s),undefined);relocate('e2','b2',actor,false);advance(true);break;
        case 94: {
          const savedPieces=structuredClone(pieces);
          assert.equal(at('d5')!.id,'black-knight-g8');
          assert.equal(at('d5')!.role,'knight');
          for(const s of ['e3','c3']) {
            assert.equal(at(s)!.owner,'white');assert.equal(at(s)!.royal,false);
            assert.ok(geometry(at('d5')!,s,true));
            relocate('d5',s,'black');
            assert.equal(check('black'),false,'each Split Knight victim is an independently legal capture');
            pieces=structuredClone(savedPieces);
          }
          for(const s of ['e3','c3','d5']){const p=at(s)!;p.zone='captured';p.square=null;p.capturedBy='black';}
          advance(true);break;
        }
        case 100: assert.equal(at('d1'),undefined);assert.notEqual((xy('g1')[0]+xy('g1')[1])%2,(xy('d1')[0]+xy('d1')[1])%2);relocate('g1','d1',actor,false);advance(false);break;
        case 105: relocate('c3','e2',actor);break;
        case 115: assert.equal(at('a8'),undefined);relocate('a4','a8',actor,false);advance(false);break;
        case 119: assert.ok(at('b5'));assert.equal(at('a4'),undefined);relocate('c6','a4',actor,false);advance(true);break;
        default: assert.fail(`unreviewed card ${n}`);
      }
    } else assert.fail(`unreviewed action ${n}`);
    const result=applyAction(state,action);
    assert.deepEqual(state,before,`${message}: input immutability`);
    assert.ok(result.ok,message);state=result.state;
    assert.deepEqual(state.pieces,pieces,`${message}: physical identities, zones and captors`);
    assert.deepEqual(state.players,players,`${message}: exact cards, draws and discards`);
    assert.deepEqual(state.effects,effects,`${message}: complete effect records`);
    assert.deepEqual(state.turn,turn,`${message}: turn and allowances`);
    assert.deepEqual(state.underElfHill??[],elf,message);
    assert.deepEqual(state.enPassant,ep,message);
    assert.equal(state.orientation,orientation,message);
    assert.equal(!!state.pendingRescue,n===31||n===104,message);
    if(n===31||n===104) {
      const pending=state.pendingRescue;assert.ok(pending?.before);
      assert.deepEqual(pending,{
        before:pending.before,fen:before.fen,pieces:before.pieces,enPassant:before.enPassant,
        historyLength:before.history.length,movedPieceIds:[n===31?'black-king-e8':'white-knight-g1'],
      },`${message}: exact rescue checkpoint fields`);
      assert.equal(pending.before.fen,before.fen);
      assert.deepEqual(pending.before.pieces,before.pieces);
      assert.deepEqual(pending.before.enPassant,before.enPassant);
      assert.deepEqual(pending.before.history,before.history);
      assert.deepEqual(pending.before.players,before.players);
      assert.deepEqual(pending.before.effects,before.effects);
    }
    assert.equal(state.pendingAbduction??null,null);assert.equal(state.pendingDoomsayer??null,null);
    assert.deepEqual(state.plotsAllowances??[],[]);assert.equal(state.chaosForbidden,undefined);
    assert.equal(state.plotsExecution,undefined);assert.equal(state.riposteSkipped,undefined);assert.equal(state.riposteCheckDeferred,undefined);
    assert.deepEqual(state.fogLocked??[],[]);assert.deepEqual(state.riposteLostMoves??[],[]);
    assert.equal(state.outcome,null,message);
    for(const color of ['white','black'] as const) {
      const expectedCheck=color==='white'?[102,103,104].includes(n):[31,61,62,104].includes(n);
      assert.equal(check(color),expectedCheck,`${message}: independently expected ${color} threat`);
      assert.equal(isKingInCheck(state,color),expectedCheck,`${message}: engine ${color} threat`);
    }
    assert.ok(pieces.every(p=>!p.neutral),'no neutral pieces exist in this trace');
    for(const opportunity of ep) {
      const victim=pieces.find(p=>p.id===opportunity.pawnId)!;
      const candidates=pieces.filter(p=>p.zone==='board'&&p.owner!==victim.owner&&p.role==='pawn'&&geometry(p,opportunity.target,true));
      assert.equal(candidates.length,0,'stored EP has no geometrically eligible opposing captor');
      const replyState = { ...state, turn: { ...state.turn, color: opposite(victim.owner), phase: 'beforeMove' as const, moveMade: false } };
      const destinations = legalDests(replyState);
      for(const pawn of pieces.filter(p=>p.zone==='board'&&p.role==='pawn'&&p.owner!==victim.owner))
        assert.ok(!(destinations.get(pawn.square!)??[]).includes(opportunity.target),'no legal EP capture');
    }
    const roleChar={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'};
    const ranks=[];
    for(let y=7;y>=0;y--){let rank='',empty=0;for(let x=0;x<8;x++){const p=at(square(x,y));if(!p){empty++;continue;}if(empty){rank+=empty;empty=0;}const ch=roleChar[p.role];rank+=p.owner==='white'?ch.toUpperCase():ch;}if(empty)rank+=empty;ranks.push(rank);}
    assert.equal(state.fen,`${ranks.join('/')} ${active} ${rights||'-'} - ${half} ${full}`,`${message}: all six FEN fields`);
  }
  assert.equal(state.fen,'k3r3/1pn3pr/3pb3/rp1B3R/p3p1P1/2q1P3/1P2NP1P/4R1KB w - - 1 29');
});

test('iteration 136 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/136.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});
