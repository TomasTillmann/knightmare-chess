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

The official FAQ (pp. 17–18, repeated on p. 41) explicitly permits Toll after Charge!, Crusade, or Merciless takes a piece across the frontier toward the opponent and then returns it homeward in the same turn. Both displacements count for that immediate Toll response; the final square alone does not determine eligibility. A homeward-only move or an earlier turn's crossing does not qualify. If payment is declined, Toll cancels the entire turn and returns the mover's used card, without granting another move, as printed on Toll.

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

The public engine action `{ type: 'endTurn', discardCardInstanceId?: string }` optionally selects one physical card ID in the ending player's hand. The exchange occurs only when that turn can legally finish, including a permitted turn without a Regular Move, and the player played no card during it; an ineffective card still counts as played. All required choices and King-safety checks still apply. The selected card goes to that player's discard pile and the next undrawn card, if any, goes to their hand. Invalid, foreign, stale, malformed, or ambiguous physical IDs reject the entire action without changing state. Omitting the selector ends the turn as before, without discarding or drawing. Ordinary discard is not a card play and does not change the last played card for Vulture or Haunting Memories. A reaction on the preceding opponent's turn does not consume this own-turn option.

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

Castling may pass through, leave, or enter check, provided the King is safe at the end of the turn, whether or not a card is played (publisher FAQ, p. 8). Castling rights, piece eligibility, and clear paths still apply.

Conversely, a before-move card may temporarily expose the acting King's line if the following Regular Move cures it. Once the Regular Move has been made, a regular card whose effect would leave the moving player's King in check, including an opponent's reaction, has no board effect: spend, discard, and replace the card normally, then restore the position from immediately before that card. This applies to either player's own turn (publisher FAQ, p. 4).

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

Resolve the relocation atomically, then apply the direct-mate and acting-King safety checks in §11.6. A failed effect restores the piece and spends the card; if the acting King began safe, the failed replacement consumes the move, while a player who began in check retains the Regular Move as a possible escape. A successful play consumes the card allowance and Regular Move, clears en-passant availability, and makes no capture. Reset the halfmove clock only for an unpromoted original Pawn; otherwise increment it, and increment the fullmove number after Black's play. Moving a royal piece revokes both of its owner's castling rights even if it is transformed away from King movement. Moving a current or original Rook revokes the right associated with its starting square.

### 13.10 Squaring the Circle

Squaring the Circle is played instead of the Regular Move only when exactly three fixed-coordinate corners—`a1`, `a8`, `h1`, and `h8`—are occupied in the pre-card position; board orientation does not change those coordinates. Select any controlled on-board piece, including a neutral piece or a piece occupying one of those corners, and move that physical piece to the sole empty corner. Off-board pieces do not count. The destination is therefore empty: this is not a capture, ignores movement geometry and paths, and never promotes a Pawn.

Preserve the piece's complete identity, status, markers, and Continuing Effects. On success, clear old en-passant availability, reset the halfmove clock only for an unpromoted original Pawn (otherwise increment it), and increment the fullmove number after Black. Moving a royal piece revokes both of its owner's castling rights even when transformed away from King movement; moving a current or original Rook revokes the right associated with its starting square. Apply the atomic replacement-move direct-mate and acting-King safety fizzle procedure in §11.6: restore the board while spending the card, and consume the move only under that procedure's escape-from-check rule.

### 13.11 Cowardice

Cowardice is played after the acting player's Regular Move. Select one opponent-owned Pawn, or a neutral Pawn, and represent its relocation as the one-element move list `[{ from, to }]`. "Pawn" refers to original identity: the piece must be an unpromoted original Pawn, but its current role may have been transformed. Move it exactly one or two squares backward relative to its original owner's forward direction, adjusted for the current board orientation. For a two-square move, both the crossed square and destination must be on the board and empty; the card cannot capture, jump, or enter a square vacated during its own effect.

Move the physical piece without changing its owner, current or original role, promoted, royal, or neutral status, Continuing Effects, or other markers. Reaching the last rank does not promote it. Cowardice does not advance either move clock, change the turn or after-move phase, revoke castling rights, or create or expire an en-passant opportunity.

After staging the relocation, apply the Checkmate Rule and acting-King safety rule in §11.6. If Cowardice newly creates direct checkmate or leaves the acting King's royal piece in check, restore the board position while still spending, discarding, and replacing the card exactly once. A successful play likewise spends and replaces the card once and leaves the game in the after-move window until the turn ends.

### 13.12 Sanctuary

Sanctuary is a seven-point, non-unique regular card played instead of the Regular Move, as printed on its artwork. Use `{ king, rook }` to name two distinct occupied squares: the acting player's royal piece and a controlled current or original Rook. A neutral Rook may qualify, but all applicable King-safety rules remain in force; a capturable Prince is not the King. The pieces must share a rank or file with no intervening piece. Previous moves and castling rights do not affect eligibility.

Let the direction point from the King toward the Rook. Move the Rook to the immediately adjacent square in that direction, then have the King jump to the next square beyond it. Both destinations must be on the board and free after vacating the selected starting squares; this action never captures or promotes. A Rook already adjacent to the King stays on its square while the King jumps over it. Resolve both pieces as one atomic effect, preserving physical identity, transformations, and markers. The Rook follows its straight path and its movement restrictions; the King explicitly jumps, may leave check or jump past attacked squares, and must finish safe. A forbidden destination remains forbidden even to the jumping King.

Apply the replacement-move fizzle procedure in §11.6 for newly created direct mate or final acting-King check. On success consume the Regular Move, clear en-passant opportunities, revoke the acting King's castling rights, and advance the FEN clocks as one replacement move. Reset the halfmove clock if an unpromoted original Pawn physically moves; otherwise increment it. Advance the fullmove number after Black. Movement limits and arrival effects apply to the physical pieces that actually move.

## 14. Board-changing effects

### 14.1 Earthquake

Rotate the board 90 degrees in either direction. The physical relationships rotate with it:

- pawn forward direction changes;
- each player's first and last ranks change;
- the frontier used by Toll and Betrayal rotates;
- eligible last-rank Pawns promote as directed, with the opponent promoting first when the card requires that order; and
- reversing the rotation reverses these changes under the same rules.

Peace Talks reversing Earthquake must resolve all newly eligible promotions immediately, with the cancelling player's opponent declaring first, then each player's Pawns in fixed-square order. Each owner chooses Queen, Rook, Bishop, or Knight. Use `{ effectId, promotions: [{ square, role }] }`, where `effectId` identifies the retained physical Earthquake card; a string effect ID remains valid when no promotion is required. Validate the complete declaration before cancellation, preserve earlier promotions and other retained rotations, and apply promotion consequences and Peace Talks' regular-card King-safety rules to the complete result.

Engine convention: coordinate labels stay attached to physical board squares; players stay seated at the table. Earthquake preserves piece and square-marker coordinates while changing owner-relative movement, starting lines, and frontier. Viewed from above, clockwise from the initial position makes White move toward decreasing files and Black toward increasing files; counterclockwise does the reverse. Numeric orientation records counterclockwise board angle (clockwise adds 270 modulo 360). See §25.9 for notation.

### 14.2 Figure Dance

All occupied corners move counterclockwise to the next corner simultaneously. No corner occupant is captured by another corner occupant. Promotion occurs only because the card expressly authorizes it.

Simultaneous means no intermediate corner is considered vacant or occupied for another mover. Determine all four sources and destinations first, then update the board at once.

### 14.3 Forbidden City

The marked square cannot be entered or traversed. Knight-style jumping pieces may jump over it. A sliding piece cannot cross it even if its destination is beyond the square.

### 14.4 Fortification

Fortification is a seven-point, non-unique Continuing Effect played after the Regular Move. Use `{ from, to }` for two distinct, directly or diagonally adjacent fixed-coordinate squares. The pair describes an undirected boundary, not a piece move; either endpoint may be occupied. Retain the physical card with its wall, draw its replacement normally, and preserve the board, move counters, and en-passant opportunities. Multiple cards may independently retain the same boundary; removing one with Peace Talks leaves any other wall there active. Walls persist independently of pieces and keep their fixed coordinates after Earthquake.

A wall lies on the boundary between two adjacent squares, including a diagonal boundary if selected. A non-jumping move cannot cross that boundary. It does not occupy either square and does not block movement that reaches the same destination across another boundary.

Knight-style jumps and cards that explicitly jump a piece may cross the wall.

Recommended ruling: for multi-segment moves such as Madman, check the wall separately for every segment. For Ghostwalk, passing through pieces does not imply passing through walls.

For a sliding move or a multi-square Pawn move, examine each consecutive neighboring-square step; for castling, examine both the King's and Rook's paths. Captures, en passant, and checks obey the same boundary restriction. A transformed or merged piece uses the crossing permission of the actual movement mode it employs. Non-move swaps and placements have no intervening path. Fortification may participate in mate under §11.4, and a wall can supply an after-move escape from check under §11.6.

## 15. Ownership, allegiance, and unusual pieces

### 15.1 Neutrality

A neutral piece may be moved by either player on that player's turn. It may capture either color and may check either King. Cards applicable to either friendly or enemy pieces may target it.

Recommended ruling: Neutrality changes control, not original color, for effects that require replacement pieces or captured-piece ownership. Record original owner separately.

If moving a neutral piece would leave the acting player's own King in check, the move is illegal. Because the neutral piece can attack either King, both Kings' safety must be evaluated after every neutral move.

Neutrality is a Continuing Effect played after the Regular Move. Its target is one occupied square containing an opposing piece (an already-neutral piece also qualifies). Kings, royal pieces, and Queens are excluded, including the current or still-applicable original type of any component of a merged piece. A previously promoted Pawn uses its promoted type for this restriction. Becoming neutral does not change physical identity, original ownership, current type, promotion, location, or movement history; a neutral Pawn retains its original owner's forward direction. The change itself is not a move or capture and preserves the completed move, clocks, castling rights, and valid en-passant opportunities.

Retain the physical Neutrality card beside the board and draw its replacement once. The marker follows the selected physical piece through movement, swaps, transformations, and temporary absence; a merged carrier is neutral while it contains that component. The printed duration ends when the marked piece is captured or made dead: discard its marker and remove that marker's neutrality, even if the piece is subsequently rescued. Peace Talks can cancel the marker with the same restoration. Multiple Neutrality markers can coexist; removing one must preserve neutrality supplied by another marker or by the piece's pre-existing state. Promotion or transformation after resolution does not itself discard Neutrality, but target ineligibility suspends it under §10. A marked Pawn promoted to Queen loses neutral control; promotion to Rook, Bishop, or Knight retains it unless another exclusion applies (official FAQ, p. 44). Resolve the complete effect under §11.6: leaving the acting King's position illegal fizzles and spends the card, while a Continuing Effect may participate in mate under §11.4.

### 15.2 Betrayal

The enemy Pawn changes allegiance only by being replaced with one of the acting player's captured Pawns. The original Pawn becomes dead and cannot return. Any Continuing Effect attached to that physical position or Pawn must be checked carefully; the official FAQ rules that Pacifism remains on the replacement Pawn.

Betrayal is played before the Regular Move and does not replace it. Use `{ pieceId, to }`: `pieceId` names an owned captured, unpromoted original Pawn, and `to` contains an opposing unpromoted original Pawn on the acting player's half of the board (owner-relative ranks one through four, including after Earthquake). A neutral on-board Pawn qualifies as opposing, but captured replacement ownership follows §15.1. A royal Pawn cannot be made dead. Return the selected physical replacement under §10, make the opposing physical Pawn dead, and transfer its Pacifism marker to the replacement while retaining that effect card's owner. This is death and replacement, not capture; capture immunity does not prevent it. Resolve the entire effect before the §11.6 checks. Preserve the Regular Move and move counters, and retain only en-passant opportunities whose physical victims remain eligible.

### 15.3 Coup

The original King becomes a capturable Prince. The marked replacement becomes the new King while retaining its ordinary movement. All rules protecting Kings and defining check/checkmate now apply to the marked piece.

A royal Pawn promotes normally. Promotion to Queen or Rook suspends Coup and restores the previous King through any remaining active Coups. Retain the physical Coup card; it resumes if the marked piece is no longer a Queen or Rook. Bishop or Knight promotion leaves Coup active (official FAQ, pp. 20–21 and 44).

Existing Neutrality and Pacifism on the replacement are suspended while it is King (official FAQ, “Can you play COUP on a NEUTRAL or PACIFIST piece?”, pp. 43–44). Retain their cards and physical markers; they resume when the piece is no longer royal and otherwise eligible. In particular, Queen promotion keeps Neutrality suspended, while Rook promotion permits it to resume. A capturable Prince remains eligible for active Pacifism.

A neutral piece of the opposite color is also a legal Coup target. Suspending Neutrality restores its original owner's exclusive control, surrendering the acting player's King and immediately awarding the opponent the game. The official FAQ explicitly permits this losing choice because Coup is a Continuing Effect and is exempt from the Checkmate Rule. The normal immediate Fog of War response can still cancel the card and restore the preceding position.

Peace Talks cannot cancel Coup after the Prince has been lost if doing so would leave the player with no King; the Checkmate Rule makes that cancellation illegal.

### 15.4 Confabulation

Two non-King pieces merge on one square. The combined piece moves, captures, and is affected by cards as either component. Confabulated Pawns cannot promote.

A named transformation such as Crab applies only to its own component (official FAQ, p. 18). The other ordinary Pawn component therefore retains its en-passant and Dark Mirror capture powers; this follows from the component scope and either-component rule. FAQ p. 21 expressly forbids a Crab itself from capturing en passant. The engine retains the interpretation that Crab's continuing forward-only movement overrides Dark Mirror on that component alone; the supplied sources do not expressly rule on that pairing.

When a mixed piece can either capture en passant or move to the same empty square without capturing, both outcomes are legal subject to their own King-safety and capture restrictions. The engine move action defaults to the available en-passant capture; `enPassant: false` selects an otherwise legal move without that capture, and `enPassant: true` requires a currently available en-passant capture. Vendetta judges the selected outcome.

Continuing Effects applied to the combined piece end when Peace Talks cancels Confabulation. Effects applied before the merge remain attached to their original targets (official FAQ, “If the CONFABULATED piece had PACIFISM (or NEUTRALITY... or both) on it”).

Ending Confabulation also ends any Coup that made the combined piece King, restoring the Prince through the remaining Coup effects. If that Prince has been captured, both Confabulation and its dependent Coup are immune to Peace Talks (official FAQ, “Can you COUP a CONFABULATED piece?”).

Recommended rulings where the preserved text is silent:

- treat the merged object as one board piece for occupancy and capture;
- a single capture removes the entire merged object;
- both original components become captured together;
- an effect targeting either component type targets the whole merged object;
- a card cannot split the components unless it expressly says so; and
- when returned later, return components separately as their original types unless an official ruling for the physical edition says otherwise.

These points must be confirmed against the full official card ruling before implementing competitive play.

### 15.5 Resurrection

Resurrection is an eight-point, non-unique regular card played instead of the Regular Move. Use `{ pieceId, to }` to return one owned captured physical piece. Dead, away, on-board, opposing-owned, royal, and current or original King/Queen pieces are ineligible. Captured neutrality does not change original ownership. A promoted Pawn currently acting as a Rook, Bishop, or Knight is eligible; promotion is permanent and is not undone as a temporary transformation.

Choose a vacant square where that kind of piece could have started: Pawns on any of their eight second-rank squares, Knights on their two original Knight squares, Bishops on their two original Bishop squares, and Rooks on their two original Rook squares. Use owner-relative starting coordinates under the current board orientation, including Earthquake. For a temporarily transformed, unpromoted piece, use its original physical type to determine starting squares; for a promoted piece, use its promoted type. Either matching starting square is allowed, not just the selected physical piece's particular original square.

Return the same physical identity without changing ownership, original role, neutrality, or promotion. Apply §10 to temporary transformations: a recent rescue retains the transformation, and a later return restores the original type. A former composite's captured components return separately as original pieces under §15.4. Effects that explicitly expired on capture remain discarded. Never revive a King, a dead piece, an expired marker, or lost castling rights.

Placement has no intervening path and is not an arrival move or capture. Walls and movement-only restrictions do not prevent placement, but Forbidden City cannot be the destination. A piece placed in a magnet's neighborhood is immobilized normally. Resolve the complete result under §11.6: direct-mate or self-check failure restores the board while spending the card, with the usual replacement-move consumption rule. Success spends and replaces the physical card once, consumes the Regular Move, clears en-passant opportunities, and advances the clock as one non-capture move (reset for an unpromoted original Pawn, otherwise increment); Black advances the fullmove number once.

## 16. Capture immunity and non-capture removal

### 16.1 Pacifism

A Pacifist piece can neither capture nor be captured. It does not threaten pieces and therefore cannot give check or qualify for a threat-based capture such as Split Knight.

The official FAQ extends its protection to indirect capture effects including Fireball, Hostage, Revenge, Toll, Doomsayer, and Split Knight. A Pacifist piece cannot be selected to explode with Fireball.

Pacifism does not protect against being made dead by Betrayal or Disintegration, because those effects are not captures.

### 16.2 Truce

While Truce forbids capture, no piece is subject to capture effects such as Fireball, Hostage, Revenge, Toll, Doomsayer, or Split Knight. Pieces do not threaten one another during the Truce.

Pieces may still be made dead by Betrayal or Disintegration. Truce ends when a King is in check or a stalemate occurs, as specified by its card. On stalemate, discard Truce and restart any move counting required for stalemate/draw purposes.

### 16.3 Mystic Shield

Mystic Shield is a nine-point, non-unique regular card played after your move. Select one occupied square containing a physical piece you just moved, using that square as the target. The piece must still be on the board; Kings and other royal pieces qualify. A controlled neutral piece qualifies regardless of its original owner, and promotion does not prevent selection. Castling permits selecting either the relocated King or Rook; where a move moved multiple pieces, select exactly one. Merely swapping or placing a piece does not make it a moved piece. A stale turn or a piece that did not participate cannot supply the trigger. Plots Within Plots preserves its original qualifying physical identities while targets use their current squares.

The selected physical piece cannot be captured by the card player's opponent during that opponent's next turn. Protect the whole composite while it contains the selected component. Record the card player's identity separately from the piece's original owner. Protection follows that physical identity through relocation, transformation, neutrality, or allegiance changes and expires when the protected opponent turn ends, including a forfeited turn. It does not prohibit the piece's own moves or captures, and does not apply to a reaction before that opponent turn begins. The official FAQ (page 5) explicitly permits moving a King into check and then playing Mystic Shield: evaluating royal safety immediately accounts for the opponent's prospective forbidden capture, so the card resolves the pending check and the turn can end. Check returns on the player's next turn if the same attack remains after protection expires. A captured or dead piece cannot retain useful protection off board.

This is a temporary restriction, not a Continuing Effect: spend, discard, and replace the card once when played; Peace Talks cannot cancel it. The card changes no piece positions, identities, clocks, castling rights, en-passant opportunities, or move status. It consumes only the card allowance. Ordinary captures, en passant, and card effects explicitly classified as captures obey the protection; blocking, non-capture displacement, transformation, allegiance change, and death remain possible. Any check depending on a forbidden capture is suppressed during the protected turn. Apply the regular-card Checkmate Rule to the complete effect: evaluate the opponent's prospective protected turn, so immunity cannot remove their sole check escape and thereby create direct mate. Such a play fizzles immediately, spending the card without granting protection and preserving the completed move.

### 16.4 Dead versus captured is deliberately exploitable

Cards may bypass capture immunity by using the word **dead** rather than **captured**. This is not a contradiction; it is a core distinction. Apply it literally.

## 17. Cancellation and rollback

### 17.1 Chaos, Knightmare!, and Think Again!

These preserved effects cancel the opponent's move and require a different move, using the same or another piece. If the opponent used a card, the card may be taken back.

The replacement must genuinely be different. The official FAQ (pages 17/38/50) requires a different board move: omitting or changing an optional card, changing the route, or changing only off-board captured/dead assignments cannot justify repeating the same displacement.

Chaos is a ten-point, non-unique regular card played after the opponent's completed move, including that mover's optional after-move card (official FAQ, pages 16/37), before `endTurn` advances the engine to the next player. It cancels the latest move, including a move made by a replacement or additional-move card. No target accepts the moving player's normal take-back of the card responsible for that move or its optional after-move card; `{ returnCard: false }` declines retrieval. `{ returnCard: true }` is equivalent to no target. Reject any other payload. A passive optional card is part of this turn: it preserves the existing response opportunity and the original move's identity, without creating a new move. An unrelated opponent action or ending the turn closes the window; Plots Within Plots preserves its original response window under §17.3. This corrects the former local closure clause where it was applied to the mover's optional card; that interpretation conflicted with the publisher ruling.

Restore the state immediately before the canceled move: physical positions and zones, all capture and promotion consequences, movement markers, Continuing Effects and their card disposition, castling rights, en-passant, clocks, and pending movement obligations. Restore the moving player's opportunity to choose a replacement and keep that player active. Returning the involved card also undoes its effects, refunds its play allowance, and reverses its replacement draw. Declining return of a card that supplied the canceled move keeps that card discarded, its replacement drawn, and its allowance spent. Declining retrieval of an optional nonmovement card retains its effects, physical disposition (including a Continuing Effect card in play), replacement draw, and spent allowance while undoing the original move; FAQ page 37 distinguishes canceling a move from canceling a card. Its effects follow the physical pieces to their restored positions. Preserve independent earlier cards and moves, including Plots Within Plots and its other replacement move. The Chaos card itself is discarded and replaced exactly once, consuming the reactor's allowance for this turn without consuming their following turn's allowance. An ordinary end-turn discard is not a played card and never reopens an ended turn.

The canceled movement cannot be repeated during the replacement opportunity: compare canonical physical origins and destinations together with any actual on-board promotion result. A different castling alias or order of independent move segments cannot evade the prohibition. A legal ordinary promotion to a different role at the same destination is a different board state; this is a derived application of FAQ page 50, not an explicit promotion example. Repeating the same promoted role remains prohibited, and invalid or inapplicable promotion declarations confer no exception. Ordinary legal-move enumeration and card target enumeration must respect it. An invalid repeat is atomic. The prohibition ends when a genuinely different replacement move completes or the affected turn ends; it must not ban that move on a later turn. Apply §11 to cancellation itself, including the replacement prohibition: if it would directly create board checkmate, Chaos fizzles and is spent while the completed opposing move remains intact. A fabricated after-move state without a real preceding move is not eligible.

Knightmare! is a separate ten-point, non-unique regular card (`knightmare`) with the same printed effect, after-opponent-move timing, target contract, restoration, optional responsible-card return, replacement prohibition, and fizzle rules as Chaos above. Preserve the selected physical Knightmare! card and its own card ID in expenditure, replacement draw, history, copying, and cancellation; owning Chaos is neither required nor a substitute. It participates in Plots Within Plots and Haunting Memories under their ordinary rules. Chained move cancellations always apply to the latest actual move and retain independent earlier expenditure; Fog of War may cancel Knightmare! under §17.2.

Think Again! is a separate ten-point, non-unique regular card (`think-again`) with the same printed effect and full contract as Chaos and Knightmare! above. It has after-opponent-move timing and the same optional responsible-card return, rollback, physical replacement prohibition, and fizzle rules. Keep its own selected physical card identity in expenditure, draws, history, copying, and cancellation. It works independently of owning either other cancellation card, supports Plots Within Plots and Haunting Memories, and may be canceled by Fog of War. A chain involving these cards always cancels the latest actual move while retaining independent earlier expenditure.

### 17.2 Fog of War

Fog of War cancels another card. Both cards are discarded. If the canceled card constituted the player's entire move, that player may still make another move but cannot play another card during that turn.

Cancel only the targeted card and consequences dependent on it. Preserve independent earlier actions unless they become illegal.

Fog of War is a ten-point, non-unique regular card, played immediately after an opposing physical card is played. With no target it cancels the latest opposing card. Within a live Plots Within Plots trio, a physical card ID may instead select Plots or either subsequent card, as expressly allowed by the official FAQ, page 52. Reject other payloads, a player's own card, stale windows, and fabricated history without a real card play. Resolve the reactor from the player who played that card, not merely from the active turn color; a player can counter an opponent's reaction during their own turn. Plots Within Plots can preserve the original opposing-card window. An immediate counter may cancel a card that has just opened a mandatory choice, including Doomsayer or Abduction, before that choice is answered. An intervening unrelated action closes the response window.

Restore the position and other reversible effects from before the canceled card, including captured or dead pieces, transformations, ownership, markers, orientation, castling, en-passant, clocks, and pending choices. Reapply only the ordinary expenditure and replacement draw of the canceled physical card, and spend and replace Fog of War once. Both physical cards end in their respective players' discard piles; a canceled Continuing Effect does not remain beside the board. Do not duplicate cards or retain card-specific effects such as Vulture's extra cost or transfer. The canceled player's ordinary card allowance remains consumed. An uncanceled Plots Within Plots retains its remaining additional play; the canceled extra still consumes its own play. Preserve the countering player's independent earlier cards and any otherwise-valid additional allowance.

The official FAQ, page 52, explicitly commits the third card when Fog cancels the second card of the trio. Preserve that same physical third card and its valid consequences. If its original target becomes invalid, retain the same card for a legal target under §17.3 rather than substituting a different card; this target handling follows §17.3's current-position validation. Canceling Plots itself backs up the dependent extras and their replacement draws. The FAQ also permits opposing Plots plus two Fogs to cancel both extras: a later cancellation must not restore a card already canceled in that saved window.

If the canceled card replaced the whole move, restore a Regular Move opportunity for its player. If it merely preceded or followed an independent move, preserve that move and its availability as it stood before the card. A different replacement is not required by Fog of War itself. If the canceled card was an additional move, restore the preceding completed move. An already-fizzled card may be countered; it remains spent. A cancellation does not undo an unrelated earlier card or a different replacement move under Plots Within Plots.

If cancellation removes a saving effect and exposes the acting King's illegal underlying move, undo that underlying move as required by §11.6 while keeping both cards spent. Neither player may play another card that turn in this case. Permit a legal ordinary replacement if one exists; otherwise apply checkmate. Restoring a pre-existing checked or mated position by canceling its escape is governed by this explicit rule. Clear cancellation-specific restrictions when the affected turn ends.

### 17.3 Plots Within Plots rollback

Plots Within Plots is an eight-point, non-unique regular card, printed "Play at any time." It consumes the player's normal card play and opens an immediate allowance for up to two additional cards. Use no target for the acting player, or `{ player }` to identify either player explicitly, including an opponent using an available response window. It does not move pieces or change clocks. Spend, discard, and replace it once. "At any time" does not bypass mandatory unresolved choices, ended games, or an already consumed card allowance unless an earlier Plots Within Plots supplies an additional play.

Play the additional cards through ordinary `playCard` actions. The allowance belongs to the player who played Plots Within Plots; it cannot pay for the other player's cards. It is immediate: making an ordinary move or ending/forfeiting the turn closes unused additional plays. A player may use zero or one of the two plays. An invalid card attempt is atomic and does not consume an additional play; a valid card that fizzles still consumes one. Record actual card-play counts and physical cards rather than pretending previous cards were never played.

At the moment Plots Within Plots is played, preserve the timing window and the physical cards already in that player's hand. Only those cards that had at least one legal play then can use its allowance; replacement draws cannot become eligible retroactively. This initial check establishes card eligibility, not a fixed destination: choose targets when each card executes and validate them against the current position. Thus two eligible replacement cards may move the same piece successively. The first card cannot make an initially unplayable card eligible by creating a missing capture trigger, its first legal target, or a new timing permission. A response remains tied to its original opposing move/card. Other restrictions, costs, targets, Continuing Effects, and King-safety rules still apply.

Two cards that each replace a move may both execute when both were legal in the original window, even though the first consumes the ordinary move. Each is a separate move with its ordinary clocks, captures, history, and response consequences. They do not permit a third ordinary move. Before-move cards without a replacement move leave the Regular Move available. An after-move card cannot become eligible merely because the first nested replacement moved a piece. Additional-move cards likewise require their qualifying move to have existed before Plots Within Plots.

A second physical Plots Within Plots may consume one eligible additional play and open its own two-play allowance with its own original eligibility window; preserve any unused outer allowance. Resolve mandatory consequences of a nested card, including Abduction's recall, before continuing. If no additional cards are used, normal play may continue immediately.

When Plots Within Plots enables two replace-move cards and a move-canceling card cancels one move, only the replace-move card responsible for that move is returned. Plots Within Plots and the other move are not automatically canceled or returned.

Two cards played through Plots Within Plots must both have been legal at the moment Plots Within Plots resolved. A first nested card cannot manufacture the timing condition that makes the second nested card legal.

## 18. Forced actions and pending obligations

### 18.1 Vendetta

Each player must use their move to capture if any legal capture exists. The effect ends when the current player has no legal capture.

A pseudo-capture that would leave the player's King in check is not legal and does not keep Vendetta alive. Cards are not required merely because one could enable a capture.

### 18.2 Challenge

The named enemy piece must be movable when selected. On the opponent's next move, that piece must be used or the opponent loses the turn.

A nonroyal Confabulated piece may be challenged through an eligible component: a Queen–Knight can be challenged as a Knight, obliging that same combined piece to move or forfeit the turn. Riposte still cannot capture a composite containing a Queen (official FAQ, p. 16).

Recommended ruling: "use" means the piece must actually move or be the operative target/actor of a card that replaces the move. Merely selecting it for a passive marker does not satisfy Challenge unless the physical card's timing says otherwise.

If a later effect makes the challenged piece unable to move, recommended ruling: the opponent loses the turn as written rather than the obligation disappearing.

### 18.3 Dungeon

Dungeon is a non-Continuing card played after the Regular Move. Use one relocation, `[{ from, to }]`, to move an opposing nonroyal piece to an empty fixed corner (`a1`, `a8`, `h1`, or `h8`). A neutral piece qualifies as opposing. Preserve its physical identity, transformation, and markers; this relocation makes no capture and does not authorize Pawn promotion. Apply movement restrictions, direct-mate and acting-King safety under §11.6, and revoke castling rights for a moved current or original Rook. Preserve move counters and retain only valid en-passant opportunities.

As with Squaring the Circle (§13.10), the arbitrary corner relocation ignores ordinary movement geometry and intervening paths; it cannot enter a forbidden destination, and an identity-based distance limit such as Curse still applies.

The acting player's opponent cannot move that physical piece by a Regular Move on their following turn. A later movement card overrides this regular-card prohibition only for the movement that card authorizes; Continuing Effect restrictions and the card's own conditions still apply. This Dungeon-specific consequence is derived from the publisher's Conflicts rule (official rulebook, page 2) and the analogous False Orders/Escape ruling (official FAQ, page 27), not an explicit Dungeon ruling. The ban follows identity and ends when that opponent's turn ends, including a forfeited turn; playing or canceling the later card does not erase the remaining ban. It does not restrict the other player, and an exchange explicitly classified as a swap rather than movement remains possible. Forbidden captures suppress check under §11.7. The restriction is temporary, not a retained Continuing Effect, so Peace Talks cannot cancel it.

### 18.4 Riposte

Riposte is a ten-point, non-unique regular reaction card, with no target payload, played immediately after an opponent's actual Regular Move captures one of your pieces. A move granted or replacing the Regular Move by a card does not qualify; ordinary movement under existing Continuing Effects still does. Use the actual pre-capture position and physical identities. The reacting player is the captured piece's original owner and must differ from the moving player; neutral victims retain that ownership. The victim must still be captured and the attacker must still be on the board. A fabricated event, older capture, death, or non-capture is ineligible. Plots Within Plots may preserve the original response window.

Reverse that capture atomically: the defending board piece stays on its pre-capture square, with all composite components and effects restored as though it had not been captured. Capture the attacking board piece and all of its physical components instead. Treat the attacker in its pre-capture form, so a reversed promotion capture does not promote it. A royal, King, or Queen component in that pre-capture attacker, including a still-applicable original type, is ineligible; a capturable Prince also remains a King type for this prohibition. Capture immunity protects the attacker normally. Neither restoration nor removal is an arrival move. En-passant victims return to their original occupied square, not the empty capture destination. Undo capture-expired effects of the defender and apply normal capture expiry to the attacker. Preserve independent earlier card expenditure, including Plots Within Plots.

Keep the capturing player's completed Regular Move consumed and preserve its fullmove counter and active color. The halfmove clock is zero for the resulting capture and en-passant availability is cleared. Restore the defender's pre-capture castling rights where applicable and revoke rights belonging to the removed attacker. Spend and replace only the reacting player's selected physical Riposte once. The complete result cannot newly create direct mate against the capturing player or leave the reacting King in check; otherwise Riposte fizzles, restoring the original completed capture, spending its card, and imposing no lost move. Check against the capturing player is permitted under §11.2 and is answered on that player's next turn, after the reacting player's forfeited move; it does not prevent closing the capturing turn.

On success, the reacting player loses exactly their next Regular Move. At the beginning of that player's next turn, after mandatory start-of-turn resolutions, consume that Regular Move automatically and open the after-move phase. This is a forfeiture, not an actual move or capture: it creates no moved-piece or capture trigger. Clear en-passant and advance the clocks once as a non-capture skipped move, including Black's fullmove increment. The player may still play cards legally available after a move and end the turn, but cannot make a Regular Move or play an instead-of-move card. The normal card allowance resets for this turn. The penalty then expires, so the following turn permits a normal move. Multiple successful obligations are consumed one per affected turn. Peace Talks cannot cancel this non-Continuing penalty; Fog of War canceling Riposte restores the original capture and removes its dependent penalty.

Recommended ruling: the affected player may use a legal card that does not require or replace a move, but cannot use a card to manufacture a move. Record this distinction before play because the preserved text does not resolve it.

### 18.5 Panic

The opponent has 15 seconds to make the next move. A move completed after the deadline loses the turn.

Recommended tournament procedure: start the timer once the card and current board state are fully visible; stop it when the piece is released on a legal destination. An illegal move does not satisfy the requirement. Pause for a rules adjudication not caused by the timed player.

### 18.6 Fatal Attraction

Fatal Attraction is an eight-point, non-unique Continuing Effect played after the Regular Move. Select a controlled on-board piece by its square; a neutral piece or the acting royal piece may be the magnet. Retain the physical card with a marker on that physical piece and draw its replacement once. The marker preserves all identities, other effects, board coordinates, clocks, and the completed Regular Move.

While the magnet remains on the board, every non-royal board piece in its eight adjacent squares is unable to move or capture, regardless of ownership or neutrality. The magnet does not freeze itself. A royal physical component exempts its whole composite from this restriction; a capturable Prince has no royal exemption. Use fixed square adjacency, including after Earthquake. Immobilized pieces do not threaten squares. Pieces may pass through the surrounding squares and may enter one with a legal quiet move or capture, but become immobilized once they stop there. An arrival is not rejected merely because it will leave its mover immobilized.

The restriction applies to ordinary moves and card movement, including swaps. The publisher FAQ p.40 (Medusa) explicitly counts swapping as movement, and the rulebook's Conflicts rule prioritizes Continuing Effects over regular cards. Applying those general rules to Fatal Attraction is an inference, not a card-pair-specific FAQ ruling, and corrects this section's former swap exception. Check every exchanged piece against the original position before releasing any magnet: swapping a magnet cannot simultaneously free its frozen neighbor to participate in that swap. Swaps need not follow ordinary-move geometry and do not capture. If the magnet moves, including by a legal swap of its composite's carrier, or is captured or made dead, discard its retained physical card and release its neighbors before evaluating the final position. A transformation without displacement retains the marker on the same physical identity. A temporary absence, such as Abduction's concealment or Under Elf Hill, retains the marker but projects no surrounding restriction while the magnet is away. A correctly restored magnet projects it again. Multiple magnets apply independently, including to one another when adjacent.

Peace Talks may cancel one retained Fatal Attraction effect. Apply ordinary continuing-effect priority and §11.7 threat suppression. As a Continuing Effect it may produce mate under §11.4 or provide an after-move rescue under §11.6; all final King-safety checks must use the resulting active magnets.

## 19. Hidden information and memory effects

### 19.1 Man-Trap

Write the coordinate of a currently occupied friendly square secretly. The next unprotected opposing piece ending a move there is captured after completing any capture it made. A King or Pacifist does not set off Man-Trap: retain the trap and its physical card for a later vulnerable entrant, regardless of whether Pacifism preceded or followed the trap. This includes Coup's current King and protection applying through a composite component (§§15.3–15.4). The publisher's explicit clarification (official FAQ, pp. 40 and 46) supersedes the printed wording that a King springs the trap but is unaffected. A neutral entrant remains capturable. A newly arriving Mystic Shield recipient is captured before the Shield's protection begins on the following turn.

Seal or timestamp the choice so it cannot be altered. If Earthquake changes orientation, retain the chosen board-attached square coordinate (§25.9).

### 19.2 Abduction

Abduction is an eight-point, non-unique regular card played after the Regular Move. Select an occupied square containing an opposing non-royal piece; a neutral piece may qualify. Capture protection, including Pacifism and Truce, prevents selection. A composite is one selected board piece, with all physical components handled together; none may be royal. Spend and replace the card once and temporarily remove the selected piece to the away zone without capturing it, losing markers, changing clocks, or advancing the turn. Keep the concealed square and piece identity out of public card history until the challenge is resolved.

The opponent looks away for ten seconds, then has ten seconds to identify the removed piece and its former square. The engine models the two timer boundaries explicitly, as with Panic: `{ type: 'revealAbduction' }` ends the concealment window; during the recall window the opponent submits `{ type: 'answerAbduction', player, role, owner, square, pieceId? }`, or `{ type: 'abductionTimeout' }` reports expiry. The caller handles elapsed time; the reducer performs no wall-clock waits. A guess uses the displayed current role and original owner. Require the exact physical `pieceId` as well when the removed piece has a piece-bound marker or is composite; omitting that optional field when identity is required counts as an incorrect answer. A correctly shaped but wrong guess resolves as failure; malformed, mistimed, repeated, or wrong-player responses leave the pending challenge unchanged. Other moves, cards, and turn-ending actions wait until resolution.

A correct answer restores the same piece and all its physical components exactly, preserving transformations, royal/neutral status, markers, castling rights, en-passant availability, clocks, and the already consumed card. A wrong answer or recall timeout captures the selected piece and all its components under normal capture rules. Reset the halfmove clock on actual capture, revoke captured Rook rights, and remove any en-passant opportunity belonging to the captured piece; do not advance the fullmove number again. Never draw or spend a second card when resolving the challenge.

Temporary removal is not a final board position. Defer capture-triggered expiry and King-safety adjudication until the answer or timeout resolves. If the final capture would newly create direct mate or leave the acting King in check, restore the pre-card board and markers while keeping Abduction spent and replaced, and record the ordinary fizzle reason. If Abduction was attempted to rescue a temporarily illegal Regular Move, resolve the existing move-rescue procedure after the memory outcome is known; a correct answer that restores the checking piece cannot validate the underlying illegal move. A resolved challenge leaves the normal after-move card-response window available.

For human play, do not use Abduction against a player unable to perform the visual-memory task; substitute a mutually agreed random test.

### 19.3 Doomsayer

The next player who pronounces a non-King piece name loses one eligible owned or neutral piece of that type. Either player may lose a neutral piece regardless of its original owner (official FAQ, pp. 8 and 43). If no eligible piece exists, the effect remains. The opponent may name a piece immediately when the card is played.

Crab and Prince are distinct names for Doomsayer (official FAQ, p. 8). A Crab may be lost for either "Crab" or "Pawn"; a Prince may be lost for "Prince". Saying "King" has no effect, and a Pawn made King by Coup cannot be lost for "Pawn". Capture immunity still applies.

Recommended ruling: only intentional game communication at the table counts; quoted card text, reading this rule aloud, speech outside the game, and accidental partial words do not. The affected player chooses which eligible piece of that type is lost unless the physical card specifies otherwise.

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

Passing in the Night exchanges one or two pairs of Pawns simultaneously. Use a list of one or two `{ from, to }` pairs, each naming an acting-player Pawn and an opposing Pawn; all selected physical pieces must be distinct. Neutral Pawns may fill either selection. Pawn eligibility uses unpromoted original identity, including transformed Pawns. Preserve ownership, powers, markers, and royal status; ignore movement geometry, make no capture, and do not promote on the last rank. Play instead of the Regular Move, as printed on the artwork. Clear en-passant availability, reset the halfmove clock for the Pawn action, and advance the fullmove number after Black. Apply §11.6 to the complete simultaneous result, and treat the exchange as a non-move swap for effects triggered by arrival moves.

Winged Victory is played instead of the Regular Move. Use `{ pieceId, to }` to select one of the acting player's captured, unpromoted original Pawns and an empty central square (`d4`, `e4`, `d5`, or `e5`). Captured-piece ownership follows §15.1 even for neutral pieces; dead, away, and on-board pieces are ineligible. Return the same physical Pawn, applying the transformation-restoration rule in §10. Placement makes no capture and does not promote. Clear en-passant availability, reset the Pawn halfmove clock, and advance the fullmove number after Black. Apply §11.6 to the complete replacement effect.

Cathedral follows the same after-move procedure as Holy War, but selects one Rook and one Bishop controlled by the acting player. Use the target shape `{ rook, bishop }`. Current or original role qualifies, including promoted Pawns currently acting as the named role, and a neutral Rook or Bishop may be selected. Exchange the two distinct physical pieces simultaneously without capture or movement geometry, preserving identity and markers. If the swap newly creates direct checkmate or leaves the acting King in check, restore the pieces and spend the card under §11.6.

Lost Castle follows the same replacement-move procedure as Tournament, but selects one Rook belonging to the acting player and one Rook belonging to the opponent. Use the target shape `{ own, opponent }`. Current or original Rook identity qualifies, a neutral Rook may fill either distinct selection, and both physical pieces retain all identity fields and markers when their squares are exchanged. A successful swap consumes the Regular Move, clears en-passant availability, and advances the FEN clocks as one non-Pawn, non-capture replacement move; use §11.6 for direct-mate and King-safety fizzles.

Siege follows the same after-move procedure as Holy War, but selects one Knight and one Rook controlled by the acting player. Use the target shape `{ knight, rook }`. Current or original role qualifies, including promoted Pawns currently acting as the named role, and a neutral Knight or Rook may fill either distinct selection. Exchange the pieces simultaneously without capture or movement geometry and preserve all identity fields and markers. Use §11.6 if the swap newly creates direct checkmate or leaves the acting King in check.

Holy Quest follows the same after-move procedure as Anathema, but selects one Bishop and one Knight belonging to the opponent. Use the target shape `{ bishop, knight }`. Current or original role qualifies, including promoted Pawns currently acting as the named role, and a neutral Bishop or Knight may fill either distinct selection. Exchange the pieces simultaneously without capture or movement geometry and preserve ownership, identity, and markers. Use §11.6 if the swap newly creates direct checkmate or leaves the acting King in check.

Treason follows the same after-move procedure as Anathema, but selects one Rook and one Knight belonging to the opponent. Use the target shape `{ rook, knight }`. Current or original role qualifies, including promoted Pawns currently acting as the named role, and a neutral Rook or Knight may fill either distinct selection. Exchange the pieces simultaneously without capture or movement geometry and preserve ownership, identity, and markers. Use §11.6 if the swap newly creates direct checkmate or leaves the acting King in check.

## 21. Movement-copying and temporary movement powers

Doppelganger copies the kind of the opponent's just-moved piece for a non-Pawn mover and prohibits capture. Recommended ruling: copy the piece's named/base movement type, not temporary powers granted to it by the card used on the preceding move, unless the copied piece is permanently transformed.

Dubbing grants Knight movement for the turn without capture. Blessing grants Bishop-style movement without capture. Masquerade grants Queen-style movement without capture. Ghostwalk changes obstruction rules but otherwise requires a legal move and an empty destination.

General anti-exploit principle: when a card says a piece moves "as if" it were another type, it grants that movement geometry only. It does not grant unrelated status, promotion, castling rights, ownership, or immunity.

### 21.1 Bombard

Bombard is an eight-point, non-unique regular card. The artwork explicitly says to play it instead of the Regular Move. Use a one-element move array `[{ from, to }]`, selecting one controlled current or unpromoted original Rook, including an eligible neutral or composite piece. Move along a single rank or file, optionally jumping one intervening piece or one obstruction, then continue along that same line to an empty square or an ordinary legal capture. The jumped piece is not captured or otherwise changed. There must be a destination beyond a jumped square; the destination itself is not a jumped obstruction.

The allowance is one obstruction for the entire move, not one per category. An intervening occupied or Forbidden City square requires a jump; a Fortification boundary requires a jump across that boundary. Coincident markers on the same square or boundary describe one physical obstruction. A forbidden destination remains illegal. Other movement and capture restrictions, including Curse, Dungeon, Pacifism, Truce, royal safety, and physical-piece effects, remain in force. Bombard grants straight Rook movement for this action only and does not grant ongoing jumping threats.

Resolve the final position using the replacement-move procedure in §11.6, including direct-mate and self-check fizzles. Success consumes the Regular Move, spends and replaces the card once, clears en-passant availability, updates castling rights for moved or captured physical pieces, and advances clocks as one move. Normal capture handling, composite identity, and arrival effects apply at the destination.

### 21.2 Crusade

Crusade is a nine-point, non-unique regular card played after your move. Immediately after a quiet Regular Move by a Bishop, move that same physical Bishop once more using a single `[{ from, to }]` target. The first move must actually have used a piece with Bishop identity at that time, not a Pawn that only became a Bishop through promotion or a different piece later occupying its square. A current Bishop, an unpromoted original Bishop retaining that identity under §10, a promoted Bishop, or a composite containing a Bishop qualifies; merely having Bishop-like movement does not change a piece's type. A controlled neutral Bishop qualifies normally.

The second move uses the piece's ordinary movement and may capture. All current path, destination, movement, capture-immunity, royal-safety, and arrival rules apply. It cannot follow a capturing Regular Move, a move made by a card, an older turn's move, or a different piece's move. Apply the regular-card direct-mate and self-check fizzle rules to the extra move, preserving the completed first move and spending the card when the effect fizzles.

Success spends and replaces the physical card once and leaves the turn after its completed Regular Move; no third ordinary move is granted. The extra move does not advance the fullmove number or increment the halfmove clock again, although a capture or Pawn component resets the halfmove clock. Clear stale en-passant opportunities and preserve physical identity and attached markers unless their own movement or capture expiry applies. Normal Plots Within Plots timing and saved-trigger rules still apply.

### 21.3 Merciless

Merciless is a nine-point, non-unique regular card played after your move. Immediately after a quiet Regular Move that moved a Rook, move that same physical Rook once more using a single `[{ from, to }]` target. Current Rooks, unpromoted original Rooks under §10, already-promoted Rooks, and composites containing a Rook qualify, including controlled neutral pieces. A Pawn that became a Rook only through promotion on the triggering move does not qualify. Movement geometry alone does not grant Rook identity.

Castling moves the Rook as well as the King: its relocated Rook may take the extra move. Select that physical Rook from its post-castling square; the King stays at its castled square, and an unmoved second Rook is ineligible. A capturing Regular Move, a move made by a card, an older turn's move, or a different piece's move cannot trigger Merciless.

The additional move uses the Rook's current ordinary movement and may capture. All current paths, walls, destination restrictions, capture immunity, royal safety, composite powers, promotion, and arrival effects apply. Resolve direct mate and self-check under §11.6, restoring the position after the first move and spending the card if the additional move fizzles. Success spends and replaces the physical card once and keeps the turn after its completed Regular Move; it grants no third ordinary move. Preserve identity and markers unless their own movement or capture expiry applies. Clear stale en-passant opportunities and update moved or captured castling rights. Do not advance the fullmove number or increment the halfmove clock again; a capture or unpromoted Pawn component resets it. Normal Plots Within Plots saved-trigger rules apply.

## 22. Specific hazardous interactions

### 22.1 Fireball and the King

Fireball is a ten-point, non-unique regular card played after the acting player's latest completed actual move in the current turn, provided that move did not capture an opposing piece. A move granted or replacing the Regular Move may qualify if a card allowance remains. Use the current square of one physical nonroyal piece other than a Prince that actually moved as the target string. A castling Rook or a newly promoted Pawn may qualify; an unmoved piece, any Prince, an older turn's move, a non-move swap, or fabricated move history does not. If multiple pieces moved, choose one eligible center. Normal Plots Within Plots saved-trigger rules apply.

The center and all pieces in its eight adjacent fixed-coordinate squares are captured simultaneously, whatever their color. This is an area capture, not movement: walls, intervening paths, and square geometry beyond adjacency do not stop the blast. Kings, Coup Princes, and composites containing either are unaffected and cannot be selected as the center (official FAQ, page 20). Other capture protection also applies: skip protected adjacent pieces; a protected center is ineligible. In particular, Fireball cannot remove Pacifist pieces or any piece protected by Truce, and a Pacifist piece cannot be selected to explode. Apply Mystic Shield's protection only during its specified opposing turn. Preserve physical identities in the captured zone and perform normal capture expiry for piece-bound effects and all components of a captured composite.

Resolve the complete simultaneous result under §11.6: newly created direct mate or acting-King self-check fizzles, restoring the pre-card board while spending and replacing Fireball once and preserving the already completed move. Fireball can provide an eligible after-move rescue by removing the checking piece. Success spends and replaces the physical card once, keeps the turn after its move, grants no extra move, resets the halfmove clock for capture, and does not advance the fullmove counter again. Revoke rights of captured Rooks and retain only still-valid en-passant opportunities. A capture of an opposing piece in the triggering move, including en passant or an arrival capture, prevents the Fireball trigger.

If Bog follows Fireball after a qualifying Rook, Bishop, or Queen move, shorten the move and relocate the explosion to that endpoint (official FAQ, pp. 12 and 28). Undo the original blast's captures and dependent effect expiry, then recompute all victims and protections at the shortened endpoint. Keep both physical cards spent and replaced once. Apply §11.6 to the complete shortened move and explosion; if Bog fizzles, retain the original Fireball result.

### 22.2 Irresistible Force

A Pawn pushes the occupied piece ahead, potentially creating a chain. A piece pushed off the last rank is captured. A King cannot be pushed.

Recommended ruling: reject the entire play before moving anything if the chain reaches a King. Check Forbidden City and walls for every push boundary; Forbidden City stops all movement but still spends the card (official FAQ, p. 31), using the replacement-move fizzle policy in §11.6. A Pacifist or Truce-protected piece cannot be pushed off-board if that result counts as capture; it may still be displaced on-board unless another rule prevents it.

### 22.3 Split Knight

Split Knight is a seven-point, non-unique regular card played instead of the Regular Move. Use `{ knight, targets }`, where `knight` is a controlled on-board current or unpromoted original Knight's square and `targets` lists at least two distinct occupied opposing squares. Neutral pieces may qualify under the usual control and opposition rules. Select any subset of the available victims, but every selected victim must be a legal ordinary capture by that Knight in the pre-card position under its current movement powers and effects. A pinned Knight cannot claim captures that would leave its King in check. Pacifism and Truce eliminate threat and prevent protected captures.

Capture the selected pieces simultaneously, then remove the selected Knight as captured. The Knight does not visit any victim's square; this is not an arrival move. Preserve physical identities and apply normal capture handling to composite pieces and piece-bound effects. Neither a victim nor the sacrificed Knight may be royal. Unselected pieces remain in place. Reject malformed, duplicate, empty, friendly, or non-capturable selections atomically.

Apply the replacement-move fizzle procedure in §11.6 to the complete result: the card cannot newly create direct checkmate or leave the acting King in check. Success spends and replaces the physical card once, consumes the Regular Move, clears en-passant availability, resets the halfmove clock for capture, and advances the fullmove number after Black. Removed Rooks lose their associated castling rights.

### 22.4 Under Elf Hill

Under Elf Hill is a seven-point, non-unique regular card played instead of the Regular Move, with no target payload. Remove the acting player's royal piece to the away zone, retaining its physical identity, owner, current and original role, promotion, neutrality, and attached effects. This is temporary absence, not capture or death; a capturable Prince stays on the board. The absent King cannot be checked or threaten squares. The card may escape check, but its removal may not newly create direct mate against the opponent. Spend and replace the card once, consume the Regular Move, clear en-passant availability, revoke the departing King's castling rights, and advance the clocks as one non-capture replacement move (reset the halfmove clock only for an unpromoted original Pawn).

At the beginning of that owner's next turn, before any move, card, timeout, or other optional action, choose the return square with `{ type: 'returnKing', to }`. The public `underElfHillReturnSquares(state)` lists legal choices only while this return is due. The square must be vacant, on any fixed board edge, and legal for placement under active effects. Restore the same physical King without capture or promotion; its destination must be safe, and the placement cannot newly create direct mate. Returning does not consume the new turn's Regular Move or card allowance, draw another card, or advance the clocks. Illegal or mistimed choices leave the pending return and state unchanged. There is no automatic choice or forfeit of this mandatory placement.

The returned physical piece cannot move or capture for the remainder of that owner's turn, including moves granted by cards, and consequently does not threaten squares during the restriction. Other pieces may move and the player may otherwise take a normal turn. Non-move swaps remain governed by the general swap rule. The restriction expires when that turn ends; ownership, transformation, or a later change in royal status does not transfer it to another physical piece. Piece-bound effects remain attached throughout the temporary absence and return unless their own explicit rule expires them; Peace Talks does not cancel Under Elf Hill because it is not a Continuing Effect.

If no legal return square exists, the official ruling is stalemate immediately, not checkmate, because the absent King is not in check but the game cannot continue. The mandatory return is resolved before testing ordinary move availability for that turn. After a legal return, if no legal Regular Move is available, the player may end the turn without moving instead of being stalemated (official FAQ, page 62).

### 22.5 Hidden Passage and Man of Straw

Hidden Passage is a ten-point, non-unique regular card played instead of the Regular Move. Use a one-element move list `[{ from, to }]` selecting the acting player's owned, on-board royal piece and a different empty square anywhere on the board. Royal identity determines the King, including a Coup replacement; a capturable Prince is not eligible. Preserve physical identity, ownership, current and original role, promotion, neutrality, and attached effects; composite components travel together. This relocation ignores ordinary movement geometry and intervening squares, but respects restrictions on the physical piece moving and on its destination, including Forbidden City, and applies arrival effects. It neither captures nor promotes, even when a royal Pawn reaches its last rank (§12.3).

Reject malformed, occupied, mistimed, or ineligible selections atomically. Apply the replacement-move fizzle procedure in §11.6 to the complete result: the destination must leave the acting King safe, and the card cannot newly create direct mate against the opponent. A checked player holding a legal Hidden Passage escape must receive that opportunity before checkmate is finalized. Success spends and replaces the physical card once, consumes the Regular Move, clears en-passant availability, revokes the relocated royal's castling rights, and advances the clocks as a non-capture replacement move (reset the halfmove clock only for an unpromoted original Pawn; advance the fullmove number after Black).

Man of Straw is a nine-point, non-unique regular card played before the Regular Move, only while the acting King is in check, including ordinary board checkmate. Use `{ king, pawn }` to select two distinct occupied squares: an owned royal piece currently in check and a controlled, nonroyal unpromoted original Pawn. A capturable Prince is not a King. A neutral Pawn can be selected by either player; a temporarily transformed original Pawn or a composite containing one remains eligible, but a promoted Pawn does not.

Exchange the two board pieces atomically, retaining their physical identities, ownership, current powers, promotion, neutrality, and unexpired attached markers. Composite components stay together. No capture, promotion, arrival trigger, or intervening path applies. Fatal Attraction's movement restriction and magnet expiration do apply to this swap under §18.6; this corrects the former blanket movement-restriction exception without changing other swap-trigger interpretations. Square-bound effects stay on their squares. Forbidden City cannot receive either piece. The complete position must leave every acting royal piece safe, including any neutral royal involved, and must not newly create direct mate against the opponent. An unsafe or direct-mate result fizzles under §11.6, restoring the board while spending the card and leaving the Regular Move available.

Success spends and replaces the card once, preserves the before-move phase and the Regular Move, and does not advance either move clock or change the active color. Revoke the relocated King's castling rights and retain only still-valid en-passant opportunities; the swap creates no new one. A checked player holding a legal Man of Straw escape must receive that opportunity before checkmate is finalized.

### 22.6 Peace Talks

Peace Talks cancels one Continuing Effect. If cancellation leaves a piece in an illegal situation, that piece's owner must correct it on the next move or lose the piece.

The Checkmate Rule still comes first. Peace Talks cannot cancel an effect when doing so would directly cause an illegal King loss or equivalent immediate victory.

### 22.7 Haunting Memories

It copies the last played card but cannot copy a unique card from its owner's deck; it may copy an opponent's unique card.

Recommended ruling: "last card played" refers to the latest successfully declared card, even if that card was later canceled, unless the official timing text states that Haunting Memories requires the previous card to have resolved. Copy the text and classification, not ownership-specific physical metadata.

### 22.8 Vulture

Vulture takes the opponent's last played card into hand. With separate decks, its player also discards their top undrawn card.

Play Vulture immediately after the opponent plays a card, taking that exact physical card rather than an older discard. The official FAQ (p. 50) explicitly permits taking an active Continuing Effect: leave a proxy in play that remains independently active and can still be canceled by Peace Talks. The retrieved physical card may be replayed; canceling or expiring the original proxy does not discard that physical card from its new location. See [the publisher FAQ](audit/ten-hour-2026-09-08/official-faq.txt), lines 2166–2174.

### 22.9 No Quarter

No Quarter binds to the exact physical enemy piece captured by the immediately preceding Regular Move, including an en-passant victim or a piece captured during promotion. A capture or removal made by a card, an older turn's capture, or a stale or missing piece identity is ineligible. The piece keeps its owner, current and original roles, promotion, royal, neutral, and attached-effect identity; only its state changes from captured to dead, so it stays off-board and can no longer be returned by another card.

Plots Within Plots preserves this original ordinary-capture trigger under §17.3, including when its first extra card moves or removes the capturer. The original victim must still be captured when No Quarter executes; an extra card cannot manufacture a missing initial capture trigger. This applies the FAQ's original-move ruling for Fireball (pp. 51–52) by analogy, rather than an explicit No Quarter FAQ ruling.

### 22.10 Evil Eye

Evil Eye is a nine-point, non-unique regular card played instead of the Regular Move. Use `{ attacker, victim }` to choose two distinct occupied squares: a piece controlled by the acting player and one opposing piece it currently threatens. A neutral attacker is controlled by either player, and a neutral victim may be selected by either player. A non-neutral victim must belong to the acting player's opponent even when the selected attacker is neutral. The victim cannot contain a royal component. Any type of attacker, including a King, may qualify.

A threat requires a legal ordinary capture of the selected physical victim in the pre-card position, under the attacker's current powers, paths, orientation, and restrictions. Mere geometric reach is insufficient: a pinned piece cannot claim a capture that would expose its King, and capture immunity or inability to move or capture removes the threat. A valid en-passant capture also threatens its physical Pawn victim; select that Pawn's occupied square, not the empty en-passant destination.

For a royal attacker, including a current Coup King, defer the hypothetical capture's King-safety check: FAQ26 expressly permits a King to capture an adjacent protected Knight while remaining safely in place. All movement and capture restrictions still apply, and the actual stationary result must satisfy King safety; this exception does not relax the pinned nonroyal attacker restriction.

Capture only the selected victim, including all of its composite components, while leaving the attacker and every other piece in place. This is an indirect capture, not movement, arrival, promotion, or sacrifice of the attacker. Preserve the attacker's physical identity, attached markers, and castling rights; effects that expire on the victim's capture expire normally. Never trigger a destination trap or expire the attacker's magnet merely because it made this stationary capture.

Apply §11.6 to the complete result, including effects released by capture: direct-mate or self-check failure restores the board and spends the card under the replacement-move consumption rule. Success spends and replaces the physical card once, consumes the Regular Move, clears en-passant availability, resets the halfmove clock, advances Black's fullmove number once, and removes castling rights belonging to a captured Rook.

### 22.11 Hostage

Hostage is a nine-point, non-unique regular reaction card played immediately after an opponent captures one of your pieces, whether by a Regular Move or a resolved card effect. Use `{ pieceId, pawn }`: `pieceId` identifies one owned physical piece captured by that immediately preceding event, and `pawn` is the occupied square of a controlled, unpromoted original Pawn to be captured instead. The reacting player is the captured piece's original owner. Captured neutrality does not transfer that ownership; an on-board neutral Pawn can be selected by either player.

The captured piece must still be captured, not dead, away, on board, royal, or taken in an older event. The substitute Pawn and every component of its composite must be capturable and nonroyal. A promoted Pawn is not eligible; a temporarily transformed original Pawn remains eligible. A capture of a composite permits choosing one captured physical component, returned separately as its original piece under §15.4. A capturable Prince may return as a Prince, never as a new King.

Capture the substitute Pawn (and all components of its composite), then return the selected captured physical piece to that vacated square. Preserve the returned piece's owner, identity, promotion, neutrality, and recent transformation under §10. Explicitly capture-expired effects remain expired. The original capturing piece stays exactly where the capture left it. This is capture plus placement, not an arrival move, promotion, or rollback of the opponent's move. Movement-only restrictions and walls do not block placement; a Forbidden City destination does. Apply normal capture expiry to the substitute and retain square-bound effects.

The response window closes on endTurn or an unrelated intervening event; an older capture cannot be reused. Plots Within Plots may preserve its original immediate window under §17.3, but a selected captured piece already returned is no longer eligible. The capture must have been made by the reacting player's opponent, not by the reacting player sacrificing their own piece. Support an immediate response to an opponent's capture card even when that card was itself a reaction during the reacting player's turn.

Spend and replace only the reacting player's physical Hostage card and consume that player's card allowance, without using their upcoming Regular Move or changing the current turn owner, phase, or move status. Reset the halfmove clock for the substitute capture, preserve the fullmove number and active color, remove only en-passant opportunities invalidated by the changed pieces, and never restore castling rights lost in the original capture.

If the complete effect newly mates the opponent or newly exposes the reacting King's check, restore the pre-card board while spending Hostage. A reactor whose Regular Move is still upcoming may remain in pre-existing check and answer it on that move; Hostage cannot leave that player's already completed turn illegally in check. The response may also rescue a checking capture. Never consume an additional Regular Move on a Hostage fizzle.

### 22.12 Legacy

Legacy is a ten-point, non-unique regular reaction card played immediately when one of the player's non-Pawn physical pieces is captured by an actual move or resolved capture effect. A promoted Pawn qualifies under its current type; an unpromoted original Pawn remains a Pawn for this restriction even if temporarily transformed. A captured composite qualifies when at least one captured physical component owned by the player is non-Pawn. Original ownership governs neutral victims. Capture is required: death, temporary absence, a non-capture, fabricated history, or an older event does not qualify. The captured component must still be in the captured zone. The printed trigger does not require the captor to be the opponent. Plots Within Plots may preserve its original capture window, but cannot create an eligibility that was absent when it was played.

Use the physical ID of a card already in that player's discard pile as the target string. This identifies the reacting player in the standard separate-deck game (§4.1), including a reaction during that player's own turn. Any discarded card may be chosen, including another Legacy, a unique card, or a Continuing Effect whose physical card has actually been discarded. A card in hand, deck, an active effect, the other player's discard, or the currently played Legacy is not eligible. The common-discard clause in the artwork belongs to the optional common-deck variant (§4.2); do not treat the two separate discard piles as one shared pile.

Return the selected physical card to hand without changing its ID or playing its effect. Spend and replace the selected physical Legacy once under normal card accounting, so the retrieved card is in addition to its ordinary replacement draw. Remove exactly the selected discard entry and preserve the relative order of all other cards. Retrieval itself does not grant permission to play the returned card: ordinary allowance and Plots Within Plots saved-eligibility rules still apply. Preserve the board, all piece/effect identities, orientation, en-passant, castling rights, clocks, pending obligations, and the current turn's owner, phase, and move status. Consume only the reacting player's current card allowance, leaving their following turn's allowance available. The immediate window closes on an unrelated action or endTurn. Reject invalid selection or timing atomically, without a draw or card expenditure.

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

**Engine convention:** coordinates remain attached to the board, with `a1` initially at White's left; orientation is separate state. Pieces, walls, concealed Man-Trap squares, and recorded moves retain those square labels when the physical board turns. Players remain stationary. The publisher specifies physical rotation and owner-relative movement, but does not prescribe this engine representation.

`orientation` is the board's counterclockwise angle viewed from above: 0, 90, 180, or 270 degrees. White's forward vectors in board coordinates are respectively increasing ranks, increasing files, decreasing ranks, and decreasing files; Black's are opposite. The public `clockwise`/`counterclockwise` directions name physical board turns, so clockwise subtracts 90 degrees modulo 360. Owner-relative starting lines and frontier follow the same geometry. Castling retains the same physical King/Rook cells and rights; the FAQ's file-versus-rank description refers to their alignment at the table after rotation, not a relabeling of engine squares.

### 25.10 Speech and real-time effects

Doomsayer, Panic, and Abduction rely on human behavior rather than board mechanics. They create accessibility, language, and adjudication issues.

**Recommended default:** agree on an accessible substitute before play and never spring a physical or cognitive challenge on a player who cannot fairly perform it.

## 26. Minimal pre-game rulings sheet

Before a serious game, agree on these points:

1. Which edition and card pool are used?
2. Separate decks or common deck?
3. What point total and handicap apply?
4. Which chess draw rules apply?
5. Use the engine's board-attached coordinates through Earthquake (§25.9), or explicitly agree on another notation for physical play.
6. How are simultaneous multi-piece effects resolved?
7. Does losing a move still permit a non-move card?
8. How are Confabulated pieces captured and returned?
9. Use the official FAQ's proxy ruling when Vulture takes an active Continuing Effect (§22.8).
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
