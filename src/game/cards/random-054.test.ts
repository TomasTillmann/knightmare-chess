import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import { CARD_CATALOG } from './catalog.js'

// Each entry is a chronological rules review, not a generated acceptance label.
const rationales = `
1. c2-c3 advances the white pawn one vacant square; no King is exposed.
2. White closes its completed move; Black receives an unused turn.
3. b8-c6 is a knight jump to an empty square; Black remains safe.
4. Black closes; White starts, with no card or piece changes.
5. g2-g4 passes empty g3, creates g3 en passant, and resets the pawn clock.
6. White closes; the new en-passant opportunity survives into Black's turn.
7. b7-b5 passes empty b6 and replaces the old en-passant opportunity.
8. Black closes; b6 en passant remains available for White.
9. b2-b4 passes b3 and stops before the black b5 pawn without capturing it.
10. White closes; Black starts with b3 en passant and no adjacent capturer.
11. c6-a5 is a legal knight jump; the previous en-passant right expires.
12. Black closes without spending or drawing a card.
13. f2-f3 is a quiet one-square pawn advance, clearing the clock.
14. After-move Coup marks the safe f3 pawn royal and demotes e1 to Prince; the retained card draws Mystic Shield once.
15. White closes; Coup's physical identities and pawn movement remain in force.
16. a7-a6 advances into vacancy; Black's e8 King remains sheltered.
17. Black closes; no continuing effect expires.
18. g1-h3 is a knight jump and leaves the new royal pawn f3 safe.
19. White closes; Black has a fresh own-turn card allowance.
20. Breakthrough replaces Black's move: b5 captures the white b4 pawn straight forward; discard and draw Knightmare once.
21. Black closes the replacement move; no additional ordinary move is granted.
22. e2-e3 is a legal pawn advance with royal f3 unaffected.
23. Black reacts with Knightmare: e3 returns to e2, clock and active side rewind, and e2-e3 becomes forbidden; draw Mystic Shield.
24. e2-e4 is a distinct move through e3, allowed after the rewind; records e3 en passant.
25. White closes; Black's reaction allowance resets for the next turn.
26. a5-c4 is an unobstructed knight jump; no attack reaches royal f3.
27. Black closes and clears no persistent Coup marker.
28. f1-g2 is a one-step diagonal bishop move into vacancy.
29. White closes the bishop move with both Kings safe.
30. c4-b2 is a knight jump to the square vacated by the captured white pawn.
31. Black closes; the knight threatens ordinary pieces, not royal f3.
32. e4-e5 is a legal single pawn advance; no promotion is due.
33. White closes; Black has its normal move and card allowance.
34. h7-h5 passes vacant h6 and records h6 en passant.
35. Black's after-move Mystic Shield protects the just-moved h5 pawn through White's next turn; discard and draw Resurrection.
36. Black closes; the shield must remain for White's turn.
37. h3-g5 is a knight jump, not a capture of protected h5.
38. White closes; Black's Mystic Shield has now served its full opposing turn and expires.
39. b2-d1 jumps onto and captures White's ordinary queen; royal f3 stays safe.
40. Black closes the capture with its King safe.
41. Bombard replaces White's move: rook h1 jumps the sole h2 pawn, crosses vacant h3, lands h4; h1 castling right is lost and Tournament drawn.
42. White closes its Bombard move; no extra ordinary move is available.
43. b4-c3 is a forward diagonal black pawn capture of the c2-origin pawn.
44. Black closes; captured identities stay in the captured zone.
45. g5-f7 is a knight capture of Black's f7 pawn; the e8 King is not attacked by f7.
46. Black's immediate Riposte restores f7 and captures the knight; it discards/draws Charge and owes exactly its next move.
47. White closes; Black's owed move is automatically consumed, advancing its clock and opening afterMove.
48. Black closes the forfeited move; White starts normally and the penalty has expired.
49. Tournament replaces White's move by swapping b1 white and g8 black knights without capture; identities persist and Fortification is drawn.
50. White closes the swap; royal f3 and black e8 remain safe.
51. a8-b8 slides one square to vacancy, revoking Black's queenside castling right.
52. Black closes the rook move without card changes.
53. Prince e1-e2 moves one square; royal safety belongs to f3, and remaining white castling rights disappear.
54. White closes; the Prince is capturable and the f3 pawn remains royal.
55. a6-a5 is a one-step forward black pawn move into vacancy.
56. Black closes; clocks and board remain fixed during the handoff.
57. Prince e2-f2 moves one adjacent square; f3 remains the unmoved royal identity.
58. After-move Fortification retains a wall on adjacent f5/g6, draws Panic, and changes neither board nor clocks.
59. White closes; Coup and the f5/g6 wall persist.
60. d7-d5 passes empty d6 and records d6 en passant; it does not cross the distant wall.
61. Black closes; White could use the immediate en-passant opportunity.
62. a2-a3 is a quiet pawn step; declining en passant expires it.
63. White closes; the wall and royal pawn are unchanged.
64. d5-d4 is a one-square black pawn advance into vacancy.
65. Black closes without drawing or spending.
66. Prince f2-e3 moves diagonally into a square attacked by d4, which is allowed for a non-royal Prince; f3 stays safe.
67. White closes; an attacked Prince is not check against its royal pawn.
68. b8-b2 slides through empty b7,b6,b5,b4,b3; friendly b1 lies beyond the destination.
69. Black closes; rook b2 does not threaten f3.
70. Prince e3-d4 captures the black d7-origin pawn; the f3 royal pawn is unaffected.
71. White closes; the captured d7 pawn remains eligible for return.
72. c3-d2 captures White's ordinary d2 pawn diagonally forward; no promotion yet.
73. Black closes; royal f3 remains safe.
74. a1-b1 captures the black g8-origin knight, preserving the rook identity.
75. White closes; Black's captured pawn and knight are distinct identities.
76. Resurrection replaces Black's move and returns its captured d7 pawn to vacant starting square d7; clock resets and Heresy is drawn.
77. Black closes the replacement move; no extra ordinary move is available.
78. g4-g5 is a one-square white pawn advance into vacancy, off the wall edge.
79. White closes; neither King is under attack.
80. Returned pawn d7-d6 advances normally; it is the same physical d7 pawn.
81. Black closes without affecting the continuing cards.
82. g2-h3 is a quiet one-square bishop diagonal; f3 royalty is unchanged.
83. White closes; the bishop remains free of the f5/g6 wall.
84. b2-c2 is a one-square rook slide into vacancy.
85. Black closes; c2 rook threatens c1 bishop, not f3 King.
86. h4-h5 captures Black's h7 pawn; its old Mystic Shield expired at action 38.
87. White closes; h7 pawn is captured, not dead.
88. c2-c1 captures White's original c1 bishop in a one-square rook move.
89. Black closes; no card response is selected.
90. h5-h6 is a quiet rook step and leaves royal f3 safe.
91. White closes; no Merciless card was played, so no extra move exists.
92. Passing in the Night replaces Black's move: d2/a3 and g7/g5 pawn pairs swap simultaneously, preserving ownership, with no capture; draw Peace Talks.
93. Black closes; g7 is a white unpromoted pawn, and d2 holds the a2-origin white pawn.
94. h6-h5 returns the rook one square without capture or crossing the wall.
95. White closes with both Kings safe.
96. d1-f2 is a knight jump into vacancy; it does not attack royal f3.
97. Black closes; the attacked h3 bishop is ordinary and may remain attacked.
98. b1-b8 slides through vacant b2,b3,b4,b5,b6,b7; c8 bishop blocks a line to Black's King.
99. White closes; b8 rook gives no check through the c8 bishop.
100. f8-g7 captures the swapped white g2-origin pawn; Black's King remains screened.
101. Black closes the bishop capture with no card use.
102. b8-b5 slides through empty b7 and b6, ending in vacancy.
103. White closes; the b5 rook remains ordinary.
104. a5-a4 advances Black's pawn; its own a3 pawn blocks a later advance, not this one.
105. Black closes without affecting either royal identity.
106. h3-c8 captures the bishop via vacant g4,f5,e6,d7; f5-e6 does not cross wall f5-g6.
107. White closes; c8 white bishop does not check e8 on the same rank.
108. c7-c5 passes vacant c6 and creates c6 en passant; c5 attacks the Prince d4, not royal f3.
109. After-move Doomsayer is retained, draws Lost Castle once, and offers White the immediate naming option.
110. White names rook and selects its h1-origin rook on h5: that rook is captured, Doomsayer discarded, and c6 en passant preserved.
111. Black closes after the naming choice; no further card draw occurs.
112. b5-b4 is a quiet rook step; the unused c6 en-passant opportunity expires.
113. White closes; the Prince remains allowed to stand on attacked d4.
114. c1-b1 is a quiet rook slide to vacancy and leaves Black's e8 King safe.
115. Black closes; White has its final ordinary move available.
116. b4-b7 slides through vacant b5,b6 to vacant b7; the rook and royal pawn retain their identities.
117. White closes the fiftieth regular move command; Black starts with both persistent effects, no pending choice, and both Kings safe.
`.trim().split('\n')

test('iteration 054 deterministic campaign trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/054.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860054)
  assert.equal(rationales.length, 117)
  assert.equal(trace.steps.length, rationales.length)
  rationales.forEach((line, i) => assert.ok(line.startsWith(`${i + 1}. `)))
  const captures: Record<number, string> = {39:'white-queen-d1',43:'white-pawn-c2',45:'black-pawn-f7',70:'black-pawn-d7',72:'white-pawn-d2',74:'black-knight-g8',86:'black-pawn-h7',88:'white-bishop-c1',100:'white-pawn-g2',106:'black-bishop-c8'}
  let state = createGameState(trace.initial)
  for (const [index, {action}] of trace.steps.entries()) {
    const n = index + 1
    const before = state
    const result = applyAction(before, action)
    assert.ok(result.ok, rationales[index])
    state = result.state
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from = action.from, to = action.to
      const mover = before.pieces.find(p => p.square === from && p.zone === 'board')!
      assert.equal(mover.owner, before.turn.color)
      const victim = before.pieces.find(p => p.square === to && p.zone === 'board')
      assert.equal(victim?.id, captures[n], rationales[index])
      const dx = to.charCodeAt(0) - from.charCodeAt(0), dy = Number(to[1]) - Number(from[1])
      const ax = Math.abs(dx), ay = Math.abs(dy)
      if (mover.role === 'knight') assert.equal(ax * ay, 2)
      else if (mover.role === 'king') assert.equal(Math.max(ax, ay), 1)
      else if (mover.role === 'pawn') {
        assert.equal(dx === 0, !victim)
        assert.ok(victim ? ax === 1 && ay === 1 : ax === 0 && (ay === 1 || ay === 2 && from[1] === (mover.owner === 'white' ? '2' : '7')))
        assert.equal(Math.sign(dy), mover.owner === 'white' ? 1 : -1)
      } else assert.ok(mover.role === 'rook' ? dx === 0 || dy === 0 : ax === ay)
      if (mover.role !== 'knight') {
        const length = Math.max(ax, ay)
        let previous = from
        for (let k = 1; k <= length; k++) {
          const square = `${String.fromCharCode(from.charCodeAt(0) + Math.sign(dx)*k)}${Number(from[1]) + Math.sign(dy)*k}`
          if (k < length) assert.ok(!before.pieces.some(p => p.zone === 'board' && p.square === square))
          if (n > 58) assert.ok(!([previous,square].includes('f5') && [previous,square].includes('g6')))
          previous = square
        }
      }
      assert.deepEqual(state.pieces, before.pieces.map(p => p.id === mover.id ? {...p,square:to} : p.id === victim?.id ? {...p,square:null,zone:'captured'} : p), rationales[index])
      assert.equal(state.fen.split(' ')[4], mover.role === 'pawn' || victim ? '0' : String(Number(before.fen.split(' ')[4]) + 1))
      assert.deepEqual(state.enPassant, mover.role === 'pawn' && ay === 2 ? [{target:`${from[0]}${(Number(from[1])+Number(to[1]))/2}`,pawnId:mover.id}] : [])
      assert.deepEqual(state.players, before.players)
    }
    if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black'
      const card = before.players[owner].hand.find(c => c.id === action.cardInstanceId)!
      assert.ok(card)
      const catalog = CARD_CATALOG[card.cardId]!
      assert.ok(catalog.timing.includes(owner === before.turn.color ? before.turn.phase : 'afterOpponentMove'))
      assert.equal(before.turn.cardPlays[owner], 0)
      assert.equal(state.turn.cardPlays[owner], 1)
      assert.deepEqual(state.players[owner].hand, [...before.players[owner].hand.filter(c=>c.id!==card.id),before.players[owner].deck[0]])
      assert.deepEqual(state.players[owner].deck, before.players[owner].deck.slice(1))
      assert.deepEqual(state.players[owner].discard, catalog.continuing ? before.players[owner].discard : [...before.players[owner].discard,card])
    }
    if (action.type === 'endTurn') {
      assert.deepEqual(state.pieces,before.pieces)
      assert.deepEqual(state.players,before.players)
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white')
      assert.equal(state.turn.moveMade,n===47)
      assert.equal(state.turn.phase,n===47?'afterMove':'beforeMove')
      assert.deepEqual(state.turn.cardPlays,{white:0,black:0})
      if(n!==47) assert.equal(state.fen,before.fen)
    }
    const piece = (id:string) => state.pieces.find(p=>p.id===id)!
    if(n>=14) {
      assert.equal(piece('white-pawn-f2').royal,true)
      assert.equal(piece('white-pawn-f2').square,'f3')
      assert.equal(piece('white-king-e1').royal,false)
    }
    if(n===14) assert.deepEqual(state.effects,[{type:'coup',owner:'white',card:{id:'white-hand-2-coup',cardId:'coup'},princeId:'white-king-e1',kingId:'white-pawn-f2',princeRole:'king'}])
    if(n===20) { assert.equal(piece('white-pawn-b2').zone,'captured'); assert.equal(piece('black-pawn-b7').square,'b4') }
    if(n===23) { assert.equal(piece('white-pawn-e2').square,'e2'); assert.equal(state.turn.moveMade,false); assert.equal(state.fen,'r1bqkbnr/2pppppp/p7/n7/1p4P1/2P2P1N/P2PP2P/RNBQKB1R w KQkq - 0 6') }
    if(n===35) assert.deepEqual(state.effects.at(-1),{type:'mystic-shield',owner:'black',player:'black',pieceId:'black-pawn-h7'})
    if(n===38) assert.equal(state.effects.length,1)
    if(n===41) { assert.equal(piece('white-rook-h1').square,'h4'); assert.equal(piece('white-pawn-h2').square,'h2') }
    if(n===46) { assert.equal(piece('white-knight-g1').zone,'captured'); assert.equal(piece('black-pawn-f7').square,'f7') }
    if(n===47) assert.equal(state.fen,'r1bqkbnr/2ppppp1/p7/4P2p/6PR/2p2P2/P2P2BP/RNBnK3 w Qkq - 1 12')
    if(n===49) { assert.equal(piece('white-knight-b1').square,'g8'); assert.equal(piece('black-knight-g8').square,'b1') }
    if(n>=58) assert.deepEqual(state.effects[1],{type:'fortification',owner:'white',card:{id:'white-deck-2-fortification',cardId:'fortification'},from:'f5',to:'g6'})
    if(n===76) { assert.equal(piece('black-pawn-d7').square,'d7'); assert.equal(piece('black-pawn-d7').zone,'board'); assert.equal(state.turn.moveMade,true) }
    if(n===92) assert.deepEqual(['white-pawn-a2','white-pawn-g2','black-pawn-b7','black-pawn-g7'].map(id=>piece(id).square),['d2','g7','a3','g5'])
    if(n===109) assert.deepEqual(state.effects.at(-1),{type:'doomsayer',owner:'black',card:{id:'black-hand-1-doomsayer',cardId:'doomsayer'}})
    if(n===110) { assert.equal(piece('white-rook-h1').zone,'captured'); assert.equal(state.effects.length,2); assert.equal(state.players.black.discard.at(-1)?.cardId,'doomsayer'); assert.deepEqual(state.enPassant,[{target:'c6',pawnId:'black-pawn-c7'}]) }
    assert.ok(!state.pendingRescue,rationales[index])
  }
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,11)
  assert.equal(state.fen,'2Bqk1Nr/1R2ppb1/3p4/2p1P1p1/p2K4/p4P2/3P1n1P/1r6 b k - 3 28')
  assert.equal(replayTrace(trace).fen,state.fen)
})
