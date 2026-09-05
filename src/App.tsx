import { useCallback, useState } from 'react';

import assetRightsUrl from '../ASSET_RIGHTS.md?url';
import licenseUrl from '../LICENSE?url';
import noticesUrl from '../THIRD_PARTY_NOTICES.md?url';

import { ChessBoard } from './ChessBoard.js';
import { CARD_CATALOG } from './game/cards/catalog.js';
import { applyAction, legalDests } from './game/reducer.js';
import { createGameState } from './game/state.js';
import type { CardInstance, Color, GameState, SquareName } from './game/types.js';

const titleCase = (value: string) => value[0].toUpperCase() + value.slice(1);

function demoGame(): GameState {
  return createGameState({
    hands: { white: ['disintegration'], black: ['disintegration'] },
    decks: { white: [], black: [] },
  });
}

interface HandProps {
  color: Color;
  cards: CardInstance[];
  active: boolean;
  selected: string | null;
  onSelect: (card: CardInstance) => void;
  onPreview: (cardId: string) => void;
}

function Hand({ color, cards, active, selected, onSelect, onPreview }: HandProps) {
  return (
    <section className={`hand hand--${color}`} aria-label={`${titleCase(color)} hand`}>
      <div className="hand__label">
        <span>{titleCase(color)}</span>
        <span>{cards.length} card{cards.length === 1 ? '' : 's'}</span>
      </div>
      <div className="hand__cards">
        {cards.length === 0 ? <span className="empty-hand">No cards</span> : null}
        {cards.map(card => {
          const definition = CARD_CATALOG[card.cardId];
          if (!definition) return null;
          return (
            <button
              aria-label={definition.name}
              aria-pressed={selected === card.id}
              className={`card ${selected === card.id ? 'card--selected' : ''}`}
              disabled={!active}
              key={card.id}
              onClick={() => onSelect(card)}
              onFocus={() => onPreview(card.cardId)}
              onMouseEnter={() => onPreview(card.cardId)}
              type="button"
            >
              <img alt="" src={definition.image} />
              <span>{definition.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function App() {
  const [game, setGame] = useState(demoGame);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState('disintegration');
  const [message, setMessage] = useState('Select a card or make a legal move.');
  const [hasError, setHasError] = useState(false);
  const [keyboardFrom, setKeyboardFrom] = useState<SquareName | ''>('');
  const [keyboardTo, setKeyboardTo] = useState<SquareName | ''>('');
  const [keyboardTarget, setKeyboardTarget] = useState<SquareName | ''>('');
  const preview = CARD_CATALOG[previewId] ?? CARD_CATALOG.disintegration;
  const moves = legalDests(game);
  const keyboardDestinations = keyboardFrom ? moves.get(keyboardFrom) ?? [] : [];
  const cardTargets = game.pieces.filter(
    piece => piece.zone === 'board'
      && piece.square
      && (piece.owner === game.turn.color || piece.neutral)
      && piece.originalRole === 'pawn'
      && !piece.promoted
      && !piece.royal,
  );

  const reduce = useCallback((action: Parameters<typeof applyAction>[1]) => {
    const result = applyAction(game, action);
    if (!result.ok) {
      setMessage(result.error.message);
      setHasError(true);
      return false;
    }
    setGame(result.state);
    setHasError(false);
    setKeyboardFrom('');
    setKeyboardTo('');
    setKeyboardTarget('');
    if (result.state.outcome) {
      setMessage(
        result.state.outcome.reason === 'stalemate'
          ? 'Game over — stalemate.'
          : `Game over — ${titleCase(result.state.outcome.winner!)} wins by checkmate.`,
      );
      return true;
    }
    const event = result.state.history.at(-1);
    if (event?.type === 'cardFizzled') {
      setMessage('Disintegration was spent, but direct checkmate made its effect fizzle.');
    } else if (event?.type === 'cardPlayed') {
      setMessage(`Disintegration removed the Pawn on ${event.target}.`);
    } else {
      setMessage('Move complete. You may play a card or end the turn.');
    }
    return true;
  }, [game]);

  const move = useCallback((from: SquareName, to: SquareName) => {
    const moving = game.pieces.find(piece => piece.zone === 'board' && piece.square === from);
    const promotes = moving?.role === 'pawn' && (to.endsWith('1') || to.endsWith('8'));
    const promotion = promotes
      ? window.prompt('Promote to queen, rook, bishop, or knight:', 'queen') ?? 'queen'
      : undefined;
    reduce({ type: 'move', from, to, ...(promotion ? { promotion } : {}) });
  }, [game.pieces, reduce]);

  const target = useCallback((square: SquareName) => {
    if (!selectedCard) return;
    if (reduce({ type: 'playCard', cardId: 'disintegration', target: square })) {
      setSelectedCard(null);
    }
  }, [reduce, selectedCard]);

  const reset = () => {
    setGame(demoGame());
    setSelectedCard(null);
    setMessage('Select a card or make a legal move.');
    setHasError(false);
    setKeyboardFrom('');
    setKeyboardTo('');
    setKeyboardTarget('');
  };

  const selectCard = (card: CardInstance) => {
    const selecting = selectedCard !== card.id;
    setPreviewId(card.cardId);
    setSelectedCard(selecting ? card.id : null);
    setMessage(selecting ? 'Choose one of your Pawns on the board.' : 'Card deselected. Make a legal move or select it again.');
    setHasError(false);
    setKeyboardTarget('');
  };

  const status = game.outcome
    ? game.outcome.reason === 'stalemate'
      ? 'Draw by stalemate'
      : `${titleCase(game.outcome.winner!)} wins by checkmate`
    : `${titleCase(game.turn.color)} to move`;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/" onClick={event => { event.preventDefault(); reset(); }}>
          <span className="brand__mark">N</span>
          <span>knightmare chess</span>
        </a>
        <div className="turn" aria-live="polite">
          <span className={`turn__dot turn__dot--${game.turn.color}`} />
          {status}
        </div>
      </header>

      <main className="game">
        <div className="game__center">
          <div className="hands-rail">
            <Hand
              active={!game.outcome && game.turn.color === 'black'}
              cards={game.players.black.hand}
              color="black"
              onPreview={setPreviewId}
              onSelect={selectCard}
              selected={selectedCard}
            />
            <Hand
              active={!game.outcome && game.turn.color === 'white'}
              cards={game.players.white.hand}
              color="white"
              onPreview={setPreviewId}
              onSelect={selectCard}
              selected={selectedCard}
            />
          </div>

          <section className="board-panel" aria-label="Game board">
            <div className="board-heading">
              <div>
                <span className="eyebrow">Local self-play</span>
                <h1>Your board, both hands</h1>
              </div>
              <span className="phase">{game.turn.phase === 'beforeMove' ? 'before move' : 'after move'}</span>
            </div>

            <div className={selectedCard ? 'board-frame board-frame--targeting' : 'board-frame'}>
              <ChessBoard
                onMove={move}
                onTarget={target}
                state={game}
                targeting={Boolean(selectedCard)}
              />
            </div>

            <div className="controls">
              <div className="controls__main">
                <p className="message" role={hasError ? 'alert' : 'status'}>
                  {message}
                </p>
                <div className="controls__buttons">
                  <button className="button button--ghost" onClick={reset} type="button">Reset</button>
                  <button
                    className="button button--primary"
                    disabled={!game.turn.moveMade || Boolean(game.outcome)}
                    onClick={() => {
                      if (reduce({ type: 'endTurn' })) setSelectedCard(null);
                    }}
                    type="button"
                  >
                    End turn
                  </button>
                </div>
              </div>

              <details className="keyboard-controls">
                <summary>Keyboard controls</summary>
                {selectedCard ? (
                  <form onSubmit={event => {
                    event.preventDefault();
                    if (keyboardTarget) target(keyboardTarget);
                  }}>
                    <label>
                      Pawn target
                      <select
                        aria-label="Pawn target"
                        onChange={event => setKeyboardTarget(event.target.value as SquareName)}
                        required
                        value={keyboardTarget}
                      >
                        <option value="">Choose square</option>
                        {cardTargets.map(piece => <option key={piece.id} value={piece.square!}>{piece.square}</option>)}
                      </select>
                    </label>
                    <button className="button button--primary" type="submit">Play card</button>
                  </form>
                ) : (
                  <form onSubmit={event => {
                    event.preventDefault();
                    if (keyboardFrom && keyboardTo) move(keyboardFrom, keyboardTo);
                  }}>
                    <label>
                      From
                      <select
                        aria-label="Move from"
                        disabled={game.turn.moveMade || Boolean(game.outcome)}
                        onChange={event => {
                          setKeyboardFrom(event.target.value as SquareName);
                          setKeyboardTo('');
                        }}
                        required
                        value={keyboardFrom}
                      >
                        <option value="">Choose piece</option>
                        {[...moves.keys()].map(square => <option key={square} value={square}>{square}</option>)}
                      </select>
                    </label>
                    <label>
                      To
                      <select
                        aria-label="Move to"
                        disabled={!keyboardFrom}
                        onChange={event => setKeyboardTo(event.target.value as SquareName)}
                        required
                        value={keyboardTo}
                      >
                        <option value="">Choose square</option>
                        {keyboardDestinations.map(square => <option key={square} value={square}>{square}</option>)}
                      </select>
                    </label>
                    <button className="button button--primary" type="submit">Make move</button>
                  </form>
                )}
              </details>
            </div>
          </section>

          <aside className="details" aria-label="Card details" role="region">
            <div className="details__topline">
              <span>card preview</span>
              <span>{preview.points} points</span>
            </div>
            <img alt={`${preview.name} card`} src={preview.image} />
            <h2>{preview.name}</h2>
            <p>{preview.description.replaceAll('*', '')}</p>
            <span className="timing">Play before or after your move</span>
          </aside>
        </div>
      </main>
      <footer className="footer">
        <span>local frontend · no engine · no server</span>
        <nav aria-label="Legal">
          <a href={licenseUrl}>GPL license</a>
          <a href={noticesUrl}>third-party notices</a>
          <a href={assetRightsUrl}>card asset rights</a>
        </nav>
      </footer>
    </div>
  );
}
