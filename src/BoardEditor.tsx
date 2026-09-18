import { useEffect, useRef, useState } from 'react';
import { ChessBoard } from './ChessBoard.js';
import { applyBoardEdit, isIntactFusion, piecesForEditing } from './editPosition.js';
import type { Color, GameState, PieceState, Role, SquareName } from './game/types.js';

const roles: Role[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
const squares = Array.from({ length: 64 }, (_, i) => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}` as SquareName);
const name = (piece: PieceState) => `${piece.owner === 'white' ? 'White' : 'Black'} ${piece.role}`;
const noMove = () => false;

export function BoardEditor({ state, onApply, onCancel }: {
  state: GameState; onApply: (state: GameState) => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pieces, setPieces] = useState(() => piecesForEditing(state));
  const [color, setColor] = useState(state.turn.color);
  const [moveMade, setMoveMade] = useState(state.turn.moveMade);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<'move' | 'add' | 'remove'>('move');
  const [addColor, setAddColor] = useState<Color>('white');
  const [addRole, setAddRole] = useState<Role>('pawn');
  const [error, setError] = useState<string | null>(null);
  const piece = pieces.find(item => item.id === selected);
  const draft = { ...state, pieces };
  // Fused components stay attached to their carrier when it is moved or removed.
  const fusions = state.effects.filter(effect => effect.type === 'confabulation' && isIntactFusion(effect, pieces));
  const fusedIds = fusions.flatMap(effect => effect.type === 'confabulation' ? [effect.pieceIds[1]] : []);
  const offBoard = pieces.filter(item => item.zone !== 'board' && !fusedIds.includes(item.id));

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function updatePiece(update: Partial<PieceState>) {
    setPieces(current => current.map(item => item.id === selected ? { ...item, ...update } : item));
    setError(null);
  }

  function at(square: SquareName) {
    setError(null);
    const occupant = pieces.find(item => item.zone === 'board' && item.square === square);
    const removeIds = new Set(occupant ? [occupant.id] : []);
    for (const effect of fusions) {
      if (effect.type === 'confabulation' && effect.pieceIds.some(id => removeIds.has(id))) {
        effect.pieceIds.forEach(id => removeIds.add(id));
      }
    }
    const withoutOccupant = pieces.map(item => removeIds.has(item.id)
      ? { ...item, square: null, zone: 'captured' as const } : item);
    if (tool === 'remove') {
      setPieces(withoutOccupant);
      setSelected(null);
    } else if (tool === 'add') {
      setPieces([...withoutOccupant, {
        id: `editor-${crypto.randomUUID()}`, owner: addColor, role: addRole, originalRole: addRole,
        square, zone: 'board', royal: addRole === 'king', neutral: false, promoted: false,
      }]);
    } else if (piece) {
      if (piece.square !== square || piece.zone !== 'board') {
        setPieces(withoutOccupant.map(item => item.id === piece.id
          ? { ...item, square, zone: 'board', capturedAtPly: undefined, capturedBy: undefined } : item));
      }
      setSelected(null);
    } else {
      setSelected(occupant?.id ?? null);
    }
  }

  function apply() {
    try { onApply(applyBoardEdit(state, pieces, color, moveMade)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Check the edited position.'); }
  }

  return <dialog className="board-editor" ref={dialog} aria-labelledby="editor-title" onCancel={onCancel} onClose={onCancel}>
    <header className="editor-heading">
      <div><h2 id="editor-title">Edit board</h2><p>The game is paused while you make corrections.</p></div>
      <button className="action-button" type="button" onClick={onCancel}>Cancel</button>
    </header>
    <div className="editor-layout">
      <div>
        <div className="editor-board">
          <ChessBoard state={draft} onMove={noMove} interactive={false} descriptionId="editor-position" />
          <div className="editor-squares" role="group" aria-label="Editable board">
            {squares.map(square => {
              const occupants = pieces.filter(item => item.zone === 'board' && item.square === square);
              return <button key={square} type="button" className="editor-square" onClick={() => at(square)}
                aria-label={`${square}: ${occupants.map(name).join(' + ') || 'empty'}`}
                aria-pressed={Boolean(selected && occupants.some(item => item.id === selected))} />;
            })}
          </div>
        </div>
        <p className="editor-hint" role="status">{tool === 'remove' ? 'Click a piece to remove it.' : tool === 'add'
          ? `Click a square to place a ${addColor} ${addRole}.`
          : piece ? `${name(piece)} selected. Click its destination; an occupied square replaces that piece.`
            : 'Click a piece, then click its destination. Moves can go to any square.'}</p>
        <p id="editor-position" className="sr-only">{pieces.filter(item => item.zone === 'board').map(item => `${name(item)} on ${item.square}`).join(', ')}</p>
      </div>
      <div className="editor-controls">
        <div className="editor-tools" role="group" aria-label="Editing tool">
          {(['move', 'add', 'remove'] as const).map(value => <button key={value} type="button" className="action-button"
            aria-pressed={tool === value} onClick={() => { setTool(value); setSelected(null); }}>
            {value === 'move' ? 'Move' : value === 'add' ? 'Add' : 'Remove'}</button>)}
        </div>
        {tool === 'add' && <div className="editor-fields">
          <label>Piece color<select value={addColor} onChange={event => setAddColor(event.target.value as Color)}>
            <option value="white">White</option><option value="black">Black</option>
          </select></label>
          <label>Piece type<select value={addRole} onChange={event => setAddRole(event.target.value as Role)}>
            {roles.map(role => <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>)}
          </select></label>
        </div>}
        {tool === 'move' && offBoard.length > 0 && <label>Restore a piece<select value={piece?.zone !== 'board' ? selected ?? '' : ''}
          onChange={event => setSelected(event.target.value || null)}>
          <option value="">Choose an off-board piece…</option>
          {offBoard.map(item => <option key={item.id} value={item.id}>{name(item)} · {item.zone} · {item.id}</option>)}
        </select></label>}
        {tool === 'move' && piece && <fieldset className="editor-piece-details"><legend>{name(piece)}{piece.square ? ` · ${piece.square}` : ''}</legend>
          <label>Color<select value={piece.owner} onChange={event => updatePiece({ owner: event.target.value as Color })}>
            <option value="white">White</option><option value="black">Black</option>
          </select></label>
          <label>Type<select value={piece.role} onChange={event => updatePiece({ role: event.target.value as Role })}>
            {roles.map(role => <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>)}
          </select></label>
          <label className="editor-check"><input type="checkbox" checked={piece.royal} onChange={event => updatePiece({ royal: event.target.checked })} />Royal (must stay safe)</label>
          <label className="editor-check"><input type="checkbox" checked={piece.neutral} onChange={event => updatePiece({ neutral: event.target.checked })} />Neutral</label>
          <label className="editor-check"><input type="checkbox" checked={piece.promoted} onChange={event => updatePiece({ promoted: event.target.checked })} />Promoted</label>
        </fieldset>}
        <label>Side to play<select value={color} onChange={event => setColor(event.target.value as Color)}>
          <option value="white">White</option><option value="black">Black</option>
        </select></label>
        <label>Move status<select value={String(moveMade)} onChange={event => setMoveMade(event.target.value === 'true')}>
          <option value="false">Still to move</option><option value="true">Move complete</option>
        </select></label>
        <p className="editor-note">Hands and continuing effects stay. Applying a correction closes pending card responses and timers. En passant is cleared.</p>
        {error && <p className="editor-error" role="alert">{error}</p>}
        <div className="editor-actions">
          <button className="action-button" type="button" onClick={() => {
            setPieces(piecesForEditing(state)); setColor(state.turn.color); setMoveMade(state.turn.moveMade); setSelected(null); setError(null);
          }}>Reset edits</button>
          <button className="action-button" type="button" data-primary="true" onClick={apply}>Apply position</button>
        </div>
      </div>
    </div>
  </dialog>;
}
