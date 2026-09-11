import type { Color, Role, SquareName } from 'chessops/types';

export type { Color, Role, SquareName };

export type CardId = string;
export type TurnPhase = 'beforeMove' | 'afterMove';
export type PieceZone = 'board' | 'captured' | 'dead' | 'away';
export type BoardOrientation = 0 | 90 | 180 | 270;

export interface PieceState {
  id: string;
  owner: Color;
  role: Role;
  originalRole: Role;
  square: SquareName | null;
  zone: PieceZone;
  promoted: boolean;
  royal: boolean;
  neutral: boolean;
  neutralBeforeEffects?: boolean;
  capturedAtPly?: number;
  capturedBy?: Color;
}

export interface CardInstance {
  id: string;
  cardId: CardId;
  /** Vulture's nonphysical Continuing Effect marker; never enters a player's piles. */
  proxy?: true;
}

export interface CardMove {
  from: SquareName;
  to: SquareName;
}

export interface EnPassantOpportunity {
  target: SquareName;
  pawnId: string;
}

export interface PendingRescueState {
  before?: GameState;
  fen: string;
  pieces: PieceState[];
  enPassant: EnPassantOpportunity[];
  historyLength: number;
  history?: GameEvent[];
  movedPieceIds: string[];
}

export interface HolyWarTarget {
  knight: SquareName;
  bishop: SquareName;
}

export interface AnathemaTarget {
  bishop: SquareName;
  rook: SquareName;
}

export interface SiegeTarget {
  knight: SquareName;
  rook: SquareName;
}

export interface SplitKnightTarget {
  knight: SquareName;
  targets: SquareName[];
}

export interface EvilEyeTarget {
  attacker: SquareName;
  victim: SquareName;
}

export interface SanctuaryTarget {
  king: SquareName;
  rook: SquareName;
}

export interface ManOfStrawTarget {
  king: SquareName;
  pawn: SquareName;
}

export interface EvangelistsTarget {
  own: SquareName;
  opponent: SquareName;
}

export interface WingedVictoryTarget {
  pieceId: string;
  to: SquareName;
}

export interface ResurrectionTarget {
  pieceId: string;
  to: SquareName;
}

export interface HostageTarget {
  pieceId: string;
  pawn: SquareName;
}

export type EarthquakeDirection = 'clockwise' | 'counterclockwise';

export interface PromotionDeclaration {
  square: SquareName;
  role: 'queen' | 'rook' | 'bishop' | 'knight';
}

export interface EarthquakeTarget {
  direction: EarthquakeDirection;
  promotions: PromotionDeclaration[];
}

export interface PeaceTalksTarget {
  effectId: string;
  promotions: PromotionDeclaration[];
}

export type DoomsayerRole = Exclude<Role, 'king'> | 'crab' | 'prince';

export interface DoomsayerEffect {
  type: 'doomsayer';
  owner: Color;
  card: CardInstance;
}

export interface PacifismEffect {
  type: 'pacifism';
  owner: Color;
  card: CardInstance;
  pieceId: string;
}

export interface FatalAttractionEffect {
  type: 'fatal-attraction';
  owner: Color;
  card: CardInstance;
  pieceId: string;
}

export interface CrabEffect {
  type: 'crab';
  owner: Color;
  card: CardInstance;
  pieceId: string;
}

export interface CurseEffect {
  type: 'curse';
  owner: Color;
  card: CardInstance;
  pieceId: string;
}

export interface ManTrapEffect {
  type: 'man-trap';
  owner: Color;
  card: CardInstance;
  square: SquareName;
}

export interface ForbiddenCityEffect {
  type: 'forbidden-city';
  owner: Color;
  card: CardInstance;
  square: SquareName;
}

export interface FortificationEffect {
  type: 'fortification';
  owner: Color;
  card: CardInstance;
  from: SquareName;
  to: SquareName;
}

export interface VendettaEffect {
  type: 'vendetta';
  owner: Color;
  card: CardInstance;
}

export interface PanicEffect {
  type: 'panic';
  owner: Color;
  player: Color;
  durationMs: 15000;
}

export interface ChallengeEffect {
  type: 'challenge';
  owner: Color;
  player: Color;
  pieceId: string;
}

export interface DungeonEffect {
  type: 'dungeon';
  owner: Color;
  player: Color;
  pieceId: string;
}

export interface ConfabulationEffect {
  type: 'confabulation';
  owner: Color;
  card: CardInstance;
  pieceIds: [string, string];
}

export interface PendingDoomsayerState {
  player: Color;
  cardInstanceId: string;
}

export interface DoomsayerLoss {
  effectId: string;
  pieceId: string;
}

export interface PlayerState {
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
}

export interface GameEvent {
  type: 'move' | 'cardPlayed' | 'cardFizzled' | 'pieceNamed' | 'doomsayerDeclined';
  movedPieceId?: string;
  movedRoles?: Role[];
  castlingRook?: { pieceId: string; to: SquareName };
  cardId?: CardId;
  copiedCardId?: CardId;
  deckOwner?: Color;
  capturedId?: string;
  capturedIds?: string[];
  effectIds?: string[];
  resolvedEffectIds?: string[];
  player?: Color;
  color?: Color;
  speaker?: Color;
  role?: DoomsayerRole;
  name?: DoomsayerRole;
  immediate?: boolean;
  movement?: CardMove[];
  preservePreviousMove?: boolean;
  target?: SquareName | CardMove | CardMove[] | readonly PromotionDeclaration[] | HolyWarTarget | AnathemaTarget | SanctuaryTarget | ManOfStrawTarget | SiegeTarget | SplitKnightTarget | EvilEyeTarget | EvangelistsTarget | EarthquakeTarget | PeaceTalksTarget | WingedVictoryTarget | HostageTarget;
  reason?: 'DIRECT_MATE' | 'SELF_CHECK' | 'FORBIDDEN_CITY';
  from?: SquareName;
  to?: SquareName;
  promotion?: Role;
  previousFen?: string;
}

export interface GameState {
  riposteLostMoves?: Color[];
  riposteSkipped?: Color;
  riposteCheckDeferred?: Color;
  legacyCapture?: { historyLength: number; pieceIds: string[] };
  fogCheckpoint?: {
    before: GameState; player: Color; card: CardInstance; historyLength: number;
    action?: Extract<GameAction, { type: 'playCard' }>;
    responses?: GameAction[];
    plots?: { allowanceIndex: number; previous?: GameState['fogCheckpoint'] };
    canceledCards?: string[];
  };
  fogLocked?: Color[];
  chaosCheckpoint?: { before: GameState; movement: string; historyLength: number; card?: CardInstance };
  chaosForbidden?: { player: Color; movement: string; additionalMove?: boolean };
  shieldMove?: { player: Color; pieceIds: string[]; capturedOpponent?: boolean };
  plotsAllowances?: Array<{
    player: Color;
    remaining: number;
    eligibleCards: string[];
    window: {
      phase: TurnPhase;
      moveMade: boolean;
      shieldMove?: GameState['shieldMove'];
      reaction?: GameEvent;
      revengePawnIds?: string[];
      capture?: GameEvent;
      legacyCapture?: GameState['legacyCapture'];
      cardResponse?: { player: Color; historyLength: number };
      fogCheckpoint?: GameState['fogCheckpoint'];
    };
  }>;
  /** Present only while evaluating one card in its saved Plots window. */
  plotsExecution?: {
    player: Color;
    allowanceIndex?: number;
    window: NonNullable<GameState['plotsAllowances']>[number]['window'];
  };
  pendingAbduction?: {
    phase: 'concealment' | 'recall';
    player: Color;
    durationMs: 10000;
    pieceId: string;
    requiresPieceId: boolean;
    before: GameState;
  } | null;
  underElfHill?: Array<{ pieceId: string; player: Color; returning: boolean; returned?: boolean }>;
  fen: string;
  pieces: PieceState[];
  players: Record<Color, PlayerState>;
  turn: {
    color: Color;
    phase: TurnPhase;
    moveMade: boolean;
    cardPlays: Record<Color, number>;
  };
  effects: unknown[];
  history: GameEvent[];
  playedCards?: Array<{ player: Color; cardInstanceId: string }>;
  cardResponse?: { player: Color; historyLength: number };
  orientation: BoardOrientation;
  enPassant: EnPassantOpportunity[];
  pendingRescue?: PendingRescueState | null;
  pendingDoomsayer?: PendingDoomsayerState | null;
  turnCheckpoint?: GameState | null;
  outcome: { winner?: Color; reason: 'checkmate' | 'stalemate' | 'surrender' } | null;
}

export type GameAction =
  | { type: 'revealAbduction' }
  | { type: 'answerAbduction'; player: Color; role: Role; owner: Color; square: SquareName; pieceId?: string }
  | { type: 'abductionTimeout' }
  | { type: 'returnKing'; to: unknown }
  | { type: 'move'; from: unknown; to: unknown; promotion?: unknown; enPassant?: unknown }
  | { type: 'playCard'; cardId: CardId; cardInstanceId?: unknown; target?: unknown }
  | { type: 'namePiece'; speaker: Color; name: DoomsayerRole; losses: DoomsayerLoss[] }
  | { type: 'declineDoomsayer'; player?: unknown; color?: unknown }
  | { type: 'panicTimeout' }
  | { type: 'endTurn'; discardCardInstanceId?: string };

export type GameErrorCode =
  | 'CARD_NOT_IN_HAND'
  | 'CARD_ALREADY_PLAYED'
  | 'INVALID_TIMING'
  | 'INVALID_TARGET'
  | 'WRONG_OWNER'
  | 'WRONG_ROLE'
  | 'ILLEGAL_MOVE'
  | 'KING_IN_CHECK'
  | 'GAME_OVER';

export type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; state: GameState; error: { code: GameErrorCode; message: string } };
