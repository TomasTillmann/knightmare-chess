"""Generate independently predicted ordinary-chess positions and transitions."""
import argparse
import json
import random
import chess

parser = argparse.ArgumentParser()
parser.add_argument('--seed', type=int, default=909001)
parser.add_argument('--games', type=int, default=10)
parser.add_argument('--plies', type=int, default=80)
args = parser.parse_args()
rng = random.Random(args.seed)
for game in range(args.games):
    board = chess.Board()
    for ply in range(args.plies):
        legal = sorted(board.legal_moves, key=lambda move: move.uci())
        if not legal:
            break
        move = rng.choice(legal)
        fen = board.fen(en_passant='fen')
        destinations = sorted(set(move.uci()[:4] for move in legal))
        checks = [board.is_attacked_by(not piece.color, square)
                  for color in [chess.WHITE, chess.BLACK]
                  for square in [board.king(color)]
                  for piece in [board.piece_at(square)]]
        board.push(move)
        print(json.dumps({'seed': args.seed, 'game': game, 'ply': ply, 'fen': fen,
                          'destinations': destinations, 'move': move.uci(),
                          'after': board.fen(en_passant='legal'), 'checks': checks}))
