# Knightmare Chess: Complete Rules and Adversarial Rulings Guide

## 1. Scope and authority

Knightmare Chess is standard chess modified by cards. The ordinary chess position is the foundation; cards temporarily or permanently override parts of it.

This document combines:

- the Steve Jackson Games rulebook;
- the Steve Jackson Games *Official Rulings* FAQ;
- the 80 card effects preserved in [`cards.md`](./cards.md); and
- explicit interpretations for cases that the available material does not settle.

When this document says **official**, the result follows the rulebook or official FAQ. When it says **recommended ruling**, it is a deterministic house rule intended to prevent arguments or make a software implementation possible.

The local card list is incomplete as a playable data source. It contains 80 effect descriptions, but not the printed timing line, point value, unique-card marker, or explicit Continuing Effect label for each card. The combined edition described by Steve Jackson Games contains 158 designed cards plus two blanks. Therefore, use the physical cards for timing and deck construction until that missing metadata is restored.

## 2. Object of the game

The ordinary goal is to checkmate the opposing King. A King is never captured.

Knightmare Chess changes when mate becomes final. A position that appears to be checkmate after one player's turn is not necessarily the end: the checked player receives a turn and may escape with a legal card. The game ends when that player cannot escape checkmate on their own turn.

Unless a card says otherwise, ordinary chess draw conditions still apply. Because cards can disturb repetition and pawn/capture counters, players should agree before play whether they are using current FIDE draw rules, casual chess conventions, or only stalemate and mutual agreement.

## 3. Required material

- One standard 8-by-8 chessboard.
- One standard set of chess pieces.
- A Knightmare Chess deck or one deck per player.
- Distinct markers for Continuing Effects, transformed pieces, Pacifism, Curse, Crab, Coup, Forbidden City, Fortification, Fatal Attraction, and similar effects.
- Paper or another tamper-evident method for Man-Trap.
- A timer capable of measuring 15 seconds for Panic.

Markers must identify both the affected object and the card causing the effect. Two identical markers—one on the card and one on the piece or square—are ideal.

## 4. Building decks

### 4.1 Standard separate-deck game

Divide the available cards equally. Each player constructs a play deck with a total printed value of 150 points. Agreeing on another total is allowed. A stronger chess player may receive a smaller point allowance as a handicap.

A card marked with an asterisk is **unique**. A player's deck may contain at most one copy of that named card, even when several physical sets are available.

Point values matter only during deck construction. They are not spent while playing.

### 4.2 Common-deck variant

The published rules also describe a common deck in the middle of the table. Both players draw from it and share a discard pile. In this variant:

- a player may discard and replace a card whenever they do not play a card on the opponent's turn;
- the normal own-turn discard option remains; and
- when the deck empties, shuffle the discard pile to form a new deck.

Do not silently mix the separate-deck and common-deck replenishment rules.

### 4.3 Local-file limitation

`cards.md` cannot support legal 150-point deck construction because point values and unique markers are missing. A fair temporary alternative is to shuffle the same number of random cards to each player, but that is a house variant, not standard deck construction.

## 5. Setup

1. Set up the board and pieces as in standard chess.
2. Determine colors and first player by agreement or any fair method. Standard White-first play is recommended.
3. Shuffle each play deck.
4. Each player draws five cards.
5. Put each deck face down and leave room for a face-up discard pile.
6. Put markers, timer, and Man-Trap paper within reach.

Cards in hand are private. Board state, discard piles, Continuing Effect cards, and markers are public unless a card explicitly creates secret information.

## 6. Essential terminology

### Turn

The period of one player's action. It normally contains one move and optionally one card. The opponent may also play an eligible card during or immediately after it.

### Move

The displacement of one piece from one square to another. It may be a Regular Move or a move created by a regular card. Some cards produce several moves or simultaneous relocation; follow their text.

### Regular Move

A move legal under ordinary chess after applying all active Continuing Effects.

### Regular card

A card that is not labeled as a Continuing Effect.

### Continuing Effect

A card explicitly labeled as such. It remains beside the board rather than entering the discard pile. Its effect can persist for the rest of the game.

### Piece

Includes pawns unless a rule says otherwise.

### Adjacent

Any square sharing an edge or corner with the given square: up to eight squares.

### Capture, lost, removed, and dead

- **Captured**, **lost**, and **removed from play** normally place a piece among the captured pieces. Such a piece may be returned by a suitable card.
- **Dead** is a separate, irreversible state. A dead piece is set aside and cannot be returned.
- A card that merely relocates, swaps, transforms, neutralizes, or changes allegiance does not capture the piece unless it says so.

### Return

Place a captured piece back into play. Dead pieces cannot return.

### Replace

Remove one piece and put another in its place. If the replacement must be captured, a dead piece is ineligible.

### Swap

Exchange the squares of two pieces. A swap is not a capture and does not require either piece to possess a legal move to the other's square unless the card adds that requirement.

### Threaten

A piece threatens a square if it could make the relevant capture under the rules currently governing it. A piece prevented from moving or capturing does not give check merely because its ordinary chess geometry points at the King.

## 7. Anatomy of a card play

Every physical card has four pieces of rules information:

1. name;
2. point value and possible unique marker;
3. effect text; and
4. timing text, plus a Continuing Effect label where applicable.

The timing text is a permission, not flavor. A card legal "before your move" cannot be saved as an after-move reaction. A card triggered by a capture cannot be played on a non-capture. If a trigger has passed, the opportunity has passed.

Card effects fall into practical families:

- **move modifiers**, such as Blessing, Dubbing, Ghostwalk, or Bombard;
- **replacement moves**, such as Guardian or many relocation/swap effects;
- **additional moves**, such as Charge!, Crusade, and Merciless;
- **reactions**, such as Bog, Hostage, Riposte, Fog of War, and the move-canceling cards;
- **direct state changes**, such as Revenge, Disintegration, Resurrection, and Forbidden City; and
- **Continuing Effects**, such as Pacifism, Crab, Curse, Confabulation, Fatal Attraction, and Truce when their physical cards carry that label.

Do not infer timing or persistence solely from the effect prose in `cards.md`. Use the printed metadata.

## 8. Turn procedure

The cards do not create a universal stack like a trading-card game. They create specific timing windows. The following procedure is a practical resolution order consistent with the core rules.

### 8.1 Start of turn

1. Resolve effects explicitly due at the beginning of the turn, such as returning a King removed by Under Elf Hill.
2. Apply pending obligations or prohibitions, such as Challenge, Dungeon, Riposte's lost move, Vendetta, or Panic.
3. Determine whether the King is currently in check and what actions could legally cure it.

### 8.2 Acting

The player normally makes one Regular Move. They may instead or additionally play one card at the time printed on that card.

A card may:

- modify the Regular Move;
- replace the Regular Move entirely;
- occur before or after the move;
- grant multiple moves; or
- create an effect without moving a piece.

Unless a card explicitly grants another move, playing a card does not grant one.

### 8.3 Opponent's response

The opponent may play at most one legal card during the acting player's turn. The card's printed timing determines whether it interrupts, responds to, or follows the action.

### 8.4 Resolution and legality

Resolve the card immediately. If a cancellation rewinds a move, restore every reversible consequence of that move: piece locations, captures, promotions, markers, and card disposition, except where the canceling card says the used card is or is not returned.

After all allowed effects resolve:

1. perform any required promotion;
2. verify that the acting player's King is not illegally left in check;
3. determine check or apparent mate against the opponent;
4. handle own-turn optional discard; and
5. refill the hand as required.

### 8.5 Card allowance

A player may normally play no more than:

- one card during their own turn; and
- one card during the opponent's turn.

These are separate allowances. Playing a card on the opponent's turn does not consume the allowance for one's next turn.

A canceled or ineffective card still counts as played unless a card explicitly says it is taken back. Fog of War consumes the card allowance of both players for that turn.

Plots Within Plots is the explicit exception: it permits two more cards that were already legal at the moment Plots Within Plots was played. It does not waive their timing conditions and does not itself grant extra moves.

## 9. Drawing, discarding, and exhaustion

In the standard separate-deck game, immediately draw one replacement after playing a card so that the hand returns to five. A card such as Vulture may change the result by adding a card through its own effect.

If a player does not play a card during their own turn, they may discard one card after the turn and draw a replacement. They cannot use this ordinary discard option on the opponent's turn.

When a separate draw deck empties:

- do not reshuffle the discard pile;
- continue playing cards remaining in hand;
- after the hand empties, continue with ordinary chess as modified by Continuing Effects still in play.

## 10. Continuing Effects and transformations

Place an active Continuing Effect card beside the board. Do not discard it after initial resolution.

If its initial condition ceases to be true, the card is suspended, not discarded. It becomes active again if the condition returns. Peace Talks or another explicit cancellation is needed to remove it.

A transformed piece has at least two relevant identities:

- its original piece type; and
- its transformed name and powers.

Unless the transforming card says otherwise, effects naming the original type can still affect it. For example, a Pawn transformed into a Crab remains targetable by a card that affects a Pawn.

If a transformed piece is captured and rescued during that move or the immediately following move, it keeps the transformation. If it returns later, it returns as the original type.

Recommended tracking rule: attach effects to the identity of the physical piece, not merely its current square. A swap or forced relocation carries the marker with the piece.

## 11. The Checkmate Rule

This is the highest-priority rule in the game.

### 11.1 What a regular card may not do

A regular card may not directly:

- create checkmate;
- create a non-checkmate victory specified by a goal card; or
- capture a King.

If a played card would do so, it has no effect. It is still played, is discarded, and is replaced normally.

### 11.2 Check is allowed; mate is not

A regular card may give check. The prohibition is against directly producing mate.

The defending player's hidden hand is irrelevant when deciding whether a regular card illegally creates checkmate. If the resulting board state is checkmate under the current board rules, the regular card is forbidden even if the defender happens to hold an escape card.

### 11.3 A later Regular Move may mate

A before-move card may remove an obstruction or alter the position, after which the player's ordinary Regular Move may deliver checkmate. The card assisted, but the subsequent move directly produced the mate.

What is never legal is using a card to expose or attack the King and then treating the Regular Move as capture of that King. Kings are not captured.

### 11.4 Continuing Effects may participate in mate

A Continuing Effect can cause or help cause checkmate. A transformed piece using permanent powers can deliver mate. The Continuing Effect is not discarded merely because the resulting position is mate.

### 11.5 Apparent mate receives an escape turn

Even after a legal move produces a geometrically checkmated position, the checked player gets a turn in which an eligible card may save the King. The game ends only if no legal move or card sequence available on that turn escapes.

This creates two distinct tests:

1. **Card legality test:** did a regular card itself create a board-state checkmate? If yes, the card fails, regardless of the defender's hand.
2. **Game-over test:** on the checked player's turn, can that player legally escape using the resources actually available? If no, the game ends.

### 11.6 Temporarily remaining in check

A player may make a move that places or leaves their King in check only if a card played on that same turn removes the check before the turn ends.

Conversely, a before-move card may temporarily expose the acting King's line if the following Regular Move cures it. Once the Regular Move has been made, a regular card whose effect would leave the acting King in check has no board effect: spend, discard, and replace the card normally, then restore the position from immediately before that card.

For a card played **instead of the move**, test the proposed replacement move as one atomic result. If it leaves the acting King in check, its board effect fails and the card is still spent. Recommended deterministic ruling: if the King was safe before that failed attempt, the replacement move is consumed; if the turn began in check, leave the Regular Move available so the player can still answer the check. If no legal answer exists, adjudicate checkmate immediately.

If that saving card is canceled by Fog of War, the underlying move becomes illegal and must be taken back. Both cards remain spent and neither player may play another card in that turn. If no legal replacement move exists, the player is checkmated.

### 11.7 Effects that prevent capture also suppress check

If a piece cannot legally capture because of Pacifism, Truce, Fatal Attraction, Mystic Shield, Challenge, or another restriction, it does not currently give check through the forbidden capture. Threat is evaluated from legal capture capability, not raw movement geometry.

## 12. Conflict resolution

Apply these rules from highest to lowest priority:

1. The Checkmate Rule.
2. Explicit card text over ordinary chess.
3. A Continuing Effect over a conflicting regular card.
4. If both conflicting effects are Continuing Effects, the later-played one.
5. If neither is a Continuing Effect, the later-played one.

Use the narrowest conflict possible. One instruction overriding another does not erase unrelated portions of either card.

Example: a card granting Bishop movement does not automatically grant the right to pass through pieces, capture, ignore a wall, or promote unless its text says so. It changes the specified movement property and leaves all others intact.

## 13. Special Pawn rules

### 13.1 Two-square movement

Any Pawn on its owner's first or second rank may make a two-square initial-style move, even if that Pawn moved earlier. The path must be clear unless a card overrides that requirement.

Any Pawn making such a move can be captured en passant when the ordinary timing and geometry permit it.

### 13.2 Promotion

A Pawn may promote only to Queen, Rook, Bishop, or Knight.

A Pawn reaching the last rank by a normal Pawn move promotes normally. A Pawn moved there by another means does not promote unless the responsible card explicitly says it does.

A promotion cannot select a piece that would create immediate checkmate when the promotion is part of a regular card's effect and would violate the Checkmate Rule.

If a card moves a Pawn to the last rank during the opponent's turn and authorizes promotion, promotion is immediate. If both sides promote simultaneously, the moving player declares first.

### 13.3 Orientation

"Forward," owner ranks, last rank, and frontier are properties of the current board orientation. Earthquake rotates those concepts with the board. Pawns move away from their owner after the rotation.

### 13.4 Fanatic

Fanatic is played instead of the acting player's Regular Move. Select one controlled Pawn and move that physical piece exactly three squares forward. All three traversed squares—the first intermediate square, the second intermediate square, and the destination—must be on the board and empty. Fanatic never captures.

"Pawn" refers to original identity. A non-promoted Pawn transformed into another piece remains eligible and keeps its transformation after moving. A neutral Pawn may be selected by either player but moves in its original owner's forward direction. A Pawn currently carrying King status also retains that status, so its destination must be safe.

Fanatic creates no en-passant right. Any pre-existing en-passant opportunity expires because Fanatic constitutes the move for the turn. Reaching the last rank does not promote the Pawn because Fanatic does not expressly authorize promotion.

After staging the three-square move, apply the Checkmate Rule before committing it. If Fanatic itself would directly checkmate the opponent, restore the Pawn and spend the card. Then test the acting King's safety as described in §11.6. A successful Fanatic play consumes both the card allowance and the Regular Move; no ordinary chess move follows it that turn.

### 13.5 Annexation

Annexation is played instead of the acting player's Regular Move. Select one or two distinct controlled Pawns and choose every destination before moving either one. Each selected Pawn moves exactly two squares forward in its original owner's direction. Both the intervening square and destination must be on the board and empty in the initial position. Annexation cannot capture, and one selected Pawn cannot use a square vacated by the other.

Resolve both moves simultaneously. A non-promoted transformed Pawn remains eligible and keeps its transformation; a neutral Pawn may be selected by either player but follows its original owner's forward direction. Reaching the last rank does not promote because Annexation does not authorize promotion. Test direct mate and the acting King's safety only after the complete result, using the replacement-move fizzle procedure in §11.6.

A Pawn that began this card on its orientation-adjusted starting square remains vulnerable to en passant on the opponent's immediately following move. When two such Pawns move, each qualifying capture remains available independently; passing up those opportunities expires all of them at the end of that reply move. A successful Annexation consumes both the card allowance and the Regular Move.

### 13.6 Forced March

Forced March is played instead of the acting player's Regular Move. Select one or two distinct controlled Pawns and choose a destination for each before moving either one. Each selected Pawn moves exactly one square sideways in either direction relative to the current board orientation. Each destination must be on the board, empty in the initial position, and distinct. Forced March cannot capture, swap the selected Pawns, converge them on one square, or move one into the other's vacated square.

"Pawn" refers to original identity. A non-promoted Pawn transformed into another piece remains eligible and keeps its transformation after moving. A neutral Pawn may be selected by either player. A Pawn carrying King status retains that status, so the complete final position must leave every acting royal piece safe.

Resolve both selected moves simultaneously and test King safety only after the complete result. If Forced March itself would directly checkmate the opponent or its final position leaves the acting King in check, restore every moved Pawn and spend the card under §11.6. A successful play consumes both the card allowance and the Regular Move, creates no en-passant right, and does not promote a Pawn moved to its last rank.

### 13.7 Onslaught

Onslaught is played instead of the acting player's Regular Move. Select one or more distinct controlled Pawns that each have an empty square immediately forward, choose every destination, and then move all selected Pawns one square forward simultaneously. Forward follows each Pawn's original owner and the current board orientation. Onslaught cannot capture, and every destination must be empty in the initial position; a Pawn therefore cannot enter a square vacated by another selected Pawn.

"Pawn" refers to original identity. A non-promoted transformed Pawn remains eligible and keeps its transformation, while a neutral Pawn may be selected by either player and still follows its original owner's forward direction. A Pawn moved to its last rank does not promote because the card does not authorize promotion.

Test the complete resulting position for direct mate and acting-King safety under §11.6. A failed play restores every moved Pawn but still spends the card. A successful Onslaught consumes the card allowance and the Regular Move, clears any old en-passant opportunity, and creates no new en-passant right.

### 13.8 Long Jump

Long Jump is played instead of the acting player's Regular Move. Select one controlled Knight and move it to any empty square of the opposite board color. The move ignores ordinary Knight geometry, distance, intervening pieces, and board orientation; rotation changes the meaning of forward but does not recolor the physical squares. Long Jump cannot capture, so an occupied destination is illegal regardless of the occupant's owner.

Current or original Knight identity qualifies. A transformed original Knight and a promoted Pawn currently acting as a Knight are eligible and retain all identity fields, powers, and markers after moving. A neutral Knight may be selected by either player. If the selected piece is royal, its destination must be safe like every other final royal position.

Resolve the relocation atomically, then apply the direct-mate and acting-King safety checks in §11.6. A successful Long Jump consumes the card allowance and Regular Move, clears en-passant availability, and advances the FEN clock as a non-Pawn, non-capture move.

### 13.9 Dubbing

Dubbing is played instead of the acting player's Regular Move. Select any one controlled piece—one owned by the acting player or a neutral piece—and move it in standard Knight L-geometry to an empty square. Represent the choice as the one-element move list `[{ from, to }]`. Board orientation and intervening pieces do not affect Knight geometry, but Dubbing cannot capture an occupant of either color.

Move the physical piece without changing its owner, current or original role, promoted, royal, or neutral status, Continuing Effects, or other markers. Dubbing grants only the movement geometry for this move; it does not make the piece a Knight. In particular, an unpromoted original Pawn reaching its last rank does not promote because the card does not authorize promotion.

Resolve the relocation atomically, then apply the direct-mate and acting-King safety checks in §11.6. A failed effect restores the piece and spends the card; if the acting King began safe, the failed replacement consumes the move, while a player who began in check retains the Regular Move as a possible escape. A successful play consumes the card allowance and Regular Move, clears en-passant availability, and makes no capture. Reset the halfmove clock only for an unpromoted original Pawn; otherwise increment it, and increment the fullmove number after Black's play. Moving a King revokes that King's castling rights, and moving a castling-eligible Rook revokes the right associated with its starting square.

### 13.10 Cowardice

Cowardice is played after the acting player's Regular Move. Select one opponent-owned Pawn, or a neutral Pawn, and represent its relocation as the one-element move list `[{ from, to }]`. "Pawn" refers to original identity: the piece must be an unpromoted original Pawn, but its current role may have been transformed. Move it exactly one or two squares backward relative to its original owner's forward direction, adjusted for the current board orientation. For a two-square move, both the crossed square and destination must be on the board and empty; the card cannot capture, jump, or enter a square vacated during its own effect.

Move the physical piece without changing its owner, current or original role, promoted, royal, or neutral status, Continuing Effects, or other markers. Reaching the last rank does not promote it. Cowardice does not advance either move clock, change the turn or after-move phase, revoke castling rights, or create or expire an en-passant opportunity.

After staging the relocation, apply the Checkmate Rule and acting-King safety rule in §11.6. If Cowardice newly creates direct checkmate or leaves the acting King's royal piece in check, restore the board position while still spending, discarding, and replacing the card exactly once. A successful play likewise spends and replaces the card once and leaves the game in the after-move window until the turn ends.

## 14. Board-changing effects

### 14.1 Earthquake

Rotate the board 90 degrees in either direction. The physical relationships rotate with it:

- pawn forward direction changes;
- each player's first and last ranks change;
- the frontier used by Toll and Betrayal rotates;
- eligible last-rank Pawns promote as directed, with the opponent promoting first when the card requires that order; and
- reversing the rotation reverses these changes under the same rules.

Recommended practice: keep coordinate labels fixed to the table and record board orientation separately. Otherwise Man-Trap coordinates and repetition records become ambiguous.

### 14.2 Figure Dance

All occupied corners move counterclockwise to the next corner simultaneously. No corner occupant is captured by another corner occupant. Promotion occurs only because the card expressly authorizes it.

Simultaneous means no intermediate corner is considered vacant or occupied for another mover. Determine all four sources and destinations first, then update the board at once.

### 14.3 Forbidden City

The marked square cannot be entered or traversed. Knight-style jumping pieces may jump over it. A sliding piece cannot cross it even if its destination is beyond the square.

### 14.4 Fortification

A wall lies on the boundary between two adjacent squares, including a diagonal boundary if selected. A non-jumping move cannot cross that boundary. It does not occupy either square and does not block movement that reaches the same destination across another boundary.

Knight-style jumps and cards that explicitly jump a piece may cross the wall.

Recommended ruling: for multi-segment moves such as Madman, check the wall separately for every segment. For Ghostwalk, passing through pieces does not imply passing through walls.

## 15. Ownership, allegiance, and unusual pieces

### 15.1 Neutrality

A neutral piece may be moved by either player on that player's turn. It may capture either color and may check either King. Cards applicable to either friendly or enemy pieces may target it.

Recommended ruling: Neutrality changes control, not original color, for effects that require replacement pieces or captured-piece ownership. Record original owner separately.

If moving a neutral piece would leave the acting player's own King in check, the move is illegal. Because the neutral piece can attack either King, both Kings' safety must be evaluated after every neutral move.

### 15.2 Betrayal

The enemy Pawn changes allegiance only by being replaced with one of the acting player's captured Pawns. The original Pawn becomes dead and cannot return. Any Continuing Effect attached to that physical position or Pawn must be checked carefully; the official FAQ rules that Pacifism remains on the replacement Pawn.

### 15.3 Coup

The original King becomes a capturable Prince. The marked replacement becomes the new King while retaining its ordinary movement. All rules protecting Kings and defining check/checkmate now apply to the marked piece.

Peace Talks cannot cancel Coup after the Prince has been lost if doing so would leave the player with no King; the Checkmate Rule makes that cancellation illegal.

### 15.4 Confabulation

Two non-King pieces merge on one square. The combined piece moves, captures, and is affected by cards as either component. Confabulated Pawns cannot promote.

Recommended rulings where the preserved text is silent:

- treat the merged object as one board piece for occupancy and capture;
- a single capture removes the entire merged object;
- both original components become captured together;
- an effect targeting either component type targets the whole merged object;
- a card cannot split the components unless it expressly says so; and
- when returned later, return components separately as their original types unless an official ruling for the physical edition says otherwise.

These points must be confirmed against the full official card ruling before implementing competitive play.

## 16. Capture immunity and non-capture removal

### 16.1 Pacifism

A Pacifist piece can neither capture nor be captured. It does not threaten pieces and therefore cannot give check or qualify for a threat-based capture such as Split Knight.

The official FAQ extends its protection to indirect capture effects including Fireball, Hostage, Revenge, Toll, Doomsayer, and Split Knight. A Pacifist piece cannot be selected to explode with Fireball.

Pacifism does not protect against being made dead by Betrayal or Disintegration, because those effects are not captures.

### 16.2 Truce

While Truce forbids capture, no piece is subject to capture effects such as Fireball, Hostage, Revenge, Toll, Doomsayer, or Split Knight. Pieces do not threaten one another during the Truce.

Pieces may still be made dead by Betrayal or Disintegration. Truce ends when a King is in check or a stalemate occurs, as specified by its card. On stalemate, discard Truce and restart any move counting required for stalemate/draw purposes.

### 16.3 Mystic Shield

The protected piece cannot be captured during the opponent's next turn. This removes any check that would depend on capturing that protected piece, but does not generally prevent blocking, displacement, transformation, allegiance change, or death unless those actions count as capture.

### 16.4 Dead versus captured is deliberately exploitable

Cards may bypass capture immunity by using the word **dead** rather than **captured**. This is not a contradiction; it is a core distinction. Apply it literally.

## 17. Cancellation and rollback

### 17.1 Chaos, Knightmare!, and Think Again!

These preserved effects cancel the opponent's move and require a different move, using the same or another piece. If the opponent used a card, the card may be taken back.

The replacement must genuinely be different. Recommended ruling: changing only a declaration or irrelevant ordering is not different; the final board transition or chosen card action must differ.

### 17.2 Fog of War

Fog of War cancels another card. Both cards are discarded. If the canceled card constituted the player's entire move, that player may still make another move but cannot play another card during that turn.

Cancel only the targeted card and consequences dependent on it. Preserve independent earlier actions unless they become illegal.

### 17.3 Plots Within Plots rollback

When Plots Within Plots enables two replace-move cards and a move-canceling card cancels one move, only the replace-move card responsible for that move is returned. Plots Within Plots and the other move are not automatically canceled or returned.

Two cards played through Plots Within Plots must both have been legal at the moment Plots Within Plots resolved. A first nested card cannot manufacture the timing condition that makes the second nested card legal.

## 18. Forced actions and pending obligations

### 18.1 Vendetta

Each player must use their move to capture if any legal capture exists. The effect ends when the current player has no legal capture.

A pseudo-capture that would leave the player's King in check is not legal and does not keep Vendetta alive. Cards are not required merely because one could enable a capture.

### 18.2 Challenge

The named enemy piece must be movable when selected. On the opponent's next move, that piece must be used or the opponent loses the turn.

Recommended ruling: "use" means the piece must actually move or be the operative target/actor of a card that replaces the move. Merely selecting it for a passive marker does not satisfy Challenge unless the physical card's timing says otherwise.

If a later effect makes the challenged piece unable to move, recommended ruling: the opponent loses the turn as written rather than the obligation disappearing.

### 18.3 Dungeon

After relocating the enemy non-King piece to an empty corner, its owner cannot move it on the following turn. It may still be moved by the other player or by an effect that does not count as its owner moving it, subject to exact timing.

### 18.4 Riposte

Riposte reverses an ordinary capture: the defending piece stays, the attacker is captured, and the Riposte player loses their next move. A lost move is not necessarily an entire lost turn.

Recommended ruling: the affected player may use a legal card that does not require or replace a move, but cannot use a card to manufacture a move. Record this distinction before play because the preserved text does not resolve it.

### 18.5 Panic

The opponent has 15 seconds to make the next move. A move completed after the deadline loses the turn.

Recommended tournament procedure: start the timer once the card and current board state are fully visible; stop it when the piece is released on a legal destination. An illegal move does not satisfy the requirement. Pause for a rules adjudication not caused by the timed player.

## 19. Hidden information and memory effects

### 19.1 Man-Trap

Write the coordinate of a currently occupied friendly square secretly. The next opposing piece ending a move there is captured after completing any capture it made. A King is unaffected.

Seal or timestamp the choice so it cannot be altered. If Earthquake changes orientation, use fixed table coordinates rather than relative player coordinates.

### 19.2 Abduction

The opponent looks away for ten seconds while one non-King enemy piece is removed, then has ten seconds to identify both the piece and its former square. A correct answer restores it; otherwise it is captured.

Recommended ruling: identify a piece by type and color unless multiple identical pieces make identity relevant because of markers. In that case, the player must also identify the marked identity. Do not use Abduction against a player unable to perform the visual-memory task; substitute a mutually agreed random test.

### 19.3 Doomsayer

The next player who pronounces a non-King piece name loses one owned piece of that type. If they own none, the effect remains. The opponent may name a piece immediately when the card is played.

Recommended ruling: only intentional game communication at the table counts; quoted card text, reading this rule aloud, speech outside the game, and accidental partial words do not. The affected player chooses which owned piece of that type is lost unless the physical card specifies otherwise.

## 20. Multi-piece and simultaneous movement

Cards such as Annexation, Forced March, Guardian, Onslaught, Passing in the Night, Figure Dance, and Heresy may affect several pieces.

Use these principles:

1. Select every target before moving any piece when the card describes simultaneous action.
2. Validate every destination and path against the initial position unless the card clearly specifies an order.
3. For sequential action, update the board after each move and re-evaluate legality.
4. If one mandatory component is impossible, perform the remaining mandatory components only when the text says "each that can do so" or otherwise permits partial resolution.
5. If the card says "one or two" or "any number," the acting player chooses a legal quantity within that range.

Heresy explicitly makes the opponent move eligible Bishops first. This is sequential, and the acting player's Bishop options are evaluated after the opponent's Bishops have moved.

Holy War is played after the acting player's Regular Move. Select one controlled physical Knight and one controlled physical Bishop, then exchange their squares simultaneously. Current and original identity both count: a transformed original Knight or Bishop remains eligible, and a Pawn promoted into the named role is eligible by its current identity. Each piece carries its current powers and markers to the other square. Neutral pieces may be selected. The swap is not a capture and does not require either piece to be able to move to the other's square. If the completed swap newly creates direct checkmate or leaves the acting King in check, restore both pieces and spend the card under §11.6.

Anathema is played after the acting player's Regular Move. Select one physical Bishop and one physical Rook belonging to the opponent, then exchange their squares simultaneously. Current and original identity both count, and either selected piece may be neutral because a neutral piece is valid for both friendly- and enemy-piece effects. Each piece keeps its owner, current powers, royal or neutral status, and every marker. The swap is not a move or capture and ignores ordinary movement geometry. If the completed swap newly creates direct checkmate or leaves the acting King in check, restore both pieces and spend the card under §11.6.

Evangelists is played instead of the acting player's Regular Move. Select one Bishop belonging to the acting player and one Bishop belonging to the opponent, then exchange their squares simultaneously. Use distinct physical pieces; a neutral Bishop may fill either selection because neutrality makes it valid for friendly- and enemy-piece effects. Current and original identity both count, including transformed original Bishops and promoted Pawns currently acting as Bishops. Preserve every identity field and marker, ignore ordinary movement geometry, and make no capture. A successful swap completes the move for the turn, clears any old en-passant opportunity, and advances the FEN halfmove and fullmove counters as one non-Pawn, non-capture replacement move. Apply the replacement-move direct-mate and King-safety fizzle procedure in §11.6.

Tournament follows the same replacement-move procedure as Evangelists, but selects one Knight belonging to the acting player and one Knight belonging to the opponent. Use the target shape `{ own, opponent }`. Current or original Knight identity qualifies, a neutral Knight may fill either distinct selection, and both physical pieces retain all identity fields and markers when their squares are exchanged.

Cathedral follows the same after-move procedure as Holy War, but selects one Rook and one Bishop controlled by the acting player. Use the target shape `{ rook, bishop }`. Current or original role qualifies, including promoted Pawns currently acting as the named role, and a neutral Rook or Bishop may be selected. Exchange the two distinct physical pieces simultaneously without capture or movement geometry, preserving identity and markers. If the swap newly creates direct checkmate or leaves the acting King in check, restore the pieces and spend the card under §11.6.

Lost Castle follows the same replacement-move procedure as Tournament, but selects one Rook belonging to the acting player and one Rook belonging to the opponent. Use the target shape `{ own, opponent }`. Current or original Rook identity qualifies, a neutral Rook may fill either distinct selection, and both physical pieces retain all identity fields and markers when their squares are exchanged. A successful swap consumes the Regular Move, clears en-passant availability, and advances the FEN clocks as one non-Pawn, non-capture replacement move; use §11.6 for direct-mate and King-safety fizzles.

Siege follows the same after-move procedure as Holy War, but selects one Knight and one Rook controlled by the acting player. Use the target shape `{ knight, rook }`. Current or original role qualifies, including promoted Pawns currently acting as the named role, and a neutral Knight or Rook may fill either distinct selection. Exchange the pieces simultaneously without capture or movement geometry and preserve all identity fields and markers. Use §11.6 if the swap newly creates direct checkmate or leaves the acting King in check.

Holy Quest follows the same after-move procedure as Anathema, but selects one Bishop and one Knight belonging to the opponent. Use the target shape `{ bishop, knight }`. Current or original role qualifies, including promoted Pawns currently acting as the named role, and a neutral Bishop or Knight may fill either distinct selection. Exchange the pieces simultaneously without capture or movement geometry and preserve ownership, identity, and markers. Use §11.6 if the swap newly creates direct checkmate or leaves the acting King in check.

Treason follows the same after-move procedure as Anathema, but selects one Rook and one Knight belonging to the opponent. Use the target shape `{ rook, knight }`. Current or original role qualifies, including promoted Pawns currently acting as the named role, and a neutral Rook or Knight may fill either distinct selection. Exchange the pieces simultaneously without capture or movement geometry and preserve ownership, identity, and markers. Use §11.6 if the swap newly creates direct checkmate or leaves the acting King in check.

## 21. Movement-copying and temporary movement powers

Doppelganger copies the kind of the opponent's just-moved piece for a non-Pawn mover and prohibits capture. Recommended ruling: copy the piece's named/base movement type, not temporary powers granted to it by the card used on the preceding move, unless the copied piece is permanently transformed.

Dubbing grants Knight movement for the turn without capture. Blessing grants Bishop-style movement without capture. Masquerade grants Queen-style movement without capture. Ghostwalk changes obstruction rules but otherwise requires a legal move and an empty destination.

General anti-exploit principle: when a card says a piece moves "as if" it were another type, it grants that movement geometry only. It does not grant unrelated status, promotion, castling rights, ownership, or immunity.

## 22. Specific hazardous interactions

### 22.1 Fireball and the King

After a qualifying non-capturing move, the moved piece and every adjacent piece explode and are captured. Kings are unaffected. Resolve all non-King removals simultaneously.

Fireball cannot remove Pacifist pieces or any piece protected by Truce because those are capture effects. It also cannot legally produce checkmate as a regular card.

### 22.2 Irresistible Force

A Pawn pushes the occupied piece ahead, potentially creating a chain. A piece pushed off the last rank is captured. A King cannot be pushed.

Recommended ruling: reject the entire play before moving anything if the chain reaches a King. Check Forbidden City and walls for every push boundary. A Pacifist or Truce-protected piece cannot be pushed off-board if that result counts as capture; it may still be displaced on-board unless another rule prevents it.

### 22.3 Split Knight

The Knight captures at least two threatened enemy pieces and is then captured itself. Every target must be legally capturable under current effects. Pacifism and Truce eliminate threat and therefore prevent the play against protected pieces.

The card cannot capture a King and cannot directly create checkmate.

### 22.4 Under Elf Hill

The King leaves the board and returns at the beginning of the owner's next turn on a vacant edge square that is not in check. It may not move that turn, but the player otherwise takes a normal turn.

If no legal return square exists, the official ruling is stalemate, not checkmate, because the absent King is not in check but the game cannot continue.

### 22.5 Hidden Passage and Man of Straw

Hidden Passage may relocate the King to any empty square, but the final square must be safe under the Checkmate Rule and ordinary King safety.

Man of Straw may answer even checkmate by swapping the King with a Pawn, provided the King's destination is not in check. After the swap, verify that the Pawn's new square creates no impossible King-capture consequence and carry any piece-bound marker with the Pawn.

### 22.6 Peace Talks

Peace Talks cancels one Continuing Effect. If cancellation leaves a piece in an illegal situation, that piece's owner must correct it on the next move or lose the piece.

The Checkmate Rule still comes first. Peace Talks cannot cancel an effect when doing so would directly cause an illegal King loss or equivalent immediate victory.

### 22.7 Haunting Memories

It copies the last played card but cannot copy a unique card from its owner's deck; it may copy an opponent's unique card.

Recommended ruling: "last card played" refers to the latest successfully declared card, even if that card was later canceled, unless the official timing text states that Haunting Memories requires the previous card to have resolved. Copy the text and classification, not ownership-specific physical metadata.

### 22.8 Vulture

Vulture takes the opponent's last played card into hand. With separate decks, its player also discards their top undrawn card.

Recommended ruling: a Continuing Effect still in play is not in a discard pile and should not be removable by Vulture unless the physical card or official FAQ explicitly permits it. The safe interpretation of "take" is the most recent eligible card in the opponent's discard pile.

## 23. Stalemate, repetition, and clocks

Stalemate exists when the player to act is not in check and no legal continuation exists, considering cards legally playable at that time. Under Elf Hill with no legal return square is an official example.

Truce explicitly ends on stalemate and restarts move counting, so a position that was stalemate only because capture was prohibited must be re-evaluated after Truce leaves play.

For repetition, positions are identical only when all legally relevant state matches, including:

- board placement and side to move;
- King and Prince identity;
- pawn orientation and en-passant availability;
- castling availability;
- transformations and allegiance;
- active and suspended Continuing Effects;
- walls, forbidden squares, traps, magnets, and markers;
- pending one-turn restrictions and lost moves; and
- arguably hands, decks, and hidden commitments.

Because hidden card state makes exact repetition impractical, recommended casual ruling: do not claim repetition while either player can still play cards; use mutual agreement or a fixed turn cap instead. For software, include the entire game state except unknowable player intention in the repetition key.

For chess clocks, pause only for an opponent's reaction window or formal adjudication. Panic's 15 seconds overrides the ordinary clock for that move.

## 24. An adversarial legality algorithm

For every proposed move or card, ask these questions in order:

1. **Timing:** Is the card legal in this exact window?
2. **Allowance:** Has this player already played a card on this turn?
3. **Targets:** Do all required targets exist and satisfy the card's conditions?
4. **State:** Is each target captured, dead, transformed, neutral, immune, trapped, or otherwise restricted?
5. **Geometry:** Are destinations, paths, walls, forbidden squares, board orientation, and jumping rules satisfied?
6. **Capture semantics:** Does the effect capture, kill, replace, return, swap, or merely move?
7. **Conflict hierarchy:** Does another card override this effect?
8. **King safety:** Does the acting player end the turn with a King illegally in check?
9. **Checkmate Rule:** Would a regular card directly mate or capture a King?
10. **Consequences:** What promotions, delayed effects, lost moves, card draws, discards, or marker changes follow?

If any early step fails, do not partially resolve the action unless the card explicitly supports partial resolution.

## 25. Known inconsistencies and underspecified cases

These are not all defects in the published physical game; several exist because `cards.md` preserves effect bodies without the metadata printed elsewhere on the cards.

### 25.1 Missing card timing

This is the largest gap. Effects such as Fog of War, Bog, Hostage, Fireball, Riposte, and the move-canceling cards depend on precise response windows. Effect prose alone is insufficient.

**Required fix:** add a `timing` field for every card from the physical card.

### 25.2 Missing Continuing Effect labels

The hierarchy, discard destination, persistence, checkmate behavior, and Peace Talks all depend on this classification.

**Required fix:** add a `continuing: true/false` field from the physical card rather than guessing from phrases like "for the rest of the game."

### 25.3 Missing values and uniqueness

Standard 150-point deck construction is impossible without point values. Multiple-set legality is impossible without unique markers.

**Required fix:** add printed `points` and `unique` data.

### 25.4 Edition mismatch

The local file has 80 entries; the combined edition has 158 designed cards and two blanks. Rules involving cards absent from the local list may still appear in the official FAQ, and deck balance may assume the wider pool.

**Required decision:** declare the intended edition and card pool before implementation.

### 25.5 Same words, different game operations

Capture immunity does not imply immunity from death, replacement, swapping, movement, transformation, or allegiance change. An implementation that models all removal as one operation will be wrong.

**Required model:** distinct operations and distinct captured/dead zones.

### 25.6 “Move” versus “turn”

Cards can create several moves in one turn, replace a move, or make a player lose a move. Treating those words as synonyms breaks Plots Within Plots, Riposte, Charge!, Crusade, Merciless, and response allowances.

**Required model:** a turn contains zero or more move events and card events.

### 25.7 Simultaneous movement

Figure Dance clearly requires simultaneous resolution, while Heresy explicitly orders the opponent first. Other multi-piece cards are less explicit.

**Recommended default:** resolve plural movement simultaneously unless the card specifies sequence or later choices depend on earlier results.

### 25.8 Identity after replacement or merging

Betrayal has an official Pacifism ruling, but the general rule for every marker after replacement is not stated in the preserved text. Confabulation also leaves capture and return details unclear.

**Recommended default:** movement and swaps preserve piece identity and markers; replacement destroys the old identity but square-bound effects remain; Confabulation creates one composite identity until captured.

### 25.9 Coordinate meaning after Earthquake

Physical rotation makes notation ambiguous, especially for Man-Trap and move history.

**Recommended default:** coordinates remain fixed relative to the table; orientation is separate state.

### 25.10 Speech and real-time effects

Doomsayer, Panic, and Abduction rely on human behavior rather than board mechanics. They create accessibility, language, and adjudication issues.

**Recommended default:** agree on an accessible substitute before play and never spring a physical or cognitive challenge on a player who cannot fairly perform it.

## 26. Minimal pre-game rulings sheet

Before a serious game, agree on these points:

1. Which edition and card pool are used?
2. Separate decks or common deck?
3. What point total and handicap apply?
4. Which chess draw rules apply?
5. Are coordinates fixed to the table through Earthquake?
6. How are simultaneous multi-piece effects resolved?
7. Does losing a move still permit a non-move card?
8. How are Confabulated pieces captured and returned?
9. Can Vulture take an active Continuing Effect?
10. What counts as pronouncing a name for Doomsayer?
11. What exact timing procedure is used for Panic and Abduction?
12. Who adjudicates a disagreement, and is the ruling final for that game?

Recording these answers prevents almost every avoidable rules dispute exposed by the local 80-card set.

## 27. Sources

- [Steve Jackson Games: Knightmare Chess rulebook](https://www.sjgames.com/knightmare/img/knightmare-chess-rules.pdf)
- [Steve Jackson Games: Knightmare Chess Official Rulings](https://www.sjgames.com/knightmare/KnightmareChess_FAQ.pdf)
- [Steve Jackson Games: chess games overview](https://www.sjgames.com/ourgames/chess.html)
- [Steve Jackson Games: Knightmare Chess 2 rulebook](https://www.sjgames.com/knightmare/img/KMC2_rules.pdf)
- [Warehouse 23: Variants and Optional Rules](https://warehouse23.com/products/knightmare-chess-variants-and-optional-rules-pdf)
- Local card-effect transcription: [`cards.md`](./cards.md)

The official rulebook and FAQ control over interpretations in this guide. The recommended rulings exist only where the preserved local data or published general rules do not provide a deterministic answer.
