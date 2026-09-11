import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/115.json', import.meta.url), 'utf8')) as RandomTrace;
// Read in order against rules §§8–14 and the eleven played card artworks.
// Each entry describes the actual physical action; the oracle below independently
// preserves all identities, zones, capture actors, cards, effects and clocks.
const rationale = `
1. White c2-c3 advances one vacant square.
2. White closes its completed move; Black receives a fresh allowance.
3. Black g8-h6 jumps in Knight geometry to an empty square.
4. Black ends; no card draw or clock increment follows.
5. White g2-g4 crosses vacant g3 from its second rank; g3 en passant is offered.
6. White ends with that en-passant opportunity intact.
7. Black e7-e5 crosses vacant e6; replaces the old opportunity with e6.
8. Black ends retaining e6 opportunity.
9. White Bishop f1-g2 takes the vacant diagonal and expires en passant.
10. White ends with unchanged pieces.
11. Black Bishop f8-d6 crosses now-empty e7.
12. Black ends without drawing.
13. White Bishop g2-f1 returns along the clear diagonal.
14. White ends with both royal identities intact.
15. Black a7-a5 crosses empty a6; offers a6 en passant.
16. Black ends retaining the opportunity.
17. White Bishop f1-h3 crosses vacant g2 and expires en passant.
18. White ends without another move.
19. Black Queen d8-e7 moves one diagonal square.
20. Black ends with no card expenditure.
21. White g4-g5 advances one empty square.
22. White ends; no en-passant opportunity was created.
23. Blessing replaces Black's move: e5-f6 is a noncapturing diagonal Pawn relocation; spend and draw Crab.
24. Black ends its Blessing replacement move.
25. White c3-c4 advances one empty square.
26. After White's move Earthquake rotates clockwise: Black h7 promotes to Rook first, White a2 to Queen; coordinates stay fixed, white forward is left; retain effect, draw Fanatic.
27. White ends; orientation and both promotions persist.
28. Black Bishop d6-g3 crosses empty e5 and f4.
29. Black ends; Earthquake persists.
30. White Bishop h3-g2 moves to the empty diagonal.
31. White ends without changing orientation.
32. Black Knight h6-g4 jumps to an empty square.
33. Black marks c7 Pawn as Crab after its move; retain physical card, draw Ghostwalk.
34. Black ends with Crab still at c7.
35. White King e1-f1 moves one safe square; revoke KQ.
36. White ends safely on f1.
37. Black promoted Rook h7-h5 crosses empty h6.
38. Black ends; promoted identity remains Pawn h7.
39. White Queen d1-e1 moves along the vacant rank.
40. White ends; King remains f1.
41. Black Knight b8-a6 makes an empty-square jump.
42. Black ends with c7 Crab unmoved.
43. White Queen e1-d1 returns one square.
44. White ends with no physical changes.
45. Black Queen e7-e3 crosses empty e6,e5,e4.
46. Black ends; white King is safe behind its existing position.
47. White g5-e5 is a rotated second-rank double advance through empty f5; offer f5 en passant.
48. White ends retaining the rotated en-passant record.
49. Black promoted Rook h5-e5 crosses g5,f5 and captures white g2 Pawn, credited to Black; expire en passant.
50. Black ends with the Pawn captured, not dead.
51. White promoted Queen a2-b3 moves one empty diagonal square.
52. White ends with promotion retained.
53. Black Queen e3-h6 crosses empty f4,g5.
54. Black ends with no capture.
55. White h2-g3 captures the black f8 Bishop diagonally forward-left after rotation; credit White.
56. White ends with Bishop captured.
57. Black promoted Rook e5-e7 crosses empty e6.
58. Black ends without drawing.
59. White Rook h1-h4 crosses empty h2,h3.
60. Dungeon relocates Black's nonroyal promoted Rook e7-h1 to the newly empty corner; prevent its next-turn movement, spend and draw Cathedral.
61. White ends; Dungeon restriction remains for Black's upcoming turn.
62. Black Queen h6-e3 crosses empty g5,f4; the imprisoned Rook does not move.
63. Black ends; its following-turn Dungeon restriction expires.
64. Resurrection replaces White's move: captured g2 Pawn returns at empty g8, a white starting-rank square under rotation; clear capturedBy, spend and draw Betrayal.
65. White ends after its replacement move.
66. Black Queen e3-b3 crosses d3,c3 and captures the promoted white a2 Queen; credit Black and retain promotion while captured.
67. Coup after Black's capture demotes e8 King to capturable Prince and makes d7 Pawn royal without changing its move; retain card and draw Resurrection.
68. Black ends with d7 as its sole royal.
69. White Queen d1-c2 takes the empty diagonal.
70. White ends without changing the Coup effect.
71. Black Knight a6-c5 jumps to an empty square.
72. Black ends with royal Pawn still d7.
73. White Rook h4-h6 crosses empty h5.
74. White ends safely.
75. Black promoted Rook h1-h2 may now move because Dungeon expired.
76. Black ends with no restriction left.
77. Dubbing replaces White's move: f2 Pawn jumps to empty d3 in Knight geometry and remains a Pawn; spend and draw Ghostwalk.
78. White ends its replacement move.
79. Ghostwalk replaces Black's move: a8 Rook passes empty b8 and friendly Bishop c8 to empty d8; revoke q, spend and draw Evangelists.
80. Black ends with the Bishop still c8.
81. White Bishop g2-c6 crosses f3,e4,d5 and gives check to the royal Pawn d7.
82. White ends; Black receives its check-response turn.
83. Black royal Pawn d7-e7 advances right under rotation and escapes c6 Bishop check; revoke remaining k.
84. Black ends with its royal Pawn safe on e7.
85. White Rook h6-h4 crosses empty h5.
86. White ends with no capture.
87. Black Bishop c8-f5 crosses empty d7,e6.
88. Black ends; royal Pawn remains e7.
89. White Bishop c6-e8 crosses empty d7 and captures the e8 Prince, now nonroyal under Coup; credit White.
90. White ends; capturing the Prince did not win or remove the royal Pawn.
91. Black Knight c5-d3 captures the white f2 Pawn; credit Black.
92. Black ends with the Pawn captured.
93. White Rook h4-h2 crosses h3 and captures Black's promoted h7 Rook; credit White.
94. White ends; captured Rook preserves promoted identity.
95. Black Rook d8-d7 moves one vacant square.
96. Black ends without castling rights.
97. White Bishop e8-d7 captures that Rook; credit White.
98. White ends; black royal e7 is not on the Bishop's diagonal.
99. Black Queen b3-b4 moves one vacant square.
100. Black ends; no effects expire.
101. White Rook h2-g2 moves one vacant square.
102. White ends; no draw without a card.
103. Evangelists replaces Black's move, simultaneously swapping black f5 and white d7 Bishops without captures; spend and draw Fireball.
104. Black ends the replacement move.
105. White g8-f8 Pawn advances left, not toward conventional rank eight; no promotion, and its forward diagonal e7 checks Black's royal Pawn.
106. White ends with unpromoted Pawn f8; Black receives the response to its e7 check.
107. Black Rook h8-f8 crosses g8 and captures the checking white g2 Pawn; credit Black and cure the royal e7 check.
108. Black ends; the captured Pawn remains eligible for return.
109. White Rook g2-f2 moves one vacant square.
110. White ends without extra clock movement.
111. Black Queen b4-d2 crosses empty c3 and captures white d2 Pawn; credit Black.
112. No Quarter follows that ordinary capture: d2 Pawn becomes dead, clearing capturedBy; spend and draw Doppelganger.
113. Black ends; dead Pawn cannot be returned.
114. Winged Victory replaces White's move: return captured g2 Pawn to empty central d5, clear capturedBy; spend and draw Treason.
115. White ends after returning the eligible captured Pawn.
116. Black g7-h7 advances right to its rotated last rank and promotes to Rook.
117. Black ends with 50 regular moves complete and both royals safe.
`.trim().split('\n');

test('iteration 115 complete independent physical transition oracle', () => {
  assert.equal(rationale.length, trace.steps.length);
  const initial = createGameState(trace.initial);
  let actual = initial;
  const pieces = structuredClone(initial.pieces);
  const players = structuredClone(initial.players);
  let effects: unknown[] = [];
  let turn = structuredClone(initial.turn);
  let orientation: GameState['orientation'] = 0;
  let ep: GameState['enPassant'] = [];
  let rights = 'KQkq', half = 0, full = 1, fenColor = 'w';
  const at = (s: string) => pieces.find(p => p.zone === 'board' && p.square === s);
  const id = (s: string) => { const p = pieces.find(p => p.id === s); assert.ok(p); return p; };
  const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
  const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
  const removeRights = (p: PieceState, square: string) => {
    if (p.royal) rights = rights.replace(p.owner === 'white' ? /[KQ]/g : /[kq]/g, '');
    if (p.role === 'rook' || p.originalRole === 'rook') {
      const right: Record<string, string> = { a1: 'Q', h1: 'K', a8: 'q', h8: 'k' };
      if (right[square]) rights = rights.replace(right[square]!, '');
    }
  };
  const clearRay = (from: string, to: string, ghost = false) => {
    const [x,y] = xy(from), [tx,ty] = xy(to), dx = Math.sign(tx-x), dy = Math.sign(ty-y);
    for (let n=1; n<Math.max(Math.abs(tx-x),Math.abs(ty-y)); n++) {
      const p=at(String.fromCharCode(97+x+dx*n)+(y+dy*n+1));
      if (p && !(ghost && p.owner === turn.color)) return false;
    }
    return true;
  };
  const attacks = (p: PieceState, to: string, step: number) => {
    if (!p.square || p.zone !== 'board') return false;
    if (p.id === 'black-pawn-h7' && step >= 61 && step < 63) return false;
    const [x,y]=xy(p.square), [tx,ty]=xy(to), dx=tx-x, dy=ty-y;
    if (!dx && !dy) return false;
    if (p.role === 'pawn') return orientation === 0
      ? Math.abs(dx) === 1 && dy === (p.owner === 'white' ? 1 : -1)
      : Math.abs(dy) === 1 && dx === (p.owner === 'white' ? -1 : 1);
    if (p.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2;
    if (p.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1;
    const aligned = p.role === 'bishop' ? Math.abs(dx) === Math.abs(dy)
      : p.role === 'rook' ? !dx || !dy : !dx || !dy || Math.abs(dx) === Math.abs(dy);
    return aligned && clearRay(p.square,to);
  };
  const checked = (color: Color, step: number) => {
    const royal=pieces.find(p=>p.owner===color && p.royal); assert.ok(royal?.square);
    return pieces.some(p=>p.owner!==color && attacks(p,royal.square!,step));
  };
  const move = (from: string, to: string, promotion?: unknown, mode = 'ordinary') => {
    assert.match(from,/^[a-h][1-8]$/); assert.match(to,/^[a-h][1-8]$/);
    const p=at(from); assert.ok(p); assert.equal(p.owner,turn.color);
    const victim=at(to), [x,y]=xy(from), [tx,ty]=xy(to), dx=tx-x,dy=ty-y;
    if (mode === 'blessing') { assert.equal(Math.abs(dx),Math.abs(dy)); assert.ok(clearRay(from,to)); assert.equal(victim,undefined); }
    else if (mode === 'dubbing') { assert.equal(Math.abs(dx)*Math.abs(dy),2); assert.equal(victim,undefined); }
    else if (mode === 'ghostwalk') { assert.equal(p.role,'rook'); assert.ok(!dx || !dy); assert.ok(clearRay(from,to,true)); assert.equal(victim,undefined); }
    else if (p.role === 'pawn') {
      const forward=orientation === 0 ? dy*(p.owner==='white'?1:-1) : dx*(p.owner==='white'?-1:1);
      const sideways=orientation===0?dx:dy;
      if (victim) { assert.equal(forward,1); assert.equal(Math.abs(sideways),1); }
      else {
        assert.equal(sideways,0); assert.ok(forward===1 || forward===2);
        if (forward===2) {
          const rank=orientation===0?(p.owner==='white'?y:7-y):(p.owner==='white'?7-x:x);
          assert.ok(rank<=1); assert.ok(clearRay(from,to));
        }
      }
    } else assert.ok(attacks(p,to,0),`${from}-${to} ordinary geometry and path`);
    ep=[];
    if (mode === 'ordinary' && p.role === 'pawn' && Math.max(Math.abs(dx),Math.abs(dy))===2)
      ep=[{ target:(String.fromCharCode(97+(x+tx)/2)+((y+ty)/2+1)) as SquareName,pawnId:p.id }];
    half= victim || (p.originalRole==='pawn' && !p.promoted) ? 0 : half+1;
    removeRights(p,from);
    if (victim) {
      assert.notEqual(victim.owner,p.owner); assert.equal(victim.royal,false); removeRights(victim,to);
      victim.square=null; victim.zone='captured'; victim.capturedBy=turn.color;
    }
    p.square=to as SquareName;
    if (promotion !== undefined) { assert.equal(p.role,'pawn'); assert.equal(to[0],p.owner==='black'?'h':'a'); assert.equal(promotion,'rook'); p.role='rook';p.promoted=true; }
  };
  for (const [index,{action}] of trace.steps.entries()) {
    const step=index+1, note=rationale[index]!;
    assert.ok(note.startsWith(`${step}. `));
    const untouched=structuredClone(actual), actor=turn.color;
    let consumesMove=false;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.equal(turn.moveMade,false); move(action.from,action.to,action.promotion); consumesMove=true;
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade,true); assert.equal(checked(actor,step),false,note);
      turn={color:opposite(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      if (step===63) effects=effects.filter(e=>(e as {type:string}).type!=='dungeon');
    } else if (action.type === 'playCard') {
      const player=players[actor], pos=player.hand.findIndex(c=>c.id===action.cardInstanceId);
      assert.ok(pos>=0); assert.equal(turn.cardPlays[actor],0);
      const card=player.hand.splice(pos,1)[0]!; assert.equal(card.cardId,action.cardId);
      const continuing=['earthquake','crab','coup'].includes(card.cardId);
      if (!continuing) player.discard.push(card);
      const drawn=player.deck.shift(); assert.ok(drawn); player.hand.push(drawn);
      turn.cardPlays[actor]++;
      const replacement=[23,64,77,79,103,114].includes(step);
      assert.equal(turn.phase,replacement?'beforeMove':'afterMove',note);
      consumesMove=replacement;
      switch(step) {
        case 23: assert.equal(card.cardId,'blessing'); assert.deepEqual(action.target,[{from:'e5',to:'f6'}]); move('e5','f6',undefined,'blessing'); break;
        case 26: {
          const target={direction:'clockwise',promotions:[{square:'h7',role:'rook'},{square:'a2',role:'queen'}]};
          assert.deepEqual(action.target,target); orientation=270;
          Object.assign(id('black-pawn-h7'),{role:'rook',promoted:true});
          Object.assign(id('white-pawn-a2'),{role:'queen',promoted:true});
          effects.push({type:'earthquake',owner:actor,card,direction:'clockwise',target}); break;
        }
        case 33: assert.equal(action.target,'c7'); effects.push({type:'crab',owner:actor,card,pieceId:'black-pawn-c7'}); break;
        case 60: assert.deepEqual(action.target,[{from:'e7',to:'h1'}]); assert.equal(at('h1'),undefined);id('black-pawn-h7').square='h1';effects.push({type:'dungeon',owner:actor,player:'black',pieceId:'black-pawn-h7'});break;
        case 64: case 114: {
          const to=step===64?'g8':'d5';assert.deepEqual(action.target,{pieceId:'white-pawn-g2',to});
          const p=id('white-pawn-g2');assert.equal(p.zone,'captured');assert.equal(p.capturedBy,'black');assert.equal(at(to),undefined);
          p.zone='board';p.square=to;delete p.capturedBy;delete p.capturedAtPly;half=0;ep=[];break;
        }
        case 67: assert.equal(action.target,'d7');id('black-king-e8').royal=false;id('black-pawn-d7').royal=true;
          effects.push({type:'coup',owner:actor,card,princeId:'black-king-e8',kingId:'black-pawn-d7',princeRole:'king'});break;
        case 77: assert.deepEqual(action.target,[{from:'f2',to:'d3'}]);move('f2','d3',undefined,'dubbing');break;
        case 79: assert.deepEqual(action.target,[{from:'a8',to:'d8'}]);move('a8','d8',undefined,'ghostwalk');break;
        case 103: assert.deepEqual(action.target,{own:'f5',opponent:'d7'});id('black-bishop-c8').square='d7';id('white-bishop-f1').square='f5';half++;ep=[];break;
        case 112: assert.equal(action.target,undefined);assert.equal(id('white-pawn-d2').zone,'captured');id('white-pawn-d2').zone='dead';delete id('white-pawn-d2').capturedBy;break;
        default: assert.fail(`unreviewed card at ${step}`);
      }
      // None of these regular cards checks the opposing royal, so none directly mates.
      assert.equal(checked(opposite(actor),step),false,note);
    } else assert.fail(`unreviewed action ${step}`);
    if (consumesMove) {turn.moveMade=true;turn.phase='afterMove';fenColor=actor==='white'?'b':'w';if(actor==='black')full++;}
    if (action.type!=='endTurn') assert.equal(checked(actor,step),false,note);
    assert.equal(checked('white',step),false,`${note}: White royal safety`);
    assert.equal(checked('black',step),[81,82,105,106].includes(step),`${note}: Black royal check timeline`);
    const result=applyAction(actual,action);
    assert.deepEqual(actual,untouched,`${note}: complete input immutability`);assert.ok(result.ok,note);
    actual=result.state;
    assert.deepEqual(actual.pieces,pieces,`${note}: all physical identity and capturedBy fields`);
    assert.deepEqual(actual.players,players,`${note}: complete card zones`);
    assert.deepEqual(actual.effects,effects,`${note}: complete effects`);
    assert.deepEqual(actual.turn,turn,note);assert.equal(actual.orientation,orientation,note);
    assert.deepEqual(actual.enPassant,ep,note);
    assert.equal(!!actual.pendingRescue,false,note);
    assert.equal(actual.pendingDoomsayer??null,null,note);assert.equal(actual.pendingAbduction??null,null,note);
    assert.deepEqual(actual.underElfHill??[],[],note);assert.equal(actual.outcome,null,note);
    const rows=[];
    for(let y=7;y>=0;y--){let row='',empty=0;for(let x=0;x<8;x++){
      const p=at(String.fromCharCode(97+x)+(y+1));if(!p){empty++;continue;}if(empty){row+=empty;empty=0;}
      const letter={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'}[p.role];row+=p.owner==='white'?letter.toUpperCase():letter;
    }if(empty)row+=empty;rows.push(row);}
    // All four double advances have no geometrically eligible enemy captor;
    // the rotated opportunity is authoritative in enPassant, never a FEN EP square.
    assert.equal(actual.fen,`${rows.join('/')} ${fenColor} ${rights||'-'} - ${half} ${full}`,note);
  }
  assert.equal(trace.steps.filter(s=>s.action.type==='move').length,50);
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,11);
  assert.equal(actual.fen,'5r2/1ppbpp1r/5p2/p2P1B2/2P3n1/3n2P1/1PQqPR2/RNB2KN1 w - - 0 29');
});
test('iteration 115 independently reviewed replay', () => {
  const replay = replayTrace(trace);
  assert.ok(replay);
});
